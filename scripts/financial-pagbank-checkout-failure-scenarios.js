const assert = require("node:assert/strict");
const crypto = require("node:crypto");

async function runPagBankCheckoutFailureScenarios({ request, jsonHeaders, createCustomerCookie, movieId, sessionId,
  readDb, writeDb, queryPostgres, failCommitForRecord, restoreQuery, pagBank }) {
  const initial = await readDb();
  const priorIntegrations = structuredClone(initial.integrations || initial.settings?.integrations || {});
  initial.integrations = {
    ...priorIntegrations,
    mercadoPago: { ...priorIntegrations.mercadoPago, enabled: false },
    pagBank: { enabled: true, environment: "sandbox", publicKey: "synthetic-public-key", accessToken: "synthetic-access-token" }
  };
  await writeDb(initial);
  const originalCreate = pagBank.createOrderPayment;
  const { outsidePostgresTransaction } = require("../backend/db/postgresStore");
  const accepted = new Map();
  const calls = [];
  const failures = new Map();
  pagBank.createOrderPayment = async (order, config, options) => {
    if (!String(order.id).startsWith("smoke-pagbank-failure-")) return originalCreate(order, config, options);
    const key = `${options.method}:${options.idempotencyKey || order.idempotencyKey || order.id}`;
    const committed = await outsidePostgresTransaction(() => queryPostgres(
      "SELECT count(*)::integer AS count FROM orders WHERE id=$1", [order.id]
    ));
    calls.push({ orderId: order.id, key, committedOrderCount: committed.rows[0].count });
    if (failures.get(order.id) === "before_accept") throw Object.assign(new Error("Synthetic provider unavailable"), { statusCode: 504 });
    if (!accepted.has(key)) {
      const result = await originalCreate(order, config, options);
      accepted.set(key, options.method === "credit_card" ? { ...result, status: "approved", statusDetail: "PAID" } : result);
    }
    if (failures.get(order.id) === "response_lost") throw Object.assign(new Error("Synthetic response lost"), { statusCode: 504 });
    return { ...accepted.get(key) };
  };
  // The long smoke suite already consumes the loopback payment bucket. Use a
  // reserved TEST-NET address for this independent scenario, without changing limits.
  const post = (id, cookie, method = "pix") => request(`/api/payments/${method}`, { method: "POST",
    headers: { ...jsonHeaders(cookie), "X-Forwarded-For": "192.0.2.22" },
    body: JSON.stringify({ order: { id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1,
      halfTicketsCount: 0, concessionItems: [], customerName: "Cliente sintético",
      customerEmail: "synthetic@example.invalid", customerPhone: "11999999999" },
    ...(method === "card" ? { encryptedCard: "synthetic-encrypted-card", cardHolderName: "Cliente Sintético",
      cardHolderTaxId: "12345678901", paymentMethodId: "visa", installments: 1 } : {}) }) });
  const counts = async (id) => {
    const [orders, payments, tickets] = await Promise.all([
      queryPostgres("SELECT count(*)::integer AS count FROM orders WHERE id=$1", [id]),
      queryPostgres("SELECT count(*)::integer AS count FROM payments WHERE order_id=$1", [id]),
      queryPostgres("SELECT count(*)::integer AS count FROM tickets WHERE order_id=$1", [id])
    ]);
    return [orders.rows[0].count, payments.rows[0].count, tickets.rows[0].count];
  };
  try {
    const beforeId = "smoke-pagbank-failure-before";
    const beforeCookie = await createCustomerCookie("before");
    failures.set(beforeId, "before_accept");
    const before = await post(beforeId, beforeCookie);
    assert.ok(before.response.status >= 500);
    assert.equal(calls.find((item) => item.orderId === beforeId)?.committedOrderCount, 1);
    assert.deepEqual(await counts(beforeId), [1, 1, 0]);
    assert.equal(accepted.size, 0);
    failures.delete(beforeId);
    const beforeRetry = await post(beforeId, beforeCookie);
    assert.equal(beforeRetry.response.status, 202, JSON.stringify(beforeRetry.payload));
    assert.equal(beforeRetry.payload.payment.provider, "pag_bank");
    assert.deepEqual(await counts(beforeId), [1, 1, 0]);

    const lostId = "smoke-pagbank-failure-lost";
    const lostCookie = await createCustomerCookie("lost");
    failures.set(lostId, "response_lost");
    const lost = await post(lostId, lostCookie);
    assert.ok(lost.response.status >= 500, `Resposta perdida: HTTP ${lost.response.status} ${JSON.stringify(lost.payload)}`);
    assert.deepEqual(await counts(lostId), [1, 1, 0]);
    assert.ok(accepted.has(`pix:${lostId}`));
    failures.delete(lostId);
    const recovered = await post(lostId, lostCookie);
    assert.equal(recovered.response.status, 202, JSON.stringify(recovered.payload));
    assert.deepEqual(await counts(lostId), [1, 1, 0]);
    assert.deepEqual(calls.filter((item) => item.orderId === lostId).map((item) => item.key),
      [`pix:${lostId}`]);
    assert.equal((await readDb()).payments.find((item) => item.orderId === lostId).metadata.onlineIntent.state, "unknown");
    const acceptedLost = accepted.get(`pix:${lostId}`);
    const originalFetchOrder = pagBank.fetchOrder;
    pagBank.fetchOrder = async (orderId, config) => orderId === acceptedLost.id
      ? pagBank.normalizeOrder({ id: acceptedLost.id, reference_id: lostId,
        charges: [{ id: acceptedLost.transactionId, status: "PAID",
          amount: { value: Math.round(Number(acceptedLost.amount) * 100) },
          payment_method: { type: "PIX" } }] }, "pix")
      : originalFetchOrder(orderId, config);
    try {
      const callbackBody = JSON.stringify({ id: acceptedLost.id, reference_id: lostId,
        metadata: { ps_order_id: acceptedLost.id }, charges: [{ id: acceptedLost.transactionId }] });
      const signature = crypto.createHash("sha256")
        .update(`synthetic-access-token-${callbackBody}`).digest("hex");
      const callback = await request("/api/webhooks/pag-bank", { method: "POST",
        headers: { "Content-Type": "application/json", "x-authenticity-token": signature },
        body: callbackBody });
      assert.equal(callback.response.status, 200, JSON.stringify(callback.payload));
      assert.deepEqual(await counts(lostId), [1, 1, 1], "Webhook PagBank recupera intenção sem navegador");
      const settled = await post(lostId, lostCookie);
      assert.equal(settled.response.status, 200);
      assert.equal(calls.filter((item) => item.orderId === lostId).length, 1);
    } finally {
      pagBank.fetchOrder = originalFetchOrder;
    }

    const commitId = "smoke-pagbank-failure-commit";
    const commitCookie = await createCustomerCookie("commit");
    const tripped = failCommitForRecord(commitId, "smoke_pagbank_checkout_commit_failure", 3);
    let failed;
    try { failed = await post(commitId, commitCookie); }
    finally { restoreQuery(); }
    assert.equal(tripped(), true, `O failpoint precisa atingir o checkout PagBank: HTTP ${failed.response.status}`);
    assert.ok(failed.response.status >= 500);
    assert.deepEqual(await counts(commitId), [1, 1, 0]);
    assert.ok(accepted.has(`pix:${commitId}`));
    const commitRetry = await post(commitId, commitCookie);
    assert.equal(commitRetry.response.status, 202, JSON.stringify(commitRetry.payload));
    assert.deepEqual(await counts(commitId), [1, 1, 0]);
    assert.equal(calls.filter((item) => item.orderId === commitId).length, 1,
      "Retry não deve chamar o provedor uma segunda vez");
    assert.equal(accepted.has(`pix:${commitId}`), true);

    const duplicateId = "smoke-pagbank-failure-concurrent";
    const concurrentCookie = await createCustomerCookie("concurrent");
    const concurrent = await Promise.all([post(duplicateId, concurrentCookie), post(duplicateId, concurrentCookie)]);
    assert.equal(concurrent.filter((item) => item.response.status === 201).length, 1);
    assert.equal(concurrent.every((item) => [200, 201, 202].includes(item.response.status)), true);
    assert.equal(calls.filter((item) => item.orderId === duplicateId).length, 1);
    assert.deepEqual(await counts(duplicateId), [1, 1, 0]);

    const cardId = "smoke-pagbank-failure-card-commit";
    const cardCookie = await createCustomerCookie("card");
    const cardCommitFailed = failCommitForRecord(cardId, "smoke_pagbank_card_commit_failure", 3);
    let failedCard;
    try { failedCard = await post(cardId, cardCookie, "card"); }
    finally { restoreQuery(); }
    assert.equal(cardCommitFailed(), true, `O failpoint precisa atingir o cartão PagBank: HTTP ${failedCard.response.status}`);
    assert.ok(failedCard.response.status >= 500);
    assert.deepEqual(await counts(cardId), [1, 1, 0], "Aprovação externa seguida de rollback preserva intenção sem ingresso");
    assert.ok(accepted.has(`credit_card:${cardId}`));
    const cardRetry = await post(cardId, cardCookie, "card");
    assert.equal(cardRetry.response.status, 202, JSON.stringify(cardRetry.payload));
    assert.equal(cardRetry.payload.payment.status, "processing");
    assert.deepEqual(await counts(cardId), [1, 1, 0]);
    assert.deepEqual(calls.filter((item) => item.orderId === cardId).map((item) => item.key),
      [`credit_card:${cardId}`]);
  } finally {
    pagBank.createOrderPayment = originalCreate;
    const final = await readDb();
    final.integrations = priorIntegrations;
    await writeDb(final);
  }
}

module.exports = { runPagBankCheckoutFailureScenarios };
