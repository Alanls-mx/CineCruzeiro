function roomForSession(db, session) {
  if (!session) return null;
  const rooms = db.rooms || [];
  const roomId = String(session.roomId || "").trim();
  const roomById = roomId ? rooms.find((room) => String(room.id) === roomId) : null;
  const roomName = String(session.room || "").split("(")[0].trim().toLowerCase();
  const roomByLabel = rooms.find((room) => {
    const candidate = String(room.name || "").trim().toLowerCase();
    return candidate && (roomName === candidate || String(session.room || "").toLowerCase().includes(candidate));
  });
  // Legacy PostgreSQL writes could point roomId at the first room while keeping
  // the correct room name. Prefer that label when the two references disagree.
  return roomByLabel || roomById || null;
}

function roomDisplayLabel(room) {
  if (!room) return "";
  return `${String(room.name || "Sala").trim()} (${String(room.technology || "Sala").trim()})`;
}

function sessionWithCurrentRoom(db, session) {
  const room = roomForSession(db, session);
  return room ? { ...session, roomId: room.id, room: roomDisplayLabel(room) } : session;
}

function roomSeatTypes(room) {
  return Array.isArray(room?.seatTypes) ? room.seatTypes : [];
}

function roomSeats(room) {
  const rows = Array.isArray(room?.seatLayout?.rows) ? room.seatLayout.rows : [];
  return rows.flatMap((row) => (Array.isArray(row.seats) ? row.seats : []).map((seat) => ({
    ...seat,
    rowId: row.id,
    rowLabel: row.label
  })));
}

function roomSeatSelectionEnabled(room) {
  return Boolean(room?.seatSelectionEnabled && roomSeats(room).some((seat) => seat.enabled !== false));
}

module.exports = { roomForSession, roomDisplayLabel, sessionWithCurrentRoom, roomSeatTypes, roomSeats, roomSeatSelectionEnabled };
