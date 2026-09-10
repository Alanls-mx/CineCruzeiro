import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repository = require("../backend/services/emailCampaignRepository");
const { createEmailCampaignWorker, _test: workerTest } = require("../backend/services/emailCampaignWorker");
const { _test: emailTest } = require("../backend/services/emailService");

test("máquina de estados impede transições que causariam reenvio", () => {
  assert.equal(repository.transitionAllowed("draft", "queued"), true);
  assert.equal(repository.transitionAllowed("scheduled", "cancelled"), true);
  assert.equal(repository.transitionAllowed("sending", "completed_with_errors"), true);
  assert.equal(repository.transitionAllowed("completed", "queued"), false);
  assert.equal(repository.transitionAllowed("cancelled", "sending"), false);
});

test("registros antigos são preservados como leitura legada", () => {
  const record = repository._test.campaignRecord({
    id: "legacy",
    subject: "Antiga",
    mode: "visual",
    recipientMode: "active",
    contentBlocks: [{ id: "a", type: "text", content: "Olá" }]
  });
  assert.equal(record.mode, "legacy_visual");
  assert.equal(record.recipient_mode, "recent");
  assert.deepEqual(record.legacy_content.contentBlocks, [{ id: "a", type: "text", content: "Olá" }]);
});

test("falha SMTP anterior ao envio permite fallback seguro", () => {
  const result = emailTest.smtpFailure({ code: "EAUTH", command: "AUTH", message: "auth failed" });
  assert.equal(result.status, "retryable_failed");
  assert.equal(result.safeToFallback, true);
});

test("timeout SMTP é incerto e não permite fallback automático", () => {
  const result = emailTest.smtpFailure({ code: "ETIMEDOUT", command: "DATA", message: "timeout" });
  assert.equal(result.status, "unknown");
  assert.equal(result.retryable, false);
  assert.equal(result.safeToFallback, false);
});

test("configuração do worker possui limites defensivos", () => {
  assert.equal(workerTest.positiveInteger(9999, 20, 1, 100), 100);
  assert.equal(workerTest.positiveInteger(-1, 20, 1, 100), 1);
  assert.equal(workerTest.positiveInteger("inválido", 20, 1, 100), 20);
});

test("worker persiste tentativa e conclui somente destinatário reivindicado", async () => {
  let claimedCampaign = false;
  let recipientClaimed = false;
  let completion = null;
  let status = "sending";
  const fakeRepository = {
    async claimCampaign() {
      if (claimedCampaign) return null;
      claimedCampaign = true;
      return { id: "campaign-1", status: "sending", subject: "Teste", templateId: "announcement" };
    },
    async snapshotRecipients() {},
    async getCampaign() { return { id: "campaign-1", status }; },
    async heartbeatCampaign() { return true; },
    async claimRecipients() {
      if (recipientClaimed) return [];
      recipientClaimed = true;
      return [{ id: "recipient-1", campaignId: "campaign-1", customerId: "user-1", recipientKey: "user:user-1", email: "cliente@example.com", name: "Cliente", deliveryId: "delivery-1", attemptCount: 1 }];
    },
    async startAttempt() { return { id: "attempt-1" }; },
    async completeAttempt(value) { completion = value; status = "completed"; },
    async reconcileCampaign() { return { id: "campaign-1", status }; },
    async deferCampaign() {},
    async failCampaign() { status = "failed"; }
  };
  const worker = createEmailCampaignWorker({
    repository: fakeRepository,
    readDb: async () => ({ users: [], orders: [] }),
    resolveAudience: () => ({ recipients: [{ id: "user-1", email: "cliente@example.com", name: "Cliente" }] }),
    deliver: async () => ({ status: "sent", provider: "smtp", providerMessageId: "message-1" }),
    pollMs: 1000
  });
  worker.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  worker.stop();
  assert.equal(completion?.recipient.id, "recipient-1");
  assert.equal(completion?.attemptId, "attempt-1");
  assert.equal(completion?.outcome.status, "sent");
});

test("limite automático preserva elegibilidade para reenvio manual", async () => {
  let completion = null;
  let claimed = false;
  const fakeRepository = {
    async claimCampaign() { return claimed ? null : (claimed = true, { id: "campaign-retry", status: "sending", templateId: "announcement" }); },
    async snapshotRecipients() {},
    async getCampaign() { return { id: "campaign-retry", status: "sending" }; },
    async heartbeatCampaign() { return true; },
    async claimRecipients() { return completion ? [] : [{ id: "recipient-retry", campaignId: "campaign-retry", customerId: "user-1", recipientKey: "user:user-1", email: "cliente@example.com", deliveryId: "delivery-retry", attemptCount: 3 }]; },
    async startAttempt() { return { id: "attempt-retry" }; },
    async completeAttempt(value) { completion = value; },
    async reconcileCampaign() { return { id: "campaign-retry", status: "failed" }; },
    async deferCampaign() {},
    async failCampaign() {}
  };
  const worker = createEmailCampaignWorker({
    repository: fakeRepository,
    readDb: async () => ({}),
    resolveAudience: () => ({ recipients: [{ id: "user-1", email: "cliente@example.com" }] }),
    deliver: async () => ({ status: "retryable_failed", provider: "smtp", errorCode: "SMTP_TEMPORARY" }),
    maxAttempts: 3
  });
  worker.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  worker.stop();
  assert.equal(completion?.outcome.status, "failed");
  assert.equal(completion?.outcome.retryable, true);
});

test("worker interrompe a campanha quando o público fica vazio na revalidação", async () => {
  let resolution = 0;
  let failedMessage = "";
  let claimedRecipient = false;
  const fakeRepository = {
    async claimCampaign() { return { id: "campaign-empty", status: "sending", templateId: "announcement" }; },
    async snapshotRecipients() {},
    async getCampaign() { return { id: "campaign-empty", status: "sending" }; },
    async heartbeatCampaign() { return true; },
    async claimRecipients() { claimedRecipient = true; return []; },
    async failCampaign(id, workerId, message) { failedMessage = message; return { id, status: "failed" }; }
  };
  const worker = createEmailCampaignWorker({
    repository: fakeRepository,
    readDb: async () => ({}),
    resolveAudience: () => ({ recipients: resolution++ === 0 ? [{ id: "user-1", email: "cliente@example.com" }] : [] })
  });
  worker.start();
  await new Promise((resolve) => setTimeout(resolve, 30));
  worker.stop();
  assert.match(failedMessage, /Nenhum destinatário continua elegível/);
  assert.equal(claimedRecipient, false);
});
