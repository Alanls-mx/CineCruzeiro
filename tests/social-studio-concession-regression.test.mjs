import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const studio=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const product=await sharp({create:{width:600,height:800,channels:4,background:'#e49b26'}}).png().toBuffer();
const movie=await sharp({create:{width:1200,height:700,channels:3,background:'#2e7799'}}).png().toBuffer();
const logo=await sharp({create:{width:500,height:180,channels:4,background:'#ffffff'}}).png().toBuffer();
const images=new Map([['/product',product],['/movie',movie],['/logo',logo]]);
const loadImage=async url=>images.get(url)||null;
const context={
  brand:{name:'Cine Cruzeiro',posterLogoUrl:'/logo',website:'https://cinecruzeiro.com.br'},
  concessions:[{id:'popcorn',name:'Pipoca Grande',description:'Pipoca quentinha na manteiga.',price:18,imageUrl:'/product'}],
  movies:[{id:'film',title:'Filme de teste',posterUrl:'/movie',backdropUrl:'/movie',catalogued:true}],
  clubPlans:[]
};
const supportingText='Pipoca quentinha na manteiga. Escolha sua pipoca antes de entrar na sala.';
const input={templateId:'concession-combo',concessionId:'popcorn',relatedMovieId:'film',formatId:'feed_portrait',signatureId:'icon-3d',auxiliaryText:supportingText,concessionDirection:{family:'cinematic-product'}};

test('produto vinculado usa atmosfera própria e texto complementar legível',async()=>{
  const loaded=[];
  const result=await studio.renderSocialPost(input,context,{loadImage:async url=>{loaded.push(url);return loadImage(url);},concessionRetried:true});
  const elements=flattenElements(result.scene.elements);
  assert.equal(result.quality.accepted,true,JSON.stringify(result.quality.issues));
  assert.ok(result.buffer?.length>1000);
  assert.ok(elements.some(element=>element.id==='product-atmosphere' && element.src==='/product'));
  assert.ok(!elements.some(element=>element.id.startsWith('custom-background-')));
  assert.ok(!loaded.includes('/movie'));
  const support=elements.find(element=>element.id==='support');
  assert.ok(support && support.fontSize>=28);
  assert.equal(support.text.replace(/\n/g,' '),supportingText);
  assert.ok(studio.captionForDraft(input,context).includes(supportingText));
});

test('texto complementar longo usa um trecho legível sem perder a legenda',async()=>{
  const longText=`${supportingText} Prepare seu pedido com antecedência para aproveitar toda a sessão.`;
  const request={...input,auxiliaryText:longText};
  const result=await studio.renderSocialPost(request,context,{loadImage,skipRaster:true,concessionRetried:true});
  const support=flattenElements(result.scene.elements).find(element=>element.id==='support');
  assert.equal(result.quality.accepted,true,JSON.stringify(result.quality.issues));
  assert.ok(!support || support.fontSize>=28);
  assert.ok(result.notices.some(notice=>notice.code==='COPY_MOVED_TO_CAPTION'));
  assert.ok(studio.captionForDraft(request,context).includes(longText));
});

test('fundo de filme continua disponível quando escolhido explicitamente',async()=>{
  const result=await studio.renderSocialPost({...input,auxiliaryText:'Pipoca quentinha na manteiga.',background:{mode:'movie',movieId:'film'}},context,{loadImage,skipRaster:true,concessionRetried:true});
  assert.ok(flattenElements(result.scene.elements).some(element=>element.id==='custom-background-0' && element.src==='/movie'));
});

test('miniatura amarela e composicao Produto e preco usam o mesmo tratamento',async()=>{
  const request={...input,workspaceVersion:2,layoutId:'product-price',style:'product-price',automaticStyle:false,concessionDirection:{family:'automatic',objective:'sell'}};
  const result=await studio.renderSocialPost(request,context,{loadImage});
  assert.equal(result.draft.concessionDirection.layout,'product-price');
  assert.equal(result.draft.concessionDirection.family,'commercial-vibrant');
  assert.equal(result.scene.backgroundColor,'#ffda38');
  assert.equal(result.quality.accepted,true,JSON.stringify(result.quality.issues));
  assert.ok(result.buffer?.length>1000);
  const corner=await sharp(result.buffer).extract({left:8,top:Math.round(result.scene.height*.5),width:1,height:1}).removeAlpha().raw().toBuffer();
  assert.ok(corner[0]>230 && corner[1]>180 && corner[2]<100,`Fundo exportado: ${[...corner]}`);
});

test('tratamento manual continua podendo substituir o padrao do layout',()=>{
  const request={...input,layoutId:'product-price',concessionDirection:{family:'clean-premium',objective:'sell'}};
  const draft=studio.normalizeDraft(request,context);
  assert.equal(draft.concessionDirection.family,'clean-premium');
  assert.equal(draft.concessionDirection.layout,'product-price');
});

test('cada cartao de bomboniere seleciona seu tratamento automatico',()=>{
  const treatments={'product-price':'commercial-vibrant','product-lateral':'cinematic-product','hero-product':'dark-snack'};
  for(const [layoutId,family] of Object.entries(treatments)) {
    const draft=studio.normalizeDraft({...input,workspaceVersion:2,layoutId,style:layoutId,concessionDirection:{family:'automatic'}},context);
    assert.equal(draft.concessionDirection.layout,layoutId);
    assert.equal(draft.concessionDirection.family,family);
  }
});
