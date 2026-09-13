const crypto = require("crypto");
const { requireRuntimeSecret } = require("./runtimeSecretService");

const SECRET_MASK = "••••••••";
const GCM_AUTH_TAG_BYTES = 16;

const DEFINITIONS = {
  mercadoPago: {
    name: "Mercado Pago",
    purpose: "Cartão, Pix, webhooks, assinaturas recorrentes e pagamentos presenciais Point",
    defaults: { enabled: false, environment: "sandbox", publicKey: "", pointEnabled: false, pointStoreId: "", pointPosId: "", pointDeviceId: "", pointPrintOnTerminal: "seller_ticket", pointExpirationTime: "PT15M", recurringEnabled: false },
    secrets: ["publicKey", "accessToken", "webhookSecret"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "publicKey", label: "Chave pública", type: "secret" },
      { key: "accessToken", label: "Token de acesso", type: "secret" },
      { key: "webhookSecret", label: "Segredo do webhook", type: "secret" },
      { key: "pointEnabled", label: "Habilitar Mercado Pago Point", type: "boolean" },
      { key: "pointStoreId", label: "Store ID Point (opcional)", type: "text" },
      { key: "pointPosId", label: "POS ID Point (opcional)", type: "text" },
      { key: "pointDeviceId", label: "Terminal ID Point", type: "text", placeholder: "Identificador exibido na lista de terminais" },
      { key: "pointPrintOnTerminal", label: "Comprovante na maquininha", type: "select", options: ["seller_ticket", "no_ticket"] },
      { key: "pointExpirationTime", label: "Tempo limite da cobrança", type: "text", placeholder: "PT15M" },
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
    defaults: { enabled: false, environment: "production", issuerId: "", classId: "", clientEmail: "", privateKey: "", serviceAccountJson: "", origins: "" },
    secrets: ["serviceAccountJson", "privateKey"],
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
    defaults: { enabled: false, environment: "production", provider: "smtp", fromEmail: "", fromName: "Cine Cruzeiro", replyTo: "", notificationEmail: "", webhookUrl: "", smtpHost: "", smtpPort: 587, smtpSecure: false, smtpUser: "" },
    secrets: ["apiKey", "webhookSecret", "smtpPassword"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["sandbox", "production"] },
      { key: "provider", label: "Provedor", type: "select", options: ["smtp", "webhook"] },
      { key: "fromEmail", label: "E-mail remetente", type: "email" },
      { key: "fromName", label: "Nome remetente", type: "text" },
      { key: "replyTo", label: "Responder para", type: "email" },
      { key: "notificationEmail", label: "E-mail de atendimento", type: "email" },
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
  gemini: {
    name: "Gemini para campanhas",
    purpose: "Geração assistida de campanhas com o Google Gemini e o mesmo catálogo validado",
    defaults: { enabled: false, environment: "production", model: "gemini-3.6-flash", timeout: 30000, maxOutputTokens: 1800 },
    secrets: ["apiKey"],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["production"] },
      { key: "apiKey", label: "Chave da API Gemini", type: "secret" },
      { key: "model", label: "Modelo", type: "text", placeholder: "gemini-3.6-flash" },
      { key: "timeout", label: "Tempo limite em ms", type: "number" },
      { key: "maxOutputTokens", label: "Limite de tokens da resposta", type: "number" }
    ]
  },
  analytics: {
    name: "Medição e anúncios",
    purpose: "Google Analytics 4 e Meta Pixel com carregamento após consentimento",
    defaults: { enabled: false, environment: "production", googleMeasurementId: "", metaPixelId: "" },
    secrets: [],
    fields: [
      { key: "environment", label: "Ambiente", type: "select", options: ["production"] },
      { key: "googleMeasurementId", label: "ID de medição do Google Analytics", type: "text", placeholder: "G-XXXXXXXXXX" },
      { key: "metaPixelId", label: "ID do Pixel da Meta", type: "text", placeholder: "123456789012345" }
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
    clientEmail: ["GOOGLE_WALLET_CLIENT_EMAIL"],
    privateKey: ["GOOGLE_WALLET_PRIVATE_KEY"],
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
    replyTo: ["SMTP_REPLY_TO", "EMAIL_REPLY_TO"],
    notificationEmail: ["EVENTS_EMAIL", "CONTACT_EMAIL", "SMTP_NOTIFICATION_EMAIL"]
  },
  gemini: {
    apiKey: ["GEMINI_API_KEY"],
    model: ["GEMINI_EMAIL_MODEL", "GEMINI_MODEL"]
  },
  analytics: {
    googleMeasurementId: ["GOOGLE_ANALYTICS_MEASUREMENT_ID", "NEXT_PUBLIC_GA_MEASUREMENT_ID"],
    metaPixelId: ["META_PIXEL_ID", "NEXT_PUBLIC_META_PIXEL_ID"]
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
  const source = requireRuntimeSecret({
    envKeys: ["INTEGRATION_SECRET_KEY", "JWT_SECRET"],
    errorCode: "INTEGRATION_SECRET_KEY_REQUIRED",
    errorMessage: "INTEGRATION_SECRET_KEY ou JWT_SECRET deve estar configurada em produção."
  });
  return crypto.createHash("sha256").update(source).digest();
}

function encryptSecret(value) {
  let key;
  try {
    key = secretKey();
  } catch (error) {
    const err = new Error(error.message || "Chave de criptografia não configurada no servidor.");
    err.statusCode = 422;
    err.code = error.code || "INTEGRATION_SECRET_KEY_REQUIRED";
    err.expose = true;
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv, { authTagLength: GCM_AUTH_TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return { encrypted: true, value: `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}` };
}

function decryptSecret(record) {
  if (!record) return "";
  if (typeof record === "string") return record;
  if (!record.encrypted || !record.value) return "";
  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(record.value).split(":");
    const tag = Buffer.from(tagRaw, "base64");
    if (tag.length !== GCM_AUTH_TAG_BYTES) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivRaw, "base64"), { authTagLength: GCM_AUTH_TAG_BYTES });
    decipher.setAuthTag(tag);
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
  if (!db || typeof db !== "object") return {};
  db.settings ||= {};
  const persisted = db.settings.integrations;
  if (!db.integrations || typeof db.integrations !== "object" || !Object.keys(db.integrations).length) {
    db.integrations = persisted && typeof persisted === "object" ? persisted : {};
  }
  db.settings.integrations = db.integrations;
  delete db.integrations.openai;
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
  if (provider === "googleWallet") return Boolean(config.issuerId && config.classId && (config.serviceAccountJson || (config.clientEmail && config.privateKey)));
  if (provider === "tmdb") return Boolean(config.apiKey || config.bearerToken);
  if (provider === "email") return Boolean((config.smtpHost && config.smtpUser && config.smtpPassword && config.fromEmail) || config.webhookUrl);
  if (provider === "gemini") return Boolean(config.apiKey && config.model);
  if (provider === "analytics") return Boolean(config.googleMeasurementId || config.metaPixelId);
  if (provider === "crm") return Boolean(config.url);
  return false;
}

function mask(value) {
  const text = String(value || "");
  if (!text) return "";
  return `${SECRET_MASK}${text.slice(-4)}`;
}

function isMaskedSecret(value) {
  const text = String(value || "").trim();
  return text.startsWith(SECRET_MASK) || /^[*•]{8,}/u.test(text);
}

function configValidationError(message, code) {
  const error = new Error(message);
  error.statusCode = 422;
  error.code = code;
  return error;
}

function normalizeGoogleWalletServiceAccount(value) {
  let credential;
  try {
    credential = JSON.parse(String(value || "").trim());
  } catch {
    throw configValidationError(
      "O JSON da Service Account é inválido. Use o arquivo JSON baixado no Google Cloud sem alterar seu conteúdo.",
      "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_INVALID"
    );
  }
  if (!credential || Array.isArray(credential) || typeof credential !== "object") {
    throw configValidationError("A credencial do Google Wallet deve ser um objeto JSON.", "GOOGLE_WALLET_SERVICE_ACCOUNT_INVALID");
  }
  if (credential.type !== "service_account" || !credential.client_email || !credential.private_key) {
    throw configValidationError(
      "A credencial precisa ser uma Service Account e conter client_email e private_key.",
      "GOOGLE_WALLET_SERVICE_ACCOUNT_INCOMPLETE"
    );
  }
  try {
    crypto.createPrivateKey(String(credential.private_key).replace(/\\n/g, "\n"));
  } catch {
    throw configValidationError(
      "A chave privada da Service Account é inválida. Importe novamente o arquivo JSON original.",
      "GOOGLE_WALLET_PRIVATE_KEY_INVALID"
    );
  }
  credential.client_email = String(credential.client_email).trim();
  credential.private_key = String(credential.private_key).replace(/\\n/g, "\n");
  return JSON.stringify(credential);
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
    const legacyEmail = decryptSecret(stored.clientEmail) || firstEnv((ENV[key] || {}).clientEmail || []);
    const legacyPrivateKey = decryptSecret(stored.privateKey) || firstEnv((ENV[key] || {}).privateKey || []);
    values.clientEmail = resolved.clientEmail || serviceAccount.client_email || legacyEmail || "";
    values.serviceAccountConfigured = Boolean(serviceAccountJson || (values.clientEmail && legacyPrivateKey));
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
    lastTestCode: stored.lastTestCode || "",
    lastTestRequestId: stored.lastTestRequestId || "",
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
      if (value === null || value === undefined) return;
      let normalized = String(value || "").trim();
      if (!normalized || isMaskedSecret(normalized)) return;
      if (normalized === "__CLEAR__") {
        delete next[field.key];
      } else {
        if (key === "googleWallet" && field.key === "serviceAccountJson") {
          normalized = normalizeGoogleWalletServiceAccount(normalized);
        }
        next[field.key] = encryptSecret(normalized);
      }
      return;
    }
    // PATCH semantics: omitted/null fields preserve the stored integration value.
    if (value === null || value === undefined) return;
    if (field.type === "boolean") next[field.key] = Boolean(value);
    else if (field.type === "number") next[field.key] = Number(value || 0);
    else next[field.key] = String(value ?? "").trim();
  });
  next.updatedAt = new Date().toISOString();
  next.updatedBy = user?.id || "";
  store[key] = next;
  if (db?.settings) {
    db.settings.integrations ||= {};
    db.settings.integrations[key] = next;
  }
  const after = sanitizeConfig(db, key);
  audit(db, "integration.config.updated", key, user, before, after);
  return after;
}

function setEnabled(db, provider, enabled, user) {
  const key = providerKey(provider);
  if (!key) return null;
  const store = ensureStore(db);
  const before = sanitizeConfig(db, key);
  const nextConfig = { ...rawConfig(db, key), enabled: Boolean(enabled), updatedAt: new Date().toISOString(), updatedBy: user?.id || "" };
  store[key] = nextConfig;
  if (db?.settings) {
    db.settings.integrations ||= {};
    db.settings.integrations[key] = nextConfig;
  }
  const after = sanitizeConfig(db, key);
  audit(db, enabled ? "integration.enabled" : "integration.disabled", key, user, before, after);
  return after;
}

function setTestResult(db, provider, result, user) {
  const key = providerKey(provider);
  if (!key) return null;
  const store = ensureStore(db);
  const before = sanitizeConfig(db, key);
  const nextConfig = {
    ...rawConfig(db, key),
    lastTestAt: new Date().toISOString(),
    lastTestStatus: result.ok ? "success" : "error",
    lastTestMessage: result.message || "",
    lastTestCode: result.code || "",
    lastTestRequestId: result.requestId || "",
    ...(result.resolvedClassId ? { resolvedClassId: result.resolvedClassId } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: user?.id || ""
  };
  store[key] = nextConfig;
  if (db?.settings) {
    db.settings.integrations ||= {};
    db.settings.integrations[key] = nextConfig;
  }
  const after = sanitizeConfig(db, key);
  audit(db, "integration.tested", key, user, before, after, { ok: Boolean(result.ok), code: result.code || "", message: result.message || "" });
  return after;
}

module.exports = {
  DEFINITIONS,
  providerKey,
  list,
  sanitizeConfig,
  resolvedConfig,
  isConfigured,
  isMaskedSecret,
  normalizeGoogleWalletServiceAccount,
  save,
  setEnabled,
  setTestResult
};
