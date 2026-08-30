const fs = require("fs");
const assert = require("assert/strict");
const crypto = require("crypto");
const http = require("http");
const WebSocket = require("ws");
const adminTwoFactorService = require("../backend/services/adminTwoFactorService");

const DATA_FILE = "backend/data/db.json";
const PORT = 4199;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_MOVIE_ID = "smoke-programacao";
const TEST_SESSION_ID = "smoke-programacao-1";
const TEST_EXPIRED_SESSION_ID = "smoke-programacao-expirada";
const TEST_SECOND_MOVIE_ID = "smoke-programacao-2";
const TEST_SECOND_SESSION_ID = "smoke-programacao-2-sessao";
const TEST_SEAT_MOVIE_ID = "smoke-poltronas";
const TEST_SEAT_SESSION_ID = "smoke-poltronas-sessao";

process.env.PORT = String(PORT);
process.env.DATA_STORE = "json";
process.env.PAYMENTS_MODE = "test";
process.env.TEST_PAYMENTS_AUTO_APPROVE = "false";
process.env.ADMIN_EMAIL = "admin@cinecruzeiro.local";
process.env.ADMIN_PASSWORD = "admin-smoke-123456";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = "smoke-mercado-pago-webhook-secret";
process.env.WEBHOOK_TESTER_ENABLED = "true";
process.env.MAX_JSON_BODY_BYTES = String(64 * 1024);

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
    body: JSON.stringify({ name: "Teste Smoke", email, password, cpf: "12345678901" })
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
  const backup = fs.readFileSync(DATA_FILE);
  const db = JSON.parse(String(backup));
  db.settings = { ...(db.settings || {}), adminTwoFactorRequired: false };
  db.users = (db.users || []).map((user) =>
    user.id === "admin" || user.email === process.env.ADMIN_EMAIL
      ? { ...user, id: "admin", email: process.env.ADMIN_EMAIL, role: "owner", active: true, passwordHash: "" }
      : user
  ).filter((user) => !["smoke-operador-clube", "smoke-gerente-integracoes"].includes(user.id));
  if (!db.users.some((user) => user.id === "admin")) {
    db.users.push({ id: "admin", name: "Administrador", email: process.env.ADMIN_EMAIL, role: "owner", active: true, passwordHash: "" });
  }
  db.concessions = (db.concessions || []).map((item) =>
    item.id === "combo-classico" ? { ...item, stock: 3, reserved: 0, sold: 0 } : item
  );
  db.ticketTypes = (db.ticketTypes || []).filter((item) => item.id !== "triple-smoke");
  db.ticketTypes.push({ id: "triple-smoke", name: "Triple Ingresso", price: 25, description: "Pacote de teste", bundleQuantity: 3, active: true });
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
        date: "2099-12-31",
        time: "19:00",
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
      date: "2099-12-31",
      time: "18:00",
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
      date: "2099-12-31",
      time: "21:00",
      format: "2D Legendado",
      room: "Sala Cruzeiro (Laser 4K)",
      ticketTypeIds: ["promocional"],
      status: "available"
    }]
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

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

  const server = require("../backend/server.js");
  const deliveredEmails = [];
  const emailWebhookServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      deliveredEmails.push(JSON.parse(raw || "{}"));
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await new Promise((resolve) => emailWebhookServer.listen(4200, "127.0.0.1", resolve));

    const health = await request("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, "ok");
    assert.equal("envFilesLoaded" in health.payload, false);
    assert.equal("jwtConfigured" in health.payload, false);
    const liveness = await request("/api/health/live");
    assert.equal(liveness.response.status, 200);
    assert.equal(liveness.payload.status, "alive");
    const readiness = await request("/api/health/ready");
    assert.equal(readiness.response.status, 200);
    assert.equal(readiness.payload.status, "ready");
    let maintainedDb = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const movie = maintainedDb.movies.find((item) => item.id === TEST_MOVIE_ID);
      if (!movie?.sessions.some((session) => session.id === TEST_EXPIRED_SESSION_ID)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      maintainedDb = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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

    const email = `smoke-${Date.now()}@cine.local`;
    const registered = await registerCustomer(email);
    const target = await registerCustomer(`target-${Date.now()}@cine.local`);
    let cookie = registered.cookie;
    const targetCookie = target.cookie;
    let adminCookie = await loginAdmin();

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
          phone: "(11) 99999-9999",
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
    const savedSeatRoom = await request("/api/rooms/sala-poltronas-smoke", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify(seatRoomPayload)
    });
    assert.equal(savedSeatRoom.response.status, 200);
    assert.equal(savedSeatRoom.payload.seatLayout.rows[0].seats[0].color, "#e11d48");
    assert.equal(savedSeatRoom.payload.seatLayout.rows[0].seats[0].accessibility, "wheelchair");

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
      headers: jsonHeaders(),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-missing", []))
    });
    assert.equal(missingSeat.response.status, 422);
    assert.equal(missingSeat.payload.error.code, "SEAT_SELECTION_INCOMPLETE");

    const firstSeat = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-a1", ["a1"]))
    });
    assert.equal(firstSeat.response.status, 201);
    assert.deepEqual(firstSeat.payload.order.selectedSeats.map((seat) => seat.label), ["A1"]);

    const roomWithoutReservedSeat = structuredClone(seatRoomPayload);
    roomWithoutReservedSeat.seatLayout.rows[0].seats = roomWithoutReservedSeat.seatLayout.rows[0].seats.filter((seat) => seat.id !== "a1");
    const protectedSeatDelete = await request("/api/rooms/sala-poltronas-smoke", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify(roomWithoutReservedSeat)
    });
    assert.equal(protectedSeatDelete.response.status, 409);
    assert.equal(protectedSeatDelete.payload.error.code, "ROOM_SEATS_IN_USE");

    const occupiedSeatMap = await request(`/api/sessions/${TEST_SEAT_SESSION_ID}/seats`);
    assert.equal(occupiedSeatMap.payload.rows[0].seats[0].status, "unavailable");
    const duplicateSeat = await request("/api/payments/pix", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(seatCheckoutOrder("smoke-seat-a1-duplicate", ["a1"]))
    });
    assert.equal(duplicateSeat.response.status, 409);
    assert.equal(duplicateSeat.payload.error.code, "SEAT_UNAVAILABLE");

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

    const protectedSessionRoomChange = await request(`/api/movies/${TEST_SEAT_MOVIE_ID}/sessions/${TEST_SEAT_SESSION_ID}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-12-31",
        time: "20:00",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        ticketTypeIds: ["promocional"],
        status: "available"
      })
    });
    assert.equal(protectedSessionRoomChange.response.status, 409);
    assert.equal(protectedSessionRoomChange.payload.error.code, "SESSION_ROOM_LOCKED_BY_SEATS");

    const dashboard = await request("/api/dashboard", { headers: jsonHeaders(adminCookie) });
    assert.equal(dashboard.response.status, 200);
    assert.equal(typeof dashboard.payload.salesToday, "number");
    assert.ok(Array.isArray(dashboard.payload.latestOrders));
    const adminDashboard = await request("/api/admin/dashboard?period=7d", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminDashboard.response.status, 200);
    assert.ok(Array.isArray(adminDashboard.payload.chart));
    assert.ok(Array.isArray(adminDashboard.payload.todaySessions));
    const adminPayments = await request("/api/admin/payments?period=7d", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminPayments.response.status, 200);
    assert.ok(Array.isArray(adminPayments.payload.payments));
    assert.equal(typeof adminPayments.payload.cardTerminal.configured, "boolean");

    const integrations = await request("/api/integrations", { headers: jsonHeaders(adminCookie) });
    assert.equal(integrations.response.status, 200);
    assert.ok(integrations.payload.integrations.tmdb);

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
    assert.match(googleLoginInitial.payload.integration.secrets.clientSecret.masked, /1234$/);

    const googleLoginSecretOnly = await request("/api/admin/integrations/googleLogin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ clientSecret: "segredo-atualizado-5678", clientId: null })
    });
    assert.equal(googleLoginSecretOnly.response.status, 200);
    assert.equal(googleLoginSecretOnly.payload.integration.values.clientId, "client-id-preservado.apps.googleusercontent.com");
    assert.equal(googleLoginSecretOnly.payload.integration.values.redirectUri, "https://cine.local/conta");
    assert.match(googleLoginSecretOnly.payload.integration.secrets.clientSecret.masked, /5678$/);

    const googleLoginMaskedSecret = await request("/api/admin/integrations/googleLogin", {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ clientSecret: "••••••••5678" })
    });
    assert.equal(googleLoginMaskedSecret.response.status, 200);
    assert.match(googleLoginMaskedSecret.payload.integration.secrets.clientSecret.masked, /5678$/);

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
        data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
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
        posterUrl: "",
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
    assert.equal(draftMovie.payload.status, "hidden");
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

    const customerSearch = await request(`/api/admin/customers?query=${encodeURIComponent(emailChangeAddress)}`, {
      headers: jsonHeaders(adminCookie)
    });
    assert.equal(customerSearch.response.status, 200);
    assert.equal(customerSearch.payload.customers[0].email, emailChangeAddress);

    const plans = await request("/api/subscription-plans");
    assert.equal(plans.response.status, 200);
    assert.ok(plans.payload.length >= 1);

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

    const plansAfterMediaSave = await request("/api/subscription-plans");
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
    const plansAfterFeaturedChange = await request("/api/subscription-plans");
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

    const subscriptionsAfterApproval = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    const providerApprovedSubscription = subscriptionsAfterApproval.payload.subscriptions.find((item) => item.id === pendingSubscription.payload.subscription.id);
    assert.equal(providerApprovedSubscription.status, "active");
    assert.equal(providerApprovedSubscription.paymentStatus, "approved");
    assert.equal(providerApprovedSubscription.creditsRemaining, 1);

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
    assert.equal(clubCredit.payload.payment.method, "club_credit");
    assert.equal(clubCredit.payload.payment.status, "approved");
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

    const clubAfterRefund = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
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
    assert.equal(bundleCreditOrder.response.status, 201);
    assert.equal(bundleCreditOrder.payload.tickets.length, 3);
    assert.equal(bundleCreditOrder.payload.subscription.creditsAvailable, 0);
    const cancelledBundleCreditOrder = await request(`/api/orders/${encodeURIComponent(bundleCreditOrder.payload.order.id)}`, {
      method: "DELETE",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ reason: "Teste de estorno integral do pacote" })
    });
    assert.equal(cancelledBundleCreditOrder.response.status, 200);
    const subscriptionsAfterBundleRefund = await request("/api/me/subscriptions", { headers: jsonHeaders(cookie) });
    const refundedBundleSubscription = subscriptionsAfterBundleRefund.payload.subscriptions.find((subscription) => subscription.id === bundleSubscription.payload.subscription.id);
    assert.equal(refundedBundleSubscription.creditsRemaining, 3);
    assert.equal(refundedBundleSubscription.usage.find((usage) => usage.orderId === bundleCreditOrder.payload.order.id).creditsUsed, 3);
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
        code: allowedTicketTypeSale.payload.tickets[0].code,
        sessionId: TEST_SESSION_ID
      })
    });
    assert.equal(correctSessionValidation.response.status, 200);
    assert.equal(correctSessionValidation.payload.ticket.status, "used");

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

    const fiscalPrepared = await request("/api/admin/fiscal-documents", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({ orderId: boxOfficeSale.payload.order.id })
    });
    assert.equal(fiscalPrepared.response.status, 201);
    assert.equal(fiscalPrepared.payload.document.orderId, boxOfficeSale.payload.order.id);
    assert.ok(["pending_configuration", "ready"].includes(fiscalPrepared.payload.document.status));

    const fiscalList = await request("/api/admin/fiscal-documents?page=1&pageSize=10", { headers: jsonHeaders(adminCookie) });
    assert.equal(fiscalList.response.status, 200);
    assert.ok(fiscalList.payload.documents.some((document) => document.orderId === boxOfficeSale.payload.order.id));
    assert.ok(fiscalList.payload.summary.total >= 1);

    const fiscalReport = await fetch(`${BASE_URL}/api/admin/fiscal-reports.csv?period=30d`, { headers: { Cookie: adminCookie } });
    assert.equal(fiscalReport.status, 200);
    assert.match(fiscalReport.headers.get("content-type") || "", /text\/csv/);
    assert.match(await fiscalReport.text(), /Referência/);

    const adminLogs = await request("/api/admin/logs?page=1&pageSize=10", { headers: jsonHeaders(adminCookie) });
    assert.equal(adminLogs.response.status, 200);
    assert.ok(Array.isArray(adminLogs.payload.logs));

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
    assert.equal(contentAfterPermanentDelete.payload.orders.some((order) => order.id === deletionSale.payload.order.id), false);
    assert.equal(contentAfterPermanentDelete.payload.payments.some((payment) => payment.orderId === deletionSale.payload.order.id), false);
    assert.equal(contentAfterPermanentDelete.payload.tickets.some((ticket) => ticket.orderId === deletionSale.payload.order.id), false);
    assert.ok((contentAfterPermanentDelete.payload.auditLogs || []).some((log) => log.action === "order.permanently_deleted"));

    const accountTickets = await request("/api/me/tickets", { headers: { Cookie: cookie } });
    assert.equal(accountTickets.response.status, 200);
    assert.ok(accountTickets.payload.tickets.some((ticket) => ticket.orderId === boxOfficeSale.payload.order.id));
    assert.ok(Array.isArray(accountTickets.payload.upcoming));
    assert.ok(Array.isArray(accountTickets.payload.archived));

    const manualTicket = accountTickets.payload.tickets.find((ticket) => ticket.orderId === boxOfficeSale.payload.order.id);
    const download = await fetch(`${BASE_URL}/api/me/tickets/${encodeURIComponent(manualTicket.id)}/download`, {
      headers: { Cookie: cookie }
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-disposition") || "", /attachment/);
    const downloadedPdfBuffer = Buffer.from(await download.arrayBuffer());
    const downloadedPdf = downloadedPdfBuffer.toString("latin1");
    assert.match(downloadedPdf, /Cine Cruzeiro/);
    assert.match(downloadedPdf, /\/ImLogo Do/);
    assert.match(downloadedPdf, /31\/12\/2099 as 19:00/);
    assert.doesNotMatch(downloadedPdf, /2099-12-31 as 19:00/);

    const numberedSeatPdf = await fetch(`${BASE_URL}/api/admin/tickets/${encodeURIComponent(boxOfficeSeat.payload.tickets[0].id)}/print`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(numberedSeatPdf.status, 200);
    const numberedSeatPdfBuffer = Buffer.from(await numberedSeatPdf.arrayBuffer());
    const numberedSeatPdfText = numberedSeatPdfBuffer.toString("latin1");
    assert.match(numberedSeatPdfText, /31\/12\/2099 as 18:00/);
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

    const transfer = await request(`/api/me/tickets/${encodeURIComponent(manualTicket.id)}/transfer`, {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ email: target.user.email })
    });
    assert.equal(transfer.response.status, 200);
    assert.equal(transfer.payload.ticket.customerUserId, target.user.id);
    assert.notEqual(transfer.payload.ticket.code, manualTicket.code);

    const oldOwnerTickets = await request("/api/me/tickets", { headers: { Cookie: cookie } });
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
    assert.equal(reset.response.status, 200);
    cookie = reset.response.headers.get("set-cookie")?.split(";")[0] || cookie;

    const resetReuse = await request("/api/auth/password/reset", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: resetRequest.payload.resetToken, password: "outra-senha-123" })
    });
    assert.equal(resetReuse.response.status, 400);

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
    assert.equal(pix.response.status, 201);
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
    assert.equal(simulator.payload.run.httpStatus, 200);
    assert.equal(simulator.payload.run.passed, true);

    const webhookBatch = await request("/api/admin/integrations/mercadoPago/webhook-simulations/batch", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({})
    });
    assert.equal(webhookBatch.response.status, 200);
    assert.equal(webhookBatch.payload.total, 8);
    assert.equal(webhookBatch.payload.passed, 8);
    assert.equal(webhookBatch.payload.failed, 0);

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
    await new Promise((resolve) => emailWebhookServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(DATA_FILE, backup);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
