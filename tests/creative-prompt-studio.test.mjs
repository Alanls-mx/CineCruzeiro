import test from "node:test";
import assert from "node:assert/strict";
import core from "../backend/services/creativePromptStudioService.js";
import workflowModule from "../backend/services/creativePromptWorkflow.js";
import imageModule from "../backend/services/creativePromptImageService.js";
import aiModule from "../backend/services/creativePromptAiProvider.js";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const baseMovie = {
  id: "movie-1", title: "Minha Melhor Amiga", originalTitle: "",
  posterUrl: "/uploads/movies/poster.jpg", backdropUrl: "/uploads/movies/backdrop.jpg",
  genre: ["Comédia"], synopsis: "Duas amigas reencontram a cidade.",
  rating: "12", duration: "105 min", releaseDate: "2026-09-29",
  cinemaName: "Cine Cruzeiro",
  sessions: [{ id: "s-1", date: "2026-09-29", time: "15:00" }]
};

function analysis(overrides = {}) {
  return {
    peopleCount: 2, mainSubject: "duas amigas em primeiro plano",
    subjectPositions: ["ambas à direita"], gazeDirection: "à esquerda",
    negativeSpace: ["céu à esquerda"], focalPoint: "rostos no centro-direita",
    depth: "praça em profundidade", environment: "praça urbana",
    lighting: "pôr do sol suave", contrast: "moderado",
    dominantColors: ["coral", "rosa", "creme"], characteristicColors: ["azul da roupa"],
    temperature: "quente", atmosphere: "leve e afetiva", perceivedGenre: "comédia humana",
    safeTextAreas: ["céu livre à esquerda"], avoidTextAreas: ["rostos à direita"],
    titleLockup: { strength: "strong", evidence: "letras próprias integradas à imagem", location: "parte inferior" },
    confidence: 0.87, ...overrides
  };
}

function variants({ style = "editorial afetivo", composition = "título no céu à esquerda", palette = "coral, rosa e creme" } = {}) {
  return { variants: ["recommended", "cinematic", "bold"].map((id) => ({
    id, summary: `${style}, ${id}`, artDirection: `${style} com presença de fotografia`,
    mood: "proximidade emocional", visualHierarchy: "rostos, título e data em sequência",
    artworkRole: "fotografia dominante", titleRole: "elemento de assinatura",
    titleMode: "preserve", titleScale: "grande, sem cobrir rostos",
    recommendedDensity: "minimal",
    paletteDirection: palette, typographyDirection: "serif display calorosa com apoio sans",
    informationDensity: "poucos dados, leitura clara", ctaTreatment: "texto compacto",
    statusTreatment: "discreto junto ao título", sessionTreatment: "data agrupada ao CTA",
    backgroundTreatment: "luz derivada do cenário", premiumFinish: "grão fino e fade atmosférico",
    composition, visualRestrictions: ["não cobrir os rostos"], rationale: "preserva a identidade da obra"
  })) };
}

test("Visual Analyzer normaliza observações e não cria identidades", () => {
  const result = core.normalizeAnalysis(analysis());
  assert.equal(result.peopleCount, 2);
  assert.deepEqual(result.safeTextAreas, ["céu livre à esquerda"]);
  assert.equal(result.titleLockup.strength, "strong");
  assert.throws(() => core.normalizeAnalysis({ dominantColors: [] }), /incompleta/i);
  assert.deepEqual(core.normalizeAnalysis(analysis({ safeTextAreas: [] })).safeTextAreas, []);
});

test("title mode preserva lockup forte e recompõe quando não detectado", () => {
  const strong = core.normalizeVariants(variants(), core.normalizeAnalysis(analysis()));
  assert.ok(strong.every((item) => item.titleMode === "preserve"));
  const absent = core.normalizeVariants(variants(), core.normalizeAnalysis(analysis({ titleLockup: { strength: "not_detected" } })));
  assert.ok(absent.every((item) => item.titleMode === "recompose"));
});

test("Content Curator distingue densidade e não inventa sessão ou estreia", () => {
  const teaser = core.normalizeRequest({ campaignType: "teaser", format: "feed", artworkSource: "poster" }, baseMovie);
  const curated = core.curateContent(baseMovie, teaser, variants().variants[0]);
  assert.equal(curated.density, "minimal");
  assert.equal(curated.action, "");
  assert.equal(curated.secondary.releaseDate, "");
  assert.throws(() => core.normalizeRequest({ campaignType: "session", format: "feed", artworkSource: "poster" }, baseMovie), /sessão cadastrada/i);
  const session = core.normalizeRequest({ campaignType: "session", format: "story", sessionId: "s-1" }, baseMovie);
  assert.equal(core.curateContent(baseMovie, session, {}).secondary.schedule, "29/09/2026 às 15:00");
  const program = core.normalizeRequest({ campaignType: "programming", format: "landscape" }, baseMovie);
  assert.deepEqual(core.curateContent(baseMovie, program, {}).secondary.programming, ["29/09/2026 às 15:00"]);
  assert.equal(core.curateContent(baseMovie, program, { recommendedDensity: "minimal" }).density, "informative");
  assert.equal(core.curateContent(baseMovie, session, { recommendedDensity: "minimal" }).density, "balanced");
});

test("Prompt Compiler entrega seções, formato, texto exato e QA", () => {
  const request = core.normalizeRequest({ campaignType: "session", format: "story", sessionId: "s-1",
    tagline: "Uma história para ver acompanhado", cta: "Escolha sua sessão" }, baseMovie);
  const visual = core.normalizeAnalysis(analysis());
  const variant = core.normalizeVariants(variants(), visual)[0];
  const curated = core.curateContent(baseMovie, request, variant);
  const brief = core.makeBrief(variant, visual, null, curated, request);
  const result = core.compileWithQa({ movie: baseMovie, request, analysis: visual, reference: null, brief, curated });
  assert.equal(result.qa.ok, true);
  for (const label of core.SECTION_LABELS) assert.ok(result.prompt.includes(`${label}\n`));
  assert.match(result.prompt, /Story vertical 9:16/);
  assert.match(result.prompt, /Minha Melhor Amiga/);
  assert.match(result.prompt, /29\/09\/2026 às 15:00/);
  assert.match(result.prompt, /preserve.*lockup/i);
  assert.doesNotMatch(result.prompt, /R\$\s*\d|www\.exemplo/i);
  assert.equal(core.qaPrompt("pouco texto", { request, curated, brief }).ok, false);
  const conflicted = core.compileWithQa({ movie: baseMovie, request, analysis: visual, reference: null,
    brief: { ...brief, titleRole: "redesenhar o título", composition: "recriar o lockup" }, curated });
  assert.equal(conflicted.qa.ok, true);
  assert.doesNotMatch(conflicted.prompt, /redesenhar o título|recriar o lockup/i);
  const invented = core.compileWithQa({ movie: baseMovie, request, analysis: visual, reference: null,
    brief: { ...brief, artDirection: "estreia às 20:00 por R$ 30,00" }, curated });
  assert.doesNotMatch(invented.prompt, /R\$ 30,00|20:00/);
  const withoutSafeArea = core.normalizeAnalysis(analysis({ safeTextAreas: [] }));
  const fallback = core.compileWithQa({ movie: baseMovie, request, analysis: withoutSafeArea,
    reference: null, brief, curated });
  assert.match(fallback.prompt, /Nenhuma área segura para texto foi confirmada/);
});

test("formatos e textos fornecidos permanecem explícitos no prompt", () => {
  for (const [format, label] of Object.entries(core.FORMATS)) {
    const request = core.normalizeRequest({ campaignType: "upcoming", format, density: "balanced",
      message: "Destacar a cumplicidade", tagline: "Uma amizade para sempre", siteUrl: "cinecruzeiro.com.br" }, baseMovie);
    const visual = core.normalizeAnalysis(analysis());
    const direction = core.normalizeVariants(variants(), visual)[0];
    const curated = core.curateContent(baseMovie, request, direction);
    const brief = core.makeBrief(direction, visual, null, curated, request);
    const { prompt } = core.compileWithQa({ movie: baseMovie, request, analysis: visual, reference: null, brief, curated });
    assert.ok(prompt.includes(label));
    for (const supplied of ["Destacar a cumplicidade", "Uma amizade para sempre", "cinecruzeiro.com.br"])
      assert.ok(prompt.includes(supplied));
    assert.doesNotMatch(prompt, /R\$\s*\d/);
  }
});

test("provedor mantém credencial no backend e valida resposta estruturada", async () => {
  const calls = [];
  const provider = aiModule.createCreativePromptAiProvider({ fetcher: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ status: "completed", output: [{ content: [{ type: "output_text", text: '{"ok":true}' }] }] }),
      { status: 200, headers: { "content-type": "application/json" } });
  } });
  await assert.rejects(() => provider.json({ enabled: false }, { system: "s", user: "u" }), /Configure/i);
  const result = await provider.json({ enabled: true, apiKey: "test-secret", model: "gpt-4.1-mini" },
    { system: "analyze", user: "artwork", imageDataUrl: "data:image/jpeg;base64,AAAA" });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-secret");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.store, false);
  assert.equal(body.input[0].content[1].type, "input_image");
  const broken = aiModule.createCreativePromptAiProvider({ fetcher: async () => new Response("não é JSON", { status: 200 }) });
  await assert.rejects(() => broken.json({ enabled: true, apiKey: "test-secret" },
    { system: "s", user: "u" }), (error) => error.code === "CREATIVE_PROMPT_AI_INVALID_RESPONSE");
});

test("imagens são validadas, reduzidas e limitadas a origens autorizadas", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "creative-prompt-test-"));
  try {
    await fs.mkdir(path.join(root, "creative-prompts"));
    const image = await sharp({ create: { width: 2100, height: 1000, channels: 3,
      background: { r: 10, g: 120, b: 170 } } }).png().toBuffer();
    await fs.writeFile(path.join(root, "creative-prompts", "art.png"), image);
    const dataUrl = await imageModule.imageDataUrl("/uploads/creative-prompts/art.png?v=2", {
      uploadRoot: root, publicRoot: root, uploadOnly: true
    });
    assert.match(dataUrl, /^data:image\/jpeg;base64,/);
    const meta = await sharp(Buffer.from(dataUrl.split(",")[1], "base64")).metadata();
    assert.equal(meta.width, 1600);
    await assert.rejects(() => imageModule.imageDataUrl("https://example.com/evil.png", {
      uploadRoot: root, publicRoot: root
    }), /catálogo permitido/i);
    await assert.rejects(() => imageModule.imageDataUrl("/uploads/creative-prompts/../secret.png", {
      uploadRoot: root, publicRoot: root, uploadOnly: true
    }), /armazenamento autorizado/i);
    await assert.rejects(() => imageModule.imageDataUrl("https://image.tmdb.org/t/p/w500/a.jpg", {
      uploadRoot: root, publicRoot: root,
      fetcher: async () => new Response("", { status: 200,
        headers: { "content-length": String(imageModule.MAX_SOURCE_BYTES + 1) } })
    }), /6 MB/i);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("referência é analisada separadamente e histórico mantém prompt", async () => {
  const calls = [];
  const records = new Map();
  const repository = {
    async insert(value) { const row = { ...value, status: "draft", promptText: "", createdAt: new Date().toISOString() }; records.set(row.id, row); return row; },
    async update(id, patch) { const row = { ...records.get(id), ...patch }; records.set(id, row); return row; },
    async get(id) { return records.get(id); }
  };
  const ai = { async json(_config, call) {
    calls.push(call);
    if (call.system.includes("Visual Analyzer")) return analysis();
    if (call.system.includes("referência visual")) return {
      composition: "assimétrica", titlePosition: "à esquerda", photoTextRatio: "70/30",
      typography: "serif", density: "baixa", palette: ["coral"], atmosphere: "suave",
      treatments: ["fade"], finish: "grão fino"
    };
    return variants();
  } };
  const images = { async imageDataUrl(url, options) { return `data:image/jpeg;base64,${Buffer.from(`${url}:${options.uploadOnly}`).toString("base64")}`; } };
  const workflow = workflowModule.createCreativePromptWorkflow({ ai, images, repository });
  const run = await workflow.generate({ config: { enabled: true, apiKey: "mock" }, movie: baseMovie,
    input: { campaignType: "premiere", format: "feed", referenceUrl: "/uploads/creative-prompts/ref.png" },
    userId: "admin", imageOptions: {} });
  assert.equal(calls.length, 3);
  assert.match(calls.find((call) => call.system.includes("Visual Analyzer")).user, /Minha Melhor Amiga/);
  assert.ok(run.referenceAnalysis);
  const compiled = await workflow.compile({ run, movie: baseMovie, variantId: "recommended" });
  assert.ok(compiled.promptText.length > 2500);
  assert.equal((await repository.get(run.id)).promptText, compiled.promptText);
  await assert.rejects(() => workflow.compile({ run, movie: baseMovie, variantId: "unknown" }), /direção criativa válida/i);
  const repeated = await workflow.generate({ config: { enabled: true, apiKey: "mock" }, movie: baseMovie,
    input: { campaignType: "premiere", format: "feed", referenceUrl: "/uploads/creative-prompts/ref.png",
      artworkSource: "poster", bias: "alternate" },
    userId: "admin", imageOptions: {}, sourceRun: run });
  assert.notEqual(repeated.id, run.id);
  assert.equal(calls.length, 4);
});

test("campanhas visualmente diferentes geram direção específica, sem nomes hardcoded no núcleo", () => {
  const cases = [
    { movie: { ...baseMovie, title: "Resident Evil" }, visual: analysis({ peopleCount: 1, dominantColors: ["preto carvão", "amarelo contaminado"],
      atmosphere: "ameaça noturna", lighting: "contraluz duro", titleLockup: { strength: "not_detected" } }),
      variant: variants({ style: "thriller tenso", composition: "assimetria com fuga à direita", palette: "carvão e amarelo contaminado" }) },
    { movie: { ...baseMovie, title: "Homem-Aranha" }, visual: analysis({ dominantColors: ["vermelho", "azul profundo"],
      atmosphere: "aventura blockbuster", safeTextAreas: ["céu superior"], titleLockup: { strength: "not_detected" } }),
      variant: variants({ style: "blockbuster cinemático", composition: "arte full bleed e título no céu", palette: "vermelho e azul da arte" }) },
    { movie: { ...baseMovie, title: "Doutor Destino" }, visual: analysis({ dominantColors: ["verde esmeralda", "dourado", "preto"],
      atmosphere: "épica e solene", safeTextAreas: ["arco superior"], titleLockup: { strength: "not_detected" } }),
      variant: variants({ style: "épico premium", composition: "simetria monumental", palette: "verde, dourado e preto da imagem" }) }
  ];
  const prompts = cases.map(({ movie, visual, variant }) => {
    const request = core.normalizeRequest({ campaignType: "upcoming", format: "feed" }, movie);
    const analyzed = core.normalizeAnalysis(visual);
    const direction = core.normalizeVariants(variant, analyzed)[0];
    const curated = core.curateContent(movie, request, direction);
    const brief = core.makeBrief(direction, analyzed, null, curated, request);
    return core.compileWithQa({ movie, request, analysis: analyzed, reference: null, brief, curated }).prompt;
  });
  assert.match(prompts[0], /thriller tenso|ameaça noturna/);
  assert.match(prompts[1], /full bleed|blockbuster/);
  assert.match(prompts[2], /verde esmeralda|épico premium/);
  assert.notEqual(prompts[0].replaceAll("Resident Evil", ""), prompts[1].replaceAll("Homem-Aranha", ""));
});
