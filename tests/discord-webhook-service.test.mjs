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
  assert.equal(saved.secrets.webhookUrl.masked.endsWith(webhookUrl.slice(-4)), true);
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
  assert.match(text, /possible_sql_injection/);
  assert.match(text, /sqli\.union_select/);
  assert.doesNotMatch(text, /UNION|SELECT/);
  assert.doesNotMatch(text, /203\.0\.113\.5|person@example\.com|secret/);
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
  assert.equal(sent[0].body.embeds[0].title, "security.suspicious_request");
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
