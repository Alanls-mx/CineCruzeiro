const { generateGeminiCampaignDraft } = require("./geminiEmailAgentService");

const PROVIDERS = Object.freeze({
  gemini: generateGeminiCampaignDraft
});

async function generateEmailDraft(provider, context, options = {}) {
  const generate = PROVIDERS[String(provider || "").toLowerCase()];
  if (!generate) {
    const error = new Error("O Gemini é o único motor de IA disponível para campanhas.");
    error.statusCode = 422;
    error.code = "EMAIL_CAMPAIGN_AI_PROVIDER_INVALID";
    throw error;
  }
  return generate(context, options);
}

module.exports = { generateEmailDraft, supportedProviders: () => Object.keys(PROVIDERS) };
