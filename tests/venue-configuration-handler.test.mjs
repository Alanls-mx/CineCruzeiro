import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createVenueConfigurationHandler } = require("../backend/services/venueConfigurationHandler.js");

test("venue handler leaves unrelated routes untouched", async () => {
  const handle = createVenueConfigurationHandler({ getSeatRealtimeService: () => null });
  assert.equal(await handle({ pathname: "/api/movies", method: "GET", db: {} }), false);
});

test("venue handler preserves missing room and ticket type responses", async () => {
  const responses = [];
  const handle = createVenueConfigurationHandler({
    getSeatRealtimeService: () => null,
    sendJson: (_res, status, body) => responses.push({ status, body })
  });
  assert.equal(await handle({ pathname: "/api/rooms/missing", method: "PUT", db: { rooms: [] } }), true);
  assert.equal(await handle({ pathname: "/api/ticket-types/missing", method: "DELETE", db: { ticketTypes: [] } }), true);
  assert.deepEqual(responses.map((item) => item.status), [404, 404]);
});
