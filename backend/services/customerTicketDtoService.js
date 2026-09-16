function toCustomerTicketDto(ticket) {
  if (!ticket) return null;
  const status = ticket.status || "active";
  const canRedeemConcessionsToday = Boolean(ticket.canRedeemConcessionsToday);
  return {
    id: ticket.id,
    ...(status === "active" || canRedeemConcessionsToday ? { code: ticket.displayCode || ticket.code || "" } : {}),
    movieTitle: ticket.movieTitle || "",
    sessionDate: ticket.sessionDate || "",
    sessionTime: ticket.sessionTime || "",
    sessionRoom: ticket.sessionRoom || "",
    sessionFormat: ticket.sessionFormat || "",
    seat: ticket.seat || ticket.seatLabel || "Lugar livre",
    ticketType: ticket.ticketType || "Ingresso",
    status,
    posterUrl: ticket.posterUrl || "",
    extras: (ticket.extras || []).map((item) => ({
      name: item.name || "",
      quantity: Number(item.quantity || 0)
    })),
    extrasSharedByOrder: Boolean(ticket.extrasSharedByOrder),
    extrasAttachedToTicket: Boolean(ticket.extrasAttachedToTicket),
    canRedeemConcessionsToday,
    orderTicketIndex: ticket.orderTicketIndex ?? 0,
    orderTicketCount: ticket.orderTicketCount ?? 1,
    archived: Boolean(ticket.archived),
    canTransfer: Boolean(ticket.canTransfer),
    transferBlockedReason: ticket.transferBlockedReason || ""
  };
}

module.exports = { toCustomerTicketDto };
