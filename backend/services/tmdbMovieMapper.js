function minutesToDuration(runtime) {
  const total = Number(runtime || 0);
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function certificationValue(details) {
  const releases = details.release_dates?.results || [];
  const br = releases.find((item) => item.iso_3166_1 === "BR");
  return br?.release_dates?.find((item) => item.certification)?.certification || "";
}

function missingMovieFields({ title, runtimeMinutes, director, genres, synopsis, certification, posterUrl, backdropUrl, trailerYoutubeId, releaseDate }) {
  const fields = [
    ["title", "Título", 0, title],
    ["duration", "Duração", 1, runtimeMinutes],
    ["director", "Direção", 1, director],
    ["genre", "Gêneros", 1, genres.length],
    ["synopsis", "Sinopse", 1, synopsis],
    ["rating", "Classificação indicativa", 1, certification],
    ["posterUrl", "Pôster vertical", 2, posterUrl],
    ["backdropUrl", "Banner horizontal", 2, backdropUrl],
    ["trailerYoutubeId", "Trailer", 2, trailerYoutubeId],
    ["releaseDate", "Data de estreia", 3, releaseDate]
  ];
  return fields.filter(([, , , value]) => !value).map(([field, label, step]) => ({ field, label, step }));
}

function tmdbMoviePayload(details, { slugify, now = () => new Date() }) {
  const title = details.title || details.original_title || "";
  const runtimeMinutes = Number.isFinite(Number(details.runtime)) && Number(details.runtime) > 0
    ? Math.round(Number(details.runtime))
    : 0;
  const director = details.credits?.crew?.find((person) => person.job === "Director")?.name || "";
  const genres = Array.isArray(details.genres) ? details.genres.map((genre) => genre.name).filter(Boolean) : [];
  const synopsis = details.overview || "";
  const certification = certificationValue(details);
  const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : "";
  const backdropUrl = details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : "";
  const trailerYoutubeId = details.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")?.key || "";
  const releaseDate = details.release_date || "";
  const tmdbMissingFields = missingMovieFields({
    title, runtimeMinutes, director, genres, synopsis, certification,
    posterUrl, backdropUrl, trailerYoutubeId, releaseDate
  });
  return {
    id: slugify(title || `tmdb-${details.id}`),
    slug: slugify(title || `tmdb-${details.id}`),
    tmdbId: details.id,
    status: "upcoming",
    workflowStatus: "draft",
    title,
    originalTitle: details.original_title || "",
    synopsis,
    duration: minutesToDuration(runtimeMinutes),
    director,
    metadata: {
      tmdbId: details.id,
      runtimeMinutes,
      durationSource: runtimeMinutes ? "tmdb" : "missing",
      tmdbFetchedAt: now().toISOString(),
      originalLanguage: details.original_language || "",
      popularity: details.popularity || 0,
      voteAverage: details.vote_average || 0
    },
    genre: genres,
    rating: certification === "Livre" ? "L" : certification || "L",
    posterUrl,
    backdropUrl,
    trailerYoutubeId,
    trailerVideoUrl: "",
    localTrailerUrl: "",
    trailerSourceUrl: "",
    trailerCacheStatus: "idle",
    trailerCachedAt: "",
    trailerCacheError: "",
    isHighlight: false,
    highlightTrailerBackground: true,
    releaseDate,
    tmdbMissingFields,
    autoPublish: false,
    tag: "Em Breve",
    sessions: []
  };
}

module.exports = { tmdbMoviePayload, missingMovieFields };
