import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {exportAnimation}=require('../backend/services/social-studio/composition-engine/animation');
const available=spawnSync(process.env.SOCIAL_STUDIO_FFMPEG || 'ffmpeg',['-version'],{windowsHide:true}).status===0;
const scene={width:320,height:400,backgroundColor:'#121820',elements:[{id:'title',type:'text',text:'Cine Cruzeiro',x:20,y:50,width:280,height:60,fontSize:32,fill:'#ffffff'},{id:'cta',type:'text',text:'Confira as sessões',x:20,y:240,width:280,height:50,fontSize:24,fill:'#ffffff'}]};
test('codificador entrega MP4, WebM e GIF reais e limita concorrência',{skip:!available},async()=>{
  const first=exportAnimation(scene,{format:'mp4',duration:5});
  await assert.rejects(()=>exportAnimation(scene,{format:'mp4'}),error=>error.statusCode===429);
  const mp4=await first;
  assert.equal(mp4.buffer.toString('ascii',4,8),'ftyp');
  const webm=await exportAnimation(scene,{format:'webm',duration:5});
  assert.equal(webm.buffer.subarray(0,4).toString('hex'),'1a45dfa3');
  const gif=await exportAnimation(scene,{format:'gif',duration:5,loop:false});
  assert.equal(gif.buffer.toString('ascii',0,3),'GIF');
  for(const result of [mp4,webm,gif])assert.ok(result.buffer.length>1000);
});
test('cancelamento e excesso de texto liberam a trava de exportação',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>exportAnimation(scene,{}, {signal:controller.signal}),/cancelada/);
  await assert.rejects(()=>exportAnimation({...scene,elements:[{type:'text',text:'Palavra '.repeat(70)}]}),/texto demais/);
});
