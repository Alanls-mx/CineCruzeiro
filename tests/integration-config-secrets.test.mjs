import assert from "node:assert/strict";
import test from "node:test";
import integrationConfigService from "../backend/services/integrationConfigService.js";

test("credenciais de integrações distintas permanecem isoladas e não revelam sufixos", () => {
  const originalKey = process.env.INTEGRATION_SECRET_KEY;
  process.env.INTEGRATION_SECRET_KEY = "integration-config-secrets-test-key";
  try {
    const db = { settings: {}, integrations: {}, auditLogs: [] };
    integrationConfigService.save(db, "pagBank", { accessToken: "pagbank-secret-9380" });
    integrationConfigService.save(db, "mercadoPago", { accessToken: "mercadopago-secret-1042" });

    const pagBank = integrationConfigService.sanitizeConfig(db, "pagBank");
    const mercadoPago = integrationConfigService.sanitizeConfig(db, "mercadoPago");
    assert.deepEqual(pagBank.secrets.accessToken, { hasValue: true, source: "stored" });
    assert.deepEqual(mercadoPago.secrets.accessToken, { hasValue: true, source: "stored" });
    assert.equal(integrationConfigService.resolvedConfig(db, "pagBank").accessToken, "pagbank-secret-9380");
    assert.equal(integrationConfigService.resolvedConfig(db, "mercadoPago").accessToken, "mercadopago-secret-1042");
    assert.doesNotMatch(JSON.stringify(pagBank), /9380|1042/);
    assert.doesNotMatch(JSON.stringify(mercadoPago), /9380|1042/);
  } finally {
    if (originalKey === undefined) delete process.env.INTEGRATION_SECRET_KEY;
    else process.env.INTEGRATION_SECRET_KEY = originalKey;
  }
});
