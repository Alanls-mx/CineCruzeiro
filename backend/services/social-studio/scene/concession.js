const sharp = require('sharp');
const {normalizeScene} = require('./schema');
const {wrapText} = require('./factory');
const {compactWebsite} = require('../engine/typography');

// Alpha bounds describe the actual packshot, not the transparent margins of its file.
async function productBounds(buffer) {
  if (!buffer) return null;
  const meta = await sharp(buffer).metadata();
  if (!meta.hasAlpha) return {x:0,y:0,width:meta.width,height:meta.height};
  const {data,info} = await sharp(buffer).resize({width:160}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>20) {
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left) return null;
  const sx=meta.width/info.width,sy=meta.height/info.height;
  const x=Math.max(0,Math.floor((left-2)*sx)),y=Math.max(0,Math.floor((top-2)*sy));
  return {x,y,width:Math.min(meta.width-x,Math.ceil((right+3)*sx)-x),height:Math.min(meta.height-y,Math.ceil((bottom+3)*sy)-y)};
}

function buildConcessionScene({draft,format,brand,sourceUrl,logoUrl,assetBounds}) {
  const w=format.width,h=format.height,story=format.id==='story',square=format.id==='square';
  const profile=draft.concessionDirection,family=profile.family;
  const vibrant=family==='commercial-vibrant',premium=family==='clean-premium',cinematic=family==='cinematic-product';
  const cold=profile.category==='soda';
  const themes={
    'product-cinema-blue':{bg:'#04233d',ink:'#ffffff',accent:'#ffe07d',surface:'#053450',glow:'#04c9d8'},
    'product-gold':{bg:'#05271e',ink:'#ffffff',accent:'#ffe28f',surface:'#063225',glow:'#c8a044'},
    'product-neon':{bg:'#290d3e',ink:'#ffffff',accent:'#f4a5ff',surface:'#350e53',glow:'#e448f5'},
    'product-sunset':{bg:'#81152d',ink:'#ffffff',accent:'#ffe08c',surface:'#b63335',glow:'#ff934e'},
    'product-stage':{bg:'#200b14',ink:'#fff7dc',accent:'#ffd58a',surface:'#2d1018',glow:'#c58a38'},
    'product-retro':{bg:'#f6eedb',ink:'#11293b',accent:'#a46b12',surface:'#f6eedb',glow:'#d9b564'},
    'product-pop':{bg:'#0aaacb',ink:'#10243a',accent:'#ffe338',surface:'#0aaacb',glow:'#ffe338'}
  };
  const themed=themes[profile.layout];
  const colors=themed || (vibrant?{bg:'#ffda38',ink:'#16202b',accent:'#16202b',surface:'#ffda38'}:premium?{bg:'#edf5ff',ink:'#123b66',accent:'#123b66',surface:'#edf5ff'}:cinematic?{bg:'#080f16',ink:'#ffffff',accent:cold?'#9de7ed':'#ffda83',surface:'#080f16'}:{bg:'#180d10',ink:'#fff6e8',accent:'#ffc96c',surface:'#180d10'});
  const top=story?.09:.055,bottom=story?.88:.95,span=bottom-top;
  const rect=([x,y,width,height])=>({x:x*w,y:(top+y*span)*h,width:width*w,height:height*span*h});
  const elements=[];
  const shape=(id,b,fill,extra={})=>elements.push({id,type:'shape',role:'ambient',...b,fill,locked:true,...extra});
  const tx=(id,value,r,size,extra={})=>{
    if(!String(value || '').trim())return;
    const box=rect(r),display=!['description','website','support'].includes(id);
    let text=value;
    let fitted=wrapText(text,box.width,box.height,size,extra.lines || 3);
    if(id==='support' && fitted.fontSize<28*w/1080) {
      const firstSentence=String(value).match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim();
      if(firstSentence && firstSentence!==String(value).trim()) {
        const concise=wrapText(firstSentence,box.width,box.height,size,extra.lines || 3);
        if(concise.fontSize>=28*w/1080) {
          text=firstSentence;
          fitted=concise;
          draft.copyMovedToCaption=[...(draft.copyMovedToCaption || []),id];
        }
      }
    }
    if(['support','description'].includes(id) && fitted.fontSize<(id==='support'?28:22)*w/1080) {
      draft.copyMovedToCaption=[...(draft.copyMovedToCaption || []),id];
      return;
    }
    elements.push({id,name:id,type:'text',role:id,...box,...fitted,fontFamily:display?'Social Display':'Social Text',fontWeight:display?900:600,fill:colors.ink,lineHeight:1.12,align:'left',hierarchy:['title','detail'].includes(id)?'primary':'tertiary',required:['title','detail','cta'].includes(id),...extra});
  };
  const image=(id,src,b,extra={})=>{if(src)elements.push({id,type:'image',role:id==='logo'?'logo':id==='artwork'?'artwork':'ambient',src,...b,fit:'contain',locked:true,keepRatio:true,...extra});};
  if(themed) {
    elements.push({id:'product-backdrop',type:'gradient',role:'ambient',x:0,y:0,width:w,height:h,direction:'bottom',locked:true,stops:[
      {offset:0,color:colors.bg},{offset:.48,color:colors.surface},{offset:1,color:colors.bg}
    ]});
    if(profile.layout==='product-retro') {
      shape('retro-panel',{x:w*.58,y:0,width:w*.42,height:h*.76},'#10243b');
      shape('retro-swoop',{x:w*.44,y:h*.10,width:w*.51,height:h*.30},'#d7a953',{points:[0,0,1,0,1,1,.28,.76]});
      shape('retro-masthead',{x:0,y:0,width:w,height:h*.135},'#f6eedb');
    } else if(profile.layout==='product-pop') {
      shape('pop-title-field',{x:w*.04,y:h*.10,width:w*.88,height:h*.22},'#ffffff',{points:[.05,0,.96,.08,1,.90,.08,1,0,.34]});
      shape('pop-price-burst',{x:w*.62,y:h*.37,width:w*.35,height:h*.29},'#ffe338',{points:[.50,0,.61,.27,.93,.12,.78,.43,1,.59,.72,.67,.83,1,.52,.79,.25,.98,.28,.69,0,.58,.28,.42,.09,.13,.40,.28]});
    } else if(profile.layout==='product-stage') {
      for(const side of [.015,.965]) {
        shape(`stage-rail-${side}`,{x:w*side,y:h*.04,width:w*.018,height:h*.65},'#9c6931');
        for(let i=0;i<7;i++)shape(`stage-light-${side}-${i}`,{x:w*(side-.006),y:h*(.085+i*.082),width:w*.03,height:w*.03},'#ffd992',{radius:w*.015});
      }
      shape('stage-floor',{x:w*.09,y:h*.68,width:w*.82,height:h*.025},'#a96f37',{radius:h*.01});
    } else {
      const strip=profile.layout==='product-neon'?'#9b30b8':profile.layout==='product-sunset'?'#f78456':profile.layout==='product-gold'?'#b6924c':'#079fbd';
      shape('film-band',{x:w*.54,y:h*.34,width:w*.53,height:h*.23},strip,{points:[0,.64,.94,0,1,.31,.06,1],opacity:.27});
      for(let i=0;i<5;i++)shape(`film-frame-${i}`,{x:w*(.62+i*.085),y:h*(.42-i*.026),width:w*.061,height:h*.082},colors.bg,{opacity:.42,rotation:-16});
      shape('product-horizon',{x:0,y:h*.69,width:w,height:h*.04},colors.glow,{opacity:.26});
    }
  }
  // Four directions have different reading paths, not just different colors.
  const layouts={
    'commercial-vibrant': {headline:[.065,.07,.87,.16],art:[.44,.29,.50,.43],price:[.065,.42,.35,.18],support:[.065,.74,.87,.045]},
    'cinematic-product': {headline:[.065,.07,.87,.15],art:[.07,.29,.54,.46],price:[.65,.42,.29,.15],support:[.65,.60,.28,.12]},
    'clean-premium': {headline:[.065,.09,.41,.23],art:[.52,.12,.42,.63],price:[.065,.50,.40,.15],support:[.065,.67,.40,.10]},
    'dark-snack': {headline:[.065,.59,.49,.16],art:[.20,.08,.60,.49],price:[.61,.61,.33,.14],support:[.065,.78,.87,.045]},
    'product-cinema-blue':{headline:[.065,.08,.87,.16],art:[.07,.30,.56,.47],price:[.66,.44,.29,.14],support:[.66,.61,.28,.13]},
    'product-gold':{headline:[.065,.075,.87,.17],art:[.07,.30,.57,.48],price:[.67,.43,.28,.14],support:[.67,.61,.27,.13]},
    'product-neon':{headline:[.065,.075,.87,.17],art:[.07,.32,.57,.46],price:[.67,.44,.28,.14],support:[.67,.62,.27,.13]},
    'product-sunset':{headline:[.065,.075,.87,.17],art:[.07,.30,.57,.48],price:[.67,.44,.28,.14],support:[.67,.62,.27,.13]},
    'product-stage':{headline:[.08,.055,.84,.17],art:[.22,.24,.56,.39],price:[.22,.675,.56,.075],support:[.22,.77,.56,.06]},
    'product-retro':{headline:[.065,.08,.34,.26],art:[.46,.27,.49,.49],price:[.065,.48,.35,.14],support:[.065,.64,.34,.11]},
    'product-pop':{headline:[.075,.095,.78,.19],art:[.07,.36,.55,.43],price:[.64,.45,.31,.15],support:[.64,.64,.29,.12]}
  };
  const structure=layouts[profile.layout]?profile.layout:family==='clean-premium'?'clean-premium':'cinematic-product';
  const layout=structuredClone(layouts[structure]);
  const priceLayout=['commercial-vibrant','product-price','product-pop'].includes(structure),cleanLayout=['clean-premium','product-retro'].includes(structure),sideLayout=['cinematic-product','product-lateral','product-cinema-blue','product-gold','product-neon','product-sunset'].includes(structure);
  if(story) {
    if(priceLayout) Object.assign(layout,{art:[.17,.25,.72,.40],price:[.065,.66,.55,.13],support:[.64,.67,.30,.11]});
    if(structure==='product-pop')layout.art=[.17,.31,.72,.32];
    if(cleanLayout) Object.assign(layout,{headline:[.065,.075,.87,.15],art:[.18,.28,.68,.39],price:[.065,.71,.47,.10],support:[.57,.70,.37,.10]});
    if(sideLayout) Object.assign(layout,{art:[.08,.29,.83,.40],price:[.065,.71,.48,.10],support:[.59,.71,.35,.09]});
  }
  if(square && sideLayout) Object.assign(layout,{art:[.07,.30,.53,.43],price:[.64,.41,.30,.18],support:[.64,.63,.30,.13]});
  const wide=assetBounds && assetBounds.width/assetBounds.height>1.5;
  if(wide && !story) {
    if(priceLayout)Object.assign(layout,{art:[.12,.29,.76,.30],price:[.065,.62,.51,.14],support:[.64,.63,.30,.12]});
    else if(sideLayout)Object.assign(layout,{art:[.08,.28,.84,.32],price:[.065,.63,.49,.14],support:[.62,.64,.32,.12]});
    else if(cleanLayout)Object.assign(layout,{headline:[.065,.09,.87,.15],art:[.39,.29,.55,.30],price:[.065,.60,.48,.14],support:[.57,.65,.37,.12]});
    else layout.art=[.08,.12,.84,.39];
  }
  if(profile.category==='family' && !story && !wide) {
    if(priceLayout)layout.art=[.43,.255,.51,.47];
    if(sideLayout)layout.art=[.065,.25,.56,.50];
  }
  if(profile.seed%2 && !story && (cleanLayout || sideLayout)) {
    for(const key of ['headline','art','price','support']) {const b=layout[key];b[0]=1-b[0]-b[2];}
  }
  const artBox=rect(layout.art);
  if(assetBounds) {
    const scale=Math.min(artBox.width/assetBounds.width,artBox.height/assetBounds.height);
    const width=assetBounds.width*scale,height=assetBounds.height*scale;
    artBox.x+=(artBox.width-width)/2;artBox.y+=(artBox.height-height)*(wide?.55:1);artBox.width=width;artBox.height=height;
  }
  if(vibrant && !themed) shape('product-ribbon',{x:0,y:artBox.y+artBox.height*.64,width:w,height:h*.075},'#efbf18',{points:[0,.6,1,0,1,.45,0,1]});
  if(premium && !themed) {
    shape('premium-field',{x:w*(profile.seed%2 && !story?0:.50),y:0,width:w*.50,height:h},'#d3e7ff');
    shape('premium-rule',rect([.065,.062,.87,.002]),'#2163a3');
  }
  if(!vibrant && !premium && !themed && sourceUrl) {
    image('product-atmosphere',sourceUrl,{x:0,y:0,width:w,height:h},{fit:'cover',opacity:.15,effects:{layer:'background',blur:55,brightness:.65,saturation:.6,scale:1.5}});
    image('product-light',sourceUrl,{x:artBox.x-w*.10,y:artBox.y-h*.03,width:artBox.width+w*.2,height:artBox.height+h*.1},{effects:{layer:'glow',color:cold?'#549cb5':'#be783d',glow:48}});
    image('product-texture',sourceUrl,{x:0,y:0,width:w,height:h},{effects:{layer:'atmosphere',grain:1.2,overlay:'gradient-light'}});
  }
  if(sourceUrl) {
    image('ambient-shadow',sourceUrl,{...artBox,y:artBox.y+h*.008},{crop:assetBounds,effects:{layer:'ambient-shadow',shadow:48,mask:'none',brightness:1,saturation:1,scale:1}});
    image('contact-shadow',sourceUrl,{...artBox,y:artBox.y+h*.006},{crop:assetBounds,effects:{layer:'contact-shadow',shadow:55,mask:'none',brightness:1,saturation:1,scale:1}});
    image('artwork',sourceUrl,artBox,{crop:assetBounds});
  }
  if(structure==='product-stage') {
    shape('stage-price-frame',rect([.18,.66,.64,.175]),'#bd8542');
    shape('stage-price-panel',rect([.187,.666,.626,.163]),'#1b0b14');
  }
  const headline=draft.offerHeadline || draft.title || draft.entities.concession.name;
  const subject=draft.offerHeadline ? draft.entities.concession.name : '';
  tx('subtitle',draft.subtitle,[.065,.002,.87,.044],square?34:38,{fill:structure==='product-retro'?colors.ink:colors.accent,lines:1});
  const titleBox=[...layout.headline];
  if(subject)titleBox[3]-=.05;
  tx('title',headline,titleBox,premium || structure==='product-retro'?86:112,{lines:3});
  if(subject) tx('subject',subject,[titleBox[0],titleBox[1]+titleBox[3]+.015,titleBox[2],.035],32,{lines:1});
  const amount=Number(draft.entities.concession.price).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const p=layout.price;
  const fullPrice=`R$ ${amount}`;
  tx('detail',fullPrice,p,vibrant && !themed?170:128,{lines:1,fill:colors.accent});
  const support=draft.auxiliaryText || draft.entities.concession.description;
  tx('support',support,layout.support,32,{lines:square?3:4});
  const footer=.845;
  shape('commercial-footer',{x:0,y:rect([0,footer,1,0]).y-h*.01,width:w,height:h},themed?structure==='product-retro'?'#10243b':structure==='product-pop'?'#10243b':colors.bg:vibrant?'#16202b':premium?'#123b66':colors.bg);
  tx('cta',draft.cta,[.065,footer,.60,.045],38,{fill:'#ffffff',lines:1});
  tx('website',compactWebsite(draft.actionDestination || brand.posterWebsite || brand.website),[.065,footer+.060,.60,.03],26,{fill:'#ffffff',lines:1,required:Boolean(draft.actionDestination)});
  tx('description',draft.offerTerms,[.065,footer+.105,.87,.035],24,{fill:'#ffffff',lines:2});
  const ratio=draft.signatureAsset?.width/draft.signatureAsset?.height || 2.6;
  const tenantSignature=/\/images\/social-studio\/signatures\/[^/]+-white-3d\.png(?:\?|$)/.test(String(logoUrl));
  const logoHeight=Math.min(h*(tenantSignature?.10:.085),w*(profile.brandedProduct?.16:.21)/ratio),logoWidth=logoHeight*ratio;
  const logoBox={x:w*.935-logoWidth,y:rect([0,footer,1,0]).y,width:logoWidth,height:logoHeight};
  image('logo',logoUrl,logoBox);
  if(!logoUrl && draft.signatureId!=='none') tx('cinema',brand.name,[.72,footer,.215,.075],28,{fill:'#ffffff',hierarchy:'branding',lines:3});
  const {entities,...sourceDraft}=draft;
  return normalizeScene({id:`scene-${draft.templateId}-${format.id}`,templateId:draft.templateId,formatId:format.id,width:w,height:h,backgroundColor:colors.bg,elements,
    sourceDraft:{...sourceDraft,concessionDirection:profile,productAsset:{source:sourceUrl,mode:profile.assetMode,preservePackaging:profile.assetMode!=='mockup'},concessionLogoBounds:logoBox,concessionSurface:colors.surface,productBounds:assetBounds,productName:draft.entities.concession.name,productPrice:fullPrice}});
}
module.exports={buildConcessionScene,productBounds};
