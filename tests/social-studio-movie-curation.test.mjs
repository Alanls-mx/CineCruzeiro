import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const {curateMovieContent,embeddedMovieTitle}=require('../backend/services/social-studio/composition-engine/movie-content');
const {extractPalette,movieSurface,hexToRgb}=require('../backend/services/social-studio/engine/palette');
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');

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
