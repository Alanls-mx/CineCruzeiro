import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const assets=new Map();
for(const [name,color] of Object.entries({poster:'#962229',backdrop:'#29475c',product:'#f2aa1e',logo:'#238dc2',custom:'#167143'})) {
  assets.set(`/customization/${name}.png`,await sharp({create:{width:800,height:name==='backdrop'?450:1000,channels:3,background:color}}).png().toBuffer());
}
const context={now:'2026-09-23T12:00:00-03:00',brand:{name:'Cine Cruzeiro',website:'https://cinema.example',logoUrl:'/customization/logo.png',posterLogoUrl:'/customization/product.png',primaryColor:'#07111f',accentColor:'#facc15'},
  movies:['one','two','three'].map((id,index)=>({id,title:`Filme ${index+1}`,genre:index?'Animação':'Terror',catalogued:true,posterUrl:'/customization/poster.png',backdropUrl:'/customization/backdrop.png',releaseDate:'2026-10-22',sessions:[{date:'2026-10-22',time:'19:00',price:20},{date:'2026-10-23',time:'21:00',price:20}]})),
  concessions:[{id:'combo',name:'Combo Clássico',description:'Pipoca e refrigerante',price:25,imageUrl:'/customization/product.png'}],clubPlans:[]};
const options={loadImage:async url=>assets.get(url)||null,skipRaster:true};
const layers=result=>flattenElements(result.scene.elements);

test('fundos são independentes do produto e não há logo imposta como hero da compra online',async()=>{
  const online=await engine.renderSocialPost({templateId:'online-ticket',movieId:'one'},context,options);
  assert.equal(online.draft.entities.movie,null);
  assert.equal(online.draft.signatureId,'classic');
  assert.ok(!layers(online).some(e=>e.id==='artwork'));
  for(const background of [{mode:'automatic'},{mode:'solid',color:'#101010'},{mode:'upload',imageUrl:'/customization/custom.png'},{mode:'movie',movieId:'two'},{mode:'catalog',genre:'Terror',movieIds:['one']}]) {
    const result=await engine.renderSocialPost({templateId:'concession-combo',concessionId:'combo',movieId:'two',background},context,options);
    assert.equal(result.draft.entities.movie,null);
    assert.equal(layers(result).find(e=>e.id==='artwork')?.src,'/customization/product.png');
    assert.deepEqual(engine.normalizeDraft(result.draft,context).background,result.draft.background);
    if(background.mode==='upload') assert.equal(layers(result).find(e=>e.id==='custom-background-0').src,background.imageUrl);
    if(background.mode==='solid') assert.equal(result.scene.backgroundColor,'#101010');
  }
  await assert.rejects(()=>engine.renderSocialPost({templateId:'online-ticket',background:{mode:'catalog',genre:'Inexistente'}},context,options),error=>error.code==='BACKGROUND_REQUIRED');
});
test('produto vinculado a filme mantém produto e preço, sem trocar a descrição pelos horários',async()=>{
  const result=await engine.renderSocialPost({templateId:'concession-combo',concessionId:'combo',relatedMovieId:'one'},context,options);
  assert.equal(layers(result).find(e=>e.id==='artwork').src,'/customization/product.png');
  assert.equal(layers(result).find(e=>e.id==='custom-background-0').src,'/customization/backdrop.png');
  assert.equal(result.draft.contentRules.mustShowSessions,false);
  assert.match(engine.captionForDraft(result.draft,context),/Filme 1/);
});

test('posição livre da assinatura é preservada dentro dos três formatos',async()=>{
  for(const formatId of ['feed_portrait','square','story']) {
    const result=await engine.renderSocialPost({templateId:'online-ticket',formatId,signaturePosition:{mode:'manual',x:0,y:0}},context,options);
    const logo=layers(result).find(e=>e.id==='logo');
    assert.ok(logo.x>=0 && logo.y>=0 && logo.x+logo.width<=result.scene.width && logo.y+logo.height<=result.scene.height);
    assert.equal(logo.x,result.scene.width*.025);
    assert.equal(engine.normalizeDraft(result.draft,context).signaturePosition.mode,'manual');
  }
});

test('significado automático escolhe a data estruturada e mantém texto manual quando solicitado',()=>{
  const input={templateId:'movie-premiere',movieId:'one',date:'DATA ANTIGA',subtitle:'ESTREIA',releaseDate:'2026-10-22',sessionDate:'2026-10-23',primaryDateKind:'session',dateTextMode:'automatic'};
  const draft=engine.normalizeDraft(input,context);
  assert.match(draft.date,/23 DE OUTUBRO/);
  assert.match(draft.subtitle,/SESSÃO/);
  assert.equal(engine.normalizeDraft({...input,dateTextMode:'manual'},context).date,'DATA ANTIGA');
  const highlight=engine.normalizeDraft({...input,templateId:'movie-highlight'},context);
  assert.equal(highlight.contentRules.mustKeepDateNearPremiere,true);
});

test('programação migra layouts antigos para a agenda cronológica e preserva a legenda',async()=>{
  for(const programLayout of ['week-timeline','day-cards','poster-calendar','editorial-week']) {
    const result=await engine.renderSocialPost({templateId:'sessions-week',movieIds:['one','two','three'],programLayout},context,options);
    assert.equal(result.draft.resolvedProgramLayout,'program-days');
    assert.match(engine.captionForDraft(result.draft,context),/Filme 2/);
    assert.equal(result.scene.sourceDraft.programSessionCount,6);
  }
  for(const programColumns of [1,2,3]) {
    const result=await engine.renderSocialPost({templateId:'multi-movies',movieIds:['one','two','three'],formatId:'square',programLayout:'cinematic-grid',programColumns,programDays:7},context,options);
    for(const element of layers(result).filter(e=>e.id.startsWith('movie-art-'))) assert.ok(element.height>=50);
  }
  const blocked=structuredClone(context);blocked.movies[0].sessions.forEach(s=>s.availableForPurchase=false);
  assert.equal(engine.normalizeDraft({templateId:'sessions-week',movieId:'one',periodStart:'2026-10-22'},blocked).schedule.count,0);
});
