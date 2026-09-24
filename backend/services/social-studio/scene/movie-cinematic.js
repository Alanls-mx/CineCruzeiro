const {normalizeScene}=require('./schema');
const {wrapText}=require('./factory');
const {mix,hexToRgb}=require('../engine/palette');
const alpha=(hex,a)=>{const {r,g,b}=hexToRgb(hex);return `rgba(${r},${g},${b},${a})`;};
const {SAFE}=require('../contracts/artwork-layout');

function sessionCopy(draft) {
  const day=draft.schedule?.days?.[0];
  if(!day || draft.showSessions===false)return '';
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'numeric',month:'long'}).format(new Date(`${day.date}T12:00:00Z`)).toUpperCase();
  return `${date} • ${day.times.join(' • ')}`;
}
function buildMovieCinematic({draft,format,palette,brand,sourceUrl,backgroundUrl,logoUrl}) {
  const w=format.width,h=format.height,safe=SAFE[format.id],top=h*safe.top,area=h*(safe.bottom-safe.top),u=w/1080;
  const family=draft.movieFamily,dir=draft.movieDirection || {},side=dir.copySide || 'left';
  const plans={
    'movie-spotlight':{art:[0,-.06,1,.66],title:[.065,.57,.87,.07],data:[.065,.66,.87,.205],cover:true,posterCrop:true},
    'movie-full-bleed':{art:[0,-.06,1,.70],title:[.065,.63,.87,.10],data:[.065,.755,.87,.105],cover:true},
    'movie-character':{art:[side==='left'?.40:0,-.03,.60,.84],title:[side==='left'?.065:.64,.22,.295,.23],data:[side==='left'?.065:.64,.48,.295,.28],cover:true},
    'movie-asymmetric':{art:[.43,.015,.53,.69],title:[.065,.08,.335,.29],data:[.065,.74,.87,.115]},
    'movie-immersive':{art:[.06,.01,.88,.63],title:[.065,.67,.56,.125],data:[.67,.67,.265,.175]},
    'cinematic-blend':{art:[side==='left'?.44:.035,.025,.525,.77],title:[side==='left'?.065:.625,.16,.31,.235],data:[side==='left'?.065:.625,.45,.31,.31]}
  };
  const plan=plans[family] || plans['cinematic-blend'];
  if(format.id==='square' && family==='movie-immersive') {plan.art=[.20,0,.60,.60];plan.title=[.065,.63,.52,.17];plan.data=[.63,.63,.305,.19];}
  const box=rect=>({x:rect[0]*w,y:top+rect[1]*area,width:rect[2]*w,height:rect[3]*area});
  const elements=[],manifest=[];
  const dark=dir.genre==='horror',bg=mix(palette.dominantColor,'#101216',dark?.60:.32),accent=mix(palette.accentColor,'#ffffff',.48);
  const image=(id,src,bounds,extra={})=>{if(src)elements.push({id,name:id,role:id,type:'image',src,...bounds,fit:'contain',opacity:1,visible:true,...extra});};
  const tx=(id,value,bounds,size,extra={})=>{
    if(!value)return;
    const fit=wrapText(id==='title'?String(value).replace(/-(?=\S)/g,'- '):value,bounds.width,bounds.height,size*u,extra.lines || 3);
    if(id==='title')fit.text=fit.text.replace(/- +/g,'-');
    elements.push({id,name:id,role:id,type:'text',...bounds,...fit,fontFamily:id==='title'?'Social Display':'Social Text',fontWeight:id==='title'?900:600,fill:id==='detail'?accent:'#ffffff',lineHeight:1.12,align:'left',opacity:1,visible:true,hierarchy:id==='title'?'primary':'secondary',...extra});
    if(extra.visible!==false)manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});
  };
  image('background-blur',backgroundUrl || sourceUrl,{x:0,y:0,width:w,height:h},{role:'background',fit:'cover',focusX:dir.focusX>50?25:75,focusY:60,opacity:dark?.74:.96,effects:{layer:'background',blur:family==='movie-full-bleed'?12:28,brightness:dark?.56:.86,saturation:dark?.70:1.02,scale:1.3,mask:'none'}});
  elements.push({id:'cinematic-wash',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,direction:side==='left'?'right':'left',stops:[{offset:0,color:alpha(bg,.88)},{offset:.62,color:alpha(bg,.2)},{offset:1,color:alpha(bg,.03)}],opacity:1});
  const heroSource=plan.cover && !plan.posterCrop?backgroundUrl:sourceUrl;
  let hero=box(plan.art);
  if(heroSource && !plan.cover) {
    const ratio=draft.sourceAsset?.width/draft.sourceAsset?.height || 2/3;
    const width=Math.min(hero.width,hero.height*ratio),height=width/ratio;
    hero={x:hero.x+(hero.width-width)/2,y:hero.y+(hero.height-height)/2,width,height};
  }
  if(heroSource) {
    if(!plan.cover)image('ambient-shadow',heroSource,{...hero,x:hero.x+14*u,y:hero.y+18*u},{role:'ambient',fit:'contain',effects:{layer:'ambient-shadow',mask:'fade-all',blend:35,shadow:28,scale:1}});
    image('artwork',heroSource,hero,{role:'artwork',fit:plan.cover?'cover':'contain',keepRatio:true,locked:true,focusX:dir.focusX,focusY:plan.posterCrop?18:dir.focusY,hierarchy:'primary',effects:{layer:'hero',mask:plan.cover?'cinematic-bottom':'fade-all',blend:plan.cover?65:24,brightness:1,scale:1}});
  }
  // Typography has reserved zones outside the sharp artwork, even in full-bleed compositions.
  const titleBox=box(plan.title),dataBox=box(plan.data);
  tx('title',draft.title || draft.entities.movie?.title,titleBox, family==='movie-asymmetric'?108:family==='movie-spotlight'?54:94,{lines:4,visible:!draft.artworkPolicy?.hideTitle});
  const session=sessionCopy(draft);
  const dateOnly=!draft.artworkPolicy?.hideDate && draft.date && draft.date!=='EM BREVE'?`${draft.content?.primaryDateLabel || 'DIA'} ${draft.date}`:'';
  const commercial=draft.templateId==='movie-price';
  const premiere=['movie-premiere','movie-presale'].includes(draft.templateId);
  const normalizedDate=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const sessionDetails=premiere && normalizedDate(draft.date)===normalizedDate(session.split(' • ')[0])?draft.schedule.days[0].times.join(' • '):session;
  if(family==='movie-spotlight') {
    const day=draft.schedule?.days?.[0];
    const label=commercial?'INGRESSOS':premiere?draft.content?.primaryDateLabel || 'ESTREIA':day?'SESSÕES':'EM BREVE';
    tx('subtitle',label,{...dataBox,height:dataBox.height*.16},28,{lines:1});
    const main=commercial?draft.price:premiere?draft.date:session?session.split(' • ')[0]:draft.date || 'EM BREVE';
    tx('detail',main,{...dataBox,y:dataBox.y+dataBox.height*.20,height:dataBox.height*.43},104,{fontFamily:'Social Display',fontWeight:900,lines:1,shadowBlur:12,shadowColor:alpha(palette.accentColor,.42)});
    if(session)tx('description',premiere?sessionDetails:day.times.join(' • '),{...dataBox,y:dataBox.y+dataBox.height*.70,height:dataBox.height*.25},36,{lines:2});
  } else if(commercial || premiere && dateOnly) {
    const detailH=dataBox.height*(session?.48:1);
    tx('detail',commercial?draft.price:dateOnly,{...dataBox,height:detailH},commercial?64:42,{lines:3});
    if(session)tx('description',commercial?session:sessionDetails,{...dataBox,y:dataBox.y+detailH+12*u,height:dataBox.height-detailH-12*u},34,{lines:4});
  } else if(session) {
    const [date,...times]=session.split(' • '),dateH=dataBox.height*.50;
    tx('detail',date,{...dataBox,height:dateH},42,{lines:2});
    tx('description',times.join(' • '),{...dataBox,y:dataBox.y+dateH+8*u,height:dataBox.height-dateH-8*u},40,{lines:3});
  }
  else if(!draft.artworkPolicy?.hideDate)tx('detail',dateOnly || 'EM BREVE',dataBox,46,{lines:3});
  const footer=box([.065,.905,.60,.038]);
  const footY=top+area*.88;
  // This foreground veil joins the atmosphere and action area without a hard footer bar.
  elements.splice(2,0,{id:'foreground-gradient',role:'ambient',type:'gradient',x:0,y:footY-area*.10,width:w,height:h-footY+area*.10,direction:'bottom',stops:[{offset:0,color:alpha(bg,0)},{offset:.45,color:alpha(bg,.86)},{offset:1,color:bg}],opacity:1});
  tx('cta',draft.cta,footer,34,{lines:1,hierarchy:'tertiary'});
  tx('website',(draft.actionDestination || '').replace(/^https?:\/\//,'').replace(/\/$/,''),box([.065,.955,.60,.032]),26,{lines:1,hierarchy:'tertiary'});
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const lw=Math.min(w*.16,w*.14*(draft.signatureScale || 100)/100),lh=Math.min(lw/ratio,area*.075);
  const logoBox={x:w*.935-lw,y:footer.y,width:lw,height:lh};
  image('logo',logoUrl,logoBox,{role:'logo',hierarchy:'branding',protected:true});
  if(!logoUrl && draft.signatureId!=='none')tx('cinema',brand.name,box([.74,.905,.195,.08]),26,{lines:2,hierarchy:'branding'});
  const primaryId={movieLogo:'artwork',symbol:'artwork',artwork:'artwork',date:'detail',price:'detail',title:'title'}[draft.primaryElement] || 'artwork';
  for(const e of elements)if(e.hierarchy==='primary')e.hierarchy='secondary';
  const primary=elements.find(e=>e.id===primaryId && e.visible!==false);
  if(primary)primary.hierarchy='primary';
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:bg,elements,motion:draft.motion,sourceDraft:{...sourceDraft,officialMovieLayout:true,creativeMovieLayout:true,movieManifest:manifest,heroUsesBackdrop:Boolean(plan.cover && !plan.posterCrop),heroUsesPosterCrop:Boolean(plan.posterCrop),signatureReserved:logoBox,editorialSource:heroSource,editorialTitle:draft.title}});
}
module.exports={buildMovieCinematic,sessionCopy};
