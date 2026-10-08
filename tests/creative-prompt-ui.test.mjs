import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import core from "../backend/services/creativeMarketingStudioService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = path.join(root, "backend", "public", "admin.html");
const script = path.join(root, "backend", "public", "creative-prompt-studio.js");

test("Studio dentro de Marketing mostra campos contextuais, gera prompt e cabe no celular", {
  skip: !fs.existsSync(chromium.executablePath())
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route(/(?:admin|creative-prompt-studio)\.js/, (route) => route.abort());
      await page.goto(new URL(`file:///${html.replaceAll("\\", "/")}`).href);
      await page.evaluate(() => {
        document.body.classList.remove("admin-booting");
        document.getElementById("marketingPanel").classList.add("active");
        const studio = document.getElementById("creativePromptPanel");
        studio.hidden = false;
        studio.classList.add("active");
        document.querySelector('[data-admin-tab-panel="marketing:overview"]').hidden = true;
        document.querySelector('[data-admin-tab="overview"]').classList.remove("active");
        document.querySelector('[data-admin-tab="creative"]').classList.add("active");
        window.state = { adminSubtabs: { marketing: "creative" }, content: {
          movies: [{ id: "film-1", title: "Minha Melhor Amiga", posterUrl: "/images/film.jpg", sessions: [] }],
          concessions: [{ id: "prod-1", name: "Combo Pipoca", price: 34.9, comboItems: [{ name: "Pipoca", quantity: 1 }] }],
          promotions: [] } };
        const baseRun = { id: "11111111-1111-4111-8111-111111111111", briefVersion: 2,
          category: "concessions", artworkSource: "none", artworkUrl: "", referenceUrl: "",
          campaignType: "concessions", format: "feed", density: "auto", selectedVariant: "",
          input: { request: { category: "concessions", format: "feed", density: "auto", facts: { product: "Combo Pipoca" } } },
          status: "draft", promptText: "", variants: [{ id: "recommended", label: "Recomendada",
            summary: "Produto em destaque", artDirection: "Fotografia comercial" }] };
        window.api = async (url) => {
          if (url.endsWith("/categories")) return { categories: window.testCatalog };
          if (url.endsWith("/status")) return { databaseReady: true, configured: false, enabled: false };
          if (url.endsWith("/history")) return { runs: [] };
          if (url.endsWith("/directions")) return { run: baseRun };
          if (url.endsWith("/compile")) return { run: { ...baseRun, selectedVariant: "recommended", status: "ready",
            promptText: "OBJETIVO\nCombo Pipoca com dados exatos.", brief: { version: 2, category: "concessions",
              artDirection: "Produto protagonista", palette: "Cores reais", density: "balanced",
              composition: "Fotografia comercial", finish: "Luz quente", visualAnalysisStatus: "manual_or_unavailable" } } };
          throw new Error(`API inesperada: ${url}`);
        };
      });
      await page.evaluate((categories) => { window.testCatalog = categories; }, core.CATEGORIES);
      await page.addScriptTag({ path: script });
      await page.evaluate(() => document.dispatchEvent(new CustomEvent("admin:subtab", {
        detail: { group: "marketing", tab: "creative" }
      })));
      await page.locator("#creativePromptCategory").selectOption("concessions");
      assert.ok(await page.locator("#creativeMarketingFact_product").isVisible());
      assert.equal(await page.locator("#creativeMarketingFact_code").count(), 0);
      assert.equal(await page.locator("#creativeMarketingFact_size").isVisible(), false);
      await page.locator(".creative-prompt-context-extra summary").click();
      assert.ok(await page.locator("#creativeMarketingFact_size").isVisible());
      await page.locator(".creative-prompt-context-extra summary").click();
      await page.locator("#creativePromptSource").selectOption("prod-1");
      assert.equal(await page.locator("#creativeMarketingFact_product").inputValue(), "Combo Pipoca");
      await page.locator('input[name="creativePromptArtwork"][value="none"]').check();
      await page.locator("#creativePromptGenerate").click();
      await page.locator('[data-creative-variant="recommended"]').click();
      assert.equal(await page.locator("#creativePromptText").inputValue(), "OBJETIVO\nCombo Pipoca com dados exatos.");
      assert.ok(await page.locator("#creativePromptDownload").isVisible());
      assert.match(await page.locator("#creativePromptProviderStatus").textContent(), /Modo manual/);
      await page.screenshot({ path: path.join(os.tmpdir(), `creative-marketing-${width}.png`), fullPage: true });
      await page.locator("#creativePromptCategory").selectOption("coupons");
      assert.ok(await page.locator("#creativeMarketingFact_code").isVisible());
      assert.equal(await page.locator("#creativeMarketingFact_product").count(), 0);
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(widths.scroll <= widths.viewport, `overflow horizontal em ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
});
