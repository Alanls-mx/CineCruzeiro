const crypto=require('crypto');
const CAMPAIGN_TYPES=new Set(['movie','schedule','concession','club','custom']);
const FORMAT_ALIASES={feed_4_5:'feed_portrait',instagram_feed:'feed_portrait',story_9_16:'story',instagram_story:'story',square_1_1:'square'};
const FORMAT_IDS=new Set(['feed_portrait','story','square']);

function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function templateFor(type,objective='') {
  if(type==='schedule')return /hoje|dia/i.test(objective)?'sessions-today':/semana/i.test(objective)?'sessions-week':'multi-movies';
  return {movie:'movie-highlight',concession:'concession-offer',club:'club-plan',custom:'online-ticket'}[type] || 'movie-highlight';
}
function normalizeCampaignRequest(input={},defaults={}) {
  const campaignType=CAMPAIGN_TYPES.has(input.campaignType)?input.campaignType:'movie';
  const objective=String(input.objective || '').trim().slice(0,240);
  const rawFormats=Array.isArray(input.formats)?input.formats:[input.formatId || 'feed_portrait'];
  const formats=[...new Set(rawFormats.map(value=>FORMAT_ALIASES[value] || value).filter(value=>FORMAT_IDS.has(value)))].slice(0,3);
  const subject=input.subject && typeof input.subject==='object' && !Array.isArray(input.subject)?input.subject:{};
  const request={
    cinemaId:String(input.cinemaId || defaults.cinemaId || 'default').slice(0,120),campaignType,objective,
    formats:formats.length?formats:['feed_portrait'],templateId:String(input.templateId || input.template || subject.templateId || templateFor(campaignType,objective)),
    triggerType:String(input.triggerType || 'manual').slice(0,80),source:String(input.source || 'studio').slice(0,80),
    subject:{...subject,...Object.fromEntries(['movieId','concessionId','clubPlanId','programMovieIds','sessionId','priceSelection','copyTone','copyDensity','copyBrief','offerTerms','offerHeadline','cta','title','subtitle','auxiliaryText','actionDestination'].filter(key=>input[key]!==undefined).map(key=>[key,input[key]]))},
    assets:Array.isArray(input.assets)?input.assets.slice(0,20):[],context:input.context && typeof input.context==='object'?input.context:{},
    copyOptions:input.copyOptions && typeof input.copyOptions==='object'?input.copyOptions:{},variationCount:Math.max(1,Math.min(4,Number(input.variationCount)||3))
  };
  const basis={cinemaId:request.cinemaId,campaignType,objective,formats:request.formats,templateId:request.templateId,triggerType:request.triggerType,subject:request.subject,eventVersion:String(input.eventVersion || input.version || ''),eventDate:String(input.eventDate || '')};
  const supplied=String(input.idempotencyKey || '').trim();
  request.idempotencyKey=(supplied || crypto.createHash('sha256').update(JSON.stringify(stable(basis))).digest('hex')).slice(0,180);
  return request;
}
module.exports={CAMPAIGN_TYPES,FORMAT_IDS,normalizeCampaignRequest,templateFor};
