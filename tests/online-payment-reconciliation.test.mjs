import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createOnlinePaymentReconciliationService } = require("../backend/services/onlinePaymentReconciliationService");
const { pendingCheckoutPayment } = require("../backend/services/onlineCheckoutIntentService");

function fixture(provider = "mercado_pago", knownId = "") {
  const config = { environment: "production", accessToken: "synthetic-account" };
  const order = { id: "order-recover-1", status: "pending_payment", totalPrice: 10, reservationExpiresAt: "", customerUserId: "u1" };
  const accountHash = require("../backend/services/onlineCheckoutIntentService").providerAccountFingerprint(provider, config, config.accessToken);
  const payment = pendingCheckoutPayment(order, provider, "pix", "fingerprint", accountHash, "stable-key");
  payment.providerPaymentId = knownId;
  payment.metadata.onlineIntent.state = knownId ? "result_known" : "unknown";
  let persisted = { orders: [order], payments: [payment], tickets: [] };
  let tail = Promise.resolve();
  const calls = { search: 0, fetch: 0, create: 0, finalized: 0 };
  let searchResult = null;
  let fetchResult = null;
  let duringSearch = null;
  const mutation = (task) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
  const readDb = async () => structuredClone(persisted);
  const writeDb = async (db) => { persisted = structuredClone(db); };
  const authority = (id = "ORD_TEST-RECOVERY", overrides = {}) => ({
    provider, id, externalReference: order.id, amount: 10, status: "approved",
    raw: { currency_id: "BRL" }, ...overrides
  });
  const service = createOnlinePaymentReconciliationService({
    withCriticalMutation: mutation, readDb, writeDb,
    activeOnlinePaymentProvider: () => ({ provider, config }),
    paymentService: {
      getMercadoPagoAccessToken: () => config.accessToken,
      fetchMercadoPagoOrder: async () => { calls.fetch++; return fetchResult; },
      searchMercadoPagoOrdersByReference: async () => {
        calls.search++;
        if (duringSearch) await duringSearch({ readDb, writeDb });
        return searchResult;
      }
    },
    pagBankPaymentService: { token: () => config.accessToken,
      fetchOrder: async () => { calls.fetch++; return fetchResult; } },
    createPaymentRecord: (_order, found) => ({ providerPaymentId: found.id, providerReference: order.id,
      metadata: {}, qrCode: "", qrCodeBase64: "", ticketUrl: "", checkoutUrl: "", expiresAt: "" }),
    finalize: async (paymentId, found) => mutation(async () => {
      const db = await readDb();
      const row = db.payments.find((item) => item.id === paymentId);
      if (row.metadata.onlineIntent.state === "completed") return { order: db.orders[0] };
      row.status = found.status;
      row.metadata.onlineIntent.state = "completed";
      if (found.status === "approved" && db.orders[0].status === "pending_payment") {
        db.orders[0].status = "paid";
        db.tickets.push({ id: "ticket-1", orderId: order.id });
      }
      await writeDb(db);
      calls.finalized++;
      return { order: db.orders[0] };
    }),
    logEvent: () => {}
  });
  return { service, paymentId: payment.id, calls, authority,
    setSearch: (value) => { searchResult = value; },
    setFetch: (value) => { fetchResult = value; },
    setDuringSearch: (value) => { duringSearch = value; },
    setIntent: (patch) => { Object.assign(persisted.payments[0].metadata.onlineIntent, patch); },
    snapshot: () => structuredClone(persisted) };
}

test("Mercado Pago recupera uma Order única pela referência sem navegador nem POST", async () => {
  const state = fixture();
  state.setSearch({ total: 1, orders: [state.authority()] });
  assert.equal(await state.service.reconcile(state.paymentId), "completed");
  assert.equal(state.snapshot().orders[0].status, "paid");
  assert.equal(state.snapshot().tickets.length, 1);
  assert.deepEqual(state.calls, { search: 1, fetch: 0, create: 0, finalized: 1 });
  assert.equal(await state.service.reconcile(state.paymentId), "skipped");
});

test("duas instâncias não consultam a mesma intenção simultaneamente", async () => {
  const state = fixture();
  state.setSearch({ total: 1, orders: [state.authority()] });
  const results = await Promise.all([state.service.reconcile(state.paymentId), state.service.reconcile(state.paymentId)]);
  assert.deepEqual(results.sort(), ["completed", "skipped"]);
  assert.equal(state.calls.search, 1);
  assert.equal(state.snapshot().tickets.length, 1);
});

test("PagBank sem Order ID exige revisão e não chama criação nem consulta ambígua", async () => {
  const state = fixture("pag_bank");
  assert.equal(await state.service.reconcile(state.paymentId), "review_required");
  assert.deepEqual(state.calls, { search: 0, fetch: 0, create: 0, finalized: 0 });
  assert.equal(state.snapshot().tickets.length, 0);
});

test("Order conhecida consulta por ID e preserva pendência", async () => {
  const state = fixture("pag_bank", "ORDE_TEST-KNOWN");
  state.setFetch(state.authority("ORDE_TEST-KNOWN", { status: "pending", raw: { currency: "BRL" } }));
  assert.equal(await state.service.reconcile(state.paymentId), "completed");
  assert.equal(state.snapshot().payments[0].status, "pending");
  assert.equal(state.snapshot().tickets.length, 0);
  assert.equal(state.calls.fetch, 1);
});

test("valor, referência e multiplicidade divergentes exigem revisão", async () => {
  for (const response of [
    { total: 1, orders: [fixture().authority("ORD-A", { amount: 11 })] },
    { total: 1, orders: [fixture().authority("ORD-B", { externalReference: "other" })] },
    { total: 2, orders: [fixture().authority("ORD-C")] }
  ]) {
    const state = fixture();
    state.setSearch(response);
    assert.equal(await state.service.reconcile(state.paymentId), "review_required");
    assert.equal(state.snapshot().tickets.length, 0);
  }
});

test("consulta indisponível retém identidade e aplica backoff", async () => {
  const state = fixture();
  assert.equal(await state.service.reconcile(state.paymentId), "unknown");
  const first = state.snapshot().payments[0].metadata.onlineIntent;
  assert.equal(first.idempotencyKey, "stable-key");
  assert.ok(Date.parse(first.nextReconcileAt) > Date.now());
  assert.equal(await state.service.reconcile(state.paymentId), "skipped");
  assert.equal(state.calls.search, 1);
});

test("lease de reconciliação vencido pode ser retomado após reinício", async () => {
  const state = fixture();
  state.setSearch(null);
  const first = await state.service.reconcile(state.paymentId);
  assert.equal(first, "unknown");
  // O caminho de crash é reproduzido no teste PostgreSQL: aqui se verifica
  // que uma tentativa antiga não impede o novo claim quando o lease expira.
  const retry = fixture();
  retry.setIntent({ state: "reconciling", reconcileClaim: "old-worker",
    reconcileLeaseUntil: new Date(Date.now() - 1_000).toISOString() });
  retry.setSearch({ total: 1, orders: [retry.authority()] });
  assert.equal(await retry.service.reconcile(retry.paymentId), "completed");
});

test("webhook concorrente encerra a intenção antes de aplicar resultado da consulta", async () => {
  const state = fixture();
  state.setSearch({ total: 1, orders: [state.authority()] });
  state.setDuringSearch(async ({ readDb, writeDb }) => {
    const db = await readDb();
    db.payments[0].metadata.onlineIntent.state = "completed";
    db.payments[0].status = "approved";
    db.orders[0].status = "paid";
    db.tickets.push({ id: "webhook-ticket", orderId: db.orders[0].id });
    await writeDb(db);
  });
  assert.equal(await state.service.reconcile(state.paymentId), "superseded");
  assert.equal(state.snapshot().tickets.length, 1);
  assert.equal(state.calls.finalized, 0);
});
