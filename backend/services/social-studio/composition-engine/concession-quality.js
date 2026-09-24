const sharp = require('sharp');
const {flattenElements} = require('../scene/groups');
const {luminance} = require('./contrast');
const {visualLength} = require('../engine/typography');
const {loadAsset} = require('../engine/assets');
const {isConcession} = require('../contracts/concession-campaign');
const {LruTtlCache}=require('../engine/cache');
const contrastCache=new LruTtlCache({maxEntries:24,ttlMs:60_000});
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
const colorLuma=hex=>luminance([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
function boxOf(element) {
  const r=(element.rotation || 0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const corners=[[0,0],[element.width,0],[0,element.height],[element.width,element.height]].map(([x,y])=>({x:element.x+x*c-y*s,y:element.y+x*s+y*c}));
  const x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y));
  return {x,y,width:Math.max(...corners.map(p=>p.x))-x,height:Math.max(...corners.map(p=>p.y))-y};
}
function inspectConcessionLayout(scene) {
  const elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const essential=elements.filter(e=>e.type==='text' || e.id==='artwork' || e.role==='logo');
  const issues=[];
  const add=(code,id,message)=>issues.push({code,elementId:id,message,penalty:25});
  const w=scene.width,h=scene.height,top=scene.formatId==='story'?h*.065:h*.025,bottom=scene.formatId==='story'?h*.91:h*.98;
  visit(scene.elements,e=>{if(e.type==='group' && (e.rotation || e.opacity<.95)) add('GROUP_TRANSFORM',e.id,'Mantenha o grupo de conteúdo opaco e sem rotação; ajuste seus elementos individualmente.');});
  for(const e of essential) {
    const b=boxOf(e);
    if(b.x<w*.025-1 || b.x+b.width>w*.975+1 || b.y<top-1 || b.y+b.height>bottom+1) add('SAFE_AREA',e.id,'Elemento fora da área segura.');
    if(e.opacity<.95) add('HIDDEN_CONTENT',e.id,'Conteúdo essencial transparente demais.');
    if(e.type==='text') {
      const lines=e.text.split('\n');
      const min=['description','website','cinema'].includes(e.id)?22:['support','subject','subtitle'].includes(e.id)?28:e.id==='detail'?62:34;
      if(e.fontSize<min*w/1080) add('SMALL_TEXT',e.id,'Texto pequeno demais para publicação.');
      if(lines.length*e.fontSize*e.lineHeight>e.height+2 || lines.some(line=>visualLength(line)*e.fontSize>e.width+2)) add('TEXT_OVERFLOW',e.id,'Texto não cabe integralmente.');
      if(!e.text.trim()) add('EMPTY_CONTENT',e.id,'Conteúdo vazio.');
    }
  }
  for(let i=0;i<essential.length;i++) for(let j=i+1;j<essential.length;j++) {
    const a=essential[i],b=essential[j];
    const pad=w*.008,box=boxOf(a);
    if(overlap({...box,x:box.x-pad,y:box.y-pad,width:box.width+2*pad,height:box.height+2*pad},boxOf(b))>4) add('CONTENT_OVERLAP',`${a.id}/${b.id}`,'Produto, texto e marca precisam de respiro entre si.');
  }
  for(const id of ['title','detail','cta','artwork']) if(!elements.some(e=>e.id===id)) add('MISSING_CONTENT',id,'A campanha perdeu uma informação essencial.');
  const art=elements.find(e=>e.id==='artwork');
  const logo=elements.find(e=>e.role==='logo');
  if(logo) {
    const atLeft=logo.x<=w*.11,atRight=logo.x+logo.width>=w*.89;
    if(!(atLeft || atRight) || logo.y<h*.70 && !(atLeft && logo.y<=top+h*.06))add('LOGO_POSITION',logo.id,'Use a assinatura em um canto, fora do centro da composição.');
    if(logo.width>w*.22 || logo.height>h*.10)add('LOGO_DOMINANT',logo.id,'A assinatura não pode dominar o produto.');
  }
  if(art && (art.fit!=='contain' || art.width*art.height/(w*h)<.065 || Math.max(art.width/w,art.height/h)<.30)) add('PRODUCT_SCALE','artwork','O produto precisa aparecer inteiro e com mais destaque.');
  const textWords=elements.filter(e=>e.type==='text').reduce((n,e)=>n+e.text.split(/\s+/).length,0);
  if(textWords>85) add('COPY_DENSITY','support','Há texto demais para uma campanha de produto. Leve os detalhes para a legenda.');
  for(const e of essential.filter(e=>e.type==='text')) {
    const index=elements.findIndex(item=>item.id===e.id);
    if(elements.slice(index+1).some(later=>later.type!=='text' && later.opacity>.1 && overlap(boxOf(e),boxOf(later))>e.width*e.height*.05)) add('OCCLUDED_CONTENT',e.id,'Uma camada à frente está cobrindo o texto.');
  }
  const title=elements.find(e=>e.id==='title'),subject=elements.find(e=>e.id==='subject');
  const name=String(scene.sourceDraft?.productName || '').replace(/\s+/g,' ').toLowerCase();
  if(name && ![title,subject].some(e=>e?.text.replace(/\s+/g,' ').toLowerCase().includes(name))) add('PRODUCT_IDENTITY','title','Mantenha o nome do produto na campanha.');
  const detail=elements.find(e=>e.id==='detail');
  if(detail && scene.sourceDraft?.productPrice && detail.text.replace(/\s+/g,' ')!==scene.sourceDraft.productPrice.replace(/\s+/g,' ')) add('PRODUCT_PRICE','detail','O preço deve corresponder ao cadastro.');
  const cta=elements.find(e=>e.id==='cta'),website=elements.find(e=>e.id==='website');
  if(scene.sourceDraft?.content?.action?.destination && (!website || !cta || Math.abs(website.x-cta.x)>w*.05 || Math.abs(website.y-cta.y-cta.height)>h*.035)) add('ACTION_GROUP','cta','Mantenha a chamada junto do destino.');
  return {valid:issues.length===0,issues};
}

function visit(elements,fn) {for(const e of elements) {fn(e);if(e.children)visit(e.children,fn);}}
async function contrastReadings(scene,loadImage) {
  const background=structuredClone(scene);
  background.elements=flattenElements(background.elements).filter(e=>e.type!=='text' && e.visible!==false);
  // Render the actual stack: custom backgrounds, gradients and opaque surfaces all count.
  const width=216,height=Math.round(width*scene.height/scene.width),scale=width/scene.width;
  const key=require('crypto').createHash('sha256').update(JSON.stringify({width:scene.width,height:scene.height,color:scene.backgroundColor,elements:background.elements})).digest('hex');
  const data=await contrastCache.getOrLoad(key,async()=>{
    const raster=await require('../scene/renderer').renderSocialScene(background,{loadImage,layerRender:true,rasterWidth:width});
    return sharp(raster.buffer).resize(width,height).removeAlpha().raw().toBuffer();
  });
  return flattenElements(scene.elements).filter(e=>e.type==='text' && e.visible!==false).map(e=>{
    const b=boxOf(e),values=[];
    for(let y=Math.max(0,Math.ceil(b.y*scale));y<Math.min(height,Math.floor((b.y+b.height)*scale));y++) for(let x=Math.max(0,Math.ceil(b.x*scale));x<Math.min(width,Math.floor((b.x+b.width)*scale));x++) values.push(luminance([...data.subarray((y*width+x)*3,(y*width+x)*3+3)]));
    values.sort((a,b)=>a-b);
    const contrast=fill=>{
      if(!/^#[\da-f]{6}$/i.test(fill) || !values.length)return 0;
      const foreground=colorLuma(fill),ratios=values.map(v=>ratio(foreground,v)).sort((a,b)=>a-b);
      return ratios[Math.floor(ratios.length*.01)];
    };
    return {id:e.id,ratio:contrast(e.fill),white:contrast('#ffffff'),dark:contrast('#101820')};
  });
}

async function repairConcessionContrast(scene,loadImage) {
  const readings=await contrastReadings(scene,loadImage),repairs=[];
  for(const reading of readings) {
    const e=scene.elements.find(e=>e.id===reading.id);
    if(!e || reading.ratio>=4.5)continue;
    if(Math.max(reading.white,reading.dark)>=4.5) e.fill=reading.white>=reading.dark?'#ffffff':'#101820';
    else {
      e.fill='#ffffff';
      const pad=scene.width*.025;
      repairs.push({id:`product-contrast-${e.id}`,type:'gradient',role:'contrast',x:Math.max(0,e.x-pad),y:e.y-pad,width:Math.min(scene.width,e.width+2*pad),height:e.height+2*pad,direction:'bottom',locked:true,stops:[{offset:0,color:'rgba(0,0,0,0)'},{offset:pad/(e.height+2*pad),color:'rgba(0,0,0,0.96)'},{offset:(pad+e.height)/(e.height+2*pad),color:'rgba(0,0,0,0.96)'},{offset:1,color:'rgba(0,0,0,0)'}]});
    }
  }
  const first=scene.elements.findIndex(e=>e.type==='text');
  scene.elements.splice(Math.max(0,first),0,...repairs);
}

async function assessConcession(scene,loadImage) {
  const {issues}=inspectConcessionLayout(scene);
  for(const e of flattenElements(scene.elements).filter(e=>e.visible!==false && (e.id==='artwork' || e.role==='logo'))) {
    const buffer=await loadAsset(e.src,loadImage);
    if(!buffer) issues.push({code:'ASSET_MISSING',elementId:e.id,message:'A imagem do produto ou da assinatura não está disponível.',penalty:30});
    else if(e.role==='logo') {
      const meta=await sharp(buffer).metadata(),scale=Math.min(e.width/meta.width,e.height/meta.height);
      if(Math.max(meta.width*scale/scene.width,meta.height*scale/scene.height)<.065 || meta.height*scale<scene.height*.022) issues.push({code:'SMALL_LOGO',elementId:e.id,message:'A assinatura está pequena demais para leitura.',penalty:25});
    }
  }
  const readings=await contrastReadings(scene,loadImage);
  for(const e of readings) if(e.ratio<4.5)issues.push({code:'LOW_CONTRAST',elementId:e.id,message:'Contraste insuficiente no conteúdo final.',penalty:30});
  visit(scene.elements,e=>{const r=readings.find(r=>r.id===e.id);if(r)e.contrastRatio=Number(r.ratio.toFixed(2));});
  const contrast=Math.min(100,...readings.map(r=>r.ratio/7*100));
  const elements=flattenElements(scene.elements),art=elements.find(e=>e.id==='artwork');
  const prominence=art?Math.min(100,art.width*art.height/(scene.width*scene.height)/.20*100):0;
  const total=Math.max(0,Math.round(76+contrast*.12+prominence*.12-issues.length*20));
  return {accepted:!issues.length,total,score:total,contrast:Math.round(contrast),commercialClarity:issues.length?50:100,issues,method:'concession-raster-quality-v1',explanation:issues.length?'A composição precisa de ajustes.':'Produto, preço, marca e chamada legíveis; áreas seguras conferidas.',family:scene.sourceDraft?.concessionDirection?.family};
}
function qualityError(quality) {
  return Object.assign(new Error(`Esta composição não passou na revisão: ${[...new Set(quality.issues.map(i=>i.message))].join(' ')} Reduza os textos ou escolha outra direção.`),{statusCode:422,code:'CONCESSION_QUALITY',quality});
}
async function assertConcessionQuality(scene,loadImage) {
  if(!isConcession(scene))return null;
  const quality=await assessConcession(scene,loadImage);
  if(!quality.accepted)throw qualityError(quality);
  return quality;
}
module.exports={inspectConcessionLayout,repairConcessionContrast,assessConcession,assertConcessionQuality,qualityError,contrastReadings,boxOf,overlap};
