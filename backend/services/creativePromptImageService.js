const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function invalidImage(message, code = "CREATIVE_PROMPT_IMAGE_INVALID") {
  return Object.assign(new Error(message), { statusCode: 422, code });
}

async function localImage(root, pathname) {
  const resolvedRoot = await fs.realpath(root).catch(() => "");
  if (!resolvedRoot) throw invalidImage("O armazenamento de imagens não está disponível.");
  const file = path.resolve(resolvedRoot, `.${pathname}`);
  const realFile = await fs.realpath(file).catch(() => "");
  const relative = path.relative(resolvedRoot, realFile);
  if (!realFile || !relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw invalidImage("A imagem não está disponível no armazenamento autorizado.");
  }
  const stat = await fs.stat(realFile);
  if (stat.size > MAX_SOURCE_BYTES) throw invalidImage("A imagem excede o limite de 6 MB.", "CREATIVE_PROMPT_IMAGE_TOO_LARGE");
  return fs.readFile(realFile);
}

async function remoteTmdbImage(url, fetcher) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "image.tmdb.org" || !parsed.pathname.startsWith("/t/p/")) {
    throw invalidImage("A imagem remota não pertence ao catálogo permitido.");
  }
  let response;
  try {
    response = await fetcher(parsed.toString(), {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      headers: { Accept: "image/jpeg,image/png,image/webp" }
    });
  } catch {
    throw invalidImage("Não foi possível carregar a arte do catálogo.");
  }
  if (!response.ok) throw invalidImage("Não foi possível carregar a arte do filme.");
  if (!response.body) throw invalidImage("A arte do catálogo veio vazia.");
  if (Number(response.headers.get("content-length") || 0) > MAX_SOURCE_BYTES) {
    throw invalidImage("A imagem excede o limite de 6 MB.", "CREATIVE_PROMPT_IMAGE_TOO_LARGE");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_SOURCE_BYTES) {
      await response.body.cancel().catch(() => {});
      throw invalidImage("A imagem excede o limite de 6 MB.", "CREATIVE_PROMPT_IMAGE_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function stripBase(url, basePath) {
  const value = String(url || "").trim();
  const base = String(basePath || "").replace(/\/$/, "");
  return base && value.startsWith(`${base}/`) ? value.slice(base.length) : value;
}

async function imageDataUrl(url, { uploadRoot, publicRoot, basePath = "", uploadOnly = false, fetcher = fetch }) {
  const value = stripBase(url, basePath);
  const localPath = value.split(/[?#]/, 1)[0];
  let source;
  if (/^https:\/\//i.test(value) && !uploadOnly) {
    source = await remoteTmdbImage(value, fetcher);
  } else if (localPath.startsWith("/uploads/creative-prompts/")) {
    source = await localImage(uploadRoot, localPath.slice("/uploads".length));
  } else if (localPath.startsWith("/uploads/") && !uploadOnly) {
    source = await localImage(uploadRoot, localPath.slice("/uploads".length));
  } else if (localPath.startsWith("/images/") && !uploadOnly) {
    source = await localImage(publicRoot, localPath);
  } else {
    throw invalidImage("Use uma arte do catálogo ou envie JPG, PNG ou WebP pelo painel.");
  }
  if (source.length > MAX_SOURCE_BYTES) throw invalidImage("A imagem excede o limite de 6 MB.", "CREATIVE_PROMPT_IMAGE_TOO_LARGE");
  let result;
  try {
    const image = sharp(source, { failOn: "error", limitInputPixels: MAX_PIXELS });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("unsupported");
    result = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true }).toBuffer();
  } catch {
    throw invalidImage("A imagem é inválida ou excede o limite de resolução.");
  }
  return `data:image/jpeg;base64,${result.toString("base64")}`;
}

module.exports = { imageDataUrl, stripBase, MAX_SOURCE_BYTES };
