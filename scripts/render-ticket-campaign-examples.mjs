import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const out=path.resolve(process.argv[2] || 'artifacts/ticket-campaigns');
const assets=new Map([
  ['example://logo',await fs.readFile('public/images/logo-header-compact.webp')],
  ['example://movie',await fs.readFile('public/images/social-studio/editorial/shrek-5.webp')]
]);
const context={now:'2026-09-23T10:00:00-03:00',brand:{name:'Cine Cruzeiro',logoUrl:'example://logo',website:'https://cinecruzeiro.com.br',primaryColor:'#081c36',secondaryColor:'#1468bd',accentColor:'#ffda38'},movies:[{id:'example',title:'Shrek 5',posterUrl:'example://movie',sessions:[{id:'session',date:'2026-09-24',time:'19:00',availableForPurchase:true,ticketTypes:[{id:'full',name:'Inteira',price:24},{id:'half',name:'Meia',price:12}]}]}],concessions:[],clubPlans:[]};
const base={templateId:'ticket-offer',movieId:'',ticketCampaignMode:'promotional',offerTerms:'Exemplo de composição. Valores e condições sujeitos à confirmação.',cta:'COMPRE AGORA',signatureId:'classic'};
const cases=[
  ['geral-sem-filme','cinema-pop',{offerHeadline:'CINEMA COM PREÇO ESPECIAL',priceSelection:{mode:'campaign',value:12}}],
  ['com-filme','campaign-led',{movieId:'example',offerHeadline:'SEU ENCONTRO COM A TELA GRANDE',priceSelection:{mode:'full',sessionId:'session'}}],
  ['meia','ticket-burst',{ticketCampaignMode:'standard',priceSelection:{mode:'half'}}],
  ['inteira','price-impact',{ticketCampaignMode:'standard',movieId:'example',priceSelection:{mode:'full'}}],
  ['menor-preco','promo-editorial',{priceSelection:{mode:'minimum'}}],
  ['segunda-terca','campaign-led',{campaignAudience:'all',campaignRecurrence:'weekly',campaignDays:'segunda, terça',priceSelection:{mode:'half'}}],
  ['preco-9','price-impact',{offerHeadline:'SEU PROGRAMA É CINEMA',priceSelection:{mode:'campaign',value:9}}],
  ['preco-12','offer-counter',{offerHeadline:'SEMANA DO CINEMA',oldPrice:24,priceSelection:{mode:'campaign',value:12}}],
  ['preco-29-90','promo-editorial',{offerHeadline:'UM ENCONTRO COM GRANDES HISTÓRIAS',priceSelection:{mode:'campaign',value:29.9}}]
];
await fs.mkdir(out,{recursive:true});
const report=[],tiles=[];
for(const [index,[name,style,fields]] of cases.entries()) {
  for(const formatId of ['feed_portrait','story','square']) {
    const result=await engine.renderSocialPost({...base,...fields,style,layoutId:style,automaticStyle:false,formatId},context,{loadImage:async url=>assets.get(url) || null});
    const filename=`${name}-${formatId}.png`;
    await fs.writeFile(path.join(out,filename),result.buffer);
    report.push({filename,style,validation:result.scene.sourceDraft.layoutValidation,caption:engine.captionForDraft(result.draft,context)});
    if(formatId==='feed_portrait') tiles.push({input:await sharp(result.buffer).resize(360,450).toBuffer(),left:index%3*360,top:Math.floor(index/3)*450});
  }
}
await sharp({create:{width:1080,height:1350,channels:3,background:'#ffffff'}}).composite(tiles).png().toFile(path.join(out,'comparacao.png'));
await fs.writeFile(path.join(out,'relatorio.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(out,'LEIA-ME.txt'),'Exemplos de teste do Social Studio. As datas, preços e condições são fictícios para validação visual; não constituem programação ou ofertas publicadas.\nOrdem da comparação: geral sem filme, com filme, meia, inteira, menor preço, segunda/terça, R$9, R$12 e R$29,90.\n');
console.log(`${report.length} exemplos: ${out}`);
