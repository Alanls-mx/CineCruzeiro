import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {reviewEditorial,mergeQuality,geometry,geometryDistance,preferenceBonus}=require('../backend/services/social-studio/composition-engine/editorial-review');
const {selectDiverseVariations}=require('../backend/services/social-studio/composition-engine/variations');
const {ticketCampaignConcept}=require('../backend/services/social-studio/contracts/ticket-campaign');
const {inspectConcessionLayout}=require('../backend/services/social-studio/composition-engine/concession-quality');
const base=()=>({width:1080,height:1920,formatId:'story',templateId:'online-ticket',sourceDraft:{relatedMovieId:'movie',layoutId:'hero-left'},elements:[{id:'title',type:'text',text:'Cinema',x:70,y:180,width:800,height:100,fontSize:80},{id:'cta',type:'text',text:'Escolha sua sessão',x:70,y:1550,width:800,height:50,fontSize:32},{id:'website',type:'text',text:'cinecruzeiro.com.br',x:70,y:1620,width:800,height:40,fontSize:28}]});
test('a atmosfera nao disfarca uma campanha vazia sem imagem disponivel',()=>{
  const scene=base();scene.sourceDraft.availableArtwork=true;scene.elements.unshift({id:'background',role:'ambient',type:'image',src:'/poster',x:0,y:0,width:1080,height:1920});
  const review=reviewEditorial(scene);
  assert.ok(review.issues.some(i=>i.code==='UNUSED_ARTWORK'&&i.blocking));
  assert.ok(review.emptyBand>.42);
  scene.elements.push({id:'artwork',type:'image',src:'/poster',x:80,y:310,width:920,height:1150});
  assert.ok(!reviewEditorial(scene).issues.some(i=>i.blocking));
});
test('avaliacao raster nao apaga avisos editoriais',()=>{
  const scene=base(),merged=mergeQuality(scene,{total:70,accepted:true,issues:[{code:'SMALL_LOGO',elementId:'logo'}]},{total:100,accepted:true,issues:[]});
  assert.equal(merged.accepted,false);
  assert.ok(merged.issues.some(i=>i.code==='SMALL_LOGO'));
  assert.ok(merged.total<100);
});
test('nomes e cores distintos nao tornam a mesma geometria uma nova composicao',()=>{
  const scene=base(),a=geometry(scene),other=structuredClone(scene);other.elements[0].fill='#ff0000';
  assert.equal(geometryDistance(a,geometry(other)),0);
  const rows=[{styleId:'hero-left',creativeIntent:'Editorial',geometry:a},{styleId:'hero-right',creativeIntent:'Cinematográfica',geometry:geometry(other)}];
  assert.equal(selectDiverseVariations(rows,'explore').length,1);
});
test('preferencia e limitada e tres formatos da mesma campanha contam uma vez',()=>{
  const draft={templateId:'movie-highlight',layoutId:'movie-immersive'};
  assert.equal(preferenceBonus(draft,Array.from({length:3},()=>({campaignId:'same',payload:draft}))),0);
  assert.equal(preferenceBonus(draft,Array.from({length:20},(_,i)=>({campaignId:String(i),payload:draft}))),3);
});
test('comparacao de tres preserva as tres intencoes e ordena por qualidade',()=>{
  const rows=[{styleId:'a',creativeIntent:'Editorial'},{styleId:'b',creativeIntent:'Editorial'},{styleId:'c',creativeIntent:'Cinematográfica'},{styleId:'d',creativeIntent:'Comercial'}];
  assert.deepEqual(selectDiverseVariations(rows,'explore',3).map(v=>v.styleId),['a','c','d']);
});
test('cadastro sem imagem carregada nao significa artwork ignorado',()=>{
  assert.ok(!reviewEditorial(base()).issues.some(i=>i.code==='UNUSED_ARTWORK'));
});
test('preco minimo nao recebe um rotulo de preco fixo',()=>{
  const concept=ticketCampaignConcept({priceInfo:{from:true,selection:{mode:'minimum'}}});
  assert.match(concept.headline,/A PARTIR DE/);
  assert.equal(concept.pricePrompt,'');
});
test('imagem cadastrada preserva embalagem e cores na exportacao',()=>{
  const scene={...base(),templateId:'concession-combo',sourceDraft:{productAsset:{source:'/real-product',preservePackaging:true}},elements:[{id:'artwork',type:'image',src:'/modified-product',x:100,y:350,width:600,height:700,fit:'contain'}]};
  assert.ok(inspectConcessionLayout(scene).issues.some(i=>i.code==='PRODUCT_ASSET_INTEGRITY'));
  scene.elements[0].src='/real-product';
  assert.ok(!inspectConcessionLayout(scene).issues.some(i=>i.code==='PRODUCT_ASSET_INTEGRITY'));
});
test('nome do produto aceita acentos corrigidos sem aceitar outro produto',()=>{
  const scene={...base(),templateId:'concession-offer',sourceDraft:{productName:'Combo Familia'},elements:[{id:'title',type:'text',text:'Combo Família',x:70,y:180,width:800,height:100,fontSize:80,lineHeight:1.1,opacity:1}]};
  assert.ok(!inspectConcessionLayout(scene).issues.some(i=>i.code==='PRODUCT_IDENTITY'));
  scene.elements[0].text='Pipoca Grande';
  assert.ok(inspectConcessionLayout(scene).issues.some(i=>i.code==='PRODUCT_IDENTITY'));
});
