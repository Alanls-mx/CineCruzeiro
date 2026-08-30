const TAG_TRANSITION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const TAG_STAGES = ["Pré-Estreia", "Estreia", "Normal"];

function startMovieTagTransition(metadata = {}, now = new Date(), startingTag = TAG_STAGES[0]) {
  const stageIndex = Math.max(0, TAG_STAGES.indexOf(startingTag));
  const startedAt = new Date(now.getTime() - (stageIndex * TAG_TRANSITION_INTERVAL_MS));
  return {
    ...metadata,
    movieTagTransitionActive: true,
    movieTagTransitionStartedAt: startedAt.toISOString(),
    movieTagTransitionCompletedAt: ""
  };
}

function stopMovieTagTransition(metadata = {}) {
  return {
    ...metadata,
    movieTagTransitionActive: false
  };
}

function applyMovieTagTransition(movie, now = new Date()) {
  const metadata = movie?.metadata && typeof movie.metadata === "object" ? movie.metadata : {};
  if (!metadata.movieTagTransitionActive) return { movie, changed: false };

  const startedAt = new Date(metadata.movieTagTransitionStartedAt || "").getTime();
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(currentTime) || currentTime < startedAt) {
    return { movie, changed: false };
  }

  const elapsedStages = Math.floor((currentTime - startedAt) / TAG_TRANSITION_INTERVAL_MS);
  const stageIndex = Math.min(elapsedStages, TAG_STAGES.length - 1);
  const tag = TAG_STAGES[stageIndex];
  const completed = stageIndex === TAG_STAGES.length - 1;
  const metadataChanged = completed && metadata.movieTagTransitionActive;

  if (movie.tag === tag && !metadataChanged) return { movie, changed: false };

  return {
    changed: true,
    movie: {
      ...movie,
      tag,
      metadata: {
        ...metadata,
        movieTagTransitionActive: !completed,
        movieTagTransitionCompletedAt: completed ? now.toISOString() : ""
      },
      updatedAt: now.toISOString()
    }
  };
}

module.exports = {
  TAG_TRANSITION_INTERVAL_MS,
  applyMovieTagTransition,
  startMovieTagTransition,
  stopMovieTagTransition
};
