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
  const structuredDate={release:releaseDate,presale:presaleStartDate,session:sessionDate}[primaryDateKind];
  const primaryDate = input.dateTextMode==='automatic' ? structuredDate : input.date !== undefined ? clean(input.date) : (structuredDate || draft.date);
  const priceEntity = ['concession-combo','concession-offer'].includes(type) ? draft.entities.concession?.price : type === 'club-plan' ? draft.entities.clubPlan?.monthlyPrice : movie.minimumPrice ?? movie.minPrice ?? Math.min(...upcoming.flatMap(s => [s.price, s.fullPrice, ...(s.ticketTypes || []).map(t=>t.price)]).filter(v=>v!==null && v!==undefined && Number.isFinite(Number(v))).map(Number));
  const hasPrice = priceEntity !== null && priceEntity !== undefined && Number.isFinite(Number(priceEntity)) && Number(priceEntity) >= 0;
  const actionDestination = destination(input.actionDestination === undefined ? context.brand?.posterWebsite || context.brand?.website : input.actionDestination);
  const content = {
    version:1, campaignType:type, copyBrief:draft.copyBrief || '', offerTerms:draft.offerTerms || '', offerHeadline:draft.offerHeadline || '', offerBadge:draft.offerBadge || '', oldPrice:draft.oldPrice,
    ticketCampaignMode:draft.ticketCampaignMode,campaignRecurrence:draft.campaignRecurrence,campaignDays:draft.campaignDays,campaignAudience:draft.campaignAudience,
    movie:{id:movie.id || '',title:movie.title || '',genres:movie.genres || [],synopsis:movie.synopsis || '',socialHook:movie.socialHook || '',director:movie.director || '',originalTitle:movie.originalTitle || '',duration:movie.duration || '',rating:movie.rating || '',tag:movie.tag || ''},
    headline:draft.title, kicker:draft.subtitle, supportingText:draft.auxiliaryText,
    releaseDate,presaleStartDate,sessionDate,primaryDateKind,primaryDate,releaseScope:movie.catalogued===false?'international':'cinema',primaryDateLabel:primaryDateKind==='release' && movie.catalogued===false?'LANÇAMENTO INTERNACIONAL':DATE_ROLES[primaryDateKind],
    sessions:draft.programMovies.length ? draft.programMovies.flatMap(m=>m.schedule.days.flatMap(group=>group.times.map(time=>({movieId:m.id,date:group.date,time})))) : draft.schedule.days.flatMap(group=>group.times.map(time=>({movieId:movie.id,date:group.date,time}))),
    availableSessions:upcoming.map(s=>({movieId:movie.id,date:s.date,time:s.time})),
    purchaseAvailable:movie.catalogued !== false && (upcoming.length>0 || type==='ticket-offer' && !movie.id && (context.movies || []).some(item=>item.catalogued!==false && require('./price').ticketOptions(item,now).length>0)),
    price:draft.priceInfo ? {value:draft.priceInfo.value,formatted:draft.price,label:draft.priceInfo.label,mode:draft.priceSelection.mode,ticketType:draft.priceInfo.ticketType,from:draft.priceInfo.from,valid:draft.priceInfo.valid} : {value:hasPrice?Number(priceEntity):undefined,formatted:draft.price},
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
  if(['movie-price','ticket-offer'].includes(type) && content.price.valid===false) add('TICKET_TYPE_REQUIRED','priceSelection','Selecione um tipo de ingresso e uma sessão válida ou o menor preço disponível.');
  if(type==='ticket-offer' && ['manual','campaign'].includes(content.price.mode) && (!content.offerHeadline || !content.offerTerms)) add('OFFER_PRICE_CONTEXT','priceSelection','Para anunciar valor manual ou de campanha, informe o nome e as condições confirmadas da oferta.');
  if(type==='ticket-offer') {
    const campaign=require('./ticket-campaign');
    const parsed=campaign.normalizeDays(content.campaignDays);
    if(parsed.invalid) add('CAMPAIGN_DAYS','campaignDays','Informe apenas dias da semana válidos, separados por vírgula.');
    if(content.campaignRecurrence==='weekly' && (!parsed.days.length || content.ticketCampaignMode!=='promotional' || !content.offerTerms)) add('CAMPAIGN_RECURRENCE','campaignDays','Para anunciar recorrência semanal, confirme os dias, o modo promocional e as condições.');
    if(content.campaignAudience==='all' && (content.ticketCampaignMode!=='promotional' || !content.offerTerms)) add('CAMPAIGN_AUDIENCE','campaignAudience','Para anunciar promoção para todos, confirme o modo promocional e as condições.');
  }
  if(type==='ticket-offer' && content.oldPrice!==undefined && (!Number.isFinite(content.oldPrice) || content.oldPrice<=content.price.value || !content.offerTerms)) add('OFFER_OLD_PRICE','oldPrice','O preço anterior deve ser maior que o atual e ter condições confirmadas.');
  const text = `${content.headline} ${content.kicker} ${content.supportingText} ${content.offerHeadline || ''}`;
  if(content.releaseScope==='international' && /estreia confirmada|estreia no|sess[ãa]o confirmada|compre|garanta|reserve/i.test(`${text} ${content.action.label}`)) add('EDITORIAL_UNCONFIRMED','subtitle','Este lançamento não tem exibição confirmada no cinema. Use uma chamada editorial, sem promessa de estreia local ou compra.');
  if (['sessions-today','sessions-week'].includes(type) && !content.sessions.length) add('NO_SESSIONS','periodStart','Não há sessões disponíveis no período. Escolha outro período ou filme.');
  if (/\bhoje\b/i.test(text) && !content.sessions.some(s=>s.date===content.today) && !content.availableSessions.some(s=>s.date===content.today) && !content.programMovies.some(m=>m.schedule.days.some(d=>d.date===content.today))) add('TODAY_MISMATCH','subtitle','A chamada diz hoje, mas não há sessões para hoje. Ajuste a chamada ou a programação.');
  if (type === 'multi-movies' && !content.programMovies.length) add('SELECT_MOVIES','movieIds','Selecione entre 1 e 12 filmes.');
  if (type === 'movie-presale' && !content.presaleStartDate && !content.purchaseAvailable) add('PRESALE_UNCONFIRMED','presaleStartDate','Informe a data de abertura da pré-venda ou cadastre sessões disponíveis para compra.');
  if (type === 'movie-presale' && /aberta|garanta|compr/i.test(`${content.kicker} ${content.action.label}`) && (!content.purchaseAvailable || content.presaleStartDate > content.today)) add('PRESALE_NOT_OPEN','subtitle','A pré-venda ainda não está disponível. Use uma chamada de abertura futura.');
  if (['movie-premiere','movie-presale'].includes(type) && !content.primaryDate) add('DATE_REQUIRED','date','Informe a data confirmada e sua finalidade.');
  if (content.primaryDate && !DATE_ROLES[content.primaryDateKind]) add('DATE_MEANING','primaryDateKind','Defina se a data representa estreia, pré-venda ou sessão.');
  if (content.action.destinationType !== 'none' && content.action.label && !content.action.destination) add('ACTION_DESTINATION_REQUIRED','actionDestination','Informe um endereço válido para a chamada da campanha.');
  if (['movie-price','ticket-offer','concession-combo','concession-offer','club-plan'].includes(type) && (content.price.value === undefined || !/\d/.test(content.price.formatted))) add('PRICE_REQUIRED','price','Não há preço real cadastrado para esta oferta. Cadastre o valor antes de anunciá-lo.');
  if(type==='concession-offer' && !(content.price.value>0)) add('PRODUCT_PRICE_REQUIRED','concessionId','Selecione um produto ativo com preço cadastrado.');
  if(type==='ticket-offer' && !content.purchaseAvailable) add('TICKET_SALE_UNAVAILABLE','movieId','Selecione um filme com sessões e ingressos disponíveis para compra.');
  if (/compre agora|garanta seu ingresso|reserve seu lugar/i.test(content.action.label) && /^movie-/.test(type) && !content.purchaseAvailable) add('PURCHASE_UNAVAILABLE','cta','A compra ainda não está disponível. Use uma chamada para acompanhar as novidades.');
  return {valid:errors.length===0,errors};
}
function assertCampaignContent(content) {
  const validation=validateCampaignContent(content);
  if (!validation.valid) throw Object.assign(new Error(validation.errors.map(e=>e.message).join(' ')),{statusCode:400,code:validation.errors[0].code,validation});
  return validation;
}
module.exports={buildCampaignContent,validateCampaignContent,assertCampaignContent,DATE_ROLES};
