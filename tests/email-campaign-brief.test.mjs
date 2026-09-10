import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { extractRequestedSchedule } = require("../backend/services/emailCampaignBriefService.js");
const { buildCampaignDraft } = require("../backend/services/emailCampaignAiService.js");

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
