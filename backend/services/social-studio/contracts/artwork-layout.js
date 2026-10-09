const MOVIE_FAMILIES=Object.freeze({
  'poster-lateral':'Pôster lateral',
  'poster-editorial':'Pôster e rodapé editorial',
  'cinematic-blend':'Pôster + atmosfera',
  'cinematic-story':'Poster hero',
  'movie-full-bleed':'Full bleed cinematográfico',
  'movie-character':'Foco no personagem',
  'movie-asymmetric':'Editorial assimétrico',
  'movie-immersive':'Fundo imersivo',
  'movie-spotlight':'Estreia em destaque',
  'movie-editorial-light':'Editorial integrado',
  'movie-campaign':'Campanha integrada'
});
const PRODUCT_LAYOUTS=Object.freeze({
  'product-price':'Produto + preço',
  'product-lateral':'Produto lateral',
  'hero-product':'Produto em destaque',
  'product-cinema-blue':'Cinema azul',
  'product-gold':'Verde e dourado',
  'product-neon':'Neon',
  'product-sunset':'Pôr do sol',
  'product-stage':'Palco de cinema',
  'product-retro':'Retrô editorial',
  'product-pop':'Pop art'
});
const SAFE={square:{left:.055,right:.945,top:.045,bottom:.95},feed_portrait:{left:.055,right:.945,top:.045,bottom:.95},story:{left:.065,right:.935,top:.085,bottom:.89}};
const isMovie=draft=>/^movie-/.test(draft?.templateId || '');
const isProgramme=draft=>['sessions-today','sessions-week','multi-movies'].includes(draft?.templateId);
function movieFamily(input,formatId) {
  const selected=input.layoutId || input.style;
  if(MOVIE_FAMILIES[selected])return selected;
  if(selected && selected!=='automatic' && input.automaticStyle!==true)return '';
  return formatId==='story'?'cinematic-story':formatId==='square'?'poster-lateral':'poster-editorial';
}
function campaignCTA(draft) {
  if(isProgramme(draft))return draft.templateId==='sessions-today'?'ESCOLHA SUA SESSÃO':'CONFIRA A PROGRAMAÇÃO';
  if(!isMovie(draft))return draft.cta;
  const content=draft.content;
  const available=content?.purchaseAvailable && !(draft.templateId==='movie-presale' && content.presaleStartDate>content.today);
  return !available?'CONHEÇA O FILME':['movie-price','movie-presale'].includes(draft.templateId)?'COMPRE SEU INGRESSO':'ESCOLHA SUA SESSÃO';
}
function timeLabel(value) {return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))?String(value):'';}
function dayLabel(value) {
  if(!require('../engine/content-rules').validDay(value))return '';
  const weekday=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short'}).format(new Date(`${value}T12:00:00Z`)).replace('.','').toUpperCase();
  return `${weekday} • ${value.slice(8,10)}/${value.slice(5,7)}`;
}
function scheduleLabel(day,limit=5) {return `${dayLabel(day.date)} • ${day.times.slice(0,limit).map(timeLabel).filter(Boolean).join(' / ')}${day.times.length>limit?' +':''}`;}
function sessionMomentParts(days, {includeDate=false}={}) {
  const first=Array.isArray(days)?days[0]:null;
  if(!first || !require('../engine/content-rules').validDay(first.date))return null;
  const times=(first.times || []).map(timeLabel).filter(Boolean);
  if(!times.length)return null;
  const weekday=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long'}).format(new Date(`${first.date}T12:00:00Z`)).replace(/-feira$/,'').toUpperCase();
  const recurring=days.some(day=>day.date!==first.date);
  const prefix=recurring?'A PARTIR DE ':'';
  const date=includeDate?` ${first.date.slice(8,10)}/${first.date.slice(5,7)}`:'';
  return {date:`${prefix}${weekday}${date}`,time:`ÀS ${times.join(' / ')}`,day:`${weekday}${includeDate?` •${date}`:''}`,clock:times.join(' / '),recurring};
}
function sessionMomentLabel(days,options) {
  const parts=sessionMomentParts(days,options);
  return parts?`${parts.date} ${parts.time}`:'';
}
module.exports={MOVIE_FAMILIES,PRODUCT_LAYOUTS,SAFE,isMovie,isProgramme,movieFamily,campaignCTA,timeLabel,dayLabel,scheduleLabel,sessionMomentParts,sessionMomentLabel};
