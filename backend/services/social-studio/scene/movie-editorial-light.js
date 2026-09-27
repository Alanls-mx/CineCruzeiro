const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {mix,hexToRgb}=require('../engine/palette');
const {SAFE,scheduleLabel}=require('../contracts/artwork-layout');

const rgba=(hex,opacity)=>{const {r,g,b}=hexToRgb(hex);return `rgba(${r},${g},${b},${opacity})`;};

function buildMovieEditorialLight({draft,format,palette,brand,sourceUrl,backgroundUrl,logoUrl}) {
  const w=format.width,h=format.height,safe=SAFE[format.id],top=h*safe.top,area=h*(safe.bottom-safe.top),u=w/1080;
  const box=([x,y,width,height])=>({x:x*w,y:top+y*area,width:width*w,height:height*area});
  const bg=mix(palette.dominantColor,'#e9e8e3',.84);
  const atmosphere=palette.editorialAtmosphere;
  const glow=atmosphere?.color || palette.secondaryColor;
  const ribbon=atmosphere?.shadow || mix(palette.secondaryColor,'#000000',.62);
  const ink='#17212b',accent='#27323b';
  const elements=[],manifest=[];
  const image=(id,src,bounds,extra={})=>{if(src)elements.push({id,name:id,type:'image',role:id,...bounds,src,fit:'contain',visible:true,opacity:1,...extra});};
  const text=(id,value,bounds,size,{lines=2,fill=ink,display=false,...extra}={})=>{
    if(!String(value || '').trim())return;
    const fit=wrapText(value,bounds.width,bounds.height,size*u,lines);
    elements.push({id,name:id,type:'text',role:id,...bounds,...fit,fontFamily:display?'Social Display':'Social Text',fontWeight:display?900:600,fill,lineHeight:1.12,align:'left',visible:true,opacity:1,...extra});
    manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});
  };
  image('background-blur',sourceUrl || backgroundUrl,{x:0,y:0,width:w,height:h},{role:'background',fit:'cover',focusX:75,focusY:45,opacity:.85,effects:{layer:'background',blur:52,brightness:1.05,saturation:1,scale:1.2}});
  elements.push({id:'editorial-color-wash',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,direction:'right',stops:[{offset:0,color:rgba(bg,.35)},{offset:.48,color:rgba(bg,.60)},{offset:1,color:rgba(bg,.90)}]});
  elements.push({id:'editorial-bottom-glow',role:'ambient',type:'gradient',x:0,y:top+area*.58,width:w,height:area*.42,direction:'bottom',stops:[{offset:0,color:rgba(glow,0)},{offset:.50,color:rgba(glow,.36)},{offset:1,color:rgba(ribbon,.82)}]});
  const hero=box([.025,.005,.565,.735]);
  image('ambient-shadow',sourceUrl,{...hero,x:hero.x+12*u,y:hero.y+14*u},{role:'ambient',effects:{layer:'ambient-shadow',mask:'fade-all',blend:58,shadow:28,scale:1}});
  image('artwork',sourceUrl,hero,{role:'artwork',keepRatio:true,locked:true,hierarchy:'primary',effects:{layer:'hero',mask:'fade-all',blend:26,brightness:1,scale:1}});
  const bandY=top+area*.73;
  elements.push({id:'editorial-brand-band',role:'ambient',type:'gradient',x:0,y:bandY,width:w,height:h-bandY,direction:'bottom',stops:[{offset:0,color:rgba(glow,0)},{offset:.12,color:rgba(glow,.85)},{offset:.26,color:ribbon},{offset:1,color:mix(ribbon,'#000000',.25)}]});
  const movieTitle=draft.title || draft.entities.movie?.title || '';
  const label=draft.subtitle && !/^(INGRESSOS )?EM DESTAQUE$/i.test(draft.subtitle)?draft.subtitle:'O FILME DA SUA VEZ';
  if(!/^(ESTREIA|PRÉ-VENDA|SESSÃO)$/i.test(label))text('subtitle',label,box([.62,.045,.315,.07]),29,{lines:2,fill:accent});
  text('title',movieTitle,box([.62,.15,.315,.28]),82,{lines:4,display:true,hierarchy:'primary'});
  const days=draft.schedule?.days || [];
  const schedule=days.length && draft.showSessions!==false?scheduleLabel(days[0],99):'';
  const detail=draft.templateId==='movie-price'?draft.price:draft.templateId==='movie-premiere' || draft.templateId==='movie-presale'?draft.date || schedule:schedule || draft.date;
  const dateHero=['movie-premiere','movie-presale'].includes(draft.templateId) && Boolean(draft.date);
  if(dateHero) {
    text('date-label',draft.content?.primaryDateLabel || (draft.templateId==='movie-presale'?'PRÉ-VENDA':'ESTREIA'),box([.32,.81,.615,.045]),30,{lines:1,fill:'#ffffff'});
    text('detail',detail,box([.32,.865,.615,.12]),66,{lines:2,display:true,fill:atmosphere?.highlight || '#ffffff',hierarchy:'primary'});
  } else text('detail',detail,box([.62,.44,.315,.075]),38,{lines:2,fill:accent});
  if(days.length && ['movie-price','movie-premiere','movie-presale'].includes(draft.templateId))text('description',schedule,box([.62,dateHero?.48:.525,.315,.095]),30,{lines:3,fill:accent});
  text('cta',draft.cta,box([.62,.635,.315,.05]),30,{lines:2,display:true});
  text('website',(draft.actionDestination || '').replace(/^https?:\/\//,'').replace(/\/$/,''),box([.62,.695,.315,.035]),27,{lines:1});
  const logoRatio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const logoWidth=Math.min(w*.19,w*.19*(draft.signatureScale || 100)/100);
  const logoBox={x:w*.065,y:top+area*.88,width:logoWidth,height:Math.min(logoWidth/logoRatio,area*.085)};
  if(logoUrl)image('logo',logoUrl,logoBox,{role:'logo',protected:true,hierarchy:'branding'});
  else if(draft.signatureId!=='none')text('cinema',brand.name,box([.065,.88,.20,.065]),30,{lines:2,fill:'#ffffff'});
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:bg,elements,motion:draft.motion,sourceDraft:{...sourceDraft,officialMovieLayout:true,creativeMovieLayout:true,movieManifest:manifest,signatureReserved:logoBox,editorialSource:sourceUrl,editorialTitle:movieTitle}});
}

module.exports={buildMovieEditorialLight};
