import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const out=path.resolve('artifacts/studio-programming-editorial');
await fs.mkdir(out,{recursive:true});
const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');
assert.ok(response.ok);
const data=await response.json();
const ids=['superman','o-fim-da-rua','toy-story-5','minha-melhor-amiga','vingadores-doutor-destino','harry-potter-e-a-pedra-filosofal','cara-de-barro','resident-evil'];
const movies=ids.map(id=>data.movies.find(m=>m.id===id));
assert.ok(movies.every(Boolean));
const images=new Map([['/qa/program-logo',await fs.readFile('public/images/logo-display.webp')]]);
for(const m of movies)for(const url of [m.posterUrl,m.backdropUrl].filter(Boolean)) {
  if(images.has(url))continue;
  const r=await fetch(new URL(url,'https://lumixengine.com'));assert.ok(r.ok);
  images.set(url,Buffer.from(await r.arrayBuffer()));
}
// Synthetic session fixtures exercise capacities without changing the live catalog.
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/qa/program-logo',website:'https://cinecruzeiro.com.br'},movies:movies.map((m,i)=>({...m,sessions:[{id:`test-${i}`,date:'2026-09-24',time:`${13+i}:00`}]}))};
const report=[];
for(const count of [1,2,3,5,8]) {
  const tiles=[];
  for(const [column,formatId] of ['square','feed_portrait','story'].entries()) {
    const name=`${count}-filmes-${formatId}`;
    const result=await engine.renderSocialPost({templateId:'multi-movies',movieIds:ids.slice(0,count),formatId,signatureId:'classic'},context,{loadImage:async url=>images.get(url)||null});
    assert.ok(result.quality.accepted);
    await fs.writeFile(path.join(out,`${name}.png`),result.buffer);
    await fs.writeFile(path.join(out,`${name}.json`),JSON.stringify(result.scene,null,2));
    report.push({name,layout:result.draft.resolvedProgramLayout,quality:result.quality,sessionCount:result.scene.sourceDraft.programSessionCount,testData:true});
    tiles.push({input:await sharp(result.buffer).resize(432,768,{fit:'contain',background:'#30343a'}).png().toBuffer(),left:column*432,top:0});
  }
  await sharp({create:{width:1296,height:768,channels:3,background:'#30343a'}}).composite(tiles).png().toFile(path.join(out,`${count}-filmes-comparison.png`));
  console.log(count,'filmes: aprovado');
}
for(const style of ['editorial','cinematic','posters']) {
  const result=await engine.renderSocialPost({templateId:'sessions-today',movieIds:ids.slice(0,2),programStyle:style,formatId:'feed_portrait'},context,{loadImage:async url=>images.get(url)||null});
  await fs.writeFile(path.join(out,`estilo-${style}.png`),result.buffer);
}
const weekly={...context,movies:context.movies.slice(0,3).map(m=>({...m,sessions:[...m.sessions,{...m.sessions[0],id:`next-${m.id}`,date:'2026-09-25'}]}))};
const result=await engine.renderSocialPost({templateId:'sessions-week',movieIds:ids.slice(0,3),formatId:'story'},weekly,{loadImage:async url=>images.get(url)||null});
await fs.writeFile(path.join(out,'agenda-por-dia.png'),result.buffer);
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(out);
