import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {MOVIE_FAMILIES,PRODUCT_LAYOUTS}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const output=path.resolve('artifacts/studio-artwork-review');
await fs.mkdir(output,{recursive:true});
const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');
assert.ok(response.ok);
const data=await response.json();
const movies=['gladiador-2','resident-evil','toy-story-5','superman','harry-potter-e-a-pedra-filosofal'].map(id=>data.movies.find(m=>m.id===id));
const products=['chocolate-cinema','refrigerante','pipoca-grande','combo-classico','combo-familia'].map(id=>data.concessions.find(p=>p.id===id));
assert.ok([...movies,...products].every(Boolean));
const images=new Map([['/qa/review-logo',await fs.readFile('public/images/logo-display.webp')]]);
for(const entity of [...movies,...products])for(const url of [entity.posterUrl,entity.backdropUrl,entity.imageUrl].filter(Boolean)) {
  if(images.has(url))continue;
  const asset=await fetch(new URL(url,'https://lumixengine.com'));
  assert.ok(asset.ok,`Asset unavailable: ${url}`);
  images.set(url,Buffer.from(await asset.arrayBuffer()));
}
const context={now:new Date().toISOString(),brand:{name:'Cine Cruzeiro',logoUrl:'/qa/review-logo',website:'https://cinecruzeiro.com.br'},movies,concessions:products,clubPlans:[]};
const report=[];
for(const entity of [...movies,...products]) {
  const product=products.includes(entity),layouts=Object.keys(product?PRODUCT_LAYOUTS:MOVIE_FAMILIES),tiles=[];
  for(const [row,formatId] of ['square','feed_portrait','story'].entries())for(const [column,layoutId] of layouts.entries()) {
    const name=`${entity.id}-${formatId}-${layoutId}`;
    const input={templateId:product?'concession-combo':'movie-highlight',...(product?{concessionId:entity.id,concessionDirection:{layout:layoutId,brandedProduct:['pipoca-grande','combo-classico','combo-familia'].includes(entity.id)}}:{movieId:entity.id}),formatId,layoutId,signatureId:'classic'};
    try {
      const rendered=await engine.renderSocialPost(input,context,{loadImage:async url=>images.get(url)||null});
      assert.ok(rendered.quality.accepted);
      const text=flattenElements(rendered.scene.elements).filter(e=>e.type==='text' && e.visible!==false).map(e=>e.text).join('\n');
      assert.doesNotMatch(text,/\d{4}-\d{2}-\d{2}|undefined|NaN|Hoje/i);
      await fs.writeFile(path.join(output,`${name}.png`),rendered.buffer);
      await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(rendered.scene,null,2));
      const tile=await sharp(rendered.buffer).resize(360,640,{fit:'contain',background:'#30343a'}).png().toBuffer();
      tiles.push({input:tile,left:column*360,top:row*640});
      report.push({name,accepted:true,quality:rendered.quality,notices:rendered.notices,resolved:rendered.scene.sourceDraft.movieFamily || rendered.draft.concessionDirection.layout});
    }catch(error) {
      report.push({name,accepted:false,message:error.message,issues:error.quality?.issues});
      console.log(name,JSON.stringify(error.quality?.issues || error.message));
    }
  }
  await sharp({create:{width:layouts.length*360,height:1920,channels:3,background:'#30343a'}}).composite(tiles).png().toFile(path.join(output,`${entity.id}-comparison.png`));
  console.log(entity.title || entity.name,report.filter(r=>r.name.startsWith(entity.id)&&r.accepted).length,'/',layouts.length*3);
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(`Approved ${report.filter(r=>r.accepted).length}/${report.length}. ${output}`);
assert.ok(report.every(r=>r.accepted));
