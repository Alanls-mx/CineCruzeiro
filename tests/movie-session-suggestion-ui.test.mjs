import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogEvents = fs.readFileSync(path.join(dirname, "../backend/public/admin-modules/catalog-and-room-events.js"), "utf8");
const sessionsSource = fs.readFileSync(path.join(dirname, "../backend/public/admin-modules/movie-sessions-view.js"), "utf8");
const scheduleSource = fs.readFileSync(path.join(dirname, "../backend/public/admin-modules/session-schedule-view.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(dirname, "../backend/public/admin.html"), "utf8");

test("nova sessão parte da data de estreia e recebe sugestão de horário", () => {
  assert.match(sessionsSource, /releaseDate >= adminTodayKey\(\) \? releaseDate : adminTodayKey\(\)/);
  assert.match(scheduleSource, /function suggestedSessionSchedule\(\)/);
  assert.match(scheduleSource, /considerando \$\{suggestion\.duration\} min de filme/);
  assert.match(adminHtml, /id="sessionScheduleSuggestion"/);
  assert.match(adminHtml, /id="sessionUseSuggestedTime"/);
});

test("a sugestão respeita alterações manuais do operador", () => {
  assert.match(catalogEvents, /sessionTimeManuallyEdited = true/);
  assert.match(catalogEvents, /apply: !state\.sessionTimeManuallyEdited/);
  assert.match(catalogEvents, /sessionTimeManuallyEdited = false;\s*updateSessionScheduleSuggestion\(\)/);
  assert.match(scheduleSource, /date === adminTodayKey\(\)/);
});
