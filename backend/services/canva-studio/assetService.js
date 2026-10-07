const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const repository = require("./studioRepository");
const { studioError } = require("./campaignPlanner");

const ROOTS = [path.resolve(__dirname, "../../public"), path.resolve(__dirname, "../../../public")];
const MAX_BYTES = 20 * 1024 * 1024;

async function loadImage(source, { allowSmall = false } = {}) {
  if (!source) return null;
  const value = String(source);
  let bytes;
  if (value.startsWith("https://image.tmdb.org/t/p/")) {
    const response = await fetch(value, { signal: AbortSignal.timeout(12000), redirect: "error" });
    if (!response.ok || !String(response.headers.get("content-type") || "").startsWith("image/")) throw studioError("STUDIO_ARTWORK_UNAVAILABLE", "A arte do filme não pôde ser carregada.", 422);
    if (Number(response.headers.get("content-length") || 0) > MAX_BYTES) throw studioError("STUDIO_ARTWORK_TOO_LARGE", "A arte excede o limite de tamanho.", 422);
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    const uri = new URL(value, "http://localhost").pathname;
    const normalized = decodeURIComponent(uri).replace(/^\/+/, "");
    if (!/^(uploads|images)\//.test(normalized) || normalized.includes("\0")) throw studioError("STUDIO_ARTWORK_SOURCE_INVALID", "Use uma arte cadastrada no cinema ou no TMDB.", 422);
    for (const root of ROOTS) {
      const file = path.resolve(root, normalized);
      if (!file.startsWith(root + path.sep)) continue;
      try {
        const stat = await fs.stat(file);
        if (stat.size > MAX_BYTES) throw studioError("STUDIO_ARTWORK_TOO_LARGE", "A arte excede o limite de tamanho.", 422);
        bytes = await fs.readFile(file);
        break;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (!bytes) throw studioError("STUDIO_ARTWORK_UNAVAILABLE", "A arte do filme não foi encontrada no servidor.", 422);
  }
  if (bytes.length > MAX_BYTES) throw studioError("STUDIO_ARTWORK_TOO_LARGE", "A arte excede o limite de tamanho.", 422);
  let metadata;
  try { metadata = await sharp(bytes).metadata(); }
  catch { throw studioError("STUDIO_ARTWORK_INVALID", "Arquivo de imagem inválido.", 422); }
  const minSize = allowSmall ? 32 : 300;
  if (!metadata.width || !metadata.height || metadata.width < minSize || metadata.height < minSize) throw studioError("STUDIO_ARTWORK_TOO_SMALL", allowSmall ? "O logo ou title lockup é pequeno demais." : "A arte precisa ter ao menos 300 x 300 pixels.", 422);
  if (!["jpeg", "png", "webp"].includes(metadata.format)) bytes = await sharp(bytes).png().toBuffer();
  return { bytes, hash: crypto.createHash("sha256").update(bytes).digest("hex"), orientation: metadata.width > metadata.height ? "landscape" : metadata.width < metadata.height ? "portrait" : "square" };
}

async function ensureAsset(canva, accountId, source, name, options = {}) {
  const image = await loadImage(source, options);
  if (!image) return { status: "missing" };
  const cached = await repository.cachedAsset(accountId, image.hash);
  if (cached?.canva_asset_id) return { status: "ready", id: cached.canva_asset_id, orientation: image.orientation };
  if (cached?.upload_job_id) {
    const response = await canva.uploadJob(cached.upload_job_id);
    if (response.job?.status === "success" && response.job.asset?.id) {
      await repository.saveAsset({ account_id: accountId, content_hash: image.hash, canva_asset_id: response.job.asset.id, name });
      return { status: "ready", id: response.job.asset.id, orientation: image.orientation };
    }
    if (response.job?.status === "failed") throw studioError("STUDIO_ASSET_UPLOAD_FAILED", response.job.error?.message || "O Canva não aceitou a arte.", 502);
    return { status: "waiting" };
  }
  const response = await canva.createUpload(image.bytes, name);
  if (!response.job?.id) throw studioError("STUDIO_ASSET_UPLOAD_FAILED", "O Canva não retornou o job de upload.", 502);
  await repository.saveAsset({ account_id: accountId, content_hash: image.hash, upload_job_id: response.job.id, name });
  return { status: "waiting" };
}

module.exports = { loadImage, ensureAsset };
