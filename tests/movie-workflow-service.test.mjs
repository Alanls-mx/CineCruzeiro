import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createMovieWorkflowService } = require("../backend/services/movieWorkflowService.js");
const service = createMovieWorkflowService({
  slugify: (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  calendarDateKey: (value) => String(value || "").slice(0, 10),
  isValidCalendarDate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  sessionStartsAt: (session) => new Date(`${session.date}T${session.time}:00Z`),
  startMovieTagTransition: (metadata) => ({ ...metadata, movieTagTransitionActive: true, movieTagTransitionStartedAt: new Date().toISOString() }),
  stopMovieTagTransition: (metadata) => ({ ...metadata, movieTagTransitionActive: false })
});

test("movie workflow keeps normalization, publication and error contracts", () => {
  const movie = service.normalizeMovie({ title: "Coyote vs. ACME", duration: "2h 10min", releaseDate: "2026-10-09", posterUrl: "/uploads/coyote.webp", sessions: [] });
  assert.equal(movie.id, "coyote-vs-acme");
  assert.equal(movie.workflowStatus, "published");
  assert.equal(movie.status, "upcoming");
  assert.equal(movie.duration, "2h 10min");
  assert.equal(movie.posterUrl, "/uploads/coyote.webp");
  service.validateMovieForWorkflow({ movies: [] }, movie, "", true);
  assert.throws(() => service.validateMovieForWorkflow({ movies: [{ id: "other", slug: movie.slug }] }, movie), { statusCode: 409 });
  assert.throws(() => service.normalizeMovie({ title: "" }), { code: "MOVIE_TITLE_REQUIRED", statusCode: 422 });
  assert.throws(() => service.normalizeMovie({ title: "Teste", duration: "25h" }), { code: "MOVIE_DURATION_INVALID", statusCode: 422 });
  assert.throws(() => service.normalizeMovie({ title: "Teste", releaseDate: "invalid" }), { code: "MOVIE_DATE_INVALID", statusCode: 422 });
  assert.throws(() => service.validateMovieForWorkflow({ movies: [] }, { ...movie, posterUrl: "" }, "", true), { statusCode: 422 });
  const draft = service.normalizeMovie({ title: "Rascunho", workflowStatus: "draft", status: "hidden", metadata: { catalogDeletedAt: "forged" } });
  assert.equal(draft.status, "upcoming");
  assert.equal(draft.metadata.catalogDeletedAt, undefined);
});
