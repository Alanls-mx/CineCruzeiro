const legacy = require("../../socialStudioService");
const { templateById } = require("../templates/registry");
const { PALETTES } = require("./palette");
const { normalizeComposition, normalizeMotion, normalizeDirection } = require("../composition-engine/config");

function entityById(items, id) {
  return (Array.isArray(items) ? items : []).find((item) => String(item.id) === String(id)) || null;
}

function genreProfile(movie = {}) {
  const genres = [movie.genre, ...(movie.genres || [])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/terror|horror|suspense/.test(genres)) return { id: "horror", recommendedStyle: "cinematic", label: "Cinematográfico escuro" };
  if (/fantasia|fantasy/.test(genres)) return { id: "fantasy", recommendedStyle: "immersive", label: "Fantasia imersiva" };
  if (/animacao|familia|infantil/.test(genres)) return { id: "family", recommendedStyle: "impact", label: "Impacto colorido" };
  if (/acao|aventura/.test(genres)) return { id: "action", recommendedStyle: "impact", label: "Impacto" };
  if (/romance/.test(genres)) return { id: "romance", recommendedStyle: "clean", label: "Clean elegante" };
  if (/drama/.test(genres)) return { id: "drama", recommendedStyle: "cinematic", label: "Cinematográfico" };
  if (/comedia|comedy/.test(genres)) return { id: "comedy", recommendedStyle: "split", label: "Comédia editorial" };
  return { id: "cinema", recommendedStyle: "cinematic", label: "Cinematográfico" };
}

function normalizeV2Draft(input = {}, context = {}) {
  const template = templateById(input.templateId);
  const legacyTemplateId = template.id === "club-plan"
    ? "cinema-club"
    : template.id === "movie-presale" ? "movie-premiere" : template.id;
  const legacyDraft = legacy.normalizeDraft({ ...input, templateId: legacyTemplateId }, context);
  const movie = entityById(context.movies, input.movieId) || legacyDraft.entities.movie;
  const concession = entityById(context.concessions, input.concessionId) || legacyDraft.entities.concession;
  const clubPlan = entityById(context.clubPlans, input.clubPlanId) || legacyDraft.entities.clubPlan;
  const profile = genreProfile(movie || {});
  const requestedStyle = input.style === "automatic" || !input.style ? profile.recommendedStyle : String(input.style);
  const style = template.styles.includes(requestedStyle) ? requestedStyle : template.styles[0];
  const draft = {
    ...legacyDraft,
    templateId: template.id,
    style,
    automaticStyle: input.style === "automatic" || !input.style || input.automaticStyle === true,
    artDirection: normalizeDirection(input.artDirection),
    paletteId: PALETTES.some((item) => item.id === input.paletteId) ? input.paletteId : "automatic",
    rendererVersion: "v2",
    genreProfile: profile,
    composition: normalizeComposition(input.composition, profile.id),
    motion: normalizeMotion(input.motion),
    entities: { movie, concession, clubPlan }
  };

  if (template.id === "movie-presale") {
    if (input.subtitle === undefined) draft.subtitle = "PRÉ-VENDA ABERTA";
    if (input.cta === undefined) draft.cta = "GARANTA NA PRÉ-VENDA";
  }
  if (template.id === "club-plan") {
    draft.clubPlanId = clubPlan?.id || "";
  }
  return draft;
}

function draftNotices(input = {}, context = {}) {
  const draft = normalizeV2Draft(input, context);
  const legacyId = draft.templateId === "club-plan" ? "cinema-club" : draft.templateId === "movie-presale" ? "movie-premiere" : draft.templateId;
  const notices = legacy.draftNotices({ ...draft, templateId: legacyId }, context);
  if (["movie-premiere", "movie-highlight", "movie-price", "movie-presale"].includes(draft.templateId)) {
    notices.unshift({
      type: "info",
      code: "STYLE_RECOMMENDATION",
      message: `${draft.genreProfile.label} recomendado a partir do gênero. Você pode escolher outra variação.`
    });
  }
  return notices;
}

module.exports = { draftNotices, genreProfile, normalizeV2Draft };
