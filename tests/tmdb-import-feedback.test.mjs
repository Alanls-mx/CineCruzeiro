import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const server = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");

test("importação TMDB retorna o diagnóstico dos campos não coletados", () => {
  assert.match(server, /function tmdbMissingMovieFields\(/);
  assert.match(server, /\["duration", "Duração", 1, runtimeMinutes\]/);
  assert.match(server, /\["posterUrl", "Pôster vertical", 2, posterUrl\]/);
  assert.match(server, /tmdbMissingFields,/);
});

test("admin orienta o operador e oferece atalhos para preencher cada campo", () => {
  assert.match(adminHtml, /id="tmdbMissingFields"/);
  assert.match(admin, /function renderTmdbMissingFields\(/);
  assert.match(admin, /data-tmdb-missing-field/);
  assert.match(admin, /setMovieWizardStep\(step\)/);
  assert.match(admin, /complete-os manualmente para finalizar o cadastro/);
});
