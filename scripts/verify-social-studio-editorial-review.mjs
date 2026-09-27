import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const output=path.resolve('artifacts/studio-editorial-review');
await fs.mkdir(output,{recursive:true});
const origin='https://lumixengine.com';
const response=await fetch(`${origin}/projects/cinecruzeiro/api/content`,{signal:AbortSignal.timeout(15000)});
assert.ok(response.ok);
const data=await response.json();
const movies=data.movies.filter(m=>m.sessions?.length).slice(0,5);
assert.ok(movies.length>=2);
const product=data.concessions.find(p=>p.id==='combo-classico');
assert.ok(product);
const images=new Map([['/qa/logo',await fs.readFile('public/images/logo-display.webp')]]);
for(const entity of [...movies,product])for(const url of [entity.posterUrl,entity.backdropUrl,entity.imageUrl].filter(Boolean)) {
  if(images.has(url))continue;
  const response=await fetch(new URL(url,origin),{signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok,url);
  images.set(url,Buffer.from(await response.arrayBuffer()));
}
// A fixed review clock keeps the production sessions reproducible after their date.
const day=movies[0].sessions[0].date;
const context={...data,movies:data.movies.map(movie=>({...movie,sessions:(movie.sessions||[]).map(session=>({...session,ticketTypes:data.ticketTypes.filter(type=>session.ticketTypeIds?.includes(type.id))}))})),now:`${day}T08:00:00-03:00`,brand:{name:'Cine Cruzeiro',website:'https://cinecruzeiro.com.br',logoUrl:'/qa/logo'}};
const cases=[
  {templateId:'movie-highlight',movieId:movies[0].id},
  {templateId:'multi-movies',movieIds:movies.map(m=>m.id),scheduleDate:day},
  {templateId:'concession-combo',concessionId:product.id},
  {templateId:'ticket-offer',movieId:movies[0].id,priceSelection:{mode:'minimum'}}
];
const report=[],tiles=[];
for(const [row,input] of cases.entries())for(const [column,formatId] of ['square','feed_portrait','story'].entries()) {
  const name=`${input.templateId}-${formatId}`;
  const result=await engine.renderSocialPost({...input,formatId,workspaceVersion:2,signatureId:'classic'},context,{loadImage:async url=>images.get(url)||null});
  assert.ok(result.quality.accepted,`${name}: ${JSON.stringify(result.quality.issues)}`);
  await fs.writeFile(path.join(output,`${name}.png`),result.buffer);
  await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(result.scene,null,2));
  tiles.push({input:await sharp(result.buffer).resize(324,576,{fit:'contain',background:'#242424'}).png().toBuffer(),left:column*324,top:row*576});
  report.push({name,quality:result.quality,notices:result.notices});
  console.log(name,result.quality.total);
}
await sharp({create:{width:972,height:2304,channels:3,background:'#242424'}}).composite(tiles).png().toFile(path.join(output,'comparison.png'));
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(`Verified ${report.length} renders: ${output}`);
