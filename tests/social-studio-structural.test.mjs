import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {AnimationQueue}=require('../backend/services/social-studio/composition-engine/animation-queue');
const {createMotionSpec}=require('../backend/services/social-studio/contracts/motion');
const {animationPlan}=require('../backend/services/social-studio/composition-engine/animation');
const {selectFeaturedMovie,analyzeProgramMood}=require('../backend/services/social-studio/programming/direction');
test('fila limitada respeita ordem, cancelamento e capacidade',async()=>{
  const queue=new AnimationQueue({concurrency:1,limit:1});
  const release=await queue.acquire();const controller=new AbortController();
  const second=queue.acquire(controller.signal);
  await assert.rejects(queue.acquire(),e=>e.code==='ANIMATION_QUEUE_FULL');
  controller.abort();await assert.rejects(second,e=>e.name==='AbortError');
  const pending=queue.acquire();release();const nextRelease=await pending;
  assert.equal(queue.stats().active,1);nextRelease();assert.equal(queue.stats().active,0);
});
test('prévia e export usam o mesmo MotionSpec, diferindo apenas em resolução',()=>{
  const scene={width:1080,height:1920,elements:[{id:'title',type:'text',text:'Campanha',x:0,y:0}],sourceDraft:{}};
  const preview=animationPlan(scene,{quality:'preview',preset:'film-reveal'}),final=animationPlan(scene,{quality:'final',preset:'film-reveal'});
  assert.deepEqual(preview.motionSpec,final.motionSpec);assert.equal(preview.width,540);assert.equal(final.width,1080);
  assert.deepEqual(final.motionSpec,createMotionSpec(scene,{preset:'film-reveal'}));
});
test('destaque manual vence ranking e programa diverso tem mood neutro',()=>{
  const movies=[{id:'a',genre:'Terror',priority:2},{id:'b',genre:'Animação',priority:1}];
  assert.equal(selectFeaturedMovie(movies).id,'b');
  assert.equal(selectFeaturedMovie(movies,{featuredMovieId:'a'}).id,'a');
  assert.equal(analyzeProgramMood(movies),'cinema');
});
test('sidebar não chama geração e debounce permanece limitado',()=>{
  const js=fs.readFileSync('backend/public/social-studio.js','utf8');
  const fn=js.slice(js.indexOf('function updateTemplatePreviews'),js.indexOf('function renderTemplates'));
  assert.doesNotMatch(fn,/requestImage|\/preview|\/resolve|AbortController/);
  assert.match(fn,/loading="lazy" decoding="async"/);
  assert.match(js,/function schedulePreview\(delay = 300\)/);
});
