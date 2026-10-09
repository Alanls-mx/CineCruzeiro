const {flattenElements} = require('../scene/groups');
const {category} = require('../contracts/workspace');
const {semanticText}=require('./movie-content');
const clamp = value => Math.round(Math.max(0, Math.min(100, value)));
const contentElements = scene => flattenElements(scene.elements).filter(e => e.visible !== false && e.opacity !== 0 && (e.type === 'text' && e.text?.trim() || e.type === 'image' && e.src && (e.id === 'artwork' || e.id.startsWith('movie-art-') || ['logo','artwork'].includes(e.role))));

function reviewEditorial(scene) {
  const elements = contentElements(scene), draft = scene.sourceDraft || {};
  const kind = category(scene.templateId), w = scene.width, h = scene.height;
  const texts = elements.filter(e => e.type === 'text');
  const artwork = elements.filter(e => e.type === 'image' && e.role !== 'logo');
  const logo = elements.find(e => e.role === 'logo');
  const issues = [];
  const add = (code, message, penalty, blocking = false) => issues.push({code, message, penalty, blocking});
  const boxes = elements.map(e => e.type === 'text' ? {...e, height:Math.min(e.height, e.fontSize * (e.lineHeight || 1.12) * e.text.split('\n').length)} : e);
  let occupied = 0, emptyRun = 0, longestGap = 0;
  // Sample content, excluding atmospheric backgrounds that would mask empty layouts.
  for (let y = 0; y < 32; y++) {
    let row = 0;
    for (let x = 0; x < 24; x++) {
      const px = (x + .5) * w / 24, py = (.08 + (y + .5) / 32 * .82) * h;
      if (boxes.some(b => px >= b.x && px <= b.x+b.width && py >= b.y && py <= b.y+b.height)) row++;
    }
    occupied += row;
    emptyRun = row ? 0 : emptyRun + 1;
    longestGap = Math.max(longestGap, emptyRun);
  }
  const occupancy = occupied / 768, gap = longestGap / 32;
  const intentionalType = draft.layoutId === 'typography-dominant' || draft.visualStyle === 'minimal';
  if (occupancy < (intentionalType ? .13 : .20)) add('SPARSE_CAMPAIGN', 'A composição tem pouco conteúdo visual para o formato.', 22, occupancy < .10);
  if (gap > .27) add('EMPTY_BAND', 'Há uma faixa vazia separando os elementos principais.', 18, gap > .42);
  const hasAvailableArt = draft.availableArtwork === true;
  if (!artwork.length && hasAvailableArt && ['movie','online'].includes(kind) && !intentionalType) add('UNUSED_ARTWORK', 'A direção visual precisa usar a imagem disponível.', 30, true);
  const targetLogo = kind === 'movie' ? .15 : kind === 'concession' ? .20 : .18;
  if (logo && logo.width / w < targetLogo * .72) add('WEAK_BRANDING', 'A assinatura está pequena para esta campanha.', 12);
  const cta = texts.find(e => e.id === 'cta'), website = texts.find(e => e.id === 'website');
  if (cta && website && (Math.abs(cta.x-website.x) > w*.06 || Math.abs(website.y-cta.y-cta.height) > h*.05)) add('ACTION_DISTANCE', 'A chamada precisa ficar junto do endereço.', 25, kind !== 'legacy');
  if (draft.priceInfo?.from || draft.content?.price?.from) {
    if (texts.some(e => e.id === 'price-label' && /valor por ingresso/i.test(e.text))) add('PRICE_SEMANTICS', 'O preço mínimo precisa manter a indicação a partir de.', 30, true);
  }
  for (const e of texts.filter(e => e.id === 'title')) {
    const lines = e.text.split('\n');
    if (lines.length > 2 && lines.at(-1).trim().length <= 2) add('TITLE_ORPHAN', 'A última linha do título ficou isolada.', 8);
  }
  const layout = clamp(100-issues.filter(i => ['SPARSE_CAMPAIGN','EMPTY_BAND','TITLE_ORPHAN'].includes(i.code)).reduce((n,i)=>n+i.penalty,0));
  return {layout, branding:logo ? clamp(logo.width/w/targetLogo*100) : draft.signatureId==='none'?85:60, conversion:clamp(100-issues.filter(i=>['ACTION_DISTANCE','PRICE_SEMANTICS'].includes(i.code)).reduce((n,i)=>n+i.penalty,0)), occupancy:Number(occupancy.toFixed(3)), emptyBand:Number(gap.toFixed(3)), issues};
}

function mergeQuality(scene, general, specialist) {
  const review = reviewEditorial(scene);
  const draft=scene.sourceDraft || {}, visible=flattenElements(scene.elements).filter(e=>e.type==='text' && e.visible!==false);
  const artIssues=[];
  const note=(code,message,penalty)=>artIssues.push({code,message,penalty,blocking:false});
  if(category(scene.templateId)==='movie') {
    const title=visible.find(e=>e.id==='title');
    if(title && ['metadata','registered-poster'].includes(draft.titleEvidence) && semanticText(title.text)===semanticText(draft.editorialTitle))
      note('REPEATED_MOVIE_TITLE','O pôster já apresenta o título; avalie retirar o título adicional.',18);
    const detail=visible.find(e=>e.id==='detail'),clock=visible.find(e=>e.id==='session-time' || e.id==='description' && /\d{1,2}[:h]\d{2}/.test(e.text));
    if(clock && detail && /\d{1,2}[/:]\d{2}|\b[A-Z]+\b/.test(detail.text) && clock.fontSize<detail.fontSize*.72)
      note('WEAK_SESSION_TIME','O horário está fraco em relação à data.',15);
    const dates=visible.flatMap(e=>[...e.text.matchAll(/\b\d{1,2}\s*(?:\/|DE)\s*(?:\d{2}|[A-ZÁÉÍÓÚÇ]+)/gi)].map(match=>({id:e.id,value:semanticText(match[0])})));
    if(dates.some((entry,index)=>dates.some((other,otherIndex)=>otherIndex>index && other.id!==entry.id && other.value===entry.value)))
      note('REPEATED_SESSION_DATE','A data aparece mais de uma vez.',16);
    const background=scene.elements.find(e=>e.id==='background-blur');
    if(background?.effects?.blur>38)note('HEAVY_BACKGROUND_BLUR','O desfoque afasta o fundo da identidade do filme.',9);
  }
  const editorialIssues=[...review.issues,...artIssues];
  const editorialScore=clamp(
    review.layout*.15+(general.balance ?? 100)*.10+(general.hierarchy ?? 100)*.15+
    (general.visualContinuity ?? 100)*.20+(general.artworkUtilization ?? 100)*.15+
    (general.redundancy ?? 100)*.10+(general.primaryElementClarity ?? 100)*.05+
    (general.genreFit ?? 100)*.10-editorialIssues.reduce((sum,item)=>sum+item.penalty,0)
  );
  const issues = [...new Map([...(general.issues || []),...(specialist?.issues || []),...editorialIssues].map(i=>[`${i.code}:${i.elementId || ''}`,i])).values()];
  // Raster validators own exact collisions/contrast for their scene families;
  // generic heuristics remain available for ranking rather than being overwritten.
  const valid = specialist ? specialist.accepted : general.accepted;
  const total = clamp((specialist ? specialist.total*.45+general.total*.30 : general.total*.75)+review.layout*.15+review.branding*.05+review.conversion*.05);
  return {...general,total,score:total,accepted:valid && !review.issues.some(i=>i.blocking),issues,
    technical:{score:specialist?.total ?? general.total,accepted:valid,issues:specialist?.issues || general.issues || []},
    editorial:{...review,score:editorialScore,issues:editorialIssues},raster:specialist || null,method:'editorial-review-v4'};
}

function geometry(scene) {
  return contentElements(scene).map(e => ({role:e.role==='logo'?'logo':e.type==='image'?'artwork':e.id, x:e.x/scene.width,y:e.y/scene.height,w:e.width/scene.width,h:e.height/scene.height})).sort((a,b)=>a.role.localeCompare(b.role)||a.y-b.y||a.x-b.x);
}
function geometryDistance(a,b) {
  if (a.length !== b.length) return 1;
  if (!a.length) return 0;
  return a.reduce((sum,item,i)=>sum+(item.role!==b[i].role?1:Math.abs(item.x-b[i].x)+Math.abs(item.y-b[i].y)+Math.abs(item.w-b[i].w)+Math.abs(item.h-b[i].h)),0)/a.length;
}
function creativeIntent(style) {
  if (/spotlight|price|burst|typography|campaign-led|offer-counter/.test(style)) return 'Comercial';
  if (/editorial|lateral|cards|days|list|hero-left/.test(style)) return 'Editorial';
  return 'Cinematográfica';
}
function preferenceBonus(draft, history = []) {
  const seen = new Set(), kind = category(draft.templateId);
  let total = 0, matches = 0;
  for (const item of history.slice(0,60)) {
    const saved = item.payload || item;
    if (category(saved.templateId)!==kind) continue;
    const key = item.campaignId || item.id || JSON.stringify([saved.movieId,saved.concessionId,saved.title,saved.layoutId]);
    if (seen.has(key)) continue;
    seen.add(key); total++;
    if ((saved.programLayout || saved.layoutId || saved.style)===(draft.programLayout || draft.layoutId || draft.style)) matches++;
  }
  // Saved campaigns indicate preference, not approval of every generated candidate.
  return total >= 3 ? Math.min(3, matches/total*3) : 0;
}
module.exports = {reviewEditorial,mergeQuality,geometry,geometryDistance,creativeIntent,preferenceBonus};
