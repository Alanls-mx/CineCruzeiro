import test from "node:test";
import assert from "node:assert/strict";
import core from "../backend/services/creativeMarketingStudioService.js";

const scenarios = [
  ["films", { title: "Minha Melhor Amiga", campaign: "Estreia", release: "29/09", sessions: "29/09 15:00" }, "title lockup"],
  ["concessions", { product: "Combo Pipoca + Refrigerante", components: "1x Pipoca grande\n2x Refrigerante 500 ml", price: "R$ 34,90" }, "embalagem"],
  ["programming", { period: "Semana de 29/09", movies: "Minha Melhor Amiga\nResident Evil", sessions: "Minha Melhor Amiga — 29/09 15:00\nResident Evil — 30/09 19:00" }, "horários"],
  ["promotions", { benefit: "Ingresso por R$ 12,00", previousPrice: "R$ 20,00", period: "29/09 a 30/09", conditions: "Apenas sessões de terça-feira" }, "benefício"],
  ["events", { name: "Pré-estreia especial", date: "29/09", time: "19:00", venue: "Cine Cruzeiro — Sala 1" }, "experiência"],
  ["coupons", { code: "CINE10", benefit: "R$ 10,00 de desconto", validity: "até 30/09", rules: "Um uso por CPF" }, "código"],
  ["giveaways", { prize: "2 ingressos", mechanics: "Comente na publicação até 29/09", rules: "Resultado em 30/09" }, "regulamento"],
  ["institutional", { headline: "Horário especial", message: "No dia 29/09 abriremos às 14:00.", hours: "14:00 às 22:00" }, "clareza"],
  ["free", { subject: "Semana do cinema", objective: "Convidar para conhecer as salas", details: "Ação em 29/09" }, "objetivo"],
];

test("nove categorias possuem campos e direção contextuais", () => {
  assert.equal(Object.keys(core.CATEGORIES).length, 9);
  const prompts = new Map();
  for (const [category, facts, categoryWord] of scenarios) {
    const input = core.normalizeInput({ category, format: "feed", density: "auto", facts,
      artworkRole: "none", requiredText: ["Texto exato da equipe"], visualDescription: "Azul profundo e luz lateral" });
    const curated = core.curate(input);
    const variants = core.variantsFor(input, null);
    assert.equal(variants.length, 3);
    assert.equal(new Set(variants.map((variant) => variant.id)).size, 3);
    const brief = core.briefFor(input, curated, variants[0], null, null);
    assert.equal(brief.version, 2);
    assert.equal(brief.category, category);
    assert.equal(brief.visualAnalysisStatus, "manual_or_unavailable");
    const prompt = core.compile(input, brief, curated);
    assert.ok(core.qa(prompt, input, curated, brief).ok);
    assert.match(prompt.toLowerCase(), new RegExp(categoryWord.toLowerCase()));
    for (const value of Object.values(facts)) assert.ok(prompt.includes(value), `${category}: ${value}`);
    assert.ok(prompt.includes("Texto exato da equipe"));
    assert.ok(prompt.length > 2000, `${category} is too generic`);
    assert.match(prompt, /não houve análise visual por IA/i);
    prompts.set(category, prompt);
  }
  assert.match(prompts.get("concessions"), /evitar inventar ingredientes, componentes/i);
  assert.match(prompts.get("coupons"), /fácil de transcrever/i);
  assert.match(prompts.get("programming"), /não deslocar um horário/i);
  assert.match(prompts.get("giveaways"), /revisão humana/i);
  assert.notEqual(prompts.get("films"), prompts.get("concessions"));
});

test("campos ausentes não são inventados e fatos obrigatórios não são truncados silenciosamente", () => {
  const input = core.normalizeInput({ category: "promotions", format: "square", facts: { benefit: "Desconto especial" },
    requiredText: ["Somente na bilheteria"], artworkRole: "none" });
  const curated = core.curate(input);
  const brief = core.briefFor(input, curated, core.variantsFor(input)[0], null, null);
  const prompt = core.compile(input, brief, curated);
  assert.ok(prompt.includes("Somente na bilheteria"));
  assert.ok(!prompt.includes("R$ 12,00"));
  assert.throws(() => core.normalizeInput({ category: "coupons", format: "feed", facts: { code: "" } }),
    /código do cupom/i);
  assert.throws(() => core.normalizeInput({ category: "free", format: "feed", facts: { subject: "X", objective: "Y" },
    requiredText: Array.from({ length: 31 }, (_, i) => `Linha ${i}`) }), /30 textos obrigatórios/i);
});

test("curadoria recomenda carrossel sem eliminar regras longas", () => {
  const rules = "Condição confirmada ".repeat(25);
  const input = core.normalizeInput({ category: "giveaways", format: "square", facts: {
    prize: "2 ingressos", mechanics: "Preencha o formulário", rules
  } });
  const curated = core.curate(input);
  assert.equal(curated.overflow, true);
  assert.ok(curated.required.includes(rules.trim()));
  assert.match(core.compile(input, core.briefFor(input, curated, core.variantsFor(input)[0], null, null), curated), /carrossel/i);
});

test("análise multimodal e referência são separadas e mockadas; sem IA o fluxo continua", async () => {
  const saved = new Map();
  const repository = {
    async insert(run) { saved.set(run.id, { ...run, status: "draft" }); return saved.get(run.id); },
    async update(id, patch) { saved.set(id, { ...saved.get(id), ...patch }); return saved.get(id); }
  };
  const calls = [];
  const workflow = core.createCreativeMarketingWorkflow({ repository,
    images: { async imageDataUrl(url) { return `data:image/png;base64,${url}`; } },
    ai: { async json(_config, request) { calls.push(request); return calls.length === 1
      ? { mainSubject: "Balde de pipoca", focalPoint: "centro", dominantColors: ["vermelho", "amarelo"], safeTextAreas: ["topo"] }
      : { composition: "assimétrica", typography: "sans", palette: ["creme"] }; } }
  });
  const raw = { category: "concessions", format: "feed", facts: { product: "Pipoca" },
    artworkRole: "product", artworkUrl: "/uploads/a.png", referenceUrl: "/uploads/b.png" };
  const visual = await workflow.generate({ raw, source: {}, userId: "qa", aiConfig: { enabled: true, configured: true } });
  assert.equal(calls.length, 2);
  assert.equal(visual.analysis.mainSubject, "Balde de pipoca");
  assert.equal(visual.referenceAnalysis.composition, "assimétrica");
  const compiled = await workflow.compileRun(visual, "recommended");
  assert.equal(compiled.brief.visualAnalysisStatus, "analyzed");
  assert.match(compiled.promptText, /vermelho, amarelo/);
  const manual = await workflow.generate({ raw: { ...raw, artworkUrl: "", referenceUrl: "", artworkRole: "none" },
    source: {}, userId: "qa", aiConfig: null });
  assert.equal(calls.length, 2);
  assert.equal(manual.analysis.mainSubject, undefined);
  assert.equal((await workflow.compileRun(manual, "commercial")).brief.visualAnalysisStatus, "manual_or_unavailable");
});

test("provedor local compatível recebe imagem e JSON sem chave paga", async () => {
  const { createCreativePromptAiProvider } = await import("../backend/services/creativePromptAiProvider.js");
  let called = false;
  const provider = createCreativePromptAiProvider({ fetcher: async (url, options) => {
    called = true;
    assert.equal(url, "http://127.0.0.1:11434/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "vision-local");
    assert.equal(body.messages[1].content[1].type, "image_url");
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, async json() { return { choices: [{ message: { content: '{"mainSubject":"Pipoca"}' } }] }; } };
  } });
  const result = await provider.json({ kind: "local", enabled: true, configured: true,
    baseUrl: "http://127.0.0.1:11434/v1", model: "vision-local" }, {
    system: "Analise", user: "Imagem", imageDataUrl: "data:image/png;base64,abc"
  });
  assert.equal(called, true);
  assert.equal(result.mainSubject, "Pipoca");
});
