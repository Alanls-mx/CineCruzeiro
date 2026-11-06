import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createVenueInputService } = require("../backend/services/venueInputService.js");
const { normalizeRoom, normalizeTicketType } = createVenueInputService({
  slugify: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
});

test("room and ticket input preserve cleanup, seat capacity and defaults", () => {
  const room = normalizeRoom({ name: "Sala Teste", cleanupMinutes: 30, seatSelectionEnabled: true,
    seatLayout: { rows: [{ label: "A", seats: [{ id: "a1", label: "A1" }, { id: "a1", label: "duplicado" }, { id: "a2", label: "A2" }] }] }
  });
  assert.equal(room.id, "sala-teste");
  assert.equal(room.cleanupMinutes, 30);
  assert.equal(room.capacity, 2);
  assert.deepEqual(room.seatLayout.rows[0].seats.map((seat) => seat.id), ["a1", "a2"]);
  assert.equal(room.seatTypes[0].id, "standard");
  assert.throws(() => normalizeRoom({ cleanupMinutes: 121 }), { code: "ROOM_CLEANUP_INVALID", statusCode: 422 });
  assert.throws(() => normalizeRoom({ cleanupMinutes: -1 }), { code: "ROOM_CLEANUP_INVALID", statusCode: 422 });

  const ticket = normalizeTicketType({ name: "Inteira", price: 25, bundleQuantity: 50, active: false });
  assert.equal(ticket.id, "inteira");
  assert.equal(ticket.price, 25);
  assert.equal(ticket.bundleQuantity, 20);
  assert.equal(ticket.active, false);
});
