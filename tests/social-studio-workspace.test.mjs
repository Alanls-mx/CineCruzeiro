import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeWorkspace,LAYOUTS}=require('../backend/services/social-studio/contracts/workspace');
const {editableSnapshot,withCaption}=require('../backend/services/social-studio/scene/preview-edit');
test('programação descarta enquadramento de filme e preserva seleção, cores e horários',()=>{
  const draft=normalizeWorkspace({templateId:'sessions-week',layoutId:'movie-editorial-light',imageUrl:'/wrong.png',artDirection:{hero:{scale:2}},movieIds:['a','b'],programStyle:'vibrant',programLayout:'program-days'});
  assert.equal(draft.layoutId,undefined);assert.equal(draft.imageUrl,'');assert.deepEqual(draft.artDirection,{});
  assert.deepEqual(draft.movieIds,['a','b']);assert.equal(draft.programStyle,'vibrant');assert.equal(draft.programLayout,'program-days');
});
test('criação oferece famílias restritas por categoria sem apagar contratos antigos',()=>{
  assert.ok(Object.values(LAYOUTS).every(layouts=>layouts.length<=3));
  assert.equal(normalizeWorkspace({workspaceVersion:2,templateId:'movie-highlight',layoutId:'ticket-burst'}).layoutId,undefined);
  assert.equal(normalizeWorkspace({workspaceVersion:2,templateId:'concession-combo',layoutId:'movie-spotlight'}).layoutId,undefined);
  assert.equal(normalizeWorkspace({templateId:'movie-highlight',layoutId:'poster-editorial'}).layoutId,'poster-editorial');
  const engine=require('../backend/services/socialStudioEngineService');
  assert.ok(!engine.SOCIAL_TEMPLATES.some(template=>template.id==='club-plan'));
  assert.equal(require('../backend/services/social-studio/templates/registry').templateById('club-plan').id,'club-plan');
});
test('edição da prévia conserva fatos e formato do snapshot autorizado',()=>{
  const original={scene:{templateId:'sessions-week',formatId:'square',width:1080,height:1080,sourceDraft:{programSessionCount:3}}};
  const edited=editableSnapshot(original,{elements:[{id:'title',x:20}],width:2,sourceDraft:{programSessionCount:0},templateId:'online-ticket'});
  assert.equal(edited.templateId,'sessions-week');assert.equal(edited.width,1080);assert.equal(edited.sourceDraft.programSessionCount,3);assert.equal(edited.elements[0].x,20);
  assert.throws(()=>editableSnapshot(original,{elements:Array(81).fill({})}),/inválida/);
});

test('salvar snapshot aceita legenda atual sem modificar a arte ou snapshot compartilhado',()=>{
  const original={buffer:Buffer.from('image'),scene:{id:'scene'},draft:{title:'Título',caption:'Legenda anterior'}};
  const current=withCaption(original,' Legenda revisada ');
  assert.equal(current.draft.caption,'Legenda revisada');
  assert.equal(original.draft.caption,'Legenda anterior');
  assert.equal(current.buffer,original.buffer);assert.equal(current.scene,original.scene);
  assert.equal(withCaption(original,'x'.repeat(1900)).draft.caption.length,1800);
});
