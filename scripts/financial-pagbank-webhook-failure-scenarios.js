const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// PG-only characterization: an existing synthetic checkout is linked to a
// synthetic PagBank Order. Provider methods are replaced only for that ID.
async function runPagBankWebhookCommitScenario({ request, jsonHeaders, cookie, movieId, sessionId,
  readDb, writeDb, queryPostgres, failCommitForRecord, restoreQuery, pagBank }) {
  const id = "smoke-pagbank-webhook-commit";
  const providerId = "ORDE_SYNTHETIC-COMMIT";
  const chargeId = "CHAR_SYNTHETIC-COMMIT";
  const created = await request("/api/payments/pix", {
    method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify({ order: {
      id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1, halfTicketsCount: 0,
      concessionItems: [], customerName: "Cliente sintético", customerEmail: "synthetic@example.invalid",
      customerPhone: "11999999999"
    } })
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));

  const fixture = await readDb();
  const payment = fixture.payments.find((item) => item.orderId === id);
  assert.ok(payment);
  payment.provider = "pag_bank";
  payment.providerPaymentId = providerId;
  payment.metadata = { ...(payment.metadata || {}), transactionId: chargeId };
  await writeDb(fixture);
  const amount = Number(payment.amount);
  const body = { id: providerId, reference_id: id, metadata: { ps_order_id: providerId }, charges: [{ id: chargeId }] };
  const rawBody = JSON.stringify(body);
  const testToken = "synthetic-pagbank-webhook-only";
  const previousToken = process.env.PAGBANK_ACCESS_TOKEN;
  process.env.PAGBANK_ACCESS_TOKEN = testToken;
  const signature = crypto.createHash("sha256").update(`${testToken}-${rawBody}`).digest("hex");
  const notify = (value = signature) => request("/api/webhooks/pag-bank", {
    method: "POST", headers: { "Content-Type": "application/json", "x-authenticity-token": value }, body: rawBody
  });
  const originalFetch = pagBank.fetchOrder;
  const originalGlobalFetch = global.fetch;
  let fetchCount = 0;
  pagBank.fetchOrder = async (orderId, config) => {
    if (orderId !== providerId) return originalFetch(orderId, config);
    fetchCount += 1;
    return pagBank.normalizeOrder({ id: providerId, reference_id: id,
      charges: [{ id: chargeId, status: "PAID", amount: { value: Math.round(amount * 100) },
        payment_method: { type: "PIX" } }] }, "pix");
  };
  const persisted = async () => {
    const [orders, payments, tickets, events] = await Promise.all([
      queryPostgres("SELECT status FROM orders WHERE id=$1", [id]),
      queryPostgres("SELECT status FROM payments WHERE order_id=$1", [id]),
      queryPostgres("SELECT count(*)::integer AS count FROM tickets WHERE order_id=$1", [id]),
      queryPostgres("SELECT count(*)::integer AS count FROM webhook_events WHERE order_id=$1", [id])
    ]);
    return { order: orders.rows[0]?.status, payment: payments.rows[0]?.status,
      tickets: tickets.rows[0].count, events: events.rows[0].count };
  };
  try {
    assert.deepEqual(await persisted(), { order: "pending_payment", payment: "pending", tickets: 0, events: 0 });
    const invalid = await notify("0".repeat(64));
    assert.equal(invalid.response.status, 401);
    assert.deepEqual(await persisted(), { order: "pending_payment", payment: "pending", tickets: 0, events: 0 });
    const tripped = failCommitForRecord(id, "synthetic_pagbank_webhook_commit_failure", 1,
      (statement, args) => statement.startsWith("INSERT INTO orders") && args.some((values) =>
        Array.isArray(values) && values.some((value) => value?.id === id && value.status === "paid")));
    let failed;
    try { failed = await notify(); }
    finally { restoreQuery(); }
    assert.equal(tripped(), true, `O failpoint precisa atingir o commit do webhook PagBank: HTTP ${failed.response.status} ${JSON.stringify(failed.payload)}`);
    assert.ok(failed.response.status >= 500, `Commit revertido recebeu HTTP ${failed.response.status}`);
    assert.deepEqual(await persisted(), { order: "pending_payment", payment: "pending", tickets: 0, events: 0 });
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    global.fetch = async (url, options) => {
      if (String(url).endsWith("/public-keys?type=webhook")) {
        return { ok: true, json: async () => ({ public_key: publicKeyBase64 }) };
      }
      return originalGlobalFetch(url, options);
    };
    const signedNotify = (signature) => request("/api/webhooks/pag-bank", {
      method: "POST", headers: { "Content-Type": "application/json", "x-payload-signature": signature }, body: rawBody
    });
    const invalidEcdsa = await signedNotify(crypto.sign("sha256", Buffer.from(`${rawBody} `), privateKey).toString("base64"));
    assert.equal(invalidEcdsa.response.status, 401);
    assert.deepEqual(await persisted(), { order: "pending_payment", payment: "pending", tickets: 0, events: 0 });
    const retry = await signedNotify(crypto.sign("sha256", Buffer.from(rawBody), privateKey).toString("base64"));
    assert.equal(retry.response.status, 200, JSON.stringify(retry.payload));
    assert.equal(retry.payload.ticketsCreated, 1);
    assert.deepEqual(await persisted(), { order: "paid", payment: "approved", tickets: 1, events: 1 });
    const duplicate = await notify();
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.payload.duplicate, true);
    assert.deepEqual(await persisted(), { order: "paid", payment: "approved", tickets: 1, events: 1 });
    assert.equal(fetchCount, 3);
  } finally {
    pagBank.fetchOrder = originalFetch;
    global.fetch = originalGlobalFetch;
    if (previousToken === undefined) delete process.env.PAGBANK_ACCESS_TOKEN;
    else process.env.PAGBANK_ACCESS_TOKEN = previousToken;
  }
}

module.exports = { runPagBankWebhookCommitScenario };
