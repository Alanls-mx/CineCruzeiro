const MULTI_LAYOUTS = ['grid', 'editorial', 'summary', 'poster-footer', 'featured'];
const clean = value => String(value || '').trim();
function cinemaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
function validDay(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
function sessionSchedule(movie, input = {}, now = new Date()) {
  const today = cinemaDay(now);
  const from = validDay(input.periodStart) ? input.periodStart : today;
  const until = input.scheduleMode === 'today' ? from : new Date(Date.parse(`${from}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0,10);
  const groups = new Map();
  for (const session of movie?.sessions || []) {
    const date = clean(session.date).slice(0,10), time = clean(session.time).slice(0,5);
    if (!validDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || date < from || date > until || session.active === false || session.available === false || ['cancelled','canceled','expired','disabled','hidden','sold_out'].includes(session.status)) continue;
    const start = Date.parse(`${date}T${time}:00-03:00`);
    if (start < new Date(now).getTime()) continue;
    if (!groups.has(date)) groups.set(date, new Set());
    groups.get(date).add(time);
  }
  const days = [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,times])=>({date,times:[...times].sort()}));
  const maximum = input.compact ? (input.compactDays || 3) : 7;
  const lines = days.slice(0,maximum).map(day=>{
    const label = day.date === today ? 'Hoje' : new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${day.date}T12:00:00Z`)).replaceAll('.','');
    const limit = input.compact ? 3 : 5;
    return `${label}: ${day.times.slice(0,limit).join(' • ')}${day.times.length > limit ? ` (+${day.times.length-limit})` : ''}`;
  });
  if(days.length > maximum) lines.push(`+${days.length-maximum} dias no site`);
  return {from,until,days,text:lines.join('\n'),count:days.reduce((sum,day)=>sum+day.times.length,0)};
}
function applyContentRules(draft, input, context) {
  const now = context.now || new Date();
  const multi = draft.templateId === 'multi-movies';
  const scheduleCampaign = ['sessions-today','sessions-week'].includes(draft.templateId);
  const premiere = ['movie-premiere','movie-presale'].includes(draft.templateId);
  const online = draft.templateId === 'online-ticket';
  const allowed = (context.movies || []).filter(movie=>movie.catalogued !== false);
  const ids = Array.isArray(input.movieIds) ? [...new Set(input.movieIds.map(String))].slice(0,6) : [];
  const selected = ids.map(id=>allowed.find(movie=>String(movie.id)===id)).filter(Boolean);
  draft.movieIds = multi ? selected.map(movie=>movie.id) : [];
  draft.multiLayout = MULTI_LAYOUTS.includes(input.multiLayout) ? input.multiLayout : 'grid';
  draft.scheduleMode = draft.templateId === 'sessions-today' ? 'today' : draft.templateId === 'sessions-week' ? 'week' : input.scheduleMode === 'today' ? 'today' : 'week';
  draft.periodStart = validDay(input.periodStart) ? input.periodStart : '';
  draft.showSessions = scheduleCampaign || input.showSessions !== false;
  draft.animation = {enabled:input.animation?.enabled === true,format:['mp4','webm','gif'].includes(input.animation?.format)?input.animation.format:'mp4',duration:[5,8,10].includes(Number(input.animation?.duration))?Number(input.animation.duration):8,preset:['cinematic','commercial','soft'].includes(input.animation?.preset)?input.animation.preset:'cinematic',loop:input.animation?.loop!==false};
  draft.website = clean(context.brand?.posterWebsite || context.brand?.website).replace(/^https?:\/\//,'').replace(/\/$/,'');
  const schedule = sessionSchedule(draft.entities.movie, draft, now);
  draft.schedule = schedule;
  draft.programMovies = multi ? selected.map(movie=>({id:movie.id,title:movie.title,posterUrl:movie.posterUrl || '',schedule:sessionSchedule(movie,{...draft,compact:true,compactDays:selected.length>2?1:3},now)})) : [];
  if (scheduleCampaign) {
    if(input.title === undefined) draft.title = draft.entities.movie?.title || 'Programação';
    if(input.subtitle === undefined || /^(HOJE NO|SESSÕES EM)/.test(input.subtitle)) draft.subtitle = draft.scheduleMode === 'today' ? (schedule.from===cinemaDay(now)?`HOJE NO ${context.brand?.name || 'CINEMA'}`.toUpperCase():`SESSÕES EM ${schedule.from.slice(8,10)}/${schedule.from.slice(5,7)}`) : 'PROGRAMAÇÃO DA SEMANA';
    if(input.cta === undefined) draft.cta = 'ESCOLHA SUA SESSÃO';
  }
  if(multi) {
    if(input.title === undefined || /^(ESSA SEMANA NO|HOJE NO) /.test(input.title)) draft.title = `${draft.scheduleMode==='today'?'HOJE':'ESSA SEMANA'} NO ${context.brand?.name || 'CINEMA'}`.toUpperCase();
    if(input.subtitle === undefined) draft.subtitle = 'FILMES EM CARTAZ';
    if(input.cta === undefined) draft.cta = 'CONFIRA A PROGRAMAÇÃO';
  }
  if(premiere && input.subtitle === undefined && draft.templateId !== 'movie-presale') draft.subtitle = 'ESTREIA';
  if(online && input.cta === undefined) draft.cta = 'ESCOLHA SUA SESSÃO';
  const sessionPromise = scheduleCampaign || /sess[õo]es|programa[çc][ãa]o|hoje no/i.test(`${draft.subtitle} ${draft.auxiliaryText} ${draft.cta}`);
  if (!multi && (scheduleCampaign || sessionPromise && schedule.count)) draft.auxiliaryText = schedule.text || 'Sessões disponíveis no site';
  const mustShowWebsite = online || multi || scheduleCampaign || premiere || /site|online|programa[çc][ãa]o|sess[ãa]o|sess[õo]es|compr|garanta/i.test(draft.cta);
  draft.contentRules = {mustShowDate:premiere,mustShowSessions:scheduleCampaign || sessionPromise && schedule.count>0,mustShowWebsite,mustShowPrice:['movie-price','concession-combo','club-plan'].includes(draft.templateId),mustShowMultipleMovies:multi,mustKeepDateNearPremiere:premiere,mustKeepWebsiteNearCTA:mustShowWebsite};
  draft.contentNotices = [];
  if(multi && selected.length < 2) draft.contentNotices.push({type:'warning',code:'SELECT_MOVIES',message:'Selecione entre 2 e 6 filmes do catálogo para montar a programação.'});
  if(mustShowWebsite && !draft.website) draft.contentNotices.push({type:'warning',code:'WEBSITE_REQUIRED',message:'Configure o site oficial do cinema antes de exportar esta campanha.'});
  if(premiere && !draft.date) draft.contentNotices.push({type:'warning',code:'DATE_REQUIRED',message:'A estreia ainda não tem data. Informe uma data confirmada ou use Filme em destaque.'});
  if(scheduleCampaign && !schedule.count) draft.contentNotices.push({type:'warning',code:'NO_SESSIONS',message:'Não há sessões disponíveis no período selecionado. A arte indicará a consulta ao site.'});
  if(draft.templateId==='movie-presale' && !(draft.entities.movie?.sessions || []).length) {
    if(input.subtitle===undefined) draft.subtitle='PRÉ-VENDA EM BREVE';
    if(input.cta===undefined) draft.cta='ACOMPANHE AS NOVIDADES';
    draft.contentNotices.push({type:'warning',code:'PRESALE_UNCONFIRMED',message:'Não há sessões à venda para este filme. Confirme a abertura da pré-venda antes de publicar.'});
  }
  return draft;
}
function assertContentReady(draft) {
  const missing=(draft.contentNotices || []).find(notice=>['SELECT_MOVIES','WEBSITE_REQUIRED','DATE_REQUIRED'].includes(notice.code));
  if(missing) throw Object.assign(new Error(missing.message),{statusCode:400,code:missing.code});
}
module.exports = {applyContentRules,sessionSchedule,cinemaDay,MULTI_LAYOUTS,assertContentReady};
