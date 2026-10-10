import test from "node:test";
import assert from "node:assert/strict";
import paymentService from "../backend/services/paymentService.js";
import integrationConfigService from "../backend/services/integrationConfigService.js";

test("Mercado Pago não aceita sandbox nem expõe configuração de teste", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPaymentsMode = process.env.PAYMENTS_MODE;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "production";
  delete process.env.PAYMENTS_MODE;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("A credencial sandbox não deve gerar requisição."); };

  const sandboxConfig = {
    environment: "sandbox",
    publicKey: "TEST-public",
    accessToken: "TEST-private"
  };
  try {
    await assert.rejects(paymentService.createMercadoPagoOrderPayment({
      id: "sandbox-disabled",
      totalPrice: 10,
      customerEmail: "cliente@example.com"
    }, sandboxConfig, { method: "pix" }), {
      code: "MERCADO_PAGO_PRODUCTION_REQUIRED",
      statusCode: 412
    });
    assert.equal(requests, 0);

    const db = {
      settings: {
        integrations: {
          mercadoPago: sandboxConfig,
          mercadoPagoSandbox: { enabled: true, publicKey: "TEST-old", accessToken: "TEST-old" }
        }
      },
      integrations: {}
    };
    const resolved = integrationConfigService.resolvedConfig(db, "mercadoPago");
    assert.equal(resolved.environment, "production");
    assert.equal(resolved.configured, false);
    assert.equal(integrationConfigService.isConfigured("mercadoPago", sandboxConfig), false);
    assert.equal(db.integrations.mercadoPagoSandbox, undefined);
    assert.equal(integrationConfigService.providerKey("mercadoPagoSandbox"), "");
    assert.equal(integrationConfigService.DEFINITIONS.mercadoPagoSandbox, undefined);
    assert.equal(integrationConfigService.list(db).mercadoPagoSandbox, undefined);
    assert.equal(integrationConfigService.DEFINITIONS.mercadoPago.fields.some((field) => field.key === "environment"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousPaymentsMode === undefined) delete process.env.PAYMENTS_MODE;
    else process.env.PAYMENTS_MODE = previousPaymentsMode;
  }
});

test("simulação local de pagamentos não chama o Mercado Pago", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPaymentsMode = process.env.PAYMENTS_MODE;
  const previousAutoApprove = process.env.TEST_PAYMENTS_AUTO_APPROVE;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.PAYMENTS_MODE = "test";
  process.env.TEST_PAYMENTS_AUTO_APPROVE = "true";
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("A simulação local não pode chamar o gateway."); };
  try {
    const config = { environment: "production", publicKey: "TEST-local-only", accessToken: "TEST-local-only" };
    assert.equal(integrationConfigService.isConfigured("mercadoPago", config), true);
    const payment = await paymentService.createMercadoPagoOrderPayment({
      id: "local-payment-stub",
      totalPrice: 10,
      customerEmail: "cliente@example.com"
    }, config, { method: "credit_card" });
    assert.equal(payment.status, "approved");
    assert.equal(payment.raw.testMode, true);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousPaymentsMode === undefined) delete process.env.PAYMENTS_MODE;
    else process.env.PAYMENTS_MODE = previousPaymentsMode;
    if (previousAutoApprove === undefined) delete process.env.TEST_PAYMENTS_AUTO_APPROVE;
    else process.env.TEST_PAYMENTS_AUTO_APPROVE = previousAutoApprove;
  }
});
