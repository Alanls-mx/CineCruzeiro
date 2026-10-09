const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {movieSurface,hexToRgb}=require('../engine/palette');
const {SAFE,sessionDayMatches,sessionMomentParts}=require('../contracts/artwork-layout');
const {embeddedMovieTitle}=require('../composition-engine/movie-content');

const rgba=(hex,opacity)=>{const {r,g,b}=hexToRgb(hex);return `rgba(${r},${g},${b},${opacity})`;};

function buildMovieEditorialLight({draft,format,palette,brand,sourceUrl,backgroundUrl,logoUrl}) {
  const w=format.width,h=format.height,safe=SAFE[format.id],top=h*safe.top,area=h*(safe.bottom-safe.top),u=w/1080;
  const box=([x,y,width,height])=>({x:x*w,y:top+y*area,width:width*w,height:height*area});
  const surface=movieSurface(palette),bg=surface.light,ink=surface.ink;
  const titlePolicy=embeddedMovieTitle(draft,sourceUrl);
  const elements=[],manifest=[];
  const image=(id,src,bounds,extra={})=>{if(src)elements.push({id,name:id,type:'image',role:id,...bounds,src,fit:'contain',visible:true,opacity:1,...extra});};
  const text=(id,value,bounds,size,{lines=2,fill=ink,display=false,...extra}={})=>{
    if(!String(value || '').trim())return;
    const fit=wrapText(value,bounds.width,bounds.height,size*u,lines);
    elements.push({id,name:id,type:'text',role:id,...bounds,...fit,fontFamily:display?'Social Display':'Social Text',fontWeight:display?900:600,fill,lineHeight:1.12,align:'left',visible:true,opacity:1,...extra});
    manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});
  };
  image('background-blur',sourceUrl || backgroundUrl,{x:0,y:0,width:w,height:h},{role:'background',fit:'fill',effects:{layer:'background',blur:46,brightness:1,saturation:1,scale:1,mask:'none'}});
  const hero=box([.015,-safe.top,.97,titlePolicy.hide?.67:.63]);
  image('artwork',sourceUrl,hero,{role:'artwork',keepRatio:true,locked:true,hierarchy:'primary',effects:{layer:'hero',mask:'fade-all',blend:22,brightness:1,scale:1}});
  const readingTop=(top+area*(titlePolicy.hide?.66:.635))/h;
  elements.splice(elements.findIndex(e=>e.id==='artwork'),0,{id:'editorial-color-wash',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,direction:'bottom',stops:[
    {offset:0,color:rgba(bg,0)},{offset:readingTop-.16,color:rgba(bg,0)},{offset:readingTop,color:rgba(bg,.98)},{offset:1,color:rgba(bg,.98)}
  ]});
  const movieTitle=draft.title || draft.entities?.movie?.title || '';
  const days=draft.showSessions===false?[]:draft.schedule?.days || [];
  const session=sessionMomentParts(days,{includeDate:true});
  const dateHero=['movie-premiere','movie-presale'].includes(draft.templateId) && Boolean(draft.date);
  const commercial=draft.templateId==='movie-price';
  const secondarySession=Boolean(session && (dateHero || commercial));
  const sameSessionDate=sessionDayMatches(draft.content?.primaryDate || draft.date,days[0]?.date);
  if(!titlePolicy.hide)text('title',movieTitle,box([.065,.635,.87,.07]),58,{lines:2,display:true,hierarchy:'primary'});
  const detail=dateHero?draft.date:commercial?draft.price:session?.day || draft.date || 'EM BREVE';
  const label=dateHero?(draft.content?.primaryDateLabel || (draft.templateId==='movie-presale'?'PRÉ-VENDA':'ESTREIA')):commercial?'INGRESSOS':session?.recurring?'A PARTIR DE':'';
  if(label)text('date-label',label,box([.065,titlePolicy.hide?.66:.711,.66,.04]),32,{lines:1});
  text('detail',detail,box([.065,titlePolicy.hide?.71:.755,.87,.061]),58,{lines:1,display:true,hierarchy:'primary'});
  if(secondarySession)text('description',sameSessionDate?session.weekday:session.day,box([.065,.82,.40,.049]),32,{lines:2});
  if(session)text('session-time',session.clock,box([secondarySession?.49:.065,.82,secondarySession?.445:.87,.06]),62,{lines:1,display:true,fill:surface.ink});
  text('cta',draft.cta,box([.065,.905,.60,.041]),32,{lines:1,display:true});
  text('website',(draft.actionDestination || '').replace(/^https?:\/\//,'').replace(/\/$/,''),box([.065,.955,.60,.032]),26,{lines:1});
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const {width:lw,height:lh}=require('./branding').signatureDimensions(w,h,ratio,draft,logoUrl);
  const logoBox={x:w*.935-lw,y:Math.min(top+area*.905,h*(format.id==='story'?.91:.985)-lh),width:lw,height:lh};
  if(logoUrl)image('logo',logoUrl,logoBox,{role:'logo',protected:true,hierarchy:'branding',...(!/assinatura-black/.test(logoUrl)?{effects:{layer:'hero',mask:'none',shadow:80,scale:1}}:{})});
  else if(draft.signatureId!=='none')text('cinema',brand.name,logoBox,28,{lines:2});
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:bg,elements,sourceDraft:{...sourceDraft,officialMovieLayout:true,creativeMovieLayout:true,solidPanelAllowed:false,movieContrastColor:surface.dark,titleEvidence:titlePolicy.evidence,movieManifest:manifest,signatureReserved:logoBox,editorialSource:sourceUrl,editorialTitle:movieTitle}});
}

module.exports={buildMovieEditorialLight};
