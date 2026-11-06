import { test } from "node:test";
import assert from "node:assert/strict";
import seatAssignment from "../backend/services/orderSeatAssignmentService.js";

const room = {
  seats: [
    { id: "A1", label: "A1", enabled: true },
    { id: "A2", label: "A2", enabled: true },
    { id: "A3", label: "A3", enabled: true }
  ]
};
const { assignSeatsToOrder } = seatAssignment.createOrderSeatAssignmentService({
  roomForSession: () => room,
  roomSeatSelectionEnabled: () => true,
  roomSeats: (value) => value.seats,
  roomSeatTypes: () => [],
  orderTicketCount: (order) => order.ticketItems.reduce((sum, item) => sum + item.quantity, 0)
});

test("autoatribuição pula a reserva de outro pedido e mantém a última poltrona", () => {
  const db = { orders: [{ id: "outro", sessionId: "s", status: "pending_payment", selectedSeatIds: ["A1", "A2"] }] };
  const order = { id: "novo", sessionId: "s", autoAssignSeats: true, ticketItems: [{ quantity: 1 }] };
  assert.equal(assignSeatsToOrder(db, order, { id: "s" }).seatDisplay, "A3");
});

test("reserva de outro pedido bloqueia assento e a própria não bloqueia retry", () => {
  const db = { orders: [{ id: "pedido", sessionId: "s", status: "pending_payment", selectedSeatIds: ["A1"] }] };
  const order = { id: "pedido", sessionId: "s", selectedSeatIds: ["A1"], ticketItems: [{ quantity: 1 }] };
  assert.equal(assignSeatsToOrder(db, order, { id: "s" }).selectedSeats[0].label, "A1");
  assert.throws(() => assignSeatsToOrder(db, { ...order, id: "outro" }, { id: "s" }),
    (error) => error.code === "SEAT_UNAVAILABLE" && error.statusCode === 409);
});

test("mapa alterado mantém erro de conflito", () => {
  assert.throws(() => assignSeatsToOrder({}, { id: "pedido", selectedSeatIds: ["X1"], ticketItems: [{ quantity: 1 }] }, { id: "s" }),
    (error) => error.code === "SEAT_LAYOUT_CHANGED" && error.statusCode === 409);
});
