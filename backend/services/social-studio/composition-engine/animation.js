const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');
const sharp = require('sharp');
const {renderSocialScene} = require('../scene/renderer');
const {animationQueue}=require('./animation-queue');
const {createMotionSpec,motionPlanes}=require('../contracts/motion');
function animationPlan(scene, config = {}) {
  scene = {...scene,elements:require('../scene/groups').flattenElements(scene.elements)};
  const format = ['mp4','webm','gif'].includes(config.format) ? config.format : 'mp4';
  const spec=createMotionSpec(scene,config);
  return {...spec,motionSpec:spec,format,quality:config.quality==='preview'?'preview':'final',width:config.quality==='preview'?(format==='gif'?360:540):1080,fps:format==='gif'?12:24};
}
function runEncoder(args, options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.SOCIAL_STUDIO_FFMPEG || 'ffmpeg',args,{windowsHide:true,stdio:['ignore','ignore','pipe'],signal:options.signal});
    let stderr='';
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-3000);});
    const timer=setTimeout(()=>child.kill('SIGKILL'),90000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Não foi possível codificar a animação. Tente MP4 ou uma duração menor.',{cause:new Error(stderr.slice(-500))}));});
  });
}
async function exportAnimation(scene, config={}, options={}) {
  scene = {...scene,elements:require('../scene/groups').flattenElements(scene.elements)};
  const release=await animationQueue.acquire(options.signal);
  let dir;
  try {
    if(options.signal?.aborted) throw new Error('Exportação cancelada.');
    const plan=animationPlan(scene,config),height=Math.round(plan.width*scene.height/scene.width/2)*2;
    if(plan.wordCount>160) throw Object.assign(new Error('Há texto demais para leitura em 30 segundos. Reduza os textos ou a programação exibida.'),{statusCode:400});
    dir=await fs.mkdtemp(path.join(os.tmpdir(),'cine-studio-motion-'));
    const ordered=motionPlanes(scene,plan.preset).map(plane=>[plane.id,plane.elements]);
    const planes=[];
    for(const [role,elements] of ordered) {
      if(!elements.length && role!=='background') continue;
      if(options.signal?.aborted) throw new Error('Exportação cancelada.');
      const render=await renderSocialScene({...scene,elements},{...options,transparent:role!=='background'});
      const filename=path.join(dir,`${planes.length}.png`);
      await sharp(render.buffer).resize(plan.width,height).png().toFile(filename);
      planes.push({role,filename});
    }
    const args=['-y','-hide_banner','-loglevel','error','-filter_complex_threads','1'];
    for(const plane of planes) args.push('-loop','1','-framerate',String(plan.fps),'-t',String(plan.duration),'-threads','1','-i',plane.filename);
    const filters=[];
    planes.forEach((plane,i)=>{
      let filter=`[${i}:v]format=rgba`;
      const track=plan.motionSpec.tracks.find(track=>track.id===plane.role);
      if(track.zoom) filter+=`,zoompan=z='1+${track.zoom}*on/${plan.duration*plan.fps}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${plan.width}x${height}:fps=${plan.fps}`;
      if(!['background','veil','brand'].includes(track.role)) filter+=`,fade=t=in:st=${track.start}:d=${track.fade}:alpha=1`;
      if(track.end<plan.duration) filter+=`,fade=t=out:st=${Math.max(track.start+track.fade,track.end-track.fade)}:d=${track.fade}:alpha=1`;
      filters.push(`${filter}[p${i}]`);
    });
    let current='p0';
    for(let i=1;i<planes.length;i++){filters.push(`[${current}][p${i}]overlay=0:0:shortest=1[o${i}]`);current=`o${i}`;}
    if(plan.format==='gif') {filters.push(`[${current}]split[g1][g2]`,`[g1]palettegen=max_colors=128[pal]`,`[g2][pal]paletteuse=dither=bayer[out]`);}
    else filters.push(`[${current}]format=yuv420p[out]`);
    args.push('-filter_complex',filters.join(';'),'-map','[out]','-t',String(plan.duration),'-an','-threads','1');
    if(plan.format==='mp4') args.push('-c:v','libx264','-preset','veryfast','-crf','22','-movflags','+faststart');
    if(plan.format==='webm') args.push('-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-crf','32','-b:v','0');
    if(plan.format==='gif') args.push('-loop',plan.loop?'0':'-1');
    const output=path.join(dir,`animation.${plan.format}`);args.push(output);
    await runEncoder(args,options);
    const buffer=await fs.readFile(output);
    if(buffer.length>30*1024*1024) throw new Error('A animação excedeu 30 MB. Use MP4 ou reduza a duração.');
    return {buffer,plan,extension:`.${plan.format}`,contentType:{mp4:'video/mp4',webm:'video/webm',gif:'image/gif'}[plan.format]};
  } catch(error) {
    if(error.code==='ENOENT') throw new Error('O codificador de vídeo não está disponível. Configure FFmpeg no servidor.');
    throw error;
  } finally {
    try { if(dir) await fs.rm(dir,{recursive:true,force:true}); }
    finally { release(); }
  }
}
module.exports={animationPlan,exportAnimation,animationQueue};
