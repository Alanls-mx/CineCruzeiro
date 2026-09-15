import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const adminSource = fs.readFileSync(path.join(dirname, "../backend/public/admin.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(dirname, "../backend/public/admin.html"), "utf8");

test("nova sessão parte da data de estreia e recebe sugestão de horário", () => {
  assert.match(adminSource, /releaseDate >= adminTodayKey\(\) \? releaseDate : adminTodayKey\(\)/);
  assert.match(adminSource, /function suggestedSessionSchedule\(\)/);
  assert.match(adminSource, /considerando \$\{suggestion\.duration\} min de filme/);
  assert.match(adminHtml, /id="sessionScheduleSuggestion"/);
});

test("a sugestão respeita alterações manuais do operador", () => {
  assert.match(adminSource, /sessionTimeManuallyEdited = true/);
  assert.match(adminSource, /apply: !state\.sessionTimeManuallyEdited/);
});
