const { test, expect } = require("@playwright/test");

test("agenda abre o editor da sessao sem erros de script", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("http://127.0.0.1:4000/admin");
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("http://127.0.0.1:4000/admin#roomsPanel");
  await page.locator('[data-admin-tab="schedule"]').click();
  const edit = page.locator('[data-admin-session-action="global-edit"][data-admin-session-id="sessao-e2e"]');
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.locator("#sessionEditor")).toBeVisible();
  await expect(page.locator("#sessionEditorTitle")).toHaveText("Editar sessão");
  expect(pageErrors).toEqual([]);
});

test("dashboard atualiza repasse de ingressos apos extracao do modulo", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const registrations = {};
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const target = this === document ? "document" : this.id;
      if (target && ["document", "ticketFinanceRefresh", "movieCatalogSearch", "manualTicketForm", "logsRefreshButton"].includes(target)) {
        const key = `${target}:${type}`;
        registrations[key] = (registrations[key] || 0) + 1;
      }
      return original.call(this, type, listener, options);
    };
    window.__adminEventRegistrations = registrations;
  });
  await page.goto("http://127.0.0.1:4000/admin");
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.locator("#ticketFinanceRows")).toBeVisible();
  const before = await page.evaluate(() => ({ ...window.__adminEventRegistrations }));
  expect(before["document:click"]).toBeGreaterThan(0);
  expect(before["ticketFinanceRefresh:click"]).toBe(1);
  expect(before["movieCatalogSearch:input"]).toBe(1);
  await page.evaluate(() => Promise.all([window.initAdmin(), window.initAdmin()]));
  await page.getByRole("button", { name: "Bilheteria", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  expect(await page.evaluate(() => ({ ...window.__adminEventRegistrations }))).toEqual(before);
  let reportRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("/api/admin/reports/ticket-distributor?")) reportRequests += 1;
  });
  await page.locator("#ticketFinanceRefresh").click();
  await expect.poll(() => reportRequests).toBe(1);
  await expect(page.locator("#ticketFinanceRows")).not.toContainText("Atualizando apuração...");
  await expect(page.locator("#ticketFinanceQuantity")).not.toHaveText("—");
  expect(pageErrors).toEqual([]);
});
