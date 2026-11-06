import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

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
    await page.addScriptTag({ path: fileURLToPath(new URL("../backend/public/admin-modules/email-campaign-template-engine.js", import.meta.url)) });
    await page.addScriptTag({ path: fileURLToPath(new URL("../backend/public/admin-modules/email-campaign-editor.js", import.meta.url)) });
    await page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      const state = {
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
      const engine = window.CineAdminModules.emailCampaignTemplateEngine.createEmailCampaignTemplateEngine({
        state, $, escapeHtml: (value) => String(value), money: (value) => String(value),
        campaignEditorAssetUrl: (value) => value, window, API_BASE: "https://example.test"
      });
      const editor = window.CineAdminModules.emailCampaignEditor.createEmailCampaignEditor({
        state, $, API_BASE: "https://example.test", campaignTemplateDefinition: engine.campaignTemplateDefinition,
        campaignTemplateVariant: engine.campaignTemplateVariant, campaignTemplateAbsoluteUrl: engine.campaignTemplateAbsoluteUrl,
        campaignTemplateHtml: () => "<p>Programação</p>", selectedCampaignMovie: engine.selectedCampaignMovie,
        selectedCampaignMovies: engine.selectedCampaignMovies, selectedCampaignConcessions: engine.selectedCampaignConcessions,
        selectedCampaignClubPlan: engine.selectedCampaignClubPlan, money: (value) => String(value), couponRuleLabel: () => ""
      });
      window.campaignTest = { engine, editor };
    });

    const explicit = await page.evaluate(() => ({
      catalog: window.campaignTest.engine.selectedCampaignCatalogItem().map((movie) => movie.id),
      payload: window.campaignTest.editor.emailCampaignPayload().movieIds
    }));
    assert.deepEqual(explicit, { catalog: ["movie-b"], payload: ["movie-b"] });

    const automatic = await page.evaluate(() => {
      for (const option of document.getElementById("emailCampaignMovies").options) option.selected = false;
      return {
        catalog: window.campaignTest.engine.selectedCampaignCatalogItem().map((movie) => movie.id),
        payload: window.campaignTest.editor.emailCampaignPayload().movieIds
      };
    });
    assert.deepEqual(automatic, { catalog: ["movie-a", "movie-b"], payload: ["movie-a", "movie-b"] });

    const missingSingleMovie = await page.evaluate(() => {
      document.getElementById("emailCampaignTemplate").innerHTML = '<option value="premiere" selected>Estreia</option>';
      return window.campaignTest.engine.selectedCampaignCatalogItem();
    });
    assert.equal(missingSingleMovie, null);
  } finally {
    await browser.close();
  }
});
