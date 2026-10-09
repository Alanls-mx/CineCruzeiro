import test from "node:test";
import assert from "node:assert/strict";
import paymentService from "../backend/services/paymentService.js";
import integrationConfigService from "../backend/services/integrationConfigService.js";

const order = { id: "SANDBOX-test", movieTitle: "Teste de cartão", totalPrice: 10, customerEmail: "test@testuser.com" };
const config = { environment: "sandbox", publicKey: "TEST-public", accessToken: "APP_USR-test-private" };
const card = { token: "card-token", paymentMethodId: "visa", installments: 1 };

test("sandbox exige chave pública de teste e permanece separado do checkout real", async () => {
  const previousEnv = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "production";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.headers.Authorization, `Bearer ${config.accessToken}`);
    assert.equal(JSON.parse(options.body).payer.email, "test@testuser.com");
    return { ok: true, json: async () => ({ id: "test-order", live_mode: false, transactions: { payments: [{ status: "processed", status_detail: "accredited", amount: "10.00" }] } }) };
  };
  try {
    await assert.rejects(paymentService.createMercadoPagoOrderPayment(order, config, { method: "credit_card", card }), { code: "MERCADO_PAGO_PRODUCTION_REQUIRED" });
    assert.equal(calls, 0);
    const result = await paymentService.createMercadoPagoOrderPayment(order, config, { method: "credit_card", card, sandboxTest: true });
    assert.equal(result.status, "approved");
    assert.equal(calls, 1);
    await assert.rejects(paymentService.createMercadoPagoOrderPayment(order, { ...config, publicKey: "production-public" }, { method: "credit_card", card, sandboxTest: true }), { code: "MERCADO_PAGO_TEST_CREDENTIALS_REQUIRED" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test("integração de teste não aceita chave pública de produção", () => {
  assert.equal(integrationConfigService.isConfigured("mercadoPagoSandbox", config), true);
  assert.equal(integrationConfigService.isConfigured("mercadoPagoSandbox", { ...config, publicKey: "APP_USR-production" }), false);
});
