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
    if (!validDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || date < from || date > until || session.active === false || session.available === false || session.availableForPurchase === false || ['cancelled','canceled','expired','disabled','hidden','sold_out'].includes(session.status)) continue;
    const start = Date.parse(`${date}T${time}:00-03:00`);
    if (start < new Date(now).getTime()) continue;
    if (!groups.has(date)) groups.set(date, new Set());
    groups.get(date).add(time);
  }
  const days = [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,times])=>({date,times:[...times].sort()}));
  const maximum = input.compact ? (input.compactDays || 3) : 7;
  const lines = days.slice(0,maximum).map(day=>{
    const limit = input.compact ? 3 : 5;
    return require('../contracts/artwork-layout').scheduleLabel(day,limit);
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
  const ids = Array.isArray(input.movieIds) ? [...new Set(input.movieIds.map(String))].slice(0,12) : [];
  const selected = ids.map(id=>allowed.find(movie=>String(movie.id)===id)).filter(Boolean);
  const program=multi || scheduleCampaign;
  if(scheduleCampaign && !selected.length && draft.entities.movie) selected.push(draft.entities.movie);
  draft.movieIds = program ? selected.map(movie=>movie.id) : [];
  draft.programLayout=clean(input.programLayout) || (input.multiLayout ? '' : 'automatic');
  draft.programSpacing=Math.max(-.006,Math.min(.009,Number(input.programSpacing)||0));
  draft.programColumns=[1,2,3].includes(Number(input.programColumns))?Number(input.programColumns):0;
  draft.programGap=Math.max(12,Math.min(36,Number(input.programGap)||24));
  draft.programDays=[1,2,3,7].includes(Number(input.programDays))?Number(input.programDays):1;
  draft.programStyle=['editorial','cinematic','posters'].includes(input.programStyle)?input.programStyle:'posters';
  draft.programPosterMode=['none','equal','featured'].includes(input.programPosterMode)?input.programPosterMode:'equal';
  draft.featuredMovieId=selected.some(m=>m.id===input.featuredMovieId)?input.featuredMovieId:'';
  if(program && selected.length) {
    const {selectFeaturedMovie,analyzeProgramMood}=require('../programming/direction');
    draft.entities.movie=selectFeaturedMovie(selected,{featuredMovieId:draft.featuredMovieId,now});
    draft.movieId=draft.entities.movie.id;
    draft.programMood=analyzeProgramMood(selected);
    draft.resolvedFeaturedMovieId=draft.entities.movie.id;
  }
  draft.multiLayout = MULTI_LAYOUTS.includes(input.multiLayout) ? input.multiLayout : 'grid';
  draft.scheduleMode = draft.templateId === 'sessions-today' ? 'today' : draft.templateId === 'sessions-week' ? 'week' : input.scheduleMode === 'today' ? 'today' : 'week';
  draft.periodStart = validDay(input.periodStart) ? input.periodStart : '';
  if (program && !draft.periodStart) {
    const next = require('./today-correction').nextSession(draft, context);
    const currentWeekEnd = new Date(Date.parse(`${cinemaDay(now)}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0,10);
    if (next && (draft.templateId === 'sessions-today' && next.date !== cinemaDay(now) || draft.templateId !== 'sessions-today' && next.date > currentWeekEnd)) draft.periodStart = next.date;
  }
  draft.showSessions = scheduleCampaign || input.showSessions !== false;
  draft.animation = require('../remotion/spec').normalizeAnimation(input.animation);
  draft.website = clean(context.brand?.posterWebsite || context.brand?.website).replace(/^https?:\/\//,'').replace(/\/$/,'');
  const schedule = sessionSchedule(draft.entities.movie, draft, now);
  if(draft.templateId==='movie-highlight' && input.subtitle===undefined) draft.subtitle = 'EM DESTAQUE';
  draft.schedule = schedule;
  draft.programMovies = program ? selected.map(movie=>({id:movie.id,title:movie.title,posterUrl:movie.posterUrl || '',backdropUrl:movie.backdropUrl || '',genre:movie.genre,genres:movie.genres || [],featured:movie.id===draft.featuredMovieId,schedule:sessionSchedule(movie,{...draft,compact:false},now)})) : [];
  if (scheduleCampaign) {
    if(input.title === undefined) draft.title = selected.length>1 ? 'Programação' : draft.entities.movie?.title || 'Programação';
    if(input.subtitle === undefined) draft.subtitle = draft.scheduleMode === 'today' ? `SESSÕES EM ${schedule.from.slice(8,10)}/${schedule.from.slice(5,7)}` : `SEMANA DE ${schedule.from.slice(8,10)}/${schedule.from.slice(5,7)}`;
    if(input.cta === undefined) draft.cta = 'ESCOLHA SUA SESSÃO';
  }
  if(multi) {
    if(input.title === undefined) draft.title = `PROGRAMAÇÃO EM ${schedule.from.slice(8,10)}/${schedule.from.slice(5,7)}`;
    if(input.subtitle === undefined) draft.subtitle = 'FILMES EM CARTAZ';
    if(input.cta === undefined) draft.cta = 'CONFIRA A PROGRAMAÇÃO';
  }
  if(program) {
    const {programData,programTitle}=require('../programming/schedule');
    const model=programData(draft.programMovies);
    draft.programMovies=model.movies;
    draft.title=programTitle(model,cinemaDay(now),context.brand?.name || 'CINEMA',draft.templateId);
    draft.subtitle='';
    // All session facts stay in the model; layout is never allowed to truncate them.
    draft.showSessions=true;
  }
  if(premiere && input.subtitle === undefined && draft.templateId !== 'movie-presale') draft.subtitle = draft.entities.movie?.catalogued===false?'NO RADAR DO CINEMA':'ESTREIA';
  if(draft.entities.movie?.catalogued===false && /^movie-/.test(draft.templateId)) {
    if(input.cta===undefined) draft.cta='CONHEÇA A HISTÓRIA';
    if(input.auxiliaryText===undefined) draft.auxiliaryText=draft.entities.movie.socialHook || 'Exibição no cinema ainda não confirmada.';
  }
  if(online && input.cta === undefined) draft.cta = 'ESCOLHA SUA SESSÃO';
  const sessionPromise = scheduleCampaign || /sess[õo]es|programa[çc][ãa]o|hoje no/i.test(`${draft.subtitle} ${draft.auxiliaryText} ${draft.cta}`);
  if (!multi && (scheduleCampaign || /^movie-/.test(draft.templateId) && sessionPromise && schedule.count)) draft.auxiliaryText = schedule.text || 'Sessões disponíveis no site';
  const mustShowWebsite = online || multi || scheduleCampaign || premiere || /site|online|programa[çc][ãa]o|sess[ãa]o|sess[õo]es|compr|garanta/i.test(draft.cta);
  draft.contentRules = {mustShowDate:premiere,mustShowSessions:scheduleCampaign || /^movie-/.test(draft.templateId) && sessionPromise && schedule.count>0,mustShowWebsite,mustShowPrice:['movie-price','ticket-offer','concession-combo','concession-offer','club-plan'].includes(draft.templateId),mustShowMultipleMovies:multi,mustKeepDateNearPremiere:premiere,mustKeepWebsiteNearCTA:mustShowWebsite};
  draft.contentNotices = [];
  if(program && Array.isArray(input.movieIds) && new Set(input.movieIds).size>12)draft.contentNotices.push({type:'warning',code:'PROGRAM_SELECTION_LIMIT',message:'Selecione no máximo 12 filmes por arte. Divida a programação em mais de uma peça.'});
  if(program && draft.programMovies.some(movie=>!movie.schedule.count))draft.contentNotices.push({type:'warning',code:'PROGRAM_EMPTY_MOVIE',message:`Sem sessões no período: ${draft.programMovies.filter(movie=>!movie.schedule.count).map(movie=>movie.title).join(', ')}. Ajuste o período ou remova esses filmes.`});
  if(multi && !selected.length) draft.contentNotices.push({type:'warning',code:'SELECT_MOVIES',message:'Selecione entre 1 e 12 filmes do catálogo para montar a programação.'});
  if(mustShowWebsite && !draft.website) draft.contentNotices.push({type:'warning',code:'WEBSITE_REQUIRED',message:'Configure o site oficial do cinema antes de exportar esta campanha.'});
  if(premiere && !draft.date) draft.contentNotices.push({type:'warning',code:'DATE_REQUIRED',message:'A estreia ainda não tem data. Informe uma data confirmada ou use Filme em destaque.'});
  if(scheduleCampaign && !draft.programMovies.some(movie=>movie.schedule.count)) draft.contentNotices.push({type:'warning',code:'NO_SESSIONS',message:'Não há sessões disponíveis no período selecionado. Ajuste a programação antes de exportar.'});
  if(draft.templateId==='movie-presale' && !(draft.entities.movie?.sessions || []).length) {
    if(input.subtitle===undefined) draft.subtitle='PRÉ-VENDA EM BREVE';
    if(input.cta===undefined) draft.cta='ACOMPANHE AS NOVIDADES';
    draft.contentNotices.push({type:'warning',code:'PRESALE_UNCONFIRMED',message:'Não há sessões à venda para este filme. Confirme a abertura da pré-venda antes de publicar.'});
  }
  return draft;
}
function assertContentReady(draft) {
  const missing=(draft.contentNotices || []).find(notice=>['SELECT_MOVIES','WEBSITE_REQUIRED','DATE_REQUIRED','PROGRAM_SELECTION_LIMIT'].includes(notice.code));
  if(missing) throw Object.assign(new Error(missing.message),{statusCode:400,code:missing.code});
  if(draft.content) require('../contracts/content').assertCampaignContent(draft.content);
  const empty=draft.contentNotices?.find(n=>n.code==='PROGRAM_EMPTY_MOVIE');
  if(empty)throw Object.assign(new Error(empty.message),{statusCode:422,code:empty.code});
}
module.exports = {applyContentRules,sessionSchedule,cinemaDay,MULTI_LAYOUTS,assertContentReady,validDay};
