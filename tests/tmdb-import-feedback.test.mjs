import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";

const server = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const admin = readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
const adminHtml = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const { tmdbMoviePayload } = require("../backend/services/tmdbMovieMapper.js");

test("importação TMDB retorna o diagnóstico dos campos não coletados", () => {
  assert.match(server, /tmdbMoviePayload\(data, \{ slugify \}\)/);
  const payload = tmdbMoviePayload({ id: 42, title: "Filme Teste", runtime: 100,
    release_dates: { results: [{ iso_3166_1: "BR", release_dates: [{ certification: "Livre" }] }] }
  }, { slugify: (value) => value.toLowerCase().replaceAll(" ", "-"), now: () => new Date("2030-01-01T00:00:00Z") });
  assert.equal(payload.id, "filme-teste");
  assert.equal(payload.duration, "1h 40m");
  assert.equal(payload.rating, "L");
  assert.equal(payload.metadata.tmdbFetchedAt, "2030-01-01T00:00:00.000Z");
  assert.deepEqual(payload.tmdbMissingFields.find((field) => field.field === "posterUrl"),
    { field: "posterUrl", label: "Pôster vertical", step: 2 });
  assert.equal(payload.tmdbMissingFields.some((field) => field.field === "duration"), false);
});

test("admin orienta o operador e oferece atalhos para preencher cada campo", () => {
  assert.match(adminHtml, /id="tmdbMissingFields"/);
  assert.match(admin, /function renderTmdbMissingFields\(/);
  assert.match(admin, /data-tmdb-missing-field/);
  assert.match(admin, /setMovieWizardStep\(step\)/);
  assert.match(admin, /complete-os manualmente para finalizar o cadastro/);
});
