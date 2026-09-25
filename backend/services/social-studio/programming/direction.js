const EDITORIAL_LAYOUTS=['program-hero','program-duo','program-cards','program-grid','program-list','program-days'];
const PROGRAM_LAYOUTS=Object.fromEntries(['sessions-today','sessions-week','multi-movies'].map(id=>[id,EDITORIAL_LAYOUTS]));
function selectFeaturedMovie(movies, options={}) {
  const now=new Date(options.now || Date.now()).getTime();
  const nearest=m=>Math.min(...(m.sessions || []).map(s=>Date.parse(`${s.date}T${s.time}:00-03:00`)).filter(t=>Number.isFinite(t) && t>=now));
  const premiere=m=>/estreia|premiere/i.test(m.tag || '') || (Date.parse(m.releaseDate)-now>=-86400000 && Date.parse(m.releaseDate)-now<7*86400000);
  return [...movies].sort((a,b)=>Number(b.id===options.featuredMovieId)-Number(a.id===options.featuredMovieId) || Number(premiere(b))-Number(premiere(a)) || (Number(a.priority ?? a.displayOrder ?? 999)-Number(b.priority ?? b.displayOrder ?? 999)) || (b.sessions?.length || 0)-(a.sessions?.length || 0) || (nearest(a)-nearest(b) || 0) || String(a.id).localeCompare(String(b.id)))[0] || null;
}
function analyzeProgramMood(movies) {
  const {genreProfile}=require('../engine/normalizer');
  const counts={};
  for(const movie of movies) {const genre=genreProfile(movie).id;counts[genre]=(counts[genre] || 0)+1;}
  const [genre,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0] || ['cinema',0];
  return count>movies.length/2?genre:'cinema';
}
function programLayout(draft,count) {
  const model=require('./schedule').programData(draft.programMovies);
  const requested=draft.programLayout;
  const aliases={timeline:'program-list','hero-schedule':'program-hero','poster-list':'program-list','cinema-board':'program-cards','editorial-schedule':'program-list','day-cards':'program-days','week-timeline':'program-days','poster-calendar':'program-days','featured-days':'program-days','editorial-week':'program-days',featured:'program-cards','cinematic-grid':'program-grid',layered:'program-grid',mosaic:'program-cards','film-strip':'program-list',panorama:'program-grid','split-heroes':'program-duo',collage:'program-grid',lineup:'program-list'};
  const selected=aliases[requested] || requested;
  if(selected==='program-days' || selected==='program-list')return selected;
  if(selected==='program-hero' && count===1 || selected==='program-duo' && count===2 || selected==='program-cards' && count>=1 && count<=4 || selected==='program-grid' && count>=2 && count<=6)return selected;
  if(model.days.length>=3 || model.rows.length>count+2)return 'program-days';
  return count===1?'program-hero':count===2?'program-duo':count===3?'program-grid':count===4?'program-cards':count<=6?'program-grid':'program-list';
}
module.exports={PROGRAM_LAYOUTS,selectFeaturedMovie,analyzeProgramMood,programLayout};
