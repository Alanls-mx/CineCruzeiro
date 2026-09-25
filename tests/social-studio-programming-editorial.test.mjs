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
  for(const [count,layout] of [[1,'program-hero'],[2,'program-duo'],[3,'program-grid'],[5,'program-grid'],[8,'program-list']]) {
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
    assert.equal(rendered.draft.resolvedProgramLayout,({1:'program-hero',2:'program-duo',3:'program-grid',5:'program-grid',8:'program-list'})[count],`${count} ${formatId}`);
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
test('pôsteres são obrigatórios inclusive em pedidos antigos sem imagem e no destaque',async()=>{
  for(const programPosterMode of ['equal','none','featured']) {
    const r=await engine.renderSocialPost({templateId:'sessions-today',movieIds:['p0','p1'],programPosterMode,featuredMovieId:programPosterMode==='featured'?'p1':''},context,{loadImage,skipRaster:true});
    const art=flattenElements(r.scene.elements).filter(e=>e.id.startsWith('movie-art-'));
    assert.equal(art.length,2);
    assert.equal(r.scene.sourceDraft.programSessionCount,2);
    if(programPosterMode==='featured')assert.equal(art[0].id,'movie-art-1');
  }
});
test('tratamentos de cor preservam a programação sempre com imagens',async()=>{
  const backgrounds=new Set();
  for(const programStyle of ['vibrant','premium','noir','cinematic','editorial'])for(const programPosterMode of ['equal','none']) {
    const rendered=await engine.renderSocialPost({templateId:'sessions-today',movieIds:['p0','p1'],programStyle,programPosterMode},context,{loadImage,skipRaster:true});
    assert.ok(rendered.quality.accepted,`${programStyle} ${programPosterMode}: ${JSON.stringify(rendered.quality.issues)}`);
    backgrounds.add(rendered.scene.backgroundColor);
    assert.equal(flattenElements(rendered.scene.elements).filter(e=>e.id.startsWith('movie-art-')).length,2);
    assert.equal(rendered.scene.sourceDraft.programSessionCount,2);
    if(programStyle==='vibrant') {
      assert.equal(rendered.scene.backgroundColor,'#ffda38');
      assert.ok(rendered.scene.elements.some(e=>e.id==='program-cross-band-one'));
    }
  }
  assert.ok(backgrounds.size>=4);
});
test('agenda por dias migra a opção antiga sem imagens preservando horários',async()=>{
  const varied={...context,movies:movies.slice(0,2).map((movie,index)=>({...movie,sessions:[{...movie.sessions[0],date:index?'2026-09-25':'2026-09-24'}]}))};
  const enabled=await engine.renderSocialPost({templateId:'sessions-week',movieIds:['p0','p1'],programPosterMode:'equal'},varied,{loadImage,skipRaster:true});
  const disabled=await engine.renderSocialPost({templateId:'sessions-week',movieIds:['p0','p1'],programPosterMode:'none'},varied,{loadImage,skipRaster:true});
  assert.equal(enabled.scene.sourceDraft.programSessionCount,disabled.scene.sourceDraft.programSessionCount);
  assert.equal(flattenElements(enabled.scene.elements).filter(e=>e.id.startsWith('movie-art-')).length,2);
  assert.equal(flattenElements(disabled.scene.elements).filter(e=>e.id.startsWith('movie-art-')).length,2);
});

test('programação identifica filme sem imagem e impede remoção de cartazes na edição',async()=>{
  const missing={...context,movies:[{...movies[0],posterUrl:'',backdropUrl:''}]};
  await assert.rejects(engine.renderSocialPost({templateId:'sessions-today',movieIds:['p0']},missing,{loadImage,skipRaster:true}),error=>error.code==='PROGRAM_IMAGES_REQUIRED' && error.message.includes('Coyote vs. ACME'));
  const rendered=await engine.renderSocialPost({templateId:'sessions-today',movieIds:['p0','p1']},context,{loadImage,skipRaster:true});
  const removePosters=elements=>elements.filter(e=>!e.id.startsWith('movie-art-')).map(e=>e.children?{...e,children:removePosters(e.children)}:e);
  rendered.scene.elements=removePosters(rendered.scene.elements);
  assert.ok(validateArtworkLayout(rendered.scene).issues.some(issue=>issue.code==='PROGRAM_IMAGES_REQUIRED'));
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

test('campanha concentra o dia no cabeçalho e agrupa todos os horários',async()=>{
  const ctx={...context,movies:movies.slice(0,3).map(m=>({...m,sessions:[...m.sessions,{...m.sessions[0],id:`extra-${m.id}`,time:'22:30'}]}))};
  for(const programLayout of ['program-cards','program-grid','program-days']) {
    const r=await engine.renderSocialPost({templateId:'multi-movies',movieIds:['p0','p1','p2'],programLayout},ctx,{loadImage,skipRaster:true});
    const elements=flattenElements(r.scene.elements);
    assert.equal(elements.filter(e=>e.type==='text' && /24\/09/.test(e.text)).length,1,programLayout);
    assert.equal(elements.filter(e=>e.type==='text' && /22H30/.test(e.text)).length,3,programLayout);
    assert.equal(r.scene.sourceDraft.programSessionCount,6);
    assert.equal(r.scene.sourceDraft.programSolidFallback,undefined);
    assert.ok(elements.some(e=>e.id==='program-atmosphere'));
    assert.ok(validateArtworkLayout(r.scene).valid);
  }
});

test('três direções de campanha alteram a geometria, não apenas a cor',async()=>{
  const geometries=new Set();
  for(const programLayout of ['program-cards','program-grid','program-days']) {
    const r=await engine.renderSocialPost({templateId:'multi-movies',movieIds:['p0','p1','p2'],programLayout},context,{loadImage,skipRaster:true,artworkRetried:true});
    const posters=flattenElements(r.scene.elements).filter(e=>e.id.startsWith('movie-art-'));
    assert.equal(posters.length,3);
    geometries.add(JSON.stringify(posters.map(e=>[e.x,e.y,e.width,e.height])));
    if(programLayout==='program-grid')assert.ok(posters[0].width*posters[0].height>posters[1].width*posters[1].height*2);
  }
  assert.equal(geometries.size,3);
});

test('duas datas preservam mosaico e associações de cada horário',async()=>{
  const ctx={...context,movies:movies.slice(0,3).map((m,i)=>({...m,sessions:i===0?[...m.sessions,{...m.sessions[0],id:'tomorrow',date:'2026-09-25'}]:m.sessions}))};
  const r=await engine.renderSocialPost({templateId:'multi-movies',movieIds:['p0','p1','p2'],programLayout:'program-grid'},ctx,{loadImage,skipRaster:true,artworkRetried:true});
  assert.equal(r.draft.resolvedProgramLayout,'program-grid');
  assert.equal(r.scene.sourceDraft.programSessionCount,4);
  assert.equal(r.scene.sourceDraft.programBindings.length,4);
  assert.equal(new Set(r.scene.sourceDraft.programBindings.map(b=>b.id)).size,4);
  assert.ok(validateArtworkLayout(r.scene).valid);
});

test('comparação do workspace retorna três estruturas com nomes próprios',async()=>{
  const {generateVariations}=require('../backend/services/social-studio/composition-engine/variations');
  const result=await generateVariations({templateId:'multi-movies',movieIds:['p0','p1','p2'],workspaceVersion:2,formatId:'feed_portrait',programStyle:'cinematic'},context,{loadImage});
  assert.equal(result.variations.length,3);
  assert.equal(new Set(result.variations.map(v=>v.draft.resolvedProgramLayout)).size,3);
  assert.deepEqual(new Set(result.variations.map(v=>v.name)),new Set(['Cartazes editoriais','Destaque e mosaico','Agenda por dia']));
});
