import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repository = require("../backend/services/emailCampaignRepository");
const { queryPostgres, postgresEnabled } = require("../backend/db/postgresStore");

test("chave idempotente devolve a campanha existente sem sinalizar nova criação", { skip: !postgresEnabled() }, async () => {
  const suffix = Date.now();
  const id = `campaign-idempotent-${suffix}`;
  const key = `request-${suffix}`;
  try {
    const first = await repository.createCampaign({ id, idempotencyKey: key, subject: "Primeira", html: "<p>Teste</p>" });
    const repeated = await repository.createCampaign({ id: `${id}-repeated`, idempotencyKey: key, subject: "Repetida", html: "<p>Outro</p>" });
    assert.equal(first.created, true);
    assert.equal(repeated.created, false);
    assert.equal(repeated.campaign.id, id);
    assert.equal(repeated.campaign.subject, "Primeira");
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE idempotency_key = $1", [key]).catch(() => null);
  }
});

test("dois workers não reivindicam a mesma campanha", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-concurrency-${Date.now()}`;
  try {
    await repository.createCampaign({ id, subject: "Concorrência", html: "<p>Teste</p>", status: "queued", createdAt: new Date().toISOString() });
    const claims = await Promise.all([
      repository.claimCampaign(`worker-a-${id}`, 60000),
      repository.claimCampaign(`worker-b-${id}`, 60000)
    ]);
    assert.equal(claims.filter((claim) => claim?.id === id).length, 1);
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});

test("dois workers não reivindicam o mesmo destinatário", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-recipient-concurrency-${Date.now()}`;
  try {
    await repository.createCampaign({ id, subject: "Destinatário único", html: "<p>Teste</p>", status: "queued" });
    await repository.snapshotRecipients(id, [{ email: `${id}@example.com`, name: "Cliente" }]);
    const claims = await Promise.all([
      repository.claimRecipients(id, `worker-a-${id}`, 1, 3),
      repository.claimRecipients(id, `worker-b-${id}`, 1, 3)
    ]);
    assert.equal(claims.flat().length, 1);
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});

test("cancelamento impede claim posterior e cancela pendentes", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-cancel-${Date.now()}`;
  try {
    await repository.createCampaign({ id, subject: "Cancelar", html: "<p>Teste</p>", status: "scheduled", scheduleAt: new Date(Date.now() + 60000).toISOString() });
    await repository.snapshotRecipients(id, [{ email: `${id}@example.com`, name: "Cliente" }]);
    const cancelled = await repository.transitionCampaign(id, "cancelled", { from: ["scheduled"] });
    assert.equal(cancelled?.status, "cancelled");
    const recipients = await repository.listRecipients(id, { status: "cancelled" });
    assert.equal(recipients.total, 1);
    const campaign = await repository.getCampaign(id);
    assert.equal(campaign.status, "cancelled");
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});

test("conclusão em andamento não sobrescreve campanha cancelada", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-cancel-race-${Date.now()}`;
  const workerId = `worker-${id}`;
  try {
    await repository.createCampaign({ id, subject: "Cancelar em andamento", html: "<p>Teste</p>", status: "queued" });
    await repository.snapshotRecipients(id, [{ email: `${id}@example.com`, name: "Cliente" }]);
    const claimedCampaign = await repository.claimCampaign(workerId, 60000);
    assert.equal(claimedCampaign?.id, id);
    const [recipient] = await repository.claimRecipients(id, workerId, 1, 3);
    const attempt = await repository.startAttempt(recipient, "smtp");
    const cancelled = await repository.transitionCampaign(id, "cancelled", { from: ["sending"] });
    assert.equal(cancelled?.status, "cancelled");
    await repository.completeAttempt({ recipient, attemptId: attempt.id, outcome: { status: "sent", provider: "smtp" } });
    const reconciled = await repository.reconcileCampaign(id, workerId);
    assert.equal(reconciled?.status, "cancelled");
    assert.equal(reconciled?.sent, 1);
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});

test("lock abandonado antes da tentativa volta a pendente sem consumir retry", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-recovery-${Date.now()}`;
  try {
    await repository.createCampaign({ id, subject: "Recuperação", html: "<p>Teste</p>", status: "queued" });
    await repository.snapshotRecipients(id, [{ email: `${id}@example.com`, name: "Cliente" }]);
    const [recipient] = await repository.claimRecipients(id, `lost-worker-${id}`, 1, 3);
    assert.equal(recipient.attemptCount, 1);
    await queryPostgres("UPDATE email_campaign_recipients SET locked_at = now() - interval '10 minutes' WHERE id = $1", [recipient.id]);
    await repository.claimCampaign(`recovery-worker-${id}`, 30000);
    const recovered = await repository.listRecipients(id, { status: "pending" });
    assert.equal(recovered.recipients[0]?.attemptCount, 0);
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});

test("retentativa manual cria um novo número sem apagar o histórico", { skip: !postgresEnabled() }, async () => {
  const id = `campaign-manual-retry-${Date.now()}`;
  try {
    await repository.createCampaign({ id, subject: "Retentativa manual", html: "<p>Teste</p>", status: "queued" });
    await repository.snapshotRecipients(id, [{ email: `${id}@example.com`, name: "Cliente" }]);
    const [recipient] = await repository.claimRecipients(id, `worker-${id}`, 1, 3);
    const attempt = await repository.startAttempt(recipient, "smtp");
    await repository.completeAttempt({
      recipient,
      attemptId: attempt.id,
      outcome: { status: "failed", retryable: true, provider: "smtp", errorCode: "TEMPORARY", errorMessage: "Falha temporária" }
    });
    await queryPostgres("UPDATE email_campaigns SET status = 'failed' WHERE id = $1", [id]);

    const retried = await repository.retryFailures(id);
    assert.equal(retried?.retried, 1);
    const [manual] = await repository.claimRecipients(id, `manual-worker-${id}`, 1, 1);
    assert.equal(manual?.attemptCount, 2);
    const manualAttempt = await repository.startAttempt(manual, "smtp");
    assert.equal(Number(manualAttempt.attempt_number), 2);
  } finally {
    await queryPostgres("DELETE FROM email_campaigns WHERE id = $1", [id]).catch(() => null);
  }
});
