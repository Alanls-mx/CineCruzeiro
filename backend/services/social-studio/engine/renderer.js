const { performance } = require("perf_hooks");
const sharp = require("sharp");
const legacy = require("../../socialStudioService");
const { loadAsset, prepareArtwork, prepareLogo, sourceUrlForDraft } = require("./assets");
const { socialStudioFonts } = require("./fonts");
const { normalizeV2Draft } = require("./normalizer");
const { extractPalette } = require("./palette");
const { templateById } = require("../templates/registry");

let satoriPromise = null;

async function satoriRenderer() {
  if (!satoriPromise) satoriPromise = import("satori").then((module) => module.default || module);
  return satoriPromise;
}

function signatureUrl(draft, context = {}) {
  if (draft.signatureId === "none") return "";
  const brand = context.brand || {};
  if (draft.signatureId === "automatic") return brand.posterLogoUrl || brand.logoUrl || "";
  if (draft.signatureId === "classic") return brand.logoUrl || "";
  const signature = legacy.SOCIAL_SIGNATURES.find((item) => item.id === draft.signatureId);
  return signature?.imageUrl || brand.posterLogoUrl || brand.logoUrl || "";
}

function logoBounds(format, draft) {
  const story = format.id === "story";
  const scale = Number(draft.signatureScale || 100) / 100;
  return {
    width: Math.round((story ? 460 : 370) * scale),
    height: Math.round((story ? 270 : 218) * scale)
  };
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
  const artwork = sourceBuffer ? await prepareArtwork(sourceBuffer, format, draft) : "";

  const logoUrl = signatureUrl(draft, context);
  const logoBuffer = await loadAsset(logoUrl, loadImage);
  const logoSize = logoBounds(format, draft);
  const logo = logoBuffer ? await prepareLogo(logoBuffer, logoSize.width, logoSize.height) : "";

  const template = templateById(draft.templateId);
  const element = template.render({ draft, format, palette, brand, assets: { artwork, logo } });
  const satori = await satoriRenderer();
  const svg = await satori(element, {
    width: format.width,
    height: format.height,
    fonts: socialStudioFonts()
  });
  let pipeline = sharp(Buffer.from(svg), { failOn: "error", density: 72 });
  const outputType = draft.outputType === "jpg" ? "jpg" : "png";
  const buffer = outputType === "jpg"
    ? await pipeline.flatten({ background: brand.primaryColor }).jpeg({ quality: 94, chromaSubsampling: "4:4:4", progressive: true }).toBuffer()
    : await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
  return {
    buffer,
    draft,
    format,
    palette,
    rendererVersion: "v2",
    template: { id: template.id, name: template.name },
    notices: require("./normalizer").draftNotices(draft, context),
    contentType: outputType === "jpg" ? "image/jpeg" : "image/png",
    extension: outputType === "jpg" ? ".jpg" : ".png",
    metrics: {
      renderMs: Number((performance.now() - startedAt).toFixed(1)),
      bytes: buffer.length,
      sourceCache: require("./assets").sourceCache.stats(),
      paletteCache: require("./palette").paletteCache.stats()
    }
  };
}

module.exports = { renderSocialPostV2, signatureUrl };
