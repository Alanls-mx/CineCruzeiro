import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {FAMILIES}=require('../backend/services/social-studio/contracts/concession-campaign');
const output=path.resolve('artifacts/studio-bomboniere');
await fs.mkdir(output,{recursive:true});
const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');
assert.ok(response.ok);
const data=await response.json();
const ids=['chocolate-cinema','refrigerante','pipoca-grande','combo-classico','combo-familia'];
const products=ids.map(id=>data.concessions.find(p=>p.id===id));
assert.ok(products.every(Boolean));
const images=new Map();
images.set('/qa/logo',await fs.readFile('public/images/logo-display.webp'));
for(const p of products) {
  const result=await fetch(new URL(p.imageUrl,'https://lumixengine.com'));
  assert.ok(result.ok);images.set(p.imageUrl,Buffer.from(await result.arrayBuffer()));
}
const loadImage=async src=>images.get(src)||null;
const context={now:new Date().toISOString(),brand:{name:'Cine Cruzeiro',logoUrl:'/qa/logo',website:'https://cinecruzeiro.com.br'},concessions:products,movies:[],clubPlans:[]};
const report=[];
for(const product of products) {
  const tiles=[];
  for(const [row,formatId] of ['square','feed_portrait','story'].entries()) {
    for(const [column,family] of Object.keys(FAMILIES).entries()) {
      const name=`${product.id}-${formatId}-${family}`;
      try {
        const result=await engine.renderSocialPost({templateId:'concession-combo',concessionId:product.id,formatId,signatureId:'classic',concessionDirection:{family,brandedProduct:['combo-classico','combo-familia','pipoca-grande'].includes(product.id)}},context,{loadImage,concessionRetried:true});
        assert.ok(result.quality.accepted);
        await fs.writeFile(path.join(output,`${name}.png`),result.buffer);
        await fs.writeFile(path.join(output,`${name}.json`),JSON.stringify(result.scene,null,2));
        const tile=await sharp(result.buffer).resize(270,480,{fit:'contain',background:'#30343a'}).png().toBuffer();
        tiles.push({input:tile,left:column*270,top:row*480});
        report.push({name,accepted:true,quality:result.quality,category:result.draft.concessionDirection.category,bytes:result.buffer.length});
      } catch(error) {
        report.push({name,accepted:false,message:error.message,issues:error.quality?.issues});
        console.log(name,JSON.stringify(error.quality?.issues || error.message));
      }
    }
  }
  await sharp({create:{width:1080,height:1440,channels:3,background:'#30343a'}}).composite(tiles).png().toFile(path.join(output,`${product.id}-comparison.png`));
  console.log(product.name,report.filter(r=>r.name.startsWith(product.id)&&r.accepted).length,'/12');
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(`Approved ${report.filter(r=>r.accepted).length}/${report.length}. ${output}`);
assert.equal(report.filter(r=>r.accepted).length,60,'Every base family/format must support real products.');
