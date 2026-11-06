const { sessionSeatAvailability } = require("./sessionSeatAvailability");

function occupiedSeatIds(db, sessionId, ignoredOrderId = "") {
  const source = ignoredOrderId
    ? { tickets: db.tickets, orders: (db.orders || []).filter((order) => order.id !== ignoredOrderId) }
    : db;
  const { sold, reserved } = sessionSeatAvailability(source, sessionId);
  return new Set([...sold, ...reserved]);
}

function createOrderSeatAssignmentService({ roomForSession, roomSeatSelectionEnabled, roomSeats, roomSeatTypes, orderTicketCount }) {
  function assignSeatsToOrder(db, order, session) {
    const room = roomForSession(db, session);
    if (!roomSeatSelectionEnabled(room)) {
      order.selectedSeatIds = [];
      order.selectedSeats = [];
      order.seatSelectionEnabled = false;
      order.seatDisplay = "Lugar livre";
      return order;
    }

    const requested = orderTicketCount(order);
    let selectedSeatIds = Array.from(new Set((order.selectedSeatIds || []).map(String)));
    if (!selectedSeatIds.length && order.autoAssignSeats) {
      const occupied = occupiedSeatIds(db, session.id, order.id);
      selectedSeatIds = roomSeats(room)
        .filter((seat) => seat.enabled !== false && !occupied.has(String(seat.id)))
        .slice(0, requested)
        .map((seat) => String(seat.id));
    }
    if (selectedSeatIds.length !== requested) {
      const error = new Error(`Selecione ${requested} poltrona(s), uma para cada ingresso gerado.`);
      error.statusCode = 422;
      error.code = "SEAT_SELECTION_INCOMPLETE";
      throw error;
    }

    const seatTypes = new Map(roomSeatTypes(room).map((type) => [String(type.id), type]));
    const seats = new Map(roomSeats(room).filter((seat) => seat.enabled !== false).map((seat) => [String(seat.id), seat]));
    const invalid = selectedSeatIds.find((seatId) => !seats.has(seatId));
    if (invalid) {
      const error = new Error("Uma das poltronas selecionadas não existe mais neste mapa. Escolha novamente.");
      error.statusCode = 409;
      error.code = "SEAT_LAYOUT_CHANGED";
      throw error;
    }

    const occupied = occupiedSeatIds(db, session.id, order.id);
    const unavailable = selectedSeatIds.find((seatId) => occupied.has(seatId));
    if (unavailable) {
      const error = new Error(`A poltrona ${seats.get(unavailable)?.label || unavailable} acabou de ser reservada. Escolha outra para continuar.`);
      error.statusCode = 409;
      error.code = "SEAT_UNAVAILABLE";
      throw error;
    }

    order.selectedSeatIds = selectedSeatIds;
    order.selectedSeats = selectedSeatIds.map((seatId) => {
      const seat = seats.get(seatId);
      const type = seatTypes.get(String(seat.typeId || ""));
    return {
      id: seatId,
      label: String(seat.label || seatId),
      rowLabel: String(seat.rowLabel || ""),
      typeId: String(seat.typeId || "standard"),
      typeName: String(type?.name || "Padrão"),
      accessibility: ["wheelchair", "obese"].includes(String(seat.accessibility || "")) ? String(seat.accessibility) : ""
    };
  });
  order.seatSelectionEnabled = true;
  order.seatDisplay = order.selectedSeats.map((seat) => seat.label).join(", ");
  return order;
}

  return { assignSeatsToOrder };
}

module.exports = { occupiedSeatIds, createOrderSeatAssignmentService };
