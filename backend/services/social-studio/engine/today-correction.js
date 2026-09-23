const unavailable = new Set(['cancelled', 'canceled', 'expired', 'hidden', 'disabled', 'sold_out']);

function nextSession(draft, context) {
  const ids = draft.movieIds?.length ? draft.movieIds.map(String) : [String(draft.movieId || '')];
  const now = new Date(context.now || Date.now()).getTime();
  return (context.movies || [])
    .filter(movie => ids.includes(String(movie.id)) && movie.catalogued !== false)
    .flatMap(movie => movie.sessions || [])
    .filter(session => session.active !== false && session.available !== false && session.availableForPurchase !== false && !unavailable.has(session.status))
    .map(session => ({date: String(session.date || '').slice(0, 10), time: String(session.time || '').slice(0, 5)}))
    .filter(session => /^\d{4}-\d{2}-\d{2}$/.test(session.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(session.time) && Date.parse(`${session.date}T${session.time}:00-03:00`) > now)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] || null;
}

function todayCorrection(draft, context) {
  if (!draft.semanticValidation?.errors.some(error => error.code === 'TODAY_MISMATCH')) return null;
  const session = nextSession(draft, context);
  const label = session ? `${session.date.slice(8, 10)}/${session.date.slice(5, 7)}` : '';
  const patch = {};
  const current = {title: draft.title, subtitle: draft.subtitle, auxiliaryText: draft.auxiliaryText, cta: draft.cta, date: draft.date};
  const replacements = {
    title: session ? `PROGRAMAÇÃO EM ${label}` : draft.entities.movie?.title || 'FILME EM DESTAQUE',
    subtitle: session ? `SESSÕES EM ${label}` : 'EM DESTAQUE',
    auxiliaryText: session ? `Próxima sessão: ${label} às ${session.time}.` : 'Consulte a programação atualizada no site.',
    cta: session ? 'CONFIRA A PROGRAMAÇÃO' : 'CONHEÇA O FILME',
    date: session ? label : ''
  };
  for (const [field, value] of Object.entries(current)) {
    if (/\bhoje\b/i.test(String(value || ''))) patch[field] = replacements[field];
  }
  if (session) {
    patch.periodStart = session.date;
    patch.primaryDateKind = 'session';
    patch.sessionDate = session.date;
    patch.date = new Intl.DateTimeFormat('pt-BR', {day: 'numeric', month: 'long', timeZone: 'UTC'})
      .format(new Date(`${session.date}T12:00:00Z`)).toUpperCase();
  }
  if (!session && /^movie-/.test(draft.templateId) && /compre|garanta|reserve/i.test(draft.cta || '')) patch.cta = 'CONHEÇA O FILME';
  if (draft.templateId === 'sessions-today' && session) {
    patch.title = `PROGRAMAÇÃO EM ${label}`;
    patch.subtitle = `SESSÕES EM ${label}`;
  }
  if (['sessions-today', 'sessions-week'].includes(draft.templateId) && !session && draft.entities.movie) {
    patch.templateId = 'movie-highlight';
    patch.title = draft.entities.movie.title;
    patch.subtitle = 'EM DESTAQUE';
    patch.cta = 'CONHEÇA O FILME';
  }
  return {
    label: session ? `Usar sessão de ${label} às ${session.time}` : 'Usar chamada sem data',
    patch
  };
}

module.exports = {nextSession, todayCorrection};
