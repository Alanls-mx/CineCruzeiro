const { test, expect } = require("@playwright/test");

async function loginAdmin(page) {
  await page.goto("http://127.0.0.1:4000/admin");
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test("operador escolhe OpenAI ou Gemini para gerar a campanha", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page);
  await page.getByRole("button", { name: "Marketing", exact: true }).click();
  await page.locator('[data-admin-tab="campaigns"]').click();

  const provider = page.locator("#emailCampaignAiProvider");
  await expect(provider).toBeVisible();
  await expect(provider.locator("option")).toHaveText(["OpenAI", "Google Gemini"]);
  await provider.selectOption("gemini");
  await expect(provider).toHaveValue("gemini");
});

test("Gemini aparece como integração configurável", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: "Integrações", exact: true }).click();
  await expect(page.getByText("Gemini para campanhas", { exact: true })).toBeVisible();
  await expect(page.getByText("IA para campanhas", { exact: true }).first()).toBeVisible();
});
