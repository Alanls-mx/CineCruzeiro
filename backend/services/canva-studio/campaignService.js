const crypto = require("crypto");
const repository = require("./studioRepository");
const oauth = require("./oauthService");
const { createCanvaClient } = require("./canvaClient");
const { ensureAsset } = require("./assetService");
const { reduceContent, directCampaign, selectTemplates, buildAutofillData, validateTemplateDataset, studioError } = require("./campaignPlanner");

function canvaClient(config) { return createCanvaClient({ config, tokenProvider: () => oauth.accessToken(config) }); }
function assertId(value) {
  if (!/^[A-Za-z0-9_-]{3,128}$/.test(String(value || ""))) throw studioError("STUDIO_ID_INVALID", "Identificador inválido.", 400);
  return String(value);
}
function selectedImage(movie, field, template) {
  if (field === "cinemaLogo") return "/images/logo-display.webp";
  if (field === "titleLockup") return movie.titleLockupUrl || movie.artworkMetadata?.titleLockupUrl || movie.metadata?.titleLockupUrl || "";
  if (field === "poster") return movie.posterUrl || "";
  if (field === "backdrop") return movie.backdropUrl || "";
  return template.metadata?.orientation === "landscape" ? movie.backdropUrl || movie.posterUrl : movie.posterUrl || movie.backdropUrl;
}
function imageFields(template) { return Object.entries(template.dataset || {}).filter(([, value]) => value.type === "image").map(([key]) => key); }
function publicCampaign(row) {
  if (!row) return null;
  return { id: row.id, movieId: row.movie_id, movieTitle: row.movie_title, type: row.campaign_type, input: row.input, plan: row.plan, options: row.options, status: row.status, stage: row.stage, error: row.error, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function registerTemplate(input) {
  const id = input.id ? assertId(input.id) : crypto.randomUUID();
  const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
  if (!Array.isArray(metadata.campaignTypes) || !metadata.campaignTypes.length) throw studioError("STUDIO_TEMPLATE_CAMPAIGN_TYPES", "Selecione ao menos um tipo de campanha para o template.");
  const canvaId = String(input.canvaTemplateId || "").trim();
  if (!/^[A-Za-z0-9_-]{5,128}$/.test(canvaId)) throw studioError("STUDIO_TEMPLATE_ID_INVALID", "Informe o ID de um Brand Template Canva.");
  const existing = await repository.template(id);
  const sameReference = existing?.canva_template_id === canvaId;
  const dataset = sameReference ? existing.dataset : {};
  const validation = sameReference && Object.keys(dataset).length ? validateTemplateDataset({ metadata }, dataset) : {};
  return repository.saveTemplate({ id, canva_template_id: canvaId, name: String(input.name || "").trim().slice(0, 100) || "Template sem nome", metadata, dataset, validation, active: Boolean(input.active) && Boolean(validation.valid), last_error: validation.errors?.join(" ") || "" });
}

async function validateTemplate(id, config) {
  const template = await repository.template(assertId(id));
  if (!template) throw studioError("STUDIO_TEMPLATE_NOT_FOUND", "Template não encontrado.", 404);
  try {
    const result = await canvaClient(config).templateDataset(template.canva_template_id);
    const dataset = result.dataset || {};
    const validation = validateTemplateDataset(template, dataset);
    return repository.saveTemplate({ ...template, dataset, validation, active: template.active && validation.valid, last_error: validation.errors.join(" ") });
  } catch (error) {
    if (error.code === "CANVA_RECONNECT_REQUIRED") await oauth.disconnect();
    if (error.code?.startsWith("CANVA_") || error.code?.startsWith("STUDIO_")) throw error;
    throw studioError("STUDIO_TEMPLATE_VALIDATION_FAILED", "Não foi possível ler os campos do template no Canva.", 502);
  }
}

async function testTemplateFixture(db, id, input) {
  const template = await repository.template(assertId(id));
  const movie = (db.movies || []).find((item) => item.id === input.movieId);
  if (!template) throw studioError("STUDIO_TEMPLATE_NOT_FOUND", "Template não encontrado.", 404);
  if (!movie) throw studioError("STUDIO_MOVIE_NOT_FOUND", "Selecione um filme cadastrado para testar.", 404);
  const reduced = reduceContent(movie, input);
  const direction = directCampaign(movie, reduced, { orientation: template.metadata?.orientation || "unknown" });
  const missing = imageFields(template).filter((field) => !selectedImage(movie, field, template));
  const compatible = Boolean(template.validation?.valid && template.metadata?.campaignTypes?.includes(reduced.type) && !missing.length && (!template.dataset?.titleLockup || selectedImage(movie, "titleLockup", template) || template.dataset?.title));
  return { compatible, missingAssets: missing, content: reduced.content, direction, templateName: template.name };
}

async function createCampaign(db, input, adminId) {
  const movie = (db.movies || []).find((item) => item.id === input.movieId && !item.deletedAt);
  if (!movie) throw studioError("STUDIO_MOVIE_NOT_FOUND", "Filme não encontrado no catálogo.", 404);
  const reduced = reduceContent(movie, input);
  const direction = directCampaign(movie, reduced, { orientation: movie.backdropUrl ? "landscape" : "portrait" });
  const choices = selectTemplates(await repository.templates(), direction, reduced, 3);
  if (choices.length < 2) throw studioError("STUDIO_TEMPLATES_INSUFFICIENT", "Cadastre e valide pelo menos dois Brand Templates compatíveis com esta campanha.", 409);
  const options = choices.map(({ template, score }) => ({ templateId: template.id, templateName: template.name, canvaTemplateId: template.canva_template_id, metadata: template.metadata, dataset: template.dataset, score, status: "queued", assetIds: {}, jobId: "", designId: "", exports: {} }));
  const sources = Object.fromEntries(["artwork", "poster", "backdrop", "titleLockup", "cinemaLogo"].map((field) => [field, selectedImage(movie, field, choices[0].template)]));
  const requestKey = /^[A-Za-z0-9_-]{12,128}$/.test(String(input.requestKey || "")) ? String(input.requestKey) : crypto.randomUUID();
  const row = await repository.insertCampaign({ id: crypto.randomUUID(), request_key: requestKey, movie_id: movie.id, movie_title: movie.title, campaign_type: reduced.type, input: { type: reduced.type, sessionId: input.sessionId || "", website: input.website || "", tagline: input.tagline || "", sources }, plan: { reduced, direction }, options, created_by: adminId });
  return publicCampaign(row);
}

async function duplicateCampaign(db, id, overrides, adminId) {
  const source = await repository.campaign(assertId(id));
  if (!source) throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha não encontrada.", 404);
  return createCampaign(db, { ...source.input, ...overrides, movieId: overrides.movieId || source.movie_id, requestKey: crypto.randomUUID() }, adminId);
}

async function advanceCampaign(id, config) {
  const claimed = await repository.claimCampaign(assertId(id));
  if (!claimed) {
    const current = await repository.campaign(id);
    if (!current) throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha não encontrada.", 404);
    return publicCampaign(current);
  }
  const options = claimed.options;
  const active = options.find((option) => !["completed", "failed"].includes(option.status));
  if (!active) return publicCampaign(await repository.updateCampaign(id, { status: options.some((option) => option.status === "completed") ? "completed" : "failed", stage: "complete", lease_until: null }));
  const canva = canvaClient(config);
  try {
    if (active.status === "queued") {
      const connection = await oauth.connection(config);
      if (!connection.connected) throw studioError("CANVA_RECONNECT_REQUIRED", "Conecte sua conta Canva no Studio.", 409);
      const field = imageFields(active).find((key) => !active.assetIds[key] && claimed.input.sources[key]);
      if (field) {
        const source = field === "artwork"
          ? active.metadata?.orientation === "landscape" ? claimed.input.sources.backdrop || claimed.input.sources.poster : claimed.input.sources.poster || claimed.input.sources.backdrop
          : claimed.input.sources[field];
        const asset = await ensureAsset(canva, connection.accountId, source, `${claimed.movie_title} ${field}`.slice(0, 50), { allowSmall: ["cinemaLogo", "titleLockup"].includes(field) });
        if (asset.status === "ready") active.assetIds[field] = asset.id;
        return publicCampaign(await repository.updateCampaign(id, { options, stage: asset.status === "waiting" ? "upload_wait" : "assets", lease_until: null }));
      }
      const data = buildAutofillData(active, claimed.plan.reduced.content, active.assetIds);
      if (!Object.keys(data).length) throw studioError("STUDIO_TEMPLATE_EMPTY", "O template não recebeu dados para Autofill.");
      active.status = "submission_pending";
      await repository.updateCampaign(id, { options, stage: "autofill_submit" });
      const response = await canva.createAutofill(active.canvaTemplateId, data);
      if (!response.job?.id) throw studioError("STUDIO_AUTOFILL_NO_JOB", "O Canva não retornou o job de Autofill.", 502);
      active.jobId = response.job.id;
      active.status = "autofill_pending";
      active.startedAt = new Date().toISOString();
      return publicCampaign(await repository.updateCampaign(id, { options, stage: "autofill_wait", lease_until: null }));
    }
    if (active.status === "autofill_pending") {
      const response = await canva.autofillJob(active.jobId);
      if (response.job?.status === "success" && response.job.result?.design?.id) {
        active.designId = response.job.result.design.id;
        active.status = "completed";
        active.completedAt = new Date().toISOString();
      } else if (response.job?.status === "failed") {
        active.status = "failed";
        active.error = { code: response.job.error?.code || "STUDIO_AUTOFILL_FAILED", message: response.job.error?.message || "Autofill falhou no Canva." };
      }
      const done = options.every((option) => ["completed", "failed"].includes(option.status));
      return publicCampaign(await repository.updateCampaign(id, { options, status: done ? options.some((option) => option.status === "completed") ? "completed" : "failed" : "processing", stage: done ? "complete" : "autofill_wait", lease_until: null }));
    }
    if (active.status === "submission_pending") {
      active.status = "failed";
      active.error = { code: "STUDIO_REMOTE_OUTCOME_UNKNOWN", message: "O resultado da criação no Canva é incerto. Verifique sua conta antes de repetir." };
      return publicCampaign(await repository.updateCampaign(id, { options, stage: "option_failed", error: active.error, lease_until: null }));
    }
    throw studioError("STUDIO_STATE_INVALID", "Estado da campanha inválido.", 409);
  } catch (error) {
    if (error.code === "CANVA_RECONNECT_REQUIRED") await oauth.disconnect();
    if (active.status === "submission_pending") {
      active.status = "failed";
      active.error = { code: "STUDIO_REMOTE_OUTCOME_UNKNOWN", message: "Não foi possível confirmar a criação no Canva. Verifique sua conta antes de repetir." };
      return publicCampaign(await repository.updateCampaign(id, { options, stage: "option_failed", error: active.error, lease_until: null }));
    }
    if (["CANVA_RATE_LIMIT", "CANVA_UNAVAILABLE", "CANVA_TIMEOUT", "CANVA_NETWORK_ERROR", "CANVA_RECONNECT_REQUIRED", "CANVA_NOT_CONFIGURED"].includes(error.code)) {
      await repository.updateCampaign(id, { stage: error.code, error: { code: error.code, message: error.message }, lease_until: null });
      throw error;
    }
    active.status = "failed";
    active.error = { code: error.code || "STUDIO_OPTION_FAILED", message: error.expose ? error.message : "Não foi possível criar esta alternativa." };
    const done = options.every((option) => ["completed", "failed"].includes(option.status));
    return publicCampaign(await repository.updateCampaign(id, { options, status: done ? options.some((option) => option.status === "completed") ? "completed" : "failed" : "processing", stage: done ? "complete" : "option_failed", error: active.error, lease_until: null }));
  }
}

async function campaignDetail(id, config) {
  const row = await repository.campaign(assertId(id));
  if (!row) throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha não encontrada.", 404);
  const result = publicCampaign(row);
  if (result.options.some((option) => option.designId) && config?.enabled && config.configured) {
    const canva = canvaClient(config);
    for (const option of result.options.filter((item) => item.designId)) {
      try {
        const design = (await canva.design(option.designId)).design;
        option.previewUrl = design?.thumbnail?.url || option.previewUrl || "";
        option.editUrl = design?.urls?.edit_url || option.editUrl || "";
      } catch { /* Retain the URL returned when the candidate was saved. */ }
    }
  }
  return result;
}

async function exportDesign(campaignId, optionId, format, config) {
  if (!["png", "jpg"].includes(format)) throw studioError("STUDIO_EXPORT_FORMAT_INVALID", "Escolha PNG ou JPG.");
  const row = await repository.campaign(assertId(campaignId));
  if (!row) throw studioError("STUDIO_CAMPAIGN_NOT_FOUND", "Campanha não encontrada.", 404);
  const option = row.options.find((item) => item.templateId === assertId(optionId) && item.designId);
  if (!option) throw studioError("STUDIO_DESIGN_NOT_FOUND", "Design ainda não disponível.", 404);
  const canva = canvaClient(config);
  let exportRecord = option.exports?.[format];
  if (!exportRecord || exportRecord.status === "failed" || exportRecord.status === "success") {
    const result = await canva.createExport(option.designId, format);
    if (!result.job?.id) throw studioError("STUDIO_EXPORT_NO_JOB", "O Canva não retornou o job de exportação.", 502);
    exportRecord = { jobId: result.job.id, status: "in_progress", startedAt: new Date().toISOString() };
  } else {
    const result = await canva.exportJob(exportRecord.jobId);
    exportRecord = { ...exportRecord, status: result.job?.status || "in_progress", urls: result.job?.urls || [], error: result.job?.error || null };
  }
  option.exports ||= {};
  option.exports[format] = exportRecord;
  await repository.updateCampaign(row.id, { options: row.options });
  return exportRecord;
}

module.exports = { publicCampaign, registerTemplate, validateTemplate, testTemplateFixture, createCampaign, duplicateCampaign, advanceCampaign, campaignDetail, exportDesign };
