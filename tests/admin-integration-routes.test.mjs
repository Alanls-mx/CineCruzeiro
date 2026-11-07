import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminIntegrationRoutes } = require("../backend/services/adminIntegrationRoutes.js");

function fixture(overrides = {}) {
  const responses = [];
  const handle = createAdminIntegrationRoutes({
    activeOnlinePaymentProvider: () => ({ provider: "mercado_pago", name: "Mercado Pago", config: { enabled: true, configured: true, publicKey: "public" } }),
    isProduction: () => true,
    integrationConfigService: { providerKey: () => "", resolvedConfig: () => ({ accessToken: "secret" }) },
    roleAlias: (role) => role,
    sendJson: (_res, status, body, headers) => responses.push({ status, body, headers }),
    ...overrides
  });
  const request = (pathname, method = "GET") => handle({
    req: { url: pathname, headers: { host: "localhost" }, adminUser: { id: "staff-1", role: "operator" } },
    res: {}, pathname, method, db: { settings: {} }
  });
  return { request, responses };
}

test("import and composition do not invoke provider or worker", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/health"), false);
  assert.deepEqual(responses, []);
});

test("public payment config keeps no-store and production status", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/payments/config"), true);
  assert.equal(responses[0].status, 200);
  assert.deepEqual(responses[0].headers, { "Cache-Control": "no-store" });
  assert.equal(responses[0].body.provider, "mercado_pago");
  assert.equal(responses[0].body.environment, "production");
  assert.equal(responses[0].body.checkoutAvailable, true);
});

test("commercial token keeps owner-only guard before revealing secret", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/admin/integrations/commercialCatalog/access-token"), true);
  assert.equal(responses[0].status, 403);
  assert.equal(responses[0].body.error.code, "COMMERCIAL_CATALOG_TOKEN_FORBIDDEN");
  assert.equal(JSON.stringify(responses).includes("secret"), false);
});

test("unknown provider retains 404 without calling test provider", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/admin/integrations/unknown", "POST"), true);
  assert.deepEqual(responses[0].body, { error: { code: "INTEGRATION_NOT_FOUND", message: "Integração não encontrada." } });
});
