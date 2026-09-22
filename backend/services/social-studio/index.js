const { draftNotices, genreProfile, normalizeV2Draft } = require("./engine/normalizer");
const { renderSocialPostV2 } = require("./engine/renderer");
const { generateSocialCampaign } = require("./services/campaignService");
const { V2_TEMPLATES, templateById } = require("./templates/registry");
const { buildEditableScene } = require("./scene/factory");
const { renderSocialScene } = require("./scene/renderer");
const { normalizeScene } = require("./scene/schema");

module.exports = {
  V2_TEMPLATES,
  buildEditableScene,
  draftNotices,
  generateSocialCampaign,
  genreProfile,
  normalizeV2Draft,
  normalizeScene,
  renderSocialScene,
  renderSocialPostV2,
  templateById
};
