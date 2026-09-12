import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { hasAvailableSession, shouldPublishUpcomingMovie } = require("../backend/services/moviePublicationPolicy");
const NOW = new Date("2026-09-12T15:00:00.000Z");

test("publica filme em breve após a estreia quando existe sessão disponível", () => {
  const movie = { status: "upcoming", releaseDate: "2026-09-12", sessions: [{ date: "2026-09-12", time: "19:00", status: "available" }] };
  assert.equal(hasAvailableSession(movie, NOW), true);
  assert.equal(shouldPublishUpcomingMovie(movie, "2026-09-12", NOW), true);
});

test("não publica antes da estreia nem sem sessão disponível", () => {
  assert.equal(shouldPublishUpcomingMovie({ status: "upcoming", releaseDate: "2026-09-13", sessions: [{ date: "2026-09-13", time: "19:00" }] }, "2026-09-12", NOW), false);
  assert.equal(shouldPublishUpcomingMovie({ status: "upcoming", releaseDate: "2026-09-12", sessions: [] }, "2026-09-12", NOW), false);
});

test("ignora sessões encerradas ou indisponíveis", () => {
  const movie = { status: "upcoming", releaseDate: "2026-09-12", sessions: [{ date: "2026-09-12", time: "10:00", status: "available" }, { date: "2026-09-12", time: "19:00", status: "cancelled" }] };
  assert.equal(hasAvailableSession(movie, NOW), false);
});
