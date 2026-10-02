const crypto = require("node:crypto");

const CRM_EVENT_TYPES = [
  "order.created",
  "payment.created",
  "payment.approved",
  "payment.rejected",
  "payment.expired",
  "payment.refunded",
  "ticket.created",
  "ticket.used",
  "club_lead.created",
  "private_rental.inquiry",
  "password_reset.requested"
];

function normalizeCrmEvents(input) {
  const source = Array.isArray(input) ? input : String(input || "").split(",");
  return [...new Set(source.map((event) => String(event || "").trim()).filter((event) => CRM_EVENT_TYPES.includes(event)))];
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function signedHeaders({ payload, secret, eventId, eventName, now = Date.now() }) {
  const timestamp = String(Math.floor(now / 1000));
  const signature = crypto.createHmac("sha256", String(secret)).update(`${timestamp}.${payload}`).digest("hex");
  return {
    "Content-Type": "application/json",
    "X-Origin-Client": "CineCruzeiro-Backend",
    "X-Cine-Cruzeiro-Timestamp": timestamp,
    "X-Cine-Cruzeiro-Signature": `sha256=${signature}`,
    "X-Cine-Cruzeiro-Event-Id": String(eventId || ""),
    "X-Cine-Cruzeiro-Event": String(eventName || "")
  };
}

async function sendCrmWebhook({ url, secret, eventId, eventName, body, timeout = 8000, fetchImpl = globalThis.fetch, now = Date.now }) {
  if (!url || !secret) return { ok: false, retryable: false, errorCode: "CRM_CREDENTIALS_MISSING" };
  const serialized = JSON.stringify(body);
  const headers = signedHeaders({ payload: serialized, secret, eventId, eventName, now: now() });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedInteger(timeout, 8000, 1000, 30000));
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: serialized,
      signal: controller.signal,
      redirect: "error"
    });
    if (response.ok) return { ok: true, httpStatus: response.status };
    const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
    const retryAfterSeconds = Number(response.headers?.get?.("retry-after"));
    return {
      ok: false,
      retryable,
      httpStatus: response.status,
      errorCode: `CRM_HTTP_${response.status}`,
      retryAfterMs: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, 15 * 60 * 1000) : 0
    };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      errorCode: error.name === "AbortError" ? "CRM_TIMEOUT" : "CRM_NETWORK_ERROR"
    };
  } finally {
    clearTimeout(timer);
  }
}

function retryDelayMs(attempt, retryAfterMs = 0) {
  if (retryAfterMs > 0) return Math.min(15 * 60 * 1000, retryAfterMs);
  return Math.min(15 * 60 * 1000, 1000 * (2 ** Math.max(0, Number(attempt) - 1)));
}

function createCrmWebhookWorker({ repository, getConfig, fetchImpl = globalThis.fetch, logger = () => {}, now = Date.now, pollMs = 1000, batchSize = 10 } = {}) {
  let timer = null;
  let stopped = true;
  let draining = false;

  async function drain() {
    if (stopped || draining) return;
    draining = true;
    try {
      const config = await getConfig();
      if (!config?.enabled || !config?.configured || !config.url || !config.secret) return;
      for (let index = 0; index < batchSize && !stopped; index += 1) {
        const item = await repository.claimNext();
        if (!item) break;
        if (!normalizeCrmEvents(config.events).includes(item.eventName)) {
          await repository.cancel(item.id, "CRM_EVENT_DISABLED");
          logger("info", "crm_webhook.cancelled", { event: item.eventName, reason: "event_disabled" });
          continue;
        }
        const result = await sendCrmWebhook({
          url: config.url,
          secret: config.secret,
          eventId: item.id,
          eventName: item.eventName,
          body: item.payload,
          timeout: config.timeout,
          fetchImpl,
          now
        });
        if (result.ok) {
          await repository.deliver(item.id, result.httpStatus);
          logger("info", "crm_webhook.delivered", { event: item.eventName, attempt: item.attempts, httpStatus: result.httpStatus });
          continue;
        }
        const retry = result.retryable && item.attempts < item.maxAttempts;
        const nextAttemptAt = retry ? new Date(now() + retryDelayMs(item.attempts, result.retryAfterMs)).toISOString() : "";
        await repository.fail(item.id, {
          status: retry ? "queued" : "dead",
          httpStatus: result.httpStatus || 0,
          errorCode: result.errorCode || "CRM_DELIVERY_FAILED",
          nextAttemptAt
        });
        logger(retry ? "warn" : "error", retry ? "crm_webhook.retry_scheduled" : "crm_webhook.dead_lettered", {
          event: item.eventName,
          attempt: item.attempts,
          maxAttempts: item.maxAttempts,
          httpStatus: result.httpStatus || 0,
          code: result.errorCode || "CRM_DELIVERY_FAILED",
          retryAt: nextAttemptAt
        });
      }
    } catch (error) {
      logger("error", "crm_webhook.worker_failed", { code: error.code || "CRM_WORKER_ERROR" });
    } finally {
      draining = false;
    }
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    timer = setInterval(() => { void drain(); }, pollMs);
    timer.unref?.();
    void drain();
  }

  function wake() {
    if (!stopped) void drain();
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, wake, drain, stop };
}

module.exports = {
  CRM_EVENT_TYPES,
  normalizeCrmEvents,
  signedHeaders,
  sendCrmWebhook,
  retryDelayMs,
  createCrmWebhookWorker
};
