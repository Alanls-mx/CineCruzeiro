import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { scoreComposition } = require("../backend/services/social-studio/composition-engine/score");
const { campaignHierarchy } = require("../backend/services/social-studio/composition-engine/hierarchy");
const { polishComposition } = require("../backend/services/social-studio/composition-engine/polish");
const { buildEditableScene } = require("../backend/services/social-studio/scene/factory");
const { normalizeV2Draft } = require("../backend/services/social-studio/engine/normalizer");
const context = { brand: { name: "Cine Cruzeiro", website: "www.cinecruzeiro.com.br" }, movies: [{ id: "movie", title: "A grande aventura", genre: "Animação", releaseDate: "2026-10-22" }] };
function fixture(formatId = "feed_portrait", title) {
  const draft = normalizeV2Draft({ templateId: "movie-premiere", movieId: "movie", title, style: "hero-left", date: "22 DE OUTUBRO", auxiliaryText: "" }, context);
  const scene = buildEditableScene({ draft, format: { id: formatId, width: 1080, height: formatId === "story" ? 1920 : 1350 }, brand: context.brand, palette: { dominantColor: "#123456", accentColor: "#abcdef" }, sourceUrl: "asset://poster", logoUrl: "asset://logo" });
  scene.elements.filter(element => element.type === "text").forEach(element => { element.contrastRatio = 7; });
  return scene;
}
test("a mesma prioridade orienta composição e curadoria por campanha", () => {
  for (const templateId of ["movie-premiere", "movie-presale", "movie-price", "concession-combo", "club-plan"]) assert.equal(campaignHierarchy({ templateId }).primary, "detail");
  assert.equal(campaignHierarchy({ templateId: "movie-highlight" }).primary, "title");
  assert.equal(campaignHierarchy({ templateId: "online-ticket" }).primary, "title");
  assert.equal(campaignHierarchy({ templateId: "movie-premiere", artDirection: { emphasis: "film" } }).primary, "title");
});
test("clareza comercial e leitura vencem versões sem título, CTA ou contraste", () => {
  const scene = fixture(), good = scoreComposition(scene);
  const poor = structuredClone(scene);
  poor.elements = poor.elements.filter(element => !["title", "cta"].includes(element.id));
  poor.elements.filter(element => element.type === "text").forEach(element => { element.fontSize = 12; element.contrastRatio = 1.2; });
  const bad = scoreComposition(poor);
  assert.ok(good.total > bad.total + 15);
  assert.ok(good.commercialClarity > bad.commercialClarity);
  assert.ok(good.readability > bad.readability);
});
test("o acabamento preserva texto, deixa marca e site dentro da área de stories e é determinístico", () => {
  const scene = fixture("story", "Uma história extraordinária de amizade e aventuras inesquecíveis");
  const polished = polishComposition(scene);
  assert.deepEqual(polished, polishComposition(scene));
  for (const element of polished.elements.filter(element => ["logo", "cinema", "website", "cta", "title"].includes(element.id))) {
    assert.ok(element.x >= 1080 * .06);
    assert.ok(element.y + element.height <= 1920 * .89);
    assert.ok(element.width > 0 && element.height > 0);
    if (element.type === "text") assert.equal(element.text.replace(/\s/g, ""), scene.elements.find(item => item.id === element.id).text.replace(/\s/g, ""));
  }
});
test("preferência por gênero não compensa uma peça comercialmente ilegível", () => {
  const scene = fixture(); scene.visualMetrics = { brightness: .1, chroma: .04 };
  scene.sourceDraft.genreProfile.id = "horror";
  const horror = scoreComposition(scene);
  scene.sourceDraft.genreProfile.id = "family";
  const family = scoreComposition(scene);
  assert.ok(horror.genreFit > family.genreFit);
  const illegible = structuredClone(scene);
  illegible.visualMetrics = { brightness: .4, chroma: .3 };
  illegible.elements.filter(element => element.type === "text").forEach(element => { element.fontSize = 10; element.contrastRatio = 1; });
  assert.ok(scoreComposition(illegible).total < family.total);
});
