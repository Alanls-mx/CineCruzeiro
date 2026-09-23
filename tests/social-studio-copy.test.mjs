import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {generateCopy}=require('../backend/services/social-studio/copy-engine');
const {normalizeV2Draft}=require('../backend/services/social-studio/engine/normalizer');
const ctx={now:'2026-09-22T10:00:00-03:00',brand:{name:'Cinema Teste',website:'https://cinema.example'},movies:[{id:'m',title:'Filme Exemplo',genre:'Terror',releaseDate:'2026-09-24',sessions:[{date:'2026-09-22',time:'19:00',price:20}]}],concessions:[{id:'c',name:'Água',price:6,description:'Água mineral'}],clubPlans:[{id:'p',name:'Clube',monthlyPrice:30,benefits:['Um ingresso por mês']}]};
test('dez campanhas e seis gêneros geram candidatos factuais e pontuados',()=>{
  for(const type of ['movie-premiere','movie-presale','movie-highlight','movie-price','online-ticket','sessions-today','sessions-week','multi-movies','concession-combo','club-plan']) {
    const draft=normalizeV2Draft({templateId:type},ctx);
    const result=generateCopy(draft,ctx,{density:'short'});
    assert.equal(result.candidates.length,8);
    assert.ok(result.candidates.every(x=>x.score>=0 && x.score<=100));
    assert.ok(result.bundle.caption.includes('cinema.example'));
    if(type==='concession-combo') assert.doesNotMatch(result.bundle.supportingText,/pipoca/i);
    if(type==='club-plan') assert.match(result.bundle.supportingText,/Um ingresso por mês/);
    assert.ok(new Set(result.candidates.map(candidate=>candidate.bundle.caption)).size>=6,`${type}: legendas distintas`);
  }
  for(const genre of ['Terror','Animação','Ação','Romance','Drama','Comédia']) {
    const context={...ctx,movies:[{...ctx.movies[0],genre}]};
    assert.ok(generateCopy(normalizeV2Draft({templateId:'movie-highlight'},context),context).bundle.supportingText);
  }
});
test('compra indisponível não gera promessa e campos travados não mudam',()=>{
  const context={...ctx,movies:[{...ctx.movies[0],sessions:[]}]};
  const draft=normalizeV2Draft({templateId:'movie-highlight',title:'Meu título'},context);
  const result=generateCopy(draft,context,{locks:{headline:true}});
  assert.equal(result.bundle.headline,'Meu título');
  assert.doesNotMatch(result.bundle.cta,/compre|garanta|reserve/i);
});
test('histórico recente penaliza frases e sugestões respeitam tom/densidade',()=>{
  const draft=normalizeV2Draft({templateId:'movie-highlight'},ctx);
  const first=generateCopy(draft,ctx,{tone:'direct'});
  const repeated=first.candidates[0].bundle;
  const second=generateCopy(draft,{...ctx,history:[{payload:{subtitle:repeated.kicker,cta:repeated.cta}}]},{tone:'direct'});
  assert.notEqual(second.bundle.kicker,first.bundle.kicker);
  assert.match(second.bundle.supportingText,/sess[ãõ](?:o|es)|programação|detalhes|cinema/i);
});
test('referências confirmadas do operador entram nas sugestões',()=>{
  const draft=normalizeV2Draft({templateId:'movie-highlight',copyBrief:'Elenco liderado por Ana Lima\nBaseado em uma peça teatral'},ctx);
  const result=generateCopy(draft,ctx,{density:'medium'});
  assert.ok(result.candidates.some(x=>x.bundle.caption.includes('Ana Lima')));
  assert.ok(result.candidates.some(x=>x.bundle.caption.includes('peça teatral')));
});
test('pré-venda futura não convida à compra antecipada',()=>{
  const draft=normalizeV2Draft({templateId:'movie-presale',presaleStartDate:'2026-09-25'},ctx);
  const result=generateCopy(draft,ctx);
  assert.ok(result.candidates.every(x=>!/compre|garanta/i.test(x.bundle.cta)));
});
test('copy usa referências do filme sem copiar a sinopse e separa ângulos editoriais',()=>{
  const synopsis='Uma amizade inesperada reúne duas famílias durante uma viagem cheia de mistérios.';
  const context={...ctx,movies:[{...ctx.movies[0],synopsis,director:'Ana Silva',duration:'2h 10m',rating:'12',genre:['Aventura','Drama'],socialHook:'Uma viagem que aproxima pessoas improváveis.'}]};
  const draft=normalizeV2Draft({templateId:'movie-highlight'},context);
  const result=generateCopy(draft,context,{density:'long'});
  assert.ok(result.candidates.some(x=>x.bundle.caption.includes('Ana Silva')));
  assert.ok(result.candidates.some(x=>x.bundle.caption.includes('amizade')));
  assert.ok(result.candidates.some(x=>x.bundle.caption.includes('2h 10m')));
  assert.ok(result.candidates.every(x=>!x.bundle.caption.includes(synopsis)));
  assert.ok(new Set(result.candidates.map(x=>x.bundle.supportingText)).size>=5);
});
