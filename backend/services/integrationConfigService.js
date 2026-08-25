const crypto = require("crypto");

const SECRET_MASK = "••••••••";

const DEFINITIONS = {
  mercadoPago: {
    name: "Mercado Pago",
    purpose: "Cartão, Pix, webhooks e assinaturas recorrentes do Clube",
    defaults: { enabled: false, environment: "sandbox", publicKey: "", pointEnabled: false, pointStoreId: "", pointPosId: "", pointDeviceId: "", recurringEnabled: false },
    secrets: ["publicKey", "accessToken", "webhookSecret"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "publicKey", label: "Chave pública", type: "secret" },
      { key: "accessToken", label: "Token de acesso", type: "secret" },
      { key: "webhookSecret", label: "Segredo do webhook", type: "secret" },
      { key: "pointEnabled", label: "Habilitar Point", type: "boolean" },
      { key: "pointStoreId", label: "Store ID Point", type: "text" },
      { key: "pointPosId", label: "POS ID Point", type: "text" },
      { key: "pointDeviceId", label: "Dispositivo Point", type: "text" },
      { key: "recurringEnabled", label: "Assinaturas recorrentes do Clube", type: "boolean" }
    ]
  },
  googleLogin: {
    name: "Login com Google",
    purpose: "Autenticação social de clientes",
    defaults: { enabled: false, environment: "production", clientId: "", redirectUri: "" },
    secrets: ["clientSecret"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Segredo do cliente", type: "secret" },
      { key: "redirectUri", label: "URL de retorno", type: "url" }
    ]
  },
  googleWallet: {
    name: "Google Wallet",
    purpose: "Adicionar ingressos digitais à carteira do cliente",
    defaults: { enabled: false, environment: "production", issuerId: "", classId: "", clientEmail: "", origins: "" },
    secrets: ["serviceAccountJson"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "issuerId", label: "Issuer ID", type: "text" },
      { key: "classId", label: "Class ID", type: "text" },
      { key: "serviceAccountJson", label: "JSON da service account", type: "secret", multiline: true },
      { key: "origins", label: "Origens permitidas", type: "text" }
    ]
  },
  tmdb: {
    name: "TMDB",
    purpose: "Busca automática de pôster, sinopse, classificação e duração dos filmes",
    defaults: { enabled: false, environment: "production" },
    secrets: ["apiKey", "bearerToken"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["production"] },
      { key: "apiKey", label: "API key", type: "secret" },
      { key: "bearerToken", label: "Bearer token", type: "secret" }
    ]
  },
  email: {
    name: "E-mail transacional",
    purpose: "SMTP para recuperação de senha, verificação, entrega de ingressos e campanhas",
    defaults: { enabled: false, environment: "production", provider: "smtp", fromEmail: "", fromName: "Cine Cruzeiro", replyTo: "", webhookUrl: "", smtpHost: "", smtpPort: 587, smtpSecure: false, smtpUser: "" },
    secrets: ["apiKey", "webhookSecret", "smtpPassword"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "provider", label: "Provedor", type: "select", options: ["smtp", "webhook"] },
      { key: "fromEmail", label: "E-mail remetente", type: "email" },
      { key: "fromName", label: "Nome remetente", type: "text" },
      { key: "replyTo", label: "Responder para", type: "email" },
      { key: "smtpHost", label: "Host SMTP", type: "text" },
      { key: "smtpPort", label: "Porta SMTP", type: "number" },
      { key: "smtpSecure", label: "Usar SSL/TLS direto", type: "boolean" },
      { key: "smtpUser", label: "Usuário SMTP", type: "text" },
      { key: "smtpPassword", label: "Senha SMTP", type: "secret" },
      { key: "webhookUrl", label: "Webhook de envio", type: "url" },
      { key: "apiKey", label: "API key", type: "secret" },
      { key: "webhookSecret", label: "Segredo do webhook", type: "secret" }
    ]
  },
  crm: {
    name: "Webhook CRM",
    purpose: "Sincronização de eventos comerciais e operacionais",
    defaults: { enabled: false, environment: "production", url: "", events: "order.created,payment.approved,ticket.used", timeout: 8000, retryLimit: 2 },
    secrets: ["secret"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "url", label: "URL do webhook", type: "url" },
      { key: "secret", label: "Segredo", type: "secret" },
      { key: "events", label: "Eventos", type: "text" },
      { key: "timeout", label: "Timeout em ms", type: "number" },
      { key: "retryLimit", label: "Tentativas", type: "number" }
    ]
  }
};

const ENV = {
  mercadoPago: {
    publicKey: ["MERCADO_PAGO_PUBLIC_KEY", "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY", "MP_PUBLIC_KEY"],
    accessToken: ["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN", "MERCADOPAGO_ACCESS_TOKEN"],
    webhookSecret: ["MERCADO_PAGO_WEBHOOK_SECRET", "MP_WEBHOOK_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"]
  },
  googleLogin: {
    clientId: ["GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"],
    clientSecret: ["GOOGLE_CLIENT_SECRET"],
    redirectUri: ["GOOGLE_REDIRECT_URI"]
  },
  googleWallet: {
    issuerId: ["GOOGLE_WALLET_ISSUER_ID"],
    classId: ["GOOGLE_WALLET_CLASS_ID"],
    clientEmail: ["GOOGLE_WALLET_CLIENT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_EMAIL"],
    privateKey: ["GOOGLE_WALLET_PRIVATE_KEY", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"],
    serviceAccountJson: ["GOOGLE_WALLET_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON"],
    origins: ["GOOGLE_WALLET_ORIGINS", "FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"]
  },
  tmdb: {
    apiKey: ["TMDB_API_KEY", "THEMOVIEDB_API_KEY", "NEXT_PUBLIC_TMDB_API_KEY"],
    bearerToken: ["TMDB_BEARER_TOKEN", "TMDB_ACCESS_TOKEN", "THEMOVIEDB_BEARER_TOKEN"]
  },
  email: {
    webhookUrl: ["EMAIL_VERIFICATION_WEBHOOK_URL", "VERIFY_EMAIL_WEBHOOK_URL", "PASSWORD_RESET_EMAIL_WEBHOOK_URL", "PASSWORD_RESET_WEBHOOK_URL", "EMAIL_WEBHOOK_URL"],
    apiKey: ["EMAIL_API_KEY", "RESEND_API_KEY", "SENDGRID_API_KEY"],
    smtpHost: ["SMTP_HOST", "EMAIL_SMTP_HOST"],
    smtpPort: ["SMTP_PORT", "EMAIL_SMTP_PORT"],
    smtpUser: ["SMTP_USER", "EMAIL_SMTP_USER"],
    smtpPassword: ["SMTP_PASSWORD", "EMAIL_SMTP_PASSWORD"],
    fromEmail: ["SMTP_FROM_EMAIL", "EMAIL_FROM"],
    fromName: ["SMTP_FROM_NAME", "EMAIL_FROM_NAME"],
    replyTo: ["SMTP_REPLY_TO", "EMAIL_REPLY_TO"]
  },
  crm: {
    url: ["CRM_WEBHOOK_URL", "LUMIX_WEBHOOK_URL"],
    secret: ["CRM_WEBHOOK_SECRET", "LUMIX_WEBHOOK_SECRET"]
  }
};

function firstEnv(keys = []) {
  const key = keys.find((name) => process.env[name]);
  return key ? process.env[key] : "";
}

function secretKey() {
  return crypto.createHash("sha256").update(process.env.INTEGRATION_SECRET_KEY || process.env.JWT_SECRET || "cine-cruzeiro-local-dev-secret").digest();
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return { encrypted: true, value: `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}` };
}

function decryptSecret(record) {
  if (!record) return "";
  if (typeof record === "string") return record;
  if (!record.encrypted || !record.value) return "";
  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(record.value).split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function providerKey(provider) {
  const raw = String(provider || "").trim();
  const match = Object.keys(DEFINITIONS).find((key) => key.toLowerCase() === raw.toLowerCase());
  return match || "";
}

function ensureStore(db) {
  db.integrations ||= {};
  return db.integrations;
}

function rawConfig(db, provider) {
  const key = providerKey(provider);
  if (!key) return null;
  const existing = ensureStore(db)[key] || {};
  return { ...DEFINITIONS[key].defaults, ...existing };
}

function resolvedConfig(db, provider) {
  const key = providerKey(provider);
  if (!key) return null;
  const definition = DEFINITIONS[key];
  const config = rawConfig(db, key);
  const out = { ...definition.defaults, ...config };
  const envMap = ENV[key] || {};
  definition.fields.forEach((field) => {
    const fromStore = definition.secrets.includes(field.key) ? decryptSecret(config[field.key]) : config[field.key];
    out[field.key] = fromStore || firstEnv(envMap[field.key] || []) || definition.defaults[field.key] || "";
  });
  out.enabled = Boolean(config.enabled || false);
  out.configured = isConfigured(key, out);
  out.providerKey = key;
  return out;
}

function isConfigured(provider, config) {
  if (provider === "mercadoPago") return Boolean(config.publicKey && config.accessToken);
  if (provider === "googleLogin") return Boolean(config.clientId && config.clientSecret);
  if (provider === "googleWallet") return Boolean(config.issuerId && config.classId && (config.serviceAccountJson || config.privateKey));
  if (provider === "tmdb") return Boolean(config.apiKey || config.bearerToken);
  if (provider === "email") return Boolean((config.smtpHost && config.smtpUser && config.smtpPassword && config.fromEmail) || config.webhookUrl);
  if (provider === "crm") return Boolean(config.url);
  return false;
}

function mask(value) {
  const text = String(value || "");
  if (!text) return "";
  return `${SECRET_MASK}${text.slice(-4)}`;
}

function sanitizeConfig(db, provider) {
  const key = providerKey(provider);
  if (!key) return null;
  const definition = DEFINITIONS[key];
  const stored = rawConfig(db, key);
  const resolved = resolvedConfig(db, key);
  const values = {};
  const secrets = {};
  definition.fields.forEach((field) => {
    if (definition.secrets.includes(field.key)) {
      const value = decryptSecret(stored[field.key]) || firstEnv((ENV[key] || {})[field.key] || []);
      secrets[field.key] = { hasValue: Boolean(value), masked: mask(value) };
    } else {
      values[field.key] = resolved[field.key] ?? "";
    }
  });
  if (key === "googleWallet") {
    const serviceAccountJson = decryptSecret(stored.serviceAccountJson) || firstEnv((ENV[key] || {}).serviceAccountJson || []);
    let serviceAccount = {};
    try {
      serviceAccount = serviceAccountJson ? JSON.parse(serviceAccountJson) : {};
    } catch {
      serviceAccount = {};
    }
    values.clientEmail = resolved.clientEmail || serviceAccount.client_email || "";
    values.serviceAccountConfigured = Boolean(serviceAccountJson || resolved.privateKey);
  }
  return {
    key,
    name: definition.name,
    purpose: definition.purpose,
    enabled: Boolean(stored.enabled),
    configured: Boolean(resolved.configured),
    environment: resolved.environment || "production",
    status: Boolean(stored.enabled) && resolved.configured ? "active" : resolved.configured ? "configured" : "pending",
    lastTestAt: stored.lastTestAt || "",
    lastTestStatus: stored.lastTestStatus || "",
    lastTestMessage: stored.lastTestMessage || "",
    updatedAt: stored.updatedAt || "",
    updatedBy: stored.updatedBy || "",
    values,
    secrets,
    fields: definition.fields.map((field) => ({ ...field, secret: definition.secrets.includes(field.key) }))
  };
}

function list(db) {
  return Object.fromEntries(Object.keys(DEFINITIONS).map((key) => [key, sanitizeConfig(db, key)]));
}

function audit(db, action, provider, user, before, after, extra = {}) {
  db.auditLogs ||= [];
  db.auditLogs.push({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: user?.id || "",
    userEmail: user?.email || "",
    action,
    entityType: "integration",
    entityId: provider,
    before,
    after,
    extra,
    createdAt: new Date().toISOString()
  });
}

function save(db, provider, input = {}, user) {
  const key = providerKey(provider);
  if (!key) return null;
  const definition = DEFINITIONS[key];
  const store = ensureStore(db);
  const before = sanitizeConfig(db, key);
  const current = rawConfig(db, key);
  const next = { ...current, enabled: Boolean(input.enabled ?? current.enabled) };
  definition.fields.forEach((field) => {
    if (!(field.key in input)) return;
    const value = input[field.key];
    if (definition.secrets.includes(field.key)) {
      const normalized = String(value || "").trim();
      if (!normalized || normalized.startsWith(SECRET_MASK)) return;
      if (normalized === "__CLEAR__") {
        delete next[field.key];
      } else {
        next[field.key] = encryptSecret(normalized);
      }
      return;
    }
    if (field.type === "boolean") next[field.key] = Boolean(value);
    else if (field.type === "number") next[field.key] = Number(value || 0);
    else next[field.key] = String(value ?? "").trim();
  });
  next.updatedAt = new Date().toISOString();
  next.updatedBy = user?.id || "";
  store[key] = next;
  const after = sanitizeConfig(db, key);
  audit(db, "integration.config.updated", key, user, before, after);
  return after;
}

function setEnabled(db, provider, enabled, user) {
  const key = providerKey(provider);
  if (!key) return null;
  const store = ensureStore(db);
  const before = sanitizeConfig(db, key);
  store[key] = { ...rawConfig(db, key), enabled: Boolean(enabled), updatedAt: new Date().toISOString(), updatedBy: user?.id || "" };
  const after = sanitizeConfig(db, key);
  audit(db, enabled ? "integration.enabled" : "integration.disabled", key, user, before, after);
  return after;
}

function setTestResult(db, provider, result, user) {
  const key = providerKey(provider);
  if (!key) return null;
  const store = ensureStore(db);
  const before = sanitizeConfig(db, key);
  store[key] = {
    ...rawConfig(db, key),
    lastTestAt: new Date().toISOString(),
    lastTestStatus: result.ok ? "success" : "error",
    lastTestMessage: result.message || "",
    updatedAt: new Date().toISOString(),
    updatedBy: user?.id || ""
  };
  const after = sanitizeConfig(db, key);
  audit(db, "integration.tested", key, user, before, after, { ok: Boolean(result.ok), message: result.message || "" });
  return after;
}

module.exports = {
  DEFINITIONS,
  providerKey,
  list,
  sanitizeConfig,
  resolvedConfig,
  isConfigured,
  save,
  setEnabled,
  setTestResult
};
