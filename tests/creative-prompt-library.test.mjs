import test from "node:test";
import assert from "node:assert/strict";
import library from "../backend/services/creativePromptLibraryService.js";
import core from "../backend/services/creativeMarketingStudioService.js";

test("biblioteca contém 200 estudos nas três categorias compatíveis", () => {
  assert.equal(library.listReferences("films").length, 80);
  assert.equal(library.listReferences("concessions").length, 60);
  assert.equal(library.listReferences("programming").length, 60);
  assert.equal(library.listReferences("promotions").length, 0);
  assert.equal(library.getReference("F001", "concessions"), null);
  assert.equal(library.getReference("F001", "films").lines.length, 25);
});

test("busca recomenda conceitos pertinentes e não copia fatos do exemplo", () => {
  assert.equal(library.recommendReference("concessions", "pipoca salgada").id, "B001");
  assert.equal(library.recommendReference("films", "Minha Melhor Amiga romance editorial").id, "F001");
  assert.equal(library.recommendReference("events", "romance"), null);
  const input = core.normalizeInput({ category: "films", format: "feed", facts: {
    title: "Outro Filme", campaign: "Sessão", sessions: "07/10/2026 20:00"
  }, artworkRole: "none" });
  const variants = core.variantsFor(input, null, library.getReference("F001", "films"));
  const curated = core.curate(input);
  const brief = core.briefFor(input, curated, variants[0], null, null);
  const prompt = core.compile(input, brief, curated);
  assert.match(prompt, /Estudo F001/);
  assert.match(prompt, /Outro Filme/);
  assert.match(prompt, /07\/10\/2026 20:00/);
  assert.doesNotMatch(prompt, /Minha Melhor Amiga|29\/09|15:00|ESCOLHA SUA SESSÃO/);
  assert.equal(brief.libraryReference.id, "F001");
});

test("referência de outra categoria é rejeitada antes de persistir", async () => {
  const workflow = core.createCreativeMarketingWorkflow({
    repository: { async insert() { throw new Error("Não deve persistir"); } }, ai: {}, images: {}
  });
  await assert.rejects(() => workflow.generate({ raw: { category: "concessions", format: "feed",
    facts: { product: "Pipoca" }, referenceId: "F001", artworkRole: "none" }, source: {}, userId: "qa" }),
  /não pertence a esta categoria/);
});

test("fluxo persiste ID da referência e reaproveita seus conceitos na compilação", async () => {
  let persisted;
  const workflow = core.createCreativeMarketingWorkflow({ repository: {
    async insert(run) { persisted = run; return run; },
    async update(_id, patch) { persisted = { ...persisted, ...patch }; return persisted; }
  }, ai: {}, images: {} });
  const run = await workflow.generate({ raw: { category: "films", format: "feed", referenceId: "F001",
    facts: { title: "Outro Filme", campaign: "Teaser" }, artworkRole: "none" }, source: {}, userId: "qa" });
  assert.equal(run.input.libraryReference.id, "F001");
  assert.match(run.variants[0].composition, /Estudo F001/);
  const compiled = await workflow.compileRun(run, "recommended");
  assert.equal(compiled.brief.libraryReference.id, "F001");
  assert.match(compiled.promptText, /Estudo F001/);
  assert.doesNotMatch(compiled.promptText, /Minha Melhor Amiga|29\/09/);
});
