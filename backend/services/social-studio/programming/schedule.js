const {dayLabel,timeLabel}=require('../contracts/artwork-layout');
const compare=(a,b)=>a.date.localeCompare(b.date) || a.times[0].localeCompare(b.times[0]) || a.title.localeCompare(b.title,'pt-BR');
function programData(movies=[]) {
  const groups=new Map();
  for(const movie of movies)for(const day of movie.schedule?.days || []) {
    const key=`${day.date}:${movie.id}`;
    if(!groups.has(key))groups.set(key,{movieId:movie.id,title:movie.title,date:day.date,times:new Set()});
    for(const time of day.times)groups.get(key).times.add(time);
  }
  const rows=[...groups.values()].map(row=>({...row,times:[...row.times].sort()})).sort(compare);
  const days=[...new Set(rows.map(r=>r.date))].map(date=>({date,rows:rows.filter(r=>r.date===date)}));
  const sortedMovies=[...movies].sort((a,b)=>{
    const ra=rows.find(r=>r.movieId===a.id),rb=rows.find(r=>r.movieId===b.id);
    return ra && rb?compare(ra,rb):ra?-1:rb?1:a.title.localeCompare(b.title,'pt-BR');
  });
  return {rows,days,movies:sortedMovies,count:rows.reduce((n,r)=>n+r.times.length,0)};
}
function programTitle(model,today,cinema,templateId) {
  const dates=model.days.map(d=>d.date),start=dates[0],end=dates.at(-1);
  if(!start)return 'PROGRAMAÇÃO';
  if(dates.length===1)return start===today && templateId==='sessions-today'?`HOJE NO ${cinema}`.toUpperCase():`PROGRAMAÇÃO • ${start.slice(8)}/${start.slice(5,7)}`;
  const range=start.slice(0,7)===end.slice(0,7)?`${start.slice(8)} A ${end.slice(8)}/${end.slice(5,7)}`:`${start.slice(8)}/${start.slice(5,7)} A ${end.slice(8)}/${end.slice(5,7)}`;
  const span=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  return `${span===7?'PROGRAMAÇÃO DA SEMANA':'PROGRAMAÇÃO'} • ${range}`;
}
const rowLabel=row=>`${dayLabel(row.date)}\n${row.times.map(timeLabel).join(' • ')}`;
module.exports={programData,programTitle,rowLabel,compare};
