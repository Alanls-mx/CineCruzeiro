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
  const accent=mix(palette.accentColor || '#f4ca18','#ffffff',.45);
  if(draft.programStyle==='cinematic') {
    const movie=draft.programMovies[0];
    if(movie?.backdropUrl || movie?.posterUrl)elements.push({id:'program-atmosphere',role:'ambient',type:'image',src:movie.backdropUrl || movie.posterUrl,x:0,y:0,width:w,height:h,fit:'cover',opacity:.16,locked:true,effects:{layer:'background',blur:40,brightness:.5,saturation:.25,scale:1.2}});
  }
  const tx=(id,value,x,y,width,height,size=36,extra={})=>{
    if(!value)return null;
    const fit=wrapText(value,width,height,size*u,extra.maxLines || 2);
    if(fit.fontSize<(extra.minimum || 28)*u || fit.text.split('\n').length>(extra.maxLines || 2))throw capacity();
    const item={id,name:id,role:id,type:'text',x,y,width,height,visible:true,opacity:1,fontFamily:'Social Text',fontWeight:600,lineHeight:1.12,align:'left',fill:'#ffffff',...extra,...fit};
    elements.push(item);manifest.push({id,text:String(value).replace(/\s+/g,' ').trim()});return item;
  };
  const im=(id,src,x,y,width,height)=>{if(src)elements.push({id,name:id,role:id==='logo'?'logo':id,type:'image',src,x,y,width,height,fit:'contain',focusX:50,focusY:50,opacity:1,visible:true});};
  tx('title',draft.title,m,top,w-2*m,116*u,62,{fontFamily:'Social Display',fontWeight:900,hierarchy:'primary',minimum:38});
  const footer=bottom-90*u;
  tx('cta',draft.cta,m,footer,w*.65,40*u,32,{minimum:26,maxLines:1});
  tx('website',(draft.actionDestination || draft.website || '').replace(/^https?:\/\//,'').replace(/\/$/,''),m,footer+48*u,w*.65,38*u,27,{minimum:24,maxLines:1});
  draft.signatureReserved={x:w*.80,y:bottom-66*u,width:w*.14,height:66*u};
  if(logoUrl)im('logo',logoUrl,...Object.values(draft.signatureReserved));
  else tx('cinema',brand.name,w*.77,bottom-70*u,w*.17,70*u,28,{minimum:24,hierarchy:'branding'});
  return {w,h,u,m,accent,elements,manifest,tx,im,x:m,y:top+140*u,width:w-2*m,height:footer-top-168*u};
}
function scheduleSummary(movie) {
  return programData([movie]).rows.map(row=>`${dayLabel(row.date)} — ${row.times.map(timeLabel).join(' • ')}`).join('\n');
}
function movieBlock(s,movie,index,box,{horizontal=false,posters=true}={}) {
  const {x,y,width,height}=box,u=s.u,gap=20*u;
  const rows=programData([movie]).rows;
  if(!rows.length)throw capacity();
  const titleH=78*u,infoH=rows.length*82*u;
  let textX=x,textY=y,textW=width;
  const src=movie.posterUrl || movie.backdropUrl;
  if(posters && src) {
    if(horizontal) {
      const artW=Math.min(width*.37,height*2/3),artH=Math.min(height,artW*1.5);
      s.im(`movie-art-${index}`,src,x,y,artW,artH);textX=x+artW+gap;textW=width-artW-gap;
    } else {
      const artH=height-titleH-infoH-gap;
      if(artH<120*u)throw capacity();
      const artW=Math.min(width,artH*2/3);
      s.im(`movie-art-${index}`,src,x,y,artW,artH);textY=y+artH+gap;
    }
  } else if(height>titleH+infoH+100*u)textY+=Math.min(60*u,(height-titleH-infoH)/3);
  if(textY+titleH+infoH>y+height+1)throw capacity();
  s.tx(`movie-title-${index}`,movie.title,textX,textY,textW,titleH,42,{fontFamily:'Social Display',fontWeight:900,hierarchy:'secondary',minimum:30});
  rows.forEach((row,i)=>{
    const ry=textY+titleH+i*82*u;
    s.tx(`movie-day-${index}-${i}`,dayLabel(row.date),textX,ry,textW,34*u,28,{fill:s.accent,maxLines:1});
    s.tx(`movie-sessions-${index}-${i}`,row.times.map(timeLabel).join(' • '),textX,ry+38*u,textW,44*u,34,{minimum:28,maxLines:1,hierarchy:'primary'});
  });
}
function cards(s,model,layout,draft,format) {
  const count=model.movies.length,gap=32*s.u;
  const posters=draft.programPosterMode!=='none' && draft.programStyle!=='editorial';
  if(count===1) {
    movieBlock(s,model.movies[0],0,{x:s.x,y:s.y,width:s.width,height:s.height},{horizontal:format.id!=='story',posters});return;
  }
  const columns=count===2?format.id==='story'?1:2:count>4 && format.id!=='story'?3:2;
  const rows=Math.ceil(count/columns),width=(s.width-gap*(columns-1))/columns,height=(s.height-gap*(rows-1))/rows;
  model.movies.forEach((movie,i)=>movieBlock(s,movie,i,{x:s.x+i%columns*(width+gap),y:s.y+Math.floor(i/columns)*(height+gap),width,height},{horizontal:count===2 && format.id==='story',posters}));
}
function list(s,model,draft) {
  // Day groups are indivisible. Reading order is down each column, then right.
  const u=s.u,featured=draft.programPosterMode==='featured' && model.movies.find(m=>m.id===draft.featuredMovieId);
  const feature=featured && model.rows.length<=4 && model.days.length===1;
  if(feature)s.im(`movie-art-${model.movies.indexOf(featured)}`,featured.posterUrl || featured.backdropUrl,s.x,s.y,s.width*.33,s.height);
  const startX=feature?s.x+s.width*.38:s.x,width=feature?s.width*.62:s.width;
  const columns=!feature && model.days.length>1 && model.rows.length>6?2:1,gap=40*u;
  const colW=(width-(columns-1)*gap)/columns;
  const titleWidth=colW*.65-20*u,timeWidth=colW*.35;
  const density=Math.min(1.65,Math.max(1,s.height/(model.rows.length*(columns===2?65:100)*u+model.days.length*82*u)));
  const titleSize=Math.min(56,36*density),timeSize=Math.min(44,32*density);
  const seen=new Set();
  let x=startX,y=s.y,col=0;
  for(const day of model.days) {
    const prepared=day.rows.map(row=>{
      const fit=wrapText(row.title,titleWidth,110*u,titleSize*u,2);
      const times=wrapText(row.times.map(timeLabel).join(' • '),timeWidth,100*u,timeSize*u,2);
      if(fit.fontSize<28*u || times.fontSize<28*u || times.text.split('\n').length>2)throw capacity();
      const height=Math.max(fit.text.split('\n').length*fit.fontSize*1.12,times.text.split('\n').length*times.fontSize*1.12)+26*u*density;
      return {row,height};
    });
    const dayH=58*u+prepared.reduce((n,r)=>n+r.height,0)+24*u;
    if(y+dayH>s.y+s.height+1 && columns>1 && col===0) {col=1;x=startX+colW+gap;y=s.y;}
    if(y+dayH>s.y+s.height+1)throw capacity();
    s.tx(`program-day-${model.days.indexOf(day)}`,dayLabel(day.date),x,y,colW,40*u,32,{fill:s.accent,maxLines:1});y+=58*u;
    for(const {row,height} of prepared) {
      const index=model.movies.findIndex(m=>m.id===row.movieId),rowIndex=model.rows.indexOf(row);
      const id=seen.has(row.movieId)?`program-film-${rowIndex}`:`movie-title-${index}`;
      seen.add(row.movieId);
      s.tx(id,row.title,x,y,titleWidth,height-16*u,titleSize,{fontFamily:'Social Display',hierarchy:'secondary'});
      s.tx(`program-time-${rowIndex}`,row.times.map(timeLabel).join(' • '),x+colW-timeWidth,y,timeWidth,height-16*u,timeSize,{hierarchy:'primary'});
      y+=height;
    }
    y+=24*u;
  }
}
function buildProgrammingScene(args) {
  const {draft,format}=args,model=programData(draft.programMovies);
  if(!model.rows.length || model.movies.some(m=>!model.rows.some(r=>r.movieId===m.id)))throw capacity();
  let layout=programLayout(draft,model.movies.length),s=shell(args);
  // Multiple dates use day-first structure; a card cannot scatter the same day.
  if(model.days.length>1)layout='program-days';
  if(draft.programPosterMode==='featured' && draft.featuredMovieId && model.movies.length>1)layout='program-list';
  if(['program-list','program-days'].includes(layout))list(s,model,draft);
  else {
    try {cards(s,model,layout,draft,format);} catch(error) {
      if(error.code!=='PROGRAM_CAPACITY')throw error;
      s=shell(args);layout='program-list';list(s,model,draft);
    }
  }
  if(s.elements.length>80)throw capacity();
  draft.resolvedProgramLayout=layout;
  const {entities,...sourceDraft}=draft;
  sourceDraft.officialProgramLayout=true;
  sourceDraft.programManifest=s.manifest;
  sourceDraft.programSessionCount=model.count;
  sourceDraft.programReadingColumns=['program-list','program-days'].includes(layout);
  sourceDraft.programReadingOrder=s.elements.filter(e=>/^movie-title-|^program-film-/.test(e.id)).sort((a,b)=>sourceDraft.programReadingColumns?a.x-b.x || a.y-b.y:a.y-b.y || a.x-b.x).map(e=>e.id);
  sourceDraft.programBindings=model.rows.map((row,i)=>{
    const movieIndex=model.movies.findIndex(m=>m.id===row.movieId);
    const anchorId=sourceDraft.programReadingColumns && model.rows.slice(0,i).some(r=>r.movieId===row.movieId)?`program-film-${i}`:`movie-title-${movieIndex}`;
    const id=sourceDraft.programReadingColumns?`program-time-${i}`:`movie-sessions-${movieIndex}-0`;
    const anchor=s.elements.find(e=>e.id===anchorId),item=s.elements.find(e=>e.id===id);
    return {id,anchorId,dx:item.x-anchor.x,dy:item.y-anchor.y};
  });
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:s.w,height:s.h,backgroundColor:'#101216',elements:s.elements,motion:draft.motion,sourceDraft});
}
module.exports={buildProgrammingScene,buildTodaySessionsScene:buildProgrammingScene,buildWeekSessionsScene:buildProgrammingScene,buildMultiMovieScene:buildProgrammingScene,scheduleSummary};
