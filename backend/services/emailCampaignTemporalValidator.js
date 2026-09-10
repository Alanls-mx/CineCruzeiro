const TIME_ZONE = "America/Sao_Paulo";

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dateKey(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(key, days) {
  const [year, month, day] = String(key || "").split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function weekWindow(reference) {
  const key = dateKey(reference);
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = shiftDateKey(key, mondayOffset);
  return { start, end: shiftDateKey(start, 6) };
}

function between(key, start, end) {
  return Boolean(key && start && end && key >= start && key <= end);
}

function movieDates(movie, kind = "any") {
  const release = dateKey(movie?.releaseDate);
  const sessions = (movie?.sessions || []).map((session) => dateKey(session?.date)).filter(Boolean);
  if (kind === "release") return release ? [release] : [];
  return [...new Set([release, ...sessions].filter(Boolean))];
}

function temporalError(message, details = {}) {
  const error = new Error(message);
  error.code = "EMAIL_CAMPAIGN_TEMPORAL_CLAIM_INVALID";
  error.statusCode = 422;
  error.details = details;
  return error;
}

function campaignText(request = {}) {
  return normalizedText([
    request.brief,
    request.aiBrief,
    request.subject,
    request.preheader,
    request.headline,
    request.message
  ].filter(Boolean).join("\n"));
}

function assertMoviesMatch(movies, predicate, message, details) {
  const invalid = movies.filter((movie) => !predicate(movie));
  if (!invalid.length) return;
  throw temporalError(message(invalid), {
    ...details,
    movieIds: invalid.map((movie) => movie.id).filter(Boolean),
    movieTitles: invalid.map((movie) => movie.title || "Filme")
  });
}

function validateCampaignTemporalClaims(request = {}, context = {}, options = {}) {
  const text = campaignText(request);
  const movies = (context.movies?.length ? context.movies : context.movie ? [context.movie] : []).filter(Boolean);
  if (!text || !movies.length) return { checked: false, claims: [], warnings: [] };

  const reference = request.scheduleAt || options.now || new Date();
  const referenceKey = dateKey(reference);
  const week = weekWindow(reference);
  const tomorrowKey = shiftDateKey(referenceKey, 1);
  const scenario = String(request.scenario || request.aiScenario || context.scenario || "");
  const claims = [];
  const weeklyClaim = /\b(?:esta|essa|nesta|nessa)\s+semana\b/.test(text);
  const weekendClaim = /\b(?:(?:este|esse|neste|nesse)\s+)?fim\s+de\s+semana\b/.test(text);
  const todayClaim = /\bhoje\b/.test(text);
  const tomorrowClaim = /\bamanha\b/.test(text);
  const upcomingSelected = movies.some((movie) => ["upcoming", "coming_soon", "em_breve"].includes(String(movie.status || "").toLowerCase()));
  const premiereClaim = /\b(?:estreia|lancamento|chega|vai\s+estrear)\b/.test(text) || scenario === "premiere" || (weeklyClaim && movies.length === 1 && upcomingSelected);
  const nowPlayingClaim = /\bem\s+cartaz\b/.test(text);
  const lastChanceClaim = /\b(?:ultimos?\s+dias|ultimas?\s+sessoes|ultima\s+chance)\b/.test(text);

  if (weeklyClaim) {
    claims.push("semana");
    const kind = premiereClaim ? "release" : "any";
    assertMoviesMatch(
      movies,
      (movie) => movieDates(movie, kind).some((key) => between(key, week.start, week.end)),
      (invalid) => premiereClaim
        ? `${invalid.map((movie) => movie.title || "O filme").join(", ")} não estreia na semana da campanha. Ajuste a data ou retire essa afirmação.`
        : `${invalid.map((movie) => movie.title || "O filme").join(", ")} não possui lançamento ou sessão na semana da campanha.`,
      { claim: "week", start: week.start, end: week.end, kind }
    );
  }

  if (weekendClaim) {
    claims.push("fim_de_semana");
    const saturday = shiftDateKey(week.start, 5);
    const sunday = shiftDateKey(week.start, 6);
    assertMoviesMatch(
      movies,
      (movie) => movieDates(movie).some((key) => between(key, saturday, sunday)),
      (invalid) => `${invalid.map((movie) => movie.title || "O filme").join(", ")} não possui lançamento ou sessão no fim de semana anunciado.`,
      { claim: "weekend", start: saturday, end: sunday }
    );
  }

  for (const [enabled, claim, key, label] of [
    [todayClaim, "today", referenceKey, "hoje"],
    [tomorrowClaim, "tomorrow", tomorrowKey, "amanhã"]
  ]) {
    if (!enabled) continue;
    claims.push(claim);
    assertMoviesMatch(
      movies,
      (movie) => movieDates(movie).includes(key),
      (invalid) => `${invalid.map((movie) => movie.title || "O filme").join(", ")} não possui lançamento ou sessão ${label}.`,
      { claim, date: key }
    );
  }

  if (nowPlayingClaim) {
    claims.push("em_cartaz");
    assertMoviesMatch(
      movies,
      (movie) => !["upcoming", "coming_soon", "em_breve", "hidden"].includes(String(movie.status || "").toLowerCase()) &&
        (movie.sessions || []).some((session) => dateKey(session?.date) >= referenceKey),
      (invalid) => `${invalid.map((movie) => movie.title || "O filme").join(", ")} não pode ser anunciado como em cartaz sem uma sessão atual ou futura.`,
      { claim: "now_playing", date: referenceKey }
    );
  }

  if (lastChanceClaim) {
    claims.push("ultimos_dias");
    assertMoviesMatch(
      movies,
      (movie) => movie.lastChance === true || movie.last_chance === true || ["last_chance", "last-days", "last_days", "ultimos_dias", "ending_soon"].includes(String(movie.status || movie.programmingStatus || "").toLowerCase()),
      (invalid) => `${invalid.map((movie) => movie.title || "O filme").join(", ")} não está marcado no catálogo como últimas sessões.`,
      { claim: "last_chance" }
    );
  }

  return { checked: true, claims, referenceDate: referenceKey, week, warnings: [] };
}

module.exports = {
  validateCampaignTemporalClaims,
  _test: { campaignText, dateKey, movieDates, normalizedText, shiftDateKey, weekWindow }
};
