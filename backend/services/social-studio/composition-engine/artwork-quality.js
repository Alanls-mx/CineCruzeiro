const {flattenElements}=require('../scene/groups');
const {boxOf,overlap,contrastReadings,repairConcessionContrast}=require('./concession-quality');
const {SAFE,isMovie,isProgramme}=require('../contracts/artwork-layout');
const {visualLength}=require('../engine/typography');
const {loadAsset}=require('../engine/assets');
const sharp=require('sharp');
const applies=scene=>isMovie(scene) || isProgramme(scene);

async function reserveSignature(scene,loadImage) {
  const logo=scene.elements.find(e=>e.role==='logo' && e.visible!==false);
  if(!logo)return;
  const buffer=await loadAsset(logo.src,loadImage);
  if(!buffer) {scene.elements=scene.elements.filter(e=>e!==logo);return;}
  const meta=await sharp(buffer).metadata(),ratio=meta.width/meta.height;
  const safe=SAFE[scene.formatId],w=scene.width,h=scene.height;
  const blockers=flattenElements(scene.elements).filter(e=>e.visible!==false && (e.type==='text' || e.id==='artwork' || e.id.startsWith('movie-art-')));
  const fits=b=>!blockers.some(e=>overlap({...b,x:b.x-10,y:b.y-10,width:b.width+20,height:b.height+20},boxOf(e))>4);
  const reserved=scene.sourceDraft.signatureReserved;
  let selected=reserved && fits(reserved)?reserved:null;
  const scale=Math.max(.7,Math.min(1.35,(scene.sourceDraft.signatureScale || 100)/100));
  for(const requestedWidth of [w*.14,w*.13,w*.12].map(value=>Math.min(w*.19,value*scale))) {
    if(selected)break;
    const height=Math.min(h*(isProgramme(scene)?.045:.07),requestedWidth/ratio),width=height*ratio;
    for(const x of [w*safe.right-width,w*safe.left]) {
      for(const y of [h*safe.bottom-height,h*safe.bottom-height-h*.035,...(x===w*safe.left?[h*safe.top]:[])]) {
        const b={x,y,width,height};
        if(height<=h*.09 && fits(b)) {selected=b;break;}
      }
      if(selected)break;
    }
  }
  if(!selected)throw Object.assign(new Error('Sem área segura para a assinatura. Reduza o texto ou escolha outra composição.'),{code:'ARTWORK_QUALITY',statusCode:422});
  Object.assign(logo,selected,{fit:'contain',focusX:50,focusY:50,rotation:0,opacity:1});
  scene.sourceDraft.signatureReserved=selected;
}
function validateArtworkLayout(scene) {
  const w=scene.width,h=scene.height,safe=SAFE[scene.formatId],issues=[];
  const elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const text=elements.filter(e=>e.type==='text' && e.text?.trim());
  const art=elements.filter(e=>e.id==='artwork' || e.id.startsWith('movie-art-'));
  const logo=elements.find(e=>e.role==='logo');
  const add=(code,id,message)=>issues.push({code,elementId:id,message,penalty:25});
  if(scene.sourceDraft.creativeMovieLayout)for(const expected of scene.sourceDraft.movieManifest || []) {
    const actual=text.find(e=>e.id===expected.id);
    if(!actual || expected.id!=='title' && actual.text.replace(/\s+/g,' ').replace(/-\s+/g,'-').trim()!==expected.text.replace(/-\s+/g,'-'))add('MOVIE_CONTENT',expected.id,'Mantenha os dados completos da campanha.');
  }
  if(scene.sourceDraft.officialProgramLayout) {
    for(const expected of scene.sourceDraft.programManifest || []) {
      const actual=text.find(e=>e.id===expected.id);
      if(!actual || actual.text.replace(/\s+/g,' ').trim()!==expected.text)add('PROGRAM_CONTENT',expected.id,'A programação perdeu ou alterou informação. Gere a arte novamente a partir das sessões.');
    }
    if(elements.filter(e=>e.role==='logo').length>1)add('DUPLICATE_LOGO','logo','Use uma única assinatura na programação.');
    for(const e of text.filter(e=>/^movie-title-|^program-film-/.test(e.id))) {
      if(e.text.split('\n').length>2 || e.fontSize<28*w/1080)add('PROGRAM_TITLE',e.id,'O título precisa caber em até duas linhas legíveis.');
    }
    if(art.some(e=>e.fit!=='contain' || e.rotation || e.effects?.scale>1))add('PROGRAM_POSTER','artwork','Preserve o formato e o alinhamento dos pôsteres.');
    if(scene.sourceDraft.programPosterMode!=='featured' && art.some(e=>Math.abs(e.width-art[0].width)>2 || Math.abs(e.height-art[0].height)>2))add('PROGRAM_POSTER_EQUALITY','artwork','Use pôsteres equivalentes ou escolha explicitamente um filme em destaque.');
    if(logo && (logo.x<w*.75 || logo.y<h*.75))add('PROGRAM_LOGO','logo','Mantenha a assinatura no rodapé direito.');
    for(const binding of scene.sourceDraft.programBindings || []) {
      const anchor=elements.find(e=>e.id===binding.anchorId),item=elements.find(e=>e.id===binding.id);
      if(anchor && item && (Math.abs(item.x-anchor.x-binding.dx)>2 || Math.abs(item.y-anchor.y-binding.dy)>2))add('PROGRAM_ASSOCIATION',binding.id,'O horário precisa permanecer junto do filme correspondente.');
    }
    const expected=scene.sourceDraft.programReadingOrder || [];
    const ordered=elements.filter(e=>expected.includes(e.id)).sort((a,b)=>scene.sourceDraft.programReadingColumns?a.x-b.x || a.y-b.y:a.y-b.y || a.x-b.x).map(e=>e.id);
    if(JSON.stringify(ordered)!==JSON.stringify(expected))add('PROGRAM_ORDER','program','Mantenha os filmes na ordem cronológica da programação.');
  }
  const visit=nodes=>nodes.forEach(e=>{if(e.type==='group' && (e.opacity<.95 || e.rotation))add('GROUP_TRANSFORM',e.id,'Mantenha o grupo de conteúdo opaco e sem rotação.');if(e.children)visit(e.children);});
  visit(scene.elements);
  if(scene.sourceDraft.editorialSource && !art.length)add('MISSING_ARTWORK','artwork','Mantenha a imagem principal da campanha.');
  for(const e of [...text,...(logo?[logo]:[])]) {
    const b=boxOf(e);
    if(b.x<w*.025-1 || b.x+b.width>w*.975+1 || b.y<h*(scene.formatId==='story'?.065:.025)-1 || b.y+b.height>h*(scene.formatId==='story'?.91:.985)+1) add('SAFE_AREA',e.id,'Conteúdo fora da área segura.');
    if(e.opacity<.95)add('HIDDEN_CONTENT',e.id,'Conteúdo essencial pouco visível.');
    if(e.type==='text') {
      const min=/movie-day-/.test(e.id)?28:/website|cinema|movie-sessions|program-/.test(e.id)?22:/description|subtitle/.test(e.id)?26:30;
      if(e.fontSize<min*w/1080)add('SMALL_TEXT',e.id,'Texto pequeno demais.');
      const lines=e.text.split('\n');
      if(lines.length*e.fontSize*e.lineHeight>e.height+2 || lines.some(l=>visualLength(l)*e.fontSize>e.width+2))add('TEXT_OVERFLOW',e.id,'Texto não cabe integralmente na área reservada.');
      if(/\d{4}-\d{2}-\d{2}/.test(e.text))add('ISO_DATE',e.id,'Use uma data de campanha, não uma data técnica.');
    }
  }
  for(let i=0;i<text.length;i++) for(let j=i+1;j<text.length;j++)if(overlap(boxOf(text[i]),boxOf(text[j]))>4)add('TEXT_OVERLAP',`${text[i].id}/${text[j].id}`,'Textos estão sobrepostos.');
  for(const e of text) {
    const index=elements.findIndex(item=>item.id===e.id);
    if(elements.slice(index+1).some(later=>later.type!=='text' && later.opacity>.1 && overlap(boxOf(e),boxOf(later))>e.width*e.height*.05))add('OCCLUDED_CONTENT',e.id,'Uma camada está cobrindo o texto.');
  }
  for(const poster of art) {
    const protectedBox=poster.fit==='contain'?boxOf(poster):{x:poster.x+poster.width*.2,y:poster.y+poster.height*.12,width:poster.width*.6,height:poster.height*.68};
    if(text.some(t=>overlap(protectedBox,boxOf(t))>4))add('SUBJECT_OVERLAP',poster.id,'O texto invade a área protegida da imagem.');
    if(scene.sourceDraft.officialMovieLayout && (!scene.sourceDraft.heroUsesBackdrop && !scene.sourceDraft.heroUsesPosterCrop && poster.fit!=='contain' || poster.crop || poster.effects?.scale>1 || poster.effects?.blur>0))add('POSTER_CROP',poster.id,'Preserve o pôster principal inteiro e nítido.');
  }
  if(logo) {
    const atLeft=logo.x<=w*.11,atRight=logo.x+logo.width>=w*.89;
    if(!(atLeft || atRight) || logo.y<h*.70 && !(atLeft && logo.y<=h*(safe.top+.045)))add('LOGO_POSITION',logo.id,'Use uma assinatura no canto, fora do centro da composição.');
    if(logo.width>w*.22 || logo.height>h*.10)add('LOGO_DOMINANT',logo.id,'A assinatura não pode dominar a composição.');
    if([...text,...art].some(e=>overlap(boxOf(logo),boxOf(e))>4))add('LOGO_OVERLAP',logo.id,'A assinatura cobre conteúdo.');
  }
  const cta=text.find(e=>e.id==='cta'),website=text.find(e=>e.id==='website');
  if(scene.sourceDraft.content?.action?.label && !cta)add('MISSING_CTA','cta','A chamada precisa estar visível.');
  if(scene.sourceDraft.content?.action?.destination && (!website || !cta || Math.abs(website.x-cta.x)>w*.05 || Math.abs(website.y-cta.y-cta.height)>h*.04))add('ACTION_GROUP','website','A chamada deve ficar junto de seu destino.');
  return {valid:!issues.length,issues};
}
async function assessArtwork(scene,loadImage) {
  const {issues}=validateArtworkLayout(scene),readings=await contrastReadings(scene,loadImage);
  for(const element of flattenElements(scene.elements).filter(e=>e.visible!==false && (e.id==='artwork' || e.id.startsWith('movie-art-') || e.role==='logo'))) {
    if(!await loadAsset(element.src,loadImage))issues.push({code:'ASSET_MISSING',elementId:element.id,message:'Uma imagem da composição não está mais disponível.',penalty:30});
  }
  for(const e of readings)if(e.ratio<4.5)issues.push({code:'LOW_CONTRAST',elementId:e.id,message:'Contraste insuficiente na imagem final.',penalty:30});
  const set=elements=>elements.forEach(e=>{const r=readings.find(r=>r.id===e.id);if(r)e.contrastRatio=r.ratio;if(e.children)set(e.children);});set(scene.elements);
  const contrast=Math.min(100,...readings.map(e=>e.ratio/7*100)),score=Math.max(0,Math.round(85+contrast*.15-issues.length*20));
  return {accepted:!issues.length,total:score,score,contrast,commercialClarity:issues.length?50:100,issues,explanation:issues.length?'A composição precisa de ajustes.':'Pôster preservado, assinatura disciplinada e leitura conferida.',method:'artwork-raster-quality-v1'};
}
function failure(quality) {return Object.assign(new Error(`A arte precisa de ajustes: ${[...new Set(quality.issues.map(e=>e.message))].join(' ')} Reduza os textos ou escolha outra composição.`),{code:'ARTWORK_QUALITY',statusCode:422,quality});}
async function assertArtworkQuality(scene,loadImage) {
  if(!applies(scene))return null;
  const quality=await assessArtwork(scene,loadImage);
  if(!quality.accepted)throw failure(quality);
  return quality;
}
async function repairContrast(scene,loadImage) {
  if(scene.sourceDraft.creativeMovieLayout) {
    let readings=await contrastReadings(scene,loadImage);
    const selectInk=()=>readings.forEach(r=>{const e=scene.elements.find(e=>e.id===r.id);if(e && r.ratio<4.5 && Math.max(r.white,r.dark)>=4.5)e.fill=r.white>=r.dark?'#ffffff':'#101820';});
    selectInk();
    if(readings.some(r=>Math.max(r.white,r.dark)<4.5)) {
      const side=['movie-character','cinematic-blend','movie-asymmetric'].includes(scene.sourceDraft.movieFamily);
      const left=scene.sourceDraft.movieFamily==='movie-asymmetric' || scene.sourceDraft.movieDirection?.copySide==='left';
      const veil={id:'movie-reading-veil',role:'ambient',type:'gradient',x:0,y:0,width:scene.width,height:scene.height,opacity:1,direction:side?(left?'right':'left'):'bottom',stops:side?[{offset:0,color:'rgba(0,0,0,0.94)'},{offset:.34,color:'rgba(0,0,0,0.94)'},{offset:.58,color:'rgba(0,0,0,0)'},{offset:1,color:'rgba(0,0,0,0)'}]:[{offset:0,color:'rgba(0,0,0,0)'},{offset:.46,color:'rgba(0,0,0,0)'},{offset:.61,color:'rgba(0,0,0,0.94)'},{offset:1,color:'rgba(0,0,0,0.94)'}]};
      scene.elements.splice(scene.elements.findIndex(e=>e.type==='text'),0,veil);
      if(side)scene.elements.splice(scene.elements.findIndex(e=>e.type==='text'),0,{...veil,id:'movie-footer-veil',direction:'bottom',stops:[{offset:0,color:'rgba(0,0,0,0)'},{offset:.65,color:'rgba(0,0,0,0)'},{offset:.74,color:'rgba(0,0,0,0.94)'},{offset:1,color:'rgba(0,0,0,0.94)'}]});
      readings=await contrastReadings(scene,loadImage);selectInk();
    }
    return;
  }
  if(scene.sourceDraft.officialProgramLayout && (await contrastReadings(scene,loadImage)).some(r=>r.ratio<4.5)) {
    scene.elements=scene.elements.filter(e=>e.role!=='ambient' && !e.id.startsWith('custom-background-'));
    scene.backgroundColor='#101216';
    scene.sourceDraft.programSolidFallback=true;
  }
  await repairConcessionContrast(scene,loadImage);
}
module.exports={applies,reserveSignature,validateArtworkLayout,assessArtwork,assertArtworkQuality,repairContrast,failure};
