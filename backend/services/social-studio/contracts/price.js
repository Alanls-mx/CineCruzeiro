const money = value => Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const amount = value => value === '' || value === null || value === undefined ? undefined : Number.isFinite(Number(value)) && Number(value)>=0 ? Number(value) : undefined;
function ticketOptions(movie = {}, now = new Date()) {
  movie ||= {};
  return (movie.sessions || []).filter(s => s.active!==false && s.available!==false && s.availableForPurchase!==false && !['cancelled','canceled','expired','hidden','disabled','sold_out'].includes(s.status) && (!s.date || Date.parse(`${s.date.slice(0,10)}T${(s.time || '23:59').slice(0,5)}:00-03:00`) >= new Date(now).getTime())).flatMap(s => (s.ticketTypes || []).filter(t=>t.active!==false && amount(t.price)!==undefined).map(t=>({sessionId:String(s.id || ''),sessionLabel:[s.date,s.time,s.roomName || s.room].filter(Boolean).join(' • '),ticketTypeId:String(t.id || ''),name:String(t.name || ''),value:amount(t.price)})));
}
function resolvePriceSelection(input, movie, now) {
  const options=ticketOptions(movie,now);
  const supplied=input.priceSelection;
  // A persisted legacy price is kept as an explicit legacy snapshot, never inferred for a new blank campaign.
  const legacy=!supplied && typeof input.price==='string' && /\d/.test(input.price);
  const selection=supplied && typeof supplied==='object' ? supplied : legacy ? {mode:'legacy',formatted:input.price} : {mode:'ticket-type'};
  const mode=['ticket-type','minimum','full','half','promotional','manual','campaign','legacy'].includes(selection.mode)?selection.mode:'ticket-type';
  const ticketTypeId=String(selection.ticketTypeId || '');
  const sessionId=String(selection.sessionId || '');
  const kinds={full:/inteira|normal|padr[aã]o/i,half:/meia/i,promotional:/promoc|promo/i};
  const rows=options.filter(o=>(!sessionId || o.sessionId===sessionId) && (mode!=='ticket-type' || o.ticketTypeId===ticketTypeId) && (!kinds[mode] || kinds[mode].test(o.name)));
  let value=['manual','campaign'].includes(mode)?amount(selection.value):mode==='legacy'?amount(String(selection.formatted || input.price || '').replace(/[^\d,.]/g,'').replace(/\./g,'').replace(',','.')):rows.length?Math.min(...rows.map(o=>o.value)):undefined;
  const variable=rows.some(o=>o.value!==value);
  const from=mode==='minimum' || ['ticket-type','full','half','promotional'].includes(mode) && variable;
  const name=['ticket-type','full','half','promotional'].includes(mode)?rows[0]?.name || '':mode==='campaign'?'INGRESSO DA CAMPANHA':'INGRESSOS';
  const label=mode==='legacy'?String(input.subtitle || 'INGRESSOS'):from?`${name || 'INGRESSOS'} A PARTIR DE`:name;
  const formatted=mode==='legacy'?String(selection.formatted || input.price):value===undefined?'':money(value);
  return {selection:{mode,ticketTypeId,sessionId,...(['manual','campaign'].includes(mode)?{value}:{}),...(mode==='legacy'?{formatted}: {})},options,value,formatted,label,from,variable,ticketType:name,valid:value!==undefined && (mode!=='ticket-type' || Boolean(ticketTypeId)) && (!kinds[mode] || rows.length>0)};
}
module.exports={ticketOptions,resolvePriceSelection};
