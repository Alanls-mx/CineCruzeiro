const path = require("path");
const fs = require("fs/promises");
const sharp = require("sharp");

const TMDB_IMAGE_HOST = "image.tmdb.org";
const IMAGE_FIELDS = ["posterUrl", "backdropUrl"];

function isTmdbImageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === TMDB_IMAGE_HOST && url.pathname.startsWith("/t/p/");
  } catch {
    return false;
  }
}

function safeMovieFolder(movieId) {
  return `movies-${String(movieId || "movie").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "movie"}`;
}

function tmdbSourceForField(movie, field) {
  const currentUrl = String(movie?.[field] || "");
  if (isTmdbImageUrl(currentUrl)) return { sourceUrl: currentUrl, previousUrl: currentUrl };
  const metadataKey = field === "posterUrl" ? "tmdbPosterSourceUrl" : "tmdbBackdropSourceUrl";
  const sourceUrl = String(movie?.metadata?.[metadataKey] || "");
  const localizedFolder = `/uploads/${safeMovieFolder(movie?.id)}/`;
  const isLegacyLocalizedImage = currentUrl.startsWith(localizedFolder) && !/\.jpe?g(?:$|[?#])/i.test(currentUrl);
  return isLegacyLocalizedImage && isTmdbImageUrl(sourceUrl)
    ? { sourceUrl, previousUrl: currentUrl }
    : null;
}

function needsLocalization(movie) {
  return IMAGE_FIELDS.some((field) => Boolean(tmdbSourceForField(movie, field)));
}

function createMovieImageService({ storageService, fetchImpl = global.fetch, timeoutMs = 12000, maxBytes = 5 * 1024 * 1024 }) {
  if (!storageService?.uploadImageBuffer) throw new Error("Storage de imagens indisponível.");

  async function download(sourceUrl, movieId, field) {
    if (!isTmdbImageUrl(sourceUrl)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(sourceUrl, {
        signal: controller.signal,
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" }
      });
      if (!response.ok) throw new Error(`TMDB respondeu HTTP ${response.status}.`);
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > maxBytes) throw new Error("Imagem do TMDB excede o limite permitido.");
      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      if (sourceBuffer.length > maxBytes) throw new Error("Imagem do TMDB excede o limite permitido.");
      const buffer = await sharp(sourceBuffer).rotate().jpeg({ quality: 88, progressive: true }).toBuffer();
      return storageService.uploadImageBuffer({
        buffer,
        filename: `${field === "posterUrl" ? "poster" : "backdrop"}-${movieId}.jpg`,
        contentType: "image/jpeg",
        folder: safeMovieFolder(movieId)
      });
    } catch (cause) {
      const error = new Error(`Não foi possível baixar ${field === "posterUrl" ? "o pôster" : "a capa"} do TMDB: ${cause.message || "falha desconhecida"}`);
      error.code = "TMDB_IMAGE_DOWNLOAD_FAILED";
      error.statusCode = 502;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function localizeMovie(movie) {
    const candidates = IMAGE_FIELDS
      .map((field) => ({ field, ...tmdbSourceForField(movie, field) }))
      .filter(({ sourceUrl }) => Boolean(sourceUrl));
    const results = await Promise.allSettled(candidates.map(async ({ field, sourceUrl, previousUrl }) => {
      const uploaded = await download(sourceUrl, movie.id, field);
      return { field, sourceUrl, previousUrl, localUrl: uploaded.url, path: uploaded.path };
    }));
    const assets = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      await Promise.all(assets.map((asset) => storageService.deleteByPublicUrl(asset.localUrl)));
      throw failed.reason;
    }
    if (!assets.length) return { movie, assets, changed: false };
    const next = { ...movie, metadata: { ...(movie.metadata || {}) } };
    for (const asset of assets) {
      next[asset.field] = asset.localUrl;
      next.metadata[asset.field === "posterUrl" ? "tmdbPosterSourceUrl" : "tmdbBackdropSourceUrl"] = asset.sourceUrl;
    }
    next.metadata.imagesLocalizedAt = new Date().toISOString();
    return { movie: next, assets, changed: true };
  }

  async function cleanupAssets(assets = []) {
    await Promise.all(assets.map((asset) => storageService.deleteByPublicUrl(asset.localUrl || asset)));
  }

  async function pruneLocalizedAssets(movie) {
    const folder = safeMovieFolder(movie?.id);
    const folderPath = path.join(storageService.rootDir, folder);
    const activeFiles = new Set(IMAGE_FIELDS.map((field) => {
      const value = String(movie?.[field] || "");
      return value.startsWith(`/uploads/${folder}/`) ? path.basename(value) : "";
    }).filter(Boolean));
    const entries = await fs.readdir(folderPath, { withFileTypes: true }).catch(() => []);
    const obsolete = entries.filter((entry) => (
      entry.isFile()
      && /^(poster|backdrop)-/i.test(entry.name)
      && !activeFiles.has(entry.name)
    ));
    await Promise.all(obsolete.map((entry) => fs.unlink(path.join(folderPath, entry.name)).catch(() => false)));
    return obsolete.length;
  }

  return { isTmdbImageUrl, needsLocalization, localizeMovie, cleanupAssets, pruneLocalizedAssets };
}

module.exports = { createMovieImageService, isTmdbImageUrl, needsLocalization, IMAGE_FIELDS };
