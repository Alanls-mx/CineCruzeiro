import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=require('../backend/services/socialStudioEngineService');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const {formatCampaignSession,ticketCampaignConcept,validateLayoutCollisions}=require('../backend/services/social-studio/contracts/ticket-campaign');
const context={now:'2026-09-23T12:00:00-03:00',brand:{name:'Cine Cruzeiro',website:'https://cinecruzeiro.com.br',logoUrl:'missing://logo'},movies:[{id:'m',title:'Filme de teste',posterUrl:'missing://poster',sessions:[{id:'s',date:'2026-09-24',time:'19:00',availableForPurchase:true,ticketTypes:[{id:'half',name:'Meia',price:12},{id:'full',name:'Inteira',price:24}]}]}],concessions:[],clubPlans:[]};
const base={templateId:'ticket-offer',movieId:'',priceSelection:{mode:'half'},offerTerms:'Meia • Válido nas sessões participantes.'};

test('conceito semanal e meia para todos dependem de confirmações explícitas',()=>{
  const normal=engine.normalizeDraft(base,context);
  assert.equal(ticketCampaignConcept(normal).allHalf,false);
  assert.equal(normal.entities.movie,null);
  const confirmed=engine.normalizeDraft({...base,ticketCampaignMode:'promotional',campaignAudience:'all',campaignRecurrence:'weekly',campaignDays:'segunda, terça'},context);
  assert.equal(confirmed.semanticValidation.valid,true);
  assert.equal(confirmed.campaignConcept.headline,'TODO MUNDO PAGA MEIA');
  assert.equal(confirmed.campaignConcept.eyebrow,'TODA SEGUNDA E TERÇA');
  for(const change of [{offerTerms:''},{ticketCampaignMode:'standard'},{campaignDays:'segunda, feriado'}]) {
    assert.equal(engine.normalizeDraft({...confirmed,...change},context).semanticValidation.valid,false);
  }
});

test('data de campanha valida calendário e horário sem vazar ISO',()=>{
  assert.equal(formatCampaignSession({date:'2026-09-24',time:'19:00'}),'24 DE SETEMBRO • 19H');
  assert.equal(formatCampaignSession({date:'2026-09-24',time:'19:30'},true),'24/09 • 19:30');
  assert.equal(formatCampaignSession({date:'2026-02-30',time:'19:00'}),'');
  assert.equal(formatCampaignSession({date:'2026-09-24',time:'99:99'}),'24 DE SETEMBRO');
});

test('matriz comercial não exporta placeholders, repetição ou elementos fora da área',async()=>{
  const families=['price-impact','campaign-led','offer-counter','ticket-burst','promo-editorial','cinema-pop'];
  const signatures=new Set();
  for(const layoutId of families) for(const formatId of ['square','feed_portrait','story']) {
    const result=await engine.renderSocialPost({...base,layoutId,style:layoutId,automaticStyle:false,formatId},context,{loadImage:async()=>null,skipRaster:true});
    const elements=flattenElements(result.scene.elements);
    assert.equal(validateLayoutCollisions(result.scene).valid,true,`${layoutId}/${formatId}`);
    assert.equal(elements.some(e=>e.type==='image'),false);
    assert.equal(elements.filter(e=>e.type==='text' && /meia/i.test(e.text)).length,1);
    assert.ok(result.scene.elements.find(e=>e.id==='price-hero'));
    assert.ok(result.scene.elements.find(e=>e.id==='action-group')?.children.some(e=>e.id==='website'));
    if(formatId==='square') signatures.add(JSON.stringify(elements.map(e=>[e.id,e.x,e.y,e.fill])));
  }
  assert.equal(signatures.size,6);
});

test('falha ao carregar arte redistribui título e remove reserva de assinatura',async()=>{
  const result=await engine.renderSocialPost({...base,movieId:'m'},context,{loadImage:async()=>{throw new Error('404');},skipRaster:true});
  const elements=flattenElements(result.scene.elements);
  assert.equal(elements.some(e=>['artwork','artwork-mat','logo'].includes(e.id)),false);
  assert.equal(elements.find(e=>e.id==='title').width,result.scene.width*.87);
  assert.equal(elements.find(e=>e.id==='cta').width,result.scene.width*.87);
});

test('exportação manual bloqueia colisão e texto fora da área segura',async()=>{
  const result=await engine.renderSocialPost(base,context,{loadImage:async()=>null,skipRaster:true});
  const scene=structuredClone(result.scene);
  const action=scene.elements.find(e=>e.id==='action-group');
  action.y=scene.elements.find(e=>e.id==='title').y;
  assert.equal(validateLayoutCollisions(scene).valid,false);
  await assert.rejects(require('../backend/services/social-studio/scene/renderer').renderSocialScene(scene),{code:'TICKET_LAYOUT_COLLISION'});
});

test('campanha geral recusa sessão cancelada e preços inexistentes',()=>{
  const unavailable=structuredClone(context);unavailable.movies[0].sessions[0].status='cancelled';
  const draft=engine.normalizeDraft(base,unavailable);
  assert.equal(draft.semanticValidation.valid,false);
  assert.equal(draft.content.purchaseAvailable,false);
});

test('prévia incompleta continua visível sem inventar preço',async()=>{
  const unavailable=structuredClone(context);unavailable.movies[0].sessions=[];
  const result=await engine.renderSocialPost({...base,movieId:'m'},unavailable,{loadImage:async()=>null,skipRaster:true,allowIncompleteTicket:true});
  const elements=flattenElements(result.scene.elements);
  assert.equal(elements.some(element=>element.id==='price-hero'),false);
  assert.equal(elements.find(element=>element.id==='price-draft')?.text,'CONSULTE OS VALORES');
  assert.equal(result.draft.semanticValidation.valid,false);
});

test('gerar variações explora famílias comerciais reais',async()=>{
  const result=await require('../backend/services/social-studio/composition-engine/variations').generateVariations(base,context,{loadImage:async()=>null});
  assert.equal(result.variations.length,4);
  assert.equal(new Set(result.variations.map(v=>v.styleId)).size,4);
  assert.ok(result.variations.every(v=>v.draft.templateId==='ticket-offer' && v.image.startsWith('data:image/jpeg')));
});

test('textos longos usam recomposição e mantêm todo o conteúdo legível',async()=>{
  const terms='Válido nas sessões participantes. Apresente documento para meia-entrada. Não cumulativo com outras promoções. Consulte horários e disponibilidade antes da compra. Oferta sujeita à capacidade da sala. Valores válidos para o período informado e para os ingressos selecionados.';
  for(const formatId of ['square','story','feed_portrait']) {
    const result=await engine.renderSocialPost({...base,formatId,offerHeadline:'ENCONTRE SEU PRÓXIMO FILME E APROVEITE GRANDES HISTÓRIAS NO CINEMA',offerTerms:terms,cta:'ESCOLHA SUA SESSÃO E GARANTA SEU INGRESSO NO SITE'},context,{loadImage:async()=>null,skipRaster:true});
    const text=flattenElements(result.scene.elements).find(e=>e.id==='description').text.replace(/\s+/g,' ');
    assert.equal(text,terms);
    assert.equal(validateLayoutCollisions(result.scene).valid,true);
  }
});
