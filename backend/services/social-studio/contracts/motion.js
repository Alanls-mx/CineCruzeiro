const {flattenElements}=require('../scene/groups');
const MOTION_PRESETS=['cinematic','commercial','soft','poster-cascade','film-reveal','spotlight-rotation','cinema-lineup','crossfade-program','featured-cycle'];
function motionPlanes(scene,preset) {
  const elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const groups={background:[],hero:[],veil:[],heading:[],detail:[],cta:[],brand:[]};
  const movieElements=elements.filter(e=>/^movie-(art|title|sessions)-\d+$/.test(e.id));
  const cycle=['featured-cycle','crossfade-program','spotlight-rotation'].includes(preset) && movieElements.length;
  for(const item of elements) {
    if(cycle && movieElements.includes(item)) continue;
    const group=item.role==='logo' || ['cinema','divider'].includes(item.id)?'brand':['cta','website'].includes(item.id)?'cta':item.type==='text'?/^(detail|sessions-|movie-sessions-|program-time-|program-day-)/.test(item.id)?'detail':'heading':item.id==='artwork' || item.id.startsWith('movie-art-') || ['poster-glow','ambient-shadow','contact-shadow'].includes(item.id)?'hero':item.role==='contrast' || ['vignette','foreground-atmosphere'].includes(item.id)?'veil':'background';
    groups[group].push(item);
  }
  const planes=[];
  for(const [role,items] of Object.entries(groups)) {
    if(cycle && ['heading','detail','hero'].includes(role)) continue;
    if((role==='hero' || role==='detail') && items.length>1) items.forEach((item,index)=>planes.push({id:`${role}-${index}`,role,index,elements:[item]}));
    else if(items.length || role==='background') planes.push({id:role,role,index:0,elements:items});
  }
  if(cycle) {
    const count=scene.sourceDraft?.programMovies?.length || new Set(movieElements.map(e=>e.id.split('-').at(-1))).size;
    for(let i=0;i<count;i++) {
      const items=movieElements.filter(e=>e.id.endsWith(`-${i}`)).map(item=>{
        const rect=item.type==='image'?{x:scene.width*.14,y:scene.height*.08,width:scene.width*.72,height:scene.height*.57}:{x:scene.width*.09,y:scene.height*(item.id.startsWith('movie-title-')?.68:.765),width:scene.width*.82,height:scene.height*.07};
        return {...item,...rect,...(item.type==='text'?{fontSize:item.id.startsWith('movie-title-')?44:30,text:String(item.text).replace(/\n/g,' ')}:{rotation:0})};
      });
      planes.push({id:`cycle-${i}`,role:'cycle',index:i,elements:items});
    }
    planes.push({id:'summary',role:'summary',index:count,elements:[...movieElements,...groups.heading,...groups.detail]});
  }
  return planes;
}
function createMotionSpec(scene,config={}) {
  const preset=MOTION_PRESETS.includes(config.preset)?config.preset:'cinematic';
  const planes=motionPlanes(scene,preset);
  const texts=flattenElements(scene.elements).filter(e=>e.type==='text' && e.visible!==false);
  const words=texts.reduce((sum,e)=>sum+String(e.text).split(/\s+/).filter(t=>/[\p{L}\p{N}]/u.test(t)).length,0);
  const cycles=planes.filter(p=>p.role==='cycle').length;
  const reading=Math.max(5,Math.ceil(words/6)+1,cycles?cycles*3+3:0);
  const duration=Math.min(30,Math.max([5,8,10].includes(Number(config.duration))?Number(config.duration):8,reading<=10?([5,8,10].find(n=>n>=reading)||10):reading));
  const starts={hero:.1,heading:.15,detail:.45,cta:.7};
  const summaryStart=cycles?duration-3:0;
  const tracks=planes.map(plane=>{
    const stagger=preset==='poster-cascade'?.16:preset==='cinema-lineup'?.12:.05;
    let start=preset==='soft'?0:(starts[plane.role] || 0)+Math.min(.8,plane.index*stagger),end=duration;
    if(plane.role==='cycle') {start=plane.index*summaryStart/cycles;end=(plane.index+1)*summaryStart/cycles+.2;}
    if(plane.role==='summary' || cycles && plane.role==='cta') start=summaryStart;
    return {id:plane.id,role:plane.role,start:Number(start.toFixed(3)),end:Number(end.toFixed(3)),fade:preset==='commercial'?.25:preset==='film-reveal'?.7:.45,zoom:plane.role==='background' && preset==='cinematic'?.025:0};
  });
  return {version:1,preset,duration,loop:config.loop!==false,wordCount:words,readableFrom:cycles?0:Math.max(...tracks.map(t=>t.start+t.fade)),tracks};
}
module.exports={MOTION_PRESETS,createMotionSpec,motionPlanes};
