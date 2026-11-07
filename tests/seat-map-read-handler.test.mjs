import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createSeatMapReadHandler } = require("../backend/services/seatMapReadHandler.js");

function fixture(permitted = false) {
  const responses = [];
  const handle = createSeatMapReadHandler({
    adminHasPermission: () => permitted,
    buildAdminSessionSeatMap: (input) => ({ showPurchaser: input.showPurchaser }),
    findSessionWithMovie: () => ({ session: { id: "session-1" }, movie: { id: "movie-1" } }),
    listActiveSeatHolds: async () => { throw new Error("holds not requested for nonselected room"); },
    occupiedSeatIds: () => [],
    roomForSession: () => ({ seatSelectionEnabled: false }),
    roomSeatSelectionEnabled: () => false,
    sendJson: (_res, status, body, headers) => responses.push({ status, body, headers })
  });
  const request = (pathname) => handle({
    req: { url: pathname, headers: { host: "localhost" }, adminUser: { id: "staff-1" } },
    res: {}, pathname, method: "GET", db: { movies: [], orders: [], tickets: [] }
  });
  return { request, responses };
}

test("admin seat map hides purchaser unless both permissions are present", async () => {
  const denied = fixture(false);
  assert.equal(await denied.request("/api/admin/sessions/session-1/seat-map"), true);
  assert.equal(denied.responses[0].body.showPurchaser, false);
  assert.deepEqual(denied.responses[0].headers, { "Cache-Control": "private, no-store" });
  const allowed = fixture(true);
  assert.equal(await allowed.request("/api/admin/sessions/session-1/seat-map"), true);
  assert.equal(allowed.responses[0].body.showPurchaser, true);
});

test("missing public session keeps 404 contract", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/sessions/missing/seats"), true);
  assert.equal(responses[0].status, 404);
  assert.equal(responses[0].body.error.code, "SESSION_NOT_FOUND");
});
