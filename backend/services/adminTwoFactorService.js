const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_ISSUER = "Cine Cruzeiro Admin";

function base32Encode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Segredo TOTP invalido.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function normalizeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function totp(secret, options = {}) {
  const period = Number(options.period || 30);
  const digits = Number(options.digits || 6);
  const timestamp = Number(options.timestamp || Date.now());
  const counter = Math.floor(timestamp / 1000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, "0");
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyTotp(secret, code, options = {}) {
  const normalized = normalizeCode(code);
  if (normalized.length !== 6 || !secret) return false;
  const timestamp = Number(options.timestamp || Date.now());
  const window = Math.max(0, Number(options.window ?? 1));
  for (let drift = -window; drift <= window; drift += 1) {
    if (secureEqual(totp(secret, { ...options, timestamp: timestamp + drift * Number(options.period || 30) * 1000 }), normalized)) return true;
  }
  return false;
}

function encryptionKey() {
  const source = process.env.TWO_FACTOR_SECRET_KEY || process.env.INTEGRATION_SECRET_KEY || process.env.JWT_SECRET || "cine-cruzeiro-local-dev-secret";
  return crypto.createHash("sha256").update(source).digest();
}

function encryptSecret(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value) {
  const [version, ivRaw, tagRaw, encryptedRaw] = String(value || "").split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function normalizeRecoveryCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(value) {
  const pepper = process.env.TWO_FACTOR_RECOVERY_PEPPER || process.env.JWT_SECRET || "cine-cruzeiro-local-dev-secret";
  return crypto.createHmac("sha256", pepper).update(normalizeRecoveryCode(value)).digest("base64url");
}

function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

function recoveryCodeIndex(hashes, value) {
  const candidate = hashRecoveryCode(value);
  return (Array.isArray(hashes) ? hashes : []).findIndex((hash) => secureEqual(hash, candidate));
}

function otpauthUrl(secret, email, options = {}) {
  const issuer = String(options.issuer || DEFAULT_ISSUER);
  const account = String(email || "administrador");
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  normalizeCode,
  totp,
  verifyTotp,
  encryptSecret,
  decryptSecret,
  normalizeRecoveryCode,
  hashRecoveryCode,
  generateRecoveryCodes,
  recoveryCodeIndex,
  otpauthUrl
};
