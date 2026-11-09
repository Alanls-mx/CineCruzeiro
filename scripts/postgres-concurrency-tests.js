const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync, fork } = require("child_process");
const path = require("path");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const PORT = 4299;
const BASE_URL = `http://localhost:${PORT}`;
const SECOND_BASE_URL = "http://localhost:4300";
const LOST_RESPONSE_KEY = "cross-instance-provider-response-lost";
const providerCallFile = path.join(os.tmpdir(), `cine-financial-calls-${crypto.randomBytes(8).toString("hex")}.log`);
const refundCallFile = path.join(os.tmpdir(), `cine-financial-refunds-${crypto.randomBytes(8).toString("hex")}.log`);
const reconcileCallFile = path.join(os.tmpdir(), `cine-financial-reconcile-${crypto.randomBytes(8).toString("hex")}.log`);

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
process.env.CINE_FINANCIAL_CALL_FILE = providerCallFile;
process.env.CINE_FINANCIAL_REFUND_FILE = refundCallFile;
process.env.CINE_FINANCIAL_RECONCILE_FILE = reconcileCallFile;
const adminSalt = crypto.randomBytes(16).toString("base64url");
const adminPasswordHash = `pbkdf2_sha256$600000$${adminSalt}$${crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD, adminSalt, 600000, 32, "sha256").toString("base64url")}`;

function jsonHeaders(cookie = "") {
  return {
    "Content-Type": "application/json",
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function request(pathname, options = {}, baseUrl = BASE_URL) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
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
  const futureSession = new Date(Date.now() + 12 * 3600000);
  const futureSessionDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(futureSession);
  const futureSessionTime = new Intl.DateTimeFormat('en-GB', {timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(futureSession);
  return {
    settings: { defaultTicketPrice: 10, currency: "BRL", adminTwoFactorRequired: false },
    ticketTypes: [{ id: "promocional", name: "Promocional", price: 10, bundleQuantity, active: true }],
    rooms: [{ id: "sala-teste", name: "Sala Teste", capacity, technology: "Teste", status: "active" }],
    movies: [{
      id: "filme-concorrencia",
      status: "now_playing",
      releaseDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      title: "Filme Concorrencia",
      synopsis: "Teste",
      duration: "1h 30m",
      genre: ["Teste"],
      rating: "L",
      posterUrl: "",
      backdropUrl: "",
      sessions: [{
        id: "sessao-concorrencia",
        date: futureSessionDate,
        time: futureSessionTime,
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
      passwordHash: adminPasswordHash,
      authProvider: "email",
      createdAt: now
    }, {
      id: "admin-second",
      name: "Segundo Operador",
      email: "admin-second@postgres.local",
      role: "owner",
      active: true,
      passwordHash: adminPasswordHash,
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
  await writeDbToPostgres(db, { importSnapshot: true });
}

async function runCrossProcessSeatRace() {
  const workerPath = path.join(__dirname, "postgres-seat-race-worker.js");
  const workers = ["worker-a", "worker-b"].map((ownerToken) => ({
    ownerToken,
    child: fork(workerPath, [], { env: process.env, stdio: ["ignore", "inherit", "inherit", "ipc"], windowsHide: true })
  }));
  function nextMessage(child, expected) {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`Worker sem resposta: ${expected}`)), 15000);
      const onExit = (code) => finish(new Error(`Worker encerrou antes de ${expected}: ${code}`));
      const onMessage = (message) => message?.type === "error"
        ? finish(new Error(message.message))
        : message?.type === expected ? finish(null, message) : undefined;
      function finish(error, message) {
        clearTimeout(deadline);
        child.off("exit", onExit);
        child.off("message", onMessage);
        if (error) reject(error); else resolve(message);
      }
      child.on("exit", onExit);
      child.on("message", onMessage);
    });
  }
  try {
    await Promise.all(workers.map(({ child }) => nextMessage(child, "ready")));
    const results = workers.map(({ child, ownerToken }) => {
      const response = nextMessage(child, "result");
      child.send({ type: "acquire", sessionId: "sessao-concorrencia", seatId: "A1", ownerToken });
      return response;
    });
    const outcomes = await Promise.all(results);
    assert.equal(outcomes.filter((item) => item.acquired).length, 1,
      "Duas instâncias não podem adquirir a mesma poltrona");
    const { queryPostgres, releaseSeatHoldsForOwner } = require("../backend/db/postgresStore");
    const held = await queryPostgres("SELECT owner_token FROM seat_holds WHERE session_id=$1 AND seat_id=$2 AND expires_at > now()",
      ["sessao-concorrencia", "A1"]);
    assert.equal(held.rowCount, 1);
    assert.equal(held.rows[0].owner_token, outcomes.find((item) => item.acquired).ownerToken);
    await releaseSeatHoldsForOwner({ sessionId: "sessao-concorrencia", ownerToken: held.rows[0].owner_token });
  } finally {
    for (const { child } of workers) if (!child.killed && child.exitCode === null) child.kill();
  }
}

async function runCrossProcessPaymentRaces(server) {
  const child = fork(path.join(__dirname, "financial-second-instance.js"), [], {
    env: { ...process.env, PORT: "4300", CINE_FINANCIAL_LOST_KEY: LOST_RESPONSE_KEY },
    stdio: ["ignore", "inherit", "inherit", "ipc"], windowsHide: true
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Segunda instância financeira não iniciou")), 20000);
      child.once("message", (message) => { clearTimeout(timeout); message?.type === "ready" ? resolve() : reject(new Error("Instância sem ready")); });
      child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Segunda instância encerrou: ${code}`)); });
    });
    const { queryPostgres, readDbFromPostgres } = require("../backend/db/postgresStore");
    const post = (id, cookie, baseUrl, includeProduct = false) => request("/api/payments/pix", {
      method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify(checkoutBody(id, includeProduct))
    }, baseUrl);
    const calls = () => fs.readFileSync(providerCallFile, "utf8").trim().split("\n").filter(Boolean);
    const sqlCount = async (table, where, value) => {
      const result = await queryPostgres(`SELECT COUNT(*)::integer AS count FROM ${table} WHERE ${where} = $1`, [value]);
      return result.rows[0].count;
    };

    await resetDb(baseDb({ capacity: 2, stock: 2 }));
    let cookie = await registerCustomer("mesma-cobranca@postgres.local");
    const initialCustomerCookie = cookie;
    fs.writeFileSync(providerCallFile, "");
    const key = "mesma-cobranca-duas-instancias";
    // Both HTTP operations are released by the same Promise barrier onto independent servers.
    const samePayment = await Promise.all([post(key, cookie, BASE_URL), post(key, cookie, SECOND_BASE_URL)]);
    assert.equal(samePayment.filter((item) => item.response.status === 201).length, 1);
    assert.equal(samePayment.every((item) => [200, 201, 202].includes(item.response.status)), true);
    assert.equal(calls().length, 1, "Uma identidade deve chegar ao provedor uma só vez");
    assert.equal(await sqlCount("orders", "idempotency_key", key), 1);
    assert.equal(await sqlCount("payments", "order_id", key), 1);
    assert.equal(await sqlCount("tickets", "order_id", key), 0);
    const winner = samePayment.find((item) => item.response.status === 201).payload;
    const webhook = mercadoPagoWebhookRequest({ payment: winner.payment, order: winner.order, eventVersion: 1 });
    const confirmations = await Promise.all([
      request(webhook.pathname, webhook.options, BASE_URL),
      request(webhook.pathname, webhook.options, SECOND_BASE_URL)
    ]);
    assert.deepEqual(confirmations.map((item) => item.response.status), [200, 200]);
    assert.equal(confirmations.filter((item) => item.payload.processed === true).length, 1);
    assert.equal(await sqlCount("tickets", "order_id", key), 1);
    assert.equal(await sqlCount("payments", "order_id", key), 1);
    assert.equal(await sqlCount("webhook_events", "order_id", key), 1);
    const refundSeed = await readDbFromPostgres({ trackChanges: false });

    await resetDb(baseDb({ capacity: 2, stock: 2 }));
    cookie = await registerCustomer("resposta-perdida-duas-instancias@postgres.local");
    fs.writeFileSync(providerCallFile, "");
    const lostResponse = await post(LOST_RESPONSE_KEY, cookie, SECOND_BASE_URL);
    assert.equal(lostResponse.response.status, 503);
    const retryOnOtherServer = await post(LOST_RESPONSE_KEY, cookie, BASE_URL);
    assert.equal(retryOnOtherServer.response.status, 202);
    assert.deepEqual(calls(), [LOST_RESPONSE_KEY], "O segundo processo não pode recriar a cobrança inconclusiva");
    assert.equal(await sqlCount("orders", "idempotency_key", LOST_RESPONSE_KEY), 1);
    assert.equal(await sqlCount("payments", "order_id", LOST_RESPONSE_KEY), 1);
    assert.equal(await sqlCount("tickets", "order_id", LOST_RESPONSE_KEY), 0);
    fs.writeFileSync(reconcileCallFile, "");
    const uncertain = await readDbFromPostgres();
    const lostPayment = uncertain.payments.find((item) => item.orderId === LOST_RESPONSE_KEY);
    const reconcileOnChild = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Reconciliação da segunda instância não respondeu")), 15000);
      child.once("message", (message) => {
        clearTimeout(timeout);
        if (message?.type !== "reconciled" || message.error) reject(new Error(message?.error || "Resposta inválida"));
        else resolve(message.result);
      });
      child.send({ type: "reconcile", paymentId: lostPayment.id });
    });
    const recoveryResults = await Promise.all([
      server.testOnlinePaymentReconciliation.reconcile(lostPayment.id), reconcileOnChild
    ]);
    assert.deepEqual(recoveryResults.sort(), ["completed", "skipped"]);
    assert.equal(await sqlCount("tickets", "order_id", LOST_RESPONSE_KEY), 1);
    assert.deepEqual(calls(), [LOST_RESPONSE_KEY], "Consulta não pode recriar cobrança externa");
    assert.equal(fs.readFileSync(reconcileCallFile, "utf8").trim().split("\n").filter(Boolean).length, 1,
      "O claim deve autorizar apenas uma consulta concorrente");

    refundSeed.integrations = {
      ...(refundSeed.integrations || {}),
      mercadoPago: { enabled: false },
      pagBank: { enabled: true, environment: "sandbox", publicKey: "synthetic-key", accessToken: "synthetic-token" }
    };
    const refundPayment = refundSeed.payments.find((item) => item.orderId === key);
    refundPayment.provider = "pag_bank";
    refundPayment.providerPaymentId = "ORDE_TEST-REFUND-RACE";
    refundPayment.metadata = { ...(refundPayment.metadata || {}), transactionId: "CHAR_TEST-REFUND-RACE",
      providerEnvironment: "sandbox" };
    await resetDb(refundSeed);
    fs.writeFileSync(refundCallFile, "");
    const firstOperator = await loginAdmin();
    const secondLogin = await request("/api/admin/login", { method: "POST", headers: jsonHeaders(),
      body: JSON.stringify({ email: "admin-second@postgres.local", password: process.env.ADMIN_PASSWORD }) }, SECOND_BASE_URL);
    assert.equal(secondLogin.response.status, 200);
    const secondOperator = secondLogin.response.headers.get("set-cookie")?.split(";")[0] || "";
    const cancel = (cookie, baseUrl) => request(`/api/orders/${encodeURIComponent(key)}`, { method: "PATCH",
      headers: jsonHeaders(cookie), body: JSON.stringify({ action: "cancel", reason: "Teste de estorno concorrente" }) }, baseUrl);
    const refunds = await Promise.all([cancel(firstOperator, BASE_URL), cancel(secondOperator, SECOND_BASE_URL)]);
    assert.deepEqual(refunds.map((item) => item.response.status), [200, 200],
      `Refund concorrente: ${refunds.map((item) => JSON.stringify(item.payload)).join(" | ")}`);
    const refundCalls = fs.readFileSync(refundCallFile, "utf8").trim().split("\n").filter(Boolean);
    assert.ok(refundCalls.length >= 1);
    assert.equal(new Set(refundCalls).size, 1, "Dois operadores devem reutilizar a mesma identidade de estorno");
    const refunded = await readDbFromPostgres();
    assert.equal(refunded.orders.find((item) => item.id === key).status, "refunded");
    assert.equal(refunded.tickets.filter((item) => item.orderId === key).length, 1);
    assert.equal(refunded.tickets.find((item) => item.orderId === key).status, "refunded");

    const partialBase = baseDb({ capacity: 2, stock: 2 });
    partialBase.users.push(refundSeed.users.find((user) => user.email === "mesma-cobranca@postgres.local"));
    await resetDb(partialBase);
    cookie = initialCustomerCookie;
    const checkoutIntegrations = structuredClone((await readDbFromPostgres()).integrations || {});
    for (const scope of ["tickets", "concessions"]) {
      const partialKey = `partial-${scope}-two-instances`;
      const created = await post(partialKey, cookie, BASE_URL, true);
      assert.equal(created.response.status, 201, JSON.stringify(created.payload));
      const approvedWebhook = mercadoPagoWebhookRequest({ payment: created.payload.payment, order: created.payload.order });
      const approved = await request(approvedWebhook.pathname, approvedWebhook.options);
      assert.equal(approved.response.status, 200, JSON.stringify(approved.payload));
      const partialSeed = await readDbFromPostgres({ trackChanges: false });
      const partialPayment = partialSeed.payments.find((item) => item.orderId === partialKey);
      assert.equal(partialPayment.status, "approved");
      partialSeed.integrations = {
        ...(partialSeed.integrations || {}),
        mercadoPago: { enabled: false },
        pagBank: { enabled: true, environment: "sandbox", publicKey: "synthetic-key", accessToken: "synthetic-token" }
      };
      partialPayment.provider = "pag_bank";
      partialPayment.providerPaymentId = `ORDE_TEST-${scope.toUpperCase()}-RACE`;
      partialPayment.metadata = { ...(partialPayment.metadata || {}), transactionId: `CHAR_TEST-${scope.toUpperCase()}-RACE`,
        providerEnvironment: "sandbox" };
      await resetDb(partialSeed);
      const before = await readDbFromPostgres();
      const stockBefore = before.concessions.find((item) => item.id === "combo-final").stock;
      fs.writeFileSync(refundCallFile, "");
      const path = `/api/orders/${encodeURIComponent(partialKey)}/refund-${scope}`;
      const refundPartial = (operatorCookie, baseUrl) => request(path, { method: "POST",
        headers: jsonHeaders(operatorCookie), body: JSON.stringify({ reason: "Distributed partial refund" }) }, baseUrl);
      const results = await Promise.all([
        refundPartial(firstOperator, BASE_URL), refundPartial(secondOperator, SECOND_BASE_URL)
      ]);
      assert.deepEqual(results.map((item) => item.response.status), [200, 200],
        `${scope}: ${results.map((item) => JSON.stringify(item.payload)).join(" | ")}`);
      const calls = fs.readFileSync(refundCallFile, "utf8").trim().split("\n").filter(Boolean);
      assert.ok(calls.length >= 1, `${scope}: provider must receive the refund identity`);
      assert.equal(new Set(calls).size, 1, `${scope}: operators must reuse one refund identity`);
      const after = await readDbFromPostgres();
      const order = after.orders.find((item) => item.id === partialKey);
      const payment = after.payments.find((item) => item.orderId === partialKey);
      const ticket = after.tickets.find((item) => item.orderId === partialKey);
      const refund = scope === "tickets" ? order.ticketRefund : order.concessionRefund;
      assert.equal(refund.status, "completed");
      assert.ok(calls.every((id) => id === refund.id));
      assert.equal(payment.status, "approved", "A different product remains paid after a partial refund");
      assert.equal(Number(payment.refundedAmount), Number(refund.amount));
      assert.equal(ticket.status, scope === "tickets" ? "refunded" : "active");
      assert.equal(after.concessions.find((item) => item.id === "combo-final").stock,
        stockBefore + (scope === "concessions" ? 1 : 0));
      assert.equal(await sqlCount("tickets", "order_id", partialKey), 1);
      after.integrations = checkoutIntegrations;
      await resetDb(after);
    }

    await resetDb(baseDb({ capacity: 1, stock: 2 }));
    cookie = await registerCustomer("ultima-poltrona-duas-instancias@postgres.local");
    fs.writeFileSync(providerCallFile, "");
    const seats = await Promise.all([post("cross-seat-a", cookie, BASE_URL), post("cross-seat-b", cookie, SECOND_BASE_URL)]);
    assert.deepEqual(seats.map((item) => item.response.status).sort(), [201, 409]);
    assert.equal(calls().length, 1);
    assert.equal(await sqlCount("orders", "session_id", "sessao-concorrencia"), 1);
    assert.equal(await sqlCount("payments", "order_id", seats.find((item) => item.response.status === 201).payload.order.id), 1);

    await resetDb(baseDb({ capacity: 10, stock: 1 }));
    cookie = await registerCustomer("ultimo-produto-duas-instancias@postgres.local");
    fs.writeFileSync(providerCallFile, "");
    const stock = await Promise.all([post("cross-stock-a", cookie, BASE_URL, true), post("cross-stock-b", cookie, SECOND_BASE_URL, true)]);
    assert.deepEqual(stock.map((item) => item.response.status).sort(), [201, 409]);
    assert.equal(calls().length, 1);
    const product = await queryPostgres("SELECT available, reserved, sold FROM concession_inventory WHERE concession_id=$1", ["combo-final"]);
    assert.equal(product.rowCount, 1);
    assert.equal(Number(product.rows[0].available), 0);
    assert.equal(Number(product.rows[0].reserved), 1);
    assert.equal(Number(product.rows[0].sold), 0);

    await resetDb(baseDb({ capacity: 10, stock: 2, includedTickets: 1 }));
    const clubEmail = "ultimo-credito-duas-instancias@postgres.local";
    const clubCookie = await registerCustomer(clubEmail);
    const clubAdminCookie = await loginAdmin();
    const subscription = await assignClubPlan(clubAdminCookie, clubEmail);
    const clubPost = (id, baseUrl) => request("/api/checkout/club-credit", {
      method: "POST", headers: { ...jsonHeaders(clubCookie), "x-idempotency-key": id },
      body: JSON.stringify({ id, idempotencyKey: id, movieId: "filme-concorrencia", sessionId: "sessao-concorrencia",
        ticketItems: [{ id: "promocional", quantity: 1 }], fullTicketsCount: 1, halfTicketsCount: 0, concessionItems: [] })
    }, baseUrl);
    const credits = await Promise.all([clubPost("cross-credit-a", BASE_URL), clubPost("cross-credit-b", SECOND_BASE_URL)]);
    assert.deepEqual(credits.map((item) => item.response.status).sort(), [201, 409]);
    const creditState = await queryPostgres("SELECT remaining, used FROM subscription_credits WHERE subscription_id=$1", [subscription.id]);
    assert.equal(creditState.rowCount, 1);
    assert.equal(Number(creditState.rows[0].remaining), 0);
    assert.equal(Number(creditState.rows[0].used), 1);
    const issuedOrderId = credits.find((item) => item.response.status === 201).payload.order.id;
    assert.equal(await sqlCount("tickets", "order_id", issuedOrderId), 1);
    assert.equal(await sqlCount("subscription_usage", "subscription_id", subscription.id), 1);
    console.log("PostgreSQL two-instance payment, seat, stock, webhook and credit races passed.");
  } finally {
    if (child.exitCode === null) child.kill();
    await new Promise((resolve) => child.exitCode !== null ? resolve() : child.once("exit", resolve));
  }
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

async function concurrentCheckout(ids, includeProduct, cookie) {
  return Promise.all(ids.map((id) => request("/api/payments/pix", {
    method: "POST",
    headers: jsonHeaders(cookie),
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
  await assertDisposableTestDatabase(TEST_DATABASE_URL);
  execFileSync(process.execPath, [path.join(__dirname, "db-migrate.js")], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit"
  });

  await resetDb(baseDb({ capacity: 1, stock: 2 }));
  fs.writeFileSync(providerCallFile, "");
  const paymentService = require("../backend/services/paymentService");
  const originalCreateMercadoPagoOrderPayment = paymentService.createMercadoPagoOrderPayment;
  paymentService.createMercadoPagoOrderPayment = async (order, config, options) => {
    fs.appendFileSync(providerCallFile, `${options.idempotencyKey || order.idempotencyKey || order.id}\n`);
    return originalCreateMercadoPagoOrderPayment(order, config, options);
  };
  paymentService.searchMercadoPagoOrdersByReference = async (reference) => {
    fs.appendFileSync(reconcileCallFile, `${reference}\n`);
    if (reference !== LOST_RESPONSE_KEY) return { total: 0, orders: [] };
    const db = await require("../backend/db/postgresStore").readDbFromPostgres();
    const order = db.orders.find((item) => item.id === reference);
    return { total: 1, orders: [{ provider: "mercado_pago", id: "ORD_TEST_CROSS_RECOVERY",
      externalReference: reference, amount: Number(order.totalPrice), status: "approved",
      raw: { currency_id: "BRL" } }] };
  };
  const refundService = require("../backend/services/orderRefundService");
  const originalSubmitFullRefund = refundService.submitFullRefund;
  refundService.submitFullRefund = async (refund, ...args) => {
    fs.appendFileSync(refundCallFile, `${refund.id}\n`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    return originalSubmitFullRefund(refund, ...args);
  };
  for (const method of ["submitPartialRefund", "submitConcessionRefund"]) {
    const original = refundService[method];
    refundService[method] = async (refund, ...args) => {
      fs.appendFileSync(refundCallFile, `${refund.id}\n`);
      await new Promise((resolve) => setTimeout(resolve, 60));
      return original(refund, ...args);
    };
  }
  const server = require("../backend/server.js");

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const initialAdminCookie = await loginAdmin();
    const initialContent = await request("/api/admin/content", {headers: jsonHeaders(initialAdminCookie)});
    const changedContent = await request("/api/content", {
      method: "PUT", headers: jsonHeaders(initialAdminCookie),
      body: JSON.stringify({settings: {...initialContent.payload.settings, emailTemplateLibrary: [{id: "private-test"}]}})
    });
    assert.equal(changedContent.response.status, 200, JSON.stringify(changedContent.payload));
    const publicContent = await request("/api/content");
    assert.equal(publicContent.payload.settings.emailTemplateLibrary, undefined);
    let checkoutCookie = await registerCustomer("checkout-seat@postgres.local");

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
    await runCrossProcessSeatRace();

    const lastSeat = await concurrentCheckout(["ultimo-ingresso-a", "ultimo-ingresso-b"], false, checkoutCookie);
    const seatStatuses = lastSeat.map((item) => item.response.status).sort();
    assert.deepEqual(seatStatuses, [201, 409]);

    await resetDb(baseDb({ capacity: 10, stock: 1 }));
    checkoutCookie = await registerCustomer("checkout-product@postgres.local");
    const productIds = Array.from({ length: 10 }, (_, index) => `ultimo-produto-${index + 1}`);
    const lastProduct = await concurrentCheckout(productIds, true, checkoutCookie);
    const productStatuses = lastProduct.map((item) => item.response.status).sort();
    assert.equal(productStatuses.filter((status) => status === 201).length, 1);
    assert.equal(productStatuses.filter((status) => status === 409).length, 9);

    await resetDb(baseDb({ capacity: 2, stock: 1 }));
    checkoutCookie = await registerCustomer("checkout-webhook@postgres.local");
    const pix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(checkoutCookie),
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
    await writeDbToPostgres(persistedAfterCommit.payload, { importSnapshot: true });
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

    await runCrossProcessPaymentRaces(server);
    console.log("PostgreSQL concurrency tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await require("../backend/db/postgresStore").closePostgres();
    fs.rmSync(providerCallFile, { force: true });
    fs.rmSync(refundCallFile, { force: true });
    fs.rmSync(reconcileCallFile, { force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
