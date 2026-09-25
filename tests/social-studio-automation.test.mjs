import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeCampaignRequest}=require('../backend/services/social-studio/automation/contract');
const {classify}=require('../backend/services/social-studio/automation/qa');
const {CampaignOrchestrator}=require('../backend/services/social-studio/automation/orchestrator');
const {SocialStudioAutomationRepository}=require('../backend/repositories/socialStudioAutomationRepository');

function memoryRepository() {
  const state={settings:{}};
  return new SocialStudioAutomationRepository({readJson:async()=>state,mutateJson:async callback=>callback(state)});
}
const waitFor=async(check,timeout=1500)=>{const started=Date.now();while(Date.now()-started<timeout){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('timeout');};
const normalized=input=>({...input,formatId:input.formatId || 'feed_portrait',templateId:input.templateId || 'movie-highlight',entities:{movie:{id:'m',title:'Filme',posterUrl:'poster://m',sessions:[]}},artDirection:{},copyLocks:{},copyTone:'automatic',copyDensity:'medium'});
const copy=()=>({provider:'rule-based',bundle:{headline:'Uma estreia na tela grande',kicker:'EM DESTAQUE',supportingText:'Uma nova história entra em cena.',cta:'VEJA AS SESSÕES',caption:'Uma estreia na tela grande.'},candidates:[{id:'copy-1',score:98,bundle:{headline:'Uma estreia na tela grande'}}]});
const variations=async draft=>({variations:[1,2,3].map(index=>({id:`v${index}`,name:`Composição ${index}`,draft:{...draft,layoutId:`layout-${index}`}})),notices:[]});
const render=async input=>({draft:normalized(input),format:{id:input.formatId,width:1080,height:input.formatId==='story'?1920:1350},quality:{accepted:true,total:92,issues:[]},buffer:Buffer.from('image'),extension:'.png',contentType:'image/png',rendererVersion:'v2'});
const accepted=rendered=>({accepted:true,score:rendered.quality.total,counts:{ERROR:0,WARNING:0,SUGGESTION:0},findings:[]});

function orchestrator(overrides={}) {
  const repository=memoryRepository();let preview=0;
  return {repository,service:new CampaignOrchestrator({repository,contextProvider:async()=>({brand:{id:'cinema-a',name:'Cinema A'},history:[]}),loadImage:async()=>null,savePreview:async()=>`/preview/${++preview}.png`,dependencies:{normalizeDraft:normalized,generateCopy:copy,generateVariations:variations,renderPost:render,evaluate:accepted,...overrides}})};
}

test('contrato adapta aliases e gera chave idempotente estável',()=>{
  const first=normalizeCampaignRequest({cinemaId:'cinema-a',campaignType:'schedule',objective:'Programação da semana',formats:['feed_4_5','story_9_16'],eventVersion:'42'});
  const second=normalizeCampaignRequest({eventVersion:'42',formats:['feed_4_5','story_9_16'],objective:'Programação da semana',campaignType:'schedule',cinemaId:'cinema-a'});
  assert.deepEqual(first.formats,['feed_portrait','story']);
  assert.equal(first.templateId,'sessions-week');
  assert.equal(first.idempotencyKey,second.idempotencyKey);
});

test('webhook duplicado reutiliza campanha e a fila produz Feed e Story para revisão',async()=>{
  const {service}=orchestrator();
  const input={cinemaId:'cinema-a',campaignType:'movie',objective:'Estreia do filme',formats:['feed_portrait','story'],movieId:'m',idempotencyKey:'event-42'};
  const first=await service.create(input,{createdBy:'n8n'}),duplicate=await service.create(input,{createdBy:'n8n'});
  assert.equal(duplicate.id,first.id);assert.equal(duplicate.duplicate,true);
  const ready=await waitFor(async()=>{const value=await service.get(first.id);return value.status==='ready'?value:null;});
  assert.equal(ready.result.compositions.length,6);
  assert.deepEqual(new Set(ready.result.compositions.map(item=>item.formatId)),new Set(['feed_portrait','story']));
  assert.equal(ready.qa.accepted,true);
});

test('retry muda a direção após falha e registra o motivo',async()=>{
  let calls=0;
  const {service}=orchestrator({generateVariations:async draft=>{calls++;if(calls===1)throw Object.assign(new Error('logo sobre título'),{code:'LAYOUT_COLLISION'});return variations(draft);}});
  const created=await service.create({campaignType:'movie',movieId:'m',idempotencyKey:'retry-1'});
  const ready=await waitFor(async()=>{const value=await service.get(created.id);return value.status==='ready'?value:null;});
  assert.equal(calls,2);
  assert.match(ready.result.retryHistory[0].reason,/logo sobre título/);
  assert.match(ready.result.retryHistory[0].action,/branding e safe areas/);
});

test('QA rejeitado termina com mensagem recuperável',async()=>{
  const rejected=()=>({accepted:false,score:42,counts:{ERROR:1,WARNING:0,SUGGESTION:0},findings:[{severity:'ERROR',code:'TEXT_OVERFLOW',message:'Há texto cortado.'}]});
  const {service}=orchestrator({evaluate:rejected});
  const created=await service.create({campaignType:'movie',movieId:'m',idempotencyKey:'qa-fail'});
  const failed=await waitFor(async()=>{const value=await service.get(created.id);return value.status==='failed'?value:null;});
  assert.equal(failed.error.code,'STUDIO_QA_REJECTED');
  assert.match(failed.error.message,/conflitos visuais/);
});

test('classificação diferencia bloqueio, aviso e sugestão',()=>{
  assert.equal(classify({code:'TEXT_OVERFLOW'}).severity,'ERROR');
  assert.equal(classify({code:'LOW_CONTRAST'}).severity,'WARNING');
  assert.equal(classify({code:'ASSET_MISSING'}).severity,'ERROR');
  assert.equal(classify({code:'PROGRAM_SMALL_POSTER'}).severity,'WARNING');
  assert.equal(classify({code:'BALANCE'}).severity,'SUGGESTION');
});

test('falta de pôster preserva a campanha e devolve aviso acionável',async()=>{
  const noPoster=input=>({...normalized(input),entities:{movie:{id:'m',title:'Filme',posterUrl:'',backdropUrl:'',sessions:[]}},imageUrl:''});
  const {service}=orchestrator({normalizeDraft:noPoster});
  const created=await service.create({campaignType:'movie',movieId:'m',idempotencyKey:'poster-missing'});
  const ready=await waitFor(async()=>{const value=await service.get(created.id);return value.status==='ready'?value:null;});
  assert.equal(ready.warnings.some(item=>item.code==='MISSING_POSTER'),true);
  assert.equal(ready.result.compositions.length,3);
});

test('programação usa o template do evento em Feed e Story',async()=>{
  const {service}=orchestrator();
  const created=await service.create({campaignType:'schedule',objective:'Programação da semana',formats:['feed_4_5','story_9_16'],subject:{programMovieIds:['m']},idempotencyKey:'schedule-42'});
  const ready=await waitFor(async()=>{const value=await service.get(created.id);return value.status==='ready'?value:null;});
  assert.deepEqual(new Set(ready.result.compositions.map(item=>item.formatId)),new Set(['feed_portrait','story']));
  assert.equal(ready.result.compositions.every(item=>item.draft.templateId==='sessions-week'),true);
});
