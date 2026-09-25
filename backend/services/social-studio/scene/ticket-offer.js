const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {compactWebsite}=require('../engine/typography');
const {PriceHero}=require('./price-hero');
const graphics=require('./promo-graphics');
const {ticketCampaignConcept,formatCampaignSession,validateLayoutCollisions}=require('../contracts/ticket-campaign');

const FAMILIES={
  'price-impact':{variant:'giant',title:.145,priceX:.065,priceW:.87},
  'campaign-led':{variant:'sticker',title:.15,priceX:.10,priceW:.80},
  'offer-counter':{variant:'split',title:.135,priceX:.12,priceW:.76},
  'ticket-burst':{variant:'burst',title:.145,priceX:.14,priceW:.73},
  'promo-editorial':{variant:'compact',title:.13,priceX:.065,priceW:.87},
  'cinema-pop':{variant:'giant',title:.16,priceX:.09,priceW:.82}
};

function buildTicketOfferScene({draft,format,brand,logoUrl,sourceUrl,backgroundUrl},fallback=false) {
  const w=format.width,h=format.height,story=format.id==='story',m=w*.065;
  const family=FAMILIES[draft.style] || FAMILIES['price-impact'];
  const mode=draft.style, editorial=mode==='promo-editorial';
  const ink=brand.primaryColor || '#081c36',gold=brand.accentColor || '#ffda38',blue=brand.secondaryColor || '#1468bd';
  const background=editorial?gold:mode==='cinema-pop'?blue:ink;
  const foreground=editorial?ink:'#ffffff',accent=editorial?ink:gold;
  const top=story?.115:.075;
  const geometry={
    'price-impact':{priceTop:story?.37:.355,priceH:story?.245:.29},
    'campaign-led':{priceTop:story?.46:.445,priceH:story?.20:.23},
    'ticket-burst':{priceTop:story?.385:.37,priceH:story?.27:.31},
    'promo-editorial':{priceTop:story?.47:.455,priceH:story?.18:.205},
    'offer-counter':{priceTop:story?.40:.385,priceH:story?.235:.27},
    'cinema-pop':{priceTop:story?.39:.375,priceH:story?.25:.285}
  }[mode] || {priceTop:story?.37:.355,priceH:story?.245:.29};
  const priceTop=geometry.priceTop,priceH=geometry.priceH;
  const concept=ticketCampaignConcept(draft), elements=[];
  const shape=(id,x,y,width,height,fill,extra={})=>elements.push({id,name:id,role:'ambient',type:'shape',x,y,width,height,fill,locked:true,...extra});
  const tx=(id,value,x,y,width,height,fontSize,extra={})=>{
    if(!value)return;
    const fitted=wrapText(value,width,height,fontSize,extra.lines || 2);
    elements.push({id,name:id,role:id,type:'text',x,y,width,height,text:fitted.text,fontSize:fitted.fontSize,fontFamily:extra.display?'Social Display':'Social Text',fontWeight:extra.display?900:600,fill:foreground,lineHeight:1.05,hierarchy:'secondary',...extra});
  };
  const image=(id,src,x,y,width,height,role,extra={})=>{if(src)elements.push({id,name:id,role:role || id,type:'image',src,x,y,width,height,fit:'contain',keepRatio:true,locked:true,...extra});};
  shape('background',0,0,w,h,background);
  const art=Boolean(sourceUrl);
  const artPlans={
    'price-impact':{x:.585,y:.055,width:.37,height:.255,focusX:50,focusY:42,mask:'fade-all',blend:44},
    'campaign-led':{x:.615,y:.052,width:.34,height:.285,focusX:50,focusY:40,mask:'fade-all',blend:52},
    'offer-counter':{x:.595,y:.065,width:.36,height:.26,focusX:50,focusY:42,mask:'fade-all',blend:45},
    'ticket-burst':{x:.575,y:.05,width:.38,height:.275,focusX:50,focusY:40,mask:'fade-all',blend:54},
    'promo-editorial':{x:.57,y:.07,width:.385,height:.315,focusX:50,focusY:40,mask:'fade-all',blend:50},
    'cinema-pop':{x:.615,y:.052,width:.34,height:.285,focusX:50,focusY:40,mask:'fade-all',blend:48}
  };
  const artPlan=artPlans[mode] || artPlans['price-impact'];
  const artBox={x:w*artPlan.x,y:h*Math.max(artPlan.y,story?.105:.045),width:w*artPlan.width,height:h*artPlan.height};
  if(art) {
    image('artwork-atmosphere',backgroundUrl || sourceUrl,0,0,w,h,'ambient',{fit:'cover',focusX:artPlan.focusX,focusY:artPlan.focusY,opacity:editorial?.12:.18,effects:{layer:'background',blur:48,brightness:editorial?.72:.42,saturation:.78,scale:1.22,mask:'none'}});
    image('ambient-shadow',sourceUrl,artBox.x+w*.012,artBox.y+h*.012,artBox.width,artBox.height,'ambient',{fit:'cover',focusX:artPlan.focusX,focusY:artPlan.focusY,opacity:.78,effects:{layer:'ambient-shadow',mask:'fade-all',blend:artPlan.blend,shadow:34,scale:1.02}});
    image('artwork',sourceUrl,artBox.x,artBox.y,artBox.width,artBox.height,'artwork',{fit:'cover',focusX:artPlan.focusX,focusY:artPlan.focusY,hierarchy:'primary',effects:{layer:'hero',mask:artPlan.mask,blend:artPlan.blend,brightness:.96,saturation:1.03,scale:1.02}});
    elements.push({id:'artwork-veil',name:'Integração do filme',role:'ambient',type:'gradient',x:artBox.x-w*.04,y:artBox.y-h*.018,width:artBox.width+w*.07,height:artBox.height+h*.05,direction:'left',stops:[{offset:0,color:background},{offset:.20,color:'rgba(0,0,0,0.28)'},{offset:.60,color:'rgba(0,0,0,0)'},{offset:1,color:'rgba(0,0,0,0)'}],locked:true});
  }
  // Decorations stay outside the content boxes and remain editable vector shapes.
  if(mode==='cinema-pop') {
    shape('promotional-stripe',-w*.1,h*.35,w*1.2,h*.29,ink,{rotation:-5});
    shape('pop-rule',w*.72,h*.05,w*.3,h*.012,gold,{rotation:12});
  } else if(editorial) {
    shape('editorial-rule',m,h*(top-.018),w*.87,6,ink);
    shape('editorial-price-rule',m,h*.64,w*.87,4,ink);
  } else shape('edge-stripe',0,0,w*.016,h,gold);
  const titleY=h*(story?top+.046:family.title);
  const hasGraphic=!art && concept.mode==='promotional' && ['cinema-pop','campaign-led'].includes(mode);
  const titleWidth=art?w*(artPlan.x-.095):hasGraphic?w*.62:mode==='campaign-led'?w*.76:w*.87;
  const titleHeight=h*(story?.15:.17);
  tx('subtitle',concept.eyebrow,m,h*top,art?titleWidth:w*.87,h*.035,36,{fill:accent,lines:1});
  if(mode==='campaign-led') shape('headline-stripe',-w*.04,titleY-h*.012,w*.86,titleHeight+h*.025,gold,{rotation:-3});
  tx('title',concept.headline,m,titleY,titleWidth,titleHeight,110,{display:true,fill:mode==='campaign-led'?ink:foreground,lines:3,align:mode==='ticket-burst' && !art?'center':'left'});
  if(!art && editorial) elements.push(...graphics.TicketIcon('editorial-ticket',[m,h*.44,w*.23,h*.105],ink,gold));
  else if(hasGraphic) elements.push(...(mode==='cinema-pop'?graphics.ClapperboardIcon:graphics.TicketIcon)('campaign-symbol',[w*.77,titleY+h*.028,w*.155,h*.075],gold,ink));
  else if(concept.mode==='promotional' && mode==='ticket-burst') {
    shape('ticket-decoration',w*.79,h*.30,w*.14,h*.035,gold,{rotation:-8});
    for(let i=0;i<4;i++) shape(`ticket-perforation-${i}`,w*.814,h*(.304+i*.006),3,3,ink,{radius:2});
  }
  const px=editorial?w*.365:w*family.priceX,pw=editorial?w*.57:w*family.priceW,py=h*priceTop,ph=h*priceH;
  let priceFill=accent;
  if(mode==='offer-counter') {
    shape('price-panel',px-w*.025,py-h*.012,pw+w*.05,ph+h*.025,gold,{rotation:mode==='offer-counter'?1:-1});
    priceFill=ink;
  }
  if(mode==='ticket-burst') {
    elements.push(graphics.PriceBurst('price-burst',[w*.035,py-h*.045,w*.93,ph+h*.075],gold));
    priceFill=ink;
  }
  const old=Number(draft.oldPrice),value=Number(draft.priceInfo?.value),hasPrice=draft.priceInfo?.valid===true && Number.isFinite(value);
  const priceLabel=old>value?`ANTES ${old.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:concept.pricePrompt;
  if(hasPrice) tx('price-label',priceLabel,mode==='ticket-burst'?w*.30:px,py+h*.006,mode==='ticket-burst'?w*.40:pw,h*.035,32,{fill:priceFill,lines:1,align:mode==='ticket-burst'?'center':'left'});
  if(hasPrice) elements.push(...PriceHero({value,x:px,y:py+h*.043,width:pw,height:ph-h*.075,fill:priceFill,variant:family.variant}));
  else tx('price-draft','CONSULTE OS VALORES',px,py+h*.035,pw,ph-h*.055,editorial?66:82,{display:true,fill:priceFill,lines:2,align:mode==='ticket-burst'?'center':'left',hierarchy:'primary'});
  if(hasPrice && old>value) tx('savings',`ECONOMIZE ${(old-value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`,px,py+ph-h*.03,pw,h*.025,25,{fill:priceFill,lines:1});
  else if(draft.offerBadge && !concept.headline.toUpperCase().includes(draft.offerBadge.toUpperCase())) tx('badge',draft.offerBadge,mode==='ticket-burst'?w*.30:px,py+ph-h*.029,mode==='ticket-burst'?w*.40:pw,h*.025,25,{fill:priceFill,lines:1,align:mode==='ticket-burst'?'center':'left'});
  const movie=draft.entities.movie;
  const session=movie?.sessions?.find(s=>String(s.id)===String(draft.priceInfo?.selection?.sessionId));
  const subject=[movie?.title,formatCampaignSession(session,editorial)].filter(Boolean).join(' • ');
  tx('subject',subject,m,h*(fallback?.658:.675),w*.87,h*.039,32,{lines:2});
  // Ticket category is communicated next to its price, never repeated in this supporting line.
  const terms=(draft.offerTerms || 'Consulte as condições e as sessões participantes.').replace(/^(?:meia(?:-entrada)?|inteira|ingresso normal)\s*[•:–-]\s*/i,'');
  tx('description',terms,m,h*(fallback?.705:.728),w*.87,h*(fallback?.086:.055),27,{fill:editorial?ink:'#d8e3ee',lines:fallback?4:3,hierarchy:'tertiary'});
  const footer=h*(story?.797:.817),actionWidth=logoUrl?w*.49:w*.87;
  shape('action-rule',m,footer-h*.009,w*.87,3,accent);
  tx('cta',draft.cta || 'COMPRE AGORA',m,footer,actionWidth,h*.044,35,{fill:accent,lines:2});
  tx('website',compactWebsite(draft.actionDestination || brand.posterWebsite || brand.website),m,footer+h*.047,actionWidth,h*.027,26,{lines:1,protected:true});
  const scale=draft.signatureScaleMode==='manual'?Math.max(.7,Math.min(1.8,Number(draft.signatureScale || 100)/100)):1;
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.4;
  const logoWidth=Math.min(w*.34,w*.24*scale,h*.075*ratio),logoHeight=logoWidth/ratio;
  image('logo',logoUrl,w-m-logoWidth,footer+(h*.07-logoHeight)/2,logoWidth,logoHeight,'logo');
  const {entities,...sourceDraft}=draft;
  sourceDraft.signatureBounds={width:logoWidth,height:logoHeight,scale:Math.round(scale*100)};
  sourceDraft.campaignConcept=concept;
  const scene=normalizeScene({id:`scene-ticket-offer-${format.id}`,templateId:'ticket-offer',formatId:format.id,width:w,height:h,backgroundColor:background,motion:draft.motion,elements,sourceDraft});
  const validation=validateLayoutCollisions(scene,{repair:true});
  if(!validation.valid && !fallback) return buildTicketOfferScene({draft:{...draft,style:'promo-editorial'},format,brand,logoUrl,sourceUrl,backgroundUrl},true);
  if(!validation.valid) throw Object.assign(new Error('A composição precisa de uma chamada ou condições mais curtas para preservar a leitura.'),{statusCode:400,code:'TICKET_LAYOUT_COLLISION',validation});
  scene.sourceDraft.layoutValidation=validation;
  return scene;
}
module.exports={buildTicketOfferScene};
