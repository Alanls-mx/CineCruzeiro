const { randomUUID } = require("node:crypto");
const { isDeletedMovie } = require("./movieCatalogLifecycleService");
const { roomForSession, roomSeats, roomSeatSelectionEnabled, roomDisplayLabel } = require("./roomReadProjectionService");
const { sessionSeatAvailability } = require("./sessionSeatAvailability");
const { sessionStartsAt, normalizedSessionStatus } = require("./sessionScheduleReadService");
const ticketCodeService = require("./ticketCodeService");

function changeError(code, message, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function destinationSessions(db, now = new Date()) {
  return (db.movies || []).filter((movie) => !isDeletedMovie(movie) && (!movie.workflowStatus || movie.workflowStatus === "published") && movie.status !== "hidden")
    .flatMap((movie) => (movie.sessions || []).map((session) => ({ movie, session })))
    .filter(({ session }) => {
      const startsAt = sessionStartsAt(session);
      return startsAt && startsAt.getTime() > now.getTime()
        && !["cancelled", "hidden", "archived", "sold_out"].includes(normalizedSessionStatus(session));
    }).sort((a, b) => sessionStartsAt(a.session) - sessionStartsAt(b.session));
}

function seatsForDestination(db, session, holds = []) {
  const room = roomForSession(db, session);
  if (!roomSeatSelectionEnabled(room)) return [];
  const { sold, reserved } = sessionSeatAvailability(db, session.id);
  const held = new Set(holds.map((item) => String(item.seatId)));
  return roomSeats(room).filter((seat) => seat.enabled !== false && !sold.has(String(seat.id))
    && !reserved.has(String(seat.id)) && !held.has(String(seat.id)))
    .map((seat) => ({ id: String(seat.id), label: String(seat.label || `${seat.rowLabel || ""}${seat.number || ""}`), typeName: seat.typeName || "" }));
}

function changeTicketSession(db, { ticketId, sessionId, seatId = "", holds = [], adminUser, now = new Date() }) {
  const ticket = (db.tickets || []).find((item) => item.id === ticketId);
  if (!ticket) throw changeError("TICKET_NOT_FOUND", "Ingresso não encontrado.", 404);
  const order = (db.orders || []).find((item) => item.id === ticket.orderId);
  if (order?.status !== "paid" || order.refundStatus === "pending" || order.refundStatus === "completed"
      || ticket.status !== "active" || ticket.usedAt || ticket.refundStatus === "pending") {
    throw changeError("TICKET_CHANGE_UNAVAILABLE", "Este ingresso não pode ser trocado enquanto não estiver ativo e integralmente pago.");
  }
  const target = destinationSessions(db, now).find(({ session }) => session.id === sessionId);
  if (!target) throw changeError("SESSION_CHANGE_UNAVAILABLE", "Escolha uma sessão futura e disponível.");
  if (ticket.sessionId === sessionId) {
    if (String(ticket.seatId || "") === String(seatId || "")) return { ticket, unchanged: true };
    throw changeError("SESSION_CHANGE_SAME_SESSION", "Escolha outra sessão para a troca.");
  }
  const room = roomForSession(db, target.session);
  const seatSelection = roomSeatSelectionEnabled(room);
  if (room?.seatSelectionEnabled && !seatSelection) throw changeError("SESSION_CHANGE_LAYOUT_UNAVAILABLE", "O mapa de poltronas da sala de destino não está disponível.");
  let seat = null;
  if (seatSelection) {
    if (!seatId) throw changeError("SESSION_CHANGE_SEAT_REQUIRED", "Selecione uma poltrona na nova sessão.", 400);
    seat = seatsForDestination(db, target.session, holds).find((item) => item.id === String(seatId));
    if (!seat) throw changeError("SESSION_CHANGE_SEAT_UNAVAILABLE", "A poltrona escolhida não está mais disponível.");
  } else {
    if (seatId) throw changeError("SESSION_CHANGE_SEAT_INVALID", "A sessão não utiliza mapa de poltronas.", 400);
    const capacity = Number(target.session.capacity || room?.capacity || 0);
    if (!Number.isFinite(capacity) || capacity <= 0) throw changeError("SESSION_CHANGE_CAPACITY_UNKNOWN", "A sala de destino não possui capacidade válida.");
    const issued = (db.tickets || []).filter((item) => item.sessionId === sessionId && !["cancelled", "refunded", "expired"].includes(item.status)).length;
    const pending = (db.orders || []).filter((item) => item.sessionId === sessionId && item.status === "pending_payment"
      && (!item.reservationExpiresAt || Date.parse(item.reservationExpiresAt) > now.getTime()))
      .reduce((sum, item) => sum + Math.max(0, Number(item.ticketCount || item.fullTicketsCount + item.halfTicketsCount || 0)), 0);
    if (capacity > 0 && issued + pending >= capacity) throw changeError("SESSION_CHANGE_FULL", "A sessão de destino está lotada.");
  }

  const previous = { movieId: ticket.movieId, movieTitle: ticket.movieTitle, sessionId: ticket.sessionId,
    sessionDate: ticket.sessionDate, sessionTime: ticket.sessionTime, sessionRoom: ticket.sessionRoom, sessionFormat: ticket.sessionFormat || "",
    seatId: ticket.seatId || "", seat: ticket.seat || ticket.seatLabel || "Lugar livre", code: ticket.code };
  const next = { movieId: target.movie.id, movieTitle: target.movie.title, sessionId: target.session.id,
    sessionDate: target.session.date, sessionTime: target.session.time, sessionFormat: target.session.format || "",
    sessionRoom: roomDisplayLabel(room) || target.session.room || "", seatId: seat?.id || "",
    seat: seat?.label || "Lugar livre" };
  // Keep the order, payment, amount and original sale reference intact. The paid order
  // must stop occupying the source seat, while the moved ticket occupies the new one.
  if (previous.seatId && order.sessionId === previous.sessionId) {
    order.selectedSeatIds = (order.selectedSeatIds || []).filter((id) => String(id) !== String(previous.seatId));
    order.selectedSeats = (order.selectedSeats || []).filter((item) => String(item.id) !== String(previous.seatId));
  }
  Object.assign(ticket, next, {
    seatLabel: next.seat, seatType: seat?.typeName || "",
    code: ticketCodeService.createTicketCode(db.tickets || []),
    qrToken: ticketCodeService.generateQrToken(),
    sessionChangedAt: now.toISOString(), sessionChangedBy: adminUser.id, updatedAt: now.toISOString()
  });
  ticket.qrPayload = ticketCodeService.qrPayload(ticket.code, ticket.qrToken);
  delete ticket.shortCode;
  delete ticket.pdfArtifactPath;
  delete ticket.generatedPdfPath;
  ticket.sessionChangeHistory = [...(ticket.sessionChangeHistory || []), { previous, next, changedAt: ticket.sessionChangedAt, changedBy: adminUser.id }].slice(-50);
  db.auditLogs ||= [];
  db.auditLogs.push({ id: `audit-ticket-session-${randomUUID()}`, userId: adminUser.id,
    userEmail: adminUser.email, action: "POST /api/admin/tickets/:id/session-change", entityType: "ticket", entityId: ticket.id,
    before: previous, after: { ...next, code: ticket.code }, createdAt: ticket.sessionChangedAt });
  return { ticket, previous, next };
}

module.exports = { destinationSessions, seatsForDestination, changeTicketSession };
