import test from "node:test";
import assert from "node:assert/strict";
import service from "../backend/services/adminSessionSeatMapService.js";

const room = {
  name: "Sala 1", seatSelectionEnabled: true,
  seatTypes: [{ id: "standard", name: "Padrão", color: "#123456" }],
  seatLayout: { screenLabel: "TELA", rows: [{ id: "A", label: "A", seats: [
    { id: "a1", label: "A1", typeId: "standard" },
    { id: "a2", label: "A2", typeId: "standard", aisleAfter: true },
    { id: "a3", label: "A3", typeId: "standard" },
    { id: "a4", label: "A4", typeId: "standard" },
    { id: "a5", label: "A5", typeId: "standard", enabled: false }
  ] }] }
};
const input = {
  movie: { title: "Filme" }, session: { id: "session-1", date: "2026-10-09", time: "19:00" }, room,
  tickets: [{ sessionId: "session-1", seatId: "a1", orderId: "order-1", ticketType: "Inteira", status: "issued" }],
  orders: [
    { id: "order-1", sessionId: "session-1", status: "paid", customerName: "Maria Silva", createdAt: "2026-10-09T10:00:00Z", paidAt: "2026-10-09T10:01:00Z" },
    { id: "order-2", sessionId: "session-1", status: "pending_payment", selectedSeatIds: ["a2"], customerName: "João", createdAt: "2026-10-09T10:02:00Z" }
  ],
  holds: [{ seatId: "a3" }], occupiedSeatIds: ["a1"]
};

test("mapa usa configuracao real, ocupacao, corredor e horario da compra", () => {
  const map = service.buildAdminSessionSeatMap({ ...input, showPurchaser: true });
  assert.equal(map.roomName, "Sala 1");
  assert.equal(map.screenLabel, "TELA");
  assert.deepEqual(map.rows[0].seats.map((seat) => seat.status), ["sold", "pending", "held", "available", "blocked"]);
  assert.equal(map.rows[0].seats[1].aisleAfter, true);
  assert.equal(map.rows[0].seats[0].purchase.customerName, "Maria Silva");
  assert.equal(map.rows[0].seats[0].purchase.createdAt, "2026-10-09T10:00:00Z");
  assert.deepEqual(map.counts, { available: 1, sold: 1, pending: 1, held: 1, blocked: 1 });
});

test("mapa oculta dados de compradores sem permissao", () => {
  const map = service.buildAdminSessionSeatMap({ ...input, showPurchaser: false });
  assert.equal(map.rows[0].seats[0].purchase, undefined);
  assert.equal(map.rows[0].seats[1].purchase, undefined);
});
