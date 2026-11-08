const assert = require("node:assert/strict");

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
  const accepted = new Map();
  const calls = [];
  const failures = new Map();
  pagBank.createOrderPayment = async (order, config, options) => {
    if (!String(order.id).startsWith("smoke-pagbank-failure-")) return originalCreate(order, config, options);
    const key = `${options.method}:${options.idempotencyKey || order.idempotencyKey || order.id}`;
    calls.push({ orderId: order.id, key });
    if (failures.get(order.id) === "before_accept") throw Object.assign(new Error("Synthetic provider unavailable"), { statusCode: 504 });
    if (!accepted.has(key)) accepted.set(key, await originalCreate(order, config, options));
    if (failures.get(order.id) === "response_lost") throw Object.assign(new Error("Synthetic response lost"), { statusCode: 504 });
    return { ...accepted.get(key) };
  };
  // The long smoke suite already consumes the loopback payment bucket. Use a
  // reserved TEST-NET address for this independent scenario, without changing limits.
  const post = (id, cookie) => request("/api/payments/pix", { method: "POST",
    headers: { ...jsonHeaders(cookie), "X-Forwarded-For": "192.0.2.22" },
    body: JSON.stringify({ order: { id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1,
      halfTicketsCount: 0, concessionItems: [], customerName: "Cliente sintético",
      customerEmail: "synthetic@example.invalid", customerPhone: "11999999999" } }) });
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
    assert.deepEqual(await counts(beforeId), [0, 0, 0]);
    assert.equal(accepted.size, 0);
    failures.delete(beforeId);
    const beforeRetry = await post(beforeId, beforeCookie);
    assert.equal(beforeRetry.response.status, 201, JSON.stringify(beforeRetry.payload));
    assert.equal(beforeRetry.payload.payment.provider, "pag_bank");
    assert.deepEqual(await counts(beforeId), [1, 1, 0]);

    const lostId = "smoke-pagbank-failure-lost";
    const lostCookie = await createCustomerCookie("lost");
    failures.set(lostId, "response_lost");
    const lost = await post(lostId, lostCookie);
    assert.ok(lost.response.status >= 500, `Resposta perdida: HTTP ${lost.response.status} ${JSON.stringify(lost.payload)}`);
    assert.deepEqual(await counts(lostId), [0, 0, 0]);
    assert.ok(accepted.has(`pix:${lostId}`));
    failures.delete(lostId);
    const recovered = await post(lostId, lostCookie);
    assert.equal(recovered.response.status, 201, JSON.stringify(recovered.payload));
    assert.deepEqual(await counts(lostId), [1, 1, 0]);
    assert.deepEqual(calls.filter((item) => item.orderId === lostId).map((item) => item.key),
      [`pix:${lostId}`, `pix:${lostId}`]);
    assert.equal((await readDb()).payments.find((item) => item.orderId === lostId).providerPaymentId,
      accepted.get(`pix:${lostId}`).id);

    const commitId = "smoke-pagbank-failure-commit";
    const commitCookie = await createCustomerCookie("commit");
    const tripped = failCommitForRecord(commitId, "smoke_pagbank_checkout_commit_failure");
    let failed;
    try { failed = await post(commitId, commitCookie); }
    finally { restoreQuery(); }
    assert.equal(tripped(), true, `O failpoint precisa atingir o checkout PagBank: HTTP ${failed.response.status}`);
    assert.ok(failed.response.status >= 500);
    assert.deepEqual(await counts(commitId), [0, 0, 0]);
    assert.ok(accepted.has(`pix:${commitId}`));
    const commitRetry = await post(commitId, commitCookie);
    assert.equal(commitRetry.response.status, 201, JSON.stringify(commitRetry.payload));
    assert.deepEqual(await counts(commitId), [1, 1, 0]);
    assert.equal(accepted.size, 3, "Retry não deve criar segunda Order no simulador");

    const duplicateId = "smoke-pagbank-failure-concurrent";
    const concurrentCookie = await createCustomerCookie("concurrent");
    const concurrent = await Promise.all([post(duplicateId, concurrentCookie), post(duplicateId, concurrentCookie)]);
    assert.deepEqual(concurrent.map((item) => item.response.status).sort(), [200, 201]);
    assert.equal(calls.filter((item) => item.orderId === duplicateId).length, 1);
    assert.deepEqual(await counts(duplicateId), [1, 1, 0]);
  } finally {
    pagBank.createOrderPayment = originalCreate;
    const final = await readDb();
    final.integrations = priorIntegrations;
    await writeDb(final);
  }
}

module.exports = { runPagBankCheckoutFailureScenarios };
