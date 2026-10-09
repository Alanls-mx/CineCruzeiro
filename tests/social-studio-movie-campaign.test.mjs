import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {movieDirection}=require('../backend/services/social-studio/composition-engine/movie-direction');
const artworkQuality=require('../backend/services/social-studio/composition-engine/artwork-quality');
const {renderSocialScene}=require('../backend/services/social-studio/scene/renderer');

const logo=await sharp({create:{width:600,height:250,channels:4,background:'#ffffff'}}).png().toBuffer();
const darkLogo=await sharp({create:{width:600,height:250,channels:4,background:'#111111'}}).png().toBuffer();
const warm=await sharp({create:{width:800,height:1200,channels:3,background:'#df906c'}}).png().toBuffer();
const dark=await sharp({create:{width:800,height:1200,channels:3,background:'#17513b'}}).png().toBuffer();
const wide=await sharp({create:{width:1600,height:900,channels:3,background:'#c77a59'}}).png().toBuffer();
const mixed=await sharp({create:{width:800,height:1200,channels:3,background:'#f1e7df'}})
  .composite([{input:await sharp({create:{width:400,height:1200,channels:3,background:'#251a20'}}).png().toBuffer(),left:400,top:0}]).png().toBuffer();
const images={'/qa/logo':logo,'/qa/warm':warm,'/qa/dark':dark,'/qa/wide':wide,'/qa/mixed':mixed};
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
  const light=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign',titleVisibility:'show'},context('Romance','/qa/warm'));
  const night=await render({templateId:'movie-presale',movieId:'film',layoutId:'movie-campaign',titleVisibility:'show'},context('Ação','/qa/dark'));
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

test('pôster cadastrado preserva o título original por padrão e permite título explícito',async()=>{
  const original=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign'},context('Comédia','/qa/warm'));
  assert.ok(!original.scene.elements.some(e=>e.id==='title'));
  assert.equal(original.scene.elements.find(e=>e.id==='artwork').fit,'contain');
  assert.ok(original.scene.elements.find(e=>e.id==='artwork').height>=original.scene.height*.65);
  assert.equal(original.scene.elements.find(e=>e.id==='artwork').effects.mask,'fade-all');
  assert.ok(original.scene.elements.find(e=>e.id==='detail').y>original.scene.elements.find(e=>e.id==='artwork').height);
  assert.equal(original.scene.elements.find(e=>e.id==='background-blur').fit,'fill');
  const explicit=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign',artworkMetadata:{containsTitle:false}},context('Comédia','/qa/warm'));
  assert.ok(explicit.scene.elements.some(e=>e.id==='title'));
});

test('campanha integrada passa revisão em feed, quadrado e story',async()=>{
  for(const formatId of ['feed_portrait','square','story'])for(const templateId of ['movie-highlight','movie-premiere','movie-presale']) {
    const result=await render({templateId,movieId:'film',formatId,layoutId:'movie-campaign'},context('Comédia','/qa/warm'));
    assert.equal(result.scene.sourceDraft.movieFamily,'movie-campaign',`${formatId}/${templateId}`);
    assert.ok(result.quality.accepted,`${formatId}/${templateId}: ${JSON.stringify(result.quality.issues)}`);
    const date=result.scene.elements.find(e=>e.id===('movie-highlight'===templateId?'detail':'description'));
    const time=result.scene.elements.find(e=>e.id==='session-time');
    assert.ok(date && time,`${formatId}/${templateId}`);
    assert.doesNotMatch(date.text,/ÀS|15:00|19:00/);
    assert.match(time.text,/^15:00 \/ 19:00$/);
    assert.ok(time.fontSize>date.fontSize,`${formatId}/${templateId}: horário sem destaque`);
    assert.ok(time.y>=date.y+date.height,`${formatId}/${templateId}: horário invadiu a data`);
    const logo=result.scene.elements.find(e=>e.id==='logo');
    assert.ok(logo.x>result.scene.width*.7 && logo.y>result.scene.height*.7,`${formatId}/${templateId}: assinatura fora do rodapé`);
    if(formatId==='story')assert.ok(result.scene.elements.find(e=>e.id==='artwork').height<=result.scene.height*.68,`${formatId}/${templateId}: preserve o title lockup inferior`);
  }
});

test('prefixo de continuidade aparece separado apenas quando há sessões em vários dias',async()=>{
  const single=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign'},context('Comédia','/qa/warm'));
  assert.ok(!single.scene.elements.some(e=>e.id==='session-kicker'));
  assert.match(single.scene.elements.find(e=>e.id==='detail').text,/SEXTA • 25\/09/);
  const ongoing=context('Comédia','/qa/warm');
  ongoing.movies[0].sessions.push({date:'2026-09-26',time:'16:00'});
  const multiple=await render({templateId:'movie-highlight',movieId:'film',layoutId:'movie-campaign'},ongoing);
  assert.equal(multiple.scene.elements.find(e=>e.id==='session-kicker').text,'A PARTIR DE');
  assert.match(multiple.scene.elements.find(e=>e.id==='detail').text,/SEXTA • 25\/09/);
});

test('contraste integrado preserva a imagem com máscara suave em vez de faixa sólida',async()=>{
  const scene={templateId:'movie-highlight',formatId:'feed_portrait',width:1080,height:1350,backgroundColor:'#f1e7df',
    sourceDraft:{integratedCampaign:true,solidPanelAllowed:false},elements:[
      {id:'artwork',role:'artwork',type:'image',src:'/qa/mixed',x:0,y:0,width:1080,height:1350,fit:'cover',opacity:1},
      {id:'title',role:'title',type:'text',text:'Título do filme',x:130,y:700,width:820,height:155,fontFamily:'Social Display',fontSize:90,fontWeight:900,fill:'#ffffff',lineHeight:1,align:'center',opacity:1},
      {id:'detail',role:'detail',type:'text',text:'ESTREIA NA SEXTA',x:180,y:930,width:720,height:90,fontFamily:'Social Display',fontSize:58,fontWeight:900,fill:'#ffffff',lineHeight:1,align:'center',opacity:1}
    ]};
  await artworkQuality.repairContrast(scene,loadImage);
  const soft=scene.elements.find(element=>element.id==='movie-soft-contrast');
  assert.ok(soft);
  assert.equal(soft.type,'image');
  assert.equal(soft.effects.layer,'contrast');
  assert.ok(soft.opacity<1);
  assert.equal(scene.elements.filter(element=>element.role==='contrast').length,1);
  assert.ok(!scene.elements.some(element=>element.role==='contrast' && element.type==='shape'));
  const background={...scene,elements:scene.elements.filter(element=>element.type!=='text')};
  const {buffer}=await renderSocialScene(background,{loadImage,layerRender:true});
  const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const luma=(x,y)=>{const i=(y*info.width+x)*info.channels;return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];};
  assert.ok(luma(540,770)<luma(540,470)-25);
  assert.ok(Math.abs(luma(540,470)-luma(540,490))<50);
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
