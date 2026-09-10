const crypto = require("crypto");
const { buildCampaignDraft, normalizeScenario } = require("./emailCampaignAiService");

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "preheader", "kicker", "headline", "message", "ctaLabel", "accentColor", "headlineColor", "textColor", "buttonColor"],
  properties: {
    subject: { type: "string" },
    preheader: { type: "string" },
    kicker: { type: "string" },
    headline: { type: "string" },
    message: { type: "string" },
    ctaLabel: { type: "string" },
    accentColor: { type: "string" },
    headlineColor: { type: "string" },
    textColor: { type: "string" },
    buttonColor: { type: "string" }
  }
};

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

function catalogFacts(input = {}) {
  const movie = input.movie ? {
    id: input.movie.id,
    title: input.movie.title,
    synopsis: input.movie.synopsis,
    duration: input.movie.duration,
    classification: input.movie.rating || input.movie.classification,
    releaseDate: input.movie.releaseDate,
    sessions: (input.movie.sessions || []).slice(0, 8).map(({ date, time, format }) => ({ date, time, format }))
  } : null;
  const coupon = input.coupon ? {
    id: input.coupon.id,
    title: input.coupon.title,
    code: input.coupon.couponCode,
    discountType: input.coupon.discountType,
    value: Number(input.coupon.value || 0),
    appliesTo: input.coupon.appliesTo || "all",
    startsAt: input.coupon.startsAt || "",
    endsAt: input.coupon.endsAt || "",
    minimumOrderValue: Number(input.coupon.minimumOrderValue || 0),
    firstPurchaseOnly: Boolean(input.coupon.firstPurchaseOnly)
  } : null;
  const plan = input.plan ? {
    id: input.plan.id,
    name: input.plan.name,
    monthlyPrice: Number(input.plan.monthlyPrice ?? input.plan.price ?? 0),
    includedTickets: Number(input.plan.includedTickets || 0),
    benefits: Array.isArray(input.plan.benefits) ? input.plan.benefits.slice(0, 8) : input.plan.benefits
  } : null;
  const concessions = (input.concessions || []).slice(0, 12).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price || 0),
    category: item.category
  }));
  return { movie, coupon, plan, concessions, warnings: input.eligibilityReport?.warnings || [] };
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
    const scenario = normalizeScenario(input.scenario);
    const facts = catalogFacts(input);
    const reference = input.referenceCampaign ? {
      templateId: input.referenceCampaign.templateId,
      subject: input.referenceCampaign.subject,
      headline: input.referenceCampaign.headline,
      message: input.referenceCampaign.message,
      colors: {
        headline: input.referenceCampaign.headlineColor,
        text: input.referenceCampaign.textColor,
        button: input.referenceCampaign.buttonColor
      }
    } : null;
    const { payload } = await requestOpenAiResponse(config, {
        model: String(config.model || "gpt-5.6-terra"),
        reasoning: { effort: "none" },
        store: false,
        max_output_tokens: Math.max(600, Math.min(4000, Number(config.maxOutputTokens || 1800))),
        safety_identifier: crypto.createHash("sha256").update(String(options.safetyIdentifier || "cine-cruzeiro-admin")).digest("hex"),
        prompt_cache_key: "cinecruzeiro-email-agent-v1",
        instructions: "Você é o redator e diretor de arte do Cine Cruzeiro. Escreva em português do Brasil, com identidade cinematográfica acolhedora e comercial, sem exageros. Use somente fatos presentes no catálogo validado. Nunca invente preço, estoque, data, sessão, benefício, cupom, validade ou elegibilidade. Preserve {{nome}} quando personalizar. Não gere HTML, links ou IDs. A saída deve obedecer exatamente ao esquema JSON. Faça a chamada principal clara, o assunto honesto e o CTA coerente com o objetivo. Se houver alertas de validade, declare a data ou condição relevante no texto.",
        input: JSON.stringify({
          objective: scenario,
          operatorBrief: String(input.brief || "").slice(0, 1000),
          audience: input.recipientMode || "all",
          templateId: baseline.templateId,
          validatedCatalog: facts,
          visualReference: reference,
          deterministicDraft: {
            subject: baseline.subject,
            preheader: baseline.preheader,
            kicker: baseline.aiScenario,
            headline: baseline.headline,
            message: baseline.message,
            ctaLabel: baseline.ctaLabel,
            colors: { headline: baseline.headlineColor, text: baseline.textColor, button: baseline.buttonColor }
          }
        }),
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
