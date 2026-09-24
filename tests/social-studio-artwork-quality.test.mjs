import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {MOVIE_FAMILIES,scheduleLabel}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const poster=await sharp({create:{width:800,height:1200,channels:3,background:'#f4eee2'}}).png().toBuffer();
const logo=await sharp({create:{width:600,height:200,channels:3,background:'#4488ee'}}).png().toBuffer();
const loadImage=async src=>src==='/quality-logo'?logo:src==='/quality-poster'?poster:null;
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/quality-logo',website:'https://cinecruzeiro.com.br'},movies:[{id:'m',title:'Gladiador 2',posterUrl:'/quality-poster',releaseDate:'2026-09-24',sessions:[{id:'s',date:'2026-09-24',time:'13:00',ticketTypes:[{id:'full',name:'Inteira',price:29.9}]}]}]};
test('famílias oficiais preservam o pôster e contraste em todos os formatos',async()=>{
  for(const formatId of ['square','feed_portrait','story'])for(const layoutId of Object.keys(MOVIE_FAMILIES)) {
    const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'m',formatId,layoutId},context,{loadImage,skipRaster:true});
    assert.ok(r.quality.accepted);
    const elements=flattenElements(r.scene.elements),art=elements.find(e=>e.id==='artwork');
    assert.equal(art.fit,'contain');assert.ok(!art.crop && !art.effects);
    assert.ok(elements.filter(e=>e.type==='text' && e.visible!==false).every(e=>e.contrastRatio>=4.5));
    assert.equal(r.draft.cta,'ESCOLHA SUA SESSÃO');
    assert.ok(elements.some(e=>e.text?.includes('13H00')));
  }
});
test('datas são absolutas e CTA explícito travado é preservado',()=>{
  assert.equal(scheduleLabel({date:'2026-09-24',times:['13:00','19:30']}),'QUI • 24/09 • 13H00 / 19H30');
  const draft=engine.normalizeDraft({templateId:'movie-highlight',movieId:'m',cta:'CONFIRA AS SESSÕES',copyLocks:{cta:true}},context);
  assert.equal(draft.cta,'CONFIRA AS SESSÕES');
});
test('exportação rejeita logo central, recorte, sobreposição, opacidade e imagem ausente',async()=>{
  const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'m',layoutId:'poster-lateral'},context,{loadImage,skipRaster:true});
  for(const kind of ['logo','crop','overlap','opacity','missing','cover']) {
    const scene=structuredClone(r.scene),title=scene.elements.find(e=>e.id==='title');
    if(kind==='logo')scene.elements.find(e=>e.id==='logo').x=scene.width*.45;
    if(kind==='crop')scene.elements.find(e=>e.id==='artwork').crop={x:0,y:0,width:100,height:100};
    if(kind==='overlap')Object.assign(title,{x:scene.elements.find(e=>e.id==='artwork').x,y:scene.elements.find(e=>e.id==='artwork').y});
    if(kind==='opacity')title.opacity=.1;
    if(kind==='missing')scene.elements.find(e=>e.id==='artwork').src='/missing-quality-art';
    if(kind==='cover')scene.elements.push({id:'cover',type:'shape',x:title.x,y:title.y,width:title.width,height:title.height,fill:'#000000'});
    await assert.rejects(engine.renderSocialScene(scene,{loadImage}),{code:'ARTWORK_QUALITY'});
  }
});
