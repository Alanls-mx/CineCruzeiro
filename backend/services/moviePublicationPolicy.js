function normalizedStatus(value) {
  return String(value || "available").trim().toLowerCase();
}

function sessionStartsAt(session = {}) {
  session = session || {};
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

const PRE_PREMIERE_WINDOW_MS = 24 * 60 * 60 * 1000;

function availableSessions(movie = {}, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (Number.isNaN(now.getTime())) return [];
  return (Array.isArray(movie.sessions) ? movie.sessions : [])
    .filter((session) => {
      if (["sold_out", "cancelled", "hidden", "archived"].includes(normalizedStatus(session.status))) return false;
      const startsAt = sessionStartsAt(session);
      return startsAt ? startsAt.getTime() + (10 * 60 * 1000) > now.getTime() : false;
    })
    .sort((first, second) => sessionStartsAt(first).getTime() - sessionStartsAt(second).getTime());
}

function nearestAvailableSession(movie = {}, nowValue = new Date()) {
  return availableSessions(movie, nowValue)[0] || null;
}

function moviePremiereTiming(movie = {}, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const session = nearestAvailableSession(movie, now);
  const startsAt = sessionStartsAt(session);
  if (!session || !startsAt || Number.isNaN(now.getTime())) return null;

  const prePremiereAt = new Date(startsAt.getTime() - PRE_PREMIERE_WINDOW_MS);
  if (now.getTime() < prePremiereAt.getTime()) {
    return { session, startsAt, prePremiereAt, publish: false, tag: "Em Breve" };
  }
  return {
    session,
    startsAt,
    prePremiereAt,
    publish: true,
    tag: now.getTime() < startsAt.getTime() ? "Pré-Estreia" : "Estreia"
  };
}

function hasAvailableSession(movie = {}, nowValue = new Date()) {
  return Boolean(nearestAvailableSession(movie, nowValue));
}

function shouldPublishUpcomingMovie(movie = {}, todayKey = "", nowValue = new Date()) {
  if (normalizedStatus(movie.status) !== "upcoming") return false;
  const premiereTiming = moviePremiereTiming(movie, nowValue);
  if (premiereTiming?.publish) return true;
  const releaseDate = String(movie.releaseDate || "").slice(0, 10);
  if (!releaseDate || !todayKey || releaseDate > todayKey) return false;
  return Boolean(movie.autoPublish);
}

module.exports = {
  PRE_PREMIERE_WINDOW_MS,
  hasAvailableSession,
  moviePremiereTiming,
  nearestAvailableSession,
  shouldPublishUpcomingMovie,
  _test: { availableSessions, normalizedStatus, sessionStartsAt }
};
