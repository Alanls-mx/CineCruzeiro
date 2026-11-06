const ticketCodeService = require("./ticketCodeService");

function createTicketValidationService({
  enrichTicket,
  effectiveTicketStatus,
  sessionForTicket,
  checkAndAutoArchiveOrder,
}) {
function inspectTicket(db, code, expectedSessionId = "") {
  const ticket = ticketCodeService.findTicketByCode(db.tickets || [], code);
  if (!ticket) {
    const error = new Error("Ingresso nao encontrado.");
    error.statusCode = 404;
    error.code = "TICKET_NOT_FOUND";
    throw error;
  }
  const order = (db.orders || []).find((item) => item.id === ticket.orderId);
  const requiredSessionId = String(expectedSessionId || "").trim();
  if (requiredSessionId) {
    const requiredMovie = (db.movies || []).find((movie) => (movie.sessions || []).some((session) => session.id === requiredSessionId));
    const requiredSession = requiredMovie?.sessions?.find((session) => session.id === requiredSessionId);
    if (!requiredSession) {
      const error = new Error("A sessão selecionada para validação não existe mais. Atualize o painel e escolha novamente.");
      error.statusCode = 400;
      error.code = "VALIDATION_SESSION_NOT_FOUND";
      throw error;
    }
    const actualSessionId = String(ticket.sessionId || order?.sessionId || "").trim();
    if (actualSessionId !== requiredSessionId) {
      const date = String(requiredSession.date || "").split("-").reverse().join("/");
      const error = new Error(`Este ingresso não pertence à sessão selecionada (${requiredMovie.title}, ${date} às ${requiredSession.time}). Ele não foi utilizado.`);
      error.statusCode = 409;
      error.code = "TICKET_SESSION_MISMATCH";
      error.ticket = enrichTicket(db, ticket);
      error.expectedSessionId = requiredSessionId;
      error.actualSessionId = actualSessionId;
      throw error;
    }
  }
  const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
  if (status === "used" || ticket.status === "used" || ticket.usedAt) {
    const error = new Error(`Ingresso ja validado em ${new Date(ticket.usedAt || Date.now()).toLocaleString("pt-BR")}.`);
    error.statusCode = 409;
    error.code = "TICKET_ALREADY_USED";
    error.ticket = ticket;
    throw error;
  }
  if (order && order.status !== "paid") {
    const error = new Error("Ingresso ainda nao esta liberado porque o pedido nao esta pago.");
    error.statusCode = 409;
    error.code = "TICKET_PAYMENT_PENDING";
    error.ticket = ticket;
    throw error;
  }
  if (["cancelled", "refunded"].includes(status) || ["cancelled", "refunded"].includes(ticket.status)) {
    const error = new Error("Ingresso indisponivel para validacao.");
    error.statusCode = 409;
    error.code = "TICKET_CANCELLED";
    error.ticket = enrichTicket(db, ticket);
    throw error;
  }
  if (status !== "active") {
    const error = new Error("Ingresso indisponivel para validacao.");
    error.statusCode = 409;
    error.code = status === "archived" ? "TICKET_EXPIRED" : "TICKET_UNAVAILABLE";
    error.ticket = enrichTicket(db, ticket);
    throw error;
  }
  return ticket;
}

function validateTicket(db, code, adminUser, expectedSessionId = "") {
  const ticket = inspectTicket(db, code, expectedSessionId);
  const order = (db.orders || []).find((item) => item.id === ticket.orderId);
  if (ticket.status !== "active" || ticket.usedAt) {
    const error = new Error(`Ingresso ja validado em ${new Date(ticket.usedAt || Date.now()).toLocaleString("pt-BR")}.`);
    error.statusCode = 409;
    error.code = "TICKET_ALREADY_USED";
    error.ticket = ticket;
    throw error;
  }
  ticket.status = "used";
  ticket.usedAt = new Date().toISOString();
  ticket.usedBy = adminUser?.id || "";
  if (order) {
    checkAndAutoArchiveOrder(db, order, adminUser, "Ingressos e bomboniere validados pelo cinema");
  }
  return ticket;
}

  return { inspectTicket, validateTicket };
}

module.exports = { createTicketValidationService };
