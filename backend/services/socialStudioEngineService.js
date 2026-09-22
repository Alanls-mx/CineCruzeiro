const legacy = require("./socialStudioService");
const v2 = require("./social-studio");

function captionForDraft(input = {}, context = {}) {
  const draft = v2.normalizeV2Draft(input, context);
  if (draft.caption) return draft.caption;
  const legacyTemplateId = draft.templateId === "club-plan"
    ? "cinema-club"
    : draft.templateId === "movie-presale" ? "movie-premiere" : draft.templateId;
  const base = legacy.captionForDraft({ ...draft, templateId: legacyTemplateId }, context);
  return draft.templateId === "movie-presale" ? base.replace(/Estreia esta semana/gi, "Pré-venda aberta") : base;
}

function buildSocialReadyPosts(context = {}) {
  return legacy.buildSocialReadyPosts(context).map((post) => ({
    ...post,
    draft: v2.normalizeV2Draft(post.draft, context),
    rendererVersion: "v2"
  }));
}

module.exports = {
  ...legacy,
  SOCIAL_TEMPLATES: v2.V2_TEMPLATES.map(({ render, variants, requirements, ...template }) => ({
    ...template,
    variants,
    requiredData: Object.keys(requirements || {}).filter((key) => requirements[key])
  })),
  buildSocialReadyPosts,
  captionForDraft,
  draftNotices: v2.draftNotices,
  generateSocialCampaign: v2.generateSocialCampaign,
  genreProfile: v2.genreProfile,
  normalizeDraft: v2.normalizeV2Draft,
  normalizeScene: v2.normalizeScene,
  renderSocialScene: v2.renderSocialScene,
  renderSocialPost: v2.renderSocialPostV2,
  renderSocialPostLegacy: legacy.renderSocialPost
};
