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
