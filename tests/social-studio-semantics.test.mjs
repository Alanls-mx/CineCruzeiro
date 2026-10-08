import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {normalizeV2Draft}=require('../backend/services/social-studio/engine/normalizer');
const {renderSocialPostV2}=require('../backend/services/social-studio/engine/renderer');
const {normalizeDesign}=require('../backend/services/social-studio/contracts/campaign');
const {groupCampaignScene,flattenElements}=require('../backend/services/social-studio/scene/groups');
const context={now:'2026-09-22T12:00:00-03:00',brand:{website:'https://cinema.example'},movies:[{id:'film',title:'Filme',releaseDate:'2026-09-24',sessions:[{date:'2026-09-24',time:'22:05',price:20}]}]};
test('contratos separam estilo, layout e look e migram style legado',()=>{
  assert.deepEqual(normalizeDesign({style:'hero-right'}),{visualStyle:'cinematic',layoutId:'hero-right',look:'cinematic',designVersion:1});
  assert.equal(normalizeDesign({style:'impact',look:'natural'}).visualStyle,'impact');
  assert.equal(normalizeDesign({style:'impact',layoutId:'editorial'}).layoutId,'editorial');
});
test('validação semântica bloqueia dados incorretos antes de carregar imagens',async()=>{
  for(const [input,ctx,code] of [
    [{templateId:'sessions-today',periodStart:'2026-09-22'},context,'NO_SESSIONS'],
    [{templateId:'movie-highlight',subtitle:'HOJE NO CINEMA'},context,'TODAY_MISMATCH'],
    [{templateId:'online-ticket',actionDestination:''},context,'ACTION_DESTINATION_REQUIRED'],
    [{templateId:'multi-movies',movieIds:[]},context,'SELECT_MOVIES'],
    [{templateId:'movie-price'}, {...context,movies:[{...context.movies[0],sessions:[]}]},'PRICE_REQUIRED'],
    [{templateId:'movie-presale'}, {...context,movies:[{...context.movies[0],sessions:[]}]},'PRESALE_UNCONFIRMED'],
  ]) {
    let loads=0;
    await assert.rejects(renderSocialPostV2(input,ctx,{loadImage:async()=>{loads++;}}),e=>e.validation.errors.some(x=>x.code===code));
    assert.equal(loads,0);
  }
});
test('datas de estreia e pré-venda permanecem independentes',()=>{
  const draft=normalizeV2Draft({templateId:'movie-presale',presaleStartDate:'2026-09-23',primaryDateKind:'presale',date:'23 DE SETEMBRO',subtitle:'PRÉ-VENDA A PARTIR DE',cta:'ACOMPANHE AS NOVIDADES'},context);
  assert.equal(draft.content.releaseDate,'2026-09-24');
  assert.equal(draft.content.presaleStartDate,'2026-09-23');
  assert.equal(draft.content.sessionDate,'2026-09-24');
  assert.equal(draft.semanticValidation.valid,true);
  assert.equal(draft.content.primaryDateLabel,'PRÉ-VENDA A PARTIR DE');
});
test('ActionGroup conserva coordenadas absolutas e permite movimento conjunto',()=>{
  const scene={sourceDraft:{},elements:[{id:'cta',type:'text',x:50,y:70,width:400,height:50},{id:'website',type:'text',x:50,y:130,width:400,height:30}]};
  groupCampaignScene(scene);
  assert.equal(scene.elements[0].type,'group');
  assert.equal(flattenElements(scene.elements)[1].y,130);
  scene.elements[0].x+=20;
  assert.equal(flattenElements(scene.elements)[1].x,70);
});
