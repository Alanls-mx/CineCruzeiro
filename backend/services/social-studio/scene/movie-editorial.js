const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {mix}=require('../engine/palette');
const {SAFE,scheduleLabel}=require('../contracts/artwork-layout');
const {visualLength}=require('../engine/typography');

function buildMovieEditorial({draft,format,palette,brand,sourceUrl,backgroundUrl,logoUrl}) {
  const w=format.width,h=format.height,safe=SAFE[format.id],top=safe.top*h,bottom=safe.bottom*h,area=bottom-top;
  let family=draft.movieFamily;
  // Without a backdrop and a separate intact poster, blend has no safe visual advantage.
  if(family==='cinematic-blend' && (!draft.entities.movie?.backdropUrl || sourceUrl===backgroundUrl))family='poster-lateral';
  if(family==='poster-lateral' && format.id==='story')family='cinematic-story';
  const lateral=family==='poster-lateral' || family==='cinematic-blend';
  const flip=(draft.artDirection?.seed || 0)%2===1;
  const bg=mix(palette.dominantColor,'#000000',.86),ink='#ffffff',accent=mix(palette.accentColor,'#ffffff',.55);
  const box=([x,y,width,height])=>({x:x*w,y:top+y*area,width:width*w,height:height*area});
  const elements=[];
  const tx=(id,value,rect,size,lines=3,extra={})=>{
    if(!String(value || '').trim())return;
    const b=box(rect),fitted=wrapText(value,b.width,b.height,size,lines);
    elements.push({id,name:id,type:'text',role:id,...b,...fitted,fontFamily:['title','detail'].includes(id)?'Social Display':'Social Text',fontWeight:['title','detail'].includes(id)?900:600,fill:['subtitle','detail'].includes(id)?accent:ink,lineHeight:1.12,align:'left',hierarchy:id==='title'?'secondary':'tertiary',...extra});
  };
  if(backgroundUrl)elements.push({id:'background-blur',type:'image',role:'background',src:backgroundUrl,x:0,y:0,width:w,height:h,fit:'cover',focusX:flip?70:30,focusY:45,opacity:family==='cinematic-blend'?.40:.22,effects:{layer:'background',blur:family==='cinematic-blend'?8:16,brightness:.55,saturation:.70,scale:1.08,mask:'none'}});
  elements.push({id:'editorial-veil',type:'gradient',role:'ambient',x:0,y:0,width:w,height:h,direction:flip?'left':'right',stops:[{offset:0,color:'rgba(0,0,0,0.1)'},{offset:1,color:bg}]});
  const withPriceAndSessions=draft.templateId==='movie-price' && draft.schedule?.days?.length && draft.showSessions!==false;
  const artHeight=withPriceAndSessions?.55:format.id==='square'?.61:.65;
  let artRect=lateral?[flip?.435:.055,.012,.51,.80]:[.065,.0,.87,artHeight];
  const titleX=sourceUrl && lateral?(flip?.065:.59):.065,titleW=sourceUrl && lateral?.35:.87;
  if(!sourceUrl)artRect=null;
  if(artRect) {
    const b=box(artRect),ratio=draft.sourceAsset?.width/draft.sourceAsset?.height || 2/3;
    const width=Math.min(b.width,b.height*ratio),height=width/ratio;
    const art={x:b.x+(b.width-width)/2,y:b.y+(b.height-height)/2,width,height};
    elements.push({id:'ambient-shadow',type:'image',role:'ambient',src:sourceUrl,...art,fit:'contain',effects:{layer:'ambient-shadow',mask:'none',scale:1,shadow:24}});
    elements.push({id:'artwork',type:'image',role:'artwork',src:sourceUrl,...art,fit:'contain',keepRatio:true,locked:true,hierarchy:'primary'});
  }
  const y=lateral?.20:artHeight+.025;
  const titleHeight=lateral?.19:.085;
  const date=draft.artworkPolicy?.hideDate?'':draft.templateId==='movie-price'?draft.price:draft.date;
  const sessionPrimary=draft.templateId==='movie-highlight' && draft.schedule?.days?.length && draft.showSessions!==false;
  const showDate=Boolean(date && date!=='EM BREVE' && !sessionPrimary);
  const dateLabel=draft.templateId==='movie-price'?'INGRESSOS':draft.content?.primaryDateLabel || '';
  const showSessions=sessionPrimary || draft.templateId==='movie-price';
  let headline=draft.title || draft.entities.movie?.title || '';
  // A verified embedded title can reduce repetition, but never remove all identification.
  const titleSize=draft.artworkPolicy?.supportTitle?42:lateral && headline.length<=22?Math.max(42,Math.min(94,titleW*w/visualLength(headline))):lateral?94:72;
  if(!sourceUrl) {headline=draft.title || '';}
  tx('title',headline,[titleX,y,titleW,titleHeight],titleSize,lateral?4:2,{visible:!(sourceUrl && draft.artworkPolicy?.hideTitle)});
  if(lateral) {
    if(showDate) {
      tx('subtitle',dateLabel || draft.subtitle,[titleX,.41,titleW,.04],30,1);
      tx('detail',date,[titleX,.47,titleW,.105],66,2);
    } else if(draft.subtitle && !/HOJE|EM DESTAQUE|NA TELA GRANDE/i.test(draft.subtitle))tx('subtitle',draft.subtitle,[titleX,.40,titleW,.06],30,2);
    if(showSessions && draft.schedule?.days?.length && draft.showSessions!==false)tx('description',scheduleLabel(draft.schedule.days[0],3),[titleX,showDate?.63:.44,titleW,.14],40,4);
  } else {
    const row=y+titleHeight+.023;
    if(showDate)tx('detail',`${dateLabel} ${date}`.trim(),[.065,row,.87,.06],44,2);
    if(showSessions && draft.schedule?.days?.length && draft.showSessions!==false)tx('description',scheduleLabel(draft.schedule.days[0],4),[.065,row+(showDate?.075:0),.87,.045],38,2);
  }
  const footer=.885;
  elements.push({id:'editorial-footer',type:'shape',role:'ambient',x:0,y:top+area*(footer-.02),width:w,height:h-(top+area*(footer-.02)),fill:bg});
  tx('cta',draft.cta,[.065,footer,.60,.042],36,1);
  tx('website',(draft.actionDestination || '').replace(/^https?:\/\//,'').replace(/\/$/,''),[.065,footer+.056,.60,.032],26,1);
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const scale=Math.max(.7,Math.min(1.35,(draft.signatureScale || 100)/100));
  const lw=Math.min(w*.19,w*.14*scale,h*.07*ratio),lh=lw/ratio;
  const logoBox={x:w*.935-lw,y:top+area*footer,width:lw,height:lh};
  if(logoUrl)elements.push({id:'logo',type:'image',role:'logo',src:logoUrl,...logoBox,fit:'contain',keepRatio:true,protected:true,hierarchy:'branding'});
  else if(draft.signatureId!=='none')tx('cinema',brand.name,[.73,footer,.205,.06],26,2);
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:bg,motion:draft.motion,elements,
    sourceDraft:{...sourceDraft,movieFamily:family,officialMovieLayout:true,signatureReserved:logoBox,editorialSource:sourceUrl,editorialTitle:headline}});
}
module.exports={buildMovieEditorial};
