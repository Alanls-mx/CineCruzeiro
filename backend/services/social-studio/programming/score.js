const {flattenElements}=require('../scene/groups');
const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
function scoreProgramming(scene) {
  const elements=flattenElements(scene.elements).filter(e=>e.visible!==false);
  const texts=elements.filter(e=>e.type==='text' && e.text);
  const times=texts.filter(e=>/\d{2}:\d{2}/.test(e.text));
  const issues=[];
  for(const time of times) if(time.fontSize<24) issues.push({code:'PROGRAM_SMALL_TIME',penalty:25,elementId:time.id});
  const movies=scene.sourceDraft.programMovies || [];
  const multi=scene.templateId==='multi-movies';
  for(const [i,movie] of movies.entries()) {
    const art=elements.find(e=>e.id===`movie-art-${i}`),title=elements.find(e=>e.id===`movie-title-${i}`),sessions=elements.find(e=>e.id===`movie-sessions-${i}`);
    if(!multi) continue;
    if(!art || art.width<120 || art.height<90) issues.push({code:'PROGRAM_SMALL_POSTER',penalty:18,elementId:`movie-art-${i}`});
    if(!title || title.fontSize<24) issues.push({code:'PROGRAM_SMALL_TITLE',penalty:22,elementId:`movie-title-${i}`});
    if(sessions && movie.schedule.count && !/\d{2}:\d{2}/.test(sessions.text)) issues.push({code:'PROGRAM_MISSING_TIME',penalty:30,elementId:sessions.id});
    if(title && art && Math.min(Math.abs(title.y-art.y-art.height),Math.abs(title.x-art.x-art.width))>scene.width*.12) issues.push({code:'PROGRAM_DETACHED_TITLE',penalty:20,elementId:title.id});
  }
  const programReadability=clamp(100-issues.filter(i=>/SMALL_TIME|SMALL_TITLE/.test(i.code)).reduce((n,i)=>n+i.penalty,0));
  const scheduleClarity=scene.sourceDraft.showSessions===false?100:clamp((times.length?100:0)-issues.filter(i=>/TIME/.test(i.code)).reduce((n,i)=>n+i.penalty,0));
  const movieSeparation=clamp(100-issues.filter(i=>/DETACHED|MISSING/.test(i.code)).length*25);
  const posterBalance=clamp(100-issues.filter(i=>i.code==='PROGRAM_SMALL_POSTER').length*18);
  const featuredMovieClarity=multi && !movies.some(m=>m.featured)?60:100;
  return {programReadability,scheduleClarity,movieSeparation,posterBalance,featuredMovieClarity,issues,total:clamp(programReadability*.3+scheduleClarity*.3+movieSeparation*.2+posterBalance*.1+featuredMovieClarity*.1)};
}
module.exports={scoreProgramming};
