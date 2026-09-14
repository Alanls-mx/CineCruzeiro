import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { findSessionRoomConflicts } = require("../backend/services/sessionRoomConflictService");

const existingMovie = {
  id: "filme-a",
  title: "Filme A",
  duration: "2h 10min",
  sessions: [{ id: "sessao-a", date: "2026-09-20", time: "19:00", roomId: "sala-1", room: "Sala 1", status: "available" }]
};

function conflicts(candidate, movies = [existingMovie]) {
  return findSessionRoomConflicts({ movies, candidateMovie: { id: "filme-b", duration: "100 min" }, candidate });
}

test("detecta sessões sobrepostas na mesma sala", () => {
  assert.equal(conflicts({ id: "sessao-b", date: "2026-09-20", time: "20:00", roomId: "sala-1" }).length, 1);
});

test("permite sessões consecutivas sem sobreposição", () => {
  assert.equal(conflicts({ id: "sessao-b", date: "2026-09-20", time: "21:10", roomId: "sala-1" }).length, 0);
});

test("não mistura salas diferentes", () => {
  assert.equal(conflicts({ id: "sessao-b", date: "2026-09-20", time: "19:00", roomId: "sala-2" }).length, 0);
});

test("ignora uma sessão cancelada", () => {
  assert.equal(conflicts({ id: "sessao-b", date: "2026-09-20", time: "19:00", roomId: "sala-1" }, [{ ...existingMovie, sessions: [{ ...existingMovie.sessions[0], status: "cancelled" }] }]).length, 0);
});
