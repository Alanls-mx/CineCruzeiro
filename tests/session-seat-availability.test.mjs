import test from "node:test";
import assert from "node:assert/strict";
import service from "../backend/services/sessionSeatAvailability.js";

const now = Date.parse("2026-10-09T20:00:00Z");
const db = {
  tickets: [{ sessionId: "s1", seatId: "A1", status: "issued" }],
  orders: [
    { sessionId: "s1", status: "pending_payment", selectedSeatIds: ["A2"], reservationExpiresAt: "2026-10-09T20:10:00Z" },
    { sessionId: "s1", status: "pending_payment", selectedSeatIds: ["A3"], reservationExpiresAt: "2026-10-09T19:59:00Z" },
    { sessionId: "s1", status: "paid", selectedSeatIds: ["A4"] },
    { sessionId: "s2", status: "pending_payment", selectedSeatIds: ["A5"] }
  ]
};

test("Pix pendente reserva a poltrona sem registra-la como vendida", () => {
  const state = service.sessionSeatAvailability(db, "s1", now);
  assert.deepEqual([...state.sold].sort(), ["A1", "A4"]);
  assert.deepEqual([...state.reserved], ["A2"]);
});

test("pagamento aprovado transfere reserva para vendida; expiracao libera a poltrona", () => {
  const approved = structuredClone(db);
  approved.orders[0].status = "paid";
  const afterApproval = service.sessionSeatAvailability(approved, "s1", now);
  assert.equal(afterApproval.sold.has("A2"), true);
  assert.equal(afterApproval.reserved.has("A2"), false);

  const afterExpiration = service.sessionSeatAvailability(db, "s1", now + 11 * 60 * 1000);
  assert.equal(afterExpiration.sold.has("A2"), false);
  assert.equal(afterExpiration.reserved.has("A2"), false);
});
