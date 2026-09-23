const PRESETS=['automatic','cinematic-reveal','slow-parallax','dark-reveal','commercial-focus','poster-reveal','editorial','poster-cascade','featured-cycle','cinema-lineup','crossfade-program','spotlight','simultaneous'];
const ALIASES={cinematic:'cinematic-reveal',commercial:'commercial-focus',soft:'editorial','film-reveal':'poster-reveal','spotlight-rotation':'spotlight'};
function normalizeAnimation(input={}) {
  const preset=ALIASES[input.preset] || input.preset;
  return {enabled:input.enabled===true,preset:PRESETS.includes(preset)?preset:'automatic',duration:[5,8,10].includes(Number(input.duration))?Number(input.duration):'automatic',intensity:['subtle','balanced','impactful'].includes(input.intensity)?input.intensity:'balanced',format:['mp4','webm','gif'].includes(input.format)?input.format:'mp4',loop:input.loop!==false,quality:input.quality==='preview'?'preview':'final'};
}
function roleFor(element) {
  if(element.role==='logo' || ['logo','cinema','divider'].includes(element.id))return 'brand';
  if(element.id==='action-group' || ['cta','website'].includes(element.id))return 'cta';
  if(/^movie-group-\d+$/.test(element.id))return 'movie';
  if(element.id==='price-hero' || /^(detail|currency|price-label|savings|sessions-|program-time-|program-day-|program-film-|movie-sessions-)/.test(element.id))return 'detail';
  if(element.id==='date-group')return 'detail';
  if(element.type==='text')return element.id==='subtitle'?'kicker':'heading';
  if(element.id==='artwork' || /^movie-art-/.test(element.id))return 'hero';
  if(['poster-glow','ambient-shadow','contact-shadow'].includes(element.id))return 'hero';
  if(element.role==='contrast' || /foreground|vignette/.test(element.id))return 'veil';
  if(/price-panel|price-burst|badge|campaign-symbol|ticket-decoration/.test(element.id))return 'decoration';
  return 'background';
}
function planesForScene(scene) {
  // Contiguous layers preserve the approved stacking order, including image masks and text backplates.
  const planes=[];
  for(const [position,source] of scene.elements.filter(e=>e.visible!==false).entries()) {
    const element=source.id?source:{...source,id:`element-${position}`};
    const role=roleFor(element),previous=planes.at(-1);
    if(previous && previous.role===role && ['background','veil'].includes(role)) previous.elements.push(element);
    else planes.push({id:element.id,role,index:planes.filter(p=>p.role===role).length,elements:[element]});
  }
  return planes;
}
function createSpec(scene,input={}) {
  scene={width:1080,height:1350,...scene};
  const config=normalizeAnimation(input),planes=planesForScene(scene);
  const texts=require('../scene/groups').flattenElements(scene.elements).filter(e=>e.type==='text' && e.visible!==false);
  const wordCount=texts.reduce((sum,e)=>sum+String(e.text || '').split(/\s+/).filter(Boolean).length,0);
  const movies=planes.filter(p=>p.role==='movie').length;
  const genre=scene.sourceDraft?.genreProfile?.id || 'cinema';
  const commercial=['ticket-offer','movie-price','concession-offer','concession-combo','club-plan'].includes(scene.templateId);
  const preset=config.preset==='automatic'?movies>1?'poster-cascade':commercial?'commercial-focus':genre==='horror'?'dark-reveal':genre==='drama' || genre==='romance'?'editorial':genre==='action'?'slow-parallax':'cinematic-reveal':config.preset;
  const cycle=movies>1 && ['featured-cycle','crossfade-program','spotlight'].includes(preset);
  const intensity={subtle:.55,balanced:1,impactful:1.4}[config.intensity];
  const readingHold=Math.max(2.5,Math.ceil(wordCount/3.5));
  const entrance=preset==='commercial-focus'?2.1:preset==='editorial'?2.6:3.4;
  const movieDurations=planes.filter(p=>p.role==='movie').map(p=>Math.max(2.5,require('../scene/groups').flattenElements(p.elements).filter(e=>e.type==='text').reduce((sum,e)=>sum+String(e.text || '').split(/\s+/).length,0)/3.5+.6));
  const cycleDuration=cycle?movieDurations.reduce((a,b)=>a+b,0):0;
  const duration=Math.max(config.duration==='automatic'?8:config.duration,Math.ceil(entrance+readingHold+cycleDuration+(cycle?.65:0)));
  if(duration>30)throw Object.assign(new Error('Há texto demais para leitura em 30 segundos. Reduza os textos ou a programação exibida.'),{statusCode:400});
  const summaryStart=entrance+cycleDuration;
  const readableFrom=cycle?summaryStart+.65:entrance;
  const starts={background:0,veil:0,hero:.45,kicker:.85,heading:1.1,detail:1.5,decoration:1.35,movie:.5,cta:2.1,brand:2.35};
  const speed=preset==='commercial-focus'?.6:preset==='editorial'?.75:1;
  const tracks=planes.map(plane=>{
    const stagger=['poster-cascade','cinema-lineup'].includes(preset)?.2:.09;
    const start=preset==='simultaneous'?0:Math.min(2.35,(starts[plane.role] || 0)+(plane.role==='movie' || plane.role==='detail'?plane.index*stagger:0))*speed;
    const artwork=['hero','background','movie','veil'].includes(plane.role);
    const box=plane.elements[0];
    return {id:plane.id,role:plane.role,start:cycle && ['cta','brand'].includes(plane.role)?summaryStart:start,end:duration,fade:plane.role==='background'?1.3:plane.role==='hero'?.95*speed:.65*speed,
      x:preset==='editorial'?0:plane.role==='hero'?scene.width*.012*intensity:0,
      y:['heading','kicker','detail','cta','brand','movie'].includes(plane.role)?scene.height*.008*intensity:0,
      scale:artwork?(plane.role==='background'?.018:.012)*intensity:preset==='commercial-focus' && plane.role==='detail'?-.025*intensity:0,
      driftX:preset==='slow-parallax' && artwork?(plane.role==='background'?-1:1)*scene.width*.004*intensity:0,
      driftY:0,reveal:['poster-reveal','cinematic-reveal','dark-reveal'].includes(preset) && ['hero','heading'].includes(plane.role),
      darken:preset==='dark-reveal' && artwork?.72:0,light:preset==='dark-reveal' && plane.role==='hero'?.08:0,
      originX:(box.x || 0)+(box.width || scene.width)/2,originY:(box.y || 0)+(box.height || scene.height)/2,
      bounds:{x:box.x || 0,y:box.y || 0,width:box.width || scene.width,height:box.height || scene.height},
      ...(cycle && plane.role==='movie'?{cycle:{start:entrance+movieDurations.slice(0,plane.index).reduce((a,b)=>a+b,0),end:entrance+movieDurations.slice(0,plane.index+1).reduce((a,b)=>a+b,0)+.4}}:{})};
  });
  return {version:2,preset,duration,intensity:config.intensity,loop:config.loop,wordCount,readingHold,durationChoice:config.duration,readableFrom,summaryStart,fps:24,tracks,audio:{enabled:false}};
}
module.exports={PRESETS,normalizeAnimation,planesForScene,createSpec};
