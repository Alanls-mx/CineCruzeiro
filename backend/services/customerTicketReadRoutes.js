function createCustomerTicketReadRoutes({
  appFrontendUrl, securityHeaders, requireCustomerAuth, ticketBelongsToUser,
  enrichTicket, toCustomerTicketDto, getOwnedTicket, sendJson
}) {
  function findAccountTickets(db, userOrQuery) {
    if (!userOrQuery) return [];
    const user = typeof userOrQuery.get === "function"
      ? (userOrQuery.get("userId") ? (db.users || []).find((item) => item.id === String(userOrQuery.get("userId")).trim()) : null)
      : userOrQuery;
    if (!user) return [];

    return (db.tickets || [])
      .filter((ticket) => ticketBelongsToUser(db, ticket, user))
      .map((ticket) => enrichTicket(db, ticket))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function handleCustomerTicketListRead({ req, res, pathname, method, db }) {
    if (pathname !== "/api/me/tickets" || method !== "GET") return false;
    const isDocumentNavigation = req.headers["sec-fetch-mode"] === "navigate"
      && String(req.headers.accept || "").includes("text/html");
    if (isDocumentNavigation) {
      res.writeHead(303, securityHeaders({
        Location: `${appFrontendUrl()}/conta/ingressos`,
        "Cache-Control": "private, no-store, max-age=0"
      }));
      res.end();
      return true;
    }
    const user = requireCustomerAuth(req, res, db);
    if (!user) return true;
    const enrichedTickets = findAccountTickets(db, user);
    const tickets = enrichedTickets.map(toCustomerTicketDto);
    sendJson(res, 200, {
      tickets,
      upcoming: enrichedTickets.filter((ticket) => !ticket.archived).map(toCustomerTicketDto),
      archived: enrichedTickets.filter((ticket) => ticket.archived).map(toCustomerTicketDto)
    }, { "Cache-Control": "private, no-store, max-age=0" });
    return true;
  }

  function handleCustomerTicketDetailRead({ res, method, action, db, ticketId, user }) {
    if (method !== "GET" || action) return false;
    const ticket = getOwnedTicket(db, ticketId, user);
    if (!ticket) {
      sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
      return true;
    }
    sendJson(res, 200, { ticket: toCustomerTicketDto(enrichTicket(db, ticket)) }, {
      "Cache-Control": "private, no-store, max-age=0"
    });
    return true;
  }

  return { handleCustomerTicketListRead, handleCustomerTicketDetailRead };
}

module.exports = { createCustomerTicketReadRoutes };
