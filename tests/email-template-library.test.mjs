import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { TEMPLATE_DEFINITIONS, TEMPLATE_VARIANTS, buildTemplateLibrary, updateLibraryPreference, findDuplicateReference, variantFor } = require("../backend/services/emailTemplateLibraryService.js");
const { publicApiError } = require("../backend/services/publicApiErrorService.js");

test("biblioteca preserva todos os layouts do sistema", () => {
  assert.deepEqual(TEMPLATE_DEFINITIONS.map((item) => item.id), [
    "announcement", "weekly", "premiere", "last_chance", "promotion", "coupon", "concession",
    "combo", "club_plan", "club", "birthday", "event", "ticket", "reactivation"
  ]);
});

test("cada layout possui duas variantes determinísticas e mantém o templateId original", () => {
  assert.equal(TEMPLATE_VARIANTS.length, TEMPLATE_DEFINITIONS.length * 2);
  for (const definition of TEMPLATE_DEFINITIONS) {
    const variants = TEMPLATE_VARIANTS.filter((item) => item.templateId === definition.id);
    assert.equal(variants.length, 2, `${definition.id} deve possuir duas variantes`);
    assert.ok(variants.every((item) => item.defaults?.headline && item.theme?.accent));
    assert.ok(variants.every((item) => item.defaults?.preheader && item.defaults.message.length > 180));
    assert.notEqual(variants[0].defaults.message, variants[1].defaults.message);
  }
  assert.equal(variantFor("premiere-spotlight")?.templateId, "premiere");
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
  assert.equal(result.items[0].origin, "SAVED");
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

test("biblioteca expõe as 28 variantes como modelos do sistema", () => {
  const result = buildTemplateLibrary({ filters: { page: 1, pageSize: 48, origin: "SYSTEM" } });
  assert.equal(result.total, 28);
  assert.equal(result.systemModelCount, 28);
  assert.ok(result.items.some((item) => item.id === "system:combo-family" && item.templateId === "combo"));
});

test("gerador Gemini foi removido das rotas, serviços e interface", () => {
  const server = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
  const adminHtml = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  const adminJs = readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  const integrations = readFileSync(new URL("../backend/services/integrationConfigService.js", import.meta.url), "utf8");

  assert.doesNotMatch(server, /campaigns\/ai-draft|email\/prompt-templates/);
  assert.doesNotMatch(adminHtml, /Gemini|Criar com IA|gerador com IA/i);
  assert.doesNotMatch(adminJs, /campaigns\/ai-draft|email\/prompt-templates|Gemini/i);
  assert.match(adminJs, /function emailCampaignHistoryLinkedLabel\(/);
  assert.doesNotMatch(integrations, /Gemini|generativelanguage\.googleapis/i);
  assert.equal(existsSync(new URL("../backend/services/geminiEmailAgentService.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../backend/services/emailCampaignAiService.js", import.meta.url)), false);
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
  const orderState = publicApiError(Object.assign(new Error('violates check constraint "orders_status_check"'), { code: "23514", constraint: "orders_status_check" }));
  assert.equal(orderState.code, "ORDER_STATE_CONFLICT");
  assert.equal(orderState.status, 409);
  const validation = publicApiError(Object.assign(new Error("Revise o filme selecionado."), { statusCode: 422, code: "MOVIE_INVALID" }));
  assert.equal(validation.message, "Revise o filme selecionado.");
});
