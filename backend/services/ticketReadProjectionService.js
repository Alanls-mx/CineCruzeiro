function createTicketReadProjectionService({ relations, statusPolicy, concessions, presentation }) {
  const { orderForTicket, movieForTicket, sessionForTicket, roomForSession, orderTicketsSorted } = relations;
  const { ticketArchiveAt, effectiveTicketStatus, sessionTicketStats,
    ticketCanRedeemPendingConcessionsToday, canTransferTicket } = statusPolicy;
  const { concessionOrdersForTicket, pendingConcessionOrdersForTicket } = concessions;
  const { todayIsoDate, roomDisplayLabel, assetRecord, ticketCodeService,
    ticketQrPayload, publicAssetUrl, shortOrderReference } = presentation;

  function enrichTicket(db, ticket) {
    const order = orderForTicket(db, ticket);
    const movie = movieForTicket(db, ticket);
    const session = sessionForTicket(db, ticket);
    const room = roomForSession(db, session);
    const archiveAt = ticketArchiveAt(ticket, db);
    const status = effectiveTicketStatus(ticket, order, session, db);
    const stats = session ? sessionTicketStats(db, session.id) : null;
    const sessionDate = session?.date || order?.sessionDate || ticket.sessionDate || todayIsoDate();
    const sessionTime = session?.time || order?.sessionTime || ticket.sessionTime || "";
    const sessionRoom = roomDisplayLabel(room) || session?.room || order?.sessionRoom || ticket.sessionRoom || "Sala Cruzeiro";
    const sessionFormat = session?.format || order?.sessionFormat || ticket.sessionFormat || "";
    const capacity = Number(session?.capacity || room?.capacity || 0);
    const orderTickets = orderTicketsSorted(db, ticket.orderId);
    const orderTicketIndex = Math.max(0, orderTickets.findIndex((item) => item.id === ticket.id));
    const orderTicketCount = orderTickets.length || 1;
    const concessionOrders = concessionOrdersForTicket(db, ticket);
    const pendingConcessionOrders = pendingConcessionOrdersForTicket(db, ticket);
    const canRedeemConcessionsToday = ticketCanRedeemPendingConcessionsToday(ticket, db);
    const orderExtras = concessionOrders.flatMap((sourceOrder) =>
      (Array.isArray(sourceOrder?.concessionItems) ? sourceOrder.concessionItems : []).map((item) => ({
        ...assetRecord(item, ["imageUrl"]),
        sourceOrderId: sourceOrder.id
      }))
    );
    const transferCheck = canTransferTicket(db, ticket);
    const displayCode = ticketCodeService.displayCode(ticket);
    return {
      ...ticket,
      displayCode,
      displayQrPayload: ticketQrPayload(displayCode),
      customerEmail: ticket.customerEmail || order?.customerEmail || "",
      customerPhone: ticket.customerPhone || order?.customerPhone || "",
      customerCpf: ticket.customerCpf || order?.customerCpf || "",
      customerUserId: ticket.customerUserId || order?.customerUserId || "",
      movieTitle: movie?.title || order?.movieTitle || ticket.movieTitle || "",
      posterUrl: publicAssetUrl(movie?.posterUrl || ""),
      backdropUrl: publicAssetUrl(movie?.backdropUrl || ""),
      sessionDate,
      sessionTime,
      sessionRoom,
      sessionFormat,
      sessionStatus: session?.status || "",
      sessionCapacity: capacity,
      sessionSold: stats?.sold || 0,
      sessionAvailable: capacity ? Math.max(0, capacity - (stats?.sold || 0)) : null,
      seat: ticket.seat || ticket.seatLabel || ticket.assento || ticket.metadata?.seat || "Lugar livre",
      orderReference: shortOrderReference(order || { id: ticket.orderId }, movie?.title || ticket.movieTitle || ""),
      orderStatus: order?.status || "",
      paymentStatus: order?.paymentStatus || "",
      extras: orderExtras,
      extrasSharedByOrder: Boolean((order?.concessionItems || []).length),
      extrasAttachedToTicket: pendingConcessionOrders.length > 0,
      canRedeemConcessionsToday,
      orderTicketIndex,
      orderTicketCount,
      status,
      archived: ["archived", "used", "cancelled", "refunded", "expired"].includes(status),
      archiveAt: archiveAt?.toISOString() || "",
      canTransfer: transferCheck.ok,
      transferBlockedReason: transferCheck.ok ? "" : transferCheck.message
    };
  }
  return { enrichTicket };
}

module.exports = { createTicketReadProjectionService };
