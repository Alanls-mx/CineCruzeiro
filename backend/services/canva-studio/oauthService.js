const crypto = require("crypto");
const repository = require("./studioRepository");
const { createCanvaClient, authorization } = require("./canvaClient");
const { encryptSecret, decryptSecret } = require("../integrationConfigService");
const { studioError } = require("./campaignPlanner");

function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function client(config, tokenProvider = async () => "") { return createCanvaClient({ config, tokenProvider }); }
function callbackPrefix(config) {
  try {
    const url = new URL(config.redirectUri);
    const suffix = "/api/admin/canva-studio/oauth/callback";
    const local = ["localhost", "127.0.0.1"].includes(url.hostname) && process.env.NODE_ENV !== "production";
    if (!(url.protocol === "https:" || (local && url.protocol === "http:")) || !url.pathname.endsWith(suffix) || url.search || url.hash) throw new Error("invalid");
    return url.pathname.slice(0, -suffix.length);
  } catch {
    throw studioError("CANVA_REDIRECT_URI_INVALID", "Configure uma URL de retorno HTTPS terminando em /api/admin/canva-studio/oauth/callback.", 422);
  }
}

async function begin(config, adminId) {
  if (!config?.enabled || !config.configured) throw studioError("CANVA_NOT_CONFIGURED", "Configure e ative a integração Canva antes de conectar a conta.", 409);
  callbackPrefix(config);
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  await repository.flow(hash(state), encryptSecret(verifier), adminId);
  return authorization(config, state, verifier);
}

async function finish(config, adminId, state, code) {
  callbackPrefix(config);
  if (!state || !code) throw studioError("CANVA_OAUTH_INVALID", "Autorização Canva incompleta.", 400);
  const flow = await repository.takeFlow(hash(state), adminId);
  if (!flow || flow.admin_user_id !== adminId) throw studioError("CANVA_OAUTH_EXPIRED", "Autorização expirada. Tente conectar novamente.", 400);
  const verifier = decryptSecret(flow.verifier);
  if (!verifier) throw studioError("CANVA_OAUTH_EXPIRED", "Autorização expirada. Tente conectar novamente.", 400);
  const tokens = await client(config).exchange({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: config.redirectUri });
  const canva = client(config, async () => tokens.access_token);
  const user = await canva.currentUser();
  const accountId = String(user.team_user?.user_id || "");
  if (!accountId) throw studioError("CANVA_ACCOUNT_UNKNOWN", "O Canva não retornou a identificação da conta. Tente conectar novamente.", 502);
  await repository.saveOAuth({ account_id: accountId, access_token: encryptSecret(tokens.access_token), refresh_token: encryptSecret(tokens.refresh_token), expires_at: new Date(Date.now() + Number(tokens.expires_in) * 1000) });
  return { connected: true, accountId };
}

async function accessToken(config) {
  if (!config?.enabled || !config.configured) throw studioError("CANVA_NOT_CONFIGURED", "Configure a integração Canva em Integrações.", 409);
  try {
    return await repository.withPostgresTransaction(async () => {
    const row = (await repository.queryPostgres("SELECT * FROM canva_studio_oauth WHERE id='primary' FOR UPDATE")).rows[0];
    if (!row) throw studioError("CANVA_RECONNECT_REQUIRED", "Conecte sua conta Canva no Studio.", 409);
    const token = decryptSecret(row.access_token);
    if (token && new Date(row.expires_at).getTime() > Date.now() + 90000) return token;
    const refresh = decryptSecret(row.refresh_token);
    if (!refresh) throw studioError("CANVA_RECONNECT_REQUIRED", "Reconecte sua conta Canva.", 409);
    let next;
    try { next = await client(config).exchange({ grant_type: "refresh_token", refresh_token: refresh }); }
    catch (error) {
      if (error.code === "CANVA_RECONNECT_REQUIRED" || error.statusCode === 403) throw studioError("CANVA_RECONNECT_REQUIRED", "O Canva revogou a conexão. Reconecte a conta.", 409);
      throw error;
    }
    await repository.saveOAuth({ account_id: row.account_id, access_token: encryptSecret(next.access_token), refresh_token: encryptSecret(next.refresh_token), expires_at: new Date(Date.now() + Number(next.expires_in) * 1000) });
    return next.access_token;
    });
  } catch (error) {
    if (error.code === "CANVA_RECONNECT_REQUIRED") await repository.clearOAuth();
    throw error;
  }
}

async function connection(config) {
  const row = await repository.oauth();
  if (row && config?.enabled && config.configured && new Date(row.expires_at).getTime() <= Date.now() + 90000) {
    try { await accessToken(config); }
    catch (error) {
      if (error.code === "CANVA_RECONNECT_REQUIRED") return { connected: false, accountId: "", expiresAt: null };
      throw error;
    }
    return connection();
  }
  return { connected: Boolean(row), accountId: row?.account_id || "", expiresAt: row?.expires_at || null };
}

async function disconnect() { await repository.clearOAuth(); }

module.exports = { begin, finish, accessToken, connection, disconnect, callbackPrefix };
