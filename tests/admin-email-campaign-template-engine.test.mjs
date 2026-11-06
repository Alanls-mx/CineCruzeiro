import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createEmailCampaignTemplateEngine } = require("../backend/public/admin-modules/email-campaign-template-engine.js");

test("campaign template resolution and preview use the selected movie and brand", () => {
  const fields = new Map();
  const $ = (id) => fields.get(id) || null;
  fields.set("emailCampaignTemplate", { value: "premiere" });
  fields.set("emailCampaignMovie", { value: "movie" });
  fields.set("emailBrandName", { value: "Cinema QA" });
  fields.set("emailBrandFooter", { value: "Mensagem QA" });
  fields.set("emailCampaignHeadline", { value: "Estreia QA" });
  const movie = { id: "movie", title: "Filme QA", status: "upcoming", posterUrl: "/poster.webp",
    sessions: [{ date: "2026-11-10", time: "21:55" }] };
  const engine = createEmailCampaignTemplateEngine({
    state: { content: { movies: [movie] } }, $, escapeHtml: String,
    money: (value) => `R$ ${value}`, campaignEditorAssetUrl: String,
    window: { location: { origin: "https://example.test" } }, API_BASE: "https://example.test"
  });
  const resolution = engine.resolveCampaignTemplateClient({ objective: "movie", movie,
    movieIds: ["movie"], concessions: [], recipientMode: "all" });
  assert.equal(resolution.templateId, "premiere");
  const html = engine.campaignTemplateHtml();
  assert.match(html, /Cinema QA/);
  assert.match(html, /Filme QA/);
  assert.match(html, /21:55/);
  assert.match(html, /Mensagem QA/);
});
