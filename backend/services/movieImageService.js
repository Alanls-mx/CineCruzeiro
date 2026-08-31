const path = require("path");

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
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) throw new Error("Imagem do TMDB excede o limite permitido.");
      const extension = path.extname(new URL(sourceUrl).pathname) || ".jpg";
      return storageService.uploadImageBuffer({
        buffer,
        filename: `${field === "posterUrl" ? "poster" : "backdrop"}-${movieId}${extension}`,
        contentType: response.headers.get("content-type") || "",
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
      .map((field) => ({ field, sourceUrl: String(movie?.[field] || "") }))
      .filter(({ sourceUrl }) => isTmdbImageUrl(sourceUrl));
    const results = await Promise.allSettled(candidates.map(async ({ field, sourceUrl }) => {
      const uploaded = await download(sourceUrl, movie.id, field);
      return { field, sourceUrl, localUrl: uploaded.url, path: uploaded.path };
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

  return { isTmdbImageUrl, localizeMovie, cleanupAssets };
}

module.exports = { createMovieImageService, isTmdbImageUrl, IMAGE_FIELDS };
