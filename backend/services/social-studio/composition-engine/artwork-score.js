const {flattenElements}=require('../scene/groups');
const clamp=n=>Math.round(Math.max(0,Math.min(100,n)));
const key=s=>String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function scoreArtwork(scene) {
  const draft=scene.sourceDraft || {},policy=draft.artworkPolicy || {},elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const texts=elements.filter(e=>e.type==='text' && e.text?.trim());
  const art=elements.find(e=>e.id==='artwork'),bg=elements.find(e=>e.id==='background-blur');
  const title=texts.find(e=>e.id==='title'),date=texts.find(e=>e.id==='detail');
  let redundancy=100;
  if(policy.embeddedTitleVisible && title) redundancy-=title.fontSize>60?35:10;
  if(policy.hideDate && date) redundancy-=30;
  if(elements.some(e=>e.role==='logo') && texts.some(e=>e.id==='cinema')) redundancy-=12;
  for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++) if(key(texts[i].text).length>5 && key(texts[i].text)===key(texts[j].text)) redundancy-=15;
  const boxes=texts.map(e=>({...e,height:Math.min(e.height,e.fontSize*(e.lineHeight || 1.12)*e.text.split('\n').length)}));
  const artworkBox=art?{...art}:bg?{...bg}:null;
  if(artworkBox && art?.fit==='contain' && draft.sourceAsset?.width) {
    const ratio=art.crop?.width ? art.crop.width/art.crop.height : draft.sourceAsset.width/draft.sourceAsset.height;
    const width=Math.min(art.width,art.height*ratio),height=width/ratio;
    Object.assign(artworkBox,{x:art.x+(art.width-width)/2,y:art.y+(art.height-height)/2,width,height});
  }
  if(artworkBox) boxes.push(artworkBox);
  let occupied=0;
  for(let y=0;y<24;y++) for(let x=0;x<18;x++) if(boxes.some(b=>(x+.5)*scene.width/18>=b.x && (x+.5)*scene.width/18<=b.x+b.width && (y+.5)*scene.height/24>=b.y && (y+.5)*scene.height/24<=b.y+b.height)) occupied++;
  const density=occupied/(24*18);
  const target=draft.visualStyle==='minimal'?.20:draft.visualStyle==='impact'?.46:draft.layoutId==='editorial'?.29:.36;
  const compositionDensity=clamp(100-Math.max(0,target-density)*220);
  const ratio=artworkBox?Math.min(1,artworkBox.width*artworkBox.height/(scene.width*scene.height)):0;
  const artworkUtilization=clamp(100-Math.max(0,(draft.primaryElement==='price'?.16:.32)-ratio)*250);
  const integrated=art?.effects && art.effects.mask!=='none' && art.effects.blend>25;
  const visualContinuity=bg?clamp(60+(bg.src===art?.src?15:10)+(integrated?20:0)+(elements.some(e=>e.id==='ambient-shadow')?5:0)+(!art?25:0)):40;
  const primaries=elements.filter(e=>e.hierarchy==='primary');
  const primaryElementClarity=clamp(100-Math.abs(1-primaries.length)*35);
  const issues=[];
  if(compositionDensity<65 && visualContinuity<80) issues.push({code:'DRY_COMPOSITION',penalty:15,elementId:'artwork'});
  if(redundancy<75) issues.push({code:'REDUNDANT_CONTENT',penalty:12,elementId:'title'});
  return {redundancy:clamp(redundancy),compositionDensity,visualContinuity,artworkUtilization,primaryElementClarity,occupiedRatio:Number(density.toFixed(3)),issues};
}
module.exports={scoreArtwork};
