const { test, expect } = require("@playwright/test");

test("navegacao publica e conta carregam sem erro", async ({ page }) => {
  await page.goto("/filmes");
  await expect(page.getByRole("heading", { name: "Filmes no Cine Cruzeiro" })).toBeVisible();

  await page.goto("/conta");
  await expect(page.locator("form").getByRole("button", { name: "Entrar", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("link", { name: "Entrar com Google" })).toBeVisible();
});

test("pagina inexistente usa a experiencia 404 do cinema", async ({ page }) => {
  const response = await page.goto("/rota-que-nao-existe-e2e");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Erro 404")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver programação" })).toBeVisible();
});

test("painel administrativo entrega shell e tela de autenticacao", async ({ page }) => {
  await page.goto("http://127.0.0.1:4000/admin");
  await expect(page).toHaveTitle(/Admin.*Cine Cruzeiro/);
  await expect(page.getByRole("button", { name: "Entrar no painel" })).toBeVisible();
  await expect(page.locator("#loginForm")).toBeVisible();
});
