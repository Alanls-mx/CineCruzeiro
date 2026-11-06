function createTmdbLookupHandler({ tmdbFetch, tmdbMoviePayload, slugify, sendJson }) {
  async function handleTmdbSearchRoute({ req, res, pathname, method, db }) {
    if (pathname === "/api/tmdb/search" && method === "GET") {
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams.get("query");
      if (!query) {
        sendJson(res, 400, { error: "Informe um titulo para pesquisar." });
        return true;
      }

      const data = await tmdbFetch("/search/movie", {
        query,
        language: "pt-BR",
        region: "BR",
        include_adult: "false",
        page: 1
      }, db);

      sendJson(
        res,
        200,
        (data.results || []).slice(0, 8).map((movie) => ({
          tmdbId: movie.id,
          title: movie.title,
          originalTitle: movie.original_title,
          year: movie.release_date ? movie.release_date.slice(0, 4) : "",
          synopsis: movie.overview || "",
          posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : ""
        }))
      );
      return true;
    }

    return false;
  }

  async function handleTmdbMovieRoute({ res, pathname, method, db }) {
    const tmdbMovieMatch = pathname.match(/^\/api\/tmdb\/movie\/([^/]+)$/);
    if (tmdbMovieMatch && method === "GET") {
      const tmdbId = decodeURIComponent(tmdbMovieMatch[1]);
      const data = await tmdbFetch(`/movie/${tmdbId}`, {
        language: "pt-BR",
        append_to_response: "release_dates,videos,credits"
      }, db);
      sendJson(res, 200, tmdbMoviePayload(data, { slugify }));
      return true;
    }

    return false;
  }

  return { handleTmdbSearchRoute, handleTmdbMovieRoute };
}

module.exports = { createTmdbLookupHandler };
