const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Installed before server.js is loaded; only synthetic IDs use this probe.
function installOnlinePaymentProbe(paymentService) {
  const original = paymentService.createMercadoPagoOrderPayment;
  const { outsidePostgresTransaction, queryPostgres } = require("../backend/db/postgresStore");
  const accepted = new Map();
  const calls = [];
  const failures = new Map();
  let onAccept = null;
  paymentService.createMercadoPagoOrderPayment = async (order, config, options) => {
    if (!String(order.id).startsWith("smoke-online-failure-")) return original(order, config, options);
    const key = `${options.method}:${options.idempotencyKey || order.idempotencyKey || order.id}`;
    const committed = await outsidePostgresTransaction(() => queryPostgres(
      "SELECT count(*)::integer AS total FROM orders WHERE id=$1", [order.id]
    ));
    calls.push({ orderId: order.id, key, committedOrderCount: committed.rows[0].total });
    if (failures.get(order.id) === "before_accept") throw Object.assign(new Error("Mock provider unavailable"), { statusCode: 504 });
    let result = accepted.get(key);
    if (!result) {
      result = await original(order, config, options);
      if (options.method === "credit_card") result = { ...result, status: "approved", statusDetail: "accredited" };
      accepted.set(key, result);
    }
    if (onAccept) await onAccept(order, result, options);
    if (failures.get(order.id) === "response_lost") throw Object.assign(new Error("Mock provider response lost"), { statusCode: 504 });
    return { ...result };
  };
  return {
    accepted, calls, failures,
    setOnAccept: (callback) => { onAccept = callback; },
    restore: () => { paymentService.createMercadoPagoOrderPayment = original; }
  };
}

async function runOnlinePaymentFailureScenarios({ probe, request, jsonHeaders, cookie, readDb, queryPostgres,
  failCommitForRecord, restoreQuery, movieId, sessionId, webhookSecret }) {
  const bodyFor = (id, method) => ({
    order: { id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1, halfTicketsCount: 0,
      customerName: "Cliente sintético", customerEmail: "synthetic@example.invalid", customerPhone: "11999999999", concessionItems: [] },
    ...(method === "card" ? { cardToken: "synthetic-token", paymentMethodId: "visa", paymentTypeId: "credit_card", installments: 1 } : {})
  });
  const post = (id, method) => request(`/api/payments/${method}`, {
    method: "POST", headers: { ...jsonHeaders(cookie), "X-Forwarded-For": "192.0.2.222" },
    body: JSON.stringify(bodyFor(id, method))
  });
  const counts = async (id) => {
    const tables = ["orders", "payments", "tickets"];
    const results = await Promise.all(tables.map((table) => queryPostgres(
      `SELECT count(*)::integer AS total FROM ${table} WHERE ${table === "orders" ? "id" : "order_id"}=$1`, [id]
    )));
    return results.map((result) => result.rows[0].total);
  };
  const callCount = (id) => probe.calls.filter((call) => call.orderId === id).length;
  const acceptedCount = (id) => [...probe.accepted.values()].filter((item) => item.externalReference === id).length;
  const notifyAccepted = async (id, method, status = "processed") => {
    const payment = probe.accepted.get(`${method}:${id}`);
    assert.ok(payment, "O provedor simulado deve ter aceitado a Order original");
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const digest = crypto.createHmac("sha256", webhookSecret)
      .update(`id:${payment.id};request-id:${requestId};ts:${timestamp};`).digest("hex");
    const amount = String(payment.amount);
    return request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(payment.id)}&type=order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId,
        "x-signature": `ts=${timestamp},v1=${digest}` },
      body: JSON.stringify({ action: status === "pending" ? "order.updated"
        : status === "canceled" ? "order.canceled" : "order.processed",
        api_version: "v1", type: "order", live_mode: false,
        data: { id: payment.id, external_reference: id, status,
          status_detail: status === "processed" ? "accredited" : status,
          total_amount: amount, total_paid_amount: status === "processed" ? amount : "0.00",
          transactions: { payments: [{ id: payment.transactionId, amount,
            paid_amount: status === "processed" ? amount : "0.00",
            status, status_detail: status === "processed" ? "accredited" : status,
            payment_method: { id: "pix", type: "bank_transfer" } }] } } })
    });
  };

  const beforeId = "smoke-online-failure-before-pix";
  probe.failures.set(beforeId, "before_accept");
  const before = await post(beforeId, "pix");
  assert.equal(probe.calls.find((call) => call.orderId === beforeId)?.committedOrderCount, 1,
    "A intenção deve estar confirmada antes da primeira chamada ao provedor");
  assert.ok(before.response.status >= 500, "Timeout pré-aceitação não pode confirmar compra");
  assert.deepEqual(await counts(beforeId), [1, 1, 0], "A intenção confirmada deve sobreviver ao erro externo");
  assert.equal(acceptedCount(beforeId), 0);
  probe.failures.delete(beforeId);
  const beforeRetry = await post(beforeId, "pix");
  assert.equal(beforeRetry.response.status, 202, JSON.stringify(beforeRetry.payload));
  assert.deepEqual(await counts(beforeId), [1, 1, 0]);
  assert.equal(callCount(beforeId), 1, "Resultado inconclusivo não pode disparar nova cobrança");

  const lostId = "smoke-online-failure-response-pix";
  probe.failures.set(lostId, "response_lost");
  const lost = await post(lostId, "pix");
  assert.ok(lost.response.status >= 500, "Resposta perdida não pode confirmar compra");
  assert.deepEqual(await counts(lostId), [1, 1, 0]);
  assert.equal(acceptedCount(lostId), 1);
  probe.failures.delete(lostId);
  const lostRetry = await post(lostId, "pix");
  assert.equal(lostRetry.response.status, 202, JSON.stringify(lostRetry.payload));
  assert.equal(acceptedCount(lostId), 1, "Retry não pode criar segunda cobrança");
  assert.deepEqual(probe.calls.filter((call) => call.orderId === lostId).map((call) => call.key),
    [`pix:${lostId}`]);
  assert.deepEqual(await counts(lostId), [1, 1, 0]);
  assert.equal((await readDb()).payments.find((item) => item.orderId === lostId).metadata.onlineIntent.state, "unknown");
  const pendingWebhook = await notifyAccepted(lostId, "pix", "pending");
  assert.equal(pendingWebhook.response.status, 200, JSON.stringify(pendingWebhook.payload));
  assert.deepEqual(await counts(lostId), [1, 1, 0]);
  const pendingPayment = (await readDb()).payments.find((item) => item.orderId === lostId);
  assert.equal(pendingPayment.status, "pending", "O callback pendente não pode manter o estado interno de envio");
  assert.equal(pendingPayment.metadata.onlineIntent.state, "completed");
  const lostWebhook = await notifyAccepted(lostId, "pix");
  assert.equal(lostWebhook.response.status, 200, JSON.stringify(lostWebhook.payload));
  assert.deepEqual(await counts(lostId), [1, 1, 1], "Webhook assinado recupera a intenção sem navegador");
  const recovered = await post(lostId, "pix");
  assert.equal(recovered.response.status, 200);
  assert.equal(callCount(lostId), 1);

  const cardId = "smoke-online-failure-commit-card";
  const commitFailed = failCommitForRecord(cardId, "smoke_online_card_commit_failure", 3);
  let failedCard;
  try { failedCard = await post(cardId, "card"); }
  finally { restoreQuery(); }
  assert.equal(commitFailed(), true, "Failpoint deve atingir o commit depois da aceitação do cartão");
  assert.ok(failedCard.response.status >= 500, "Commit falho não pode responder aprovação");
  assert.equal(acceptedCount(cardId), 1);
  assert.deepEqual(await counts(cardId), [1, 1, 0], "Falha após aceite preserva a intenção e não emite ingresso");
  const cardRetry = await post(cardId, "card");
  assert.equal(cardRetry.response.status, 202, JSON.stringify(cardRetry.payload));
  assert.equal(acceptedCount(cardId), 1);
  assert.deepEqual(probe.calls.filter((call) => call.orderId === cardId).map((call) => call.key),
    [`credit_card:${cardId}`]);
  assert.deepEqual(await counts(cardId), [1, 1, 0]);
  const cardWebhook = await notifyAccepted(cardId, "credit_card");
  assert.equal(cardWebhook.response.status, 200, JSON.stringify(cardWebhook.payload));
  assert.deepEqual(await counts(cardId), [1, 1, 1], "Aceite externo após rollback local exige recuperação assinada");

  const finalId = "smoke-online-failure-final-commit-card";
  const failedFinalCommit = failCommitForRecord(finalId, "smoke_online_final_commit_failure", 4);
  let finalFailure;
  try { finalFailure = await post(finalId, "card"); }
  finally { restoreQuery(); }
  assert.equal(failedFinalCommit(), true, "Failpoint deve atingir o commit da conclusão depois do ID externo");
  assert.ok(finalFailure.response.status >= 500);
  assert.deepEqual(await counts(finalId), [1, 1, 0], "Falha no commit final não pode emitir ingresso");
  const knownResult = (await readDb()).payments.find((item) => item.orderId === finalId);
  assert.equal(knownResult.providerPaymentId, probe.accepted.get(`credit_card:${finalId}`).id);
  assert.equal(knownResult.metadata.onlineIntent.state, "result_known");
  const finalRetry = await post(finalId, "card");
  assert.equal(finalRetry.response.status, 200);
  assert.equal(callCount(finalId), 1, "Retry após falha no commit final não recria a cobrança");
  const finalWebhook = await notifyAccepted(finalId, "credit_card");
  assert.equal(finalWebhook.response.status, 200, JSON.stringify(finalWebhook.payload));
  assert.deepEqual(await counts(finalId), [1, 1, 1]);

  const earlyId = "smoke-online-failure-early-cancel";
  probe.setOnAccept(async (order) => {
    if (order.id !== earlyId) return;
    const canceled = await notifyAccepted(earlyId, "pix", "canceled");
    assert.equal(canceled.response.status, 200, JSON.stringify(canceled.payload));
  });
  try {
    const earlyResponse = await post(earlyId, "pix");
    assert.equal(earlyResponse.response.status, 409, JSON.stringify(earlyResponse.payload));
    assert.equal(earlyResponse.payload.error.code, "PAYMENT_ORDER_CLOSED");
    assert.equal(earlyResponse.payload.payment.qrCode, "", "QR de pedido cancelado não pode ser exibido");
  } finally {
    probe.setOnAccept(null);
  }
  const earlySnapshot = await readDb();
  assert.equal(earlySnapshot.orders.find((item) => item.id === earlyId).status, "cancelled");
  assert.equal(earlySnapshot.payments.find((item) => item.orderId === earlyId).status, "cancelled",
    "Resposta pendente tardia não pode rebaixar o cancelamento confirmado");
  assert.deepEqual(await counts(earlyId), [1, 1, 0]);

  const concurrentId = "smoke-online-failure-concurrent-pix";
  const concurrent = await Promise.all([post(concurrentId, "pix"), post(concurrentId, "pix")]);
  assert.equal(concurrent.filter((item) => item.response.status === 201).length, 1);
  assert.equal(concurrent.every((item) => [200, 201, 202].includes(item.response.status)), true);
  assert.equal(callCount(concurrentId), 1);
  assert.deepEqual(await counts(concurrentId), [1, 1, 0]);
  const duplicate = await post(concurrentId, "pix");
  assert.equal(duplicate.response.status, 200);
  assert.equal(callCount(concurrentId), 1);
}

module.exports = { installOnlinePaymentProbe, runOnlinePaymentFailureScenarios };
