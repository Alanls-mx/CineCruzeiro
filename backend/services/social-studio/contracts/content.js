const {cinemaDay} = require('../engine/content-rules');
const clean = value => String(value ?? '').trim().slice(0, 1800);
const DATE_ROLES = {release:'ESTREIA', presale:'PRÉ-VENDA A PARTIR DE', session:'SESSÃO'};
function day(value) {
  const text = clean(value).slice(0, 10);
  const parsed=new Date(`${text}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===text ? text : '';
}
function destination(value) {
  const text = clean(value);
  if (!text || /\s|^(?!https?:)[a-z]+:/i.test(text)) return '';
  try { const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); return url.hostname.includes('.') ? url.href : ''; } catch { return ''; }
}
function buildCampaignContent(draft, input = {}, context = {}) {
  const movie = draft.entities.movie || {};
  const type = draft.templateId;
  const now = context.now || new Date();
  const upcoming = (movie.sessions || []).filter(s => s.active !== false && s.available !== false && s.availableForPurchase !== false && !['cancelled','canceled','hidden','expired','sold_out','disabled'].includes(s.status) && Date.parse(`${String(s.date).slice(0,10)}T${String(s.time).slice(0,5)}:00-03:00`) >= new Date(now).getTime()).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const primaryDateKind = Object.hasOwn(DATE_ROLES, input.primaryDateKind) ? input.primaryDateKind : type === 'movie-presale' && input.presaleStartDate ? 'presale' : type === 'movie-premiere' || type === 'movie-presale' ? 'release' : 'session';
  const releaseDate = day(input.releaseDate || movie.releaseDate);
  const presaleStartDate = day(input.presaleStartDate || movie.presaleStartDate);
  const sessionDate = day(input.sessionDate || upcoming[0]?.date);
  const primaryDate = input.date !== undefined ? clean(input.date) : ({release:releaseDate,presale:presaleStartDate,session:sessionDate}[primaryDateKind] || draft.date);
  const priceEntity = type === 'concession-combo' ? draft.entities.concession?.price : type === 'club-plan' ? draft.entities.clubPlan?.monthlyPrice : movie.minimumPrice ?? movie.minPrice ?? Math.min(...upcoming.flatMap(s => [s.price, s.fullPrice, ...(s.ticketTypes || []).map(t=>t.price)]).filter(v=>v!==null && v!==undefined && Number.isFinite(Number(v))).map(Number));
  const hasPrice = priceEntity !== null && priceEntity !== undefined && Number.isFinite(Number(priceEntity)) && Number(priceEntity) >= 0;
  const actionDestination = destination(input.actionDestination === undefined ? context.brand?.posterWebsite || context.brand?.website : input.actionDestination);
  const content = {
    version:1, campaignType:type,
    movie:{id:movie.id || '',title:movie.title || '',genres:movie.genres || [],synopsis:movie.synopsis || '',socialHook:movie.socialHook || ''},
    headline:draft.title, kicker:draft.subtitle, supportingText:draft.auxiliaryText,
    releaseDate,presaleStartDate,sessionDate,primaryDateKind,primaryDate,primaryDateLabel:DATE_ROLES[primaryDateKind],
    sessions:draft.programMovies.length ? draft.programMovies.flatMap(m=>m.schedule.days.flatMap(group=>group.times.map(time=>({movieId:m.id,date:group.date,time})))) : draft.schedule.days.flatMap(group=>group.times.map(time=>({movieId:movie.id,date:group.date,time}))),
    availableSessions:upcoming.map(s=>({movieId:movie.id,date:s.date,time:s.time})),
    purchaseAvailable:movie.catalogued !== false && upcoming.length>0,
    price:{value:hasPrice?Number(priceEntity):undefined,formatted:draft.price},
    action:{label:draft.cta,destinationType:input.actionDestinationType || (type==='club-plan'?'club':type==='online-ticket'?'purchase':'website'),destination:actionDestination},
    brandWebsite:destination(context.brand?.website), programMovies:draft.programMovies,
    today:cinemaDay(now),period:{from:draft.schedule.from,until:draft.schedule.until},
  };
  return content;
}
function validateCampaignContent(content) {
  const errors = [];
  const add = (code,field,message) => errors.push({code,field,message,type:'error'});
  const type = content.campaignType;
  const text = `${content.headline} ${content.kicker} ${content.supportingText}`;
  if (['sessions-today','sessions-week'].includes(type) && !content.sessions.length) add('NO_SESSIONS','periodStart','Não há sessões disponíveis no período. Escolha outro período ou filme.');
  if (/\bhoje\b/i.test(text) && !content.sessions.some(s=>s.date===content.today) && !content.programMovies.some(m=>m.schedule.days.some(d=>d.date===content.today))) add('TODAY_MISMATCH','subtitle','A chamada diz hoje, mas não há sessões para hoje. Ajuste a chamada ou a programação.');
  if (type === 'multi-movies' && content.programMovies.length<2) add('SELECT_MOVIES','movieIds','Selecione entre 2 e 6 filmes.');
  if (type === 'movie-presale' && !content.presaleStartDate && !content.purchaseAvailable) add('PRESALE_UNCONFIRMED','presaleStartDate','Informe a data de abertura da pré-venda ou cadastre sessões disponíveis para compra.');
  if (type === 'movie-presale' && /aberta|garanta|compr/i.test(`${content.kicker} ${content.action.label}`) && (!content.purchaseAvailable || content.presaleStartDate > content.today)) add('PRESALE_NOT_OPEN','subtitle','A pré-venda ainda não está disponível. Use uma chamada de abertura futura.');
  if (['movie-premiere','movie-presale'].includes(type) && !content.primaryDate) add('DATE_REQUIRED','date','Informe a data confirmada e sua finalidade.');
  if (content.primaryDate && !DATE_ROLES[content.primaryDateKind]) add('DATE_MEANING','primaryDateKind','Defina se a data representa estreia, pré-venda ou sessão.');
  if (content.action.destinationType !== 'none' && content.action.label && !content.action.destination) add('ACTION_DESTINATION_REQUIRED','actionDestination','Informe um endereço válido para a chamada da campanha.');
  if (['movie-price','concession-combo','club-plan'].includes(type) && (content.price.value === undefined || !/\d/.test(content.price.formatted))) add('PRICE_REQUIRED','price','Não há preço real cadastrado para esta oferta. Cadastre o valor antes de anunciá-lo.');
  if (/compre agora|garanta seu ingresso|reserve seu lugar/i.test(content.action.label) && /^movie-/.test(type) && !content.purchaseAvailable) add('PURCHASE_UNAVAILABLE','cta','A compra ainda não está disponível. Use uma chamada para acompanhar as novidades.');
  return {valid:errors.length===0,errors};
}
function assertCampaignContent(content) {
  const validation=validateCampaignContent(content);
  if (!validation.valid) throw Object.assign(new Error(validation.errors.map(e=>e.message).join(' ')),{statusCode:400,code:validation.errors[0].code,validation});
  return validation;
}
module.exports={buildCampaignContent,validateCampaignContent,assertCampaignContent,DATE_ROLES};
