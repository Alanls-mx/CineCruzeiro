const crypto = require("crypto");
const ticketCodeService = require("./ticketCodeService");

function createTicketIssuanceService({ todayIsoDate, fallbackCustomerName }) {
  function buildTicketsForOrder(order, db, source = "online") {
    const tickets = [];
    const selectedTicketItems = Array.isArray(order.ticketItems) && order.ticketItems.length
      ? order.ticketItems
      : [
          { name: "Inteira", quantity: Number(order.fullTicketsCount || 0) },
          { name: "Meia", quantity: Number(order.halfTicketsCount || 0) }
        ];
    const base = {
      orderId: order.id,
      movieId: order.movieId || "",
      movieTitle: order.movieTitle || "",
      sessionId: order.sessionId || "",
      sessionTime: order.sessionTime || "",
      sessionFormat: order.sessionFormat || "",
      sessionDate: order.sessionDate || todayIsoDate(),
      customerName: order.customerName || fallbackCustomerName,
      customerPhone: order.customerPhone || "",
      customerEmail: String(order.customerEmail || "").trim().toLowerCase(),
      customerCpf: String(order.customerCpf || "").replace(/\D/g, ""),
      customerUserId: order.customerUserId || "",
      sessionRoom: order.sessionRoom || "",
      source,
      status: "active",
      createdAt: new Date().toISOString()
    };

    const pushTicket = (ticketType, index) => {
      const pendingTickets = (db.orders || []).flatMap((item) => Array.isArray(item.pendingPrintTickets) ? item.pendingPrintTickets : []);
      const code = ticketCodeService.createTicketCode([...(db.tickets || []), ...pendingTickets, ...tickets]);
      const qrToken = ticketCodeService.generateQrToken();
      const selectedSeat = Array.isArray(order.selectedSeats) ? order.selectedSeats[index - 1] : null;
      tickets.push({
        ...base,
        customerName: order.attendeeNames?.[index - 1] || base.customerName,
        id: `ticket-${Date.now()}-${index}-${crypto.randomBytes(2).toString("hex")}`,
        code,
        qrToken,
        qrPayload: ticketCodeService.qrPayload(code, qrToken),
        ticketType,
        ticketNumber: Math.max(0, ...(db.tickets || []).map((item) => Number(item.ticketNumber || 0)), ...pendingTickets.map((item) => Number(item.ticketNumber || 0)), ...tickets.map((item) => Number(item.ticketNumber || 0))) + 1,
        basePrice: 0,
        subscriptionCreditAmount: 0,
        additionalPaymentAmount: 0,
        paymentSource: source === "courtesy" ? "courtesy" : /promoc/i.test(ticketType) ? "promotional" : "standard",
        subscriptionCreditId: "",
        seatId: selectedSeat?.id || "",
        seat: selectedSeat?.label || "Lugar livre",
        seatLabel: selectedSeat?.label || "Lugar livre",
        seatType: selectedSeat?.typeName || "",
        usedAt: "",
        usedBy: ""
      });
    };

    let ticketIndex = 0;
    selectedTicketItems.forEach((item) => {
      const quantity = Math.max(0, Math.floor(Number(item.ticketQuantity ?? (Number(item.quantity || 0) * Number(item.bundleQuantity || 1)))));
      Array.from({ length: quantity }).forEach(() => {
        ticketIndex += 1;
        pushTicket(String(item.name || "Ingresso"), ticketIndex);
      });
    });
    return tickets;
  }

  return { buildTicketsForOrder };
}

module.exports = { createTicketIssuanceService };
