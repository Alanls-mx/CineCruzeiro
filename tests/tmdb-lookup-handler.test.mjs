import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createTmdbLookupHandler } = require("../backend/services/tmdbLookupHandler.js");

test("TMDB lookup keeps search validation, result limit and movie mapping", async () => {
  const calls = [];
  const handler = createTmdbLookupHandler({
    tmdbFetch: async (pathname, options) => { calls.push({ pathname, options }); return pathname === "/search/movie"
      ? { results: Array.from({ length: 10 }, (_, id) => ({ id, title: `Filme ${id}`, original_title: `Original ${id}`, release_date: "2026-10-09", overview: "Sinopse", poster_path: "/poster.jpg" })) }
      : { id: 42, title: "Detalhe" }; },
    tmdbMoviePayload: (data) => ({ tmdbId: data.id, title: data.title }),
    slugify: (value) => value,
    sendJson: (res, status, body) => Object.assign(res, { status, body })
  });
  const missing = {};
  assert.equal(await handler.handleTmdbSearchRoute({ req: { url: "/api/tmdb/search", headers: { host: "local.test" } }, res: missing, pathname: "/api/tmdb/search", method: "GET", db: {} }), true);
  assert.equal(missing.status, 400);
  assert.deepEqual(calls, []);

  const search = {};
  assert.equal(await handler.handleTmdbSearchRoute({ req: { url: "/api/tmdb/search?query=Filme", headers: { host: "local.test" } }, res: search, pathname: "/api/tmdb/search", method: "GET", db: {} }), true);
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 8);
  assert.equal(search.body[0].posterUrl, "https://image.tmdb.org/t/p/w342/poster.jpg");
  assert.equal(calls[0].options.region, "BR");

  const movie = {};
  assert.equal(await handler.handleTmdbMovieRoute({ res: movie, pathname: "/api/tmdb/movie/42", method: "GET", db: {} }), true);
  assert.deepEqual(movie, { status: 200, body: { tmdbId: 42, title: "Detalhe" } });
  assert.equal(await handler.handleTmdbMovieRoute({ res: {}, pathname: "/api/tmdb/movie/42", method: "POST", db: {} }), false);
});
