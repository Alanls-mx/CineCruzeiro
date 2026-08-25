const fs = require("fs");
const assert = require("assert/strict");
const crypto = require("crypto");

const DATA_FILE = "backend/data/db.json";
const PORT = 4199;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_MOVIE_ID = "smoke-programacao";
const TEST_SESSION_ID = "smoke-programacao-1";

process.env.PORT = String(PORT);
process.env.DATA_STORE = "json";
process.env.PAYMENTS_MODE = "test";
process.env.TEST_PAYMENTS_AUTO_APPROVE = "false";
process.env.ADMIN_EMAIL = "admin@cinecruzeiro.local";
process.env.ADMIN_PASSWORD = "admin-smoke-123456";
process.env.MERCADO_PAGO_WEBHOOK_SECRET = "smoke-mercado-pago-webhook-secret";
process.env.WEBHOOK_TESTER_ENABLED = "true";

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

async function registerCustomer(email, password = "123456") {
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
  return { cookie, token: result.payload.token, user: result.payload.user };
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
  db.movies = (db.movies || []).filter((movie) => ![TEST_MOVIE_ID, "smoke-filme-edicao", "smoke-rascunho-admin"].includes(movie.id));
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
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      }
    ]
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

  try {
    await new Promise((resolve) => setTimeout(resolve, 700));

    const health = await request("/api/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.payload.status, "ok");
    assert.equal("envFilesLoaded" in health.payload, false);
    assert.equal("jwtConfigured" in health.payload, false);

    const email = `smoke-${Date.now()}@cine.local`;
    const registered = await registerCustomer(email);
    const target = await registerCustomer(`target-${Date.now()}@cine.local`);
    let cookie = registered.cookie;
    const targetCookie = target.cookie;
    const adminCookie = await loginAdmin();

    const me = await request("/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.email, email);

    const meByBearer = await request("/api/auth/me", { headers: { Authorization: `Bearer ${registered.token}` } });
    assert.equal(meByBearer.response.status, 200);
    assert.equal(meByBearer.payload.user.email, email);

    const emailChangeAddress = `verified-${Date.now()}@cine.local`;
    const emailChange = await request("/api/me/email-change/request", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ email: emailChangeAddress })
    });
    assert.equal(emailChange.response.status, 202);
    assert.ok(emailChange.payload.verificationToken);

    const emailConfirm = await request("/api/me/email-change/confirm", {
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
      body: JSON.stringify({ currentPassword: "123456", newPassword: "senha-nova-123", confirmPassword: "senha-diferente" })
    });
    assert.equal(passwordMismatch.response.status, 400);

    const passwordChanged = await request("/api/me", {
      method: "PATCH",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ currentPassword: "123456", newPassword: "senha-nova-123", confirmPassword: "senha-nova-123" })
    });
    assert.equal(passwordChanged.response.status, 200);

    const adminMe = await request("/api/admin/me", { headers: { Cookie: adminCookie } });
    assert.equal(adminMe.response.status, 200);
    assert.equal(adminMe.payload.user.role, "owner");

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

    const operatorUser = await request("/api/users", {
      method: "POST",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        id: "smoke-operador-clube",
        name: "Operador Smoke",
        email: "operador-smoke@cine.local",
        password: "operador-smoke-123",
        role: "operator",
        active: true
      })
    });
    assert.equal(operatorUser.response.status, 201);
    const operatorLogin = await request("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "operador-smoke@cine.local", password: "operador-smoke-123" })
    });
    assert.equal(operatorLogin.response.status, 200);
    const operatorCookie = operatorLogin.response.headers.get("set-cookie").split(";")[0] || "";
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
        priceFull: 10,
        priceHalf: 10,
        status: "available"
      })
    });
    assert.equal(createSession.response.status, 201);
    assert.ok(createSession.payload.id);

    const updateSession = await request(`/api/movies/smoke-rascunho-admin/sessions/${encodeURIComponent(createSession.payload.id)}`, {
      method: "PUT",
      headers: jsonHeaders(adminCookie),
      body: JSON.stringify({
        date: "2099-08-24",
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
        active: true
      })
    });
    assert.equal(oneCreditPlan.response.status, 201);
    assert.equal(oneCreditPlan.payload.includedTickets, 1);
    assert.equal(oneCreditPlan.payload.imageUrl, uploadedImage.payload.url);
    assert.equal(oneCreditPlan.payload.isFeatured, true);
    assert.equal(oneCreditPlan.payload.displayOrder, 7);

    const plansAfterMediaSave = await request("/api/subscription-plans");
    const persistedMediaPlan = plansAfterMediaSave.payload.find((plan) => plan.id === oneCreditPlan.payload.id);
    assert.equal(persistedMediaPlan.imageUrl, uploadedImage.payload.url);
    assert.equal(persistedMediaPlan.isFeatured, true);
    assert.equal(persistedMediaPlan.displayOrder, 7);

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
    assert.equal(cancelledSubscription.payload.subscription.status, "cancelled");

    const clubAfterSubscriptionCancel = await request("/api/checkout/club-credit", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ movieId: TEST_MOVIE_ID, sessionId: TEST_SESSION_ID, idempotencyKey: `club-smoke-cancelled-valid-${Date.now()}` })
    });
    assert.equal(clubAfterSubscriptionCancel.response.status, 409);

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
    assert.match(await download.text(), /Cine Cruzeiro/);

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

    const accountTicketsByBearer = await request("/api/me/tickets", { headers: { Authorization: `Bearer ${registered.token}` } });
    assert.equal(accountTicketsByBearer.response.status, 200);
    assert.equal(accountTicketsByBearer.payload.tickets.some((ticket) => ticket.orderId === boxOfficeSale.payload.order.id), false);

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
    assert.equal(card.payload.payment.metadata.paymentMethodType, "credit_card");

    console.log("Smoke tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(DATA_FILE, backup);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
