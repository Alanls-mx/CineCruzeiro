import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  CRM_EVENT_TYPES,
  normalizeCrmEvents,
  sendCrmWebhook,
  retryDelayMs,
  createCrmWebhookWorker
} = require("../backend/services/crmWebhookDeliveryService.js");
const integrationConfigService = require("../backend/services/integrationConfigService.js");

function outboxRepository(seed, now = Date.now) {
  const items = [structuredClone(seed)];
  return {
    items,
    async claimNext() {
      const item = items.find((entry) => entry.status === "queued" && Date.parse(entry.nextAttemptAt) <= now());
      if (!item) return null;
      item.status = "processing";
      item.attempts += 1;
      return structuredClone(item);
    },
    async deliver(id, httpStatus) { Object.assign(items.find((entry) => entry.id === id), { status: "delivered", httpStatus }); },
    async fail(id, failure) { Object.assign(items.find((entry) => entry.id === id), failure); },
    async cancel(id, errorCode) { Object.assign(items.find((entry) => entry.id === id), { status: "cancelled", errorCode }); }
  };
}

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > 3000) { clearInterval(timer); reject(new Error("Timed out waiting for CRM outbox state")); }
    }, 10);
  });
}

test("event selection normalizes legacy comma strings and rejects unknown event names", () => {
  assert.deepEqual(normalizeCrmEvents("payment.approved, unknown.event, ticket.used"), ["payment.approved", "ticket.used"]);
  assert.equal(CRM_EVENT_TYPES.includes("private_rental.inquiry"), true);
});

test("CRM integration persists only selected events and keeps the HMAC key masked", () => {
  const db = { settings: {}, integrations: {}, auditLogs: [] };
  const url = "https://crm.example/hooks/cine";
  const secret = "crm-secret-that-must-not-leak";
  const saved = integrationConfigService.save(db, "crm", {
    url,
    secret,
    events: ["payment.approved", "unknown.event"],
    timeout: 5000,
    retryLimit: 4
  }, { id: "crm-test" });
  const resolved = integrationConfigService.resolvedConfig(db, "crm");
  assert.equal(saved.configured, true);
  assert.equal(saved.secrets.secret.hasValue, true);
  assert.deepEqual(saved.values.events, ["payment.approved"]);
  assert.equal(JSON.stringify(saved).includes(secret), false);
  assert.equal(resolved.secret, secret);
  assert.deepEqual(normalizeCrmEvents(resolved.events), ["payment.approved"]);
});

test("CRM deliveries sign the exact request body with timestamp and stable event id", async () => {
  let request;
  const body = { event: "payment.approved", eventId: "evt-1", data: { orderId: "order-1" } };
  const result = await sendCrmWebhook({
    url: "https://crm.example/hooks/cine",
    secret: "crm-secret-for-tests",
    eventId: "evt-1",
    eventName: body.event,
    body,
    now: () => 1790953200000,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 204 };
    }
  });
  const timestamp = String(Math.floor(1790953200000 / 1000));
  const expected = crypto.createHmac("sha256", "crm-secret-for-tests").update(`${timestamp}.${JSON.stringify(body)}`).digest("hex");
  assert.equal(result.ok, true);
  assert.equal(request.options.headers["X-Cine-Cruzeiro-Timestamp"], timestamp);
  assert.equal(request.options.headers["X-Cine-Cruzeiro-Signature"], `sha256=${expected}`);
  assert.equal(request.options.headers["X-Cine-Cruzeiro-Event-Id"], "evt-1");
  assert.equal(request.options.headers["X-Cine-Cruzeiro-Event"], "payment.approved");
  assert.equal(request.options.redirect, "error");
});

test("retry policy uses bounded exponential backoff and honors retry-after", () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(4), 8000);
  assert.equal(retryDelayMs(20), 15 * 60 * 1000);
  assert.equal(retryDelayMs(1, 5000), 5000);
});

test("worker retries transient failures and delivers the same outbox item", async () => {
  let attempts = 0;
  let now = Date.now();
  const repository = outboxRepository({
    id: "evt-retry",
    eventName: "payment.approved",
    payload: { event: "payment.approved", eventId: "evt-retry" },
    attempts: 0,
    maxAttempts: 3,
    status: "queued",
    nextAttemptAt: new Date(now - 1).toISOString()
  }, () => now);
  let loggedDelivery = false;
  let retryScheduled = false;
  const worker = createCrmWebhookWorker({
    repository,
    getConfig: async () => ({ enabled: true, configured: true, url: "https://crm.example/hook", secret: "secret", events: ["payment.approved"], timeout: 1500 }),
    now: () => now,
    fetchImpl: async () => (++attempts === 1 ? { ok: false, status: 503, headers: { get: () => null } } : { ok: true, status: 204 }),
    logger: (_level, event) => {
      if (event === "crm_webhook.retry_scheduled") retryScheduled = true;
      if (event === "crm_webhook.delivered") loggedDelivery = true;
    }
  });
  worker.start();
  await waitFor(() => retryScheduled);
  worker.stop();
  assert.equal(repository.items[0].attempts, 1);
  now += 1000;
  worker.start();
  await waitFor(() => loggedDelivery);
  worker.stop();
  assert.equal(attempts, 2);
  assert.equal(repository.items[0].status, "delivered");
  assert.equal(repository.items[0].attempts, 2);
});

test("worker cancels queued events removed from the selection and dead-letters permanent errors", async () => {
  const repository = outboxRepository({
    id: "evt-cancel",
    eventName: "ticket.used",
    payload: { event: "ticket.used" },
    attempts: 0,
    maxAttempts: 3,
    status: "queued",
    nextAttemptAt: new Date(Date.now() - 1).toISOString()
  });
  let fetchCount = 0;
  const worker = createCrmWebhookWorker({
    repository,
    getConfig: async () => ({ enabled: true, configured: true, url: "https://crm.example/hook", secret: "secret", events: ["payment.approved"] }),
    fetchImpl: async () => { fetchCount += 1; return { ok: false, status: 401, headers: { get: () => null } }; }
  });
  worker.start();
  await waitFor(() => repository.items[0].status === "cancelled");
  worker.stop();
  assert.equal(fetchCount, 0);

  repository.items[0] = { ...repository.items[0], id: "evt-dead", eventName: "payment.approved", status: "queued", attempts: 0, nextAttemptAt: new Date(Date.now() - 1).toISOString() };
  worker.start();
  await waitFor(() => repository.items[0].status === "dead");
  worker.stop();
  assert.equal(repository.items[0].attempts, 1);
});
