const { generateOpenAiCampaignDraft } = require("./openAiEmailAgentService");
const { generateGeminiCampaignDraft } = require("./geminiEmailAgentService");

const PROVIDERS = Object.freeze({
  openai: generateOpenAiCampaignDraft,
  gemini: generateGeminiCampaignDraft
});

async function generateEmailDraft(provider, context, options = {}) {
  const generate = PROVIDERS[String(provider || "").toLowerCase()];
  if (!generate) {
    const error = new Error("Selecione OpenAI ou Gemini como motor da campanha.");
    error.statusCode = 422;
    error.code = "EMAIL_CAMPAIGN_AI_PROVIDER_INVALID";
    throw error;
  }
  return generate(context, options);
}

module.exports = { generateEmailDraft, supportedProviders: () => Object.keys(PROVIDERS) };
