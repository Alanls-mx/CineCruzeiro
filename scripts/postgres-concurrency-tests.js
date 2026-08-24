const assert = require("assert/strict");
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

function baseDb({ capacity = 1, stock = 1 } = {}) {
  return {
    settings: { defaultTicketPrice: 10, currency: "BRL" },
    ticketTypes: [{ id: "promocional", name: "Promocional", price: 10, active: true }],
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
    users: [{
      id: "admin",
      name: "Admin",
      email: process.env.ADMIN_EMAIL,
      role: "owner",
      active: true,
      passwordHash: "",
      authProvider: "email",
      createdAt: new Date().toISOString()
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

    const lastSeat = await concurrentCheckout(["ultimo-ingresso-a", "ultimo-ingresso-b"], false);
    const seatStatuses = lastSeat.map((item) => item.response.status).sort();
    assert.deepEqual(seatStatuses, [201, 409]);

    await resetDb(baseDb({ capacity: 2, stock: 1 }));
    const lastProduct = await concurrentCheckout(["ultimo-produto-a", "ultimo-produto-b"], true);
    const productStatuses = lastProduct.map((item) => item.response.status).sort();
    assert.deepEqual(productStatuses, [201, 409]);

    await resetDb(baseDb({ capacity: 2, stock: 1 }));
    const pix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(checkoutBody("webhook-concorrente", true))
    });
    assert.equal(pix.response.status, 201);

    const providerPaymentId = pix.payload.payment.providerPaymentId;
    const webhookBody = {
      eventId: "evento-aprovado-1",
      providerPaymentId,
      orderId: pix.payload.order.id,
      status: "approved"
    };
    const webhookResults = await Promise.all([
      request("/api/webhooks/open-finance", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(webhookBody) }),
      request("/api/webhooks/open-finance", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(webhookBody) })
    ]);
    assert.ok(webhookResults.every((item) => item.response.status === 200));

    const finalizationResults = await Promise.all([
      request("/api/webhooks/open-finance", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...webhookBody, eventId: "evento-aprovado-2" })
      }),
      request("/api/webhooks/open-finance", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ...webhookBody, eventId: "evento-aprovado-3" })
      })
    ]);
    assert.ok(finalizationResults.every((item) => item.response.status === 200));

    const content = await request("/api/admin/content", { headers: jsonHeaders(await loginAdmin()) });
    const order = content.payload.orders.find((item) => item.id === "webhook-concorrente");
    const tickets = content.payload.tickets.filter((ticket) => ticket.orderId === order.id);
    const combo = content.payload.concessions.find((item) => item.id === "combo-final");
    assert.equal(order.status, "paid");
    assert.equal(tickets.length, 1);
    assert.equal(combo.sold, 1);
    assert.equal(combo.reserved, 0);

    console.log("PostgreSQL concurrency tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
