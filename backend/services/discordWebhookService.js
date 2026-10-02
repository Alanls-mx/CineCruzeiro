const MAX_QUEUE_SIZE = 200;
const MAX_EMBEDS_PER_MESSAGE = 5;
const SEND_TIMEOUT_MS = 5000;
const RETRY_LIMIT = 2;
const EVENT_FIELD_ALLOWLIST = new Set([
  "status", "statusCode", "code", "reason", "rule", "attackType", "method", "path",
  "durationMs", "count", "threshold", "windowSeconds", "cpuPercent", "httpStatus"
]);

function validateDiscordWebhookUrl(input) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    return false;
  }
  return url.protocol === "https:"
    && url.hostname === "discord.com"
    && !url.port
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && /^\/api\/webhooks\/\d{15,22}\/[A-Za-z0-9._-]{20,}$/.test(url.pathname);
}

function cleanText(value, limit = 180) {
  return String(value ?? "")
    .replace(/@/g, "＠")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, limit);
}

function cleanPath(value) {
  const segments = String(value ?? "").split("?")[0].split("/").map((segment) => {
    if (!segment) return "";
    if (segment.length > 64 || /@|%40|%27|'|%22|"|;|%3b|--|union|select|sleep|benchmark|\b1%?=1\b/i.test(segment)) return ":redacted";
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d{3,}$/.test(segment)) return ":id";
    return segment;
  });
  return cleanText(segments.join("/"), 220);
}

function eventEmbed(log = {}) {
  const level = String(log.level || "info").toLowerCase();
  const colors = { error: 0xe5484d, warn: 0xe5a000, info: 0x3b82f6 };
  const title = cleanText(log.event || "Evento do sistema", 240);
  const fields = [];
  const payload = log.fields && typeof log.fields === "object" ? log.fields : {};
  for (const [key, value] of Object.entries(payload)) {
    if (!EVENT_FIELD_ALLOWLIST.has(key) || value === null || value === undefined || typeof value === "object") continue;
    const safeValue = key === "path" ? cleanPath(value) : cleanText(value, 160);
    if (safeValue) fields.push({ name: cleanText(key, 40), value: safeValue, inline: true });
    if (fields.length === 6) break;
  }
  const metrics = payload.metrics && typeof payload.metrics === "object" ? payload.metrics : {};
  const metricFields = [
    ["cpuPercent", "CPU"],
    ["latencyRequestP95Ms", "HTTP p95"],
    ["eventLoopP95Ms", "Event loop p95"],
    ["errors5xx", "HTTP 5xx"]
  ];
  for (const [key, label] of metricFields) {
    if (metrics[key] === null || metrics[key] === undefined || fields.length === 10) continue;
    const suffix = key.endsWith("Ms") ? " ms" : key === "cpuPercent" ? "%" : "";
    fields.push({ name: label, value: cleanText(`${metrics[key]}${suffix}`, 40), inline: true });
  }
  if (log.requestId) fields.push({ name: "Request ID", value: cleanText(log.requestId, 60), inline: true });
  return {
    title,
    description: `Nível: **${cleanText(level.toUpperCase(), 12)}**`,
    color: colors[level] || colors.info,
    fields,
    timestamp: new Date(log.timestamp || Date.now()).toISOString(),
    footer: { text: "Cine Cruzeiro • telemetria com dados pessoais removidos" }
  };
}

function healthEmbed(snapshot = {}) {
  const metrics = snapshot.current || {};
  const percent = (used, total) => Number(total) > 0 ? `${Math.round(Number(used) / Number(total) * 100)}%` : "n/d";
  const diskAvailable = Number(metrics.diskAvailable);
  const diskTotal = Number(metrics.diskTotal);
  const memoryTotal = Number(metrics.memoryTotal);
  const memoryUsed = Number(metrics.memoryUsed);
  return {
    title: "Saúde do servidor",
    description: "Resumo periódico de desempenho e disponibilidade.",
    color: 0x24b47e,
    fields: [
      { name: "CPU", value: metrics.cpuPercent == null ? "n/d" : `${metrics.cpuPercent}%`, inline: true },
      { name: "Memória", value: percent(memoryUsed, memoryTotal), inline: true },
      { name: "Disco livre", value: percent(diskAvailable, diskTotal) === "n/d" ? "n/d" : `${percent(diskAvailable, diskTotal)} livre`, inline: true },
      { name: "HTTP p95 (60s)", value: metrics.latencyRequestP95Ms == null ? "n/d" : `${metrics.latencyRequestP95Ms} ms`, inline: true },
      { name: "Erros HTTP 5xx", value: String(metrics.errors5xx ?? 0), inline: true },
      { name: "Event loop p95", value: metrics.eventLoopP95Ms == null ? "n/d" : `${metrics.eventLoopP95Ms} ms`, inline: true }
    ],
    timestamp: new Date(metrics.sampledAt || Date.now()).toISOString(),
    footer: { text: "Cine Cruzeiro • amostra agregada, sem dados de clientes" }
  };
}

function shouldForward(log, includeInfo) {
  const level = String(log.level || "info").toLowerCase();
  const event = String(log.event || "").toLowerCase();
  return level === "warn" || level === "error"
    || /^(performance|security|abuse|attack|sql_injection)\./.test(event)
    || event === "request.failed"
    || (includeInfo && level === "info");
}

function createDiscordWebhookService({ fetchImpl = globalThis.fetch, logger = () => {}, timers = globalThis, maxQueue = MAX_QUEUE_SIZE } = {}) {
  let config = { enabled: false, webhookUrl: "", includeInfo: false, healthIntervalMinutes: 5 };
  let queue = [];
  let dropped = 0;
  let flushTimer = null;
  let healthTimer = null;
  let sending = false;
  let closed = false;

  async function postEmbeds(embeds, url = config.webhookUrl, attempt = 0) {
    const controller = new AbortController();
    const timeout = timers.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }),
        signal: controller.signal,
        redirect: "error"
      });
      if (response.ok || response.status === 204) return true;
      if (response.status === 429 && attempt < RETRY_LIMIT) {
        let retryAfter = Number(response.headers?.get?.("retry-after")) * 1000;
        if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
          const body = await response.json().catch(() => ({}));
          retryAfter = Number(body.retry_after) * 1000;
        }
        await new Promise((resolve) => timers.setTimeout(resolve, Math.min(Math.max(retryAfter || 1000, 250), 10000)));
        return postEmbeds(embeds, url, attempt + 1);
      }
      if (response.status >= 500 && attempt < RETRY_LIMIT) {
        await new Promise((resolve) => timers.setTimeout(resolve, 300 * (attempt + 1)));
        return postEmbeds(embeds, url, attempt + 1);
      }
      logger({ event: "discord.delivery_failed", status: response.status });
      return false;
    } catch (error) {
      if (attempt < RETRY_LIMIT) {
        await new Promise((resolve) => timers.setTimeout(resolve, 300 * (attempt + 1)));
      return postEmbeds(embeds, url, attempt + 1);
      }
      logger({ event: "discord.delivery_failed", reason: error.name === "AbortError" ? "timeout" : "network" });
      return false;
    } finally {
      timers.clearTimeout(timeout);
    }
  }

  async function flush() {
    if (sending || closed || !config.enabled || !validateDiscordWebhookUrl(config.webhookUrl) || !queue.length) return;
    sending = true;
    const batch = queue.splice(0, MAX_EMBEDS_PER_MESSAGE);
    if (dropped > 0) {
      batch.unshift({
        title: "Eventos agrupados",
        description: `${dropped} evento(s) foram omitidos porque a fila atingiu o limite configurado.`,
        color: 0xe5a000,
        timestamp: new Date().toISOString()
      });
      dropped = 0;
      batch.splice(MAX_EMBEDS_PER_MESSAGE);
    }
    try {
      if (!await postEmbeds(batch)) dropped += batch.length;
    } finally {
      sending = false;
      if (queue.length && !closed) scheduleFlush(1000);
    }
  }

  function scheduleFlush(delay = 500) {
    if (flushTimer || closed) return;
    flushTimer = timers.setTimeout(() => {
      flushTimer = null;
      void flush();
    }, delay);
    flushTimer.unref?.();
  }

  function setConfig(next = {}) {
    config = {
      enabled: Boolean(next.enabled && next.configured && validateDiscordWebhookUrl(next.webhookUrl)),
      webhookUrl: String(next.webhookUrl || ""),
      includeInfo: Boolean(next.includeInfo),
      healthIntervalMinutes: Math.min(60, Math.max(1, Number(next.healthIntervalMinutes) || 5))
    };
    if (!config.enabled) {
      queue = [];
      dropped = 0;
      if (flushTimer) timers.clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function enqueue(log = {}) {
    if (!config.enabled || !shouldForward(log, config.includeInfo)) return;
    if (queue.length >= maxQueue) {
      dropped += 1;
      return;
    }
    queue.push(eventEmbed(log));
    scheduleFlush();
  }

  function enqueueHealth(snapshot) {
    if (!config.enabled) return;
    queue.push(healthEmbed(snapshot));
    if (queue.length > maxQueue) {
      queue.shift();
      dropped += 1;
    }
    scheduleFlush();
  }

  function test(configInput) {
    if (!validateDiscordWebhookUrl(configInput?.webhookUrl)) {
      return Promise.resolve({ ok: false, message: "Informe uma URL válida de webhook oficial do Discord." });
    }
    return postEmbeds([{
      title: "Teste da integração Discord",
      description: "O Cine Cruzeiro conseguiu enviar este embed de verificação.",
      color: 0x5865f2,
      timestamp: new Date().toISOString(),
      footer: { text: "Teste • sem dados de operação" }
    }], configInput.webhookUrl).then((ok) => ({ ok, message: ok ? "Webhook do Discord conectado com sucesso." : "O Discord não aceitou o embed de teste." }));
  }

  function close() {
    closed = true;
    if (flushTimer) timers.clearTimeout(flushTimer);
    if (healthTimer) timers.clearInterval(healthTimer);
    flushTimer = null;
    healthTimer = null;
    queue = [];
  }

  return {
    setConfig,
    enqueue,
    enqueueHealth,
    test,
    isEnabled: () => config.enabled,
    healthIntervalMs: () => config.healthIntervalMinutes * 60 * 1000,
    close
  };
}

module.exports = { createDiscordWebhookService, validateDiscordWebhookUrl, eventEmbed, healthEmbed, shouldForward };
