const FAMILIES = Object.freeze({
  'commercial-vibrant': 'Comercial vibrante',
  'cinematic-product': 'Produto cinematográfico',
  'clean-premium': 'Clean premium',
  'dark-snack': 'Dark food / snack'
});
const CATEGORIES = ['popcorn','soda','chocolate','individual','couple','family','product'];
const OBJECTIVES = ['sell','price','introduce','desire','brand','offer','new'];
const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isConcession = draft => ['concession-combo','concession-offer'].includes(draft?.templateId);

function categoryFor(product = {}, override) {
  if (CATEGORIES.includes(override)) return override;
  const name = clean(`${product.category || ''} ${product.name || ''}`);
  if (/combo|kit/.test(name)) return /famil/.test(name) ? 'family' : /casal|duplo|dois/.test(name) ? 'couple' : 'individual';
  if (/pipoca/.test(name)) return 'popcorn';
  if (/refrigerante|coca|pepsi|guarana|bebida|suco|agua/.test(name)) return 'soda';
  if (/chocolate|choco|bombom/.test(name)) return 'chocolate';
  return 'product';
}

function normalizeConcession(input, product = {}) {
  const source = input.concessionDirection || {};
  const layouts=require('./artwork-layout').PRODUCT_LAYOUTS;
  const requestedLayout=source.layout || input.layoutId || input.style;
  const category = categoryFor(product, source.categoryMode==='automatic'?undefined:source.category);
  const objective = OBJECTIVES.includes(source.objective) ? source.objective : input.templateId === 'concession-offer' ? 'offer' : 'sell';
  const requested = source.familyMode==='automatic'?'automatic':source.family || input.layoutId || input.style;
  const legacy = {impact:'commercial-vibrant',clean:'clean-premium',minimal:'clean-premium','hero-left':'cinematic-product','hero-right':'clean-premium',split:'clean-premium','poster-dominant':'dark-snack','typography-dominant':'commercial-vibrant'};
  const family = FAMILIES[requested] ? requested : legacy[requested] || (input.relatedMovieId ? 'cinematic-product' : ['offer','price','new'].includes(objective) ? 'commercial-vibrant' : ['introduce','brand'].includes(objective) || category === 'soda' ? 'clean-premium' : category === 'chocolate' || objective==='desire' ? 'dark-snack' : category === 'family' ? 'commercial-vibrant' : 'cinematic-product');
  const layout=layouts[requestedLayout]?requestedLayout:family==='commercial-vibrant'?'product-price':family==='dark-snack'?'hero-product':'product-lateral';
  return { category, objective, family, layout, familyMode:FAMILIES[requested] || legacy[requested]?'manual':'automatic',categoryMode:source.categoryMode!=='automatic' && CATEGORIES.includes(source.category)?'manual':'automatic',
    brandedProduct:source.brandedProduct === true || product.containsCinemaBranding === true,
    seed:Math.max(0,Math.min(9999,Number(input.artDirection?.seed) || 0)) };
}

const ANGLES = {
  popcorn: ['O FILME COMEÇA NA PIPOCA','PIPOCA NO SEU ROTEIRO','UM BALDE PARA A SESSÃO','CINEMA COM GOSTO DE PIPOCA','ESCOLHA SUA PIPOCA','PIPOCA E TELA GRANDE'],
  soda: ['SEU GOLE ENTRE AS CENAS','UMA PAUSA PARA REFRESCAR','SEU FILME, SUA BEBIDA','REFRESQUE A SESSÃO','ESCOLHA O QUE VAI NO COPO','BEBIDA PARA ACOMPANHAR'],
  chocolate: ['UM DOCE ENTRE AS CENAS','SEU MOMENTO DE CHOCOLATE','O LADO DOCE DO CINEMA','CHOCOLATE NO SEU ROTEIRO','ESCOLHA SUA PAUSA DOCE','UM DOCE PARA A SESSÃO'],
  individual: ['SEU COMBO, SUA SESSÃO','COMBINE SEUS FAVORITOS','TUDO JUNTO NO SEU COMBO','SEU PEDIDO PARA O FILME','UM COMBO NO SEU ROTEIRO','A ESCOLHA ANTES DO FILME'],
  couple: ['UM COMBO PARA COMPARTILHAR','O FILME É MELHOR EM COMPANHIA','ESCOLHA O COMBO DA DUPLA','DOIS LUGARES, UM ENCONTRO','SABORES PARA DIVIDIR','SESSÃO A DOIS'],
  family: ['A FAMÍLIA JÁ TEM UM COMBO','UM COMBO PARA COMPARTILHAR','O PEDIDO DA TURMA','JUNTOS TAMBÉM NA BOMBONIERE','ESCOLHA O COMBO DA FAMÍLIA','SUA TURMA, SEU COMBO'],
  product: ['CONHEÇA ESTA OPÇÃO','NO SEU ROTEIRO DE CINEMA','UMA ESCOLHA PARA A SESSÃO','DESCUBRA NA BOMBONIERE','ESCOLHA SEU FAVORITO','SEU PEDIDO COMEÇA AQUI']
};
function concessionCopy(product, direction, index = 0, context = {}) {
  const category = direction.category, objective = direction.objective;
  const angle = ANGLES[category][Math.abs(index) % ANGLES[category].length];
  const price = Number(product.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const name = String(product.name || 'Produto da bomboniere');
  const intents={price:['CONFIRA O VALOR','ESCOLHA PELO PREÇO','SEU PEDIDO NA BOMBONIERE'],introduce:['CONHEÇA ESTA ESCOLHA','DESCUBRA NA BOMBONIERE',angle],brand:['SUA SESSÃO COMEÇA AQUI',angle,'ENCONTRE NA BOMBONIERE'],new:['NOVIDADE NA BOMBONIERE','UMA NOVA ESCOLHA PARA SUA SESSÃO','CONHEÇA A NOVIDADE']};
  const kicker = intents[objective]?.[index%3] || angle;
  const cta = ['sell','price','offer'].includes(objective) ? ['ESCOLHA NA BOMBONIERE','PEÇA NO BALCÃO','CONFIRA O PRODUTO'][index%3] : ['CONHEÇA NA BOMBONIERE','VEJA OS DETALHES','DESCUBRA ESTA OPÇÃO'][index%3];
  const occasion = context.relatedMovieId && context.movie?.title ? `Para acompanhar sua sessão de ${context.movie.title}.` : category === 'family' || category === 'couple' ? 'Para quem faz do cinema um encontro.' : category === 'chocolate' ? 'Inclua chocolate no seu próximo encontro com o cinema.' : category === 'soda' ? 'Escolha a bebida que acompanha o seu filme.' : category === 'popcorn' ? 'Escolha sua pipoca antes de entrar na sala.' : 'Conheça a composição e escolha seu pedido antes da sessão.';
  const facts = String(product.description || '').trim();
  const supportingText = context.density === 'short' ? (index>5 && facts ? facts : occasion) : [facts,occasion].filter(Boolean).join(' ');
  const destinationText = String(context.action?.destination || '').replace(/^https?:\/\//,'').replace(/\/$/,'');
  const brief = String(context.copyBrief || '').trim();
  return { headline:name,kicker,supportingText,detail:price,cta,destinationText,
    caption:[`${kicker}\n${name}`,supportingText,brief,`Valor: ${price}`,context.offerTerms,`${cta}\n${destinationText}`].filter(Boolean).join('\n\n') };
}
module.exports = {FAMILIES,CATEGORIES,OBJECTIVES,isConcession,categoryFor,normalizeConcession,concessionCopy};
