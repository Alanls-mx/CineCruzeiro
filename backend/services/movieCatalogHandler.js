function createMovieCatalogHandler({
  assertMovieCanBeDeleted,
  buildSessionAutocorrectPlan,
  createMovieSessionBatch,
  crypto,
  deleteLocalTrailer,
  deleteUnreferencedAssets,
  deletedMovieRecord,
  isDeletedMovie,
  listActiveSeatHolds,
  memorySeatHolds,
  movieDurationMinutes,
  movieHistory,
  movieImageService,
  movieRepository,
  normalizeMovie,
  normalizeMovieSession,
  postgresEnabled,
  readBody,
  repositoryAudit,
  requireSessionRoomConflictConfirmation,
  roomForSession,
  sendJson,
  sessionCommercialChanges,
  sessionHasActiveSeatAssignments,
  sessionHasAuditHistory,
  sessionRepository,
  sessionRoomConflicts,
  sessionStartsAt,
  sessionWithCurrentRoom,
  syncHighlightTrailerCache,
  syncSessionSnapshotRecords,
  validateMovieForWorkflow,
  validateSessionRoom,
  writeDb,
  getSeatRealtimeService
}) {
  return async function handleMovieCatalogRoutes({ req, res, pathname, method, db }) {
    const seatRealtimeService = getSeatRealtimeService();
  if (pathname === "/api/movies" && method === "POST") {
    const previousMovies = db.movies.map((item) => ({ ...item }));
    const body = await readBody(req);
    let movie = normalizeMovie(body);
    if (db.movies.some((item) => item.id === movie.id && isDeletedMovie(item))) {
      movie.id = `${movie.id}-${crypto.randomBytes(4).toString("hex")}`;
    }
    movie.sessions = (movie.sessions || []).map((session) => validateSessionRoom(db, normalizeMovieSession(session, movie.id, {}, db.ticketTypes)));
    const initialSessions = [];
    for (const session of movie.sessions) {
      const conflicts = sessionRoomConflicts(db, movie, session, { additional: initialSessions.map((item) => ({ movie, session: item })) });
      if (requireSessionRoomConflictConfirmation(res, conflicts, body.confirmRoomConflict)) return true;
      initialSessions.push(session);
    }
    if (db.movies.some((item) => item.id === movie.id)) {
      sendJson(res, 409, { error: { code: "MOVIE_EXISTS", message: "Já existe um filme com este identificador. Abra o filme existente para editá-lo." } });
      return true;
    }
    validateMovieForWorkflow(db, movie, "", body.workflowStatus === "published" || body.workflow_status === "published");
    const localized = movie.workflowStatus === "published"
      ? await movieImageService.localizeMovie(movie)
      : { movie, assets: [], changed: false };
    movie = localized.movie;
    if (movie.isHighlight) db.movies = db.movies.map((item) => ({ ...item, isHighlight: false }));
    db.movies.push(movie);
    let savedMovie = movie;
    try {
      await syncHighlightTrailerCache(db, previousMovies);
      if (postgresEnabled()) {
        movie = db.movies.find((item) => item.id === movie.id) || movie;
        savedMovie = await movieRepository.create(movie, {
          resetTrailerCache: true,
          audit: repositoryAudit(req, "movies", movie.id, null, movie)
        });
      } else {
        await writeDb(db);
      }
    } catch (error) {
      await movieImageService.cleanupAssets(localized.assets);
      throw error;
    }
    sendJson(res, 201, savedMovie);
    return true;
  }

  if (pathname === "/api/movies/order" && method === "PUT") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) {
      sendJson(res, 400, { error: { code: "MOVIE_ORDER_INVALID", message: "Envie a lista de filmes na ordem desejada." } });
      return true;
    }
    const orderMap = new Map(ids.map((id, index) => [id, (index + 1) * 10]));
    db.movies = (db.movies || []).map((movie) => ({
      ...movie,
      sortOrder: orderMap.has(movie.id) ? orderMap.get(movie.id) : Number(movie.sortOrder || 1000)
    })).sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    if (postgresEnabled()) {
      await movieRepository.reorder(ids, {
        audit: repositoryAudit(req, "movies", "order", null, ids)
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { movies: db.movies.filter((movie) => !isDeletedMovie(movie)) });
    return true;
  }

  if (pathname === "/api/admin/sessions/autocorrect" && method === "POST") {
    const body = await readBody(req);
    const filters = {
      from: String(body.from || "").slice(0, 10),
      to: String(body.to || "").slice(0, 10),
      roomId: String(body.roomId || ""),
      movieId: String(body.movieId || "")
    };
    const historyOrders = (db.orders || []).flatMap((order) => [
      order.sessionId ? { sessionId: order.sessionId } : null,
      ...(order.items || []).map((item) => item.sessionId ? { sessionId: item.sessionId } : null)
    ]).filter(Boolean);
    const plan = buildSessionAutocorrectPlan({
      movies: db.movies || [],
      rooms: db.rooms || [],
      tickets: db.tickets || [],
      orders: historyOrders,
      filters,
      turnaroundMinutes: body.turnaroundMinutes,
      stepMinutes: body.stepMinutes,
      includeSales: body.includeSales === true
    });

    if (body.apply !== true) {
      sendJson(res, 200, plan);
      return true;
    }
    if (!body.previewHash || body.previewHash !== plan.hash) {
      sendJson(res, 409, {
        error: {
          code: "SESSION_AUTOCORRECT_PREVIEW_EXPIRED",
          message: "A programação mudou desde a prévia. Gere uma nova sugestão antes de aplicar."
        }
      });
      return true;
    }
    if (!plan.changes.length) {
      sendJson(res, 200, { ...plan, applied: 0 });
      return true;
    }
    if (plan.changes.some((change) => change.hasSales) && body.confirmSalesImpact !== true) {
      sendJson(res, 409, {
        error: {
          code: "SESSION_AUTOCORRECT_SALES_CONFIRMATION_REQUIRED",
          message: "A sugestão altera sessões com vendas. Confirme o impacto comercial antes de aplicar."
        }
      });
      return true;
    }

    const updates = plan.changes.map((change) => {
      const movie = (db.movies || []).find((item) => item.id === change.movieId);
      const sessionIndex = movie?.sessions?.findIndex((item) => item.id === change.sessionId) ?? -1;
      if (!movie || sessionIndex < 0) return null;
      const previous = movie.sessions[sessionIndex];
      const session = { ...previous, date: change.to.date, time: change.to.time };
      return { movie, sessionIndex, previous, session };
    });
    if (updates.some((update) => !update)) {
      sendJson(res, 409, {
        error: {
          code: "SESSION_AUTOCORRECT_DATA_CHANGED",
          message: "Uma das sessões da sugestão não existe mais. Gere uma nova prévia."
        }
      });
      return true;
    }

    const reason = "Autocorreção da agenda global";
    for (const update of updates) {
      update.movie.sessions[update.sessionIndex] = update.session;
      const synchronized = syncSessionSnapshotRecords(db, update.movie, update.session, { reason });
      update.movie.sessions.sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
      update.movie.updatedAt = new Date().toISOString();
      if (postgresEnabled()) {
        await sessionRepository.update(update.movie, update.session, {
          reason,
          audit: repositoryAudit(req, "session", update.session.id, update.previous, update.session)
        });
      } else {
        db.auditLogs ||= [];
        db.auditLogs.unshift({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          userId: req.adminUser?.id || "",
          userEmail: req.adminUser?.email || "",
          action: "session.autocorrected",
          entityType: "session",
          entityId: update.session.id,
          before: update.previous,
          after: update.session,
          metadata: { reason, ...synchronized },
          createdAt: synchronized.timestamp
        });
      }
      seatRealtimeService?.broadcastSessionRefresh(update.session.id);
    }
    if (!postgresEnabled()) await writeDb(db);
    sendJson(res, 200, { ...plan, applied: updates.length });
    return true;
  }

  const movieSessionsMatch = pathname.match(/^\/api\/movies\/([^/]+)\/sessions(?:\/([^/]+))?$/);
  if (movieSessionsMatch) {
    const movieId = decodeURIComponent(movieSessionsMatch[1]);
    const sessionId = movieSessionsMatch[2] ? decodeURIComponent(movieSessionsMatch[2]) : "";
    const movieIndex = db.movies.findIndex((movie) => movie.id === movieId);
    if (movieIndex === -1 || isDeletedMovie(db.movies[movieIndex])) {
      sendJson(res, 404, { error: { code: "MOVIE_NOT_FOUND", message: "Filme não encontrado." } });
      return true;
    }

    const movie = db.movies[movieIndex];
    movie.sessions ||= [];

    if (method === "POST" && !sessionId) {
      const body = await readBody(req);
      if (!String(movie.duration || "").trim()) {
        sendJson(res, 422, { error: { code: "SESSION_MOVIE_DURATION_REQUIRED", message: "Informe a duração do filme antes de criar sessões." } });
        return true;
      }
      if (body.dateTo || body.dateEnd || Array.isArray(body.times)) {
        const batch = createMovieSessionBatch(body, movie.slug || movieId, movie.sessions, db.ticketTypes);
        const created = batch.created.map((session) => validateSessionRoom(db, session));
        const accepted = [];
        const conflicts = created.flatMap((session) => {
          const found = sessionRoomConflicts(db, movie, session, { additional: accepted.map((item) => ({ movie, session: item })) });
          accepted.push(session);
          return found.map((conflict) => ({ requestedDate: session.date, requestedTime: session.time, requestedRoom: session.room, ...conflict }));
        });
        if (requireSessionRoomConflictConfirmation(res, conflicts, body.confirmRoomConflict)) return true;
        movie.sessions.push(...created);
        movie.sessions.sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
        movie.updatedAt = new Date().toISOString();
        if (postgresEnabled()) {
          await sessionRepository.createMany(movieId, created, {
            audit: repositoryAudit(req, "session", "batch", null, created)
          });
        } else {
          await writeDb(db);
        }
        sendJson(res, 201, { ...batch, created, totalCreated: created.length, totalSkipped: batch.skipped.length });
        return true;
      }
      const session = validateSessionRoom(db, normalizeMovieSession(body, movie.slug || movieId, {}, db.ticketTypes));
      if (movie.sessions.some((item) => item.id === session.id || (item.date === session.date && item.time === session.time && roomForSession(db, item)?.id === session.roomId && item.format === session.format && item.status !== "cancelled"))) {
        sendJson(res, 409, { error: { code: "SESSION_EXISTS", message: "Já existe uma sessão com este identificador." } });
        return true;
      }
      const conflicts = sessionRoomConflicts(db, movie, session);
      if (requireSessionRoomConflictConfirmation(res, conflicts, body.confirmRoomConflict)) return true;
      movie.sessions.push(session);
      movie.updatedAt = new Date().toISOString();
      if (postgresEnabled()) {
        await sessionRepository.create(movieId, session, {
          audit: repositoryAudit(req, "session", session.id, null, session)
        });
      } else {
        await writeDb(db);
      }
      sendJson(res, 201, session);
      return true;
    }

    const sessionIndex = movie.sessions.findIndex((session) => session.id === sessionId);
    if (!sessionId || sessionIndex === -1) {
      sendJson(res, 404, { error: { code: "SESSION_NOT_FOUND", message: "Sessão não encontrada." } });
      return true;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      const previousSession = postgresEnabled()
        ? await sessionRepository.findById(sessionId)
        : movie.sessions[sessionIndex];
      if (!previousSession) {
        sendJson(res, 404, { error: { code: "SESSION_NOT_FOUND", message: "Sessão não encontrada." } });
        return true;
      }
      movie.sessions[sessionIndex] = previousSession;
      const session = validateSessionRoom(db, normalizeMovieSession(body, movieId, previousSession, db.ticketTypes), previousSession);
      const conflicts = sessionRoomConflicts(db, movie, session, { ignoreSessionId: sessionId });
      if (requireSessionRoomConflictConfirmation(res, conflicts, body.confirmRoomConflict)) return true;
      const commercialChanges = sessionCommercialChanges(previousSession, session);
      const hasHistory = sessionHasAuditHistory(db, sessionId);
      if ((session.room !== previousSession.room || session.roomId !== previousSession.roomId)
        && (sessionHasActiveSeatAssignments(db, sessionId) || (await listActiveSeatHolds(sessionId)).length > 0)) {
        sendJson(res, 409, {
          error: {
            code: "SESSION_ROOM_LOCKED_BY_SEATS",
            message: "Esta sessão possui poltronas reservadas ou emitidas. Cancele ou transfira os vínculos antes de trocar a sala."
          }
        });
        return true;
      }
      if (hasHistory && (commercialChanges.length || session.status === "cancelled") && body.confirmSalesImpact !== true) {
        sendJson(res, 409, {
          error: {
            code: "SESSION_CHANGE_CONFIRMATION_REQUIRED",
            message: "Esta sessão possui vendas. Confirme o impacto e informe o motivo para alterar data, horário, sala, formato ou cancelar.",
            changes: commercialChanges,
            cancellation: session.status === "cancelled"
          }
        });
        return true;
      }
      const changeReason = String(body.changeReason || "").trim();
      if (hasHistory && (commercialChanges.length || session.status === "cancelled") && changeReason.length < 6) {
        sendJson(res, 422, {
          error: {
            code: "SESSION_CHANGE_REASON_REQUIRED",
            message: "Informe um motivo com pelo menos 6 caracteres para registrar a alteração desta sessão."
          }
        });
        return true;
      }
      movie.sessions[sessionIndex] = session;
      const synchronized = syncSessionSnapshotRecords(db, movie, session, { reason: changeReason });
      if (commercialChanges.length || previousSession.status !== session.status) {
        db.auditLogs ||= [];
        db.auditLogs.unshift({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          userId: req.adminUser?.id || "",
          userEmail: req.adminUser?.email || "",
          action: session.status === "cancelled" ? "session.cancelled" : "session.updated",
          entityType: "session",
          entityId: session.id,
          before: previousSession,
          after: session,
          metadata: { reason: changeReason, changes: commercialChanges, ...synchronized },
          createdAt: synchronized.timestamp
        });
      }
      movie.sessions.sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
      movie.updatedAt = new Date().toISOString();
      if (postgresEnabled()) {
        await sessionRepository.update(movie, session, {
          reason: changeReason,
          audit: repositoryAudit(req, "session", session.id, previousSession, session)
        });
      } else {
        await writeDb(db);
      }
      seatRealtimeService?.broadcastSessionRefresh(session.id);
      sendJson(res, 200, session);
      return true;
    }

    if (method === "DELETE") {
      if (sessionHasAuditHistory(db, sessionId)) {
        sendJson(res, 409, {
          error: {
            code: "SESSION_HAS_HISTORY",
            message: "Esta sessão possui histórico e não pode ser excluída. Use Esgotada para suspender vendas ou Cancelada para cancelar a exibição e tratar os reembolsos."
          }
        });
        return true;
      }
      const [removed] = movie.sessions.splice(sessionIndex, 1);
      movie.updatedAt = new Date().toISOString();
      if (postgresEnabled()) {
        await sessionRepository.remove(movieId, sessionId, {
          audit: repositoryAudit(req, "session", sessionId, removed, null)
        });
      } else {
        await writeDb(db);
      }
      sendJson(res, 200, removed);
      return true;
    }
  }

  const movieMatch = pathname.match(/^\/api\/movies\/([^/]+)$/);
  if (movieMatch) {
    const id = decodeURIComponent(movieMatch[1]);
    const index = db.movies.findIndex((movie) => movie.id === id);
    if (index === -1 || isDeletedMovie(db.movies[index])) {
      sendJson(res, 404, { error: "Filme nao encontrado" });
      return true;
    }

    if (method === "PUT") {
      const previousMovies = db.movies.map((item) => ({ ...item }));
      const previousMovie = postgresEnabled()
        ? await movieRepository.findById(id)
        : db.movies[index];
      if (!previousMovie || isDeletedMovie(previousMovie)) {
        sendJson(res, 404, { error: "Filme nao encontrado" });
        return true;
      }
      db.movies[index] = previousMovie;
      const body = await readBody(req);
      if (body.sessions !== undefined && JSON.stringify(body.sessions) !== JSON.stringify(previousMovie.sessions || [])) {
        sendJson(res, 422, { error: { code: "SESSION_ENDPOINT_REQUIRED", message: "Altere as sessões pela programação do filme para preservar as validações e o histórico." } });
        return true;
      }
      let movie = normalizeMovie({ ...body, id }, previousMovie);
      movie.sessions = (movie.sessions || []).map((session) => sessionWithCurrentRoom(db, session));
      if (!movie.duration && (movie.sessions.length || movie.workflowStatus === "published")) {
        sendJson(res, 422, { error: { code: "MOVIE_DURATION_REQUIRED", message: "Informe a duração do filme antes de manter sessões ou publicar." } });
        return true;
      }
      if (movieDurationMinutes(movie) > movieDurationMinutes(previousMovie) && movie.sessions.length) {
        const scheduleDb = { ...db, movies: db.movies.map((item, position) => position === index ? movie : item) };
        const conflicts = movie.sessions
          .filter((session) => (sessionStartsAt(session)?.getTime() || 0) + movieDurationMinutes(movie) * 60000 > Date.now())
          .flatMap((session) => sessionRoomConflicts(scheduleDb, movie, session, { ignoreSessionId: session.id }));
        if (conflicts.length) {
          sendJson(res, 409, { error: { code: "MOVIE_DURATION_SESSION_CONFLICT", message: "A nova duração reduz o intervalo mínimo de limpeza de sessões futuras. Ajuste os horários antes de salvar o filme.", conflicts } });
          return true;
        }
      }
      const publishingNow = body.workflowStatus === "published" || body.workflow_status === "published";
      validateMovieForWorkflow(db, movie, id, publishingNow);
      const localized = movie.workflowStatus === "published"
        ? await movieImageService.localizeMovie(movie)
        : { movie, assets: [], changed: false };
      movie = localized.movie;
      if (movie.isHighlight) db.movies = db.movies.map((item) => ({ ...item, isHighlight: false }));
      db.movies[index] = movie;
      let savedMovie = movie;
      try {
        await syncHighlightTrailerCache(db, previousMovies);
        if (postgresEnabled()) {
          movie = db.movies.find((item) => item.id === movie.id) || movie;
          savedMovie = await movieRepository.update(movie, {
            resetTrailerCache: true,
            audit: repositoryAudit(req, "movies", movie.id, previousMovie, movie)
          });
        } else {
          await writeDb(db);
        }
      } catch (error) {
        await movieImageService.cleanupAssets(localized.assets);
        throw error;
      }
      await deleteUnreferencedAssets(db, [previousMovie.posterUrl, previousMovie.backdropUrl].filter((url) => url && url !== movie.posterUrl && url !== movie.backdropUrl));
      sendJson(res, 200, savedMovie);
      return true;
    }

    if (method === "DELETE") {
      const movie = db.movies[index];
      assertMovieCanBeDeleted({ ...db, seatHolds: postgresEnabled() ? [] : [...memorySeatHolds.values()] }, movie);
      let historyPreserved = movieHistory(db, movie);
      if (postgresEnabled()) {
        const result = await movieRepository.removeFromCatalog(id, {
          audit: repositoryAudit(req, "movies", id, movie, null)
        });
        historyPreserved = result.historyPreserved;
        if (historyPreserved) db.movies[index] = result.movie;
        else db.movies.splice(index, 1);
      } else {
        if (historyPreserved) db.movies[index] = deletedMovieRecord(movie);
        else db.movies.splice(index, 1);
        await writeDb(db);
      }
      if (!historyPreserved) await Promise.all([
        deleteLocalTrailer(movie.localTrailerUrl),
        deleteUnreferencedAssets(db, [movie.posterUrl, movie.backdropUrl])
      ]);
      sendJson(res, 200, { id, deleted: true, historyPreserved });
      return true;
    }
  }

    return false;
  };
}

module.exports = { createMovieCatalogHandler };
