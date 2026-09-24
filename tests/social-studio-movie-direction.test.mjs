import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {movieDirection}=require('../backend/services/social-studio/composition-engine/movie-direction');
const {MOVIE_FAMILIES}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const assets={poster:await sharp({create:{width:800,height:1200,channels:3,background:'#997522'}}).png().toBuffer(),backdrop:await sharp({create:{width:1600,height:900,channels:3,background:'#276799'}}).png().toBuffer(),logo:await sharp({create:{width:600,height:200,channels:3,background:'#277abc'}}).png().toBuffer()};
const loadImage=async src=>assets[src.replace('/movie-direction/','')] || null;
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/movie-direction/logo',website:'https://cinecruzeiro.com.br'},movies:[{id:'movie',title:'Uma aventura extraordinária',genre:'Ação',posterUrl:'/movie-direction/poster',backdropUrl:'/movie-direction/backdrop',releaseDate:'2026-09-25',sessions:[{date:'2026-09-25',time:'13:00',ticketTypes:[{id:'full',name:'Inteira',price:29.9}]},{date:'2026-09-25',time:'18:30',ticketTypes:[{id:'full',name:'Inteira',price:29.9}]}]}]};
test('arquétipos cinematográficos funcionam em formatos e campanhas preservando horários e contraste',async()=>{
  for(const templateId of ['movie-highlight','movie-premiere','movie-presale','movie-price'])for(const formatId of ['feed_portrait','square','story'])for(const layoutId of Object.keys(MOVIE_FAMILIES)) {
    const r=await engine.renderSocialPost({templateId,movieId:'movie',formatId,layoutId,priceSelection:{mode:'full'}},context,{loadImage,skipRaster:true});
    assert.ok(r.quality.accepted,`${templateId}/${formatId}/${layoutId}`);
    const elements=flattenElements(r.scene.elements),text=elements.map(e=>e.text || '').join(' ').replace(/\s+/g,' ');
    assert.match(text,/13[H:]00/);assert.match(text,/18[H:]30/);
    assert.ok(elements.filter(e=>e.type==='text').every(e=>e.contrastRatio>=4.5));
    assert.ok(elements.find(e=>e.role==='logo').width/r.scene.width<=.19);
  }
});
test('seleção considera áreas livres, material e gênero sem alegar detecção de rostos',()=>{
  const draft={movieId:'one',genreProfile:{id:'family'},artDirection:{seed:3}};
  const analysis={quietest:'left',zones:[{id:'left',complexity:.07},{id:'right',complexity:.5},{id:'bottom',complexity:.4}],focusX:75,focusY:42,method:'luminance-edge-density'};
  assert.equal(movieDirection(draft,{},analysis,false).copySide,'left');
  const selected=movieDirection(draft,{layoutId:'movie-character'},analysis,true,{focusX:25,focusY:35});
  assert.equal(selected.family,'movie-character');assert.equal(selected.focusX,25);
  assert.equal(selected.subjectDetection,'visual-saliency-heuristic');
  assert.equal(movieDirection(draft,{layoutId:'movie-full-bleed'},analysis,false).family,'cinematic-blend');
  const families=new Set(['horror','family','action','comedy','drama'].map(id=>movieDirection({...draft,genreProfile:{id}},{},analysis,true).family));
  assert.ok(families.size>=3);
  for(const genre of ['family','comedy','drama'])assert.ok(!['poster-lateral','poster-editorial','cinematic-story'].includes(movieDirection({...draft,genreProfile:{id:genre}},{},analysis,true).family));
});
test('estreia comunica a data uma vez e conserva todos os horários',async()=>{
  const result=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'movie',layoutId:'movie-spotlight'},context,{loadImage,skipRaster:true});
  const description=flattenElements(result.scene.elements).find(e=>e.id==='description');
  assert.equal(description.text,'13:00 • 18:30');
  assert.ok(['film-wash','film-atmosphere','hero-light','film-vignette'].every(id=>result.scene.elements.some(e=>e.id===id)));
  assert.ok(flattenElements(result.scene.elements).find(e=>e.id==='detail').fontSize>=80);
});
test('editorial integrado dissolve o pôster em fundo derivado e mantém ação e assinatura',async()=>{
  const result=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'movie',formatId:'feed_portrait',layoutId:'movie-editorial-light'},context,{loadImage,skipRaster:true});
  const elements=flattenElements(result.scene.elements);
  assert.ok(result.quality.accepted);
  assert.equal(result.scene.sourceDraft.movieFamily,'movie-editorial-light');
  assert.equal(elements.find(e=>e.id==='artwork').effects.mask,'fade-all');
  assert.ok(elements.some(e=>e.id==='editorial-brand-band'));
  assert.ok(elements.find(e=>e.id==='logo').x<result.scene.width*.2);
  assert.ok(elements.find(e=>e.id==='website').text.includes('cinecruzeiro.com.br'));
});
test('exportação manual preserva horários e não permite trocar poster por recorte',async()=>{
  const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'movie',layoutId:'movie-asymmetric'},context,{loadImage,skipRaster:true,artworkRetried:true});
  const altered=structuredClone(r.scene);
  altered.elements.find(e=>e.id==='description').text='23:00';
  await assert.rejects(engine.renderSocialScene(altered,{loadImage}),{code:'ARTWORK_QUALITY'});
  const crop=structuredClone(r.scene);crop.elements.find(e=>e.id==='artwork').fit='cover';
  await assert.rejects(engine.renderSocialScene(crop,{loadImage}),{code:'ARTWORK_QUALITY'});
});
