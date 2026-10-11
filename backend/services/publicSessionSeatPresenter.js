function createPublicSessionSeatPresenter({ roomSeats, roomSeatTypes }) {
  function present({ sessionId, session, movie, room, enabled, sold, reserved, holds, ownerToken }) {
    const holdsBySeat = new Map(holds.map((hold) => [String(hold.seatId), hold]));
    return {
      sessionId,
      movieTitle: movie?.title || "",
      roomId: room?.id || "",
      roomName: room?.name || session.room || "Sala Cruzeiro",
      enabled,
      capacity: enabled ? roomSeats(room).filter((seat) => seat.enabled !== false).length : Number(room?.capacity || session.capacity || 0),
      placeholder: enabled ? "Selecione sua poltrona" : "Lugar livre",
      screenLabel: room?.seatLayout?.screenLabel || "TELA",
      seatTypes: roomSeatTypes(room),
      rows: (room?.seatLayout?.rows || []).map((row) => ({
        id: row.id,
        label: row.label,
        seats: (row.seats || []).map((seat) => ({
          id: seat.id,
          label: seat.label,
          typeId: seat.typeId,
          color: seat.color || "",
          accessibility: seat.accessibility || "",
          enabled: seat.enabled !== false,
          aisleAfter: Boolean(seat.aisleAfter),
          status: seat.enabled === false
            ? "blocked"
            : sold.has(String(seat.id))
              ? "unavailable"
              : reserved.has(String(seat.id)) || holdsBySeat.has(String(seat.id))
                ? "held"
                : "available",
          heldByMe: !reserved.has(String(seat.id)) && Boolean(ownerToken && holdsBySeat.get(String(seat.id))?.ownerToken === ownerToken)
        }))
      }))
    };
  }

  return { present };
}

module.exports = { createPublicSessionSeatPresenter };
