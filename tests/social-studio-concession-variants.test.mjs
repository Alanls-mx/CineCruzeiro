import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {PRODUCT_LAYOUTS}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const packshot=await sharp({create:{width:700,height:800,channels:4,background:'#ffffff00'}})
  .composite([{input:await sharp({create:{width:550,height:660,channels:4,background:'#e9a51b'}}).png().toBuffer(),left:75,top:70}]).png().toBuffer();
const logo=await sharp({create:{width:480,height:250,channels:4,background:'#ffffff'}}).png().toBuffer();
const context={brand:{name:'Cinema Exemplo',website:'https://cinema.exemplo.com.br',posterLogoUrl:'/logo'},
  concessions:[{id:'combo',name:'Combo Clássico',description:'Pipoca média + refrigerante.',price:25,imageUrl:'/packshot'}],movies:[],clubPlans:[]};
const loadImage=async src=>src==='/packshot'?packshot:src==='/logo'?logo:null;
const newLayouts=Object.keys(PRODUCT_LAYOUTS).filter(id=>id.startsWith('product-') && !['product-price','product-lateral'].includes(id));

test('novas direções da bomboniere preservam produto, preço e qualidade em todos os formatos',async()=>{
  const backgrounds=new Set(),geometries=new Set();
  for(const layoutId of newLayouts)for(const formatId of ['feed_portrait','square','story']) {
    let result;
    try {result=await engine.renderSocialPost({templateId:'concession-combo',concessionId:'combo',layoutId,formatId,workspaceVersion:2,signatureId:'icon-3d'},context,{loadImage,skipRaster:!(process.env.SOCIAL_VARIANT_PREVIEW_DIR && formatId==='feed_portrait'),concessionRetried:true});}
    catch(error) {throw new Error(`${layoutId}/${formatId}: ${JSON.stringify(error.quality?.issues || error.message)}`);}
    assert.ok(result.quality.accepted,`${layoutId}/${formatId}: ${JSON.stringify(result.quality.issues)}`);
    const elements=flattenElements(result.scene.elements);
    assert.equal(elements.find(e=>e.id==='artwork').src,'/packshot');
    assert.equal(elements.find(e=>e.id==='artwork').fit,'contain');
    assert.equal(elements.find(e=>e.id==='detail').text,'R$ 25,00');
    assert.ok(elements.filter(e=>e.type==='text').every(e=>e.contrastRatio>=4.5));
    if(formatId==='feed_portrait') {
      if(process.env.SOCIAL_VARIANT_PREVIEW_DIR) {
        await mkdir(process.env.SOCIAL_VARIANT_PREVIEW_DIR,{recursive:true});
        await writeFile(path.join(process.env.SOCIAL_VARIANT_PREVIEW_DIR,`${layoutId}.png`),result.buffer);
      }
      backgrounds.add(result.scene.backgroundColor);
      const art=elements.find(e=>e.id==='artwork');
      geometries.add([art.x,art.y,art.width,art.height].map(Math.round).join(','));
    }
  }
  assert.ok(backgrounds.size>=5);
  assert.ok(geometries.size>=4);
});
