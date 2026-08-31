const assert = require("assert/strict");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const path = require("path");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const PORT = 4299;
const BASE_URL = `http://localhost:${PORT}`;

if (!TEST_DATABASE_URL) {
  console.log("PostgreSQL concurrency tests skipped: configure TEST_DATABASE_URL.");
  process.exit(0);
}

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL = "";
process.env.DATA_STORE = "postgres";
process.env.PORT = String(PORT);
process.env.PAYMENTS_MODE = "test";
process.env.TEST_PAYMENTS_AUTO_APPROVE = "false";
process.env.ADMIN_EMAIL = "admin@cinecruzeiro.local";
process.env.ADMIN_PASSWORD = "admin-pg-test-123456";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = "postgres-concurrency-webhook-secret";

function jsonHeaders(cookie = "") {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function loginAdmin() {
  const result = await request("/api/admin/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  assert.equal(result.response.status, 200);
  return result.response.headers.get("set-cookie")?.split(";")[0] || "";
}

function baseDb({ capacity = 1, stock = 1, includedTickets = 2, bundleQuantity = 1 } = {}) {
  const now = new Date().toISOString();
  const cycleEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    settings: { defaultTicketPrice: 10, currency: "BRL", adminTwoFactorRequired: false },
    ticketTypes: [{ id: "promocional", name: "Promocional", price: 10, bundleQuantity, active: true }],
    rooms: [{ id: "sala-teste", name: "Sala Teste", capacity, technology: "Teste", status: "active" }],
    movies: [{
      id: "filme-concorrencia",
      status: "now_playing",
      title: "Filme Concorrencia",
      synopsis: "Teste",
      duration: "1h 30m",
      genre: ["Teste"],
      rating: "L",
      posterUrl: "",
      backdropUrl: "",
      sessions: [{
        id: "sessao-concorrencia",
        time: "19:00",
        format: "2D Dublado",
        room: "Sala Teste",
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      }]
    }],
    concessions: [{
      id: "combo-final",
      name: "Combo Final",
      description: "Ultimo produto",
      price: 8,
      category: "combo",
      stock,
      reserved: 0,
      sold: 0,
      maxPerOrder: 1,
      active: true
    }],
    promotions: [],
    ads: [],
    subscriptionPlans: [{
      id: "plano-midia-postgres",
      name: "Plano Midia PostgreSQL",
      monthlyPrice: 19.9,
      includedTickets,
      billingCycle: "monthly",
      benefits: ["2 ingressos"],
      imageUrl: "/uploads/club-plans/plano-teste.png",
      isFeatured: true,
      displayOrder: 3,
      active: true
    }],
    subscriptions: [{
      id: "assinatura-roundtrip",
      userId: "cliente-roundtrip",
      planId: "plano-midia-postgres",
      status: "active",
      provider: "manual_admin",
      cycleStart: now,
      cycleEnd,
      creditsAvailable: 0,
      creditsUsed: 3,
      createdAt: now,
      updatedAt: now
    }],
    subscriptionCredits: [{
      id: "credito-roundtrip",
      subscriptionId: "assinatura-roundtrip",
      cycleStart: now,
      cycleEnd,
      total: 3,
      used: 3,
      remaining: 0,
      createdAt: now,
      updatedAt: now
    }],
    subscriptionUsage: [{
      id: "uso-roundtrip",
      subscriptionId: "assinatura-roundtrip",
      creditId: "credito-roundtrip",
      userId: "cliente-roundtrip",
      creditsUsed: 3,
      usedAt: now
    }],
    users: [{
      id: "admin",
      name: "Admin",
      email: process.env.ADMIN_EMAIL,
      role: "owner",
      active: true,
      passwordHash: "",
      authProvider: "email",
      createdAt: now
    }, {
      id: "cliente-roundtrip",
      name: "Cliente Roundtrip",
      email: "roundtrip@cine.local",
      role: "customer",
      active: true,
      passwordHash: "",
      authProvider: "email",
      createdAt: now
    }],
    orders: [],
    payments: [],
    tickets: [],
    webhookEvents: [],
    auditLogs: []
  };
}

async function resetDb(db) {
  const { writeDbToPostgres } = require("../backend/db/postgresStore");
  await writeDbToPostgres(db);
}

function checkoutBody(id, includeProduct = false) {
  return {
    order: {
      id,
      idempotencyKey: id,
      movieId: "filme-concorrencia",
      sessionId: "sessao-concorrencia",
      fullTicketsCount: 1,
      halfTicketsCount: 0,
      customerName: "Cliente Teste",
      customerEmail: `${id}@cine.local`,
      customerPhone: "11999999999",
      concessionItems: includeProduct ? [{ id: "combo-final", quantity: 1 }] : []
    }
  };
}

async function concurrentCheckout(ids, includeProduct) {
  return Promise.all(ids.map((id) => request("/api/payments/pix", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(checkoutBody(id, includeProduct))
  })));
}

async function registerCustomer(email) {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      name: "Cliente Clube Concorrente",
      email,
      password: "Clube-concorrencia-2026!"
    })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  return result.response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function assignClubPlan(adminCookie, email) {
  const result = await request("/api/admin/subscriptions/assign", {
    method: "POST",
    headers: jsonHeaders(adminCookie),
    body: JSON.stringify({ email, planId: "plano-midia-postgres", status: "active" })
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  return result.payload.subscription;
}

function clubCheckoutRequest({ cookie, id, quantity = 1 }) {
  return request("/api/checkout/club-credit", {
    method: "POST",
    headers: { ...jsonHeaders(cookie), "x-idempotency-key": id },
    body: JSON.stringify({
      id,
      idempotencyKey: id,
      movieId: "filme-concorrencia",
      sessionId: "sessao-concorrencia",
      ticketItems: [{ id: "promocional", quantity }],
      fullTicketsCount: quantity,
      halfTicketsCount: 0,
      concessionItems: []
    })
  });
}

function mercadoPagoWebhookRequest({ payment, order, eventVersion = 1, status = "approved" }) {
  const providerPaymentId = payment.providerPaymentId;
  const requestId = crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const approved = status === "approved";
  const providerStatus = approved ? "processed" : status === "pending" ? "action_required" : status;
  const body = {
    action: approved || status === "rejected" ? "order.processed" : "order.action_required",
    api_version: "v1",
    type: "order",
    live_mode: false,
    data: {
      id: providerPaymentId,
      external_reference: order.id,
      status: providerStatus,
      status_detail: approved ? "accredited" : status,
      total_amount: String(payment.amount),
      total_paid_amount: approved ? String(payment.amount) : "0",
      version: eventVersion,
      transactions: {
        payments: [{
          id: `PAY_PG_${eventVersion}`,
          amount: String(payment.amount),
          paid_amount: approved ? String(payment.amount) : "0",
          status: providerStatus,
          status_detail: approved ? "accredited" : status,
          payment_method: { id: "pix", type: "bank_transfer" }
        }]
      }
    }
  };
  const manifest = `id:${providerPaymentId};request-id:${requestId};ts:${timestamp};`;
  const signature = crypto.createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
  return {
    pathname: `/api/webhooks/mercado-pago?data.id=${encodeURIComponent(providerPaymentId)}&type=order`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-signature": `ts=${timestamp},v1=${signature}`
      },
      body: JSON.stringify(body)
    }
  };
}

async function run() {
  execFileSync(process.execPath, [path.join(__dirname, "db-migrate.js")], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit"
  });

  await resetDb(baseDb({ capacity: 1, stock: 2 }));
  const server = require("../backend/server.js");

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await loginAdmin();

    const { acquireSeatHold, releaseSeatHoldsForOwner } = require("../backend/db/postgresStore");
    const holdOwners = Array.from({ length: 20 }, (_, index) => `concorrente-${index + 1}`);
    const seatHolds = await Promise.all(holdOwners.map((ownerToken) => acquireSeatHold({
      sessionId: "sessao-concorrencia",
      seatId: "A1",
      ownerToken,
      connectionId: ownerToken
    })));
    const winningHolds = seatHolds.filter(Boolean);
    assert.equal(winningHolds.length, 1);
    await releaseSeatHoldsForOwner({ sessionId: "sessao-concorrencia", ownerToken: winningHolds[0].ownerToken });

    const lastSeat = await concurrentCheckout(["ultimo-ingresso-a", "ultimo-ingresso-b"], false);
    const seatStatuses = lastSeat.map((item) => item.response.status).sort();
    assert.deepEqual(seatStatuses, [201, 409]);

    await resetDb(baseDb({ capacity: 10, stock: 1 }));
    const productIds = Array.from({ length: 10 }, (_, index) => `ultimo-produto-${index + 1}`);
    const lastProduct = await concurrentCheckout(productIds, true);
    const productStatuses = lastProduct.map((item) => item.response.status).sort();
    assert.equal(productStatuses.filter((status) => status === 201).length, 1);
    assert.equal(productStatuses.filter((status) => status === 409).length, 9);

    await resetDb(baseDb({ capacity: 2, stock: 1 }));
    const pix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(checkoutBody("webhook-concorrente", true))
    });
    assert.equal(pix.response.status, 201);

    const webhook = mercadoPagoWebhookRequest({ payment: pix.payload.payment, order: pix.payload.order, eventVersion: 1 });
    const webhookResults = await Promise.all(Array.from({ length: 10 }, () =>
      request(webhook.pathname, webhook.options)
    ));
    assert.deepEqual(webhookResults.map((item) => item.response.status), Array(10).fill(200));
    assert.equal(webhookResults.filter((item) => item.payload.processed === true).length, 1);
    assert.equal(webhookResults.filter((item) => item.payload.duplicate === true).length, 9);

    const finalizationWebhooks = [2, 3].map((eventVersion) => mercadoPagoWebhookRequest({
      payment: pix.payload.payment,
      order: pix.payload.order,
      eventVersion
    }));
    const finalizationResults = await Promise.all(finalizationWebhooks.map((item) => request(item.pathname, item.options)));
    assert.ok(finalizationResults.every((item) => item.response.status === 200));

    const content = await request("/api/admin/content", { headers: jsonHeaders(await loginAdmin()) });
    assert.equal(content.response.status, 200, JSON.stringify(content.payload));
    assert.ok(Array.isArray(content.payload.subscriptionUsage), `subscriptionUsage ausente: ${Object.keys(content.payload).join(", ")}`);
    const order = content.payload.orders.find((item) => item.id === "webhook-concorrente");
    const tickets = content.payload.tickets.filter((ticket) => ticket.orderId === order.id);
    const combo = content.payload.concessions.find((item) => item.id === "combo-final");
    const persistedPlan = content.payload.subscriptionPlans.find((item) => item.id === "plano-midia-postgres");
    assert.equal(order.status, "paid");
    assert.equal(tickets.length, 1);
    assert.equal(combo.sold, 1);
    assert.equal(combo.reserved, 0);
    assert.equal(persistedPlan.imageUrl, "/uploads/club-plans/plano-teste.png");
    assert.equal(persistedPlan.isFeatured, true);
    assert.equal(persistedPlan.displayOrder, 3);
    assert.equal(content.payload.subscriptionUsage.find((item) => item.id === "uso-roundtrip").creditsUsed, 3);

    const staleWebhook = mercadoPagoWebhookRequest({
      payment: pix.payload.payment,
      order: pix.payload.order,
      eventVersion: 4,
      status: "rejected"
    });
    const staleResult = await request(staleWebhook.pathname, staleWebhook.options);
    assert.equal(staleResult.response.status, 200);
    const afterStale = await request("/api/admin/content", { headers: jsonHeaders(await loginAdmin()) });
    const stablePayment = afterStale.payload.payments.find((item) => item.orderId === order.id);
    assert.equal(stablePayment.status, "approved");
    assert.equal(afterStale.payload.orders.find((item) => item.id === order.id).status, "paid");
    assert.equal(afterStale.payload.tickets.filter((ticket) => ticket.orderId === order.id).length, 1);
    assert.equal(afterStale.payload.concessions.find((item) => item.id === "combo-final").sold, 1);

    const validationCookie = await loginAdmin();
    const validations = await Promise.all(Array.from({ length: 2 }, () => request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(validationCookie),
      body: JSON.stringify({ code: tickets[0].code })
    })));
    assert.deepEqual(validations.map((item) => item.response.status).sort(), [200, 409]);
    assert.equal(validations.find((item) => item.response.status === 200).payload.ticket.status, "used");

    const persistedAfterCommit = await request("/api/admin/content", { headers: jsonHeaders(validationCookie) });
    const committedOrder = persistedAfterCommit.payload.orders.find((item) => item.id === "webhook-concorrente");
    committedOrder.emailDeliveredAt = "";
    const { writeDbToPostgres } = require("../backend/db/postgresStore");
    await writeDbToPostgres(persistedAfterCommit.payload);
    const resend = await request(`/api/orders/${encodeURIComponent(committedOrder.id)}/resend-ticket-email`, {
      method: "POST",
      headers: jsonHeaders(validationCookie),
      body: JSON.stringify({})
    });
    assert.equal(resend.response.status, 200);
    const afterResend = await request("/api/admin/content", { headers: jsonHeaders(validationCookie) });
    assert.equal(afterResend.payload.payments.filter((item) => item.orderId === committedOrder.id).length, 1);
    assert.equal(afterResend.payload.tickets.filter((ticket) => ticket.orderId === committedOrder.id).length, 1);
    assert.equal(afterResend.payload.orders.find((item) => item.id === committedOrder.id).status, "paid");

    await resetDb(baseDb({ capacity: 10, stock: 2, includedTickets: 2 }));
    const adminCookie = await loginAdmin();
    const clubEmail = "clube-concorrente@cine.local";
    const clubCookie = await registerCustomer(clubEmail);
    const concurrentSubscription = await assignClubPlan(adminCookie, clubEmail);
    const clubResults = await Promise.all([1, 2, 3].map((index) => clubCheckoutRequest({
      cookie: clubCookie,
      id: `clube-concorrente-${index}`
    })));
    assert.equal(clubResults.filter((item) => item.response.status === 201).length, 2);
    assert.equal(clubResults.filter((item) => item.response.status === 409).length, 1);
    assert.equal(clubResults.find((item) => item.response.status === 409).payload.error.code, "CLUB_CREDITS_EXHAUSTED");
    const clubContent = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    const exhaustedCredit = clubContent.payload.subscriptionCredits.find((item) => item.subscriptionId === concurrentSubscription.id);
    const concurrentUsage = clubContent.payload.subscriptionUsage.filter((item) => item.subscriptionId === concurrentSubscription.id);
    assert.equal(exhaustedCredit.remaining, 0);
    assert.equal(exhaustedCredit.used, 2);
    assert.equal(concurrentUsage.length, 2);
    assert.equal(concurrentUsage.reduce((sum, item) => sum + Number(item.creditsUsed || 0), 0), 2);

    await resetDb(baseDb({ capacity: 10, stock: 2, includedTickets: 6, bundleQuantity: 3 }));
    const bundleAdminCookie = await loginAdmin();
    const bundleEmail = "clube-pacote@cine.local";
    const bundleCookie = await registerCustomer(bundleEmail);
    const bundleSubscription = await assignClubPlan(bundleAdminCookie, bundleEmail);
    const bundleCheckout = await clubCheckoutRequest({ cookie: bundleCookie, id: "clube-pacote-seis", quantity: 2 });
    assert.equal(bundleCheckout.response.status, 201, JSON.stringify(bundleCheckout.payload));
    assert.equal(bundleCheckout.payload.tickets.length, 6);
    assert.equal(bundleCheckout.payload.subscription.creditsAvailable, 0);
    const cancelled = await request(`/api/orders/${encodeURIComponent(bundleCheckout.payload.order.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(bundleAdminCookie),
      body: JSON.stringify({ action: "cancel", reason: "Teste automatizado de devolucao" })
    });
    assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.payload));
    const bundleContent = await request("/api/admin/content", { headers: jsonHeaders(bundleAdminCookie) });
    const restoredCredit = bundleContent.payload.subscriptionCredits.find((item) => item.subscriptionId === bundleSubscription.id);
    const refundedUsage = bundleContent.payload.subscriptionUsage.find((item) => item.orderId === bundleCheckout.payload.order.id);
    assert.equal(restoredCredit.remaining, 6);
    assert.equal(restoredCredit.used, 0);
    assert.ok(refundedUsage.refundedAt);

    console.log("PostgreSQL concurrency tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
