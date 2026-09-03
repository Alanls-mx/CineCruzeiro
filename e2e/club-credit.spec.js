const { test, expect } = require("@playwright/test");

const BACKEND = "http://127.0.0.1:4000";

test("cliente cria conta, recebe plano ativo e usa crédito do Clube no checkout completo", async ({ page, request }) => {
  const email = "cliente-clube-e2e@cine.local";
  await page.route("https://sdk.mercadopago.com/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome").fill("Cliente Clube E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Clube-e2e-2026!");
  await page.getByLabel("WhatsApp").fill("11988887777");
  await page.locator("form").getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Cliente Clube E2E" })).toBeVisible({ timeout: 10000 });

  const adminLogin = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(adminLogin.ok()).toBeTruthy();
  const assignment = await request.post(`${BACKEND}/api/admin/subscriptions/assign`, {
    data: { email, planId: "plano-e2e", status: "active" }
  });
  expect(assignment.status()).toBe(201);
  const assigned = (await assignment.json()).subscription;
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/me/subscriptions", { credentials: "include", cache: "no-store" });
    const payload = await response.json();
    return payload.subscriptions?.[0]?.creditsRemaining;
  })).toBe(2);

  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Conta identificada" })).toBeVisible();
  await expect(page.getByText("Você possui 2. O benefício será aplicado na finalização.")).toBeVisible();
  await expect(page.getByText("Clube · ingressos (10%)")).toBeVisible();
  await expect(page.getByText("Subtotal R$ 15,00")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("R$ 13,50", { exact: true })).toBeVisible();
  await page.getByLabel("Usar 1 crédito(s) do Clube").check();
  const summary = page.getByRole("complementary");
  await expect(summary.getByText("Créditos do Clube")).toBeVisible();
  await expect(summary.getByText("1 crédito", { exact: true })).toBeVisible();
  await expect(summary.getByText("1× Ingresso Inteiro")).toBeVisible();
  await expect(summary.getByText("R$ 13,50 neste tipo de ingresso")).toBeVisible();
  await expect(summary.getByText("-R$ 13,50")).toBeVisible();
  await expect(summary.getByText("R$ 0,00", { exact: true })).toBeVisible();
  await expect(page.getByText("Créditos restantes após confirmação: 1.")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar com créditos do Clube" }).click();
  await expect(page.getByText("Tudo certo com sua compra")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Pagamento aprovado")).toBeVisible();
  await expect(summary.getByText("Créditos do Clube")).toBeVisible();
  await expect(summary.getByText("1× Ingresso Inteiro")).toBeVisible();

  const contentResponse = await request.get(`${BACKEND}/api/admin/content`);
  expect(contentResponse.ok()).toBeTruthy();
  const content = await contentResponse.json();
  const usage = content.subscriptionUsage.filter((item) => item.subscriptionId === assigned.id);
  const credit = content.subscriptionCredits.find((item) => item.subscriptionId === assigned.id);
  const order = content.orders.find((item) => item.customerEmail === email && item.origin === "club");
  expect(order).toBeTruthy();
  expect(order.status).toBe("paid");
  expect(usage).toHaveLength(1);
  expect(usage[0].creditsUsed).toBe(1);
  expect(credit.remaining).toBe(1);
  expect(content.tickets.filter((ticket) => ticket.orderId === order.id)).toHaveLength(1);
});

test("mantém benefícios e total do Clube no resumo após gerar o Pix", async ({ page, request }) => {
  const email = "cliente-clube-pix-e2e@cine.local";
  await page.route("https://sdk.mercadopago.com/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/conta");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Nome").fill("Cliente Clube Pix E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Clube-pix-e2e-2026!");
  await page.getByLabel("WhatsApp").fill("11977776666");
  await page.locator("form").getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Cliente Clube Pix E2E" })).toBeVisible({ timeout: 10000 });

  const adminLogin = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(adminLogin.ok()).toBeTruthy();
  const assignment = await request.post(`${BACKEND}/api/admin/subscriptions/assign`, {
    data: { email, planId: "plano-e2e", status: "active" }
  });
  expect(assignment.status()).toBe(201);

  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.locator("article").filter({ hasText: "Pipoca E2E" }).getByRole("button", { name: "+" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  const summary = page.getByRole("complementary");
  await expect(summary.getByText("Clube · ingressos (10%)")).toBeVisible();
  await expect(summary.getByText("R$ 21,10", { exact: true })).toBeVisible();
  await page.getByLabel("Usar 1 crédito(s) do Clube").check();
  await expect(summary.getByText("Créditos do Clube")).toBeVisible();
  await expect(summary.getByText("1× Ingresso Inteiro")).toBeVisible();
  await expect(summary.getByText("R$ 13,50 neste tipo de ingresso")).toBeVisible();
  await expect(summary.getByText("R$ 7,60", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Gerar Pix", exact: true }).click();

  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  await expect(summary.getByText("Clube · ingressos (10%)")).toBeVisible();
  await expect(summary.getByText("Créditos do Clube")).toBeVisible();
  await expect(summary.getByText("1× Ingresso Inteiro")).toBeVisible();
  await expect(summary.getByText("Subtotal R$ 23,00")).toBeVisible();
  await expect(summary.getByText("R$ 7,60", { exact: true })).toBeVisible();
});
