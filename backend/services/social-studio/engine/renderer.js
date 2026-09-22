const { performance } = require("perf_hooks");
const legacy = require("../../socialStudioService");
const { loadAsset, sourceUrlForDraft } = require("./assets");
const { normalizeV2Draft } = require("./normalizer");
const { extractPalette } = require("./palette");
const { templateById } = require("../templates/registry");
const { buildEditableScene } = require("../scene/factory");
const { renderSocialScene } = require("../scene/renderer");

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
  const format = legacy.formatById(draft.formatId);
  const brand = legacy.normalizeBrand(context.brand || {});
  const loadImage = typeof options.loadImage === "function" ? options.loadImage : async () => null;

  const sourceUrl = sourceUrlForDraft(draft);
  const sourceBuffer = await loadAsset(sourceUrl, loadImage);
  const palette = draft.paletteMode === "brand"
    ? { dominantColor: brand.primaryColor, secondaryColor: brand.secondaryColor, accentColor: brand.accentColor, textColor: brand.textColor }
    : await extractPalette(sourceBuffer, brand);
  const logoUrl = signatureUrl(draft, context);
  const template = templateById(draft.templateId);
  const outputType = draft.outputType === "jpg" ? "jpg" : "png";
  const scene = buildEditableScene({ draft, format, palette, brand, sourceUrl, logoUrl });
  const rendered = await renderSocialScene(scene, { loadImage, outputType });
  return {
    buffer: rendered.buffer,
    scene: rendered.scene,
    draft,
    format,
    palette,
    rendererVersion: "v2",
    template: { id: template.id, name: template.name },
    notices: require("./normalizer").draftNotices(draft, context),
    contentType: rendered.contentType,
    extension: rendered.extension,
    metrics: {
      renderMs: Number((performance.now() - startedAt).toFixed(1)),
      bytes: rendered.buffer.length,
      sourceCache: require("./assets").sourceCache.stats(),
      paletteCache: require("./palette").paletteCache.stats()
    }
  };
}

module.exports = { renderSocialPostV2, signatureUrl };
