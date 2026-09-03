const { test, expect } = require("@playwright/test");
const crypto = require("crypto");

const BACKEND = "http://127.0.0.1:4000";
const ADMIN_EMAIL = "admin-e2e@cine.local";
const ADMIN_PASSWORD = "Admin-e2e-2026!";
const WEBHOOK_SECRET = "e2e-webhook-secret";

test.describe.configure({ mode: "serial" });

async function adminContent(request) {
  const login = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(login.ok()).toBeTruthy();
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

async function startPixCheckout(page, email, { concession = false } = {}) {
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
  await expect(page.getByRole("heading", { name: "Dados do visitante" })).toBeVisible();
  await page.getByLabel("Nome").fill("Cliente E2E");
  await page.getByLabel("WhatsApp").fill("11999999999");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Gerar Pix", exact: true }).click();
  await expect(page.getByText("Aguardando confirmação")).toBeVisible({ timeout: 10000 });
  await expect(page.getByAltText("QR Code para pagamento via Pix")).toBeVisible({ timeout: 10000 });
}

test("mantém as poltronas reservadas ao avançar até o pagamento", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Dados do visitante" })).toBeVisible();
  await expect(page.getByText("A4", { exact: true })).toBeVisible();
  expect(seatMapRequests.length).toBeGreaterThan(0);
  expect(seatMapRequests.every((url) => new URL(url).searchParams.has("ownerToken"))).toBeTruthy();
});

test("cliente aplica cupom e o backend mantém o desconto no pedido", async ({ page, request }) => {
  const email = "checkout-cupom@e2e.local";
  await page.route("https://sdk.mercadopago.com/**", (route) => route.abort("blockedbyclient"));
  await page.goto("/checkout/sessao-e2e");
  await page.getByRole("link", { name: "Continuar para Extras" }).click();
  await page.getByRole("button", { name: "Continuar para Pagamento" }).click();
  await page.getByLabel("Nome").fill("Cliente Cupom E2E");
  await page.getByLabel("WhatsApp").fill("11999999999");
  await page.getByLabel("E-mail").fill(email);
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

test("checkout Pix permanece pendente, preserva bomboniere e entrega ingresso apenas após webhook aprovado", async ({ page, request }) => {
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
