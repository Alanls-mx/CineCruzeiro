import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const {generateCopy}=require('../backend/services/social-studio/copy-engine');
const {motionPlanes}=require('../backend/services/social-studio/contracts/motion');
const {scoreArtwork}=require('../backend/services/social-studio/composition-engine/artwork-score');
const context={now:'2026-09-22T12:00:00-03:00',brand:{name:'Cinema',posterWebsite:'cinema.example',posterLogoUrl:'asset://scale-logo'},movies:[{id:'m',title:'Uma aventura',genres:['Ação'],posterUrl:'asset://price-poster',releaseDate:'2026-10-22',sessions:[{id:'a',date:'2026-10-22',time:'19:00',ticketTypes:[{id:'full',name:'Inteira',price:28},{id:'half',name:'Meia',price:14},{id:'promo',name:'Promocional',price:20}]},{id:'b',date:'2026-10-23',time:'20:00',ticketTypes:[{id:'full',name:'Inteira',price:28}]}]}]};
const images=new Map([['asset://price-poster',await sharp({create:{width:320,height:480,channels:3,background:'#923111'}}).png().toBuffer()],['asset://scale-logo',await sharp({create:{width:800,height:400,channels:4,background:'#00ffff'}}).png().toBuffer()]]);
const loadImage=async url=>images.get(url);
const price=input=>engine.normalizeDraft({templateId:'movie-price',movieId:'m',...input},context);

test('preço exige seleção e aceita tipos reais, mínimo explícito e manual',()=>{
  assert.equal(price({}).semanticValidation.valid,false);
  assert.equal(engine.normalizeDraft({templateId:'movie-price'},{movies:[]}).semanticValidation.valid,false);
  for(const [id,value] of [['full',28],['half',14],['promo',20]]) {
    const draft=price({priceSelection:{mode:'ticket-type',ticketTypeId:id}});
    assert.equal(draft.content.price.value,value);assert.equal(draft.content.price.from,false);
    assert.equal(engine.normalizeDraft(draft,context).content.price.value,value);
    assert.equal(generateCopy(draft,context).bundle.kicker,draft.priceInfo.label);
  }
  const minimum=price({priceSelection:{mode:'minimum'}});
  assert.equal(minimum.content.price.value,14);assert.match(minimum.subtitle,/A PARTIR DE/);
  assert.equal(price({priceSelection:{mode:'manual',value:19.9}}).content.price.value,19.9);
  assert.equal(price({priceSelection:{mode:'manual',value:''}}).semanticValidation.valid,false);
});
test('sessão específica usa valor exato e tipo variável usa a partir de',()=>{
  const ctx=structuredClone(context);ctx.movies[0].sessions[0].ticketTypes[0].price=25;ctx.movies[0].sessions[1].ticketTypes[0].price=30;
  const draft=sessionId=>engine.normalizeDraft({templateId:'movie-price',movieId:'m',priceSelection:{mode:'ticket-type',ticketTypeId:'full',sessionId}},ctx);
  assert.equal(draft('').content.price.value,25);assert.equal(draft('').content.price.from,true);
  assert.equal(draft('b').content.price.value,30);assert.equal(draft('b').content.price.from,false);
  assert.equal(draft('missing').semanticValidation.valid,false);
});
test('campanha antiga mantém snapshot e nova seleção é preservada no histórico',async()=>{
  assert.equal(price({price:'R$ 37,50'}).price,'R$ 37,50');
  const rendered=await engine.renderSocialPost({templateId:'movie-price',movieId:'m',priceSelection:{mode:'ticket-type',ticketTypeId:'full',sessionId:'b'},signatureScale:120,layoutId:'hero-left'},context,{loadImage});
  const record=engine.createHistoryRecord(rendered,{},context);
  assert.equal(record.payload.priceSelection.ticketTypeId,'full');
  assert.equal(engine.normalizeDraft(record.payload,context).content.price.value,28);
  assert.equal(record.originalScene.sourceDraft.priceSelection.sessionId,'b');
  assert.equal(record.payload.signatureScale,120);
});
test('escala da assinatura respeita teto seguro e pixels em PNG, JPG, cena e motion',async()=>{
  for(const polish of [false,true]) {
    let previous=0;
    for(const signatureScale of [70,100,120,135]) {
      const r=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'m',layoutId:'hero-right',signatureScale,polish},context,{loadImage});
      const logo=flattenElements(r.scene.elements).find(e=>e.id==='logo');
      assert.ok(logo.width>=previous && logo.width<=r.scene.width*.19+1);
      previous=logo.width;
      assert.ok(Math.abs(logo.width/logo.height-2)<.001);
      assert.ok(logo.x>=0 && logo.y+logo.height<=r.scene.height*.975+1);
      for(const e of flattenElements(r.scene.elements).filter(e=>e.visible!==false && e.type==='text')) assert.ok(Math.min(e.x+e.width,logo.x+logo.width)<=Math.max(e.x,logo.x) || Math.min(e.y+e.height,logo.y+logo.height)<=Math.max(e.y,logo.y));
      const exported=await engine.renderSocialScene(r.scene,{loadImage,outputType:'jpg'});
      assert.equal(flattenElements(exported.scene.elements).find(e=>e.id==='logo').width,logo.width);
      const planes=motionPlanes(r.scene);
      assert.ok(JSON.stringify(planes).includes('scale-logo'));
      const {data,info}=await sharp(r.buffer).raw().toBuffer({resolveWithObject:true});
      let min=info.width,max=0;
      for(let y=Math.floor(logo.y);y<Math.min(info.height,Math.ceil(logo.y+logo.height));y++) for(let x=Math.floor(logo.x);x<Math.min(info.width,Math.ceil(logo.x+logo.width));x++){const offset=(y*info.width+x)*info.channels;if(data[offset]<20 && data[offset+1]>220 && data[offset+2]>220){min=Math.min(min,x);max=Math.max(max,x);}}
      assert.ok(Math.abs(max-min+1-logo.width)<4,`pixels ${max-min+1}, bounds ${logo.width}`);
    }
  }
});
test('metadata troca estratégia e suprime duplicação sem interferir em outro asset',async()=>{
  for(const [dominantAsset,strategy] of [['logo','LOGO_DOMINANT'],['symbol','SYMBOL_DOMINANT'],['character','CHARACTER_DOMINANT']]) {
    const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'m',date:'',artworkMetadata:{containsMovieLogo:true,dominantAsset}},context,{loadImage,skipRaster:true});
    assert.equal(r.draft.artworkPolicy.strategy,strategy);
    if(dominantAsset!=='character') assert.equal(flattenElements(r.scene.elements).find(e=>e.id==='title').visible,false);
    assert.equal(flattenElements(r.scene.elements).filter(e=>e.visible!==false && e.hierarchy==='primary').length,1);
  }
  const draft=engine.normalizeDraft({movieId:'m',imageUrl:'asset://new',artworkMetadata:{sourceUrl:'asset://old',containsTitle:true}},context);
  assert.equal(draft.artworkMetadata.containsTitle,undefined);
});
test('escala manual permanece limitada à zona de assinatura nos três formatos',async()=>{
 for(const formatId of ['square','story','feed_portrait']) {
  const sizes=[];
  for(const signatureScale of [100,135]) {
   const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'m',formatId,style:'clean',artDirection:{enabled:false},signatureScale},context,{loadImage,skipRaster:true});
   sizes.push(flattenElements(r.scene.elements).find(e=>e.id==='logo').width);
  }
  assert.ok(sizes[1]>=sizes[0] && sizes[1]<=1080*.19+1);
 }
});
test('data embutida só substitui data editorial idêntica conferida',async()=>{
  const ctx=structuredClone(context);ctx.movies[0].catalogued=false;ctx.movies[0].sessions=[];
  const r=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'m',artworkMetadata:{containsReleaseDate:true,releaseDateVerified:true,embeddedReleaseDate:'2026-10-22'}},ctx,{loadImage,skipRaster:true});
  assert.equal(r.draft.artworkPolicy.hideDate,true);
  assert.equal(r.draft.content.primaryDateLabel,'LANÇAMENTO INTERNACIONAL');
  assert.match(engine.captionForDraft(r.draft,ctx),/ainda não está confirmada/);
  const highlight=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'m',date:''},ctx,{loadImage,skipRaster:true});
  assert.ok(!flattenElements(highlight.scene.elements).some(e=>e.visible!==false && /confira as sess|garanta seu lugar/i.test(e.text || '')));
  await assert.rejects(engine.renderSocialPost({templateId:'movie-premiere',movieId:'m',subtitle:'ESTREIA CONFIRMADA NO CINEMA'},ctx,{loadImage}),/não tem exibição confirmada/);
});
test('densidade respeita minimalismo e redundância penaliza conteúdo repetido',()=>{
  const scene={width:1080,height:1350,sourceDraft:{visualStyle:'impact'},elements:[{id:'title',type:'text',text:'Conheça o filme',fontSize:60,x:40,y:800,width:350,height:100}]};
  const impact=scoreArtwork(scene),minimal=scoreArtwork({...scene,sourceDraft:{visualStyle:'minimal'}});
  assert.ok(minimal.compositionDensity>impact.compositionDensity);
  assert.ok(scoreArtwork({...scene,elements:[...scene.elements,{...scene.elements[0],id:'cta'}]}).redundancy<impact.redundancy);
});
