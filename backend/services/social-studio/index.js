const { draftNotices, genreProfile, normalizeV2Draft } = require("./engine/normalizer");
const { renderSocialPostV2 } = require("./engine/renderer");
const { generateSocialCampaign } = require("./services/campaignService");
const { V2_TEMPLATES, templateById } = require("./templates/registry");

module.exports = {
  V2_TEMPLATES,
  draftNotices,
  generateSocialCampaign,
  genreProfile,
  normalizeV2Draft,
  renderSocialPostV2,
  templateById
};
