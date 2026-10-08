import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {selectFeaturedMovie,analyzeProgramMood}=require('../backend/services/social-studio/programming/direction');
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
test('Studio restaurado não expõe geração ou controles de vídeo',()=>{
  const server=fs.readFileSync('backend/server.js','utf8');
  const js=fs.readFileSync('backend/public/social-studio.js','utf8');
  const html=fs.readFileSync('backend/public/admin.html','utf8');
  assert.doesNotMatch(server,/social-studio\/(?:animation-jobs|motion-preview|animation)(?:\b|\/)/);
  assert.doesNotMatch(js,/socialStudioAnimation|socialStudioMotion|motion-preview|animation-jobs/);
  assert.doesNotMatch(html,/socialStudioAnimation|socialStudioMotion/);
});
