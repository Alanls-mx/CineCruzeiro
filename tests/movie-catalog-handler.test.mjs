import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createMovieCatalogHandler } = require("../backend/services/movieCatalogHandler.js");

test("catalog handler leaves unrelated routes to the existing dispatcher", async () => {
  const handle = createMovieCatalogHandler({ getSeatRealtimeService: () => null });
  assert.equal(await handle({ pathname: "/api/rooms", method: "GET", db: {} }), false);
});

test("catalog handler preserves the missing-movie response", async () => {
  let response;
  const handle = createMovieCatalogHandler({
    getSeatRealtimeService: () => null,
    sendJson: (_res, status, body) => { response = { status, body }; }
  });
  const handled = await handle({ pathname: "/api/movies/missing/sessions", method: "POST", db: { movies: [] } });
  assert.equal(handled, true);
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "MOVIE_NOT_FOUND");
});

test("central admin authorization still precedes the catalog handler", () => {
  const source = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
  const dispatcher = source.slice(source.indexOf("async function handleApi("));
  assert.ok(dispatcher.indexOf("if (!ensureAdmin(req, res, db, pathname, method)) return;") < dispatcher.indexOf("if (await handleMovieCatalogRoutes("));
});

test("a sold session still requires confirmation and records an automatic audit reason", async () => {
  const previous = { id: "session-qa", date: "2026-11-10", time: "19:00", status: "active", room: "Sala 1" };
  const movie = { id: "movie-qa", sessions: [previous] };
  const db = { movies: [movie], ticketTypes: [], auditLogs: [] };
  const replies = [];
  const reasons = [];
  let body = { time: "21:00" };
  let writes = 0;
  const handle = createMovieCatalogHandler({
    getSeatRealtimeService: () => null,
    isDeletedMovie: () => false,
    readBody: async () => body,
    sendJson: (_res, status, payload) => replies.push({ status, payload }),
    normalizeMovieSession: (input, _movieId, old) => ({ ...old, ...input }),
    validateSessionRoom: (_db, session) => session,
    sessionRoomConflicts: () => [],
    requireSessionRoomConflictConfirmation: () => false,
    sessionCommercialChanges: () => ["time"],
    sessionHasAuditHistory: () => true,
    sessionStartsAt: (session) => new Date(`${session.date}T${session.time}:00`),
    syncSessionSnapshotRecords: (_db, _movie, _session, { reason }) => {
      reasons.push(reason);
      return { timestamp: new Date().toISOString() };
    },
    postgresEnabled: () => false,
    writeDb: async () => { writes += 1; },
    crypto: { randomBytes: () => Buffer.from("12345678", "hex") }
  });
  const request = { adminUser: { id: "admin-qa", email: "admin@example.test" } };
  const route = { req: request, pathname: "/api/movies/movie-qa/sessions/session-qa", method: "PUT", db };
  assert.equal(await handle(route), true);
  assert.equal(replies.at(-1).status, 409);
  assert.equal(replies.at(-1).payload.error.code, "SESSION_CHANGE_CONFIRMATION_REQUIRED");
  assert.equal(writes, 0);

  body = { ...body, confirmSalesImpact: true };
  assert.equal(await handle(route), true);
  assert.equal(replies.at(-1).status, 200);
  assert.equal(writes, 1);
  assert.deepEqual(reasons, ["Alteração administrativa da sessão"]);
  assert.equal(db.auditLogs[0].userId, "admin-qa");
  assert.equal(db.auditLogs[0].metadata.reason, reasons[0]);
});
