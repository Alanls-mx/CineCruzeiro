import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCampaignDraft } = require("../backend/services/emailCampaignAiService.js");
const { generateGeminiCampaignDraft, testGeminiConnection, _test: geminiTest } = require("../backend/services/geminiEmailAgentService.js");
const { generateEmailDraft, supportedProviders } = require("../backend/services/emailCampaignAiProviderService.js");
const integrationConfigService = require("../backend/services/integrationConfigService.js");
const { resolveCampaignContext, filterCouponRecipients, filterOfferRecipients } = require("../backend/services/emailCampaignEligibilityService.js");
const { resolveCampaignTemplate, _test: templateResolverTest } = require("../backend/services/emailCampaignTemplateResolver.js");

const siteUrl = "https://lumixengine.com/projects/cinecruzeiro";

test("agente usa o filme, poster, sessoes e cores do rascunho de referência", () => {
  const result = buildCampaignDraft({
    scenario: "premiere",
    siteUrl,
    movie: {
      id: "filme-1",
      slug: "filme-1",
      title: "Novo Filme",
      posterUrl: "/uploads/movies/filme.webp",
      duration: "1h 50m",
      rating: "12",
      sessions: [{ date: "2026-09-12", time: "19:00" }]
    },
    referenceCampaign: {
      id: "campanha-antiga",
      templateId: "premiere",
      headlineColor: "#ffcc00",
      textColor: "#dbeafe",
      buttonColor: "#22d3ee"
    },
    brand: { name: "Cine Cruzeiro", logoUrl: "/uploads/logo.webp" }
  });

  assert.equal(result.templateId, "premiere");
  assert.equal(result.movieId, "filme-1");
  assert.equal(result.headlineColor, "#ffcc00");
  assert.equal(result.buttonColor, "#22d3ee");
  assert.match(result.html, /Novo Filme/);
  assert.match(result.html, /uploads\/movies\/filme.webp/);
  assert.match(result.variables.sessoes_filme, /12\/09\/2026 às 19:00/);
});

test("agente incorpora cupom, plano, bomboniere e público no rascunho", () => {
  const result = buildCampaignDraft({
    scenario: "promotion",
    siteUrl,
    coupon: { id: "cupom-1", title: "Quarta do cinema", couponCode: "QUARTA20", discountType: "percent", value: 20, endsAt: "2026-09-30T23:59:00-03:00" },
    plan: { id: "plano-1", name: "Plano Família", monthlyPrice: 89.9, includedTickets: 8, benefits: ["8 ingressos por mês", "15% na bomboniere"] },
    concessions: [{ id: "pipoca", name: "Pipoca Grande", description: "Pipoca salgada", price: 18, imageUrl: "/uploads/concessions/pipoca.webp" }],
    recipientMode: "purchased",
    brief: "Destaque a condição para quem já comprou ingressos."
  });

  assert.equal(result.couponId, "cupom-1");
  assert.equal(result.clubPlanId, "plano-1");
  assert.deepEqual(result.concessionIds, ["pipoca"]);
  assert.equal(result.variables.codigo_cupom, "QUARTA20");
  assert.equal(result.variables.publico_oferta, "clientes com compras aprovadas");
  assert.match(result.message, /Destaque a condição/);
  assert.match(result.html, /QUARTA20/);
  assert.match(result.html, /Plano Família/);
  assert.match(result.html, /Pipoca Grande/);
});

test("briefing e links não permitem HTML ou esquemas perigosos", () => {
  const result = buildCampaignDraft({
    scenario: "coupon",
    siteUrl,
    coupon: { couponCode: "CINE10", discountType: "amount", value: 10 },
    brief: "<script>alert('x')</script>",
    imageUrl: "javascript:alert(1)"
  });

  assert.doesNotMatch(result.html, /<script/i);
  assert.doesNotMatch(result.html, /javascript:/i);
  assert.match(result.html, /&lt;script&gt;/i);
});

test("agente rejeita rascunho de referência de outro template", () => {
  const result = buildCampaignDraft({
    scenario: "concession",
    siteUrl,
    concessions: [{ id: "combo", name: "Combo Família", price: 42 }],
    referenceCampaign: {
      id: "vingadores-grande-estreia",
      templateId: "premiere",
      headlineColor: "#ff0000",
      buttonColor: "#00ff00"
    }
  });

  assert.equal(result.templateId, "concession");
  assert.equal(result.aiReferenceCampaignId, "");
  assert.equal(result.aiContext, "concession");
  assert.equal(result.headlineColor, "#ffffff");
  assert.equal(result.buttonColor, "#f59e0b");
});

test("agente mantém referência quando o template visual é o mesmo", () => {
  const result = buildCampaignDraft({
    scenario: "premiere",
    siteUrl,
    movie: { id: "doomsday", title: "Vingadores: Doomsday" },
    referenceCampaign: {
      id: "vingadores-grande-estreia",
      templateId: "premiere",
      headlineColor: "#ffcc00",
      textColor: "#fef3c7",
      buttonColor: "#ef4444"
    }
  });

  assert.equal(result.templateId, "premiere");
  assert.equal(result.aiReferenceCampaignId, "vingadores-grande-estreia");
  assert.equal(result.headlineColor, "#ffcc00");
  assert.equal(result.buttonColor, "#ef4444");
});

test("agente gera rascunho coerente para template de ingressos", () => {
  const result = buildCampaignDraft({
    scenario: "ticket",
    siteUrl,
    movie: { id: "filme-2", slug: "filme-2", title: "Sessão Especial" }
  });

  assert.equal(result.templateId, "ticket");
  assert.equal(result.aiContext, "ticket");
  assert.match(result.subject, /Sessão Especial/);
  assert.match(result.message, /QR Code/);
});

test("agente Gemini usa catálogo validado e saída estruturada", async () => {
  let requestUrl = "";
  let requestOptions;
  const result = await generateGeminiCampaignDraft({
    scenario: "premiere",
    siteUrl,
    movie: { id: "filme-gemini", slug: "filme-gemini", title: "Estreia Gemini", workflowStatus: "published", status: "upcoming" }
  }, {
    config: { enabled: true, configured: true, apiKey: "gemini-test-key", model: "gemini-2.5-flash", timeout: 5000, maxOutputTokens: 900 },
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return {
        ok: true,
        status: 200,
        headers: { get: () => "gemini-request" },
        async json() {
          return {
            responseId: "gemini-response",
            candidates: [{ content: { parts: [{ text: JSON.stringify({
              subject: "Estreia Gemini chega ao Cine Cruzeiro",
              preheader: "Escolha sua sessão",
              kicker: "Grande estreia",
              headline: "Uma nova história na tela grande",
              message: "Olá, {{nome}}. Estreia Gemini está chegando ao Cine Cruzeiro.",
              ctaLabel: "Ver sessões",
              accentColor: "#facc15",
              headlineColor: "#ffffff",
              textColor: "#dbeafe",
              buttonColor: "#facc15"
            }) }] } }]
          };
        }
      };
    }
  });

  const requestBody = JSON.parse(requestOptions.body);
  assert.equal(result.aiProvider, "gemini");
  assert.equal(result.aiResponseId, "gemini-response");
  assert.match(requestUrl, /gemini-2\.5-flash:generateContent$/);
  assert.equal(requestOptions.headers["x-goog-api-key"], "gemini-test-key");
  assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
  assert.equal(requestBody.generationConfig.responseSchema.type, "object");
  assert.equal(requestBody.generationConfig.responseSchema.additionalProperties, undefined);
  assert.match(requestBody.contents[0].parts[0].text, /Estreia Gemini/);
  assert.match(result.html, /Estreia Gemini/);
});

test("teste Gemini valida conexão e modelo", async () => {
  const result = await testGeminiConnection({ apiKey: "gemini-test-key", model: "gemini-2.5-flash", timeout: 5000 }, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === "x-goog-request-id" ? "gemini-request" : "" },
      async json() { return { candidates: [{ content: { parts: [{ text: "conexão confirmada" }] } }] }; }
    })
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "GEMINI_CONNECTED");
  assert.equal(result.requestId, "gemini-request");
});

test("Gemini identifica e persiste sugestão de modelo quando o configurado não existe", async () => {
  const urls = [];
  const result = await testGeminiConnection({ apiKey: "gemini-test-key", model: "gemini-3-8-flash", timeout: 5000 }, {
    fetchImpl: async (url) => {
      urls.push(url);
      if (urls.length === 1) return {
        ok: false,
        status: 404,
        headers: { get: () => "" },
        async json() { return { error: { status: "NOT_FOUND", message: "models/gemini-3-8-flash is not found for generateContent" } }; }
      };
      if (urls.length === 2) return {
        ok: true,
        status: 200,
        headers: { get: () => "" },
        async json() {
          return {
            models: [
              { name: "models/gemini-2.5-flash-image", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
              { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }
            ]
          };
        }
      };
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === "x-goog-request-id" ? "resolved-request" : "" },
        async json() { return { candidates: [{ content: { parts: [{ text: "conexão confirmada" }] } }] }; }
      };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "GEMINI_MODEL_RESOLVED");
  assert.equal(result.model, "gemini-3.8-flash");
  assert.equal(result.resolvedModel, "gemini-3.8-flash");
  assert.match(urls[0], /gemini-3-8-flash:generateContent$/);
  assert.match(urls[1], /\/v1beta\/models\?pageSize=100$/);
  assert.match(urls[2], /gemini-3\.8-flash:generateContent$/);
});

test("se a versão digitada não existir, Gemini escolhe o Flash estável mais recente disponível", () => {
  const selected = geminiTest.pickGeminiModel([
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview"
  ], "gemini-inexistente");
  assert.equal(selected, "gemini-3.6-flash");
});

test("Gemini não reutiliza um modelo listado que já falhou por descontinuação", () => {
  const selected = geminiTest.pickGeminiModel([
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.6-flash"
  ], "gemini-2.5-flash", ["gemini-2.5-flash"]);
  assert.equal(selected, "gemini-3.6-flash");
});

test("Gemini explica cota esgotada sem repetir a solicitação", async () => {
  let requests = 0;
  const result = await testGeminiConnection({ apiKey: "gemini-test-key", model: "gemini-2.5-flash", timeout: 5000 }, {
    fetchImpl: async () => {
      requests += 1;
      return {
        ok: false,
        status: 429,
        headers: { get: () => "" },
        async json() { return { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for free tier limit: 0" } }; }
      };
    },
    sleepImpl: async () => {}
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "GEMINI_QUOTA_EXCEEDED");
  assert.match(result.message, /cota do Gemini foi esgotada/);
  assert.equal(requests, 1);
});

test("Gemini repete uma vez quando o limite informa Retry-After", async () => {
  let requests = 0;
  let waited = 0;
  const result = await testGeminiConnection({ apiKey: "gemini-test-key", model: "gemini-2.5-flash", timeout: 5000 }, {
    fetchImpl: async () => {
      requests += 1;
      if (requests === 1) return {
        ok: false,
        status: 429,
        headers: { get: (name) => name.toLowerCase() === "retry-after" ? "1" : "" },
        async json() { return { error: { status: "RESOURCE_EXHAUSTED", message: "Rate limit reached" } }; }
      };
      return { ok: true, status: 200, headers: { get: () => "" }, async json() { return { candidates: [] }; } };
    },
    sleepImpl: async (milliseconds) => { waited = milliseconds; }
  });
  assert.equal(result.ok, true);
  assert.equal(requests, 2);
  assert.equal(waited, 1000);
});

test("Gemini sem configuração bloqueia a geração", async () => {
  await assert.rejects(
    generateGeminiCampaignDraft({ scenario: "promotion", brief: "Oferta Gemini" }, { config: { enabled: false } }),
    { code: "GEMINI_NOT_CONFIGURED", statusCode: 409 }
  );
});

test("falha do Gemini não cria rascunho por fallback local", async () => {
  await assert.rejects(
    generateGeminiCampaignDraft({ scenario: "promotion" }, {
      config: { enabled: true, configured: true, apiKey: "gemini-test-key", model: "gemini-2.5-flash", timeout: 5000 },
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        headers: { get: () => "" },
        async json() { return { error: { status: "UNAVAILABLE", message: "temporarily unavailable" } }; }
      }),
      sleepImpl: async () => {}
    }),
    { code: "GEMINI_UNAVAILABLE" }
  );
});

test("motor de campanhas expõe somente o Gemini", async () => {
  assert.deepEqual(supportedProviders(), ["gemini"]);
  await assert.rejects(generateEmailDraft("openai", {}), { code: "EMAIL_CAMPAIGN_AI_PROVIDER_INVALID" });
});

test("Integrações expõem Gemini com segredo protegido e modelo padrão", () => {
  const definition = integrationConfigService.DEFINITIONS.gemini;
  assert.ok(definition);
  assert.deepEqual(definition.secrets, ["apiKey"]);
  assert.equal(definition.defaults.model, "gemini-3.6-flash");
  assert.equal(integrationConfigService.DEFINITIONS.openai, undefined);
  assert.equal(geminiTest.geminiErrorDetails(404, { error: { status: "NOT_FOUND" } }).code, "GEMINI_MODEL_NOT_FOUND");
});

test("validação rejeita cupom expirado, esgotado e restrito a outro filme", () => {
  const base = {
    movies: [{ id: "filme-1", title: "Filme 1", workflowStatus: "published", status: "upcoming", releaseDate: "2026-10-10" }],
    concessions: [], subscriptionPlans: [], orders: []
  };
  assert.throws(() => resolveCampaignContext({ ...base, promotions: [{ id: "cupom", couponCode: "FIM", value: 10, active: true, endsAt: "2026-08-01" }] }, { scenario: "premiere", movieId: "filme-1", couponId: "cupom" }, { now: "2026-09-09T12:00:00-03:00" }), { code: "EMAIL_CAMPAIGN_COUPON_EXPIRED" });
  assert.throws(() => resolveCampaignContext({ ...base, promotions: [{ id: "cupom", couponCode: "LIMITE", value: 10, active: true, usageLimit: 1 }], orders: [{ status: "paid", couponId: "cupom" }] }, { scenario: "premiere", movieId: "filme-1", couponId: "cupom" }, { now: "2026-09-09T12:00:00-03:00" }), { code: "EMAIL_CAMPAIGN_COUPON_EXHAUSTED" });
  assert.throws(() => resolveCampaignContext({ ...base, promotions: [{ id: "cupom", couponCode: "OUTRO", value: 10, active: true, allowedMovieIds: ["filme-2"] }] }, { scenario: "premiere", movieId: "filme-1", couponId: "cupom" }, { now: "2026-09-09T12:00:00-03:00" }), { code: "EMAIL_CAMPAIGN_COUPON_MOVIE_INVALID" });
});

test("validação impede anunciar cupom que expira antes do lançamento", () => {
  const db = {
    movies: [{ id: "filme-1", title: "Filme Futuro", workflowStatus: "published", status: "upcoming", releaseDate: "2026-11-12" }],
    promotions: [{ id: "cupom", couponCode: "OUTUBRO", value: 15, active: true, appliesTo: "tickets", endsAt: "2026-10-31T23:59:59-03:00" }],
    concessions: [], subscriptionPlans: [], orders: []
  };
  assert.throws(() => resolveCampaignContext(db, { scenario: "premiere", movieId: "filme-1", couponId: "cupom" }, { now: "2026-09-09T12:00:00-03:00" }), { code: "EMAIL_CAMPAIGN_COUPON_EXPIRES_BEFORE_MOVIE" });
});

test("validação alerta quando cupom não cobre todo o mês da estreia", () => {
  const db = {
    movies: [{ id: "filme-1", title: "Filme Futuro", workflowStatus: "published", status: "upcoming", releaseDate: "2026-10-10" }],
    promotions: [{ id: "cupom", couponCode: "ESTREIA", value: 15, active: true, appliesTo: "tickets", endsAt: "2026-10-15T23:59:59-03:00" }],
    concessions: [], subscriptionPlans: [], orders: []
  };
  const result = resolveCampaignContext(db, { scenario: "premiere", movieId: "filme-1", couponId: "cupom" }, { now: "2026-09-09T12:00:00-03:00" });
  assert.equal(result.coupon.id, "cupom");
  assert.match(result.report.warnings[0], /não cobre todo o mês/);
});

test("validação bloqueia produto sem estoque e plano inativo", () => {
  const db = {
    movies: [], promotions: [], orders: [],
    concessions: [{ id: "pipoca", name: "Pipoca", price: 18, stock: 0, active: true }],
    subscriptionPlans: [{ id: "clube", name: "Clube", monthlyPrice: 39.9, active: false }]
  };
  assert.throws(() => resolveCampaignContext(db, { scenario: "concession", concessionIds: ["pipoca"] }), { code: "EMAIL_CAMPAIGN_CONCESSION_OUT_OF_STOCK" });
  assert.throws(() => resolveCampaignContext(db, { scenario: "club", clubPlanId: "clube" }), { code: "EMAIL_CAMPAIGN_PLAN_UNAVAILABLE" });
});

test("público exclui quem não pode mais usar cupom individual", () => {
  const coupon = { id: "cupom", couponCode: "UNICO", perCustomerLimit: 1 };
  const recipients = [{ id: "a", email: "a@example.com" }, { id: "b", email: "b@example.com" }];
  const db = { orders: [{ status: "paid", customerUserId: "a", couponId: "cupom", couponCode: "UNICO" }] };
  const result = filterCouponRecipients(db, coupon, recipients);
  assert.deepEqual(result.recipients.map((item) => item.id), ["b"]);
  assert.equal(result.excluded, 1);
  assert.equal(result.reasons.perCustomerLimit, 1);
});

test("público de um plano exclui clientes que já possuem a assinatura", () => {
  const recipients = [{ id: "a", email: "a@example.com" }, { id: "b", email: "b@example.com" }];
  const db = { orders: [], subscriptions: [{ userId: "a", planId: "familia", status: "active" }] };
  const result = filterOfferRecipients(db, { plan: { id: "familia" } }, recipients);
  assert.deepEqual(result.recipients.map((item) => item.id), ["b"]);
  assert.equal(result.reasons.alreadySubscribed, 1);
});

test("resolvedor escolhe automaticamente os cenários principais", () => {
  const cases = [
    [{ objective: "movie", movie: { id: "m", status: "upcoming" } }, "premiere"],
    [{ objective: "movie", movie: { id: "m", status: "now_playing" } }, "now_playing"],
    [{ objective: "movie", movie: { id: "m", status: "ending_soon" } }, "last_chance"],
    [{ objective: "programming", movieIds: ["m1", "m2"] }, "programming"],
    [{ objective: "offer", couponId: "cupom" }, "coupon"],
    [{ objective: "offer" }, "promotion"],
    [{ objective: "concession", concessions: [{ id: "p" }] }, "concession"],
    [{ objective: "concession", concessions: [{ id: "p" }, { id: "c" }] }, "combo"],
    [{ objective: "club", plan: { id: "plano" } }, "club_plan"],
    [{ objective: "club" }, "club"],
    [{ objective: "event" }, "event"],
    [{ recipientMode: "reactivation" }, "reactivation"],
    [{ recipientMode: "birthday_manual" }, "birthday"],
    [{ objective: "announcement" }, "announcement"]
  ];
  for (const [context, scenario] of cases) assert.equal(resolveCampaignTemplate(context).scenario, scenario);
  assert.equal(resolveCampaignTemplate({ objective: "movie" }).incomplete, true);
  assert.equal(templateResolverTest.isUpcomingMovie({ status: "upcoming" }), true);
});

test("resolvedor limita override aos layouts compatíveis e preserva o layout válido", () => {
  const compatible = resolveCampaignTemplate({ objective: "movie", movie: { id: "m", status: "upcoming" }, templateId: "weekly", templateSelectionMode: "manual" });
  assert.equal(compatible.templateId, "weekly");
  assert.equal(compatible.templateSelectionMode, "manual");
  assert.deepEqual(compatible.compatibleTemplates, ["premiere", "weekly"]);

  const corrected = resolveCampaignTemplate({ objective: "concession", concessions: [{ id: "p" }], templateId: "premiere", templateSelectionMode: "manual" });
  assert.equal(corrected.templateId, "concession");
  assert.equal(corrected.templateSelectionMode, "automatic");
  assert.match(corrected.reason, /não é compatível/);
});
