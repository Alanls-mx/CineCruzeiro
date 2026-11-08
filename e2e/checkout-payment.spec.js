const { test, expect } = require("@playwright/test");
const crypto = require("crypto");

const BACKEND = "http://127.0.0.1:4000";
const ADMIN_EMAIL = "admin-e2e@cine.local";
const ADMIN_PASSWORD = "Admin-e2e-2026!";
const WEBHOOK_SECRET = "e2e-webhook-secret";
const authenticatedAdminContexts = new WeakSet();

test.describe.configure({ mode: "serial" });

async function adminContent(request) {
  if (!authenticatedAdminContexts.has(request)) {
    const login = await request.post(`${BACKEND}/api/admin/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    expect(login.ok(), `Falha no login administrativo: ${login.status()}`).toBeTruthy();
    authenticatedAdminContexts.add(request);
  }
  const response = await request.get(`${BACKEND}/api/admin/content`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function latestOrderFor(request, customerEmail) {
  const content = await adminContent(request);
  const order = content.orders.find((item) => item.customerEmail === customerEmail);
  expect(order).toBeTruthy();
  const payment = content.payments.find((item) => item.orderId === order.id);
  expect(payment).toBeTruthy();
  return { order, payment };
}

async function sendMercadoPagoOrderEvent(request, { order, payment, status, version }) {
  const approved = status === "approved";
  const rejected = status === "rejected";
  const providerStatus = approved ? "processed" : rejected ? "rejected" : "action_required";
  const action = rejected ? "order.processed" : approved ? "order.processed" : "order.action_required";
  const requestId = crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const providerId = payment.providerPaymentId;
  const body = {
    action,
    api_version: "v1",
    type: "order",
    live_mode: false,
    data: {
      id: providerId,
      external_reference: order.id,
      status: providerStatus,
      status_detail: approved ? "accredited" : rejected ? "rejected_other_reason" : "action_required",
      total_amount: String(payment.amount),
      total_paid_amount: approved ? String(payment.amount) : "0",
      version,
      transactions: {
        payments: [{
          id: `PAY_E2E_${version}`,
          amount: String(payment.amount),
          paid_amount: approved ? String(payment.amount) : "0",
          status: providerStatus,
          status_detail: approved ? "accredited" : rejected ? "rejected_other_reason" : "action_required",
          payment_method: { id: "pix", type: "bank_transfer" }
        }]
      }
    }
  };
  const manifest = `id:${providerId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(manifest).digest("hex");
  const response = await request.post(`${BACKEND}/api/webhooks/mercado-pago?data.id=${encodeURIComponent(providerId)}&type=order`, {
    headers: {
      "x-request-id": requestId,
      "x-signature": `ts=${timestamp},v1=${signature}`
    },
    data: body
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function authenticateCustomer(page, email) {
  const password = "Checkout-e2e-2026!";
  const registration = await page.request.post(`${BACKEND}/api/auth/register`, {
    data: { name: "Cliente E2E", email, password, phone: "11999999999" }
  });
  if (registration.status() === 409) {
    const login = await page.request.post(`${BACKEND}/api/auth/login`, { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    return;
  }
  expect(registration.ok()).toBeTruthy();
}

async function startPixCheckout(page, email, { concession = false } = {}) {
  await authenticateCustomer(page, email);
  await page.addInitScript(() => { window.MP_DEVICE_SESSION_ID = "e2e-device-checkout"; });
  await page.route("https://sdk.mercadopago.com/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/checkout/sessao-e2e");
  await expect(page.getByRole("heading", { name: "Filme E2E" })).toBeVisible();
  await expect(page.getByText("Esta sessão usa lugares livres")).toBeVisible();
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await expect(page.getByRole("heading", { name: "Bomboniere" })).toBeVisible();
  if (concession) {
    await page.locator("article").filter({ hasText: "Pipoca E2E" }).getByRole("button", { name: "+" }).click();
  }
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Conta identificada" })).toBeVisible();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Gerar Pix", exact: true }).click();
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  await expect(page.getByAltText("QR Code para pagamento via Pix")).toBeVisible({ timeout: 10000 });
}

test("visitante precisa entrar ou criar uma conta antes de comprar", async ({ page }) => {
  await page.goto("/checkout/sessao-e2e");
  await expect(page.getByRole("heading", { name: "Entre para comprar seu ingresso" })).toBeVisible();
  const accountLink = page.getByRole("link", { name: "Entrar ou criar conta" });
  await expect(accountLink).toHaveAttribute("href", "/conta?returnTo=%2Fcheckout%2Fsessao-e2e");
  await expect(page.getByRole("heading", { name: "Ingressos" })).toHaveCount(0);
});

test("mantém as poltronas reservadas ao avançar até o pagamento", async ({ page }) => {
  await authenticateCustomer(page, "checkout-poltronas@e2e.local");
  const seatMapRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/sessions/sessao-poltronas-e2e/seats")) {
      seatMapRequests.push(request.url());
    }
  });

  await page.goto("/checkout/sessao-poltronas-e2e");
  await expect(page.getByRole("heading", { name: "Filme Poltronas E2E" })).toBeVisible();
  const seat = page.getByRole("button", { name: /^A4,/ });
  await seat.click();
  await expect(seat).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await expect(page.getByRole("heading", { name: "Bomboniere" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();

  await expect(page).toHaveURL(/\/checkout\/sessao-poltronas-e2e\/pagamento$/);
  await expect(page.getByRole("heading", { name: "Conta identificada" })).toBeVisible();
  await expect(page.getByText("A4", { exact: true })).toBeVisible();
  expect(seatMapRequests.length).toBeGreaterThan(0);
  expect(seatMapRequests.every((url) => new URL(url).searchParams.has("ownerToken"))).toBeTruthy();
});

test("cliente aplica cupom e o backend mantém o desconto no pedido", async ({ page, request }) => {
  const email = "checkout-cupom@e2e.local";
  await authenticateCustomer(page, email);
  await page.addInitScript(() => { window.MP_DEVICE_SESSION_ID = "e2e-device-coupon"; });
  await page.route("https://sdk.mercadopago.com/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await expect(page.getByRole("heading", { name: "Conta identificada" })).toBeVisible();
  await page.getByLabel("Código do cupom").fill("e2e20");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByText("E2E20 aplicado")).toBeVisible();
  await expect(page.getByText("você economizou R$ 3,00")).toBeVisible();
  await expect(page.getByText("R$ 12,00", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Gerar Pix", exact: true }).click();
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  const pending = await latestOrderFor(request, email);
  expect(pending.order.couponCode).toBe("E2E20");
  expect(pending.order.couponDiscount).toBe(3);
  expect(pending.order.totalPrice).toBe(12);
});

test("checkout Pix permanece pendente, preserva bomboniere e entrega ingresso apenas após webhook aprovado", async ({ page, request, browser }) => {
  const email = "checkout-aprovado@e2e.local";
  await startPixCheckout(page, email, { concession: true });
  const pending = await latestOrderFor(request, email);
  let content = await adminContent(request);
  const soldBeforeApproval = content.concessions.find((item) => item.id === "pipoca-e2e").sold;
  expect(content.tickets.filter((ticket) => ticket.orderId === pending.order.id)).toHaveLength(0);
  expect(pending.order.concessionItems).toEqual(expect.arrayContaining([expect.objectContaining({ id: "pipoca-e2e", quantity: 1 })]));

  await sendMercadoPagoOrderEvent(request, { ...pending, status: "approved", version: 1 });
  await expect(page.getByText("Tudo certo com sua compra")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Pagamento aprovado")).toBeVisible();
  content = await adminContent(request);
  expect(content.tickets.filter((ticket) => ticket.orderId === pending.order.id)).toHaveLength(1);
  const product = content.concessions.find((item) => item.id === "pipoca-e2e");
  expect(product.sold).toBe(soldBeforeApproval + 1);
  expect(product.reserved).toBe(0);

  const other = await browser.newContext();
  try {
    const registration = await other.request.post(`${BACKEND}/api/auth/register`, {
      data: { firstName: "Outro", lastName: "Cliente", email: "outro-cliente@e2e.local", password: "Outro-e2e-2026!" }
    });
    expect(registration.status()).toBe(201);
    const ticketId = content.tickets.find((ticket) => ticket.orderId === pending.order.id).id;
    for (const path of [`/api/me/tickets/${ticketId}`, `/api/me/tickets/${ticketId}/qr`, `/api/checkout/orders/${pending.order.id}`]) {
      const response = await other.request.get(`${BACKEND}${path}`);
      expect(response.status(), path).toBe(404);
    }
  } finally {
    await other.close();
  }
});

test("Pix pendente sobrevive à atualização e a falha de consulta sem criar outra cobrança", async ({ page, request }) => {
  const email = "checkout-retomada@e2e.local";
  await startPixCheckout(page, email);
  const pending = await latestOrderFor(request, email);
  let paymentPosts = 0;
  page.on("request", (sent) => {
    if (sent.method() === "POST" && /\/api\/payments\/(pix|card)$/.test(sent.url())) paymentPosts += 1;
  });
  await page.route("**/api/checkout/orders/**", (route) => route.abort("failed"));
  await page.reload();
  await expect(page.getByText("Conferindo a confirmação do pagamento")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Não refaça o pagamento enquanto conferimos.", { exact: false })).toBeVisible();
  await page.unroute("**/api/checkout/orders/**");
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 12000 });
  await expect(page.getByAltText("QR Code para pagamento via Pix")).toBeVisible();
  const content = await adminContent(request);
  expect(content.orders.filter((order) => order.customerEmail === email)).toHaveLength(1);
  expect(content.payments.filter((payment) => payment.orderId === pending.order.id)).toHaveLength(1);
  expect(content.tickets.filter((ticket) => ticket.orderId === pending.order.id)).toHaveLength(0);
  expect(paymentPosts).toBe(0);
});

test("checkout Pix recusado não emite ingresso", async ({ page, request }) => {
  const email = "checkout-recusado@e2e.local";
  await startPixCheckout(page, email);
  const pending = await latestOrderFor(request, email);
  await sendMercadoPagoOrderEvent(request, { ...pending, status: "rejected", version: 1 });
  await expect(page.getByText("Aguardando confirmação")).not.toBeVisible({ timeout: 10000 });
  const content = await adminContent(request);
  expect(content.tickets.filter((ticket) => ticket.orderId === pending.order.id)).toHaveLength(0);
  expect(content.orders.find((item) => item.id === pending.order.id).status).toBe("cancelled");
});
