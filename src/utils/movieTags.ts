const HIDDEN_MOVIE_TAGS = new Set(["", "normal"]);

export function normalizeMovieTag(tag: string | undefined | null) {
  return String(tag || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isVisibleMovieTag(tag: string | undefined | null) {
  return !HIDDEN_MOVIE_TAGS.has(normalizeMovieTag(tag));
}
