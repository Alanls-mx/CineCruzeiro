function normalizedStatus(value) {
  return String(value || "available").trim().toLowerCase();
}

function sessionStartsAt(session = {}) {
  if (session.startsAt) {
    const direct = new Date(session.startsAt);
    if (!Number.isNaN(direct.getTime())) return direct;
  }
  const date = String(session.date || "").slice(0, 10);
  const time = String(session.time || session.timeLabel || "00:00").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasAvailableSession(movie = {}, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  return (Array.isArray(movie.sessions) ? movie.sessions : []).some((session) => {
    if (["sold_out", "cancelled", "hidden", "archived"].includes(normalizedStatus(session.status))) return false;
    const startsAt = sessionStartsAt(session);
    return startsAt ? startsAt.getTime() + (10 * 60 * 1000) > now.getTime() : false;
  });
}

function shouldPublishUpcomingMovie(movie = {}, todayKey = "", nowValue = new Date()) {
  if (normalizedStatus(movie.status) !== "upcoming") return false;
  const releaseDate = String(movie.releaseDate || "").slice(0, 10);
  if (!releaseDate || !todayKey || releaseDate > todayKey) return false;
  return Boolean(movie.autoPublish || hasAvailableSession(movie, nowValue));
}

module.exports = { hasAvailableSession, shouldPublishUpcomingMovie, _test: { normalizedStatus, sessionStartsAt } };
