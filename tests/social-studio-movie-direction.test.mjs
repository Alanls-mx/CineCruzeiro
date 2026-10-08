import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {movieDirection}=require('../backend/services/social-studio/composition-engine/movie-direction');
const {MOVIE_FAMILIES,campaignCTA}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const assets={poster:await sharp({create:{width:800,height:1200,channels:3,background:'#997522'}}).png().toBuffer(),backdrop:await sharp({create:{width:1600,height:900,channels:3,background:'#276799'}}).png().toBuffer(),logo:await sharp({create:{width:600,height:200,channels:3,background:'#277abc'}}).png().toBuffer()};
const loadImage=async src=>src.includes('/images/social-studio/cine-cruzeiro-assinatura-oficial.png')?assets.logo:assets[src.replace('/movie-direction/','')] || null;
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/movie-direction/logo',website:'https://cinecruzeiro.com.br'},movies:[{id:'movie',title:'Uma aventura extraordinária',genre:'Ação',posterUrl:'/movie-direction/poster',backdropUrl:'/movie-direction/backdrop',releaseDate:'2026-09-25',sessions:[{date:'2026-09-25',time:'13:00',ticketTypes:[{id:'full',name:'Inteira',price:29.9}]},{date:'2026-09-25',time:'18:30',ticketTypes:[{id:'full',name:'Inteira',price:29.9}]}]}]};
test('filme sem venda ativa mantém ação editorial sem repetir EM BREVE',()=>{
  assert.equal(campaignCTA({templateId:'movie-highlight',content:{purchaseAvailable:false}}),'CONHEÇA O FILME');
  assert.equal(campaignCTA({templateId:'movie-highlight',content:{purchaseAvailable:true}}),'ESCOLHA SUA SESSÃO');
  assert.equal(campaignCTA({templateId:'movie-presale',content:{purchaseAvailable:true,presaleStartDate:'2026-10-01',today:'2026-09-24'}}),'CONHEÇA O FILME');
});
test('arquétipos cinematográficos funcionam em formatos e campanhas preservando horários e contraste',async()=>{
  for(const templateId of ['movie-highlight','movie-premiere','movie-presale','movie-price'])for(const formatId of ['feed_portrait','square','story'])for(const layoutId of Object.keys(MOVIE_FAMILIES)) {
    const r=await engine.renderSocialPost({templateId,movieId:'movie',formatId,layoutId,priceSelection:{mode:'full'}},context,{loadImage,skipRaster:true});
    assert.ok(r.quality.accepted,`${templateId}/${formatId}/${layoutId}`);
    const elements=flattenElements(r.scene.elements),text=elements.map(e=>e.text || '').join(' ').replace(/\s+/g,' ');
    assert.match(text,/13[H:]00/);assert.match(text,/18[H:]30/);
    assert.ok(elements.filter(e=>e.type==='text').every(e=>e.contrastRatio>=4.5));
    assert.ok(elements.find(e=>e.role==='logo').width/r.scene.width<=.19);
  }
});
test('seleção considera áreas livres, material e gênero sem alegar detecção de rostos',()=>{
  const draft={movieId:'one',genreProfile:{id:'family'},artDirection:{seed:3}};
  const analysis={quietest:'left',zones:[{id:'left',complexity:.07},{id:'right',complexity:.5},{id:'bottom',complexity:.4}],focusX:75,focusY:42,method:'luminance-edge-density'};
  assert.equal(movieDirection(draft,{},analysis,false).copySide,'left');
  const selected=movieDirection(draft,{layoutId:'movie-character'},analysis,true,{focusX:25,focusY:35});
  assert.equal(selected.family,'movie-character');assert.equal(selected.focusX,25);
  assert.equal(selected.subjectDetection,'visual-saliency-heuristic');
  assert.equal(movieDirection(draft,{layoutId:'movie-full-bleed'},analysis,false).family,'cinematic-blend');
  const families=new Set(['horror','family','action','comedy','drama'].map(id=>movieDirection({...draft,genreProfile:{id}},{},analysis,true).family));
  assert.ok(families.size>=3);
  for(const genre of ['family','comedy','drama'])assert.ok(!['poster-lateral','poster-editorial','cinematic-story'].includes(movieDirection({...draft,genreProfile:{id:genre}},{},analysis,true).family));
});
test('estreia comunica a data uma vez e conserva todos os horários',async()=>{
  const result=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'movie',layoutId:'movie-spotlight'},context,{loadImage,skipRaster:true});
  const description=flattenElements(result.scene.elements).find(e=>e.id==='description');
  assert.match(description.text,/13:00/);
  assert.match(description.text,/18:30/);
  assert.ok(['film-wash','film-atmosphere','hero-light','film-vignette'].every(id=>result.scene.elements.some(e=>e.id===id)));
  assert.ok(flattenElements(result.scene.elements).find(e=>e.id==='detail').fontSize>=80);
});
test('editorial integrado dissolve o pôster em fundo derivado e mantém ação e assinatura',async()=>{
  const result=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'movie',formatId:'feed_portrait',layoutId:'movie-editorial-light'},context,{loadImage,skipRaster:true});
  const elements=flattenElements(result.scene.elements);
  assert.ok(result.quality.accepted);
  assert.equal(result.scene.sourceDraft.movieFamily,'movie-editorial-light');
  assert.equal(elements.find(e=>e.id==='artwork').effects.mask,'fade-all');
  assert.ok(elements.some(e=>e.id==='editorial-brand-band'));
  assert.ok(elements.some(e=>e.id==='editorial-brand-tone'));
  assert.ok(!elements.some(e=>e.id.startsWith('product-contrast-')));
  assert.ok(elements.find(e=>e.id==='logo').x<result.scene.width*.2);
  assert.ok(elements.find(e=>e.id==='website').text.includes('cinecruzeiro.com.br'));
});
test('estreia automática preserva pôster inteiro e usa editorial mesmo sem backdrop',()=>{
  for(const backdrop of [false,true]) {
    const draft={templateId:'movie-premiere',movieId:'one',genreProfile:{id:'family'}};
    assert.equal(movieDirection(draft,{}, {zones:[{id:'bottom',complexity:.8}]},backdrop).family,'movie-editorial-light');
    assert.equal(movieDirection(draft,{layoutId:'movie-spotlight'},null,backdrop).family,'movie-spotlight');
  }
});
test('editorial mantém imagem, data e horários sem recorrer a outro layout',async()=>{
  for(const formatId of ['feed_portrait','square','story'])for(const templateId of ['movie-premiere','movie-highlight','movie-price','movie-presale']) {
    const result=await engine.renderSocialPost({templateId,movieId:'movie',formatId,layoutId:'movie-editorial-light',priceSelection:{mode:'full'}},context,{loadImage,skipRaster:true,artworkRetried:true});
    assert.equal(result.scene.sourceDraft.movieFamily,'movie-editorial-light');
    const elements=flattenElements(result.scene.elements),art=elements.find(e=>e.id==='artwork');
    assert.equal(art.fit,'contain');
    assert.ok(art.effects.blend<40);
    assert.ok(elements.find(e=>e.id==='title').x>art.x+art.width);
    if(['movie-premiere','movie-presale'].includes(templateId))assert.ok(elements.find(e=>e.id==='detail').y>art.y+art.height);
    assert.ok(!elements.some(e=>e.id==='movie-reading-veil'));
    assert.ok(!elements.some(e=>e.id.startsWith('product-contrast-')));
  }
});
test('atmosfera editorial deriva as cores do pôster sem vermelho ou cor de marca fixos',async()=>{
  const {extractEditorialAtmosphere,hexToRgb}=require('../backend/services/social-studio/engine/palette');
  for(const color of ['#e87b18','#157cdc','#31b65a']) {
    const buffer=await sharp({create:{width:64,height:96,channels:3,background:color}}).png().toBuffer();
    const atmosphere=await extractEditorialAtmosphere(buffer);
    assert.equal(atmosphere.color,color);
    const source=hexToRgb(color),shadow=hexToRgb(atmosphere.shadow);
    assert.ok(Math.abs(shadow.r-source.r*.52)<=1);
    assert.ok(Math.abs(shadow.g-source.g*.52)<=1);
    assert.ok(Math.abs(shadow.b-source.b*.52)<=1);
  }
  assert.equal(await extractEditorialAtmosphere(null),null);
});

test('rodape preserva uma segunda tonalidade escura real sem achatar o laranja em marrom',async()=>{
  const {extractEditorialAtmosphere,hexToRgb}=require('../backend/services/social-studio/engine/palette');
  const shadow=await sharp({create:{width:32,height:8,channels:3,background:'#941b08'}}).png().toBuffer();
  const poster=await sharp({create:{width:32,height:48,channels:3,background:'#cc550d'}}).composite([{input:shadow,left:0,top:37}]).png().toBuffer();
  const palette=await extractEditorialAtmosphere(poster),shade=hexToRgb(palette.shadow);
  assert.equal(palette.color,'#cc550d');
  assert.ok(shade.r>60 && shade.g<shade.r*.15);
  const scene=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'movie',layoutId:'movie-editorial-light'},context,{loadImage,skipRaster:true});
  const texture=scene.scene.elements.find(e=>e.id==='editorial-brand-band');
  assert.equal(texture.src,context.movies[0].posterUrl);
  assert.equal(texture.effects.mask,'fade-top');
  assert.equal(texture.opacity,1);
  assert.equal(texture.effects.saturation,1);
  assert.ok(!scene.scene.elements.some(e=>e.id==='editorial-bottom-glow'));
});
test('exportação manual preserva horários e não permite trocar poster por recorte',async()=>{
  const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'movie',layoutId:'movie-asymmetric'},context,{loadImage,skipRaster:true,artworkRetried:true});
  const altered=structuredClone(r.scene);
  altered.elements.find(e=>e.id==='description').text='23:00';
  await assert.rejects(engine.renderSocialScene(altered,{loadImage}),{code:'ARTWORK_QUALITY'});
  const crop=structuredClone(r.scene);crop.elements.find(e=>e.id==='artwork').fit='cover';
  await assert.rejects(engine.renderSocialScene(crop,{loadImage}),{code:'ARTWORK_QUALITY'});
});

test('atmosfera inferior conserva variacao espacial da imagem sem curvas ou faixas pintadas',async()=>{
  const {buildMovieEditorialLight}=require('../backend/services/social-studio/scene/movie-editorial-light');
  const {createCinematicArtwork}=require('../backend/services/social-studio/composition-engine/pipeline');
  const scene=buildMovieEditorialLight({draft:{entities:{},signatureId:'none'},format:{id:'feed_portrait',width:1080,height:1350},palette:{dominantColor:'#aa6622',secondaryColor:'#aa6622'},brand:{name:'Cine Cruzeiro'},sourceUrl:'/poster.png'});
  const band=scene.elements.find(e=>e.id==='editorial-brand-band');
  assert.equal(band.src,'/poster.png');
  assert.equal(band.effects.colorWash,0);
  const strip=await sharp({create:{width:64,height:192,channels:3,background:'#bb450d'}}).png().toBuffer();
  const source=await sharp({create:{width:128,height:192,channels:3,background:'#422218'}}).composite([{input:strip,left:0,top:0}]).png().toBuffer();
  const {data,info}=await sharp(await createCinematicArtwork(source,band)).raw().toBuffer({resolveWithObject:true});
  const sample=x=>[...data.subarray(((info.height-1)*info.width+x)*info.channels,((info.height-1)*info.width+x)*info.channels+4)];
  const left=sample(0),right=sample(info.width-1);
  assert.ok(Math.abs(left[0]-right[0])>40,'real horizontal color variation must remain visible');
  assert.equal(left[3],255);
  assert.equal(right[3],255);
});
