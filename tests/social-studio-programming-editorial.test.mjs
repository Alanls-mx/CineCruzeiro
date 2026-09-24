import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const {programData,programTitle}=require('../backend/services/social-studio/programming/schedule');
const {programLayout}=require('../backend/services/social-studio/programming/direction');
const {validateArtworkLayout}=require('../backend/services/social-studio/composition-engine/artwork-quality');
const poster=await sharp({create:{width:800,height:1200,channels:3,background:'#306080'}}).png().toBuffer();
const logo=await sharp({create:{width:600,height:200,channels:3,background:'#307ac0'}}).png().toBuffer();
const loadImage=async src=>src==='/program-logo'?logo:src==='/program-poster'?poster:null;
const titles=['Coyote vs. ACME','O Fim da Rua','Toy Story 5','Minha Melhor Amiga','Vingadores: Doutor Destino','Harry Potter e a Pedra Filosofal','Cara de Barro','Resident Evil'];
const movies=titles.map((title,i)=>({id:`p${i}`,title,posterUrl:'/program-poster',sessions:[{id:`s${i}`,date:'2026-09-24',time:`${13+i}:00`}]}));
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/program-logo',website:'https://cinecruzeiro.com.br'},movies};
test('agenda escolhe seis estruturas por conteúdo, sem destaque implícito',()=>{
  for(const [count,layout] of [[1,'program-hero'],[2,'program-duo'],[3,'program-cards'],[5,'program-grid'],[8,'program-list']]) {
    const draft=engine.normalizeDraft({templateId:'multi-movies',movieIds:movies.slice(0,count).map(m=>m.id).reverse()},context);
    assert.equal(programLayout(draft,count),layout);
    assert.ok(draft.programMovies.every(m=>!m.featured));
    assert.equal(draft.programMovies[0].id,'p0');
  }
});
test('1, 2, 3, 5 e 8 filmes preservam conteúdo e geometria nos três formatos',async()=>{
  for(const count of [1,2,3,5,8])for(const formatId of ['square','feed_portrait','story']) {
    const rendered=await engine.renderSocialPost({templateId:'multi-movies',movieIds:movies.slice(0,count).map(m=>m.id).reverse(),formatId},context,{loadImage,skipRaster:true});
    assert.ok(rendered.quality.accepted,`${count} ${formatId}`);
    assert.equal(rendered.draft.resolvedProgramLayout,({1:'program-hero',2:'program-duo',3:'program-cards',5:'program-grid',8:'program-list'})[count]);
    const elements=flattenElements(rendered.scene.elements),text=elements.filter(e=>e.type==='text').map(e=>e.text.replace(/\s+/g,' ')).join(' ');
    for(const movie of movies.slice(0,count)) {assert.ok(text.includes(movie.title));assert.ok(text.includes(movie.sessions[0].time.replace(':','H')));}
    assert.equal(rendered.scene.sourceDraft.programSessionCount,count);
    assert.equal(elements.filter(e=>e.role==='logo').length,1);
    assert.doesNotMatch(text,/\d{4}-\d{2}-\d{2}|mais sessões|no site$/);
    assert.ok(validateArtworkLayout(rendered.scene).valid);
  }
});
test('agrupa horários duplicados, ordena os dias e calcula título factual',()=>{
  const model=programData([{id:'b',title:'B',schedule:{days:[{date:'2026-09-25',times:['19:00','13:00','19:00']}]}},{id:'a',title:'A',schedule:{days:[{date:'2026-09-24',times:['20:00']} ]}}]);
  assert.deepEqual(model.rows.map(r=>r.movieId),['a','b']);
  assert.deepEqual(model.rows[1].times,['13:00','19:00']);
  assert.equal(programTitle(model,'2026-09-24','Cine Cruzeiro','sessions-week'),'PROGRAMAÇÃO • 24 A 25/09');
  model.days.push({date:'2026-09-30'});
  assert.match(programTitle(model,'2026-09-24','Cine Cruzeiro','sessions-week'),/DA SEMANA/);
});
test('não exporta horários alterados, conteúdo oculto nem ordem invertida',async()=>{
  const rendered=await engine.renderSocialPost({templateId:'multi-movies',movieIds:['p0','p1'],programLayout:'program-list'},context,{loadImage,skipRaster:true});
  for(const kind of ['time','hidden','order','association']) {
    const scene=structuredClone(rendered.scene);
    if(kind==='time')scene.elements.find(e=>e.id==='program-time-0').text='23H00';
    if(kind==='hidden')scene.elements.find(e=>e.id==='program-time-0').visible=false;
    if(kind==='association')scene.elements.find(e=>e.id==='program-time-0').y=scene.elements.find(e=>e.id==='program-time-1').y+80;
    if(kind==='order') {const a=scene.elements.find(e=>e.id==='movie-title-0'),b=scene.elements.find(e=>e.id==='movie-title-1');[a.y,b.y]=[b.y,a.y];}
    await assert.rejects(engine.renderSocialScene(scene,{loadImage}),{code:'ARTWORK_QUALITY'});
  }
});
test('pôsteres iguais, sem pôster e destaque explícito conservam a agenda',async()=>{
  for(const programPosterMode of ['equal','none','featured']) {
    const r=await engine.renderSocialPost({templateId:'sessions-today',movieIds:['p0','p1'],programPosterMode,featuredMovieId:programPosterMode==='featured'?'p1':''},context,{loadImage,skipRaster:true});
    const art=flattenElements(r.scene.elements).filter(e=>e.id.startsWith('movie-art-'));
    assert.equal(art.length,programPosterMode==='none'?0:programPosterMode==='featured'?1:2);
    assert.equal(r.scene.sourceDraft.programSessionCount,2);
    if(programPosterMode==='featured')assert.equal(art[0].id,'movie-art-1');
  }
});
test('filme sem sessões é avisado e bloqueado antes de carregar imagens',async()=>{
  const ctx={...context,movies:[...movies,{id:'empty',title:'Sem programação',sessions:[]}]};
  const input={templateId:'multi-movies',movieIds:['p0','empty']};
  assert.ok(engine.draftNotices(input,ctx).some(n=>n.code==='PROGRAM_EMPTY_MOVIE'));
  let loads=0;
  await assert.rejects(engine.renderSocialPost(input,ctx,{loadImage:async()=>{loads++;return poster;}}),{code:'PROGRAM_EMPTY_MOVIE'});
  assert.equal(loads,0);
});
test('programação extensa bloqueia em vez de omitir sessões',async()=>{
  const dense={...context,movies:movies.map(m=>({...m,sessions:Array.from({length:7},(_,i)=>({...m.sessions[0],id:`${m.id}-${i}`,date:`2026-09-${24+i}`}))}))};
  await assert.rejects(engine.renderSocialPost({templateId:'sessions-week',movieIds:movies.map(m=>m.id),formatId:'square'},dense,{loadImage,skipRaster:true}),{code:'PROGRAM_CAPACITY'});
});
