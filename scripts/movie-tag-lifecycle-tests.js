const assert = require("assert/strict");
const {
  TAG_TRANSITION_INTERVAL_MS,
  applyMovieTagTransition,
  startMovieTagTransition,
  stopMovieTagTransition
} = require("../backend/utils/movieTagLifecycle");

const startedAt = new Date("2026-08-27T12:00:00.000Z");
const baseMovie = {
  id: "filme-pre-estreia",
  tag: "Pré-Estreia",
  metadata: startMovieTagTransition({}, startedAt)
};

assert.equal(applyMovieTagTransition(baseMovie, new Date(startedAt.getTime() + TAG_TRANSITION_INTERVAL_MS - 1)).movie.tag, "Pré-Estreia");
assert.equal(applyMovieTagTransition(baseMovie, new Date(startedAt.getTime() + TAG_TRANSITION_INTERVAL_MS)).movie.tag, "Estreia");

const completed = applyMovieTagTransition(baseMovie, new Date(startedAt.getTime() + (2 * TAG_TRANSITION_INTERVAL_MS)));
assert.equal(completed.movie.tag, "Destaque da Semana");
assert.equal(completed.movie.metadata.movieTagTransitionActive, false);
assert.ok(completed.movie.metadata.movieTagTransitionCompletedAt);

const manualMovie = { ...baseMovie, metadata: stopMovieTagTransition(baseMovie.metadata) };
assert.equal(applyMovieTagTransition(manualMovie, new Date(startedAt.getTime() + (3 * TAG_TRANSITION_INTERVAL_MS))).movie.tag, "Pré-Estreia");

console.log("Movie tag lifecycle tests passed.");
