import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const baselinePath=process.env.STUDIO_BASELINE || '../scratch/studio-before/backend/services/socialStudioEngineService';
const before=require(baselinePath);
const out=path.resolve('artifacts/social-studio-artwork-price');
await fs.mkdir(out,{recursive:true});
const assets=new Map();
for(const [id,file] of Object.entries({logo:'cine-cruzeiro-logo-3d.png',sonic:'editorial/sonic-4.webp',shrek:'editorial/shrek-5.webp',comedy:'editorial/focker-in-law.webp',frozen:'editorial/frozen-3.webp'})) assets.set(`asset://${id}`,await fs.readFile(`public/images/social-studio/${file}`));
// Fixed test data, not a claim of confirmed cinema screenings or release dates.
const names={sonic:['Sonic 4','Ação'],shrek:['Shrek 5','Animação'],comedy:['Focker-in-Law','Comédia'],frozen:['Frozen 3','Fantasia']};
const context={now:'2026-09-22T12:00:00-03:00',brand:{name:'Cine Cruzeiro',posterLogoUrl:'asset://logo',logoUrl:'asset://logo',posterWebsite:'www.cinecruzeiro.com.br',primaryColor:'#07111f',secondaryColor:'#267be6',accentColor:'#facc15',textColor:'#ffffff'},movies:Object.entries(names).map(([id,[title,genre]])=>({id,title,genre,posterUrl:`asset://${id}`,releaseDate:'2027-06-11',catalogued:false,sessions:[]})),concessions:[],clubPlans:[]};
const loadImage=async url=>assets.get(url);
const cases=[
 ['logo','sonic',{artworkMetadata:{containsMovieLogo:true,dominantAsset:'logo'}}],
 ['symbol','shrek',{artworkMetadata:{containsMovieLogo:true,dominantAsset:'symbol'}}],
 ['embedded-title','frozen',{artworkMetadata:{containsTitle:true,dominantAsset:'logo'},composition:{look:'cold'}}],
 ['character','comedy',{artworkMetadata:{dominantAsset:'character'}}],
 ['poster','comedy',{artworkStrategy:'POSTER_BLEND'}],
 ['empty-space','shrek',{artworkStrategy:'FULL_POSTER'}],
];
const report=[],tiles=[];
for(const [index,[name,movieId,extra]] of cases.entries()) {
 const base={templateId:'movie-highlight',movieId,date:'',formatId:'feed_portrait',automaticStyle:true,signatureScale:100,generateCopy:true,...extra};
 for(const [label,renderer] of [['before',before],['after',engine]]) {
  const result=await renderer.renderSocialPost(base,context,{loadImage});
  await fs.writeFile(path.join(out,`${name}-${label}.png`),result.buffer);
  if(label==='after') await fs.writeFile(path.join(out,`${name}-scene.json`),JSON.stringify(result.scene,null,2));
  tiles.push({input:await sharp(result.buffer).resize(216,270).png().toBuffer(),left:index%3*432+(label==='after'?216:0),top:Math.floor(index/3)*270});
  report.push({name,label,ms:result.metrics.renderMs,score:result.quality.total,issues:result.quality.issues,strategy:result.draft.artworkPolicy?.strategy,primary:result.draft.primaryElement});
 }
}
await sharp({create:{width:1296,height:540,channels:3,background:'#111'}}).composite(tiles).png().toFile(path.join(out,'comparison.png'));
const scaleTiles=[];
for(const [index,signatureScale] of [70,100,120,135].entries()) {
 const r=await engine.renderSocialPost({templateId:'movie-highlight',movieId:'comedy',date:'',layoutId:'hero-left',signatureScale},context,{loadImage});
 await fs.writeFile(path.join(out,`signature-${signatureScale}.png`),r.buffer);
 scaleTiles.push({input:await sharp(r.buffer).resize(270,338).toBuffer(),left:index*270,top:0});
 report.push({signatureScale,bounds:r.scene.sourceDraft.signatureBounds});
}
await sharp({create:{width:1080,height:338,channels:3,background:'#111'}}).composite(scaleTiles).png().toFile(path.join(out,'signature-scales.png'));
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,report}));
