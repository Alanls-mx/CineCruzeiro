import { test } from "node:test";
import assert from "node:assert/strict";
import recoveryFactory from "../backend/services/pointPaymentRecoveryHandler.js";

function fixture(providerPayment, options = {}) {
  const events = [];
  let persisted = {
    orders: [{ id: "pedido", status: "pending_payment" }],
    payments: [{ id: "pagamento", orderId: "pedido", status: "pending", amount: 10, providerPaymentId: "ord-provedor", providerReference: "referencia", metadata: { kind: "point_sale", terminalId: "terminal" } }],
    tickets: []
  };
  const sent = [];
  const handler = recoveryFactory.createPointPaymentRecoveryHandler({
    getAdminUser: () => options.admin === false ? null : { id: "operador" },
    sendJson: (_res, status, payload) => { events.push("response"); sent.push({ status, payload }); },
    integrationConfigService: { resolvedConfig: () => ({}) },
    attemptPointCreation: async () => { events.push("retry"); return providerPayment; },
    cardTerminalProvider: { getStatus: async () => { events.push("provider"); if (options.lost) throw new Error("sem conexão"); return providerPayment; } },
    pointPaymentOrders: (db, payment) => db.orders.filter((order) => order.id === payment.orderId),
    orderRequiresConfirmedPrint: () => false,
    mercadoPagoReferenceMatches: (_payment, reference) => reference === "referencia",
    withCriticalMutation: async (fn) => { events.push("transaction"); return fn(); },
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => { persisted = structuredClone(db); events.push("commit"); },
    applyPointPaymentStatus: (db, payment, provider) => {
      payment.status = provider.status;
      if (provider.status === "approved") db.orders[0].status = "paid";
      return { orders: db.orders, tickets: [], newlyPaidOrders: provider.status === "approved" ? db.orders : [], reconciliationRequired: false };
    },
    queueBoxOfficePointPrint: async () => ({ status: "not_requested" }),
    syncBoxOfficePointPrint: async () => null,
    finalizePrintedOrders: () => { throw new Error("não esperado"); },
    shouldDeliverBoxOfficeTicketsByEmail: () => true,
    queueTicketEmailDelivery: () => { events.push("email"); },
    logEvent: () => {}
  });
  return {
    events, sent,
    run: () => handler({ req: {}, res: {}, db: structuredClone(persisted), pathname: "/api/box-office/point-payments/pagamento", method: "GET" })
  };
}

test("referência ou valor divergente não altera pedido nem emite ingresso", async () => {
  const wrongReference = fixture({ id: "ord-provedor", status: "approved", externalReference: "outra", amount: 10 });
  assert.equal(await wrongReference.run(), true);
  assert.equal(wrongReference.sent[0].status, 409);
  assert.equal(wrongReference.sent[0].payload.error.code, "POINT_REFERENCE_MISMATCH");
  assert.equal(wrongReference.events.includes("transaction"), false);
  const wrongAmount = fixture({ id: "ord-provedor", status: "approved", externalReference: "referencia", amount: 11 });
  await wrongAmount.run();
  assert.equal(wrongAmount.sent[0].payload.error.code, "POINT_AMOUNT_MISMATCH");
  assert.equal(wrongAmount.events.includes("commit"), false);
});

test("resposta aprovada só é enviada e entrega agendada depois do commit", async () => {
  const state = fixture({ id: "ord-provedor", status: "approved", externalReference: "referencia", amount: 10 });
  assert.equal(await state.run(), true);
  assert.equal(state.sent[0].status, 200);
  assert.deepEqual(state.events, ["provider", "transaction", "commit", "response", "email"]);
});

test("perda de conexão mantém recuperação e não confirma pagamento", async () => {
  const state = fixture(null, { lost: true });
  await state.run();
  assert.equal(state.sent[0].status, 200);
  assert.equal(state.sent[0].payload.reconnecting, true);
  assert.equal(state.sent[0].payload.completed, false);
  assert.equal(state.events.includes("commit"), false);
});

test("acesso administrativo é verificado antes de consultar o provedor", async () => {
  const state = fixture(null, { admin: false });
  await state.run();
  assert.equal(state.sent[0].status, 401);
  assert.deepEqual(state.events, ["response"]);
});
