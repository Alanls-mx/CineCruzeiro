const { buildCampaignDraft } = require("./emailCampaignAiService");
const { RESPONSE_SCHEMA, SYSTEM_INSTRUCTIONS, campaignGenerationContext } = require("./emailCampaignAiProviderContext");

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
  if (Number(status) === 404) return { code: "GEMINI_MODEL_NOT_FOUND", providerStatus, message: "O modelo Gemini configurado não foi encontrado ou não está disponível para este projeto.", retryable: false, retryAfter, requestId: id };
  if (Number(status) === 400) return { code: "GEMINI_REQUEST_INVALID", providerStatus, message: "O Gemini rejeitou a configuração da solicitação. Confira o nome do modelo configurado.", retryable: false, retryAfter, requestId: id };
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
  const model = encodeURIComponent(String(config.model || "gemini-2.5-flash"));
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

function geminiResponseText(payload = {}) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
}

async function testGeminiConnection(config = {}, options = {}) {
  if (!config.apiKey || !config.model) return { ok: false, code: "GEMINI_NOT_CONFIGURED", message: "Informe a chave da API e o modelo do Gemini." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(60000, Number(config.timeout || 30000))));
  try {
    const { response } = await requestGeminiResponse(config, {
      contents: [{ role: "user", parts: [{ text: "Responda somente: conexão confirmada" }] }],
      generationConfig: { maxOutputTokens: 32 }
    }, { ...options, signal: controller.signal, maxRetries: 1 });
    return { ok: true, code: "GEMINI_CONNECTED", message: `Gemini conectado com o modelo ${config.model}.`, requestId: requestId(response) };
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
    return { ...baseline, aiProvider: "local-reference-agent", aiFallbackReason: "GEMINI_NOT_CONFIGURED", aiFallbackMessage: "Configure e ative o Gemini em Integrações para usar este provedor." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(60000, Number(config.timeout || 30000))));
  try {
    const providerInput = campaignGenerationContext(input, baseline);
    const { payload } = await requestGeminiResponse(config, {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTIONS }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(providerInput) }] }],
      generationConfig: {
        maxOutputTokens: Math.max(600, Math.min(4000, Number(config.maxOutputTokens || 1800))),
        responseFormat: { text: { mimeType: "application/json", schema: RESPONSE_SCHEMA } }
      }
    }, { fetchImpl: options.fetchImpl || fetch, signal: controller.signal, maxRetries: 1, sleepImpl: options.sleepImpl });
    const text = geminiResponseText(payload);
    if (!text) throw Object.assign(new Error("O Gemini não retornou conteúdo utilizável."), { code: "GEMINI_EMPTY_RESPONSE" });
    const creative = JSON.parse(text);
    const generated = buildCampaignDraft({ ...input, creative });
    return { ...generated, aiProvider: "gemini", aiModel: config.model || "", aiResponseId: payload.responseId || "" };
  } catch (error) {
    if (options.fallback === false) throw error;
    return {
      ...baseline,
      aiProvider: "local-reference-agent",
      aiFallbackReason: error.name === "AbortError" ? "GEMINI_TIMEOUT" : String(error.code || "GEMINI_UNAVAILABLE"),
      aiFallbackMessage: error.name === "AbortError" ? "O Gemini demorou demais para responder." : String(error.message || "O Gemini não está disponível.")
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  generateGeminiCampaignDraft,
  testGeminiConnection,
  _test: { geminiErrorDetails, geminiResponseText, requestGeminiResponse, retryAfterSeconds }
};
