const {MOVIE_FAMILIES}=require('../contracts/artwork-layout');
const crypto=require('crypto');
function movieDirection(draft,input,analysis,backdrop,backdropAnalysis) {
  const selected=input.layoutId || input.style;
  const manual=MOVIE_FAMILIES[selected] && input.automaticStyle!==true;
  const genre=draft.genreProfile?.id;
  const choices=genre==='horror'?['movie-character','movie-full-bleed','cinematic-blend']
    :genre==='family'?['movie-immersive','movie-asymmetric','cinematic-story']
    :genre==='action'?['movie-full-bleed','movie-asymmetric','movie-character']
    :genre==='comedy'?['movie-asymmetric','poster-lateral','movie-immersive']
    :['poster-lateral','cinematic-blend','poster-editorial','movie-immersive'];
  const seed=crypto.createHash('sha256').update(`${draft.movieId}:${draft.artDirection?.seed || 0}`).digest().readUInt32LE(0);
  let family=manual?selected:choices[seed%choices.length];
  if(!manual && draft.templateId==='movie-premiere')family='movie-spotlight';
  const quietest=analysis?.zones?.[0],busy=quietest?.complexity>.22;
  if(!manual && busy && !backdrop)family=genre==='family'?'movie-immersive':'cinematic-blend';
  if(!manual && draft.templateId!=='movie-premiere' && backdrop && quietest?.id==='bottom' && quietest.complexity<.12)family='movie-full-bleed';
  if(!backdrop && ['movie-full-bleed','movie-character'].includes(family))family='cinematic-blend';
  const quiet=analysis?.zones?.find(z=>z.id==='left')?.complexity<analysis?.zones?.find(z=>z.id==='right')?.complexity?'left':'right';
  const focal=['movie-full-bleed','movie-character'].includes(family)?backdropAnalysis || analysis:analysis;
  return {family,automatic:!manual,copySide:quiet,focusX:focal?.focusX || 50,focusY:focal?.focusY || 42,
    method:analysis?.method || 'genre-and-assets',genre,
    reason:manual?'Composição escolhida no painel.':`Direção por gênero, material disponível e complexidade visual; texto no lado ${quiet==='left'?'esquerdo':'direito'} mais tranquilo.`,
    // Edge density approximates a focal area; it does not claim face or gaze recognition.
    subjectDetection:'visual-saliency-heuristic',backdrop:Boolean(backdrop)};
}
module.exports={movieDirection};
