import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PROMPT_TEMPLATE_DEFINITIONS,
  listPromptTemplates,
  resolvePromptTemplate,
  updatePromptTemplate,
  renderPromptTemplate
} = require("../backend/services/emailCampaignPromptTemplates.js");
const { campaignGenerationContext } = require("../backend/services/emailCampaignAiProviderContext.js");

test("biblioteca cobre todos os cenários de e-mail sem IDs duplicados", () => {
  const expected = ["announcement", "programming", "premiere", "now_playing", "last_chance", "promotion", "coupon", "concession", "combo", "club_plan", "club", "birthday", "event", "ticket", "reactivation"];
  assert.deepEqual(PROMPT_TEMPLATE_DEFINITIONS.map((item) => item.scenario).sort(), expected.sort());
  assert.equal(new Set(PROMPT_TEMPLATE_DEFINITIONS.map((item) => item.id)).size, expected.length);
  assert.ok(PROMPT_TEMPLATE_DEFINITIONS.every((item) => item.prompt.length >= 80));
});

test("personalização fica isolada no modelo escolhido e pode ser restaurada", () => {
  const settings = {};
  const customPrompt = "Crie uma mensagem institucional objetiva, com assunto curto, informação confirmada em primeiro plano e um único botão coerente com o contexto validado.";
  const updated = updatePromptTemplate(settings, "announcement", customPrompt);
  assert.equal(updated.prompt, customPrompt);
  assert.equal(updated.customized, true);
  assert.equal(resolvePromptTemplate(settings, "coupon").customized, false);

  const restored = updatePromptTemplate(settings, "announcement", "", { reset: true });
  assert.equal(restored.customized, false);
  assert.notEqual(restored.prompt, customPrompt);
});

test("modelo rejeita ID desconhecido e conteúdo insuficiente", () => {
  assert.throws(() => updatePromptTemplate({}, "unknown", "texto"), /não encontrado/i);
  assert.throws(() => updatePromptTemplate({}, "announcement", "curto"), /80 caracteres/i);
});

test("variáveis usam somente os itens validados do cenário", () => {
  const template = resolvePromptTemplate({}, "concession");
  const rendered = renderPromptTemplate(template, {
    concessions: [{ name: "Pipoca Grande", price: 18 }],
    movies: [{ title: "Filme que não pertence à campanha" }],
    recipientMode: "recent"
  });
  assert.match(rendered, /Pipoca Grande/);
  assert.match(rendered, /R\$\s?18,00/);
  assert.doesNotMatch(rendered, /Filme que não pertence à campanha/);
  assert.doesNotMatch(rendered, /\{\{produtos\}\}/);
});

test("modelo de filme aceita contexto de um único título", () => {
  const template = resolvePromptTemplate({}, "premiere");
  const rendered = renderPromptTemplate(template, {
    movie: { title: "Estreia Confirmada", sessions: [{ date: "2026-09-18", time: "20:00" }] },
    movies: []
  });
  assert.match(rendered, /Estreia Confirmada/);
  assert.match(rendered, /2026-09-18 · 20:00/);
  assert.doesNotMatch(rendered, /filme validado/);
});

test("contexto do Gemini recebe o modelo editorial aprovado", () => {
  const promptTemplate = {
    id: "premiere",
    name: "Grande estreia",
    instructions: "Dê protagonismo ao filme validado, preserve a identidade do cinema e não introduza nenhuma oferta ausente no contexto aprovado."
  };
  const context = campaignGenerationContext({
    objective: "movie",
    scenario: "premiere",
    promptTemplate,
    movie: { id: "movie-1", title: "Filme validado", sessions: [] }
  }, { templateId: "premiere" });
  assert.deepEqual(context.promptModel, promptTemplate);
  assert.equal(context.contentScope, "Somente filmes e programação");
  assert.equal(context.validatedCatalog.movies.length, 1);
  assert.equal(context.validatedCatalog.movies[0].title, "Filme validado");
});

test("listagem efetiva não altera as definições padrão", () => {
  const custom = "Use um comunicado com hierarquia compacta, linguagem direta e apenas informações presentes no contexto comercial que foi previamente aprovado pelo backend.";
  const settings = { emailAiPromptTemplates: { announcement: custom } };
  const listed = listPromptTemplates(settings);
  assert.equal(listed.find((item) => item.id === "announcement").prompt, custom);
  assert.notEqual(PROMPT_TEMPLATE_DEFINITIONS.find((item) => item.id === "announcement").prompt, custom);
});
