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
  'movie-editorial-light':'Editorial integrado'
});
const PRODUCT_LAYOUTS=Object.freeze({'product-price':'Produto + preço','product-lateral':'Produto lateral','hero-product':'Hero product'});
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
  return !available?'EM BREVE':['movie-price','movie-presale'].includes(draft.templateId)?'COMPRE SEU INGRESSO':'ESCOLHA SUA SESSÃO';
}
function timeLabel(value) {return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))?String(value).replace(':','H'):'';}
function dayLabel(value) {
  if(!require('../engine/content-rules').validDay(value))return '';
  const weekday=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short'}).format(new Date(`${value}T12:00:00Z`)).replace('.','').toUpperCase();
  return `${weekday} • ${value.slice(8,10)}/${value.slice(5,7)}`;
}
function scheduleLabel(day,limit=5) {return `${dayLabel(day.date)} • ${day.times.slice(0,limit).map(timeLabel).filter(Boolean).join(' / ')}${day.times.length>limit?' +':''}`;}
module.exports={MOVIE_FAMILIES,PRODUCT_LAYOUTS,SAFE,isMovie,isProgramme,movieFamily,campaignCTA,timeLabel,dayLabel,scheduleLabel};
