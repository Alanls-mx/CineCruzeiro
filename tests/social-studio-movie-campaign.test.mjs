import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {movieDirection}=require('../backend/services/social-studio/composition-engine/movie-direction');

const logo=await sharp({create:{width:600,height:250,channels:4,background:'#ffffff'}}).png().toBuffer();
const darkLogo=await sharp({create:{width:600,height:250,channels:4,background:'#111111'}}).png().toBuffer();
const warm=await sharp({create:{width:800,height:1200,channels:3,background:'#df906c'}}).png().toBuffer();
const dark=await sharp({create:{width:800,height:1200,channels:3,background:'#17513b'}}).png().toBuffer();
const wide=await sharp({create:{width:1600,height:900,channels:3,background:'#c77a59'}}).png().toBuffer();
const images={'/qa/logo':logo,'/qa/warm':warm,'/qa/dark':dark,'/qa/wide':wide};
const loadImage=async url=>url.includes('/images/social-studio/cine-cruzeiro-assinatura-oficial.png')?logo:url.includes('/images/social-studio/cine-cruzeiro-assinatura-black.png')?darkLogo:images[url] || null;
const render=async (input,options)=>{
  try{return await engine.renderSocialPost(input,options,{loadImage,skipRaster:true,artworkRetried:true});}
  catch(error){if(error.quality)console.error(input.templateId,input.formatId || 'feed_portrait',error.quality.issues);throw error;}
};
const context=(genre,source,title='Uma longa historia de cinema')=>({
  now:'2026-09-24T09:00:00-03:00',
  brand:{name:'Cine Cruzeiro',logoUrl:'/qa/logo',website:'https://cinecruzeiro.com.br'},
  movies:[{id:'film',title,genre,posterUrl:source,releaseDate:'2026-09-25',sessions:[
    {date:'2026-09-25',time:'15:00'},
    {date:'2026-09-25',time:'19:00'}
  ]}]
});

test('campanha integrada adapta tipografia e atmosfera à arte sem cor fixa de gênero',async()=>{
  const light=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign'},context('Romance','/qa/warm'));
  const night=await render({templateId:'movie-presale',movieId:'film',layoutId:'movie-campaign'},context('Ação','/qa/dark'));
  for(const result of [light,night]) {
    assert.equal(result.scene.sourceDraft.movieFamily,'movie-campaign');
    assert.ok(result.quality.accepted);
    assert.ok(result.scene.elements.find(e=>e.id==='artwork').height>=result.scene.height*.68);
    assert.ok(result.scene.elements.some(e=>e.id==='campaign-atmosphere'));
    assert.match(result.scene.elements.map(e=>e.text || '').join(' '),/15:00/);
    assert.match(result.scene.elements.map(e=>e.text || '').join(' '),/19:00/);
  }
  assert.equal(light.scene.elements.find(e=>e.id==='title').fontFamily,'Social Editorial');
  assert.equal(night.scene.elements.find(e=>e.id==='title').fontFamily,'Social Display');
  assert.match(light.scene.elements.find(e=>e.id==='logo').src,/assinatura-black\.png$/);
  assert.match(night.scene.elements.find(e=>e.id==='logo').src,/assinatura-oficial\.png$/);
  const website=scene=>scene.elements.find(e=>e.id==='action-group')?.children.find(e=>e.id==='website');
  assert.equal(website(light.scene).text,'www.cinecruzeiro.com.br');
  assert.equal(website(night.scene).text,'www.cinecruzeiro.com.br');
  assert.notEqual(light.scene.backgroundColor,night.scene.backgroundColor);
  assert.match(night.scene.elements.find(e=>e.id==='detail').text,/PRÉ-VENDA/);
});

test('campanha integrada evita crop agressivo e não redesenha título informado na arte',async()=>{
  const result=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign',artworkMetadata:{containsTitle:true}},context('Comédia','/qa/wide'));
  assert.equal(result.scene.sourceDraft.movieFamily,'movie-campaign');
  assert.ok(result.quality.accepted);
  const artwork=result.scene.elements.find(e=>e.id==='artwork');
  assert.ok(artwork.fit==='contain' || Math.abs(artwork.width/artwork.height-1600/900)<.01);
  assert.ok(!result.scene.elements.some(e=>e.id==='title'));
  assert.ok(result.scene.elements.find(e=>e.id==='detail'));
});

test('campanha integrada passa revisão em feed, quadrado e story',async()=>{
  for(const formatId of ['feed_portrait','square','story'])for(const templateId of ['movie-highlight','movie-premiere','movie-presale']) {
    const result=await render({templateId,movieId:'film',formatId,layoutId:'movie-campaign'},context('Comédia','/qa/warm'));
    assert.equal(result.scene.sourceDraft.movieFamily,'movie-campaign',`${formatId}/${templateId}`);
    assert.ok(result.quality.accepted,`${formatId}/${templateId}: ${JSON.stringify(result.quality.issues)}`);
  }
});

test('automático usa campanha integrada em romance e pré-venda sem perder escolha manual',()=>{
  const draft={movieId:'film',templateId:'movie-highlight',genreProfile:{id:'romance'},artDirection:{seed:1}};
  assert.equal(movieDirection(draft,{},null,true).family,'movie-campaign');
  assert.equal(movieDirection({...draft,templateId:'movie-presale',genreProfile:{id:'action'}},{},null,true).family,'movie-campaign');
  assert.equal(movieDirection(draft,{layoutId:'movie-spotlight'},null,true).family,'movie-spotlight');
});

test('assinatura escolhida manualmente não é substituída pela automática',async()=>{
  const result=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign',signatureId:'classic'},context('Romance','/qa/warm'));
  assert.match(result.scene.elements.find(e=>e.id==='logo').src,/assinatura-oficial\.png$/);
});
