const {MOVIE_FAMILIES}=require('../contracts/artwork-layout');
function movieDirection(draft,input,analysis,backdrop,backdropAnalysis) {
  const selected=input.layoutId || input.style;
  const manual=MOVIE_FAMILIES[selected] && input.automaticStyle!==true;
  const genre=draft.genreProfile?.id;
  const quietest=analysis?.zones?.[0];
  let family=selected;
  if(!manual) {
    if(draft.templateId==='movie-presale')family='movie-campaign';
    else if(draft.formatId==='story' || draft.templateId==='movie-premiere')family='movie-spotlight';
    else if(draft.formatId==='square')family='movie-immersive';
    else if(analysis?.brightness>.52 || !analysis && ['romance','comedy'].includes(genre))family='movie-campaign';
    else if(analysis?.brightness>.3 && quietest?.id==='bottom' && quietest.complexity<.12)family='movie-editorial-light';
    else family='movie-immersive';
  }
  if(!backdrop && ['movie-full-bleed','movie-character'].includes(family))family='cinematic-blend';
  const quiet=analysis?.zones?.find(z=>z.id==='left')?.complexity<analysis?.zones?.find(z=>z.id==='right')?.complexity?'left':'right';
  const focal=['movie-full-bleed','movie-character'].includes(family)?backdropAnalysis || analysis:analysis;
  return {family,automatic:!manual,copySide:quiet,focusX:focal?.focusX || 50,focusY:focal?.focusY || 42,
    method:analysis?.method || 'genre-and-assets',genre,
    reason:manual?'Composição escolhida no painel.':'Direção pelo formato, luminosidade e áreas de menor complexidade da arte; dados comerciais fora do pôster preservado.',
    // Edge density approximates a focal area; it does not claim face or gaze recognition.
    subjectDetection:'visual-saliency-heuristic',backdrop:Boolean(backdrop)};
}
module.exports={movieDirection};
