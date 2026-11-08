const { test, expect } = require("@playwright/test");
const crypto = require("node:crypto");

const BACKEND = "http://127.0.0.1:4000";
const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const cardToken = "token-sintetico-e2e";
const cardCustomerEmail = "cartao-resiliencia@e2e.local";

test.beforeAll(async ({ request }) => {
  const registration = await request.post(`${BACKEND}/api/auth/register`, {
    data: { firstName: "Cliente", lastName: "Cartao", email: cardCustomerEmail, password: "Cartao-e2e-2026!", phone: "11999999999" }
  });
  expect(registration.status()).toBe(201);
});

async function prepareCheckout(page) {
  const login = await page.request.post(`${BACKEND}/api/auth/login`, {
    data: { email: cardCustomerEmail, password: "Cartao-e2e-2026!" }
  });
  expect(login.status()).toBe(200);
  await page.addInitScript(() => { window.MP_DEVICE_SESSION_ID = "e2e-device-card"; });
  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await page.getByRole("button", { name: "Cartão", exact: true }).click();
}

async function installMercadoPagoBrick(page, token = cardToken) {
  await page.route(SDK_URL, (route) => route.fulfill({
    status: 200, contentType: "application/javascript",
    body: `window.MercadoPago = class {
      bricks() { return { create: async (kind, id, options) => {
        if (kind !== "cardPayment") throw new Error("Brick inesperado");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Pagar com cartão";
        button.addEventListener("click", () => {
          Promise.resolve(options.callbacks.onSubmit({ token: ${JSON.stringify(token)}, payment_method_id: "visa", installments: 1 }, { paymentTypeId: "credit_card" })).catch(() => {});
        });
        document.getElementById(id).appendChild(button);
        options.callbacks.onReady();
        return { unmount() { button.remove(); } };
      } }; }
    };`
  }));
}

async function adminSnapshot(request) {
  const login = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(login.status()).toBe(200);
  const response = await request.get(`${BACKEND}/api/admin/content`);
  expect(response.status()).toBe(200);
  return response.json();
}

async function approveCardOrder(request, order, payment) {
  const requestId = crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const providerId = payment.providerPaymentId;
  const signature = crypto.createHmac("sha256", "e2e-webhook-secret")
    .update(`id:${providerId};request-id:${requestId};ts:${timestamp};`).digest("hex");
  return request.post(`${BACKEND}/api/webhooks/mercado-pago?data.id=${encodeURIComponent(providerId)}&type=order`, {
    headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
    data: {
      action: "order.processed", api_version: "v1", type: "order", live_mode: false,
      data: {
        id: providerId, external_reference: order.id, status: "processed", status_detail: "accredited",
        total_amount: String(payment.amount), total_paid_amount: String(payment.amount), version: 1,
        transactions: { payments: [{ id: "PAY_E2E_CARD", amount: String(payment.amount), paid_amount: String(payment.amount),
          status: "processed", status_detail: "accredited", payment_method: { id: "visa", type: "credit_card" } }] }
      }
    }
  });
}

test("cartão Mercado Pago informa SDK indisponível sem iniciar cobrança", async ({ page }) => {
  let paymentPosts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/payments/card")) paymentPosts += 1; });
  await page.route(SDK_URL, (route) => route.abort("failed"));
  await prepareCheckout(page);
  await expect(page.getByRole("button", { name: "Tentar carregar novamente" })).toBeVisible();
  expect(paymentPosts).toBe(0);
});

test("cartão Mercado Pago recusa token vazio antes da API", async ({ page }) => {
  let paymentPosts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/api/payments/card")) paymentPosts += 1; });
  await installMercadoPagoBrick(page, "");
  await prepareCheckout(page);
  await page.getByRole("button", { name: "Pagar com cartão" }).click();
  await expect(page.getByText("Preencha os dados do cartão no formulário seguro do provedor ativo.")).toBeVisible();
  expect(paymentPosts).toBe(0);
});

test("cartão recupera resposta perdida com a mesma identidade e só emite após confirmação", async ({ page, request }) => {
  await installMercadoPagoBrick(page);
  await prepareCheckout(page);
  const attempts = [];
  await page.route("**/api/payments/card", async (route) => {
    attempts.push(JSON.parse(route.request().postData()));
    if (attempts.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Pagar com cartão" }).click();
  await expect(page.getByText(/Failed to fetch|Não foi possível|Nao foi possivel/)).toBeVisible();
  let pixPosts = 0;
  page.on("request", (sent) => { if (sent.method() === "POST" && sent.url().endsWith("/api/payments/pix")) pixPosts += 1; });
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Gerar Pix", exact: true }).click();
  await expect(page.getByText(/Existe uma tentativa de pagamento em verificação/)).toBeVisible();
  expect(pixPosts).toBe(0);
  await page.getByRole("button", { name: "Cartão", exact: true }).click();
  await page.reload();
  const cardButton = page.getByRole("button", { name: "Pagar com cartão" });
  await expect(cardButton).toBeVisible();
  await cardButton.evaluate((button) => { button.click(); button.click(); });
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  expect(attempts).toHaveLength(2);
  expect(attempts[0].idempotencyKey).toBe(attempts[1].idempotencyKey);
  expect(attempts[0].cardToken).toBe(cardToken);
  const before = await adminSnapshot(request);
  const orders = before.orders.filter((order) => order.customerEmail === cardCustomerEmail);
  expect(orders).toHaveLength(1);
  const payments = before.payments.filter((payment) => payment.orderId === orders[0].id);
  expect(payments).toHaveLength(1);
  expect(before.tickets.filter((ticket) => ticket.orderId === orders[0].id)).toHaveLength(0);
  expect(JSON.stringify({ orders, payments })).not.toContain(cardToken);

  const approved = await approveCardOrder(request, orders[0], payments[0]);
  expect(approved.status()).toBe(200);
  await expect(page.getByText("Tudo certo com sua compra")).toBeVisible({ timeout: 10000 });
  const duplicate = await approveCardOrder(request, orders[0], payments[0]);
  expect(duplicate.status()).toBe(200);
  const after = await (await request.get(`${BACKEND}/api/admin/content`)).json();
  expect(after.tickets.filter((ticket) => ticket.orderId === orders[0].id)).toHaveLength(1);
});
