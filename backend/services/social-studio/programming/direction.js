const PROGRAM_LAYOUTS = {
  'sessions-today':['timeline','hero-schedule','poster-list','cinema-board','editorial-schedule'],
  'sessions-week':['day-cards','week-timeline','poster-calendar','featured-days','editorial-week'],
  'multi-movies':['featured','cinematic-grid','layered','mosaic','film-strip','panorama','split-heroes','collage','lineup'],
};
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
  const layouts=PROGRAM_LAYOUTS[draft.templateId] || [];
  const requested=draft.programLayout || draft.multiLayout;
  const aliases={grid:'cinematic-grid',editorial:'mosaic',summary:'lineup','poster-footer':'film-strip'};
  if(layouts.includes(requested)) return requested;
  if(aliases[requested] && draft.programLayout!=='automatic') return aliases[requested];
  if(draft.templateId==='multi-movies') return count===2?'split-heroes':count<=4?'featured':'mosaic';
  return draft.templateId==='sessions-today'?'hero-schedule':'poster-calendar';
}
module.exports={PROGRAM_LAYOUTS,selectFeaturedMovie,analyzeProgramMood,programLayout};
