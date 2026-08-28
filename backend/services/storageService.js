const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const SUPPORTED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

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
    : path.join(publicDir, publicBasePath.replace(/^\//, ""));

  async function uploadImage({ data, filename = "", contentType = "", folder = "general" }) {
    const parsed = parseBase64Image(data);
    const declaredType = String(contentType || parsed.contentType || "").toLowerCase().replace("image/jpg", "image/jpeg");
    const detectedType = detectedImageType(parsed.buffer);
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
    if (!parsed.buffer.length) {
      const error = new Error("Arquivo de imagem vazio.");
      error.statusCode = 400;
      throw error;
    }
    if (parsed.buffer.length > maxBytes) {
      const error = new Error(`Imagem muito grande. Envie um arquivo de até ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      error.statusCode = 413;
      throw error;
    }

    const baseName = path.basename(String(filename || "imagem"), path.extname(String(filename || "")));
    const safeName = baseName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "imagem";
    const targetFolder = sanitizeFolder(folder);
    const targetDir = path.join(rootDir, targetFolder);
    await fs.mkdir(targetDir, { recursive: true });

    const fileName = `${safeName}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extension}`;
    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, parsed.buffer);

    return {
      path: filePath,
      url: `${publicBasePath}/${targetFolder}/${fileName}`,
      contentType: detectedType,
      size: parsed.buffer.length
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
    deleteByPublicUrl,
    getPublicUrl(filePath) {
      const normalized = path.normalize(filePath);
      if (!insideRoot(rootDir, normalized)) return "";
      return `${publicBasePath}/${path.relative(rootDir, normalized).replace(/\\/g, "/")}`;
    }
  };
}

module.exports = { createStorageService, SUPPORTED_IMAGE_TYPES };
