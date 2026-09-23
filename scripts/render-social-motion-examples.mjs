import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url),engine=require('../backend/services/socialStudioEngineService');
const {renderRemotion}=require('../backend/services/social-studio/remotion/renderer');
const out=path.resolve(process.argv[2] || 'artifacts/remotion');
await fs.mkdir(out,{recursive:true});
const assets=new Map();
for(const [key,file] of [['logo','public/images/logo-display.webp'],['family','public/images/social-studio/editorial/shrek-5.webp'],['action','public/images/social-studio/editorial/sonic-4.webp'],['editorial','public/images/social-studio/editorial/focker-in-law.webp']])assets.set(`example://${key}`,await fs.readFile(file));
// A local licensed/test asset can be supplied without fetching or publishing a movie schedule.
assets.set('example://horror',await fs.readFile(process.env.SOCIAL_TEST_HORROR || 'public/images/social-studio/editorial/focker-in-law.webp'));
const loadImage=async src=>assets.get(src) || null;
const movies=[['horror','Suspense na tela','Terror'],['action','Aventura na tela','Ação'],['family','Diversão em família','Animação'],['editorial','Grandes encontros','Drama']].map(([id,title,genre])=>({id,title,genre,genres:[genre],status:'now_showing',posterUrl:`example://${id}`,releaseDate:'2026-09-24',sessions:[{id:`s-${id}`,date:'2026-09-24',time:'19:00',availableForPurchase:true,ticketTypes:[{id:'full',name:'Inteira',price:24},{id:'half',name:'Meia',price:12}]}]}));
const context={now:'2026-09-24T10:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'example://logo',website:'https://cinecruzeiro.com.br',primaryColor:'#081c36',secondaryColor:'#1468bd',accentColor:'#ffda38'},movies,concessions:[],clubPlans:[]};
const cases=[...movies.map(movie=>[movie.id,{templateId:'movie-highlight',movieId:movie.id,signatureId:'classic'},'automatic']),['ticket',{templateId:'ticket-offer',movieId:'',ticketCampaignMode:'promotional',layoutId:'cinema-pop',style:'cinema-pop',priceSelection:{mode:'campaign',value:12},offerHeadline:'CINEMA COM PREÇO ESPECIAL',offerTerms:'Campanha de teste. Consulte condições.',signatureId:'classic'},'commercial-focus'],['three',{templateId:'multi-movies',movieIds:['horror','action','family'],signatureId:'classic'},'poster-cascade'],['sessions',{templateId:'sessions-today',movieIds:['horror','action','family'],signatureId:'classic',sessionDate:'2026-09-24'},'cinema-lineup']];
const report=[];
for(const [name,fields,preset] of cases.filter(item=>!process.env.SOCIAL_TEST_CASE || item[0]===process.env.SOCIAL_TEST_CASE))for(const formatId of ['feed_portrait','square','story']) {
  const rendered=await engine.renderSocialPost({...fields,formatId},context,{loadImage});
  const prefix=`${name}-${formatId}`;
  await fs.writeFile(path.join(out,`${prefix}.png`),rendered.buffer);
  await fs.writeFile(path.join(out,`${prefix}.scene.json`),JSON.stringify(rendered.scene));
  for(const quality of ['preview','final']) {
    const file=path.join(out,`${prefix}-${quality}.mp4`);
    if(!process.env.SOCIAL_TEST_FORCE && await fs.access(file).then(()=>true,()=>false))continue;
    const result=await renderRemotion(rendered.scene,{preset,quality,duration:'automatic'},{loadImage});
    await fs.writeFile(file,result.buffer);
    const frames=[];
    for(const [i,time] of [0.4,1.3,2.6,result.plan.readableFrom+1].entries()) {
      const png=path.join(out,`${prefix}-${quality}-${i}.png`);
      const extraction=spawnSync('ffmpeg',['-y','-ss',String(time),'-i',file,'-frames:v','1',png],{windowsHide:true});
      if(extraction.status!==0)throw new Error('Não foi possível extrair quadro de revisão.');
      frames.push({input:await sharp(png).resize(270,480,{fit:'contain',background:'#05080d'}).toBuffer(),left:i*270,top:0});
    }
    await sharp({create:{width:1080,height:480,channels:3,background:'#05080d'}}).composite(frames).png().toFile(path.join(out,`${prefix}-${quality}-filmstrip.png`));
    report.push({name,formatId,quality,plan:result.plan,metrics:result.metrics});
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(prefix,quality,result.plan.duration,result.metrics.renderMs);
  }
}
const multi=JSON.parse(await fs.readFile(path.join(out,'three-story.scene.json'),'utf8'));
for(const preset of ['simultaneous','poster-cascade','featured-cycle','crossfade-program']) {
  const result=await renderRemotion(multi,{preset,quality:'preview'},{loadImage});
  await fs.writeFile(path.join(out,`three-${preset}.mp4`),result.buffer);
  report.push({name:'multi-comparison',preset,plan:result.plan,metrics:result.metrics});
}
const webm=await renderRemotion(multi,{preset:'featured-cycle',format:'webm',quality:'preview'},{loadImage});
await fs.writeFile(path.join(out,'three-featured-cycle.webm'),webm.buffer);
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(out,'LEIA-ME.txt'),'Artes e vídeos de teste, não publicados. Filmes, textos, datas e preços usados para validar composição e leitura, não como programação real. Cada PNG tem prévia e vídeo final correspondentes. Os arquivos filmstrip mostram quatro momentos da animação.\n');
