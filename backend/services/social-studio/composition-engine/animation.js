const {animationQueue}=require('./animation-queue');
const {createSpec,normalizeAnimation}=require('../remotion/spec');
function animationPlan(scene,input={}) {
  scene={width:1080,height:1350,...scene};
  const config=normalizeAnimation(input),spec=createSpec(scene,config);
  const width=config.quality==='preview'?Math.min(540,scene.width):scene.width;
  return {...spec,motionSpec:spec,format:config.format,quality:config.quality,width,height:Math.floor(width*scene.height/scene.width/2)*2,fps:24};
}
async function exportAnimation(scene,config={},options={}) {
  const release=await animationQueue.acquire(options.signal);
  try {
    if(options.signal?.aborted)throw new Error('Exportação cancelada.');
    return await require('../remotion/renderer').renderRemotion(scene,config,options);
  } finally {release();}
}
module.exports={animationPlan,exportAnimation,animationQueue};
