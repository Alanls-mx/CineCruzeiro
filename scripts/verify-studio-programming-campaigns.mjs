import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const phase=process.argv.includes('--before')?'before':'after';
const catalog=process.argv.includes('--catalog');
const folder=path.resolve('artifacts/studio-programming-campaigns',catalog?'catalog':phase);
await fs.mkdir(folder,{recursive:true});
const titles=['Shrek 5','Sonic 4','Frozen 3','Como Treinar o Seu Dragão 2','Entrando Numa Fria'];
const files=['shrek-5','sonic-4','frozen-3','como-treinar-dragao-2','focker-in-law'];
const assets=new Map(await Promise.all(files.map(async file=>[`/qa/${file}`,await fs.readFile(`public/images/social-studio/editorial/${file}.webp`)])));
assets.set('/qa/logo',await fs.readFile('public/images/social-studio/cine-cruzeiro-logo-3d.png'));
const loadImage=async src=>assets.get(src);
let movies=titles.map((title,i)=>({id:`film-${i}`,title,genre:i===4?'Comédia':'Animação',posterUrl:`/qa/${files[i]}`,sessions:[{id:`s-${i}`,date:'2026-09-25',time:`${15+i}:00`}]}));
if(catalog) {
  const response=await fetch('https://lumixengine.com/projects/cinecruzeiro/api/content');
  if(!response.ok)throw new Error('Catálogo indisponível para QA');
  const data=await response.json();
  const selected=['toy-story-5','cara-de-barro','minha-melhor-amiga','vingadores-doutor-destino','resident-evil'].map(id=>data.movies.find(m=>m.id===id));
  if(selected.some(m=>!m))throw new Error('Filme de QA não encontrado');
  movies=selected.map((movie,i)=>({...movie,sessions:movies[i].sessions}));
  for(const movie of movies)for(const url of [movie.posterUrl,movie.backdropUrl].filter(Boolean)) {
    if(assets.has(url))continue;
    const image=await fetch(new URL(url,'https://lumixengine.com'));
    if(!image.ok)throw new Error(`Imagem indisponível: ${movie.title}`);
    assets.set(url,Buffer.from(await image.arrayBuffer()));
  }
}
const context={now:'2026-09-25T09:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'/qa/logo',posterWebsite:'cinecruzeiro.com.br'},movies};
const samples=[
  {id:'01-solo',count:1}, {id:'02-dupla',count:2},
  {id:'03-editorial',count:3,programLayout:'program-cards'},
  {id:'04-mosaico',count:3,programLayout:'program-grid'},
  {id:'05-agenda',count:3,programLayout:'program-days'},
  {id:'06-cinco-filmes',count:5},
  {id:'07-varios-horarios',count:3,times:true,programLayout:'program-cards'},
  {id:'08-varios-dias',count:3,days:true,programLayout:'program-grid'},
  {id:'09-amarelo',count:3,programStyle:'vibrant',programLayout:'program-cards'},
  {id:'10-quadrado',count:3,formatId:'square',programLayout:'program-grid'},
  {id:'11-story',count:3,formatId:'story',programLayout:'program-cards'},
];
const results=[];
for(const sample of samples) {
  const ctx={...context,movies:movies.map((movie,i)=>({...movie,sessions:sample.times?[...movie.sessions,{id:`extra-${i}`,date:'2026-09-25',time:'21:30'}]:sample.days?movie.sessions.map(s=>({...s,date:i===2?'2026-09-26':s.date})):movie.sessions}))};
  const rendered=await engine.renderSocialPost({templateId:'multi-movies',movieIds:movies.slice(0,sample.count).map(m=>m.id),formatId:sample.formatId || 'feed_portrait',programLayout:sample.programLayout || 'automatic',programStyle:sample.programStyle || 'automatic'},ctx,{loadImage});
  await fs.writeFile(path.join(folder,`${sample.id}.png`),rendered.buffer);
  results.push({sample:sample.id,layout:rendered.draft.resolvedProgramLayout,quality:rendered.quality.total,accepted:rendered.quality.accepted,sessionCount:rendered.scene.sourceDraft.programSessionCount});
}
const tiles=await Promise.all(samples.map(async(sample,index)=>({input:await sharp(path.join(folder,`${sample.id}.png`)).resize(270,338,{fit:'contain',background:'#080c11'}).png().toBuffer(),left:index%4*286+8,top:Math.floor(index/4)*354+8})));
await sharp({create:{width:4*286,height:Math.ceil(samples.length/4)*354,channels:3,background:'#080c11'}}).composite(tiles).png().toFile(path.join(folder,'comparison.png'));
await fs.writeFile(path.join(folder,'results.json'),JSON.stringify({note:'Dados de sessões fictícios exclusivamente para QA; pôsteres reais do acervo local.',results},null,2));
console.log(JSON.stringify({folder,results},null,2));
