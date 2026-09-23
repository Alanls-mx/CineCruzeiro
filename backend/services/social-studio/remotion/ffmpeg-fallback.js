const fs=require('fs/promises');
const path=require('path');
const sharp=require('sharp');
const {frameState}=require('./timeline');
const {runEncoder}=require('../composition-engine/ffmpeg-support');

// Compatibility renderer: no timing rules live here. It samples the same tracks as Remotion.
async function renderFallback({scene,spec,layers,dir,width,height,config,output,options}) {
  const images=await Promise.all(layers.map(async layer=>({...layer,data:(await fs.readFile(path.join(dir,layer.file))).toString('base64')})));
  const frames=Math.ceil(spec.duration*spec.fps);
  for(let frame=0;frame<frames;frame++) {
    if(options.signal?.aborted)throw new Error('Exportação cancelada.');
    const content=images.map((image,i)=>{
      const track=spec.tracks.find(t=>t.id===image.id),state=frameState(track,frame/spec.fps,spec),light=state.brightness+state.light;
      const x=state.x+track.originX*(1-state.scale),y=state.y+track.originY*(1-state.scale);
      const edge=state.reveal<1?track.bounds.y+track.bounds.height*state.reveal:scene.height;
      return `<defs><clipPath id="c${i}"><rect width="${scene.width}" height="${edge}"/></clipPath><filter id="f${i}" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="${light}"/><feFuncG type="linear" slope="${light}"/><feFuncB type="linear" slope="${light}"/></feComponentTransfer></filter></defs><g opacity="${state.opacity}" transform="translate(${x} ${y}) scale(${state.scale})" clip-path="url(#c${i})" filter="url(#f${i})"><image width="${scene.width}" height="${scene.height}" href="data:image/png;base64,${image.data}"/></g>`;
    }).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${scene.width} ${scene.height}"><rect width="100%" height="100%" fill="${scene.backgroundColor}"/>${content}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(dir,`frame-${String(frame).padStart(5,'0')}.png`));
    options.onProgress?.(frame/frames*.9);
  }
  const codec=config.format==='webm'?['-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-crf','28','-b:v','0']:['-c:v','libx264','-preset','veryfast','-crf','18','-movflags','+faststart'];
  await runEncoder(['-y','-framerate',String(spec.fps),'-i',path.join(dir,'frame-%05d.png'),...codec,'-pix_fmt','yuv420p',output],options);
}
module.exports={renderFallback};
