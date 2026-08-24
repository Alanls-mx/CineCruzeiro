const assert = require("assert");
const crypto = require("crypto");
const paymentService = require("../backend/services/paymentService");

const secret = "webhook-test-secret";
const requestId = "2066ca19-c6f1-498a-be75-1923005edd06";
const timestamp = "1787607418";
const dataId = "ORDTST01M0TV8Z1ZVPCCF62Q01BVRNZX";
const externalReference = "homem-aranha-um-novo-dia-estreia-1-1787607414207-4f19cefe2e751";

const body = {
  action: "order.processed",
  api_version: "v1",
  live_mode: false,
  type: "order",
  data: {
    currency_id: "BRL",
    external_reference: externalReference,
    id: dataId,
    status: "processed",
    status_detail: "accredited",
    total_amount: "10.00",
    total_paid_amount: "10.00",
    transactions: {
      payments: [{
        amount: "10.00",
        id: "PAY01M0TV8Z2EZ0BQFRTPWD0DQ956",
        paid_amount: "10.00",
        status: "processed",
        status_detail: "accredited",
        payment_method: { id: "master", installments: 1, type: "credit_card" }
      }]
    }
  }
};

function signatureFor(id) {
  const manifest = `id:${id};request-id:${requestId};ts:${timestamp};`;
  const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${timestamp},v1=${hash}`;
}

const req = {
  headers: {
    "x-request-id": requestId,
    "x-signature": signatureFor(dataId)
  }
};
const url = new URL(`https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago?data.id=${encodeURIComponent(dataId)}&type=order`);

const verification = paymentService.verifyWebhookRequest("mercado_pago", req, url, body, { webhookSecret: secret });
assert.equal(verification.verified, true);
assert.equal(verification.dataId, dataId);

const normalized = paymentService.normalizeMercadoPagoWebhookOrder(body);
assert.equal(normalized.id, dataId);
assert.equal(normalized.externalReference, externalReference);
assert.equal(normalized.status, "approved");
assert.equal(normalized.amount, 10);

const lowerCaseUrl = new URL(`https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago?data.id=${encodeURIComponent(dataId.toLowerCase())}&type=order`);
assert.throws(
  () => paymentService.verifyWebhookRequest("mercado_pago", req, lowerCaseUrl, body, { webhookSecret: secret }),
  (error) => error?.code === "MERCADO_PAGO_WEBHOOK_INVALID_SIGNATURE" && error?.statusCode === 401
);

console.log("Mercado Pago webhook signature tests passed.");
