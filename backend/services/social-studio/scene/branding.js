const sharp = require('sharp');
const {loadAsset} = require('../engine/assets');

// Raster resolution belongs to the asset; these bounds are the visual size in every renderer.
async function applySignatureGeometry(scene, loadImage) {
  const logo = scene.elements.find(e => e.role === 'logo' && e.visible !== false);
  if (!logo) return scene;
  const buffer = await loadAsset(logo.src, loadImage);
  const metadata = buffer ? await sharp(buffer).metadata() : null;
  const ratio = metadata?.width && metadata?.height ? metadata.width / metadata.height : logo.width / logo.height;
  const draft = scene.sourceDraft;
  const scale = Math.max(70, Math.min(135, Number(draft.signatureScale) || 100)) / 100;
  const prominence = draft.signatureScaleMode === 'automatic' ? {subtle:.82,normal:1,strong:1.15}[draft.brandProminence] || 1 : 1;
  const margin = scene.width * .055;
  const bottom = scene.height * (scene.formatId === 'story' ? .90 : .975);
  const baseWidth = Math.min(scene.width * .24, Math.max(scene.width * .18, logo.width)) * prominence;
  if(draft.signaturePosition?.mode==='manual') {
    Object.assign(logo,{width:baseWidth*scale,height:baseWidth*scale/ratio,fit:'contain',focusX:50,focusY:50,locked:false});
    return scene;
  }
  const blockers = scene.elements.filter(e => e.visible !== false && (e.type === 'text' && e.text?.trim() || (e.id === 'artwork' || e.id.startsWith('movie-art-')) && e.height < scene.height*.8));
  const candidates = [scene.width-margin-baseWidth*1.35, scene.width*.72, margin];
  const slots = candidates.flatMap(x => {
    const right = Math.min(scene.width-margin, x + baseWidth * 1.35);
    const intervals=blockers.filter(e=>e.x<right+12 && e.x+e.width>x-12).map(e=>({top:e.y-14,bottom:e.y+e.height+14})).sort((a,b)=>a.top-b.top);
    let floor=scene.height*.70;
    const gaps=[];
    for(const interval of [...intervals,{top:bottom,bottom}]) {
      const end=Math.min(bottom,interval.top);
      if(end>floor) gaps.push({x,right,bottom:end,maxWidth:Math.max(0,Math.min(right-x,(end-floor)*ratio))});
      floor=Math.max(floor,interval.bottom);
    }
    return gaps;
  }).sort((a,b) => b.maxWidth-a.maxWidth || b.bottom-a.bottom);
  const minimumWidth = Math.max(scene.width*.13, scene.height*.04*ratio);
  const legibleSlots = slots.filter(candidate => candidate.maxWidth >= minimumWidth);
  const slot = (legibleSlots.length ? legibleSlots : slots).sort((a,b) => b.bottom-a.bottom || b.maxWidth-a.maxWidth)[0];
  const width = Math.min(baseWidth, slot?.maxWidth || 0) * scale;
  if (width < 16) throw Object.assign(new Error('Sem espaço para a assinatura. Reduza o texto ou escolha outra composição.'), {statusCode:400,code:'SIGNATURE_NO_SPACE'});
  Object.assign(logo, {x:slot.right-width,y:slot.bottom-width/ratio,width,height:width/ratio,fit:'contain',focusX:50,focusY:50,keepRatio:true,locked:false});
  scene.sourceDraft.signatureBounds = {width:logo.width,height:logo.height,aspectRatio:ratio,scale:Math.round(scale*100)};
  return scene;
}
module.exports = {applySignatureGeometry};
