const crypto = require("crypto");
const { movieDurationMinutes, roomIdentity, sessionStartsAt } = require("./sessionRoomConflictService");

const INACTIVE_STATUSES = new Set(["cancelled", "hidden", "archived"]);

function cinemaParts(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function ceilToStep(timestamp, stepMinutes = 5) {
  const step = Math.max(1, Number(stepMinutes) || 1);
  const stepMs = step * 60 * 1000;
  return Math.ceil(timestamp / stepMs) * stepMs;
}

function overlaps(start, end, occupied, turnaroundMs) {
  return occupied.find((slot) => start < slot.end + turnaroundMs && end + turnaroundMs > slot.start);
}

function planHash(plan) {
  return crypto.createHash("sha256").update(JSON.stringify({
    changes: plan.changes.map(({ movieId, sessionId, from, to }) => ({ movieId, sessionId, from, to })),
    unresolved: plan.unresolved.map(({ sessionId, reason }) => ({ sessionId, reason })),
    turnaroundMinutes: plan.turnaroundMinutes,
    stepMinutes: plan.stepMinutes
  })).digest("base64url");
}

function buildSessionAutocorrectPlan({ movies = [], rooms = [], tickets = [], orders = [], filters = {}, turnaroundMinutes = 20, stepMinutes = 5, includeSales = false, now = Date.now() } = {}) {
  const margin = Math.min(120, Math.max(0, Number(turnaroundMinutes) || 0));
  const step = [1, 5, 10, 15, 20, 30, 60].includes(Number(stepMinutes)) ? Number(stepMinutes) : 5;
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const hasHistory = new Set([
    ...tickets.map((ticket) => ticket.sessionId),
    ...orders.map((order) => order.sessionId)
  ].filter(Boolean));
  const entries = movies.flatMap((movie) => (movie.sessions || []).map((session) => {
    const startsAt = sessionStartsAt(session)?.getTime();
    return {
      movie,
      session,
      startsAt,
      durationMinutes: movieDurationMinutes(movie),
      roomKey: roomIdentity(session, roomMap),
      hasSales: hasHistory.has(session.id),
      inScope: (!filters.from || session.date >= filters.from)
        && (!filters.to || session.date <= filters.to)
        && (!filters.roomId || roomIdentity(session, roomMap) === `id:${filters.roomId}`)
        && (!filters.movieId || movie.id === filters.movieId)
    };
  })).filter((entry) => Number.isFinite(entry.startsAt)
    && !INACTIVE_STATUSES.has(String(entry.session.status || "").toLowerCase()));

  const byRoom = new Map();
  entries.forEach((entry) => byRoom.set(entry.roomKey, [...(byRoom.get(entry.roomKey) || []), entry]));
  const changes = [];
  const unresolved = [];
  const turnaroundMs = margin * 60 * 1000;

  byRoom.forEach((roomEntries) => {
    const ordered = roomEntries.sort((a, b) => a.startsAt - b.startsAt || String(a.session.id).localeCompare(String(b.session.id)));
    const locked = ordered.filter((entry) => !entry.inScope || entry.startsAt <= now || (entry.hasSales && !includeSales));
    const occupied = locked.map((entry) => ({ start: entry.startsAt, end: entry.startsAt + entry.durationMinutes * 60000, entry }));

    const lockedInScope = locked.filter((entry) => entry.inScope);
    lockedInScope.forEach((entry, index) => {
      const collision = lockedInScope.slice(index + 1).find((candidate) => entry.startsAt < candidate.startsAt + candidate.durationMinutes * 60000
        && candidate.startsAt < entry.startsAt + entry.durationMinutes * 60000);
      if (collision) unresolved.push({
        movieId: entry.movie.id,
        movieTitle: entry.movie.title,
        sessionId: entry.session.id,
        date: entry.session.date,
        time: entry.session.time,
        room: entry.session.room,
        reason: entry.startsAt <= now ? "Sessão já iniciada" : "Sessão com vendas vinculadas"
      });
    });

    ordered.filter((entry) => entry.inScope && !locked.includes(entry)).forEach((entry) => {
      let start = entry.startsAt;
      let end = start + entry.durationMinutes * 60000;
      let collision = overlaps(start, end, occupied, turnaroundMs);
      while (collision) {
        start = ceilToStep(collision.end + turnaroundMs, step);
        end = start + entry.durationMinutes * 60000;
        collision = overlaps(start, end, occupied, turnaroundMs);
      }
      occupied.push({ start, end, entry });
      occupied.sort((a, b) => a.start - b.start);
      if (start !== entry.startsAt) {
        changes.push({
          movieId: entry.movie.id,
          movieTitle: entry.movie.title,
          sessionId: entry.session.id,
          room: entry.session.room,
          durationMinutes: entry.durationMinutes,
          hasSales: entry.hasSales,
          from: { date: entry.session.date, time: entry.session.time },
          to: cinemaParts(start)
        });
      }
    });
  });

  changes.sort((a, b) => `${a.from.date}T${a.from.time}`.localeCompare(`${b.from.date}T${b.from.time}`));
  const plan = { changes, unresolved, turnaroundMinutes: margin, stepMinutes: step, includeSales: Boolean(includeSales) };
  return { ...plan, hash: planHash(plan) };
}

module.exports = { buildSessionAutocorrectPlan, planHash, ceilToStep, _test: { cinemaParts, overlaps, ceilToStep } };

