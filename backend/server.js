const http = require("http");
const { createWriteStream } = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const QRCode = require("qrcode");
const { postgresEnabled, readDbFromPostgres, writeDbToPostgres, withPostgresMutationLock, appendAuditLogToPostgres } = require("./db/postgresStore");
const paymentService = require("./services/paymentService");
const integrationConfigService = require("./services/integrationConfigService");
const emailService = require("./services/emailService");
const { createStorageService } = require("./services/storageService");
const cardTerminalProvider = require("./services/cardTerminalProvider");

const requestContext = new AsyncLocalStorage();

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.BIND_HOST || process.env.HOST || "0.0.0.0";
const SUBSCRIPTION_PENDING_PAYMENT_TTL_MS = 15 * 60 * 1000;
const SUBSCRIPTION_MAINTENANCE_INTERVAL_MS = 60 * 1000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "db.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const TRAILERS_DIR = path.join(PUBLIC_DIR, "trailers");
const FRONTEND_PUBLIC_DIR = path.join(ROOT, "..", "public");
const storageService = createStorageService({
  publicDir: PUBLIC_DIR,
  rootDir: process.env.CINE_UPLOADS_DIR || ""
});
const PROJECT_ROOT = path.resolve(ROOT, "..");
const MAX_TRAILER_BYTES = Number(process.env.MAX_TRAILER_BYTES || 120 * 1024 * 1024);
const ENV_FILES = [
  path.join(ROOT, ".env"),
  path.join(ROOT, ".env.local"),
  path.join(PROJECT_ROOT, ".env"),
  path.join(PROJECT_ROOT, ".env.local")
];
const TMDB_BEARER_ENV_KEYS = ["TMDB_BEARER_TOKEN", "TMDB_ACCESS_TOKEN", "THEMOVIEDB_BEARER_TOKEN"];
const TMDB_API_KEY_ENV_KEYS = ["TMDB_API_KEY", "THEMOVIEDB_API_KEY", "NEXT_PUBLIC_TMDB_API_KEY"];
const JWT_SECRET_ENV_KEYS = ["JWT_SECRET", "ADMIN_JWT_SECRET"];
const GOOGLE_CLIENT_ID_ENV_KEYS = ["GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"];
const GOOGLE_CLIENT_SECRET_ENV_KEYS = ["GOOGLE_CLIENT_SECRET"];
const GOOGLE_REDIRECT_URI_ENV_KEYS = ["GOOGLE_REDIRECT_URI"];
const FRONTEND_URL_ENV_KEYS = ["FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];
const CORS_ORIGIN_ENV_KEYS = ["CORS_ORIGIN", "CORS_ALLOWED_ORIGIN", "FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];
const CRM_WEBHOOK_ENV_KEYS = ["CRM_WEBHOOK_URL", "LUMIX_WEBHOOK_URL"];
const PASSWORD_RESET_EMAIL_WEBHOOK_ENV_KEYS = ["PASSWORD_RESET_EMAIL_WEBHOOK_URL", "PASSWORD_RESET_WEBHOOK_URL", "EMAIL_WEBHOOK_URL"];
const ADMIN_EMAIL_ENV_KEYS = ["ADMIN_EMAIL", "SEED_ADMIN_EMAIL"];
const ADMIN_PASSWORD_ENV_KEYS = ["ADMIN_PASSWORD", "SEED_ADMIN_PASSWORD"];
const GOOGLE_WALLET_ISSUER_ID_ENV_KEYS = ["GOOGLE_WALLET_ISSUER_ID"];
const GOOGLE_WALLET_CLASS_ID_ENV_KEYS = ["GOOGLE_WALLET_CLASS_ID"];
const GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_ENV_KEYS = ["GOOGLE_WALLET_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON"];
const GOOGLE_WALLET_ORIGINS_ENV_KEYS = ["GOOGLE_WALLET_ORIGINS", "FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];

let loadedEnvFiles = [];

function configuredAppBasePath() {
  const raw = String(process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_BASE_PATH || process.env.APP_BASE_PATH || "").trim();
  if (!raw || raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

function publicAssetUrl(url) {
  const value = String(url || "");
  const basePath = configuredAppBasePath();
  if (!basePath || !value.startsWith("/uploads/")) return value;
  return `${basePath}${value}`;
}

function storedAssetUrl(url) {
  const value = String(url || "").trim();
  const basePath = configuredAppBasePath();
  if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
  return value;
}

function storedLocalUploadUrl(url) {
  const value = storedAssetUrl(url);
  return value.startsWith("/uploads/") ? value : "";
}

function stripPublicAssetBase(pathname) {
  const value = String(pathname || "");
  const basePath = configuredAppBasePath();
  if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
  return value;
}

function appFrontendUrl() {
  const raw = (getFirstEnv(FRONTEND_URL_ENV_KEYS)?.value || "http://localhost:3000").replace(/\/+$/, "");
  const basePath = configuredAppBasePath();
  if (!basePath || raw.endsWith(basePath)) return raw;
  return `${raw}${basePath}`;
}

function parseEnvLine(line) {
  let trimmed = line.replace(/^\uFEFF/, "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return { key, value };
}

async function loadEnvFiles() {
  loadedEnvFiles = [];

  for (const file of ENV_FILES) {
    try {
      const raw = await fs.readFile(file, "utf8");
      loadedEnvFiles.push(file);

      raw.split(/\r?\n/).forEach((line) => {
        const parsed = parseEnvLine(line);
        if (parsed && !process.env[parsed.key]) {
          process.env[parsed.key] = parsed.value;
        }
      });
    } catch {
      // Env files are optional for local development.
    }
  }
}

function getFirstEnv(keys) {
  const key = keys.find((name) => process.env[name]);
  return key ? { key, value: process.env[key] } : null;
}

function getTmdbCredentials(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "tmdb") : null;
  if (configured?.bearerToken) {
    return { configured: true, mode: "bearer", token: configured.bearerToken, envKey: configured.updatedBy ? "admin.integrations.tmdb" : "env" };
  }
  if (configured?.apiKey) {
    return { configured: true, mode: "api_key", token: configured.apiKey, envKey: configured.updatedBy ? "admin.integrations.tmdb" : "env" };
  }
  const bearer = getFirstEnv(TMDB_BEARER_ENV_KEYS);
  const apiKey = getFirstEnv(TMDB_API_KEY_ENV_KEYS);

  if (bearer?.value) {
    return { configured: true, mode: "bearer", token: bearer.value, envKey: bearer.key };
  }

  if (apiKey?.value) {
    return { configured: true, mode: "api_key", token: apiKey.value, envKey: apiKey.key };
  }

  return { configured: false, mode: null, token: "", envKey: "" };
}

function getJwtSecret() {
  const configured = getFirstEnv(JWT_SECRET_ENV_KEYS);
  return configured?.value || "cine-cruzeiro-local-dev-secret";
}

function getCrmWebhookUrl(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "crm") : null;
  if (configured?.enabled && configured?.url) return configured.url;
  return getFirstEnv(CRM_WEBHOOK_ENV_KEYS)?.value || "";
}

function getPasswordResetEmailWebhookUrl(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "email") : null;
  if (configured?.enabled && configured?.webhookUrl) return configured.webhookUrl;
  return getFirstEnv(PASSWORD_RESET_EMAIL_WEBHOOK_ENV_KEYS)?.value || "";
}

function getEmailVerificationWebhookUrl(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "email") : null;
  if (configured?.enabled && configured?.webhookUrl) return configured.webhookUrl;
  return getFirstEnv(["EMAIL_VERIFICATION_WEBHOOK_URL", "VERIFY_EMAIL_WEBHOOK_URL"])?.value || getPasswordResetEmailWebhookUrl(db);
}

function getGoogleWalletConfig(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "googleWallet") : null;
  let serviceAccount = {};
  const serviceAccountJson = configured?.serviceAccountJson || getFirstEnv(GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_ENV_KEYS)?.value || "";
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      serviceAccount = {};
    }
  }

  const issuerId = configured?.issuerId || getFirstEnv(GOOGLE_WALLET_ISSUER_ID_ENV_KEYS)?.value || "";
  const classId = configured?.classId || getFirstEnv(GOOGLE_WALLET_CLASS_ID_ENV_KEYS)?.value || "";
  const clientEmail = serviceAccount.client_email || "";
  const privateKey = String(serviceAccount.private_key || "").replace(/\\n/g, "\n");
  const origins = normalizeGoogleWalletOrigins(configured?.origins || getFirstEnv(GOOGLE_WALLET_ORIGINS_ENV_KEYS)?.value || appFrontendUrl());

  return {
    configured: Boolean(issuerId && classId && clientEmail && privateKey),
    issuerId,
    classId: googleWalletResourceId(issuerId, classId),
    clientEmail,
    privateKey,
    origins,
    projectId: serviceAccount.project_id || "",
    serviceAccountConfigured: Boolean(serviceAccountJson),
    environment: configured?.environment || "production"
  };
}

function normalizeGoogleWalletOrigins(value) {
  const candidates = String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  candidates.push(appFrontendUrl(), "https://lumixengine.com", "https://www.lumixengine.com");
  return [...new Set(candidates.map((origin) => {
    try {
      return new URL(origin).origin.replace(/\/+$/, "");
    } catch {
      return origin.replace(/\/+$/, "");
    }
  }).filter(Boolean))];
}

function googleWalletResourceId(issuerId, resourceId) {
  const safeIssuer = String(issuerId || "").trim();
  const safeResource = String(resourceId || "").trim();
  if (!safeIssuer || !safeResource) return safeResource;
  return safeResource.includes(".") ? safeResource : `${safeIssuer}.${safeResource}`;
}

function googleWalletObjectId(config, ticket) {
  const stableId = String(ticket.id || ticket.code || "").replace(/[^A-Za-z0-9._-]/g, "_");
  return googleWalletResourceId(config.issuerId, `ticket_${stableId}`);
}

function getGoogleOAuthConfig(req, db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "googleLogin") : null;
  const forwardedHost = String(req?.headers["x-forwarded-host"] || "").trim();
  const forwardedProto = String(req?.headers["x-forwarded-proto"] || "http").trim();
  const origin = req
    ? `${forwardedProto || "http"}://${forwardedHost || req.headers.host}`
    : publicBackendUrl();
  return {
    clientId: configured?.clientId || getFirstEnv(GOOGLE_CLIENT_ID_ENV_KEYS)?.value || "",
    clientSecret: configured?.clientSecret || getFirstEnv(GOOGLE_CLIENT_SECRET_ENV_KEYS)?.value || "",
    redirectUri: configured?.redirectUri || getFirstEnv(GOOGLE_REDIRECT_URI_ENV_KEYS)?.value || `${origin}/api/auth/google/callback`,
    frontendUrl: appFrontendUrl()
  };
}

function corsOrigin() {
  return getFirstEnv(CORS_ORIGIN_ENV_KEYS)?.value || "http://localhost:3000";
}

function allowedCorsOrigins() {
  return corsOrigin()
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function responseCorsOrigin(req) {
  const requestOrigin = String(req?.headers?.origin || "").replace(/\/+$/, "");
  const allowed = allowedCorsOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || "http://localhost:3000";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function cookieSameSite() {
  if (!isProduction()) return "SameSite=Lax";
  const frontendHost = originHost(corsOrigin());
  const backendHost = originHost(publicBackendUrl());
  return frontendHost && backendHost && frontendHost !== backendHost ? "SameSite=None" : "SameSite=Lax";
}

function securityHeaders(extra = {}) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: http://localhost:3000 http://localhost:4000"
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    ...(isProduction() ? { "Strict-Transport-Security": "max-age=15552000; includeSubDomains" } : {}),
    ...extra
  };
}

function tmdbSetupMessage() {
  return [
    "Configure uma chave do TMDB para usar a busca automatica.",
    `Arquivos lidos: ${ENV_FILES.map((file) => path.relative(PROJECT_ROOT, file)).join(", ")}.`,
    `Nomes aceitos: ${[...TMDB_BEARER_ENV_KEYS, ...TMDB_API_KEY_ENV_KEYS].join(", ")}.`
  ].join(" ");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

function normalizeApiPayload(data, status) {
  if (!data || typeof data !== "object" || !("error" in data)) return data;
  if (typeof data.error === "string") {
    return {
      ...data,
      error: {
        code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: data.error
      }
    };
  }
  return data;
}

function redactLogValue(value) {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/password|hash|token|secret|authorization|cookie|pixCode|qrCode|card|cvv|access/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redactLogValue(item)];
    })
  );
}

function logEvent(level, event, fields = {}) {
  const store = requestContext.getStore();
  const payload = redactLogValue({
    level,
    event,
    method: store?.method,
    path: store?.pathname,
    ip: store?.req ? clientIp(store.req) : undefined,
    ...fields,
    timestamp: new Date().toISOString()
  });
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else console.log(line);
}

const MERCADO_PAGO_ORDER_ACTIONS = new Set([
  "order.created",
  "order.updated",
  "order.processed",
  "order.action_required",
  "order.cancelled",
  "order.canceled",
  "order.refunded"
]);

function webhookTesterEnabled() {
  return String(process.env.WEBHOOK_TESTER_ENABLED || "true").toLowerCase() !== "false";
}

function mercadoPagoWebhookAction(body = {}) {
  return String(body.action || body.type || "unknown").trim().toLowerCase() || "unknown";
}

function mercadoPagoWebhookEventId(body = {}, verification = {}) {
  const explicit = String(body.eventId || body.notificationId || "").trim();
  if (explicit) return explicit;
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const revision = String(data.version ?? body.version ?? data.status_detail ?? data.status ?? body.date_created ?? "").trim();
  return ["mercado_pago", mercadoPagoWebhookAction(body), verification.dataId || data.id || "sem-recurso", revision || "sem-revisao"].join(":");
}

function webhookSafeLogContext(req, url, body = {}) {
  return {
    signaturePresent: Boolean(req.headers["x-signature"]),
    requestIdPresent: Boolean(req.headers["x-request-id"]),
    dataIdPresent: Boolean(url.searchParams.get("data.id")),
    action: mercadoPagoWebhookAction(body),
    resourceId: String(url.searchParams.get("data.id") || "").slice(0, 96)
  };
}

function sanitizeWebhookTestPayload(body = {}) {
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const transaction = data.transactions?.payments?.[0] || {};
  return {
    action: body.action || "",
    api_version: body.api_version || "v1",
    type: body.type || "order",
    live_mode: Boolean(body.live_mode),
    date_created: body.date_created || "",
    data: {
      id: data.id || "",
      external_reference: data.external_reference || "",
      status: data.status || "",
      status_detail: data.status_detail || "",
      total_amount: data.total_amount || "",
      version: data.version ?? 1,
      transactions: {
        payments: transaction.id ? [{
          id: transaction.id,
          amount: transaction.amount,
          status: transaction.status,
          status_detail: transaction.status_detail,
          payment_method: {
            id: transaction.payment_method?.id || "",
            type: transaction.payment_method?.type || ""
          }
        }] : []
      }
    }
  };
}

function sendJson(res, status, data, extraHeaders = {}) {
  const req = requestContext.getStore()?.req;
  const payload = normalizeApiPayload(data, status);
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": responseCorsOrigin(req),
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key, Authorization",
    ...extraHeaders
  });
  res.end(body);
}

function sendNoContent(res) {
  const req = requestContext.getStore()?.req;
  res.writeHead(204, {
    ...securityHeaders(),
    "Access-Control-Allow-Origin": responseCorsOrigin(req),
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key, Authorization"
  });
  res.end();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayIsoDate() {
  const { year, month, day } = datePartsInSaoPaulo();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sessionStartsAt(session = {}, fallbackDate = todayIsoDate()) {
  const date = String(session.date || fallbackDate || todayIsoDate()).slice(0, 10);
  const time = String(session.time || session.timeLabel || "00:00").trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sessionSellableUntil(session = {}, fallbackDate = todayIsoDate()) {
  const startsAt = sessionStartsAt(session, fallbackDate);
  return startsAt ? new Date(startsAt.getTime() + 10 * 60 * 1000) : null;
}

function isSessionSellable(session = {}, fallbackDate = todayIsoDate(), now = new Date()) {
  if (!session || session.status === "sold_out") return false;
  const sellableUntil = sessionSellableUntil(session, fallbackDate);
  return sellableUntil ? sellableUntil.getTime() > now.getTime() : true;
}

function sellableSessions(movie = {}, now = new Date()) {
  return (movie.sessions || [])
    .filter((session) => isSessionSellable(session, session.date || todayIsoDate(), now))
    .sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
}

function datePartsInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function saoPauloDateFromOffset(offsetDays = 0) {
  const { year, month, day } = datePartsInSaoPaulo();
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0));
}

function buildCalendarDays(count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const date = saoPauloDateFromOffset(index);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long"
    }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short"
    }).format(date).replace(".", "");
    const dayMonth = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit"
    }).format(date);
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    return {
      isoDate,
      label: index === 0 ? "Hoje" : index === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate: dayMonth
    };
  });
}

function buildCalendarDaysForMovies(movies = [], minimumDays = 7) {
  const baseDays = buildCalendarDays(minimumDays);
  const dates = new Set(baseDays.map((day) => day.isoDate));
  (movies || []).forEach((movie) => {
    (movie.sessions || []).forEach((session) => {
      const date = String(session.date || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayIsoDate()) dates.add(date);
    });
  });
  const today = new Date(`${todayIsoDate()}T12:00:00-03:00`).getTime();
  return [...dates].sort().slice(0, 31).map((isoDate) => {
    const date = new Date(`${isoDate}T12:00:00-03:00`);
    const difference = Math.round((date.getTime() - today) / 86400000);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date).replace(".", "");
    const displayDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);
    return {
      isoDate,
      label: difference === 0 ? "Hoje" : difference === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate
    };
  });
}

function isPastOrToday(date) {
  if (!date) return false;
  return String(date).slice(0, 10) <= todayIsoDate();
}

function defaultPremiereSessions(movie, db) {
  const room = db.rooms?.find((item) => item.status === "active") || db.rooms?.[0];
  const roomName = room ? `${room.name} (${room.technology || "Sala"})` : "Sala Cruzeiro (Laser 4K)";
  const price = Number(db.settings?.defaultTicketPrice ?? db.ticketTypes?.[0]?.price ?? 10);
  return [
    {
      id: `${movie.id}-estreia-1`,
      time: "19:00",
      format: "2D Dublado",
      room: roomName,
      priceFull: price,
      priceHalf: price,
      status: "available"
    }
  ];
}

function applyScheduledPremieres(db) {
  let changed = false;
  db.movies = db.movies.map((movie) => {
    if (movie.status === "upcoming" && movie.autoPublish && isPastOrToday(movie.releaseDate)) {
      changed = true;
      return {
        ...movie,
        status: "now_playing",
        tag: movie.tag === "Em Breve" ? "Estreia" : movie.tag || "Estreia",
        sessions: movie.sessions?.length ? movie.sessions : defaultPremiereSessions(movie, db),
        publishedAt: movie.publishedAt || new Date().toISOString()
      };
    }
    return movie;
  });
  return changed;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  req.rawBody = raw;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("JSON inválido. Revise o corpo da requisição.");
    error.statusCode = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

const rateBuckets = new Map();

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function rateLimit(req, pathname) {
  const sensitive = /\/api\/(auth|payments|checkout|tickets\/validate|account\/tickets|admin)/.test(pathname);
  if (!sensitive) return null;

  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = pathname.includes("/tickets/validate") ? 40 : pathname.includes("/payments") ? 15 : 30;
  const key = `${clientIp(req)}:${pathname}`;
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > limit
    ? { code: "RATE_LIMITED", message: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente." }
    : null;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function signedValue(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedValue(value) {
  const [encoded, signature] = String(value || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function adminCookie(value, maxAge = 60 * 60 * 8) {
  return [
    `cine_admin=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    cookieSameSite(),
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function customerCookie(value, maxAge = 60 * 60 * 24 * 30) {
  return [
    `cine_customer=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    cookieSameSite(),
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function googleOAuthCookie(value, maxAge = 60 * 10) {
  return [
    `cine_google_oauth=${encodeURIComponent(value)}`,
    "Path=/api/auth/google",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function adminRoles() {
  return new Set(["owner", "master", "manager", "operator", "seller"]);
}

function roleAlias(role) {
  const value = String(role || "").trim();
  if (value === "master") return "owner";
  if (value === "seller") return "operator";
  return value;
}

function getAdminUser(req, db) {
  const session = verifySignedValue(parseCookies(req).cine_admin);
  if (!session?.sub) return null;
  const user = (db.users || []).find((item) => item.id === session.sub && item.active !== false);
  if (!user || !adminRoles().has(user.role)) return null;
  const normalizedRole = roleAlias(user.role);
  return normalizedRole === user.role ? user : { ...user, role: normalizedRole };
}

function getCustomerUser(req, db) {
  const session = verifySignedValue(parseCookies(req).cine_customer);
  const bearer = bearerPayload(req);
  const fallback = verifyJwt(parseCookies(req).cine_customer_fallback);
  const userId = session?.sub || bearer?.sub || fallback?.sub;
  if (!userId) return null;
  const user = (db.users || []).find((item) => item.id === userId && item.active !== false);
  if (!user || !["customer", ...adminRoles()].includes(user.role)) return null;
  const normalizedRole = roleAlias(user.role);
  return normalizedRole === user.role ? user : { ...user, role: normalizedRole };
}

function adminAuthRequired(pathname, method) {
  if (pathname.startsWith("/api/webhooks/")) return false;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/dashboard")) return true;
  if (pathname.startsWith("/api/uploads/")) return true;
  if (pathname.startsWith("/api/integrations")) return true;
  if (pathname.startsWith("/api/box-office/")) return true;
  if (pathname === "/api/content" && method === "PUT") return true;
  if (pathname === "/api/settings") return true;
  if (/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads|users)(\/|$)/.test(pathname)) return true;
  if (/^\/api\/admin\/(subscription-plans|subscriptions)(\/|$)/.test(pathname)) return true;
  if (/^\/api\/orders(\/|$)/.test(pathname) && ["GET", "PATCH", "DELETE"].includes(method)) return true;
  if (pathname === "/api/tickets/manual" || pathname === "/api/tickets/validate") return true;
  return false;
}

function mutatesState(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function originHost(value) {
  try {
    return value ? new URL(value).host : "";
  } catch {
    return "";
  }
}

function adminOriginAllowed(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;

  const requestHost = req.headers.host || "";
  const origin = originHost(req.headers.origin);
  const referer = originHost(req.headers.referer);
  const allowedHosts = new Set([requestHost, originHost(corsOrigin()), originHost(publicBackendUrl())].filter(Boolean));

  if (origin) return allowedHosts.has(origin);
  if (referer) return allowedHosts.has(referer);
  return true;
}

function requiredAdminRoles(pathname, method) {
  if (pathname === "/api/admin/content") return ["owner", "manager", "operator"];
  if (pathname === "/api/admin/dashboard") return ["owner", "manager", "operator"];
  if (pathname.startsWith("/api/admin/integrations")) return ["owner"];
  if (pathname.startsWith("/api/admin/email")) return ["owner", "manager"];
  if (pathname.startsWith("/api/admin/payments")) return ["owner", "manager"];
  if (/^\/api\/orders\/[^/]+\/permanent$/.test(pathname)) return ["owner", "master"];
  if (pathname.startsWith("/api/dashboard")) return ["owner", "manager", "operator"];
  if (pathname.startsWith("/api/uploads/")) return ["owner", "manager"];
  if (pathname.startsWith("/api/integrations")) return ["owner"];
  if (/^\/api\/admin\/(subscription-plans|subscriptions)(\/|$)/.test(pathname)) return ["owner", "manager"];
  if (pathname.startsWith("/api/box-office/")) return ["owner", "manager", "operator"];
  if (pathname === "/api/content" && method === "PUT") return ["owner"];
  if (pathname === "/api/settings") return ["owner"];
  if (/^\/api\/users(\/|$)/.test(pathname)) return ["owner"];
  if (/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads)(\/|$)/.test(pathname)) return ["owner", "manager"];
  if (/^\/api\/orders(\/|$)/.test(pathname) && method === "GET") return ["owner", "manager", "operator"];
  if (/^\/api\/orders\/[^/]+$/.test(pathname) && ["PATCH", "DELETE"].includes(method)) return ["owner", "manager"];
  if (pathname === "/api/tickets/manual" || pathname === "/api/tickets/validate") return ["owner", "manager", "operator"];
  return ["owner", "manager", "operator"];
}

function ensureAdmin(req, res, db, pathname, method, allowedRoles = requiredAdminRoles(pathname, method)) {
  if (!adminAuthRequired(pathname, method)) return true;
  const user = getAdminUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para continuar." } });
    return false;
  }
  if (!allowedRoles.includes(user.role)) {
    sendJson(res, 403, { error: { code: "ADMIN_FORBIDDEN", message: "Seu usuario nao tem permissao para esta acao." } });
    return false;
  }
  if (mutatesState(method) && !adminOriginAllowed(req)) {
    sendJson(res, 403, { error: { code: "ADMIN_CSRF_BLOCKED", message: "Origem da requisicao administrativa nao autorizada." } });
    return false;
  }
  req.adminUser = user;
  const store = requestContext.getStore();
  if (store) {
    store.adminUser = user;
    store.beforeDb ||= structuredCloneSafe(db);
  }
  return true;
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function auditCollectionForPath(pathname) {
  const match = pathname.match(/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads|users)(?:\/([^/]+))?/);
  if (match) {
    return {
      entityType: match[1].replace("ticket-types", "ticket_type"),
      collection: match[1] === "ticket-types" ? "ticketTypes" : match[1],
      entityId: match[2] ? decodeURIComponent(match[2]) : ""
    };
  }
  if (pathname === "/api/settings") return { entityType: "settings", collection: "settings", entityId: "app" };
  if (pathname === "/api/content") return { entityType: "content", collection: "movies", entityId: "bulk" };
  if (/^\/api\/orders(?:\/([^/]+))?/.test(pathname)) {
    const match = pathname.match(/^\/api\/orders(?:\/([^/]+))?/);
    return { entityType: "order", collection: "orders", entityId: match?.[1] ? decodeURIComponent(match[1]) : "" };
  }
  if (pathname === "/api/box-office/sales") return { entityType: "box_office_sale", collection: "orders", entityId: "" };
  if (pathname === "/api/tickets/manual") return { entityType: "manual_sale", collection: "orders", entityId: "" };
  if (pathname === "/api/tickets/validate") return { entityType: "ticket_validation", collection: "tickets", entityId: "" };
  return { entityType: "admin_action", collection: "", entityId: "" };
}

function sanitizeAuditValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/password|hash|token|secret|pixCode|qrCode|raw|authorization/i.test(key)) return [key, "[redacted]"];
      return [key, sanitizeAuditValue(item)];
    })
  );
}

function auditValueForCollection(db, collection) {
  if (!collection) return null;
  return sanitizeAuditValue(db?.[collection]);
}

function appendAuditLog(db) {
  const store = requestContext.getStore();
  if (!store?.adminUser || !store.beforeDb || store.auditInProgress) return;
  const { entityType, collection, entityId } = auditCollectionForPath(store.pathname);
  db.auditLogs ||= [];
  store.auditInProgress = true;
  db.auditLogs.push({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: store.adminUser.id,
    userEmail: store.adminUser.email,
    action: `${store.method} ${store.pathname}`,
    entityType,
    entityId,
    before: auditValueForCollection(store.beforeDb, collection),
    after: auditValueForCollection(db, collection),
    ip: clientIp(store.req),
    createdAt: new Date().toISOString()
  });
  store.beforeDb = structuredCloneSafe(db);
  store.auditInProgress = false;
}

function normalizeDb(db) {
  db.settings = {
    cinemaName: "Cine Cruzeiro",
    defaultTicketPrice: 10,
    currency: "BRL",
    salesChannel: "WhatsApp + Pix",
    heroTrailerBackgroundEnabled: false,
    announcementEnabled: true,
    announcementText: "Promoção permanente no Cine Cruzeiro - Ingressos a apenas R$ 10,00",
    clubHeroImageUrl: "",
    clubBannerImageUrl: "",
    eventHeroImageUrl: "",
    eventGamesImageUrl: "",
    eventPartiesImageUrl: "",
    eventCorporateImageUrl: "",
    eventGalleryImageUrl: "",
    ...db.settings
  };
  [
    "clubHeroImageUrl",
    "clubBannerImageUrl",
    "eventHeroImageUrl",
    "eventGamesImageUrl",
    "eventPartiesImageUrl",
    "eventCorporateImageUrl",
    "eventGalleryImageUrl"
  ].forEach((key) => {
    db.settings[key] = storedLocalUploadUrl(db.settings[key]);
  });
  db.movies ||= [];
  db.movies = db.movies.map((movie) => ({
    ...movie,
    slug: movie.slug || movie.id || slugify(movie.title || ""),
    workflowStatus: movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published"),
    sortOrder: Number(movie.sortOrder ?? movie.displayOrder ?? 100),
    director: movie.director || "",
    metadata: movie.metadata || {}
  })).sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
  db.rooms ||= [];
  db.ticketTypes ||= [];
  db.orders ||= [];
  db.payments ||= [];
  db.subscriptionPlans ||= db.settings.subscriptionPlans || [
    {
      id: "individual",
      name: "Plano Individual",
      monthlyPrice: 24.9,
      price: 24.9,
      includedTickets: 3,
      ticketsPerCycle: 3,
      billingCycle: "monthly",
      imageUrl: "",
      isFeatured: false,
      displayOrder: 1,
      benefits: ["3 ingressos por mês", "Fila expressa na bomboniere", "Descontos em combos"],
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: "duplo",
      name: "Plano Duplo",
      monthlyPrice: 44.9,
      price: 44.9,
      includedTickets: 6,
      ticketsPerCycle: 6,
      billingCycle: "monthly",
      imageUrl: "",
      isFeatured: true,
      displayOrder: 2,
      benefits: ["6 ingressos por mês", "Fila expressa na bomboniere", "1 pipoca grátis no mês", "Descontos em combos"],
      active: true,
      createdAt: new Date().toISOString()
    }
  ];
  db.subscriptions ||= db.settings.subscriptions || [];
  db.subscriptionCredits ||= db.settings.subscriptionCredits || [];
  db.subscriptionUsage ||= db.settings.subscriptionUsage || [];
  db.subscriptionPlans = (db.subscriptionPlans || []).map((plan, index) => ({
    ...plan,
    imageUrl: storedLocalUploadUrl(plan.imageUrl || plan.heroImageUrl || ""),
    isFeatured: Boolean(plan.isFeatured || plan.featured),
    displayOrder: Number(plan.displayOrder ?? plan.sortOrder ?? index + 1)
  })).sort((a, b) => Number(a.displayOrder || 100) - Number(b.displayOrder || 100));
  db.webhookEvents ||= [];
  db.integrations ||= db.settings.integrations || {};
  db.settings.integrations = db.integrations;
  db.settings.mercadoPagoSubscriptionPlans ||= db.settings.mercadoPagoSubscriptionPlans || {};
  db.emailCampaigns ||= db.settings.emailCampaigns || [];
  db.settings.emailCampaigns = db.emailCampaigns;
  db.auditLogs ||= [];
  db.tickets ||= [];
  db.concessions ||= [
    {
      id: "combo-classico",
      name: "Combo Classico",
      description: "Pipoca media + refrigerante",
      price: 25,
      compareAt: 30,
      category: "combo",
      imageUrl: "",
      badge: "Mais pedido",
      stock: 80,
      maxPerOrder: 6,
      featured: true,
      sortOrder: 1,
      tags: ["pipoca", "bebida"],
      comboItems: [
        { name: "Pipoca media", quantity: 1 },
        { name: "Refrigerante", quantity: 1 }
      ],
      active: true
    },
    {
      id: "pipoca-grande",
      name: "Pipoca Grande",
      description: "Pipoca quentinha na manteiga",
      price: 18,
      category: "pipoca",
      imageUrl: "",
      badge: "",
      stock: 100,
      maxPerOrder: 8,
      featured: false,
      sortOrder: 2,
      tags: ["pipoca"],
      comboItems: [],
      active: true
    },
    {
      id: "refrigerante",
      name: "Refrigerante",
      description: "Bebida gelada 500ml",
      price: 9,
      category: "bebida",
      imageUrl: "",
      badge: "",
      stock: 120,
      maxPerOrder: 10,
      featured: false,
      sortOrder: 3,
      tags: ["bebida"],
      comboItems: [],
      active: true
    }
  ];
  db.concessions = db.concessions
    .map((item) => normalizeConcession(item, item))
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
  db.promotions ||= [
    {
      id: "promocao-permanente",
      title: "Ingresso Promocional Permanente",
      description: "Todos os ingressos a R$ 10,00",
      discountType: "fixed_price",
      value: 10,
      couponCode: "",
      active: true
    }
  ];
  db.ads ||= [
    {
      id: "banner-whatsapp-pix",
      title: "Compre pelo WhatsApp e pague no Pix",
      placement: "home",
      imageUrl: "",
      linkUrl: "",
      active: true
    }
  ];
  db.ads = db.ads.map((item) => normalizeAd(item, item));
  db.users ||= [
    {
      id: "admin",
      name: "Administrador",
      email: "admin@cinecruzeiro.local",
      role: "owner",
      active: true,
      createdAt: new Date().toISOString()
    }
  ];
  const configuredAdminEmail = getFirstEnv(ADMIN_EMAIL_ENV_KEYS)?.value || "admin@cinecruzeiro.local";
  const configuredAdminPassword = getFirstEnv(ADMIN_PASSWORD_ENV_KEYS)?.value || (isProduction() ? "" : "cine-cruzeiro-dev-admin");
  const adminUser = db.users.find((user) => user.email === configuredAdminEmail) || db.users.find((user) => user.role === "owner");
  if (adminUser && configuredAdminPassword && !adminUser.passwordHash) {
    adminUser.email = configuredAdminEmail;
    adminUser.role = "owner";
    adminUser.passwordHash = hashPassword(configuredAdminPassword);
    adminUser.authProvider = adminUser.authProvider || "email";
  }
  return db;
}

async function readDb() {
  if (isProduction() && !postgresEnabled()) {
    throw Object.assign(new Error("PostgreSQL deve estar configurado em producao."), {
      code: "POSTGRES_REQUIRED_IN_PRODUCTION",
      statusCode: 500
    });
  }
  const db = postgresEnabled()
    ? await readDbFromPostgres()
    : JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  return normalizeDb(db);
}

async function writeDb(db) {
  appendAuditLog(db);
  if (postgresEnabled()) {
    await writeDbToPostgres(normalizeDb(db));
    return;
  }
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

async function withCriticalMutation(callback) {
  if (postgresEnabled()) {
    return withPostgresMutationLock(callback);
  }
  return callback();
}

function getTrailerExtension(sourceUrl, contentType = "") {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".mp4", ".webm", ".mov"].includes(ext)) return ext;
  } catch {
    // The caller validates URLs before download.
  }

  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.startsWith("video/")) return ".mp4";
  return "";
}

function trailerFilename(movie, sourceUrl, extension) {
  const hash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  return `${slugify(movie.id || movie.title || "trailer")}-${hash}${extension}`;
}

function localTrailerPathFromUrl(localTrailerUrl) {
  if (!localTrailerUrl) return "";

  let pathname = "";
  try {
    const parsed = new URL(localTrailerUrl, publicBackendUrl());
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return "";
  }

  if (!pathname.startsWith("/trailers/")) return "";
  const filename = path.basename(pathname);
  const resolved = path.resolve(TRAILERS_DIR, filename);
  const trailersRoot = path.resolve(TRAILERS_DIR);
  return resolved.startsWith(trailersRoot + path.sep) ? resolved : "";
}

function publicBackendUrl() {
  return (process.env.CINE_PUBLIC_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
}

async function deleteLocalTrailer(localTrailerUrl) {
  const trailerPath = localTrailerPathFromUrl(localTrailerUrl);
  if (!trailerPath) return;

  try {
    await fs.rm(trailerPath, { force: true });
  } catch {
    // Cache cleanup should not block catalog operations.
  }
}

function createByteLimitStream(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new Error(`Trailer maior que o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`));
        return;
      }
      callback(null, chunk);
    }
  });
}

function normalizePaymentOrder(input) {
  const customerName = String(input.customerName || "Cliente Cine Cruzeiro").trim();
  const [firstName, ...lastNameParts] = customerName.split(/\s+/);

  return {
    id: input.id || input.idempotencyKey || `pedido-${crypto.randomBytes(12).toString("hex")}`,
    idempotencyKey: input.idempotencyKey || input.id || "",
    movieId: String(input.movieId || ""),
    sessionId: String(input.sessionId || ""),
    fullTicketsCount: Math.max(0, Number(input.fullTicketsCount || 0)),
    halfTicketsCount: Math.max(0, Number(input.halfTicketsCount || 0)),
    concessionItems: Array.isArray(input.concessionItems)
      ? input.concessionItems.map((item) => ({
          id: String(item.id || ""),
          quantity: Math.max(0, Number(item.quantity || 0))
        }))
      : [],
    couponCode: String(input.couponCode || "").trim().toUpperCase(),
    customerUserId: String(input.customerUserId || input.userId || "").trim(),
    customerName,
    customerEmail: String(input.customerEmail || `cliente-${Date.now()}@cinecruzeiro.local`).trim(),
    customerPhone: String(input.customerPhone || "").trim(),
    customerCpf: input.customerCpf ? String(input.customerCpf).replace(/\D/g, "").slice(0, 11) : "",
    payerFirstName: firstName || "Cliente",
    payerLastName: lastNameParts.join(" ") || "Cine Cruzeiro",
    paymentMethod: input.paymentMethod || "PIX",
    useClubCredits: Boolean(input.useClubCredits),
    useClubBenefits: Boolean(input.useClubBenefits),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function createTicketCode(existingTickets = []) {
  const existingCodes = new Set(existingTickets.map((ticket) => ticket.code));
  let code = "";
  do {
    code = `CC-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
  } while (existingCodes.has(code));
  return code;
}

function ticketQrPayload(code) {
  return `CINECRUZEIRO:TICKET:${code}`;
}

function ticketSessionStartsAt(ticket, db = null) {
  const session = db ? sessionForTicket(db, ticket) : null;
  const date = String(session?.date || ticket.sessionDate || todayIsoDate()).trim();
  const time = String(session?.time || ticket.sessionTime || "00:00").trim();
  const parsed = new Date(`${date}T${time.length === 5 ? time : "00:00"}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ticketArchiveAt(ticket, db = null) {
  const startsAt = ticketSessionStartsAt(ticket, db);
  return startsAt ? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000) : null;
}

function isTicketArchived(ticket, db = null) {
  if (ticket.status === "used") return true;
  const archiveAt = ticketArchiveAt(ticket, db);
  return archiveAt ? archiveAt.getTime() <= Date.now() : false;
}

function ticketIsExpired(ticket, db = null) {
  return isTicketArchived(ticket, db);
}

function movieForTicket(db, ticket) {
  return (db.movies || []).find((movie) => movie.id === ticket.movieId) || null;
}

function sessionForTicket(db, ticket) {
  const movie = movieForTicket(db, ticket);
  return (movie?.sessions || []).find((session) => session.id === ticket.sessionId) || null;
}

function roomForSession(db, session) {
  if (!session) return null;
  const roomName = String(session.room || "").split("(")[0].trim().toLowerCase();
  return (db.rooms || []).find((room) => {
    const candidate = String(room.name || "").trim().toLowerCase();
    return candidate && (roomName === candidate || String(session.room || "").toLowerCase().includes(candidate));
  }) || null;
}

function sessionTicketStats(db, sessionId) {
  const tickets = (db.tickets || []).filter((ticket) => ticket.sessionId === sessionId);
  const sold = tickets.filter((ticket) => {
    const order = orderForTicket(db, ticket);
    const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
    return !["cancelled", "refunded", "expired", "pending_payment"].includes(status);
  }).length;
  return {
    sold,
    total: tickets.length,
    active: tickets.filter((ticket) => effectiveTicketStatus(ticket, orderForTicket(db, ticket), sessionForTicket(db, ticket), db) === "active").length,
    used: tickets.filter((ticket) => ticket.status === "used").length,
    cancelled: tickets.filter((ticket) => ["cancelled", "refunded"].includes(ticket.status)).length
  };
}

function orderForTicket(db, ticket) {
  if (!ticket) return null;
  return (db.orders || []).find((order) => order.id === ticket.orderId) || null;
}

function effectiveTicketStatus(ticket, order, session = null, db = null) {
  if (ticket.status === "used") return "used";
  if (["cancelled", "refunded", "expired"].includes(ticket.status)) return ticket.status;
  if (order && ["cancelled", "refunded", "expired"].includes(order.status)) return order.status;
  if (order && order.status !== "paid") return "pending_payment";
  if (session && ["cancelled", "hidden"].includes(session.status)) return "cancelled";
  if (ticketIsExpired(ticket, db)) return "archived";
  return ticket.status || "active";
}

function ticketBelongsToUser(db, ticket, user) {
  if (!ticket || !user) return false;
  const ticketUserId = String(ticket.customerUserId || "").trim();
  if (ticketUserId) return ticketUserId === user.id;

  const order = orderForTicket(db, ticket);
  if (order?.customerUserId) return order.customerUserId === user.id;

  const ticketEmail = String(ticket.customerEmail || "").trim().toLowerCase();
  const ticketCpf = String(ticket.customerCpf || "").replace(/\D/g, "");
  return (ticketEmail && ticketEmail === user.email) || (ticketCpf && user.cpf && ticketCpf === String(user.cpf).replace(/\D/g, ""));
}

function enrichTicket(db, ticket) {
  const order = orderForTicket(db, ticket);
  const movie = movieForTicket(db, ticket);
  const session = sessionForTicket(db, ticket);
  const room = roomForSession(db, session);
  const archiveAt = ticketArchiveAt(ticket, db);
  const status = effectiveTicketStatus(ticket, order, session, db);
  const stats = session ? sessionTicketStats(db, session.id) : null;
  const sessionDate = session?.date || order?.sessionDate || ticket.sessionDate || todayIsoDate();
  const sessionTime = session?.time || order?.sessionTime || ticket.sessionTime || "";
  const sessionRoom = session?.room || order?.sessionRoom || ticket.sessionRoom || "Sala Cruzeiro";
  const sessionFormat = session?.format || order?.sessionFormat || ticket.sessionFormat || "";
  const capacity = Number(session?.capacity || room?.capacity || 0);
  const orderTickets = (db.tickets || [])
    .filter((item) => item.orderId && item.orderId === ticket.orderId)
    .sort((a, b) => String(a.createdAt || a.id || "").localeCompare(String(b.createdAt || b.id || "")));
  const orderTicketIndex = Math.max(0, orderTickets.findIndex((item) => item.id === ticket.id));
  const orderTicketCount = orderTickets.length || 1;
  const orderExtras = Array.isArray(order?.concessionItems)
    ? order.concessionItems.map((item) => assetRecord(item, ["imageUrl"]))
    : [];
  return {
    ...ticket,
    customerEmail: ticket.customerEmail || order?.customerEmail || "",
    customerPhone: ticket.customerPhone || order?.customerPhone || "",
    customerCpf: ticket.customerCpf || order?.customerCpf || "",
    customerUserId: ticket.customerUserId || order?.customerUserId || "",
    movieTitle: movie?.title || order?.movieTitle || ticket.movieTitle || "",
    posterUrl: publicAssetUrl(movie?.posterUrl || ""),
    backdropUrl: publicAssetUrl(movie?.backdropUrl || ""),
    sessionDate,
    sessionTime,
    sessionRoom,
    sessionFormat,
    sessionStatus: session?.status || "",
    sessionCapacity: capacity,
    sessionSold: stats?.sold || 0,
    sessionAvailable: capacity ? Math.max(0, capacity - (stats?.sold || 0)) : null,
    seat: ticket.seat || ticket.seatLabel || ticket.assento || ticket.metadata?.seat || "Livre",
    orderReference: order?.id || ticket.orderId,
    orderStatus: order?.status || "",
    paymentStatus: order?.paymentStatus || "",
    extras: orderTicketIndex <= 0 ? orderExtras : [],
    extrasSharedByOrder: orderExtras.length > 0,
    orderTicketIndex,
    orderTicketCount,
    status,
    archived: status === "archived" || status === "used",
    archiveAt: archiveAt?.toISOString() || "",
    canTransfer: canTransferTicket(db, ticket).ok
  };
}

function canTransferTicket(db, ticket) {
  if (!ticket) return { ok: false, message: "Ingresso nao encontrado." };
  const order = orderForTicket(db, ticket);
  const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
  if (!order || order.status !== "paid") return { ok: false, message: "Somente ingressos pagos podem ser transferidos." };
  if (status !== "active") return { ok: false, message: "Este ingresso nao esta valido para transferencia." };
  if (ticketIsExpired(ticket, db)) return { ok: false, message: "Este ingresso ja passou do prazo de transferencia." };
  return { ok: true };
}

function extractTicketCode(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/(?:CINECRUZEIRO:TICKET:)?(CC-[A-F0-9]{8,32})/i);
  return match ? match[1].toUpperCase() : raw.toUpperCase();
}

function buildTicketsForOrder(order, db, source = "online") {
  const tickets = [];
  const fullCount = Number(order.fullTicketsCount || 0);
  const halfCount = Number(order.halfTicketsCount || 0);
  const base = {
    orderId: order.id,
    movieId: order.movieId || "",
    movieTitle: order.movieTitle || "",
    sessionId: order.sessionId || "",
    sessionTime: order.sessionTime || "",
    sessionFormat: order.sessionFormat || "",
    sessionDate: order.sessionDate || todayIsoDate(),
    customerName: order.customerName || "Cliente Cine Cruzeiro",
    customerPhone: order.customerPhone || "",
    customerEmail: String(order.customerEmail || "").trim().toLowerCase(),
    customerCpf: String(order.customerCpf || "").replace(/\D/g, ""),
    customerUserId: order.customerUserId || "",
    sessionRoom: order.sessionRoom || "",
    source,
    status: "active",
    createdAt: new Date().toISOString()
  };

  const pushTicket = (ticketType, index) => {
    const code = createTicketCode([...(db.tickets || []), ...tickets]);
    tickets.push({
      ...base,
      id: `ticket-${Date.now()}-${index}-${crypto.randomBytes(2).toString("hex")}`,
      code,
      qrPayload: ticketQrPayload(code),
      ticketType,
      usedAt: "",
      usedBy: ""
    });
  };

  Array.from({ length: fullCount }).forEach((_, index) => pushTicket("Inteira", index + 1));
  Array.from({ length: halfCount }).forEach((_, index) => pushTicket("Meia", fullCount + index + 1));
  return tickets;
}

function findAccountTickets(db, query) {
  const email = String(query.get("email") || "").trim().toLowerCase();
  const cpf = String(query.get("cpf") || "").replace(/\D/g, "");
  const userId = String(query.get("userId") || "").trim();
  if (!email && !cpf && !userId) return [];

  const user = userId ? (db.users || []).find((item) => item.id === userId) : null;
  return (db.tickets || [])
    .filter((ticket) => user ? ticketBelongsToUser(db, ticket, user) : (() => {
      const ticketEmail = String(ticket.customerEmail || "").trim().toLowerCase();
      const ticketCpf = String(ticket.customerCpf || "").replace(/\D/g, "");
      return (email && ticketEmail === email) || (cpf && ticketCpf === cpf);
    })())
    .map((ticket) => enrichTicket(db, ticket))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchCustomers(db, query) {
  const rawTerm = String(query || "").trim();
  const term = normalizeSearchText(rawTerm);
  const digits = term.replace(/\D/g, "");
  return (db.users || [])
    .filter((user) => user.active !== false && ["customer", ...adminRoles()].includes(user.role))
    .filter((user) => {
      if (!term) return true;
      if (term.length < 2 && digits.length < 3) return false;
      const name = normalizeSearchText(user.name);
      const email = normalizeSearchText(user.email);
      const cpf = String(user.cpf || "").replace(/\D/g, "");
      const phone = String(user.phone || "").replace(/\D/g, "");
      return name.includes(term) || email.includes(term) || (digits.length >= 3 && (phone.includes(digits) || cpf.includes(digits)));
    })
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, 12)
    .map(sanitizeUser);
}

function validateTicket(db, code, adminUser) {
  const ticketCode = extractTicketCode(code);
  const ticket = (db.tickets || []).find((item) => item.code === ticketCode);
  if (!ticket) {
    const error = new Error("Ingresso nao encontrado.");
    error.statusCode = 404;
    error.code = "TICKET_NOT_FOUND";
    throw error;
  }
  const order = (db.orders || []).find((item) => item.id === ticket.orderId);
  const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
  if (status === "used") {
    const error = new Error(`Ingresso ja validado em ${new Date(ticket.usedAt).toLocaleString("pt-BR")}.`);
    error.statusCode = 409;
    error.code = "TICKET_ALREADY_USED";
    error.ticket = ticket;
    throw error;
  }
  if (order && order.status !== "paid") {
    const error = new Error("Ingresso ainda nao esta liberado porque o pedido nao esta pago.");
    error.statusCode = 409;
    error.code = "TICKET_PAYMENT_PENDING";
    error.ticket = ticket;
    throw error;
  }
  if (status !== "active") {
    const error = new Error("Ingresso indisponivel para validacao.");
    error.statusCode = 409;
    error.code = status === "archived" ? "TICKET_EXPIRED" : "TICKET_UNAVAILABLE";
    error.ticket = enrichTicket(db, ticket);
    throw error;
  }
  ticket.status = "used";
  ticket.usedAt = new Date().toISOString();
  ticket.usedBy = adminUser?.id || "";
  return ticket;
}

async function createOpenFinancePixPayment(order, config = {}) {
  return paymentService.createOpenFinancePixPayment(order, config);
}

async function createMercadoPagoOrderPayment(order, config = {}, options = {}) {
  return paymentService.createMercadoPagoOrderPayment(order, config, options);
}

function frontendUrlForRequest(req, db) {
  return getGoogleOAuthConfig(req, db).frontendUrl;
}

function mercadoPagoSubscriptionPlanMap(db) {
  db.settings ||= {};
  db.settings.mercadoPagoSubscriptionPlans ||= {};
  return db.settings.mercadoPagoSubscriptionPlans;
}

function mercadoPagoPlanIdFor(db, plan) {
  const mapping = mercadoPagoSubscriptionPlanMap(db)[plan.id] || {};
  return String(plan.providerPlanId || plan.mercadoPagoPlanId || mapping.providerPlanId || "").trim();
}

function rememberMercadoPagoPlanId(db, plan, providerPlan) {
  if (!providerPlan?.id) return "";
  const id = String(providerPlan.id);
  const mapping = mercadoPagoSubscriptionPlanMap(db);
  mapping[plan.id] = {
    provider: "mercado_pago",
    providerPlanId: id,
    planName: plan.name,
    amount: Number(plan.monthlyPrice ?? plan.price ?? 0),
    status: providerPlan.status || "active",
    updatedAt: new Date().toISOString()
  };
  plan.providerPlanId = id;
  plan.mercadoPagoPlanId = id;
  return id;
}

async function ensureMercadoPagoSubscriptionPlan(db, plan, integrationConfig, req) {
  const existing = mercadoPagoPlanIdFor(db, plan);
  if (existing) return existing;
  const providerPlan = await paymentService.createMercadoPagoSubscriptionPlan(plan, integrationConfig, {
    frontendUrl: frontendUrlForRequest(req, db)
  });
  return rememberMercadoPagoPlanId(db, plan, providerPlan);
}

function applyMercadoPagoSubscriptionStatus(db, subscription, providerSubscription, actor = "mercado_pago", options = {}) {
  const now = new Date().toISOString();
  const nextStatus = providerSubscription?.localStatus || paymentService.normalizeMercadoPagoSubscriptionStatus(providerSubscription?.status);
  const previousStatus = subscription.status;
  subscription.provider = "mercado_pago";
  subscription.providerSubscriptionId = providerSubscription?.id || subscription.providerSubscriptionId || "";
  subscription.providerStatus = providerSubscription?.status || subscription.providerStatus || "";
  subscription.providerPlanId = providerSubscription?.planId || subscription.providerPlanId || "";
  subscription.nextBillingAt = providerSubscription?.nextPaymentDate || subscription.nextBillingAt || "";
  subscription.updatedAt = now;

  const paymentApproved = options.paymentApproved === true || subscription.paymentStatus === "approved";

  if (["ending", "cancelled", "ended"].includes(previousStatus) && nextStatus === "active") {
    subscription.status = previousStatus;
    subscription.paymentStatus = subscription.paymentStatus || "cancelled";
    subscription.nextBillingAt = "";
  } else if (nextStatus === "active" && paymentApproved) {
    subscription.status = "active";
    subscription.paymentStatus = "approved";
    subscription.approvedAt ||= now;
    subscription.startedAt ||= now;
    if (!currentSubscriptionCredit(db, subscription)) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      if (plan) createSubscriptionCreditCycle(db, subscription, plan, new Date());
    }
  } else if (nextStatus === "active") {
    subscription.status = "pending_payment";
    subscription.paymentStatus = "pending";
  } else if (nextStatus === "cancelled" && previousStatus === "ending") {
    subscription.status = "ending";
    subscription.nextBillingAt = "";
  } else if (nextStatus === "cancelled") {
    subscription.status = "cancelled";
    subscription.paymentStatus = "cancelled";
    subscription.cancelledAt ||= now;
  } else if (nextStatus === "paused") {
    subscription.status = "paused";
  } else if (nextStatus === "payment_failed") {
    subscription.status = "payment_failed";
    subscription.paymentStatus = "failed";
  } else if (previousStatus === "active" && subscription.paymentStatus === "approved") {
    // Mercado Pago may deliver an older pending event after authorization.
    subscription.status = "active";
    subscription.paymentStatus = "approved";
  } else {
    subscription.status = "pending_payment";
    subscription.paymentStatus = "pending";
  }

  subscription.history ||= [];
  subscription.history.push({
    action: "mercado_pago_status",
    from: previousStatus,
    to: subscription.status,
    providerStatus: subscription.providerStatus,
    by: actor,
    at: now
  });
  return refreshSubscriptionCredits(db, subscription);
}

function isMercadoPagoAlreadyCancelledError(error) {
  const message = String(error?.message || error?.raw?.message || "").toLowerCase();
  return message.includes("cancelled preapproval")
    || message.includes("canceled preapproval")
    || message.includes("cannot modify a cancelled")
    || message.includes("can not modify a cancelled");
}

async function cancelMercadoPagoSubscriptionSafely(subscription, integrationConfig = {}) {
  if (subscription.provider !== "mercado_pago" || !subscription.providerSubscriptionId) return null;
  if (["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())) {
    return { id: subscription.providerSubscriptionId, status: "cancelled", localStatus: "cancelled", alreadyCancelled: true };
  }
  try {
    return await paymentService.cancelMercadoPagoSubscription(subscription.providerSubscriptionId, integrationConfig || {});
  } catch (error) {
    if (!isMercadoPagoAlreadyCancelledError(error)) throw error;
    return { id: subscription.providerSubscriptionId, status: "cancelled", localStatus: "cancelled", alreadyCancelled: true };
  }
}

function subscriptionEntitlementEnd(db, subscription, now = new Date()) {
  const credit = currentSubscriptionCredit(db, subscription, now);
  const candidates = [
    credit?.cycleEnd,
    subscription.benefitsUntil,
    subscription.currentPeriodEnd,
    subscription.cycleEnd
  ].filter(Boolean).map((value) => new Date(value)).filter((value) => Number.isFinite(value.getTime()) && value.getTime() > now.getTime());
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString() || now.toISOString();
}

function markSubscriptionWithoutRenewal(db, subscription, options = {}) {
  const now = options.now || new Date();
  const timestamp = now.toISOString();
  const benefitsUntil = subscriptionEntitlementEnd(db, subscription, now);
  subscription.status = new Date(benefitsUntil).getTime() > now.getTime() ? "ending" : "ended";
  subscription.cancelAtPeriodEnd = true;
  subscription.cancellationRequestedAt ||= timestamp;
  subscription.billingCancelledAt ||= timestamp;
  subscription.benefitsUntil = benefitsUntil;
  subscription.cancellationMode = options.mode || "period_end";
  subscription.reactivationBlocked = true;
  subscription.cancelledAt ||= timestamp;
  subscription.endedAt = subscription.status === "ended" ? (subscription.endedAt || timestamp) : "";
  subscription.nextBillingAt = "";
  subscription.updatedAt = timestamp;
  return subscription;
}

function finalizeEndingSubscriptions(db, options = {}) {
  const now = options.now || new Date();
  const timestamp = now.toISOString();
  let changed = 0;
  for (const subscription of db.subscriptions || []) {
    const activeCredit = currentSubscriptionCredit(db, subscription, now);
    if (subscription.status === "cancelled" && activeCredit && Number(activeCredit.remaining || 0) > 0) {
      subscription.status = "ending";
      subscription.cancelAtPeriodEnd = true;
      subscription.benefitsUntil = activeCredit.cycleEnd;
      subscription.billingCancelledAt ||= subscription.cancelledAt || timestamp;
      subscription.cancellationRequestedAt ||= subscription.cancelledAt || timestamp;
      subscription.cancellationMode ||= "period_end";
      subscription.reactivationBlocked = true;
      subscription.nextBillingAt = "";
      subscription.updatedAt = timestamp;
      changed += 1;
      continue;
    }
    if (subscription.status !== "ending") continue;
    const endValue = subscription.benefitsUntil || subscription.currentPeriodEnd || subscription.cycleEnd || "";
    if (endValue && new Date(endValue).getTime() > now.getTime()) continue;
    subscription.status = "ended";
    subscription.endedAt ||= timestamp;
    subscription.creditsAvailable = 0;
    subscription.nextBillingAt = "";
    subscription.updatedAt = timestamp;
    changed += 1;
  }
  return { changed: changed > 0, finalized: changed };
}

function subscriptionPaymentExpiresAt(subscription, now = new Date()) {
  const explicit = subscription.paymentExpiresAt || subscription.pendingPaymentExpiresAt || subscription.expiresAt || "";
  if (explicit) return new Date(explicit);
  const createdAt = subscription.createdAt || subscription.updatedAt || now.toISOString();
  return new Date(new Date(createdAt).getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS);
}

function subscriptionPendingPaymentExpired(subscription, now = new Date()) {
  if (subscription.status !== "pending_payment") return false;
  return subscriptionPaymentExpiresAt(subscription, now).getTime() <= now.getTime();
}

function markSubscriptionPaymentExpired(db, subscription, providerSubscription, now = new Date()) {
  const timestamp = now.toISOString();
  const payment = findSubscriptionPayment(db, subscription.id);
  if (payment && payment.status !== "approved") {
    payment.status = "expired";
    payment.expiredAt ||= timestamp;
    payment.updatedAt = timestamp;
  }
  subscription.status = "cancelled";
  subscription.paymentStatus = "expired";
  subscription.providerStatus = providerSubscription?.status || subscription.providerStatus || "cancelled";
  subscription.cancelledAt ||= timestamp;
  subscription.paymentExpiredAt = timestamp;
  subscription.paymentExpiresAt = subscription.paymentExpiresAt || subscriptionPaymentExpiresAt(subscription, now).toISOString();
  subscription.nextBillingAt = "";
  subscription.cycleEnd = timestamp;
  subscription.currentPeriodEnd = timestamp;
  subscription.creditsAvailable = 0;
  subscription.creditsUsed = 0;
  const credit = currentSubscriptionCredit(db, subscription, now);
  if (credit) {
    credit.remaining = 0;
    credit.updatedAt = timestamp;
    syncSubscriptionCreditMirror(subscription, credit);
  }
  subscription.updatedAt = timestamp;
  subscription.history ||= [];
  subscription.history.push({
    action: "pending_payment_expired",
    reason: "Pagamento nao aprovado em 15 minutos.",
    provider: subscription.provider || "",
    providerStatus: subscription.providerStatus || "",
    at: timestamp
  });
}

async function expirePendingPaymentSubscriptions(db, options = {}) {
  const now = options.now || new Date();
  const expired = (db.subscriptions || []).filter((subscription) => subscriptionPendingPaymentExpired(subscription, now));
  if (!expired.length) return { changed: false, expired: 0, failed: 0 };

  const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
  let changed = 0;
  let failed = 0;
  for (const subscription of expired) {
    let providerSubscription = null;
    try {
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        providerSubscription = await paymentService.fetchMercadoPagoSubscription(
          subscription.providerSubscriptionId,
          mercadoPagoConfig || {}
        );
        if (providerSubscription?.localStatus === "active") {
          applyMercadoPagoSubscriptionStatus(
            db,
            subscription,
            providerSubscription,
            "mercado_pago_expiration_reconciliation",
            { paymentApproved: true }
          );
          changed += 1;
          continue;
        }
      }
      providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
      markSubscriptionPaymentExpired(db, subscription, providerSubscription, now);
      changed += 1;
    } catch (error) {
      failed += 1;
      subscription.history ||= [];
      subscription.history.push({
        action: "pending_payment_expiration_failed",
        reason: error?.code || error?.message || "Falha ao cancelar assinatura pendente no provedor.",
        at: now.toISOString()
      });
      logEvent("warn", "subscription.pending_payment_expiration_failed", {
        subscriptionId: subscription.id,
        provider: subscription.provider || "",
        providerSubscriptionId: subscription.providerSubscriptionId || "",
        code: error?.code || "SUBSCRIPTION_EXPIRATION_FAILED"
      });
    }
  }
  return { changed: changed > 0 || failed > 0, expired: changed, failed };
}

function normalizeProviderPaymentStatus(status) {
  return paymentService.normalizeProviderPaymentStatus(status);
}

function createPaymentRecord(order, providerPayment, method) {
  return paymentService.createPaymentRecord(order, providerPayment, method);
}

function createBoxOfficePaymentRecord(order, method, adminUser) {
  const now = new Date().toISOString();
  const provider = method === "courtesy"
    ? "admin"
    : method === "card_terminal"
    ? (cardTerminalProvider.configured() ? cardTerminalProvider.providerName() : "manual_external")
    : method === "external_pix"
    ? "external_manual"
    : "box_office";
  return {
    id: `pagamento-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: order.id,
    method,
    provider,
    providerPaymentId: `${method}-${order.id}`,
    providerReference: order.id,
    status: "approved",
    amount: Number(order.totalPrice || 0),
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    metadata: {
      origin: "box_office",
      ...(method === "card_terminal" ? cardTerminalProvider.manualTerminalPaymentMetadata({}, adminUser) : {}),
      manualConfirmation: !cardTerminalProvider.configured() || method !== "card_terminal",
      createdBy: adminUser?.id || "",
      createdByEmail: adminUser?.email || ""
    }
  };
}

function createClubCreditPaymentRecord(order, subscription) {
  const now = new Date().toISOString();
  return {
    id: `pagamento-clube-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: order.id,
    method: "club_credit",
    provider: "internal_club",
    providerPaymentId: `club-credit-${order.id}`,
    providerReference: order.id,
    status: "approved",
    amount: 0,
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    metadata: {
      subscriptionId: subscription.id,
      benefit: "club_credit"
    }
  };
}

function findSubscriptionPayment(db, subscriptionId, method = "") {
  return (db.payments || []).find((payment) =>
    payment.metadata?.kind === "club_subscription" &&
    payment.metadata?.subscriptionId === subscriptionId &&
    (!method || payment.method === method) &&
    !["approved", "expired", "cancelled", "rejected", "refunded"].includes(String(payment.status || ""))
  ) || null;
}

function activateSubscriptionFromPayment(db, subscription, payment, actor = "mercado_pago_order_webhook") {
  if (!subscription) return null;
  if (subscription.status === "active" && currentSubscriptionCredit(db, subscription)) return refreshSubscriptionCredits(db, subscription);
  subscription.status = "active";
  subscription.paymentStatus = "approved";
  subscription.provider = subscription.provider || "mercado_pago";
  subscription.providerStatus = payment?.status || subscription.providerStatus || "approved";
  subscription.providerPaymentId = payment?.providerPaymentId || subscription.providerPaymentId || "";
  subscription.approvedAt ||= payment?.approvedAt || new Date().toISOString();
  subscription.startedAt ||= subscription.approvedAt;
  subscription.paymentExpiredAt = "";
  subscription.updatedAt = new Date().toISOString();
  if (!currentSubscriptionCredit(db, subscription)) {
    const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
    if (plan) createSubscriptionCreditCycle(db, subscription, plan, new Date());
  }
  subscription.history ||= [];
  subscription.history.push({
    action: "payment_approved",
    by: actor,
    paymentId: payment?.id || "",
    providerPaymentId: payment?.providerPaymentId || "",
    at: subscription.approvedAt
  });
  return refreshSubscriptionCredits(db, subscription);
}

function failSubscriptionFromPayment(db, subscription, payment, status, actor = "mercado_pago_order_webhook") {
  if (!subscription || subscription.status === "active") return subscription;
  const now = new Date().toISOString();
  const terminalStatus = status === "expired" || status === "cancelled" ? "cancelled" : "payment_failed";
  subscription.status = terminalStatus;
  subscription.paymentStatus = status === "expired" ? "expired" : status === "cancelled" ? "cancelled" : "failed";
  subscription.providerStatus = status || subscription.providerStatus || "";
  subscription.cancelledAt ||= terminalStatus === "cancelled" ? now : "";
  subscription.paymentExpiredAt = status === "expired" ? now : subscription.paymentExpiredAt || "";
  subscription.nextBillingAt = "";
  subscription.creditsAvailable = 0;
  subscription.creditsUsed = 0;
  subscription.updatedAt = now;
  subscription.history ||= [];
  subscription.history.push({
    action: "payment_not_approved",
    by: actor,
    status,
    paymentId: payment?.id || "",
    providerPaymentId: payment?.providerPaymentId || "",
    at: now
  });
  return refreshSubscriptionCredits(db, subscription);
}

async function deliverTicketsByEmail(db, order, tickets) {
  if (!tickets?.length || !order?.customerEmail) return false;
  const emailUser = (db.users || []).find((user) =>
    user.active !== false &&
    (user.id === order.customerUserId || String(user.email || "").toLowerCase() === String(order.customerEmail || "").toLowerCase())
  );
  const enrichedTickets = tickets.map((ticket) => {
    const enriched = enrichTicket(db, ticket);
    try {
      enriched.googleWalletUrl = googleWalletSaveUrl(db, ticket, emailUser || {
        id: order.customerUserId || "",
        name: order.customerName || enriched.customerName || "Cliente Cine Cruzeiro",
        email: order.customerEmail || enriched.customerEmail || ""
      }, null);
    } catch {
      enriched.googleWalletUrl = "";
    }
    return enriched;
  });
  const attachments = [];
  for (const ticket of tickets) {
    try {
      attachments.push({
        filename: `cine-cruzeiro-${String(ticket.code || ticket.id || "ingresso").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.pdf`,
        content: await ticketDownloadPdf(db, ticket),
        contentType: "application/pdf"
      });
    } catch (error) {
      logEvent("warn", "ticket_email.pdf_failed", { orderId: order.id, ticketId: ticket.id, message: error.message });
    }
  }
  const delivered = await emailService.sendTicketDelivery(db, order, enrichedTickets, {
    attachments,
    accountUrl: `${appFrontendUrl()}/conta/ingressos`,
    logoUrl: `${appFrontendUrl()}/images/favicon-email.png`,
    siteUrl: appFrontendUrl()
  }).catch((error) => {
    logEvent("warn", "ticket_email.failed", { orderId: order.id, message: error.message });
    return false;
  });
  if (delivered) {
    order.emailDeliveredAt = new Date().toISOString();
  }
  return delivered;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signWalletJwt(claims, privateKey) {
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedBody = base64Url(JSON.stringify(claims));
  const payload = `${encodedHeader}.${encodedBody}`;
  const signature = crypto.createSign("RSA-SHA256").update(payload).sign(privateKey, "base64url");
  return `${payload}.${signature}`;
}

function googleWalletLocalized(value) {
  return { defaultValue: { language: "pt-BR", value: String(value || "") } };
}

function googleWalletAbsoluteUrl(req, db, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const frontendUrl = getGoogleOAuthConfig(req, db).frontendUrl.replace(/\/+$/, "");
  return `${frontendUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function walletEventTicketObjectForTicket(db, ticket, user, req) {
  const config = getGoogleWalletConfig(db);
  const enriched = enrichTicket(db, ticket);
  const objectId = googleWalletObjectId(config, ticket);
  const validTimeInterval = {
    start: { date: `${enriched.sessionDate}T00:00:00-03:00` },
    end: { date: enriched.archiveAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
  };
  const frontendUrl = getGoogleOAuthConfig(req, db).frontendUrl;

  return {
    id: objectId,
    classId: config.classId,
    state: enriched.status === "active" ? "ACTIVE" : "INACTIVE",
    heroImage: enriched.backdropUrl ? { sourceUri: { uri: googleWalletAbsoluteUrl(req, db, enriched.backdropUrl) } } : undefined,
    imageModulesData: enriched.posterUrl ? [{ mainImage: { sourceUri: { uri: googleWalletAbsoluteUrl(req, db, enriched.posterUrl) } }, id: "poster" }] : undefined,
    eventName: googleWalletLocalized(enriched.movieTitle || "Ingresso Cine Cruzeiro"),
    ticketHolderName: user.name || enriched.customerName || "Cliente Cine Cruzeiro",
    ticketNumber: enriched.code,
    barcode: {
      type: "QR_CODE",
      value: enriched.qrPayload,
      alternateText: enriched.code
    },
    validTimeInterval,
    textModulesData: [
      { id: "pedido", header: "Pedido", body: `${enriched.movieTitle || "Cine Cruzeiro"} - ${enriched.sessionTime || "sessao"}${enriched.sessionFormat ? ` • ${enriched.sessionFormat}` : ""}` },
      { id: "sessao", header: "Sessao", body: `${enriched.sessionDate} as ${enriched.sessionTime}` },
      { id: "sala", header: "Sala", body: enriched.sessionRoom || "Sala Cruzeiro" },
      { id: "formato", header: "Formato", body: enriched.sessionFormat || "Sessao Cine Cruzeiro" },
      { id: "tipo", header: "Tipo", body: enriched.ticketType },
      { id: "entrada", header: "Entrada", body: "Apresente o QR Code na portaria. Chegue com 15 minutos de antecedencia." }
    ],
    linksModuleData: {
      uris: [
        {
          id: "conta",
          uri: `${frontendUrl}/conta/ingressos`,
          description: "Meus ingressos"
        }
      ]
    }
  };
}

function googleWalletSaveUrl(db, ticket, user, req) {
  const config = getGoogleWalletConfig(db);
  if (!config.configured) {
    const error = new Error("Configure GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_CLASS_ID e credenciais da service account para habilitar Google Wallet.");
    error.statusCode = 412;
    throw error;
  }
  const enriched = enrichTicket(db, ticket);
  if (enriched.status !== "active") {
    const error = new Error("Google Wallet esta disponivel apenas para ingressos validos.");
    error.statusCode = 409;
    throw error;
  }
  const eventTicketObject = walletEventTicketObjectForTicket(db, ticket, user, req);
  const claims = {
    iss: config.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: config.origins,
    payload: {
      eventTicketObjects: [eventTicketObject]
    }
  };
  logEvent("info", "google_wallet.jwt.generated", {
    issuerId: config.issuerId,
    classId: config.classId,
    objectId: eventTicketObject.id,
    clientEmail: config.clientEmail,
    origins: config.origins,
    passType: "eventTicketObjects",
    objectPreview: {
      state: eventTicketObject.state,
      eventName: eventTicketObject.eventName?.defaultValue?.value || "",
      barcodeType: eventTicketObject.barcode?.type || "",
      hasHeroImage: Boolean(eventTicketObject.heroImage),
      hasPoster: Boolean(eventTicketObject.imageModulesData?.length)
    }
  });
  return `https://pay.google.com/gp/v/save/${signWalletJwt(claims, config.privateKey)}`;
}

function pdfText(value) {
  const safe = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
  return `(${safe})`;
}

function pdfColor(hex) {
  const value = String(hex || "#000000").replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

function pdfRect(x, y, width, height, color) {
  return `${pdfColor(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;
}

function pdfLine(x1, y1, x2, y2, color = "#334155", width = 1) {
  return `${pdfColor(color)} RG ${width.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function pdfWriteText(text, x, y, size, options = {}) {
  const font = options.bold ? "F2" : "F1";
  const color = pdfColor(options.color || "#ffffff");
  return `BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfText(text)} Tj ET\n`;
}

function wrapText(value, maxChars) {
  const words = String(value || "")
    .replace(/[-_/]/g, "$& ")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function pdfWriteMultiline(text, x, y, size, options = {}) {
  return wrapText(text, options.maxChars || 54)
    .slice(0, options.maxLines || 3)
    .map((line, index) => pdfWriteText(line, x, y - index * (options.lineHeight || size + 5), size, options))
    .join("");
}

function pdfWriteValueBlock(label, value, x, y, options = {}) {
  const labelSize = options.labelSize || 8;
  const valueSize = options.valueSize || 11;
  return [
    pdfWriteText(label, x, y, labelSize, { bold: true, color: options.labelColor || "#93c5fd" }),
    pdfWriteMultiline(value || "-", x, y - 18, valueSize, {
      bold: options.boldValue !== false,
      color: options.valueColor || "#ffffff",
      maxChars: options.maxChars || 28,
      maxLines: options.maxLines || 2,
      lineHeight: options.lineHeight || valueSize + 4
    })
  ].join("");
}

function pdfDrawImage(name, x, y, width, height) {
  return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q\n`;
}

function jpegDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function readLocalPosterBuffer(posterUrl) {
  let pathname = "";
  try {
    pathname = new URL(posterUrl).pathname;
  } catch {
    pathname = String(posterUrl || "");
  }
  const uploadPath = stripPublicAssetBase(pathname);
  if (!uploadPath.startsWith("/uploads/")) return null;
  const filePath = path.normalize(path.join(storageService.rootDir, uploadPath.replace(/^\/uploads\//, "")));
  if (!filePath.startsWith(storageService.rootDir)) return null;
  const buffer = await fs.readFile(filePath).catch(() => null);
  return buffer && jpegDimensions(buffer) ? buffer : null;
}

async function cachedPosterBufferForTicket(db, enriched) {
  const movie = movieForTicket(db, enriched);
  const posterUrl = String(enriched.posterUrl || movie?.posterUrl || "");
  if (!posterUrl) return null;
  const local = await readLocalPosterBuffer(posterUrl);
  if (local) return local;
  if (!/^https?:\/\//i.test(posterUrl)) return null;

  const cacheKey = crypto
    .createHash("sha256")
    .update(`${movie?.id || enriched.movieId || enriched.movieTitle}:${posterUrl}`)
    .digest("hex")
    .slice(0, 24);
  const cacheDir = path.join(storageService.rootDir, "pdf-posters");
  const cachePath = path.join(cacheDir, `${slugify(movie?.id || enriched.movieId || enriched.movieTitle || "filme")}-${cacheKey}.jpg`);
  const cached = await fs.readFile(cachePath).catch(() => null);
  if (cached && jpegDimensions(cached)) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(posterUrl, { signal: controller.signal, headers: { Accept: "image/jpeg,image/*;q=0.8" } }).catch(() => null);
    if (!response?.ok) return null;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 6 * 1024 * 1024) return null;
    if (!contentType.includes("jpeg") && !contentType.includes("jpg") && !jpegDimensions(buffer)) return null;
    if (!jpegDimensions(buffer)) return null;
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cachePath, buffer).catch(() => null);
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

function ticketStatusLabel(status) {
  return {
    active: "Valido",
    used: "Usado",
    archived: "Arquivado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    pending_payment: "Aguardando pagamento"
  }[String(status || "")] || "Nao informado";
}

function pdfQr(payload, x, y, size) {
  const qr = QRCode.create(String(payload || ""), { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const cell = size / moduleCount;
  let output = pdfRect(x - 10, y - 10, size + 20, size + 20, "#ffffff");
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.modules.get(row, column)) {
        output += pdfRect(x + column * cell, y + (moduleCount - row - 1) * cell, cell + 0.05, cell + 0.05, "#020617");
      }
    }
  }
  return output;
}

function buildPdf(pages, options = {}) {
  const normalizedPages = Array.isArray(pages) ? pages : [pages];
  const pageCount = normalizedPages.length;
  const firstPageObject = 3;
  const contentStart = firstPageObject + pageCount;
  const fontRegularObject = contentStart + pageCount;
  const fontBoldObject = fontRegularObject + 1;
  const imageObject = options.image ? fontBoldObject + 1 : null;
  const resourceImage = imageObject ? " /XObject << /Im1 " + imageObject + " 0 R >>" : "";
  const pageKids = Array.from({ length: pageCount }, (_, index) => `${firstPageObject + index} 0 R`).join(" ");
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "utf8"),
    Buffer.from(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>`, "utf8")
  ];

  normalizedPages.forEach((_, index) => {
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >>${resourceImage} >> /Contents ${contentStart + index} 0 R >>`, "utf8"));
  });

  normalizedPages.forEach((content) => {
    const stream = Buffer.from(String(content || ""), "utf8");
    objects.push(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "utf8"),
      stream,
      Buffer.from("\nendstream", "utf8")
    ]));
  });

  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "utf8"));
  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "utf8"));

  if (options.image) {
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${options.image.width} /Height ${options.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${options.image.buffer.length} >>\nstream\n`, "utf8"),
      options.image.buffer,
      Buffer.from("\nendstream", "utf8")
    ]));
  }

  const chunks = [Buffer.from("%PDF-1.4\n% Cine Cruzeiro\n", "utf8")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "utf8"), object, Buffer.from("\nendobj\n", "utf8"));
  });
  const body = Buffer.concat(chunks);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF`;
  return Buffer.concat([body, Buffer.from(xref, "utf8")]);
}

async function ticketDownloadPdf(db, ticket) {
  const enriched = enrichTicket(db, ticket);
  const extras = (enriched.extras || []).map((item) => `${item.name} x${Number(item.quantity || 0)}`).join(" - ");
  const formatLine = [enriched.sessionRoom || "Cine Cruzeiro", enriched.sessionFormat || "Sessao"].filter(Boolean).join(" - ");
  const posterBuffer = await cachedPosterBufferForTicket(db, enriched);
  const posterSize = posterBuffer ? jpegDimensions(posterBuffer) : null;
  const image = posterBuffer && posterSize ? { buffer: posterBuffer, ...posterSize } : null;

  let page1 = "";
  page1 += pdfRect(0, 0, 595, 842, "#050914");
  page1 += pdfRect(46, 54, 503, 734, "#101827");
  page1 += pdfRect(46, 714, 503, 74, "#0b1220");
  page1 += pdfRect(46, 54, 503, 10, "#facc15");
  page1 += pdfWriteText("CINE CRUZEIRO", 78, 758, 15, { bold: true, color: "#facc15" });
  page1 += pdfWriteText("Ingresso digital", 78, 735, 11, { color: "#bfdbfe" });
  page1 += pdfWriteText(ticketStatusLabel(enriched.status).toUpperCase(), 434, 752, 11, { bold: true, color: "#facc15" });
  page1 += pdfRect(78, 390, 180, 270, "#0b1220");
  if (image) page1 += pdfDrawImage("Im1", 86, 402, 164, 246);
  else page1 += pdfWriteMultiline(enriched.movieTitle, 104, 550, 18, { bold: true, color: "#ffffff", maxChars: 13, maxLines: 5, lineHeight: 22 });
  page1 += pdfWriteText("FILME", 286, 650, 9, { bold: true, color: "#60a5fa" });
  page1 += pdfWriteMultiline(enriched.movieTitle, 286, 612, 22, { bold: true, color: "#ffffff", maxChars: 21, maxLines: 3, lineHeight: 26 });
  page1 += pdfWriteText(`${enriched.sessionDate} as ${enriched.sessionTime}`, 286, 512, 16, { bold: true, color: "#facc15" });
  page1 += pdfWriteMultiline(formatLine, 286, 488, 10, { color: "#cbd5e1", maxChars: 38, maxLines: 2, lineHeight: 14 });
  page1 += pdfLine(78, 354, 517, 354, "#334155", 1);
  page1 += pdfWriteText("QR Code de entrada", 214, 324, 10, { bold: true, color: "#bfdbfe" });
  page1 += pdfQr(enriched.qrPayload || enriched.code, 222, 134, 164);
  page1 += pdfWriteText("Apresente este codigo na entrada.", 202, 104, 11, { bold: true, color: "#ffffff" });
  page1 += pdfWriteText("Pagina 1 de 2", 462, 86, 9, { color: "#94a3b8" });

  let page2 = "";
  page2 += pdfRect(0, 0, 595, 842, "#050914");
  page2 += pdfRect(46, 54, 503, 734, "#101827");
  page2 += pdfRect(46, 714, 503, 74, "#0b1220");
  page2 += pdfRect(46, 54, 503, 10, "#facc15");
  page2 += pdfWriteText("CINE CRUZEIRO", 78, 758, 15, { bold: true, color: "#facc15" });
  page2 += pdfWriteText("Detalhes do ingresso", 78, 735, 11, { color: "#bfdbfe" });
  page2 += pdfWriteMultiline(enriched.movieTitle, 78, 672, 20, { bold: true, color: "#ffffff", maxChars: 34, maxLines: 2, lineHeight: 24 });
  page2 += pdfWriteText(`${enriched.sessionDate} as ${enriched.sessionTime}`, 78, 608, 14, { bold: true, color: "#facc15" });
  page2 += pdfLine(78, 574, 517, 574, "#334155", 1);
  page2 += pdfWriteValueBlock("CODIGO", enriched.code, 78, 538, { valueSize: 12, maxChars: 32, maxLines: 2 });
  page2 += pdfWriteValueBlock("PEDIDO", enriched.orderReference || enriched.orderId || "-", 78, 462, { valueSize: 10, maxChars: 48, maxLines: 3, boldValue: false });
  page2 += pdfWriteValueBlock("TIPO", enriched.ticketType || "Ingresso", 338, 538, { valueSize: 13, maxChars: 20, maxLines: 1 });
  page2 += pdfWriteValueBlock("SALA", enriched.sessionRoom || "Cine Cruzeiro", 338, 462, { valueSize: 11, maxChars: 28, maxLines: 2 });
  page2 += pdfWriteValueBlock("ASSENTO", enriched.seat || "Livre", 338, 390, { valueSize: 13, maxChars: 20, maxLines: 1 });
  page2 += pdfWriteValueBlock("STATUS", ticketStatusLabel(enriched.status), 78, 390, { valueSize: 13, maxChars: 20, maxLines: 1 });
  page2 += pdfLine(78, 344, 517, 344, "#334155", 1);
  page2 += pdfWriteText("BOMBONIERE", 78, 306, 9, { bold: true, color: "#facc15" });
  page2 += pdfWriteMultiline(extras || "Sem extras comprados neste pedido.", 78, 282, 11, { color: "#cbd5e1", maxChars: 72, maxLines: 5, lineHeight: 15 });
  page2 += pdfWriteText("INFORMACOES UTEIS", 78, 178, 9, { bold: true, color: "#60a5fa" });
  page2 += pdfWriteText("Apresente o QR Code da primeira pagina na entrada.", 78, 152, 10, { color: "#ffffff" });
  page2 += pdfWriteText("Chegue com 15 minutos de antecedencia.", 78, 134, 10, { color: "#cbd5e1" });
  page2 += pdfWriteText("A validade depende do status real no servidor do Cine Cruzeiro.", 78, 116, 10, { color: "#cbd5e1" });
  page2 += pdfWriteText("Pagina 2 de 2", 462, 86, 9, { color: "#94a3b8" });
  return buildPdf([page1, page2], image ? { image } : {});
}

function finalizePaidOrder(db, order, payment, source = "online") {
  const existingTickets = (db.tickets || []).filter((ticket) => ticket.orderId === order?.id);
  if (!order || (order.status === "paid" && existingTickets.length > 0)) {
    return existingTickets;
  }
  payment.status = "approved";
  payment.approvedAt = payment.approvedAt || new Date().toISOString();
  payment.updatedAt = new Date().toISOString();
  order.status = "paid";
  order.paymentStatus = "approved";
  order.paidAt = order.paidAt || new Date().toISOString();
  const tickets = buildTicketsForOrder(order, db, source);
  order.ticketCodes = tickets.map((ticket) => ticket.code);
  confirmConcessionStock(db, order);
  db.tickets.unshift(...tickets);
  return tickets;
}

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).format(date);
}

function billingCycleStart(date = new Date()) {
  const base = new Date(date);
  return new Date(base.getTime()).toISOString();
}

function nextMonthIso(date = new Date()) {
  const base = new Date(date);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds())).toISOString();
}

function billingCycleEnd(date = new Date()) {
  return nextMonthIso(date);
}

function normalizeSubscriptionPlan(input, existing = {}) {
  const name = String(input.name || existing.name || "Plano do Clube").trim();
  const monthlyPrice = Number(input.monthlyPrice ?? input.priceMonthly ?? input.price ?? existing.monthlyPrice ?? existing.price ?? 0);
  const includedTickets = Math.max(0, Number(input.includedTickets ?? input.creditsPerMonth ?? input.ticketsPerCycle ?? existing.includedTickets ?? existing.ticketsPerCycle ?? 0));
  const normalizePercent = (value) => Math.min(90, Math.max(0, Number(value || 0)));
  const freeConcessionItems = (Array.isArray(input.freeConcessionItems) ? input.freeConcessionItems : existing.freeConcessionItems || [])
    .map((item) => ({
      concessionId: String(item.concessionId || item.id || "").trim(),
      quantityPerCycle: Math.min(20, Math.max(1, Math.floor(Number(item.quantityPerCycle || item.quantity || 1))))
    }))
    .filter((item, index, items) => item.concessionId && items.findIndex((candidate) => candidate.concessionId === item.concessionId) === index);
  return {
    id: String(input.id || existing.id || slugify(name) || `plano-${Date.now()}`),
    name,
    monthlyPrice,
    price: monthlyPrice,
    includedTickets,
    ticketsPerCycle: includedTickets,
    billingCycle: input.billingCycle || input.billing_cycle || existing.billingCycle || "monthly",
    benefits: Array.isArray(input.benefits)
      ? input.benefits.map((item) => String(item).trim()).filter(Boolean)
      : String(input.benefits || existing.benefits || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean),
    ticketDiscountPercent: normalizePercent(input.ticketDiscountPercent ?? existing.ticketDiscountPercent),
    concessionDiscountPercent: normalizePercent(input.concessionDiscountPercent ?? existing.concessionDiscountPercent),
    freeConcessionItems,
    imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
    isFeatured: input.isFeatured !== undefined ? Boolean(input.isFeatured) : Boolean(existing.isFeatured || existing.featured),
    displayOrder: Number(input.displayOrder ?? input.sortOrder ?? existing.displayOrder ?? existing.sortOrder ?? 100),
    providerPlanId: String(input.providerPlanId || input.mercadoPagoPlanId || existing.providerPlanId || existing.mercadoPagoPlanId || "").trim(),
    mercadoPagoPlanId: String(input.mercadoPagoPlanId || input.providerPlanId || existing.mercadoPagoPlanId || existing.providerPlanId || "").trim(),
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false,
    createdAt: existing.createdAt || input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function subscriptionStatusLabel(status = "") {
  return {
    active: "Ativa",
    pending_payment: "Aguardando pagamento",
    pending: "Pagamento pendente",
    paused: "Pausada",
    ending: "Sem renovação",
    cancelled: "Cancelada",
    ended: "Encerrada",
    payment_failed: "Falha na renovação",
    past_due: "Falha na renovação",
    cancelled_by_admin: "Cancelada"
  }[String(status || "").toLowerCase()] || "Não informado";
}

function currentSubscriptionCredit(db, subscription, now = new Date()) {
  const timestamp = now.getTime();
  return (db.subscriptionCredits || [])
    .filter((credit) => credit.subscriptionId === subscription.id)
    .find((credit) => new Date(credit.cycleStart).getTime() <= timestamp && new Date(credit.cycleEnd).getTime() > timestamp) || null;
}

function syncSubscriptionCreditMirror(subscription, credit) {
  subscription.currentCreditId = credit?.id || "";
  subscription.currentPeriodKey = credit?.cycleStart ? monthKey(new Date(credit.cycleStart)) : subscription.currentPeriodKey || "";
  subscription.currentPeriodStart = credit?.cycleStart || subscription.currentPeriodStart || "";
  subscription.currentPeriodEnd = credit?.cycleEnd || subscription.currentPeriodEnd || "";
  subscription.cycleStart = subscription.currentPeriodStart;
  subscription.cycleEnd = subscription.currentPeriodEnd;
  subscription.creditsAvailable = Number(credit?.remaining || 0);
  subscription.creditsUsed = Number(credit?.used || 0);
  return subscription;
}

function createSubscriptionCreditCycle(db, subscription, plan, now = new Date()) {
  db.subscriptionCredits ||= [];
  const cycleStart = billingCycleStart(now);
  const cycleEnd = billingCycleEnd(now);
  const total = Number(plan.includedTickets ?? plan.ticketsPerCycle ?? 0);
  const credit = {
    id: `credito-clube-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    subscriptionId: subscription.id,
    cycleStart,
    cycleEnd,
    total,
    used: 0,
    remaining: total,
    rolloverFromId: "",
    metadata: { rolloverPolicy: "none" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.subscriptionCredits.unshift(credit);
  subscription.startedAt ||= new Date().toISOString();
  subscription.cycleStart = cycleStart;
  subscription.cycleEnd = cycleEnd;
  subscription.nextBillingAt = cycleEnd;
  subscription.currentPeriodKey = monthKey(now);
  subscription.currentPeriodStart = cycleStart;
  subscription.currentPeriodEnd = cycleEnd;
  subscription.renewedAt = new Date().toISOString();
  syncSubscriptionCreditMirror(subscription, credit);
  return credit;
}

function refreshSubscriptionCredits(db, subscription, now = new Date()) {
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
  if (!plan) return subscription;
  let credit = currentSubscriptionCredit(db, subscription, now);
  const status = String(subscription.status || "");
  const shouldRenew = status === "active" && (!subscription.cycleEnd || new Date(subscription.cycleEnd).getTime() <= now.getTime());
  if (!credit && shouldRenew) {
    credit = createSubscriptionCreditCycle(db, subscription, plan, now);
  }
  if (!credit && !db.subscriptionCredits?.some((item) => item.subscriptionId === subscription.id) && status === "active") {
    credit = createSubscriptionCreditCycle(db, subscription, plan, now);
  }
  if (!credit && subscription.status === "ending") {
    subscription.status = "ended";
    subscription.endedAt ||= now.toISOString();
    subscription.creditsAvailable = 0;
    subscription.nextBillingAt = "";
    return subscription;
  }
  return syncSubscriptionCreditMirror(subscription, credit);
}

function subscriptionCanUseCredit(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  if (subscription.status === "ending") {
    const benefitsUntil = subscription.benefitsUntil || subscription.currentPeriodEnd || subscription.cycleEnd || "";
    return Boolean(benefitsUntil && new Date(benefitsUntil).getTime() > now.getTime());
  }
  return false;
}

function activeSubscriptionForUser(db, userId) {
  const now = new Date();
  const subscriptions = (db.subscriptions || [])
    .filter((item) => item.userId === userId && subscriptionCanUseCredit(item, now))
    .map((item) => refreshSubscriptionCredits(db, item, now));
  return subscriptions.find((item) => Number(item.creditsAvailable || 0) > 0) || subscriptions[0] || null;
}

function subscriptionBlocksNewPlan(subscription, now = new Date()) {
  if (!subscription) return false;
  const status = String(subscription.status || "");
  if (["pending_payment", "active", "paused", "ending"].includes(status)) return true;
  return false;
}

function blockingSubscriptionForUser(db, userId) {
  const now = new Date();
  return (db.subscriptions || [])
    .filter((item) => item.userId === userId)
    .map((item) => refreshSubscriptionCredits(db, item, now))
    .find((item) => subscriptionBlocksNewPlan(item, now)) || null;
}

function subscriptionSummary(db, userId) {
  return (db.subscriptions || [])
    .filter((subscription) => subscription.userId === userId)
    .map((subscription) => {
      refreshSubscriptionCredits(db, subscription);
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      const credit = currentSubscriptionCredit(db, subscription);
      const usage = (db.subscriptionUsage || []).filter((item) => item.subscriptionId === subscription.id);
      return {
        ...subscription,
        plan,
        statusLabel: subscriptionStatusLabel(subscription.status),
        credit,
        usage,
        cycleStart: subscription.cycleStart || subscription.currentPeriodStart || credit?.cycleStart || "",
        cycleEnd: subscription.cycleEnd || subscription.currentPeriodEnd || credit?.cycleEnd || "",
        nextBillingAt: subscription.nextBillingAt || subscription.cycleEnd || "",
        creditsTotal: subscriptionCanUseCredit(subscription) ? Number(credit?.total || 0) : 0,
        creditsRemaining: subscriptionCanUseCredit(subscription) ? Math.max(0, Number(subscription.creditsAvailable || 0)) : 0,
        creditsUsed: subscriptionCanUseCredit(subscription) ? Number(subscription.creditsUsed || 0) : 0
      };
    });
}

function createSubscription(db, userId, planId, adminUser, status = "pending_payment", provider = "external_pending") {
  const plan = (db.subscriptionPlans || []).find((item) => item.id === planId && item.active !== false);
  if (!plan) {
    const error = new Error("Plano do Clube nao encontrado ou inativo.");
    error.statusCode = 404;
    throw error;
  }
  const existing = (db.subscriptions || []).find((item) => item.userId === userId && item.planId === planId && ["pending_payment", "active", "paused"].includes(item.status));
  if (existing) {
    const now = new Date();
    existing.status = status;
    existing.updatedAt = now.toISOString();
    existing.provider = existing.provider || provider;
    if (status === "pending_payment") {
      existing.paymentStatus = "pending";
      existing.paymentExpiresAt = new Date(now.getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS).toISOString();
      existing.paymentExpiredAt = "";
    }
    existing.history ||= [];
    existing.history.push({ action: status === "active" ? "activate" : "status", status, by: adminUser?.id || userId || "", at: now.toISOString() });
    if (status === "active" && !currentSubscriptionCredit(db, existing)) {
      createSubscriptionCreditCycle(db, existing, plan);
    } else if (status !== "active") {
      existing.creditsAvailable = 0;
    }
    return refreshSubscriptionCredits(db, existing);
  }
  const now = new Date();
  const subscription = {
    id: `assinatura-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId,
    planId,
    status,
    provider,
    providerSubscriptionId: "",
    cycleStart: "",
    cycleEnd: "",
    nextBillingAt: "",
    startedAt: status === "active" ? new Date().toISOString() : "",
    currentPeriodKey: "",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    creditsAvailable: 0,
    creditsUsed: 0,
    paymentStatus: status === "active" ? "approved" : "pending",
    paymentExpiresAt: status === "pending_payment" ? new Date(now.getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS).toISOString() : "",
    paymentExpiredAt: "",
    cancelAtPeriodEnd: false,
    cancellationRequestedAt: "",
    billingCancelledAt: "",
    benefitsUntil: "",
    cancellationMode: "",
    reactivationBlocked: false,
    endedAt: "",
    createdBy: adminUser?.id || "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [{ action: status === "active" ? "assign" : "subscribe", by: adminUser?.id || userId || "", at: now.toISOString(), provider }]
  };
  db.subscriptions.unshift(subscription);
  if (status === "active") createSubscriptionCreditCycle(db, subscription, plan, now);
  return subscription;
}

function createManualSubscription(db, userId, planId, adminUser, status = "active") {
  return createSubscription(db, userId, planId, adminUser, status, "manual_admin");
}

function consumeSubscriptionCredit(db, subscription, context) {
  const credit = currentSubscriptionCredit(db, subscription);
  const quantity = Math.max(1, Number(context.quantity || 1));
  if (!credit || Number(credit.remaining || 0) < quantity) {
    const error = new Error("Creditos do Clube esgotados neste ciclo.");
    error.statusCode = 409;
    error.code = "CLUB_CREDITS_EXHAUSTED";
    throw error;
  }
  if (context.idempotencyKey && (db.subscriptionUsage || []).some((item) => item.idempotencyKey === context.idempotencyKey)) {
    const error = new Error("Uso duplicado do credito do Clube.");
    error.statusCode = 409;
    error.code = "CLUB_CREDIT_DUPLICATE";
    throw error;
  }
  credit.used = Number(credit.used || 0) + quantity;
  credit.remaining = Number(credit.remaining || 0) - quantity;
  credit.updatedAt = new Date().toISOString();
  syncSubscriptionCreditMirror(subscription, credit);
  const usage = {
    id: `uso-clube-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    subscriptionId: subscription.id,
    creditId: credit.id,
    userId: context.userId,
    ticketId: context.ticketId || "",
    orderId: context.orderId || "",
    movieId: context.movieId || "",
    sessionId: context.sessionId || "",
    monthKey: monthKey(new Date(credit.cycleStart)),
    cycleStart: credit.cycleStart,
    cycleEnd: credit.cycleEnd,
    creditsUsed: quantity,
    idempotencyKey: context.idempotencyKey || "",
    usedAt: new Date().toISOString()
  };
  db.subscriptionUsage ||= [];
  db.subscriptionUsage.unshift(usage);
  return usage;
}

function ticketSubtotalForOrder(db, order) {
  const movie = (db.movies || []).find((item) => item.id === order.movieId);
  const session = (movie?.sessions || []).find((item) => item.id === order.sessionId);
  if (!session) return 0;
  const full = Math.max(0, Number(order.fullTicketsCount || 0));
  const half = Math.max(0, Number(order.halfTicketsCount || 0));
  return Number((full * Number(session.priceFull || 0) + half * Number(session.priceHalf || 0)).toFixed(2));
}

function applyClubCreditDiscount(db, order, user, idempotencyKey) {
  if (!user || !order?.useClubCredits) return { order, subscription: null, quantity: 0 };
  const quantity = Math.max(0, Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0));
  if (!quantity) return { order, subscription: null, quantity: 0 };
  const subscription = activeSubscriptionForUser(db, user.id);
  if (!subscription || !subscriptionCanUseCredit(subscription)) {
    const error = new Error("Voce nao possui assinatura ativa com creditos disponiveis.");
    error.statusCode = 409;
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }
  if (Number(subscription.creditsAvailable || 0) < quantity) {
    const error = new Error(`Seu Clube tem ${Number(subscription.creditsAvailable || 0)} credito(s) disponivel(is), mas este pedido usa ${quantity} ingresso(s).`);
    error.statusCode = 409;
    error.code = "CLUB_CREDITS_INSUFFICIENT";
    throw error;
  }
  const ticketDiscount = Math.min(ticketSubtotalForOrder(db, order), Number(order.totalPrice || 0));
  if (ticketDiscount <= 0) return { order, subscription: null, quantity: 0 };
  order.discountValue = Number((Number(order.discountValue || 0) + ticketDiscount).toFixed(2));
  order.totalPrice = Math.max(0, Number((Number(order.totalPrice || 0) - ticketDiscount).toFixed(2)));
  order.clubSubscriptionId = subscription.id;
  order.clubBenefit = "club_credit";
  order.clubCreditQuantity = quantity;
  order.clubCreditPending = true;
  order.clubCreditIdempotencyKey = `${idempotencyKey || order.id}:club-credit`;
  return { order, subscription, quantity };
}

function activeClubPlanForBenefits(db, userId) {
  if (!userId) return null;
  const subscription = activeSubscriptionForUser(db, userId);
  if (!subscription || !subscriptionCanUseCredit(subscription)) return null;
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId && item.active !== false);
  return plan ? { subscription, plan } : null;
}

function reservedFreeConcessionQuantity(db, subscription, concessionId, currentOrderId = "") {
  const credit = currentSubscriptionCredit(db, subscription);
  const cycleStart = new Date(credit?.cycleStart || subscription.currentPeriodStart || subscription.cycleStart || 0).getTime();
  const cycleEnd = new Date(credit?.cycleEnd || subscription.currentPeriodEnd || subscription.cycleEnd || 0).getTime();
  if (!Number.isFinite(cycleStart) || !Number.isFinite(cycleEnd)) return 0;
  const now = Date.now();
  return (db.orders || []).reduce((sum, existingOrder) => {
    if (existingOrder.id === currentOrderId || existingOrder.clubSubscriptionId !== subscription.id) return sum;
    if (!["pending_payment", "paid"].includes(existingOrder.status)) return sum;
    if (existingOrder.status === "pending_payment" && existingOrder.reservationExpiresAt && new Date(existingOrder.reservationExpiresAt).getTime() <= now) return sum;
    const createdAt = new Date(existingOrder.createdAt || 0).getTime();
    if (createdAt < cycleStart || createdAt >= cycleEnd) return sum;
    const claim = (existingOrder.clubBenefits?.freeConcessionItems || []).find((item) => item.concessionId === concessionId);
    return sum + Number(claim?.quantity || 0);
  }, 0);
}

function applyClubPlanBenefits(db, order, user) {
  if (!order?.useClubBenefits) return { order, subscription: null, plan: null };
  if (!user) {
    const error = new Error("Entre na sua conta para aplicar os benefícios do Clube.");
    error.statusCode = 401;
    error.code = "CLUB_AUTH_REQUIRED";
    throw error;
  }
  const benefit = activeClubPlanForBenefits(db, user.id);
  if (!benefit) {
    const error = new Error("Nenhuma assinatura ativa foi encontrada para aplicar os benefícios.");
    error.statusCode = 409;
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }
  const { subscription, plan } = benefit;
  const ticketSubtotal = ticketSubtotalForOrder(db, order);
  const ticketDiscountPercent = Math.min(90, Math.max(0, Number(plan.ticketDiscountPercent || 0)));
  const concessionDiscountPercent = Math.min(90, Math.max(0, Number(plan.concessionDiscountPercent || 0)));
  const freeConcessionItems = [];
  let freeConcessionDiscount = 0;

  for (const configured of plan.freeConcessionItems || []) {
    const concessionId = String(configured.concessionId || configured.id || "");
    const item = (order.concessionItems || []).find((candidate) => candidate.id === concessionId);
    if (!item) continue;
    const limit = Math.min(20, Math.max(0, Number(configured.quantityPerCycle || configured.quantity || 0)));
    const used = reservedFreeConcessionQuantity(db, subscription, concessionId, order.id);
    const quantity = Math.min(Number(item.quantity || 0), Math.max(0, limit - used));
    if (!quantity) continue;
    freeConcessionItems.push({ concessionId, name: item.name, quantity, unitPrice: Number(item.unitPrice || 0) });
    freeConcessionDiscount += quantity * Number(item.unitPrice || 0);
  }

  const concessionSubtotal = (order.concessionItems || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const ticketDiscount = ticketSubtotal * (ticketDiscountPercent / 100);
  const concessionDiscountBase = Math.max(0, concessionSubtotal - freeConcessionDiscount);
  const concessionDiscount = concessionDiscountBase * (concessionDiscountPercent / 100);
  const clubDiscount = Math.min(Number(order.totalPrice || 0), Number((ticketDiscount + freeConcessionDiscount + concessionDiscount).toFixed(2)));

  order.discountValue = Number((Number(order.discountValue || 0) + clubDiscount).toFixed(2));
  order.totalPrice = Math.max(0, Number((Number(order.totalPrice || 0) - clubDiscount).toFixed(2)));
  order.clubSubscriptionId = subscription.id;
  order.clubBenefits = {
    planId: plan.id,
    ticketDiscountPercent,
    concessionDiscountPercent,
    ticketDiscount: Number(ticketDiscount.toFixed(2)),
    concessionDiscount: Number(concessionDiscount.toFixed(2)),
    freeConcessionDiscount: Number(freeConcessionDiscount.toFixed(2)),
    totalDiscount: clubDiscount,
    freeConcessionItems
  };
  return { order, subscription, plan };
}

function consumePendingClubCredit(db, order, tickets, userId) {
  if (!order?.clubCreditPending || order.clubCreditUsageId) return null;
  const subscription = (db.subscriptions || []).find((item) => item.id === order.clubSubscriptionId);
  if (!subscription) return null;
  const usage = consumeSubscriptionCredit(db, subscription, {
    userId: userId || order.customerUserId,
    orderId: order.id,
    ticketId: tickets?.[0]?.id || "",
    movieId: order.movieId,
    sessionId: order.sessionId,
    quantity: order.clubCreditQuantity,
    idempotencyKey: order.clubCreditIdempotencyKey || `${order.id}:club-credit`
  });
  order.clubCreditUsageId = usage.id;
  order.clubCreditPending = false;
  subscription.updatedAt = new Date().toISOString();
  return usage;
}

function refundSubscriptionCreditForUsage(db, usage, adminUser, reason) {
  if (!usage || usage.refundedAt) return false;
  const credit = (db.subscriptionCredits || []).find((item) => item.id === usage.creditId)
    || (db.subscriptionCredits || []).find((item) => item.subscriptionId === usage.subscriptionId && item.cycleStart === usage.cycleStart);
  const subscription = (db.subscriptions || []).find((item) => item.id === usage.subscriptionId);
  if (!credit || !subscription) return false;
  credit.used = Math.max(0, Number(credit.used || 0) - 1);
  credit.remaining = Math.min(Number(credit.total || 0), Number(credit.remaining || 0) + 1);
  credit.updatedAt = new Date().toISOString();
  usage.refundedAt = new Date().toISOString();
  usage.refundedBy = adminUser?.id || "";
  usage.refundReason = String(reason || "Credito devolvido por cancelamento").trim();
  syncSubscriptionCreditMirror(subscription, credit);
  subscription.history ||= [];
  subscription.history.push({ action: "credit_refund", usageId: usage.id, by: adminUser?.id || "", reason: usage.refundReason, at: usage.refundedAt });
  return true;
}

function findExistingCheckout(db, order, method) {
  const existingOrder = (db.orders || []).find((item) =>
    item.id === order.id || (order.idempotencyKey && item.idempotencyKey === order.idempotencyKey)
  );
  if (!existingOrder) return null;
  const payment = (db.payments || []).find((item) => item.orderId === existingOrder.id && (!method || item.method === method));
  return {
    order: existingOrder,
    payment,
    tickets: (db.tickets || []).filter((ticket) => ticket.orderId === existingOrder.id)
  };
}

function expireStaleReservations(db) {
  const now = Date.now();
  let changed = false;
  (db.orders || []).forEach((order) => {
    if (
      order.status !== "pending_payment" ||
      !order.reservationExpiresAt ||
      new Date(order.reservationExpiresAt).getTime() > now
    ) {
      return;
    }

    order.status = "expired";
    order.paymentStatus = order.paymentStatus === "approved" ? "approved" : "expired";
    order.expiredAt = order.expiredAt || new Date().toISOString();
    changed = releaseConcessionReservation(db, order) || changed;
    changed = true;

    (db.payments || [])
      .filter((payment) => payment.orderId === order.id && !["approved", "refunded"].includes(payment.status))
      .forEach((payment) => {
        payment.status = "expired";
        payment.expiredAt = payment.expiredAt || new Date().toISOString();
        payment.updatedAt = new Date().toISOString();
      });
  });
  return changed;
}

async function downloadTrailerForMovie(movie) {
  const sourceUrl = String(movie.trailerVideoUrl || "").trim();
  if (!sourceUrl) {
    await deleteLocalTrailer(movie.localTrailerUrl);
    return {
      ...movie,
      localTrailerUrl: "",
      trailerSourceUrl: "",
      trailerCacheStatus: "idle",
      trailerCachedAt: "",
      trailerCacheError: ""
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return { ...movie, trailerCacheStatus: "failed", trailerCacheError: "URL direta do trailer invalida." };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return { ...movie, trailerCacheStatus: "failed", trailerCacheError: "Use uma URL direta http(s) autorizada." };
  }

  if (movie.localTrailerUrl && movie.trailerSourceUrl === sourceUrl) {
    return { ...movie, trailerCacheStatus: "cached", trailerCacheError: "" };
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Nao foi possivel baixar o trailer (${response.status}).`);
    }

    const contentType = response.headers.get("content-type") || "";
    const extension = getTrailerExtension(sourceUrl, contentType);
    if (!extension || (!contentType.startsWith("video/") && !path.extname(parsedUrl.pathname))) {
      throw new Error("A URL precisa apontar para um arquivo de video direto (.mp4, .webm ou .mov).");
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_TRAILER_BYTES) {
      throw new Error(`Trailer maior que o limite de ${Math.round(MAX_TRAILER_BYTES / 1024 / 1024)} MB.`);
    }

    await fs.mkdir(TRAILERS_DIR, { recursive: true });
    const filename = trailerFilename(movie, sourceUrl, extension);
    const destination = path.join(TRAILERS_DIR, filename);
    const tempDestination = `${destination}.download`;

    await pipeline(
      Readable.fromWeb(response.body),
      createByteLimitStream(MAX_TRAILER_BYTES),
      createWriteStream(tempDestination)
    );
    await fs.rename(tempDestination, destination);

    const nextLocalTrailerUrl = `${publicBackendUrl()}/trailers/${filename}`;
    if (movie.localTrailerUrl && movie.localTrailerUrl !== nextLocalTrailerUrl) {
      await deleteLocalTrailer(movie.localTrailerUrl);
    }

    return {
      ...movie,
      localTrailerUrl: nextLocalTrailerUrl,
      trailerSourceUrl: sourceUrl,
      trailerCacheStatus: "cached",
      trailerCachedAt: new Date().toISOString(),
      trailerCacheError: ""
    };
  } catch (error) {
    try {
      const sourceUrlHash = sourceUrl ? crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12) : "";
      const partialFiles = await fs.readdir(TRAILERS_DIR).catch(() => []);
      await Promise.all(
        partialFiles
          .filter((file) => file.includes(sourceUrlHash) && file.endsWith(".download"))
          .map((file) => fs.rm(path.join(TRAILERS_DIR, file), { force: true }))
      );
    } catch {
      // Ignore temporary cache cleanup errors.
    }

    return {
      ...movie,
      trailerCacheStatus: "failed",
      trailerCacheError: error.message || "Falha ao baixar trailer."
    };
  }
}

async function syncHighlightTrailerCache(db, previousMovies = []) {
  await Promise.all(
    previousMovies
      .filter((movie) => movie.localTrailerUrl)
      .map((movie) => deleteLocalTrailer(movie.localTrailerUrl))
  );

  db.movies = db.movies.map((movie) => ({
    ...movie,
    localTrailerUrl: "",
    trailerSourceUrl: "",
    trailerCacheStatus: "idle",
    trailerCachedAt: "",
    trailerCacheError: ""
  }));
}

function normalizeMovieWorkflow(input, existing = {}) {
  const raw = input.workflowStatus || input.workflow_status || existing.workflowStatus || existing.workflow_status || "";
  if (["draft", "published", "archived"].includes(raw)) return raw;
  if ((input.status || existing.status) === "hidden") return "archived";
  return "published";
}

function publicMovieStatus(input, existing = {}, workflowStatus = "published") {
  if (workflowStatus === "draft" || workflowStatus === "archived") return "hidden";
  const value = input.status || existing.status || "upcoming";
  return ["now_playing", "upcoming", "hidden"].includes(value) ? value : "upcoming";
}

function validateMovieForWorkflow(db, movie, existingId = "", strictPublish = false) {
  const duplicateSlug = (db.movies || []).find((item) => {
    if (item.id === existingId || item.id === movie.id) return false;
    return String(item.slug || item.id || "").toLowerCase() === String(movie.slug || movie.id || "").toLowerCase();
  });
  if (duplicateSlug) {
    const error = new Error("Já existe um filme usando este slug.");
    error.statusCode = 409;
    throw error;
  }

  if (movie.workflowStatus !== "published" || !strictPublish) return;
  if (!movie.title || !movie.slug) {
    const error = new Error("Informe título e slug antes de publicar.");
    error.statusCode = 422;
    throw error;
  }
  if (!movie.posterUrl) {
    const error = new Error("Adicione um pôster antes de publicar o filme.");
    error.statusCode = 422;
    throw error;
  }
}

function movieHasAuditHistory(db, movieId) {
  return (db.orders || []).some((order) => order.movieId === movieId || (order.items || []).some((item) => item.movieId === movieId))
    || (db.tickets || []).some((ticket) => ticket.movieId === movieId)
    || (db.payments || []).some((payment) => payment.movieId === movieId);
}

function normalizeMovie(input, existing = {}) {
  const title = String(input.title || existing.title || "Novo Filme").trim();
  const id = String(input.id || existing.id || slugify(title) || `filme-${Date.now()}`);
  const workflowStatus = normalizeMovieWorkflow(input, existing);
  const slug = String(input.slug || existing.slug || slugify(title) || id).trim();
  const sessions = Array.isArray(input.sessions)
    ? input.sessions.map((session, index) => ({
        id: String(session.id || `${id}-sessao-${index + 1}`),
        date: session.date || session.sessionDate || "",
        time: String(session.time || "19:00"),
        format: session.format || "2D Dublado",
        room: String(session.room || "Sala Cruzeiro (Laser 4K)"),
        priceFull: Number(session.priceFull ?? 10),
        priceHalf: Number(session.priceHalf ?? 10),
        status: session.status || "available"
      }))
    : existing.sessions || [];

  return {
    id,
    slug: slugify(slug) || id,
    workflowStatus,
    sortOrder: Number(input.sortOrder ?? input.displayOrder ?? existing.sortOrder ?? existing.displayOrder ?? 100),
    status: publicMovieStatus(input, existing, workflowStatus),
    title,
    originalTitle: input.originalTitle || existing.originalTitle || "",
    synopsis: input.synopsis || existing.synopsis || "",
    duration: input.duration || existing.duration || "1h 40m",
    director: input.director || existing.director || "",
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : existing.metadata || {},
    genre: Array.isArray(input.genre)
      ? input.genre
      : String(input.genre || existing.genre || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    rating: input.rating || existing.rating || "L",
    posterUrl: input.posterUrl || existing.posterUrl || "",
    backdropUrl: input.backdropUrl || existing.backdropUrl || "",
    trailerYoutubeId: input.trailerYoutubeId || existing.trailerYoutubeId || "",
    trailerVideoUrl: input.trailerVideoUrl !== undefined ? String(input.trailerVideoUrl || "").trim() : existing.trailerVideoUrl || "",
    localTrailerUrl: existing.localTrailerUrl || "",
    trailerSourceUrl: existing.trailerSourceUrl || "",
    trailerCacheStatus: existing.trailerCacheStatus || "idle",
    trailerCachedAt: existing.trailerCachedAt || "",
    trailerCacheError: existing.trailerCacheError || "",
    isHighlight: Boolean(input.isHighlight),
    highlightTrailerBackground: input.highlightTrailerBackground !== undefined
      ? Boolean(input.highlightTrailerBackground)
      : existing.highlightTrailerBackground !== false,
    releaseDate: input.releaseDate !== undefined ? input.releaseDate : existing.releaseDate || "",
    autoPublish: input.autoPublish !== undefined ? Boolean(input.autoPublish) : Boolean(existing.autoPublish),
    publishedAt: workflowStatus === "published" ? (input.publishedAt || existing.publishedAt || new Date().toISOString()) : input.publishedAt || existing.publishedAt || "",
    tag: input.tag || existing.tag || "Em Breve",
    updatedAt: new Date().toISOString(),
    sessions
  };
}

function normalizeMovieSession(input, movieId, existing = {}) {
  const preserveExistingDate = Boolean(existing.id && existing.date && input.dateChanged !== true);
  const date = String(preserveExistingDate ? existing.date : input.date ?? input.sessionDate ?? existing.date ?? "").trim();
  const time = String(input.time ?? existing.time ?? "").trim();
  const room = String(input.room ?? existing.room ?? "").trim();
  const format = String(input.format ?? existing.format ?? "").trim();
  const priceFull = Number(input.priceFull ?? existing.priceFull);
  const priceHalf = Number(input.priceHalf ?? input.priceFull ?? existing.priceHalf ?? existing.priceFull);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("Informe uma data válida para a sessão.");
    error.statusCode = 422;
    throw error;
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    const error = new Error("Informe um horário válido para a sessão.");
    error.statusCode = 422;
    throw error;
  }
  if (!room || !format) {
    const error = new Error("Informe sala e formato da sessão.");
    error.statusCode = 422;
    throw error;
  }
  if (!Number.isFinite(priceFull) || priceFull < 0 || !Number.isFinite(priceHalf) || priceHalf < 0) {
    const error = new Error("Informe um preço válido para a sessão.");
    error.statusCode = 422;
    throw error;
  }

  return {
    id: String(existing.id || input.id || `${movieId}-sessao-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`),
    date,
    time,
    format,
    room,
    priceFull,
    priceHalf,
    status: ["available", "filling_fast", "sold_out"].includes(input.status || existing.status)
      ? input.status || existing.status
      : "available"
  };
}

function sessionDatesInRange(dateFrom, dateTo, weekdays = []) {
  const start = new Date(`${String(dateFrom || "").slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${String(dateTo || "").slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    const error = new Error("Informe um período válido para criar as sessões.");
    error.statusCode = 422;
    throw error;
  }
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays > 120) {
    const error = new Error("Crie sessões em períodos de no máximo 120 dias.");
    error.statusCode = 422;
    throw error;
  }
  const allowedWeekdays = new Set((weekdays || []).map(Number).filter((day) => day >= 0 && day <= 6));
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000);
    return { date, isoDate: date.toISOString().slice(0, 10) };
  }).filter(({ date }) => !allowedWeekdays.size || allowedWeekdays.has(date.getUTCDay())).map(({ isoDate }) => isoDate);
}

function createMovieSessionBatch(input, movieId, existingSessions = []) {
  const dateFrom = String(input.dateFrom || input.date || "").slice(0, 10);
  const dateTo = String(input.dateTo || input.dateEnd || dateFrom).slice(0, 10);
  const times = (Array.isArray(input.times) ? input.times : [input.time])
    .map((time) => String(time || "").trim())
    .filter((time, index, items) => /^\d{2}:\d{2}$/.test(time) && items.indexOf(time) === index);
  if (!times.length) {
    const error = new Error("Informe pelo menos um horário válido.");
    error.statusCode = 422;
    throw error;
  }
  const dates = sessionDatesInRange(dateFrom, dateTo, input.weekdays);
  const created = [];
  const skipped = [];
  for (const date of dates) {
    for (const time of times) {
      const duplicate = [...existingSessions, ...created].some((session) =>
        session.date === date && session.time === time && session.room === input.room && session.format === input.format
      );
      if (duplicate) {
        skipped.push({ date, time, reason: "duplicate" });
        continue;
      }
      created.push(normalizeMovieSession({ ...input, date, time }, movieId));
    }
  }
  if (!created.length && !skipped.length) {
    const error = new Error("Nenhuma data corresponde aos dias da semana selecionados.");
    error.statusCode = 422;
    throw error;
  }
  return { created, skipped };
}

function sessionHasAuditHistory(db, sessionId) {
  return (db.orders || []).some((order) => order.sessionId === sessionId || (order.items || []).some((item) => item.sessionId === sessionId))
    || (db.tickets || []).some((ticket) => ticket.sessionId === sessionId)
    || (db.payments || []).some((payment) => payment.sessionId === sessionId)
    || (db.subscriptionUsage || db.subscriptionUsages || []).some((usage) => usage.sessionId === sessionId);
}

function normalizeRoom(input, existing = {}) {
  const name = String(input.name || existing.name || "Nova Sala").trim();
  return {
    id: String(input.id || existing.id || slugify(name) || `sala-${Date.now()}`),
    name,
    capacity: Number(input.capacity ?? existing.capacity ?? 80),
    technology: input.technology || existing.technology || "",
    status: input.status || existing.status || "active"
  };
}

function normalizeTicketType(input, existing = {}) {
  const name = String(input.name || existing.name || "Ingresso").trim();
  return {
    id: String(input.id || existing.id || slugify(name) || `ingresso-${Date.now()}`),
    name,
    price: Number(input.price ?? existing.price ?? 10),
    description: input.description || existing.description || "",
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
  };
}

function normalizeConcession(input, existing = {}) {
  const name = String(input.name || existing.name || "Produto").trim();
  const stockValue = input.stock !== undefined ? input.stock : existing.stock;
  const reservedValue = input.reserved !== undefined ? input.reserved : existing.reserved;
  const soldValue = input.sold !== undefined ? input.sold : existing.sold;
  const tagValue = input.tags !== undefined ? input.tags : existing.tags;
  const comboItemsValue = input.comboItems !== undefined ? input.comboItems : existing.comboItems;
  const tags = Array.isArray(tagValue)
    ? tagValue
    : String(tagValue || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const comboItems = Array.isArray(comboItemsValue)
    ? comboItemsValue.map((item) => ({
        name: String(item.name || "").trim(),
        quantity: Math.max(1, Number(item.quantity || 1))
      })).filter((item) => item.name)
    : String(comboItemsValue || "")
        .split(/\r?\n/)
        .map((line) => {
          const [namePart, quantityPart] = line.split("|");
          return {
            name: String(namePart || "").trim(),
            quantity: Math.max(1, Number(quantityPart || 1))
          };
        })
        .filter((item) => item.name);

  return {
    id: String(input.id || existing.id || slugify(name) || `produto-${Date.now()}`),
    sku: String(input.sku || existing.sku || slugify(name) || `sku-${Date.now()}`),
    name,
    description: input.description || existing.description || "",
    imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
    badge: input.badge !== undefined ? String(input.badge || "").trim() : existing.badge || "",
    price: Number(input.price ?? existing.price ?? 0),
    compareAt: input.compareAt === "" ? "" : Number(input.compareAt ?? existing.compareAt ?? 0),
    category: input.category || existing.category || "combo",
    stock: stockValue === "" || stockValue === undefined ? "" : Number(stockValue),
    reserved: reservedValue === "" || reservedValue === undefined ? 0 : Math.max(0, Number(reservedValue || 0)),
    sold: soldValue === "" || soldValue === undefined ? 0 : Math.max(0, Number(soldValue || 0)),
    maxPerOrder: Number(input.maxPerOrder ?? existing.maxPerOrder ?? 8),
    featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
    sortOrder: Number(input.sortOrder ?? existing.sortOrder ?? 100),
    tags,
    comboItems,
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
  };
}

function finiteStock(item) {
  return item && item.stock !== "" && item.stock !== undefined;
}

function eachStockedOrderItem(db, order, callback) {
  (order.concessionItems || []).forEach((orderItem) => {
    const item = db.concessions.find((concession) => concession.id === orderItem.id);
    if (!item || !finiteStock(item)) return;
    const quantity = Math.max(0, Number(orderItem.quantity || 0));
    if (!quantity) return;
    callback(item, quantity);
  });
}

function reserveConcessionStock(db, order) {
  if (order.stockReservationStatus === "reserved" || order.stockReservationStatus === "sold") return;

  eachStockedOrderItem(db, order, (item, quantity) => {
    if (Number(item.stock || 0) < quantity) {
      const error = new Error(`${item.name} nao possui estoque suficiente.`);
      error.statusCode = 409;
      throw error;
    }
  });

  eachStockedOrderItem(db, order, (item, quantity) => {
    item.stock = Number(item.stock || 0) - quantity;
    item.reserved = Math.max(0, Number(item.reserved || 0) + quantity);
  });
  order.stockReservationStatus = "reserved";
  order.stockReservedAt = order.stockReservedAt || new Date().toISOString();
}

function confirmConcessionStock(db, order) {
  if (order.stockReservationStatus === "sold") return;

  if (order.stockReservationStatus === "reserved") {
    eachStockedOrderItem(db, order, (item, quantity) => {
      item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
      item.sold = Math.max(0, Number(item.sold || 0) + quantity);
    });
  } else {
    eachStockedOrderItem(db, order, (item, quantity) => {
      if (Number(item.stock || 0) < quantity) {
        const error = new Error(`${item.name} nao possui estoque suficiente para confirmar a venda.`);
        error.statusCode = 409;
        throw error;
      }
      item.stock = Number(item.stock || 0) - quantity;
      item.sold = Math.max(0, Number(item.sold || 0) + quantity);
    });
  }

  order.stockReservationStatus = "sold";
  order.stockSoldAt = order.stockSoldAt || new Date().toISOString();
}

function releaseConcessionReservation(db, order) {
  if (order.stockReservationStatus !== "reserved") return false;

  eachStockedOrderItem(db, order, (item, quantity) => {
    item.stock = Number(item.stock || 0) + quantity;
    item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
  });
  order.stockReservationStatus = "released";
  order.stockReleasedAt = new Date().toISOString();
  return true;
}

function orderTickets(db, orderId) {
  return (db.tickets || []).filter((ticket) => ticket.orderId === orderId);
}

function orderPayment(db, orderId) {
  return (db.payments || []).find((payment) => payment.orderId === orderId) || null;
}

function appendOrderAudit(order, entry) {
  order.auditTrail ||= [];
  order.auditTrail.push({
    id: `order-audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    ...entry,
    at: new Date().toISOString()
  });
}

function safeOrderUpdate(order, body, adminUser) {
  const allowedFields = ["customerName", "customerPhone", "customerEmail", "customerCpf", "operationalNotes"];
  const before = structuredCloneSafe(order);
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      order[field] = String(body[field] || "").trim();
    }
  });
  order.updatedBy = adminUser?.id || "";
  order.updatedByEmail = adminUser?.email || "";
  order.updatedAt = new Date().toISOString();
  appendOrderAudit(order, {
    action: "edit",
    updatedBy: order.updatedBy,
    reason: String(body.reason || "Edição operacional").trim(),
    before,
    after: structuredCloneSafe(order)
  });
}

function cancelOrder(db, order, reason, adminUser) {
  const payment = orderPayment(db, order.id);
  const tickets = orderTickets(db, order.id);
  if (tickets.some((ticket) => ticket.status === "used")) {
    const error = new Error("Pedido com ingresso ja utilizado nao pode ser cancelado pelo painel.");
    error.statusCode = 409;
    throw error;
  }

  const before = structuredCloneSafe({ order, payment, tickets });
  const now = new Date().toISOString();
  releaseConcessionReservation(db, order);
  order.status = "cancelled";
  order.cancelledBy = adminUser?.id || "";
  order.cancelledByEmail = adminUser?.email || "";
  order.cancelledAt = now;
  order.updatedAt = now;
  order.cancellationReason = String(reason || "Cancelado pelo painel").trim();

  if (payment) {
    payment.updatedAt = now;
    if (payment.status === "approved") {
      payment.refundStatus = payment.refundStatus || "required";
      payment.metadata = { ...(payment.metadata || {}), cancellationReason: order.cancellationReason };
      order.refundStatus = "required";
      order.paymentStatus = "approved";
    } else {
      payment.status = "cancelled";
      payment.cancelledAt = now;
      order.paymentStatus = "cancelled";
    }
  } else {
    order.paymentStatus = "cancelled";
  }

  tickets.forEach((ticket) => {
    ticket.status = "cancelled";
    ticket.cancelledAt = now;
    ticket.cancelledBy = adminUser?.id || "";
  });

  if (order.origin === "club" || payment?.method === "club_credit") {
    (db.subscriptionUsage || [])
      .filter((usage) => usage.orderId === order.id)
      .forEach((usage) => refundSubscriptionCreditForUsage(db, usage, adminUser, order.cancellationReason));
  }

  appendOrderAudit(order, {
    action: "cancel",
    cancelledBy: order.cancelledBy,
    reason: order.cancellationReason,
    before,
    after: structuredCloneSafe({ order, payment, tickets: orderTickets(db, order.id) })
  });
}

function archiveOrder(order, reason, adminUser) {
  const before = structuredCloneSafe(order);
  const now = new Date().toISOString();
  order.archived = true;
  order.archivedAt = now;
  order.archivedBy = adminUser?.id || "";
  order.archivedByEmail = adminUser?.email || "";
  order.updatedAt = now;
  appendOrderAudit(order, {
    action: "archive",
    updatedBy: order.archivedBy,
    reason: String(reason || "Arquivado pelo painel").trim(),
    before,
    after: structuredCloneSafe(order)
  });
}

function reverseConcessionStockForDeletion(db, order) {
  const status = order.stockReservationStatus;
  if (!["reserved", "sold"].includes(status)) return;
  eachStockedOrderItem(db, order, (item, quantity) => {
    item.stock = Number(item.stock || 0) + quantity;
    if (status === "reserved") item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
    if (status === "sold") item.sold = Math.max(0, Number(item.sold || 0) - quantity);
  });
  order.stockReservationStatus = "deleted_reversed";
}

function permanentlyDeleteOrder(db, orderId, body = {}, adminUser = {}) {
  if (!["owner", "master"].includes(adminUser.role)) {
    const error = new Error("Somente owner/master pode excluir pedido permanentemente.");
    error.statusCode = 403;
    throw error;
  }
  if (String(body.confirmation || "").trim().toUpperCase() !== "EXCLUIR") {
    const error = new Error("Digite EXCLUIR para confirmar a exclusão permanente.");
    error.statusCode = 422;
    throw error;
  }
  const reason = String(body.reason || "").trim();
  if (reason.length < 6) {
    const error = new Error("Informe um motivo claro para a exclusão permanente.");
    error.statusCode = 422;
    throw error;
  }
  const index = (db.orders || []).findIndex((item) => item.id === orderId);
  if (index === -1) {
    const error = new Error("Pedido nao encontrado.");
    error.statusCode = 404;
    throw error;
  }
  const order = db.orders[index];
  const payment = orderPayment(db, order.id);
  const tickets = orderTickets(db, order.id);
  const snapshot = structuredCloneSafe({
    order,
    payment,
    tickets,
    subscriptionUsage: (db.subscriptionUsage || []).filter((usage) => usage.orderId === order.id),
    webhookEvents: (db.webhookEvents || []).filter((event) => event.orderId === order.id)
  });
  reverseConcessionStockForDeletion(db, order);
  db.auditLogs ||= [];
  db.auditLogs.push({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: adminUser.id,
    userEmail: adminUser.email,
    action: "order.permanently_deleted",
    entityType: "order",
    entityId: order.id,
    before: sanitizeAuditValue(snapshot),
    after: null,
    orderReference: shortOrderReference(order),
    deletedBy: adminUser.id,
    deletedAt: new Date().toISOString(),
    reason,
    ip: requestContext.getStore()?.req ? clientIp(requestContext.getStore().req) : "",
    createdAt: new Date().toISOString()
  });
  db.payments = (db.payments || []).filter((item) => item.orderId !== order.id);
  db.tickets = (db.tickets || []).filter((item) => item.orderId !== order.id);
  db.subscriptionUsage = (db.subscriptionUsage || []).filter((item) => item.orderId !== order.id);
  db.webhookEvents = (db.webhookEvents || []).filter((item) => item.orderId !== order.id);
  db.orders.splice(index, 1);
  return { deleted: true, orderId, orderReference: shortOrderReference(order), externalFinancialProvider: payment && !["box_office", "admin", "external_manual", "manual_external", "internal_club"].includes(payment.provider) };
}

function removableDraftOrder(order, payment, tickets) {
  const draftStatuses = new Set(["draft", "test"]);
  return draftStatuses.has(order.status) && !payment && !tickets.some((ticket) => ticket.status === "used");
}

function repriceOrderFromCatalog(db, order) {
  const movie = db.movies.find((item) => item.id === order.movieId);
  if (!movie) {
    const error = new Error("Filme nao encontrado para este pedido.");
    error.statusCode = 400;
    throw error;
  }
  const session = (movie.sessions || []).find((item) => item.id === order.sessionId);
  if (!session || session.status === "sold_out") {
    const error = new Error("Sessao indisponivel para este pedido.");
    error.statusCode = 400;
    throw error;
  }
  if (!isSessionSellable(session, order.sessionDate || session.date || todayIsoDate())) {
    const error = new Error("Esta sessao ja iniciou e nao esta mais disponivel para venda.");
    error.statusCode = 409;
    error.code = "SESSION_SALES_CLOSED";
    throw error;
  }

  const fullTicketsCount = Math.max(0, Number(order.fullTicketsCount || 0));
  const halfTicketsCount = Math.max(0, Number(order.halfTicketsCount || 0));
  if (fullTicketsCount + halfTicketsCount <= 0) {
    const error = new Error("Selecione pelo menos um ingresso.");
    error.statusCode = 400;
    throw error;
  }
  const requestedTickets = fullTicketsCount + halfTicketsCount;
  const roomCapacity = Number((db.rooms || []).find((room) => room.status === "active")?.capacity || 120);
  const paidTickets = (db.tickets || []).filter((ticket) =>
    ticket.sessionId === session.id && !["cancelled", "refunded"].includes(ticket.status)
  ).length;
  const reservedTickets = (db.orders || []).filter((existingOrder) =>
    existingOrder.sessionId === session.id &&
    existingOrder.status === "pending_payment" &&
    (!existingOrder.reservationExpiresAt || new Date(existingOrder.reservationExpiresAt).getTime() > Date.now())
  ).reduce((sum, existingOrder) => sum + Number(existingOrder.fullTicketsCount || 0) + Number(existingOrder.halfTicketsCount || 0), 0);
  if (paidTickets + reservedTickets + requestedTickets > roomCapacity) {
    const error = new Error("Esta sessao nao possui lugares suficientes para a quantidade escolhida.");
    error.statusCode = 409;
    throw error;
  }

  const ticketTotal = fullTicketsCount * Number(session.priceFull || 0) + halfTicketsCount * Number(session.priceHalf || 0);
  const concessionItems = (order.concessionItems || [])
    .map((item) => {
      const concession = db.concessions.find((catalogItem) => catalogItem.id === item.id && catalogItem.active !== false);
      if (!concession) {
        const error = new Error(`Produto indisponivel na bomboniere: ${item.name || item.id}`);
        error.statusCode = 400;
        throw error;
      }
      const quantity = Math.max(0, Math.min(Number(item.quantity || 0), Number(concession.maxPerOrder || 8)));
      if (finiteStock(concession) && quantity > Number(concession.stock || 0)) {
        const error = new Error(`${concession.name} nao possui estoque suficiente.`);
        error.statusCode = 409;
        throw error;
      }
      return {
        id: concession.id,
        sku: concession.sku,
        name: concession.name,
        category: concession.category,
        imageUrl: concession.imageUrl,
        quantity,
        unitPrice: Number(concession.price || 0)
      };
    })
    .filter((item) => item.quantity > 0);

  const pricedItems = concessionItems;
  const concessionTotal = pricedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const couponCode = String(order.couponCode || "").trim().toUpperCase();
  const discountValue = couponCode === "CINE10" ? (ticketTotal + concessionTotal) * 0.1 : 0;
  const totalPrice = Math.max(0, Number((ticketTotal + concessionTotal - discountValue).toFixed(2)));

  return {
    ...order,
    movieTitle: movie.title,
    sessionTime: session.time,
    sessionDate: session.date || order.sessionDate || todayIsoDate(),
    sessionFormat: session.format,
    sessionRoom: session.room || "Sala Cruzeiro",
    fullTicketsCount,
    halfTicketsCount,
    concessionItems: pricedItems,
    includeComboUpsell: pricedItems.length > 0,
    comboUpsellQuantity: pricedItems.reduce((sum, item) => sum + item.quantity, 0),
    discountValue,
    totalPrice
  };
}

function normalizePromotion(input, existing = {}) {
  const title = String(input.title || existing.title || "Promocao").trim();
  return {
    id: String(input.id || existing.id || slugify(title) || `promocao-${Date.now()}`),
    title,
    description: input.description || existing.description || "",
    discountType: input.discountType || existing.discountType || "fixed_price",
    value: Number(input.value ?? existing.value ?? 0),
    couponCode: String(input.couponCode || existing.couponCode || "").trim().toUpperCase(),
    startsAt: input.startsAt || existing.startsAt || "",
    endsAt: input.endsAt || existing.endsAt || "",
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
  };
}

function normalizeAd(input, existing = {}) {
  const title = String(input.title || existing.title || "Anuncio").trim();
  return {
    id: String(input.id || existing.id || slugify(title) || `anuncio-${Date.now()}`),
    title,
    placement: input.placement || existing.placement || "home",
    imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
    linkUrl: input.linkUrl || existing.linkUrl || "",
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
  };
}

function normalizeUser(input, existing = {}) {
  const name = String(input.name || existing.name || "Usuario").trim();
  const email = String(input.email || existing.email || "").trim().toLowerCase();
  const rawRole = input.role || existing.role || "customer";
  const role = rawRole === "editor" ? "manager" : rawRole;
  return {
    id: String(input.id || existing.id || slugify(email || name) || `usuario-${Date.now()}`),
    name,
    email,
    phone: input.phone !== undefined ? String(input.phone || "").trim() : existing.phone || "",
    cpf: input.cpf !== undefined ? String(input.cpf || "").replace(/\D/g, "").slice(0, 11) : existing.cpf || "",
    passwordHash: input.password ? hashPassword(String(input.password)) : input.passwordHash || existing.passwordHash || "",
    authProvider: input.authProvider || existing.authProvider || (input.googleSub || existing.googleSub ? "google" : "email"),
    googleSub: input.googleSub || existing.googleSub || "",
    picture: input.picture || existing.picture || "",
    emailVerified: input.emailVerified !== undefined ? Boolean(input.emailVerified) : Boolean(existing.emailVerified),
    pendingEmail: input.pendingEmail !== undefined ? String(input.pendingEmail || "").trim().toLowerCase() : existing.pendingEmail || "",
    emailVerificationHash: input.emailVerificationHash !== undefined ? input.emailVerificationHash : existing.emailVerificationHash || "",
    emailVerificationExpiresAt: input.emailVerificationExpiresAt !== undefined ? input.emailVerificationExpiresAt : existing.emailVerificationExpiresAt || "",
    emailVerificationRequestedAt: input.emailVerificationRequestedAt !== undefined ? input.emailVerificationRequestedAt : existing.emailVerificationRequestedAt || "",
    passwordResetHash: input.passwordResetHash !== undefined ? input.passwordResetHash : existing.passwordResetHash || "",
    passwordResetExpiresAt: input.passwordResetExpiresAt !== undefined ? input.passwordResetExpiresAt : existing.passwordResetExpiresAt || "",
    passwordResetRequestedAt: input.passwordResetRequestedAt !== undefined ? input.passwordResetRequestedAt : existing.passwordResetRequestedAt || "",
    emailUnsubscribedAt: input.emailUnsubscribedAt !== undefined ? input.emailUnsubscribedAt : existing.emailUnsubscribedAt || "",
    emailUnsubscribeToken: input.emailUnsubscribeToken !== undefined ? input.emailUnsubscribeToken : existing.emailUnsubscribeToken || "",
    role: ["owner", "master", "manager", "operator", "seller", "customer"].includes(role) ? role : "customer",
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false,
    updatedAt: new Date().toISOString(),
    createdAt: existing.createdAt || input.createdAt || new Date().toISOString()
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordResetHash, passwordResetExpiresAt, passwordResetRequestedAt, emailVerificationHash, emailUnsubscribeToken, ...safeUser } = user;
  return safeUser;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const [algorithm, iterations, salt, expectedHash] = String(passwordHash).split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;
  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256")
    .toString("base64url");
  if (Buffer.byteLength(actualHash) !== Buffer.byteLength(expectedHash)) return false;
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

const EMAIL_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

function requestStillCoolingDown(value, windowMs = EMAIL_REQUEST_COOLDOWN_MS) {
  if (!value) return false;
  const requestedAt = new Date(value).getTime();
  return Number.isFinite(requestedAt) && Date.now() - requestedAt < windowMs;
}

function ensureEmailUnsubscribeToken(user) {
  if (!user) return "";
  if (!user.emailUnsubscribeToken) {
    user.emailUnsubscribeToken = crypto.randomBytes(32).toString("base64url");
    user.updatedAt = new Date().toISOString();
  }
  return user.emailUnsubscribeToken;
}

function emailUnsubscribeUrlForUser(user) {
  const token = ensureEmailUnsubscribeToken(user);
  return token ? `${appFrontendUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}` : "";
}

function transactionalEmailConfigured(db) {
  const config = integrationConfigService.resolvedConfig(db, "email");
  return Boolean((config?.enabled && config?.configured) || getPasswordResetEmailWebhookUrl(db) || getEmailVerificationWebhookUrl(db));
}

async function notifyPasswordReset(email, resetUrl, db, options = {}) {
  const sentBySmtp = await emailService.sendPasswordReset(db, email, resetUrl, options).catch(() => false);
  if (sentBySmtp) return true;
  const deliveryUrl = getPasswordResetEmailWebhookUrl(db);
  if (!deliveryUrl) {
    logEvent("warn", "password_reset.delivery_missing_channel", { email });
    return false;
  }
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Origin-Client": "CineCruzeiro-Backend"
    },
    body: JSON.stringify({
      event: "password_reset.requested",
      timestamp: new Date().toISOString(),
      cinemaId: "cine_cruzeiro_sala_1",
      data: { email, resetUrl }
    })
  }).catch(() => null);
  const ok = Boolean(response?.ok);
  if (!ok) logEvent("warn", "password_reset.delivery_failed", { email, status: response?.status || 0 });
  return ok;
}

async function notifyEmailVerification(email, verificationUrl, db, options = {}) {
  const sentBySmtp = await emailService.sendEmailVerification(db, email, verificationUrl, options).catch(() => false);
  if (sentBySmtp) return true;
  const deliveryUrl = getEmailVerificationWebhookUrl(db);
  if (!deliveryUrl) {
    logEvent("warn", "email_verification.delivery_missing_channel", { email });
    return false;
  }
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Origin-Client": "CineCruzeiro-Backend"
    },
    body: JSON.stringify({
      event: "email_verification.requested",
      timestamp: new Date().toISOString(),
      cinemaId: "cine_cruzeiro_sala_1",
      data: { email, verificationUrl }
    })
  }).catch(() => null);
  const ok = Boolean(response?.ok);
  if (!ok) logEvent("warn", "email_verification.delivery_failed", { email, status: response?.status || 0 });
  return ok;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iat: now,
    exp: now + 60 * 60 * 8,
    iss: "cine-cruzeiro-admin",
    ...payload
  };
  const encoded = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyJwt(token) {
  const [header, body, signature] = String(token || "").split(".");
  if (!header || !body || !signature) return null;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(`${header}.${body}`).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function authResponse(user) {
  return {
    token: signJwt({ sub: user.id, email: user.email, role: user.role, name: user.name }),
    user: sanitizeUser(user)
  };
}

function customerSessionValue(user) {
  return signedValue({
    sub: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  });
}

function bearerPayload(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? verifyJwt(match[1]) : null;
}

function tmdbAuthUrl(pathname, params = {}, db) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  const tmdb = getTmdbCredentials(db);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  if (tmdb.mode === "api_key") {
    url.searchParams.set("api_key", tmdb.token);
  }

  return url;
}

async function tmdbFetch(pathname, params = {}, db) {
  const tmdb = getTmdbCredentials(db);

  if (!tmdb.configured) {
    const error = new Error(tmdbSetupMessage());
    error.statusCode = 412;
    throw error;
  }

  const headers = tmdb.mode === "bearer" ? { Authorization: `Bearer ${tmdb.token}` } : {};

  const response = await fetch(tmdbAuthUrl(pathname, params, db), { headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.status_message || "Erro ao consultar o TMDB.");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function minutesToDuration(runtime) {
  const total = Number(runtime || 0);
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function tmdbCertification(details) {
  const releases = details.release_dates?.results || [];
  const br = releases.find((item) => item.iso_3166_1 === "BR");
  const cert = br?.release_dates?.find((item) => item.certification)?.certification;
  if (!cert) return "L";
  return cert === "Livre" ? "L" : cert;
}

function tmdbMoviePayload(details) {
  const title = details.title || details.original_title || "";
  return {
    id: slugify(title || `tmdb-${details.id}`),
    slug: slugify(title || `tmdb-${details.id}`),
    tmdbId: details.id,
    status: "upcoming",
    workflowStatus: "draft",
    title,
    originalTitle: details.original_title || "",
    synopsis: details.overview || "",
    duration: minutesToDuration(details.runtime),
    director: details.credits?.crew?.find((person) => person.job === "Director")?.name || "",
    metadata: {
      tmdbId: details.id,
      originalLanguage: details.original_language || "",
      popularity: details.popularity || 0,
      voteAverage: details.vote_average || 0
    },
    genre: Array.isArray(details.genres) ? details.genres.map((genre) => genre.name) : [],
    rating: tmdbCertification(details),
    posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : "",
    backdropUrl: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : "",
    trailerYoutubeId:
      details.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")?.key || "",
    trailerVideoUrl: "",
    localTrailerUrl: "",
    trailerSourceUrl: "",
    trailerCacheStatus: "idle",
    trailerCachedAt: "",
    trailerCacheError: "",
    isHighlight: false,
    highlightTrailerBackground: true,
    releaseDate: details.release_date || "",
    autoPublish: false,
    tag: "Em Breve",
    sessions: []
  };
}

function assetRecord(record, keys) {
  if (!record) return record;
  const next = { ...record };
  keys.forEach((key) => {
    if (next[key]) next[key] = publicAssetUrl(next[key]);
  });
  return next;
}

function assetMovie(movie) {
  return assetRecord(movie, ["posterUrl", "backdropUrl"]);
}

function getContent(db, options = {}) {
  const includePrivate = Boolean(options.includePrivate);
  const now = new Date();
  const publicSettings = { ...(db.settings || {}) };
  delete publicSettings.integrations;
  delete publicSettings.webhookSimulatorRuns;
  delete publicSettings.emailCampaigns;
  const analyticsConfig = integrationConfigService.resolvedConfig(db, "analytics");
  publicSettings.tracking = {
    enabled: Boolean(analyticsConfig?.enabled && analyticsConfig?.configured),
    googleMeasurementId: analyticsConfig?.enabled ? String(analyticsConfig.googleMeasurementId || "") : "",
    metaPixelId: analyticsConfig?.enabled ? String(analyticsConfig.metaPixelId || "") : ""
  };
  const movies = [...(db.movies || [])]
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")))
    .map(assetMovie);
  const visibleMovies = movies
    .filter((movie) => movie.status !== "hidden")
    .map((movie) => ({ ...movie, sessions: sellableSessions(movie, now) }));
  const nowPlaying = visibleMovies.filter((movie) => movie.status === "now_playing");
  const upcoming = visibleMovies.filter((movie) => movie.status === "upcoming");
  const featuredMovie = visibleMovies.find((movie) => movie.isHighlight) || nowPlaying[0] || visibleMovies[0] || null;
  const ticketsByOrderId = includePrivate
    ? (db.tickets || []).reduce((map, ticket) => {
        const orderId = String(ticket.orderId || "");
        if (!orderId) return map;
        const tickets = map.get(orderId) || [];
        tickets.push(ticket);
        map.set(orderId, tickets);
        return map;
      }, new Map())
    : null;

  return {
    settings: assetRecord(publicSettings, [
      "logoUrl",
      "clubHeroImageUrl",
      "clubBannerImageUrl",
      "eventHeroImageUrl",
      "eventGamesImageUrl",
      "eventPartiesImageUrl",
      "eventCorporateImageUrl",
      "eventGalleryImageUrl"
    ]),
    calendar: {
      timezone: "America/Sao_Paulo",
      today: todayIsoDate(),
      days: buildCalendarDaysForMovies(visibleMovies, 7)
    },
    rooms: db.rooms,
    ticketTypes: db.ticketTypes,
    concessions: (db.concessions || []).map((item) => assetRecord(item, ["imageUrl"])),
    promotions: (db.promotions || []).map((item) => assetRecord(item, ["imageUrl"])),
    ads: (db.ads || []).map((item) => assetRecord(item, ["imageUrl"])),
    movies: includePrivate ? movies : visibleMovies,
    nowPlaying,
    upcoming,
    featuredMovie,
    ...(includePrivate
      ? {
          users: db.users.map(sanitizeUser),
          orders: db.orders.map((order) => ({
            ...order,
            tickets: (ticketsByOrderId.get(String(order.id || "")) || []).map((ticket) => enrichTicket(db, ticket))
          })),
          payments: db.payments || [],
          tickets: (db.tickets || []).map((ticket) => enrichTicket(db, ticket)),
          auditLogs: db.auditLogs || [],
          subscriptionPlans: (db.subscriptionPlans || []).map((item) => assetRecord(item, ["imageUrl"])),
          subscriptions: db.subscriptions || [],
          subscriptionCredits: db.subscriptionCredits || [],
          subscriptionUsage: db.subscriptionUsage || []
        }
      : {})
  };
}

function paymentStatusLabel(status = "") {
  return {
    approved: "Pago",
    paid: "Pago",
    pending: "Aguardando pagamento",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    rejected: "Pagamento recusado",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function orderStatusLabel(status = "") {
  return {
    paid: "Pago",
    pending: "Pendente",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    draft: "Rascunho",
    test: "Teste"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function originLabel(origin = "") {
  return {
    online: "Site",
    box_office: "Bilheteria",
    club: "Clube",
    manual: "Bilheteria"
  }[String(origin || "").toLowerCase()] || origin || "Site";
}

function methodLabel(method = "") {
  return {
    pix: "Pix",
    external_pix: "Pix",
    PIX: "Pix",
    credit_card: "Cartão",
    CREDIT_CARD: "Cartão",
    cash: "Dinheiro",
    card_terminal: "Cartão na maquininha",
    courtesy: "Cortesia",
    club_credit: "Crédito do Clube",
    CLUB_CREDIT: "Crédito do Clube"
  }[String(method || "")] || method || "Nao informado";
}

function providerLabel(provider = "") {
  return {
    open_finance: "Pix legado",
    mercado_pago: "Mercado Pago",
    box_office: "Bilheteria",
    admin: "Administração",
    internal_club: "Clube",
    external_manual: "Registro manual",
    manual_external: "Maquininha externa"
  }[String(provider || "").toLowerCase()] || provider || "Manual";
}

function parseAdminPeriod(url) {
  const period = url.searchParams.get("period") || "today";
  const today = todayIsoDate();
  const now = new Date(`${today}T12:00:00`);
  const iso = (date) => date.toISOString().slice(0, 10);
  let start = today;
  let end = today;
  if (period === "7d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 6);
    start = iso(date);
  } else if (period === "30d") {
    const date = new Date(now);
    date.setDate(date.getDate() - 29);
    start = iso(date);
  } else if (period === "month") {
    start = `${today.slice(0, 7)}-01`;
  } else if (period === "custom") {
    start = url.searchParams.get("from") || today;
    end = url.searchParams.get("to") || today;
  }
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59`);
  const days = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - days + 1);
  return {
    period,
    start,
    end,
    days,
    previousStart: iso(previousStartDate),
    previousEnd: iso(previousEndDate)
  };
}

function inDateRange(value, start, end) {
  const date = String(value || "").slice(0, 10);
  return date && date >= start && date <= end;
}

function compareMetric(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((Number(current || 0) - Number(previous || 0)) / Number(previous)) * 100);
}

function shortOrderReference(order) {
  const raw = String(order?.reference || order?.id || "");
  const tail = raw.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000";
  return `#CC-${tail}`;
}

function movieForOrder(db, order) {
  return (db.movies || []).find((movie) => movie.id === order.movieId) || null;
}

function sessionForOrder(db, order) {
  const movie = movieForOrder(db, order);
  return (movie?.sessions || []).find((session) => session.id === order.sessionId) || null;
}

function orderTicketCount(order) {
  return Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
}

function sessionCapacity(db, session) {
  const roomName = String(session?.room || "").split(" (")[0];
  const room = (db.rooms || []).find((item) => item.name === roomName || session?.room?.includes(item.name));
  return Number(room?.capacity || 120);
}

function sessionAvailabilityStatus(session, sold, capacity) {
  const now = new Date();
  const startsAt = session?.date && session?.time ? new Date(`${session.date}T${session.time}:00`) : null;
  if (startsAt && startsAt < now) return "Encerrada";
  if (sold >= capacity || session?.status === "sold_out") return "Esgotada";
  const rate = capacity ? sold / capacity : 0;
  if (rate >= 0.9) return "Quase lotada";
  if (rate >= 0.7 || session?.status === "filling_fast") return "Enchendo rápido";
  return "Boa disponibilidade";
}

function adminDashboard(db, options = {}) {
  const now = new Date();
  const today = todayIsoDate();
  const period = options.period || { period: "today", start: today, end: today, previousStart: today, previousEnd: today, days: 1 };
  const paidOrders = (db.orders || []).filter((order) => order.status === "paid");
  const periodOrders = (db.orders || []).filter((order) => inDateRange(order.createdAt, period.start, period.end));
  const periodPaidOrders = paidOrders.filter((order) => inDateRange(order.createdAt, period.start, period.end));
  const previousPaidOrders = paidOrders.filter((order) => inDateRange(order.createdAt, period.previousStart, period.previousEnd));
  const todayOrders = paidOrders.filter((order) => String(order.createdAt || "").slice(0, 10) === today);
  const sum = (orders) => orders.reduce((total, order) => total + Number(order.totalPrice || 0), 0);
  const ticketCountForOrders = (orders) => orders.reduce((total, order) => total + orderTicketCount(order), 0);
  const ticketsSold = ticketCountForOrders(periodPaidOrders);
  const todaySessions = (db.movies || [])
    .flatMap((movie) => (movie.sessions || []).filter((session) => session.date === today).map((session) => {
      const sold = (db.tickets || []).filter((ticket) => ticket.sessionId === session.id && !["cancelled", "refunded"].includes(ticket.status)).length;
      const capacity = sessionCapacity(db, session);
      return {
        movie: {
          id: movie.id,
          slug: movie.slug || movie.id,
          title: movie.title,
          posterUrl: movie.posterUrl || "",
          rating: movie.rating || "L"
        },
        session,
        sold,
        capacity,
        occupancyRate: capacity ? Math.round((sold / capacity) * 100) : 0,
        status: sessionAvailabilityStatus(session, sold, capacity)
      };
    }))
    .sort((a, b) => String(a.session.time).localeCompare(String(b.session.time)));
  const upcomingSessions = todaySessions.slice(0, 8);
  const roomCapacity = Number((db.rooms || []).find((room) => room.status === "active")?.capacity || 120);
  const occupied = todaySessions.reduce((total, item) => total + item.sold, 0);
  const totalCapacity = todaySessions.reduce((total, item) => total + item.capacity, 0) || roomCapacity;
  const groupCount = (items, getter) => items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const groupAmount = (items, getter) => items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + Number(item.totalPrice || item.amount || 0);
    return acc;
  }, {});
  const productSales = {};
  let concessionRevenue = 0;
  const revenueByMovie = {};
  periodPaidOrders.forEach((order) => (order.concessionItems || []).forEach((item) => {
    const key = item.name || item.id;
    productSales[key] = (productSales[key] || 0) + Number(item.quantity || 0);
    concessionRevenue += Number(item.totalPrice ?? item.price * item.quantity ?? 0);
  }));
  periodPaidOrders.forEach((order) => {
    const movie = movieForOrder(db, order);
    const movieTitle = order.movieTitle || movie?.title || "Filme não identificado";
    const extrasTotal = (order.concessionItems || []).reduce((total, item) => total + Number(item.totalPrice ?? item.price * item.quantity ?? 0), 0);
    const ticketRevenue = Math.max(0, Number(order.totalPrice || 0) - extrasTotal);
    revenueByMovie[movieTitle] = (revenueByMovie[movieTitle] || 0) + ticketRevenue;
  });
  const lowStockProducts = (db.concessions || [])
    .filter((item) => item.active !== false && item.stock !== "" && item.stock !== undefined && Number(item.stock || 0) <= 5)
    .map((item) => ({ id: item.id, name: item.name, imageUrl: item.imageUrl || "", stock: Number(item.stock || 0) }))
    .slice(0, 6);
  const latestOrders = periodOrders.slice(0, 8).map((order) => ({
    id: order.id,
    reference: shortOrderReference(order),
    customerName: order.customerName || order.customer?.name || "Cliente",
    movieTitle: order.movieTitle || movieForOrder(db, order)?.title || "Filme",
    status: orderStatusLabel(order.status),
    origin: originLabel(order.origin || "online"),
    paymentMethod: methodLabel(order.paymentMethod),
    totalPrice: Number(order.totalPrice || 0),
    createdAt: order.createdAt || ""
  }));
  const paymentsInPeriod = (db.payments || []).filter((payment) => inDateRange(payment.createdAt, period.start, period.end));
  const approvedPaymentStatuses = new Set(["approved", "paid", "processed"]);
  const clubRevenue = paymentsInPeriod
    .filter((payment) => approvedPaymentStatuses.has(String(payment.status || "").toLowerCase()) && payment.metadata?.kind === "club_subscription")
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const ticketRevenue = Math.max(0, sum(periodPaidOrders) - concessionRevenue);
  const revenueComposition = [
    { key: "tickets", label: "Ingressos", amount: ticketRevenue, hint: `${ticketsSold} ingresso(s) vendidos` },
    { key: "concessions", label: "Bomboniere", amount: concessionRevenue, hint: `${Object.values(productSales).reduce((total, quantity) => total + Number(quantity || 0), 0)} item(ns) vendido(s)` },
    { key: "club", label: "Assinaturas do Clube", amount: clubRevenue, hint: "Pagamentos recorrentes aprovados" }
  ];
  const attentionPayments = (db.payments || []).filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    if (["rejected", "cancelled"].includes(status)) return true;
    if (payment.refundStatus === "required" || payment.refundStatus === "pending") return true;
    if (["pending", "processing"].includes(status)) {
      const ageMinutes = (Date.now() - new Date(payment.createdAt || Date.now()).getTime()) / 60000;
      return ageMinutes > 20;
    }
    return false;
  }).slice(0, 8);
  const chart = [];
  for (let index = 0; index < period.days; index += 1) {
    const date = new Date(`${period.start}T12:00:00`);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const orders = periodPaidOrders.filter((order) => String(order.createdAt || "").slice(0, 10) === key);
    chart.push({
      date: key,
      revenue: sum(orders),
      orders: orders.length,
      tickets: ticketCountForOrders(orders)
    });
  }
  const clubSubscriptions = db.subscriptions || [];
  const newSubscribers = clubSubscriptions.filter((item) => inDateRange(item.createdAt || item.startedAt, period.start, period.end)).length;
  const cancelledSubscriptions = clubSubscriptions.filter((item) => inDateRange(item.cancelledAt, period.start, period.end)).length;
  const activeSubscriptions = clubSubscriptions.filter((item) => item.status === "active");
  const recurringRevenueEstimate = activeSubscriptions.reduce((total, subscription) => {
    const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
    return total + Number(plan?.monthlyPrice || plan?.price || 0);
  }, 0);
  const periodUsers = (db.users || []).filter((user) => user.role === "customer" && inDateRange(user.createdAt, period.start, period.end));
  const problematicStatuses = ["pending", "processing", "rejected", "cancelled", "refunded"];
  return {
    period,
    revenueToday: sum(todayOrders),
    revenuePeriod: sum(periodPaidOrders),
    revenueMonth: sum(periodPaidOrders),
    comparison: {
      revenue: compareMetric(sum(periodPaidOrders), sum(previousPaidOrders)),
      sales: compareMetric(periodPaidOrders.length, previousPaidOrders.length),
      tickets: compareMetric(ticketsSold, ticketCountForOrders(previousPaidOrders))
    },
    salesToday: todayOrders.length,
    salesPeriod: periodPaidOrders.length,
    salesMonth: periodPaidOrders.length,
    ticketsSold,
    averageTicket: periodPaidOrders.length ? sum(periodPaidOrders) / periodPaidOrders.length : 0,
    customers: (db.users || []).filter((user) => user.role === "customer").length,
    newCustomers: periodUsers.length,
    activeSubscriptions: activeSubscriptions.length,
    pendingPayments: (db.payments || []).filter((payment) => ["pending", "processing"].includes(payment.status)).length,
    rejectedPayments: (db.payments || []).filter((payment) => payment.status === "rejected").length,
    problematicPayments: (db.payments || []).filter((payment) => problematicStatuses.includes(String(payment.status || "").toLowerCase())).length,
    concessionRevenue,
    ticketRevenue,
    clubRevenue,
    revenueComposition,
    revenueByMovie: Object.entries(revenueByMovie)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 8)
      .map(([name, amount]) => ({ name, amount })),
    capacity: { roomCapacity: totalCapacity, occupied, occupancyRate: totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0 },
    salesByOrigin: groupCount(periodOrders, (order) => originLabel(order.origin || "online")),
    revenueByOrigin: groupAmount(periodPaidOrders, (order) => originLabel(order.origin || "online")),
    paymentMethods: groupCount(periodOrders, (order) => methodLabel(order.paymentMethod)),
    revenueByMethod: groupAmount(periodPaidOrders, (order) => methodLabel(order.paymentMethod)),
    reconciliation: groupAmount(paymentsInPeriod, (payment) => paymentStatusLabel(payment.status)),
    upcomingSessions,
    todaySessions,
    chart,
    attentionPayments: attentionPayments.map((payment) => {
      const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
      return {
        id: payment.id,
        orderId: payment.orderId,
        orderReference: shortOrderReference(order),
        status: paymentStatusLabel(payment.status),
        method: methodLabel(payment.method),
        provider: providerLabel(payment.provider),
        amount: Number(payment.amount || 0),
        message: payment.refundStatus ? "Reembolso pendente" : ["pending", "processing"].includes(payment.status) ? "Aguardando confirmação há muito tempo" : paymentStatusLabel(payment.status),
        createdAt: payment.createdAt || ""
      };
    }),
    topProducts: Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, quantity]) => ({ name, quantity })),
    lowStockProducts,
    club: {
      activeSubscriptions: activeSubscriptions.length,
      newSubscribers,
      cancellations: cancelledSubscriptions,
      recurringRevenueEstimate,
      creditsIssued: (db.subscriptionCredits || []).filter((item) => inDateRange(item.cycleStart || item.createdAt, period.start, period.end)).reduce((total, item) => total + Number(item.total || 0), 0),
      creditsUsed: (db.subscriptionUsage || []).filter((item) => inDateRange(item.usedAt, period.start, period.end)).length
    },
    cardTerminal: {
      configured: cardTerminalProvider.configured(),
      provider: providerLabel(cardTerminalProvider.providerName())
    },
    latestOrders,
    generatedAt: now.toISOString()
  };
}

function adminIntegrationsStatus(req, db) {
  const integrations = integrationConfigService.list(db);
  const googleOAuth = getGoogleOAuthConfig(req, db);
  const wallet = getGoogleWalletConfig(db);
  const tmdb = getTmdbCredentials(db);
  integrations.googleLogin.configured = Boolean(googleOAuth.clientId && googleOAuth.clientSecret);
  integrations.googleWallet.configured = Boolean(wallet.configured);
  integrations.tmdb.configured = Boolean(tmdb.configured);
  integrations.email.configured = Boolean(integrationConfigService.resolvedConfig(db, "email")?.configured || getEmailVerificationWebhookUrl(db) || getPasswordResetEmailWebhookUrl(db));
  integrations.crm.configured = Boolean(getCrmWebhookUrl(db));
  return integrations;
}

function googleWalletApiError(error, fallback = "Google Wallet recusou a requisicao.") {
  if (!error) return fallback;
  if (error.error) {
    const apiError = error.error;
    const details = Array.isArray(apiError.errors) && apiError.errors[0] ? apiError.errors[0] : {};
    return [apiError.status || details.reason || "", apiError.message || fallback].filter(Boolean).join(": ");
  }
  return error.message || fallback;
}

async function googleWalletAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signWalletJwt({
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }, config.privateKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const error = new Error(googleWalletApiError(payload, "Falha ao autenticar a Service Account."));
    error.statusCode = response.status;
    throw error;
  }
  return payload.access_token;
}

async function googleWalletApiGet(pathname, config) {
  const token = await googleWalletAccessToken(config);
  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1${pathname}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(googleWalletApiError(payload));
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function testGoogleWalletIntegration(db) {
  const wallet = getGoogleWalletConfig(db);
  const checks = [
    { key: "serviceAccount", label: "Service Account", ok: Boolean(wallet.clientEmail && wallet.privateKey), detail: wallet.clientEmail ? `Configurada como ${wallet.clientEmail}` : "JSON da Service Account ausente." },
    { key: "issuer", label: "Issuer", ok: Boolean(wallet.issuerId), detail: wallet.issuerId || "Issuer ID ausente." },
    { key: "class", label: "Classe", ok: Boolean(wallet.classId), detail: wallet.classId || "Class ID ausente." },
    { key: "origin", label: "Origem", ok: wallet.origins.length > 0, detail: wallet.origins.join(", ") || "Origem ausente." }
  ];
  if (checks.some((item) => !item.ok)) {
    return {
      ok: false,
      message: checks.find((item) => !item.ok)?.detail || "Configuração incompleta.",
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket"
      }
    };
  }

  try {
    const eventClass = await googleWalletApiGet(`/eventTicketClass/${encodeURIComponent(wallet.classId)}`, wallet);
    const issuerFromClass = String(eventClass.id || "").split(".")[0] || "";
    const classApproved = String(eventClass.reviewStatus || "").toUpperCase() === "APPROVED";
    checks.push(
      { key: "auth", label: "Autenticação", ok: true, detail: "Service Account autenticada na API Google Wallet." },
      { key: "classRead", label: "EventTicketClass", ok: true, detail: `${eventClass.id || wallet.classId} encontrada.` },
      { key: "classIssuer", label: "Classe do Issuer", ok: issuerFromClass === wallet.issuerId, detail: issuerFromClass === wallet.issuerId ? "Class ID pertence ao Issuer configurado." : `Classe pertence ao Issuer ${issuerFromClass || "desconhecido"}.` },
      { key: "classStatus", label: "Status da classe", ok: classApproved, detail: eventClass.reviewStatus || "Status não informado." },
      { key: "jwt", label: "Geração JWT", ok: true, detail: "Assinatura RS256 pronta para Save to Google Wallet." },
      { key: "publication", label: "Publicação", ok: true, detail: String(wallet.environment || "production") === "sandbox" ? "Modo de demonstração/teste." : "Produção configurada." }
    );
    const ok = checks.every((item) => item.ok);
    logEvent("info", "google_wallet.integration.tested", {
      ok,
      issuerId: wallet.issuerId,
      classId: wallet.classId,
      clientEmail: wallet.clientEmail,
      origins: wallet.origins,
      passType: "EventTicket",
      reviewStatus: eventClass.reviewStatus || ""
    });
    return {
      ok,
      message: ok
        ? "Google Wallet autenticado, Issuer encontrado e EventTicketClass pronta."
        : checks.find((item) => !item.ok)?.detail || "Revise a configuração do Google Wallet.",
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket",
        reviewStatus: eventClass.reviewStatus || "",
        demoModeNotice: "Se o Issuer estiver em modo de demonstração, apenas usuários de teste conseguem adicionar o ingresso."
      }
    };
  } catch (error) {
    checks.push({ key: "api", label: "API Google Wallet", ok: false, detail: error.message || "Falha ao consultar a classe." });
    logEvent("warn", "google_wallet.integration_failed", {
      issuerId: wallet.issuerId,
      classId: wallet.classId,
      clientEmail: wallet.clientEmail,
      origins: wallet.origins,
      passType: "EventTicket",
      statusCode: error.statusCode || 0,
      message: error.message
    });
    return {
      ok: false,
      message: error.statusCode === 403
        ? `Falha: a Service Account não possui acesso ao Issuer ${wallet.issuerId}.`
        : error.message || "Falha ao testar Google Wallet.",
      checks,
      diagnostics: {
        issuerId: wallet.issuerId,
        classId: wallet.classId,
        clientEmail: wallet.clientEmail,
        origins: wallet.origins,
        passType: "EventTicket",
        statusCode: error.statusCode || 0
      }
    };
  }
}

async function testIntegrationProvider(db, provider, req) {
  const key = integrationConfigService.providerKey(provider);
  const config = integrationConfigService.resolvedConfig(db, key);
  if (!key || !config) {
    return { ok: false, message: "Integração não encontrada." };
  }
  if (key === "mercadoPago") {
    if (!config.accessToken || !config.publicKey) return { ok: false, message: "Informe public key e access token do Mercado Pago." };
    const response = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${config.accessToken}` } });
    return { ok: response.ok, message: response.ok ? "Mercado Pago autenticado com sucesso." : "Mercado Pago recusou as credenciais." };
  }
  if (key === "tmdb") {
    const data = await tmdbFetch("/configuration", {}, db).catch((error) => ({ error }));
    return data.error ? { ok: false, message: data.error.message || "TMDB indisponível." } : { ok: true, message: "TMDB conectado com sucesso." };
  }
  if (key === "googleLogin") {
    const googleOAuth = getGoogleOAuthConfig(req, db);
    return googleOAuth.clientId && googleOAuth.clientSecret
      ? { ok: true, message: "Login com Google possui credenciais mínimas." }
      : { ok: false, message: "Informe Client ID e Client secret." };
  }
  if (key === "googleWallet") {
    return testGoogleWalletIntegration(db);
  }
  if (key === "email") {
    if (String(config.provider || "smtp") === "smtp" || config.smtpHost) {
      const verified = await emailService.verifySmtp(db);
      if (!verified.ok) return verified;
      return emailService.sendIntegrationTest(db, req.adminUser?.email || config.fromEmail);
    }
    if (!config.webhookUrl) return { ok: false, message: "Informe SMTP ou webhook do provedor de e-mail." };
    return emailService.sendIntegrationTest(db, req.adminUser?.email || config.fromEmail);
  }
  if (key === "analytics") {
    const googleValid = !config.googleMeasurementId || /^G-[A-Z0-9]+$/i.test(config.googleMeasurementId);
    const metaValid = !config.metaPixelId || /^\d{5,30}$/.test(config.metaPixelId);
    const configured = Boolean(config.googleMeasurementId || config.metaPixelId);
    return {
      ok: configured && googleValid && metaValid,
      message: !configured
        ? "Informe ao menos um identificador de medição."
        : googleValid && metaValid
          ? "Identificadores válidos. A coleta inicia somente após consentimento do visitante."
          : "Revise o ID do Google Analytics ou do Pixel da Meta."
    };
  }
  if (key === "crm") {
    if (!config.url) return { ok: false, message: "Informe a URL do webhook CRM." };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(config.timeout || 8000));
    try {
      const response = await fetch(config.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(config.secret ? { "X-Cine-Cruzeiro-Secret": config.secret } : {})
        },
        body: JSON.stringify({ event: "integration.tested", timestamp: new Date().toISOString(), source: "cine-cruzeiro-admin" })
      });
      return { ok: response.ok, message: response.ok ? "Webhook CRM respondeu com sucesso." : `Webhook CRM respondeu HTTP ${response.status}.` };
    } catch (error) {
      return { ok: false, message: error.name === "AbortError" ? "Webhook CRM demorou demais para responder." : "Não foi possível chamar o webhook CRM." };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, message: "Teste ainda não disponível para esta integração." };
}

function webhookTestStatus(input = {}) {
  const value = String(input.status || "processed").toLowerCase();
  if (["processed", "pending", "action_required", "cancelled", "canceled", "refunded", "rejected"].includes(value)) return value;
  return "processed";
}

function webhookTestAction(input = {}, status = "processed") {
  const requested = String(input.action || "").trim().toLowerCase();
  if (requested) return requested;
  if (status === "action_required") return "order.action_required";
  if (["cancelled", "canceled"].includes(status)) return "order.cancelled";
  if (status === "refunded") return "order.refunded";
  return "order.processed";
}

function buildMercadoPagoWebhookTestPayload(input = {}) {
  const status = webhookTestStatus(input);
  const action = webhookTestAction(input, status);
  const resourceId = String(input.resourceId || `ORDTST${crypto.randomBytes(13).toString("hex").toUpperCase()}`).slice(0, 96);
  const externalReference = String(input.externalReference || `webhook-test-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`).slice(0, 96);
  const amount = Math.max(0.01, Number(input.amount || 10));
  const providerStatus = status === "pending" ? "created" : status;
  const statusDetail = status === "processed" ? "accredited" : status === "pending" ? "waiting_payment" : status;
  return {
    action,
    api_version: "v1",
    application_id: "CINE_CRUZEIRO_WEBHOOK_TESTER",
    data: {
      currency_id: "BRL",
      external_reference: externalReference,
      id: resourceId,
      status: providerStatus,
      status_detail: statusDetail,
      total_amount: amount.toFixed(2),
      total_paid_amount: status === "processed" ? amount.toFixed(2) : "0.00",
      transactions: {
        payments: [{
          amount: amount.toFixed(2),
          id: `PAYTST${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
          paid_amount: status === "processed" ? amount.toFixed(2) : "0.00",
          payment_method: { id: "master", installments: 1, type: "credit_card" },
          status: providerStatus,
          status_detail: statusDetail
        }]
      },
      type: "online",
      version: Number(input.version || 1)
    },
    date_created: input.dateCreated || new Date().toISOString(),
    live_mode: false,
    type: "order",
    user_id: "CINE_CRUZEIRO_TESTER"
  };
}

async function ensureWebhookTestFixture(payload, options = {}) {
  if (options.resourceMissing || mercadoPagoWebhookAction(payload) === "order.unknown") return;
  await withCriticalMutation(async () => {
    const db = await readDb();
    const reference = payload.data.external_reference;
    const resourceId = payload.data.id;
    const existing = (db.orders || []).find((item) => item.id === reference);
    if (existing && existing.origin !== "webhook_test" && !options.useExistingOrder) {
      const error = new Error("A referência pertence a um pedido real. Ative explicitamente o teste em pedido existente para continuar.");
      error.code = "WEBHOOK_TEST_REAL_ORDER_BLOCKED";
      error.statusCode = 409;
      throw error;
    }
    if (!existing) {
      const now = new Date().toISOString();
      db.orders.unshift({
        id: reference,
        idempotencyKey: reference,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentMethod: "credit_card",
        origin: "webhook_test",
        testOnly: true,
        movieTitle: "Teste de Webhook",
        fullTicketsCount: 0,
        halfTicketsCount: 0,
        concessionItems: [],
        customerName: "Simulador de Webhook",
        customerEmail: "",
        totalPrice: Number(payload.data.total_amount || 0),
        createdAt: now,
        updatedAt: now
      });
    }
    const payment = (db.payments || []).find((item) => item.orderId === reference && item.provider === "mercado_pago");
    if (!payment) {
      const now = new Date().toISOString();
      db.payments.unshift({
        id: `pagamento-webhook-test-${crypto.randomBytes(8).toString("hex")}`,
        orderId: reference,
        method: "credit_card",
        provider: "mercado_pago",
        providerPaymentId: resourceId,
        providerReference: reference,
        status: "pending",
        amount: Number(payload.data.total_amount || 0),
        currency: "BRL",
        metadata: { webhookSimulator: true },
        createdAt: now,
        updatedAt: now
      });
    }
    await writeDb(db);
  });
}

function webhookTestExpectation(scenario = "valid") {
  if (["invalid_signature", "missing_signature", "missing_request_id", "missing_data_id"].includes(scenario)) return 401;
  if (scenario === "invalid_payload") return 400;
  return 200;
}

async function storeWebhookSimulationRun(run) {
  await withCriticalMutation(async () => {
    const db = await readDb();
    db.settings ||= {};
    db.settings.webhookSimulatorRuns ||= [];
    db.settings.webhookSimulatorRuns.unshift(run);
    db.settings.webhookSimulatorRuns = db.settings.webhookSimulatorRuns.slice(0, 60);
    await writeDb(db);
  });
}

async function runMercadoPagoWebhookSimulation(input = {}, options = {}) {
  if (!webhookTesterEnabled()) {
    const error = new Error("O simulador de webhooks está desativado por WEBHOOK_TESTER_ENABLED.");
    error.code = "WEBHOOK_TESTER_DISABLED";
    error.statusCode = 404;
    throw error;
  }
  const currentDb = await readDb();
  const config = integrationConfigService.resolvedConfig(currentDb, "mercadoPago") || {};
  const secret = paymentService.getMercadoPagoWebhookSecret(config);
  if (!secret) {
    const error = new Error("Configure o Segredo do webhook do Mercado Pago antes de executar o simulador.");
    error.code = "MERCADO_PAGO_WEBHOOK_SECRET_REQUIRED";
    error.statusCode = 412;
    throw error;
  }

  const scenario = String(input.scenario || "valid").toLowerCase();
  const payload = buildMercadoPagoWebhookTestPayload(input);
  if (scenario === "unknown_event") payload.action = "order.unknown";
  const resourceMissing = scenario === "resource_not_found" || webhookTestExpectation(scenario) !== 200;
  await ensureWebhookTestFixture(payload, { resourceMissing, useExistingOrder: Boolean(input.useExistingOrder) });

  const requestId = String(input.requestId || crypto.randomUUID());
  const timestamp = String(input.timestamp || Math.floor(Date.now() / 1000));
  const signature = paymentService.createMercadoPagoWebhookSignature({ dataId: payload.data.id, requestId, timestamp }, secret);
  const query = new URLSearchParams({ type: "order" });
  if (scenario !== "missing_data_id") query.set("data.id", payload.data.id);
  const headers = { "Content-Type": "application/json" };
  if (scenario !== "missing_request_id") headers["x-request-id"] = requestId;
  if (scenario !== "missing_signature") headers["x-signature"] = scenario === "invalid_signature"
    ? `${signature.header.slice(0, -1)}${signature.header.endsWith("0") ? "1" : "0"}`
    : signature.header;

  const startedAt = Date.now();
  let status = 0;
  let responsePayload = {};
  let responseText = "";
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/mercado-pago?${query}`, {
      method: "POST",
      headers,
      body: scenario === "invalid_payload" ? "{" : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
    status = response.status;
    responseText = await response.text();
    responsePayload = JSON.parse(responseText || "{}");
  } catch (error) {
    responsePayload = { error: { code: "WEBHOOK_TEST_REQUEST_FAILED", message: error.message } };
  }
  const elapsedMs = Date.now() - startedAt;
  const expectedStatus = webhookTestExpectation(scenario);
  const processing = responsePayload.processing || {};
  const run = {
    id: options.runId || `webhook-run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    scenario,
    action: payload.action,
    resourceId: payload.data.id,
    externalReference: payload.data.external_reference,
    requestId,
    timestamp: new Date().toISOString(),
    httpStatus: status,
    expectedStatus,
    passed: status === expectedStatus && (scenario !== "duplicate" || Boolean(responsePayload.duplicate)),
    signatureValid: status !== 401 && !["invalid_signature", "missing_signature", "missing_request_id", "missing_data_id"].includes(scenario),
    result: responsePayload.duplicate ? "Webhook já processado — nenhuma duplicação realizada." : responsePayload.ok ? "Processamento concluído" : responsePayload.error?.message || responseText || "Sem resposta",
    processing,
    duplicate: Boolean(responsePayload.duplicate),
    elapsedMs,
    payload: sanitizeWebhookTestPayload(payload),
    request: {
      signaturePresent: Boolean(headers["x-signature"]),
      requestIdPresent: Boolean(headers["x-request-id"]),
      dataIdPresent: query.has("data.id")
    },
    response: {
      ok: Boolean(responsePayload.ok),
      errorCode: responsePayload.error?.code || "",
      processed: Boolean(responsePayload.processed),
      duplicate: Boolean(responsePayload.duplicate)
    },
    replay: { scenario, payload: sanitizeWebhookTestPayload(payload), requestId, timestamp }
  };
  await storeWebhookSimulationRun(run);
  return run;
}

async function serveStatic(req, res, pathname) {
  const uploadPublicPath = stripPublicAssetBase(pathname);
  if (uploadPublicPath.startsWith("/uploads/")) {
    const uploadPath = path.normalize(path.join(storageService.rootDir, uploadPublicPath.replace(/^\/uploads\//, "")));
    if (!uploadPath.startsWith(storageService.rootDir)) {
      sendJson(res, 403, { error: "Acesso negado" });
      return;
    }

    try {
      const file = await fs.readFile(uploadPath);
      const ext = path.extname(uploadPath).toLowerCase();
      res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=300, must-revalidate"
      });
      res.end(file);
      return;
    } catch {
      sendJson(res, 404, { error: "Arquivo nao encontrado" });
      return;
    }
  }

  if (pathname.startsWith("/trailers/")) {
    const trailerPath = path.normalize(path.join(TRAILERS_DIR, pathname.replace(/^\/trailers\//, "")));
    if (!trailerPath.startsWith(TRAILERS_DIR)) {
      sendJson(res, 403, { error: "Acesso negado" });
      return;
    }

    try {
      const file = await fs.readFile(trailerPath);
      const ext = path.extname(trailerPath).toLowerCase();
      res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Access-Control-Allow-Origin": corsOrigin(),
        "Vary": "Origin",
        "Cache-Control": "public, max-age=86400"
      });
      res.end(file);
      return;
    } catch {
      sendJson(res, 404, { error: "Trailer nao encontrado" });
      return;
    }
  }

  if (pathname.startsWith("/images/")) {
    const imagePath = path.normalize(path.join(FRONTEND_PUBLIC_DIR, pathname));
    if (!imagePath.startsWith(FRONTEND_PUBLIC_DIR)) {
      sendJson(res, 403, { error: "Acesso negado" });
      return;
    }

    try {
      const file = await fs.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=86400"
      });
      res.end(file);
      return;
    } catch {
      sendJson(res, 404, { error: "Imagem nao encontrada" });
      return;
    }
  }

  const db = await readDb();
  const wantsAdminShell = pathname === "/admin" || pathname === "/admin/";
  const directAdminHtml = pathname === "/admin/admin.html";
  const authenticatedAdmin = getAdminUser(req, db);
  if (directAdminHtml && !authenticatedAdmin) {
    res.writeHead(302, { Location: "/admin" });
    res.end();
    return;
  }
  const relativePath = wantsAdminShell
    ? (authenticatedAdmin ? "admin.html" : "admin-login.html")
    : pathname.replace(/^\/admin\//, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Acesso negado" });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": pathname.startsWith("/admin") ? "no-store" : ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(file);
  } catch {
    sendJson(res, 404, { error: "Arquivo nao encontrado" });
  }
}

function mercadoPagoReferenceMatches(payment, externalReference) {
  const received = String(externalReference || "");
  if (!received) return true;
  const localOrderId = String(payment?.orderId || "");
  const providerReference = String(payment?.providerReference || "");
  return received === providerReference
    || received === localOrderId
    || received === localOrderId.slice(0, 64);
}

async function reconcileMercadoPagoCheckoutOrder(orderId, snapshotDb) {
  const snapshotOrder = (snapshotDb.orders || []).find((item) => item.id === orderId || item.idempotencyKey === orderId);
  if (!snapshotOrder) return false;
  const snapshotPayment = (snapshotDb.payments || []).find((item) => item.orderId === snapshotOrder.id);
  if (!snapshotPayment || snapshotPayment.provider !== "mercado_pago" || !snapshotPayment.providerPaymentId) return false;

  const hasTickets = (snapshotDb.tickets || []).some((ticket) => ticket.orderId === snapshotOrder.id);
  const needsReconciliation = ["pending", "processing"].includes(String(snapshotPayment.status || ""))
    || (snapshotPayment.status === "approved" && (snapshotOrder.status !== "paid" || !hasTickets));
  if (!needsReconciliation) return false;

  const providerConfig = integrationConfigService.resolvedConfig(snapshotDb, "mercadoPago");
  const providerStatus = await paymentService.fetchProviderPaymentStatus(
    "mercado_pago",
    snapshotPayment.providerPaymentId,
    providerConfig || {}
  );
  if (!providerStatus || providerStatus.status === "pending") return false;

  if (!mercadoPagoReferenceMatches(snapshotPayment, providerStatus.externalReference)) {
    logEvent("warn", "payment.reconciliation_reference_mismatch", {
      orderId: snapshotOrder.id,
      providerPaymentId: snapshotPayment.providerPaymentId
    });
    return false;
  }
  if (providerStatus.amount && Math.abs(Number(providerStatus.amount) - Number(snapshotPayment.amount)) > 0.01) {
    logEvent("warn", "payment.reconciliation_amount_mismatch", {
      orderId: snapshotOrder.id,
      providerPaymentId: snapshotPayment.providerPaymentId
    });
    return false;
  }

  return withCriticalMutation(async () => {
    const lockedDb = await readDb();
    const order = (lockedDb.orders || []).find((item) => item.id === snapshotOrder.id);
    const payment = (lockedDb.payments || []).find((item) => item.orderId === snapshotOrder.id);
    if (!order || !payment) return false;

    const wasAlreadyPaid = order.status === "paid";
    payment.status = providerStatus.status;
    payment.updatedAt = new Date().toISOString();
    payment.metadata = {
      ...(payment.metadata || {}),
      lastReconciliationAt: new Date().toISOString(),
      providerStatus: providerStatus.raw || null
    };
    if (providerStatus.externalReference) payment.providerReference = providerStatus.externalReference;

    let tickets = [];
    if (payment.status === "approved") {
      tickets = finalizePaidOrder(lockedDb, order, payment, "online");
      if (!wasAlreadyPaid && tickets.length) {
        consumePendingClubCredit(lockedDb, order, tickets, order.customerUserId);
        await deliverTicketsByEmail(lockedDb, order, tickets);
      }
    } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status) && order.status !== "paid") {
      releaseConcessionReservation(lockedDb, order);
      order.status = payment.status === "refunded" ? "refunded" : payment.status === "rejected" ? "cancelled" : payment.status;
      order.paymentStatus = payment.status;
    }

    await writeDb(lockedDb);
    logEvent("info", "payment.reconciled", {
      orderId: order.id,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      tickets: tickets.length
    });
    return true;
  });
}

async function handleApi(req, res, pathname) {
  const method = req.method;
  if (method === "OPTIONS") {
    sendNoContent(res);
    return;
  }

  const db = await readDb();
  const scheduledChanged = applyScheduledPremieres(db);
  const reservationsChanged = expireStaleReservations(db);
  const subscriptionMaintenance = await expirePendingPaymentSubscriptions(db);
  const subscriptionLifecycle = finalizeEndingSubscriptions(db);
  if (scheduledChanged || reservationsChanged || subscriptionMaintenance.changed || subscriptionLifecycle.changed) {
    await writeDb(db);
  }

  const limited = rateLimit(req, pathname);
  if (limited) {
    sendJson(res, 429, { error: limited });
    return;
  }

  if (pathname === "/api/admin/login" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const user = (db.users || []).find((item) => item.email === email && item.active !== false && adminRoles().has(item.role));
    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
      sendJson(res, 401, { error: { code: "ADMIN_LOGIN_INVALID", message: "E-mail ou senha invalidos." } });
      return;
    }
    const session = signedValue({ sub: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 8 });
    const loginAudit = {
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      userId: user.id,
      userEmail: user.email,
      action: "POST /api/admin/login",
      entityType: "admin_session",
      entityId: user.id,
      before: null,
      after: { role: user.role },
      ip: clientIp(req),
      createdAt: new Date().toISOString()
    };
    if (postgresEnabled()) {
      await appendAuditLogToPostgres(loginAudit);
    } else {
      db.auditLogs ||= [];
      db.auditLogs.push(loginAudit);
      await writeDb(db);
    }
    res.writeHead(200, {
      ...securityHeaders({ "Content-Type": "application/json; charset=utf-8" }),
      "Set-Cookie": adminCookie(session),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    });
    res.end(JSON.stringify({ user: sanitizeUser(user) }, null, 2));
    return;
  }

  if (pathname === "/api/admin/logout" && method === "POST") {
    const user = getAdminUser(req, db);
    if (user) {
      db.auditLogs ||= [];
      db.auditLogs.push({
        id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        userId: user.id,
        userEmail: user.email,
        action: "POST /api/admin/logout",
        entityType: "admin_session",
        entityId: user.id,
        before: { active: true },
        after: { active: false },
        ip: clientIp(req),
        createdAt: new Date().toISOString()
      });
      await writeDb(db);
    }
    res.writeHead(204, {
      ...securityHeaders(),
      "Set-Cookie": adminCookie("", 0),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    });
    res.end();
    return;
  }

  if (pathname === "/api/admin/me" && method === "GET") {
    const user = getAdminUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para continuar." } });
      return;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (!ensureAdmin(req, res, db, pathname, method)) return;

  if (pathname === "/api/health" && method === "GET") {
    sendJson(res, 200, {
      status: "ok"
    });
    return;
  }

  if (pathname === "/api/content" && method === "GET") {
    sendJson(res, 200, getContent(db), {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=45"
    });
    return;
  }

  if (pathname === "/api/admin/content" && method === "GET") {
    sendJson(res, 200, getContent(db, { includePrivate: true }));
    return;
  }

  if ((pathname === "/api/dashboard" || pathname === "/api/admin/dashboard") && method === "GET") {
    const dashboardUrl = new URL(req.url, `http://${req.headers.host}`);
    sendJson(res, 200, adminDashboard(db, { period: parseAdminPeriod(dashboardUrl) }));
    return;
  }

  if (pathname === "/api/admin/payments" && method === "GET") {
    const paymentsUrl = new URL(req.url, `http://${req.headers.host}`);
    const period = parseAdminPeriod(paymentsUrl);
    const statusFilter = paymentsUrl.searchParams.get("status") || "";
    const methodFilter = paymentsUrl.searchParams.get("method") || "";
    const originFilter = paymentsUrl.searchParams.get("origin") || "";
    const providerFilter = paymentsUrl.searchParams.get("provider") || "";
    let rows = (db.payments || []).filter((payment) => inDateRange(payment.createdAt, period.start, period.end));
    if (statusFilter) rows = rows.filter((payment) => String(payment.status || "") === statusFilter);
    if (methodFilter) rows = rows.filter((payment) => String(payment.method || "") === methodFilter);
    if (providerFilter) rows = rows.filter((payment) => String(payment.provider || "") === providerFilter);
    if (originFilter) {
      rows = rows.filter((payment) => {
        const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
        return String(order.origin || "online") === originFilter;
      });
    }
    sendJson(res, 200, {
      period,
      cardTerminal: {
        configured: cardTerminalProvider.configured(),
        provider: providerLabel(cardTerminalProvider.providerName())
      },
      payments: rows.slice(0, 200).map((payment) => {
        const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
        return {
          ...payment,
          orderReference: shortOrderReference(order),
          orderStatusLabel: orderStatusLabel(order.status),
          statusLabel: paymentStatusLabel(payment.status),
          methodLabel: methodLabel(payment.method),
          providerLabel: providerLabel(payment.provider),
          originLabel: originLabel(order.origin || "online"),
          customerName: order.customerName || "Cliente",
          movieTitle: order.movieTitle || movieForOrder(db, order)?.title || ""
        };
      })
    });
    return;
  }

  if (pathname === "/api/payments/config/mercado-pago" && method === "GET") {
    const mercadoPago = integrationConfigService.resolvedConfig(db, "mercadoPago");
    const environment = mercadoPago?.environment === "production" ? "production" : "sandbox";
    sendJson(res, 200, {
      provider: "mercado_pago",
      enabled: Boolean(mercadoPago?.enabled),
      configured: Boolean(mercadoPago?.configured),
      publicKey: mercadoPago?.publicKey || "",
      environment,
      livePayments: !isProduction() || environment === "production"
    });
    return;
  }

  if ((pathname === "/api/integrations" || pathname === "/api/admin/integrations") && method === "GET") {
    sendJson(res, 200, { integrations: adminIntegrationsStatus(req, db) });
    return;
  }

  const webhookSimulationBase = "/api/admin/integrations/mercadoPago/webhook-simulations";
  if (pathname === webhookSimulationBase && method === "GET") {
    sendJson(res, 200, {
      enabled: webhookTesterEnabled(),
      runs: (db.settings?.webhookSimulatorRuns || []).slice(0, 60)
    });
    return;
  }

  if (pathname === webhookSimulationBase && method === "POST") {
    const body = await readBody(req);
    const run = await runMercadoPagoWebhookSimulation(body);
    sendJson(res, 200, { run });
    return;
  }

  if (pathname === `${webhookSimulationBase}/batch` && method === "POST") {
    const seed = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
    const valid = await runMercadoPagoWebhookSimulation({
      scenario: "valid",
      action: "order.processed",
      externalReference: `webhook-bateria-${seed}`,
      resourceId: `ORDTSTBATCH${crypto.randomBytes(10).toString("hex").toUpperCase()}`
    });
    const duplicate = await runMercadoPagoWebhookSimulation({
      scenario: "duplicate",
      action: valid.action,
      externalReference: valid.externalReference,
      resourceId: valid.resourceId,
      requestId: valid.requestId,
      timestamp: valid.replay.timestamp
    });
    const runs = [
      valid,
      await runMercadoPagoWebhookSimulation({ scenario: "invalid_signature", action: "order.processed" }),
      await runMercadoPagoWebhookSimulation({ scenario: "missing_signature", action: "order.processed" }),
      duplicate,
      await runMercadoPagoWebhookSimulation({ scenario: "unknown_event" }),
      await runMercadoPagoWebhookSimulation({ scenario: "resource_not_found", action: "order.processed" }),
      await runMercadoPagoWebhookSimulation({ scenario: "valid", action: "order.action_required", status: "action_required" }),
      await runMercadoPagoWebhookSimulation({ scenario: "valid", action: "order.processed" })
    ];
    sendJson(res, 200, {
      total: runs.length,
      passed: runs.filter((item) => item.passed).length,
      failed: runs.filter((item) => !item.passed).length,
      runs
    });
    return;
  }

  const webhookSimulationResendMatch = pathname.match(/^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations\/([^/]+)\/resend$/);
  if (webhookSimulationResendMatch && method === "POST") {
    const runId = decodeURIComponent(webhookSimulationResendMatch[1]);
    const source = (db.settings?.webhookSimulatorRuns || []).find((item) => item.id === runId);
    if (!source) {
      sendJson(res, 404, { error: { code: "WEBHOOK_SIMULATION_NOT_FOUND", message: "Simulação não encontrada no histórico." } });
      return;
    }
    const replay = await runMercadoPagoWebhookSimulation({
      scenario: "duplicate",
      action: source.action,
      status: source.payload?.data?.status === "action_required" ? "action_required" : source.payload?.data?.status || "processed",
      amount: source.payload?.data?.total_amount || 10,
      resourceId: source.resourceId,
      externalReference: source.externalReference,
      requestId: source.requestId,
      timestamp: source.replay?.timestamp || Math.floor(Date.now() / 1000)
    });
    sendJson(res, 200, { run: replay });
    return;
  }

  const adminIntegrationMatch = pathname.match(/^\/api\/admin\/integrations\/([^/]+)(?:\/(test|enable|disable))?$/);
  if (adminIntegrationMatch) {
    const key = integrationConfigService.providerKey(decodeURIComponent(adminIntegrationMatch[1]));
    const action = adminIntegrationMatch[2] || "";
    if (!key) {
      sendJson(res, 404, { error: { code: "INTEGRATION_NOT_FOUND", message: "Integração não encontrada." } });
      return;
    }
    if (method === "GET" && !action) {
      sendJson(res, 200, { integration: integrationConfigService.sanitizeConfig(db, key) });
      return;
    }
    if (method === "PUT" && !action) {
      const body = await readBody(req);
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const saved = integrationConfigService.save(lockedDb, key, body, req.adminUser);
        await writeDb(lockedDb);
        sendJson(res, 200, { integration: saved });
      });
      return;
    }
    if (method === "POST" && ["enable", "disable"].includes(action)) {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const saved = integrationConfigService.setEnabled(lockedDb, key, action === "enable", req.adminUser);
        await writeDb(lockedDb);
        sendJson(res, 200, { integration: saved });
      });
      return;
    }
    if (method === "POST" && action === "test") {
      const result = await testIntegrationProvider(db, key, req);
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const saved = integrationConfigService.setTestResult(lockedDb, key, result, req.adminUser);
        await writeDb(lockedDb);
        sendJson(res, 200, { ...result, integration: saved });
      });
      return;
    }
  }

  if (pathname === "/api/integrations/test" && method === "POST") {
    const body = await readBody(req);
    const statuses = adminIntegrationsStatus(req, db);
    const key = String(body.integration || "").trim();
    const item = statuses[key];
    if (!item) {
      sendJson(res, 404, { error: { code: "INTEGRATION_NOT_FOUND", message: "Integracao nao encontrada." } });
      return;
    }
    const result = await testIntegrationProvider(db, key, req);
    sendJson(res, 200, { ...result, configured: Boolean(item.configured), integration: key });
    return;
  }

  if (pathname === "/api/admin/email/promotions" && method === "POST") {
    const body = await readBody(req);
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    if (!subject || !message) {
      sendJson(res, 400, { error: { code: "EMAIL_CAMPAIGN_INVALID", message: "Informe assunto e mensagem da campanha." } });
      return;
    }
    const emailConfig = integrationConfigService.resolvedConfig(db, "email");
    if (!(emailConfig?.enabled && emailConfig?.configured)) {
      sendJson(res, 412, { error: { code: "SMTP_NOT_CONFIGURED", message: "Configure e ative o SMTP em Integrações antes de enviar campanhas." } });
      return;
    }
    const recipients = (db.users || [])
      .filter((user) =>
        user.active !== false &&
        user.role === "customer" &&
        !user.emailUnsubscribedAt &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(user.email || ""))
      )
      .map((user) => ({
        email: user.email,
        name: user.name || "",
        unsubscribeUrl: emailUnsubscribeUrlForUser(user)
      }));
    if (!recipients.length) {
      sendJson(res, 409, { error: { code: "NO_EMAIL_RECIPIENTS", message: "Nenhum cliente com e-mail válido foi encontrado." } });
      return;
    }
    const result = await emailService.sendPromotionCampaign(db, {
      recipients,
      subject,
      message,
      ctaLabel: String(body.ctaLabel || "Ver promoção").trim(),
      ctaUrl: String(body.ctaUrl || "").trim()
    });
    db.emailCampaigns ||= [];
    db.emailCampaigns.unshift({
      id: `campanha-email-${Date.now()}`,
      subject,
      message,
      ctaLabel: String(body.ctaLabel || "").trim(),
      ctaUrl: String(body.ctaUrl || "").trim(),
      recipients: recipients.length,
      sent: result.sent,
      failed: result.failed,
      createdBy: req.adminUser?.id || "",
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    sendJson(res, 200, { ...result, recipients: recipients.length });
    return;
  }

  if (pathname === "/api/admin/customers" && method === "GET") {
    const query = new URL(req.url, `http://${req.headers.host}`).searchParams.get("query") || "";
    sendJson(res, 200, { customers: searchCustomers(db, query) });
    return;
  }

  if (pathname === "/api/events" && method === "POST") {
    const body = await readBody(req);
    const allowedEvents = new Set([
      "order.created",
      "payment.created",
      "payment.approved",
      "payment.rejected",
      "payment.expired",
      "payment.refunded",
      "ticket.created",
      "ticket.used",
      "club_lead.created",
      "private_rental.inquiry",
      "password_reset.requested"
    ]);
    if (!allowedEvents.has(body.event)) {
      sendJson(res, 400, { error: { code: "EVENT_NOT_ALLOWED", message: "Evento nao suportado." } });
      return;
    }
    if (body.event === "private_rental.inquiry") {
      const inquiry = body.data && typeof body.data === "object" ? body.data : {};
      if (String(inquiry.website || "").trim()) {
        sendJson(res, 202, { success: true, message: "Solicitação recebida." });
        return;
      }
      inquiry.name = String(inquiry.name || "").trim().slice(0, 100);
      inquiry.phone = String(inquiry.phone || "").trim().slice(0, 30);
      inquiry.email = String(inquiry.email || "").trim().toLowerCase().slice(0, 160);
      inquiry.desiredDate = String(inquiry.desiredDate || "").trim().slice(0, 80);
      inquiry.estimatedGuests = String(inquiry.estimatedGuests || "").trim().slice(0, 80);
      inquiry.notes = String(inquiry.notes || "").trim().slice(0, 2000);
      if (inquiry.name.length < 2 || inquiry.phone.replace(/\D/g, "").length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) {
        sendJson(res, 422, { error: { code: "EVENT_INQUIRY_INVALID", message: "Informe nome, WhatsApp e um e-mail válido para receber a confirmação." } });
        return;
      }
      const emailConfig = integrationConfigService.resolvedConfig(db, "email");
      if (!(emailConfig?.enabled && emailConfig?.configured)) {
        sendJson(res, 412, { error: { code: "EVENT_EMAIL_NOT_CONFIGURED", message: "O canal de atendimento por e-mail está temporariamente indisponível. Tente novamente em instantes." } });
        return;
      }
      const delivery = await emailService.sendPrivateEventInquiry(db, inquiry);
      if (!delivery.inquiryDelivered) {
        sendJson(res, 502, { error: { code: "EVENT_EMAIL_DELIVERY_FAILED", message: "Não foi possível entregar sua solicitação agora. Confira os dados e tente novamente." } });
        return;
      }
      body.data = inquiry;
      body.delivery = { acknowledgementSent: Boolean(delivery.acknowledgementDelivered) };
    }
    const crmUrl = getCrmWebhookUrl(db);
    if (crmUrl) {
      await fetch(crmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Origin-Client": "CineCruzeiro-Backend"
        },
        body: JSON.stringify({
          ...body,
          timestamp: body.timestamp || new Date().toISOString(),
          cinemaId: "cine_cruzeiro_sala_1"
        })
      }).catch(() => null);
    }
    sendJson(res, 202, {
      success: true,
      acknowledgementSent: body.event === "private_rental.inquiry" ? Boolean(body.delivery?.acknowledgementSent) : undefined,
      message: body.event === "private_rental.inquiry"
        ? (body.delivery?.acknowledgementSent
          ? "Solicitação enviada. Enviamos uma confirmação para o seu e-mail."
          : "Solicitação recebida. Nossa equipe entrará em contato em breve.")
        : "Evento recebido pelo backend."
    });
    return;
  }

  if (pathname === "/api/content" && method === "PUT") {
    if (!ensureAdmin(req, res, db, pathname, method, ["owner"])) return;
    const body = await readBody(req);
    const allowedKeys = new Set(["movies", "rooms", "ticketTypes", "concessions", "promotions", "ads", "settings"]);
    const nextDb = { ...db };
    Object.entries(body || {}).forEach(([key, value]) => {
      if (allowedKeys.has(key)) nextDb[key] = value;
    });
    const previousMovies = db.movies.map((movie) => ({ ...movie }));
    await syncHighlightTrailerCache(nextDb, previousMovies);
    await writeDb(nextDb);
    sendJson(res, 200, getContent(nextDb));
    return;
  }

  if (pathname === "/api/settings" && method === "PUT") {
    const body = await readBody(req);
    [
      "eventHeroImageUrl",
      "eventGamesImageUrl",
      "eventPartiesImageUrl",
      "eventCorporateImageUrl",
      "eventGalleryImageUrl",
      "clubHeroImageUrl",
      "clubBannerImageUrl"
    ].forEach((key) => {
      if (body[key] !== undefined) body[key] = storedLocalUploadUrl(body[key]);
    });
    db.settings = { ...db.settings, ...body };
    await writeDb(db);
    sendJson(res, 200, assetRecord(db.settings, [
      "eventHeroImageUrl",
      "eventGamesImageUrl",
      "eventPartiesImageUrl",
      "eventCorporateImageUrl",
      "eventGalleryImageUrl",
      "clubHeroImageUrl",
      "clubBannerImageUrl"
    ]));
    return;
  }

  if (pathname === "/api/email/unsubscribe" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = String(url.searchParams.get("token") || "").trim();
    const user = token ? (db.users || []).find((item) => item.emailUnsubscribeToken === token && item.active !== false) : null;
    if (user) {
      user.emailUnsubscribedAt ||= new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
    const title = user ? "Descadastro confirmado" : "Link indisponível";
    const message = user
      ? "Você não receberá mais e-mails promocionais do Cine Cruzeiro. Mensagens essenciais de conta e compra ainda podem ser enviadas quando necessário."
      : "Este link de descadastro não existe ou já não está disponível.";
    res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
    res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)} - Cine Cruzeiro</title></head><body style="margin:0;background:#060a12;color:#f8fafc;font-family:Inter,Arial,sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="max-width:560px;background:#0d1728;padding:32px;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.34)"><p style="margin:0 0 10px;color:#facc15;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase">Cine Cruzeiro</p><h1 style="margin:0 0 14px;font-size:34px;line-height:1.05">${htmlEscape(title)}</h1><p style="margin:0;color:#cbd5e1;line-height:1.7">${htmlEscape(message)}</p><a href="${htmlEscape(appFrontendUrl())}" style="display:inline-block;margin-top:24px;background:#facc15;color:#020617;padding:14px 18px;border-radius:8px;text-decoration:none;font-weight:900">Voltar ao site</a></section></main></body></html>`);
    return;
  }

  if (pathname === "/api/auth/register" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || password.length < 6) {
      sendJson(res, 400, { error: "Informe e-mail e senha com pelo menos 6 caracteres." });
      return;
    }
    if (db.users.some((item) => item.email === email)) {
      sendJson(res, 409, { error: "Ja existe uma conta com este e-mail." });
      return;
    }

    const user = normalizeUser({
      name: body.name,
      email,
      phone: body.phone,
      cpf: body.cpf,
      passwordHash: hashPassword(password),
      role: "customer",
      active: true,
      authProvider: "email"
    });
    const verificationToken = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(verificationToken)}`;
    user.pendingEmail = email;
    user.emailVerified = false;
    user.emailVerificationHash = hashResetToken(verificationToken);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    db.users.push(user);
    await writeDb(db);
    const verificationEmailSent = await notifyEmailVerification(email, verificationUrl, db);
    if (isProduction() && !verificationEmailSent) {
      user.pendingEmail = "";
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      user.emailVerificationRequestedAt = "";
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
    sendJson(res, 201, {
      ...authResponse(user),
      verificationEmailSent,
      message: verificationEmailSent
        ? "Conta criada. Enviamos um link para confirmar seu e-mail."
        : "Conta criada, mas não foi possível enviar a confirmação agora. Você pode solicitar um novo link em Minha Conta."
    }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.email === String(body.email || "").trim().toLowerCase() && item.active);
    if (!user) {
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return;
    }

    if (user.passwordHash && !verifyPassword(String(body.password || ""), user.passwordHash)) {
      sendJson(res, 401, { error: "E-mail ou senha invalidos." });
      return;
    }

    if (!user.passwordHash && body.password) {
      user.passwordHash = hashPassword(String(body.password));
      user.authProvider = user.authProvider || "email";
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
    }

    sendJson(res, 200, authResponse(user), { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return;
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return;
    }
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    sendJson(res, 200, { ok: true }, { "Set-Cookie": customerCookie("", 0) });
    return;
  }

  if (pathname === "/api/auth/password/request" && method === "POST") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const user = email ? db.users.find((item) => item.email === email && item.active !== false && item.authProvider !== "google") : null;
    let resetToken = "";
    let resetUrl = "";

    if (user) {
      if (requestStillCoolingDown(user.passwordResetRequestedAt)) {
        sendJson(res, 202, {
          ok: true,
          message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao."
        });
        return;
      }
      if (isProduction() && !transactionalEmailConfigured(db)) {
        logEvent("warn", "password_reset.delivery_not_configured", { email });
        sendJson(res, 202, {
          ok: true,
          message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao."
        });
        return;
      }
      resetToken = crypto.randomBytes(32).toString("base64url");
      resetUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?resetToken=${encodeURIComponent(resetToken)}`;
      user.passwordResetHash = hashResetToken(resetToken);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      user.passwordResetRequestedAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
      const delivered = await notifyPasswordReset(email, resetUrl, db);
      if (isProduction() && !delivered) {
        user.passwordResetHash = "";
        user.passwordResetExpiresAt = "";
        await writeDb(db);
      }
    }

    sendJson(res, 202, {
      ok: true,
      message: "Se o e-mail existir, enviaremos as instrucoes de recuperacao.",
      ...(user && !isProduction() ? { resetToken, resetUrl } : {})
    });
    return;
  }

  if (pathname === "/api/auth/password/reset" && method === "POST") {
    const body = await readBody(req);
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    if (!token || password.length < 6) {
      sendJson(res, 400, { error: { code: "PASSWORD_RESET_INVALID", message: "Informe token e senha com pelo menos 6 caracteres." } });
      return;
    }

    const tokenHash = hashResetToken(token);
    const user = db.users.find((item) =>
      item.active !== false &&
      item.authProvider !== "google" &&
      item.passwordResetHash === tokenHash &&
      item.passwordResetExpiresAt &&
      new Date(item.passwordResetExpiresAt).getTime() > Date.now()
    );
    if (!user) {
      sendJson(res, 400, { error: { code: "PASSWORD_RESET_EXPIRED", message: "Token de recuperacao invalido ou expirado." } });
      return;
    }

    user.passwordHash = hashPassword(password);
    user.authProvider = user.authProvider || "email";
    user.passwordResetHash = "";
    user.passwordResetExpiresAt = "";
    user.passwordResetRequestedAt = "";
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    sendJson(res, 200, { ok: true, ...authResponse(user) }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return;
  }

  if (pathname === "/api/me" && method === "PATCH") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return;
    }
    const body = await readBody(req);
    const requestedEmail = String(body.email || "").trim().toLowerCase();
    if (requestedEmail && requestedEmail !== user.email) {
      sendJson(res, 400, { error: { code: "EMAIL_CHANGE_REQUIRES_VERIFICATION", message: "Use o fluxo de verificacao para trocar o e-mail." } });
      return;
    }
    user.name = String(body.name || user.name || "").trim();
    user.phone = String(body.phone || user.phone || "").trim();
    user.cpf = String(body.cpf || user.cpf || "").replace(/\D/g, "").slice(0, 11);
    const wantsPasswordChange = body.password !== undefined || body.newPassword !== undefined || body.currentPassword !== undefined || body.confirmPassword !== undefined;
    if (wantsPasswordChange) {
      const currentPassword = String(body.currentPassword || "");
      const nextPassword = String(body.newPassword ?? body.password ?? "");
      const confirmPassword = String(body.confirmPassword ?? body.newPassword ?? body.password ?? "");
      if (!nextPassword && !currentPassword && !confirmPassword) {
        // No-op for clients that submit empty password fields.
      } else if (!user.passwordHash) {
        sendJson(res, 400, { error: { code: "PASSWORD_CHANGE_OAUTH", message: "Esta conta usa login Google. Use recuperação de senha para criar uma senha." } });
        return;
      } else if (!currentPassword) {
        sendJson(res, 400, { error: { code: "CURRENT_PASSWORD_REQUIRED", message: "Informe sua senha atual para trocar a senha." } });
        return;
      } else if (!verifyPassword(currentPassword, user.passwordHash)) {
        sendJson(res, 401, { error: { code: "CURRENT_PASSWORD_INVALID", message: "A senha atual está incorreta." } });
        return;
      } else if (nextPassword !== confirmPassword) {
        sendJson(res, 400, { error: { code: "PASSWORD_CONFIRMATION_MISMATCH", message: "As novas senhas não coincidem." } });
        return;
      } else if (nextPassword.length < 6) {
        sendJson(res, 400, { error: { code: "PASSWORD_TOO_SHORT", message: "A senha precisa ter pelo menos 6 caracteres." } });
        return;
      } else {
        user.passwordHash = hashPassword(nextPassword);
        user.authProvider = user.authProvider || "email";
      }
    }
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (pathname === "/api/me/email-change/request" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return;
    }
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { error: { code: "EMAIL_INVALID", message: "Informe um e-mail valido." } });
      return;
    }
    if ((db.users || []).some((item) => item.id !== user.id && item.email === email && item.active !== false)) {
      sendJson(res, 409, { error: { code: "EMAIL_IN_USE", message: "Ja existe uma conta com este e-mail." } });
      return;
    }
    if (user.pendingEmail === email && requestStillCoolingDown(user.emailVerificationRequestedAt)) {
      sendJson(res, 429, { error: { code: "EMAIL_VERIFICATION_COOLDOWN", message: "Aguarde alguns minutos antes de pedir um novo e-mail de verificação." } });
      return;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(token)}`;
    user.pendingEmail = email;
    user.emailVerificationHash = hashResetToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    const delivered = await notifyEmailVerification(email, verificationUrl, db);
    if (isProduction() && !delivered) {
      user.pendingEmail = "";
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      await writeDb(db);
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "Configure e ative SMTP ou webhook de e-mail para verificar troca de e-mail em produção." } });
      return;
    }
    sendJson(res, 202, {
      ok: true,
      message: "Enviamos a verificacao para o novo e-mail.",
      user: sanitizeUser(user),
      ...(!isProduction() ? { verificationToken: token, verificationUrl } : {})
    });
    return;
  }

  if (pathname === "/api/me/email-verification/request" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para continuar." } });
      return;
    }
    if (user.emailVerified) {
      sendJson(res, 200, { ok: true, message: "Seu e-mail já está confirmado.", user: sanitizeUser(user) });
      return;
    }
    if (requestStillCoolingDown(user.emailVerificationRequestedAt)) {
      sendJson(res, 429, { error: { code: "EMAIL_VERIFICATION_COOLDOWN", message: "Aguarde alguns minutos antes de pedir um novo e-mail de confirmação." } });
      return;
    }
    if (isProduction() && !transactionalEmailConfigured(db)) {
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_NOT_CONFIGURED", message: "Configure e ative SMTP ou webhook de e-mail para confirmar contas em produção." } });
      return;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const verificationUrl = `${getGoogleOAuthConfig(req, db).frontendUrl}/conta?emailToken=${encodeURIComponent(token)}`;
    user.pendingEmail = user.email;
    user.emailVerified = false;
    user.emailVerificationHash = hashResetToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    user.emailVerificationRequestedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    const delivered = await notifyEmailVerification(user.email, verificationUrl, db);
    if (isProduction() && !delivered) {
      user.emailVerificationHash = "";
      user.emailVerificationExpiresAt = "";
      user.emailVerificationRequestedAt = "";
      user.pendingEmail = "";
      user.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 412, { error: { code: "EMAIL_DELIVERY_FAILED", message: "Não foi possível enviar a confirmação agora. Confira a integração de e-mail." } });
      return;
    }
    sendJson(res, 202, {
      ok: true,
      message: "Enviamos um link de confirmação para o e-mail da sua conta.",
      user: sanitizeUser(user),
      ...(!isProduction() ? { verificationToken: token, verificationUrl } : {})
    });
    return;
  }

  if (["/api/auth/email/verify", "/api/me/email-change/confirm"].includes(pathname) && method === "POST") {
    const body = await readBody(req);
    const tokenHash = hashResetToken(body.token || "");
    const user = (db.users || []).find((item) =>
      item.active !== false &&
      item.emailVerificationHash === tokenHash &&
      item.emailVerificationExpiresAt &&
      new Date(item.emailVerificationExpiresAt).getTime() > Date.now()
    );
    if (!user || !user.pendingEmail) {
      sendJson(res, 400, { error: { code: "EMAIL_VERIFICATION_INVALID", message: "Token de verificacao invalido ou expirado." } });
      return;
    }
    if ((db.users || []).some((item) => item.id !== user.id && item.email === user.pendingEmail && item.active !== false)) {
      sendJson(res, 409, { error: { code: "EMAIL_IN_USE", message: "Ja existe uma conta com este e-mail." } });
      return;
    }
    user.email = user.pendingEmail;
    user.pendingEmail = "";
    user.emailVerified = true;
    user.emailVerificationHash = "";
    user.emailVerificationExpiresAt = "";
    user.emailVerificationRequestedAt = "";
    user.updatedAt = new Date().toISOString();
    await writeDb(db);
    sendJson(res, 200, { ok: true, ...authResponse(user) }, { "Set-Cookie": customerCookie(customerSessionValue(user)) });
    return;
  }

  if (pathname === "/api/auth/google/start" && method === "GET") {
    const config = getGoogleOAuthConfig(req, db);
    if (!config.clientId || !config.clientSecret) {
      sendJson(res, 412, { error: "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend/.env." });
      return;
    }

    const startUrl = new URL(req.url, `http://${req.headers.host}`);
    const requestedReturnTo = String(startUrl.searchParams.get("returnTo") || "");
    const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "";
    const state = signJwt({ type: "google_oauth", nonce: crypto.randomUUID(), returnTo });
    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", config.clientId);
    googleUrl.searchParams.set("redirect_uri", config.redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", state);
    googleUrl.searchParams.set("prompt", "select_account");
    res.writeHead(302, { Location: googleUrl.toString(), "Set-Cookie": googleOAuthCookie(state) });
    res.end();
    return;
  }

  if (pathname === "/api/auth/google/callback" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const state = verifyJwt(stateParam);
    const stateCookie = parseCookies(req).cine_google_oauth;
    const config = getGoogleOAuthConfig(req, db);
    if (!code || state?.type !== "google_oauth" || stateParam !== stateCookie) {
      res.writeHead(302, { Location: `${config.frontendUrl}/?authError=google_oauth`, "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      res.writeHead(302, { Location: `${config.frontendUrl}/?authError=google_token`, "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.email) {
      res.writeHead(302, { Location: `${config.frontendUrl}/?authError=google_profile`, "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const email = String(profile.email).toLowerCase();
    const existingIndex = db.users.findIndex((item) => item.email === email || item.googleSub === profile.sub);
    const user = normalizeUser(
      {
        name: profile.name || email,
        email,
        googleSub: profile.sub,
        picture: profile.picture || "",
        emailVerified: Boolean(profile.email_verified),
        role: existingIndex >= 0 ? db.users[existingIndex].role : "customer",
        authProvider: "google",
        active: true
      },
      existingIndex >= 0 ? db.users[existingIndex] : {}
    );

    if (existingIndex >= 0) db.users[existingIndex] = user;
    else db.users.push(user);
    await writeDb(db);

    const successUrl = new URL(`${config.frontendUrl}${state.returnTo || "/"}`);
    successUrl.searchParams.set("auth", "google_success");
    res.writeHead(302, {
      Location: successUrl.toString(),
      "Set-Cookie": [customerCookie(customerSessionValue(user)), googleOAuthCookie("", 0)]
    });
    res.end();
    return;
  }

  if (pathname === "/api/tmdb/search" && method === "GET") {
    const query = new URL(req.url, `http://${req.headers.host}`).searchParams.get("query");
    if (!query) {
      sendJson(res, 400, { error: "Informe um titulo para pesquisar." });
      return;
    }

    const data = await tmdbFetch("/search/movie", {
      query,
      language: "pt-BR",
      region: "BR",
      include_adult: "false",
      page: 1
    }, db);

    sendJson(
      res,
      200,
      (data.results || []).slice(0, 8).map((movie) => ({
        tmdbId: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        year: movie.release_date ? movie.release_date.slice(0, 4) : "",
        synopsis: movie.overview || "",
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : ""
      }))
    );
    return;
  }

  if (pathname === "/api/subscription-plans" && method === "GET") {
    sendJson(
      res,
      200,
      (db.subscriptionPlans || []).filter((plan) => plan.active !== false).map((plan) => assetRecord(plan, ["imageUrl"])),
      { "Cache-Control": "public, max-age=30, stale-while-revalidate=90" }
    );
    return;
  }

  if (pathname === "/api/me/subscriptions" && method === "GET") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar o Clube." } });
      return;
    }
    sendJson(res, 200, { subscriptions: subscriptionSummary(db, user.id) });
    return;
  }

  const mySubscriptionCancelMatch = pathname.match(/^\/api\/me\/subscriptions\/([^/]+)\/cancel$/);
  if (mySubscriptionCancelMatch && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para cancelar o Clube." } });
      return;
    }
    const id = decodeURIComponent(mySubscriptionCancelMatch[1]);
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const lockedUser = getCustomerUser(req, lockedDb);
      const subscription = (lockedDb.subscriptions || []).find((item) => item.id === id && item.userId === lockedUser.id);
      if (!subscription) {
        sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
        return;
      }
      if (["ending", "ended", "cancelled"].includes(subscription.status)) {
        sendJson(res, 200, {
          subscription: { ...refreshSubscriptionCredits(lockedDb, subscription), statusLabel: subscriptionStatusLabel(subscription.status) },
          message: subscription.status === "ending" ? "A renovação já está cancelada. Seus créditos continuam válidos até o fim do ciclo." : "Esta assinatura já está encerrada."
        });
        return;
      }
      const now = new Date().toISOString();
      const cancelImmediately = Boolean(body.cancelImmediately || body.immediate);
      let providerSubscription = null;
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
        providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
        subscription.providerStatus = providerSubscription?.status || "cancelled";
      }
      markSubscriptionWithoutRenewal(lockedDb, subscription, {
        mode: cancelImmediately ? "immediate_billing_end" : "period_end",
        now: new Date(now)
      });
      subscription.history ||= [];
      subscription.history.push({
        action: "cancel",
        by: lockedUser.id,
        reason: String(body.reason || "Cancelado pelo cliente").trim(),
        effective: cancelImmediately ? "immediate" : "period_end",
        provider: subscription.provider || "",
        providerStatus: providerSubscription?.status || subscription.providerStatus || "",
        at: subscription.cancelledAt
      });
      await writeDb(lockedDb);
      sendJson(res, 200, {
        subscription: { ...refreshSubscriptionCredits(lockedDb, subscription), statusLabel: subscriptionStatusLabel(subscription.status) },
        message: cancelImmediately
          ? "Cobrança encerrada. Seus créditos atuais continuam válidos até o fim do ciclo."
          : "Renovação cancelada. Não haverá nova cobrança e os créditos atuais continuam válidos até o fim do ciclo."
      });
    });
    return;
  }

  if (pathname === "/api/subscriptions/subscribe" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para assinar o Clube." } });
      return;
    }
    const body = await readBody(req);
    const paymentMethod = String(body.paymentMethod || "").trim().toLowerCase();
    if (!["card", "credit_card"].includes(paymentMethod)) {
      sendJson(res, 422, {
        error: {
          code: "SUBSCRIPTION_PAYMENT_METHOD_REQUIRED",
          message: "Assinaturas do Clube aceitam somente cartão de crédito via Mercado Pago."
        }
      });
      return;
    }
    try {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const lockedUser = getCustomerUser(req, lockedDb);
        if (!lockedUser) {
          sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para assinar o Clube." } });
          return;
        }
        const plan = (lockedDb.subscriptionPlans || []).find((item) => item.id === body.planId && item.active !== false);
        if (!plan) {
          sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano do Clube nao encontrado." } });
          return;
        }
        const existingSubscription = blockingSubscriptionForUser(lockedDb, lockedUser.id);
        if (existingSubscription) {
          sendJson(res, 409, {
            error: {
              code: "SUBSCRIPTION_ALREADY_EXISTS",
              message: "Voce ja possui uma assinatura do Clube ativa ou pendente. Cancele a atual antes de assinar outro plano."
            },
            subscription: {
              ...existingSubscription,
              plan: (lockedDb.subscriptionPlans || []).find((item) => item.id === existingSubscription.planId) || null,
              statusLabel: subscriptionStatusLabel(existingSubscription.status)
            }
          });
          return;
        }

        const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
        if (!(mercadoPagoConfig?.enabled && mercadoPagoConfig?.configured) && process.env.PAYMENTS_MODE !== "test") {
          sendJson(res, 412, { error: { code: "MERCADO_PAGO_NOT_CONFIGURED", message: "Ative e configure o Mercado Pago nas Integracoes para vender assinaturas recorrentes." } });
          return;
        }

        const subscription = createSubscription(lockedDb, lockedUser.id, plan.id, lockedUser, "pending_payment", "mercado_pago");
        const normalizedPaymentMethod = paymentMethod === "card" ? "credit_card" : paymentMethod;
        subscription.provider = "mercado_pago";
        subscription.providerPlanId = "";
        subscription.externalBillingPending = true;
        subscription.paymentStatus = "pending";
        subscription.preferredPaymentMethod = normalizedPaymentMethod;

        const providerSubscription = await paymentService.createMercadoPagoSubscription(subscription, plan, lockedUser, mercadoPagoConfig || {}, {
          // Checkout hospedado: assinatura pendente sem plano associado. O
          // Mercado Pago recebe a recorrencia em auto_recurring e coleta o
          // meio de pagamento no proprio checkout.
          associatedPlan: false,
          frontendUrl: frontendUrlForRequest(req, lockedDb),
          notificationUrl: `${frontendUrlForRequest(req, lockedDb)}/api/webhooks/mercado-pago?source_news=webhooks`
        });
        subscription.providerSubscriptionId = providerSubscription.id;
        subscription.providerStatus = providerSubscription.status;
        subscription.checkoutUrl = providerSubscription.checkoutUrl || providerSubscription.initPoint || "";
        subscription.nextBillingAt = providerSubscription.nextPaymentDate || "";
        subscription.history ||= [];
        subscription.history.push({
          action: "mercado_pago_checkout_created",
          providerSubscriptionId: subscription.providerSubscriptionId,
          paymentMethod: normalizedPaymentMethod,
          at: new Date().toISOString()
        });

        await writeDb(lockedDb);
        sendJson(res, 202, {
          subscription: {
            ...subscription,
            plan,
            statusLabel: subscriptionStatusLabel(subscription.status)
          },
          checkoutUrl: subscription.checkoutUrl,
          initPoint: subscription.checkoutUrl,
          provider: "mercado_pago",
          paymentMethod: normalizedPaymentMethod,
          externalBillingPending: true,
          message: "Finalize a assinatura recorrente no Mercado Pago para liberar os creditos do Clube."
        });
      });
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: { code: error.code || "SUBSCRIPTION_PROVIDER_ERROR", message: error.message || "Nao foi possivel iniciar a assinatura." } });
    }
    return;
  }

  if (pathname === "/api/checkout/club-credit" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para usar o benefício do Clube." } });
      return;
    }
    const body = await readBody(req);
    try {
      await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const lockedUser = getCustomerUser(req, lockedDb);
      const idempotencyKey = String(req.headers["x-idempotency-key"] || body.idempotencyKey || `club-${lockedUser.id}-${body.movieId}-${body.sessionId}`).trim();
      const existing = (lockedDb.orders || []).find((order) => order.idempotencyKey === idempotencyKey && order.origin === "club");
      if (existing) {
        sendJson(res, 200, {
          order: existing,
          payment: orderPayment(lockedDb, existing.id),
          tickets: orderTickets(lockedDb, existing.id),
          subscription: (lockedDb.subscriptions || []).find((item) => item.id === existing.clubSubscriptionId) || null
        });
        return;
      }
      const subscription = activeSubscriptionForUser(lockedDb, lockedUser.id);
      if (!subscription || !subscriptionCanUseCredit(subscription)) {
        sendJson(res, 409, { error: { code: "NO_ACTIVE_SUBSCRIPTION", message: "Voce nao possui assinatura ativa com creditos disponiveis." } });
        return;
      }
      const requestedCredits = Math.max(0, Number(body.fullTicketsCount || 1) + Number(body.halfTicketsCount || 0));
      if (Number(subscription.creditsAvailable || 0) < requestedCredits) {
        sendJson(res, 409, { error: { code: "CLUB_CREDITS_EXHAUSTED", message: "Creditos do Clube insuficientes para a quantidade de ingressos selecionada." } });
        return;
      }
      const pricedOrder = repriceOrderFromCatalog(lockedDb, normalizePaymentOrder({
        ...body,
        idempotencyKey,
        fullTicketsCount: Number(body.fullTicketsCount ?? 1),
        halfTicketsCount: Number(body.halfTicketsCount || 0),
        concessionItems: Array.isArray(body.concessionItems) ? body.concessionItems : [],
        customerUserId: lockedUser.id,
        customerName: lockedUser.name,
        customerEmail: lockedUser.email,
        customerPhone: lockedUser.phone || "",
        customerCpf: lockedUser.cpf || "",
        paymentMethod: "CLUB_CREDIT",
        useClubBenefits: true
      }));
      applyClubPlanBenefits(lockedDb, pricedOrder, lockedUser);
      const ticketValueAfterPlanDiscount = Math.max(0, ticketSubtotalForOrder(lockedDb, pricedOrder) - Number(pricedOrder.clubBenefits?.ticketDiscount || 0));
      const ticketDiscount = Math.min(ticketValueAfterPlanDiscount, Number(pricedOrder.totalPrice || 0));
      pricedOrder.discountValue = Number((Number(pricedOrder.discountValue || 0) + ticketDiscount).toFixed(2));
      pricedOrder.totalPrice = Math.max(0, Number((Number(pricedOrder.totalPrice || 0) - ticketDiscount).toFixed(2)));
      if (pricedOrder.totalPrice > 0) {
        sendJson(res, 409, { error: { code: "CLUB_REMAINING_PAYMENT_REQUIRED", message: "Seu crédito cobre os ingressos. Finalize por Pix ou cartão para pagar os extras selecionados." } });
        return;
      }
      pricedOrder.clubSubscriptionId = subscription.id;
      pricedOrder.clubBenefit = "club_credit";
      pricedOrder.clubCreditQuantity = requestedCredits;
      pricedOrder.idempotencyKey = idempotencyKey;

      const payment = createClubCreditPaymentRecord(pricedOrder, subscription);
      const savedOrder = {
        ...pricedOrder,
        status: "paid",
        origin: "club",
        paymentMethod: "CLUB_CREDIT",
        paymentProvider: "internal_club",
        paymentId: payment.id,
        paymentStatus: "approved",
        paidAt: new Date().toISOString()
      };
      const tickets = finalizePaidOrder(lockedDb, savedOrder, payment, "club_credit");
      const usage = consumeSubscriptionCredit(lockedDb, subscription, {
        userId: lockedUser.id,
        orderId: savedOrder.id,
        ticketId: tickets[0]?.id || "",
        movieId: savedOrder.movieId,
        sessionId: savedOrder.sessionId,
        quantity: requestedCredits,
        idempotencyKey
      });
      savedOrder.clubCreditUsageId = usage.id;
      subscription.updatedAt = new Date().toISOString();
      if (tickets.length) await deliverTicketsByEmail(lockedDb, savedOrder, tickets);
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      sendJson(res, 201, { order: savedOrder, payment, tickets, subscription });
      });
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: { code: error.code || "CLUB_CREDIT_ERROR", message: error.message } });
    }
    return;
  }

  if (pathname === "/api/admin/subscription-plans" && method === "GET") {
    sendJson(res, 200, db.subscriptionPlans || []);
    return;
  }

  if (pathname === "/api/admin/subscription-plans" && method === "POST") {
    const body = await readBody(req);
    const plan = normalizeSubscriptionPlan(body);
    db.subscriptionPlans = (db.subscriptionPlans || []).filter((item) => item.id !== plan.id);
    db.subscriptionPlans.push(plan);
    await writeDb(db);
    sendJson(res, 201, plan);
    return;
  }

  const subscriptionPlanMatch = pathname.match(/^\/api\/admin\/subscription-plans\/([^/]+)$/);
  if (subscriptionPlanMatch && method === "PUT") {
    const id = decodeURIComponent(subscriptionPlanMatch[1]);
    const index = (db.subscriptionPlans || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
      return;
    }
    const plan = normalizeSubscriptionPlan({ ...(await readBody(req)), id }, db.subscriptionPlans[index]);
    db.subscriptionPlans[index] = plan;
    await writeDb(db);
    sendJson(res, 200, plan);
    return;
  }

  if (subscriptionPlanMatch && method === "DELETE") {
    const id = decodeURIComponent(subscriptionPlanMatch[1]);
    const index = (db.subscriptionPlans || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
      return;
    }
    const body = await readBody(req);
    const hasSubscriptions = (db.subscriptions || []).some((item) => item.planId === id);
    let plan;
    if (hasSubscriptions) {
      plan = { ...db.subscriptionPlans[index], active: false, deletedAt: new Date().toISOString(), deletedBy: req.adminUser?.id || "", deleteReason: String(body.reason || "Desativado pelo painel").trim() };
      db.subscriptionPlans[index] = plan;
    } else {
      [plan] = db.subscriptionPlans.splice(index, 1);
      plan = { ...plan, deletedAt: new Date().toISOString(), deletedBy: req.adminUser?.id || "", deleteReason: String(body.reason || "Excluido pelo painel").trim() };
    }
    db.auditLogs ||= [];
    db.auditLogs.push({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      userId: req.adminUser?.id || "",
      userEmail: req.adminUser?.email || "",
      action: hasSubscriptions ? "subscription_plan.deactivated" : "subscription_plan.deleted",
      entityType: "subscription_plan",
      entityId: id,
      before: null,
      after: plan,
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    sendJson(res, 200, { plan, deactivated: hasSubscriptions, deleted: !hasSubscriptions });
    return;
  }

  if (pathname === "/api/admin/subscriptions" && method === "GET") {
    sendJson(res, 200, {
      plans: db.subscriptionPlans || [],
      subscriptions: (db.subscriptions || []).map((subscription) => ({
        ...refreshSubscriptionCredits(db, subscription),
        statusLabel: subscriptionStatusLabel(subscription.status),
        credit: currentSubscriptionCredit(db, subscription),
        plan: (db.subscriptionPlans || []).find((plan) => plan.id === subscription.planId) || null,
        user: sanitizeUser((db.users || []).find((user) => user.id === subscription.userId) || {})
      })),
      credits: db.subscriptionCredits || [],
      usage: db.subscriptionUsage || []
    });
    return;
  }

  if (pathname === "/api/admin/subscriptions/assign" && method === "POST") {
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const adminUser = getAdminUser(req, lockedDb);
      const user = (lockedDb.users || []).find((item) => item.id === body.userId || item.email === String(body.email || "").toLowerCase());
      if (!user) {
        sendJson(res, 404, { error: { code: "USER_NOT_FOUND", message: "Usuario cadastrado nao encontrado." } });
        return;
      }
      const existingSubscription = blockingSubscriptionForUser(lockedDb, user.id);
      if (existingSubscription && existingSubscription.planId !== body.planId) {
        sendJson(res, 409, {
          error: {
            code: "SUBSCRIPTION_ALREADY_EXISTS",
            message: "Este cliente ja possui uma assinatura ativa ou pendente."
          },
          subscription: existingSubscription
        });
        return;
      }
      const subscription = createManualSubscription(lockedDb, user.id, body.planId, adminUser, body.status || "active");
      await writeDb(lockedDb);
      sendJson(res, 201, { subscription });
    });
    return;
  }

  const adminSubscriptionMatch = pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)$/);
  if (adminSubscriptionMatch && method === "PATCH") {
    const id = decodeURIComponent(adminSubscriptionMatch[1]);
    const body = await readBody(req);
    const subscription = (db.subscriptions || []).find((item) => item.id === id);
    if (!subscription) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    const allowedStatus = new Set(["pending_payment", "active", "paused", "ending", "cancelled", "ended", "payment_failed"]);
    if (body.status === "active" && (
      subscription.reactivationBlocked
      || ["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())
      || ["ending", "cancelled", "ended"].includes(String(subscription.status || "").toLowerCase())
    )) {
      sendJson(res, 409, {
        error: {
          code: "SUBSCRIPTION_REAUTHORIZATION_REQUIRED",
          message: "Esta autorização de cobrança foi encerrada. Crie uma nova assinatura para obter uma nova autorização do cliente; a anterior não pode ser reativada."
        }
      });
      return;
    }
    if (allowedStatus.has(body.status)) subscription.status = body.status;
    if (body.status === "active" && !currentSubscriptionCredit(db, subscription)) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      if (plan) createSubscriptionCreditCycle(db, subscription, plan);
      subscription.startedAt ||= new Date().toISOString();
    }
    if (body.status === "cancelled") {
      const now = new Date().toISOString();
      let providerSubscription = null;
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
        providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
        subscription.providerStatus = providerSubscription?.status || "cancelled";
      }
      markSubscriptionWithoutRenewal(db, subscription, { mode: "admin_billing_end", now: new Date(now) });
    }
    subscription.updatedAt = new Date().toISOString();
    subscription.history ||= [];
    subscription.history.push({ action: "status", status: subscription.status, statusLabel: subscriptionStatusLabel(subscription.status), by: req.adminUser?.id || "", reason: body.reason || "", at: new Date().toISOString() });
    await writeDb(db);
    sendJson(res, 200, { ...subscription, statusLabel: subscriptionStatusLabel(subscription.status), credit: currentSubscriptionCredit(db, subscription) });
    return;
  }

  if (adminSubscriptionMatch && method === "DELETE") {
    const id = decodeURIComponent(adminSubscriptionMatch[1]);
    const index = (db.subscriptions || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    const subscription = db.subscriptions[index];
    const terminalStatus = ["cancelled", "ended", "cancelled_by_admin"].includes(String(subscription.status || "").toLowerCase());
    if (!terminalStatus) {
      sendJson(res, 409, { error: { code: "SUBSCRIPTION_NOT_CANCELLED", message: "Cancele ou encerre a assinatura antes de excluir." } });
      return;
    }
    const before = {
      subscription,
      credits: (db.subscriptionCredits || []).filter((credit) => credit.subscriptionId === id),
      usage: (db.subscriptionUsage || []).filter((usage) => usage.subscriptionId === id)
    };
    if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
      const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
      const providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
      subscription.providerStatus = providerSubscription?.status || "cancelled";
    }
    db.subscriptions.splice(index, 1);
    db.subscriptionCredits = (db.subscriptionCredits || []).filter((credit) => credit.subscriptionId !== id);
    db.subscriptionUsage = (db.subscriptionUsage || []).filter((usage) => usage.subscriptionId !== id);
    db.auditLogs ||= [];
    db.auditLogs.push({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      userId: req.adminUser?.id || "",
      userEmail: req.adminUser?.email || "",
      action: "subscription.deleted",
      entityType: "subscription",
      entityId: id,
      before: sanitizeAuditValue(before),
      after: null,
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    sendJson(res, 200, { deleted: true, subscriptionId: id });
    return;
  }

  const adminCreditAdjustMatch = pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)\/credits\/adjust$/);
  if (adminCreditAdjustMatch && method === "POST") {
    const id = decodeURIComponent(adminCreditAdjustMatch[1]);
    const body = await readBody(req);
    const reason = String(body.reason || "").trim();
    if (!reason) {
      sendJson(res, 400, { error: { code: "REASON_REQUIRED", message: "Informe o motivo do ajuste de crédito." } });
      return;
    }
    const subscription = (db.subscriptions || []).find((item) => item.id === id);
    if (!subscription) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    let credit = currentSubscriptionCredit(db, subscription);
    if (!credit) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      if (!plan) {
        sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
        return;
      }
      credit = createSubscriptionCreditCycle(db, subscription, plan);
    }
    const delta = Math.trunc(Number(body.delta || 0));
    if (!delta) {
      sendJson(res, 400, { error: { code: "INVALID_DELTA", message: "Informe um ajuste diferente de zero." } });
      return;
    }
    const nextRemaining = Number(credit.remaining || 0) + delta;
    if (nextRemaining < 0) {
      sendJson(res, 409, { error: { code: "NEGATIVE_CREDITS", message: "O ajuste deixaria créditos negativos." } });
      return;
    }
    credit.remaining = nextRemaining;
    credit.total = Number(credit.used || 0) + nextRemaining;
    credit.updatedAt = new Date().toISOString();
    syncSubscriptionCreditMirror(subscription, credit);
    subscription.history ||= [];
    subscription.history.push({ action: "credit_adjust", delta, reason, by: req.adminUser?.id || "", at: new Date().toISOString() });
    await writeDb(db);
    sendJson(res, 200, { subscription, credit });
    return;
  }

  const tmdbMovieMatch = pathname.match(/^\/api\/tmdb\/movie\/([^/]+)$/);
  if (tmdbMovieMatch && method === "GET") {
    const tmdbId = decodeURIComponent(tmdbMovieMatch[1]);
    const data = await tmdbFetch(`/movie/${tmdbId}`, {
      language: "pt-BR",
      append_to_response: "release_dates,videos,credits"
    }, db);
    sendJson(res, 200, tmdbMoviePayload(data));
    return;
  }

  if (pathname === "/api/uploads/images" && method === "POST") {
    const body = await readBody(req);
    const uploaded = await storageService.uploadImage({
      data: body.data || body.base64,
      filename: body.filename,
      contentType: body.contentType,
      folder: body.folder || "admin"
    });
    sendJson(res, 201, { ...uploaded, url: uploaded.url, publicUrl: publicAssetUrl(uploaded.url) });
    return;
  }

  if (pathname === "/api/movies" && method === "POST") {
    const previousMovies = db.movies.map((item) => ({ ...item }));
    const body = await readBody(req);
    const movie = normalizeMovie(body);
    if (db.movies.some((item) => item.id === movie.id)) {
      sendJson(res, 409, { error: { code: "MOVIE_EXISTS", message: "Já existe um filme com este identificador. Abra o filme existente para editá-lo." } });
      return;
    }
    validateMovieForWorkflow(db, movie, "", body.workflowStatus === "published" || body.workflow_status === "published");
    if (movie.isHighlight) db.movies = db.movies.map((item) => ({ ...item, isHighlight: false }));
    db.movies.push(movie);
    await syncHighlightTrailerCache(db, previousMovies);
    await writeDb(db);
    sendJson(res, 201, db.movies.find((item) => item.id === movie.id) || movie);
    return;
  }

  if (pathname === "/api/movies/order" && method === "PUT") {
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) {
      sendJson(res, 400, { error: { code: "MOVIE_ORDER_INVALID", message: "Envie a lista de filmes na ordem desejada." } });
      return;
    }
    const orderMap = new Map(ids.map((id, index) => [id, (index + 1) * 10]));
    db.movies = (db.movies || []).map((movie) => ({
      ...movie,
      sortOrder: orderMap.has(movie.id) ? orderMap.get(movie.id) : Number(movie.sortOrder || 1000)
    })).sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    await writeDb(db);
    sendJson(res, 200, { movies: db.movies });
    return;
  }

  const movieSessionsMatch = pathname.match(/^\/api\/movies\/([^/]+)\/sessions(?:\/([^/]+))?$/);
  if (movieSessionsMatch) {
    const movieId = decodeURIComponent(movieSessionsMatch[1]);
    const sessionId = movieSessionsMatch[2] ? decodeURIComponent(movieSessionsMatch[2]) : "";
    const movieIndex = db.movies.findIndex((movie) => movie.id === movieId);
    if (movieIndex === -1) {
      sendJson(res, 404, { error: { code: "MOVIE_NOT_FOUND", message: "Filme não encontrado." } });
      return;
    }

    const movie = db.movies[movieIndex];
    movie.sessions ||= [];

    if (method === "POST" && !sessionId) {
      const body = await readBody(req);
      if (body.dateTo || body.dateEnd || Array.isArray(body.times)) {
        const batch = createMovieSessionBatch(body, movieId, movie.sessions);
        movie.sessions.push(...batch.created);
        movie.sessions.sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
        movie.updatedAt = new Date().toISOString();
        await writeDb(db);
        sendJson(res, 201, { ...batch, totalCreated: batch.created.length, totalSkipped: batch.skipped.length });
        return;
      }
      const session = normalizeMovieSession(body, movieId);
      if (movie.sessions.some((item) => item.id === session.id)) {
        sendJson(res, 409, { error: { code: "SESSION_EXISTS", message: "Já existe uma sessão com este identificador." } });
        return;
      }
      movie.sessions.push(session);
      movie.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 201, session);
      return;
    }

    const sessionIndex = movie.sessions.findIndex((session) => session.id === sessionId);
    if (!sessionId || sessionIndex === -1) {
      sendJson(res, 404, { error: { code: "SESSION_NOT_FOUND", message: "Sessão não encontrada." } });
      return;
    }

    if (method === "PUT") {
      const body = await readBody(req);
      const session = normalizeMovieSession(body, movieId, movie.sessions[sessionIndex]);
      movie.sessions[sessionIndex] = session;
      movie.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, session);
      return;
    }

    if (method === "DELETE") {
      if (sessionHasAuditHistory(db, sessionId)) {
        sendJson(res, 409, {
          error: {
            code: "SESSION_HAS_HISTORY",
            message: "Esta sessão possui vendas ou ingressos vinculados e não pode ser excluída. Marque-a como esgotada para interromper novas vendas."
          }
        });
        return;
      }
      const [removed] = movie.sessions.splice(sessionIndex, 1);
      movie.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  const movieMatch = pathname.match(/^\/api\/movies\/([^/]+)$/);
  if (movieMatch) {
    const id = decodeURIComponent(movieMatch[1]);
    const index = db.movies.findIndex((movie) => movie.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Filme nao encontrado" });
      return;
    }

    if (method === "PUT") {
      const previousMovies = db.movies.map((item) => ({ ...item }));
      const body = await readBody(req);
      const movie = normalizeMovie({ ...body, id }, db.movies[index]);
      const publishingNow = (body.workflowStatus === "published" || body.workflow_status === "published")
        && db.movies[index].workflowStatus !== "published";
      validateMovieForWorkflow(db, movie, id, publishingNow);
      if (movie.isHighlight) db.movies = db.movies.map((item) => ({ ...item, isHighlight: false }));
      db.movies[index] = movie;
      await syncHighlightTrailerCache(db, previousMovies);
      await writeDb(db);
      sendJson(res, 200, db.movies.find((item) => item.id === movie.id) || movie);
      return;
    }

    if (method === "DELETE") {
      const movie = db.movies[index];
      if (movieHasAuditHistory(db, movie.id)) {
        db.movies[index] = {
          ...movie,
          workflowStatus: "archived",
          status: "hidden",
          isHighlight: false,
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await writeDb(db);
        sendJson(res, 200, { archived: true, movie: db.movies[index] });
        return;
      }
      const [removed] = db.movies.splice(index, 1);
      await Promise.all([
        deleteLocalTrailer(removed.localTrailerUrl),
        storageService.deleteByPublicUrl(removed.posterUrl),
        storageService.deleteByPublicUrl(removed.backdropUrl)
      ]);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/rooms" && method === "POST") {
    const room = normalizeRoom(await readBody(req));
    db.rooms = db.rooms.filter((item) => item.id !== room.id);
    db.rooms.push(room);
    await writeDb(db);
    sendJson(res, 201, room);
    return;
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch) {
    const id = decodeURIComponent(roomMatch[1]);
    const index = db.rooms.findIndex((room) => room.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Sala nao encontrada" });
      return;
    }

    if (method === "PUT") {
      const room = normalizeRoom(await readBody(req), db.rooms[index]);
      db.rooms[index] = room;
      await writeDb(db);
      sendJson(res, 200, room);
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.rooms.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/ticket-types" && method === "POST") {
    const ticket = normalizeTicketType(await readBody(req));
    db.ticketTypes = db.ticketTypes.filter((item) => item.id !== ticket.id);
    db.ticketTypes.push(ticket);
    await writeDb(db);
    sendJson(res, 201, ticket);
    return;
  }

  const ticketMatch = pathname.match(/^\/api\/ticket-types\/([^/]+)$/);
  if (ticketMatch) {
    const id = decodeURIComponent(ticketMatch[1]);
    const index = db.ticketTypes.findIndex((ticket) => ticket.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Tipo de ingresso nao encontrado" });
      return;
    }

    if (method === "PUT") {
      const ticket = normalizeTicketType(await readBody(req), db.ticketTypes[index]);
      db.ticketTypes[index] = ticket;
      await writeDb(db);
      sendJson(res, 200, ticket);
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.ticketTypes.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/concessions" && method === "POST") {
    const item = normalizeConcession(await readBody(req));
    db.concessions = db.concessions.filter((existing) => existing.id !== item.id);
    db.concessions.push(item);
    db.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    await writeDb(db);
    sendJson(res, 201, item);
    return;
  }

  const concessionMatch = pathname.match(/^\/api\/concessions\/([^/]+)$/);
  if (concessionMatch) {
    const id = decodeURIComponent(concessionMatch[1]);
    const index = db.concessions.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Produto da bomboniere nao encontrado" });
      return;
    }

    if (method === "PUT") {
      const item = normalizeConcession(await readBody(req), db.concessions[index]);
      db.concessions[index] = item;
      db.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
      await writeDb(db);
      sendJson(res, 200, item);
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.concessions.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/promotions" && method === "POST") {
    const item = normalizePromotion(await readBody(req));
    db.promotions = db.promotions.filter((existing) => existing.id !== item.id);
    db.promotions.push(item);
    await writeDb(db);
    sendJson(res, 201, item);
    return;
  }

  const promotionMatch = pathname.match(/^\/api\/promotions\/([^/]+)$/);
  if (promotionMatch) {
    const id = decodeURIComponent(promotionMatch[1]);
    const index = db.promotions.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Promocao nao encontrada" });
      return;
    }

    if (method === "PUT") {
      const item = normalizePromotion(await readBody(req), db.promotions[index]);
      db.promotions[index] = item;
      await writeDb(db);
      sendJson(res, 200, item);
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.promotions.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/ads" && method === "POST") {
    const item = normalizeAd(await readBody(req));
    db.ads = db.ads.filter((existing) => existing.id !== item.id);
    db.ads.push(item);
    await writeDb(db);
    sendJson(res, 201, item);
    return;
  }

  const adMatch = pathname.match(/^\/api\/ads\/([^/]+)$/);
  if (adMatch) {
    const id = decodeURIComponent(adMatch[1]);
    const index = db.ads.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Anuncio nao encontrado" });
      return;
    }

    if (method === "PUT") {
      const item = normalizeAd(await readBody(req), db.ads[index]);
      db.ads[index] = item;
      await writeDb(db);
      sendJson(res, 200, item);
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.ads.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, removed);
      return;
    }
  }

  if (pathname === "/api/users" && method === "POST") {
    if (!ensureAdmin(req, res, db, pathname, method, ["owner"])) return;
    const user = normalizeUser(await readBody(req));
    db.users = db.users.filter((existing) => existing.id !== user.id);
    db.users.push(user);
    await writeDb(db);
    sendJson(res, 201, sanitizeUser(user));
    return;
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) {
    if (!ensureAdmin(req, res, db, pathname, method, ["owner"])) return;
    const id = decodeURIComponent(userMatch[1]);
    const index = db.users.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Usuario nao encontrado" });
      return;
    }

    if (method === "PUT") {
      const user = normalizeUser(await readBody(req), db.users[index]);
      db.users[index] = user;
      await writeDb(db);
      sendJson(res, 200, sanitizeUser(user));
      return;
    }

    if (method === "DELETE") {
      const [removed] = db.users.splice(index, 1);
      await writeDb(db);
      sendJson(res, 200, sanitizeUser(removed));
      return;
    }
  }

  if (pathname === "/api/payments/pix" && method === "POST") {
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      expireStaleReservations(lockedDb);
      const normalizedOrder = normalizePaymentOrder(body.order || body);
      normalizedOrder.idempotencyKey = body.idempotencyKey || req.headers["x-idempotency-key"] || normalizedOrder.idempotencyKey || normalizedOrder.id;
      const customerUser = getCustomerUser(req, lockedDb);
      if (customerUser) {
        normalizedOrder.customerUserId = customerUser.id;
        normalizedOrder.customerEmail = customerUser.email || normalizedOrder.customerEmail;
        normalizedOrder.customerCpf = customerUser.cpf || normalizedOrder.customerCpf;
      }
      const existing = findExistingCheckout(lockedDb, normalizedOrder, "pix");
      if (existing) {
        sendJson(res, 200, existing);
        return;
      }
      const order = repriceOrderFromCatalog(lockedDb, normalizedOrder);
      if (normalizedOrder.useClubCredits) {
        sendJson(res, 422, { error: { code: "CLUB_CREDIT_ROUTE_REQUIRED", message: "Use a ação exclusiva de créditos do Clube. O pagamento Pix nunca aprova créditos automaticamente." } });
        return;
      }
      applyClubPlanBenefits(lockedDb, order, customerUser);
      if (order.totalPrice <= 0) {
        sendJson(res, 409, { error: { code: "PAYMENT_AMOUNT_INVALID", message: "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de gerar o Pix." } });
        return;
      }
      const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
      if (!(mercadoPagoConfig?.enabled && mercadoPagoConfig?.configured) && process.env.PAYMENTS_MODE !== "test") {
        sendJson(res, 412, { error: { code: "MERCADO_PAGO_NOT_CONFIGURED", message: "Mercado Pago está indisponível. Configure e habilite a integração no painel administrativo." } });
        return;
      }
      const providerPayment = await createMercadoPagoOrderPayment(order, mercadoPagoConfig, {
        method: "pix",
        idempotencyKey: body.idempotencyKey || req.headers["x-idempotency-key"]
      });
      const payment = createPaymentRecord(order, providerPayment, "pix");
      const savedOrder = {
        ...order,
        paymentMethod: "PIX",
        paymentProvider: payment.provider,
        paymentId: payment.providerPaymentId,
        paymentStatus: payment.status,
        status: payment.status === "approved" ? "paid" : "pending_payment",
        reservationExpiresAt: payment.status === "approved" ? "" : new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      reserveConcessionStock(lockedDb, savedOrder);
      const tickets = payment.status === "approved" ? finalizePaidOrder(lockedDb, savedOrder, payment, "online") : [];
      if (tickets.length) consumePendingClubCredit(lockedDb, savedOrder, tickets, customerUser?.id);
      if (tickets.length) await deliverTicketsByEmail(lockedDb, savedOrder, tickets);
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      logEvent("info", "payment.created", { orderId: savedOrder.id, paymentId: payment.id, method: payment.method, provider: payment.provider, status: payment.status });
      sendJson(res, 201, { order: savedOrder, payment, tickets });
    });
    return;
  }

  if (pathname === "/api/payments/card" && method === "POST") {
    const body = await readBody(req);
    if (body.cardNumber || body.cvv || body.securityCode || body.cardExpiration || body.cardholderName) {
      sendJson(res, 400, { error: { code: "CARD_DATA_NOT_ALLOWED", message: "O Cine Cruzeiro não recebe dados de cartão. Envie apenas o token seguro gerado pelo Mercado Pago." } });
      return;
    }
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      expireStaleReservations(lockedDb);
      const normalizedOrder = normalizePaymentOrder(body.order || body);
      normalizedOrder.idempotencyKey = body.idempotencyKey || req.headers["x-idempotency-key"] || normalizedOrder.idempotencyKey || normalizedOrder.id;
      const customerUser = getCustomerUser(req, lockedDb);
      if (customerUser) {
        normalizedOrder.customerUserId = customerUser.id;
        normalizedOrder.customerEmail = customerUser.email || normalizedOrder.customerEmail;
        normalizedOrder.customerCpf = customerUser.cpf || normalizedOrder.customerCpf;
      }
      const existing = findExistingCheckout(lockedDb, normalizedOrder, "credit_card");
      if (existing) {
        sendJson(res, 200, existing);
        return;
      }
      const order = repriceOrderFromCatalog(lockedDb, normalizedOrder);
      if (normalizedOrder.useClubCredits) {
        sendJson(res, 422, { error: { code: "CLUB_CREDIT_ROUTE_REQUIRED", message: "Use a ação exclusiva de créditos do Clube. O pagamento por cartão nunca aprova créditos automaticamente." } });
        return;
      }
      applyClubPlanBenefits(lockedDb, order, customerUser);
      if (order.totalPrice <= 0) {
        sendJson(res, 409, { error: { code: "PAYMENT_AMOUNT_INVALID", message: "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de pagar." } });
        return;
      }
      const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
      if (!(mercadoPagoConfig?.enabled && mercadoPagoConfig?.configured) && process.env.PAYMENTS_MODE !== "test") {
        sendJson(res, 412, { error: { code: "MERCADO_PAGO_NOT_CONFIGURED", message: "Mercado Pago está indisponível. Configure e habilite a integração no painel administrativo." } });
        return;
      }
      const providerPayment = await createMercadoPagoOrderPayment(order, mercadoPagoConfig, {
        method: "credit_card",
        card: {
          token: body.cardToken || body.token || body.card?.token || body.payment?.token,
          paymentMethodId: body.paymentMethodId || body.payment_method_id || body.card?.paymentMethodId || body.card?.payment_method_id,
          paymentTypeId: body.paymentTypeId || body.payment_type_id || body.card?.paymentTypeId || body.card?.payment_type_id || "credit_card",
          installments: body.installments || body.card?.installments || 1
        },
        idempotencyKey: body.idempotencyKey || req.headers["x-idempotency-key"],
        statementDescriptor: "CINE CRUZEIRO"
      });
      const payment = createPaymentRecord(order, providerPayment, "credit_card");
      const savedOrder = {
        ...order,
        paymentMethod: "CREDIT_CARD",
        paymentProvider: payment.provider,
        paymentId: payment.providerPaymentId,
        paymentStatus: payment.status,
        status: payment.status === "approved" ? "paid" : "pending_payment",
        reservationExpiresAt: payment.status === "approved" ? "" : new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
      reserveConcessionStock(lockedDb, savedOrder);
      const tickets = payment.status === "approved" ? finalizePaidOrder(lockedDb, savedOrder, payment, "online") : [];
      if (tickets.length) consumePendingClubCredit(lockedDb, savedOrder, tickets, customerUser?.id);
      if (tickets.length) await deliverTicketsByEmail(lockedDb, savedOrder, tickets);
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      logEvent("info", "payment.created", { orderId: savedOrder.id, paymentId: payment.id, method: payment.method, provider: payment.provider, status: payment.status });
      sendJson(res, 201, { order: savedOrder, payment, tickets });
    });
    return;
  }

  if (pathname === "/api/account/tickets" && method === "GET") {
    sendJson(res, 410, { error: { code: "ENDPOINT_REMOVED", message: "Use /api/me/tickets com sessao autenticada." } });
    return;
  }

  const checkoutOrderMatch = pathname.match(/^\/api\/checkout\/orders\/([^/]+)$/);
  if (checkoutOrderMatch && method === "GET") {
    const orderId = decodeURIComponent(checkoutOrderMatch[1]);
    await reconcileMercadoPagoCheckoutOrder(orderId, db);
    const currentDb = await readDb();
    const order = (currentDb.orders || []).find((item) => item.id === orderId || item.idempotencyKey === orderId);
    if (!order) {
      sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
      return;
    }
    const payment = (currentDb.payments || []).find((item) => item.orderId === order.id) || null;
    if (!payment) {
      sendJson(res, 404, { error: { code: "PAYMENT_NOT_FOUND", message: "Pagamento nao encontrado para este pedido." } });
      return;
    }
    const tickets = payment.status === "approved"
      ? (currentDb.tickets || []).filter((ticket) => ticket.orderId === order.id).map((ticket) => enrichTicket(currentDb, ticket))
      : [];
    sendJson(res, 200, { order, payment, tickets });
    return;
  }

  if (pathname === "/api/me/tickets" && method === "GET") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar ingressos." } });
      return;
    }
    const query = new URLSearchParams();
    query.set("userId", user.id);
    query.set("email", user.email);
    if (user.cpf) query.set("cpf", user.cpf);
    const tickets = findAccountTickets(db, query);
    sendJson(res, 200, {
      tickets,
      upcoming: tickets.filter((ticket) => !ticket.archived),
      archived: tickets.filter((ticket) => ticket.archived)
    });
    return;
  }

  const accountTicketMatch = pathname.match(/^\/api\/me\/tickets\/([^/]+)(?:\/([^/]+))?$/);
  if (accountTicketMatch) {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar ingressos." } });
      return;
    }
    const ticketId = decodeURIComponent(accountTicketMatch[1]);
    const action = accountTicketMatch[2] ? decodeURIComponent(accountTicketMatch[2]) : "";

    if (method === "GET" && !action) {
      const ticket = (db.tickets || []).find((item) => item.id === ticketId);
      if (!ticket || !ticketBelongsToUser(db, ticket, user)) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      sendJson(res, 200, { ticket: enrichTicket(db, ticket) });
      return;
    }

    if (method === "GET" && action === "download") {
      const ticket = (db.tickets || []).find((item) => item.id === ticketId);
      if (!ticket || !ticketBelongsToUser(db, ticket, user)) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      const disposition = url.searchParams.get("view") === "1" ? "inline" : "attachment";
      const pdf = await ticketDownloadPdf(db, ticket);
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="cine-cruzeiro-${ticket.code}.pdf"`,
          "Cache-Control": "no-store"
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin"
      });
      res.end(pdf);
      return;
    }

    if (method === "POST" && action === "google-wallet") {
      const ticket = (db.tickets || []).find((item) => item.id === ticketId);
      if (!ticket || !ticketBelongsToUser(db, ticket, user)) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      try {
        sendJson(res, 200, { url: googleWalletSaveUrl(db, ticket, user, req) });
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: { code: error.statusCode === 412 ? "GOOGLE_WALLET_NOT_CONFIGURED" : "GOOGLE_WALLET_UNAVAILABLE", message: error.message } });
      }
      return;
    }

    if (method === "POST" && action === "transfer") {
      const body = await readBody(req);
      const targetEmail = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        sendJson(res, 400, { error: { code: "EMAIL_INVALID", message: "Informe o e-mail de uma conta cadastrada." } });
        return;
      }
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const freshUser = getCustomerUser(req, lockedDb);
        const ticket = (lockedDb.tickets || []).find((item) => item.id === ticketId);
        if (!freshUser || !ticket || !ticketBelongsToUser(lockedDb, ticket, freshUser)) {
          sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
          return;
        }
        const targetUser = (lockedDb.users || []).find((item) => item.email === targetEmail && item.active !== false && ["customer", ...adminRoles()].includes(item.role));
        if (!targetUser) {
          sendJson(res, 404, { error: { code: "TRANSFER_TARGET_NOT_FOUND", message: "Este e-mail ainda nao possui conta cadastrada." } });
          return;
        }
        if (targetUser.id === freshUser.id) {
          sendJson(res, 400, { error: { code: "TRANSFER_SAME_USER", message: "Este ingresso ja esta na sua conta." } });
          return;
        }
        const transferCheck = canTransferTicket(lockedDb, ticket);
        if (!transferCheck.ok) {
          sendJson(res, 409, { error: { code: "TICKET_NOT_TRANSFERABLE", message: transferCheck.message } });
          return;
        }
        const oldCode = ticket.code;
        const newCode = createTicketCode(lockedDb.tickets || []);
        ticket.customerUserId = targetUser.id;
        ticket.customerName = targetUser.name || ticket.customerName;
        ticket.customerEmail = targetUser.email;
        ticket.customerPhone = targetUser.phone || "";
        ticket.customerCpf = targetUser.cpf || "";
        ticket.code = newCode;
        ticket.qrPayload = ticketQrPayload(newCode);
        ticket.transferredAt = new Date().toISOString();
        ticket.transferredFromUserId = freshUser.id;
        ticket.updatedAt = new Date().toISOString();
        lockedDb.ticketTransfers ||= [];
        lockedDb.ticketTransfers.push({
          id: `transfer-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          fromUserId: freshUser.id,
          toUserId: targetUser.id,
          ticketId: ticket.id,
          oldCode,
          newCode,
          transferredAt: ticket.transferredAt
        });
        lockedDb.auditLogs ||= [];
        lockedDb.auditLogs.push({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          userId: freshUser.id,
          userEmail: freshUser.email,
          action: "POST /api/me/tickets/:id/transfer",
          entityType: "ticket",
          entityId: ticket.id,
          before: { customerUserId: freshUser.id, code: oldCode },
          after: { customerUserId: targetUser.id, code: newCode },
          ip: clientIp(req),
          createdAt: ticket.transferredAt
        });
        const enrichedTransferTicket = enrichTicket(lockedDb, ticket);
        let transferAttachment = null;
        try {
          transferAttachment = {
            filename: `cine-cruzeiro-${String(ticket.code || ticket.id || "ingresso").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.pdf`,
            content: await ticketDownloadPdf(lockedDb, ticket),
            contentType: "application/pdf"
          };
        } catch (error) {
          logEvent("warn", "ticket_transfer_pdf.failed", { ticketId: ticket.id, message: error.message });
        }
        try {
          enrichedTransferTicket.googleWalletUrl = googleWalletSaveUrl(lockedDb, ticket, targetUser, null);
        } catch {
          enrichedTransferTicket.googleWalletUrl = "";
        }
        await writeDb(lockedDb);
        emailService.sendTicketTransfer(lockedDb, {
          ticket: enrichedTransferTicket,
          fromUser: freshUser,
          toUser: targetUser,
          accountUrl: `${appFrontendUrl()}/conta/ingressos`,
          logoUrl: `${appFrontendUrl()}/images/favicon-email.png`,
          siteUrl: appFrontendUrl(),
          attachments: transferAttachment ? [transferAttachment] : []
        }).catch((error) => {
          logEvent("warn", "ticket_transfer_email.failed", { ticketId: ticket.id, message: error.message });
        });
        logEvent("info", "ticket.transferred", { ticketId: ticket.id, fromUserId: freshUser.id, toUserId: targetUser.id });
        sendJson(res, 200, { ok: true, ticket: enrichTicket(lockedDb, ticket) });
      });
      return;
    }
  }

  if ((pathname === "/api/box-office/sales" || pathname === "/api/tickets/manual") && method === "POST") {
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const adminUser = getAdminUser(req, lockedDb);
      if (!adminUser) {
        sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para vender na bilheteria." } });
        return;
      }
      const methodMap = {
        cash: "cash",
        money: "cash",
        card_terminal: "card_terminal",
        terminal: "card_terminal",
        external_pix: "external_pix",
        pix_counter: "external_pix",
        courtesy: "courtesy",
        cortesia: "courtesy"
      };
      const paymentMethod = methodMap[String(body.paymentMethod || "cash").trim()] || "cash";
      const selectedCustomer = body.customerUserId
        ? (lockedDb.users || []).find((user) => user.id === body.customerUserId && user.active !== false && ["customer", ...adminRoles()].includes(user.role))
        : null;
      const saleMode = body.saleMode || (selectedCustomer ? "registered" : body.customerName ? "guest" : "quick");
      const order = repriceOrderFromCatalog(lockedDb, normalizePaymentOrder({
        ...body,
        customerUserId: selectedCustomer?.id || "",
        customerName: selectedCustomer?.name || body.customerName || (saleMode === "quick" ? "Venda rápida de balcão" : "Cliente avulso"),
        customerEmail: selectedCustomer?.email || body.customerEmail || "",
        customerPhone: selectedCustomer?.phone || body.customerPhone || "",
        customerCpf: selectedCustomer?.cpf || body.customerCpf || "",
        paymentMethod,
        status: "paid",
        paymentStatus: "approved"
      }));
      if (paymentMethod === "courtesy") {
        order.discountValue = Number(order.totalPrice || 0);
        order.totalPrice = 0;
      }
      if (!selectedCustomer && !body.customerEmail) order.customerEmail = "";
      const payment = createBoxOfficePaymentRecord(order, paymentMethod, adminUser);
      const savedOrder = {
        ...order,
        id: order.id,
        status: "paid",
        origin: "box_office",
        saleMode,
        paymentMethod,
        paymentProvider: payment.provider,
        paymentId: payment.id,
        paymentStatus: "approved",
        createdBy: adminUser.id,
        createdByEmail: adminUser.email,
        createdAt: order.createdAt || new Date().toISOString(),
        paidAt: new Date().toISOString(),
        audit: {
          origin: "box_office",
          paymentMethod,
          createdBy: adminUser.id,
          createdAt: new Date().toISOString(),
          customerId: selectedCustomer?.id || ""
        }
      };
      const tickets = finalizePaidOrder(lockedDb, savedOrder, payment, paymentMethod === "courtesy" ? "courtesy" : "box_office");
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      logEvent("info", "box_office_sale.created", {
        orderId: savedOrder.id,
        tickets: tickets.length,
        paymentMethod,
        createdBy: adminUser.id,
        customerId: selectedCustomer?.id || ""
      });
      sendJson(res, 201, { order: savedOrder, payment, tickets });
    });
    return;
  }

  if (pathname === "/api/tickets/validate" && method === "POST") {
    const body = await readBody(req);
    try {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const adminUser = getAdminUser(req, lockedDb);
        const ticket = validateTicket(lockedDb, body.code || body.qrPayload, adminUser);
        lockedDb.auditLogs ||= [];
        lockedDb.auditLogs.push({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          entityType: "ticket_validation",
          entityId: ticket.id,
          action: "ticket.validated",
          updatedBy: adminUser?.id || "",
          updatedByEmail: adminUser?.email || "",
          at: new Date().toISOString(),
          before: null,
          after: {
            ticketId: ticket.id,
            operatorId: adminUser?.id || "",
            validatedAt: ticket.usedAt,
            result: "validated"
          }
        });
        await writeDb(lockedDb);
        logEvent("info", "ticket.used", { ticketId: ticket.id, orderId: ticket.orderId, usedBy: ticket.usedBy });
        sendJson(res, 200, { ok: true, result: "valid", ticket: enrichTicket(lockedDb, ticket) });
      });
    } catch (error) {
      try {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const adminUser = getAdminUser(req, lockedDb);
          const failedTicketId = error.ticket?.id || "";
          const result = error.code === "TICKET_ALREADY_USED" ? "used" : error.code === "TICKET_EXPIRED" ? "expired" : "invalid";
          lockedDb.auditLogs ||= [];
          lockedDb.auditLogs.push({
            id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
            entityType: "ticket_validation",
            entityId: failedTicketId,
            action: "ticket.validation_denied",
            updatedBy: adminUser?.id || "",
            updatedByEmail: adminUser?.email || "",
            at: new Date().toISOString(),
            before: null,
            after: {
              ticketId: failedTicketId,
              operatorId: adminUser?.id || "",
              validatedAt: new Date().toISOString(),
              result,
              code: error.code || "TICKET_VALIDATION_FAILED",
              message: error.message,
              payloadPreview: String(body.code || body.qrPayload || "").slice(0, 80)
            }
          });
          await writeDb(lockedDb);
        });
      } catch {
        // A falha de auditoria nao deve mascarar o motivo real da validacao.
      }
      sendJson(res, error.statusCode || 400, {
        ok: false,
        result: error.code === "TICKET_ALREADY_USED" ? "used" : error.code === "TICKET_EXPIRED" ? "expired" : "invalid",
        error: {
          code: error.code || "TICKET_VALIDATION_FAILED",
          message: error.message
        },
        ticket: error.ticket ? enrichTicket(db, error.ticket) : null
      });
    }
    return;
  }

  if (pathname === "/api/webhooks/mercado-pago" && method === "POST") {
    const body = await readBody(req);
    const provider = "mercado_pago";
    const webhookUrl = new URL(req.url, `http://${req.headers.host}`);
    const providerConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
    const receivedContext = webhookSafeLogContext(req, webhookUrl, body);
    logEvent("info", "webhook.mercado_pago.received", receivedContext);
    let verification;
    try {
      verification = paymentService.verifyWebhookRequest(provider, req, webhookUrl, body, providerConfig || {});
    } catch (error) {
      logEvent("warn", "webhook.mercado_pago.rejected", {
        ...receivedContext,
        validation: "rejected",
        reason: error.code || "MERCADO_PAGO_WEBHOOK_INVALID_SIGNATURE"
      });
      throw error;
    }
    logEvent("info", "webhook.mercado_pago.validated", {
      ...receivedContext,
      validation: "approved"
    });
    const signedOrderStatus = paymentService.normalizeMercadoPagoWebhookOrder(body);
    const providerPaymentId = String(verification.dataId || signedOrderStatus?.id || body.data?.id || body.providerPaymentId || body.paymentId || "");
    const orderId = String(body.orderId || body.externalReference || body.external_reference || signedOrderStatus?.externalReference || body.data?.external_reference || body.reference || "");
    const eventId = mercadoPagoWebhookEventId(body, verification);
    const webhookAction = mercadoPagoWebhookAction(body);
    const webhookTopic = String([
      webhookUrl.searchParams.get("type"),
      webhookUrl.searchParams.get("topic"),
      body.type,
      body.topic,
      body.action
    ].filter(Boolean).join(" ")).toLowerCase();

    if (!providerPaymentId && !orderId) {
      logEvent("info", "webhook.accepted_without_reference", {
        provider,
        eventId,
        topic: webhookTopic || "unknown",
        verified: verification.verified
      });
      sendJson(res, 200, { ok: true, accepted: true, processed: false });
      return;
    }

    const isAuthorizedPaymentEvent = /subscription_authorized_payment|authorized_payment/.test(webhookTopic);
    const isSubscriptionEvent = /preapproval|subscription|authorized_payment/.test(webhookTopic);
    if (!isSubscriptionEvent && !MERCADO_PAGO_ORDER_ACTIONS.has(webhookAction)) {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const duplicate = lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId);
        if (!duplicate) {
          lockedDb.webhookEvents.push({
            provider,
            eventId,
            providerPaymentId,
            orderId,
            requestId: verification.requestId,
            action: webhookAction,
            status: "ignored_unknown_event",
            verified: true,
            createdAt: new Date().toISOString()
          });
          await writeDb(lockedDb);
        }
        logEvent("info", "webhook.mercado_pago.ignored", { eventId, action: webhookAction, providerPaymentId, duplicate });
        sendJson(res, 200, {
          ok: true,
          accepted: true,
          processed: false,
          duplicate,
          processing: { recognized: false, orderLocated: false, stateUpdated: false }
        });
      });
      return;
    }

    if (provider === "mercado_pago" && isSubscriptionEvent) {
      const authorizedPayment = isAuthorizedPaymentEvent
        ? await paymentService.fetchMercadoPagoAuthorizedPayment(providerPaymentId, providerConfig || {})
        : null;
      const effectiveProviderSubscriptionId = authorizedPayment?.preapprovalId || providerPaymentId;
      const providerSubscription = effectiveProviderSubscriptionId
        ? await paymentService.fetchMercadoPagoSubscription(effectiveProviderSubscriptionId, providerConfig || {})
        : null;
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        if (lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId)) {
          logEvent("info", "webhook.subscription.duplicate", { provider, eventId, providerPaymentId });
          sendJson(res, 200, { ok: true, duplicate: true, processing: { recognized: true, stateUpdated: false } });
          return;
        }
        const subscription = (lockedDb.subscriptions || []).find((item) =>
          item.provider === "mercado_pago" &&
          (
            item.providerSubscriptionId === effectiveProviderSubscriptionId
            || item.id === providerSubscription?.externalReference
            || item.id === authorizedPayment?.externalReference
          )
        );
        if (!subscription) {
          lockedDb.webhookEvents.push({
            provider,
            eventId,
            providerPaymentId,
            orderId: "",
            subscriptionId: "",
            status: "not_found",
            verified: verification.verified,
            createdAt: new Date().toISOString()
          });
          await writeDb(lockedDb);
          logEvent("info", "webhook.subscription.not_found", { provider, eventId, providerPaymentId, verified: verification.verified });
          sendJson(res, 200, { ok: true, accepted: true, processed: false, processing: { recognized: true, subscriptionLocated: false, stateUpdated: false } });
          return;
        }
        if (isAuthorizedPaymentEvent) {
          const paymentApproved = authorizedPayment?.paymentStatus === "approved";
          if (paymentApproved) {
            applyMercadoPagoSubscriptionStatus(lockedDb, subscription, {
              ...(providerSubscription || {}),
              id: effectiveProviderSubscriptionId,
              status: "authorized",
              localStatus: "active"
            }, "mercado_pago_authorized_payment_webhook", { paymentApproved: true });
          } else if (["rejected", "cancelled", "refunded", "expired"].includes(authorizedPayment?.paymentStatus || "")) {
            applyMercadoPagoSubscriptionStatus(lockedDb, subscription, {
              ...(providerSubscription || {}),
              id: effectiveProviderSubscriptionId,
              status: "payment_failed",
              localStatus: "payment_failed"
            }, "mercado_pago_authorized_payment_webhook", { paymentApproved: false });
          } else {
            subscription.paymentStatus = "pending";
            subscription.updatedAt = new Date().toISOString();
          }
          subscription.lastAuthorizedPaymentId = authorizedPayment?.id || providerPaymentId;
          subscription.lastProviderPaymentId = authorizedPayment?.paymentId || "";
        } else {
          const providerAuthorizationApproved = providerSubscription?.localStatus === "active";
          applyMercadoPagoSubscriptionStatus(lockedDb, subscription, providerSubscription || {
            id: effectiveProviderSubscriptionId,
            status: body.status || body.action || "pending"
          }, "mercado_pago_webhook", {
            paymentApproved: providerAuthorizationApproved || subscription.paymentStatus === "approved"
          });
        }
        lockedDb.webhookEvents.push({
          provider,
          eventId,
          providerPaymentId,
          orderId: "",
          subscriptionId: subscription.id,
          authorizedPaymentId: authorizedPayment?.id || "",
          status: subscription.status,
          verified: verification.verified,
          createdAt: new Date().toISOString()
        });
        await writeDb(lockedDb);
        logEvent("info", "webhook.subscription.processed", { provider, eventId, providerPaymentId, subscriptionId: subscription.id, status: subscription.status, verified: verification.verified });
        sendJson(res, 200, { ok: true, processed: true, processing: { recognized: true, subscriptionLocated: true, stateUpdated: true, status: subscription.status } });
      });
      return;
    }

    // Prefer the provider lookup recommended by Mercado Pago. The signed Orders
    // payload is a safe fallback when the lookup is temporarily unavailable.
    const signedPayloadHasState = Boolean(body.data?.status || body.data?.status_detail || body.data?.transactions?.payments?.length);
    const providerStatus = signedPayloadHasState
      ? signedOrderStatus
      : await paymentService.fetchProviderPaymentStatus(provider, providerPaymentId, providerConfig || {});
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      if (lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId)) {
        logEvent("info", "webhook.duplicate", { provider, eventId, providerPaymentId });
        sendJson(res, 200, {
          ok: true,
          duplicate: true,
          processed: false,
          processing: { recognized: true, orderLocated: true, stateUpdated: false }
        });
        return;
      }

      const effectiveOrderId = orderId || providerStatus?.externalReference || "";
      const payment = lockedDb.payments.find((item) =>
        item.provider === provider &&
        (item.providerPaymentId === providerPaymentId || item.orderId === effectiveOrderId || item.providerReference === effectiveOrderId)
      );
      if (!payment) {
        lockedDb.webhookEvents.push({
          provider,
          eventId,
          providerPaymentId,
          orderId: effectiveOrderId,
          status: "not_found",
          verified: verification.verified,
          createdAt: new Date().toISOString()
        });
        await writeDb(lockedDb);
        logEvent("info", "webhook.payment.not_found", { provider, eventId, providerPaymentId, orderId: effectiveOrderId, verified: verification.verified });
        sendJson(res, 200, {
          ok: true,
          accepted: true,
          processed: false,
          processing: { recognized: true, orderLocated: false, stateUpdated: false }
        });
        return;
      }

      const isClubSubscriptionPayment = payment.metadata?.kind === "club_subscription";
      const order = isClubSubscriptionPayment ? null : lockedDb.orders.find((item) => item.id === payment.orderId);
      if (provider === "mercado_pago" && providerPaymentId && payment.providerPaymentId !== providerPaymentId && providerStatus?.id) {
        payment.metadata = { ...(payment.metadata || {}), previousProviderPaymentId: payment.providerPaymentId };
        payment.providerPaymentId = providerStatus.id;
      }
      if (!mercadoPagoReferenceMatches(payment, providerStatus?.externalReference)) {
        sendJson(res, 409, {
          error: {
            code: "PAYMENT_REFERENCE_MISMATCH",
            message: "Referencia externa do pagamento nao confere com o pedido."
          }
        });
        return;
      }
      if (providerStatus?.externalReference) payment.providerReference = providerStatus.externalReference;
      if (providerStatus?.amount && Math.abs(Number(providerStatus.amount) - Number(payment.amount)) > 0.01) {
        sendJson(res, 409, {
          error: {
            code: "PAYMENT_AMOUNT_MISMATCH",
            message: "Valor confirmado pelo provedor nao confere com o pedido."
          }
        });
        return;
      }

      const nextStatus = providerStatus?.status || normalizeProviderPaymentStatus(body.status || body.action || body.type);
      payment.metadata = { ...(payment.metadata || {}), lastWebhook: body, verification, providerStatus: providerStatus?.raw || null };
      payment.status = nextStatus === "pending" ? payment.status : nextStatus;
      payment.updatedAt = new Date().toISOString();
      if (payment.status === "approved") payment.approvedAt = payment.approvedAt || new Date().toISOString();
      if (payment.status === "expired") payment.expiredAt = payment.expiredAt || new Date().toISOString();
      if (payment.status === "cancelled") payment.cancelledAt = payment.cancelledAt || new Date().toISOString();
      if (payment.status === "refunded") payment.refundedAt = payment.refundedAt || new Date().toISOString();
      let tickets = [];
      let subscription = null;
      if (isClubSubscriptionPayment) {
        subscription = (lockedDb.subscriptions || []).find((item) => item.id === payment.metadata?.subscriptionId) || null;
        if (payment.status === "approved") {
          activateSubscriptionFromPayment(lockedDb, subscription, payment);
        } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status)) {
          failSubscriptionFromPayment(lockedDb, subscription, payment, payment.status);
        }
      } else
      if (payment.status === "approved") {
        const wasAlreadyPaid = order?.status === "paid";
        tickets = finalizePaidOrder(lockedDb, order, payment, "online");
        if (!wasAlreadyPaid && tickets.length) consumePendingClubCredit(lockedDb, order, tickets, order?.customerUserId);
        if (!wasAlreadyPaid && tickets.length) await deliverTicketsByEmail(lockedDb, order, tickets);
      } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status) && order?.status !== "paid") {
        releaseConcessionReservation(lockedDb, order);
        order.status = payment.status === "refunded" ? "refunded" : payment.status === "rejected" ? "cancelled" : payment.status;
        order.paymentStatus = payment.status;
      }

      lockedDb.webhookEvents.push({
        provider,
        eventId,
        providerPaymentId,
        orderId: payment.orderId,
        requestId: verification.requestId,
        action: webhookAction,
        status: payment.status,
        subscriptionId: subscription?.id || "",
        verified: verification.verified,
        createdAt: new Date().toISOString()
      });
      await writeDb(lockedDb);
      logEvent("info", "webhook.processed", { provider, eventId, providerPaymentId, orderId: payment.orderId, status: payment.status, tickets: tickets.length, verified: verification.verified });
      sendJson(res, 200, {
        ok: true,
        processed: true,
        processing: {
          recognized: true,
          orderLocated: Boolean(order),
          stateUpdated: true,
          status: payment.status,
          ticketsCreated: tickets.length
        }
      });
    });
    return;
  }

  if (pathname === "/api/orders" && method === "GET") {
    sendJson(res, 200, db.orders);
    return;
  }

  const permanentOrderDeleteMatch = pathname.match(/^\/api\/orders\/([^/]+)\/permanent$/);
  if (permanentOrderDeleteMatch && method === "DELETE") {
    const orderId = decodeURIComponent(permanentOrderDeleteMatch[1]);
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const result = permanentlyDeleteOrder(lockedDb, orderId, body, req.adminUser);
      await writeDb(lockedDb);
      sendJson(res, 200, result);
    });
    return;
  }

  const adminOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  const orderResendEmailMatch = pathname.match(/^\/api\/orders\/([^/]+)\/resend-ticket-email$/);
  if (orderResendEmailMatch && method === "POST") {
    const orderId = decodeURIComponent(orderResendEmailMatch[1]);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const order = (lockedDb.orders || []).find((item) => item.id === orderId);
      if (!order) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return;
      }
      const tickets = orderTickets(lockedDb, order.id);
      if (order.status !== "paid" || !tickets.length) {
        sendJson(res, 409, { error: { code: "ORDER_NOT_DELIVERABLE", message: "Somente pedidos pagos com ingressos emitidos podem ser reenviados." } });
        return;
      }
      const delivered = await deliverTicketsByEmail(lockedDb, order, tickets);
      await writeDb(lockedDb);
      sendJson(res, 200, { ok: delivered, emailDeliveredAt: order.emailDeliveredAt || "" });
    });
    return;
  }

  if (adminOrderMatch && method === "GET") {
    const orderId = decodeURIComponent(adminOrderMatch[1]);
    const order = (db.orders || []).find((item) => item.id === orderId);
    if (!order) {
      sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
      return;
    }
    sendJson(res, 200, {
      order,
      payment: orderPayment(db, order.id),
      tickets: orderTickets(db, order.id).map((ticket) => enrichTicket(db, ticket))
    });
    return;
  }

  if (adminOrderMatch && method === "PATCH") {
    const orderId = decodeURIComponent(adminOrderMatch[1]);
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const order = (lockedDb.orders || []).find((item) => item.id === orderId);
      if (!order) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return;
      }
      if (body.action === "cancel") {
        cancelOrder(lockedDb, order, body.reason, req.adminUser);
      } else if (body.action === "archive") {
        archiveOrder(order, body.reason, req.adminUser);
      } else {
        safeOrderUpdate(order, body, req.adminUser);
      }
      await writeDb(lockedDb);
      sendJson(res, 200, {
        order,
        payment: orderPayment(lockedDb, order.id),
        tickets: orderTickets(lockedDb, order.id).map((ticket) => enrichTicket(lockedDb, ticket))
      });
    });
    return;
  }

  if (adminOrderMatch && method === "DELETE") {
    const orderId = decodeURIComponent(adminOrderMatch[1]);
    const body = await readBody(req);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const index = (lockedDb.orders || []).findIndex((item) => item.id === orderId);
      if (index === -1) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return;
      }
      const order = lockedDb.orders[index];
      const payment = orderPayment(lockedDb, order.id);
      const tickets = orderTickets(lockedDb, order.id);
      if (removableDraftOrder(order, payment, tickets)) {
        lockedDb.orders.splice(index, 1);
        await writeDb(lockedDb);
        sendJson(res, 200, { deleted: true, orderId });
        return;
      }
      cancelOrder(lockedDb, order, body.reason, req.adminUser);
      await writeDb(lockedDb);
      sendJson(res, 200, {
        deleted: false,
        order,
        payment: orderPayment(lockedDb, order.id),
        tickets: orderTickets(lockedDb, order.id).map((ticket) => enrichTicket(lockedDb, ticket))
      });
    });
    return;
  }

  if (pathname === "/api/orders" && method === "POST") {
    const body = await readBody(req);
    const order = {
      ...body,
      id: body.id || `pedido-${Date.now()}`,
      status: "pending_payment",
      createdAt: body.createdAt || new Date().toISOString()
    };
    db.orders.unshift(order);
    await writeDb(db);
    sendJson(res, 201, { ...order, tickets: [] });
    return;
  }

  sendJson(res, 404, { error: "Rota nao encontrada" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  requestContext.run({ req, pathname, method: req.method }, async () => {
    try {

      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname);
        return;
      }

      if (pathname === "/" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/images/") || pathname.startsWith("/trailers/") || stripPublicAssetBase(pathname).startsWith("/uploads/")) {
        await serveStatic(req, res, pathname === "/" ? "/admin" : pathname);
        return;
      }

      sendJson(res, 404, { error: "Nao encontrado" });
    } catch (error) {
      const status = error.statusCode || 500;
      logEvent(status >= 500 ? "error" : "warn", "request.failed", {
        status,
        code: error.code || "REQUEST_ERROR",
        message: error.message
      });
      sendJson(res, status, {
        error: {
          code: status >= 500 ? "INTERNAL_ERROR" : error.code || "REQUEST_ERROR",
          message: status >= 500 ? "Erro interno do backend" : error.message
        },
        ...(isProduction() ? {} : { detail: error.message })
      });
    }
    });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Porta ${PORT} ocupada. Rode npm run dev:stop e tente iniciar novamente.`);
    process.exit(1);
  }
  throw error;
});

async function runSubscriptionMaintenance() {
  try {
    await withCriticalMutation(async () => {
      const db = await readDb();
      const result = await expirePendingPaymentSubscriptions(db);
      const lifecycle = finalizeEndingSubscriptions(db);
      if (result.changed || lifecycle.changed) {
        await writeDb(db);
        logEvent("info", "subscription.pending_payment_maintenance", {
          expired: result.expired,
          failed: result.failed,
          finalized: lifecycle.finalized
        });
      }
    });
  } catch (error) {
    logEvent("warn", "subscription.pending_payment_maintenance_failed", {
      code: error?.code || "SUBSCRIPTION_MAINTENANCE_FAILED",
      message: error?.message || "Falha ao executar manutencao do Clube."
    });
  }
}

loadEnvFiles().then(() => {
  if (isProduction() && !postgresEnabled()) {
    console.error("POSTGRES_REQUIRED_IN_PRODUCTION: configure DATABASE_URL ou POSTGRES_URL antes de iniciar em producao.");
    process.exit(1);
  }
  server.listen(PORT, HOST, () => {
    const tmdb = getTmdbCredentials();
    console.log(`Cine Cruzeiro backend: http://${HOST}:${PORT}`);
    console.log(`Painel admin: http://${HOST}:${PORT}/admin`);
    console.log(`TMDB: ${tmdb.configured ? `configurado via ${tmdb.mode}` : "nao configurado"}`);
    void runSubscriptionMaintenance();
    const subscriptionMaintenanceTimer = setInterval(() => {
      void runSubscriptionMaintenance();
    }, SUBSCRIPTION_MAINTENANCE_INTERVAL_MS);
    subscriptionMaintenanceTimer.unref?.();
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

module.exports = server;
