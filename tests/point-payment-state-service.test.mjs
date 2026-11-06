import { test } from "node:test";
import assert from "node:assert/strict";
import stateFactory from "../backend/services/pointPaymentStateService.js";

let issued = 0;
let released = 0;
const { applyPointPaymentStatus } = stateFactory.createPointPaymentStateService({
  paymentStatusAfterWebhook: (_current, incoming) => incoming,
  pointPaymentOrders: (db, payment) => db.orders.filter((order) => order.id === payment.orderId),
  orderRequiresConfirmedPrint: () => false,
  stagePaidOrderForPrint: () => { throw new Error("não esperado"); },
  finalizePaidOrder: (_db, order) => { issued += 1; order.status = "paid"; return [{ id: "ingresso" }]; },
  releaseConcessionReservation: () => { released += 1; }
});
const payment = () => ({ id: "pagamento", orderId: "pedido", status: "pending", metadata: { kind: "point_sale" } });

test("aprovação autorizada é a única transição que chama emissão", () => {
  issued = 0;
  const db = { orders: [{ id: "pedido", status: "pending_payment" }] };
  const pending = applyPointPaymentStatus(db, payment(), { status: "pending" });
  assert.equal(pending.tickets.length, 0);
  assert.equal(issued, 0);
  const approved = applyPointPaymentStatus(db, payment(), { status: "approved" });
  assert.equal(approved.tickets.length, 1);
  assert.equal(issued, 1);
  assert.equal(db.orders[0].status, "paid");
});

test("aprovação tardia após cancelamento exige conciliação sem emitir ingresso", () => {
  issued = 0;
  const db = { orders: [{ id: "pedido", status: "cancelled" }] };
  const localPayment = payment();
  const result = applyPointPaymentStatus(db, localPayment, { status: "approved" });
  assert.equal(result.reconciliationRequired, true);
  assert.equal(result.tickets.length, 0);
  assert.equal(issued, 0);
  assert.equal(localPayment.metadata.reconciliationReason, "point_approved_after_order_closed");
});

test("cancelamento de pagamento pendente libera reserva, sem direito emitido", () => {
  released = 0;
  const db = { orders: [{ id: "pedido", status: "pending_payment" }] };
  const result = applyPointPaymentStatus(db, payment(), { status: "cancelled" });
  assert.equal(result.tickets.length, 0);
  assert.equal(db.orders[0].status, "cancelled");
  assert.equal(released, 1);
});
