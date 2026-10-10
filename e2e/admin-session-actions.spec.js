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
