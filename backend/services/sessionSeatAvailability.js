function sessionSeatAvailability(db, sessionId, now = Date.now()) {
  const sold = new Set();
  const reserved = new Set();

  for (const ticket of db.tickets || []) {
    if (ticket.sessionId !== sessionId || ["cancelled", "refunded", "expired"].includes(ticket.status)) continue;
    if (ticket.seatId) sold.add(String(ticket.seatId));
  }

  for (const order of db.orders || []) {
    if (order.sessionId !== sessionId) continue;
    const paid = ["paid", "paid_pending_print"].includes(order.status);
    const pending = order.status === "pending_payment"
      && (!order.reservationExpiresAt || Date.parse(order.reservationExpiresAt) > now);
    if (!paid && !pending) continue;
    for (const seatId of order.selectedSeatIds || []) {
      (paid ? sold : reserved).add(String(seatId));
    }
  }

  for (const seatId of sold) reserved.delete(seatId);
  return { sold, reserved };
}

module.exports = { sessionSeatAvailability };
