const { buildCampaignDraft } = require("./emailCampaignAiService");
const { RESPONSE_SCHEMA, SYSTEM_INSTRUCTIONS, campaignGenerationContext } = require("./emailCampaignAiProviderContext");

const GEMINI_RESPONSE_SCHEMA = { ...RESPONSE_SCHEMA };
delete GEMINI_RESPONSE_SCHEMA.additionalProperties;

const GEMINI_COMPACT_RESPONSE_SCHEMA = {
  type: "object",
  required: ["subject", "preheader", "kicker", "headline", "message", "ctaLabel", "visualStyle", "accentColor", "headlineColor", "textColor", "buttonColor"],
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    kicker: { type: "string" },
    headline: { type: "string" },
    message: { type: "string" },
    ctaLabel: { type: "string" },
    visualStyle: RESPONSE_SCHEMA.properties.visualStyle,
    accentColor: { type: "string" },
    headlineColor: { type: "string" },
    textColor: { type: "string" },
    buttonColor: { type: "string" }
  }
};

const COMPACT_RECOVERY_INSTRUCTIONS = "A resposta anterior ficou incompleta. Retorne agora apenas os campos compactos exigidos pelo esquema, sem sections, buttons ou artDirection. Seja conciso. O backend montará os botões e a composição visual de forma determinística a partir do briefing original.";

function responseHeader(response, name) {
  if (!response?.headers || typeof response.headers.get !== "function") return "";
  return String(response.headers.get(name) || "").trim();
}

function requestId(response) {
  return responseHeader(response, "x-goog-request-id") || responseHeader(response, "x-request-id");
}

function retryAfterSeconds(response, message = "") {
  const value = responseHeader(response, "retry-after");
  const numeric = Number(value);
  if (value && Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const match = String(message).match(/retry\s+(?:in\s+)?([0-9.]+)s/i);
  return match ? Math.max(1, Math.ceil(Number(match[1]) || 0)) : 0;
}

function geminiErrorDetails(status, payload = {}, response = null) {
  const providerError = payload?.error && typeof payload.error === "object" ? payload.error : {};
  const providerStatus = String(providerError.status || "").trim();
  const providerMessage = String(providerError.message || "").trim();
  const normalized = providerMessage.toLowerCase();
  const retryAfter = retryAfterSeconds(response, providerMessage);
  const id = requestId(response);

  if (Number(status) === 429) {
    const exhausted = /quota|free tier|billing|limit:\s*0|resource has been exhausted/.test(normalized) && !retryAfter;
    return exhausted
      ? { code: "GEMINI_QUOTA_EXCEEDED", providerStatus, message: "A chave foi aceita, mas a cota do Gemini foi esgotada. Revise a cobrança e os limites do projeto no Google AI Studio.", retryable: false, retryAfter, requestId: id }
      : { code: "GEMINI_RATE_LIMITED", providerStatus, message: retryAfter ? `O Gemini atingiu um limite temporário. Tente novamente em ${retryAfter} segundo(s).` : "O Gemini atingiu um limite temporário de requisições. Aguarde alguns instantes e teste novamente.", retryable: true, retryAfter, requestId: id };
  }
  if ([401, 403].includes(Number(status))) return { code: "GEMINI_AUTHENTICATION_FAILED", providerStatus, message: "A chave da API Gemini é inválida, foi revogada ou não tem permissão para este projeto.", retryable: false, retryAfter, requestId: id };
  if (Number(status) === 404 || (Number(status) === 400 && /model.*(?:not found|does not exist|not supported)|invalid.*model/.test(normalized))) {
    return { code: "GEMINI_MODEL_NOT_FOUND", providerStatus, message: "O modelo Gemini configurado não existe mais ou não aceita geração de conteúdo.", retryable: false, retryAfter, requestId: id };
  }
  if (Number(status) === 400) return { code: "GEMINI_REQUEST_INVALID", providerStatus, message: "O Gemini rejeitou a configuração da solicitação.", retryable: false, retryAfter, requestId: id };
  if (Number(status) >= 500) return { code: "GEMINI_UNAVAILABLE", providerStatus, message: "O Gemini está temporariamente indisponível. Tente novamente em alguns instantes.", retryable: true, retryAfter, requestId: id };
  return { code: "GEMINI_RESPONSE_ERROR", providerStatus, message: `O Gemini recusou a solicitação (HTTP ${status}).`, retryable: false, retryAfter, requestId: id };
}

async function parseResponsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function sleep(milliseconds, sleepImpl) {
  return sleepImpl ? sleepImpl(milliseconds) : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGeminiResponse(config, body, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRetries = Math.max(0, Math.min(2, Number(options.maxRetries ?? 1)));
  const model = encodeURIComponent(String(config.model || "gemini-3.6-flash"));
  let attempt = 0;
  while (true) {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: options.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify(body)
    });
    const payload = await parseResponsePayload(response);
    if (response.ok) return { payload, response };
    const details = geminiErrorDetails(response.status, payload, response);
    if (details.retryable && attempt < maxRetries) {
      const delay = details.retryAfter > 0 ? Math.min(5000, details.retryAfter * 1000) : Math.min(5000, 1000 * (2 ** attempt));
      attempt += 1;
      await sleep(delay, options.sleepImpl);
      continue;
    }
    const error = new Error(details.message);
    Object.assign(error, details, { statusCode: response.status });
    throw error;
  }
}

function normalizeModelName(value) {
  return String(value || "").trim().replace(/^models\//, "");
}

function correctedModelName(value) {
  return normalizeModelName(value).replace(/^(gemini-\d+)-(\d+)(-)/, "$1.$2$3");
}

function compatibleTextModels(payload = {}) {
  return (Array.isArray(payload.models) ? payload.models : [])
    .filter((model) => (model?.supportedGenerationMethods || []).includes("generateContent"))
    .map((model) => normalizeModelName(model.name))
    .filter((name) => /^gemini-/i.test(name) && !/(?:image|audio|live|tts|embedding|robotics)/i.test(name));
}

function stableFlashVersion(name) {
  const match = String(name).match(/^gemini-(\d+)(?:\.(\d+))?-flash$/i);
  if (!match) return -1;
  return (Number(match[1]) * 1000) + Number(match[2] || 0);
}

function pickGeminiModel(models = [], configuredModel = "", excludedModels = []) {
  const excluded = new Set(excludedModels.map(normalizeModelName).filter(Boolean));
  const available = [...new Set(models.map(normalizeModelName).filter((name) => name && !excluded.has(name)))];
  const configured = normalizeModelName(configuredModel);
  if (available.includes(configured)) return configured;
  const corrected = correctedModelName(configured);
  if (available.includes(corrected)) return corrected;
  const stableFlash = available
    .filter((name) => stableFlashVersion(name) >= 0)
    .sort((left, right) => stableFlashVersion(right) - stableFlashVersion(left));
  return stableFlash[0]
    || available.find((name) => name === "gemini-2.5-flash")
    || available.find((name) => name === "gemini-flash-latest")
    || available.find((name) => /flash/i.test(name) && !/(?:preview|exp)/i.test(name))
    || available.find((name) => /flash/i.test(name))
    || available[0]
    || "";
}

async function resolveGeminiModel(config = {}, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", {
    method: "GET",
    signal: options.signal,
    headers: { "x-goog-api-key": config.apiKey }
  });
  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    const details = geminiErrorDetails(response.status, payload, response);
    const error = new Error(details.message);
    Object.assign(error, details, { statusCode: response.status });
    throw error;
  }
  const model = pickGeminiModel(compatibleTextModels(payload), config.model, options.excludedModels || []);
  if (!model) {
    throw Object.assign(new Error("Nenhum modelo Gemini compatível com geração de texto está disponível para esta chave."), { code: "GEMINI_NO_COMPATIBLE_MODEL" });
  }
  return model;
}

async function requestGeminiWithModelFallback(config, body, options = {}) {
  const configuredModel = normalizeModelName(config.model || "gemini-3.6-flash");
  try {
    const result = await requestGeminiResponse({ ...config, model: configuredModel }, body, options);
    return { ...result, model: configuredModel, modelChanged: false };
  } catch (error) {
    if (error.code !== "GEMINI_MODEL_NOT_FOUND") throw error;
    const model = await resolveGeminiModel(config, { ...options, excludedModels: [configuredModel] });
    const result = await requestGeminiResponse({ ...config, model }, body, options);
    return { ...result, model, modelChanged: true };
  }
}

function geminiResponseText(payload = {}) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
}

function geminiFinishReason(payload = {}) {
  return String(payload?.candidates?.[0]?.finishReason || payload?.promptFeedback?.blockReason || "").trim();
}

function parseGeminiCreative(payload = {}) {
  const text = geminiResponseText(payload).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const finishReason = geminiFinishReason(payload);
  if (!text) {
    const blocked = String(payload?.promptFeedback?.blockReason || "").trim();
    throw Object.assign(new Error(blocked
      ? "O Gemini bloqueou a geração deste conteúdo. Revise o briefing e tente novamente."
      : "O Gemini não retornou conteúdo utilizável. Tente novamente."), {
      code: blocked ? "GEMINI_RESPONSE_BLOCKED" : "GEMINI_EMPTY_RESPONSE",
      statusCode: 502,
      expose: true,
      retryableGeneration: !blocked,
      finishReason
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("O Gemini devolveu uma resposta incompleta. O sistema tentará gerar novamente com um formato mais compacto."), {
      code: "GEMINI_INVALID_RESPONSE",
      statusCode: 502,
      expose: true,
      retryableGeneration: true,
      finishReason
    });
  }
}

function campaignGenerationBody(providerInput, compact = false) {
  return {
    system_instruction: { parts: [{ text: compact ? `${SYSTEM_INSTRUCTIONS}\n\n${COMPACT_RECOVERY_INSTRUCTIONS}` : SYSTEM_INSTRUCTIONS }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(providerInput) }] }],
    generationConfig: {
      maxOutputTokens: compact ? 1800 : 3200,
      responseMimeType: "application/json",
      responseSchema: compact ? GEMINI_COMPACT_RESPONSE_SCHEMA : GEMINI_RESPONSE_SCHEMA
    }
  };
}

async function requestCampaignCreative(config, providerInput, options = {}, compact = false) {
  const controller = new AbortController();
  const timeout = Math.max(5000, Math.min(60000, Number(config.timeout || 30000)));
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const requestedTokens = Number(config.maxOutputTokens || 0);
    const body = campaignGenerationBody(providerInput, compact);
    body.generationConfig.maxOutputTokens = compact
      ? Math.max(1400, Math.min(2400, requestedTokens || 1800))
      : Math.max(2600, Math.min(5000, requestedTokens || 3200));
    const result = await requestGeminiWithModelFallback(config, body, {
      fetchImpl: options.fetchImpl || fetch,
      signal: controller.signal,
      maxRetries: 1,
      sleepImpl: options.sleepImpl
    });
    return { ...result, creative: parseGeminiCreative(result.payload) };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeGenerationError(error, repeated = false) {
  if (error.name === "AbortError") {
    return Object.assign(new Error(repeated
      ? "O Gemini demorou demais nas duas tentativas. O briefing foi mantido; tente gerar novamente em alguns instantes."
      : "O Gemini demorou demais para responder. Nenhum rascunho foi criado."), {
      statusCode: 504,
      code: "GEMINI_TIMEOUT",
      expose: true
    });
  }
  if (repeated && error.code === "GEMINI_INVALID_RESPONSE") {
    error.message = "O Gemini devolveu uma resposta incompleta nas duas tentativas. O briefing foi mantido; tente gerar novamente.";
  }
  if (!error.statusCode) error.statusCode = ["GEMINI_EMPTY_RESPONSE", "GEMINI_INVALID_RESPONSE", "GEMINI_RESPONSE_BLOCKED"].includes(error.code) ? 502 : 503;
  error.expose = true;
  return error;
}

async function testGeminiConnection(config = {}, options = {}) {
  if (!config.apiKey || !config.model) return { ok: false, code: "GEMINI_NOT_CONFIGURED", message: "Informe a chave da API e o modelo do Gemini." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(60000, Number(config.timeout || 30000))));
  try {
    const { response, model, modelChanged } = await requestGeminiWithModelFallback(config, {
      contents: [{ role: "user", parts: [{ text: "Responda somente: conexão confirmada" }] }],
      generationConfig: { maxOutputTokens: 32 }
    }, { ...options, signal: controller.signal, maxRetries: 1 });
    return {
      ok: true,
      code: modelChanged ? "GEMINI_MODEL_RESOLVED" : "GEMINI_CONNECTED",
      message: modelChanged ? `Gemini conectado. O modelo inválido foi substituído automaticamente por ${model}.` : `Gemini conectado com o modelo ${model}.`,
      requestId: requestId(response),
      model,
      resolvedModel: modelChanged ? model : ""
    };
  } catch (error) {
    if (error.name === "AbortError") return { ok: false, code: "GEMINI_TIMEOUT", message: "O Gemini demorou demais para responder." };
    return { ok: false, code: String(error.code || "GEMINI_UNAVAILABLE"), message: error.message || "Não foi possível conectar ao Gemini.", retryAfterSeconds: Number(error.retryAfter || 0), requestId: String(error.requestId || "") };
  } finally {
    clearTimeout(timer);
  }
}

async function generateGeminiCampaignDraft(input = {}, options = {}) {
  const baseline = buildCampaignDraft(input);
  const config = options.config || {};
  if (!(config.enabled && config.configured && config.apiKey)) {
    throw Object.assign(new Error("Configure, teste e ative o Gemini em Integrações antes de gerar campanhas com IA."), {
      statusCode: 409,
      code: "GEMINI_NOT_CONFIGURED"
    });
  }

  const providerInput = campaignGenerationContext(input, baseline);
  let firstFailure = null;
  let activeConfig = config;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await requestCampaignCreative(activeConfig, providerInput, options, attempt === 1);
      activeConfig = { ...activeConfig, model: result.model };
      const generated = buildCampaignDraft({ ...input, creative: result.creative });
      return {
        ...generated,
        aiProvider: "gemini",
        aiModel: result.model,
        aiModelResolved: result.modelChanged,
        aiResponseId: result.payload.responseId || "",
        aiGenerationRetried: attempt === 1,
        aiGenerationRetryReason: firstFailure?.code || ""
      };
    } catch (error) {
      const canRetry = attempt === 0 && (error.name === "AbortError" || error.retryableGeneration === true);
      if (canRetry) {
        firstFailure = error;
        continue;
      }
      throw normalizeGenerationError(error, attempt === 1);
    }
  }
  throw normalizeGenerationError(firstFailure || new Error("O Gemini não retornou conteúdo utilizável."), true);
}

module.exports = {
  generateGeminiCampaignDraft,
  testGeminiConnection,
  _test: {
    compatibleTextModels,
    correctedModelName,
    geminiErrorDetails,
    geminiFinishReason,
    geminiResponseText,
    parseGeminiCreative,
    normalizeModelName,
    pickGeminiModel,
    requestGeminiResponse,
    requestGeminiWithModelFallback,
    resolveGeminiModel,
    retryAfterSeconds
  }
};
