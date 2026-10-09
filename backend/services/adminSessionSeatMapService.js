function buildAdminSessionSeatMap({ movie, session, room, tickets = [], orders = [], holds = [], occupiedSeatIds = [], showPurchaser = false }) {
  const activeTickets = tickets.filter((ticket) => ticket.sessionId === session.id && !["cancelled", "refunded", "expired"].includes(ticket.status));
  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  const activeOrders = orders.filter((order) => order.sessionId === session.id
    && ["pending_payment", "paid", "paid_pending_print"].includes(order.status)
    && !(order.status === "pending_payment" && order.reservationExpiresAt && Date.parse(order.reservationExpiresAt) <= Date.now()));
  const heldIds = new Set(holds.map((hold) => String(hold.seatId)));
  const occupiedIds = new Set([...occupiedSeatIds].map(String));
  const typeById = new Map((room?.seatTypes || []).map((type) => [String(type.id), type]));
  const counts = { available: 0, sold: 0, pending: 0, held: 0, blocked: 0 };

  const rows = (room?.seatLayout?.rows || []).map((row) => ({
    id: row.id,
    label: row.label,
    seats: (row.seats || []).map((seat) => {
      const id = String(seat.id);
      const label = String(seat.label || "");
      const ticket = activeTickets.find((item) => String(item.seatId || "") === id
        || (!item.seatId && String(item.seatLabel || item.seat || "") === label));
      const order = ticket ? orderById.get(String(ticket.orderId || ""))
        : activeOrders.find((item) => (item.selectedSeatIds || []).some((seatId) => String(seatId) === id));
      const status = seat.enabled === false ? "blocked"
        : ticket || order?.status === "paid" || order?.status === "paid_pending_print" ? "sold"
          : order?.status === "pending_payment" ? "pending"
            : occupiedIds.has(id) ? "sold"
              : heldIds.has(id) ? "held" : "available";
      counts[status] += 1;
      const type = typeById.get(String(seat.typeId || ""));
      return {
        id,
        label,
        status,
        typeName: type?.name || "Padrão",
        color: seat.color || type?.color || "",
        accessibility: seat.accessibility || "",
        aisleAfter: Boolean(seat.aisleAfter),
        ...(showPurchaser && order ? {
          purchase: {
            orderId: order.id,
            orderReference: order.reference || order.publicReference || order.id,
            customerName: order.saleMode === "quick" ? "Venda rápida" : order.customerName || ticket?.customerName || "Cliente não identificado",
            createdAt: order.createdAt || "",
            paidAt: order.paidAt || "",
            origin: order.origin || "",
            orderStatus: order.status || "",
            paymentMethod: order.paymentMethod || "",
            ticketType: ticket?.ticketType || "",
            ticketStatus: ticket?.status || "",
            usedAt: ticket?.usedAt || ""
          }
        } : {})
      };
    })
  }));

  return {
    sessionId: session.id,
    movieTitle: movie?.title || "",
    date: session.date || "",
    time: session.time || "",
    roomName: room?.name || session.room || "Sala",
    enabled: Boolean(rows.some((row) => row.seats.length)),
    screenLabel: room?.seatLayout?.screenLabel || "TELA",
    counts,
    rows
  };
}

module.exports = { buildAdminSessionSeatMap };
