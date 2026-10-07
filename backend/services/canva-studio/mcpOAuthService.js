const crypto = require("crypto");
const repository = require("./studioRepository");
const { callbackPrefix } = require("./oauthService");
const { encryptSecret, decryptSecret } = require("../integrationConfigService");
const { studioError } = require("./campaignPlanner");

const MCP_RESOURCE = "https://mcp.canva.com/mcp";
const AUTHORIZE_URL = "https://mcp.canva.com/authorize";
const TOKEN_URL = "https://mcp.canva.com/token";

function redirectUri(config) {
  callbackPrefix(config);
  return config.redirectUri.replace(/\/oauth\/callback$/, "/mcp/callback");
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function challenge(verifier) { return crypto.createHash("sha256").update(verifier).digest("base64url"); }
function validConfig(config) {
  if (!config?.enabled || !config.configured) throw studioError("CANVA_NOT_CONFIGURED", "Configure e ative a integração Canva antes de conectar a IA.", 409);
  redirectUri(config);
}
async function exchange(config, body, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(20000)
    });
  } catch { throw studioError("CANVA_MCP_UNAVAILABLE", "Não foi possível comunicar com o Canva IA. Tente novamente.", 503); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw studioError("CANVA_MCP_AUTH_FAILED", "O Canva IA não concluiu a autorização. Confira se Canva MCP está ativo no app e a URL de retorno cadastrada.", 409);
  return payload;
}
async function begin(config, adminId) {
  validConfig(config);
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  await repository.flow(hash(state), encryptSecret(verifier), adminId);
  const url = new URL(AUTHORIZE_URL);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: config.clientId, redirect_uri: redirectUri(config), state, code_challenge: challenge(verifier), code_challenge_method: "S256", resource: MCP_RESOURCE })) url.searchParams.set(key, value);
  return url.toString();
}
async function finish(config, adminId, state, code) {
  validConfig(config);
  if (!state || !code) throw studioError("CANVA_MCP_OAUTH_INVALID", "Autorização Canva IA incompleta.", 400);
  const flow = await repository.takeFlow(hash(state), adminId);
  if (!flow) throw studioError("CANVA_MCP_OAUTH_EXPIRED", "Autorização Canva IA expirada. Conecte novamente.", 400);
  const verifier = decryptSecret(flow.verifier);
  if (!verifier) throw studioError("CANVA_MCP_OAUTH_EXPIRED", "Autorização Canva IA expirada. Conecte novamente.", 400);
  const tokens = await exchange(config, { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri(config), resource: MCP_RESOURCE });
  if (!tokens.refresh_token) throw studioError("CANVA_MCP_AUTH_FAILED", "O Canva IA não forneceu um token renovável. Conecte novamente.", 409);
  await repository.saveMcpOAuth({ access_token: encryptSecret(tokens.access_token), refresh_token: encryptSecret(tokens.refresh_token), expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000) });
  return { connected: true };
}
async function accessToken(config) {
  validConfig(config);
  return repository.withPostgresTransaction(async () => {
    const row = (await repository.queryPostgres("SELECT * FROM canva_studio_mcp_oauth WHERE id='primary' FOR UPDATE")).rows[0];
    if (!row) throw studioError("CANVA_MCP_RECONNECT_REQUIRED", "Conecte o Canva IA no Studio.", 409);
    const token = decryptSecret(row.access_token);
    if (token && new Date(row.expires_at).getTime() > Date.now() + 90000) return token;
    const refresh = decryptSecret(row.refresh_token);
    if (!refresh) throw studioError("CANVA_MCP_RECONNECT_REQUIRED", "Reconecte o Canva IA no Studio.", 409);
    let next;
    try { next = await exchange(config, { grant_type: "refresh_token", refresh_token: refresh, resource: MCP_RESOURCE }); }
    catch (error) {
      if (error.code === "CANVA_MCP_AUTH_FAILED") throw studioError("CANVA_MCP_RECONNECT_REQUIRED", "A conexão com o Canva IA expirou. Reconecte a conta.", 409);
      throw error;
    }
    await repository.saveMcpOAuth({ access_token: encryptSecret(next.access_token), refresh_token: encryptSecret(next.refresh_token || refresh), expires_at: new Date(Date.now() + Number(next.expires_in || 3600) * 1000) });
    return next.access_token;
  });
}
async function connection() { return { connected: Boolean(await repository.mcpOAuth()) }; }
async function disconnect() { await repository.clearMcpOAuth(); }

module.exports = { begin, finish, accessToken, connection, disconnect, redirectUri, MCP_RESOURCE };
