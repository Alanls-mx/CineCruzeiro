import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createSessionScheduleView } = require("../backend/public/admin-modules/session-schedule-view.js");

test("schedule suggestion respects the room cleaning interval", () => {
  const movie = { id: "movie", title: "Filme QA", duration: "100 min", sessions: [
    { id: "busy", date: "2026-11-10", time: "19:00", roomId: "room", room: "Sala QA", status: "available" }
  ] };
  const state = { content: { calendar: { today: "2026-11-06" }, movies: [movie], rooms: [
    { id: "room", name: "Sala QA", cleanupMinutes: 20 }
  ] }, editingSessionId: "" };
  const fields = { sessionDate: { value: "2026-11-10" },
    sessionRoom: { value: "Sala QA", selectedOptions: [{ dataset: { roomId: "room" } }] },
    movieDuration: { value: "100 min" } };
  const view = createSessionScheduleView({ state, $: (id) => fields[id] || null,
    currentMovie: () => movie });
  const suggestion = view.suggestedSessionSchedule();
  assert.equal(suggestion.duration, 100);
  assert.equal(suggestion.turnaround, 20);
  assert.equal(suggestion.time, "21:00");
  assert.equal(view.globalSessionConflictMap(view.globalSessionEntries()).size, 0);
});
