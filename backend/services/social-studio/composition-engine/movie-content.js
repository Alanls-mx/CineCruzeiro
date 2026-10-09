const {flattenElements}=require('../scene/groups');

function embeddedMovieTitle(draft,sourceUrl,{intact=true}={}) {
  const metadata=draft.artworkMetadata || {};
  const applies=!metadata.sourceUrl || metadata.sourceUrl===sourceUrl;
  const known=applies && (metadata.containsTitle===true || metadata.containsMovieLogo===true);
  const absent=applies && metadata.containsTitle===false && metadata.containsMovieLogo!==true;
  // Registered posters are an operator convention, not an OCR result. Explicit metadata wins.
  const registered=Boolean(sourceUrl && sourceUrl===draft.entities?.movie?.posterUrl);
  const embedded=intact && !absent && (known || registered);
  const customTitle=draft.title && draft.entities?.movie?.title && semanticText(draft.title)!==semanticText(draft.entities.movie.title);
  const hide=draft.titleVisibility==='hide' || embedded && !customTitle && (!draft.titleVisibility || draft.titleVisibility==='automatic');
  return {hide,embedded,evidence:known?'metadata':registered && !absent?'registered-poster':'none'};
}

function semanticText(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
    .replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/[^a-z0-9]/g,'');
}

function curateMovieContent(scene) {
  if(!scene.templateId?.startsWith('movie-'))return scene;
  const elements=flattenElements(scene.elements);
  const rank={detail:10,'session-time':9,title:8,cta:7,website:6,description:4,subtitle:3,'date-label':2,cinema:1};
  const selected=new Map(),removed=[];
  for(const element of elements.filter(e=>e.type==='text' && e.visible!==false)
    .sort((a,b)=>(rank[b.id] || 0)-(rank[a.id] || 0))) {
    const key=semanticText(element.text);
    if(!key)continue;
    if(selected.has(key) || element.id==='cinema' && elements.some(e=>e.role==='logo' && e.visible!==false)) {
      removed.push(element.id);
    } else selected.set(key,element.id);
  }
  const hide=nodes=>nodes.forEach(element=>{
    if(removed.includes(element.id))element.visible=false;
    if(element.children)hide(element.children);
  });
  hide(scene.elements);
  // The export contract must describe the curated output, not discarded duplicate fields.
  if(scene.sourceDraft.movieManifest)scene.sourceDraft.movieManifest=scene.sourceDraft.movieManifest.filter(item=>!removed.includes(item.id));
  scene.sourceDraft.curatedDuplicates=removed;
  return scene;
}

module.exports={embeddedMovieTitle,semanticText,curateMovieContent};
