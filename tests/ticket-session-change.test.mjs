import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { changeTicketSession, destinationSessions, seatsForDestination } = require("../backend/services/ticketSessionChangeService.js");
const { sessionSeatAvailability } = require("../backend/services/sessionSeatAvailability.js");
const { createSessionTicketActionHandler } = require("../backend/public/admin-modules/session-ticket-actions.js");
const ticketCodes = require("../backend/services/ticketCodeService.js");
const { _test: emailParts } = require("../backend/services/emailService.js");

function fixture() {
  const room = (id) => ({ id, name: id, seatSelectionEnabled: true, seatLayout: { rows: [{ id: "A", label: "A", seats: [
    { id: "A1", label: "A1", enabled: true }, { id: "A2", label: "A2", enabled: true }
  ] }] } });
  return {
    movies: [
      { id: "old", title: "Filme anterior", sessions: [{ id: "old-session", date: "2099-01-01", time: "19:00", roomId: "old-room", format: "2D" }] },
      { id: "new", title: "Filme novo", sessions: [{ id: "new-session", date: "2099-01-02", time: "20:00", roomId: "new-room", format: "3D" }] }
    ],
    rooms: [room("old-room"), room("new-room")],
    orders: [{ id: "order", movieId: "old", sessionId: "old-session", status: "paid", totalPrice: 37,
      selectedSeatIds: ["A1"], selectedSeats: [{ id: "A1", label: "A1" }] }],
    payments: [{ id: "payment", orderId: "order", status: "approved", amount: 37 }],
    subscriptionUsage: [{ id: "club-usage", orderId: "order", ticketId: "ticket", creditsUsed: 1 }],
    tickets: [{ id: "ticket", orderId: "order", movieId: "old", movieTitle: "Filme anterior", sessionId: "old-session",
      sessionDate: "2099-01-01", sessionTime: "19:00", sessionRoom: "old-room", seatId: "A1", seat: "A1",
      code: "CC-00000001", shortCode: "CC-00000001", qrToken: "old-token", status: "active", customerEmail: "customer@example.test" }],
    auditLogs: []
  };
}

const adminUser = { id: "owner", email: "owner@example.test" };

test("troca mantém pedido e pagamento, libera origem, ocupa destino e invalida QR antigo", () => {
  const db = fixture();
  const beforeOrder = { ...db.orders[0] };
  const beforePayment = { ...db.payments[0] };
  const beforeClubUsage = { ...db.subscriptionUsage[0] };
  const oldQr = ticketCodes.qrPayload(db.tickets[0].code, db.tickets[0].qrToken);
  const result = changeTicketSession(db, { ticketId: "ticket", sessionId: "new-session", seatId: "A2", adminUser });
  assert.equal(result.previous.sessionId, "old-session");
  assert.equal(result.next.movieTitle, "Filme novo");
  assert.equal(result.ticket.sessionFormat, "3D");
  assert.notEqual(result.ticket.code, "CC-00000001");
  assert.notEqual(result.ticket.qrToken, "old-token");
  assert.equal(db.orders[0].totalPrice, beforeOrder.totalPrice);
  assert.equal(db.orders[0].sessionId, beforeOrder.sessionId);
  assert.deepEqual(db.orders[0].selectedSeatIds, []);
  assert.deepEqual(db.payments[0], beforePayment);
  assert.deepEqual(db.subscriptionUsage[0], beforeClubUsage);
  assert.equal(ticketCodes.findTicketByCode(db.tickets, oldQr), null);
  assert.equal(ticketCodes.findTicketByCode(db.tickets, "CC-00000001"), null);
  assert.equal(sessionSeatAvailability(db, "old-session").sold.has("A1"), false);
  assert.equal(sessionSeatAvailability(db, "new-session").sold.has("A2"), true);
  assert.equal(db.auditLogs.at(-1).before.sessionId, "old-session");
  assert.equal(db.auditLogs.at(-1).after.sessionId, "new-session");
  assert.equal(db.tickets[0].sessionChangeHistory.length, 1);
  assert.deepEqual(destinationSessions(db).map((item) => item.session.id), ["old-session", "new-session"]);
  assert.equal(changeTicketSession(db, { ticketId: "ticket", sessionId: "new-session", seatId: "A2", adminUser }).unchanged, true);
  assert.equal(db.tickets[0].sessionChangeHistory.length, 1);
});

test("troca recusa ingresso usado, pagamento pendente, poltrona ocupada e hold", () => {
  for (const update of [
    (db) => { db.tickets[0].status = "used"; },
    (db) => { db.orders[0].status = "pending_payment"; },
    (db) => { db.orders[0].refundStatus = "pending"; }
  ]) {
    const db = fixture(); update(db);
    assert.throws(() => changeTicketSession(db, { ticketId: "ticket", sessionId: "new-session", seatId: "A1", adminUser }),
      { code: "TICKET_CHANGE_UNAVAILABLE" });
  }
  const db = fixture();
  db.tickets.push({ id: "other", sessionId: "new-session", seatId: "A1", status: "active" });
  assert.deepEqual(seatsForDestination(db, db.movies[1].sessions[0], [{ seatId: "A2" }]), []);
  assert.throws(() => changeTicketSession(db, { ticketId: "ticket", sessionId: "new-session", seatId: "A1", adminUser }),
    { code: "SESSION_CHANGE_SEAT_UNAVAILABLE" });
  assert.throws(() => changeTicketSession(db, { ticketId: "ticket", sessionId: "new-session", seatId: "A2", holds: [{ seatId: "A2" }], adminUser }),
    { code: "SESSION_CHANGE_SEAT_UNAVAILABLE" });
  assert.equal(db.tickets[0].sessionId, "old-session");
  assert.equal(db.orders[0].selectedSeatIds[0], "A1");
});

test("ação delegada abre troca uma única vez", () => {
  const calls = [];
  const handle = createSessionTicketActionHandler({ openTicketSessionChange: (id) => calls.push(id) });
  assert.equal(handle({ target: { closest: (selector) => selector.includes("ticket-action")
    ? { dataset: { adminTicketAction: "change-session", adminTicketValue: "ticket" } } : null } }), true);
  assert.deepEqual(calls, ["ticket"]);
  assert.match(emailParts.baseLayout("Troca", "<p>Nova sessão</p>", { brand: { name: "Cinema QA" } }), /Cinema QA/);
});
