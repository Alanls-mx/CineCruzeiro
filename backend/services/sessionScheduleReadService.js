const { PRE_PREMIERE_WINDOW_MS } = require("./moviePublicationPolicy");

function todayIsoDate() {
  const { year, month, day } = datePartsInSaoPaulo();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sessionStartsAt(session = {}, fallbackDate = todayIsoDate()) {
  const date = String(session.date || fallbackDate || todayIsoDate()).slice(0, 10);
  const time = String(session.time || session.timeLabel || "00:00").trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sessionSellableUntil(session = {}, fallbackDate = todayIsoDate()) {
  const startsAt = sessionStartsAt(session, fallbackDate);
  return startsAt ? new Date(startsAt.getTime() + 10 * 60 * 1000) : null;
}

const PRE_PREMIERE_SALES_WINDOW_MS = PRE_PREMIERE_WINDOW_MS;

function sessionSalesOpenAt(session = {}, fallbackDate = todayIsoDate()) {
  const startsAt = sessionStartsAt(session, fallbackDate);
  return startsAt ? new Date(startsAt.getTime() - PRE_PREMIERE_SALES_WINDOW_MS) : null;
}

function normalizedSessionStatus(session = {}) {
  return String(session?.status || "available").trim().toLowerCase();
}

function isSessionSellable(session = {}, fallbackDate = todayIsoDate(), now = new Date()) {
  if (!session || ["sold_out", "cancelled", "hidden", "archived"].includes(normalizedSessionStatus(session))) return false;
  const salesOpenAt = sessionSalesOpenAt(session, fallbackDate);
  if (salesOpenAt && salesOpenAt.getTime() > now.getTime()) return false;
  const sellableUntil = sessionSellableUntil(session, fallbackDate);
  return sellableUntil ? sellableUntil.getTime() > now.getTime() : true;
}

function sellableSessions(movie = {}, now = new Date()) {
  return (movie.sessions || [])
    .filter((session) => isSessionSellable(session, session.date || todayIsoDate(), now))
    .sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
}

function datePartsInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function saoPauloDateFromOffset(offsetDays = 0) {
  const { year, month, day } = datePartsInSaoPaulo();
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0));
}

function buildCalendarDays(count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const date = saoPauloDateFromOffset(index);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long"
    }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short"
    }).format(date).replace(".", "");
    const dayMonth = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit"
    }).format(date);
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    return {
      isoDate,
      label: index === 0 ? "Hoje" : index === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate: dayMonth
    };
  });
}

function buildCalendarDaysForMovies(movies = [], minimumDays = 7) {
  const baseDays = buildCalendarDays(minimumDays);
  const dates = new Set(baseDays.map((day) => day.isoDate));
  (movies || []).forEach((movie) => {
    (movie.sessions || []).forEach((session) => {
      const date = String(session.date || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayIsoDate()) dates.add(date);
    });
  });
  const today = new Date(`${todayIsoDate()}T12:00:00-03:00`).getTime();
  return [...dates].sort().slice(0, 31).map((isoDate) => {
    const date = new Date(`${isoDate}T12:00:00-03:00`);
    const difference = Math.round((date.getTime() - today) / 86400000);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date).replace(".", "");
    const displayDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);
    return {
      isoDate,
      label: difference === 0 ? "Hoje" : difference === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate
    };
  });
}

module.exports = { todayIsoDate, sessionStartsAt, sessionSellableUntil, sessionSalesOpenAt, normalizedSessionStatus, isSessionSellable, sellableSessions, datePartsInSaoPaulo, saoPauloDateFromOffset, buildCalendarDays, buildCalendarDaysForMovies };
