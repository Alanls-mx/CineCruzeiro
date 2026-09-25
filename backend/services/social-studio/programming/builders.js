const {normalizeScene}=require('../scene/schema');
const {wrapText}=require('../scene/factory');
const {programLayout}=require('./direction');
const {programData}=require('./schedule');
const {dayLabel,timeLabel,SAFE}=require('../contracts/artwork-layout');
const {mix}=require('../engine/palette');

function capacity() {
  return Object.assign(new Error('A programação completa não cabe com leitura segura. Selecione um período menor ou divida os filmes em mais de uma arte.'),{code:'PROGRAM_CAPACITY',statusCode:422});
}
function shell({draft,format,brand,palette,logoUrl}) {
  const w=format.width,h=format.height,u=w/1080,m=w*.06,safe=SAFE[format.id];
  const top=Math.max(h*safe.top,h*.06),bottom=Math.min(h*safe.bottom,h*.94);
  const elements=[],manifest=[];
  const mood=draft.programMood || 'cinema';
  const requested=draft.programStyle;
  const style=!requested || requested==='automatic' || requested==='posters' ? (mood==='horror'?'noir':'cinematic') : requested;
  const source=palette.accentColor || '#f4ca18';
  const themes={
    vibrant:{bg:'#ffda38',field:'#ffea72',panel:'#fff0a4',ink:'#20232b',accent:'#453127',rule:'#453127'},
    premium:{bg:'#e9f2f7',field:'#ffffff',panel:'#ffffff',ink:'#173249',accent:'#235b84',rule:'#9fc4dc'},
    noir:{bg:'#1b121b',field:mix(source,'#211925',.18),panel:'#271b26',ink:'#fff6ec',accent:mix(source,'#ffe0ae',.55),rule:mix(source,'#b36663',.35)},
    cinematic:{bg:mix(palette.dominantColor,'#030509',.66),field:mix(palette.secondaryColor,'#030509',.42),panel:mix(palette.dominantColor,'#030509',.60),ink:'#ffffff',accent:mix(source,'#ffffff',.68),rule:mix(source,'#ffffff',.40)},
    editorial:{bg:'#f1f4f2',field:'#ffffff',panel:'#ffffff',ink:'#162b37',accent:'#245978',rule:'#a7b8bb'}
  };
  const theme=themes[style] || themes.cinematic,accent=theme.accent;
  elements.push({id:'program-color-field',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,locked:true,direction:style==='premium'?'right':'bottom',stops:[{offset:0,color:theme.field},{offset:1,color:theme.bg}]});
  if(style==='vibrant') {
    elements.push({id:'program-cross-band-one',role:'ambient',type:'shape',x:w*.44,y:top+15*u,width:w*.54,height:76*u,rotation:-12,opacity:.88,fill:'#f8bd24',locked:true});
    elements.push({id:'program-cross-band-two',role:'ambient',type:'shape',x:w*.53,y:top-30*u,width:w*.45,height:49*u,rotation:15,opacity:.74,fill:'#fff5b4',locked:true});
    elements.push({id:'program-accent-rail',role:'ambient',type:'shape',x:0,y:0,width:w*.018,height:h,fill:theme.rule,locked:true});
    elements.push({id:'program-top-flash',role:'ambient',type:'shape',x:m,y:top+151*u,width:w-2*m,height:5*u,fill:theme.rule,locked:true});
  } else if(style==='noir') {
    elements.push({id:'program-accent-rail',role:'ambient',type:'shape',x:0,y:0,width:w*.018,height:h,fill:theme.rule,locked:true});
    elements.push({id:'program-top-flash',role:'ambient',type:'shape',x:m,y:top+151*u,width:w-2*m,height:5*u,fill:theme.rule,locked:true});
  } else if(style==='premium' || style==='editorial') {
    elements.push({id:'program-top-rule',role:'ambient',type:'shape',x:m,y:top+151*u,width:w-2*m,height:2*u,fill:theme.rule,locked:true});
  }
  const light=['vibrant','premium','editorial'].includes(style);
  const movie=draft.programMovies.find(m=>m.id===draft.featuredMovieId) || draft.programMovies[0];
  if(movie?.backdropUrl || movie?.posterUrl)elements.push({id:'program-atmosphere',role:'ambient',type:'image',src:movie.backdropUrl || movie.posterUrl,x:0,y:0,width:w,height:h,fit:'cover',opacity:light?.12:.62,locked:true,focusX:72,focusY:32,effects:{layer:'background',blur:18,brightness:light?1:.66,saturation:.72,scale:1.18,vignette:42,grain:1,colorWash:16,color:palette.secondaryColor}});
  elements.push({id:'program-reading-wash',role:'ambient',type:'gradient',x:0,y:0,width:w,height:h,locked:true,stops:[{offset:0,color:light?theme.field:'rgba(0,0,0,0.76)'},{offset:.24,color:light?'rgba(255,255,255,0)':'rgba(0,0,0,0.15)'},{offset:.7,color:light?'rgba(255,255,255,0)':'rgba(0,0,0,0.45)'},{offset:1,color:theme.bg}]});
  const tx=(id,value,x,y,width,height,size=36,extra={})=>{
    if(!value)return null;
    const fit=wrapText(value,width,height,size*u,extra.maxLines || 2);
    if(fit.fontSize<(extra.minimum || 28)*u || fit.text.split('\n').length>(extra.maxLines || 2))throw capacity();
    const item={id,name:id,role:id,type:'text',x,y,width,height,visible:true,opacity:1,fontFamily:'Social Text',fontWeight:600,lineHeight:1.12,align:'left',fill:theme.ink,...extra,...fit};
    elements.push(item);manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});return item;
  };
  const im=(id,src,x,y,width,height)=>{if(src)elements.push({id,name:id,role:id==='logo'?'logo':id,type:'image',src,x,y,width,height,fit:'contain',focusX:50,focusY:50,opacity:1,visible:true});};
  const panel=(id,x,y,width,height)=>{
    const at=elements.findIndex(element=>element.type==='text');
    elements.splice(at,0,{id,role:'decorative',type:'shape',x,y,width,height,fill:theme.panel,locked:true});
    elements.splice(at+1,0,{id:`${id}-rule`,role:'decorative',type:'shape',x,y,width,height:4*u,fill:theme.rule,locked:true});
  };
  const model=programData(draft.programMovies),singleDay=model.days.length===1;
  const title=singleDay && /^PROGRAMAÇÃO\s*•/.test(draft.title)?'PROGRAMAÇÃO':draft.title;
  tx('title',title,m,top,w-2*m,singleDay?80*u:116*u,66,{fontFamily:'Social Display',fontWeight:900,hierarchy:'primary',minimum:38});
  if(singleDay)tx('program-date',dayLabel(model.days[0].date),m,top+88*u,w-2*m,52*u,40,{fill:accent,maxLines:1,hierarchy:'secondary'});
  const footer=bottom-90*u;
  tx('cta',draft.cta,m,footer,w*.65,40*u,32,{minimum:26,maxLines:1});
  tx('website',(draft.actionDestination || draft.website || '').replace(/^https?:\/\//,'').replace(/\/$/,''),m,footer+48*u,w*.65,38*u,27,{minimum:24,maxLines:1});
  draft.signatureReserved={x:w*.80,y:bottom-66*u,width:w*.14,height:66*u};
  if(logoUrl)im('logo',logoUrl,...Object.values(draft.signatureReserved));
  else tx('cinema',brand.name,w*.77,bottom-70*u,w*.17,70*u,28,{minimum:24,hierarchy:'branding'});
  const contentTop=top+(singleDay?164:140)*u;
  return {w,h,u,m,accent,singleDay,bg:theme.bg,elements,manifest,tx,im,panel,x:m,y:contentTop,width:w-2*m,height:footer-contentTop-28*u};
}
function scheduleSummary(movie) {
  return programData([movie]).rows.map(row=>`${dayLabel(row.date)} — ${row.times.map(timeLabel).join(' • ')}`).join('\n');
}
function movieBlock(s,movie,index,box,{horizontal=false,posters=true,center=false}={}) {
  const {x,y,width,height}=box,u=s.u,gap=20*u;
  const rows=programData([movie]).rows;
  if(!rows.length)throw capacity();
  const titleH=76*u,rowH=(s.singleDay?78:108)*u,infoH=rows.length*rowH;
  let textX=x,textY=y,textW=width;
  const src=movie.posterUrl || movie.backdropUrl;
  if(posters && src) {
    if(horizontal) {
      const artW=Math.min(width*.50,height*2/3),artH=Math.min(height,artW*1.5);
      s.im(`movie-art-${index}`,src,x,y+(height-artH)/2,artW,artH);textX=x+artW+gap;textW=width-artW-gap;
      textY=y+Math.max(0,(height-titleH-infoH)/2);
    } else {
      const artH=Math.min(height-titleH-infoH-gap,width*1.5);
      if(artH<120*u)throw capacity();
      const artW=Math.min(width,artH*2/3);
      const offset=Math.max(0,(height-artH-titleH-infoH-gap)/2);
      s.im(`movie-art-${index}`,src,x+(width-artW)/2,y+offset,artW,artH);textY=y+offset+artH+gap;
    }
  } else if(height>titleH+infoH+100*u)textY+=Math.min(60*u,(height-titleH-infoH)/3);
  if(textY+titleH+infoH>y+height+1)throw capacity();
  s.tx(`movie-title-${index}`,movie.title,textX,textY,textW,titleH,42,{fontFamily:'Social Display',fontWeight:900,hierarchy:'secondary',minimum:28,align:center?'center':'left'});
  rows.forEach((row,i)=>{
    const ry=textY+titleH+i*rowH;
    if(!s.singleDay)s.tx(`movie-day-${index}-${i}`,dayLabel(row.date),textX,ry,textW,34*u,28,{fill:s.accent,maxLines:1});
    s.tx(`movie-sessions-${index}-${i}`,row.times.map(timeLabel).join(' • '),textX,ry+(s.singleDay?4:38)*u,textW,70*u,36,{fill:s.accent,minimum:28,maxLines:2,hierarchy:'primary',align:center?'center':'left'});
  });
}
function cards(s,model,layout,draft,format) {
  const count=model.movies.length,gap=32*s.u;
  const posters=draft.programPosterMode!=='none';
  if(count===1) {
    movieBlock(s,model.movies[0],0,{x:s.x,y:s.y,width:s.width,height:s.height},{horizontal:format.id!=='story',posters});return;
  }
  if(count===3 && format.id==='story' || count===2 && format.id==='story') {
    const height=(s.height-gap*(count-1))/count;
    model.movies.forEach((movie,i)=>movieBlock(s,movie,i,{x:s.x,y:s.y+i*(height+gap),width:s.width,height},{horizontal:true}));return;
  }
  if(count===5 && format.id!=='square') {
    const rowGap=32*s.u,topH=(s.height-rowGap)*.54;
    model.movies.forEach((movie,i)=>{
      const upper=i<2,columns=upper?2:3,index=upper?i:i-2,width=(s.width-gap*(columns-1))/columns;
      movieBlock(s,movie,i,{x:s.x+index*(width+gap),y:upper?s.y:s.y+topH+rowGap,width,height:upper?topH:s.height-topH-rowGap},{center:true});
    });return;
  }
  const columns=count===3?3:count===2?2:count>4 && format.id!=='story'?3:2;
  const rows=Math.ceil(count/columns),width=(s.width-gap*(columns-1))/columns,height=(s.height-gap*(rows-1))/rows;
  model.movies.forEach((movie,i)=>{
    const box={x:s.x+i%columns*(width+gap),y:s.y+Math.floor(i/columns)*(height+gap),width,height};
    movieBlock(s,movie,i,box,{posters,center:true});
  });
}
function mosaic(s,model,draft,format) {
  if(model.movies.length>4 || model.movies.length===1 || format.id==='square')return cards(s,model,'program-grid',draft,format);
  const gap=32*s.u,lead=model.movies.find(m=>m.id===draft.featuredMovieId) || model.movies[0];
  const rest=model.movies.filter(m=>m!==lead),leadW=s.width*.54;
  movieBlock(s,lead,model.movies.indexOf(lead),{x:s.x,y:s.y,width:leadW,height:s.height});
  const sideW=s.width-leadW-gap,sideH=(s.height-gap*(rest.length-1))/rest.length;
  for(const [i,movie] of rest.entries())movieBlock(s,movie,model.movies.indexOf(movie),{x:s.x+leadW+gap,y:s.y+i*(sideH+gap),width:sideW,height:sideH},{horizontal:rest.length>2});
}
function list(s,model,draft) {
  // Day groups are indivisible. Reading order is down each column, then right.
  const u=s.u,featured=draft.programPosterMode==='featured' && model.movies.find(m=>m.id===draft.featuredMovieId);
  const feature=featured && model.rows.length<=4 && model.days.length===1 && (featured.posterUrl || featured.backdropUrl);
  if(feature)s.im(`movie-art-${model.movies.indexOf(featured)}`,featured.posterUrl || featured.backdropUrl,s.x,s.y,s.width*.30,s.height*.72);
  const startX=feature?s.x+s.width*.35:s.x,width=feature?s.width*.65:s.width;
  const columns=!feature && model.days.length>1 && model.rows.length>6?2:1,gap=40*u;
  const colW=(width-(columns-1)*gap)/columns;
  const timeWidth=colW*(columns===2?.28:.22);
  const density=Math.min(1.65,Math.max(1,s.height/(model.rows.length*(columns===2?65:100)*u+model.days.length*82*u)));
  const titleSize=Math.min(56,36*density),timeSize=Math.min(44,32*density);
  const dayHeader=s.singleDay?0:58*u,dayGap=s.singleDay?0:24*u;
  const selectedMovies=model.movies;
  const imageFor=row=>selectedMovies.find(movie=>movie.id===row.movieId);
  const baseRows=model.days.flatMap(day=>day.rows.map(row=>{
    const titleWidth=colW-timeWidth-(imageFor(row)?Math.min(70*u,colW*.14):0)-24*u;
    const fit=wrapText(row.title,titleWidth,110*u,titleSize*u,2);
    const times=wrapText(row.times.map(timeLabel).join(' • '),timeWidth,100*u,timeSize*u,2);
    if(fit.fontSize<28*u || times.fontSize<28*u || fit.text.split('\n').length>2 || times.text.split('\n').length>2)throw capacity();
    return {row,base:Math.max(fit.text.split('\n').length*fit.fontSize*1.12,times.text.split('\n').length*times.fontSize*1.12)+26*u*density};
  }));
  const baseTotal=baseRows.reduce((sum,item)=>sum+item.base,0)+model.days.length*(dayHeader+dayGap);
  const stretch=columns===1?Math.max(0,(s.height-baseTotal)/baseRows.length):0;
  const heights=new Map(baseRows.map(item=>[item.row,item.base+stretch]));
  const minHeight=Math.min(...heights.values());
  const artWidth=Math.min(colW*(columns===2?.16:.30),Math.max(0,(minHeight-12*u)*2/3),240*u);
  const seen=new Set();
  let x=startX,y=s.y,col=0;
  for(const day of model.days) {
    const prepared=day.rows.map(row=>({row,height:heights.get(row)}));
    const dayH=dayHeader+prepared.reduce((n,r)=>n+r.height,0)+dayGap;
    if(y+dayH>s.y+s.height+1 && columns>1 && col===0) {col=1;x=startX+colW+gap;y=s.y;}
    if(y+dayH>s.y+s.height+1)throw capacity();
    if(!s.singleDay)s.tx(`program-day-${model.days.indexOf(day)}`,dayLabel(day.date),x,y,colW,40*u,32,{fill:s.accent,maxLines:1});y+=dayHeader;
    for(const {row,height} of prepared) {
      const index=model.movies.findIndex(m=>m.id===row.movieId),rowIndex=model.rows.indexOf(row);
      const id=seen.has(row.movieId)?`program-film-${rowIndex}`:`movie-title-${index}`;
      seen.add(row.movieId);
      const movie=imageFor(row),src=movie?.posterUrl || movie?.backdropUrl;
      const art=src && artWidth>=28*u?artWidth:0;
      const rowArt=art && (!feature || row.movieId!==featured.id);
      if(rowArt)s.im(`movie-art-${index}-${rowIndex}`,src,x,y+(height-art*1.5)/2,art,art*1.5);
      const copyX=x+(rowArt?art+18*u:0);
      const stacked=columns===1 && rowArt && height>=150*u;
      const titleWidth=colW-(stacked?0:timeWidth)-(copyX-x)-20*u;
      const copyY=y+(stacked?Math.max(0,(height-166*u)/2):height>140*u?Math.min(42*u,(height-100*u)/2):0);
      const copyH=stacked?78*u:height-(copyY-y)-8*u;
      const displayTitle=!art && model.rows.length<=4?Math.min(72,titleSize*1.28):titleSize;
      const displayTime=!art && model.rows.length<=4?Math.min(54,timeSize*1.20):timeSize;
      s.tx(id,row.title,copyX,copyY,titleWidth,copyH,displayTitle,{fontFamily:'Social Display',hierarchy:'secondary'});
      s.tx(`program-time-${rowIndex}`,row.times.map(timeLabel).join(' • '),stacked?copyX:x+colW-timeWidth,stacked?copyY+copyH+10*u:copyY,stacked?titleWidth:timeWidth,stacked?height-(copyY-y)-copyH-14*u:copyH,displayTime,{fill:s.accent,hierarchy:'primary'});
      y+=height;
    }
    y+=dayGap;
  }
}
function buildProgrammingScene(args) {
  const {draft,format}=args,model=programData(draft.programMovies);
  if(draft.programImagesRequired) {
    const missing=model.movies.filter(movie=>!movie.posterUrl && !movie.backdropUrl);
    if(missing.length)throw Object.assign(new Error(`Adicione um pôster ou imagem em Filmes para: ${missing.map(movie=>movie.title).join(', ')}. A programação precisa das imagens para ser criada.`),{code:'PROGRAM_IMAGES_REQUIRED',statusCode:422});
  }
  if(!model.rows.length || model.movies.some(m=>!model.rows.some(r=>r.movieId===m.id)))throw capacity();
  let layout=programLayout(draft,model.movies.length),s=shell(args);
  if(draft.programPosterMode==='featured' && draft.featuredMovieId && model.movies.length>1)layout=model.movies.length<=4?'program-grid':'program-list';
  if(['program-list','program-days'].includes(layout))list(s,model,draft);
  else {
    try {
      if(layout==='program-grid')mosaic(s,model,draft,format);
      else cards(s,model,layout,draft,format);
    } catch(error) {
      if(error.code!=='PROGRAM_CAPACITY')throw error;
      s=shell(args);layout='program-list';list(s,model,draft);
    }
  }
  if(s.elements.length>80)throw capacity();
  draft.resolvedProgramLayout=layout;
  const {entities,...sourceDraft}=draft;
  sourceDraft.officialProgramLayout=true;
  sourceDraft.programCampaignVersion=2;
  sourceDraft.programArtworkHierarchy=layout==='program-grid' || draft.programPosterMode==='featured';
  sourceDraft.programManifest=s.manifest;
  sourceDraft.programImageIds=s.elements.filter(e=>e.id.startsWith('movie-art-')).map(e=>e.id);
  sourceDraft.programSessionCount=model.count;
  sourceDraft.programReadingColumns=['program-list','program-days'].includes(layout);
  sourceDraft.programReadingOrder=s.elements.filter(e=>/^movie-title-|^program-film-/.test(e.id)).sort((a,b)=>sourceDraft.programReadingColumns?a.x-b.x || a.y-b.y:a.y-b.y || a.x-b.x).map(e=>e.id);
  sourceDraft.programBindings=model.rows.map((row,i)=>{
    const movieIndex=model.movies.findIndex(m=>m.id===row.movieId);
    const anchorId=sourceDraft.programReadingColumns && model.rows.slice(0,i).some(r=>r.movieId===row.movieId)?`program-film-${i}`:`movie-title-${movieIndex}`;
    const movieRow=model.rows.filter(r=>r.movieId===row.movieId).indexOf(row);
    const id=sourceDraft.programReadingColumns?`program-time-${i}`:`movie-sessions-${movieIndex}-${movieRow}`;
    const anchor=s.elements.find(e=>e.id===anchorId),item=s.elements.find(e=>e.id===id);
    return {id,anchorId,dx:item.x-anchor.x,dy:item.y-anchor.y};
  });
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:s.w,height:s.h,backgroundColor:s.bg,elements:s.elements,motion:draft.motion,sourceDraft});
}
module.exports={buildProgrammingScene,buildTodaySessionsScene:buildProgrammingScene,buildWeekSessionsScene:buildProgrammingScene,buildMultiMovieScene:buildProgrammingScene,scheduleSummary};
