import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCampaignDraft } = require("../backend/services/emailCampaignAiService.js");
const { generateOpenAiCampaignDraft } = require("../backend/services/openAiEmailAgentService.js");
const { resolveCampaignContext, filterCouponRecipients, filterOfferRecipients } = require("../backend/services/emailCampaignEligibilityService.js");

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

test("agente OpenAI usa saída estruturada sem aceitar HTML inventado", async () => {
  let requestBody;
  const result = await generateOpenAiCampaignDraft({
    scenario: "premiere",
    siteUrl,
    movie: { id: "filme-ia", slug: "filme-ia", title: "Estreia Segura", workflowStatus: "published", status: "upcoming" }
  }, {
    config: { enabled: true, configured: true, apiKey: "test-key", model: "modelo-teste", timeout: 5000, maxOutputTokens: 900 },
    safetyIdentifier: "admin-teste",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return {
            id: "resp-teste",
            model: "modelo-teste",
            output_text: JSON.stringify({
              subject: "Estreia Segura chega à tela grande",
              preheader: "Reserve sua sessão",
              kicker: "Grande estreia",
              headline: "Uma noite para viver no cinema",
              message: "Olá, {{nome}}. Estreia Segura está chegando ao Cine Cruzeiro.",
              ctaLabel: "Ver sessões",
              accentColor: "#facc15",
              headlineColor: "#ffffff",
              textColor: "#dbeafe",
              buttonColor: "#facc15"
            })
          };
        }
      };
    }
  });

  assert.equal(result.aiProvider, "openai");
  assert.equal(result.aiResponseId, "resp-teste");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.text.format.type, "json_schema");
  assert.match(result.html, /Estreia Segura/);
  assert.doesNotMatch(result.html, /<script/i);
});

test("agente mantém gerador local quando OpenAI não está configurada", async () => {
  const result = await generateOpenAiCampaignDraft({ scenario: "promotion", brief: "Oferta de teste" }, { config: { enabled: false } });
  assert.equal(result.aiProvider, "local-reference-agent");
  assert.equal(result.aiFallbackReason, "OPENAI_NOT_CONFIGURED");
  assert.match(result.message, /Oferta de teste/);
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
