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
const {movieDirection}=require('../backend/services/social-studio/composition-engine/movie-direction');
const {buildMovieCinematic}=require('../backend/services/social-studio/scene/movie-cinematic');

test('direção editorial adapta fonte e bordas à obra sem depender do título',()=>{
  const analysis={brightness:.62,zones:[{id:'bottom',complexity:.10},{id:'left',complexity:.12},{id:'right',complexity:.14}]};
  const input={layoutId:'movie-editorial-light',formatId:'square'};
  const comedy=movieDirection({genreProfile:{id:'comedy'},formatId:'square',templateId:'movie-highlight'},input,analysis,false,null);
  const romance=movieDirection({genreProfile:{id:'romance'},formatId:'square',templateId:'movie-highlight'},input,analysis,false,null);
  assert.equal(comedy.editorialFont,'Social Display');
  assert.equal(comedy.edgeTreatment,'soft');
  assert.equal(movieDirection({genreProfile:{id:'comedy'},formatId:'story',templateId:'movie-highlight'},input,analysis,false,null).edgeTreatment,'preserved');
  assert.equal(romance.editorialFont,'Social Editorial');
  assert.ok(romance.blur<30);
  assert.equal(movieDirection({genreProfile:{id:'comedy'},formatId:'square',templateId:'movie-highlight'}, {...input,movieEdgeTreatment:'progressive'},analysis,false,null).edgeTreatment,'progressive');
});

test('direção lateral só desloca o pôster quando a imagem oferece um lado livre',()=>{
  const draft={genreProfile:{id:'comedy'},formatId:'square',templateId:'movie-highlight'};
  const zones=[{id:'left',complexity:.12},{id:'right',complexity:.32}];
  const biased=movieDirection(draft,{layoutId:'movie-immersive'},{brightness:.5,zones},false,null);
  const balanced=movieDirection(draft,{layoutId:'movie-immersive'},{brightness:.5,zones:[{id:'left',complexity:.20},{id:'right',complexity:.22}]},false,null);
  assert.equal(biased.lateralBias,'right');
  assert.equal(balanced.lateralBias,null);
  const base={templateId:'movie-highlight',movieFamily:'movie-immersive',title:'Filme único',sourceAsset:{width:800,height:1200},entities:{movie:{title:'Filme único',posterUrl:'/poster'}},artworkMetadata:{sourceUrl:'/poster'}};
  const args={format:{id:'square',width:1080,height:1080},palette:{dominantColor:'#246286',accentColor:'#a8d9ea',secondaryColor:'#15334c',artworkLightness:.3},brand:{name:'Cinema'},sourceUrl:'/poster',backgroundUrl:'/backdrop',logoUrl:null};
  const centered=buildMovieCinematic({...args,draft:{...base,movieDirection:balanced}});
  const shifted=buildMovieCinematic({...args,draft:{...base,movieDirection:biased}});
  const centerArt=centered.elements.find(e=>e.id==='artwork'),shiftArt=shifted.elements.find(e=>e.id==='artwork');
  const bg=shifted.elements.find(e=>e.id==='background-blur');
  assert.ok(shiftArt.x>centerArt.x);
  assert.ok(shiftArt.x>=0 && shiftArt.x+shiftArt.width<=1080);
  assert.equal(bg.src,'/backdrop');
  assert.ok(bg.opacity<.5 && bg.effects.scale<1.1 && bg.effects.blur<=15);
});

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
  assert.equal(elements.find(e=>e.id==='artwork').effects.mask,'fade-sides-bottom');
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

test('QA editorial aponta fonte fora da linguagem do filme e cartaz isolado no quadrado',()=>{
  const scene={templateId:'movie-highlight',formatId:'square',width:1080,height:1080,
    sourceDraft:{genreProfile:{id:'comedy'},movieDirection:{mood:'playful'},availableArtwork:true},elements:[
      {id:'background-blur',role:'background',type:'image',src:'/poster',x:0,y:0,width:1080,height:1080,effects:{blur:28}},
      {id:'artwork',role:'artwork',type:'image',src:'/poster',x:320,y:0,width:440,height:700,visible:true},
      {id:'detail',type:'text',text:'SEXTA • 09/10',x:70,y:730,width:620,height:80,fontSize:58,fontFamily:'Social Editorial',visible:true},
      {id:'session-time',type:'text',text:'19:30',x:70,y:835,width:620,height:90,fontSize:72,visible:true}
    ]};
  const technical={total:96,accepted:true,issues:[]};
  const quality=mergeQuality(scene,technical,technical);
  assert.equal(quality.technical.score,96);
  assert.ok(quality.editorial.issues.some(issue=>issue.code==='TYPE_VOICE_MISMATCH'));
  assert.ok(quality.editorial.issues.some(issue=>issue.code==='ISOLATED_POSTER'));
  assert.ok(quality.editorial.score<quality.technical.score);
});
