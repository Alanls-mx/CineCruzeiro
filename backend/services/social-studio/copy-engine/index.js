const TONES = ['automatic','cinematic','commercial','fun','elegant','direct'];
const CAMPAIGNS = {
  'movie-premiere':['PREPARE-SE PARA A ESTREIA','UMA NOVA HISTÓRIA NA TELA GRANDE','A PRÓXIMA ESTREIA','MARQUE ESTA DATA','O CINEMA TEM UM NOVO ENCONTRO','ESTREIA NO CINEMA'],
  'movie-presale':['A CONTAGEM REGRESSIVA COMEÇOU','ANTES DA PRIMEIRA SESSÃO','PREPARE-SE PARA A ESTREIA','O PRÓXIMO ENCONTRO JÁ TEM DATA','SEU PRÓXIMO FILME','UMA ESTREIA PARA ACOMPANHAR'],
  'movie-highlight':['NA TELA GRANDE','SEU PRÓXIMO FILME','UMA HISTÓRIA PARA VER NO CINEMA','O FILME DA SUA VEZ','CINEMA NO SEU RITMO','EM DESTAQUE'],
  'movie-price':['INGRESSOS A PARTIR DE','ESCOLHA SUA SESSÃO','SEU PRÓXIMO INGRESSO','CINEMA NA SUA AGENDA','O VALOR DA SUA SESSÃO','ENCONTRE SEU HORÁRIO'],
  'sessions-today':['HOJE TEM CINEMA','ESCOLHA SUA SESSÃO DE HOJE','SEU FILME É HOJE','A PROGRAMAÇÃO DE HOJE','HOJE NA TELA GRANDE','O CINEMA TE ESPERA HOJE'],
  'sessions-week':['PROGRAME SUA SEMANA','SUA SEMANA PEDE CINEMA','ESCOLHA O DIA E O FILME','SETE DIAS DE CINEMA','RESERVE UM TEMPO PARA O CINEMA','SUA PRÓXIMA SESSÃO'],
  'multi-movies':['ESCOLHA SUA PRÓXIMA HISTÓRIA','FILMES PARA A SUA AGENDA','A TELA GRANDE TEM MAIS HISTÓRIAS','PROGRAME SEU CINEMA','UM ENCONTRO COM O CINEMA','CONHEÇA A PROGRAMAÇÃO'],
  'online-ticket':['BILHETERIA DIGITAL','SEU INGRESSO ONLINE','ESCOLHA O FILME E A SESSÃO','SEU CINEMA EM POUCOS PASSOS','PROGRAME SUA IDA AO CINEMA','O CINEMA COMEÇA NA SUA ESCOLHA'],
  'concession-combo':['COMPLETE SUA SESSÃO','UMA PAUSA NA BOMBONIERE','ESCOLHA SEU ACOMPANHAMENTO','ANTES DO FILME','SABOR PARA O SEU CINEMA','O COMPLEMENTO DA SUA SESSÃO'],
  'club-plan':['CONHEÇA O CLUBE','SEU CINEMA COM BENEFÍCIOS','CINEMA NA SUA ROTINA','SEU PLANO PARA MAIS CINEMA','DESCUBRA OS BENEFÍCIOS','FAÇA PARTE DO CLUBE'],
};
const GENRES = {
  horror:['Apague as luzes. A história vai começar.','Há histórias que pedem uma sala escura.','O suspense ganha a tela grande.'],
  family:['Junte a turma para uma sessão.','Uma aventura para compartilhar.','O próximo passeio tem cinema.'],
  action:['Ação em ritmo de cinema.','Entre no ritmo da tela grande.','Sua próxima sessão pede ação.'],
  romance:['Uma história para sentir de perto.','Um encontro com a tela grande.','Reserve um tempo para essa história.'],
  comedy:['Uma sessão para mudar o clima do dia.','Chame a companhia da próxima risada.','Seu próximo encontro pode ser no cinema.'],
  drama:['Há histórias que ficam com a gente.','Dê tempo a uma nova história.','Um novo olhar na tela grande.'],
  cinema:['Veja essa história na tela grande.','Escolha seu próximo encontro com o cinema.','O cinema espera pela sua próxima escolha.'],
};
const TONE_LINES = {
  cinematic:['Uma história ganha outra dimensão na tela grande.','Luzes baixas, tela acesa: a história começa aqui.','Uma experiência para acompanhar do primeiro ao último minuto.'],
  commercial:['Consulte os horários e escolha sua sessão.','Encontre uma sessão que combine com sua agenda.','Veja a programação e escolha como viver esta história.'],
  fun:['Chame a turma para o cinema.','A próxima boa história merece companhia.','Escolha a sessão e aproveite o passeio.'],
  elegant:['Um momento para viver o cinema.','Uma história para apreciar na tela grande.','Reserve um tempo para uma nova experiência.'],
  direct:['Consulte a programação.','Confira as sessões disponíveis.','Veja os detalhes antes de escolher sua sessão.']
};
const CONCESSION_LINES = ['Escolha esta opção na bomboniere.','Um acompanhamento para a sua sessão.','Confira os detalhes do produto antes do filme.','Mais uma opção para completar o passeio.'];
const CLUB_LINES = ['Conheça os benefícios deste plano.','Veja o que está incluído antes de escolher.','Compare os benefícios e escolha seu plano.','Confira as condições do clube no site.'];
const FIELD_MAP={headline:'title',kicker:'subtitle',supportingText:'auxiliaryText',cta:'cta',caption:'caption'};
function excerpt(value, limit) {
  const text=String(value || '').replace(/\s+/g,' ').trim();
  if(text.length<=limit) return text;
  return `${text.slice(0,limit).replace(/\s+\S*$/,'').trim()}…`;
}

function copyContext(draft, context) {
  return {...draft.content,cinemaName:context.brand?.name || 'Cinema',genre:draft.genreProfile?.id || 'cinema',concession:draft.entities.concession,clubPlan:draft.entities.clubPlan,history:context.history || [],schedule:draft.schedule};
}
function scoreCopy(bundle, context, options = {}) {
  const limits=options.density==='short'?{headline:60,kicker:32,supportingText:80,cta:30}:{headline:110,kicker:65,supportingText:180,cta:55};
  let score=100;
  for(const [field,max] of Object.entries(limits)) if(bundle[field].length>max) score-=Math.min(30,(bundle[field].length-max)*.8);
  const recent=context.history.slice(0,20).map(item=>item.payload || item);
  for(const [field,legacy] of Object.entries(FIELD_MAP)) {
    if(recent.some(item=>String(item[legacy] || '').toLowerCase()===bundle[field].toLowerCase())) score-=field==='headline'?16:8;
    if(options.current && String(options.current[legacy] || '')===bundle[field]) score-=12;
  }
  if(!context.purchaseAvailable && /compre agora|garanta seu ingresso/i.test(bundle.cta)) score=0;
  if(/\bhoje\b/i.test(bundle.kicker) && !context.sessions.some(s=>s.date===context.today)) score=0;
  return Math.max(0,Math.round(score));
}
class RuleBasedCopyProvider {
  generate(context, options={}) {
    const type=context.campaignType, pool=CAMPAIGNS[type] || CAMPAIGNS['movie-highlight'];
    const tone=TONES.includes(options.tone)?options.tone:'automatic';
    const density=['short','medium','long'].includes(options.density)?options.density:'medium';
    const ctas=type==='club-plan'?['CONHEÇA O CLUBE','VEJA OS BENEFÍCIOS','CONSULTE OS PLANOS']:type==='concession-combo'?['CONHEÇA A BOMBONIERE','VEJA AS OPÇÕES','COMPLETE SUA SESSÃO']:context.purchaseAvailable?['ESCOLHA SUA SESSÃO','VEJA OS HORÁRIOS','COMPRE SEU INGRESSO','CONFIRA AS SESSÕES']:['CONHEÇA A HISTÓRIA','DESCUBRA O FILME','SAIBA MAIS SOBRE O LANÇAMENTO','VEJA O QUE VEM POR AÍ'];
    const genreLines=GENRES[context.genre] || GENRES.cinema;
    const subject=type==='concession-combo'?context.concession?.name:type==='club-plan'?context.clubPlan?.name:context.movie?.title;
    const candidates=Array.from({length:8},(_,i)=>{
      let kicker=pool[i%pool.length];
      if(type==='movie-price') kicker=context.price.label || 'SELECIONE O INGRESSO';
      if(context.releaseScope==='international') kicker=['NO RADAR DO CINEMA','UMA HISTÓRIA NO HORIZONTE','LANÇAMENTO INTERNACIONAL','PARA SUA LISTA DE FILMES'][i%4];
      if(type==='sessions-today' && context.period.from!==context.today) kicker='PROGRAMAÇÃO DO DIA';
      if(type==='movie-presale') kicker=context.purchaseAvailable && (!context.presaleStartDate || context.presaleStartDate<=context.today)?(i%2?'SEU LUGAR JÁ PODE SER GARANTIDO':'PRÉ-VENDA ABERTA'):'PRÉ-VENDA A PARTIR DE';
      let supportingText=tone!=='automatic' ? TONE_LINES[tone][i%TONE_LINES[tone].length] : genreLines[i%genreLines.length];
      if(type==='concession-combo') {
        const description=String(context.concession?.description || '').trim();
        supportingText=[description,CONCESSION_LINES[i%CONCESSION_LINES.length]].filter(Boolean).join(' ');
      }
      if(type==='club-plan') {
        const benefits=(context.clubPlan?.benefits || []).map(item=>typeof item==='string'?item:item?.label || item?.name || '').filter(Boolean);
        supportingText=[benefits.slice(0,density==='short'?1:2).join(' • '),CLUB_LINES[i%CLUB_LINES.length]].filter(Boolean).join(' ');
      }
      if(/^sessions-/.test(type)) supportingText=context.schedule.text;
      if(type==='multi-movies') supportingText=context.programMovies.map(movie=>movie.title).join(' • ');
      if(/^movie-/.test(type) && context.movie?.synopsis && i%3===2) supportingText=excerpt(context.movie.synopsis,density==='short'?90:145);
      if(context.movie?.socialHook && i===7 && !/^sessions-|multi-movies|concession|club/.test(type)) supportingText=context.movie.socialHook;
      if(context.releaseScope==='international') supportingText=context.movie?.socialHook || 'Exibição no cinema ainda não confirmada.';
      const headline=['online-ticket','multi-movies'].includes(type)?pool[(i+2)%pool.length]:subject && /^movie-/.test(type) && i%4===3?`${subject} NO CINEMA`:subject || context.cinemaName;
      const cta=ctas[i%ctas.length];
      const detail=type==='movie-price'?context.price.formatted:context.primaryDate || '';
      const destinationText=(context.action.destination || '').replace(/^https?:\/\//,'').replace(/\/$/,'');
      const priceLine=['concession-combo','club-plan'].includes(type) && context.price.formatted ? `${type==='club-plan'?'Mensalidade':'Valor'}: ${context.price.formatted}` : '';
      const scheduleLine=context.programMovies.length?context.programMovies.map(movie=>`${movie.title}\n${movie.schedule.text}`).join('\n\n'):'';
      const detailLine=detail && `${type==='movie-price'?context.price.label:context.primaryDateLabel}: ${detail}`;
      const synopsis=/^movie-/.test(type) && (density==='long' || density==='medium' && i%3===1) && supportingText!==excerpt(context.movie?.synopsis,density==='short'?90:145) ? excerpt(context.movie?.synopsis,density==='long'?460:260) : '';
      const clubBenefits=type==='club-plan' && density==='long' ? (context.clubPlan?.benefits || []).map(item=>typeof item==='string'?item:item?.label || item?.name || '').filter(Boolean).join(' • ') : '';
      const opening=i%2===0?`${kicker}\n${headline}`:`${headline}\n${kicker}`;
      const caption=[opening,supportingText,priceLine,detailLine,synopsis,clubBenefits,context.releaseScope==='international'?'A exibição no cinema ainda não está confirmada.':'',scheduleLine,`${cta}\n${destinationText}`].filter(Boolean).join('\n\n');
      const bundle={headline,kicker,supportingText,detail,cta,destinationText,caption};
      return {id:`rules-${i}`,bundle,score:scoreCopy(bundle,context,{...options,density})};
    });
    return candidates.sort((a,b)=>b.score-a.score || ((Number(a.id.slice(-1))-(options.seed || 0)+8)%8)-((Number(b.id.slice(-1))-(options.seed || 0)+8)%8));
  }
}
function generateCopy(draft,context,options={}) {
  const provider=options.provider || new RuleBasedCopyProvider();
  const candidates=provider.generate(copyContext(draft,context),{...options,current:draft});
  const bundle={...candidates[0].bundle};
  for(const [field,legacy] of Object.entries(FIELD_MAP)) if(options.locks?.[field]) bundle[field]=draft[legacy] || '';
  return {bundle,candidates,provider:'rule-based',tone:options.tone || 'automatic',density:options.density || 'medium'};
}
module.exports={RuleBasedCopyProvider,generateCopy,scoreCopy,copyContext,FIELD_MAP,TONES};
