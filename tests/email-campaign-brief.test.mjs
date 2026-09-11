import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extractRequestedSchedule, requestedButtonHints } = require("../backend/services/emailCampaignBriefService.js");
const { buildCampaignDraft } = require("../backend/services/emailCampaignAiService.js");
const { campaignGenerationContext } = require("../backend/services/emailCampaignAiProviderContext.js");
const { armCampaignCoupon, buildCampaignCoupon, syncCampaignCouponSchedule, syncScheduledCampaignCoupons } = require("../backend/services/emailCampaignCouponService.js");

test("briefing transforma data e hora explícitas em agendamento brasileiro", () => {
  const result = extractRequestedSchedule("Enviar esta campanha no dia 15/09/2026 às 14h.", { now: "2026-09-10T12:00:00-03:00" });
  assert.equal(result.matched, true);
  assert.equal(result.scheduleAt, "2026-09-15T17:00:00.000Z");
});

test("data de validade do cupom não é confundida com data de envio", () => {
  const result = extractRequestedSchedule("Agendar o envio para 15/09/2026 às 14h, com cupom válido até 30/09/2026.", { now: "2026-09-10T12:00:00-03:00" });
  assert.equal(result.scheduleAt, "2026-09-15T17:00:00.000Z");
});

test("rascunho usa referência visual e materializa os botões pedidos", () => {
  const result = buildCampaignDraft({
    siteUrl: "https://lumixengine.com/projects/cinecruzeiro",
    scenario: "premiere",
    brief: "Quero comprar ingressos e ver o trailer.",
    movie: { id: "movie-1", slug: "movie-1", title: "Filme em destaque", trailerVideoUrl: "https://www.youtube.com/watch?v=abc123" },
    referenceCampaign: {
      id: "reference-1",
      templateId: "premiere",
      visualStyle: "dramatic",
      accentColor: "#ff7185",
      headlineColor: "#fff7e6",
      textColor: "#dbeafe",
      buttonColor: "#facc15"
    },
    creative: {
      visualStyle: "playful",
      buttons: [{ label: "Uma ação incompatível", intent: "club" }]
    }
  });

  assert.equal(result.visualStyle, "dramatic");
  assert.equal(result.buttonColor, "#facc15");
  assert.deepEqual(result.ctaButtons.map((button) => button.label), ["Comprar ingressos", "Ver trailer"]);
  assert.match(result.html, /Comprar ingressos/);
  assert.match(result.html, /Ver trailer/);
  assert.match(result.html, /youtube\.com/);
});

test("briefing promocional preserva CTA, cupom, período e direção visual solicitados", () => {
  const brief = `Crie uma campanha para Coyote x Acme com visual nostálgico.\nCupom: **ACME20**\n20% de desconto nos ingressos.\nVálido de 10/09/2026 até 20/09/2026, às 23h59.\nCTA principal:\n**USAR ACME20 E COMPRAR INGRESSOS**\nUse composição assimétrica com pôster ao lado, caixa/encomenda ACME, blueprint, estrada e marcas de impacto. O CTA deve aparecer no hero, depois do card e próximo ao final.`;
  const coupon = buildCampaignCoupon({ brief, campaignId: "coyote-acme", movieIds: ["coyote"], now: new Date("2026-09-10T12:00:00Z") });
  const result = buildCampaignDraft({
    objective: "offer",
    scenario: "promotion",
    siteUrl: "https://lumixengine.com/projects/cinecruzeiro",
    brief,
    coupon,
    movie: { id: "coyote", slug: "coyote-x-acme", title: "Coyote x Acme", posterUrl: "/uploads/movies/coyote/poster.webp" },
    creative: {
      visualStyle: "nostalgic",
      artDirection: { heroLayout: "stacked", motifs: [], offerCardStyle: "classic", dividerStyle: "line", ctaPlacement: "standard" },
      sections: [{ type: "quote", title: "", body: "Dessa vez, o plano da ACME funciona.", items: [] }]
    }
  });

  assert.equal(coupon.couponCode, "ACME20");
  assert.equal(coupon.appliesTo, "tickets");
  assert.equal(coupon.startsAt, "2026-09-10T03:00:00.000Z");
  assert.equal(coupon.endsAt, "2026-09-21T02:59:59.999Z");
  assert.equal(coupon.autoCouponValidityMode, "explicit");
  assert.equal(syncCampaignCouponSchedule(coupon, { id: "coyote-acme", scheduleAt: "2026-09-15T12:00:00Z" }).startsAt, coupon.startsAt);
  assert.equal(requestedButtonHints(brief)[0].label, "USAR ACME20 E COMPRAR INGRESSOS");
  assert.equal(result.ctaButtons[0].label, "USAR ACME20 E COMPRAR INGRESSOS");
  assert.equal(result.artDirection.heroLayout, "split");
  assert.equal(result.artDirection.offerCardStyle, "package");
  assert.equal(result.artDirection.ctaPlacement, "repeated");
  assert.match(result.html, /ACME Special Delivery/);
  assert.match(result.html, /20% OFF/);
  assert.match(result.html, /PLANO ACME Nº 20/);
  assert.doesNotMatch(result.html, /Dessa vez, o plano da ACME funciona/);
  assert.equal((result.html.match(/USAR ACME20 E COMPRAR INGRESSOS/g) || []).length, 3);
});

test("contexto enviado ao Gemini mantém o briefing além do antigo limite", () => {
  const brief = `${"Direção visual detalhada. ".repeat(60)}MARCADOR_FINAL_DO_BRIEFING`;
  const context = campaignGenerationContext({ scenario: "announcement", brief }, buildCampaignDraft({ scenario: "announcement", brief }));
  assert.match(context.operatorBrief, /MARCADOR_FINAL_DO_BRIEFING$/);
  assert.ok(context.operatorBrief.length > 1000);
});

test("horários do filme apontam diretamente para o checkout da sessão", () => {
  const result = buildCampaignDraft({
    scenario: "premiere",
    siteUrl: "https://lumixengine.com/projects/cinecruzeiro",
    now: "2026-09-11T12:00:00-03:00",
    movie: {
      id: "filme-coyote",
      slug: "coyote-vs-acme",
      title: "Coyote vs. ACME",
      sessions: [{ id: "sessao-coyote-1", date: "2026-09-12", time: "19:30", format: "2D", language: "Dublado" }]
    }
  });

  assert.match(result.html, /href="https:\/\/lumixengine\.com\/projects\/cinecruzeiro\/checkout\/sessao-coyote-1"/);
  assert.match(result.html, /Escolher esta sessão/);
});

test("cupom de campanha respeita horários, quantidade e limite individual", () => {
  const coupon = buildCampaignCoupon({
    brief: "Cupom CINE20 com 20% de desconto, válido de 15/09/2026 às 14h30 até 20/09/2026 às 22h15, quantidade: 100 usos e 2 usos por cliente.",
    campaignId: "campanha-agendada",
    movieIds: ["filme-1"],
    now: new Date("2026-09-11T12:00:00Z")
  });

  assert.equal(coupon.startsAt, "2026-09-15T17:30:00.000Z");
  assert.equal(coupon.endsAt, "2026-09-21T01:15:59.999Z");
  assert.equal(coupon.usageLimit, 100);
  assert.equal(coupon.perCustomerLimit, 2);
  assert.equal(coupon.active, false);

  const armed = armCampaignCoupon(coupon, { id: "campanha-agendada" }, new Date("2026-09-14T12:00:00Z"));
  assert.equal(armed.active, false);
  assert.equal(armed.autoCouponActivationScheduled, true);

  const db = { promotions: [armed] };
  const activated = syncScheduledCampaignCoupons(db, new Date("2026-09-15T17:30:00Z"));
  assert.equal(activated.changed, true);
  assert.equal(db.promotions[0].active, true);

  const deactivated = syncScheduledCampaignCoupons(db, new Date("2026-09-21T01:16:00Z"));
  assert.equal(deactivated.changed, true);
  assert.equal(db.promotions[0].active, false);
});
