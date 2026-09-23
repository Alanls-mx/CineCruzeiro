const fs=require('fs/promises');
const path=require('path');
const {renderRemotion,getBundle}=require('./renderer');
const controller=new AbortController();
process.on('message',message=>{if(message.cancel)controller.abort();});
process.on('disconnect',()=>controller.abort());
(async()=>{
  const dir=process.argv[2],{scene,config,files}=JSON.parse(await fs.readFile(path.join(dir,'input.json'),'utf8'));
  process.env.SOCIAL_STUDIO_MOTION_WORKDIR=dir;
  const result=await renderRemotion(scene,config,{tempRoot:dir,signal:controller.signal,loadImage:src=>files[src]?fs.readFile(path.join(dir,files[src])):null,onProgress:progress=>process.send?.({progress})});
  await fs.writeFile(path.join(dir,`output.${config.format}`),result.buffer);
  process.send?.({result:{plan:result.plan,metrics:result.metrics}});
})().catch(error=>{process.send?.({error:error.message});process.exitCode=1;}).finally(async()=>{
  if(!process.env.SOCIAL_STUDIO_REMOTION_BUNDLE && process.env.SOCIAL_STUDIO_ANIMATION_ENGINE!=='ffmpeg')await getBundle().then(dir=>{
    const relative=path.relative(require('os').tmpdir(),dir);
    if(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(dir).startsWith('remotion'))return fs.rm(dir,{recursive:true,force:true});
  }).catch(()=>{});
  process.disconnect?.();
});
