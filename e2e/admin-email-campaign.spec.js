const { test, expect } = require("@playwright/test");

async function loginAdmin(page) {
  await page.goto("http://127.0.0.1:4000/admin");
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test("operador escolhe o objetivo e prepara uma campanha de bomboniere", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.getByRole("button", { name: "Marketing", exact: true }).click();
  await page.locator('[data-admin-tab="campaigns"]').click();

  const objective = page.getByRole("radiogroup", { name: "Objetivo da campanha" });
  await expect(objective).toBeVisible();
  await objective.getByRole("radio", { name: /Bomboniere/ }).click();
  await expect(page.locator("#emailCampaignObjective")).toHaveValue("concession");
  await page.locator('[data-campaign-step="content"]').click();
  await expect(page.locator("#emailCampaignSubject")).toBeVisible();
  await expect(page.locator("#emailCampaignConcessions")).toBeVisible();
});

test("integração de e-mail pode ser configurada no painel", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: "Integrações", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Central de Integrações" })).toBeVisible();
  await expect(page.locator('[data-integration-action="config"][data-integration-key="email"]')).toBeVisible();
});
