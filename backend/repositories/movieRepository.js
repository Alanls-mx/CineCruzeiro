const { timedQuery, runMutation } = require("./repositorySupport");
const { insertSession, mapSession } = require("./sessionRepository");
const { calendarDateKey } = require("../services/calendarDateService");
const { isDeletedMovie, assertMovieCanBeDeleted, deletedMovieRecord } = require("../services/movieCatalogLifecycleService");

function mapMovie(row, sessions = []) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug || row.id,
    workflowStatus: row.workflow_status || (row.status === "hidden" ? "archived" : "published"),
    sortOrder: Number(row.sort_order || 100),
    status: row.status,
    title: row.title,
    originalTitle: row.original_title || "",
    synopsis: row.synopsis || "",
    duration: row.duration || "",
    director: row.director || "",
    metadata: row.metadata || {},
    genre: Array.isArray(row.genre) ? row.genre : [],
    rating: row.rating || "L",
    posterUrl: row.poster_url || "",
    backdropUrl: row.backdrop_url || "",
    trailerYoutubeId: row.trailer_youtube_id || "",
    trailerVideoUrl: row.trailer_video_url || "",
    localTrailerUrl: row.local_trailer_url || "",
    trailerSourceUrl: row.trailer_source_url || "",
    trailerCacheStatus: row.trailer_cache_status || "idle",
    trailerCacheError: row.trailer_cache_error || "",
    isHighlight: Boolean(row.is_highlight),
    highlightTrailerBackground: row.highlight_trailer_background !== false,
    releaseDate: calendarDateKey(row.release_date),
    autoPublish: Boolean(row.auto_publish),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : "",
    tag: row.tag || "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    sessions
  };
}

function movieParams(movie) {
  return [
    movie.id, movie.slug || movie.id,
    movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published"),
    Number(movie.sortOrder || 100), movie.status || "upcoming", movie.title,
    movie.originalTitle || "", movie.synopsis || "", movie.duration || "",
    movie.director || "", JSON.stringify(movie.metadata || {}), movie.genre || [],
    movie.rating || "L", movie.posterUrl || "", movie.backdropUrl || "",
    movie.trailerYoutubeId || "", movie.trailerVideoUrl || "", movie.localTrailerUrl || "",
    movie.trailerSourceUrl || "", movie.trailerCacheStatus || "idle", movie.trailerCacheError || "",
    Boolean(movie.isHighlight), movie.highlightTrailerBackground !== false,
    movie.releaseDate || "", Boolean(movie.autoPublish), movie.publishedAt || "", movie.tag || ""
  ];
}

async function findById(id) {
  const [movieResult, sessionsResult] = await Promise.all([
    timedQuery(null, "SELECT * FROM movies WHERE id = $1", [id], { repository: "movie", operation: "findById" }),
    timedQuery(null, `SELECT sessions.*,
      COALESCE(array_agg(session_ticket_types.ticket_type_id ORDER BY session_ticket_types.position)
        FILTER (WHERE session_ticket_types.ticket_type_id IS NOT NULL), '{}') AS ticket_type_ids
      FROM sessions LEFT JOIN session_ticket_types ON session_ticket_types.session_id = sessions.id
      WHERE sessions.movie_id = $1 GROUP BY sessions.id ORDER BY sessions.starts_at`, [id], { repository: "movie", operation: "sessions" })
  ]);
  return mapMovie(movieResult.rows[0], sessionsResult.rows.map(mapSession));
}

async function writeMovie(client, movie, update = false) {
  const params = movieParams(movie);
  if (movie.isHighlight) {
    await timedQuery(client, "UPDATE movies SET is_highlight = false, updated_at = now() WHERE id <> $1 AND is_highlight = true", [movie.id], { repository: "movie", operation: "clear_highlight" });
  }
  const sql = update
    ? `UPDATE movies SET slug=$2, workflow_status=$3, sort_order=$4, status=$5, title=$6,
        original_title=$7, synopsis=$8, duration=$9, director=$10, metadata=$11::jsonb,
        genre=$12, rating=$13, poster_url=$14, backdrop_url=$15, trailer_youtube_id=$16,
        trailer_video_url=$17, local_trailer_url=$18, trailer_source_url=$19,
        trailer_cache_status=$20, trailer_cache_error=$21, is_highlight=$22,
        highlight_trailer_background=$23, release_date=NULLIF($24,'')::date,
        auto_publish=$25, published_at=NULLIF($26,'')::timestamptz, tag=$27, updated_at=now()
      WHERE id=$1 AND NOT (metadata ? 'catalogDeletedAt') RETURNING *`
    : `INSERT INTO movies (id, slug, workflow_status, sort_order, status, title, original_title,
        synopsis, duration, director, metadata, genre, rating, poster_url, backdrop_url,
        trailer_youtube_id, trailer_video_url, local_trailer_url, trailer_source_url,
        trailer_cache_status, trailer_cache_error, is_highlight, highlight_trailer_background,
        release_date, auto_publish, published_at, tag)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
        NULLIF($24,'')::date,$25,NULLIF($26,'')::timestamptz,$27) RETURNING *`;
  const result = await timedQuery(client, sql, params, { repository: "movie", operation: update ? "update" : "insert" });
  if (update && !result.rowCount) {
    const error = new Error("O filme foi excluído ou alterado em outra operação. Atualize o catálogo.");
    error.statusCode = 409;
    throw error;
  }
  return result.rows[0];
}

async function create(movie, options = {}) {
  return runMutation({
    event: "repository.movie.create",
    metadata: { repository: "movie", operation: "create", movieId: movie.id },
    audit: options.audit
  }, async (client) => {
    if (options.resetTrailerCache) {
      await timedQuery(client, `UPDATE movies SET local_trailer_url='', trailer_source_url='',
        trailer_cache_status='idle', trailer_cache_error='', updated_at=now()`, [], { repository: "movie", operation: "trailer_cache.reset" });
    }
    const row = await writeMovie(client, movie, false);
    const sessions = [];
    for (const session of movie.sessions || []) sessions.push(await insertSession(client, movie.id, session));
    return mapMovie(row, sessions);
  });
}

async function update(movie, options = {}) {
  return runMutation({
    event: "repository.movie.update",
    metadata: { repository: "movie", operation: "update", movieId: movie.id },
    audit: options.audit
  }, async (client) => {
    if (options.resetTrailerCache) {
      await timedQuery(client, `UPDATE movies SET local_trailer_url='', trailer_source_url='',
        trailer_cache_status='idle', trailer_cache_error='', updated_at=now()`, [], { repository: "movie", operation: "trailer_cache.reset" });
    }
    const row = await writeMovie(client, movie, true);
    return mapMovie(row, movie.sessions || []);
  });
}

async function archive(movie, options = {}) {
  return update(movie, options);
}

async function remove(id, options = {}) {
  return runMutation({
    event: "repository.movie.delete",
    metadata: { repository: "movie", operation: "delete", movieId: id },
    audit: options.audit
  }, async (client) => {
    const result = await timedQuery(client, "DELETE FROM movies WHERE id = $1 RETURNING *", [id], { repository: "movie", operation: "delete" });
    return mapMovie(result.rows[0]);
  });
}

async function removeFromCatalog(id, options = {}) {
  return runMutation({
    event: "repository.movie.delete",
    metadata: { repository: "movie", operation: "delete_catalog", movieId: id },
    audit: options.audit
  }, async (client) => {
    // Lock parent/session rows before checking references; FK inserts then wait.
    const result = await timedQuery(client, "SELECT * FROM movies WHERE id=$1 FOR UPDATE", [id]);
    const sessionRows = await timedQuery(client, "SELECT * FROM sessions WHERE movie_id=$1 ORDER BY id FOR UPDATE", [id]);
    const movie = mapMovie(result.rows[0], sessionRows.rows.map(mapSession));
    if (!movie || isDeletedMovie(movie)) return { historyPreserved: Boolean(movie), movie };
    const orders = await timedQuery(client, `SELECT metadata, id, status, movie_id, session_id, reservation_expires_at
      FROM orders WHERE movie_id=$1 OR session_id IN (SELECT id FROM sessions WHERE movie_id=$1)
      OR id IN (SELECT order_id FROM order_items WHERE metadata->>'movieId'=$1
        OR metadata->>'sessionId' IN (SELECT id FROM sessions WHERE movie_id=$1))
      ORDER BY id FOR UPDATE`, [id]);
    const tickets = await timedQuery(client, `SELECT metadata, status, movie_id, session_id FROM tickets
      WHERE movie_id=$1 OR session_id IN (SELECT id FROM sessions WHERE movie_id=$1) FOR UPDATE`, [id]);
    const holds = await timedQuery(client, `SELECT session_id, expires_at FROM seat_holds
      WHERE session_id IN (SELECT id FROM sessions WHERE movie_id=$1) AND expires_at > now()`, [id]);
    assertMovieCanBeDeleted({
      orders: orders.rows.map((row) => ({ ...row.metadata, movieId: row.movie_id || id, sessionId: row.session_id, status: row.status, reservationExpiresAt: row.reservation_expires_at })),
      tickets: tickets.rows.map((row) => ({ ...row.metadata, movieId: row.movie_id, sessionId: row.session_id, status: row.status })),
      seatHolds: holds.rows.map((row) => ({ sessionId: row.session_id, expiresAt: row.expires_at }))
    }, movie);
    const usage = await timedQuery(client, `SELECT 1 FROM subscription_usage
      WHERE movie_id=$1 OR session_id IN (SELECT id FROM sessions WHERE movie_id=$1)
      UNION ALL SELECT 1 FROM subscription_credit_redemptions
      WHERE session_id IN (SELECT id FROM sessions WHERE movie_id=$1) LIMIT 1`, [id]);
    const historyPreserved = Boolean(orders.rowCount || tickets.rowCount || usage.rowCount);
    const retained = historyPreserved ? deletedMovieRecord(movie) : null;
    if (retained) {
      await timedQuery(client, `UPDATE movies SET workflow_status='archived', status='hidden',
        is_highlight=false, auto_publish=false, slug=$2, metadata=$3::jsonb, updated_at=now() WHERE id=$1`,
      [id, retained.slug, JSON.stringify(retained.metadata)]);
    } else {
      await timedQuery(client, "DELETE FROM movies WHERE id=$1", [id]);
    }
    if (options.audit) {
      options.audit.before = movie;
      options.audit.after = retained;
    }
    return { historyPreserved, movie: retained };
  });
}

async function reorder(ids, options = {}) {
  return runMutation({
    event: "repository.movie.reorder",
    metadata: { repository: "movie", operation: "reorder", count: ids.length },
    audit: options.audit
  }, async (client) => {
    const rows = await timedQuery(client, `UPDATE movies AS movie SET
      sort_order = ordering.sort_order, updated_at = now()
      FROM (SELECT unnest($1::text[]) AS id, generate_series(1, array_length($1::text[], 1)) * 10 AS sort_order) ordering
      WHERE movie.id = ordering.id
      RETURNING movie.*`, [ids], { repository: "movie", operation: "reorder" });
    return rows.rows.map((row) => mapMovie(row));
  });
}

module.exports = { mapMovie, findById, create, update, archive, remove, removeFromCatalog, reorder };
