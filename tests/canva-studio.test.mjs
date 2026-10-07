import assert from "node:assert/strict";
import test from "node:test";
import planner from "../backend/services/canva-studio/campaignPlanner.js";
import clientModule from "../backend/services/canva-studio/canvaClient.js";
import assets from "../backend/services/canva-studio/assetService.js";
import repository from "../backend/services/canva-studio/studioRepository.js";
import oauth from "../backend/services/canva-studio/oauthService.js";
import campaigns from "../backend/services/canva-studio/campaignService.js";
import integrations from "../backend/services/integrationConfigService.js";
import aiCampaigns from "../backend/services/canva-studio/aiCampaignService.js";
import mcpClient from "../backend/services/canva-studio/mcpClient.js";
import mcpOAuth from "../backend/services/canva-studio/mcpOAuthService.js";

const movie = {
  id: "film-1", title: "Minha Melhor Amiga", genre: ["Romance", "Comédia"], status: "now_playing",
  posterUrl: "/uploads/film/poster.jpg", backdropUrl: "/uploads/film/backdrop.jpg",
  artworkMetadata: { titleLockupUrl: "/uploads/film/lockup.png" },
  sessions: [
    { id: "late", date: "2026-10-09", time: "19:00" },
    { id: "first", date: "2026-10-08", time: "9:30" }
  ]
};
const dataset = { artwork: { type: "image" }, title: { type: "text" }, status: { type: "text" }, cinemaLogo: { type: "image" } };

test("Canva IA usa poster, backdrop e assinatura oficial sem exigir template", async () => {
  const previous = repository.insertCampaign;
  let saved;
  repository.insertCampaign = async (value) => { saved = value; return { ...value, status: "queued", stage: "planning", created_at: new Date(), updated_at: new Date() }; };
  try {
    const result = await aiCampaigns.createCampaign({ movies: [movie] }, { kind: "film", movieId: movie.id, type: "campaign", signature: "light", prompt: "Enfatize a amizade." }, "admin-1");
    assert.equal(result.plan.mode, "ai");
    assert.deepEqual(result.plan.sources.map((item) => item.source), [movie.posterUrl, movie.backdropUrl, aiCampaigns.SIGNATURES.light]);
    assert.equal(saved.options.length, 0);
    assert.match(aiCampaigns.brief(result.input, result.plan), /Enfatize a amizade/);
    assert.match(aiCampaigns.brief(result.input, result.plan), /Não invente filmes/);
  } finally { repository.insertCampaign = previous; }
});

test("Canva IA monta programação, bomboniere e promoção a partir do catálogo", () => {
  const db = { movies: [movie], concessions: [{ name: "Combo", imageUrl: "/uploads/combo.png", price: 25, active: true }], promotions: [{ title: "Terça especial", imageUrl: "/uploads/promo.png", description: "Desconto de terça", active: true }] };
  assert.equal(aiCampaigns.sources(db, null, "programming", "auto")[0].source, movie.posterUrl);
  db.concessions[0].id = "combo-1";
  db.promotions[0].id = "promo-1";
  assert.equal(aiCampaigns.sources(db, null, "concessions", "auto", "combo-1")[0].source, "/uploads/combo.png");
  assert.equal(aiCampaigns.sources(db, null, "promotion", "auto", "promo-1")[0].source, "/uploads/promo.png");
  assert.match(aiCampaigns.facts(db, null, "concessions", null, "combo-1")[0], /R\$ 25,00/);
  assert.match(aiCampaigns.facts(db, null, "promotion", null, "promo-1")[0], /Terça especial/);
});

test("outras peças exigem direção escrita e preservam assinatura", async () => {
  await assert.rejects(aiCampaigns.createCampaign({ movies: [] }, { kind: "other" }, "admin-1"), { code: "STUDIO_AI_PROMPT_REQUIRED" });
  assert.deepEqual(aiCampaigns.sources({}, null, "other", "dark").map((item) => item.source), [aiCampaigns.SIGNATURES.dark]);
});

test("Canva MCP preserva candidatos para revisão antes de salvar", () => {
  const result = mcpClient.candidatesFrom({ job: { id: "job-1", result: { generated_designs: [{ candidate_id: "dg-1", url: "https://www.canva.com/d/1", thumbnails: [{ url: "https://design.canva.ai/1" }] }] } } });
  assert.equal(result.jobId, "job-1");
  assert.deepEqual(result.candidates, [{ candidateId: "dg-1", previewUrl: "https://design.canva.ai/1", viewUrl: "https://www.canva.com/d/1" }]);
  assert.equal(mcpOAuth.redirectUri({ redirectUri: "https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/oauth/callback" }), "https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/mcp/callback");
});

test("OAuth MCP usa PKCE e não expõe o segredo na URL", async () => {
  const previous = repository.flow;
  let stored;
  repository.flow = async (...args) => { stored = args; };
  try {
    const url = new URL(await mcpOAuth.begin({ enabled: true, configured: true, clientId: "client-id", clientSecret: "private-secret", redirectUri: "https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/oauth/callback" }, "admin-1"));
    assert.equal(url.origin, "https://mcp.canva.com");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("resource"), "https://mcp.canva.com/mcp");
    assert.ok(url.searchParams.get("state"));
    assert.ok(stored[1]);
    assert.doesNotMatch(url.href, /private-secret/);
  } finally { repository.flow = previous; }
});

test("campanha IA espera escolha humana e salva apenas o candidato selecionado", async () => {
  const row = { id: "campaign-ai", movie_title: movie.title, campaign_type: "campaign", input: { mode: "ai", kind: "film" }, plan: { mode: "ai", kind: "film", sources: [{ role: "Pôster oficial do filme", source: movie.posterUrl }], assetIds: { 0: "asset-1" }, facts: [movie.title] }, options: [], status: "queued", stage: "planning" };
  const previous = { campaign: repository.campaign, claimCampaign: repository.claimCampaign, claimCandidate: repository.claimCandidate, updateCampaign: repository.updateCampaign, connection: oauth.connection, accessToken: mcpOAuth.accessToken, generate: mcpClient.generate, materialize: mcpClient.materialize };
  repository.campaign = async () => row;
  repository.claimCampaign = async () => { row.status = "processing"; return row; };
  repository.claimCandidate = async (_id, options) => { row.options = options; row.stage = "selection_pending"; return row; };
  repository.updateCampaign = async (_id, patch) => Object.assign(row, patch);
  oauth.connection = async () => ({ connected: true, accountId: "canva-1" });
  mcpOAuth.accessToken = async () => "token";
  mcpClient.generate = async () => ({ jobId: "job-1", candidates: [{ candidateId: "dg-1", previewUrl: "https://design.canva.ai/1", viewUrl: "https://www.canva.com/d/1" }] });
  mcpClient.materialize = async () => ({ id: "design-1", editUrl: "https://www.canva.com/design/1/edit", previewUrl: "" });
  try {
    const review = await aiCampaigns.advanceCampaign(row.id, {});
    assert.equal(review.stage, "review");
    assert.equal(review.status, "processing");
    assert.equal(review.options[0].status, "candidate");
    const selected = await aiCampaigns.selectCandidate(row.id, "dg-1", {});
    assert.equal(selected.status, "completed");
    assert.equal(selected.options[0].designId, "design-1");
  } finally {
    Object.assign(repository, { campaign: previous.campaign, claimCampaign: previous.claimCampaign, claimCandidate: previous.claimCandidate, updateCampaign: previous.updateCampaign });
    oauth.connection = previous.connection;
    mcpOAuth.accessToken = previous.accessToken;
    mcpClient.generate = previous.generate;
    mcpClient.materialize = previous.materialize;
  }
});
function template(id, family, profiles = ["romantic-editorial"]) {
  return { id, canva_template_id: `DAV${id}`, name: family, active: true, validation: { valid: true }, dataset,
    metadata: { family, profiles, orientation: "portrait", campaignTypes: ["teaser", "campaign", "session"], titleCapacity: "medium", informationCapacity: "medium" } };
}

test("Content Reducer reduz teaser e ordena sessões sem redundância", () => {
  const teaser = planner.reduceContent(movie, { type: "teaser" });
  assert.deepEqual(Object.keys(teaser.content).sort(), ["status", "title"]);
  const session = planner.reduceContent(movie, { type: "session", sessionId: "first" });
  assert.equal(session.content.time, "09:30");
  assert.equal(session.content.session, "QUI • 08/10 • 09:30");
  assert.equal(session.content.status, "EM CARTAZ");
  assert.equal(planner.reduceContent(movie, { type: "schedule" }).scheduled[0].id, "first");
  assert.throws(() => planner.reduceContent(movie, { type: "session", sessionId: "absent" }), { code: "STUDIO_SESSION_REQUIRED" });
});

test("Campaign Director escolhe perfil sem depender do nome e preserva lockup", () => {
  const reduced = planner.reduceContent(movie, { type: "campaign" });
  const direction = planner.directCampaign(movie, reduced, { orientation: "portrait", subjectSide: "right" });
  assert.equal(direction.profile, "romantic-editorial");
  assert.equal(direction.titleMode, "hybrid");
  assert.equal(direction.subjectSide, "right");
  assert.equal(planner.directCampaign({ ...movie, title: "Outro Filme", genre: ["Terror"] }, reduced).profile, "horror-gritty");
});

test("validação de dataset reconhece imagens alternativas e recusa campos incorretos", () => {
  assert.equal(planner.validateTemplateDataset({ metadata: {} }, { poster: { type: "image" }, titleLockup: { type: "image" } }).valid, true);
  const result = planner.validateTemplateDataset({ metadata: { supportsSession: true } }, { poster: { type: "text" }, unknown: { type: "image" } });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Tipo incorreto/);
  assert.match(result.errors.join(" "), /Campo não reconhecido/);
  assert.equal(planner.validateTemplateDataset({ metadata: { campaignTypes: ["session"] } }, dataset).valid, false);
});

test("Template Selector favorece compatibilidade e diversidade", () => {
  const reduced = planner.reduceContent(movie, { type: "campaign" });
  const direction = planner.directCampaign(movie, reduced, { orientation: "portrait" });
  const picks = planner.selectTemplates([template("hero-1", "hero"), template("hero-2", "hero"), template("editorial", "editorial"), template("clean", "clean")], direction, reduced, 3);
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map((item) => item.template.metadata.family)).size, 3);
  assert.deepEqual(planner.buildAutofillData(template("hero-3", "hero"), reduced.content, { artwork: "asset-1", cinemaLogo: "asset-2" }).artwork, { type: "image", asset_id: "asset-1" });
  assert.throws(() => planner.buildAutofillData(template("hero-4", "hero"), reduced.content, {}), { code: "STUDIO_ARTWORK_MISSING" });
});

test("Canva Client envia payloads oficiais e mapeia falhas sem vazar tokens", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ job: { id: "job-1" } }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  const canva = clientModule.createCanvaClient({ config: { clientId: "id", clientSecret: "secret" }, tokenProvider: async () => "private-token", fetchImpl: fakeFetch });
  await canva.createAutofill("DAV1", { title: { type: "text", text: "Filme" } });
  assert.equal(calls[0].url, "https://api.canva.com/rest/v1/autofills");
  assert.deepEqual(JSON.parse(calls[0].options.body), { brand_template_id: "DAV1", data: { title: { type: "text", text: "Filme" } }, type: "create_from_brand_template" });
  await canva.createExport("design-1", "png");
  assert.equal(calls[1].url, "https://api.canva.com/rest/v1/exports");
  assert.equal(clientModule.mapCanvaError(429, {}).code, "CANVA_RATE_LIMIT");
  assert.doesNotMatch(clientModule.mapCanvaError(401, { message: "private-token" }).message, /private-token/);
  const url = new URL(clientModule.authorization({ clientId: "id", redirectUri: "https://example.com/callback" }, "state", "verifier"));
  assert.equal(url.searchParams.get("code_challenge_method"), "s256");
  assert.equal(url.searchParams.get("state"), "state");
  assert.deepEqual(url.searchParams.get("scope").split(" "), ["asset:write", "brandtemplate:content:read", "design:content:read", "design:content:write", "design:meta:read"]);
  assert.ok(!url.href.includes("verifier"));
});

test("Asset cache reutiliza o ID Canva sem novo upload", async () => {
  const previous = repository.cachedAsset;
  repository.cachedAsset = async () => ({ canva_asset_id: "canva-asset-1" });
  try {
    const result = await assets.ensureAsset({ createUpload: () => { throw new Error("upload desnecessário"); } }, "account-1", "/images/logo-display.webp", "logo", { allowSmall: true });
    assert.equal(result.id, "canva-asset-1");
    assert.equal(result.status, "ready");
  } finally { repository.cachedAsset = previous; }
});

test("Campanha persiste plano e três alternativas antes dos jobs remotos", async () => {
  const previous = { templates: repository.templates, insertCampaign: repository.insertCampaign };
  let saved;
  repository.templates = async () => [template("hero-1", "hero"), template("editorial", "editorial"), template("clean", "clean")];
  repository.insertCampaign = async (value) => { saved = value; return { ...value, status: "queued", stage: "planning", created_at: new Date(), updated_at: new Date() }; };
  try {
    const result = await campaigns.createCampaign({ movies: [movie] }, { movieId: movie.id, type: "campaign", requestKey: "request-key-123456" }, "admin-1");
    assert.equal(result.options.length, 3);
    assert.equal(result.plan.direction.titleMode, "hybrid");
    assert.equal(saved.request_key, "request-key-123456");
    assert.equal(saved.movie_id, movie.id);
  } finally { Object.assign(repository, previous); }
});

test("Autofill assíncrono grava o design no histórico", async () => {
  const previous = { claimCampaign: repository.claimCampaign, updateCampaign: repository.updateCampaign, accessToken: oauth.accessToken };
  const previousFetch = global.fetch;
  const row = { id: "campaign-1", movie_id: movie.id, movie_title: movie.title, campaign_type: "campaign", input: {}, plan: {}, options: [{ templateId: "hero-1", status: "autofill_pending", jobId: "job-1", exports: {} }], status: "processing", stage: "autofill_wait" };
  repository.claimCampaign = async () => row;
  repository.updateCampaign = async (_id, patch) => Object.assign(row, patch);
  oauth.accessToken = async () => "test-token";
  global.fetch = async () => new Response(JSON.stringify({ job: { id: "job-1", status: "success", result: { design: { id: "design-1" } } } }), { status: 200 });
  try {
    const result = await campaigns.advanceCampaign(row.id, { enabled: true, configured: true });
    assert.equal(result.status, "completed");
    assert.equal(result.options[0].designId, "design-1");
  } finally { Object.assign(repository, { claimCampaign: previous.claimCampaign, updateCampaign: previous.updateCampaign }); oauth.accessToken = previous.accessToken; global.fetch = previousFetch; }
});

test("OAuth usa estado de uso único e guarda tokens criptografados", async () => {
  const previous = { flow: repository.flow, takeFlow: repository.takeFlow, saveOAuth: repository.saveOAuth };
  const oldKey = process.env.INTEGRATION_SECRET_KEY;
  const oldFetch = global.fetch;
  process.env.INTEGRATION_SECRET_KEY = "canva-studio-test-encryption-key";
  let savedFlow;
  let savedTokens;
  repository.flow = async (stateHash, verifier, adminId) => { savedFlow = { stateHash, verifier, adminId }; };
  repository.takeFlow = async (stateHash, adminId) => stateHash === savedFlow.stateHash && adminId === savedFlow.adminId ? { verifier: savedFlow.verifier, admin_user_id: savedFlow.adminId } : null;
  repository.saveOAuth = async (value) => { savedTokens = value; return value; };
  global.fetch = async (url, options) => {
    if (url.endsWith("/oauth/token")) {
      assert.equal(options.body.get("grant_type"), "authorization_code");
      assert.ok(options.body.get("code_verifier"));
      return new Response(JSON.stringify({ access_token: "access-private", refresh_token: "refresh-private", expires_in: 14400 }), { status: 200 });
    }
    return new Response(JSON.stringify({ team_user: { user_id: "canva-user-1", team_id: "canva-team-1" } }), { status: 200 });
  };
  try {
    const config = { enabled: true, configured: true, clientId: "id", clientSecret: "secret", redirectUri: "https://example.com/projects/cinecruzeiro/api/admin/canva-studio/oauth/callback" };
    const url = new URL(await oauth.begin(config, "admin-1"));
    assert.equal(oauth.callbackPrefix(config), "/projects/cinecruzeiro");
    const result = await oauth.finish(config, "admin-1", url.searchParams.get("state"), "code-1");
    assert.equal(result.accountId, "canva-user-1");
    assert.equal(integrations.decryptSecret(savedTokens.access_token), "access-private");
    assert.equal(integrations.decryptSecret(savedTokens.refresh_token), "refresh-private");
    assert.doesNotMatch(JSON.stringify(savedTokens), /access-private|refresh-private/);
    await assert.rejects(oauth.finish(config, "wrong-admin", url.searchParams.get("state"), "code-1"), { code: "CANVA_OAUTH_EXPIRED" });
  } finally {
    Object.assign(repository, previous);
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.INTEGRATION_SECRET_KEY; else process.env.INTEGRATION_SECRET_KEY = oldKey;
  }
});

test("duplicação cria nova campanha e aceita outra sessão", async () => {
  const previous = { campaign: repository.campaign, templates: repository.templates, insertCampaign: repository.insertCampaign };
  repository.campaign = async () => ({ id: "source-campaign", movie_id: movie.id, input: { type: "session", sessionId: "late" } });
  repository.templates = async () => [template("hero-1", "hero"), template("editorial", "editorial")].map((item) => ({ ...item, dataset: { ...item.dataset, session: { type: "text" } } }));
  let saved;
  repository.insertCampaign = async (value) => { saved = value; return { ...value, status: "queued", stage: "planning" }; };
  try {
    const result = await campaigns.duplicateCampaign({ movies: [movie] }, "source-campaign", { sessionId: "first" }, "admin-1");
    assert.equal(result.input.sessionId, "first");
    assert.equal(result.plan.reduced.content.time, "09:30");
    assert.ok(saved.request_key);
  } finally { Object.assign(repository, previous); }
});

test("upload falho informa o erro sem criar Autofill", async () => {
  const old = repository.cachedAsset;
  repository.cachedAsset = async () => ({ upload_job_id: "pending-job" });
  try {
    await assert.rejects(assets.ensureAsset({ uploadJob: async () => ({ job: { status: "failed", error: { message: "Formato recusado" } } }) }, "account-1", "/images/logo-display.webp", "logo", { allowSmall: true }), { code: "STUDIO_ASSET_UPLOAD_FAILED" });
  } finally { repository.cachedAsset = old; }
});

test("Autofill com resposta incerta não é reenviado automaticamente", async () => {
  const previous = { claimCampaign: repository.claimCampaign, updateCampaign: repository.updateCampaign, connection: oauth.connection, accessToken: oauth.accessToken };
  const previousFetch = global.fetch;
  const row = { id: "campaign-uncertain", movie_title: movie.title, campaign_type: "campaign", input: { sources: { artwork: movie.posterUrl } }, plan: { reduced: planner.reduceContent(movie, { type: "campaign" }) }, options: [{ templateId: "hero-1", canvaTemplateId: "DAVhero1", status: "queued", dataset: { artwork: { type: "image" }, title: { type: "text" } }, metadata: {}, assetIds: { artwork: "asset-1" } }], status: "processing", stage: "assets" };
  repository.claimCampaign = async () => row;
  repository.updateCampaign = async (_id, patch) => Object.assign(row, patch);
  oauth.connection = async () => ({ connected: true, accountId: "account-1" });
  oauth.accessToken = async () => "test-token";
  let remoteCalls = 0;
  global.fetch = async () => { remoteCalls++; throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); };
  try {
    const first = await campaigns.advanceCampaign(row.id, { enabled: true, configured: true });
    assert.equal(first.options[0].status, "failed");
    assert.equal(first.options[0].error.code, "STUDIO_REMOTE_OUTCOME_UNKNOWN");
    const second = await campaigns.advanceCampaign(row.id, { enabled: true, configured: true });
    assert.equal(second.status, "failed");
    assert.equal(remoteCalls, 1);
  } finally {
    Object.assign(repository, { claimCampaign: previous.claimCampaign, updateCampaign: previous.updateCampaign });
    oauth.connection = previous.connection; oauth.accessToken = previous.accessToken; global.fetch = previousFetch;
  }
});

test("refresh token é rotacionado antes de expirar", async () => {
  const oldKey = process.env.INTEGRATION_SECRET_KEY;
  const oldFetch = global.fetch;
  const previous = { withPostgresTransaction: repository.withPostgresTransaction, queryPostgres: repository.queryPostgres, saveOAuth: repository.saveOAuth };
  process.env.INTEGRATION_SECRET_KEY = "canva-studio-refresh-test-key";
  let saved;
  repository.withPostgresTransaction = async (callback) => callback();
  repository.queryPostgres = async () => ({ rows: [{ account_id: "account-1", access_token: integrations.encryptSecret("old-access"), refresh_token: integrations.encryptSecret("old-refresh"), expires_at: new Date(0) }] });
  repository.saveOAuth = async (value) => { saved = value; };
  global.fetch = async (_url, options) => {
    assert.equal(options.body.get("refresh_token"), "old-refresh");
    return new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 14400 }), { status: 200 });
  };
  try {
    const token = await oauth.accessToken({ enabled: true, configured: true, clientId: "id", clientSecret: "secret" });
    assert.equal(token, "new-access");
    assert.equal(integrations.decryptSecret(saved.refresh_token), "new-refresh");
    assert.equal(saved.account_id, "account-1");
  } finally {
    Object.assign(repository, previous); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.INTEGRATION_SECRET_KEY; else process.env.INTEGRATION_SECRET_KEY = oldKey;
  }
});

test("refresh revogado limpa a conexão e pede nova autorização", async () => {
  const oldKey = process.env.INTEGRATION_SECRET_KEY;
  const oldFetch = global.fetch;
  const previous = { oauth: repository.oauth, withPostgresTransaction: repository.withPostgresTransaction, queryPostgres: repository.queryPostgres, clearOAuth: repository.clearOAuth };
  process.env.INTEGRATION_SECRET_KEY = "canva-studio-revoked-test-key";
  let row = { account_id: "account-1", access_token: integrations.encryptSecret("old-access"), refresh_token: integrations.encryptSecret("revoked-refresh"), expires_at: new Date(0) };
  repository.oauth = async () => row;
  repository.withPostgresTransaction = async (callback) => callback();
  repository.queryPostgres = async () => ({ rows: row ? [row] : [] });
  repository.clearOAuth = async () => { row = null; };
  global.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  try {
    const result = await oauth.connection({ enabled: true, configured: true, clientId: "id", clientSecret: "secret" });
    assert.equal(result.connected, false);
    assert.equal(row, null);
  } finally {
    Object.assign(repository, previous); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.INTEGRATION_SECRET_KEY; else process.env.INTEGRATION_SECRET_KEY = oldKey;
  }
});

test("exportação assíncrona retorna URL somente após sucesso do job", async () => {
  const previous = { campaign: repository.campaign, updateCampaign: repository.updateCampaign, accessToken: oauth.accessToken };
  const oldFetch = global.fetch;
  const row = { id: "campaign-1", options: [{ templateId: "hero-1", designId: "design-1", exports: {} }] };
  repository.campaign = async () => row;
  repository.updateCampaign = async (_id, patch) => Object.assign(row, patch);
  oauth.accessToken = async () => "test-token";
  global.fetch = async (url, options) => new Response(JSON.stringify(options.method === "POST" ? { job: { id: "export-job-1" } } : { job: { id: "export-job-1", status: "success", urls: ["https://document-export.canva.com/output.png"] } }), { status: 200 });
  try {
    const first = await campaigns.exportDesign(row.id, "hero-1", "png", { enabled: true, configured: true });
    assert.equal(first.status, "in_progress");
    const second = await campaigns.exportDesign(row.id, "hero-1", "png", { enabled: true, configured: true });
    assert.equal(second.status, "success");
    assert.equal(second.urls.length, 1);
  } finally { Object.assign(repository, { campaign: previous.campaign, updateCampaign: previous.updateCampaign }); oauth.accessToken = previous.accessToken; global.fetch = oldFetch; }
});
