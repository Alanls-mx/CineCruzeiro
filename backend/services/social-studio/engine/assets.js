const crypto = require("crypto");
const sharp = require("sharp");
const { LruTtlCache } = require("./cache");
const { clamp } = require("./typography");

const sourceCache = new LruTtlCache({ maxEntries: 80, ttlMs: 20 * 60 * 1000 });
const transformedCache = new LruTtlCache({ maxEntries: 48, ttlMs: 20 * 60 * 1000 });

function bufferKey(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function dataUrl(buffer, mime = "image/png") {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function loadAsset(url, loader) {
  const key = String(url || "").trim();
  if (!key || typeof loader !== "function") return null;
  return sourceCache.getOrLoad(key, async () => {
    const value = await loader(key);
    return Buffer.isBuffer(value) && value.length ? value : null;
  });
}

function imageAnchor(draft = {}) {
  const presets = {
    center: [50, 50], left: [20, 50], right: [80, 50], top: [50, 18], bottom: [50, 82]
  };
  return presets[draft.imagePreset] || [clamp(draft.imagePositionX ?? 50, 0, 100), clamp(draft.imagePositionY ?? 50, 0, 100)];
}

async function prepareArtwork(buffer, format, draft = {}) {
  if (!buffer) return "";
  const scale = clamp(draft.imageScale ?? 100, 100, 180) / 100;
  const width = Number(format.width);
  const height = Number(format.height);
  const scaledWidth = Math.max(width, Math.round(width * scale));
  const scaledHeight = Math.max(height, Math.round(height * scale));
  const [anchorX, anchorY] = imageAnchor(draft);
  const left = Math.round((scaledWidth - width) * (anchorX / 100));
  const top = Math.round((scaledHeight - height) * (anchorY / 100));
  const key = `${bufferKey(buffer)}:${width}x${height}:${scaledWidth}x${scaledHeight}:${left}:${top}:${draft.blur || 0}`;
  return transformedCache.getOrLoad(key, async () => {
    let pipeline = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize(scaledWidth, scaledHeight, { fit: "cover", position: "centre" })
      .extract({ left, top, width, height });
    if (Number(draft.blur) > 0) pipeline = pipeline.blur(Math.max(0.3, Number(draft.blur)));
    return dataUrl(await pipeline.png({ compressionLevel: 7, adaptiveFiltering: true }).toBuffer());
  });
}

async function prepareLogo(buffer, maxWidth, maxHeight) {
  if (!buffer) return "";
  const key = `${bufferKey(buffer)}:logo:${maxWidth}x${maxHeight}`;
  return transformedCache.getOrLoad(key, async () => dataUrl(await sharp(buffer, { failOn: "error" })
    .rotate()
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 8, adaptiveFiltering: true })
    .toBuffer()));
}

function sourceUrlForDraft(draft = {}) {
  if (draft.imageMode === "upload" && draft.imageUrl) return draft.imageUrl;
  const movieTemplates = ["movie-premiere", "movie-highlight", "movie-price", "movie-presale"];
  if (movieTemplates.includes(draft.templateId)) {
    const movie = draft.entities?.movie || {};
    if (draft.imageMode === "poster") return movie.posterUrl || movie.backdropUrl || "";
    if (draft.imageMode === "backdrop") return movie.backdropUrl || movie.posterUrl || "";
    if (draft.imageUrl) return draft.imageUrl;
    if (draft.formatId === "story" || ["movie-premiere", "movie-presale", "movie-price"].includes(draft.templateId)) {
      return movie.posterUrl || movie.backdropUrl || "";
    }
    return movie.backdropUrl || movie.posterUrl || "";
  }
  if (draft.imageUrl) return draft.imageUrl;
  if (draft.templateId === "concession-combo") return draft.entities?.concession?.imageUrl || "";
  if (["club-plan", "cinema-club"].includes(draft.templateId)) return draft.entities?.clubPlan?.imageUrl || "";
  return "";
}

module.exports = {
  dataUrl,
  loadAsset,
  prepareArtwork,
  prepareLogo,
  sourceCache,
  sourceUrlForDraft,
  transformedCache
};
