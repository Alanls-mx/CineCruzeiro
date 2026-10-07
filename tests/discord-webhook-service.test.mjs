import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  createDiscordWebhookService,
  validateDiscordWebhookUrl,
  eventEmbed,
  shouldForward
} = require("../backend/services/discordWebhookService.js");
const integrationConfigService = require("../backend/services/integrationConfigService.js");

const webhookUrl = `https://discord.com/api/webhooks/${"1".repeat(18)}/${"x".repeat(68)}`;

test("Discord webhook URL accepts only official HTTPS webhook endpoints", () => {
  assert.equal(validateDiscordWebhookUrl(webhookUrl), true);
  assert.equal(validateDiscordWebhookUrl(webhookUrl.replace("https://", "http://")), false);
  assert.equal(validateDiscordWebhookUrl(webhookUrl.replace("discord.com", "example.com")), false);
  assert.equal(validateDiscordWebhookUrl(`${webhookUrl}?redirect=https://example.com`), false);
});

test("integration settings validate and mask the Discord URL as a secret", () => {
  const db = { settings: {}, integrations: {}, auditLogs: [] };
  assert.throws(
    () => integrationConfigService.save(db, "discord", { webhookUrl: "https://attacker.example/hook" }, { id: "admin-test" }),
    { code: "DISCORD_WEBHOOK_URL_INVALID" }
  );
  const saved = integrationConfigService.save(db, "discord", { webhookUrl }, { id: "admin-test" });
  const resolved = integrationConfigService.resolvedConfig(db, "discord");
  assert.equal(saved.configured, true);
  assert.equal(saved.secrets.webhookUrl.hasValue, true);
  assert.equal(saved.secrets.webhookUrl.source, "stored");
  assert.equal(saved.secrets.webhookUrl.masked, undefined);
  assert.equal(Object.values(saved.values).includes(webhookUrl), false);
  assert.equal(resolved.webhookUrl, webhookUrl);
});

test("alert filtering sends warnings, errors, performance and security while info is optional", () => {
  assert.equal(shouldForward({ level: "warn", event: "database.query" }, false), true);
  assert.equal(shouldForward({ level: "info", event: "payment.created" }, false), false);
  assert.equal(shouldForward({ level: "info", event: "performance.anomaly" }, false), true);
  assert.equal(shouldForward({ level: "info", event: "security.suspicious_request" }, false), true);
  assert.equal(shouldForward({ level: "info", event: "payment.created" }, true), true);
});

test("event embeds omit personal and unapproved fields", () => {
  const embed = eventEmbed({
    level: "warn",
    event: "security.suspicious_request",
    requestId: "req-123",
    fields: { attackType: "possible_sql_injection", rule: "sqli.union_select", path: "/api/items/1%27%20UNION%20SELECT%20email", ip: "203.0.113.5", email: "person@example.com", body: "secret" }
  });
  const text = JSON.stringify(embed);
  assert.match(text, /Possível tentativa de injeção SQL/);
  assert.match(text, /sqli\.union_select/);
  assert.doesNotMatch(text, /UNION|SELECT/);
  assert.doesNotMatch(text, /203\.0\.113\.5|person@example\.com|secret/);
  assert.equal(embed.title, "Padrão suspeito detectado");
  assert.match(embed.description, /API do site/);
});

test("HTTP completion embeds explain the affected area, route, status and duration in Portuguese", () => {
  const embed = eventEmbed({
    level: "info",
    event: "http.request.completed",
    requestId: "req-123",
    fields: { method: "GET", path: "/api/admin/payments/123456", statusCode: 200, durationMs: 17 }
  });
  const text = JSON.stringify(embed);
  assert.equal(embed.title, "Requisição HTTP concluída");
  assert.match(embed.description, /Consulta em painel administrativo · pagamentos respondeu HTTP 200 \(sucesso\)/i);
  assert.match(text, /Área afetada/);
  assert.match(text, /\/api\/admin\/payments\/:id/);
  assert.match(text, /Duração.*17 ms/);
  assert.match(text, /ID da requisição/);
  assert.doesNotMatch(text, /"method"|"path"|"statusCode"|"durationMs"/);
});

test("failed request embeds include technical type and a sanitized cause", () => {
  const embed = eventEmbed({
    level: "error",
    event: "request.failed",
    requestId: "req-failed",
    fields: {
      method: "POST",
      path: "/api/checkout",
      status: 500,
      code: "ECONNREFUSED",
      errorType: "TypeError",
      message: "Cannot connect as alan@example.com using Bearer abc123",
      cause: "postgres://admin:password@db.internal/cinema"
    }
  });
  const text = JSON.stringify(embed);
  assert.equal(embed.title, "Falha ao processar requisição");
  assert.match(embed.description, /checkout e pagamento/i);
  assert.match(embed.description, /conexão do banco ocultada/);
  assert.match(embed.description, /Mensagem: Cannot connect/);
  assert.match(text, /ECONNREFUSED · conexão recusada pelo serviço de destino/);
  assert.match(text, /TypeError · Erro de tipo/);
  assert.doesNotMatch(text, /alan@example\.com|abc123|admin:password/);
});

test("release and outage embeds explain the failure stage and human-readable cause", () => {
  const embed = eventEmbed({
    level: "error",
    event: "deployment.failed",
    fields: {
      failureStage: "health_check",
      outageDetected: true,
      outageType: "health_check_unreachable",
      attemptedVersion: "2.4.0+abc1234",
      cause: "servidor não respondeu"
    }
  });
  const text = JSON.stringify(embed);
  assert.match(embed.description, /checagem de disponibilidade/);
  assert.match(embed.description, /servidor não respondeu à checagem/);
  assert.match(embed.description, /2\.4\.0\+abc1234/);
  assert.match(text, /Versão tentada/);
  assert.match(text, /Etapa da falha/);
});

test("service batches and posts alert embeds asynchronously with mentions disabled", async () => {
  const sent = [];
  const service = createDiscordWebhookService({
    fetchImpl: async (url, options) => {
      sent.push({ url, body: JSON.parse(options.body), redirect: options.redirect });
      return { ok: true, status: 204 };
    }
  });
  service.setConfig({ enabled: true, configured: true, webhookUrl, includeInfo: false });
  service.enqueue({ level: "warn", event: "security.suspicious_request", fields: { rule: "sqli.union_select" } });
  await new Promise((resolve) => setTimeout(resolve, 600));
  service.close();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, webhookUrl);
  assert.equal(sent[0].redirect, "error");
  assert.equal(sent[0].body.allowed_mentions.parse.length, 0);
  assert.equal(sent[0].body.embeds[0].title, "Padrão suspeito detectado");
});

test("test action publishes a minimal verification embed", async () => {
  let payload;
  const service = createDiscordWebhookService({
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return { ok: true, status: 204 };
    }
  });
  const result = await service.test({ webhookUrl });
  service.close();
  assert.equal(result.ok, true);
  assert.equal(payload.embeds[0].title, "Teste da integração Discord");
  assert.deepEqual(payload.allowed_mentions.parse, []);
});
