import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const {curateMovieContent,embeddedMovieTitle}=require('../backend/services/social-studio/composition-engine/movie-content');
const {extractPalette,movieSurface,hexToRgb}=require('../backend/services/social-studio/engine/palette');
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const {sessionMomentParts}=require('../backend/services/social-studio/contracts/artwork-layout');
const {mergeQuality}=require('../backend/services/social-studio/composition-engine/editorial-review');

test('curadoria mantém uma ocorrência semântica, o papel principal e o contrato de exportação',()=>{
  const scene={templateId:'movie-highlight',sourceDraft:{movieManifest:[{id:'subtitle',text:'Em breve'},{id:'detail',text:'EM BREVE'}]},elements:[
    {id:'subtitle',type:'text',text:'Em breve'},{id:'detail',type:'text',text:'EM\nBREVE'},
    {id:'cta',type:'text',text:'Escolha sua sessão'},{id:'description',type:'text',text:'ESCOLHA SUA SESSÃO!'},
    {id:'website',type:'text',text:'www.cinema.com.br'},{id:'cinema',type:'text',text:'Cinema'},
    {id:'logo',role:'logo',type:'image'}]};
  curateMovieContent(scene);
  assert.deepEqual(scene.elements.filter(e=>e.type==='text' && e.visible!==false).map(e=>e.id),['detail','cta','website']);
  assert.deepEqual(scene.sourceDraft.movieManifest,[{id:'detail',text:'EM BREVE'}]);
});

test('título integrado respeita a origem, o enquadramento e as correções do operador',()=>{
  const draft={titleVisibility:'automatic',entities:{movie:{posterUrl:'/poster'}},artworkMetadata:{sourceUrl:'/poster'}};
  assert.equal(embeddedMovieTitle(draft,'/poster').hide,true);
  assert.equal(embeddedMovieTitle(draft,'/upload').hide,false);
  assert.equal(embeddedMovieTitle(draft,'/poster',{intact:false}).hide,false);
  assert.equal(embeddedMovieTitle({...draft,titleVisibility:'show'},'/poster').hide,false);
  assert.equal(embeddedMovieTitle({...draft,title:'Chamada personalizada',entities:{movie:{title:'Filme',posterUrl:'/poster'}}},'/poster').hide,false);
  assert.equal(embeddedMovieTitle({...draft,artworkMetadata:{containsTitle:false}},'/poster').hide,false);
  assert.equal(embeddedMovieTitle({...draft,artworkMetadata:{containsTitle:true,sourceUrl:'/upload'}},'/upload').hide,true);
});

test('paleta de filmes conserva cores da imagem mesmo com outra identidade institucional',async()=>{
  const buffer=await sharp({create:{width:80,height:120,channels:3,background:'#168aaa'}}).png().toBuffer();
  const a=await extractPalette(buffer,{primaryColor:'#ff0000',secondaryColor:'#ff0000',accentColor:'#ff0000'},{preserveArtwork:true});
  const b=await extractPalette(buffer,{primaryColor:'#ffff00',secondaryColor:'#ffff00',accentColor:'#ffff00'},{preserveArtwork:true});
  assert.deepEqual(a,b);
  assert.equal(a.dominantColor,'#168aaa');
  const surface=movieSurface(a),rgb=hexToRgb(surface.dark);
  assert.ok(rgb.b>rgb.r*3 && rgb.g>rgb.r*3);
  assert.ok(Math.max(rgb.r,rgb.g,rgb.b)>=60);
  const white=await sharp({create:{width:40,height:60,channels:3,background:'#ffffff'}}).png().toBuffer();
  assert.equal((await extractPalette(white,{primaryColor:'#ff0000'},{preserveArtwork:true})).dominantColor,'#ffffff');
  const companion=hexToRgb(movieSurface({...a,editorialAtmosphere:{companion:'#134f3a'}}).dark);
  assert.ok(companion.g>companion.r*2 && companion.g>companion.b);
});

test('filme sem sessões exibe EM BREVE uma vez em cada composição',async()=>{
  const poster=await sharp({create:{width:800,height:1200,channels:3,background:'#78b3ca'}}).png().toBuffer();
  const context={now:'2026-10-09T09:00:00-03:00',brand:{name:'Cinema',website:'https://www.cinema.com.br'},movies:[{id:'film',title:'Uma noite especial',posterUrl:'/poster',status:'upcoming',sessions:[]}]};
  for(const layoutId of ['movie-spotlight','movie-editorial-light','movie-immersive','movie-campaign']) {
    const result=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'film',layoutId,formatId:'story',signatureId:'none'},context,{loadImage:async src=>src==='/poster'?poster:null,skipRaster:true,artworkRetried:true});
    const texts=flattenElements(result.scene.elements).filter(e=>e.type==='text' && e.visible!==false).map(e=>e.text.replace(/\s+/g,' '));
    assert.equal(texts.filter(t=>t==='EM BREVE').length,1,layoutId);
    assert.ok(result.quality.accepted,layoutId);
    if(layoutId!=='movie-spotlight')assert.ok(!texts.includes('Uma noite especial'),layoutId);
    assert.ok(!result.scene.elements.some(e=>e.id==='movie-reading-veil'));
  }
});

test('sessão na madrugada mantém data real e só mostra dia comercial quando solicitado',()=>{
  const days=[{date:'2026-10-09',times:['01:00']}];
  const actual=sessionMomentParts(days,{includeDate:true});
  const previous=sessionMomentParts(days,{includeDate:true,dayMode:'previous'});
  assert.match(actual.day,/MADRUGADA DE SEXTA.*09\/10/);
  assert.equal(actual.businessDate,'2026-10-09');
  assert.equal(previous.businessDate,'2026-10-08');
  assert.match(previous.businessDay,/QUI.*08\/10/);
  assert.equal(previous.clock,'01:00');
});

test('spotlight preserva pôster oficial inteiro e destaca horário sem repetir título ou data',async()=>{
  const poster=await sharp({create:{width:800,height:1200,channels:3,background:'#ae6986'}}).png().toBuffer();
  const context={now:'2026-10-08T09:00:00-03:00',brand:{name:'Cinema',website:'https://www.cinema.com.br'},movies:[{id:'film',title:'Filme único',posterUrl:'/poster',releaseDate:'2026-10-09',sessions:[{date:'2026-10-09',time:'21:55'}]}]};
  const result=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'film',layoutId:'movie-spotlight',formatId:'feed_portrait',signatureId:'none'},context,{loadImage:async src=>src==='/poster'?poster:null,skipRaster:true});
  const elements=flattenElements(result.scene.elements),texts=elements.filter(e=>e.type==='text' && e.visible!==false);
  assert.equal(elements.find(e=>e.id==='artwork').fit,'contain');
  assert.ok(!texts.some(e=>e.id==='title'));
  assert.match(texts.find(e=>e.id==='detail').text,/SEXTA.*09\/10/);
  assert.match(texts.find(e=>e.id==='description').text,/21:55/);
  assert.ok(texts.find(e=>e.id==='description').fontSize>=texts.find(e=>e.id==='detail').fontSize*.72);
  assert.equal(texts.filter(e=>/09\/10/.test(e.text)).length,1);
  assert.ok(result.quality.technical.accepted);
  assert.ok(Number.isFinite(result.quality.editorial.score));
});

test('QA editorial penaliza redundância mesmo quando a verificação técnica aprova',()=>{
  const scene={templateId:'movie-highlight',width:1080,height:1350,formatId:'feed_portrait',sourceDraft:{titleEvidence:'registered-poster',editorialTitle:'Filme único',availableArtwork:true},elements:[
    {id:'artwork',role:'artwork',type:'image',src:'/poster',x:0,y:0,width:1080,height:1000,visible:true},
    {id:'title',type:'text',text:'Filme único',x:80,y:1000,width:500,height:90,fontSize:60,visible:true},
    {id:'cta',type:'text',text:'Escolha sua sessão',x:80,y:1140,width:500,height:45,fontSize:32,visible:true}
  ]};
  const quality=mergeQuality(scene,{total:95,accepted:true,issues:[]},{total:95,accepted:true,issues:[]});
  assert.equal(quality.technical.score,95);
  assert.ok(quality.editorial.score<quality.technical.score);
  assert.ok(quality.editorial.issues.some(issue=>issue.code==='REPEATED_MOVIE_TITLE'));
});
