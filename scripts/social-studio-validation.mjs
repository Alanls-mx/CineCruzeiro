import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
const {readDbFromPostgres,closePostgres}=require('../backend/db/postgresStore');
const engine=require('../backend/services/socialStudioEngineService');
const {LAYOUTS}=require('../backend/services/social-studio/contracts/workspace');
const {PRODUCT_LAYOUTS,MOVIE_FAMILIES}=require('../backend/services/social-studio/contracts/artwork-layout');
const {flattenElements}=require('../backend/services/social-studio/scene/groups');
const root=path.resolve(import.meta.dirname,'..');
const uploadsRoot=path.resolve(process.env.CINE_UPLOADS_DIR || path.join(root,'backend/public/uploads'));
const formatIds=['feed_portrait','square','story'];
const outputFlag=process.argv.find(arg=>arg.startsWith('--generate='));
const outputRoot=outputFlag?path.resolve(outputFlag.slice('--generate='.length)):'';
const onlyFlag=process.argv.find(arg=>arg.startsWith('--only='));
const onlyIds=onlyFlag?new Set(onlyFlag.slice('--only='.length).split(',').map(value=>value.trim().toLowerCase())):null;
const categoryFlag=process.argv.find(arg=>arg.startsWith('--category='));
const onlyCategory=categoryFlag?.slice('--category='.length) || '';
const intents={
  'movie-editorial-light':'Preservar o pôster oficial em grande escala, sem repetir seu título, com transição clara para data, horário e chamada no rodapé.',
  'movie-immersive':'Usar a imagem do filme como ambiente predominante, com transição atmosférica para as informações.',
  'movie-spotlight':'Fazer o momento de exibição ou o status do filme ganhar prioridade sem reduzir a presença da arte.',
  'movie-campaign':'Integrar a fotografia, a paleta e o tratamento de título da obra numa peça de campanha coesa.',
  'product-price':'Produto e preço em leitura imediata, com a cor promocional clássica da bomboniere.',
  'product-lateral':'Dar escala ao produto e reservar uma coluna clara para preço e informação essencial.',
  'hero-product':'Centralizar o produto como protagonista e manter a oferta em segundo plano.',
  'product-cinema-blue':'Criar atmosfera azul de cinema, com produto preservado e acentos de luz fria.',
  'product-gold':'Valorizar o produto com verde profundo e detalhes dourados de apresentação premium.',
  'product-neon':'Dar energia noturna à oferta com iluminação roxa, preservando rótulos e cores da embalagem.',
  'product-sunset':'Usar calor vermelho e laranja para destacar apetite, produto e preço.',
  'product-stage':'Apresentar o produto em um palco iluminado, com preço e descrição em área própria.',
  'product-retro':'Contrastar fundo claro editorial com plataforma escura e acento dourado.',
  'product-pop':'Criar leitura promocional expressiva, com campo de título e preço em destaque gráfico.'
};
const slug=value=>String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);

function assetFile(value='') {
  if(!value)return '';
  let pathname;
  try {pathname=new URL(value,'https://local.invalid').pathname;} catch {return '';}
  pathname=pathname.replace(/^\/projects\/cinecruzeiro(?=\/)/,'');
  const base=pathname.startsWith('/uploads/')?uploadsRoot:pathname.startsWith('/images/')?path.join(root,'public'):null;
  if(!base)return '';
  const relative=pathname.replace(/^\/(uploads|images)\//,'');
  const file=path.resolve(base,pathname.startsWith('/images/')?`images/${relative}`:relative);
  return file.startsWith(`${base}${path.sep}`)?file:'';
}

async function assetStatus(value) {
  const file=assetFile(value);
  if(!file)return value?'external':'missing';
  return await fs.stat(file).then(stat=>stat.size>0?'available':'empty').catch(()=>'missing');
}

async function loadImage(value) {
  const file=assetFile(value);
  return file?fs.readFile(file).catch(()=>null):null;
}

async function copySource(value,target) {
  const file=assetFile(value);
  if(!file || await assetStatus(value)!=='available')return '';
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(file,target);
  return path.relative(outputRoot,target).replaceAll('\\','/');
}

async function contactSheet(entries,target) {
  if(!entries.length)return;
  entries=[...entries].sort((a,b)=>a.file.localeCompare(b.file));
  const columns=Math.min(5,entries.length),tileWidth=240,tileHeight=318;
  const tiles=await Promise.all(entries.map(async(entry,index)=>({
    input:await sharp(path.join(outputRoot,entry.file)).resize({width:tileWidth,height:tileHeight,fit:'contain',background:'#07111f'}).png().toBuffer(),
    left:index%columns*tileWidth,top:Math.floor(index/columns)*tileHeight
  })));
  await fs.mkdir(path.dirname(target),{recursive:true});
  await sharp({create:{width:columns*tileWidth,height:Math.ceil(entries.length/columns)*tileHeight,channels:3,background:'#07111f'}}).composite(tiles).jpeg({quality:85}).toFile(target);
}

function renderFacts(result) {
  const elements=flattenElements(result.scene.elements);
  const visibleText=elements.filter(item=>item.type==='text' && item.visible!==false).map(item=>({role:item.id,text:item.text}));
  const artwork=elements.find(item=>item.id==='artwork');
  const logo=elements.find(item=>item.id==='logo');
  return {visibleText,artwork:artwork?.src || '',logo:logo?.src || '',backgroundColor:result.scene.backgroundColor,
    artworkColors:result.palette?.artworkColors || [],titleEvidence:result.scene.sourceDraft.titleEvidence || '',curatedDuplicates:result.scene.sourceDraft.curatedDuplicates || [],
    quality:{accepted:result.quality.accepted,technical:result.quality.technical?.score,editorial:result.quality.editorial?.score,
      editorialIssues:result.quality.editorial?.issues || [],issues:result.quality.issues || []}};
}

async function generate(db,movies,concessions) {
  if(!outputRoot)throw new Error('Informe --generate=/caminho/de/saida.');
  const brand=engine.normalizeBrand({
    name:db.settings?.socialStudioBrand?.name || db.settings?.cinemaName || 'Cine Cruzeiro',
    website:db.settings?.socialStudioBrand?.website || 'https://www.cinecruzeiro.com.br',
    posterWebsite:'www.cinecruzeiro.com.br',
    logoUrl:'/images/social-studio/cine-cruzeiro-assinatura-oficial.png',
    posterLogoUrl:'/images/social-studio/cine-cruzeiro-assinatura-oficial.png',
    primaryColor:db.settings?.socialStudioBrand?.primaryColor || '#07111f'
  });
  const context={now:new Date().toISOString(),brand,
    movies:movies.map(movie=>({...movie,catalogued:true,genres:Array.isArray(movie.genre)?movie.genre:[movie.genre].filter(Boolean),sessions:movie.sessions || []})),
    concessions:concessions.map(item=>({...item,price:Number(item.price || 0)})),clubPlans:[]};
  const manifest={generatedAt:new Date().toISOString(),cinema:brand.name,source:'Catálogo PostgreSQL publicado do Cine Cruzeiro',formats:formatIds,
    expected:{movies:movies.length,concessions:concessions.length,movieLayouts:LAYOUTS.movie.length,concessionLayouts:LAYOUTS.concession.length,
      posters:movies.length*LAYOUTS.movie.length+concessions.length*LAYOUTS.concession.length},posts:[],failures:[]};
  await fs.mkdir(outputRoot,{recursive:true});
  const previous=await fs.readFile(path.join(outputRoot,'manifest.json'),'utf8').then(JSON.parse).catch(()=>null);
  if(previous?.posts)manifest.posts=previous.posts;
  for(const signature of ['cine-cruzeiro-assinatura-oficial.png','cine-cruzeiro-assinatura-black.png'])
    await copySource(`/images/social-studio/${signature}`,path.join(outputRoot,'fontes','assinaturas',signature));
  for(const [kind,items,layouts] of [['filmes',movies,LAYOUTS.movie],['bomboniere',concessions,LAYOUTS.concession]]) {
    for(const [itemIndex,item] of items.entries()) {
      const label=kind==='filmes'?item.title:item.name;
      const folder=path.join(outputRoot,kind,`${String(itemIndex+1).padStart(2,'0')}-${slug(label)}`);
      const sources={};
      if(kind==='filmes') {
        for(const [field,value] of [['poster',item.posterUrl],['backdrop',item.backdropUrl]])
          if(value)sources[field]=await copySource(value,path.join(outputRoot,'fontes','filmes',`${slug(label)}-${field}${path.extname(assetFile(value)) || '.png'}`));
      } else if(item.imageUrl) sources.product=await copySource(item.imageUrl,path.join(outputRoot,'fontes','bomboniere',`${slug(label)}${path.extname(assetFile(item.imageUrl)) || '.png'}`));
      for(const [layoutIndex,layoutId] of layouts.entries()) {
        if(manifest.posts.some(post=>post.category===kind && post.id===String(item.id) && post.composition===layoutId))continue;
        const preferred=(itemIndex+layoutIndex)%formatIds.length;
        const candidateFormats=[...formatIds.slice(preferred),...formatIds.slice(0,preferred)];
        const hasSessions=kind==='filmes' && (item.sessions || []).some(session=>session.status!=='cancelled' && !session.cancelledAt);
        const input=kind==='filmes'?{
          templateId:'movie-highlight',movieId:item.id,layoutId,outputType:'png',workspaceVersion:2,signatureId:'automatic',
          title:item.title,subtitle:item.status==='upcoming'?'EM BREVE':'EM CARTAZ',
          cta:hasSessions?'ESCOLHA SUA SESSÃO':'ACOMPANHE AS NOVIDADES',
          actionDestination:brand.website,showSessions:hasSessions
        }:{
          templateId:'concession-combo',concessionId:item.id,layoutId,outputType:'png',workspaceVersion:2,signatureId:'automatic',
          title:item.name,subtitle:'NA BOMBONIERE',cta:'PEÇA NO BALCÃO',actionDestination:brand.website,
          concessionDirection:{assetMode:'registered'}
        };
        let lastError;
        for(const formatId of candidateFormats)try {
          const result=await engine.renderSocialPost({...input,formatId},context,{loadImage,artworkRetried:true,concessionRetried:true,editorialRetried:true});
          const chosen=result.draft.concessionDirection?.layout || result.draft.movieFamily || result.draft.layoutId;
          if(chosen!==layoutId)throw new Error(`A direção mudou de ${layoutId} para ${chosen}.`);
          if(!result.quality.accepted || !result.buffer)throw new Error('Render sem PNG aprovado.');
          const relative=`${kind}/${path.basename(folder)}/${String(layoutIndex+1).padStart(2,'0')}-${slug(layoutId)}-${formatId}.png`;
          const target=path.join(outputRoot,relative);
          await fs.mkdir(path.dirname(target),{recursive:true});
          await fs.writeFile(target,result.buffer);
          const facts=renderFacts(result);
          manifest.posts.push({file:relative,category:kind,id:String(item.id),name:label,composition:layoutId,
            compositionName:(kind==='filmes'?MOVIE_FAMILIES:PRODUCT_LAYOUTS)[layoutId],intention:intents[layoutId],format:formatId,
            dimensions:`${result.format.width}x${result.format.height}`,sourceFiles:sources,...facts});
          console.log(`OK ${manifest.posts.length}/${manifest.expected.posters} ${label} ${layoutId} ${formatId}`);
          lastError=null;
          break;
        } catch(error) {
          lastError={category:kind,id:String(item.id),name:label,composition:layoutId,format:formatId,
            code:error.code || 'RENDER_FAILED',reason:error.message,issues:error.quality?.issues || []};
          console.error(`TENTATIVA ${label} ${layoutId} ${formatId}: ${lastError.reason} ${JSON.stringify(lastError.issues)}`);
        }
        if(lastError)manifest.failures.push(lastError);
      }
      await contactSheet(manifest.posts.filter(post=>post.category===kind && post.id===String(item.id)),path.join(outputRoot,'grades',kind,`${slug(label)}.jpg`));
    }
  }
  manifest.posts.sort((a,b)=>{
    if(a.category!==b.category)return a.category==='filmes'?-1:1;
    const items=a.category==='filmes'?movies:concessions;
    const layouts=a.category==='filmes'?LAYOUTS.movie:LAYOUTS.concession;
    return items.findIndex(item=>String(item.id)===a.id)-items.findIndex(item=>String(item.id)===b.id)
      || layouts.indexOf(a.composition)-layouts.indexOf(b.composition);
  });
  await fs.writeFile(path.join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2));
  const rows=manifest.posts.map((post,index)=>`| ${index+1} | ${post.category} | ${post.name.replaceAll('|','/')} | ${post.compositionName} | ${post.format} | ${post.quality.technical ?? '—'} | ${post.quality.editorial ?? '—'} | [PNG](${post.file.replaceAll(' ','%20')}) |`).join('\n');
  const details=manifest.posts.map(post=>`### ${post.name} / ${post.compositionName}\n\n- Arquivo: [${post.file}](${post.file.replaceAll(' ','%20')})\n- Intenção: ${post.intention}\n- Formato: ${post.format} (${post.dimensions})\n- Fonte principal: ${post.sourceFiles.poster || post.sourceFiles.product || 'não disponível'}\n- Fundo derivado: ${post.sourceFiles.backdrop || 'do próprio produto/arte'}\n- Cor base: ${post.backgroundColor}\n- Assinatura: ${post.logo}\n- Textos impressos: ${post.visibleText.map(item=>`${item.role}: “${item.text.replaceAll('\n',' / ')}”`).join('; ')}\n- QA técnico: ${post.quality.technical ?? '—'}/100. QA editorial: ${post.quality.editorial ?? '—'}/100.\n- Alertas editoriais: ${post.quality.editorialIssues?.map(item=>item.message).join(' ') || 'nenhum'}.\n`).join('\n');
  const failed=manifest.failures.length?`\n## Pendências\n\n${manifest.failures.map(item=>`- ${item.name} / ${item.composition}: ${item.reason}`).join('\n')}\n`:'';
  await fs.writeFile(path.join(outputRoot,'CATALOGO.md'),`# Validação dos pôsteres do Social Studio\n\nFonte: catálogo publicado do Cine Cruzeiro, consultado em ${manifest.generatedAt}. As artes foram renderizadas individualmente pelo mesmo motor do Studio, com composição e formato selecionados explicitamente; não foram salvas como campanhas no painel nem publicadas nas redes.\n\n${manifest.posts.length} de ${manifest.expected.posters} pôsteres aprovados no QA técnico. ${movies.length} filmes publicados; ${concessions.length} itens ativos da bomboniere. Os três formatos foram distribuídos entre as composições de cada item. Preço, produto, título e sessões vêm do cadastro; nenhum desconto ou horário foi inventado.\n\nA pasta \`fontes\` contém as imagens originais e as assinaturas; \`grades\` mostra uma folha de contato por filme ou produto. \`manifest.json\` registra os mesmos dados em formato estruturado.\n\n## Pontos para validação editorial\n\n- O QA técnico confirma legibilidade, integridade de asset, contraste e áreas seguras. O QA editorial pontua redundância, hierarquia, espaço e intensidade do desfoque. As notas são independentes e a aprovação técnica não significa aprovação editorial humana.\n- Nas sessões de madrugada, a data real do ingresso é identificada como madrugada. O dia comercial anterior só é mencionado quando o operador o seleciona.\n- As peças são amostras de validação, não aprovação para publicação. Confirme datas, preços e disponibilidade novamente antes de usar, pois o catálogo pode mudar.\n\n## Índice\n\n| Nº | Categoria | Item | Composição | Formato | QA técnico | QA editorial | Arte |\n|---:|---|---|---|---|---:|---:|---|\n${rows}\n\n## Intenção e conteúdo\n\n${details}${failed}`);
  console.log(`RESULTADO ${manifest.posts.length}/${manifest.expected.posters}; falhas=${manifest.failures.length}; pasta=${outputRoot}`);
  if(manifest.failures.length)process.exitCode=1;
}

const db=await readDbFromPostgres({includeAuditLogs:false,trackChanges:false});
try {
  const movies=(db.movies || []).filter(movie=>(movie.workflowStatus || (movie.status==='hidden'?'archived':'published'))==='published' && movie.status!=='hidden' && (!onlyCategory || onlyCategory==='filmes') && (!onlyIds || onlyIds.has(String(movie.id).toLowerCase()) || onlyIds.has(slug(movie.title))));
  const concessions=(db.concessions || []).filter(item=>item.active!==false && !item.archivedAt && (!onlyCategory || onlyCategory==='bomboniere') && (!onlyIds || onlyIds.has(String(item.id).toLowerCase()) || onlyIds.has(slug(item.name))));
  if(outputRoot)await generate(db,movies,concessions);
  else {
  const inventory={generatedAt:new Date().toISOString(),cinema:'Cine Cruzeiro',movies:await Promise.all(movies.map(async movie=>({
    id:String(movie.id),title:String(movie.title),status:movie.status || '',releaseDate:movie.releaseDate || '',
    posterUrl:movie.posterUrl || '',posterStatus:await assetStatus(movie.posterUrl),backdropUrl:movie.backdropUrl || '',backdropStatus:await assetStatus(movie.backdropUrl),
    sessions:(movie.sessions || []).filter(session=>session.cancelledAt==null && session.status!=='cancelled').length
  }))),concessions:await Promise.all(concessions.map(async item=>({
    id:String(item.id),name:String(item.name),price:Number(item.price || 0),imageUrl:item.imageUrl || '',imageStatus:await assetStatus(item.imageUrl)
  })))};
  console.log(JSON.stringify(inventory,null,2));
  }
} finally {
  await closePostgres();
}
