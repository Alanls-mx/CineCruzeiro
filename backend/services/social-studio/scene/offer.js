const { normalizeScene } = require('./schema');
const { wrapText } = require('./factory');
const { compactWebsite } = require('../engine/typography');

function buildConcessionOfferScene({draft,format,brand,logoUrl,sourceUrl}) {
  const w=format.width, h=format.height;
  const ticket=draft.templateId==='ticket-offer';
  const flip=['hero-right'].includes(draft.style);
  const minimal=draft.style==='typography-dominant';
  const ink=brand.primaryColor || '#07111f';
  const accent=brand.accentColor || '#ffdc3c';
  const background=ticket?ink:accent;
  const foreground=ticket?'#ffffff':ink;
  const secondary=ticket?accent:ink;
  const margin=w*.065;
  const story=format.id==='story';
  const safeBottom=h*(story?.865:.94);
  const elements=[];
  const shape=(id,x,y,width,height,fill,extra={})=>elements.push({id,name:id,role:'ambient',type:'shape',x,y,width,height,fill,locked:true,...extra});
  const tx=(id,value,x,y,width,height,size,extra={})=>{
    if(!value) return;
    const wrapped=wrapText(value,width,height,size,extra.lines || 3);
    elements.push({id,name:id,role:id,type:'text',x,y,width,height,text:wrapped.text,fontSize:wrapped.fontSize,fontFamily:extra.display?'Social Display':'Social Text',fontWeight:extra.display?900:700,fill:foreground,lineHeight:1.03,align:'left',hierarchy:id==='detail'?'primary':'tertiary',...extra});
  };
  const image=(id,src,x,y,width,height,role='artwork')=>{
    if(src) elements.push({id,name:id,role,type:'image',src,x,y,width,height,fit:'contain',locked:true,keepRatio:true});
  };
  shape('top-rule',margin,h*.057,w-2*margin,Math.max(5,h*.006),secondary);
  tx('subtitle',draft.subtitle,margin,h*.077,w-2*margin,h*.055,42,{fill:secondary,lines:2});
  const hasOfferHeadline=Boolean(draft.offerHeadline);
  tx('title',draft.offerHeadline || draft.title,margin,h*.14,w-2*margin,h*(hasOfferHeadline?.135:.15),ticket?96:106,{display:true,lines:3,hierarchy:'secondary'});
  if(hasOfferHeadline) tx('subject',draft.title,margin,h*.282,w-2*margin,h*.042,32,{fill:secondary,lines:1});

  const visualTop=h*(story?.34:.315);
  const visualHeight=h*(story?.29:ticket?.37:.43);
  const imageX=flip?w*.045:w*.49;
  const priceX=flip?w*.50:margin;
  const priceWidth=w*.43;
  if(sourceUrl && !minimal) image('artwork',sourceUrl,imageX,visualTop,w*.46,visualHeight);
  if(!ticket && sourceUrl && minimal) image('artwork',sourceUrl,w*.63,h*.37,w*.31,h*.29);
  const amount=Number(ticket?draft.priceInfo?.value:draft.entities.concession?.price);
  const formatted=Number.isFinite(amount)?amount.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  const numberWidth=minimal?w*.83:priceWidth;
  const numberX=minimal?margin:priceX;
  const numberY=h*(story?.39:ticket?.40:.42);
  tx('price-label',ticket?(draft.priceInfo?.label || 'INGRESSO'): 'POR APENAS',numberX,numberY-h*.085,numberWidth,h*.06,40,{fill:secondary,lines:2});
  tx('currency','R$',numberX,numberY,numberWidth*.32,h*.075,60,{fill:secondary,display:true,lines:1});
  tx('detail',formatted,numberX,numberY+h*.07,numberWidth,h*.19,minimal?225:185,{fill:foreground,display:true,lines:1,required:true});
  const selectedSession=draft.entities.movie?.sessions?.find(s=>String(s.id)===String(draft.priceInfo?.selection?.sessionId));
  const factual=ticket
    ? [draft.priceInfo?.ticketType,selectedSession ? `${selectedSession.date} às ${selectedSession.time}` : 'Consulte as sessões disponíveis']
    : [draft.entities.concession?.description];
  const note=[...factual,draft.offerTerms].filter(Boolean).join(' • ') || 'Consulte os detalhes no site';
  const conditionsTop=story?safeBottom-h*.195:h*.765;
  const conditionsHeight=story?h*.095:h*.12;
  shape('conditions-band',0,conditionsTop,w,conditionsHeight,ticket?accent:ink);
  tx('description',note,margin,conditionsTop+h*.017,w-2*margin,conditionsHeight-h*.03,32,{fill:ticket?ink:'#ffffff',lines:3});
  const footerTop=story?safeBottom-h*.075:h*.90;
  tx('cta',draft.cta,margin,footerTop,w*.52,h*.035,34,{fill:foreground,lines:2});
  const website=compactWebsite(brand.posterWebsite || brand.website);
  tx('website',website,margin,footerTop+h*.038,w*.52,h*.025,25,{fill:foreground,lines:1,protected:true,required:Boolean(website)});
  image('logo',logoUrl,w*.71,footerTop-h*.004,w*.23,h*.064,'logo');
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:background,motion:draft.motion,elements,sourceDraft});
}

const {buildTicketOfferScene}=require('./ticket-offer');

function buildOfferScene(args){return args.draft.templateId==='ticket-offer'?buildTicketOfferScene(args):buildConcessionOfferScene(args);}
module.exports={buildOfferScene};
