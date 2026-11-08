const { test, expect } = require("@playwright/test");

const BACKEND = "http://127.0.0.1:4000";

test("cadastro, saída, recuperação e nova senha mantêm a conta acessível", async ({ page, browser }) => {
  const email = "cliente-jornada@e2e.local";
  const oldPassword = "Jornada-antiga-2026!";
  const newPassword = "Jornada-nova-2026!";
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Cliente");
  await page.getByLabel("Sobrenome", { exact: true }).fill("Jornada");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(oldPassword);
  await page.getByLabel("Telefone").fill("11 98888-7777");
  await expect(page.getByLabel("Telefone")).toHaveValue("11988887777");
  await page.locator("form").getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Cliente Jornada" })).toBeVisible();
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.locator("form").getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeEmpty();
  await expect(page.getByLabel("Senha")).toBeEmpty();
  await expect(page.getByLabel("Telefone")).toHaveCount(0);

  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByLabel("E-mail").fill(email);
  const recoveryResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/password/request"));
  await page.getByRole("button", { name: "Enviar recuperação" }).click();
  const recovery = await recoveryResponse;
  expect(recovery.status()).toBe(202);
  const { resetToken } = await recovery.json();
  expect(resetToken).toBeTruthy();
  await expect(page.getByText(/Se o e-mail existir, enviaremos/)).toBeVisible();

  await page.goto(`/conta?resetToken=${encodeURIComponent(resetToken)}`);
  await expect(page.getByText("Link de recuperação validado.", { exact: false })).toBeVisible();
  await page.getByLabel("Nova senha").fill(newPassword);
  const resetResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/password/reset"));
  await page.getByRole("button", { name: "Atualizar senha" }).click();
  expect((await resetResponse).status()).toBe(200);

  const other = await browser.newContext();
  try {
    expect((await other.request.post(`${BACKEND}/api/auth/login`, {
      data: { email, password: oldPassword }
    })).status()).toBe(401);
    expect((await other.request.post(`${BACKEND}/api/auth/login`, {
      data: { email, password: newPassword }
    })).status()).toBe(200);
    expect((await other.request.post(`${BACKEND}/api/auth/password/reset`, {
      data: { token: resetToken, password: "Jornada-terceira-2026!" }
    })).status()).toBe(400);
  } finally {
    await other.close();
  }
});
