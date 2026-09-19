import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import integrationConfigService from "../backend/services/integrationConfigService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("catálogo comercial externo salva token criptografado e não o devolve ao painel", () => {
  const originalSecret = process.env.INTEGRATION_SECRET_KEY;
  process.env.INTEGRATION_SECRET_KEY = "commercial-catalog-test-secret";
  try {
    const db = { settings: {}, integrations: {}, auditLogs: [] };
    const saved = integrationConfigService.save(db, "commercialCatalog", {
      accessToken: "catalog_test_1234567890",
      allowedOrigins: "https://app.parceira.example",
      cacheSeconds: 90
    }, { id: "admin-test" });

    assert.equal(saved.configured, true);
    assert.equal(saved.secrets.accessToken.hasValue, true);
    assert.equal(saved.values.allowedOrigins, "https://app.parceira.example");
    assert.equal(saved.values.cacheSeconds, 90);
    assert.equal(saved.values.accessToken, undefined);
    assert.equal(db.integrations.commercialCatalog.accessToken.encrypted, true);
    assert.equal(integrationConfigService.resolvedConfig(db, "commercialCatalog").accessToken, "catalog_test_1234567890");
  } finally {
    if (originalSecret === undefined) delete process.env.INTEGRATION_SECRET_KEY;
    else process.env.INTEGRATION_SECRET_KEY = originalSecret;
  }
});

test("catálogo comercial possui endpoint protegido, CORS opcional e os conjuntos comerciais esperados", () => {
  const server = fs.readFileSync(path.join(root, "backend", "server.js"), "utf8");
  const admin = fs.readFileSync(path.join(root, "backend", "public", "admin.js"), "utf8");

  assert.match(server, /pathname === "\/api\/commercial\/catalog"/);
  assert.match(server, /catalogTokensMatch/);
  assert.match(server, /commercialCatalogCorsHeaders/);
  assert.match(server, /commercialCatalog\/access-token/);
  assert.match(server, /availableSessions/);
  assert.match(server, /concessions:/);
  assert.match(server, /promotions:/);
  assert.match(server, /coupons:/);
  assert.match(server, /dates/);
  assert.match(admin, /Gerar token seguro/);
  assert.match(admin, /Revelar token/);
  assert.match(admin, /Copiar token/);
  assert.match(admin, /Authorization: Bearer TOKEN/);
});
