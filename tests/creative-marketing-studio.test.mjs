import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buffer as streamBuffer } from "node:stream/consumers";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import core from "../backend/services/creativeMarketingStudioService.js";
import bundleService from "../backend/services/creativeMarketingBundleService.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));

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

test("datas de catálogo são apresentadas em padrão brasileiro sem alterar textos não temporais", () => {
  assert.equal(core.brazilianFactDate("2026-10-07"), "07/10/2026");
  assert.equal(core.brazilianFactDate("2026-10-07T19:30:00Z"), "07/10/2026 19:30");
  const input = core.normalizeInput({ category: "films", format: "feed", facts: {
    title: "Filme 2026-10-07", campaign: "Sessão", release: "2026-10-07",
    sessions: "2026-10-07 19:30"
  } });
  assert.equal(input.facts.title, "Filme 2026-10-07");
  assert.equal(input.facts.release, "07/10/2026");
  assert.equal(input.facts.sessions, "07/10/2026 19:30");
});

test("abordagens mudam composição, hierarquia e acabamento", () => {
  for (const [category, facts] of [["films", { title: "Filme", campaign: "Teaser" }],
    ["programming", { movies: "Filme A", sessions: "07/10/2026 19:30" }],
    ["concessions", { product: "Pipoca" }]]) {
    const input = core.normalizeInput({ category, format: "feed", facts });
    const variants = core.variantsFor(input);
    assert.equal(new Set(variants.map((v) => v.composition)).size, 3);
    assert.equal(new Set(variants.map((v) => v.hierarchy)).size, 3);
    assert.equal(new Set(variants.map((v) => v.finish)).size, 3);
    const prompts = variants.map((v) => core.compile(input, core.briefFor(input, core.curate(input), v), core.curate(input)));
    assert.equal(new Set(prompts).size, 3);
    const second = core.variantsFor({ ...input, bias: "alternate" });
    assert.notEqual(second[0].composition, variants[0].composition);
  }
});

test("pacote entrega prompt, briefing, artwork, referência e duas assinaturas", async () => {
  const uploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), "creative-bundle-"));
  try {
    await fs.mkdir(path.join(uploadRoot, "creative-prompts"));
    const image = await sharp({ create: { width: 12, height: 12, channels: 3,
      background: { r: 10, g: 40, b: 80 } } }).png().toBuffer();
    for (const name of ["principal.png", "poster.png", "backdrop.png", "referencia.png"])
      await fs.writeFile(path.join(uploadRoot, "creative-prompts", name), image);
    const url = (name) => `/uploads/creative-prompts/${name}.png`;
    const archive = await bundleService.createBundle({
      run: { id: "test-run", briefVersion: 2, category: "films", format: "feed", promptText: "Prompt completo",
        artworkUrl: url("principal"), referenceUrl: url("referencia"), input: {
          request: { facts: { title: "Filme" } },
          sourceAssets: { posterUrl: url("poster"), backdropUrl: url("backdrop") }
        } },
      movie: { posterUrl: url("arte-atualizada"), backdropUrl: url("backdrop-atualizado") }, uploadRoot, publicRoot
    });
    const bytes = await streamBuffer(archive);
    assert.equal(bytes.subarray(0, 2).toString(), "PK");
    for (const filename of ["prompt-canva.txt", "briefing.json", "LEIA-ME.txt", "imagem-principal.png",
      "poster-filme.png", "backdrop-filme.png", "referencia-visual.png", "assinatura-clara.png", "assinatura-escura.png"])
      assert.ok(bytes.includes(Buffer.from(filename)), `${filename} missing`);
  } finally { await fs.rm(uploadRoot, { recursive: true, force: true }); }
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
