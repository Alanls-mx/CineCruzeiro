import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { TEMPLATE_DEFINITIONS, buildTemplateLibrary, updateLibraryPreference, findDuplicateReference } = require("../backend/services/emailTemplateLibraryService.js");
const { publicApiError } = require("../backend/services/publicApiErrorService.js");

test("biblioteca preserva todos os layouts do sistema", () => {
  assert.deepEqual(TEMPLATE_DEFINITIONS.map((item) => item.id), [
    "announcement", "weekly", "premiere", "last_chance", "promotion", "coupon", "concession",
    "combo", "club_plan", "club", "birthday", "event", "ticket", "reactivation"
  ]);
});

test("biblioteca indexa referências sem carregar o HTML completo", () => {
  const result = buildTemplateLibrary({
    campaigns: [{
      id: "campanha-1",
      subject: "Vingadores chega ao Cine Cruzeiro",
      preheader: "Uma grande estreia",
      templateId: "premiere",
      objective: "movie",
      aiGenerated: true,
      hasHtml: true,
      html: "<html>conteúdo que não deve ir para a listagem</html>",
      imageUrl: "/uploads/movies/vingadores.webp",
      updatedAt: "2026-09-11T10:00:00.000Z"
    }],
    filters: { search: "vingadores", page: 1, pageSize: 6 }
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].sourceType, "campaign");
  assert.equal(result.items[0].origin, "AI_GENERATED");
  assert.equal("html" in result.items[0], false);
  assert.equal(result.items[0].hasRealPreview, true);
});

test("recomendação prioriza o layout compatível com o contexto", () => {
  const result = buildTemplateLibrary({
    filters: { page: 1, pageSize: 14 },
    context: { templateId: "coupon", objective: "offer" }
  });
  assert.equal(result.items[0].templateId, "coupon");
});

test("filtros combinam categoria, origem e favoritos", () => {
  const preferences = updateLibraryPreference({}, "system:combo", "favorite", true);
  const result = buildTemplateLibrary({
    preferences,
    filters: { category: "concession", favorites: true, origin: "SYSTEM" }
  });
  assert.deepEqual(result.items.map((item) => item.id), ["system:combo"]);
});

test("uso do modelo alimenta popularidade e histórico sem alterar o template", () => {
  const first = updateLibraryPreference({}, "system:premiere", "use");
  const second = updateLibraryPreference(first, "system:premiere", "use");
  assert.equal(second.usageCounts["system:premiere"], 2);
  assert.equal(second.recent[0], "system:premiere");
  assert.ok(second.lastUsedAt["system:premiere"]);
});

test("anti-duplicação considera contexto, copy e estrutura", () => {
  const existing = {
    id: "ref-1",
    templateId: "premiere",
    movieId: "filme-1",
    subject: "A grande estreia chegou",
    headline: "Garanta seu lugar",
    contentSections: [{ type: "movie_hero" }, { type: "sessions" }]
  };
  assert.equal(findDuplicateReference({ ...existing, id: "novo" }, [existing])?.id, "ref-1");
  assert.equal(findDuplicateReference({ ...existing, movieId: "filme-2" }, [existing]), null);
});

test("erro inesperado recebe mensagem acionável e código de atendimento", () => {
  const result = publicApiError(new Error("segredo interno"), "req-123");
  assert.equal(result.status, 500);
  assert.equal(result.code, "OPERATION_FAILED");
  assert.match(result.message, /req-123/);
  assert.doesNotMatch(result.message, /segredo interno/);
});

test("erros conhecidos recebem orientação específica", () => {
  assert.equal(publicApiError(Object.assign(new Error("duplicate"), { code: "23505" })).code, "RESOURCE_CONFLICT");
  assert.equal(publicApiError(Object.assign(new Error("Gemini invalid response"), { statusCode: 500 })).code, "GEMINI_UNAVAILABLE");
  const validation = publicApiError(Object.assign(new Error("Revise o filme selecionado."), { statusCode: 422, code: "MOVIE_INVALID" }));
  assert.equal(validation.message, "Revise o filme selecionado.");
});
