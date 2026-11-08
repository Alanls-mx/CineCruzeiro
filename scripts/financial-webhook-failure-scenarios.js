const assert = require("node:assert/strict");
const crypto = require("node:crypto");

async function runMercadoPagoWebhookFailureScenarios({ request, jsonHeaders, cookie, movieId, sessionId, readDb, queryPostgres, secret,
  failCommitForRecord, restoreQuery }) {
  const createPix = async (id) => {
    const result = await request("/api/payments/pix", {
      method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify({ order: {
        id, idempotencyKey: id, movieId, sessionId, fullTicketsCount: 1, halfTicketsCount: 0,
        concessionItems: [], customerName: "Cliente sintético", customerEmail: "synthetic@example.invalid", customerPhone: "11999999999"
      } })
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    return result.payload;
  };
  const notify = async (checkout, { action, status, amount, reference, signatureValid = true }) => {
    const id = checkout.payment.providerPaymentId;
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const paid = status === "processed";
    const total = String(amount ?? checkout.payment.amount);
    const body = {
      action, api_version: "v1", type: "order", live_mode: false,
      data: {
        id, external_reference: reference ?? checkout.order.id, status,
        status_detail: paid ? "accredited" : status,
        total_amount: total, total_paid_amount: paid ? total : "0",
        transactions: { payments: [{ id: `PAY_${id}`, amount: total, paid_amount: paid ? total : "0",
          status, status_detail: paid ? "accredited" : status, payment_method: { id: "pix", type: "bank_transfer" } }] }
      }
    };
    const manifest = `id:${id};request-id:${requestId};ts:${timestamp};`;
    const digest = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(id)}&type=order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": requestId,
        "x-signature": `ts=${timestamp},v1=${signatureValid ? digest : "0".repeat(64)}` },
      body: JSON.stringify(body)
    });
  };
  const persisted = async (id) => {
    const [payment, order, tickets] = await Promise.all([
      queryPostgres("SELECT status FROM payments WHERE order_id=$1", [id]),
      queryPostgres("SELECT status FROM orders WHERE id=$1", [id]),
      queryPostgres("SELECT count(*)::integer AS total FROM tickets WHERE order_id=$1", [id])
    ]);
    return { payment: payment.rows[0]?.status, order: order.rows[0]?.status, tickets: tickets.rows[0].total };
  };

  const checkout = await createPix("smoke-webhook-failure-mismatch");
  const wrongAmount = await notify(checkout, { action: "order.processed", status: "processed", amount: checkout.payment.amount + 1 });
  assert.equal(wrongAmount.response.status, 409);
  assert.equal(wrongAmount.payload.error.code, "PAYMENT_AMOUNT_MISMATCH");
  assert.deepEqual(await persisted(checkout.order.id), { payment: "pending", order: "pending_payment", tickets: 0 });
  const wrongReference = await notify(checkout, { action: "order.processed", status: "processed", reference: "different-order" });
  assert.equal(wrongReference.response.status, 409);
  assert.equal(wrongReference.payload.error.code, "PAYMENT_REFERENCE_MISMATCH");
  assert.deepEqual(await persisted(checkout.order.id), { payment: "pending", order: "pending_payment", tickets: 0 });
  const invalidSignature = await notify(checkout, { action: "order.processed", status: "processed", signatureValid: false });
  assert.equal(invalidSignature.response.status, 401);
  assert.deepEqual(await persisted(checkout.order.id), { payment: "pending", order: "pending_payment", tickets: 0 });
  const approved = await notify(checkout, { action: "order.processed", status: "processed" });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.payload));
  assert.deepEqual(await persisted(checkout.order.id), { payment: "approved", order: "paid", tickets: 1 });
  const repeated = await notify(checkout, { action: "order.processed", status: "processed" });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.payload.duplicate, true);
  const delayedPending = await notify(checkout, { action: "order.updated", status: "pending" });
  assert.equal(delayedPending.response.status, 200);
  assert.deepEqual(await persisted(checkout.order.id), { payment: "approved", order: "paid", tickets: 1 });

  const lateCheckout = await createPix("smoke-webhook-failure-late-approval");
  const cancelled = await notify(lateCheckout, { action: "order.canceled", status: "canceled" });
  assert.equal(cancelled.response.status, 200);
  assert.deepEqual(await persisted(lateCheckout.order.id), { payment: "cancelled", order: "cancelled", tickets: 0 });
  const lateApproval = await notify(lateCheckout, { action: "order.processed", status: "processed" });
  assert.equal(lateApproval.response.status, 200);
  assert.equal((await persisted(lateCheckout.order.id)).tickets, 0);
  assert.equal((await readDb()).orders.find((item) => item.id === lateCheckout.order.id).latePaymentReview?.provider,
    "mercado_pago", "Aprovação tardia deve exigir conciliação sem emitir ingresso");

  const commitCheckout = await createPix("smoke-webhook-failure-commit");
  const commitFailed = failCommitForRecord(commitCheckout.order.id, "smoke_webhook_commit_failure");
  let failedCommit;
  try { failedCommit = await notify(commitCheckout, { action: "order.processed", status: "processed" }); }
  finally { restoreQuery(); }
  assert.equal(commitFailed(), true, "O failpoint precisa atingir o commit do webhook aprovado");
  assert.ok(failedCommit.response.status >= 500, "O webhook não pode confirmar uma escrita revertida");
  assert.deepEqual(await persisted(commitCheckout.order.id), { payment: "pending", order: "pending_payment", tickets: 0 });
  const retry = await notify(commitCheckout, { action: "order.processed", status: "processed" });
  assert.equal(retry.response.status, 200, JSON.stringify(retry.payload));
  assert.deepEqual(await persisted(commitCheckout.order.id), { payment: "approved", order: "paid", tickets: 1 });

  const ignoredCheckout = await createPix("smoke-webhook-unknown-commit");
  const ignoredProviderId = ignoredCheckout.payment.providerPaymentId;
  const ignoredEvents = async () => (await queryPostgres(
    "SELECT count(*)::integer AS total FROM webhook_events WHERE provider='mercado_pago' AND provider_payment_id=$1",
    [ignoredProviderId]
  )).rows[0].total;
  // Background ticket-email writes can contain the provider ID too. Arm this
  // failpoint only for the ignored event's transaction, not another worker.
  const ignoredCommitFailed = failCommitForRecord(ignoredProviderId, "smoke_unknown_webhook_commit_failure", 1,
    (statement, args) => statement.startsWith("INSERT INTO webhook_events") && args.some((values) =>
      Array.isArray(values) && values[2] === ignoredProviderId && values[4] === "ignored_unknown_event"));
  let ignoredFailure;
  try { ignoredFailure = await notify(ignoredCheckout, { action: "unknown.operation", status: "pending" }); }
  finally { restoreQuery(); }
  assert.equal(ignoredCommitFailed(), true, "O failpoint precisa atingir o commit do evento ignorado");
  assert.ok(ignoredFailure.response.status >= 500, "Evento ignorado não pode ser confirmado antes do commit");
  assert.equal(await ignoredEvents(), 0);
  assert.deepEqual(await persisted(ignoredCheckout.order.id), { payment: "pending", order: "pending_payment", tickets: 0 });
  const ignoredRetry = await notify(ignoredCheckout, { action: "unknown.operation", status: "pending" });
  assert.equal(ignoredRetry.response.status, 200);
  assert.equal(ignoredRetry.payload.processed, false);
  assert.equal(await ignoredEvents(), 1);
  const ignoredDuplicate = await notify(ignoredCheckout, { action: "unknown.operation", status: "pending" });
  assert.equal(ignoredDuplicate.response.status, 200);
  assert.equal(ignoredDuplicate.payload.duplicate, true);
  assert.equal(await ignoredEvents(), 1);
}

module.exports = { runMercadoPagoWebhookFailureScenarios };
