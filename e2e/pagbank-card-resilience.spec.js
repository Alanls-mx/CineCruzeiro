const { test, expect, request: playwrightRequest } = require("@playwright/test");

const BACKEND = "http://127.0.0.1:4000";
const SDK = "https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js";
const email = "pagbank-cartao@e2e.local";
const password = "Pagbank-e2e-2026!";
let admin;

test.describe.configure({ mode: "serial" });

async function adminCall(method, path, data) {
  const response = await admin[method](`${BACKEND}${path}`, data ? { data } : {});
  expect(response.status(), `${method} ${path}: ${await response.text()}`).toBe(200);
  return response;
}

test.beforeAll(async () => {
  admin = await playwrightRequest.newContext();
  const login = await admin.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(login.status()).toBe(200);
  await adminCall("post", "/api/admin/integrations/mercadoPago/disable");
  await adminCall("put", "/api/admin/integrations/pagBank", {
    environment: "sandbox", publicKey: "PAGBANK-e2e-public-key", accessToken: "PAGBANK-e2e-token"
  });
  await adminCall("post", "/api/admin/integrations/pagBank/enable");
});

test.afterAll(async () => {
  try {
    if (admin) {
      await adminCall("post", "/api/admin/integrations/pagBank/disable");
      await adminCall("post", "/api/admin/integrations/mercadoPago/enable");
    }
  } finally { await admin?.dispose(); }
});

async function checkout(page) {
  const login = await page.request.post(`${BACKEND}/api/auth/login`, { data: { email, password } });
  expect(login.status()).toBe(200);
  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await page.getByRole("button", { name: "Cartão", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cartão PagBank" })).toBeVisible();
}

async function fillCard(page, number = "4111111111111111") {
  await page.getByLabel("Nome no cartão").fill("Cliente PagBank");
  await page.getByLabel("CPF do titular").fill("12345678909");
  await page.getByLabel("Número do cartão").fill(number);
  await page.getByLabel("Mês", { exact: true }).fill("12");
  await page.getByLabel("Ano", { exact: true }).fill("2030");
  await page.getByLabel("CVV").fill("123");
}

test("PagBank bloqueia envio quando SDK está indisponível", async ({ page }) => {
  let posts = 0;
  page.on("request", (sent) => { if (sent.method() === "POST" && sent.url().endsWith("/api/payments/card")) posts += 1; });
  await page.route(SDK, (route) => route.abort("failed"));
  await checkout(page);
  await expect(page.getByText("Não foi possível carregar a criptografia do PagBank.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar com cartão" })).toBeDisabled();
  expect(posts).toBe(0);
});

test("PagBank mostra erro de criptografia e não chama a API", async ({ page }) => {
  let posts = 0;
  page.on("request", (sent) => { if (sent.method() === "POST" && sent.url().endsWith("/api/payments/card")) posts += 1; });
  await page.route(SDK, (route) => route.fulfill({ status: 200, contentType: "application/javascript",
    body: "window.PagSeguro = { encryptCard: () => ({ hasErrors: true, errors: [{message:'Cartão inválido'}] }) };" }));
  await checkout(page);
  await fillCard(page, "0000000000000000");
  await page.getByRole("button", { name: "Pagar com cartão" }).click();
  await expect(page.getByText("Cartão inválido")).toBeVisible();
  expect(posts).toBe(0);
  await expect(page.getByLabel("Número do cartão")).toHaveValue("");
  await expect(page.getByLabel("CVV")).toHaveValue("");
});

test("PagBank criptografa no navegador e mantém pedido pendente sem dados sensíveis", async ({ page }) => {
  const encryptedCard = "encrypted-card-e2e";
  const requests = [];
  page.on("request", (sent) => {
    if (sent.method() === "POST" && sent.url().endsWith("/api/payments/card")) requests.push(sent.postData());
  });
  await page.route(SDK, (route) => route.fulfill({ status: 200, contentType: "application/javascript",
    body: `window.PagSeguro = { encryptCard: () => ({ encryptedCard: ${JSON.stringify(encryptedCard)} }) };` }));
  await checkout(page);
  await fillCard(page);
  await page.getByRole("button", { name: "Pagar com cartão" }).click();
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain(encryptedCard);
  expect(requests[0]).not.toContain("4111111111111111");
  expect(requests[0]).not.toContain('"securityCode":"123"');
  const contentResponse = await admin.get(`${BACKEND}/api/admin/content`);
  expect(contentResponse.status()).toBe(200);
  const content = await contentResponse.json();
  const order = content.orders.find((item) => item.customerEmail === email);
  expect(order).toBeTruthy();
  expect(content.payments.filter((item) => item.orderId === order.id)).toHaveLength(1);
  expect(content.tickets.filter((item) => item.orderId === order.id)).toHaveLength(0);
  expect(JSON.stringify(content.orders.filter((item) => item.id === order.id))).not.toContain(encryptedCard);
});
