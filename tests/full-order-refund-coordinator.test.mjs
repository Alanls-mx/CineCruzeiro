import { test } from "node:test";
import assert from "node:assert/strict";
import refundFactory from "../backend/services/fullOrderRefundCoordinator.js";

function fixture() {
  let persisted = {
    orders: [{ id: "pedido", status: "paid", concessionItems: [], stockReservationStatus: "none" }],
    payments: [{ id: "pagamento", orderId: "pedido", status: "approved", amount: 10, provider: "mercado_pago", metadata: {} }],
    tickets: [{ id: "ingresso", orderId: "pedido", status: "active" }]
  };
  let failProvider = false;
  let failFinalCommit = false;
  let commits = 0;
  let mutationTail = Promise.resolve();
  const events = [];
  const coordinator = refundFactory.createFullOrderRefundCoordinator({
    withCriticalMutation: (fn) => {
      const result = mutationTail.then(fn);
      mutationTail = result.catch(() => {});
      return result;
    },
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => {
      commits += 1;
      if (failFinalCommit && commits === 2) throw new Error("commit falhou");
      persisted = structuredClone(db);
      events.push(`commit:${commits}`);
    },
    refundError: (code, message, statusCode = 409) => Object.assign(new Error(message), { code, statusCode }),
    orderPayment: (db, id) => db.payments.find((payment) => payment.orderId === id),
    orderTickets: (db, id) => db.tickets.filter((ticket) => ticket.orderId === id),
    isOrderSessionExpired: () => false,
    cancelOrder: (_db, order) => { order.status = "cancelled"; },
    refundProviderConfig: () => ({ accessToken: "token", environment: "production" }),
    paymentService: { getMercadoPagoAccessToken: () => "token" },
    prepareRefund: () => ({ id: "refund-original", amount: 10, status: "pending" }),
    appendOrderAudit: () => {},
    structuredCloneSafe: structuredClone,
    broadcastReleasedOrderSeats: async () => { events.push("assentos"); },
    submitFullRefund: async (refund) => {
      events.push(`provider:${refund.id}`);
      if (failProvider) throw new Error("resposta perdida");
      return { status: "completed", providerRefundId: "devolucao-provedor" };
    },
    logEvent: () => {},
    goodsFiscalService: { cancelUnissued: () => {} },
    eachStockedOrderItem: () => {},
    adjustConcessionStock: () => {}
  });
  return { coordinator, events, read: () => persisted, failProvider: (value) => { failProvider = value; }, failFinalCommit: (value) => { failFinalCommit = value; } };
}

test("intenção é confirmada antes do provedor; direitos só mudam no commit final", async () => {
  const state = fixture();
  const result = await state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "admin" });
  assert.deepEqual(state.events, ["commit:1", "provider:refund-original", "commit:2", "assentos"]);
  assert.equal(result.order.status, "refunded");
  assert.equal(state.read().tickets[0].status, "refunded");
  await state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "admin" });
  assert.equal(state.events.filter((event) => event.startsWith("provider:")).length, 1);
});

test("resposta externa perdida deixa direitos ativos e retry usa a chave original", async () => {
  const state = fixture();
  state.failProvider(true);
  await assert.rejects(state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "admin" }),
    (error) => error.code === "REFUND_PENDING");
  assert.equal(state.read().orders[0].status, "paid");
  assert.equal(state.read().tickets[0].status, "active");
  assert.equal(state.read().payments[0].metadata.cancellationRefund.id, "refund-original");
  state.failProvider(false);
  await state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "admin" });
  assert.deepEqual(state.events.filter((event) => event.startsWith("provider:")), ["provider:refund-original", "provider:refund-original"]);
});

test("falha no commit final preserva a intenção e não libera direitos", async () => {
  const state = fixture();
  state.failFinalCommit(true);
  await assert.rejects(state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "admin" }), /commit falhou/);
  assert.equal(state.read().orders[0].status, "paid");
  assert.equal(state.read().tickets[0].status, "active");
  assert.equal(state.read().payments[0].metadata.cancellationRefund.id, "refund-original");
  assert.equal(state.events.includes("assentos"), false);
});

test("dois operadores reutilizam a mesma identidade de estorno e liberam direitos uma vez", async () => {
  const state = fixture();
  const results = await Promise.all([
    state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "operador-a" }),
    state.coordinator.cancelOrderWithRefund("pedido", "desistência", { id: "operador-b" })
  ]);
  assert.deepEqual(results.map((result) => result.order.status), ["refunded", "refunded"]);
  assert.deepEqual(new Set(state.events.filter((event) => event.startsWith("provider:"))), new Set(["provider:refund-original"]));
  assert.equal(state.read().payments[0].metadata.cancellationRefund.id, "refund-original");
  assert.equal(state.read().tickets[0].status, "refunded");
  assert.equal(state.events.filter((event) => event === "assentos").length, 2,
    "Duas respostas podem atualizar a visualização; a mutação financeira é idempotente");
});
