const crypto = require("crypto");
const repository = require("./studioRepository");
const oauth = require("./oauthService");
const mcpOAuth = require("./mcpOAuthService");
const mcp = require("./mcpClient");
const { createCanvaClient } = require("./canvaClient");
const { ensureAsset } = require("./assetService");
const { studioError, reduceContent } = require("./campaignPlanner");
const { publicCampaign } = require("./campaignService");

const KINDS = new Set(["film", "programming", "concessions", "promotion", "other"]);
const SIGNATURES = { light: "/images/cine-cruzeiro-signature-light.png", dark: "/images/cine-cruzeiro-signature-dark.png" };
function id(value) {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(String(value || ""))) throw studioError("STUDIO_ID_INVALID", "Identificador inválido.", 400);
  return String(value);
}
function clean(value, limit = 500) { return String(value || "").trim().slice(0, limit); }
function sources(db, movie, kind, signature, itemId = "") {
  const assets = [];
  if (kind === "film") {
    if (movie.posterUrl) assets.push({ role: "Pôster oficial do filme", source: movie.posterUrl });
    if (movie.backdropUrl) assets.push({ role: "Backdrop oficial do filme", source: movie.backdropUrl });
  } else if (kind === "programming") {
    for (const item of (db.movies || []).filter((entry) => !entry.deletedAt && entry.posterUrl && (entry.sessions || []).length).slice(0, 4)) assets.push({ role: `Pôster oficial de ${clean(item.title, 100)}`, source: item.posterUrl });
  } else if (kind === "concessions") {
    const item = (db.concessions || []).find((entry) => entry.id === itemId && entry.active !== false);
    if (item?.imageUrl) assets.push({ role: `Produto ${clean(item.name, 100)}`, source: item.imageUrl });
  } else if (kind === "promotion") {
    const item = (db.promotions || []).find((entry) => entry.id === itemId && entry.active !== false && !entry.archivedAt);
    if (item?.imageUrl) assets.push({ role: `Promoção ${clean(item.title || item.name, 100)}`, source: item.imageUrl });
  }
  const genre = Array.isArray(movie?.genre) ? movie.genre.join(" ") : String(movie?.genre || "");
  const variant = signature === "dark" ? "dark" : signature === "light" ? "light" : /romance|comédia|família|infantil/i.test(genre) ? "dark" : "light";
  assets.push({ role: `Assinatura oficial Cine Cruzeiro, versão ${variant === "light" ? "clara" : "escura"}`, source: SIGNATURES[variant] });
  return assets;
}
function facts(db, movie, kind, reduced, itemId = "") {
  if (kind === "film") return [
    `Filme: ${clean(movie.title, 150)}`,
    `Status: ${clean(reduced.content.status, 50)}`,
    reduced.content.session ? `Sessão: ${clean(reduced.content.session, 150)}` : "",
    reduced.content.tagline ? `Chamada: ${clean(reduced.content.tagline, 200)}` : ""
  ].filter(Boolean);
  if (kind === "programming") return (db.movies || []).filter((item) => !item.deletedAt && (item.sessions || []).length).slice(0, 4)
    .map((item) => `${clean(item.title, 100)}: ${(item.sessions || []).slice(0, 2).map((s) => `${clean(s.date || s.startsAt, 20)} ${clean(s.time || s.timeLabel || String(s.startsAt || "").slice(11, 16), 10)}`).join(", ")}`);
  if (kind === "concessions") return (db.concessions || []).filter((item) => item.id === itemId && item.active !== false)
    .map((item) => `${clean(item.name, 100)}: ${clean(item.description, 150)}${Number.isFinite(Number(item.price)) ? `, R$ ${Number(item.price).toFixed(2).replace(".", ",")}` : ""}`);
  if (kind === "other") return ["Peça institucional do Cine Cruzeiro. Não há fatos comerciais cadastrados para esta peça."];
  return (db.promotions || []).filter((item) => item.id === itemId && item.active !== false && !item.archivedAt)
    .map((item) => {
      const discount = item.discountType === "percent" ? `${Number(item.value)}% de desconto` : item.discountType === "fixed_price" ? `Preço R$ ${Number(item.value).toFixed(2).replace(".", ",")}` : `R$ ${Number(item.value).toFixed(2).replace(".", ",")} de desconto`;
      return `${clean(item.title || item.name, 120)}: ${clean(item.description, 200)}. ${discount}${item.couponCode ? `. Cupom ${clean(item.couponCode, 32)}` : ""}${item.endsAt ? `. Válido até ${clean(item.endsAt, 20)}` : ""}`;
    });
}
function brief(input, plan) {
  const label = { film: "filme", programming: "programação de filmes", concessions: "bomboniere", promotion: "promoções", other: "comunicação institucional" }[plan.kind];
  const roles = plan.sources.map((asset, index) => `${index + 1}. ${asset.role}`).join("\n");
  return [
    `Crie um único pôster vertical, editável, para ${label} do Cine Cruzeiro. Use as imagens fornecidas como material obrigatório, não como inspiração descartável.`,
    `Ordem das imagens enviadas:\n${roles}`,
    `Dados confirmados:\n${plan.facts.join("\n") || "Nenhum item específico cadastrado."}`,
    `Direção criativa complementar: ${clean(input.prompt, 1200) || "Campanha cinematográfica clara, legível e contemporânea."}`,
    "Preserve a identidade, as pessoas, o título já presente na arte e a assinatura oficial. Não recrie ou redesenhe o logo. Se não houver foto do produto/oferta, crie apenas imagem conceitual, sem inventar embalagem ou características específicas. Não invente filmes, horários, preços, condições nem informações ausentes. Priorize hierarquia, legibilidade e imagem. Texto em português do Brasil."
  ].join("\n\n").slice(0, 5000);
}
async function createCampaign(db, input, adminId) {
  const kind = KINDS.has(input.kind) ? input.kind : "film";
  if (kind === "other" && !clean(input.prompt, 1200)) throw studioError("STUDIO_AI_PROMPT_REQUIRED", "Descreva a peça que deseja criar.", 422);
  const movie = (db.movies || []).find((item) => item.id === input.movieId && !item.deletedAt);
  if (kind === "film" && !movie) throw studioError("STUDIO_MOVIE_NOT_FOUND", "Selecione um filme para criar o pôster.", 422);
  const reduced = kind === "film" ? reduceContent(movie, { type: input.type || "campaign", sessionId: input.sessionId || "" }) : null;
  const itemId = clean(input.itemId, 128);
  const selectedSources = sources(db, movie, kind, input.signature, itemId);
  const selectedFacts = facts(db, movie, kind, reduced, itemId);
  if (kind === "film" && selectedSources.length < 2) throw studioError("STUDIO_AI_ASSETS_MISSING", "Cadastre pôster ou backdrop para o filme antes de criar com IA.", 422);
  if (!selectedFacts.length) throw studioError("STUDIO_AI_CONTENT_MISSING", "Cadastre itens e informações nesta categoria antes de criar com IA.", 422);
  const plan = { mode: "ai", kind, sources: selectedSources, facts: selectedFacts, assetIds: {} };
  const campaignType = kind === "film" ? reduced.type : kind === "programming" ? "schedule" : "campaign";
  const requestKey = /^[A-Za-z0-9_-]{12,128}$/.test(String(input.requestKey || "")) ? input.requestKey : crypto.randomUUID();
  const row = await repository.insertCampaign({ id: crypto.randomUUID(), request_key: requestKey, movie_id: movie?.id || null, movie_title: movie?.title || ({ programming: "Programação", concessions: "Bomboniere", promotion: "Promoções", other: "Outras peças" }[kind]), campaign_type: campaignType,
    input: { mode: "ai", kind, type: campaignType, movieId: movie?.id || "", itemId, sessionId: input.sessionId || "", prompt: clean(input.prompt, 1200), signature: input.signature || "auto" }, plan, options: [], created_by: adminId });
  return publicCampaign(row);
}
async function advanceCampaign(campaignId, config) {
  const current = await repository.campaign(id(campaignId));
  if (!current) throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha não encontrada.", 404);
  if (["completed", "failed"].includes(current.status)) return publicCampaign(current);
  const claimed = await repository.claimCampaign(id(campaignId));
  if (!claimed) return publicCampaign(await repository.campaign(campaignId));
  if (claimed.plan?.mode !== "ai") throw studioError("STUDIO_STATE_INVALID", "Campanha não pertence ao modo Criar com IA.", 409);
  if (claimed.stage === "review" || claimed.stage === "selection_pending") return publicCampaign(await repository.updateCampaign(campaignId, { status: "processing", lease_until: null }));
  if (claimed.stage === "generation_pending") {
    await repository.updateCampaign(campaignId, { status: "failed", stage: "generation_uncertain", error: { code: "STUDIO_REMOTE_OUTCOME_UNKNOWN", message: "A geração no Canva pode ter sido concluída. Confira sua conta antes de repetir." }, lease_until: null });
    throw studioError("STUDIO_REMOTE_OUTCOME_UNKNOWN", "A geração no Canva pode ter sido concluída. Confira sua conta antes de repetir.", 409);
  }
  const plan = claimed.plan;
  const canva = createCanvaClient({ config, tokenProvider: () => oauth.accessToken(config) });
  let generationStarted = false;
  try {
    const connection = await oauth.connection(config);
    if (!connection.connected) throw studioError("CANVA_RECONNECT_REQUIRED", "Conecte o Canva REST no Studio para enviar as imagens.", 409);
    for (const [index, source] of plan.sources.entries()) {
      if (plan.assetIds[index]) continue;
      const asset = await ensureAsset(canva, connection.accountId, source.source, `${claimed.movie_title} ${source.role}`.slice(0, 50), { allowSmall: source.role.startsWith("Assinatura") });
      if (asset.status === "ready") plan.assetIds[index] = asset.id;
      return publicCampaign(await repository.updateCampaign(campaignId, { plan, stage: asset.status === "waiting" ? "upload_wait" : "assets", lease_until: null }));
    }
    const token = await mcpOAuth.accessToken(config);
    await repository.updateCampaign(campaignId, { stage: "generation_pending", lease_until: null });
    generationStarted = true;
    const result = await mcp.generate(token, brief(claimed.input, plan), plan.sources.map((_, index) => plan.assetIds[index]), `${claimed.movie_title} - Cine Cruzeiro`);
    const options = result.candidates.map((candidate) => ({ templateId: candidate.candidateId, candidateId: candidate.candidateId, jobId: result.jobId, templateName: "Canva IA", status: "candidate", previewUrl: candidate.previewUrl, viewUrl: candidate.viewUrl, designId: "", exports: {} }));
    return publicCampaign(await repository.updateCampaign(campaignId, { options, stage: "review", lease_until: null }));
  } catch (error) {
    if (error.code === "CANVA_MCP_POSTER_UNAVAILABLE") await repository.updateCampaign(campaignId, { stage: "capability_unavailable", status: "failed", error: { code: error.code, message: error.message }, lease_until: null });
    else if (generationStarted) await repository.updateCampaign(campaignId, { stage: "generation_uncertain", status: "failed", error: { code: "STUDIO_REMOTE_OUTCOME_UNKNOWN", message: "O resultado no Canva é incerto. Confira sua conta antes de repetir." }, lease_until: null });
    else if (["CANVA_MCP_RECONNECT_REQUIRED", "CANVA_RECONNECT_REQUIRED", "CANVA_RATE_LIMIT", "CANVA_MCP_UNAVAILABLE"].includes(error.code)) await repository.updateCampaign(campaignId, { stage: error.code, error: { code: error.code, message: error.message }, lease_until: null });
    else await repository.updateCampaign(campaignId, { stage: "preparation_failed", status: "failed", error: { code: error.code || "STUDIO_PREPARATION_FAILED", message: error.expose ? error.message : "Não foi possível preparar as imagens para o Canva." }, lease_until: null });
    throw error;
  }
}
async function selectCandidate(campaignId, candidateId, config) {
  const row = await repository.campaign(id(campaignId));
  if (!row || row.plan?.mode !== "ai") throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha de IA não encontrada.", 404);
  if (row.stage !== "review") throw studioError("STUDIO_AI_NOT_READY", "Aguarde as alternativas antes de escolher.", 409);
  const option = row.options.find((item) => item.candidateId === id(candidateId));
  if (!option) throw studioError("STUDIO_AI_CANDIDATE_NOT_FOUND", "Alternativa não encontrada.", 404);
  const token = await mcpOAuth.accessToken(config);
  option.status = "selection_pending";
  if (!(await repository.claimCandidate(campaignId, row.options))) throw studioError("STUDIO_AI_NOT_READY", "Esta alternativa já está sendo salva. Atualize a campanha.", 409);
  let design;
  try { design = await mcp.materialize(token, option.jobId, option.candidateId); }
  catch (error) {
    if (error.code === "CANVA_MCP_CANDIDATE_UNAVAILABLE") {
      option.status = "candidate";
      await repository.updateCampaign(campaignId, { options: row.options, stage: "review", error: { code: error.code, message: error.message } });
    } else {
      await repository.updateCampaign(campaignId, { status: "failed", stage: "selection_uncertain", error: { code: "STUDIO_REMOTE_OUTCOME_UNKNOWN", message: "O design pode ter sido salvo no Canva. Confira sua conta antes de repetir." } });
    }
    throw error;
  }
  option.designId = design.id;
  option.editUrl = design.editUrl;
  option.previewUrl = design.previewUrl || option.previewUrl;
  option.status = "completed";
  for (const other of row.options) if (other !== option) other.status = "not_selected";
  return publicCampaign(await repository.updateCampaign(campaignId, { options: row.options, status: "completed", stage: "complete" }));
}

module.exports = { KINDS, SIGNATURES, sources, facts, brief, createCampaign, advanceCampaign, selectCandidate };
