import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import integrationConfigService from "../backend/services/integrationConfigService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function serviceAccount(overrides = {}) {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    type: "service_account",
    project_id: "cine-wallet-test",
    client_email: "wallet@cine-wallet-test.iam.gserviceaccount.com",
    private_key: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    ...overrides
  };
}

test("Google Wallet valida, salva e preserva a Service Account", () => {
  const db = { settings: {}, integrations: {}, auditLogs: [] };
  const account = serviceAccount();
  const saved = integrationConfigService.save(db, "googleWallet", {
    issuerId: "3388000000000000000",
    classId: "cine_ingressos",
    origins: "https://cinema.example",
    serviceAccountJson: JSON.stringify(account)
  }, { id: "admin-test" });

  assert.equal(saved.configured, true);
  assert.equal(saved.values.clientEmail, account.client_email);
  assert.equal(saved.secrets.serviceAccountJson.hasValue, true);

  const updated = integrationConfigService.save(db, "googleWallet", { classId: "cine_ingressos_v2" }, { id: "admin-test" });
  assert.equal(updated.values.classId, "cine_ingressos_v2");
  assert.equal(updated.values.clientEmail, account.client_email);
  assert.equal(updated.secrets.serviceAccountJson.hasValue, true);
});

test("Google Wallet rejeita JSON e chave privada inválidos antes de salvar", () => {
  const db = { settings: {}, integrations: {}, auditLogs: [] };
  assert.throws(
    () => integrationConfigService.save(db, "googleWallet", { serviceAccountJson: "{invalido" }),
    { code: "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_INVALID", statusCode: 422 }
  );
  assert.throws(
    () => integrationConfigService.save(db, "googleWallet", { serviceAccountJson: JSON.stringify(serviceAccount({ private_key: "chave-invalida" })) }),
    { code: "GOOGLE_WALLET_PRIVATE_KEY_INVALID", statusCode: 422 }
  );
});

test("painel salva alterações antes de testar a conexão", () => {
  const admin = fs.readFileSync(path.join(root, "backend", "public", "admin.js"), "utf8");
  const testFlow = admin.slice(admin.indexOf("async function testIntegration"), admin.indexOf("async function toggleIntegration"));
  assert.match(testFlow, /persistIntegrationForm\(\{ close: false, announce: false \}\)/);
  assert.ok(testFlow.indexOf("persistIntegrationForm") < testFlow.indexOf("/test"));
  assert.match(testFlow, /Salvando e testando/);
});
