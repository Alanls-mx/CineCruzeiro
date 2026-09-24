import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const {sessionSchedule}=require('../backend/services/social-studio/engine/content-rules');
const engine=require('../backend/services/socialStudioEngineService');
const {animationPlan}=require('../backend/services/social-studio/composition-engine/animation');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const context={now:'2026-09-22T12:00:00-03:00',brand:{name:'Cine Cruzeiro',posterWebsite:'www.cinecruzeiro.com.br',logoUrl:'asset://logo'},movies:Array.from({length:6},(_,i)=>({id:`m${i}`,title:`Filme ${i+1}`,genre:'Animação',posterUrl:`asset://poster${i}`,releaseDate:'2026-09-24',sessions:[{date:'2026-09-22',time:'10:00'},{date:'2026-09-22',time:'14:00'},{date:'2026-09-22',time:'16:30'},{date:'2026-09-23',time:'19:00'},{date:'2026-09-23',time:'20:00',status:'cancelled'}]}))};
const poster=await sharp({create:{width:240,height:360,channels:3,background:'#376077'}}).png().toBuffer();
const loadImage=async()=>poster;
test('programação respeita período, fuso, cancelamento, ordem e deduplicação',()=>{
  const today=sessionSchedule(context.movies[0],{scheduleMode:'today'},context.now);
  assert.equal(today.count,2);assert.equal(today.text,'TER • 22/09 • 14H00 / 16H30');assert.doesNotMatch(today.text,/10H00|19H00|20H00|Hoje/);
  const week=sessionSchedule(context.movies[0],{scheduleMode:'week'},context.now);
  assert.equal(week.count,3);assert.match(week.text,/23\/09/);
  assert.doesNotThrow(()=>sessionSchedule(context.movies[0],{periodStart:'2026-99-99'},context.now));
});
test('chamada de hoje oferece a próxima sessão real e corrige o rascunho',()=>{
  const future={...context,movies:context.movies.map(movie=>({...movie,sessions:[{date:'2026-09-22',time:'10:00'},{date:'2026-09-23',time:'19:00',status:'cancelled'},{date:'2026-09-24',time:'20:00'}]}))};
  const input={templateId:'movie-highlight',movieId:'m0',title:'FILME DE HOJE',subtitle:'HOJE NO CINEMA',auxiliaryText:'Sessão de hoje',cta:'VENHA HOJE'};
  const notice=engine.draftNotices(input,future).find(item=>item.code==='TODAY_MISMATCH');
  assert.equal(notice.correction.label,'Usar sessão de 24/09 às 20:00');
  assert.equal(notice.correction.patch.subtitle,'SESSÕES EM 24/09');
  assert.equal(notice.correction.patch.primaryDateKind,'session');
  assert.equal(notice.correction.patch.sessionDate,'2026-09-24');
  assert.equal(notice.correction.patch.periodStart,'2026-09-24');
  const corrected=engine.normalizeDraft({...input,...notice.correction.patch},future);
  assert.equal(corrected.semanticValidation.errors.some(error=>error.code==='TODAY_MISMATCH'),false);
  assert.equal(corrected.content.primaryDate,'24 DE SETEMBRO');
});
test('a programação calcula a chamada real e bloqueia um período sem sessões',()=>{
  const future={...context,movies:context.movies.map(movie=>({...movie,sessions:[{date:'2026-09-22',time:'10:00'},{date:'2026-09-24',time:'19:00',status:'cancelled'},{date:'2026-09-25',time:'20:00'}]}))};
  const input={templateId:'sessions-today',movieId:'m0',title:'HOJE NO CINEMA',subtitle:'HOJE NO CINEMA'};
  const corrected=engine.normalizeDraft(input,future);
  assert.equal(corrected.semanticValidation.valid,true);
  assert.equal(corrected.schedule.days[0].date,'2026-09-25');
  assert.equal(corrected.title,'PROGRAMAÇÃO • 25/09');
  const empty={...future,movies:future.movies.map(movie=>({...movie,sessions:[]}))};
  for(const templateId of ['sessions-today','sessions-week'])assert.ok(engine.draftNotices({...input,templateId},empty).some(n=>n.code==='NO_SESSIONS'));
});
test('nova campanha de sessões escolhe a próxima data disponível',()=>{
  const future={...context,movies:context.movies.map(movie=>({...movie,sessions:[{date:'2026-09-22',time:'10:00'},{date:'2026-09-25',time:'20:00'}]}))};
  const draft=engine.normalizeDraft({templateId:'sessions-today',movieId:'m0'},future);
  assert.equal(draft.periodStart,'2026-09-25');
  assert.equal(draft.schedule.days[0].date,'2026-09-25');
  assert.equal(draft.semanticValidation.valid,true);
});
test('sessão de hoje disponível não gera falso alerta fora do filtro da arte',()=>{
  const input={templateId:'movie-highlight',movieId:'m0',periodStart:'2026-09-23',scheduleMode:'today',subtitle:'HOJE NO CINEMA'};
  const draft=engine.normalizeDraft(input,context);
  assert.equal(draft.semanticValidation.errors.some(error=>error.code==='TODAY_MISMATCH'),false);
});
test('estreia e CTA têm pares próximos; horário real não é omitido',async()=>{
  const rendered=await engine.renderSocialPost({movieId:'m0',templateId:'movie-premiere',style:'hero-left',cta:'ACESSE O SITE'},context,{loadImage});
  const e=id=>flattenElements(rendered.scene.elements).find(item=>item.id===id);
  assert.ok(Math.abs(e('detail').y-e('subtitle').y-e('subtitle').height)<15);
  assert.ok(Math.abs(e('website').y-e('cta').y-e('cta').height)<15);
  assert.equal(e('website').text.replace(/\s/g,''),'www.cinecruzeiro.com.br');
  const schedule=await engine.renderSocialPost({movieId:'m0',templateId:'sessions-week'},context,{loadImage});
  assert.ok(flattenElements(schedule.scene.elements).some(item=>/14H00/.test(item.text || '')));
});
test('multi-filmes normaliza seleção, ordem e histórico; não usa filmes editoriais',async()=>{
  const input={templateId:'multi-movies',movieIds:['m2','m0','m2','missing'],animation:{enabled:true,format:'webm',duration:5}};
  const draft=engine.normalizeDraft(input,context);
  assert.deepEqual(draft.movieIds,['m2','m0']);
  assert.equal(draft.programMovies[0].title,'Filme 1');
  const rendered=await engine.renderSocialPost(input,context,{loadImage});
  const record=engine.createHistoryRecord(rendered,{},context);
  assert.deepEqual(record.payload.movieIds,['m2','m0']);
  assert.equal(record.payload.animation.format,'webm');
});
test('grade de 2, 3, 4 e 6 filmes cabe nos três formatos',async()=>{
  for(const count of [2,3,4,6]) for(const formatId of ['square','feed_portrait','story']) {
    const render=await engine.renderSocialPost({templateId:'multi-movies',movieIds:context.movies.slice(0,count).map(m=>m.id),formatId},context,{loadImage});
    assert.equal(flattenElements(render.scene.elements).filter(item=>item.id.startsWith('movie-title-')).length,count);
    assert.equal(render.scene.sourceDraft.programSessionCount,count*3);
    for(const item of render.scene.elements) {assert.ok(item.x>=0 && item.y>=0);assert.ok(item.x+item.width<=render.scene.width+1);assert.ok(item.y+item.height<=render.scene.height+1);}
    const overlaps=render.quality.issues.filter(issue=>['TEXT_OVERLAP','TEXT_OVERFLOW'].includes(issue.code));
    assert.deepEqual(overlaps,[],`${count}/${formatId}`);
  }
});
test('animação limita formatos, duração e garante intervalo de leitura',()=>{
  const plan=animationPlan({elements:[{type:'text',text:'Palavra '.repeat(42)}]}, {duration:5,format:'exe',preset:'bounce'});
  assert.equal(plan.format,'mp4');assert.equal(plan.preset,'cinematic-reveal');assert.ok(plan.duration-plan.readableFrom>=12);
});
test('dados obrigatórios impedem exportação incoerente',()=>{
  const {assertContentReady}=require('../backend/services/social-studio/engine/content-rules');
  assert.throws(()=>assertContentReady(engine.normalizeDraft({templateId:'multi-movies',movieIds:[]},context)),/Selecione/);
  assert.throws(()=>assertContentReady(engine.normalizeDraft({templateId:'online-ticket'}, {...context,brand:{name:'Cinema'}})),/site oficial/);
  assert.throws(()=>assertContentReady(engine.normalizeDraft({templateId:'movie-premiere',date:''},context)),/data/);
});
