import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const paymentService = require("../backend/services/paymentService");

test("a webhook body cannot approve an order that Mercado Pago still reports pending", async () => {
  const originalFetch = global.fetch;
  const id = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
  const secret = "webhook-secret";
  const requestId = "request-123";
  const url = new URL(`https://example.com/api/webhooks/mercado-pago?data.id=${id}&type=order`);
  const body = {
    type: "order",
    action: "order.processed",
    data: { id, status: "processed", status_detail: "accredited", total_amount: "10.00" }
  };
  const signature = paymentService.createMercadoPagoWebhookSignature({ dataId: id, requestId }, secret);
  const verification = paymentService.verifyWebhookRequest("mercado_pago", {
    headers: { "x-request-id": requestId, "x-signature": signature.header }
  }, url, body, { webhookSecret: secret });
  assert.equal(verification.verified, true);

  global.fetch = async (requestedUrl) => {
    assert.equal(requestedUrl, `https://api.mercadopago.com/v1/orders/${id}`);
    return { ok: true, json: async () => ({
      id,
      external_reference: "checkout-123",
      status: "pending",
      total_amount: "10.00",
      transactions: { payments: [{ status: "pending", amount: "10.00" }] }
    }) };
  };
  try {
    const actual = await paymentService.fetchMercadoPagoWebhookOrder(verification.dataId, { accessToken: "test-token" });
    assert.equal(actual.status, "pending");
    assert.equal(actual.externalReference, "checkout-123");
  } finally {
    global.fetch = originalFetch;
  }
});

test("webhook lookup failures request a retry instead of accepting payload status", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: "unavailable" }) });
  try {
    await assert.rejects(
      paymentService.fetchMercadoPagoWebhookOrder("ORD01JQ4S4KY8HWQ6NA5PXB65B3D3", { accessToken: "test-token" }),
      { code: "MERCADO_PAGO_WEBHOOK_LOOKUP_FAILED", statusCode: 503 }
    );
  } finally {
    global.fetch = originalFetch;
  }
});
