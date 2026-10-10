import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { findSessionRoomConflicts } = require("../backend/services/sessionRoomConflictService");
const { buildSessionAutocorrectPlan } = require("../backend/services/sessionScheduleAutocorrectService");
const room = { id: "room", name: "Sala", cleanupMinutes: 30 };
const session = (id, date, time, roomId = "room") => ({ id, date, time, roomId, room: "Sala", status: "available" });
const movie = { id: "film", title: "Filme", duration: "120 min", sessions: [session("late", "2099-01-01", "23:00")] };
const conflicts = (candidate, rooms = [room]) => findSessionRoomConflicts({ movies: [movie], rooms, candidateMovie: movie, candidate });

test("cleanup crosses midnight and includes its exact boundary", () => {
  assert.equal(conflicts(session("next", "2099-01-02", "01:29")).length, 1);
  assert.equal(conflicts(session("next", "2099-01-02", "01:30")).length, 0);
  assert.equal(conflicts(session("before", "2099-01-01", "20:30")).length, 0);
  assert.equal(conflicts(session("before", "2099-01-01", "20:31")).length, 1);
});

test("cleanup is room-specific, can be zero and ignores canceled sessions", () => {
  assert.equal(conflicts(session("next", "2099-01-02", "01:00"), [{ ...room, cleanupMinutes: 0 }]).length, 0);
  assert.equal(conflicts(session("other", "2099-01-02", "01:00", "other-room")).length, 0);
  assert.equal(conflicts({ ...session("canceled", "2099-01-01", "23:30"), status: "cancelled" }).length, 0);
});

test("legacy room labels resolve to the configured room", () => {
  const legacy = { ...movie, sessions: [{ ...movie.sessions[0], roomId: "", room: "Sala" }] };
  const found = findSessionRoomConflicts({ movies: [legacy], rooms: [room], candidateMovie: legacy, candidate: session("next", "2099-01-02", "01:10") });
  assert.equal(found.length, 1);
  assert.equal(found[0].cleanupMinutes, 30);
  const legacyCandidate = { ...session("next", "2099-01-02", "01:10"), roomId: "", room: "Sala (Laser antigo)" };
  const legacyFound = findSessionRoomConflicts({ movies: [legacy], rooms: new Map([[room.id, room]]), candidateMovie: legacy, candidate: legacyCandidate });
  assert.equal(legacyFound[0].cleanupMinutes, 30);
});

test("autocorrect never reduces the configured room minimum", () => {
  const plan = buildSessionAutocorrectPlan({ rooms: [room], movies: [{ ...movie, sessions: [...movie.sessions, session("next", "2099-01-02", "01:10")] }], turnaroundMinutes: 0, now: Date.parse("2098-01-01") });
  assert.deepEqual(plan.changes[0].to, { date: "2099-01-02", time: "01:30" });
  assert.equal(plan.roomMinimums.room, 30);
});
