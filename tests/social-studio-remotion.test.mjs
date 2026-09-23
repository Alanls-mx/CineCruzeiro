import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createSpec,planesForScene}=require('../backend/services/social-studio/remotion/spec');
const {frameState}=require('../backend/services/social-studio/remotion/timeline');
const {AnimationJobs}=require('../backend/services/social-studio/remotion/jobs');
const snapshots=require('../backend/services/social-studio/remotion/snapshots');
const scene={width:1080,height:1350,backgroundColor:'#070a12',elements:[{id:'bg',type:'shape',x:0,y:0,width:1080,height:1350},{id:'title',type:'text',x:80,y:100,width:900,height:130,text:'Sua próxima sessão'},{id:'artwork',type:'image',x:80,y:300,width:500,height:700,src:'asset://poster'},{id:'action-group',type:'group',x:80,y:1100,width:900,height:120,children:[{id:'cta',type:'text',x:0,y:0,width:900,height:50,text:'Compre agora'},{id:'website',type:'text',x:0,y:60,width:900,height:50,text:'cinecruzeiro.com.br'}]}]};
test('todos os presets chegam à mesma arte aprovada, com leitura final e ação agrupada',()=>{
  for(const preset of ['cinematic-reveal','slow-parallax','dark-reveal','commercial-focus','poster-reveal','editorial']) {
    const spec=createSpec(scene,{preset,duration:5});
    assert.ok(spec.duration-spec.readableFrom>=spec.readingHold);
    for(const track of spec.tracks){const state=frameState(track,spec.duration-.1,spec);assert.deepEqual(state,{opacity:1,x:0,y:0,scale:1,brightness:1,reveal:1,light:0});}
    assert.deepEqual(planesForScene(scene).flatMap(p=>p.elements),scene.elements);
    assert.equal(spec.tracks.filter(t=>t.role==='cta').length,1);
  }
});
test('ciclos preservam geometria e reservam leitura por filme e resumo',()=>{
  const multi={...scene,elements:[scene.elements[0],...Array.from({length:3},(_,i)=>({id:`movie-group-${i}`,type:'group',x:i*330+40,y:200,width:300,height:700,children:[{type:'text',id:`movie-title-${i}`,text:'Filme com duas sessões 19h e 21h',x:0,y:0,width:300,height:80}]})),scene.elements.at(-1)]};
  for(const preset of ['featured-cycle','crossfade-program','spotlight','poster-cascade','cinema-lineup']) {
    const spec=createSpec(multi,{preset});
    assert.ok(spec.duration-spec.readableFrom>=spec.readingHold);
    assert.deepEqual(planesForScene(multi).flatMap(p=>p.elements),multi.elements);
    for(const track of spec.tracks)if(track.cycle)assert.ok(track.cycle.end-track.cycle.start>=2.5);
  }
});
test('prévia congelada é isolada por operador e não recompõe a arte',()=>{
  const rendered={scene,buffer:Buffer.from('png')},id=snapshots.remember('a',rendered);
  assert.equal(snapshots.read('a',id),rendered);assert.throws(()=>snapshots.read('b',id),/expirou/);
});
async function waitDone(jobs,id,owner){for(let i=0;i<200;i++){const job=await jobs.get(id,owner);if(!['waiting','rendering'].includes(job.status))return job;await new Promise(r=>setTimeout(r,10));}throw new Error('Job não terminou');}
test('fila persiste arquivo, isola usuário, invalida cache por asset e permite cancelar',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cine-motion-test-'));let bytes='one',active=0,peak=0;
  const jobs=new AnimationJobs(root,{loadImage:async()=>Buffer.from(bytes),runner:async(dir,{signal,onProgress})=>{
    active++;peak=Math.max(peak,active);
    try{await new Promise(r=>setTimeout(r,60));if(signal.aborted)throw new Error('Cancelada');onProgress(.9);await fs.writeFile(path.join(dir,'output.mp4'),'video');return {plan:{duration:8},metrics:{bytes:5}};}finally{active--;}
  }});
  try {
    const input={scene,owner:'a',postId:'post',artVersion:'manual-1',animation:{format:'mp4'}};
    const a=await jobs.create(input),same=await jobs.create(input);assert.equal(a.id,same.id);
    await assert.rejects(()=>jobs.get(a.id,'b'),/não encontrada/);
    assert.equal((await waitDone(jobs,a.id,'a')).status,'done');assert.equal((await jobs.file(a.id,'a')).buffer.toString(),'video');
    bytes='two';const different=await jobs.create(input);assert.notEqual(different.id,a.id);
    const other=await jobs.create({...input,owner:'b'});assert.notEqual(other.id,different.id);
    await jobs.cancel(other.id,'b');assert.equal((await jobs.get(other.id,'b')).status,'cancelled');
    await waitDone(jobs,different.id,'a');assert.equal(peak,1);
    const edited=await jobs.create({...input,artVersion:'manual-2'});assert.notEqual(edited.id,different.id);await waitDone(jobs,edited.id,'a');
    const restored=new AnimationJobs(root,{loadImage:async()=>Buffer.from(bytes)});await restored.ready;assert.equal((await restored.get(a.id,'a')).status,'done');clearInterval(restored.cleanupTimer);
    assert.equal((await fs.readdir(root)).some(name=>name===a.id),false);
  } finally {clearInterval(jobs.cleanupTimer);await fs.rm(root,{recursive:true,force:true});}
});
test('falha não remove campanha; reinício sinaliza job interrompido',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cine-motion-failure-'));
  const jobs=new AnimationJobs(root,{loadImage:async()=>Buffer.from('x'),runner:async()=>{throw new Error('Codificador indisponível');}});
  try{const job=await jobs.create({scene,owner:'a',postId:'saved-static',animation:{}});const failed=await waitDone(jobs,job.id,'a');assert.equal(failed.status,'failed');assert.equal(failed.postId,'saved-static');assert.match(failed.error,/Codificador/);}finally{clearInterval(jobs.cleanupTimer);await fs.rm(root,{recursive:true,force:true});}
});
