import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { chromium } from "@playwright/test";

const source = fs.readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
const functions = [
  "emailCampaignPayload",
  "selectedCampaignMovie",
  "selectedCampaignMovies",
  "selectedCampaignCatalogMovies",
  "selectedCampaignCatalogItem"
].map((name) => {
  const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}).join("\n");

test("weekly email campaign recognizes multiple and automatic movie selections", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <select id="emailCampaignMovie"><option value=""></option></select>
      <select id="emailCampaignMovies" multiple>
        <option value="movie-a">Filme A</option>
        <option value="movie-b" selected>Filme B</option>
      </select>
      <select id="emailCampaignTemplate"><option value="weekly" selected>Semanal</option></select>
      <select id="emailCampaignObjective"><option value="programming" selected>Programação</option></select>
    `);
    await page.evaluate((code) => {
      window.$ = (id) => document.getElementById(id);
      window.state = {
        content: { movies: [
          { id: "movie-a", title: "Filme A", status: "active", sessions: [] },
          { id: "movie-b", title: "Filme B", status: "active", sessions: [] },
          { id: "movie-hidden", title: "Oculto", status: "hidden", sessions: [] }
        ] },
        emailCampaignSelectedIds: new Set(),
        emailCampaignAttachments: [],
        emailCampaignVariables: {},
        emailCampaignTemplateSelectionMode: "automatic",
        emailCampaignIdempotencyKey: "test",
        emailCampaignUseCanonicalHtml: false
      };
      window.templateLayout = "weekly";
      window.campaignTemplateDefinition = () => ({ catalog: "movie", layout: window.templateLayout });
      window.campaignTemplateVariant = () => null;
      window.campaignPreviewVariables = () => ({});
      window.campaignTemplateHtml = () => "<p>Programação</p>";
      window.campaignCanonicalHtmlWithEdits = () => "";
      window.campaignTemplateAbsoluteUrl = (value) => value || "";
      window.eval(code);
    }, functions);

    const explicit = await page.evaluate(() => ({
      catalog: selectedCampaignCatalogItem().map((movie) => movie.id),
      payload: emailCampaignPayload().movieIds
    }));
    assert.deepEqual(explicit, { catalog: ["movie-b"], payload: ["movie-b"] });

    const automatic = await page.evaluate(() => {
      for (const option of $("emailCampaignMovies").options) option.selected = false;
      return {
        catalog: selectedCampaignCatalogItem().map((movie) => movie.id),
        payload: emailCampaignPayload().movieIds
      };
    });
    assert.deepEqual(automatic, { catalog: ["movie-a", "movie-b"], payload: ["movie-a", "movie-b"] });

    const missingSingleMovie = await page.evaluate(() => {
      window.templateLayout = "premiere";
      return selectedCampaignCatalogItem();
    });
    assert.equal(missingSingleMovie, null);
  } finally {
    await browser.close();
  }
});
