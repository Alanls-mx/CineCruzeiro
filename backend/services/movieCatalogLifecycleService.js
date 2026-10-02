const { sessionStartsAt } = require("./moviePublicationPolicy");

function isDeletedMovie(movie) {
  return Boolean(movie?.metadata?.catalogDeletedAt);
}

function movieHistory(db, movie) {
  const sessionIds = new Set((movie.sessions || []).map((session) => session.id));
  const references = (record) => record.movieId === movie.id || sessionIds.has(record.sessionId);
  return ["orders", "tickets", "payments", "subscriptionUsage", "subscriptionUsages", "subscriptionCreditRedemptions"]
    .some((collection) => (db[collection] || []).some((record) => references(record) || (record.items || []).some(references)));
}

function assertMovieCanBeDeleted(db, movie, now = new Date()) {
  const futureSessions = new Set((movie.sessions || [])
    .filter((session) => !["cancelled", "hidden", "archived"].includes(session.status)
      && (!sessionStartsAt(session) || sessionStartsAt(session).getTime() + 10 * 60000 > now.getTime()))
    .map((session) => session.id));
  const relevant = (record) => futureSessions.has(record.sessionId)
    || (record.movieId === movie.id && !record.sessionId && futureSessions.size > 0);
  const activeOrders = (db.orders || []).some((order) =>
    (relevant(order) || (order.items || []).some(relevant))
    && ["paid", "paid_pending_print", "pending_payment", "processing"].includes(order.status)
    && !(order.status === "pending_payment" && order.reservationExpiresAt && new Date(order.reservationExpiresAt) <= now));
  const activeTickets = (db.tickets || []).some((ticket) => relevant(ticket)
    && !["cancelled", "refunded", "expired"].includes(ticket.status));
  const activeHolds = (db.seatHolds || []).some((hold) => futureSessions.has(hold.sessionId) && new Date(hold.expiresAt) > now);
  if (activeOrders || activeTickets || activeHolds) {
    const error = new Error("Este filme possui sessões futuras com ingressos ou reservas ativos. Cancele ou transfira esses vínculos antes de excluir o filme.");
    error.statusCode = 409;
    throw error;
  }
}

function deletedMovieRecord(movie, now = new Date()) {
  return {
    ...movie,
    workflowStatus: "archived",
    status: "hidden",
    isHighlight: false,
    autoPublish: false,
    updatedAt: now.toISOString(),
    metadata: { ...movie.metadata, catalogDeletedAt: now.toISOString(), catalogOriginalSlug: movie.slug || movie.id },
    slug: `deleted-${movie.id}`
  };
}

module.exports = { isDeletedMovie, movieHistory, assertMovieCanBeDeleted, deletedMovieRecord };
