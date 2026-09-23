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
    : template.id === "movie-presale" ? "movie-premiere" : ['sessions-today','sessions-week','multi-movies'].includes(template.id) ? 'movie-highlight' : template.id;
  const legacyDraft = legacy.normalizeDraft({ ...input, templateId: legacyTemplateId }, context);
  const movie = entityById(context.movies, input.movieId) || legacyDraft.entities.movie;
  const concession = entityById(context.concessions, input.concessionId) || legacyDraft.entities.concession;
  const clubPlan = entityById(context.clubPlans, input.clubPlanId) || legacyDraft.entities.clubPlan;
  const profile = genreProfile(movie || {});
  const design = require('../contracts/campaign').normalizeDesign(input, profile.recommendedStyle);
  const requestedStyle = input.style === "automatic" || !input.style ? profile.recommendedStyle : String(input.style);
  const style = template.styles.includes(requestedStyle) ? requestedStyle : template.styles[0];
  const draft = {
    ...legacyDraft,
    ...design,
    templateId: template.id,
    style,
    automaticStyle: input.automaticStyle === true || (!input.layoutId && (input.style === "automatic" || !input.style)),
    polish: input.polish === true,
    artDirection: normalizeDirection(input.artDirection),
    paletteId: PALETTES.some((item) => item.id === input.paletteId) ? input.paletteId : "automatic",
    rendererVersion: "v2",
    copyTone: require('../copy-engine').TONES.includes(input.copyTone) ? input.copyTone : 'automatic',
    copyDensity: ['short','medium','long'].includes(input.copyDensity) ? input.copyDensity : 'medium',
    copyLocks:Object.fromEntries(Object.keys(require('../copy-engine').FIELD_MAP).map(field=>[field,input.copyLocks?.[field]===true])),
    genreProfile: profile,
    composition: normalizeComposition({...input.composition,look:design.look}, profile.id),
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
  if(input.layoutId) draft.style = design.layoutId;
  require('./content-rules').applyContentRules(draft, input, context);
  draft.signatureScaleMode=input.signatureScaleMode==='automatic' || input.signatureScale===undefined ? 'automatic' : 'manual';
  draft.brandProminence=['subtle','normal','strong'].includes(input.brandProminence)?input.brandProminence:'normal';
  Object.assign(draft,require('../composition-engine/artwork-policy').normalizeArtwork(input,movie));
  if(template.id==='movie-price') {
    draft.priceInfo=require('../contracts/price').resolvePriceSelection(input,draft.entities.movie,context.now);
    draft.priceSelection=draft.priceInfo.selection;
    draft.price=draft.priceInfo.formatted;
    draft.subtitle=draft.priceInfo.label || 'SELECIONE O TIPO DE INGRESSO';
  }
  if(draft.programMood) {
    draft.genreProfile={...draft.genreProfile,id:draft.programMood};
    draft.composition=normalizeComposition({...input.composition,look:design.look},draft.programMood);
  }
  const {buildCampaignContent,validateCampaignContent} = require('../contracts/content');
  draft.content = buildCampaignContent(draft,input,context);
  draft.primaryDateKind = draft.content.primaryDateKind;
  draft.releaseDate = draft.content.releaseDate;
  draft.presaleStartDate = draft.content.presaleStartDate;
  draft.sessionDate = draft.content.sessionDate;
  if(input.date===undefined) {
    const value=draft.content.primaryDate;
    draft.date=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)).toUpperCase():value;
  }
  draft.actionDestination = draft.content.action.destination;
  draft.actionDestinationType = draft.content.action.destinationType;
  draft.semanticValidation = validateCampaignContent(draft.content);
  draft.contentNotices = [...draft.contentNotices.filter(n=>!draft.semanticValidation.errors.some(e=>e.code===n.code)), ...draft.semanticValidation.errors];
  return draft;
}

function draftNotices(input = {}, context = {}) {
  const draft = normalizeV2Draft(input, context);
  const correction=require('./today-correction').todayCorrection(draft,context);
  const contentNotices=draft.contentNotices.map(notice=>notice.code==='TODAY_MISMATCH' && correction ? {...notice,correction} : notice);
  if(['sessions-today','sessions-week','multi-movies'].includes(draft.templateId)) return contentNotices;
  const legacyId = draft.templateId === "club-plan" ? "cinema-club" : draft.templateId === "movie-presale" ? "movie-premiere" : draft.templateId;
  const notices = legacy.draftNotices({ ...draft, templateId: legacyId }, context);
  if (["movie-premiere", "movie-highlight", "movie-price", "movie-presale"].includes(draft.templateId)) {
    notices.unshift({
      type: "info",
      code: "STYLE_RECOMMENDATION",
      message: `${draft.genreProfile.label} recomendado a partir do gênero. Você pode escolher outra variação.`
    });
  }
  return [...notices, ...contentNotices];
}

module.exports = { draftNotices, genreProfile, normalizeV2Draft };
