import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const room = require("../backend/services/roomReadProjectionService.js");
const labels = require("../backend/services/commercialStatusLabelService.js");

test("baseline room projection prefers label over stale room ID and preserves seat rows", () => {
  const db = { rooms: [
    { id: "stale", name: "Sala A", technology: "2D" },
    { id: "correct", name: "Sala B", technology: "3D", seatSelectionEnabled: true,
      seatLayout: { rows: [{ id: "r1", label: "A", seats: [{ id: "A1", label: "A1" }, { id: "A2", enabled: false }] }] } }
  ] };
  const session = { roomId: "stale", room: "Sala B (3D)" };
  assert.equal(room.roomForSession(db, session).id, "correct");
  assert.equal(room.sessionWithCurrentRoom(db, session).room, "Sala B (3D)");
  assert.equal(room.sessionWithCurrentRoom(db, session).roomId, "correct");
  assert.equal(room.roomSeatSelectionEnabled(db.rooms[1]), true);
  assert.equal(room.roomSeats(db.rooms[1])[0].rowLabel, "A");
  assert.equal(room.roomSeatTypes(db.rooms[1]).length, 0);
  assert.equal(room.roomForSession(db, { roomId: "stale", room: "unknown" }).id, "stale");
});

test("baseline administrative labels preserve financial and campaign wording", () => {
  assert.equal(labels.paymentStatusLabel("APPROVED"), "Pago");
  assert.equal(labels.orderStatusLabel("paid_pending_print"), "Pago; aguardando impressão");
  assert.equal(labels.originLabel("box_office"), "Bilheteria");
  assert.equal(labels.methodLabel("point_credit"), "Crédito na Point");
  assert.equal(labels.methodLabel("CREDIT_CARD"), "Cartão");
  assert.equal(labels.providerLabel("pag_bank"), "PagBank");
  assert.equal(labels.campaignStatusLabel("completed_with_errors"), "Concluída com falhas");
  assert.equal(labels.campaignStatusLabel("unknown"), "Rascunho");
});
