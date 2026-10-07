const CAMPAIGN_TYPES = ["teaser", "campaign", "session", "schedule"];
const IMAGE_FIELDS = new Set(["artwork", "poster", "backdrop", "titleLockup", "cinemaLogo"]);
const TEXT_FIELDS = new Set(["title", "tagline", "status", "date", "weekday", "time", "session", "cta", "website"]);
const FIELD_TYPES = Object.fromEntries([
  ...[...IMAGE_FIELDS].map((field) => [field, "image"]),
  ...[...TEXT_FIELDS].map((field) => [field, "text"]),
]);
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function studioError(code, message, statusCode = 422) {
  return Object.assign(new Error(message), { code, statusCode, expose: true });
}

function campaignType(value) {
  const type = String(value || "campaign").toLowerCase();
  if (!CAMPAIGN_TYPES.includes(type)) throw studioError("STUDIO_CAMPAIGN_TYPE_INVALID", "Tipo de campanha inválido.");
  return type;
}

function sessionDate(session) {
  const value = String(session?.date || session?.startsAt || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function sessionTime(session) {
  const direct = String(session?.time || session?.timeLabel || "").match(/\b\d{1,2}:\d{2}\b/);
  if (direct) return direct[0].padStart(5, "0");
  const fromIso = String(session?.startsAt || "").match(/T(\d{2}:\d{2})/);
  return fromIso?.[1] || "";
}

function formatSession(session) {
  const date = sessionDate(session);
  const time = sessionTime(session);
  if (!date || !time) return null;
  return {
    id: String(session.id || ""),
    date: date.toISOString().slice(0, 10),
    weekday: WEEKDAYS[date.getUTCDay()],
    dateLabel: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    time,
  };
}

function reduceContent(movie, input = {}) {
  const type = campaignType(input.type);
  const title = String(movie?.title || "").trim();
  if (!title) throw studioError("STUDIO_MOVIE_REQUIRED", "Selecione um filme cadastrado.");
  const sessions = (movie.sessions || [])
    .filter((session) => !["cancelled", "hidden", "archived"].includes(String(session.status || "").toLowerCase()))
    .map(formatSession).filter(Boolean)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const selected = type === "session" ? sessions.find((session) => session.id === String(input.sessionId || "")) : null;
  if (type === "session" && !selected) throw studioError("STUDIO_SESSION_REQUIRED", "Escolha uma sessão válida deste filme.");
  const scheduled = type === "schedule" ? sessions.slice(0, 4) : [];
  if (type === "schedule" && !scheduled.length) throw studioError("STUDIO_SCHEDULE_EMPTY", "Este filme ainda não tem sessões para divulgar.");
  const status = type === "teaser"
    ? "EM BREVE"
    : movie.status === "now_playing" ? "EM CARTAZ" : "EM BREVE";
  const content = { title, status };
  if (type === "campaign" && input.tagline) content.tagline = String(input.tagline).trim().slice(0, 100);
  if (selected) {
    content.weekday = selected.weekday;
    content.date = selected.dateLabel;
    content.time = selected.time;
    content.session = `${selected.weekday} • ${selected.dateLabel} • ${selected.time}`;
  }
  if (scheduled.length) content.session = scheduled.map((item) => `${item.weekday} ${item.dateLabel} ${item.time}`).join("  |  ");
  if (type !== "teaser") {
    content.cta = type === "campaign" ? "Confira a programação" : "Escolha sua sessão";
    content.website = String(input.website || "www.cinecruzeiro.com.br").trim().slice(0, 100);
  }
  return { type, content, session: selected, scheduled };
}

function directCampaign(movie, reduced, artwork = {}) {
  const genre = (Array.isArray(movie.genre) ? movie.genre : [movie.genre || ""]).join(" ").toLowerCase();
  let profile = "blockbuster-cinematic";
  if (reduced.type === "schedule") profile = "programming";
  else if (reduced.type === "teaser" && !/terror|horror|thriller|suspense/.test(genre)) profile = "minimal-teaser";
  else if (/terror|horror/.test(genre)) profile = "horror-gritty";
  else if (/thriller|suspense|mistério|misterio/.test(genre)) profile = "dark-thriller";
  else if (/romance|romântic|romantic|drama romântico/.test(genre)) profile = "romantic-editorial";
  else if (/comédia|comedia|comedy/.test(genre)) profile = "comedy-light";
  else if (/família|familia|animação|animacao|animation/.test(genre)) profile = "family-playful";
  else if (/drama|biograf|document/.test(genre)) profile = "prestige";
  else if (/fantasia|fantasy|ficção|ficcao|sci-fi/.test(genre)) profile = "epic-premium";
  const titleWords = reduced.content.title.split(/\s+/).length;
  const hasLockup = Boolean(movie.artworkMetadata?.titleLockupUrl || movie.metadata?.titleLockupUrl || movie.titleLockupUrl);
  return {
    profile,
    type: reduced.type,
    imageOrientation: artwork.orientation || "unknown",
    subjectSide: ["left", "right", "center"].includes(artwork.subjectSide) ? artwork.subjectSide : "unknown",
    tone: artwork.tone || "unknown",
    titleMode: hasLockup ? "hybrid" : "generated_type",
    titleLength: titleWords <= 3 ? "short" : titleWords <= 6 ? "medium" : "long",
    informationDensity: reduced.type === "teaser" ? "low" : reduced.type === "schedule" ? "high" : "medium",
    ctaImportance: reduced.type === "teaser" ? "quiet" : reduced.type === "session" ? "high" : "medium",
    statusImportance: reduced.type === "teaser" ? "medium" : "quiet",
  };
}

function validateTemplateDataset(template, dataset) {
  const fields = dataset && typeof dataset === "object" ? dataset : {};
  const required = Array.isArray(template.metadata?.requiredFields) ? template.metadata.requiredFields : [];
  const errors = [];
  for (const field of required) if (!fields[field]) errors.push(`Campo obrigatório ausente: ${field}.`);
  for (const [field, definition] of Object.entries(fields)) {
    if (!FIELD_TYPES[field]) errors.push(`Campo não reconhecido: ${field}.`);
    else if (definition?.type !== FIELD_TYPES[field]) errors.push(`Tipo incorreto em ${field}: esperado ${FIELD_TYPES[field]}.`);
  }
  if (!["artwork", "poster", "backdrop"].some((field) => fields[field])) errors.push("O template precisa de um campo de imagem principal.");
  if (!fields.title && !fields.titleLockup) errors.push("O template precisa de título ou titleLockup.");
  if ((template.metadata?.supportsSession || template.metadata?.campaignTypes?.includes("session")) && !["session", "date", "time"].some((field) => fields[field])) {
    errors.push("Metadata de sessão incompatível com o dataset.");
  }
  if (template.metadata?.campaignTypes?.includes("schedule") && !fields.session) errors.push("Programação exige o campo session.");
  if (template.metadata?.supportsTitleLockup && !fields.titleLockup) errors.push("Metadata de title lockup incompatível com o dataset.");
  return { valid: errors.length === 0, errors, fields: Object.keys(fields) };
}

function scoreTemplate(template, direction, reduced) {
  if (!template.active || !template.validation?.valid) return null;
  const metadata = template.metadata || {};
  if (!Array.isArray(metadata.campaignTypes) || !metadata.campaignTypes.includes(reduced.type)) return null;
  const fields = template.dataset || {};
  if (reduced.type === "session" && !["session", "date", "time"].some((field) => fields[field])) return null;
  if (reduced.type === "schedule" && !fields.session) return null;
  if (!fields.title && !(direction.titleMode !== "generated_type" && fields.titleLockup)) return null;
  if (direction.titleLength === "long" && metadata.titleCapacity === "short") return null;
  if (metadata.informationCapacity === "low" && direction.informationDensity === "high") return null;
  let score = 50 + Number(metadata.priority || 0);
  if ((metadata.profiles || []).includes(direction.profile)) score += 24;
  if (metadata.orientation === direction.imageOrientation) score += 8;
  if (metadata.subjectSide && metadata.subjectSide === direction.subjectSide) score += 8;
  if (metadata.tone && metadata.tone === direction.tone) score += 7;
  if (metadata.titleCapacity === direction.titleLength) score += 7;
  if (metadata.informationCapacity === direction.informationDensity) score += 6;
  if (direction.titleMode !== "generated_type" && fields.titleLockup) score += 12;
  if (direction.titleMode === "generated_type" && fields.title) score += 5;
  if (reduced.type === "teaser" && metadata.family === "teaser") score += 10;
  return score;
}

function selectTemplates(templates, direction, reduced, limit = 3) {
  const scored = templates.map((template) => ({ template, score: scoreTemplate(template, direction, reduced) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => b.score - a.score || String(a.template.id).localeCompare(String(b.template.id)));
  const selected = [];
  const usedFamilies = new Set();
  while (selected.length < limit && scored.length) {
    const index = scored.findIndex((entry) => !usedFamilies.has(entry.template.metadata?.family) && entry.score >= scored[0].score - 12);
    const [entry] = scored.splice(index < 0 ? 0 : index, 1);
    selected.push(entry);
    usedFamilies.add(entry.template.metadata?.family);
  }
  return selected;
}

function buildAutofillData(template, content, assetIds = {}) {
  const data = {};
  for (const field of Object.keys(template.dataset || {})) {
    if (IMAGE_FIELDS.has(field) && assetIds[field]) data[field] = { type: "image", asset_id: assetIds[field] };
    if (TEXT_FIELDS.has(field) && content[field]) data[field] = { type: "text", text: content[field] };
  }
  const missing = (template.metadata?.requiredFields || []).filter((field) => !data[field]);
  if (missing.length) throw studioError("STUDIO_TEMPLATE_DATA_MISSING", `Dados ausentes para o template: ${missing.join(", ")}.`);
  if (!["artwork", "poster", "backdrop"].some((field) => data[field])) throw studioError("STUDIO_ARTWORK_MISSING", "Este filme não possui uma arte compatível com o template.");
  if (!data.title && !data.titleLockup) throw studioError("STUDIO_TITLE_MISSING", "Este template não recebeu título ou title lockup.");
  return data;
}

module.exports = {
  CAMPAIGN_TYPES,
  FIELD_TYPES,
  studioError,
  reduceContent,
  directCampaign,
  validateTemplateDataset,
  selectTemplates,
  buildAutofillData,
};
