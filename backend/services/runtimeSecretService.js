const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let cachedLocalSecret = "";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function configuredSecret(envKeys = []) {
  const key = envKeys.find((name) => String(process.env[name] || "").trim());
  return key ? String(process.env[key]).trim() : "";
}

function localSecretPath() {
  if (process.env.CINE_LOCAL_SECRET_FILE) return path.resolve(process.env.CINE_LOCAL_SECRET_FILE);
  if (process.env.CINE_DATA_FILE) return path.join(path.dirname(path.resolve(process.env.CINE_DATA_FILE)), ".local-secret");
  return path.join(__dirname, "..", "data", ".local-secret");
}

function readLocalSecret(filePath) {
  try {
    const value = fs.readFileSync(filePath, "utf8").trim();
    return value.length >= 43 ? value : "";
  } catch {
    return "";
  }
}

function developmentSecret() {
  if (isProduction()) return "";
  if (cachedLocalSecret) return cachedLocalSecret;

  const filePath = localSecretPath();
  cachedLocalSecret = readLocalSecret(filePath);
  if (cachedLocalSecret) return cachedLocalSecret;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const generated = crypto.randomBytes(48).toString("base64url");
  try {
    fs.writeFileSync(filePath, generated, { encoding: "utf8", flag: "wx", mode: 0o600 });
    cachedLocalSecret = generated;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    cachedLocalSecret = readLocalSecret(filePath);
  }
  if (!cachedLocalSecret) throw new Error("Não foi possível preparar o segredo local de desenvolvimento.");
  return cachedLocalSecret;
}

function requireRuntimeSecret({ envKeys = [], errorCode, errorMessage }) {
  const source = configuredSecret(envKeys) || developmentSecret();
  if (source) return source;
  const error = new Error(errorMessage);
  error.code = errorCode;
  throw error;
}

function runtimeSecretConfigured(envKeys = []) {
  return Boolean(configuredSecret(envKeys) || !isProduction());
}

module.exports = { requireRuntimeSecret, runtimeSecretConfigured };
