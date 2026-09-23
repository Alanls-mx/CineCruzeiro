const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const http=require('http');
const crypto=require('crypto');
const {performance}=require('perf_hooks');
const {createSpec,planesForScene,normalizeAnimation}=require('./spec');
const {renderSocialScene}=require('../scene/renderer');
let bundlePromise;
async function getBundle(){
  if(process.env.SOCIAL_STUDIO_REMOTION_BUNDLE) return process.env.SOCIAL_STUDIO_REMOTION_BUNDLE;
  const compiled=path.resolve(__dirname,'../../../../.remotion');
  if(await fs.access(path.join(compiled,'index.html')).then(()=>true,()=>false))return compiled;
  if(!bundlePromise) bundlePromise=(async()=>{
    const {bundle}=require('@remotion/bundler');
    return bundle({entryPoint:path.join(__dirname,'entry.jsx'),...(process.env.SOCIAL_STUDIO_MOTION_WORKDIR?{outDir:path.join(process.env.SOCIAL_STUDIO_MOTION_WORKDIR,'bundle')}:{}),publicDir:null,onProgress:()=>{},webpackOverride:config=>({...config,cache:false})});
  })().catch(error=>{bundlePromise=null;throw error;});
  return bundlePromise;
}
async function renderRemotion(scene,input={},options={}) {
  const started=performance.now(),cpu=process.cpuUsage(),config=normalizeAnimation(input),spec=createSpec(scene,config);
  const width=config.quality==='preview'?Math.min(540,scene.width):scene.width,height=Math.floor(width*scene.height/scene.width/2)*2;
  const dir=await fs.mkdtemp(path.join(options.tempRoot || os.tmpdir(),'cine-remotion-'));
  let server;
  const cancelState=require('@remotion/renderer').makeCancelSignal();
  const cancel=()=>cancelState.cancel();
  options.signal?.addEventListener('abort',cancel,{once:true});
  try {
    if(options.signal?.aborted)throw Object.assign(new Error('Exportação cancelada.'),{name:'AbortError'});
    if(scene.templateId==='ticket-offer' && !require('../contracts/ticket-campaign').validateLayoutCollisions(scene).valid) throw new Error('Ajuste as colisões da arte antes de animar.');
    const layers=[];
    for(const plane of planesForScene(scene)) {
      if(options.signal?.aborted)throw Object.assign(new Error('Exportação cancelada.'),{name:'AbortError'});
      const rendered=await renderSocialScene({...scene,elements:plane.elements},{...options,transparent:true,layerRender:true});
      const file=`${layers.length}.png`;
      await fs.writeFile(path.join(dir,file),rendered.buffer);
      layers.push({id:plane.id,file});
    }
    const token=crypto.randomBytes(20).toString('hex');
    server=http.createServer(async(req,res)=>{
      const match=req.url?.match(new RegExp(`^/${token}/(\\d+)\\.png$`));
      if(!match || Number(match[1])>=layers.length){res.writeHead(404);res.end();return;}
      try {const buffer=await fs.readFile(path.join(dir,`${Number(match[1])}.png`));res.writeHead(200,{'Content-Type':'image/png'});res.end(buffer);}catch{res.writeHead(404);res.end();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin=`http://127.0.0.1:${server.address().port}/${token}`;
    const inputProps={width:scene.width,height:scene.height,backgroundColor:scene.backgroundColor,layers:layers.map(layer=>({id:layer.id,src:`${origin}/${layer.file}`})),spec};
    const output=path.join(dir,`animation.${config.format==='gif'?'mp4':config.format}`);
    const fallback=process.env.SOCIAL_STUDIO_ANIMATION_ENGINE==='ffmpeg';
    if(fallback) await require('./ffmpeg-fallback').renderFallback({scene,spec,layers,dir,width,height,config,output,options});
    else {
    const {selectComposition,renderMedia}=require('@remotion/renderer');
    const serveUrl=await getBundle();
    const installedBrowser=await fs.readFile(path.join(serveUrl,'browser.json'),'utf8').then(JSON.parse).catch(()=>null);
    const browserExecutable=process.env.SOCIAL_STUDIO_CHROME || installedBrowser?.path || null;
    const composition=await selectComposition({serveUrl,id:'SocialCampaign',inputProps,browserExecutable,logLevel:'error'});
    await renderMedia({serveUrl,composition,inputProps,outputLocation:output,codec:config.format==='webm'?'vp9':'h264',crf:config.quality==='preview'?25:18,pixelFormat:'yuv420p',scale:width/scene.width,concurrency:1,disallowParallelEncoding:true,browserExecutable,cancelSignal:cancelState.cancelSignal,logLevel:'error',onProgress:progress=>options.onProgress?.(progress.progress),chromiumOptions:{enableMultiProcessOnLinux:false},offthreadVideoThreads:1});
    }
    let buffer=await fs.readFile(output);
    if(config.format==='gif') {
      const {runEncoder}=require('../composition-engine/ffmpeg-support');
      const gif=path.join(dir,'animation.gif');
      const gifWidth=config.quality==='preview'?Math.min(360,scene.width):width;
      await runEncoder(['-y','-i',output,'-vf',`fps=12,scale=${gifWidth}:${Math.round(gifWidth*scene.height/scene.width)}`,'-loop',config.loop?'0':'-1',gif],options);
      buffer=await fs.readFile(gif);
    }
    if(buffer.length>60*1024*1024)throw new Error('O vídeo excedeu 60 MB. Reduza a duração.');
    const used=process.cpuUsage(cpu);
    const outputWidth=config.format==='gif' && config.quality==='preview'?Math.min(360,scene.width):width;
    const outputHeight=config.format==='gif'?Math.round(outputWidth*scene.height/scene.width):height;
    return {buffer,extension:`.${config.format}`,contentType:{mp4:'video/mp4',webm:'video/webm',gif:'image/gif'}[config.format],plan:{...spec,motionSpec:spec,width:outputWidth,height:outputHeight,quality:config.quality,format:config.format,engine:fallback?'ffmpeg':'remotion'},metrics:{renderMs:Math.round(performance.now()-started),cpuMs:Math.round((used.user+used.system)/1000),nodeRssBytes:process.memoryUsage().rss,bytes:buffer.length}};
  } finally {
    options.signal?.removeEventListener('abort',cancel);
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await fs.rm(dir,{recursive:true,force:true});
  }
}
module.exports={renderRemotion,getBundle};
