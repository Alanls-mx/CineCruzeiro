import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const output=path.resolve('artifacts/movie-editorial-reference');
await fs.mkdir(output,{recursive:true});
const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');
assert.ok(response.ok);
const content=await response.json();
const movie=content.movies.find(m=>/coyote/i.test(m.title));
assert.ok(movie,'Coyote must exist in the catalog');
const images=new Map([['/qa/logo',await fs.readFile('public/images/logo-display.webp')]]);
for(const url of [movie.posterUrl,movie.backdropUrl].filter(Boolean)) {
  const r=await fetch(new URL(url,'https://lumixengine.com'));
  assert.ok(r.ok);
  images.set(url,Buffer.from(await r.arrayBuffer()));
}
// Fixed illustrative sessions make visual regression runs reproducible.
const context={now:'2026-09-24T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/qa/logo',website:'https://cinecruzeiro.com.br'},movies:[{...movie,releaseDate:'2026-09-25',sessions:[{date:'2026-09-25',time:'22:05'}]}]};
for(const formatId of ['feed_portrait','square','story'])for(const direction of ['before','after']) {
  const result=await engine.renderSocialPost({templateId:'movie-premiere',movieId:movie.id,formatId,layoutId:direction==='before'?'movie-spotlight':'movie-editorial-light',signatureId:'classic'},context,{loadImage:async url=>images.get(url)||null,artworkRetried:true});
  assert.ok(result.quality.accepted);
  if(direction==='after')assert.equal(result.scene.sourceDraft.movieFamily,'movie-editorial-light','No fallback may mask a failed editorial composition');
  await fs.writeFile(path.join(output,`${formatId}-${direction}.png`),result.buffer);
  await fs.writeFile(path.join(output,`${formatId}-${direction}.json`),JSON.stringify(result.scene,null,2));
  console.log(formatId,direction,result.scene.sourceDraft.movieFamily);
}
console.log(output);
