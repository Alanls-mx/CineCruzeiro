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

function createStorageService({ publicDir, publicBasePath = "/uploads", maxBytes = DEFAULT_MAX_BYTES }) {
  const rootDir = path.join(publicDir, publicBasePath.replace(/^\//, ""));

  async function uploadImage({ data, filename = "", contentType = "", folder = "general" }) {
    const parsed = parseBase64Image(data);
    const type = String(contentType || parsed.contentType || "").toLowerCase();
    const extension = SUPPORTED_IMAGE_TYPES.get(type) || SUPPORTED_IMAGE_TYPES.get(parsed.contentType);
    if (!extension) {
      const error = new Error("Formato de imagem não permitido. Use JPG, PNG ou WebP.");
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
      contentType: type || parsed.contentType,
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
    if (!filePath.startsWith(rootDir)) return false;
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
      if (!normalized.startsWith(rootDir)) return "";
      return `${publicBasePath}/${path.relative(rootDir, normalized).replace(/\\/g, "/")}`;
    }
  };
}

module.exports = { createStorageService, SUPPORTED_IMAGE_TYPES };
