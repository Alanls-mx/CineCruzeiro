import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {renderRemotion}=require('../backend/services/social-studio/remotion/renderer');
const output=path.resolve('artifacts/studio-customization');
await fs.mkdir(output,{recursive:true});
const assets=new Map();
for(const [name,file] of [['logo','public/images/logo-display.webp'],['family','public/images/social-studio/editorial/shrek-5.webp'],['action','public/images/social-studio/editorial/sonic-4.webp'],['comedy','public/images/social-studio/editorial/focker-in-law.webp']]) assets.set(`/qa/${name}`,await fs.readFile(file));
// Read only public product artwork; all campaigns and dates below are local fixtures.
const publicContent=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content').then(r=>{assert.ok(r.ok);return r.json();});
const product=publicContent.concessions.find(item=>item.imageUrl);
assert.ok(product);
const productResponse=await fetch(new URL(product.imageUrl,'https://lumixengine.com'));
assert.ok(productResponse.ok);
assets.set('/qa/product',Buffer.from(await productResponse.arrayBuffer()));
const movies=[['family','Shrek 5','Animação'],['action','Sonic 4','Ação'],['comedy','Focker-in-Law','Comédia']].map(([id,title,genre])=>({id,title,genre,posterUrl:`/qa/${id}`,catalogued:true,releaseDate:'2026-10-22',sessions:[{date:'2026-10-22',time:'19:00',price:20},{date:'2026-10-23',time:'21:00',price:20}]}));
const context={now:'2026-10-22T10:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/qa/logo',website:'https://cinecruzeiro.com.br',primaryColor:'#07111f',secondaryColor:'#1468bd',accentColor:'#ffda38'},movies,concessions:[{id:'combo',name:'Combo Clássico',description:'Pipoca e refrigerante',price:25,imageUrl:'/qa/product'}],clubPlans:[]};
const loadImage=async src=>assets.get(src)||null;
const cases=[
  ['online-catalog',{templateId:'online-ticket',background:{mode:'catalog',movieIds:['family','action','comedy'],blur:5,darken:55}}],
  ['online-solid',{templateId:'online-ticket',background:{mode:'solid',color:'#102e43'},signaturePosition:{mode:'manual',x:95,y:0}}],
  ['product-custom',{templateId:'concession-combo',concessionId:'combo',background:{mode:'upload',imageUrl:'/qa/comedy',blur:22,darken:65}}],
  ['product-movie',{templateId:'concession-combo',concessionId:'combo',relatedMovieId:'family'}],
  ['week-cards',{templateId:'sessions-week',movieIds:movies.map(m=>m.id),programLayout:'day-cards'}],
  ['week-editorial',{templateId:'sessions-week',movieIds:movies.map(m=>m.id),programLayout:'editorial-week',programDays:2}],
  ['today-board',{templateId:'sessions-today',movieIds:movies.map(m=>m.id),programLayout:'cinema-board'}],
  ['multi-grid',{templateId:'multi-movies',movieIds:movies.map(m=>m.id),programLayout:'cinematic-grid',programColumns:3,programDays:2}]
];
const tiles=[],report=[],renderedCases=new Map();
for(const [index,[name,input]] of cases.entries()) {
  const result=await engine.renderSocialPost({...input,signatureId:'classic'},context,{loadImage});
  assert.ok(result.buffer.length>10000);
  renderedCases.set(name,result);
  await fs.writeFile(path.join(output,`${name}.png`),result.buffer);
  await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(result.scene,null,2));
  tiles.push({input:await sharp(result.buffer).resize(270,338).toBuffer(),left:index%4*270,top:Math.floor(index/4)*338});
  report.push({name,quality:result.quality,bytes:result.buffer.length});
}
await sharp({create:{width:1080,height:676,channels:3,background:'#07111f'}}).composite(tiles).png().toFile(path.join(output,'gallery.png'));
for(const preset of process.argv.includes('--static-only')?[]:['poster-reveal','commercial-focus']) {
  const {scene,buffer}=renderedCases.get('product-movie');
  const result=await renderRemotion(scene,{preset,quality:'preview'},{loadImage});
  const file=path.join(output,`${preset}.mp4`);
  await fs.writeFile(file,result.buffer);
  const frames=[];
  for(const [index,time] of [.4,1.2,2.2,result.plan.duration-.3].entries()) {
    const destination=path.join(output,`${preset}-${index}.png`);
    const extraction=spawnSync('ffmpeg',['-y','-ss',String(time),'-i',file,'-frames:v','1',destination],{windowsHide:true});
    assert.equal(extraction.status,0);
    frames.push({input:await sharp(destination).resize(270,338).toBuffer(),left:index*270,top:0});
    if(index===3) {
      const expected=await sharp(buffer).resize(270,338).removeAlpha().raw().toBuffer();
      const actual=await sharp(destination).resize(270,338).removeAlpha().raw().toBuffer();
      const error=actual.reduce((sum,value,i)=>sum+Math.abs(value-expected[i]),0)/actual.length;
      assert.ok(error<12,`Final frame must match still, error=${error}`);
    }
  }
  await sharp({create:{width:1080,height:338,channels:3,background:'#07111f'}}).composite(frames).png().toFile(path.join(output,`${preset}-filmstrip.png`));
  report.push({preset,engine:result.plan.engine,duration:result.plan.duration,bytes:result.buffer.length});
  console.log(preset,result.plan.engine,result.plan.duration);
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(`${cases.length} static campaigns verified${process.argv.includes('--static-only')?'':' and 2 real Remotion videos'}; test data only, nothing published.`);
