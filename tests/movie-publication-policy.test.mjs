import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { hasAvailableSession, moviePremiereTiming, nearestAvailableSession, shouldPublishUpcomingMovie } = require("../backend/services/moviePublicationPolicy");
const NOW = new Date("2026-09-12T15:00:00.000Z");

test("publica filme em breve após a estreia quando existe sessão disponível", () => {
  const movie = { status: "upcoming", releaseDate: "2026-09-12", sessions: [{ date: "2026-09-12", time: "19:00", status: "available" }] };
  assert.equal(hasAvailableSession(movie, NOW), true);
  assert.equal(shouldPublishUpcomingMovie(movie, "2026-09-12", NOW), true);
});

test("não publica antes da estreia nem sem sessão disponível", () => {
  assert.equal(shouldPublishUpcomingMovie({ status: "upcoming", releaseDate: "2026-09-13", sessions: [{ date: "2026-09-13", time: "19:00" }] }, "2026-09-12", NOW), false);
  assert.equal(shouldPublishUpcomingMovie({ status: "upcoming", releaseDate: "2026-09-12", sessions: [] }, "2026-09-12", NOW), false);
  assert.equal(shouldPublishUpcomingMovie({ status: "upcoming", releaseDate: "2026-09-12", autoPublish: true, sessions: [] }, "2026-09-12", NOW), false);
});

test("publica pela sessão mais próxima nas 24 horas anteriores com selo de pré-estreia", () => {
  const movie = {
    status: "upcoming",
    releaseDate: "2026-09-13",
    sessions: [
      { id: "later", date: "2026-09-14", time: "19:00", status: "available" },
      { id: "nearest", date: "2026-09-13", time: "10:00", status: "available" }
    ]
  };
  const now = new Date("2026-09-12T14:00:00.000Z");
  assert.equal(nearestAvailableSession(movie, now)?.id, "nearest");
  assert.equal(moviePremiereTiming(movie, now)?.tag, "Pré-Estreia");
  assert.equal(shouldPublishUpcomingMovie(movie, "2026-09-12", now), true);
});

test("troca o selo para estreia ao alcançar a data e o horário da sessão", () => {
  const movie = { status: "upcoming", sessions: [{ id: "premiere", date: "2026-09-12", time: "19:00", status: "available" }] };
  const timing = moviePremiereTiming(movie, new Date("2026-09-12T22:00:00.000Z"));
  assert.equal(timing?.tag, "Estreia");
  assert.equal(timing?.publish, true);
});

test("ignora sessões encerradas ou indisponíveis", () => {
  const movie = { status: "upcoming", releaseDate: "2026-09-12", sessions: [{ date: "2026-09-12", time: "10:00", status: "available" }, { date: "2026-09-12", time: "19:00", status: "cancelled" }] };
  assert.equal(hasAvailableSession(movie, NOW), false);
});
