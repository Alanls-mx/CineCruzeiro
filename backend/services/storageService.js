const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const SUPPORTED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const AI_FILENAME_PREFIX = /^(?:ai|ia|dall[-_ ]?e|midjourney|chatgpt|openai|gemini|imagegen|generated(?:[-_ ]by[-_ ]ai)?)(?=$|[-_. ])[\s_.-]*/i;

function hasAiFilenamePrefix(filename) {
  const baseName = path.basename(String(filename || ""), path.extname(String(filename || "")));
  return AI_FILENAME_PREFIX.test(baseName);
}

function normalizeImageBaseName(filename) {
  const original = path.basename(String(filename || "imagem"), path.extname(String(filename || "")));
  const hasAiPrefix = hasAiFilenamePrefix(filename);
  const withoutPrefix = hasAiPrefix ? original.replace(AI_FILENAME_PREFIX, "") : original;
  const safeRemainder = withoutPrefix
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, hasAiPrefix ? 34 : 48);
  if (!hasAiPrefix) return safeRemainder || "imagem";
  return `cine-cruzeiro${safeRemainder ? `-${safeRemainder}` : "-imagem"}`.slice(0, 48).replace(/-+$/g, "");
}

function cineCruzeiroXmp() {
  const year = new Date().getUTCFullYear();
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Imagem oficial do Cine Cruzeiro</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>Cine Cruzeiro</rdf:li></rdf:Seq></dc:creator>
      <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Copyright ${year} Cine Cruzeiro</rdf:li></rdf:Alt></dc:rights>
      <xmp:CreatorTool>Cine Cruzeiro Media Pipeline</xmp:CreatorTool>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

async function sanitizeImageBuffer(buffer, contentType) {
  let pipeline = sharp(buffer, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
  if (contentType === "image/jpeg") pipeline = pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4", progressive: true });
  else if (contentType === "image/png") pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  else pipeline = pipeline.webp({ quality: 92, alphaQuality: 100, smartSubsample: true });
  return pipeline
    .withExif({ IFD0: {
      Artist: "Cine Cruzeiro",
      Copyright: `Copyright ${new Date().getUTCFullYear()} Cine Cruzeiro`,
      ImageDescription: "Imagem oficial do Cine Cruzeiro",
      Software: "Cine Cruzeiro Media Pipeline"
    } })
    .withXmp(cineCruzeiroXmp())
    .toBuffer();
}

function sanitizeFolder(value) {
  return String(value || "general")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "general";
}

function parseBase64Image(data) {
  const raw = String(data || "");
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      contentType: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], "base64")
    };
  }
  return {
    contentType: "",
    buffer: Buffer.from(raw, "base64")
  };
}

function detectedImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function insideRoot(rootDir, filePath) {
  const relative = path.relative(rootDir, filePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function createStorageService({ publicDir, publicBasePath = "/uploads", rootDir: configuredRootDir = "", maxBytes = DEFAULT_MAX_BYTES }) {
  const rootDir = configuredRootDir
    ? path.resolve(configuredRootDir)
    : path.resolve(publicDir, publicBasePath.replace(/^\//, ""));

  async function uploadImage({ data, filename = "", contentType = "", folder = "general" }) {
    const parsed = parseBase64Image(data);
    return uploadImageBuffer({ buffer: parsed.buffer, filename, contentType: contentType || parsed.contentType, folder });
  }

  async function uploadImageBuffer({ buffer, filename = "", contentType = "", folder = "general" }) {
    const imageBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
    const declaredType = String(contentType || "").toLowerCase().split(";")[0].trim().replace("image/jpg", "image/jpeg");
    const detectedType = detectedImageType(imageBuffer);
    const extension = SUPPORTED_IMAGE_TYPES.get(detectedType);
    if (!extension) {
      const error = new Error("Formato de imagem não permitido. Use JPG, PNG ou WebP.");
      error.statusCode = 415;
      throw error;
    }
    if (declaredType && declaredType !== detectedType) {
      const error = new Error("O conteúdo do arquivo não corresponde ao formato de imagem informado.");
      error.statusCode = 415;
      throw error;
    }
    if (!imageBuffer.length) {
      const error = new Error("Arquivo de imagem vazio.");
      error.statusCode = 400;
      throw error;
    }
    if (imageBuffer.length > maxBytes) {
      const error = new Error(`Imagem muito grande. Envie um arquivo de até ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      error.statusCode = 413;
      throw error;
    }

    let sanitizedBuffer;
    try {
      sanitizedBuffer = await sanitizeImageBuffer(imageBuffer, detectedType);
    } catch {
      const error = new Error("Não foi possível processar a imagem enviada.");
      error.statusCode = 415;
      throw error;
    }
    if (sanitizedBuffer.length > maxBytes) {
      const error = new Error(`A imagem processada excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      error.statusCode = 413;
      throw error;
    }

    const safeName = normalizeImageBaseName(filename);
    const targetFolder = sanitizeFolder(folder);
    const targetDir = path.resolve(rootDir, targetFolder);
    if (!insideRoot(rootDir, targetDir)) {
      const error = new Error("Operação de armazenamento não permitida.");
      error.statusCode = 400;
      throw error;
    }
    await fs.mkdir(targetDir, { recursive: true });
    const [realRoot, realTarget] = await Promise.all([fs.realpath(rootDir), fs.realpath(targetDir)]);
    if (!insideRoot(realRoot, realTarget)) {
      const error = new Error("Operação de armazenamento não permitida.");
      error.statusCode = 400;
      throw error;
    }

    const fileName = `${safeName}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
    const filePath = path.resolve(targetDir, fileName);
    if (!insideRoot(rootDir, filePath)) {
      const error = new Error("Operação de armazenamento não permitida.");
      error.statusCode = 400;
      throw error;
    }
    await fs.writeFile(filePath, sanitizedBuffer, { flag: "wx" });

    return {
      path: filePath,
      url: `${publicBasePath}/${targetFolder}/${fileName}`,
      contentType: detectedType,
      size: sanitizedBuffer.length
    };
  }

  async function deleteByPublicUrl(url) {
    let value = String(url || "");
    const uploadIndex = value.indexOf(`${publicBasePath}/`);
    if (uploadIndex > 0) value = value.slice(uploadIndex);
    if (!value.startsWith(`${publicBasePath}/`)) return false;
    const relative = value.replace(publicBasePath, "").replace(/^\/+/, "");
    const filePath = path.normalize(path.join(rootDir, relative));
    if (!insideRoot(rootDir, filePath)) return false;
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  return {
    rootDir,
    uploadImage,
    uploadImageBuffer,
    deleteByPublicUrl,
    getPublicUrl(filePath) {
      const normalized = path.normalize(filePath);
      if (!insideRoot(rootDir, normalized)) return "";
      return `${publicBasePath}/${path.relative(rootDir, normalized).replace(/\\/g, "/")}`;
    }
  };
}

module.exports = { createStorageService, SUPPORTED_IMAGE_TYPES, hasAiFilenamePrefix, normalizeImageBaseName, sanitizeImageBuffer };
