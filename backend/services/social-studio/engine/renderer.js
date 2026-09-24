const { performance } = require("perf_hooks");
const legacy = require("../../socialStudioService");
const { loadAsset, sourceUrlForDraft } = require("./assets");
const { normalizeV2Draft } = require("./normalizer");
const { extractPalette, applyPalette } = require("./palette");
const { templateById } = require("../templates/registry");
const { buildEditableScene } = require("../scene/factory");
const { renderSocialScene } = require("../scene/renderer");
const sharp = require("sharp");
const { ensureTextContrast } = require("../composition-engine/contrast");
const { analyzeArtwork, selectDirection } = require("../composition-engine/direction");
const { scoreComposition } = require("../composition-engine/score");

function signatureUrl(draft, context = {}) {
  if (draft.signatureId === "none") return "";
  const brand = context.brand || {};
  if (draft.signatureId === "icon-3d") return brand.posterLogoUrl || brand.logoUrl || "";
  if (draft.signatureId === "automatic") return brand.posterLogoUrl || brand.logoUrl || "";
  if (draft.signatureId === "classic") return brand.logoUrl || "";
  const signature = legacy.SOCIAL_SIGNATURES.find((item) => item.id === draft.signatureId);
  return signature?.imageUrl || brand.posterLogoUrl || brand.logoUrl || "";
}

async function renderSocialPostV2(input = {}, context = {}, options = {}) {
  const startedAt = performance.now();
  const draft = normalizeV2Draft(input, context);
  const concession = require('../contracts/concession-campaign').isConcession(draft);
  require('../contracts/content').assertCampaignContent(draft.content);
  const format = require('../contracts/formats').formatById(draft.formatId);
  const brand = legacy.normalizeBrand(context.brand || {});
  const loadImage = typeof options.loadImage === "function" ? options.loadImage : async () => null;
  const loadArtwork=async url=>{
    if(draft.templateId!=='ticket-offer') return loadAsset(url,loadImage);
    try {const buffer=await loadAsset(url,loadImage);if(buffer) await sharp(buffer,{limitInputPixels:40_000_000}).metadata();return buffer;} catch {return null;}
  };

  const movie = draft.entities.movie;
  const automaticPoster = (draft.movieFamily || (draft.templateId.startsWith('movie-') || ['sessions-today','sessions-week','multi-movies','online-ticket'].includes(draft.templateId)) && draft.composition.enabled) && draft.imageMode === "automatic" && !draft.imageUrl;
  let sourceUrl = automaticPoster && movie?.posterUrl ? movie.posterUrl : sourceUrlForDraft(draft);
  if (!sourceUrl && draft.templateId==='club-plan') sourceUrl = brand.logoUrl || '';
  let sourceBuffer = await loadArtwork(sourceUrl);
  let backgroundUrl = draft.composition.enabled && movie?.backdropUrl && !draft.imageUrl ? movie.backdropUrl : sourceUrl;
  let backgroundBuffer = await loadArtwork(backgroundUrl);
  if (!sourceBuffer && backgroundBuffer && !concession) { sourceUrl = backgroundUrl; sourceBuffer = backgroundBuffer; }
  if (!backgroundBuffer) { backgroundUrl = sourceUrl; backgroundBuffer = sourceBuffer; }
  let analysis = draft.artDirection.enabled ? await analyzeArtwork(sourceBuffer) : null;
  if(!draft.artworkMetadata.contentBounds && ['logo','symbol'].includes(draft.artworkMetadata.dominantAsset) && analysis?.contentBounds) {
    draft.artworkMetadata.contentBounds=analysis.contentBounds;
  }
  const policy=require('../composition-engine/artwork-policy');
  const productArtwork=['concession-combo','concession-offer','club-plan'].includes(draft.templateId);
  draft.artworkPolicy=policy.resolveArtworkPolicy(draft,analysis,Boolean(!productArtwork && movie?.backdropUrl && backgroundBuffer));
  draft.primaryElement=draft.artworkPolicy.primaryElement;
  if(!concession && !draft.movieFamily && ['BACKDROP_HERO','FULL_BLEED'].includes(draft.artworkPolicy.strategy)) {sourceUrl=backgroundUrl;sourceBuffer=backgroundBuffer;}
  if(sourceBuffer) {const meta=await sharp(sourceBuffer).metadata();draft.sourceAsset={width:meta.width,height:meta.height};}
  if(!concession && !draft.movieFamily && !['ticket-offer','concession-offer'].includes(draft.templateId)) {
    draft.style = selectDirection(draft, analysis);
    if(draft.artworkPolicy.strategy==='FULL_BLEED') draft.style='full-bleed';
    if(draft.automaticStyle && ['LOGO_DOMINANT','SYMBOL_DOMINANT','FULL_POSTER'].includes(draft.artworkPolicy.strategy)) draft.style='hero-center';
    if(draft.automaticStyle && draft.artworkPolicy.dryArtwork && draft.artworkPolicy.strategy==='POSTER_BLEND') draft.style='poster-dominant';
  }
  if(draft.templateId==='ticket-offer') draft.style=require('../contracts/ticket-campaign').selectTicketFamily(draft,Boolean(sourceBuffer));
  draft.layoutId = require('../contracts/campaign').normalizeDesign({...draft,layoutId:undefined}).layoutId;
  let fullBleed = false;
  if (draft.style === "full-bleed" && backgroundBuffer && backgroundUrl === movie?.backdropUrl) {
    const metadata = await sharp(backgroundBuffer).metadata();
    fullBleed = metadata.width >= 1000 && metadata.width / metadata.height >= 1.3;
    if(fullBleed) {
      const frame={focusX:analysis?.focusX>50?23:77,focusY:45,scale:1,...draft.artDirection.background};
      const raster=await require("../composition-engine/pipeline").createCinematicArtwork(backgroundBuffer,{width:320,height:Math.round(320*format.height/format.width),fit:"cover",focusX:frame.focusX,focusY:frame.focusY,effects:{...frame,layer:"background"}});
      analysis={...await analyzeArtwork(raster),backgroundFrame:frame};
    }
  }
  let palette = applyPalette(draft.paletteMode === "brand"
    ? { dominantColor: brand.primaryColor, secondaryColor: brand.secondaryColor, accentColor: brand.accentColor, textColor: brand.textColor }
    : await extractPalette(sourceBuffer, brand), draft.paletteId);
  const backgroundMovieUrls = [];
  const backgroundMovieColors = [];
  if (['multi-movies','sessions-today','sessions-week'].includes(draft.templateId)) {
    const otherPalettes = [];
    const featuredId = String(draft.entities.movie?.id || '');
    for (const item of draft.programMovies.filter(item => String(item.id) !== featuredId)) {
      if (backgroundMovieUrls.length >= 2) break;
      const candidates = [item.backdropUrl, item.posterUrl].filter(Boolean);
      for (const url of candidates) {
        if (url === backgroundUrl || backgroundMovieUrls.includes(url)) continue;
        const buffer = await loadAsset(url, loadImage);
        if (!buffer) continue;
        backgroundMovieUrls.push(url);
        if (draft.paletteMode !== 'brand' && draft.paletteId === 'automatic') {
          const color = await extractPalette(buffer, brand);
          otherPalettes.push(color);
          backgroundMovieColors.push(color.dominantColor);
        }
        break;
      }
    }
    if (otherPalettes.length) palette = require('./palette').blendProgramPalettes(palette, otherPalettes);
  }
  let logoUrl = signatureUrl(draft, context);
  if((draft.templateId==='ticket-offer' || concession || draft.movieFamily) && logoUrl) {
    const logo=await loadArtwork(logoUrl);
    if(!logo) logoUrl='';
    else {const metadata=await sharp(logo).metadata();draft.signatureAsset={width:metadata.width,height:metadata.height};}
  }
  const template = templateById(draft.templateId);
  const outputType = draft.outputType === "jpg" ? "jpg" : "png";
  const offerTemplate=['ticket-offer','concession-offer'].includes(draft.templateId);
  let scene = concession ? null : offerTemplate
    ? require('../scene/offer').buildOfferScene({draft,format,brand,logoUrl,sourceUrl:sourceBuffer ? sourceUrl : ''})
    : buildEditableScene({ draft, format, palette, brand, sourceUrl: sourceBuffer ? sourceUrl : "", backgroundUrl, fullBleed, logoUrl, analysis });
  if(concession) {
    const {buildConcessionScene,productBounds}=require('../scene/concession');
    const assetBounds=await productBounds(sourceBuffer);
    if(!assetBounds) throw Object.assign(new Error('Selecione uma imagem válida do produto antes de gerar a campanha.'),{statusCode:422,code:'PRODUCT_IMAGE_REQUIRED'});
    draft.style=draft.concessionDirection.layout;
    draft.layoutId=draft.style;
    scene=buildConcessionScene({draft,format,brand,sourceUrl,logoUrl,assetBounds});
  }
  if (['sessions-today','sessions-week','multi-movies'].includes(draft.templateId)) scene = require('../programming/builders').buildProgrammingScene({draft,format,palette,brand,logoUrl,baseScene:scene,backgroundMovieUrls,backgroundMovieColors});
  else if(!concession && !draft.movieFamily) {
    if (draft.polish && !offerTemplate) scene = require("../composition-engine/polish").polishComposition(scene);
    if(!offerTemplate) scene = require('../scene/content-layout').enforceContentLayout(scene);
  }
  const visualStyle=draft.visualStyle;
  await require('../scene/customization').applyBackground(scene,draft,context,loadImage);
  for(const element of scene.elements.filter(e=>e.type==='text' && !offerTemplate && !concession && !draft.movieFamily)) {
    if(visualStyle==='clean') {element.fontFamily='Social Text';element.fontWeight=element.hierarchy==='primary'?800:600;}
    if(visualStyle==='impact' && ['title','detail'].includes(element.id)) element.fill=palette.accentColor;
    if(visualStyle==='minimal' && !['title','detail'].includes(element.id)) element.fontWeight=500;
  }
  if(!concession && !draft.movieFamily) policy.applyArtworkPolicy(scene);
  if(!concession && !draft.movieFamily) await ensureTextContrast(scene, loadImage);
  if(!offerTemplate && !concession && !draft.movieFamily) await require('../scene/branding').applySignatureGeometry(scene,loadImage);
  require('../scene/customization').positionSignature(scene);
  let artworkQuality;
  const artworkGate=require('../composition-engine/artwork-quality');
  if(artworkGate.applies(scene)) {
    try {
      await artworkGate.reserveSignature(scene,loadImage);
      await artworkGate.repairContrast(scene,loadImage);
      artworkQuality=await artworkGate.assessArtwork(scene,loadImage);
      if(!artworkQuality.accepted)throw artworkGate.failure(artworkQuality);
    } catch(error) {
      if(error.code!=='ARTWORK_QUALITY' || options.artworkRetried)throw error;
      const isMovie=require('../contracts/artwork-layout').isMovie(draft);
      const layouts=isMovie?['poster-lateral','poster-editorial','cinematic-story']:draft.templateId==='multi-movies'?['cinematic-grid','lineup']:['poster-list','cinema-board'];
      for(const layout of layouts) {
        try {
          const alternative=await renderSocialPostV2({...input,...(isMovie?{layoutId:layout,style:layout,automaticStyle:false}:{programLayout:layout}),signaturePosition:{mode:'automatic'}},context,{...options,artworkRetried:true});
          alternative.notices.push({type:'info',code:'ARTWORK_REFLOW',message:'A composição foi reorganizada para preservar imagem, leitura e assinatura.'});
          if(draft.style==='full-bleed' && !fullBleed)alternative.notices.push({type:'info',code:'BACKDROP_FALLBACK',message:'Sem backdrop adequado: o pôster foi preservado em uma composição editorial.'});
          return alternative;
        } catch(next) {if(next.code!=='ARTWORK_QUALITY')throw next;}
      }
      throw error;
    }
  }
  let concessionQuality;
  if(concession) {
    const gate=require('../composition-engine/concession-quality');
    const logo=scene.elements.find(e=>e.role==='logo');
    if(logo && gate.inspectConcessionLayout(scene).issues.some(i=>i.elementId?.includes('logo'))) Object.assign(logo,scene.sourceDraft.concessionLogoBounds);
    await gate.repairConcessionContrast(scene,loadImage);
    concessionQuality=await gate.assessConcession(scene,loadImage);
    if(!concessionQuality.accepted) {
      if(!options.concessionRetried) {
        const alternatives=Object.keys(require('../contracts/artwork-layout').PRODUCT_LAYOUTS).filter(layout=>layout!==draft.concessionDirection.layout);
        for(const layout of alternatives) {
          try {
            const alternative=await renderSocialPostV2({...input,layoutId:layout,concessionDirection:{...draft.concessionDirection,layout}},context,{...options,concessionRetried:true});
            alternative.notices.push({type:'info',code:'CONCESSION_REFLOW',message:'A direção foi ajustada para preservar a leitura e evitar sobreposições.'});
            return alternative;
          } catch(error) {if(error.code!=='CONCESSION_QUALITY')throw error;}
        }
      }
      throw gate.qualityError(concessionQuality);
    }
  }
  if(draft.templateId==='ticket-offer') require('../scene/groups').groupElements(scene,'price-hero',['currency','detail'],'price');
  require('../scene/groups').groupCampaignScene(scene);
  const semantics = require('../scene/groups').validateSceneSemantics(scene);
  if(!semantics.valid) throw Object.assign(new Error(semantics.errors.map(e=>e.message).join(' ')),{statusCode:400,code:'SCENE_SEMANTICS'});
  const quality = {...scoreComposition(scene),...(concessionQuality || artworkQuality || {})};
  if(!concession && !offerTemplate && draft.automaticStyle && !options.directionRetried && quality.issues.some(issue=>issue.code==='DRY_COMPOSITION')) {
    const alternative=await renderSocialPostV2({...input,layoutId:'hero-center',automaticStyle:false,artworkStrategy:movie?.backdropUrl?'BACKDROP_HERO':'CROPPED_POSTER'},context,{...options,directionRetried:true});
    if(alternative.quality.accepted && alternative.quality.total>quality.total) return alternative;
  }
  const rendered = options.skipRaster ? { scene, buffer: null, contentType: outputType === "jpg" ? "image/jpeg" : "image/png", extension: `.${outputType}` } : await renderSocialScene(scene, { loadImage, outputType });
  return {
    buffer: rendered.buffer,
    scene: rendered.scene,
    draft,
    format,
    palette,
    quality,
    semantics,
    analysis: analysis ? { method:analysis.method,quietest:analysis.quietest } : null,
    rendererVersion: "v2",
    template: { id: template.id, name: template.name },
    notices: [...require("./normalizer").draftNotices(draft, context), ...(draft.style === "full-bleed" && !fullBleed ? [{ type: "info", code: "BACKDROP_FALLBACK", message: "Sem backdrop horizontal em alta resolução: usando pôster integrado, sem recortar a arte." }] : [])],
    contentType: rendered.contentType,
    extension: rendered.extension,
    metrics: {
      renderMs: Number((performance.now() - startedAt).toFixed(1)),
      bytes: rendered.buffer?.length || 0,
      sourceCache: require("./assets").sourceCache.stats(),
      paletteCache: require("./palette").paletteCache.stats(),
      compositionCache: require("../composition-engine/pipeline").compositionCacheStats()
    }
  };
}

module.exports = { renderSocialPostV2, signatureUrl };
