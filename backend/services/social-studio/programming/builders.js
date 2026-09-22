const {normalizeScene}=require('../scene/schema');
const {wrapText}=require('../scene/factory');
const {wrapSchedule}=require('../scene/content-layout');
const {programLayout}=require('./direction');

function shell({draft,format,brand,palette,logoUrl,baseScene}) {
  const w=format.width,h=format.height,m=w*.06;
  const top=h*(format.id==='story'?.075:.045),bottom=h*(format.id==='story'?.89:.955);
  const elements=(baseScene?.elements || []).filter(e=>['background-blur','background-wash','atmosphere','vignette'].includes(e.id)).map(e=>({...e,width:w,height:h}));
  if(!elements.some(e=>e.id==='background-blur')) {
    const movie=draft.programMovies.find(m=>m.featured) || draft.programMovies[0];
    if(movie?.posterUrl) elements.push({id:'background-blur',type:'image',src:movie.backdropUrl || movie.posterUrl,x:0,y:0,width:w,height:h,fit:'cover',effects:{layer:'background',blur:28,brightness:.45,saturation:.8,scale:1.25},locked:true});
  }
  elements.push({id:'program-wash',type:'gradient',x:0,y:0,width:w,height:h,direction:'bottom',stops:[{offset:0,color:'rgba(0,0,0,0.65)'},{offset:.5,color:'rgba(0,0,0,0.2)'},{offset:1,color:'#080a10'}],locked:true});
  const tx=(id,value,x,y,width,height,size=40,extra={})=>{
    const fit=String(value).includes('\n')?wrapSchedule(value,width,height,size):wrapText(value,width,height,size,4);
    const item={id,name:id,role:id,type:'text',x,y,width,height,visible:true,opacity:1,fontFamily:'Social Text',fontWeight:600,lineHeight:1.12,align:'left',fill:'#ffffff',...fit,...extra};
    elements.push(item);return item;
  };
  const im=(id,src,x,y,width,height,extra={})=>{
    if(!src) return;
    const item={id,name:id,role:id,type:'image',src,x,y,width,height,fit:'contain',focusX:50,focusY:50,opacity:1,visible:true,...extra};elements.push(item);return item;
  };
  tx('subtitle',draft.subtitle,m,top,w-2*m,h*.035,28,{fill:palette.accentColor});
  tx('title',draft.title,m,top+h*.042,w-2*m,h*.09,64,{fontFamily:'Social Display',fontWeight:900,hierarchy:'primary'});
  const ctaY=bottom-h*.132;
  tx('cta',draft.cta,m,ctaY,w*.88,h*.036,34);
  tx('website',(draft.actionDestination || draft.website).replace(/^https?:\/\//,'').replace(/\/$/,''),m,ctaY+h*.04,w*.88,h*.03,27);
  tx('cinema',brand.name,m,bottom-h*.035,w*.57,h*.03,25,{hierarchy:'branding'});
  im('logo',logoUrl,w*.70,bottom-h*.047,w*.24,h*.047,{role:'logo'});
  return {w,h,m,top,bottom,x:m,y:top+h*.155,width:w-2*m,height:ctaY-top-h*.185,elements,tx,im};
}

function scheduleSummary(movie, maxDays=2, maxTimes=3) {
  const days=movie.schedule.days;
  const lines=days.slice(0,maxDays).map(day=>`${day.date.slice(8,10)}/${day.date.slice(5,7)}  ${day.times.slice(0,maxTimes).join(' • ')}${day.times.length>maxTimes?' +':''}`);
  if(days.length>maxDays) lines.push('+ sessões no site');
  return lines.join('\n') || 'Novas sessões em breve';
}

function movieBlock(s,movie,index,box,{horizontal=false,reverse=false,mask='cinematic-bottom',prominent=false,showSessions=true,overlap=false}={}) {
  const {x,y,width,height}=box;
  const titleH=horizontal?height*.32:Math.max(42,Math.min(76,height*.20));
  const sessionsH=showSessions?(horizontal?height*.60:Math.max(54,Math.min(90,height*.25))):0;
  const artH=horizontal?height:height-titleH-sessionsH-14;
  const artW=horizontal?width*.25:width;
  const textX=horizontal && !reverse?x+width*.30:x;
  const textW=horizontal?width*.70:width;
  const textY=horizontal?y:y+artH+6;
  s.im(`movie-art-${index}`,movie.posterUrl,reverse?x+width*.75:x,y,artW,artH,{effects:{layer:'hero',mask,blend:mask==='none'?0:55,brightness:1,scale:1},rotation:overlap?(index%2?-3:3):0});
  s.tx(`movie-title-${index}`,movie.title,textX,textY,textW,titleH,prominent?52:36,{fontFamily:'Social Display',fontWeight:900,hierarchy:'secondary'});
  if(showSessions) {
    let text=scheduleSummary(movie,horizontal && height>220?2:1,3);
    if(sessionsH<80 && text.includes('\n')) text=text.split('\n')[0];
    s.tx(`movie-sessions-${index}`,text,textX,textY+titleH+6,textW,sessionsH,prominent?34:26,{hierarchy:'primary'});
  }
}

function finish(s,draft,format) {
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:s.w,height:s.h,backgroundColor:'#080a10',elements:s.elements,motion:draft.motion,sourceDraft});
}

function buildMultiMovieScene(args) {
  const {draft,format}=args,s=shell(args),movies=draft.programMovies,count=movies.length;
  const layout=programLayout(draft,count);draft.resolvedProgramLayout=layout;
  const gap=s.w*.022,slots=Array(count),featured=Math.max(0,movies.findIndex(m=>m.featured));
  const remaining=movies.map((_,i)=>i).filter(i=>i!==featured);
  const grid=(indices,box,columns)=>{
    const rows=Math.ceil(indices.length/columns),width=(box.width-gap*(columns-1))/columns,height=(box.height-gap*(rows-1))/rows;
    indices.forEach((index,i)=>{slots[index]={x:box.x+i%columns*(width+gap),y:box.y+Math.floor(i/columns)*(height+gap),width,height};});
  };
  const region={x:s.x,y:s.y,width:s.width,height:s.height};
  if(layout==='lineup' || layout==='film-strip') {
    const rows=count>4?Math.ceil(count/2):count,cols=count>4?2:1;
    grid(movies.map((_,i)=>i),region,cols);
    slots.forEach(slot=>{slot.horizontal=true;});
    if(layout==='film-strip') s.elements.push({id:'film-strip-rule',type:'shape',x:s.x,y:s.y-8,width:s.width,height:2,fill:args.palette.accentColor,opacity:.65});
  } else if(['featured','mosaic'].includes(layout) && count>2) {
    if(format.id==='story' || layout==='mosaic') {
      slots[featured]={x:s.x,y:s.y,width:s.width,height:s.height*.39,horizontal:true};
      grid(remaining,{x:s.x,y:s.y+s.height*.43,width:s.width,height:s.height*.57},count>4?3:remaining.length);
    } else {
      slots[featured]={x:s.x,y:s.y,width:s.width*.47,height:s.height};
      grid(remaining,{x:s.x+s.width*.51,y:s.y,width:s.width*.49,height:s.height},count>4?2:1);
      if(count<=4) remaining.forEach(i=>{slots[i].horizontal=true;});
    }
  } else if(layout==='panorama') {
    grid(movies.map((_,i)=>i),region,format.id==='story'?2:Math.min(3,count));
    slots.forEach(slot=>{slot.horizontal=slot.width>slot.height*1.3;});
  } else {
    grid(movies.map((_,i)=>i),region,count<=2?2:format.id==='square' && count>4?3:count===3 && format.id!=='story'?3:2);
    if(layout==='layered' || layout==='collage') slots.forEach((slot,i)=>{const dy=Math.min(18,slot.height*.04)*(i%2?-1:1);slot.y+=dy;slot.height-=Math.abs(dy);});
  }
  movies.forEach((movie,i)=>movieBlock(s,movie,i,slots[i],{horizontal:slots[i].horizontal,reverse:layout==='mosaic' && i%2===1,mask:layout==='cinematic-grid'?'soft-edge':layout==='collage'?'radial':'cinematic-bottom',prominent:i===featured && layout==='featured',showSessions:draft.showSessions,overlap:layout==='layered'}));
  return finish(s,draft,format);
}

function buildScheduleScene(args,week) {
  const {draft,format}=args,s=shell(args),movies=draft.programMovies;
  const layout=programLayout(draft,movies.length);draft.resolvedProgramLayout=layout;
  const feature=Math.max(0,movies.findIndex(m=>m.featured)),movie=movies[feature];
  const gap=s.w*.025;
  const rows=[];
  for(const [i,m] of movies.entries()) for(const day of m.schedule.days) rows.push({movie:m,index:i,date:day.date,times:day.times});
  rows.sort((a,b)=>a.date.localeCompare(b.date) || a.times[0].localeCompare(b.times[0]) || a.movie.title.localeCompare(b.movie.title));
  if(layout==='poster-list' || layout==='editorial-schedule') {
    const rowH=(s.height-gap*(movies.length-1))/movies.length;
    movies.forEach((m,i)=>movieBlock(s,m,i,{x:s.x,y:s.y+i*(rowH+gap),width:s.width,height:rowH},{horizontal:true,reverse:layout==='editorial-schedule' && i%2===1,showSessions:true}));
  } else {
    const posterColumn=['hero-schedule','poster-calendar','featured-days'].includes(layout);
    const contentX=posterColumn?s.x+s.width*.44:s.x,contentW=posterColumn?s.width*.56:s.width;
    if(posterColumn && movie) s.im('artwork',movie.posterUrl,s.x,s.y,s.width*.40,s.height,{effects:{layer:'hero',mask:'cinematic-bottom',blend:60}});
    const dayCards=layout==='day-cards' || layout==='featured-days';
    const columns=dayCards?(posterColumn?1:format.id==='story'?2:3):1;
    const maximum=dayCards?6:week?6:5;
    const visible=rows.slice(0,maximum),gridRows=Math.ceil(visible.length/columns);
    const rowH=(s.height-(gridRows-1)*gap-(rows.length>maximum?36:0))/Math.max(1,gridRows);
    visible.forEach((row,index)=>{
      const width=(contentW-gap*(columns-1))/columns,x=contentX+index%columns*(width+gap),y=s.y+Math.floor(index/columns)*(rowH+gap);
      const dayLabel=week?new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${row.date}T12:00:00Z`)).toUpperCase():row.times.slice(0,3).join(' • ');
      const labelH=Math.min(rowH*.28,50),titleH=Math.min(rowH*.30,66),timeH=Math.max(24,rowH-labelH-titleH-12);
      if(layout==='timeline' || layout==='week-timeline') s.elements.push({id:`timeline-rule-${index}`,type:'shape',x,y:y+rowH-2,width,height:1,fill:args.palette.accentColor,opacity:.5});
      s.tx(`program-day-${index}`,dayLabel,x,y,width,labelH,posterColumn?32:42,{fill:args.palette.accentColor,fontFamily:'Social Display',fontWeight:900});
      s.tx(`program-film-${index}`,row.movie.title,x,y+labelH+6,width,titleH,32,{fontFamily:'Social Display',hierarchy:'secondary'});
      s.tx(`program-time-${index}`,week?row.times.slice(0,3).join(' • '):row.times.length>3?`${row.times.slice(3,6).join(' • ')}${row.times.length>6?' +':''}`:'',x,y+labelH+titleH+12,width,timeH,34,{hierarchy:'primary'});
    });
    if(rows.length>maximum) s.tx('more-sessions','+ mais sessões no site',contentX,s.y+s.height-32,contentW,32,24);
  }
  return finish(s,draft,format);
}
const buildTodaySessionsScene=args=>buildScheduleScene(args,false);
const buildWeekSessionsScene=args=>buildScheduleScene(args,true);
function buildProgrammingScene(args) {
  return args.draft.templateId==='multi-movies'?buildMultiMovieScene(args):args.draft.templateId==='sessions-today'?buildTodaySessionsScene(args):buildWeekSessionsScene(args);
}
module.exports={buildProgrammingScene,buildTodaySessionsScene,buildWeekSessionsScene,buildMultiMovieScene,scheduleSummary};
