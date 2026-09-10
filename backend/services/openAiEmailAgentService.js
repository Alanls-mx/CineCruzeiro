const crypto = require("crypto");
const { buildCampaignDraft } = require("./emailCampaignAiService");
const { RESPONSE_SCHEMA, SYSTEM_INSTRUCTIONS, catalogFacts, campaignGenerationContext } = require("./emailCampaignAiProviderContext");

const OPENAI_QUOTA_CODES = new Set([
  "credit_balance_exhausted",
  "organization_usage_limit_exceeded",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "insufficient_quota"
]);

function responseHeader(response, name) {
  if (!response?.headers || typeof response.headers.get !== "function") return "";
  return String(response.headers.get(name) || "").trim();
}

function retryAfterSeconds(response) {
  const value = responseHeader(response, "retry-after");
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : 0;
}

function openAiErrorDetails(status, payload = {}, response = null) {
  const providerError = payload?.error && typeof payload.error === "object" ? payload.error : {};
  const providerCode = String(providerError.code || "").trim().toLowerCase();
  const providerType = String(providerError.type || "").trim().toLowerCase();
  const providerMessage = String(providerError.message || "").trim().toLowerCase();
  const quotaExceeded = OPENAI_QUOTA_CODES.has(providerCode)
    || OPENAI_QUOTA_CODES.has(providerType)
    || /quota|billing|credit balance|spend limit|usage limit/.test(providerMessage);
  const requestId = responseHeader(response, "x-request-id");
  const retryAfter = retryAfterSeconds(response);

  if (Number(status) === 429 && quotaExceeded) {
    const messages = {
      credit_balance_exhausted: "A chave foi aceita, mas a conta OpenAI está sem créditos. Adicione saldo na cobrança da API e teste novamente.",
      organization_usage_limit_exceeded: "A organização OpenAI atingiu o limite de uso aprovado. Revise os limites da organização antes de testar novamente.",
      organization_spend_limit_exceeded: "A organização OpenAI atingiu o limite de gastos configurado. Aumente o limite ou aguarde a renovação.",
      project_spend_limit_exceeded: "O projeto OpenAI atingiu o limite de gastos configurado. Revise o limite desse projeto antes de testar novamente."
    };
    return {
      code: "OPENAI_QUOTA_EXCEEDED",
      providerCode: providerCode || providerType || "insufficient_quota",
      message: messages[providerCode] || "A chave foi aceita, mas a conta ou o projeto OpenAI está sem cota disponível. Revise créditos e limites de gastos antes de testar novamente.",
      retryable: false,
      retryAfter,
      requestId
    };
  }
  if (Number(status) === 429) {
    return {
      code: "OPENAI_RATE_LIMITED",
      providerCode: providerCode || providerType || "rate_limit_exceeded",
      message: retryAfter
        ? `A OpenAI atingiu um limite temporário de requisições. Tente novamente em ${retryAfter} segundo(s).`
        : "A OpenAI atingiu um limite temporário de requisições. Aguarde alguns instantes e teste novamente.",
      retryable: true,
      retryAfter,
      requestId
    };
  }
  if (Number(status) === 401) return { code: "OPENAI_AUTHENTICATION_FAILED", providerCode, message: "A chave da API OpenAI é inválida, foi revogada ou pertence a outro projeto.", retryable: false, retryAfter, requestId };
  if (Number(status) === 403) return { code: "OPENAI_ACCESS_DENIED", providerCode, message: "A chave não tem permissão para usar a OpenAI neste projeto ou modelo.", retryable: false, retryAfter, requestId };
  if (Number(status) === 404) return { code: "OPENAI_MODEL_NOT_FOUND", providerCode, message: "O modelo configurado não foi encontrado ou não está disponível para este projeto.", retryable: false, retryAfter, requestId };
  if (Number(status) === 400) return { code: "OPENAI_REQUEST_INVALID", providerCode, message: "A OpenAI rejeitou a configuração da solicitação. Confira o nome do modelo configurado.", retryable: false, retryAfter, requestId };
  if (Number(status) >= 500) return { code: "OPENAI_UNAVAILABLE", providerCode, message: "A OpenAI está temporariamente indisponível. Tente novamente em alguns instantes.", retryable: true, retryAfter, requestId };
  return { code: "OPENAI_RESPONSE_ERROR", providerCode, message: `A OpenAI recusou a solicitação (HTTP ${status}).`, retryable: false, retryAfter, requestId };
}

async function parseResponsePayload(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function wait(milliseconds, sleepImpl) {
  if (sleepImpl) return sleepImpl(milliseconds);
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestOpenAiResponse(config, body, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRetries = Math.max(0, Math.min(2, Number(options.maxRetries ?? 1)));
  let attempt = 0;
  while (true) {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: options.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body)
    });
    const payload = await parseResponsePayload(response);
    if (response.ok) return { payload, response };

    const details = openAiErrorDetails(response.status, payload, response);
    if (details.retryable && attempt < maxRetries) {
      const delay = details.retryAfter > 0
        ? Math.min(5000, details.retryAfter * 1000)
        : Math.min(5000, 1000 * (2 ** attempt));
      attempt += 1;
      await wait(delay, options.sleepImpl);
      continue;
    }

    const error = new Error(details.message);
    Object.assign(error, details, { statusCode: response.status });
    throw error;
  }
}

async function testOpenAiConnection(config = {}, options = {}) {
  if (!config.apiKey || !config.model) return { ok: false, code: "OPENAI_NOT_CONFIGURED", message: "Informe a chave da API e o modelo da OpenAI." };
  const controller = new AbortController();
  const timeout = Math.max(5000, Math.min(60000, Number(config.timeout || 30000)));
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const { response } = await requestOpenAiResponse(config, {
      model: String(config.model),
      reasoning: { effort: "none" },
      store: false,
      max_output_tokens: 64,
      input: "Responda somente: conexão confirmada"
    }, { ...options, signal: controller.signal, maxRetries: 1 });
    return {
      ok: true,
      code: "OPENAI_CONNECTED",
      message: `OpenAI conectada com o modelo ${config.model}.`,
      requestId: responseHeader(response, "x-request-id")
    };
  } catch (error) {
    if (error.name === "AbortError") return { ok: false, code: "OPENAI_TIMEOUT", message: "A OpenAI demorou demais para responder." };
    return {
      ok: false,
      code: String(error.code || "OPENAI_UNAVAILABLE"),
      message: error.message || "Não foi possível conectar à OpenAI.",
      retryAfterSeconds: Number(error.retryAfter || 0),
      requestId: String(error.requestId || "")
    };
  } finally {
    clearTimeout(timer);
  }
}

function responseText(payload = {}) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function generateOpenAiCampaignDraft(input = {}, options = {}) {
  const baseline = buildCampaignDraft(input);
  const config = options.config || {};
  if (!(config.enabled && config.configured && config.apiKey)) {
    return { ...baseline, aiProvider: "local-reference-agent", aiFallbackReason: "OPENAI_NOT_CONFIGURED" };
  }

  const controller = new AbortController();
  const timeout = Math.max(5000, Math.min(60000, Number(config.timeout || 30000)));
  const timer = setTimeout(() => controller.abort(), timeout);
  const fetchImpl = options.fetchImpl || fetch;
  try {
    const providerInput = campaignGenerationContext(input, baseline);
    const { payload } = await requestOpenAiResponse(config, {
        model: String(config.model || "gpt-5.6-terra"),
        reasoning: { effort: "none" },
        store: false,
        max_output_tokens: Math.max(500, Math.min(1600, Number(config.maxOutputTokens || 900))),
        safety_identifier: crypto.createHash("sha256").update(String(options.safetyIdentifier || "cine-cruzeiro-admin")).digest("hex"),
        prompt_cache_key: "cinecruzeiro-email-agent-v1",
        instructions: SYSTEM_INSTRUCTIONS,
        input: JSON.stringify(providerInput),
        text: { format: { type: "json_schema", name: "cinecruzeiro_email_campaign", strict: true, schema: RESPONSE_SCHEMA } }
      }, { fetchImpl, signal: controller.signal, maxRetries: 1, sleepImpl: options.sleepImpl });
    const text = responseText(payload);
    if (!text) throw Object.assign(new Error("A OpenAI não retornou conteúdo utilizável."), { code: "OPENAI_EMPTY_RESPONSE" });
    const creative = JSON.parse(text);
    const generated = buildCampaignDraft({ ...input, creative });
    return { ...generated, aiProvider: "openai", aiModel: payload.model || config.model || "", aiResponseId: payload.id || "" };
  } catch (error) {
    if (options.fallback === false) throw error;
    return {
      ...baseline,
      aiProvider: "local-reference-agent",
      aiFallbackReason: error.name === "AbortError" ? "OPENAI_TIMEOUT" : String(error.code || "OPENAI_UNAVAILABLE"),
      aiFallbackMessage: error.name === "AbortError" ? "A OpenAI demorou demais para responder." : String(error.message || "A OpenAI não está disponível.")
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  generateOpenAiCampaignDraft,
  testOpenAiConnection,
  _test: { catalogFacts, responseText, RESPONSE_SCHEMA, openAiErrorDetails, requestOpenAiResponse, retryAfterSeconds }
};
