import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {MOVIE_FAMILIES}=require('../backend/services/social-studio/contracts/artwork-layout');
const output=path.resolve('artifacts/studio-movie-direction');
await fs.mkdir(output,{recursive:true});
const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');assert.ok(response.ok);
const data=await response.json();
const movies=['cara-de-barro','toy-story-5','resident-evil','minha-melhor-amiga'].map(id=>data.movies.find(m=>m.id===id));
assert.ok(movies.every(Boolean));
const images=new Map([['/qa/movie-logo',await fs.readFile('public/images/logo-display.webp')]]);
for(const movie of movies)for(const url of [movie.posterUrl,movie.backdropUrl].filter(Boolean)) {
  if(images.has(url))continue;
  const r=await fetch(new URL(url,'https://lumixengine.com'));assert.ok(r.ok);images.set(url,Buffer.from(await r.arrayBuffer()));
}
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/qa/movie-logo',website:'https://cinecruzeiro.com.br'},movies:movies.map(m=>({...m,sessions:[{id:`test-${m.id}`,date:'2026-09-25',time:'13:00'},{id:`test2-${m.id}`,date:'2026-09-25',time:'18:30'}]}))};
const report=[];
for(const movie of movies) {
  const tiles=[];
  for(const [index,layoutId] of ['automatic',...Object.keys(MOVIE_FAMILIES)].entries()) {
    const name=`${movie.id}-${layoutId}`;
    try {
      const result=await engine.renderSocialPost({templateId:'movie-highlight',movieId:movie.id,formatId:'feed_portrait',layoutId,signatureId:'classic'},context,{loadImage:async url=>images.get(url)||null,artworkRetried:true});
      assert.ok(result.quality.accepted);
      await fs.writeFile(path.join(output,`${name}.png`),result.buffer);
      await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(result.scene,null,2));
      tiles.push({input:await sharp(result.buffer).resize(270,338).png().toBuffer(),left:index%3*270,top:Math.floor(index/3)*338});
      report.push({name,accepted:true,resolved:result.scene.sourceDraft.movieFamily,quality:result.quality});
    }catch(error){report.push({name,accepted:false,error:error.message,issues:error.quality?.issues});console.log(name,JSON.stringify(error.quality?.issues || error.message));}
  }
  await sharp({create:{width:810,height:Math.ceil((Object.keys(MOVIE_FAMILIES).length+1)/3)*338,channels:3,background:'#30343a'}}).composite(tiles).png().toFile(path.join(output,`${movie.id}-comparison.png`));
  console.log(movie.title,report.filter(r=>r.name.startsWith(movie.id)&&r.accepted).length,'/',Object.keys(MOVIE_FAMILIES).length+1);
}
const premiere=await engine.renderSocialPost({templateId:'movie-premiere',movieId:'cara-de-barro',formatId:'feed_portrait',layoutId:'movie-spotlight'},context,{loadImage:async url=>images.get(url)||null});
await fs.writeFile(path.join(output,'cara-de-barro-estreia.png'),premiere.buffer);
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
assert.ok(report.every(r=>r.accepted));
console.log(output);
