import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCampaignDraft } = require("../backend/services/emailCampaignAiService.js");

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
