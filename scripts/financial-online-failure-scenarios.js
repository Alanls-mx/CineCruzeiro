const assert = require("node:assert/strict");

// Installed before server.js is loaded; only synthetic IDs use this probe.
function installOnlinePaymentProbe(paymentService) {
  const original = paymentService.createMercadoPagoOrderPayment;
  const accepted = new Map();
  const calls = [];
  const failures = new Map();
  paymentService.createMercadoPagoOrderPayment = async (order, config, options) => {
    if (!String(order.id).startsWith("smoke-online-failure-")) return original(order, config, options);
    const key = `${options.method}:${options.idempotencyKey || order.idempotencyKey || order.id}`;
    calls.push({ orderId: order.id, key });
    if (failures.get(order.id) === "before_accept") throw Object.assign(new Error("Mock provider unavailable"), { statusCode: 504 });
    let result = accepted.get(key);
    if (!result) {
      result = await original(order, config, options);
      if (options.method === "credit_card") result = { ...result, status: "approved", statusDetail: "accredited" };
      accepted.set(key, result);
    }
    if (failures.get(order.id) === "response_lost") throw Object.assign(new Error("Mock provider response lost"), { statusCode: 504 });
    return { ...result };
  };
  return {
    accepted, calls, failures,
    restore: () => { paymentService.createMercadoPagoOrderPayment = original; }
  };
}

async function runOnlinePaymentFailureScenarios({ probe, request, jsonHeaders, cookie, readDb, queryPostgres,
  failCommitForRecord, restoreQuery, movieId, sessionId }) {
  const bodyFor = (id, method) => ({
    order: { id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1, halfTicketsCount: 0,
      customerName: "Cliente sintético", customerEmail: "synthetic@example.invalid", customerPhone: "11999999999", concessionItems: [] },
    ...(method === "card" ? { cardToken: "synthetic-token", paymentMethodId: "visa", paymentTypeId: "credit_card", installments: 1 } : {})
  });
  const post = (id, method) => request(`/api/payments/${method}`, {
    method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify(bodyFor(id, method))
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

  const beforeId = "smoke-online-failure-before-pix";
  probe.failures.set(beforeId, "before_accept");
  const before = await post(beforeId, "pix");
  assert.ok(before.response.status >= 500, "Timeout pré-aceitação não pode confirmar compra");
  assert.deepEqual(await counts(beforeId), [0, 0, 0]);
  assert.equal(acceptedCount(beforeId), 0);
  probe.failures.delete(beforeId);
  const beforeRetry = await post(beforeId, "pix");
  assert.equal(beforeRetry.response.status, 201, JSON.stringify(beforeRetry.payload));
  assert.deepEqual(await counts(beforeId), [1, 1, 0]);
  assert.equal(probe.calls.filter((call) => call.orderId === beforeId).every((call) => call.key === `pix:${beforeId}`), true);

  const lostId = "smoke-online-failure-response-pix";
  probe.failures.set(lostId, "response_lost");
  const lost = await post(lostId, "pix");
  assert.ok(lost.response.status >= 500, "Resposta perdida não pode confirmar compra");
  assert.deepEqual(await counts(lostId), [0, 0, 0]);
  assert.equal(acceptedCount(lostId), 1);
  probe.failures.delete(lostId);
  const lostRetry = await post(lostId, "pix");
  assert.equal(lostRetry.response.status, 201, JSON.stringify(lostRetry.payload));
  assert.equal(acceptedCount(lostId), 1, "Retry deve reutilizar a identidade aceita pelo simulador");
  assert.deepEqual(probe.calls.filter((call) => call.orderId === lostId).map((call) => call.key),
    [`pix:${lostId}`, `pix:${lostId}`]);
  assert.deepEqual(await counts(lostId), [1, 1, 0]);
  assert.equal((await readDb()).payments.find((item) => item.orderId === lostId).providerPaymentId,
    probe.accepted.get(`pix:${lostId}`).id);

  const cardId = "smoke-online-failure-commit-card";
  const commitFailed = failCommitForRecord(cardId, "smoke_online_card_commit_failure");
  let failedCard;
  try { failedCard = await post(cardId, "card"); }
  finally { restoreQuery(); }
  assert.equal(commitFailed(), true, "Failpoint deve atingir o commit depois da aceitação do cartão");
  assert.ok(failedCard.response.status >= 500, "Commit falho não pode responder aprovação");
  assert.equal(acceptedCount(cardId), 1);
  assert.deepEqual(probe.calls.filter((call) => call.orderId === cardId).map((call) => call.key),
    [`credit_card:${cardId}`, `credit_card:${cardId}`]);
  assert.deepEqual(await counts(cardId), [0, 0, 0], "Rollback não pode emitir ingresso");
  const cardRetry = await post(cardId, "card");
  assert.equal(cardRetry.response.status, 201, JSON.stringify(cardRetry.payload));
  assert.equal(acceptedCount(cardId), 1);
  assert.deepEqual(await counts(cardId), [1, 1, 1]);
  assert.equal((await readDb()).payments.find((item) => item.orderId === cardId).providerPaymentId,
    probe.accepted.get(`credit_card:${cardId}`).id);

  const concurrentId = "smoke-online-failure-concurrent-pix";
  const concurrent = await Promise.all([post(concurrentId, "pix"), post(concurrentId, "pix")]);
  assert.deepEqual(concurrent.map((item) => item.response.status).sort(), [200, 201]);
  assert.equal(callCount(concurrentId), 1);
  assert.deepEqual(await counts(concurrentId), [1, 1, 0]);
  const duplicate = await post(concurrentId, "pix");
  assert.equal(duplicate.response.status, 200);
  assert.equal(callCount(concurrentId), 1);
}

module.exports = { installOnlinePaymentProbe, runOnlinePaymentFailureScenarios };
