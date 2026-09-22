const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');
const sharp = require('sharp');
const {renderSocialScene} = require('../scene/renderer');
let active = false;
function animationPlan(scene, config = {}) {
  const format = ['mp4','webm','gif'].includes(config.format) ? config.format : 'mp4';
  const duration = [5,8,10].includes(Number(config.duration)) ? Number(config.duration) : 8;
  const preset = ['cinematic','commercial','soft'].includes(config.preset) ? config.preset : 'cinematic';
  const words = scene.elements.filter(item=>item.type==='text' && item.visible!==false).reduce((sum,item)=>sum+String(item.text).split(/\s+/).filter(token=>/[\p{L}\p{N}]/u.test(token)).length,0);
  const needed = Math.max(5,Math.ceil(words/6)+1);
  const minimum = [5,8,10].find(value=>value>=needed) || 10;
  return {format,duration:Math.max(duration,minimum),preset,loop:config.loop!==false,width:format==='gif'?480:720,fps:format==='gif'?12:20,readableFrom:1.2,wordCount:words};
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
  if(active) throw Object.assign(new Error('Uma animação está sendo processada. Aguarde e tente novamente.'),{statusCode:429});
  active=true;
  let dir;
  try {
    if(options.signal?.aborted) throw new Error('Exportação cancelada.');
    const plan=animationPlan(scene,config),height=Math.round(plan.width*scene.height/scene.width/2)*2;
    if(plan.wordCount>60) throw Object.assign(new Error('Há texto demais para uma animação de até 10 segundos. Reduza os filmes ou desative os horários nesta versão.'),{statusCode:400});
    dir=await fs.mkdtemp(path.join(os.tmpdir(),'cine-studio-motion-'));
    const groups={background:[],hero:[],veil:[],heading:[],detail:[],cta:[],brand:[]};
    for(const item of scene.elements.filter(item=>item.visible!==false)) {
      const group = item.role==='logo' || item.id==='cinema' || item.id==='divider' ? 'brand' : item.id==='cta' || item.id==='website' ? 'cta' : item.type==='text' ? (item.id==='detail' || item.id.startsWith('sessions-') ? 'detail' : 'heading') : item.id==='artwork' || item.id.startsWith('movie-art-') || ['poster-glow','ambient-shadow','contact-shadow'].includes(item.id) ? 'hero' : item.role==='contrast' || item.id==='vignette' || item.id==='foreground-atmosphere' ? 'veil' : 'background';
      groups[group].push(item);
    }
    const ordered=[];
    for(const [role,elements] of Object.entries(groups)) {
      if(role==='hero' && scene.templateId==='multi-movies') elements.forEach((element,index)=>ordered.push([`hero-${index}`,[element]]));
      else if(role==='detail' && elements.length>1) elements.forEach((element,index)=>ordered.push([`detail-${index}`,[element]]));
      else if(role==='detail' && ['sessions-today','sessions-week'].includes(scene.templateId) && elements[0]?.text.includes('\n')) {
        const element=elements[0],lines=element.text.split('\n'),lineHeight=element.fontSize*element.lineHeight,start=element.y+(element.height-lines.length*lineHeight)/2;
        lines.forEach((line,index)=>ordered.push([`detail-${index}`,[{...element,id:`${element.id}-line-${index}`,text:line,y:start+index*lineHeight,height:lineHeight}]]));
      } else ordered.push([role,elements]);
    }
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
    const filters=[],starts={hero:.1,veil:0,heading:.15,detail:.45,cta:.7,brand:0};
    planes.forEach((plane,i)=>{
      let filter=`[${i}:v]format=rgba`;
      if(plane.role==='background' && plan.preset==='cinematic') filter+=`,zoompan=z='1+0.025*on/${plan.duration*plan.fps}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${plan.width}x${height}:fps=${plan.fps}`;
      const [kind,index]=plane.role.split('-');
      const start=(starts[kind] || 0)+Math.min(.25,Number(index || 0)*.05);
      if(kind!=='background' && kind!=='veil' && kind!=='brand') filter+=`,fade=t=in:st=${plan.preset==='soft'?0:start}:d=${plan.preset==='commercial'?.25:.45}:alpha=1`;
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
    finally { active=false; }
  }
}
module.exports={animationPlan,exportAnimation};
