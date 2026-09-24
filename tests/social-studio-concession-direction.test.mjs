import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {FAMILIES,categoryFor,concessionCopy,normalizeConcession}=require('../backend/services/social-studio/contracts/concession-campaign');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const {renderSocialScene}=require('../backend/services/social-studio/scene/renderer');
const {generateVariations}=require('../backend/services/social-studio/composition-engine/variations');
const {createSpec}=require('../backend/services/social-studio/remotion/spec');
const product=await sharp({create:{width:600,height:800,channels:4,background:'#cc7711'}}).png().toBuffer();
const logo=await sharp({create:{width:500,height:180,channels:4,background:'#ffffff'}}).png().toBuffer();
const images=new Map([['/p',product],['/logo',logo],['/back',product]]);
const loadImage=async src=>images.get(src)||null;
const context={brand:{name:'Cine Cruzeiro',logoUrl:'/logo',website:'https://cinecruzeiro.com.br'},concessions:[{id:'p',name:'Combo Família',description:'Pipoca e refrigerante',price:42,imageUrl:'/p'}],movies:[],clubPlans:[]};
const input={templateId:'concession-combo',concessionId:'p',signatureId:'classic'};

test('direção reconhece categorias sem transformar descrição de combo em categoria de bebida',()=>{
  for(const [name,category] of [['Pipoca Grande','popcorn'],['Coca-Cola 500ML','soda'],['Chocolate de Cinema','chocolate'],['Combo Clássico','individual'],['Combo Duplo','couple'],['Combo Família','family'],['Foto Temática','product']]) assert.equal(categoryFor({name}),category);
  assert.equal(categoryFor({name:'Combo Família'},'soda'),'soda');
  assert.equal(normalizeConcession(input,context.concessions[0]).brandedProduct,false);
});
test('copy varia por produto, objetivo e histórico sem inventar desconto, estoque ou quantidade',()=>{
  const outputs=new Set();
  for(const category of ['popcorn','soda','chocolate','individual','couple','family']) {
    for(let i=0;i<6;i++) {
      const copy=concessionCopy(context.concessions[0],{category,objective:'sell'},i,{});
      outputs.add(copy.kicker);
      assert.doesNotMatch(copy.caption,/últimas unidades|desconto|grátis|litros|somente hoje/i);
      assert.match(copy.detail,/42,00/);
    }
  }
  assert.ok(outputs.size>=30);
});
test('quatro direções em três formatos passam pela avaliação antes da exibição',async()=>{
  for(const formatId of ['square','feed_portrait','story']) for(const family of Object.keys(FAMILIES)) {
    const result=await engine.renderSocialPost({...input,formatId,concessionDirection:{family}},context,{loadImage,skipRaster:true,concessionRetried:true});
    assert.equal(result.quality.accepted,true,JSON.stringify(result.quality));
    const elements=flattenElements(result.scene.elements);
    assert.ok(elements.filter(e=>e.type==='text').every(e=>e.contrastRatio>=4.5));
    assert.equal(elements.find(e=>e.id==='detail').text,'R$ 42,00');
    assert.ok(createSpec(result.scene).tracks.some(t=>t.role==='hero'));
    assert.ok(createSpec(result.scene).tracks.some(t=>t.role==='cta'));
  }
});
test('fundo personalizado claro é corrigido e logo manual em colisão retorna à zona segura',async()=>{
  const result=await engine.renderSocialPost({...input,background:{mode:'solid',color:'#ffffff'},signaturePosition:{mode:'manual',x:5,y:5}},context,{loadImage,skipRaster:true});
  assert.ok(result.quality.accepted);
  const logo=flattenElements(result.scene.elements).find(e=>e.id==='logo');
  assert.ok(logo.y>result.scene.height*.7);
});
test('editor não exporta sobreposição, baixo contraste, transparência ou preço alterado',async()=>{
  const result=await engine.renderSocialPost({...input,concessionDirection:{family:'commercial-vibrant'}},context,{loadImage,skipRaster:true});
  for(const kind of ['overlap','contrast','price','opacity','safe']) {
    const scene=structuredClone(result.scene);
    const title=scene.elements.find(e=>e.id==='title');
    if(kind==='overlap')Object.assign(scene.elements.find(e=>e.id==='logo'),{x:title.x,y:title.y});
    if(kind==='contrast')title.fill=scene.backgroundColor;
    if(kind==='opacity')title.opacity=.1;
    if(kind==='price')scene.elements.find(e=>e.id==='detail').text='R$ 1,00';
    if(kind==='safe')title.x=-25;
    await assert.rejects(renderSocialScene(scene,{loadImage}),{code:'CONCESSION_QUALITY'});
  }
});
test('não mostra produto ausente, transparente ou descrição longa ilegível',async()=>{
  await assert.rejects(engine.renderSocialPost({...input,imageUrl:'/missing-product'},context,{loadImage:async()=>null}),{code:'PRODUCT_IMAGE_REQUIRED'});
  await assert.rejects(engine.renderSocialPost({...input,auxiliaryText:'Descrição extensa '.repeat(30)},context,{loadImage,skipRaster:true}),{code:'CONCESSION_QUALITY'});
});
test('variações aprovadas representam famílias realmente diferentes',async()=>{
  const result=await generateVariations(input,context,{loadImage});
  assert.equal(new Set(result.variations.map(v=>v.styleId)).size,3);
  assert.ok(result.variations.every(v=>v.quality.accepted && v.image));
});
