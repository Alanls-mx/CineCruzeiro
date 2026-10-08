import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import repository from "../backend/repositories/creativePromptRepository.js";
import postgres from "../backend/db/postgresStore.js";

after(() => postgres.closePostgres());

test("Creative Prompt Studio persiste histórico no PostgreSQL", {
  skip: !process.env.DATABASE_URL && !process.env.POSTGRES_URL
}, async () => {
  const id = randomUUID();
  try {
    const inserted = await repository.insert({
      id, movieId: "creative-prompt-test-movie", createdBy: "creative-prompt-test-admin",
      campaignType: "teaser", format: "feed", density: "minimal",
      artworkSource: "poster", artworkUrl: "/images/test.jpg", referenceUrl: "",
      input: { request: { campaignType: "teaser" }, movie: { title: "Filme teste" } },
      analysis: { focalPoint: "centro" }, referenceAnalysis: null,
      variants: [{ id: "recommended", summary: "teste" }]
    });
    assert.equal(inserted.status, "draft");
    assert.deepEqual(inserted.analysis, { focalPoint: "centro" });
    assert.ok(!(await repository.list()).some((item) => item.id === id));
    const ready = await repository.update(id, { status: "ready", selectedVariant: "recommended",
      brief: { artDirection: "editorial" }, curatedContent: { primary: "Filme teste" },
      promptText: "Prompt de teste" });
    assert.equal(ready.promptText, "Prompt de teste");
    assert.ok((await repository.list()).some((item) => item.id === id));
    const saved = await repository.update(id, { status: "saved" });
    assert.equal(saved.status, "saved");
    assert.deepEqual((await repository.get(id)).brief, { artDirection: "editorial" });
  } finally {
    await postgres.queryPostgres("DELETE FROM creative_prompt_studio_runs WHERE id = $1", [id]);
  }
});

test("Creative Marketing Studio persiste categoria sem filme e brief versionado", {
  skip: !process.env.DATABASE_URL && !process.env.POSTGRES_URL
}, async () => {
  const id = randomUUID();
  try {
    const inserted = await repository.insert({
      id, movieId: null, category: "coupons", briefVersion: 2,
      createdBy: "creative-marketing-test-admin", campaignType: "coupons",
      format: "square", density: "informative", artworkSource: "none", artworkUrl: "",
      referenceUrl: "", input: { request: { category: "coupons", facts: { code: "TESTE10" } } },
      analysis: {}, referenceAnalysis: null, variants: [{ id: "recommended", summary: "Cupom" }]
    });
    assert.equal(inserted.category, "coupons");
    assert.equal(inserted.briefVersion, 2);
    assert.equal(inserted.movieId, null);
    const ready = await repository.update(id, { brief: { version: 2, category: "coupons" },
      curatedContent: { required: ["TESTE10"] }, promptText: "Código exato TESTE10", status: "ready" });
    assert.equal(ready.brief.version, 2);
    assert.ok((await repository.list()).some((item) => item.id === id && item.category === "coupons"));
  } finally {
    await postgres.queryPostgres("DELETE FROM creative_prompt_studio_runs WHERE id = $1", [id]);
  }
});
