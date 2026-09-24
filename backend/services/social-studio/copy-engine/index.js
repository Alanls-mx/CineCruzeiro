const TONES = ['automatic','cinematic','commercial','fun','elegant','direct'];
const CAMPAIGNS = {
  'movie-premiere':['PREPARE-SE PARA A ESTREIA','UMA NOVA HISTÓRIA NA TELA GRANDE','A PRÓXIMA ESTREIA','MARQUE ESTA DATA','O CINEMA TEM UM NOVO ENCONTRO','ESTREIA NO CINEMA'],
  'movie-presale':['A CONTAGEM REGRESSIVA COMEÇOU','ANTES DA PRIMEIRA SESSÃO','PREPARE-SE PARA A ESTREIA','O PRÓXIMO ENCONTRO JÁ TEM DATA','SEU PRÓXIMO FILME','UMA ESTREIA PARA ACOMPANHAR'],
  'movie-highlight':['NA TELA GRANDE','SEU PRÓXIMO FILME','UMA HISTÓRIA PARA VER NO CINEMA','O FILME DA SUA VEZ','CINEMA NO SEU RITMO','EM DESTAQUE'],
  'movie-price':['INGRESSOS A PARTIR DE','ESCOLHA SUA SESSÃO','SEU PRÓXIMO INGRESSO','CINEMA NA SUA AGENDA','O VALOR DA SUA SESSÃO','ENCONTRE SEU HORÁRIO'],
  'ticket-offer':['INGRESSOS EM DESTAQUE','SEU LUGAR NO CINEMA','ESCOLHA SUA SESSÃO','INGRESSO PARA A TELA GRANDE','CINEMA NA SUA AGENDA','O PREÇO DA SUA SESSÃO'],
  'sessions-today':['HOJE TEM CINEMA','ESCOLHA SUA SESSÃO DE HOJE','SEU FILME É HOJE','A PROGRAMAÇÃO DE HOJE','HOJE NA TELA GRANDE','O CINEMA TE ESPERA HOJE'],
  'sessions-week':['PROGRAME SUA SEMANA','SUA SEMANA PEDE CINEMA','ESCOLHA O DIA E O FILME','SETE DIAS DE CINEMA','RESERVE UM TEMPO PARA O CINEMA','SUA PRÓXIMA SESSÃO'],
  'multi-movies':['ESCOLHA SUA PRÓXIMA HISTÓRIA','FILMES PARA A SUA AGENDA','A TELA GRANDE TEM MAIS HISTÓRIAS','PROGRAME SEU CINEMA','UM ENCONTRO COM O CINEMA','CONHEÇA A PROGRAMAÇÃO'],
  'online-ticket':['BILHETERIA DIGITAL','SEU INGRESSO ONLINE','ESCOLHA O FILME E A SESSÃO','SEU CINEMA EM POUCOS PASSOS','PROGRAME SUA IDA AO CINEMA','O CINEMA COMEÇA NA SUA ESCOLHA'],
  'concession-combo':['COMPLETE SUA SESSÃO','UMA PAUSA NA BOMBONIERE','ESCOLHA SEU ACOMPANHAMENTO','ANTES DO FILME','SABOR PARA O SEU CINEMA','O COMPLEMENTO DA SUA SESSÃO'],
  'concession-offer':['OFERTA DA BOMBONIERE','BOMBONIERE EM DESTAQUE','O SABOR DA SESSÃO','ANTES DO FILME','ESCOLHA SEU ACOMPANHAMENTO','DESTAQUE DA BOMBONIERE'],
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
const STORY_THEMES = [
  {match:/amizad|amig[oa]s?/i,lines:['A amizade está no centro desta história.','Uma história que coloca a amizade em primeiro plano.']},
  {match:/fam[ií]li|pais|m[ãa]e|irm[ãa]os?/i,lines:['Família, encontros e novas perspectivas entram em cena.','Os laços de família dão o tom desta história.']},
  {match:/mist[eé]ri|segredo|investig/i,lines:['Um mistério para acompanhar na tela grande.','Pistas e segredos conduzem esta história.']},
  {match:/sobreviv|amea[çc]a|perigo/i,lines:['Uma história marcada por perigo e escolhas difíceis.','O perigo dá ritmo a esta sessão.']},
  {match:/aventura|jornada|viagem|miss[ãa]o/i,lines:['Uma jornada para acompanhar do começo ao fim.','Uma nova aventura pede a tela grande.']},
  {match:/amor|romance|paix[ãa]o/i,lines:['Afetos e escolhas movem esta história.','Uma história de encontros e sentimentos.']},
  {match:/vingan[çc]a|confronto|batalha/i,lines:['Confrontos e decisões dão ritmo à trama.','Uma história de escolhas sob pressão.']},
  {match:/humor|confus[ãa]o|com[eé]dia/i,lines:['A confusão rende uma sessão para rir junto.','Humor e encontros improváveis entram em cena.']},
];
function movieReferences(context) {
  const movie=context.movie || {};
  const references=[];
  const add=(kind,text)=>{if(text && !references.some(item=>item.text===text)) references.push({kind,text});};
  String(context.copyBrief || '').split(/[\r\n]+/).map(line=>line.trim()).filter(Boolean).slice(0,3).forEach(line=>add('brief',excerpt(line,120)));
  const hook=String(movie.socialHook || '').replace(/\s+/g,' ').trim();
  if(hook) add('editorial',excerpt(hook,130));
  const synopsis=String(movie.synopsis || '');
  for(const theme of STORY_THEMES) if(theme.match.test(synopsis) || theme.match.test(hook)) {
    theme.lines.forEach(line=>add('theme',line));
    if(references.length>=7) break;
  }
  if(movie.director) add('direction',`Direção de ${movie.director}.`);
  const genres=(Array.isArray(movie.genres)?movie.genres:[]).filter(Boolean);
  if(genres.length>1) add('genre',`${genres.slice(0,2).join(' e ')} na tela grande.`);
  else if(genres.length) add('genre',`${genres[0]} para viver no cinema.`);
  if(movie.duration) add('duration',`${movie.duration} de cinema para colocar na agenda.`);
  if(movie.rating) add('rating',`Classificação indicativa: ${movie.rating}.`);
  const next=(context.availableSessions || [])[0];
  if(next?.date && next?.time) add('session',`Próxima sessão: ${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${next.date}T12:00:00Z`))}, às ${next.time}.`);
  return references;
}
function movieAngle(context, index, tone, genreLines) {
  const references=movieReferences(context);
  const preferred=tone==='direct' ? ['brief','session','duration','rating','direction','genre','editorial','theme'] : ['brief','editorial','theme','direction','genre','session','duration','rating'];
  const rotated=preferred.slice(index%preferred.length).concat(preferred.slice(0,index%preferred.length));
  const reference=rotated.map(kind=>references.find(item=>item.kind===kind)).find(Boolean);
  const fallback=tone!=='automatic' ? TONE_LINES[tone] : genreLines;
  const fallbackLine=fallback[index%fallback.length];
  const line=index%3===1 ? fallbackLine : index%3===2 && reference ? `${reference.text} ${fallbackLine}` : reference?.text || fallbackLine;
  return {line,reference,available:references};
}
function excerpt(value, limit) {
  const text=String(value || '').replace(/\s+/g,' ').trim();
  if(text.length<=limit) return text;
  return `${text.slice(0,limit).replace(/\s+\S*$/,'').trim()}…`;
}

function copyContext(draft, context) {
  return {...draft.content,relatedMovieId:draft.relatedMovieId,campaignConcept:draft.campaignConcept,cinemaName:context.brand?.name || 'Cinema',genre:draft.genreProfile?.id || 'cinema',concession:draft.entities.concession,clubPlan:draft.entities.clubPlan,history:context.history || [],schedule:draft.schedule};
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
  if(/^movie-/.test(context.campaignType) && context.movie?.synopsis && bundle.caption.includes(context.movie.synopsis)) score-=25;
  return Math.max(0,Math.round(score));
}
class RuleBasedCopyProvider {
  generate(context, options={}) {
    const type=context.campaignType, pool=CAMPAIGNS[type] || CAMPAIGNS['movie-highlight'];
    const tone=TONES.includes(options.tone)?options.tone:'automatic';
    const density=['short','medium','long'].includes(options.density)?options.density:'medium';
    const saleOpen=context.purchaseAvailable && (type!=='movie-presale' || !context.presaleStartDate || context.presaleStartDate<=context.today);
    const ctas=type==='club-plan'?['CONHEÇA O CLUBE','VEJA OS BENEFÍCIOS','CONSULTE OS PLANOS']:['concession-combo','concession-offer'].includes(type)?['CONHEÇA A BOMBONIERE','VEJA AS OPÇÕES','COMPLETE SUA SESSÃO']:saleOpen?['ESCOLHA SUA SESSÃO','VEJA OS HORÁRIOS','COMPRE SEU INGRESSO','CONFIRA AS SESSÕES']:['CONHEÇA A HISTÓRIA','DESCUBRA O FILME','SAIBA MAIS SOBRE O LANÇAMENTO','VEJA O QUE VEM POR AÍ'];
    const genreLines=GENRES[context.genre] || GENRES.cinema;
    const subject=['concession-combo','concession-offer'].includes(type)?context.concession?.name:type==='club-plan'?context.clubPlan?.name:context.movie?.title;
    const candidates=Array.from({length:8},(_,i)=>{
      let kicker=pool[i%pool.length];
      if(type==='movie-price') kicker=context.price.label || 'SELECIONE O INGRESSO';
      if(type==='ticket-offer') kicker=context.offerHeadline || (context.price.from?['INGRESSO A PARTIR DE','SESSÕES COM VALOR ESPECIAL','ESCOLHA SUA SESSÃO'][i%3]:context.price.mode==='promotional'?['INGRESSO PROMOCIONAL','VALOR ESPECIAL PARA SUA SESSÃO','PROMOÇÃO EM CARTAZ'][i%3]:['INGRESSOS EM DESTAQUE','SEU LUGAR NO CINEMA','CONFIRA OS VALORES'][i%3]);
      if(type==='ticket-offer' && context.campaignConcept) kicker=context.campaignConcept.eyebrow;
      if(context.releaseScope==='international') kicker=['NO RADAR DO CINEMA','UMA HISTÓRIA NO HORIZONTE','LANÇAMENTO INTERNACIONAL','PARA SUA LISTA DE FILMES'][i%4];
      if(type==='sessions-today' && context.period.from!==context.today) kicker='PROGRAMAÇÃO DO DIA';
      if(type==='movie-presale') kicker=context.purchaseAvailable && (!context.presaleStartDate || context.presaleStartDate<=context.today)?(i%2?'SEU LUGAR JÁ PODE SER GARANTIDO':'PRÉ-VENDA ABERTA'):'PRÉ-VENDA A PARTIR DE';
      const angle=movieAngle(context,i,tone,genreLines);
      let supportingText=angle.line;
      if(type==='ticket-offer') {
        const lines=context.price.mode==='half' ? ['Meia-entrada para a sessão escolhida. Consulte as condições.','Escolha uma sessão e confira as regras da meia-entrada.']
          : context.price.mode==='full' ? ['Ingresso inteiro para a sessão escolhida.','Confira o valor da inteira e garanta seu lugar.']
          : context.price.mode==='minimum' || context.price.from ? ['Valores a partir do anunciado. Confira a sessão antes de comprar.','Escolha a sessão e confirme o valor disponível.']
          : ['Confira as sessões participantes e as condições da campanha.','Escolha sua sessão e confirme as regras da oferta.'];
        supportingText=lines[i%lines.length];
        if(context.campaignConcept?.allHalf) supportingText=['A campanha de meia-entrada é para todos os clientes, conforme as condições anunciadas.','Escolha sua sessão entre as participantes da campanha. O valor anunciado vale para todos os clientes.'][i%2];
        if(subject) supportingText=`${subject} na tela grande. ${supportingText}`;
      }
      if(['concession-combo','concession-offer'].includes(type)) {
        const description=String(context.concession?.description || '').trim();
        supportingText=[description,CONCESSION_LINES[i%CONCESSION_LINES.length]].filter(Boolean).join(' ');
        if(context.relatedMovieId && context.movie?.title) supportingText=`${description} Para acompanhar sua sessão de ${context.movie.title}.`.trim();
      }
      if(type==='club-plan') {
        const benefits=(context.clubPlan?.benefits || []).map(item=>typeof item==='string'?item:item?.label || item?.name || '').filter(Boolean);
        supportingText=[benefits.slice(0,density==='short'?1:2).join(' • '),CLUB_LINES[i%CLUB_LINES.length]].filter(Boolean).join(' ');
      }
      if(/^sessions-/.test(type)) supportingText=context.schedule.text;
      if(type==='multi-movies') supportingText=context.programMovies.map(movie=>movie.title).join(' • ');
      if(context.releaseScope==='international') supportingText=context.movie?.socialHook || angle.line;
      const headline=type==='ticket-offer'?(context.campaignConcept?.headline || context.offerHeadline || 'INGRESSOS EM DESTAQUE'):['online-ticket','multi-movies'].includes(type)?pool[(i+2)%pool.length]:subject && /^movie-/.test(type) && i%4===3?`${subject} NO CINEMA`:subject || context.cinemaName;
      if(type==='online-ticket') supportingText=context.relatedMovieId?`Confira as sessões de ${context.movie.title} no site do cinema.`:['Escolha o filme, confira os horários e compre seu ingresso no site.','Programe sua ida ao cinema com a bilheteria online.','Encontre o filme e o horário que combinam com sua agenda.'][i%3];
      const cta=type==='online-ticket'?['CONFIRA A PROGRAMAÇÃO','ACESSE A BILHETERIA','ESCOLHA SUA SESSÃO'][i%3]:ctas[i%ctas.length];
      const detail=['movie-price','ticket-offer','concession-offer'].includes(type)?context.price.formatted:/^movie-/.test(type)?context.primaryDate || '':'';
      const destinationText=(context.action.destination || '').replace(/^https?:\/\//,'').replace(/\/$/,'');
      const priceLine=['concession-combo','concession-offer','club-plan','ticket-offer'].includes(type) && context.price.formatted ? `${type==='club-plan'?'Mensalidade':'Valor'}: ${context.price.formatted}` : '';
      const scheduleLine=context.programMovies.length?context.programMovies.map(movie=>`${movie.title}\n${movie.schedule.text}`).join('\n\n'):'';
      const detailLine=type!=='ticket-offer' && detail && `${['movie-price','ticket-offer'].includes(type)?context.price.label:type==='concession-offer'?'PREÇO':context.primaryDateLabel}: ${detail}`;
      const editorialDetail=/^movie-/.test(type) && density!=='short' ? angle.available.filter(item=>!supportingText.includes(item.text)).slice(0,density==='long'?3:1).map(item=>item.text).join(' ') : '';
      const clubBenefits=type==='club-plan' && density==='long' ? (context.clubPlan?.benefits || []).map(item=>typeof item==='string'?item:item?.label || item?.name || '').filter(Boolean).join(' • ') : '';
      const opening=i%2===0?`${kicker}\n${headline}`:`${headline}\n${kicker}`;
      const caption=[opening,supportingText,editorialDetail,priceLine,detailLine,context.offerTerms,clubBenefits,context.releaseScope==='international'?'A exibição no cinema ainda não está confirmada.':'',scheduleLine,`${cta}\n${destinationText}`].filter(Boolean).join('\n\n');
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
