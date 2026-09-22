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
  if (draft.signatureId === "automatic") return brand.posterLogoUrl || brand.logoUrl || "";
  if (draft.signatureId === "classic") return brand.logoUrl || "";
  const signature = legacy.SOCIAL_SIGNATURES.find((item) => item.id === draft.signatureId);
  return signature?.imageUrl || brand.posterLogoUrl || brand.logoUrl || "";
}

async function renderSocialPostV2(input = {}, context = {}, options = {}) {
  const startedAt = performance.now();
  const draft = normalizeV2Draft(input, context);
  require('../contracts/content').assertCampaignContent(draft.content);
  const format = legacy.formatById(draft.formatId);
  const brand = legacy.normalizeBrand(context.brand || {});
  const loadImage = typeof options.loadImage === "function" ? options.loadImage : async () => null;

  const movie = draft.entities.movie;
  const automaticPoster = draft.composition.enabled && draft.imageMode === "automatic" && !draft.imageUrl;
  let sourceUrl = automaticPoster && movie?.posterUrl ? movie.posterUrl : sourceUrlForDraft(draft);
  let sourceBuffer = await loadAsset(sourceUrl, loadImage);
  let backgroundUrl = draft.composition.enabled && movie?.backdropUrl && !draft.imageUrl ? movie.backdropUrl : sourceUrl;
  let backgroundBuffer = await loadAsset(backgroundUrl, loadImage);
  if (!sourceBuffer && backgroundBuffer) { sourceUrl = backgroundUrl; sourceBuffer = backgroundBuffer; }
  if (!backgroundBuffer) { backgroundUrl = sourceUrl; backgroundBuffer = sourceBuffer; }
  let analysis = draft.artDirection.enabled ? await analyzeArtwork(sourceBuffer) : null;
  draft.style = selectDirection(draft, analysis);
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
  const palette = applyPalette(draft.paletteMode === "brand"
    ? { dominantColor: brand.primaryColor, secondaryColor: brand.secondaryColor, accentColor: brand.accentColor, textColor: brand.textColor }
    : await extractPalette(sourceBuffer, brand), draft.paletteId);
  const logoUrl = signatureUrl(draft, context);
  const template = templateById(draft.templateId);
  const outputType = draft.outputType === "jpg" ? "jpg" : "png";
  let scene = buildEditableScene({ draft, format, palette, brand, sourceUrl: sourceBuffer ? sourceUrl : "", backgroundUrl, fullBleed, logoUrl, analysis });
  if (['sessions-today','sessions-week','multi-movies'].includes(draft.templateId)) scene = require('../programming/builders').buildProgrammingScene({draft,format,palette,brand,logoUrl,baseScene:scene});
  else {
    if (draft.polish) scene = require("../composition-engine/polish").polishComposition(scene);
    scene = require('../scene/content-layout').enforceContentLayout(scene);
  }
  await ensureTextContrast(scene, loadImage);
  require('../scene/groups').groupCampaignScene(scene);
  const semantics = require('../scene/groups').validateSceneSemantics(scene);
  if(!semantics.valid) throw Object.assign(new Error(semantics.errors.map(e=>e.message).join(' ')),{statusCode:400,code:'SCENE_SEMANTICS'});
  const quality = scoreComposition(scene);
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
