const assert = require("assert");
const crypto = require("crypto");
const paymentService = require("../backend/services/paymentService");

const secret = "webhook-test-secret";
assert.equal(paymentService.mercadoPagoPixExpirationMs(), 30 * 60 * 1000);
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
  return paymentService.createMercadoPagoWebhookSignature({ dataId: id, requestId, timestamp }, secret).header;
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

const longOrderId = "deadpool-wolverine-sessao-1787616443186-e2e8b3-1787631042989-f953e55fc40cf8";
const providerExternalReference = longOrderId.slice(0, 64);
const paymentRecord = paymentService.createPaymentRecord(
  { id: longOrderId, totalPrice: 10 },
  { provider: "mercado_pago", id: dataId, status: "pending", externalReference: providerExternalReference },
  "pix"
);
assert.equal(paymentRecord.orderId, longOrderId);
assert.equal(paymentRecord.providerReference, providerExternalReference);

const bodyWithDifferentId = structuredClone(body);
bodyWithDifferentId.data.id = "ID_DO_BODY_NAO_ASSINADO";
const queryWins = paymentService.verifyWebhookRequest("mercado_pago", req, url, bodyWithDifferentId, { webhookSecret: secret });
assert.equal(queryWins.dataId, dataId);

const mixedCaseHeaders = {
  headers: {
    "X-Request-ID": requestId,
    "X-Signature": signatureFor(dataId)
  }
};
assert.equal(paymentService.verifyWebhookRequest("mercado_pago", mixedCaseHeaders, url, body, { webhookSecret: secret }).verified, true);

for (const [expectedCode, request, requestUrl] of [
  ["MERCADO_PAGO_WEBHOOK_SIGNATURE_REQUIRED", { headers: { "x-request-id": requestId } }, url],
  ["MERCADO_PAGO_WEBHOOK_REQUEST_ID_REQUIRED", { headers: { "x-signature": signatureFor(dataId) } }, url],
  ["MERCADO_PAGO_WEBHOOK_DATA_ID_REQUIRED", req, new URL("https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago?type=order")]
]) {
  assert.throws(
    () => paymentService.verifyWebhookRequest("mercado_pago", request, requestUrl, body, { webhookSecret: secret }),
    (error) => error?.code === expectedCode && error?.statusCode === 401
  );
}

assert.throws(
  () => paymentService.verifyWebhookRequest("mercado_pago", req, url, body, {}),
  (error) => error?.code === "MERCADO_PAGO_WEBHOOK_SECRET_REQUIRED" && error?.statusCode === 412
);

const actionRequired = structuredClone(body);
actionRequired.action = "order.action_required";
actionRequired.data.status = "action_required";
actionRequired.data.status_detail = "action_required";
actionRequired.data.transactions.payments[0].status = "action_required";
actionRequired.data.transactions.payments[0].status_detail = "action_required";
assert.equal(paymentService.normalizeMercadoPagoWebhookOrder(actionRequired).status, "pending");

const authorizedPayment = paymentService.normalizeMercadoPagoAuthorizedPayment({
  id: 6114264375,
  preapproval_id: "PREAPPROVAL_APPROVED_1",
  external_reference: "assinatura-local-1",
  transaction_amount: "24.90",
  payment: {
    id: 19951521071,
    status: "approved",
    status_detail: "accredited"
  }
});
assert.equal(authorizedPayment.preapprovalId, "PREAPPROVAL_APPROVED_1");
assert.equal(authorizedPayment.externalReference, "assinatura-local-1");
assert.equal(authorizedPayment.paymentStatus, "approved");
assert.equal(authorizedPayment.amount, 24.9);

const lowerCaseUrl = new URL(`https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago?data.id=${encodeURIComponent(dataId.toLowerCase())}&type=order`);
const lowerCaseVerification = paymentService.verifyWebhookRequest("mercado_pago", req, lowerCaseUrl, body, { webhookSecret: secret });
assert.equal(lowerCaseVerification.verified, true);
assert.equal(lowerCaseVerification.dataId, dataId.toLowerCase());

console.log("Mercado Pago webhook signature tests passed.");
