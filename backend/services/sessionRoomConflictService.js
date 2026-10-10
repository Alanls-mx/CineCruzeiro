const { isValidCalendarDate, isValidSessionTime } = require("./calendarDateService");
const { isDeletedMovie } = require("./movieCatalogLifecycleService");

function normalizedStatus(value) {
  return String(value || "available").trim().toLowerCase();
}

function sessionStartsAt(session = {}) {
  const date = String(session.date || "").slice(0, 10);
  const time = String(session.time || session.timeLabel || "").trim();
  if (!isValidCalendarDate(date) || !isValidSessionTime(time)) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function movieDurationMinutes(movie = {}) {
  const raw = String(movie.duration || "").trim().toLowerCase();
  const hours = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*h/)?.[1]?.replace(",", ".") || 0);
  const minutes = Number(raw.match(/(\d+)\s*(?:m|min)/)?.[1] || raw.match(/h\s*(\d+)\s*$/)?.[1] || 0);
  if (hours || minutes) return Math.max(1, Math.round(hours * 60 + minutes));
  const numeric = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 100;
}

function roomIdentity(session = {}, rooms = []) {
  const roomId = String(session.roomId || "").trim();
  if (roomId) return `id:${roomId}`;
  const knownRooms = rooms instanceof Map ? [...rooms.values()] : rooms;
  const roomLabel = String(session.room || "").trim().toLowerCase();
  const knownRoom = knownRooms.find((room) => {
    const name = String(room.name || "").trim().toLowerCase();
    return name && (roomLabel === name || roomLabel.startsWith(`${name} (`));
  });
  if (knownRoom) return `id:${knownRoom.id}`;
  const label = String(session.room || "sem-sala")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `label:${label}`;
}

function roomCleanupMinutes(room) {
  return room ? Math.min(120, Math.max(0, Number(room.cleanupMinutes ?? 20) || 0)) : 0;
}

function findSessionRoomConflicts({ movies = [], rooms = [], candidateMovie = {}, candidate = {}, ignoreSessionId = "", additional = [] } = {}) {
  const candidateStart = sessionStartsAt(candidate);
  if (!candidateStart || ["cancelled", "hidden", "archived"].includes(normalizedStatus(candidate.status))) return [];
  const candidateEnd = new Date(candidateStart.getTime() + movieDurationMinutes(candidateMovie) * 60 * 1000);
  const knownRooms = rooms instanceof Map ? [...rooms.values()] : rooms;
  const candidateRoom = roomIdentity(candidate, knownRooms);
  const room = knownRooms.find((item) => candidateRoom === `id:${item.id}`);
  const cleanupMinutes = roomCleanupMinutes(room);
  const gapMs = cleanupMinutes * 60000;
  const scheduled = movies.filter((movie) => !isDeletedMovie(movie)).flatMap((movie) => (movie.sessions || []).map((session) => ({ movie, session }))).concat(additional);

  return scheduled.flatMap(({ movie, session }) => {
    if (!session || String(session.id || "") === String(ignoreSessionId || candidate.id || "")) return [];
    if (roomIdentity(session, rooms) !== candidateRoom || ["cancelled", "hidden", "archived"].includes(normalizedStatus(session.status))) return [];
    const startsAt = sessionStartsAt(session);
    if (!startsAt) return [];
    const endsAt = new Date(startsAt.getTime() + movieDurationMinutes(movie) * 60 * 1000);
    if (candidateStart.getTime() >= endsAt.getTime() + gapMs || startsAt.getTime() >= candidateEnd.getTime() + gapMs) return [];
    return [{ movieId: movie.id, movieTitle: movie.title || "Filme sem título", sessionId: session.id, date: session.date, time: session.time, room: session.room, endsAt: endsAt.toISOString(), cleanupMinutes, availableAfter: new Date(endsAt.getTime() + gapMs).toISOString() }];
  });
}

module.exports = {
  findSessionRoomConflicts,
  roomCleanupMinutes,
  movieDurationMinutes,
  roomIdentity,
  sessionStartsAt,
  _test: { movieDurationMinutes, normalizedStatus, roomIdentity, sessionStartsAt }
};
