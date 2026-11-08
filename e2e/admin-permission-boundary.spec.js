const { test, expect } = require("@playwright/test");

const BACKEND = "http://127.0.0.1:4000";

test("permissão restrita oculta ações e o backend recusa chamadas diretas", async ({ request, browser }) => {
  const ownerLogin = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(ownerLogin.status()).toBe(200);
  const email = "operador-restrito@e2e.local";
  const password = "Operador-restrito-2026!";
  const created = await request.post(`${BACKEND}/api/users`, {
    data: {
      name: "Operador Restrito", email, password, accountType: "team", role: "operator",
      useCustomPermissions: true, adminPermissions: ["dashboard.view", "tickets.validate"], active: true
    }
  });
  expect(created.status()).toBe(201);

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${BACKEND}/admin`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Entrar no painel" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator('[data-panel="integrationsPanel"]')).toBeHidden();
    await expect(page.locator('[data-panel="moviesPanel"]')).toBeHidden();
    for (const path of ["/api/users", "/api/admin/payments", "/api/integrations"]) {
      const response = await context.request.get(`${BACKEND}${path}`);
      expect(response.status(), path).toBe(403);
    }
    const sale = await context.request.post(`${BACKEND}/api/box-office/sales`, { data: {} });
    expect(sale.status()).toBe(403);
  } finally {
    await context.close();
  }
});
