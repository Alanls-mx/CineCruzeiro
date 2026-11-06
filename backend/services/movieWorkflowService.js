function createMovieWorkflowService({ slugify, calendarDateKey, isValidCalendarDate, sessionStartsAt, startMovieTagTransition, stopMovieTagTransition }) {
  function normalizeMovieWorkflow(input, existing = {}) {
    const raw = input.workflowStatus || input.workflow_status || existing.workflowStatus || existing.workflow_status || "";
    if (["draft", "published", "archived"].includes(raw)) return raw;
    if ((input.status || existing.status) === "hidden") return "archived";
    return "published";
  }

  function publicMovieStatus(input, existing = {}, workflowStatus = "published") {
    if (workflowStatus === "archived") return "hidden";
    const value = input.status || existing.status || "upcoming";
    // Draft is a publication workflow, not a public-status value. Legacy drafts
    // may still carry "hidden" from the old coupling, so preserve a publishable state.
    if (workflowStatus === "draft" && value === "hidden") return "upcoming";
    return ["now_playing", "upcoming", "hidden"].includes(value) ? value : "upcoming";
  }

  function validateMovieForWorkflow(db, movie, existingId = "", strictPublish = false) {
    const duplicateSlug = (db.movies || []).find((item) => {
      if (item.id === existingId || item.id === movie.id) return false;
      return String(item.slug || item.id || "").toLowerCase() === String(movie.slug || movie.id || "").toLowerCase();
    });
    if (duplicateSlug) {
      const error = new Error("Já existe um filme usando este slug.");
      error.statusCode = 409;
      throw error;
    }

    if (movie.workflowStatus !== "published" || !strictPublish) return;
    if (!movie.title || !movie.slug) {
      const error = new Error("Informe título e slug antes de publicar.");
      error.statusCode = 422;
      throw error;
    }
    if (!String(movie.duration || "").trim()) {
      const error = new Error("Informe a duração do filme antes de publicar.");
      error.statusCode = 422;
      throw error;
    }
    if (!movie.posterUrl) {
      const error = new Error("Adicione um pôster antes de publicar o filme.");
      error.statusCode = 422;
      throw error;
    }
  }

  function normalizeMovie(input, existing = {}) {
    const title = String(input.title ?? existing.title ?? "").trim();
    if (!title) throw Object.assign(new Error("Informe o título do filme."), { statusCode: 422, code: "MOVIE_TITLE_REQUIRED" });
    if (input.releaseDate && !isValidCalendarDate(calendarDateKey(input.releaseDate))) {
      throw Object.assign(new Error("Informe uma data de estreia válida."), { statusCode: 422, code: "MOVIE_DATE_INVALID" });
    }
    const duration = String(input.duration ?? existing.duration ?? "").trim();
    const durationParts = duration.match(/^(?:(\d+(?:[.,]\d+)?)\s*h(?:\s*(\d+)\s*(?:m|min(?:utos?)?)?)?|(?:(\d+)\s*(?:m|min(?:utos?)?)?))$/i);
    const trailingMinutes = durationParts?.[2] ? Number(durationParts[2]) : 0;
    const durationValue = durationParts
      ? Number(String(durationParts[1] || "0").replace(",", ".")) * 60 + trailingMinutes + Number(durationParts[3] || 0)
      : 0;
    if (input.duration !== undefined && duration && (!durationParts || trailingMinutes >= 60
      || durationValue < 1 || durationValue > 1440)) {
      throw Object.assign(new Error("Informe uma duração válida, como 120 min ou 2h 10min."), { statusCode: 422, code: "MOVIE_DURATION_INVALID" });
    }
    const id = String(input.id || existing.id || slugify(title) || `filme-${Date.now()}`);
    const workflowStatus = normalizeMovieWorkflow(input, existing);
    const slug = String(input.slug || existing.slug || slugify(title) || id).trim();
    const sessions = (Array.isArray(input.sessions)
      ? input.sessions.map((session, index) => ({
          id: String(session.id || `${id}-sessao-${index + 1}`),
          date: session.date || session.sessionDate || "",
          time: String(session.time || "19:00"),
          format: session.format || "2D Dublado",
          room: String(session.room || "Sala Cruzeiro (Laser 4K)"),
          roomId: String(session.roomId || ""),
          ticketTypeIds: Array.isArray(session.ticketTypeIds) ? session.ticketTypeIds.map(String) : [],
          priceFull: Number(session.priceFull ?? 10),
          priceHalf: Number(session.priceHalf ?? 10),
          status: session.status || "available"
        }))
      : (existing.sessions || []).map((session) => ({ ...session })))
      .sort((a, b) => (sessionStartsAt(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (sessionStartsAt(b)?.getTime() || Number.MAX_SAFE_INTEGER));
    const hasInputTag = Object.prototype.hasOwnProperty.call(input, "tag");
    const tag = hasInputTag
      ? String(input.tag || "").trim()
      : String(existing.tag ?? "Em Breve").trim();
    const existingMetadata = existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
    const inputMetadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
    let metadata = { ...existingMetadata, ...inputMetadata };
    // Catalog deletion is server-owned and cannot be supplied by an editor/import.
    delete metadata.catalogDeletedAt;
    delete metadata.catalogOriginalSlug;
    const automatedTag = tag === "Pré-Estreia" || tag === "Estreia";
    const hasValidTransition = metadata.movieTagTransitionActive
      && Number.isFinite(new Date(metadata.movieTagTransitionStartedAt || "").getTime());
    if (automatedTag && (tag !== existing.tag || !hasValidTransition)) {
      metadata = startMovieTagTransition(metadata, new Date(), tag);
    } else if (tag !== existing.tag && !automatedTag) {
      metadata = stopMovieTagTransition(metadata);
    }

    return {
      id,
      slug: slugify(slug) || id,
      workflowStatus,
      sortOrder: Number(input.sortOrder ?? input.displayOrder ?? existing.sortOrder ?? existing.displayOrder ?? 100),
      status: publicMovieStatus(input, existing, workflowStatus),
      title,
      originalTitle: input.originalTitle ?? existing.originalTitle ?? "",
      synopsis: input.synopsis ?? existing.synopsis ?? "",
      duration,
      director: input.director ?? existing.director ?? "",
      metadata,
      genre: Array.isArray(input.genre)
        ? input.genre
        : String(input.genre || existing.genre || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
      rating: input.rating || existing.rating || "L",
      posterUrl: input.posterUrl ?? existing.posterUrl ?? "",
      backdropUrl: input.backdropUrl ?? existing.backdropUrl ?? "",
      trailerYoutubeId: input.trailerYoutubeId ?? existing.trailerYoutubeId ?? "",
      trailerVideoUrl: input.trailerVideoUrl !== undefined ? String(input.trailerVideoUrl || "").trim() : existing.trailerVideoUrl || "",
      localTrailerUrl: existing.localTrailerUrl || "",
      trailerSourceUrl: existing.trailerSourceUrl || "",
      trailerCacheStatus: existing.trailerCacheStatus || "idle",
      trailerCachedAt: existing.trailerCachedAt || "",
      trailerCacheError: existing.trailerCacheError || "",
      isHighlight: input.isHighlight !== undefined ? Boolean(input.isHighlight) : Boolean(existing.isHighlight),
      highlightTrailerBackground: input.highlightTrailerBackground !== undefined
        ? Boolean(input.highlightTrailerBackground)
        : existing.highlightTrailerBackground !== false,
      releaseDate: input.releaseDate !== undefined ? calendarDateKey(input.releaseDate) : calendarDateKey(existing.releaseDate),
      autoPublish: input.autoPublish !== undefined ? Boolean(input.autoPublish) : Boolean(existing.autoPublish),
      publishedAt: workflowStatus === "published" ? (input.publishedAt || existing.publishedAt || new Date().toISOString()) : input.publishedAt || existing.publishedAt || "",
      tag,
      updatedAt: new Date().toISOString(),
      sessions
    };
  }
  return { normalizeMovie, validateMovieForWorkflow };
}

module.exports = { createMovieWorkflowService };
