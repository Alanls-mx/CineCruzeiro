import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const integrationConfigService = require("../backend/services/integrationConfigService");
const pagBank = require("../backend/services/pagBankPaymentService");
const refunds = require("../backend/services/orderRefundService");

test("only one online payment provider may be enabled", () => {
  const db = { settings: { integrations: { mercadoPago: { enabled: true }, pagBank: { enabled: false } } } };
  assert.throws(() => integrationConfigService.setEnabled(db, "pagBank", true), { code: "PAYMENT_PROVIDER_EXCLUSIVE" });
  assert.equal(integrationConfigService.resolvedConfig(db, "pagBank").enabled, false);
  integrationConfigService.setEnabled(db, "mercadoPago", false);
  integrationConfigService.setEnabled(db, "pagBank", true);
  assert.equal(integrationConfigService.resolvedConfig(db, "pagBank").enabled, true);
});

test("PagBank Pix uses catalog total, order reference and charge QR code", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => ({
        id: "ORDE_123", reference_id: "order-123",
        charges: [{ id: "CHAR_123", status: "WAITING", amount: { value: 1234 }, payment_method: { type: "PIX", pix: { expiration_date: "2026-10-06T12:00:00Z" } }, qr_code: { text: "PIX-COPY-PASTE" } }]
      })
    };
  };
  try {
    const payment = await pagBank.createOrderPayment({ id: "order-123", totalPrice: 12.34, movieTitle: "Filme", customerName: "Cliente Teste", customerEmail: "teste@example.com", customerCpf: "12345678909" }, { environment: "sandbox", accessToken: "token" }, { method: "pix", idempotencyKey: "operation-123", notificationUrl: "https://example.com/api/webhooks/pag-bank" });
    assert.equal(calls[0].url, "https://sandbox.api.pagseguro.com/orders");
    assert.equal(calls[0].options.headers["x-idempotency-key"], "operation-123");
    assert.equal(calls[0].body.charges[0].amount.value, 1234);
    assert.equal(calls[0].body.charges[0].payment_method.type, "PIX");
    assert.equal(calls[0].body.notification_urls[0], "https://example.com/api/webhooks/pag-bank");
    assert.equal(payment.provider, "pag_bank");
    assert.equal(payment.status, "pending");
    assert.equal(payment.qrCode, "PIX-COPY-PASTE");
    assert.equal(payment.transactionId, "CHAR_123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("card API receives only the encrypted card and cardholder tax ID", async () => {
  const originalFetch = global.fetch;
  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: "ORDE_321", reference_id: "order-321", charges: [{ id: "CHAR_321", status: "PAID", amount: { value: 500 }, payment_method: { type: "CREDIT_CARD" } }] }) };
  };
  try {
    await pagBank.createOrderPayment({ id: "order-321", totalPrice: 5, customerName: "Cliente Teste", customerEmail: "teste@example.com", customerCpf: "12345678909" }, { environment: "sandbox", accessToken: "token" }, { method: "credit_card", card: { encrypted: "ENCRYPTED", holderName: "Titular", holderTaxId: "98765432100" } });
    assert.equal(body.charges[0].payment_method.card.encrypted, "ENCRYPTED");
    assert.equal(body.charges[0].payment_method.holder.tax_id, "98765432100");
    assert.equal(body.charges[0].payment_method.capture, true);
    assert.equal(JSON.stringify(body).includes("securityCode"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("webhook signature is validated over the exact raw body", () => {
  const rawBody = '{"id":"ORDE_123", "charges":[]}';
  const signature = crypto.createHash("sha256").update(`token-${rawBody}`).digest("hex");
  assert.deepEqual(pagBank.verifyOrderWebhook({ rawBody, headers: { "x-authenticity-token": signature } }, { accessToken: "token" }), { verified: true });
  assert.throws(() => pagBank.verifyOrderWebhook({ rawBody: rawBody.replace(" ", ""), headers: { "x-authenticity-token": signature } }, { accessToken: "token" }), { code: "PAGBANK_WEBHOOK_INVALID_SIGNATURE" });
});

test("PagBank whitelist refusal identifies the blocked API without exposing credentials", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error_messages: [{ code: "ACCESS_DENIED", description: "whitelist access required. Contact PagSeguro" }] })
  });
  try {
    await assert.rejects(pagBank.request("/orders", { accessToken: "private-token", environment: "production" }), (error) => {
      assert.equal(error.code, "PAGBANK_WHITELIST_REQUIRED");
      assert.equal(error.statusCode, 412);
      assert.match(error.message, /API de Pedidos/);
      assert.doesNotMatch(error.message, /private-token/);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("charge webhook resolves to the recorded PagBank order", () => {
  const payments = [{ provider: "pag_bank", providerPaymentId: "ORDE_123", metadata: { transactionId: "CHAR_123" } }];
  assert.deepEqual(pagBank.resolveWebhookOrder({ id: "CHAR_123", status: "PAID" }, payments), { chargeId: "CHAR_123", orderId: "ORDE_123" });
  assert.deepEqual(pagBank.resolveWebhookOrder({ id: "CHAR_123", metadata: { ps_order_id: "ORDE_123" } }, []), { chargeId: "CHAR_123", orderId: "ORDE_123" });
  assert.deepEqual(pagBank.resolveWebhookOrder({ id: "ORDE_123", charges: [{ id: "CHAR_123" }] }, payments), { chargeId: "CHAR_123", orderId: "ORDE_123" });
});

test("PagBank refund preparation requires the charge ID and retains idempotency", () => {
  const payment = { provider: "pag_bank", providerPaymentId: "ORDE_123", status: "approved", amount: 10, metadata: { transactionId: "CHAR_123" } };
  const order = { id: "order-123", totalPrice: 10 };
  const intent = refunds.prepareRefund(payment, order);
  assert.equal(intent.provider, "pag_bank");
  assert.equal(intent.transactionId, "CHAR_123");
  payment.metadata.cancellationRefund = intent;
  assert.strictEqual(refunds.prepareRefund(payment, order), intent);
  assert.throws(() => refunds.prepareRefund({ ...payment, metadata: {} }, order), { code: "REFUND_PROVIDER_UNSUPPORTED" });
});

test("refund is completed only after PagBank confirms the refunded amount", async () => {
  const originalFetch = global.fetch;
  const payment = { provider: "pag_bank", providerPaymentId: "ORDE_123", status: "approved", amount: 10, metadata: { transactionId: "CHAR_123" } };
  const refund = refunds.prepareRefund(payment, { id: "order-123", totalPrice: 10 });
  let refundedCents = 0;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).endsWith("/cancel")) return { ok: true, json: async () => ({ status: "REFUNDED" }) };
    return { ok: true, json: async () => ({ id: "ORDE_123", reference_id: "order-123", charges: [{ id: "CHAR_123", status: "REFUNDED", amount: { value: 1000, summary: { refunded: refundedCents } } }] }) };
  };
  try {
    await assert.rejects(refunds.submitFullRefund(refund, "token", undefined, { environment: "sandbox", accessToken: "token" }), { code: "REFUND_CONFIRMATION_PENDING" });
    refundedCents = 1000;
    const confirmed = await refunds.submitFullRefund(refund, "token", undefined, { environment: "sandbox", accessToken: "token" });
    assert.equal(confirmed.providerStatus, "REFUNDED");
    assert.equal(calls[0].url, "https://sandbox.api.pagseguro.com/charges/CHAR_123/cancel");
    assert.equal(calls[0].options.headers["x-idempotency-key"], refund.id);
  } finally {
    global.fetch = originalFetch;
  }
});
