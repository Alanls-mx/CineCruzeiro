const ERROR_CODES=new Set([
  'TEXT_OVERFLOW','TEXT_OVERLAP','SUBJECT_OVERLAP','SAFE_AREA','OCCLUDED_CONTENT','CONTENT_OVERLAP',
  'MISSING_MOVIES','MISSING_MOVIE','MISSING_SESSIONS','MISSING_CONTENT','MISSING_CTA','MISSING_DESTINATION',
  'DATE_DISCONNECTED','WEBSITE_DISCONNECTED','ACTION_GROUP','ISO_DATE','ASSET_MISSING','PROGRAM_IMAGES_REQUIRED',
  'PROGRAM_CONTENT','PROGRAM_MISSING_TIME','PROGRAM_ORDER','PROGRAM_ASSOCIATION','MOVIE_CONTENT'
]);
const WARNING_CODES=new Set([
  'LOW_CONTRAST','SMALL_ARTWORK','SMALL_LOGO','NO_ARTWORK','MISSING_ARTWORK','MISSING_POSTER',
  'ASSET_LOW_RESOLUTION','EMPTY_SPACE','DRY_COMPOSITION','DENSE_COMPOSITION','COPY_DENSITY','SMALL_TEXT',
  'PROGRAM_SMALL_POSTER','PROGRAM_SMALL_TITLE','PROGRAM_SMALL_TIME','PROGRAM_DETACHED_TITLE','LOGO_POSITION',
  'LOGO_DOMINANT','POSTER_CROP','PRODUCT_SCALE','REDUNDANT_CONTENT'
]);
const LABELS={TEXT_OVERFLOW:'Há texto cortado.',TEXT_OVERLAP:'Dois textos estão sobrepostos.',SUBJECT_OVERLAP:'O texto invade a área principal da imagem.',SAFE_AREA:'Um elemento importante está fora da área segura.',OCCLUDED_CONTENT:'Uma camada está cobrindo conteúdo importante.',CONTENT_OVERLAP:'Elementos essenciais estão sobrepostos.',MISSING_MOVIES:'Nenhum filme válido foi encontrado.',MISSING_SESSIONS:'Não há sessões válidas para a chamada.',DATE_DISCONNECTED:'A data ficou separada do contexto da campanha.',WEBSITE_DISCONNECTED:'O destino ficou separado da chamada.',ACTION_GROUP:'A chamada ficou separada de seu destino.',LOW_CONTRAST:'O contraste pode ser melhorado.',SMALL_ARTWORK:'O pôster está pequeno demais.',SMALL_LOGO:'A assinatura está pequena.',NO_ARTWORK:'A campanha foi gerada sem imagem principal.',ASSET_MISSING:'Uma imagem necessária não está mais disponível.',ISO_DATE:'A data está em formato técnico.',SMALL_TEXT:'Há texto pequeno demais para publicação.'};
function classify(issue={}) {const code=String(issue.code || 'QUALITY_NOTE');return {severity:ERROR_CODES.has(code)?'ERROR':WARNING_CODES.has(code)?'WARNING':'SUGGESTION',code,message:issue.message || LABELS[code] || `Revisar ${code.toLowerCase().replace(/_/g,' ')}.`,elementId:issue.elementId || ''};}
function evaluate(rendered,context={}) {
  const findings=(rendered.quality?.issues || []).map(classify);
  const draft=rendered.draft || {},movie=draft.entities?.movie;
  if(movie && !movie.posterUrl && !movie.backdropUrl && !draft.imageUrl)findings.push({severity:'WARNING',code:'MISSING_POSTER',message:'Não foi possível obter o pôster; foi usado o fallback visual existente.',elementId:'artwork'});
  if(draft.templateId==='sessions-today' && !draft.schedule?.days?.length)findings.push({severity:'ERROR',code:'MISSING_SESSIONS',message:'Não há sessões de hoje para sustentar esta chamada.',elementId:'schedule'});
  const counts={ERROR:0,WARNING:0,SUGGESTION:0};findings.forEach(item=>counts[item.severity]++);
  return {accepted:counts.ERROR===0,score:Number(rendered.quality?.total || 0),counts,findings,checkedAt:new Date().toISOString(),rendererVersion:rendered.rendererVersion || 'v2'};
}
module.exports={evaluate,classify};
