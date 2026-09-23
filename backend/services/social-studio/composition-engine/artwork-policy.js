const STRATEGIES=['FULL_POSTER','CROPPED_POSTER','BACKDROP_HERO','LOGO_DOMINANT','SYMBOL_DOMINANT','CHARACTER_DOMINANT','POSTER_BLEND','FULL_BLEED'];
function normalizeArtwork(input, movie = {}) {
  movie ||= {};
  const key=input.imageMode==='backdrop'?'backdrop':'poster';
  const stored=movie.artworkMetadata?.[key] || movie.artworkMetadata || {};
  const override=input.artworkMetadata || {};
  const source=input.imageUrl || (key==='backdrop'?movie.backdropUrl:movie.posterUrl) || '';
  const metadata={...(!input.imageUrl?stored:{}),...(!override.sourceUrl || override.sourceUrl===source?override:{})};
  const fields=['containsTitle','containsReleaseDate','containsMovieLogo','containsBillingBlock','releaseDateVerified'];
  const normalized=Object.fromEntries(fields.filter(k=>typeof metadata[k]==='boolean').map(k=>[k,metadata[k]]));
  normalized.dominantAsset=['logo','symbol','character','poster'].includes(metadata.dominantAsset)?metadata.dominantAsset:'poster';
  normalized.embeddedReleaseDate=/^\d{4}-\d{2}-\d{2}$/.test(metadata.embeddedReleaseDate || '')?metadata.embeddedReleaseDate:'';
  if(metadata.contentBounds && ['x','y','width','height'].every(k=>Number.isFinite(metadata.contentBounds[k]))) {
    const b=metadata.contentBounds;
    if(b.x>=0 && b.y>=0 && b.width>0 && b.height>0 && b.x+b.width<=1 && b.y+b.height<=1) normalized.contentBounds={x:b.x,y:b.y,width:b.width,height:b.height};
  }
  return {artworkMetadata:{...normalized,sourceUrl:source},artworkStrategy:STRATEGIES.includes(input.artworkStrategy)?input.artworkStrategy:'automatic',titleVisibility:['show','support','hide'].includes(input.titleVisibility)?input.titleVisibility:'automatic',dateVisibility:['show','embedded'].includes(input.dateVisibility)?input.dateVisibility:'automatic'};
}
function resolveArtworkPolicy(draft, analysis, hasBackdrop) {
  const m=draft.artworkMetadata;
  let strategy=draft.artworkStrategy;
  const complexity=analysis?.zones?.reduce((sum,z)=>sum+z.complexity,0)/(analysis?.zones?.length || 1);
  if(strategy==='automatic') strategy=m.dominantAsset==='logo'?'LOGO_DOMINANT':m.dominantAsset==='symbol'?'SYMBOL_DOMINANT':m.dominantAsset==='character'?'CHARACTER_DOMINANT':draft.style==='full-bleed' && hasBackdrop?'FULL_BLEED':complexity<.07 && hasBackdrop?'BACKDROP_HERO':'POSTER_BLEND';
  if(['BACKDROP_HERO','FULL_BLEED'].includes(strategy) && !hasBackdrop) strategy='POSTER_BLEND';
  const intact=['FULL_POSTER','POSTER_BLEND','LOGO_DOMINANT','SYMBOL_DOMINANT'].includes(strategy) && draft.imageMode!=='backdrop';
  const knownTitle=intact && (m.containsTitle || m.containsMovieLogo);
  const hideTitle=draft.titleVisibility==='hide' || draft.titleVisibility==='automatic' && knownTitle && ['LOGO_DOMINANT','SYMBOL_DOMINANT'].includes(strategy);
  const supportTitle=draft.titleVisibility==='support' || draft.titleVisibility==='automatic' && knownTitle;
  // Dates may only be delegated to artwork when an operator verified the same date and scope.
  const hideDate=draft.dateVisibility!=='show' && intact && m.containsReleaseDate && m.releaseDateVerified && m.embeddedReleaseDate===draft.content.releaseDate && draft.primaryDateKind==='release' && draft.content.releaseScope==='international';
  const campaign=draft.templateId;
  const primaryElement=campaign==='movie-price'?'price':/^sessions-/.test(campaign)?'sessions':['LOGO_DOMINANT','SYMBOL_DOMINANT'].includes(strategy)?strategy==='LOGO_DOMINANT'?'movieLogo':'symbol':['movie-premiere','movie-presale'].includes(campaign) && !hideDate?'date':strategy==='CHARACTER_DOMINANT' || hideTitle?'artwork':'title';
  return {strategy,primaryElement,hideTitle,supportTitle,hideDate,embeddedTitleVisible:Boolean(knownTitle),dryArtwork:complexity<.07};
}
function applyArtworkPolicy(scene) {
  const draft=scene.sourceDraft,p=draft.artworkPolicy;
  if(!p || !draft.templateId.startsWith('movie-')) return scene;
  const get=id=>scene.elements.find(e=>e.id===id);
  const title=get('title'),date=get('detail'),cinema=get('cinema'),art=get('artwork');
  if(title) {if(p.hideTitle) title.visible=false;else if(p.supportTitle) {title.fontSize=Math.min(title.fontSize,38);title.hierarchy='secondary';}}
  if(date && p.hideDate) {date.visible=false;const label=get('subtitle');if(label) {label.text=draft.subtitle;}}
  if(date && !date.text?.trim()) date.visible=false;
  if(cinema && get('logo')) cinema.visible=false;
  const description=get('description'),cta=get('cta');
  const key=s=>String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(description && cta && key(description.text)===key(cta.text)) description.visible=false;
  const primaryId={artwork:'artwork',movieLogo:'artwork',symbol:'artwork',date:'detail',price:'detail',sessions:'detail',title:'title'}[p.primaryElement];
  for(const e of scene.elements) if(e.hierarchy==='primary') e.hierarchy='secondary';
  const primary=get(primaryId);
  if(primary && primary.visible!==false) primary.hierarchy='primary';
  if(art && ['CROPPED_POSTER','CHARACTER_DOMINANT','BACKDROP_HERO'].includes(p.strategy)) art.fit='cover';
  if(art && p.strategy==='FULL_POSTER' && art.effects) Object.assign(art.effects,{mask:'none',blend:0,scale:1});
  if(art && ['LOGO_DOMINANT','SYMBOL_DOMINANT'].includes(p.strategy) && draft.artworkMetadata.contentBounds && draft.sourceAsset && !Object.keys(draft.artDirection?.hero || {}).some(k=>k.startsWith('crop'))) {
    const b=draft.artworkMetadata.contentBounds;
    art.crop={x:Math.round(b.x*draft.sourceAsset.width),y:Math.round(b.y*draft.sourceAsset.height),width:Math.max(1,Math.floor(b.width*draft.sourceAsset.width)),height:Math.max(1,Math.floor(b.height*draft.sourceAsset.height))};
    for(const e of scene.elements.filter(e=>['ambient-shadow','contact-shadow'].includes(e.id))) e.crop={...art.crop};
  }
  return scene;
}
module.exports={STRATEGIES,normalizeArtwork,resolveArtworkPolicy,applyArtworkPolicy};
