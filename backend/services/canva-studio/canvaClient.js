const crypto = require("crypto");
const API_BASE = "https://api.canva.com/rest/v1";
const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const SCOPES = ["asset:write", "brandtemplate:content:read", "design:content:read", "design:content:write", "design:meta:read"];

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function authorization(config, state, verifier) {
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const url = new URL(AUTHORIZE_URL);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri, scope: SCOPES.join(" "), state, code_challenge: challenge, code_challenge_method: "s256" })) url.searchParams.set(key, value);
  return url.toString();
}

function mapCanvaError(status, payload, retryAfter = "") {
  const invalidGrant = payload?.error === "invalid_grant";
  const code = status === 401 || invalidGrant ? "CANVA_RECONNECT_REQUIRED" : status === 403 ? "CANVA_SCOPE_OR_PLAN_REQUIRED" : status === 429 ? "CANVA_RATE_LIMIT" : status >= 500 ? "CANVA_UNAVAILABLE" : "CANVA_REQUEST_FAILED";
  const message = status === 401 || invalidGrant ? "A conexão com o Canva expirou. Reconecte a conta."
    : status === 403 ? "O Canva recusou a operação. Confira permissões, plano e acesso ao Brand Template."
    : status === 429 ? "Limite temporário do Canva atingido. Tente novamente em instantes."
    : status >= 500 ? "O Canva está temporariamente indisponível. Tente novamente."
    : payload?.message || payload?.error?.message || "O Canva não concluiu a operação.";
  return Object.assign(new Error(message), { code, statusCode: status === 429 ? 429 : status === 401 || invalidGrant ? 409 : status === 403 ? 403 : 502, retryAfter, expose: true, providerCode: payload?.code || payload?.error?.code || "" });
}

async function fetchCanva(fetchImpl, url, options) {
  try { return await fetchImpl(url, options); }
  catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw Object.assign(new Error(timeout ? "O Canva demorou para responder. Tente novamente." : "Não foi possível comunicar com o Canva. Verifique a conexão."), {
      code: timeout ? "CANVA_TIMEOUT" : "CANVA_NETWORK_ERROR", statusCode: 503, expose: true
    });
  }
}

function createCanvaClient({ config, tokenProvider, fetchImpl = fetch }) {
  async function request(method, endpoint, body, options = {}) {
    const token = await tokenProvider();
    const headers = { Authorization: `Bearer ${token}` };
    if (options.binary) {
      headers["Content-Type"] = "application/octet-stream";
      headers["Asset-Upload-Metadata"] = JSON.stringify({ name_base64: Buffer.from(Array.from(options.name).slice(0, 50).join("")).toString("base64") });
    } else if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetchCanva(fetchImpl, `${API_BASE}${endpoint}`, { method, headers, body: options.binary ? body : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw mapCanvaError(response.status, payload, response.headers.get("retry-after") || "");
    return payload;
  }
  async function exchange(params) {
    const response = await fetchCanva(fetchImpl, `${API_BASE}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw mapCanvaError(response.status, payload);
    if (!payload.access_token || !payload.refresh_token || !payload.expires_in) throw mapCanvaError(502, {});
    return payload;
  }
  return {
    exchange,
    currentUser: () => request("GET", "/users/me"),
    templateDataset: (id) => request("GET", `/brand-templates/${encodeURIComponent(id)}/dataset`),
    createUpload: (bytes, name) => request("POST", "/asset-uploads", bytes, { binary: true, name }),
    uploadJob: (id) => request("GET", `/asset-uploads/${encodeURIComponent(id)}`),
    createAutofill: (templateId, data) => request("POST", "/autofills", { brand_template_id: templateId, data, type: "create_from_brand_template" }),
    autofillJob: (id) => request("GET", `/autofills/${encodeURIComponent(id)}`),
    design: (id) => request("GET", `/designs/${encodeURIComponent(id)}`),
    createExport: (id, format) => request("POST", "/exports", { design_id: id, format: { type: format } }),
    exportJob: (id) => request("GET", `/exports/${encodeURIComponent(id)}`)
  };
}

module.exports = { SCOPES, authorization, mapCanvaError, createCanvaClient };
