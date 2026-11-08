const fs = require("fs");
const assert = require("assert/strict");
const crypto = require("crypto");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const WebSocket = require("ws");
const adminTwoFactorService = require("../backend/services/adminTwoFactorService");
const ticketCodeService = require("../backend/services/ticketCodeService");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");
const { installOnlinePaymentProbe, runOnlinePaymentFailureScenarios } = require("./financial-online-failure-scenarios");
const { runMercadoPagoWebhookFailureScenarios } = require("./financial-webhook-failure-scenarios");
const { runPagBankWebhookCommitScenario } = require("./financial-pagbank-webhook-failure-scenarios");
const { runPagBankCheckoutFailureScenarios } = require("./financial-pagbank-checkout-failure-scenarios");

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cine-smoke-"));
const DATA_FILE = path.join(testRoot, "db.json");
const postgresMode = process.env.CINE_SMOKE_MODE !== "json";
const PORT = 4199;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_MOVIE_ID = "smoke-programacao";
const TEST_SESSION_ID = "smoke-programacao-1";
const TEST_EXPIRED_SESSION_ID = "smoke-programacao-expirada";
const TEST_SECOND_MOVIE_ID = "smoke-programacao-2";
const TEST_SECOND_SESSION_ID = "smoke-programacao-2-sessao";
const TEST_SEAT_MOVIE_ID = "smoke-poltronas";
const TEST_SEAT_SESSION_ID = "smoke-poltronas-sessao";

function futureSession(hoursAhead) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const mainSession = futureSession(6);
const seatSession = futureSession(7);
const secondSession = futureSession(9);
const reportDate = futureSession(0).date;
const pdfSessionLabel = ({ date, time }) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)} as ${time}`;

process.env.PORT = String(PORT);
process.env.NODE_ENV = "test";
process.env.DATA_STORE = postgresMode ? "postgres" : "json";
if (postgresMode) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
  process.env.POSTGRES_URL = "";
} else {
  process.env.DATABASE_URL = "";
  process.env.POSTGRES_URL = "";
}
process.env.CINE_DATA_FILE = DATA_FILE;
process.env.CINE_UPLOADS_DIR = path.join(testRoot, "uploads");
process.env.CINE_EMAIL_ATTACHMENTS_DIR = path.join(testRoot, "email-attachments");
process.env.CINE_TICKET_DOCUMENTS_DIR = path.join(testRoot, "ticket-documents");
process.env.PAYMENTS_MODE = "test";
process.env.TEST_PAYMENTS_AUTO_APPROVE = "false";
process.env.ADMIN_EMAIL = "admin@cinecruzeiro.local";
process.env.ADMIN_PASSWORD = "admin-smoke-123456";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = "smoke-mercado-pago-webhook-secret";
process.env.WEBHOOK_TESTER_ENABLED = "true";
process.env.MAX_JSON_BODY_BYTES = String(64 * 1024);
process.env.MOVIE_IMAGE_MAINTENANCE_ENABLED = "false";
process.env.GOOGLE_WALLET_SYNC_OBJECTS = "false";

async function readPersistedDb() {
  return postgresMode
    ? require("../backend/db/postgresStore").readDbFromPostgres({ trackChanges: false })
    : JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

async function writePersistedDb(db) {
  if (postgresMode) await require("../backend/db/postgresStore").writeDbToPostgres(db, { importSnapshot: true });
  else fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

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

async function requestUntil(pathname, options, matches, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let result;
  do {
    result = await request(pathname, options);
    if (matches(result)) return result;
    await new Promise((resolve) => setTimeout(resolve, 25));
  } while (Date.now() < deadline);
  assert.fail(`Estado esperado não apareceu em ${pathname}: ${JSON.stringify(result.payload)}`);
}

async function rawHttpRequest(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "localhost", port: PORT, path: pathname, method: "GET", headers }, (res) => {
      res.resume();
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function holdSeat(sessionId, seatId, ownerToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${PORT}/api/realtime/seats`);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Tempo esgotado ao reservar poltrona no teste."));
    }, 5000);
    socket.on("open", () => socket.send(JSON.stringify({ type: "join_session", requestId: "join", sessionId, ownerToken })));
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === "session_state") {
        socket.send(JSON.stringify({ type: "select_seat", requestId: "select", seatId }));
      }
      if (message.type === "select_seat_confirmed") {
        clearTimeout(timer);
        socket.close();
        resolve(message);
      }
      if (message.type === "select_seat_rejected" || message.type === "protocol_error") {
        clearTimeout(timer);
        socket.close();
        reject(new Error(message.message));
      }
    });
    socket.on("error", reject);
  });
}

async function registerCustomer(email, password = "cliente-smoke-123") {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ firstName: "Teste", lastName: "Smoke", email, password, cpf: "12345678901" })
  });
  assert.equal(result.response.status, 201);
  const setCookie = result.response.headers.get("set-cookie") || "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=/i);
  const cookie = setCookie.split(";")[0] || "";
  assert.match(cookie, /^cine_customer=/);
  assert.equal("token" in result.payload, false);
  return { cookie, user: result.payload.user };
}

async function loginAdmin() {
  const result = await request("/api/admin/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    })
  });
  assert.equal(result.response.status, 200);
  const setCookie = result.response.headers.get("set-cookie") || "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=/i);
  const cookie = setCookie.split(";")[0] || "";
  assert.match(cookie, /^cine_admin=/);
  return cookie;
}

async function run() {
  if (postgresMode) {
    await assertDisposableTestDatabase();
    execFileSync(process.execPath, [path.join(__dirname, "db-migrate.js")], { env: process.env, stdio: "inherit" });
  }
  const db = {
    settings: {},
    rooms: [{ id: "sala-cruzeiro", name: "Sala Cruzeiro", technology: "Laser 4K", capacity: 100, status: "active" }],
    ticketTypes: [{ id: "promocional", name: "Ingresso Promocional", price: 10, active: true }],
    concessions: [{ id: "combo-classico", name: "Combo Clássico", category: "combo", price: 25, stock: 3, active: true }],
    ads: [{ id: "banner-site-pix", title: "Compre pelo site e pague no Pix", placement: "movie", imageUrl: "", linkUrl: "", active: true }]
  };
  db.settings = { ...(db.settings || {}), adminTwoFactorRequired: false };
  db.users = (db.users || []).map((user) =>
    user.id === "admin" || user.email === process.env.ADMIN_EMAIL
      ? { ...user, id: "admin", email: process.env.ADMIN_EMAIL, role: "owner", active: true, passwordHash: "" }
      : user
  ).filter((user) => !["smoke-operador-clube", "smoke-gerente-integracoes"].includes(user.id));
  if (!db.users.some((user) => user.id === "admin")) {
    db.users.push({ id: "admin", name: "Administrador", email: process.env.ADMIN_EMAIL, role: "owner", active: true, passwordHash: "" });
  }
  const adminSalt = crypto.randomBytes(16).toString("base64url");
  db.users.find((user) => user.id === "admin").passwordHash = `pbkdf2_sha256$600000$${adminSalt}$${crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD, adminSalt, 600000, 32, "sha256").toString("base64url")}`;
  db.concessions = (db.concessions || []).filter((item) => item.id !== "smoke-counter-product").map((item) =>
    item.id === "combo-classico" ? { ...item, stock: 3, reserved: 0, sold: 0 } : item
  );
  db.concessions.push({
    id: "smoke-counter-product",
    sku: "SMOKE-PDV",
    name: "Pipoca Smoke PDV",
    category: "pipoca",
    price: 17.5,
    stock: 2,
    stockUnit: "kg",
    usagePerSale: 0.25,
    maxPerOrder: 8,
    active: true
  });
  db.concessions.push({ id: "smoke-last-stock", name: "Produto último estoque", category: "pipoca", price: 5, stock: 1, active: true });
  if (postgresMode) db.concessions.push({ id: "smoke-cross-channel-stock", name: "Produto entre canais", category: "pipoca", price: 5, stock: 1, active: true });
  db.ticketTypes = (db.ticketTypes || []).filter((item) => item.id !== "triple-smoke");
  db.ticketTypes.push({ id: "triple-smoke", name: "Triple Ingresso", price: 25, description: "Pacote de teste", bundleQuantity: 3, active: true });
  db.promotions = (db.promotions || []).filter((item) => !["cupom-smoke-20", "cupom-smoke-gratis"].includes(item.id));
  db.promotions.push(
    {
      id: "cupom-smoke-20",
      title: "Cupom Smoke 20%",
      description: "Teste de cálculo e elegibilidade",
      discountType: "percent",
      value: 20,
      couponCode: "SMOKE20",
      appliesTo: "all",
      minimumOrderValue: 5,
      maximumDiscount: 50,
      usageLimit: 10,
      perCustomerLimit: 2,
      allowClubStacking: true,
      allowedMovieIds: [TEST_MOVIE_ID],
      active: true
    },
    {
      id: "cupom-smoke-gratis",
      title: "Cupom Smoke Gratuito",
      description: "Teste de pedido sem cobrança",
      discountType: "percent",
      value: 100,
      couponCode: "SMOKEFREE",
      appliesTo: "tickets",
      perCustomerLimit: 1,
      allowedMovieIds: [TEST_MOVIE_ID],
      active: true
    }
  );
  db.movies = (db.movies || []).filter((movie) => ![TEST_MOVIE_ID, TEST_SECOND_MOVIE_ID, TEST_SEAT_MOVIE_ID, "smoke-filme-edicao", "smoke-rascunho-admin"].includes(movie.id));
  db.rooms = (db.rooms || []).filter((room) => room.id !== "sala-poltronas-smoke");
  db.rooms.push({
    id: "sala-poltronas-smoke",
    name: "Sala Poltronas Smoke",
    capacity: 6,
    technology: "Teste numerado",
    status: "active",
    seatSelectionEnabled: true,
    seatTypes: [
      { id: "standard", name: "Padrão", color: "#2563eb", description: "Convencional" },
      { id: "premium", name: "Premium", color: "#b45309", description: "Conforto ampliado" }
    ],
    seatLayout: {
      screenLabel: "TELA TESTE",
      rows: [
        { id: "row-a", label: "A", seats: [
          { id: "a1", label: "A1", typeId: "standard", color: "#e11d48", accessibility: "wheelchair", enabled: true },
          { id: "a2", label: "A2", typeId: "standard", enabled: true, aisleAfter: true },
          { id: "a3", label: "A3", typeId: "premium", accessibility: "obese", enabled: true }
        ] },
        { id: "row-b", label: "B", seats: [
          { id: "b1", label: "B1", typeId: "standard", enabled: true },
          { id: "b2", label: "B2", typeId: "standard", enabled: false },
          { id: "b3", label: "B3", typeId: "premium", enabled: true }
        ] }
      ]
    }
  });
  db.orders = (db.orders || []).filter((order) => order.id !== "smoke-expired-history-order");
  db.tickets = (db.tickets || []).filter((ticket) => ticket.id !== "smoke-expired-history-ticket");
  db.movies.push({
    id: TEST_MOVIE_ID,
    status: "now_playing",
    title: "Filme Smoke Programação",
    originalTitle: "Smoke Schedule Movie",
    synopsis: "Filme usado apenas pelos testes automatizados.",
    duration: "1h 30m",
    genre: ["Teste"],
    rating: "L",
    posterUrl: "",
    backdropUrl: "",
    trailerYoutubeId: "",
    isHighlight: false,
    tag: "Estreia",
    sessions: [
      {
        id: TEST_SESSION_ID,
        date: mainSession.date,
        time: mainSession.time,
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        ticketTypeIds: ["promocional", "triple-smoke"],
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      },
      {
        id: TEST_EXPIRED_SESSION_ID,
        date: "2000-01-01",
        time: "19:00",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        ticketTypeIds: ["promocional"],
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      }
    ]
  });
  db.movies.push({
    id: TEST_SEAT_MOVIE_ID,
    status: "now_playing",
    title: "Filme Smoke Poltronas",
    duration: "1h 20m",
    genre: ["Teste"],
    rating: "L",
    sessions: [{
      id: TEST_SEAT_SESSION_ID,
      date: seatSession.date,
      time: seatSession.time,
      format: "2D Dublado",
      room: "Sala Poltronas Smoke (Teste numerado)",
      ticketTypeIds: ["promocional", "triple-smoke"],
      status: "available"
    }]
  });
  db.orders.push({
    id: "smoke-expired-history-order",
    movieId: TEST_MOVIE_ID,
    sessionId: TEST_EXPIRED_SESSION_ID,
    status: "paid",
    customerName: "Histórico Smoke",
    customerEmail: "historico@smoke.local",
    customerUserId: "historico-smoke-local",
    totalPrice: 10,
    concessionItems: [],
    createdAt: "2000-01-01T20:00:00.000Z"
  });
  db.tickets.push({
    id: "smoke-expired-history-ticket",
    orderId: "smoke-expired-history-order",
    movieId: TEST_MOVIE_ID,
    sessionId: TEST_EXPIRED_SESSION_ID,
    code: "CC-0011223344556677",
    qrPayload: "CINECRUZEIRO:TICKET:CC-0011223344556677",
    ticketType: "Ingresso Promocional",
    status: "active",
    customerName: "Histórico Smoke",
    customerEmail: "historico@smoke.local",
    customerUserId: "historico-smoke-local",
    createdAt: "2000-01-01T20:00:00.000Z"
  });
  db.movies.push({
    id: TEST_SECOND_MOVIE_ID,
    status: "now_playing",
    title: "Segundo Filme Smoke",
    duration: "1h 15m",
    genre: ["Teste"],
    rating: "L",
    sessions: [{
      id: TEST_SECOND_SESSION_ID,
      date: secondSession.date,
      time: secondSession.time,
      format: "2D Legendado",
      room: "Sala Cruzeiro (Laser 4K)",
      ticketTypeIds: ["promocional"],
      status: "available"
    }]
  });
  await writePersistedDb(db);

  const paymentService = require("../backend/services/paymentService");
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  await assert.rejects(
    () => paymentService.createMercadoPagoOrderPayment(
      { id: "smoke-real-pix", totalPrice: 10, customerEmail: "pix@cine.local" },
      { environment: "sandbox", accessToken: "APP_USR_smoke" },
      { method: "pix" }
    ),
    (error) => error?.code === "MERCADO_PAGO_PRODUCTION_REQUIRED"
  );
  await assert.rejects(
    () => paymentService.createMercadoPagoOrderPayment(
      { id: "smoke-test-payer", totalPrice: 10, customerEmail: "test_payer_123@testuser.com" },
      { environment: "production", accessToken: "APP_USR_smoke" },
      { method: "pix" }
    ),
    (error) => error?.code === "MERCADO_PAGO_TEST_PAYER_NOT_ALLOWED"
  );
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  const onlinePaymentProbe = installOnlinePaymentProbe(paymentService);

  const pointProvider = require("../backend/services/cardTerminalProvider");
  const mockPointOrders = new Map();
  const mockPointPrints = new Map();
  const mockPointRefunds = new Map();
  let pointCancelMode = "cancelled";
  let pointCancelCalls = 0;
  let pointStatusError = "";
  let pointPrintFails = false;
  let pointCreateLosesResponse = false;
  pointProvider.terminalConnection = async () => ({ connected: true, terminal: { id: "smoke-point-terminal" } });
  pointProvider.createPayment = async (order, _config, options) => {
    const existing = [...mockPointOrders.values()].find((item) => item.idempotencyKey === options.idempotencyKey);
    if (existing) return { ...existing };
    const payment = {
      id: `ORD-SMOKE-${mockPointOrders.size + 1}`,
      externalReference: options.externalReference,
      idempotencyKey: options.idempotencyKey,
      status: "pending",
      providerStatus: "at_terminal",
      amount: Number(order.totalPrice),
      terminalId: "smoke-point-terminal"
    };
    mockPointOrders.set(payment.id, payment);
    if (pointCreateLosesResponse) {
      pointCreateLosesResponse = false;
      throw Object.assign(new Error("Mock Point response lost"), { code: "POINT_CONNECTION_LOST", statusCode: 504 });
    }
    return { ...payment };
  };
  pointProvider.getStatus = async (id) => {
    if (pointStatusError) throw Object.assign(new Error("Mock Point status unavailable"), { statusCode: 504, code: pointStatusError });
    const payment = mockPointOrders.get(id);
    if (!payment && id === "ORD-SMOKE-CROSS-INSTANCE") {
      const local = (await readPersistedDb()).payments.find((item) => item.providerPaymentId === id);
      if (local) return { id, externalReference: local.providerReference, status: "pending", providerStatus: "at_terminal",
        amount: Number(local.amount), terminalId: "smoke-point-terminal" };
    }
    if (!payment) throw Object.assign(new Error("Mock Point order missing"), { statusCode: 404, code: "POINT_ORDER_MISSING" });
    return { ...payment };
  };
  pointProvider.cancelPayment = async (id) => {
    pointCancelCalls += 1;
    if (pointCancelMode === "refused") throw Object.assign(new Error("Mock Point refusal"), { statusCode: 409, code: "POINT_CANCEL_REFUSED" });
    if (pointCancelMode === "timeout") throw Object.assign(new Error("Mock Point timeout"), { statusCode: 504, code: "POINT_CONNECTION_LOST" });
    const payment = mockPointOrders.get(id);
    payment.status = pointCancelMode;
    payment.providerStatus = pointCancelMode === "pending" ? "processing" : pointCancelMode;
    return { ...payment };
  };
  pointProvider.refundPayment = async (id, _config, options) => {
    const existing = mockPointRefunds.get(options.idempotencyKey);
    if (existing) return { ...existing };
    const payment = mockPointOrders.get(id);
    if (!payment) throw Object.assign(new Error("Mock Point refund order missing"), { statusCode: 404 });
    payment.status = "refunded";
    payment.providerStatus = "refunded";
    mockPointRefunds.set(options.idempotencyKey, { ...payment });
    return { ...payment };
  };
  pointProvider.createTicketPrint = async (_tickets, _config, options) => {
    if (pointPrintFails) throw Object.assign(new Error("Mock Point printer unavailable"), { code: "POINT_PRINT_FAILED" });
    const reference = options.externalReference;
    if (!mockPointPrints.has(reference)) mockPointPrints.set(reference, { id: `PRINT-SMOKE-${mockPointPrints.size + 1}`, terminalId: "smoke-point-terminal" });
    return { ...mockPointPrints.get(reference) };
  };
  pointProvider.getPrintStatus = async (id) => ({ id, status: "printed", providerStatus: "finished", statusDetail: "" });

  const server = require("../backend/server.js");
  const deliveredEmails = [];
  const emailWebhookServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const delivery = JSON.parse(raw || "{}");
      deliveredEmails.push(delivery);
      const finish = () => {
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      };
      if (delivery.event === "payment.approved") setTimeout(finish, 1500);
      else finish();
    });
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await new Promise((resolve) => emailWebhookServer.listen(4200, "127.0.0.1", resolve));

    const health = await request("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, "ok");
    assert.equal("checks" in health.payload, false);
    assert.equal("envFilesLoaded" in health.payload, false);
    assert.equal("jwtConfigured" in health.payload, false);
    const liveness = await request("/api/health/live");
    assert.equal(liveness.response.status, 200);
    assert.equal(liveness.payload.status, "alive");
    const readiness = await request("/api/health/ready");
    assert.equal(readiness.response.status, 200);
    assert.equal(readiness.payload.status, "ready");
    assert.equal("checks" in readiness.payload, false);
    const publicContent = await request("/api/content");
    assert.equal(publicContent.response.status, 200);
    assert.equal(publicContent.payload.settings.cinemaName, "Cine Cruzeiro");
    assert.equal(publicContent.payload.settings.defaultTicketPrice, 10);
    const normalizedMovie = publicContent.payload.movies.find((item) => item.id === TEST_MOVIE_ID);
    assert.equal(normalizedMovie.slug, TEST_MOVIE_ID);
    assert.equal(normalizedMovie.workflowStatus, "published");
    assert.equal(normalizedMovie.sortOrder, 100);
    const normalizedSession = normalizedMovie.sessions.find((item) => item.id === TEST_SESSION_ID);
    assert.deepEqual(normalizedSession.ticketTypeIds, ["promocional", "triple-smoke"]);
    assert.equal(normalizedSession.priceFull, 10);
    assert.equal(normalizedSession.priceHalf, 25);
    assert.ok((publicContent.payload.concessions || []).every((item) => !("stock" in item) && !("reserved" in item) && !("sold" in item)));
    let maintainedDb = await readPersistedDb();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const movie = maintainedDb.movies.find((item) => item.id === TEST_MOVIE_ID);
      if (!movie?.sessions.some((session) => session.id === TEST_EXPIRED_SESSION_ID)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      maintainedDb = await readPersistedDb();
    }
    const maintainedMovie = maintainedDb.movies.find((movie) => movie.id === TEST_MOVIE_ID);
    const maintainedOrder = maintainedDb.orders.find((order) => order.id === "smoke-expired-history-order");
    const maintainedTicket = maintainedDb.tickets.find((ticket) => ticket.id === "smoke-expired-history-ticket");
    assert.equal(maintainedMovie.sessions.some((session) => session.id === TEST_EXPIRED_SESSION_ID), false);
    assert.equal(maintainedOrder.sessionId, "");
    assert.equal(maintainedOrder.archivedSessionId, TEST_EXPIRED_SESSION_ID);
    assert.equal(maintainedOrder.sessionTime, "19:00");
    assert.equal(maintainedTicket.sessionId, "");
    assert.equal(maintainedTicket.status, "expired");

    const invalidRegistration = await request("/api/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "T", email: "email-invalido", password: "123456" })
    });
    assert.equal(invalidRegistration.response.status, 422);
    assert.equal(invalidRegistration.payload.error.code, "CUSTOMER_NAME_INVALID");

    const weakPasswordRegistration = await request("/api/auth/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "Cliente Teste", email: `weak-${Date.now()}@cine.local`, password: "1234567890" })
    });
    assert.equal(weakPasswordRegistration.response.status, 422);
    assert.equal(weakPasswordRegistration.payload.error.code, "CUSTOMER_PASSWORD_INVALID");

    const oversizedPayload = await request("/api/events", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ event: "club_lead.created", data: { notes: "x".repeat(70 * 1024) } })
    });
    assert.equal(oversizedPayload.response.status, 413);
    assert.equal(oversizedPayload.payload.error.code, "PAYLOAD_TOO_LARGE");

    const email = "historico@smoke.local";
    const registered = await registerCustomer(email);
    const target = await registerCustomer(`target-${Date.now()}@cine.local`);
    let cookie = registered.cookie;
    const targetCookie = target.cookie;
    let adminCookie = await loginAdmin();
    const adsDisabled = await request("/api/ads/status", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(adsDisabled.response.status, 200);
    assert.equal(adsDisabled.payload.enabled, false);
    const publicContentWithoutAds = await requestUntil(
      "/api/content", {}, ({ payload }) => Array.isArray(payload.ads) && payload.ads.length === 0
    );
    assert.equal(publicContentWithoutAds.payload.ads.length, 0);
    const privateContentWithDisabledAds = await requestUntil(
      "/api/admin/content",
      { headers: jsonHeaders(adminCookie) },
      ({ payload }) => payload.settings?.adsEnabled === false
    );
    assert.ok(privateContentWithDisabledAds.payload.ads.length > 0);
    assert.equal(privateContentWithDisabledAds.payload.settings.adsEnabled, false);
    const blockedAdMetric = await request(`/api/marketing/ads/${encodeURIComponent(privateContentWithDisabledAds.payload.ads[0].id)}/impression`, { method: "POST" });
    assert.equal(blockedAdMetric.response.status, 404);
    const adsEnabled = await request("/api/ads/status", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ enabled: true })
    });
    assert.equal(adsEnabled.response.status, 200);
    assert.equal(adsEnabled.payload.enabled, true);
    const publicContentWithAds = await requestUntil(
      "/api/content", {}, ({ payload }) => Array.isArray(payload.ads) && payload.ads.length > 0
    );
    assert.ok(publicContentWithAds.payload.ads.length > 0);
    const performance = await request("/api/admin/logs/performance", { headers: jsonHeaders(adminCookie) });
    assert.equal(performance.response.status, 200);
    assert.ok(performance.payload.current.vcores > 0);
    const publicPerformance = await request("/api/admin/logs/performance");
    assert.equal(publicPerformance.response.status, 401);
    const dailySales = await request("/api/admin/concession-sales", { headers: jsonHeaders(adminCookie) });
    assert.equal(dailySales.response.status, 200);
    assert.ok(Array.isArray(dailySales.payload.groups));

    const templateLibrary = await request("/api/admin/email/template-library?pageSize=48&origin=SYSTEM", { headers: jsonHeaders(adminCookie) });
    assert.equal(templateLibrary.response.status, 200);
    assert.equal(templateLibrary.payload.systemModelCount, 28);
    assert.equal(templateLibrary.payload.items.length, 28);

    const couponOrder = {
      movieId: TEST_MOVIE_ID,
      sessionId: TEST_SESSION_ID,
      ticketItems: [{ id: "promocional", quantity: 1 }],
      concessionItems: [],
      couponCode: "SMOKE20"
    };
    const anonymousCouponPreview = await request("/api/coupons/preview", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ order: couponOrder })
    });
    assert.equal(anonymousCouponPreview.response.status, 401);
    assert.equal(anonymousCouponPreview.payload.error.code, "AUTH_REQUIRED");

    const anonymousPix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ order: { ...couponOrder, id: "smoke-anonymous-pix", idempotencyKey: "smoke-anonymous-pix" } })
    });
    assert.equal(anonymousPix.response.status, 401);
    assert.equal(anonymousPix.payload.error.code, "AUTH_REQUIRED");

    const anonymousCard = await request("/api/payments/card", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ order: { ...couponOrder, id: "smoke-anonymous-card", idempotencyKey: "smoke-anonymous-card" } })
    });
    assert.equal(anonymousCard.response.status, 401);
    assert.equal(anonymousCard.payload.error.code, "AUTH_REQUIRED");

    for (const [path, extraBody] of [["/api/payments/pix", {}], ["/api/payments/card", { cardToken: "token-teste" }]]) {
      const tamperedId = `smoke-price-tampering-${path.endsWith("pix") ? "pix" : "card"}-${Date.now()}`;
      const tampered = await request(path, {
        method: "POST",
        headers: jsonHeaders(targetCookie),
        body: JSON.stringify({
          ...extraBody,
          idempotencyKey: tamperedId,
          order: { ...couponOrder, id: tamperedId, idempotencyKey: tamperedId, total: 0.01, totalPrice: 0.01 }
        })
      });
      assert.equal(tampered.response.status, 409);
      assert.equal(tampered.payload.error.code, "CLIENT_PRICE_MISMATCH");
      assert.equal(tampered.payload.qrCode, undefined);
      assert.equal(tampered.payload.preference_id, undefined);
      assert.equal(tampered.payload.payment, undefined);
    }

    const couponPreview = await request("/api/coupons/preview", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify({ order: couponOrder })
    });
    assert.equal(couponPreview.response.status, 200);
    assert.equal(couponPreview.payload.valid, true);
    assert.equal(couponPreview.payload.coupon.code, "SMOKE20");
    assert.equal(couponPreview.payload.coupon.discountValue, Number((couponPreview.payload.subtotal * 0.2).toFixed(2)));
    assert.equal(couponPreview.payload.total, Number((couponPreview.payload.subtotal * 0.8).toFixed(2)));

    const invalidCoupon = await request("/api/coupons/preview", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify({ order: { ...couponOrder, couponCode: "NAOEXISTE" } })
    });
    assert.equal(invalidCoupon.response.status, 422);
    assert.equal(invalidCoupon.payload.error.code, "COUPON_NOT_FOUND");

    const wrongMovieCoupon = await request("/api/coupons/preview", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify({ order: { ...couponOrder, movieId: TEST_SECOND_MOVIE_ID, sessionId: TEST_SECOND_SESSION_ID } })
    });
    assert.equal(wrongMovieCoupon.response.status, 409);
    assert.equal(wrongMovieCoupon.payload.error.code, "COUPON_MOVIE_NOT_ELIGIBLE");

    const freeCouponOrderId = `smoke-coupon-free-${Date.now()}`;
    const freeCouponCheckout = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify({
        idempotencyKey: freeCouponOrderId,
        order: { ...couponOrder, id: freeCouponOrderId, idempotencyKey: freeCouponOrderId, couponCode: "SMOKEFREE" }
      })
    });
    assert.equal(freeCouponCheckout.response.status, 201);
    assert.equal(freeCouponCheckout.payload.order.status, "paid");
    assert.equal(freeCouponCheckout.payload.order.totalPrice, 0);
    assert.equal(freeCouponCheckout.payload.payment, null);
    assert.equal(freeCouponCheckout.payload.tickets.length, 1);
    const freeCouponPersisted = await requestUntil(
      "/api/admin/content",
      { headers: jsonHeaders(adminCookie) },
      ({ payload }) => payload.orders?.some((item) => item.id === freeCouponOrderId)
    );
    assert.equal(freeCouponPersisted.response.status, 200, JSON.stringify(freeCouponPersisted.payload));
    const freeCouponOrder = freeCouponPersisted.payload.orders.find((order) => order.id === freeCouponOrderId);
    assert.ok(freeCouponOrder);
    assert.equal(freeCouponOrder.status, "paid", JSON.stringify(freeCouponOrder));
    assert.equal(freeCouponOrder.couponCode, "SMOKEFREE", JSON.stringify(freeCouponOrder));
    assert.ok(Number(freeCouponOrder.couponDiscount) > 0, JSON.stringify(freeCouponOrder));

    const repeatedFreeCoupon = await request("/api/coupons/preview", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify({ order: { ...couponOrder, couponCode: "SMOKEFREE" } })
    });
    assert.equal(repeatedFreeCoupon.response.status, 409);
    assert.equal(repeatedFreeCoupon.payload.error.code, "COUPON_CUSTOMER_LIMIT_REACHED");

    const couponAdminContent = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(couponAdminContent.response.status, 200);
    const freeCouponStats = couponAdminContent.payload.promotions.find((item) => item.id === "cupom-smoke-gratis");
    assert.equal(freeCouponStats.usageCount, 1);
    assert.equal(freeCouponStats.discountGranted, couponPreview.payload.subtotal);

    const duplicateCoupon = await request("/api/promotions", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ title: "Código duplicado", couponCode: "SMOKE20", discountType: "percent", value: 5, active: true })
    });
    assert.equal(duplicateCoupon.response.status, 409);
    assert.equal(duplicateCoupon.payload.error.code, "COUPON_CODE_DUPLICATE");

    const twoFactorSetup = await request("/api/admin/2fa/setup", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(twoFactorSetup.response.status, 200);
    assert.match(twoFactorSetup.payload.qrCodeDataUrl, /^data:image\/png;base64,/);
    const twoFactorCode = adminTwoFactorService.totp(twoFactorSetup.payload.secret);
    const twoFactorEnable = await request("/api/admin/2fa/enable", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ code: twoFactorCode })
    });
    assert.equal(twoFactorEnable.response.status, 200);
    assert.equal(twoFactorEnable.payload.recoveryCodes.length, 10);

    const protectedLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(protectedLogin.response.status, 202);
    assert.equal(protectedLogin.payload.twoFactorRequired, true);
    const verifiedLogin = await request("/api/admin/login/2fa", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ challenge: protectedLogin.payload.challenge, code: adminTwoFactorService.totp(twoFactorSetup.payload.secret) })
    });
    assert.equal(verifiedLogin.response.status, 200);
    adminCookie = (verifiedLogin.response.headers.get("set-cookie") || "").split(";")[0] || "";
    assert.match(adminCookie, /^cine_admin=/);

    const twoFactorStatus = await request("/api/admin/2fa/status", { headers: jsonHeaders(adminCookie) });
    assert.equal(twoFactorStatus.response.status, 200);
    assert.equal(twoFactorStatus.payload.enabled, true);
    assert.equal(twoFactorStatus.payload.recoveryCodesRemaining, 10);
    const twoFactorDisable = await request("/api/admin/2fa/disable", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD, code: adminTwoFactorService.totp(twoFactorSetup.payload.secret) })
    });
    assert.equal(twoFactorDisable.response.status, 200);

    const emailIntegration = await request("/api/admin/integrations/email", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        enabled: true,
        provider: "webhook",
        webhookUrl: "http://127.0.0.1:4200/email",
        fromEmail: "atendimento@cinecruzeiro.local",
        notificationEmail: "eventos@cinecruzeiro.local"
      })
    });
    assert.equal(emailIntegration.response.status, 200);

    const verificationCandidate = await registerCustomer(`verify-${Date.now()}@cine.local`);
    const verificationDelivery = [...deliveredEmails].reverse().find((item) => item.event === "email_verification.requested");
    assert.ok(verificationDelivery?.data?.verificationUrl);
    assert.match(verificationDelivery.html || "", /favicon-email\.png/);
    assert.match(verificationDelivery.html || "", /Confirmar e-mail/);
    const verificationToken = new URL(verificationDelivery.data.verificationUrl).searchParams.get("emailToken");
    assert.ok(verificationToken);
    const verifiedAccount = await request("/api/auth/email/verify", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: verificationToken })
    });
    assert.equal(verifiedAccount.response.status, 200);
    assert.equal(verifiedAccount.payload.user.id, verificationCandidate.user.id);
    assert.equal(verifiedAccount.payload.user.emailVerified, true);

    const eventInquiry = await request("/api/events", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        event: "private_rental.inquiry",
        data: {
          name: "Cliente Evento",
          phone: "11999999999",
          email: "evento@cliente.local",
          eventType: "corporativo",
          desiredDate: "2099-12-30 19:00",
          estimatedGuests: "40 pessoas",
          notes: "Teste de evento"
        }
      })
    });
    assert.equal(eventInquiry.response.status, 202);
    assert.equal(eventInquiry.payload.success, true);
    assert.equal(eventInquiry.payload.acknowledgementSent, true);
    assert.deepEqual(deliveredEmails.slice(-2).map((item) => item.event), ["private_rental.inquiry", "private_rental.acknowledged"]);

    const me = await request("/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.email, email);

    const legacyBearer = await request("/api/auth/me", { headers: { Authorization: "Bearer legacy-browser-token" } });
    assert.equal(legacyBearer.response.status, 401);

    const csrfAttempt = await request("/api/me", {
      method: "PATCH",
      headers: { ...jsonHeaders(cookie), Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ name: "Ataque CSRF" })
    });
    assert.equal(csrfAttempt.response.status, 403);
    assert.equal(csrfAttempt.payload.error.code, "CUSTOMER_CSRF_BLOCKED");

    const nodeEnvBeforeCsrfCheck = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const missingOriginCsrfAttempt = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: "Ataque sem origem" })
    });
    if (nodeEnvBeforeCsrfCheck === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnvBeforeCsrfCheck;
    assert.equal(missingOriginCsrfAttempt.response.status, 403);
    assert.equal(missingOriginCsrfAttempt.payload.error.code, "CUSTOMER_CSRF_BLOCKED");

    const privilegeEscalation = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ name: "Teste Smoke", role: "owner", active: false })
    });
    assert.equal(privilegeEscalation.response.status, 200);
    assert.equal(privilegeEscalation.payload.user.role, "customer");
    assert.equal(privilegeEscalation.payload.user.active, true);

    const emailChangeAddress = `verified-${Date.now()}@cine.local`;
    const emailChange = await request("/api/me/email-change/request", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ email: emailChangeAddress })
    });
    assert.equal(emailChange.response.status, 202);
    assert.ok(emailChange.payload.verificationToken);

    const emailConfirm = await request("/api/auth/email/verify", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: emailChange.payload.verificationToken })
    });
    assert.equal(emailConfirm.response.status, 200);
    assert.equal(emailConfirm.payload.user.email, emailChangeAddress);
    assert.equal(emailConfirm.payload.user.emailVerified, true);
    cookie = emailConfirm.response.headers.get("set-cookie")?.split(";")[0] || cookie;

    const passwordWithoutCurrent = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ newPassword: "senha-nova-123", confirmPassword: "senha-nova-123" })
    });
    assert.equal(passwordWithoutCurrent.response.status, 400);

    const passwordMismatch = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ currentPassword: "cliente-smoke-123", newPassword: "senha-nova-123", confirmPassword: "senha-diferente" })
    });
    assert.equal(passwordMismatch.response.status, 400);

    const passwordChanged = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ currentPassword: "cliente-smoke-123", newPassword: "senha-nova-123", confirmPassword: "senha-nova-123" })
    });
    assert.equal(passwordChanged.response.status, 200);
    cookie = passwordChanged.response.headers.get("set-cookie")?.split(";")[0] || cookie;

    const adminMe = await request("/api/admin/me", { headers: { Cookie: adminCookie } });
    assert.equal(adminMe.response.status, 200);
    assert.equal(adminMe.payload.user.role, "owner");

    const seatRoomPayload = structuredClone(db.rooms.find((room) => room.id === "sala-poltronas-smoke"));
    seatRoomPayload.technology = "Laser Smoke Atualizado";
    const savedSeatRoom = await request("/api/rooms/sala-poltronas-smoke", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify(seatRoomPayload)
    });
    assert.equal(savedSeatRoom.response.status, 200);
    assert.equal(savedSeatRoom.payload.seatLayout.rows[0].seats[0].color, "#e11d48");
    assert.equal(savedSeatRoom.payload.seatLayout.rows[0].seats[0].accessibility, "wheelchair");
    assert.equal(savedSeatRoom.payload.synchronized.sessionsUpdated, 1);

    const contentAfterRoomUpdate = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    const synchronizedSession = contentAfterRoomUpdate.payload.movies
      .find((movie) => movie.id === TEST_SEAT_MOVIE_ID)?.sessions
      .find((session) => session.id === TEST_SEAT_SESSION_ID);
    assert.equal(synchronizedSession.roomId, "sala-poltronas-smoke");
    assert.equal(synchronizedSession.room, "Sala Poltronas Smoke (Laser Smoke Atualizado)");

    const seatMap = await request(`/api/sessions/${TEST_SEAT_SESSION_ID}/seats`);
    assert.equal(seatMap.response.status, 200);
    assert.equal(seatMap.payload.enabled, true);
    assert.equal(seatMap.payload.capacity, 5);
    assert.equal(seatMap.payload.rows[0].seats[0].color, "#e11d48");
    assert.equal(seatMap.payload.rows[0].seats[0].accessibility, "wheelchair");
    assert.equal(seatMap.payload.rows[0].seats[2].accessibility, "obese");
    assert.equal(seatMap.payload.rows[0].seats[1].aisleAfter, true);
    assert.equal(seatMap.payload.rows[1].seats[1].status, "blocked");

    const seatCheckoutOrder = (id, selectedSeatIds) => ({
      order: {
        id,
        idempotencyKey: id,
        movieId: TEST_SEAT_MOVIE_ID,
        sessionId: TEST_SEAT_SESSION_ID,
        fullTicketsCount: 0,
        halfTicketsCount: 0,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        selectedSeatIds,
        customerName: "Cliente Poltrona",
        customerEmail: `${id}@smoke.local`,
        customerPhone: "12999999999",
        paymentMethod: "PIX"
      }
    });
    const missingSeat = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-missing", []))
    });
    assert.equal(missingSeat.response.status, 422);
    assert.equal(missingSeat.payload.error.code, "SEAT_SELECTION_INCOMPLETE");

    const firstSeat = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-a1", ["a1"]))
    });
    assert.equal(firstSeat.response.status, 201);
    assert.deepEqual(firstSeat.payload.order.selectedSeats.map((seat) => seat.label), ["A1"]);
    await requestUntil(
      "/api/admin/content",
      { headers: jsonHeaders(adminCookie) },
      ({ payload }) => payload.orders?.some((order) => order.id === "smoke-seat-a1")
    );

    const roomWithoutReservedSeat = structuredClone(seatRoomPayload);
    roomWithoutReservedSeat.seatLayout.rows[0].seats = roomWithoutReservedSeat.seatLayout.rows[0].seats.filter((seat) => seat.id !== "a1");
    const protectedSeatDelete = await request("/api/rooms/sala-poltronas-smoke", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify(roomWithoutReservedSeat)
    });
    assert.equal(protectedSeatDelete.response.status, 409);
    assert.equal(protectedSeatDelete.payload.error.code, "ROOM_SEATS_IN_USE");

    const heldSeatMap = await request(`/api/sessions/${TEST_SEAT_SESSION_ID}/seats`);
    assert.equal(heldSeatMap.payload.rows[0].seats[0].status, "held");
    const duplicateSeat = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(targetCookie),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-a1-duplicate", ["a1"]))
    });
    assert.equal(duplicateSeat.response.status, 409);
    assert.equal(duplicateSeat.payload.error.code, "SEAT_UNAVAILABLE");

    const firstSeatCheckoutCookie = (firstSeat.response.headers.get("set-cookie") || "").split(";")[0];
    if (postgresMode) {
      const pgStore = require("../backend/db/postgresStore");
      let expiryRow;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expiryRow = await pgStore.queryPostgres(
          "UPDATE orders SET reservation_expires_at = now() - interval '1 second' WHERE id = $1 RETURNING reservation_expires_at",
          ["smoke-seat-a1"]
        );
        if (Date.parse(expiryRow.rows[0]?.reservation_expires_at) < Date.now()) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.ok(Date.parse(expiryRow.rows[0]?.reservation_expires_at) < Date.now(),
        JSON.stringify({ expiry: expiryRow.rows[0]?.reservation_expires_at, now: new Date().toISOString(), rows: expiryRow.rowCount }));
      let expiredInPostgres;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        pgStore.invalidatePostgresSnapshot();
        expiredInPostgres = (await readPersistedDb()).orders.find((order) => order.id === "smoke-seat-a1");
        if (Date.parse(expiredInPostgres?.reservationExpiresAt) < Date.now()) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.ok(Date.parse(expiredInPostgres.reservationExpiresAt) < Date.now(),
        JSON.stringify({ raw: expiryRow.rows[0]?.reservation_expires_at, snapshot: expiredInPostgres.reservationExpiresAt }));
    } else {
      const expirationDb = await readPersistedDb();
      const expiringSeatOrder = expirationDb.orders.find((order) => order.id === "smoke-seat-a1");
      expiringSeatOrder.reservationExpiresAt = new Date(Date.now() - 1000).toISOString();
      await writePersistedDb(expirationDb);
    }
    const expiredSeatOrder = await request("/api/checkout/orders/smoke-seat-a1", {
      headers: jsonHeaders(firstSeatCheckoutCookie)
    });
    assert.equal(expiredSeatOrder.response.status, 200);
    assert.equal(expiredSeatOrder.payload.order.status, "expired");
    assert.equal(expiredSeatOrder.payload.payment.status, "expired");
    assert.equal(expiredSeatOrder.payload.payment.qrCode, "");
    const releasedSeatMap = await request(`/api/sessions/${TEST_SEAT_SESSION_ID}/seats`);
    assert.equal(releasedSeatMap.payload.rows[0].seats[0].status, "available");

    const boxOfficeMissingSeat = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_SEAT_MOVIE_ID,
        sessionId: TEST_SEAT_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        selectedSeatIds: [],
        autoAssignSeats: false,
        paymentMethod: "courtesy",
        saleMode: "quick"
      })
    });
    assert.equal(boxOfficeMissingSeat.response.status, 422);
    assert.equal(boxOfficeMissingSeat.payload.error.code, "SEAT_SELECTION_INCOMPLETE");

    const adminSeatHoldToken = "smoke-admin-seat-hold";
    await holdSeat(TEST_SEAT_SESSION_ID, "a3", adminSeatHoldToken);
    const boxOfficeConflictingHold = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_SEAT_MOVIE_ID,
        sessionId: TEST_SEAT_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        selectedSeatIds: ["a3"],
        autoAssignSeats: false,
        paymentMethod: "courtesy",
        saleMode: "quick"
      })
    });
    assert.equal(boxOfficeConflictingHold.response.status, 409);
    assert.equal(boxOfficeConflictingHold.payload.error.code, "SEAT_ALREADY_HELD");

    const boxOfficeOwnedHold = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_SEAT_MOVIE_ID,
        sessionId: TEST_SEAT_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        selectedSeatIds: ["a3"],
        seatHoldToken: adminSeatHoldToken,
        autoAssignSeats: false,
        paymentMethod: "courtesy",
        saleMode: "quick"
      })
    });
    assert.equal(boxOfficeOwnedHold.response.status, 201);
    assert.equal(boxOfficeOwnedHold.payload.tickets[0].seat, "A3");

    const boxOfficeSeat = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_SEAT_MOVIE_ID,
        sessionId: TEST_SEAT_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        selectedSeatIds: ["a2"],
        autoAssignSeats: false,
        paymentMethod: "courtesy",
        saleMode: "quick"
      })
    });
    assert.equal(boxOfficeSeat.response.status, 201);
    assert.equal(boxOfficeSeat.payload.tickets[0].seat, "A2");
    assert.equal(boxOfficeSeat.payload.orders[0].selectedSeats[0].label, "A2");
    const confirmedSeatPrint = await request(`/api/box-office/point-payments/${encodeURIComponent(boxOfficeSeat.payload.payment.id)}/print-result`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ ok: true, jobId: boxOfficeSeat.payload.order.pointPrint.jobId })
    });
    assert.equal(confirmedSeatPrint.response.status, 200);
    assert.equal(confirmedSeatPrint.payload.completed, true);

    const raceSeatSale = () => request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_SEAT_MOVIE_ID, sessionId: TEST_SEAT_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }], selectedSeatIds: ["b1"],
        autoAssignSeats: false, paymentMethod: "courtesy", saleMode: "quick"
      })
    });
    const competingSeatSales = await Promise.all([raceSeatSale(), raceSeatSale()]);
    assert.deepEqual(competingSeatSales.map((item) => item.response.status).sort(), [201, 409]);
    assert.equal((await readPersistedDb()).orders.filter((item) => item.sessionId === TEST_SEAT_SESSION_ID && item.selectedSeatIds?.includes("b1")).length, 1);

    const protectedSessionRoomChange = await request(`/api/movies/${TEST_SEAT_MOVIE_ID}/sessions/${TEST_SEAT_SESSION_ID}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-11-30",
        dateChanged: true,
        time: "20:00",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        ticketTypeIds: ["promocional"],
        status: "available"
      })
    });
    assert.equal(protectedSessionRoomChange.response.status, 409);
    assert.equal(protectedSessionRoomChange.payload.error.code, "SESSION_ROOM_LOCKED_BY_SEATS", JSON.stringify(protectedSessionRoomChange.payload.error));

    const dashboard = await request("/api/dashboard", { headers: jsonHeaders(adminCookie) });
    assert.equal(dashboard.response.status, 200);
    assert.equal(typeof dashboard.payload.salesToday, "number");
    assert.ok(Array.isArray(dashboard.payload.latestOrders));
    const adminDashboard = await request("/api/admin/dashboard?period=7d", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminDashboard.response.status, 200);
    assert.ok(Array.isArray(adminDashboard.payload.chart));
    assert.ok(Array.isArray(adminDashboard.payload.todaySessions));
    assert.equal(typeof adminDashboard.payload.concessionSummary.netRevenue, "number");
    assert.ok(Array.isArray(adminDashboard.payload.concessionSummary.products));
    assert.equal(adminDashboard.payload.concessionSummary.netRevenue, adminDashboard.payload.concessionRevenue);
    assert.equal(Object.hasOwn(adminDashboard.payload, "fiscal"), false);

    const dashboardReport = await fetch(`${BASE_URL}/api/admin/reports/dashboard.csv?period=7d`, { headers: { Cookie: adminCookie } });
    assert.equal(dashboardReport.status, 200);
    assert.doesNotMatch(await dashboardReport.text(), /NFS-e|fiscal/i);

    const distributorCsv = await fetch(`${BASE_URL}/api/admin/reports/ticket-distributor.csv?period=custom&from=${reportDate}&to=${reportDate}`, { headers: { Cookie: adminCookie } });
    assert.equal(distributorCsv.status, 200);
    assert.match(distributorCsv.headers.get("content-type") || "", /text\/csv/);
    assert.match(distributorCsv.headers.get("content-disposition") || "", /repasse-bilheteria-/);
    const distributorCsvText = await distributorCsv.text();
    assert.match(distributorCsvText, /Código do ingresso/);
    assert.match(distributorCsvText, /Repasse à distribuidora/);
    assert.doesNotMatch(distributorCsvText, /Teste Smoke|@cine\.local|CPF/i);

    const distributorPdf = await fetch(`${BASE_URL}/api/admin/reports/ticket-distributor.pdf?period=custom&from=${reportDate}&to=${reportDate}`, { headers: { Cookie: adminCookie } });
    assert.equal(distributorPdf.status, 200);
    assert.match(distributorPdf.headers.get("content-type") || "", /application\/pdf/);
    assert.match(distributorPdf.headers.get("content-disposition") || "", /repasse-bilheteria-/);
    const distributorPdfBuffer = Buffer.from(await distributorPdf.arrayBuffer());
    assert.equal(distributorPdfBuffer.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(distributorPdfBuffer.length > 1000);
    assert.doesNotMatch(distributorPdfBuffer.toString("latin1"), /Teste Smoke|@cine\.local/);

    const removedFiscalRoute = await request("/api/admin/fiscal-documents", { headers: jsonHeaders(adminCookie) });
    assert.equal(removedFiscalRoute.response.status, 404);
    const adminPayments = await request("/api/admin/payments?period=7d", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminPayments.response.status, 200);
    assert.ok(Array.isArray(adminPayments.payload.payments));
    assert.equal(typeof adminPayments.payload.cardTerminal.configured, "boolean");

    const integrations = await request("/api/integrations", { headers: jsonHeaders(adminCookie) });
    assert.equal(integrations.response.status, 200);
    assert.ok(integrations.payload.integrations.tmdb);
    assert.equal(Object.hasOwn(integrations.payload.integrations, "fiscal"), false);

    const googleLoginInitial = await request("/api/admin/integrations/googleLogin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        clientId: "client-id-preservado.apps.googleusercontent.com",
        clientSecret: "segredo-original-1234",
        redirectUri: "https://cine.local/conta"
      })
    });
    assert.equal(googleLoginInitial.response.status, 200);
    assert.equal(googleLoginInitial.payload.integration.values.clientId, "client-id-preservado.apps.googleusercontent.com");
    assert.deepEqual(googleLoginInitial.payload.integration.secrets.clientSecret, { hasValue: true, source: "stored" });

    const googleLoginSecretOnly = await request("/api/admin/integrations/googleLogin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ clientSecret: "segredo-atualizado-5678", clientId: null })
    });
    assert.equal(googleLoginSecretOnly.response.status, 200);
    assert.equal(googleLoginSecretOnly.payload.integration.values.clientId, "client-id-preservado.apps.googleusercontent.com");
    assert.equal(googleLoginSecretOnly.payload.integration.values.redirectUri, "https://cine.local/conta");
    assert.deepEqual(googleLoginSecretOnly.payload.integration.secrets.clientSecret, { hasValue: true, source: "stored" });

    const googleLoginMaskedSecret = await request("/api/admin/integrations/googleLogin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ clientSecret: "••••••••5678" })
    });
    assert.equal(googleLoginMaskedSecret.response.status, 200);
    assert.deepEqual(googleLoginMaskedSecret.payload.integration.secrets.clientSecret, { hasValue: true, source: "stored" });

    const googleLoginStart = await request("/api/auth/google/start?returnTo=%2Fconta", { redirect: "manual" });
    assert.equal(googleLoginStart.response.status, 302);
    const googleAuthorizationUrl = new URL(googleLoginStart.response.headers.get("location"));
    assert.equal(googleAuthorizationUrl.origin, "https://accounts.google.com");
    assert.equal(googleAuthorizationUrl.searchParams.get("redirect_uri"), "https://cine.local/conta");
    assert.equal(googleAuthorizationUrl.searchParams.get("scope"), "openid email profile");
    assert.match(googleLoginStart.response.headers.get("set-cookie") || "", /cine_google_oauth=/);
    assert.match(googleLoginStart.response.headers.get("set-cookie") || "", /Path=\//);
    assert.match(googleLoginStart.response.headers.get("set-cookie") || "", /HttpOnly/i);

    const uploadedImage = await request("/api/uploads/images", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        filename: "poster-smoke.png",
        contentType: "image/png",
        folder: "smoke",
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
      })
    });
    assert.equal(uploadedImage.response.status, 201);
    assert.match(uploadedImage.payload.url, /^\/uploads\/smoke\//);

    const spoofedImage = await request("/api/uploads/images", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        filename: "arquivo-falso.png",
        contentType: "image/png",
        folder: "smoke",
        data: `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`
      })
    });
    assert.equal(spoofedImage.response.status, 415);

    const operatorUser = await request("/api/users", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-operador-clube",
        name: "Operador Smoke",
        email: "operador-smoke@cine.local",
        password: "operador-smoke-123",
        accountType: "team",
        passwordHash: "plaintext-attacker-value",
        twoFactorEnabled: true,
        twoFactorSecret: "attacker-secret",
        role: "operator",
        useCustomPermissions: true,
        adminPermissions: ["tickets.validate", "unknown.permission"],
        active: true
      })
    });
    assert.equal(operatorUser.response.status, 201);
    assert.equal(operatorUser.payload.twoFactorEnabled, false);
    assert.equal(operatorUser.payload.useCustomPermissions, true);
    assert.deepEqual(operatorUser.payload.adminPermissions, ["tickets.validate"]);
    assert.deepEqual(operatorUser.payload.effectivePermissions, ["tickets.validate"]);
    assert.equal("passwordHash" in operatorUser.payload, false);

    const customerCreatedByAdmin = await request("/api/users", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-cliente-sem-painel",
        name: "Cliente sem Painel",
        email: "cliente-sem-painel@cine.local",
        password: "cliente-seguro-123",
        role: "owner",
        useCustomPermissions: true,
        adminPermissions: ["settings.manage"],
        active: true
      })
    });
    assert.equal(customerCreatedByAdmin.response.status, 201);
    assert.equal(customerCreatedByAdmin.payload.role, "customer");
    assert.equal(customerCreatedByAdmin.payload.useCustomPermissions, false);
    assert.deepEqual(customerCreatedByAdmin.payload.adminPermissions, []);
    assert.deepEqual(customerCreatedByAdmin.payload.effectivePermissions, []);

    const customerAdminLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "cliente-sem-painel@cine.local", password: "cliente-seguro-123" })
    });
    assert.equal(customerAdminLogin.response.status, 401);

    const crossAccountTypeUpdate = await request(`/api/users/${encodeURIComponent(customerCreatedByAdmin.payload.id)}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        accountType: "team",
        name: "Cliente sem Painel",
        email: "cliente-sem-painel@cine.local",
        role: "owner",
        active: true
      })
    });
    assert.equal(crossAccountTypeUpdate.response.status, 409);
    assert.equal(crossAccountTypeUpdate.payload.error.code, "USER_ACCOUNT_TYPE_MISMATCH");

    const operatorLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "operador-smoke@cine.local", password: "operador-smoke-123" })
    });
    assert.equal(operatorLogin.response.status, 200);
    const operatorCookie = operatorLogin.response.headers.get("set-cookie").split(";")[0] || "";
    const operatorContent = await request("/api/admin/content", { headers: jsonHeaders(operatorCookie) });
    assert.equal(operatorContent.response.status, 200);
    assert.equal(operatorContent.payload.users.length, 0);
    assert.equal(operatorContent.payload.orders.length, 0);
    assert.equal(operatorContent.payload.payments.length, 0);
    assert.equal(operatorContent.payload.tickets.length, 0);
    assert.equal(operatorContent.payload.subscriptions.length, 0);
    assert.ok(operatorContent.payload.movies.length > 0);
    const operatorDashboardDenied = await request("/api/admin/dashboard", { headers: jsonHeaders(operatorCookie) });
    assert.equal(operatorDashboardDenied.response.status, 403);
    const operatorValidationAllowed = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(operatorCookie),
      body: JSON.stringify({ code: "codigo-inexistente" })
    });
    assert.equal(operatorValidationAllowed.response.status, 404);
    const operatorPlanDenied = await request("/api/admin/subscription-plans", {
      method: "POST",
      headers: jsonHeaders(operatorCookie),
      body: JSON.stringify({ id: "negado", name: "Negado", monthlyPrice: 1, includedTickets: 1 })
    });
    assert.equal(operatorPlanDenied.response.status, 403);
    const operatorPaymentsDenied = await request("/api/admin/payments", { headers: jsonHeaders(operatorCookie) });
    assert.equal(operatorPaymentsDenied.response.status, 403);
    const operatorIntegrationsDenied = await request("/api/integrations", { headers: jsonHeaders(operatorCookie) });
    assert.equal(operatorIntegrationsDenied.response.status, 403);

    const managerUser = await request("/api/users", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-gerente-integracoes",
        name: "Gerente Smoke",
        email: "gerente-smoke@cine.local",
        password: "gerente-smoke-123",
        accountType: "team",
        role: "manager",
        active: true
      })
    });
    assert.equal(managerUser.response.status, 201);
    const managerLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "gerente-smoke@cine.local", password: "gerente-smoke-123" })
    });
    assert.equal(managerLogin.response.status, 200);
    const managerCookie = managerLogin.response.headers.get("set-cookie").split(";")[0] || "";
    const managerIntegrationsDenied = await request("/api/integrations", { headers: jsonHeaders(managerCookie) });
    assert.equal(managerIntegrationsDenied.response.status, 403);

    const createMovie = await request("/api/movies", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-filme-edicao",
        title: "Filme Smoke",
        synopsis: "Teste de criação para edição.",
        duration: "1h 30m",
        genre: ["Teste"],
        rating: "L",
        posterUrl: uploadedImage.payload.url,
        backdropUrl: "",
        sessions: []
      })
    });
    assert.equal(createMovie.response.status, 201);
    const editMovie = await request("/api/movies/smoke-filme-edicao", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        ...createMovie.payload,
        id: "id-nao-deve-duplicar",
        title: "Filme Smoke Editado"
      })
    });
    assert.equal(editMovie.response.status, 200);
    assert.equal(editMovie.payload.id, "smoke-filme-edicao");
    const movieContent = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(movieContent.payload.movies.filter((movie) => movie.id === "smoke-filme-edicao").length, 1);

    const draftMovie = await request("/api/movies", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-rascunho-admin",
        slug: "smoke-rascunho-admin",
        workflowStatus: "draft",
        title: "Smoke Rascunho Admin",
        sessions: []
      })
    });
    assert.equal(draftMovie.response.status, 201);
    assert.equal(draftMovie.payload.workflowStatus, "draft");
    assert.equal(draftMovie.payload.status, "upcoming");
    const publishMovie = await request("/api/movies/smoke-rascunho-admin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        ...draftMovie.payload,
        workflowStatus: "published",
        status: "upcoming",
        posterUrl: uploadedImage.payload.url,
        synopsis: "Filme publicado pelo teste de fluxo administrativo.",
        duration: "1h 20m",
        rating: "L"
      })
    });
    assert.equal(publishMovie.response.status, 200);
    assert.equal(publishMovie.payload.workflowStatus, "published");
    assert.equal(publishMovie.payload.slug, "smoke-rascunho-admin");
    assert.equal(publishMovie.payload.sessions.length, 0);

    const createSession = await request("/api/movies/smoke-rascunho-admin/sessions", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-08-24",
        time: "18:00",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        ticketTypeIds: ["promocional"],
        status: "available"
      })
    });
    assert.equal(createSession.response.status, 201);
    assert.ok(createSession.payload.id);
    assert.deepEqual(createSession.payload.ticketTypeIds, ["promocional"]);
    assert.equal(createSession.payload.priceFull, 10);

    const updateSession = await request(`/api/movies/smoke-rascunho-admin/sessions/${encodeURIComponent(createSession.payload.id)}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-08-26",
        time: "19:15",
        format: "2D Legendado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 12,
        priceHalf: 12,
        status: "available"
      })
    });
    assert.equal(updateSession.response.status, 200);
    assert.equal(updateSession.payload.time, "19:15");
    assert.equal(updateSession.payload.date, "2099-08-24");
    assert.deepEqual(updateSession.payload.ticketTypeIds, ["promocional"]);
    assert.equal(updateSession.payload.priceFull, 10);

    const moveSessionDate = await request(`/api/movies/smoke-rascunho-admin/sessions/${encodeURIComponent(createSession.payload.id)}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-08-25",
        dateChanged: true,
        time: "19:15",
        format: "2D Legendado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 12,
        priceHalf: 12,
        status: "available"
      })
    });
    assert.equal(moveSessionDate.response.status, 200);
    assert.equal(moveSessionDate.payload.date, "2099-08-25");

    const editMovieWithoutSessions = await request("/api/movies/smoke-rascunho-admin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ title: "Smoke Rascunho Atualizado", workflowStatus: "published", status: "upcoming" })
    });
    assert.equal(editMovieWithoutSessions.response.status, 200);
    assert.equal(editMovieWithoutSessions.payload.sessions.length, 1);
    assert.equal(editMovieWithoutSessions.payload.sessions[0].id, createSession.payload.id);

    const deleteSession = await request(`/api/movies/smoke-rascunho-admin/sessions/${encodeURIComponent(createSession.payload.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(deleteSession.response.status, 200);
    const afterSessionDelete = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(afterSessionDelete.payload.movies.find((movie) => movie.id === "smoke-rascunho-admin").sessions.length, 0);

    const createSessionRange = await request("/api/movies/smoke-rascunho-admin/sessions", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        dateFrom: "2099-08-25",
        dateTo: "2099-08-27",
        times: ["20:00"],
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      })
    });
    assert.equal(createSessionRange.response.status, 201);
    assert.equal(createSessionRange.payload.totalCreated, 3);
    assert.equal(createSessionRange.payload.totalSkipped, 0);
    for (const session of createSessionRange.payload.created) {
      const removeBatchSession = await request(`/api/movies/smoke-rascunho-admin/sessions/${encodeURIComponent(session.id)}`, {
        method: "DELETE",
        headers: jsonHeaders(adminCookie)
      });
      assert.equal(removeBatchSession.response.status, 200);
    }
    assert.equal(movieContent.payload.movies.some((movie) => movie.id === "id-nao-deve-duplicar"), false);

    const orderBefore = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    const reorderedIds = [
      "smoke-rascunho-admin",
      ...orderBefore.payload.movies.map((movie) => movie.id).filter((id) => id !== "smoke-rascunho-admin")
    ];
    const reorderedMovies = await request("/api/movies/order", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ ids: reorderedIds })
    });
    assert.equal(reorderedMovies.response.status, 200);
    const orderAfter = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(orderAfter.payload.movies[0].id, "smoke-rascunho-admin");
    assert.equal(Number(orderAfter.payload.movies[0].sortOrder), 10);
    assert.deepEqual(
      orderAfter.payload.movies.map((movie) => Number(movie.sortOrder)),
      orderAfter.payload.movies.map((_, index) => (index + 1) * 10)
    );

    const customerSearch = await request(`/api/admin/customers?query=${encodeURIComponent(emailChangeAddress)}`, {
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(customerSearch.response.status, 200);
    assert.equal(customerSearch.payload.customers[0].email, emailChangeAddress);

    const plans = await request("/api/subscription-plans");
    assert.equal(plans.response.status, 200);
    assert.deepEqual(plans.payload, []);

    const oneCreditPlan = await request("/api/admin/subscription-plans", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-clube-1",
        name: "Plano Smoke 1",
        monthlyPrice: 9.9,
        includedTickets: 1,
        imageUrl: uploadedImage.payload.url,
        isFeatured: true,
        displayOrder: 7,
        benefits: ["1 ingresso smoke"],
        ticketDiscountPercent: 10,
        concessionDiscountPercent: 5,
        freeConcessionItems: [{ concessionId: "combo-classico", quantityPerCycle: 1 }],
        active: true
      })
    });
    assert.equal(oneCreditPlan.response.status, 201);
    assert.equal(oneCreditPlan.payload.includedTickets, 1);
    assert.equal(oneCreditPlan.payload.imageUrl, uploadedImage.payload.url);
    assert.equal(oneCreditPlan.payload.isFeatured, true);
    assert.equal(oneCreditPlan.payload.displayOrder, 7);
    assert.equal(oneCreditPlan.payload.ticketDiscountPercent, 10);
    assert.equal(oneCreditPlan.payload.concessionDiscountPercent, 5);
    assert.equal(oneCreditPlan.payload.freeConcessionItems[0].concessionId, "combo-classico");

    const plansAfterMediaSave = await requestUntil(
      "/api/subscription-plans",
      {},
      ({ payload }) => payload.some?.((plan) => plan.id === oneCreditPlan.payload.id)
    );
    const persistedMediaPlan = plansAfterMediaSave.payload.find((plan) => plan.id === oneCreditPlan.payload.id);
    assert.equal(persistedMediaPlan.imageUrl, uploadedImage.payload.url);
    assert.equal(persistedMediaPlan.isFeatured, true);
    assert.equal(persistedMediaPlan.displayOrder, 7);

    const secondFeaturedPlan = await request("/api/admin/subscription-plans", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-clube-destaque-2",
        name: "Plano Smoke Destaque 2",
        monthlyPrice: 19.9,
        includedTickets: 2,
        isFeatured: true,
        displayOrder: 15,
        active: true
      })
    });
    assert.equal(secondFeaturedPlan.response.status, 201);
    const plansAfterFeaturedChange = await requestUntil(
      "/api/subscription-plans",
      {},
      ({ payload }) => payload.find?.((plan) => plan.id === oneCreditPlan.payload.id)?.isFeatured === false
        && payload.find?.((plan) => plan.id === secondFeaturedPlan.payload.id)?.isFeatured === true
    );
    assert.equal(plansAfterFeaturedChange.payload.find((plan) => plan.id === oneCreditPlan.payload.id).isFeatured, false);
    assert.equal(plansAfterFeaturedChange.payload.find((plan) => plan.id === secondFeaturedPlan.payload.id).isFeatured, true);

    const subscriptionWithoutPaymentMethod = await request("/api/subscriptions/subscribe", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ planId: oneCreditPlan.payload.id })
    });
    assert.equal(subscriptionWithoutPaymentMethod.response.status, 422);
    assert.equal(subscriptionWithoutPaymentMethod.payload.error.code, "SUBSCRIPTION_PAYMENT_METHOD_REQUIRED");

    const subscriptionWithPix = await request("/api/subscriptions/subscribe", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ planId: oneCreditPlan.payload.id, paymentMethod: "pix" })
    });
    assert.equal(subscriptionWithPix.response.status, 422);
    assert.equal(subscriptionWithPix.payload.error.code, "SUBSCRIPTION_PAYMENT_METHOD_REQUIRED");

    const subscriptionWithDebitCard = await request("/api/subscriptions/subscribe", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ planId: oneCreditPlan.payload.id, paymentMethod: "debit_card" })
    });
    assert.equal(subscriptionWithDebitCard.response.status, 422);
    assert.equal(subscriptionWithDebitCard.payload.error.code, "SUBSCRIPTION_PAYMENT_METHOD_REQUIRED");

    const pendingSubscription = await request("/api/subscriptions/subscribe", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ planId: oneCreditPlan.payload.id, paymentMethod: "credit_card" })
    });
    assert.equal(pendingSubscription.response.status, 202);
    assert.equal(pendingSubscription.payload.subscription.status, "pending_payment");
    assert.equal(pendingSubscription.payload.subscription.paymentStatus, "pending");
    assert.equal(Number(pendingSubscription.payload.subscription.creditsAvailable || 0), 0);
    assert.equal(pendingSubscription.payload.subscription.approvedAt || "", "");
    assert.equal(pendingSubscription.payload.subscription.providerPlanId, "");
    assert.ok(pendingSubscription.payload.subscription.paymentExpiresAt);
    assert.equal(pendingSubscription.payload.paymentMethod, "credit_card");
    assert.ok(pendingSubscription.payload.checkoutUrl);
    const subscriptionsAfterCreate = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    assert.equal(subscriptionsAfterCreate.response.status, 200);
    assert.ok(subscriptionsAfterCreate.payload.subscriptions.some((item) => item.id === pendingSubscription.payload.subscription.id));

    const pendingClubCredit = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: `club-smoke-pending-${Date.now()}` })
    });
    assert.equal(pendingClubCredit.response.status, 409);
    assert.equal(pendingClubCredit.payload.error.code, "NO_ACTIVE_SUBSCRIPTION");

    const subscriptionResourceId = pendingSubscription.payload.subscription.providerSubscriptionId;
    const subscriptionWebhookRequestId = crypto.randomUUID();
    const subscriptionWebhookTimestamp = String(Math.floor(Date.now() / 1000));
    const subscriptionWebhookBody = {
      action: "updated",
      api_version: "v1",
      type: "subscription_preapproval",
      live_mode: false,
      data: { id: subscriptionResourceId, status: "authorized", version: 1 }
    };
    const subscriptionManifest = `id:${subscriptionResourceId};request-id:${subscriptionWebhookRequestId};ts:${subscriptionWebhookTimestamp};`;
    const subscriptionWebhookSignature = crypto.createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(subscriptionManifest).digest("hex");
    process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE = "true";
    const approvedSubscriptionWebhook = await request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(subscriptionResourceId)}&type=subscription_preapproval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": subscriptionWebhookRequestId,
        "x-signature": `ts=${subscriptionWebhookTimestamp},v1=${subscriptionWebhookSignature}`
      },
      body: JSON.stringify(subscriptionWebhookBody)
    });
    process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE = "false";
    assert.equal(approvedSubscriptionWebhook.response.status, 200);
    assert.equal(approvedSubscriptionWebhook.payload.processing.status, "active");

    const subscriptionsAfterApproval = await requestUntil(
      "/api/me/subscriptions",
      { headers: jsonHeaders(cookie) },
      ({ payload }) => payload.subscriptions?.some((item) => item.id === pendingSubscription.payload.subscription.id && item.status === "active")
    );
    const providerApprovedSubscription = subscriptionsAfterApproval.payload.subscriptions.find((item) => item.id === pendingSubscription.payload.subscription.id);
    assert.equal(providerApprovedSubscription.status, "active");
    assert.equal(providerApprovedSubscription.paymentStatus, "approved");
    assert.equal(providerApprovedSubscription.creditsRemaining, 1);

    const independentCreditPreview = await request("/api/checkout/club-benefits/preview", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        useClubBenefits: false,
        useClubCredits: true
      })
    });
    assert.equal(independentCreditPreview.response.status, 200);
    assert.equal(independentCreditPreview.payload.benefits, null);
    assert.equal(independentCreditPreview.payload.creditSummary.quantity, 1);
    assert.ok(independentCreditPreview.payload.creditSummary.totalAmount > 0);
    assert.ok(independentCreditPreview.payload.total < independentCreditPreview.payload.subtotal);

    const prioritizedCreditPreview = await request("/api/checkout/club-benefits/preview", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        useClubBenefits: true,
        useClubCredits: true
      })
    });
    assert.equal(prioritizedCreditPreview.response.status, 200);
    assert.equal(prioritizedCreditPreview.payload.benefits.ticketDiscount, 0);
    assert.equal(prioritizedCreditPreview.payload.creditSummary.items[0].planDiscountAmount, 0);
    assert.equal(
      prioritizedCreditPreview.payload.creditSummary.totalAmount,
      prioritizedCreditPreview.payload.creditSummary.items[0].originalTotalPrice
    );

    const couponAfterCreditPreview = await request("/api/checkout/club-benefits/preview", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        couponCode: "SMOKE20",
        useClubBenefits: true,
        useClubCredits: true
      })
    });
    assert.equal(couponAfterCreditPreview.response.status, 200);
    assert.equal(couponAfterCreditPreview.payload.coupon.appliedAfterClubCredits, true);
    assert.equal(couponAfterCreditPreview.payload.coupon.discountValue, 0);
    assert.ok(couponAfterCreditPreview.payload.coupon.originalDiscountValue > 0);
    assert.equal(couponAfterCreditPreview.payload.creditSummary.items[0].couponDiscountAmount, 0);
    assert.equal(
      couponAfterCreditPreview.payload.creditSummary.totalAmount,
      couponAfterCreditPreview.payload.creditSummary.items[0].originalTotalPrice
    );

    const benefitOrderId = `smoke-club-benefits-${Date.now()}`;
    const planBenefitsPix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        order: {
          id: benefitOrderId,
          idempotencyKey: benefitOrderId,
          movieId: TEST_MOVIE_ID,
          sessionId: TEST_SESSION_ID,
          fullTicketsCount: 1,
          halfTicketsCount: 0,
          concessionItems: [{ id: "combo-classico", quantity: 1 }],
          useClubBenefits: true
        }
      })
    });
    assert.equal(planBenefitsPix.response.status, 201);
    assert.equal(planBenefitsPix.payload.payment.status, "pending");
    assert.equal(planBenefitsPix.payload.order.clubBenefits.ticketDiscountPercent, 10);
    assert.equal(planBenefitsPix.payload.order.clubBenefits.freeConcessionItems[0].concessionId, "combo-classico");
    assert.equal(planBenefitsPix.payload.tickets.length, 0);
    const benefitAfterCreated = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(benefitAfterCreated.response.status, 200);
    assert.equal(benefitAfterCreated.payload.orders.some((order) => order.id === benefitOrderId), true, "Pix 201 deve ser visivel apos commit");

    const cancelBenefitOrder = await request(`/api/orders/${encodeURIComponent(benefitOrderId)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Liberar reserva do teste de benefícios" })
    });
    assert.equal(cancelBenefitOrder.response.status, 200);

    const staleWebhookRequestId = crypto.randomUUID();
    const staleWebhookTimestamp = String(Math.floor(Date.now() / 1000));
    const staleWebhookManifest = `id:${subscriptionResourceId};request-id:${staleWebhookRequestId};ts:${staleWebhookTimestamp};`;
    const staleWebhookSignature = crypto.createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(staleWebhookManifest).digest("hex");
    const stalePendingWebhook = await request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(subscriptionResourceId)}&type=subscription_preapproval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": staleWebhookRequestId,
        "x-signature": `ts=${staleWebhookTimestamp},v1=${staleWebhookSignature}`
      },
      body: JSON.stringify({ ...subscriptionWebhookBody, data: { ...subscriptionWebhookBody.data, status: "pending", version: 2 } })
    });
    assert.equal(stalePendingWebhook.response.status, 200);
    const subscriptionsAfterStaleEvent = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    const subscriptionAfterStaleEvent = subscriptionsAfterStaleEvent.payload.subscriptions.find((item) => item.id === pendingSubscription.payload.subscription.id);
    assert.equal(subscriptionAfterStaleEvent.status, "active");
    assert.equal(subscriptionAfterStaleEvent.paymentStatus, "approved");

    const cancelProviderApprovedSubscription = await request(`/api/me/subscriptions/${encodeURIComponent(providerApprovedSubscription.id)}/cancel`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ reason: "Liberar usuario para continuidade do smoke", cancelImmediately: true })
    });
    assert.equal(cancelProviderApprovedSubscription.response.status, 200);
    assert.equal(cancelProviderApprovedSubscription.payload.subscription.status, "ending");
    assert.equal(cancelProviderApprovedSubscription.payload.subscription.reactivationBlocked, true);
    assert.equal(cancelProviderApprovedSubscription.payload.subscription.creditsAvailable, 1);
    const subscriptionsAfterCancel = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    assert.equal(subscriptionsAfterCancel.response.status, 200);
    assert.equal(subscriptionsAfterCancel.payload.subscriptions.find((item) => item.id === providerApprovedSubscription.id)?.status, "ending");

    const forbiddenReactivation = await request(`/api/admin/subscriptions/${encodeURIComponent(providerApprovedSubscription.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ status: "active", reason: "Não deve reativar autorização cancelada" })
    });
    assert.equal(forbiddenReactivation.response.status, 409);
    assert.equal(forbiddenReactivation.payload.error.code, "SUBSCRIPTION_REAUTHORIZATION_REQUIRED");

    const closeProviderSubscription = await request(`/api/admin/subscriptions/${encodeURIComponent(providerApprovedSubscription.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ status: "ended", reason: "Encerrar ciclo no smoke" })
    });
    assert.equal(closeProviderSubscription.response.status, 200);

    const assignSubscription = await request("/api/admin/subscriptions/assign", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ userId: registered.user.id, planId: oneCreditPlan.payload.id })
    });
    assert.equal(assignSubscription.response.status, 201);
    assert.equal(assignSubscription.payload.subscription.userId, registered.user.id);

    const clubSubscriptions = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    assert.equal(clubSubscriptions.response.status, 200);
    assert.ok(clubSubscriptions.payload.subscriptions.some((subscription) => subscription.status === "active"));
    const activeClub = clubSubscriptions.payload.subscriptions.find((subscription) => subscription.planId === oneCreditPlan.payload.id && subscription.status === "active");
    assert.equal(activeClub.creditsRemaining, 1);

    const clubIdempotency = `club-smoke-${Date.now()}`;
    const clubCredit = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: { ...jsonHeaders(cookie), "X-Idempotency-Key": clubIdempotency },
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: clubIdempotency })
    });
    assert.equal(clubCredit.response.status, 201);
    assert.equal(clubCredit.payload.order.origin, "club");
    assert.equal(clubCredit.payload.payment, null, "resgate integral nao deve criar pagamento ficticio de R$ 0");
    assert.equal(clubCredit.payload.order.paymentStatus, "not_required");
    assert.equal(clubCredit.payload.tickets[0].paymentSource, "subscription_credit");
    assert.equal(clubCredit.payload.tickets.length, 1);

    const duplicateClubCredit = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: { ...jsonHeaders(cookie), "X-Idempotency-Key": clubIdempotency },
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: clubIdempotency })
    });
    assert.equal(duplicateClubCredit.response.status, 200);
    assert.equal(duplicateClubCredit.payload.order.id, clubCredit.payload.order.id);

    const noClubCredit = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: `club-smoke-empty-${Date.now()}` })
    });
    assert.equal(noClubCredit.response.status, 409);

    const cancelledClubOrder = await request(`/api/orders/${encodeURIComponent(clubCredit.payload.order.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Teste de devolucao de credito" })
    });
    assert.equal(cancelledClubOrder.response.status, 200);
    assert.equal(cancelledClubOrder.payload.order.status, "cancelled");

    const clubAfterRefund = await requestUntil(
      "/api/me/subscriptions",
      { headers: jsonHeaders(cookie) },
      ({ payload }) => payload.subscriptions?.some((subscription) =>
        subscription.planId === oneCreditPlan.payload.id
        && subscription.creditsRemaining === 1
        && subscription.usage?.some((usage) => usage.refundedAt))
    );
    const refundedClub = clubAfterRefund.payload.subscriptions.find((subscription) => subscription.planId === oneCreditPlan.payload.id);
    assert.equal(refundedClub.creditsRemaining, 1);
    assert.ok(refundedClub.usage.some((usage) => usage.refundedAt));

    const cancelledSubscription = await request(`/api/me/subscriptions/${encodeURIComponent(activeClub.id)}/cancel`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ reason: "Smoke cancelamento" })
    });
    assert.equal(cancelledSubscription.response.status, 200);
    assert.equal(cancelledSubscription.payload.subscription.status, "ending");
    assert.equal(cancelledSubscription.payload.subscription.creditsAvailable, 1);

    const clubAfterSubscriptionCancel = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: `club-smoke-cancelled-valid-${Date.now()}` })
    });
    assert.equal(clubAfterSubscriptionCancel.response.status, 201);

    const closeManualSubscription = await request(`/api/admin/subscriptions/${encodeURIComponent(activeClub.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ status: "ended", reason: "Fim do ciclo no smoke" })
    });
    assert.equal(closeManualSubscription.response.status, 200);

    const bundleCreditPlan = await request("/api/admin/subscription-plans", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-clube-bundle",
        name: "Plano Smoke Bundle",
        monthlyPrice: 29.9,
        includedTickets: 3,
        creditReferenceValue: 10,
        benefits: ["3 ingressos smoke"],
        active: true
      })
    });
    assert.equal(bundleCreditPlan.response.status, 201);
    const bundleSubscription = await request("/api/admin/subscriptions/assign", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ userId: registered.user.id, planId: bundleCreditPlan.payload.id })
    });
    assert.equal(bundleSubscription.response.status, 201);
    const bundleCreditOrderId = `club-bundle-smoke-${Date.now()}`;
    const bundleCreditOrder = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: { ...jsonHeaders(cookie), "X-Idempotency-Key": bundleCreditOrderId },
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "triple-smoke", quantity: 1 }],
        idempotencyKey: bundleCreditOrderId
      })
    });
    assert.equal(bundleCreditOrder.response.status, 201, JSON.stringify(bundleCreditOrder.payload));
    assert.equal(bundleCreditOrder.payload.tickets.length, 3);
    assert.equal(bundleCreditOrder.payload.subscription.creditsAvailable, 0);
    const subscriptionsAfterBundlePurchase = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    assert.equal(subscriptionsAfterBundlePurchase.response.status, 200);
    const purchasedBundleSubscription = subscriptionsAfterBundlePurchase.payload.subscriptions.find((subscription) => subscription.id === bundleSubscription.payload.subscription.id);
    assert.equal(purchasedBundleSubscription?.creditsRemaining, 0);
    assert.equal(purchasedBundleSubscription?.creditCounts?.redeemed, 3);
    assert.ok(purchasedBundleSubscription?.usage.some((usage) => usage.orderId === bundleCreditOrder.payload.order.id && !usage.refundedAt),
      "A compra deve persistir o uso dos creditos antes do cancelamento");
    const cancelledBundleCreditOrder = await request(`/api/orders/${encodeURIComponent(bundleCreditOrder.payload.order.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Teste de estorno integral do pacote" })
    });
    assert.equal(cancelledBundleCreditOrder.response.status, 200);
    assert.equal(cancelledBundleCreditOrder.payload.order.status, "cancelled");
    const subscriptionsAfterBundleRefund = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    assert.equal(subscriptionsAfterBundleRefund.response.status, 200);
    const refundedBundleSubscription = subscriptionsAfterBundleRefund.payload.subscriptions.find((subscription) => subscription.id === bundleSubscription.payload.subscription.id);
    assert.ok(refundedBundleSubscription, "A assinatura do pacote deve continuar visivel apos o cancelamento");
    const refundedBundleUsage = refundedBundleSubscription.usage.find((usage) => usage.orderId === bundleCreditOrder.payload.order.id);
    let persistedClubState = null;
    if (postgresMode && !refundedBundleUsage?.refundedAt) {
      const { queryPostgres } = require("../backend/db/postgresStore");
      const [credit, usage, order] = await Promise.all([
        queryPostgres("SELECT used, remaining FROM subscription_credits WHERE id=$1", [refundedBundleSubscription.credit?.id]),
        queryPostgres("SELECT credits_used, refunded_at FROM subscription_usage WHERE order_id=$1", [bundleCreditOrder.payload.order.id]),
        queryPostgres("SELECT status, updated_at, metadata->'auditTrail' AS audit_trail FROM orders WHERE id=$1", [bundleCreditOrder.payload.order.id])
      ]);
      persistedClubState = {
        credit: credit.rows,
        usage: usage.rows,
        order: order.rows.map(({ status, updated_at, audit_trail }) => ({ status, updated_at, auditActions: (audit_trail || []).map((entry) => entry.action) }))
      };
    }
    assert.ok(refundedBundleUsage?.refundedAt, JSON.stringify({
      message: "O uso dos creditos deve registrar a devolucao",
      orderId: bundleCreditOrder.payload.order.id,
      cancelledOrderStatus: cancelledBundleCreditOrder.payload.order?.status,
      cancellationAuditActions: (cancelledBundleCreditOrder.payload.order?.auditTrail || []).map((entry) => entry.action),
      subscriptionStatus: refundedBundleSubscription.status,
      credit: refundedBundleSubscription.credit,
      creditCounts: refundedBundleSubscription.creditCounts,
      persistedClubState,
      usage: refundedBundleSubscription.usage.map(({ id, orderId, creditId, creditsUsed, refundedAt }) => ({ id, orderId, creditId, creditsUsed, refundedAt }))
    }));
    assert.equal(refundedBundleSubscription.creditsRemaining, 3, JSON.stringify({
      orderId: bundleCreditOrder.payload.order.id,
      subscriptionStatus: refundedBundleSubscription.status,
      credit: refundedBundleSubscription.credit,
      creditCounts: refundedBundleSubscription.creditCounts,
      usage: refundedBundleUsage
    }));
    assert.equal(refundedBundleUsage.creditsUsed, 3);
    const closeBundleSubscription = await request(`/api/admin/subscriptions/${encodeURIComponent(bundleSubscription.payload.subscription.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ status: "ended", reason: "Fim do teste de pacote" })
    });
    assert.equal(closeBundleSubscription.response.status, 200);

    const renewedSubscription = await request("/api/admin/subscriptions/assign", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ userId: registered.user.id, planId: oneCreditPlan.payload.id })
    });
    assert.equal(renewedSubscription.response.status, 201);
    assert.equal(renewedSubscription.payload.subscription.status, "active");

    const renewedClubCredit = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: `club-smoke-renewed-valid-${Date.now()}` })
    });
    assert.equal(renewedClubCredit.response.status, 201);

    const usedClubValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ code: renewedClubCredit.payload.tickets[0].code })
    });
    assert.equal(usedClubValidation.response.status, 200, JSON.stringify(usedClubValidation.payload));

    const cancelUsedClubOrder = await request(`/api/orders/${encodeURIComponent(renewedClubCredit.payload.order.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Nao deve devolver credito usado" })
    });
    assert.equal(cancelUsedClubOrder.response.status, 409);

    const deletableCustomer = await registerCustomer(`delete-${Date.now()}@cine.local`);
    const deletableSubscription = await request("/api/admin/subscriptions/assign", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ userId: deletableCustomer.user.id, planId: oneCreditPlan.payload.id })
    });
    assert.equal(deletableSubscription.response.status, 201);
    const deleteCustomer = await request(`/api/users/${encodeURIComponent(deletableCustomer.user.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(deleteCustomer.response.status, 200);
    const subscriptionsAfterUserDelete = await request("/api/admin/subscriptions", { headers: jsonHeaders(adminCookie) });
    assert.equal(subscriptionsAfterUserDelete.response.status, 200);
    assert.ok(!subscriptionsAfterUserDelete.payload.subscriptions.some((subscription) => subscription.userId === deletableCustomer.user.id));

    const deleteOwnAdmin = await request("/api/users/admin", {
      method: "DELETE",
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(deleteOwnAdmin.response.status, 409);

    const deactivateSmokePlan = await request(`/api/admin/subscription-plans/${encodeURIComponent(oneCreditPlan.payload.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Smoke desativar plano com assinaturas" })
    });
    assert.equal(deactivateSmokePlan.response.status, 200);
    assert.equal(deactivateSmokePlan.payload.deactivated, true);
    assert.equal(deactivateSmokePlan.payload.plan.active, false);

    const boxOfficeSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        customerUserId: registered.user.id,
        saleMode: "registered",
        paymentMethod: "external_pix"
      })
    });
    assert.equal(boxOfficeSale.response.status, 201);
    assert.equal(boxOfficeSale.payload.order.origin, "box_office");
    assert.equal(boxOfficeSale.payload.order.customerUserId, registered.user.id);
    assert.equal(boxOfficeSale.payload.payment.method, "external_pix");
    assert.equal(boxOfficeSale.payload.tickets.length, 1);
    assert.equal(boxOfficeSale.payload.tickets[0].ticketType, "Ingresso Promocional");
    const committedBoxOfficeSale = await readPersistedDb();
    assert.equal(committedBoxOfficeSale.orders.some((item) => item.id === boxOfficeSale.payload.order.id), true, "Bilheteria 201 deve seguir o commit");
    assert.equal(committedBoxOfficeSale.tickets.some((item) => item.orderId === boxOfficeSale.payload.order.id), true);

    const concessionCounterSale = await request("/api/admin/concession-counter-sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        saleMode: "concession_counter",
        paymentMethod: "cash",
        concessionItems: [{ id: "smoke-counter-product", quantity: 2 }]
      })
    });
    assert.equal(concessionCounterSale.response.status, 201);
    assert.equal(concessionCounterSale.payload.order.origin, "concession_counter");
    assert.equal(concessionCounterSale.payload.order.saleMode, "concession_counter");
    assert.equal(concessionCounterSale.payload.order.totalPrice, 35);
    assert.equal(concessionCounterSale.payload.order.status, "paid_pending_print");
    assert.equal(concessionCounterSale.payload.order.stockReservationStatus, "reserved");
    assert.equal(concessionCounterSale.payload.tickets.length, 0);
    assert.equal(concessionCounterSale.payload.payment.metadata.origin, "concession_counter");
    const committedCounterSale = await readPersistedDb();
    assert.equal(committedCounterSale.orders.some((item) => item.id === concessionCounterSale.payload.order.id), true, "Bomboniere 201 deve seguir o commit");

    const concessionCourtesySale = await request("/api/admin/concession-counter-sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        saleMode: "concession_counter",
        paymentMethod: "courtesy",
        concessionItems: [{ id: "smoke-counter-product", quantity: 1 }]
      })
    });
    assert.equal(concessionCourtesySale.response.status, 201);
    assert.equal(concessionCourtesySale.payload.order.totalPrice, 0);
    assert.equal(concessionCourtesySale.payload.order.discountValue, 17.5);
    assert.equal(concessionCourtesySale.payload.payment.method, "courtesy");
    assert.equal(concessionCourtesySale.payload.payment.amount, 0);

    const counterReceipt = await fetch(`${BASE_URL}/api/admin/concession-sales/${encodeURIComponent(concessionCounterSale.payload.order.id)}/print`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(counterReceipt.status, 200);
    assert.match(counterReceipt.headers.get("content-type") || "", /application\/pdf/);
    assert.ok((await counterReceipt.arrayBuffer()).byteLength > 500);

    const confirmedCounterPrint = await request(`/api/box-office/point-payments/${encodeURIComponent(concessionCounterSale.payload.payment.id)}/print-result`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ ok: true, jobId: concessionCounterSale.payload.order.pointPrint.jobId })
    });
    assert.equal(confirmedCounterPrint.response.status, 200);
    assert.equal(confirmedCounterPrint.payload.completed, true);
    assert.equal(confirmedCounterPrint.payload.orders[0].concessionStatus, "fulfilled");
    assert.equal(confirmedCounterPrint.payload.orders[0].concessionItems[0].fulfilledQuantity, 2);

    const counterDailySales = await request(`/api/admin/concession-sales?date=${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}`, { headers: jsonHeaders(adminCookie) });
    assert.equal(counterDailySales.response.status, 200);
    const counterGroup = counterDailySales.payload.groups.find((group) => group.id.startsWith("counter-sales-"));
    assert.equal(counterGroup.title, "Balcão da bomboniere");
    assert.ok(counterGroup.orders.some((order) => order.id === concessionCounterSale.payload.order.id));
    const archivedCounterSale = await request(`/api/admin/concession-sales/${encodeURIComponent(concessionCounterSale.payload.order.id)}/archive`, {
      method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify({ archived: true })
    });
    assert.equal(archivedCounterSale.response.status, 200);
    assert.equal(archivedCounterSale.payload.archived, true);
    const contentAfterArchive = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(contentAfterArchive.response.status, 200);
    assert.equal(contentAfterArchive.payload.orders.find((order) => order.id === concessionCounterSale.payload.order.id)?.concessionArchived, true);
    const restoredCounterSale = await request(`/api/admin/concession-sales/${encodeURIComponent(concessionCounterSale.payload.order.id)}/archive`, {
      method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify({ archived: false })
    });
    assert.equal(restoredCounterSale.response.status, 200);
    assert.equal(restoredCounterSale.payload.archived, false);
    const contentAfterRestore = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(contentAfterRestore.response.status, 200);
    assert.equal(contentAfterRestore.payload.orders.find((order) => order.id === concessionCounterSale.payload.order.id)?.concessionArchived, false);

    const multiMovieSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        customerUserId: registered.user.id,
        saleMode: "registered",
        paymentMethod: "cash",
        saleItems: [
          { movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, ticketItems: [{ id: "promocional", quantity: 1 }] },
          { movieId: TEST_SECOND_MOVIE_ID, sessionId: TEST_SECOND_SESSION_ID, ticketItems: [{ id: "promocional", quantity: 2 }] }
        ]
      })
    });
    assert.equal(multiMovieSale.response.status, 201);
    assert.equal(multiMovieSale.payload.orders.length, 2);
    assert.equal(multiMovieSale.payload.payments.length, 2);
    assert.equal(multiMovieSale.payload.tickets.length, 3);
    assert.ok(multiMovieSale.payload.batchId);
    assert.ok(multiMovieSale.payload.orders.every((order) => order.customerUserId === registered.user.id));
    assert.deepEqual(new Set(multiMovieSale.payload.orders.map((order) => order.movieId)), new Set([TEST_MOVIE_ID, TEST_SECOND_MOVIE_ID]));

    const blockedTicketTypeSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "meia", quantity: 1 }],
        saleMode: "quick",
        paymentMethod: "cash"
      })
    });
    assert.equal(blockedTicketTypeSale.response.status, 409);
    assert.equal(blockedTicketTypeSale.payload.error.code, "SESSION_TICKET_TYPE_UNAVAILABLE");

    const allowedTicketTypeSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 2 }],
        concessionItems: [{ id: "combo-classico", quantity: 1 }],
        saleMode: "quick",
        paymentMethod: "cash"
      })
    });
    assert.equal(allowedTicketTypeSale.response.status, 201);
    assert.equal(allowedTicketTypeSale.payload.order.totalPrice, 45);
    assert.equal(allowedTicketTypeSale.payload.order.concessionItems[0].id, "combo-classico");
    assert.equal(allowedTicketTypeSale.payload.order.concessionItems[0].quantity, 1);
    assert.equal(allowedTicketTypeSale.payload.tickets.length, 2);
    assert.ok(allowedTicketTypeSale.payload.tickets.every((ticket) => ticket.ticketType === "Ingresso Promocional"));
    const confirmedQuickPrint = await request(`/api/box-office/point-payments/${encodeURIComponent(allowedTicketTypeSale.payload.payment.id)}/print-result`, {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ ok: true, jobId: allowedTicketTypeSale.payload.order.pointPrint.jobId })
    });
    assert.equal(confirmedQuickPrint.response.status, 200);
    assert.equal(confirmedQuickPrint.payload.completed, true);
    assert.equal(confirmedQuickPrint.payload.tickets.length, 2);

    const guestOnlineWithoutEmail = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        customerName: "Cliente Online",
        saleMode: "guest",
        ticketDeliveryMethod: "online",
        paymentMethod: "cash"
      })
    });
    assert.equal(guestOnlineWithoutEmail.response.status, 422);
    assert.equal(guestOnlineWithoutEmail.payload.error.code, "BOX_OFFICE_DELIVERY_EMAIL_INVALID");

    const guestOnlineSaleStartedAt = Date.now();
    const guestOnlineSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        customerName: "Cliente Online",
        customerEmail: "cliente-online@cine.local",
        saleMode: "guest",
        ticketDeliveryMethod: "online",
        paymentMethod: "cash"
      })
    });
    assert.equal(guestOnlineSale.response.status, 201);
    assert.ok(Date.now() - guestOnlineSaleStartedAt < 1100, "A emissão não deve aguardar o provedor de e-mail");
    assert.equal(guestOnlineSale.payload.order.ticketDeliveryMethod, "online");
    assert.equal(guestOnlineSale.payload.pointPrint.status, "not_requested");

    const guestPhysicalSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        customerName: "Cliente Balcão",
        saleMode: "guest",
        ticketDeliveryMethod: "physical",
        paymentMethod: "cash"
      })
    });
    assert.equal(guestPhysicalSale.response.status, 201);
    assert.equal(guestPhysicalSale.payload.order.ticketDeliveryMethod, "physical");

    const concessionValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ code: allowedTicketTypeSale.payload.tickets[0].code, mode: "concessions" })
    });
    assert.equal(concessionValidation.response.status, 200);
    assert.equal(concessionValidation.payload.result, "concessions_fulfilled");
    assert.equal(concessionValidation.payload.concessions[0].fulfilledQuantity, 1);

    const duplicateConcessionValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ code: allowedTicketTypeSale.payload.tickets[1].code, mode: "concessions" })
    });
    assert.equal(duplicateConcessionValidation.response.status, 409);
    assert.equal(duplicateConcessionValidation.payload.result, "concessions_already_fulfilled");

    const wrongSessionValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        code: allowedTicketTypeSale.payload.tickets[0].code,
        sessionId: TEST_SECOND_SESSION_ID
      })
    });
    assert.equal(wrongSessionValidation.response.status, 409);
    assert.equal(wrongSessionValidation.payload.result, "wrong_session");
    assert.equal(wrongSessionValidation.payload.error.code, "TICKET_SESSION_MISMATCH");
    assert.notEqual(wrongSessionValidation.payload.ticket.status, "used");

    const correctSessionValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        code: `CC2.${Buffer.from(JSON.stringify({ v: 2, c: allowedTicketTypeSale.payload.tickets[0].code }), "utf8").toString("base64url")}.assinatura-legada`,
        sessionId: TEST_SESSION_ID
      })
    });
    assert.equal(correctSessionValidation.response.status, 200);
    assert.equal(correctSessionValidation.payload.ticket.status, "used");
    const afterTicketValidation = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(afterTicketValidation.response.status, 200);
    assert.equal(
      afterTicketValidation.payload.tickets.find((ticket) => ticket.id === correctSessionValidation.payload.ticket.id)?.status,
      "used",
      "A validacao deve estar persistida quando HTTP 200 for recebido."
    );

    const bundledTicketSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        ticketItems: [{ id: "triple-smoke", quantity: 2 }],
        saleMode: "quick",
        paymentMethod: "cash"
      })
    });
    assert.equal(bundledTicketSale.response.status, 201);
    assert.equal(bundledTicketSale.payload.order.totalPrice, 50);
    assert.equal(bundledTicketSale.payload.order.ticketItems[0].bundleQuantity, 3);
    assert.equal(bundledTicketSale.payload.order.ticketItems[0].ticketQuantity, 6);
    assert.equal(bundledTicketSale.payload.tickets.length, 6);
    assert.ok(bundledTicketSale.payload.tickets.every((ticket) => ticket.ticketType === "Triple Ingresso"));

    const adminLogs = await request("/api/admin/logs?page=1&pageSize=10", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminLogs.response.status, 200);
    assert.ok(Array.isArray(adminLogs.payload.logs));

    await requestUntil(`/api/orders/${encodeURIComponent(boxOfficeSale.payload.order.id)}`, {
      headers: jsonHeaders(adminCookie)
    }, ({ response, payload }) => response.status === 200 && Boolean(payload.order?.emailDeliveredAt || payload.order?.ticketDelivery?.status === "delivered"), 10000);

    const editedOrder = await request(`/api/orders/${encodeURIComponent(boxOfficeSale.payload.order.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        customerPhone: "11888888888",
        operationalNotes: "Ajuste operacional smoke",
        reason: "Teste smoke"
      })
    });
    assert.equal(editedOrder.response.status, 200);
    assert.equal(editedOrder.payload.order.customerPhone, "11888888888");
    assert.ok(Array.isArray(editedOrder.payload.order.auditTrail));

    const archivedOrder = await request(`/api/orders/${encodeURIComponent(boxOfficeSale.payload.order.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ action: "archive", reason: "Arquivamento smoke" })
    });
    assert.equal(archivedOrder.response.status, 200);
    assert.equal(archivedOrder.payload.order.archived, true);
    assert.ok(archivedOrder.payload.order.archivedAt);
    assert.ok(archivedOrder.payload.order.auditTrail.some((entry) => entry.action === "archive"));

    const restoredOrder = await request(`/api/orders/${encodeURIComponent(boxOfficeSale.payload.order.id)}`, {
      method: "PATCH",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ action: "unarchive", reason: "Restauração smoke" })
    });
    assert.equal(restoredOrder.response.status, 200);
    assert.equal(restoredOrder.payload.order.archived, false);
    assert.equal(restoredOrder.payload.order.archivedAt, "");
    assert.ok(restoredOrder.payload.order.auditTrail.some((entry) => entry.action === "unarchive"));

    const expiredQuickSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_EXPIRED_SESSION_ID,
        ticketItems: [{ id: "promocional", quantity: 1 }],
        saleMode: "quick",
        paymentMethod: "cash"
      })
    });
    assert.equal(expiredQuickSale.response.status, 404);
    assert.equal(expiredQuickSale.payload.error.code, "SESSION_NOT_FOUND");

    const deletionSale = await request("/api/box-office/sales", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        saleMode: "quick",
        paymentMethod: "cash"
      })
    });
    assert.equal(deletionSale.response.status, 201);
    const deniedPermanentDelete = await request(`/api/orders/${encodeURIComponent(deletionSale.payload.order.id)}/permanent`, {
      method: "DELETE",
      headers: jsonHeaders(operatorCookie),
      body: JSON.stringify({ reason: "Operador nao pode excluir", confirmation: "EXCLUIR" })
    });
    assert.equal(deniedPermanentDelete.response.status, 403);
    const invalidPermanentDelete = await request(`/api/orders/${encodeURIComponent(deletionSale.payload.order.id)}/permanent`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Teste", confirmation: "APAGAR" })
    });
    assert.equal(invalidPermanentDelete.response.status, 422);
    const permanentDelete = await request(`/api/orders/${encodeURIComponent(deletionSale.payload.order.id)}/permanent`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Remocao permanente smoke", confirmation: "EXCLUIR" })
    });
    assert.equal(permanentDelete.response.status, 200);
    const contentAfterPermanentDelete = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(contentAfterPermanentDelete.response.status, 200);
    assert.equal(contentAfterPermanentDelete.payload.orders.some((order) => order.id === deletionSale.payload.order.id), false);
    assert.equal(contentAfterPermanentDelete.payload.payments.some((payment) => payment.orderId === deletionSale.payload.order.id), false);
    assert.equal(contentAfterPermanentDelete.payload.tickets.some((ticket) => ticket.orderId === deletionSale.payload.order.id), false);

    const directTicketsNavigation = await rawHttpRequest("/api/me/tickets", {
      Cookie: cookie,
      Accept: "text/html",
      "Sec-Fetch-Mode": "navigate"
    });
    assert.equal(directTicketsNavigation.statusCode, 303);
    assert.match(directTicketsNavigation.headers.location || "", /\/conta\/ingressos$/);

    const accountTickets = await request("/api/me/tickets", { headers: { Cookie: cookie } });
    assert.equal(accountTickets.response.status, 200);
    assert.ok(accountTickets.payload.tickets.some((ticket) => ticket.id === boxOfficeSale.payload.tickets[0].id));
    assert.ok(Array.isArray(accountTickets.payload.upcoming));
    assert.ok(Array.isArray(accountTickets.payload.archived));
    assert.equal(accountTickets.payload.upcoming.some((ticket) => ticket.id === "smoke-expired-history-ticket"), false);
    assert.equal(accountTickets.payload.archived.some((ticket) => ticket.id === "smoke-expired-history-ticket"), true);
    const expiredAccountTicket = accountTickets.payload.archived.find((ticket) => ticket.id === "smoke-expired-history-ticket");
    assert.equal(Object.prototype.hasOwnProperty.call(expiredAccountTicket, "code"), false);

    const expiredDownload = await fetch(`${BASE_URL}/api/me/tickets/${encodeURIComponent(expiredAccountTicket.id)}/download`, {
      headers: { Cookie: cookie }
    });
    assert.equal(expiredDownload.status, 410);
    const expiredDownloadPayload = await expiredDownload.json();
    assert.equal(expiredDownloadPayload.error.code, "TICKET_DOCUMENT_EXPIRED");

    const manualTicket = accountTickets.payload.tickets.find((ticket) => ticket.id === boxOfficeSale.payload.tickets[0].id);
    for (const [path, options] of [
      [`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/download`, { headers: { Cookie: targetCookie } }],
      [`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/google-wallet`, { method: "POST", headers: jsonHeaders(targetCookie) }],
      [`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/transfer`, { method: "POST", headers: jsonHeaders(targetCookie), body: JSON.stringify({ email }) }]
    ]) {
      const forbiddenTicketAccess = await request(path, options);
      assert.equal(forbiddenTicketAccess.response.status, 404);
      assert.equal(forbiddenTicketAccess.payload.error.code, "TICKET_NOT_FOUND");
    }
    const download = await fetch(`${BASE_URL}/api/me/tickets/${encodeURIComponent(manualTicket.id)}/download`, {
      headers: { Cookie: cookie }
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-disposition") || "", /attachment/);
    const downloadedPdfBuffer = Buffer.from(await download.arrayBuffer());
    const downloadedPdf = downloadedPdfBuffer.toString("latin1");
    assert.match(downloadedPdf, /Cine Cruzeiro/);
    assert.match(downloadedPdf, /\/ImLogo Do/);
    assert.ok(downloadedPdf.includes(pdfSessionLabel(mainSession)));
    assert.ok(!downloadedPdf.includes(`${mainSession.date} as ${mainSession.time}`));

    const numberedSeatPdf = await fetch(`${BASE_URL}/api/admin/tickets/${encodeURIComponent(boxOfficeSeat.payload.tickets[0].id)}/print`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(numberedSeatPdf.status, 200);
    const numberedSeatPdfBuffer = Buffer.from(await numberedSeatPdf.arrayBuffer());
    const numberedSeatPdfText = numberedSeatPdfBuffer.toString("latin1");
    assert.match(numberedSeatPdfText, /MediaBox \[0 0 226\.77 566\.93\]/);
    assert.match(numberedSeatPdfText, /VIA PDV/);
    assert.ok(numberedSeatPdfText.includes(pdfSessionLabel(seatSession)));
    assert.match(numberedSeatPdfText, /POLTRONA/);
    assert.match(numberedSeatPdfText, /A2/);
    if (process.env.SMOKE_TICKET_PDF_OUTPUT) {
      fs.mkdirSync(require("path").dirname(process.env.SMOKE_TICKET_PDF_OUTPUT), { recursive: true });
      fs.writeFileSync(process.env.SMOKE_TICKET_PDF_OUTPUT, numberedSeatPdfBuffer);
    }

    const walletMissing = await request(`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/google-wallet`, {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    assert.equal(walletMissing.response.status, 412);

    const walletKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const walletPrivateKey = walletKeyPair.privateKey.export({ type: "pkcs8", format: "pem" });
    const walletIntegration = await request("/api/admin/integrations/googleWallet", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        issuerId: "3388000000023188948",
        classId: "lumixengine_ingressos",
        origins: "https://lumixengine.com/projects/cinecruzeiro,https://www.lumixengine.com/projects/cinecruzeiro",
        serviceAccountJson: JSON.stringify({
          type: "service_account",
          project_id: "painel-interno-lumix",
          client_email: "lumixengine@painel-interno-lumix.iam.gserviceaccount.com",
          private_key: walletPrivateKey
        })
      })
    });
    assert.equal(walletIntegration.response.status, 200);
    assert.equal(walletIntegration.payload.integration.values.clientEmail, "lumixengine@painel-interno-lumix.iam.gserviceaccount.com");
    assert.equal(walletIntegration.payload.integration.values.serviceAccountConfigured, true);
    assert.equal(walletIntegration.payload.integration.secrets.serviceAccountJson.hasValue, true);

    const walletPass = await request(`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/google-wallet`, {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    assert.equal(walletPass.response.status, 200);
    assert.match(walletPass.payload.url, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    const walletJwt = walletPass.payload.url.split("/save/")[1];
    const walletPayload = JSON.parse(Buffer.from(walletJwt.split(".")[1], "base64url").toString("utf8"));
    assert.equal(walletPayload.iss, "lumixengine@painel-interno-lumix.iam.gserviceaccount.com");
    assert.equal(walletPayload.aud, "google");
    assert.equal(walletPayload.typ, "savetowallet");
    assert.ok(walletPayload.origins.includes("https://lumixengine.com"));
    assert.ok(walletPayload.origins.includes("https://www.lumixengine.com"));
    assert.equal(walletPayload.origins.some((origin) => origin.includes("/projects/cinecruzeiro")), false);
    assert.ok(Array.isArray(walletPayload.payload.eventTicketObjects));
    assert.equal(walletPayload.payload.genericObjects, undefined);
    assert.equal(walletPayload.payload.eventTicketObjects[0].classId, "3388000000023188948.lumixengine_ingressos");
    assert.equal(walletPayload.payload.eventTicketObjects[0].id, `3388000000023188948.ticket_${manualTicket.id.replace(/[^A-Za-z0-9._-]/g, "_")}`);
    assert.equal(walletPayload.payload.eventTicketObjects[0].state, "ACTIVE");
    assert.equal(walletPayload.payload.eventTicketObjects[0].eventName, undefined);
    assert.equal(walletPayload.payload.eventTicketObjects[0].ticketType.defaultValue.value, manualTicket.ticketType);
    assert.equal(walletPayload.payload.eventTicketObjects[0].reservationInfo.confirmationCode, boxOfficeSale.payload.order.id);
    assert.equal(walletPayload.payload.eventTicketObjects[0].seatInfo.seat.defaultValue.value, manualTicket.seat);

    const transfer = await request(`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/transfer`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ email: target.user.email })
    });
    assert.equal(transfer.response.status, 200);
    assert.equal(transfer.payload.ticket.customerUserId, undefined);
    assert.notEqual(transfer.payload.ticket.code, manualTicket.code);
    assert.equal(transfer.payload.ticket.canTransfer, false);
    assert.match(transfer.payload.ticket.transferBlockedReason, /24 horas/i);

    const oldOwnerTickets = await requestUntil(
      "/api/me/tickets",
      { headers: { Cookie: cookie } },
      ({ payload }) => payload.tickets && !payload.tickets.some((ticket) => ticket.id === manualTicket.id)
    );
    assert.equal(oldOwnerTickets.response.status, 200);
    assert.equal(oldOwnerTickets.payload.tickets.some((ticket) => ticket.id === manualTicket.id), false);

    const targetTickets = await request("/api/me/tickets", { headers: { Cookie: targetCookie } });
    assert.equal(targetTickets.response.status, 200);
    assert.ok(targetTickets.payload.tickets.some((ticket) => ticket.id === manualTicket.id));

    const oldQrValidation = await request("/api/tickets/validate", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ code: manualTicket.code })
    });
    assert.equal(oldQrValidation.response.status, 404);

    const accountTicketsByBearer = await request("/api/me/tickets", { headers: { Authorization: "Bearer legacy-browser-token" } });
    assert.equal(accountTicketsByBearer.response.status, 401);

    const bruteForceEmail = `brute-${Date.now()}@cine.local`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedAttempt = await request("/api/auth/login", {
        method: "POST",
        headers: { ...jsonHeaders(), "X-Forwarded-For": "203.0.113.77" },
        body: JSON.stringify({ email: bruteForceEmail, password: "senha-incorreta" })
      });
      assert.equal(failedAttempt.response.status, 401);
    }
    const blockedLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { ...jsonHeaders(), "X-Forwarded-For": "203.0.113.77" },
      body: JSON.stringify({ email: bruteForceEmail, password: "senha-incorreta" })
    });
    assert.equal(blockedLogin.response.status, 429);
    assert.ok(Number(blockedLogin.response.headers.get("retry-after")) >= 1);

    const badLogin = await request("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: emailChangeAddress, password: "senha-errada" })
    });
    assert.equal(badLogin.response.status, 401);
    assert.equal(typeof badLogin.payload.error.code, "string");

    if (!postgresMode) await new Promise((resolve) => setTimeout(resolve, 2000));

    const resetRequest = await request("/api/auth/password/request", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: emailChangeAddress })
    });
    assert.equal(resetRequest.response.status, 202);
    assert.ok(resetRequest.payload.resetToken);

    const reset = await request("/api/auth/password/reset", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: resetRequest.payload.resetToken, password: "nova123456" })
    });
    assert.equal(reset.response.status, 200, JSON.stringify(reset.payload));
    const resetCookie = reset.response.headers.get("set-cookie")?.split(";")[0] || "";
    assert.match(resetCookie, /^cine_customer=/);
    cookie = resetCookie;
    const sessionAfterReset = await request("/api/auth/me", { headers: jsonHeaders(cookie) });
    assert.equal(sessionAfterReset.response.status, 200, JSON.stringify(sessionAfterReset.payload));

    const resetReuse = await request("/api/auth/password/reset", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: resetRequest.payload.resetToken, password: "outra-senha-123" })
    });
    assert.equal(resetReuse.response.status, 400);
    const sessionAfterResetReuse = await request("/api/auth/me", { headers: jsonHeaders(cookie) });
    assert.equal(sessionAfterResetReuse.response.status, 200, JSON.stringify(sessionAfterResetReuse.payload));

    const orderBody = {
      order: {
        id: "smoke-pix-pendente",
        idempotencyKey: "smoke-pix-pendente",
        movieId: TEST_MOVIE_ID,
        sessionId: TEST_SESSION_ID,
        fullTicketsCount: 1,
        halfTicketsCount: 0,
        customerName: "Teste Smoke",
        customerEmail: emailChangeAddress,
        customerPhone: "11999999999",
        concessionItems: [{ id: "combo-classico", quantity: 1 }]
      }
    };

    const pix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(orderBody)
    });
    assert.equal(pix.response.status, 201, JSON.stringify(pix.payload));
    assert.equal(pix.payload.payment.provider, "mercado_pago");
    assert.equal(pix.payload.payment.status, "pending");
    assert.equal(typeof pix.payload.payment.qrCode, "string");

    const duplicatePix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(orderBody)
    });
    assert.equal(duplicatePix.response.status, 200);
    assert.equal(duplicatePix.payload.order.id, pix.payload.order.id);

    const checkoutStatus = await request("/api/checkout/orders/smoke-pix-pendente", {
      headers: jsonHeaders(cookie)
    });
    assert.equal(checkoutStatus.response.status, 200);
    assert.equal(checkoutStatus.payload.payment.status, "pending");
    assert.equal(checkoutStatus.payload.tickets.length, 0);

    const checkoutWithoutProof = await request("/api/checkout/orders/smoke-pix-pendente");
    assert.equal(checkoutWithoutProof.response.status, 404);

    const checkoutAsOtherCustomer = await request("/api/checkout/orders/smoke-pix-pendente", {
      headers: jsonHeaders(targetCookie)
    });
    assert.equal(checkoutAsOtherCustomer.response.status, 404);

    const legacyOrderCreation = await request("/api/orders", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ id: "attacker-order", status: "paid", totalPrice: 0 })
    });
    assert.equal(legacyOrderCreation.response.status, 410);

    const noExtrasOrderId = `smoke-pix-sem-extras-${Date.now()}`;
    const noExtrasPix = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        order: {
          id: noExtrasOrderId,
          idempotencyKey: noExtrasOrderId,
          movieId: TEST_MOVIE_ID,
          sessionId: TEST_SESSION_ID,
          fullTicketsCount: 1,
          halfTicketsCount: 0,
          customerName: "Teste Smoke",
          customerEmail: emailChangeAddress,
          customerPhone: "11999999999",
          concessionItems: [],
          useClubCredits: false
        }
      })
    });
    assert.equal(noExtrasPix.response.status, 201);
    assert.equal(noExtrasPix.payload.payment.status, "pending");
    assert.equal(noExtrasPix.payload.order.status, "pending_payment");
    assert.equal(noExtrasPix.payload.tickets.length, 0);

    const webhookResourceId = pix.payload.payment.providerPaymentId;
    const webhookRequestId = crypto.randomUUID();
    const webhookTimestamp = String(Math.floor(Date.now() / 1000));
    const webhookBody = {
      action: "order.processed",
      api_version: "v1",
      type: "order",
      live_mode: false,
      data: {
        id: webhookResourceId,
        external_reference: pix.payload.order.id,
        status: "processed",
        status_detail: "accredited",
        total_amount: String(pix.payload.payment.amount),
        total_paid_amount: String(pix.payload.payment.amount),
        version: 1,
        transactions: {
          payments: [{
            id: "PAY_SMOKE_APPROVED",
            amount: String(pix.payload.payment.amount),
            paid_amount: String(pix.payload.payment.amount),
            status: "processed",
            status_detail: "accredited",
            payment_method: { id: "pix", type: "bank_transfer" }
          }]
        }
      }
    };
    const manifest = `id:${webhookResourceId};request-id:${webhookRequestId};ts:${webhookTimestamp};`;
    const webhookSignature = crypto.createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(manifest).digest("hex");
    const webhookHeaders = {
      "Content-Type": "application/json",
      "x-request-id": webhookRequestId,
      "x-signature": `ts=${webhookTimestamp},v1=${webhookSignature}`
    };
    const approvedWebhook = await request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(webhookResourceId)}&type=order`, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify(webhookBody)
    });
    assert.equal(approvedWebhook.response.status, 200);
    assert.equal(approvedWebhook.payload.processed, true);
    assert.equal(approvedWebhook.payload.processing.status, "approved");

    const duplicateWebhook = await request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(webhookResourceId)}&type=order`, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify(webhookBody)
    });
    assert.equal(duplicateWebhook.response.status, 200);
    assert.equal(duplicateWebhook.payload.duplicate, true);

    const invalidWebhook = await request(`/api/webhooks/mercado-pago?data.id=${encodeURIComponent(webhookResourceId)}&type=order`, {
      method: "POST",
      headers: { ...webhookHeaders, "x-signature": `${webhookHeaders["x-signature"]}invalid` },
      body: JSON.stringify(webhookBody)
    });
    assert.equal(invalidWebhook.response.status, 401);

    const simulator = await request("/api/admin/integrations/mercadoPago/webhook-simulations", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ scenario: "resource_not_found", action: "order.processed", amount: 10 })
    });
    assert.equal(simulator.response.status, 200);
    assert.equal(simulator.payload.run.httpStatus, 503);
    assert.equal(simulator.payload.run.passed, true);

    const webhookBatch = await request("/api/admin/integrations/mercadoPago/webhook-simulations/batch", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({})
    });
    assert.equal(webhookBatch.response.status, 202);
    let webhookBatchJob = webhookBatch.payload.job;
    for (let attempt = 0; attempt < 100 && !["completed", "failed"].includes(webhookBatchJob.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const progress = await request(`/api/admin/integrations/mercadoPago/webhook-simulations/batch/${encodeURIComponent(webhookBatchJob.id)}`, {
        headers: jsonHeaders(adminCookie)
      });
      assert.equal(progress.response.status, 200);
      webhookBatchJob = progress.payload.job;
    }
    assert.equal(webhookBatchJob.status, "completed", JSON.stringify(webhookBatchJob));
    assert.equal(webhookBatchJob.total, 8);
    assert.equal(webhookBatchJob.passed, 8);
    assert.equal(webhookBatchJob.failed, 0);

    const cardBody = {
      order: {
        ...orderBody.order,
        id: "smoke-card-orders-api",
        idempotencyKey: "smoke-card-orders-api",
        concessionItems: []
      },
      cardToken: "test-card-token",
      paymentMethodId: "visa",
      paymentTypeId: "credit_card",
      installments: 1,
      idempotencyKey: "smoke-card-orders-api"
    };
    const card = await request("/api/payments/card", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify(cardBody)
    });
    assert.equal(card.response.status, 201);
    assert.equal(card.payload.payment.provider, "mercado_pago");
    assert.equal(card.payload.payment.method, "credit_card");
    const cardAfterCreated = await request("/api/admin/content", { headers: jsonHeaders(adminCookie) });
    assert.equal(cardAfterCreated.response.status, 200);
    assert.equal(cardAfterCreated.payload.orders.some((order) => order.id === card.payload.order.id), true, "Cartao 201 deve ser visivel apos commit");

    const pointConfig = await request("/api/admin/integrations/mercadoPago", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ enabled: true, pointEnabled: true, pointDeviceId: "smoke-point-terminal", accessToken: "TEST-smoke-point-only" })
    });
    assert.equal(pointConfig.response.status, 200);
    const pointSaleBody = (key) => ({
      movieId: TEST_MOVIE_ID,
      sessionId: TEST_SESSION_ID,
      fullTicketsCount: 1,
      halfTicketsCount: 0,
      saleMode: "quick",
      paymentMethod: "point_debit",
      clientRequestId: key
    });
    const createPointSale = async (key) => {
      const result = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(key))
      });
      assert.equal(result.response.status, 202, JSON.stringify(result.payload));
      assert.equal(result.payload.payment.status, "pending");
      const saved = await readPersistedDb();
      assert.equal(saved.payments.some((item) => item.id === result.payload.payment.id), true, "Point 202 deve seguir o commit");
      return result;
    };
    const pointCallsBeforeInvalid = mockPointOrders.size;
    for (const endpoint of ["/api/box-office/sales", "/api/tickets/manual", "/api/admin/concession-counter-sales"]) {
      const invalid = await request(endpoint, {
        method: "POST", headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ ...pointSaleBody("missing-key"), clientRequestId: "bad!" })
      });
      assert.equal(invalid.response.status, 422);
      assert.equal(invalid.payload.error.code, "POINT_REQUEST_ID_REQUIRED");
    }
    assert.equal(mockPointOrders.size, pointCallsBeforeInvalid, "Identidade invalida nao pode chamar o provedor");
    const cancelPoint = (id) => request(`/api/box-office/point-payments/${encodeURIComponent(id)}/cancel`, {
      method: "POST", headers: jsonHeaders(adminCookie), body: "{}"
    });

    const pointPending = await createPointSale("smoke-point-pending");
    const resumedPointSale = await request("/api/box-office/sales", {
      method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody("smoke-point-pending"))
    });
    assert.equal(resumedPointSale.response.status, 200);
    assert.equal(resumedPointSale.payload.payment.id, pointPending.payload.payment.id);
    assert.equal(mockPointOrders.size, 1, "Repetir a venda nao deve criar outra Order Point");
    if (postgresMode) {
      const conflict = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ ...pointSaleBody("smoke-point-pending"), fullTicketsCount: 2 })
      });
      assert.equal(conflict.response.status, 409);
      assert.equal(conflict.payload.error.code, "POINT_REQUEST_ID_CONFLICT");
      assert.equal(mockPointOrders.size, 1);
    }
    pointCancelMode = "pending";
    const inconclusiveCancel = await cancelPoint(pointPending.payload.payment.id);
    assert.equal(inconclusiveCancel.response.status, 202);
    assert.equal(inconclusiveCancel.payload.payment.status, "pending");
    assert.equal(inconclusiveCancel.payload.cancellationPending, true);
    assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointPending.payload.payment.id).status, "pending");
    pointCancelMode = "cancelled";
    const confirmedCancel = await cancelPoint(pointPending.payload.payment.id);
    assert.equal(confirmedCancel.response.status, 200);
    assert.equal(confirmedCancel.payload.payment.status, "cancelled");
    const cancelledSnapshot = await readPersistedDb();
    assert.equal(cancelledSnapshot.payments.find((item) => item.id === pointPending.payload.payment.id).status, "cancelled");
    assert.equal(cancelledSnapshot.orders.find((item) => item.id === pointPending.payload.order.id).status, "cancelled");
    const cancelCallsAfterConfirmation = pointCancelCalls;
    const repeatedCancel = await cancelPoint(pointPending.payload.payment.id);
    assert.equal(repeatedCancel.response.status, 200);
    assert.equal(pointCancelCalls, cancelCallsAfterConfirmation, "A repeticao nao deve chamar cancelamento externo novamente");

    const pointRefused = await createPointSale("smoke-point-refused");
    pointCancelMode = "refused";
    const refusedCancel = await cancelPoint(pointRefused.payload.payment.id);
    assert.equal(refusedCancel.response.status, 409);
    assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointRefused.payload.payment.id).status, "pending");
    pointCancelMode = "timeout";
    const timedOutCancel = await cancelPoint(pointRefused.payload.payment.id);
    assert.equal(timedOutCancel.response.status, 504);
    assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointRefused.payload.payment.id).status, "pending");

    const pointConcurrent = await createPointSale("smoke-point-concurrent");
    pointCancelMode = "cancelled";
    const callsBeforeRace = pointCancelCalls;
    const parallelCancels = await Promise.all([cancelPoint(pointConcurrent.payload.payment.id), cancelPoint(pointConcurrent.payload.payment.id)]);
    assert.deepEqual(parallelCancels.map((item) => item.response.status), [200, 200]);
    assert.equal(pointCancelCalls, callsBeforeRace + 1, "Duas requisicoes devem produzir um cancelamento externo");
    assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointConcurrent.payload.payment.id).status, "cancelled");

    const unknownPoint = await request("/api/box-office/point-payments/not-found", { headers: jsonHeaders(adminCookie) });
    assert.equal(unknownPoint.response.status, 404);
    const pointToApprove = await createPointSale("smoke-point-approval");
    const pointOrder = mockPointOrders.get(pointToApprove.payload.payment.providerPaymentId);
    const pointStatusPath = `/api/box-office/point-payments/${encodeURIComponent(pointToApprove.payload.payment.id)}`;
    const pendingPoint = await request(pointStatusPath, { headers: jsonHeaders(adminCookie) });
    assert.equal(pendingPoint.response.status, 200);
    assert.equal(pendingPoint.payload.payment.status, "pending");
    assert.equal(pendingPoint.payload.completed, false);
    pointStatusError = "POINT_CONNECTION_LOST";
    const disconnectedPoint = await request(pointStatusPath, { headers: jsonHeaders(adminCookie) });
    assert.equal(disconnectedPoint.response.status, 200);
    assert.equal(disconnectedPoint.payload.reconnecting, true);
    pointStatusError = "";
    pointOrder.externalReference = "another-sale";
    assert.equal((await request(pointStatusPath, { headers: jsonHeaders(adminCookie) })).response.status, 409);
    pointOrder.externalReference = pointToApprove.payload.payment.providerReference;
    pointOrder.amount += 1;
    assert.equal((await request(pointStatusPath, { headers: jsonHeaders(adminCookie) })).response.status, 409);
    pointOrder.amount -= 1;
    pointOrder.status = "approved";
    pointOrder.providerStatus = "processed";
    const approvedPoint = await request(pointStatusPath, { headers: jsonHeaders(adminCookie) });
    assert.equal(approvedPoint.response.status, 200);
    assert.equal(approvedPoint.payload.completed, true);
    assert.equal(approvedPoint.payload.tickets.length, 1);
    const approvedSnapshot = await readPersistedDb();
    assert.equal(approvedSnapshot.payments.find((item) => item.id === pointToApprove.payload.payment.id).status, "approved");
    assert.equal(approvedSnapshot.tickets.filter((item) => item.orderId === pointToApprove.payload.order.id).length, 1);
    const printCountAfterApproval = mockPointPrints.size;
    const repeatedApprovals = await Promise.all([
      request(pointStatusPath, { headers: jsonHeaders(adminCookie) }),
      request(pointStatusPath, { headers: jsonHeaders(adminCookie) })
    ]);
    assert.deepEqual(repeatedApprovals.map((item) => item.response.status), [200, 200]);
    assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === pointToApprove.payload.order.id).length, 1);
    assert.equal(mockPointPrints.size, printCountAfterApproval);

    pointOrder.status = "refunded";
    pointOrder.providerStatus = "refunded";
    const providerRefundedAfterSale = await request(pointStatusPath, { headers: jsonHeaders(adminCookie) });
    assert.equal(providerRefundedAfterSale.response.status, 200);
    assert.equal(providerRefundedAfterSale.payload.reconciliationRequired, true);
    assert.equal(providerRefundedAfterSale.payload.completed, false);
    assert.equal(providerRefundedAfterSale.payload.payment.metadata.reconciliationReason, "point_provider_disagrees_with_paid_order");
    assert.equal((await readPersistedDb()).tickets.find((item) => item.orderId === pointToApprove.payload.order.id).status, "active");
    assert.equal(mockPointPrints.size, printCountAfterApproval);

    const latePoint = await createPointSale("smoke-point-late-approval");
    assert.equal((await cancelPoint(latePoint.payload.payment.id)).response.status, 200);
    const lateProviderOrder = mockPointOrders.get(latePoint.payload.payment.providerPaymentId);
    lateProviderOrder.status = "approved";
    lateProviderOrder.providerStatus = "processed";
    const lateApproval = await request(`/api/box-office/point-payments/${encodeURIComponent(latePoint.payload.payment.id)}`, { headers: jsonHeaders(adminCookie) });
    assert.equal(lateApproval.response.status, 200);
    assert.equal(lateApproval.payload.reconciliationRequired, true);
    assert.equal(lateApproval.payload.completed, false);
    assert.equal((await readPersistedDb()).orders.find((item) => item.id === latePoint.payload.order.id).status, "cancelled");
    assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === latePoint.payload.order.id).length, 0);

    const pointPrintFailure = await createPointSale("smoke-point-print-failure");
    const printFailureProviderOrder = mockPointOrders.get(pointPrintFailure.payload.payment.providerPaymentId);
    printFailureProviderOrder.status = "approved";
    printFailureProviderOrder.providerStatus = "processed";
    pointPrintFails = true;
    const failedPrint = await request(`/api/box-office/point-payments/${encodeURIComponent(pointPrintFailure.payload.payment.id)}`, { headers: jsonHeaders(adminCookie) });
    pointPrintFails = false;
    assert.equal(failedPrint.response.status, 200);
    assert.equal(failedPrint.payload.pointPrint.status, "failed");
    assert.equal(failedPrint.payload.completed, false);
    assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === pointPrintFailure.payload.order.id).length, 0);

    const lastStockSale = () => request("/api/admin/concession-counter-sales", {
      method: "POST", headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ saleMode: "concession_counter", paymentMethod: "cash", concessionItems: [{ id: "smoke-last-stock", quantity: 1 }] })
    });
    const competingStockSales = await Promise.all([lastStockSale(), lastStockSale()]);
    assert.deepEqual(competingStockSales.map((item) => item.response.status).sort(), [201, 409]);
    const stockAfterRace = await readPersistedDb();
    assert.equal(stockAfterRace.orders.filter((item) => item.concessionItems?.some((product) => product.id === "smoke-last-stock")).length, 1);
    assert.equal(stockAfterRace.concessions.find((item) => item.id === "smoke-last-stock").stock, 0);

    if (postgresMode) {
      const productId = "smoke-cross-channel-stock";
      const onlineId = "smoke-online-failure-cross-channel-stock";
      const checkoutSale = request("/api/payments/pix", {
        method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify({ order: {
          id: onlineId, idempotencyKey: onlineId, movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID,
          fullTicketsCount: 1, halfTicketsCount: 0, concessionItems: [{ id: productId, quantity: 1 }]
        } })
      });
      const counterSale = request("/api/admin/concession-counter-sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify({
          saleMode: "concession_counter", paymentMethod: "cash", concessionItems: [{ id: productId, quantity: 1 }]
        })
      });
      const [checkoutResult, counterResult] = await Promise.all([checkoutSale, counterSale]);
      assert.deepEqual([checkoutResult.response.status, counterResult.response.status].sort(), [201, 409],
        "Somente um canal pode consumir a última unidade");
      const raceDb = await readPersistedDb();
      const winner = raceDb.orders.filter((order) => order.concessionItems?.some((item) => item.id === productId));
      const product = raceDb.concessions.find((item) => item.id === productId);
      assert.equal(winner.length, 1);
      assert.equal(product.stock, 0);
      assert.equal(Number(product.reserved || 0) + Number(product.sold || 0), 1);
      if (checkoutResult.response.status === 201) {
        assert.equal(raceDb.payments.find((payment) => payment.orderId === onlineId).status, "pending");
        assert.equal(raceDb.tickets.filter((ticket) => ticket.orderId === onlineId).length, 0);
      } else {
        assert.equal(raceDb.orders.some((order) => order.id === onlineId), false);
      }
    }

    if (postgresMode) {
      const pg = require("pg");
      const originalQuery = pg.Client.prototype.query;
      function failCommitForRecord(recordId, errorCode, occurrence = 1, matchWrite = null) {
        const touchedClients = new WeakSet();
        let tripped = false;
        let matchingCommits = 0;
        pg.Client.prototype.query = function (statement, ...args) {
          if (matchWrite
            ? matchWrite(statement, args)
            : args.some((arg) => String(JSON.stringify(arg) || "").includes(recordId))) touchedClients.add(this);
          if (!tripped && statement === "COMMIT" && touchedClients.has(this)) {
            touchedClients.delete(this);
            matchingCommits += 1;
            if (matchingCommits === occurrence) {
              tripped = true;
              return Promise.reject(new Error(errorCode));
            }
          }
          return originalQuery.call(this, statement, ...args);
        };
        return () => tripped;
      }
      const matchingPaymentWrite = (paymentId, predicate) => (statement, args) =>
        statement.startsWith("INSERT INTO payments") && args.some((values) =>
          Array.isArray(values) && values.some((value) => value?.id === paymentId && predicate(value)));
      const matchingOrderWrite = (orderId, predicate) => (statement, args) =>
        statement.startsWith("INSERT INTO orders") && args.some((values) =>
          Array.isArray(values) && values.some((value) => value?.id === orderId && predicate(value)));
      await runOnlinePaymentFailureScenarios({
        probe: onlinePaymentProbe, request, jsonHeaders, cookie, readDb: readPersistedDb,
        queryPostgres: require("../backend/db/postgresStore").queryPostgres,
        failCommitForRecord, restoreQuery: () => { pg.Client.prototype.query = originalQuery; },
        movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID
      });
      const localPrintSale = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ ...pointSaleBody("smoke-local-print-commit"), paymentMethod: "courtesy" })
      });
      assert.equal(localPrintSale.response.status, 201, JSON.stringify(localPrintSale.payload));
      const localPrintOrderId = localPrintSale.payload.order.id;
      const localPrintPaymentId = localPrintSale.payload.payment.id;
      const localPrintPath = `/api/box-office/point-payments/${encodeURIComponent(localPrintPaymentId)}/print-result`;
      const confirmLocalPrint = (body) => request(localPrintPath, {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(body)
      });
      const printBody = { ok: true, jobId: localPrintSale.payload.order.pointPrint.jobId };
      assert.equal((await request(localPrintPath, {
        method: "POST", headers: jsonHeaders(), body: JSON.stringify(printBody)
      })).response.status, 401);
      assert.equal((await request(localPrintPath, {
        method: "POST", headers: { ...jsonHeaders(adminCookie), Origin: "https://invalid.example" },
        body: JSON.stringify(printBody)
      })).response.status, 403);
      const staleLocalPrint = await confirmLocalPrint({ ok: true, jobId: "old-job" });
      assert.equal(staleLocalPrint.response.status, 409);
      assert.equal(staleLocalPrint.payload.error.code, "PRINT_JOB_STALE");
      assert.equal((await readPersistedDb()).tickets.filter((ticket) => ticket.orderId === localPrintOrderId).length, 0);
      const localPrintCommitFailed = failCommitForRecord(localPrintOrderId, "smoke_local_print_commit_failure", 1,
        matchingOrderWrite(localPrintOrderId, (order) => order.status === "paid"));
      let failedLocalPrint;
      try { failedLocalPrint = await confirmLocalPrint(printBody); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(localPrintCommitFailed(), true);
      assert.equal(failedLocalPrint.response.status >= 500, true);
      assert.equal((await readPersistedDb()).orders.find((order) => order.id === localPrintOrderId).status, "paid_pending_print");
      assert.equal((await readPersistedDb()).tickets.filter((ticket) => ticket.orderId === localPrintOrderId).length, 0);
      const localPrintRecovered = await confirmLocalPrint(printBody);
      assert.equal(localPrintRecovered.response.status, 200, JSON.stringify(localPrintRecovered.payload));
      assert.equal(localPrintRecovered.payload.completed, true);
      assert.equal((await readPersistedDb()).tickets.filter((ticket) => ticket.orderId === localPrintOrderId).length, 1);
      assert.equal((await confirmLocalPrint(printBody)).response.status, 200);
      assert.equal((await readPersistedDb()).tickets.filter((ticket) => ticket.orderId === localPrintOrderId).length, 1);

      const rejectedPrintSale = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie),
        body: JSON.stringify({ ...pointSaleBody("smoke-local-print-failed"), paymentMethod: "courtesy" })
      });
      assert.equal(rejectedPrintSale.response.status, 201);
      const failedPrintResponse = await request(
        `/api/box-office/point-payments/${encodeURIComponent(rejectedPrintSale.payload.payment.id)}/print-result`, {
          method: "POST", headers: jsonHeaders(adminCookie),
          body: JSON.stringify({ ok: false, jobId: rejectedPrintSale.payload.order.pointPrint.jobId, message: "Impressora simulada indisponível" })
        }
      );
      assert.equal(failedPrintResponse.response.status, 200);
      assert.equal(failedPrintResponse.payload.completed, false);
      assert.equal((await readPersistedDb()).orders.find((order) => order.id === rejectedPrintSale.payload.order.id).status, "paid_pending_print");
      assert.equal((await readPersistedDb()).tickets.filter((ticket) => ticket.orderId === rejectedPrintSale.payload.order.id).length, 0);
      const pointSyncFailure = await createPointSale("smoke-point-sync-commit-failure");
      const syncProviderOrder = mockPointOrders.get(pointSyncFailure.payload.payment.providerPaymentId);
      syncProviderOrder.status = "approved";
      syncProviderOrder.providerStatus = "processed";
      const syncPath = `/api/box-office/point-payments/${encodeURIComponent(pointSyncFailure.payload.payment.id)}`;
      const syncCommitFailed = failCommitForRecord(pointSyncFailure.payload.payment.id, "smoke_point_sync_commit_failure");
      let failedSync;
      try {
        failedSync = await request(syncPath, { headers: jsonHeaders(adminCookie) });
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(syncCommitFailed(), true, "O failpoint deve atingir o commit da sincronizacao Point");
      assert.equal(failedSync.response.status >= 500, true, "Falha de commit nao pode responder Point confirmado");
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointSyncFailure.payload.payment.id).status, "pending");
      assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === pointSyncFailure.payload.order.id).length, 0);
      const printCountAfterFailedSync = mockPointPrints.size;
      const recoveredSync = await request(syncPath, { headers: jsonHeaders(adminCookie) });
      assert.equal(recoveredSync.response.status, 200);
      assert.equal(recoveredSync.payload.completed, true);
      assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === pointSyncFailure.payload.order.id).length, 1);
      assert.equal(mockPointPrints.size, printCountAfterFailedSync, "A retomada deve reutilizar a mesma impressao Point");

      const printResolvePath = `/api/box-office/point-payments/${encodeURIComponent(pointPrintFailure.payload.payment.id)}/resolve-print-failure`;
      const requestPrintResolve = (cookie = adminCookie) => request(printResolvePath, {
        method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify({ reason: "Smoke print failure" })
      });
      assert.equal((await requestPrintResolve(operatorCookie)).response.status, 403);
      const printPrepareFail = failCommitForRecord(pointPrintFailure.payload.payment.id, "smoke_print_refund_prepare_commit_failure");
      let failedPrintPrepare;
      try { failedPrintPrepare = await requestPrintResolve(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(printPrepareFail(), true);
      assert.equal(failedPrintPrepare.response.status >= 500, true);
      assert.equal(mockPointRefunds.size, 0, "O estorno Point nao deve sair antes da intencao confirmada");
      const printFinalFail = failCommitForRecord(pointPrintFailure.payload.payment.id, "smoke_print_refund_final_commit_failure", 1,
        matchingPaymentWrite(pointPrintFailure.payload.payment.id, (payment) => payment.metadata?.printResolution?.status === "completed"));
      let failedPrintFinal;
      try { failedPrintFinal = await requestPrintResolve(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(printFinalFail(), true);
      assert.equal(failedPrintFinal.response.status >= 500, true);
      const printPending = (await readPersistedDb()).payments.find((item) => item.id === pointPrintFailure.payload.payment.id);
      assert.equal(printPending.metadata.printResolution.status, "pending");
      assert.equal(printPending.status, "approved");
      assert.equal(mockPointRefunds.size, 1);
      assert.equal((await readPersistedDb()).tickets.filter((item) => item.orderId === pointPrintFailure.payload.order.id).length, 0);
      const printRecovered = await requestPrintResolve();
      assert.equal(printRecovered.response.status, 200);
      assert.equal(printRecovered.payload.payment.status, "refunded");
      assert.equal(mockPointRefunds.size, 1);
      assert.equal((await readPersistedDb()).orders.find((item) => item.id === pointPrintFailure.payload.order.id).status, "refunded");

      const refundablePoint = await createPointSale("smoke-point-ticket-refund");
      const refundableProviderOrder = mockPointOrders.get(refundablePoint.payload.payment.providerPaymentId);
      refundableProviderOrder.status = "approved";
      refundableProviderOrder.providerStatus = "processed";
      const refundablePath = `/api/box-office/point-payments/${encodeURIComponent(refundablePoint.payload.payment.id)}`;
      assert.equal((await request(refundablePath, { headers: jsonHeaders(adminCookie) })).payload.completed, true);
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE payments SET provider_payment_id=$1, metadata=jsonb_set(metadata, '{metadata,providerEnvironment}', to_jsonb($2::text), true) WHERE id=$3",
        ["ORDSMOKEREFUND1", "sandbox", refundablePoint.payload.payment.id]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === refundablePoint.payload.payment.id).metadata.providerEnvironment, "sandbox");
      const ticketRefundPath = `/api/orders/${encodeURIComponent(refundablePoint.payload.order.id)}/refund-tickets`;
      const requestTicketRefund = () => request(ticketRefundPath, {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify({ reason: "Smoke refund" })
      });
      assert.equal((await request(ticketRefundPath, { method: "POST", headers: jsonHeaders(), body: "{}" })).response.status, 401);
      assert.equal((await request(ticketRefundPath, { method: "POST", headers: jsonHeaders(operatorCookie), body: "{}" })).response.status, 403);
      const refundPreparationFailed = failCommitForRecord(refundablePoint.payload.order.id, "smoke_refund_prepare_commit_failure");
      let failedPreparation;
      try {
        failedPreparation = await requestTicketRefund();
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(refundPreparationFailed(), true);
      assert.equal(failedPreparation.response.status >= 500, true, "Falha ao preparar estorno nao pode confirmar a venda estornada");
      assert.equal((await readPersistedDb()).orders.find((item) => item.id === refundablePoint.payload.order.id).ticketRefund?.status || "", "");
      assert.equal((await readPersistedDb()).tickets.find((item) => item.orderId === refundablePoint.payload.order.id).status, "active");

      const refundConfirmationFailed = failCommitForRecord(refundablePoint.payload.order.id, "smoke_refund_confirm_commit_failure", 1,
        matchingOrderWrite(refundablePoint.payload.order.id, (order) => order.ticketRefund?.status === "completed"));
      let failedConfirmation;
      try {
        failedConfirmation = await requestTicketRefund();
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(refundConfirmationFailed(), true);
      assert.equal(failedConfirmation.response.status >= 500, true, "Falha de commit final nao pode responder reembolso concluido");
      const pendingRefundSnapshot = await readPersistedDb();
      const pendingRefund = pendingRefundSnapshot.orders.find((item) => item.id === refundablePoint.payload.order.id).ticketRefund;
      assert.equal(pendingRefund.status, "pending");
      assert.equal(pendingRefundSnapshot.tickets.find((item) => item.orderId === refundablePoint.payload.order.id).status, "active");
      const recoveredRefund = await requestTicketRefund();
      assert.equal(recoveredRefund.response.status, 200);
      assert.equal(recoveredRefund.payload.refund.id, pendingRefund.id, "A retomada deve usar a chave duravel do estorno");
      const completedRefundSnapshot = await readPersistedDb();
      assert.equal(completedRefundSnapshot.tickets.find((item) => item.orderId === refundablePoint.payload.order.id).status, "refunded");
      const refundedAmount = completedRefundSnapshot.payments.find((item) => item.id === refundablePoint.payload.payment.id).refundedAmount;
      assert.equal((await requestTicketRefund()).response.status, 200);
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === refundablePoint.payload.payment.id).refundedAmount, refundedAmount);

      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE concession_inventory SET available=10 WHERE concession_id=$1", ["combo-classico"]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const combinedBody = {
        ...pointSaleBody("smoke-point-combined-refund"),
        saleMode: "registered", customerUserId: registered.user.id,
        concessionItems: [{ id: "combo-classico", quantity: 1 }]
      };
      const combinedSale = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(combinedBody)
      });
      assert.equal(combinedSale.response.status, 202, JSON.stringify(combinedSale.payload));
      const combinedProviderOrder = mockPointOrders.get(combinedSale.payload.payment.providerPaymentId);
      combinedProviderOrder.status = "approved";
      combinedProviderOrder.providerStatus = "processed";
      const combinedPointPath = `/api/box-office/point-payments/${encodeURIComponent(combinedSale.payload.payment.id)}`;
      assert.equal((await request(combinedPointPath, { headers: jsonHeaders(adminCookie) })).payload.completed, true);
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE payments SET provider_payment_id=$1, metadata=jsonb_set(jsonb_set(metadata, '{metadata,providerEnvironment}', to_jsonb($2::text), true), '{metadata,transactionId}', to_jsonb($3::text), true) WHERE id=$4",
        ["ORDSMOKECONCESSION1", "sandbox", "TRXSMOKECONCESSION1", combinedSale.payload.payment.id]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const combinedOrderId = combinedSale.payload.order.id;
      const combinedTicketId = (await readPersistedDb()).tickets.find((item) => item.orderId === combinedOrderId)?.id;
      assert.ok(combinedTicketId);
      const combinedStockBefore = (await readPersistedDb()).concessions.find((item) => item.id === "combo-classico").stock;
      const concessionRefundPath = `/api/orders/${encodeURIComponent(combinedOrderId)}/refund-concessions`;
      const requestConcessionRefund = (cookie = adminCookie) => request(concessionRefundPath, {
        method: "POST", headers: jsonHeaders(cookie), body: JSON.stringify({ reason: "Smoke partial refund" })
      });
      assert.equal((await requestConcessionRefund("")).response.status, 401);
      assert.equal((await requestConcessionRefund(operatorCookie)).response.status, 403);
      const concessionPrepareFail = failCommitForRecord(combinedOrderId, "smoke_concession_prepare_commit_failure");
      let failedConcessionPrepare;
      try { failedConcessionPrepare = await requestConcessionRefund(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(concessionPrepareFail(), true);
      assert.equal(failedConcessionPrepare.response.status >= 500, true);
      assert.equal((await readPersistedDb()).orders.find((item) => item.id === combinedOrderId).concessionRefund?.status || "", "");
      assert.equal((await readPersistedDb()).concessions.find((item) => item.id === "combo-classico").stock, combinedStockBefore);
      const concessionFinalFail = failCommitForRecord(combinedOrderId, "smoke_concession_final_commit_failure", 1,
        matchingOrderWrite(combinedOrderId, (order) => order.concessionRefund?.status === "completed"));
      let failedConcessionFinal;
      try { failedConcessionFinal = await requestConcessionRefund(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(concessionFinalFail(), true);
      assert.equal(failedConcessionFinal.response.status >= 500, true);
      const combinedPendingSnapshot = await readPersistedDb();
      const pendingConcessionRefund = combinedPendingSnapshot.orders.find((item) => item.id === combinedOrderId).concessionRefund;
      assert.equal(pendingConcessionRefund.status, "pending");
      assert.equal(combinedPendingSnapshot.concessions.find((item) => item.id === "combo-classico").stock, combinedStockBefore);
      assert.equal(combinedPendingSnapshot.tickets.find((item) => item.id === combinedTicketId).status, "active");
      const completedConcession = await requestConcessionRefund();
      assert.equal(completedConcession.response.status, 200, JSON.stringify(completedConcession.payload));
      assert.equal(completedConcession.payload.refund.id, pendingConcessionRefund.id);
      const combinedCompletedSnapshot = await readPersistedDb();
      assert.equal(combinedCompletedSnapshot.concessions.find((item) => item.id === "combo-classico").stock, combinedStockBefore + 1);
      assert.equal(combinedCompletedSnapshot.tickets.find((item) => item.id === combinedTicketId).status, "active");
      assert.equal(combinedCompletedSnapshot.orders.find((item) => item.id === combinedOrderId).status, "paid");
      const combinedRefundedAmount = combinedCompletedSnapshot.payments.find((item) => item.id === combinedSale.payload.payment.id).refundedAmount;
      assert.equal((await requestConcessionRefund()).response.status, 200);
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === combinedSale.payload.payment.id).refundedAmount, combinedRefundedAmount);
      assert.equal((await readPersistedDb()).concessions.find((item) => item.id === "combo-classico").stock, combinedStockBefore + 1);

      const fullRefundSale = await createPointSale("smoke-point-full-refund");
      const fullRefundProviderOrder = mockPointOrders.get(fullRefundSale.payload.payment.providerPaymentId);
      fullRefundProviderOrder.status = "approved";
      fullRefundProviderOrder.providerStatus = "processed";
      assert.equal((await request(`/api/box-office/point-payments/${encodeURIComponent(fullRefundSale.payload.payment.id)}`, { headers: jsonHeaders(adminCookie) })).payload.completed, true);
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE payments SET provider_payment_id=$1, metadata=jsonb_set(metadata, '{metadata,providerEnvironment}', to_jsonb($2::text), true) WHERE id=$3",
        ["ORDSMOKEFULLREFUND1", "sandbox", fullRefundSale.payload.payment.id]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const fullRefundOrderId = fullRefundSale.payload.order.id;
      const requestFullRefund = (cookie = adminCookie) => request(`/api/orders/${encodeURIComponent(fullRefundOrderId)}`, {
        method: "PATCH", headers: jsonHeaders(cookie), body: JSON.stringify({ action: "cancel", reason: "Smoke full refund" })
      });
      assert.equal((await requestFullRefund(operatorCookie)).response.status, 403);
      const fullPrepareFail = failCommitForRecord(fullRefundOrderId, "smoke_full_refund_prepare_commit_failure");
      let failedFullPrepare;
      try { failedFullPrepare = await requestFullRefund(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(fullPrepareFail(), true);
      assert.equal(failedFullPrepare.response.status >= 500, true);
      assert.equal((await readPersistedDb()).orders.find((item) => item.id === fullRefundOrderId).refundStatus || "", "");
      assert.equal((await readPersistedDb()).tickets.find((item) => item.orderId === fullRefundOrderId).status, "active");
      const fullFinalFail = failCommitForRecord(fullRefundOrderId, "smoke_full_refund_final_commit_failure", 1,
        matchingOrderWrite(fullRefundOrderId, (order) => order.refundStatus === "completed"));
      let failedFullFinal;
      try { failedFullFinal = await requestFullRefund(); }
      finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(fullFinalFail(), true);
      assert.equal(failedFullFinal.response.status >= 500, true);
      const pendingFullSnapshot = await readPersistedDb();
      const pendingFullOrder = pendingFullSnapshot.orders.find((item) => item.id === fullRefundOrderId);
      const fullRefundId = pendingFullSnapshot.payments.find((item) => item.id === fullRefundSale.payload.payment.id).metadata.cancellationRefund.id;
      assert.equal(pendingFullOrder.status, "paid");
      assert.equal(pendingFullOrder.refundStatus, "pending");
      assert.equal(pendingFullSnapshot.tickets.find((item) => item.orderId === fullRefundOrderId).status, "active");
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE orders SET metadata=jsonb_set(metadata, '{sessionDate}', to_jsonb($1::text), true) WHERE id=$2",
        ["2020-01-01", fullRefundOrderId]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const completedFull = await requestFullRefund();
      assert.equal(completedFull.response.status, 200, JSON.stringify(completedFull.payload));
      assert.equal(completedFull.payload.refund.id, fullRefundId);
      assert.equal((await readPersistedDb()).tickets.find((item) => item.orderId === fullRefundOrderId).status, "refunded");
      assert.equal((await requestFullRefund()).response.status, 200);

      const counterFailureBody = {
        movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, fullTicketsCount: 1, halfTicketsCount: 0,
        saleMode: "registered", customerUserId: registered.user.id, paymentMethod: "external_pix",
        clientRequestId: "smoke-counter-commit-failure"
      };
      const counterCommitFailed = failCommitForRecord("pedido-bilheteria-smoke-counter-commit-failure-0", "smoke_counter_commit_failure");
      let failedCounterSale;
      try {
        failedCounterSale = await request("/api/box-office/sales", {
          method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(counterFailureBody)
        });
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(counterCommitFailed(), true, "O failpoint deve atingir o commit da bilheteria");
      assert.equal(failedCounterSale.response.status >= 500, true, "Falha de commit nao pode responder venda confirmada");
      assert.equal((await readPersistedDb()).orders.some((item) => item.id === "pedido-bilheteria-smoke-counter-commit-failure-0"), false);
      const recoveredCounterSale = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(counterFailureBody)
      });
      assert.equal(recoveredCounterSale.response.status, 201);
      assert.equal((await readPersistedDb()).orders.some((item) => item.id === recoveredCounterSale.payload.order.id), true);

      const saleCommitFailed = failCommitForRecord("pedido-bilheteria-smoke-point-sale-failure-0", "smoke_point_sale_commit_failure");
      const pointOrdersBeforePreparation = mockPointOrders.size;
      let failedSale;
      try {
        failedSale = await request("/api/box-office/sales", {
          method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody("smoke-point-sale-failure"))
        });
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(saleCommitFailed(), true, "O failpoint deve atingir o commit da venda");
      assert.equal(failedSale.response.status >= 500, true, "Falha de commit nao pode responder venda concluida");
      assert.equal((await readPersistedDb()).orders.some((item) => item.id === "pedido-bilheteria-smoke-point-sale-failure-0"), false);
      assert.equal(mockPointOrders.size, pointOrdersBeforePreparation, "Falha do commit da intencao nao pode chamar o provedor");
      const recoveredSale = await createPointSale("smoke-point-sale-failure");
      assert.equal(mockPointOrders.has(recoveredSale.payload.payment.providerPaymentId), true);

      const crashKey = "smoke-point-crash-before-send";
      const crashPaymentId = `pagamento-point-${crashKey}`;
      const crashBeforeSend = failCommitForRecord(crashPaymentId, "smoke_point_crash_before_send", 1,
        matchingPaymentWrite(crashPaymentId, (payment) => payment.metadata?.pointCreateState === "sending" && !payment.metadata?.providerRequestSentAt));
      let crashedSale;
      const pointOrdersBeforeCrash = mockPointOrders.size;
      try {
        crashedSale = await request("/api/box-office/sales", {
          method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(crashKey))
        });
      } finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(crashBeforeSend(), true);
      assert.equal(crashedSale.response.status, 202, "A intencao duravel pode retornar pendencia quando a reivindicacao falha");
      assert.equal(mockPointOrders.size, pointOrdersBeforeCrash, "Interrupcao apos preparacao nao criou cobranca");
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === crashPaymentId).metadata.pointCreateState, "prepared");
      const recoveredCrash = await Promise.all(Array.from({ length: 2 }, () =>
        request(`/api/box-office/point-payments/${crashPaymentId}`, { headers: jsonHeaders(adminCookie) })));
      assert.deepEqual(recoveredCrash.map((result) => result.response.status), [200, 200]);
      assert.equal(mockPointOrders.size, pointOrdersBeforeCrash + 1);

      const crossKey = "smoke-point-cross-instance";
      const crossPaymentId = `pagamento-point-${crossKey}`;
      const crossPrepareFail = failCommitForRecord(crossPaymentId, "smoke_point_cross_before_send", 1,
        matchingPaymentWrite(crossPaymentId, (payment) => payment.metadata?.pointCreateState === "sending" && !payment.metadata?.providerRequestSentAt));
      let crossPrepared;
      try {
        crossPrepared = await request("/api/box-office/sales", {
          method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(crossKey))
        });
      } finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(crossPrepareFail(), true);
      assert.equal(crossPrepared.response.status, 202);
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === crossPaymentId).metadata.pointCreateState, "prepared");
      const crossCallsFile = path.join(testRoot, "point-cross-instance-calls.txt");
      fs.writeFileSync(crossCallsFile, "");
      const secondPort = 4201;
      const second = spawn(process.execPath, [path.join(__dirname, "point-smoke-second-instance.js")], {
        env: { ...process.env, PORT: String(secondPort), CINE_POINT_CROSS_CALL_FILE: crossCallsFile },
        stdio: ["ignore", "pipe", "pipe"]
      });
      let secondOutput = "";
      second.stdout.on("data", (chunk) => { secondOutput = (secondOutput + chunk).slice(-2000); });
      second.stderr.on("data", (chunk) => { secondOutput = (secondOutput + chunk).slice(-2000); });
      try {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
          if (second.exitCode !== null || second.signalCode !== null) break;
          try { ready = (await fetch(`http://127.0.0.1:${secondPort}/api/content`)).ok; }
          catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
        }
        assert.equal(ready, true, `Segunda instancia nao iniciou: ${secondOutput}`);
        const secondLogin = await fetch(`http://127.0.0.1:${secondPort}/api/admin/login`, {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
        });
        assert.equal(secondLogin.status, 200, `Login da segunda instancia: ${secondOutput}`);
        const secondCookie = (secondLogin.headers.get("set-cookie") || "").split(";")[0];
        const beforeCross = mockPointOrders.size;
        const crossResults = await Promise.all([
          request(`/api/box-office/point-payments/${crossPaymentId}`, { headers: jsonHeaders(adminCookie) }),
          fetch(`http://127.0.0.1:${secondPort}/api/box-office/point-payments/${crossPaymentId}`, {
            headers: jsonHeaders(secondCookie)
          })
        ]);
        assert.deepEqual(crossResults.map((item) => item.response?.status || item.status), [200, 200]);
        const secondCalls = fs.readFileSync(crossCallsFile, "utf8").trim().split("\n").filter(Boolean);
        assert.equal(mockPointOrders.size - beforeCross + secondCalls.length, 1, "Duas instancias nao podem criar duas Orders para a mesma intencao");
        assert.ok((await readPersistedDb()).payments.find((item) => item.id === crossPaymentId).providerPaymentId);
      } finally {
        second.kill("SIGTERM");
        if (second.exitCode === null && second.signalCode === null) await Promise.race([
          new Promise((resolve) => second.once("exit", resolve)),
          new Promise((resolve) => setTimeout(resolve, 5000))
        ]);
        if (second.exitCode === null && second.signalCode === null) second.kill("SIGKILL");
      }

      const finalKey = "smoke-point-final-commit-failure";
      const finalPaymentId = `pagamento-point-${finalKey}`;
      const finalCommitFailed = failCommitForRecord(finalPaymentId, "smoke_point_final_commit_failure", 1,
        matchingPaymentWrite(finalPaymentId, (payment) => Boolean(payment.providerPaymentId)));
      let failedFinal;
      try {
        failedFinal = await request("/api/box-office/sales", {
          method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(finalKey))
        });
      } finally { pg.Client.prototype.query = originalQuery; }
      assert.equal(finalCommitFailed(), true);
      assert.equal(failedFinal.response.status >= 500, true);
      const durableIntent = (await readPersistedDb()).payments.find((item) => item.id === finalPaymentId);
      assert.equal(durableIntent.metadata.pointCreateState, "sending");
      assert.equal(Boolean(durableIntent.metadata.providerRequestSentAt), true);
      assert.equal(durableIntent.providerPaymentId || "", "");
      const providerOrderCount = mockPointOrders.size;
      const repeatedFinal = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(finalKey))
      });
      assert.equal(repeatedFinal.response.status, 200);
      assert.equal(mockPointOrders.size, providerOrderCount);
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE payments SET metadata=jsonb_set(metadata, '{metadata,pointCreateLeaseUntil}', to_jsonb($1::text), true) WHERE id=$2",
        ["2000-01-01T00:00:00.000Z", finalPaymentId]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const recoveredFinal = await request(`/api/box-office/point-payments/${finalPaymentId}`, { headers: jsonHeaders(adminCookie) });
      assert.equal(recoveredFinal.response.status, 200);
      assert.equal(recoveredFinal.payload.payment.providerPaymentId.startsWith("ORD-SMOKE-"), true);
      assert.equal(mockPointOrders.size, providerOrderCount, "A chave original deve recuperar a mesma cobranca");

      pointCreateLosesResponse = true;
      const timeoutKey = "smoke-point-response-lost";
      const timeoutSale = await request("/api/box-office/sales", {
        method: "POST", headers: jsonHeaders(adminCookie), body: JSON.stringify(pointSaleBody(timeoutKey))
      });
      assert.equal(timeoutSale.response.status, 202);
      assert.equal(timeoutSale.payload.payment.metadata.pointCreateState, "unknown");
      const countAfterTimeout = mockPointOrders.size;
      await require("../backend/db/postgresStore").queryPostgres(
        "UPDATE payments SET metadata=jsonb_set(metadata, '{metadata,pointCreateLeaseUntil}', to_jsonb($1::text), true) WHERE id=$2",
        ["2000-01-01T00:00:00.000Z", timeoutSale.payload.payment.id]
      );
      require("../backend/db/postgresStore").invalidatePostgresSnapshot();
      const resumedTimeout = await request(`/api/box-office/point-payments/${timeoutSale.payload.payment.id}`, { headers: jsonHeaders(adminCookie) });
      assert.equal(resumedTimeout.response.status, 200);
      assert.equal(mockPointOrders.size, countAfterTimeout);

      const pointCommitFailure = await createPointSale("smoke-point-commit-failure");
      const pointCommitFailed = failCommitForRecord(pointCommitFailure.payload.payment.id, "smoke_point_commit_failure");
      let failedCommit;
      try {
        failedCommit = await cancelPoint(pointCommitFailure.payload.payment.id);
      } finally {
        pg.Client.prototype.query = originalQuery;
      }
      assert.equal(pointCommitFailed(), true, "O failpoint deve atingir o commit do cancelamento");
      assert.equal(failedCommit.response.status >= 500, true, "Falha de commit nao pode responder sucesso");
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointCommitFailure.payload.payment.id).status, "pending");
      const recoveredCancel = await cancelPoint(pointCommitFailure.payload.payment.id);
      assert.equal(recoveredCancel.response.status, 200);
      assert.equal((await readPersistedDb()).payments.find((item) => item.id === pointCommitFailure.payload.payment.id).status, "cancelled");

      await runMercadoPagoWebhookFailureScenarios({
        request, jsonHeaders, cookie, movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID,
        readDb: readPersistedDb, queryPostgres: require("../backend/db/postgresStore").queryPostgres,
        secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET, failCommitForRecord,
        restoreQuery: () => { pg.Client.prototype.query = originalQuery; }
      });
      await runPagBankWebhookCommitScenario({
        request, jsonHeaders, cookie, movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID,
        readDb: readPersistedDb, writeDb: writePersistedDb,
        queryPostgres: require("../backend/db/postgresStore").queryPostgres,
        failCommitForRecord, restoreQuery: () => { pg.Client.prototype.query = originalQuery; },
        pagBank: require("../backend/services/pagBankPaymentService")
      });
      await runPagBankCheckoutFailureScenarios({
        request, jsonHeaders,
        createCustomerCookie: async (label) => (await registerCustomer(`pagbank-${label}@example.invalid`)).cookie,
        movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID,
        readDb: readPersistedDb, writeDb: writePersistedDb,
        queryPostgres: require("../backend/db/postgresStore").queryPostgres,
        failCommitForRecord, restoreQuery: () => { pg.Client.prototype.query = originalQuery; },
        pagBank: require("../backend/services/pagBankPaymentService")
      });
    }

    const requiredPolicy = await request("/api/admin/security-policy", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ adminTwoFactorRequired: true })
    });
    assert.equal(requiredPolicy.response.status, 200);
    assert.equal(requiredPolicy.payload.adminTwoFactorRequired, true);
    const setupRequiredLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "operador-smoke@cine.local", password: "operador-smoke-123" })
    });
    assert.equal(setupRequiredLogin.response.status, 200);
    assert.equal(setupRequiredLogin.payload.user.twoFactorSetupRequired, true);
    const setupRequiredCookie = (setupRequiredLogin.response.headers.get("set-cookie") || "").split(";")[0] || "";
    const blockedBeforeSetup = await request("/api/admin/content", { headers: jsonHeaders(setupRequiredCookie) });
    assert.equal(blockedBeforeSetup.response.status, 428);
    assert.equal(blockedBeforeSetup.payload.error.code, "ADMIN_2FA_SETUP_REQUIRED");
    const setupStatusAllowed = await request("/api/admin/2fa/status", { headers: jsonHeaders(setupRequiredCookie) });
    assert.equal(setupStatusAllowed.response.status, 200);
    assert.equal(setupStatusAllowed.payload.requiredByPolicy, true);

    const logout = await request("/api/auth/logout", {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    assert.equal(logout.response.status, 200);
    const revokedCustomerSession = await request("/api/auth/me", { headers: jsonHeaders(cookie) });
    assert.equal(revokedCustomerSession.response.status, 401);

    const adminLogout = await request("/api/admin/logout", {
      method: "POST",
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(adminLogout.response.status, 204);
    const revokedAdminSession = await request("/api/admin/me", { headers: jsonHeaders(adminCookie) });
    assert.equal(revokedAdminSession.response.status, 401);

    console.log("Smoke tests passed.");
  } finally {
    onlinePaymentProbe.restore();
    await new Promise((resolve) => emailWebhookServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => setTimeout(resolve, 1800));
    if (postgresMode) await require("../backend/db/postgresStore").closePostgres();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});
