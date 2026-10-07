import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

test("Studio alterna entre IA e templates e mostra categorias sem exigir filme", async () => {
  const html = await readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  const start = html.indexOf('<section id="studioPanel"');
  const end = html.indexOf('<section id="clubPanel"', start);
  assert.ok(start > 0 && end > start);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<style>[hidden]{display:none!important}</style>${html.slice(start, end)}`);
    await page.evaluate(() => {
      window.state = { adminUser: { role: "owner" } };
      window.API_BASE = "";
      window.api = async (url) => url.endsWith("/overview") ? {
        configured: true, connection: { connected: true, accountId: "canva-1" }, mcpConnection: { connected: true },
        mcpRedirectUri: "https://example.com/api/admin/canva-studio/mcp/callback",
        concessions: [{ id: "combo-1", name: "Combo" }], promotions: [{ id: "promo-1", name: "Terça especial" }],
        movies: [{ id: "film-1", title: "Minha Melhor Amiga", posterUrl: "/images/poster.png", sessions: [{ id: "session-1", date: "2026-10-09", time: "19:00" }] }]
      } : { campaigns: [] };
    });
    await page.addScriptTag({ path: fileURLToPath(new URL("../backend/public/canva-studio.js", import.meta.url)) });
    await page.evaluate(() => document.dispatchEvent(new CustomEvent("admin:panel", { detail: { panel: "studioPanel" } })));
    await page.getByRole("button", { name: "Criar com IA" }).first().waitFor();
    assert.equal(await page.locator("#studioCreateButton").isDisabled(), false);
    await page.locator("#studioKind").selectOption("concessions");
    assert.equal(await page.locator("#studioMovieField").isVisible(), false);
    assert.equal(await page.locator("#studioItemField").isVisible(), true);
    assert.equal(await page.locator("#studioItem option").count(), 2);
    await page.locator("#studioKind").selectOption("other");
    assert.equal(await page.locator("#studioItemField").isVisible(), false);
    assert.equal(await page.locator("#studioPrompt").getAttribute("required"), "");
    assert.equal(await page.locator("#studioPromptField").isVisible(), true);
    await page.locator('[data-studio-mode="template"]').click();
    assert.equal(await page.locator("#studioMovieField").isVisible(), true);
    assert.equal(await page.locator("#studioPromptField").isVisible(), false);
  } finally { await browser.close(); }
});
