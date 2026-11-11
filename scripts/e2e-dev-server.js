const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");
const { sellableTomorrowSession } = require("./e2e-session-time");

const root = path.resolve(__dirname, "..");
const dataDir = fs.realpathSync(process.env.CINE_E2E_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "cinecruzeiro-e2e-")));
if (path.dirname(dataDir) !== fs.realpathSync(os.tmpdir()) || !path.basename(dataDir).startsWith("cinecruzeiro-e2e-")) {
  throw new Error("O diretório E2E deve ser descartável e estar diretamente em os.tmpdir().");
}
const dataFile = path.join(dataDir, "db.json");
const postgresE2e = process.env.CINE_E2E_POSTGRES === "1";
const adminPassword = "Admin-e2e-2026!";
const adminSalt = crypto.randomBytes(16).toString("base64url");
const adminPasswordHash = `pbkdf2_sha256$120000$${adminSalt}$${crypto.pbkdf2Sync(adminPassword, adminSalt, 120000, 32, "sha256").toString("base64url")}`;
function fixtureCustomer(id, name, email, password, now) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return {
    id, name, email, role: "customer", active: true, authProvider: "email", emailVerified: true, createdAt: now,
    passwordHash: `pbkdf2_sha256$120000$${salt}$${crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url")}`
  };
}
const processes = [];
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3000);
let shuttingDown = false;

function fixture() {
  const referenceDate = new Date();
  const now = referenceDate.toISOString();
  const { date: sessionDate, time: sessionTime } = sellableTomorrowSession(referenceDate);
  const mercadoPago = {
    enabled: true,
    environment: "sandbox",
    publicKey: "TEST-e2e-public-key-0000000000000001",
    accessToken: "TEST-e2e-access-token"
  };
  return {
    settings: {
      cinemaName: "Cine Cruzeiro E2E",
      currency: "BRL",
      defaultTicketPrice: 15,
      adminTwoFactorRequired: false,
      integrations: { mercadoPago }
    },
    integrations: { mercadoPago },
    ticketTypes: [
      { id: "inteira-e2e", name: "Ingresso Inteiro", price: 15, description: "Ingresso de teste", bundleQuantity: 1, active: true },
      { id: "meia-e2e", name: "Meia Entrada", price: 7.5, description: "Meia de teste", bundleQuantity: 1, active: true }
    ],
    rooms: [
      { id: "sala-livre-e2e", name: "Sala Livre E2E", capacity: 20, technology: "2D", status: "active", seatSelectionEnabled: false },
      {
        id: "sala-marcada-e2e",
        name: "Sala Marcada E2E",
        capacity: 4,
        technology: "2D",
        status: "active",
        seatSelectionEnabled: true,
        seatTypes: [{ id: "padrao", name: "Padrão", color: "#2563eb" }],
        seatLayout: {
          screenLabel: "TELA",
          rows: [{
            id: "A",
            label: "A",
            seats: [1, 2, 3, 4].map((number) => ({ id: `A${number}`, label: `A${number}`, typeId: "padrao", enabled: true }))
          }]
        }
      }
    ],
    movies: [
      {
        id: "filme-e2e",
        slug: "filme-e2e",
        workflowStatus: "published",
        status: "now_playing",
        title: "Filme E2E",
        synopsis: "Sessão determinística para testes completos.",
        duration: "1h 40min",
        genre: ["Teste"],
        rating: "L",
        posterUrl: "",
        backdropUrl: "",
        sessions: [{
          id: "sessao-e2e",
          date: sessionDate,
          time: sessionTime,
          format: "2D Dublado",
          room: "Sala Livre E2E",
          roomId: "sala-livre-e2e",
          ticketTypeIds: ["inteira-e2e", "meia-e2e"],
          status: "available"
        }]
      },
      {
        id: "filme-poltronas-e2e",
        slug: "filme-poltronas-e2e",
        workflowStatus: "published",
        status: "now_playing",
        title: "Filme Poltronas E2E",
        synopsis: "Sessão para concorrência WebSocket.",
        duration: "1h 20min",
        genre: ["Teste"],
        rating: "10",
        posterUrl: "",
        backdropUrl: "",
        sessions: [{
          id: "sessao-poltronas-e2e",
          date: sessionDate,
          time: sessionTime,
          format: "2D Legendado",
          room: "Sala Marcada E2E",
          roomId: "sala-marcada-e2e",
          ticketTypeIds: ["inteira-e2e"],
          status: "available"
        }, {
          id: "sessao-troca-e2e",
          date: sellableTomorrowSession(new Date(referenceDate.getTime() + 86400000)).date,
          time: sessionTime,
          format: "2D Legendado",
          room: "Sala Marcada E2E",
          roomId: "sala-marcada-e2e",
          ticketTypeIds: ["inteira-e2e"],
          status: "available"
        }]
      }
    ],
    concessions: [{
      id: "pipoca-e2e",
      sku: "PIPOCA-E2E",
      name: "Pipoca E2E",
      description: "Produto determinístico",
      price: 8,
      category: "pipoca",
      stock: 20,
      reserved: 0,
      sold: 0,
      maxPerOrder: 5,
      active: true
    }],
    subscriptionPlans: [{
      id: "plano-e2e",
      name: "Plano E2E",
      monthlyPrice: 29.9,
      includedTickets: 2,
      billingCycle: "monthly",
      benefits: ["2 ingressos"],
      ticketDiscountPercent: 10,
      concessionDiscountPercent: 5,
      active: true,
      isFeatured: true,
      displayOrder: 10
    }],
    subscriptions: [],
    subscriptionCredits: [],
    subscriptionUsage: [],
    users: [{
      id: "admin-e2e",
      name: "Administrador E2E",
      email: "admin-e2e@cine.local",
      role: "owner",
      active: true,
      passwordHash: adminPasswordHash,
      authProvider: "email",
      emailVerified: true,
      createdAt: now
    },
    fixtureCustomer("customer-card-resilience-e2e", "Cliente Cartao", "cartao-resiliencia@e2e.local", "Cartao-e2e-2026!", now),
    fixtureCustomer("customer-pagbank-card-e2e", "Cliente PagBank", "pagbank-cartao@e2e.local", "Pagbank-e2e-2026!", now),
    fixtureCustomer("customer-pix-recovery-e2e", "Cliente Pix", "pix-resposta-perdida@e2e.local", "Pix-e2e-2026!", now)],
    orders: [],
    payments: [],
    tickets: [],
    promotions: [{
      id: "cupom-e2e-20",
      title: "Cupom E2E 20%",
      description: "Cupom de teste do checkout",
      discountType: "percent",
      value: 20,
      couponCode: "E2E20",
      appliesTo: "all",
      usageLimit: 20,
      perCustomerLimit: 1,
      active: true
    }],
    ads: [],
    webhookEvents: [],
    auditLogs: []
  };
}

const e2eFixture = fixture();
if (!postgresE2e) fs.writeFileSync(dataFile, JSON.stringify(e2eFixture, null, 2));

const env = {
  ...process.env,
  CINE_DATA_FILE: dataFile,
  CINE_UPLOADS_DIR: path.join(dataDir, "uploads"),
  CINE_EMAIL_ATTACHMENTS_DIR: path.join(dataDir, "email-attachments"),
  CINE_TICKET_DOCUMENTS_DIR: path.join(dataDir, "ticket-documents"),
  DATA_STORE: postgresE2e ? "postgres" : "json",
  DATABASE_URL: postgresE2e ? process.env.TEST_DATABASE_URL : "",
  POSTGRES_URL: "",
  CINE_BACKEND_URL: "http://127.0.0.1:4000",
  NEXT_PUBLIC_CINE_API_URL: "http://127.0.0.1:4000",
  PAYMENTS_MODE: "test",
  TEST_PAYMENTS_AUTO_APPROVE: "false",
  MERCADO_PAGO_WEBHOOK_SECRET: "e2e-webhook-secret",
  ADMIN_EMAIL: "admin-e2e@cine.local",
  ADMIN_PASSWORD: adminPassword,
  CORS_ORIGIN: `http://127.0.0.1:${frontendPort},http://localhost:${frontendPort}`,
  NEXT_PUBLIC_CINE_WS_URL: "ws://127.0.0.1:4000",
  MOVIE_IMAGE_MAINTENANCE_ENABLED: "false"
};

function run(label, executable, args, overrides = {}) {
  const child = spawn(executable, args, { cwd: root, env: { ...env, ...overrides }, shell: false, stdio: "pipe" });
  processes.push(child);
  child.stdout.on("data", (data) => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${label}] ${data}`));
  child.on("exit", (code) => {
    if (code && code !== 0) shutdown(code);
  });
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const children = processes.splice(0);
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill();
  })));
  if (!process.env.CINE_E2E_DATA_DIR && path.dirname(dataDir) === fs.realpathSync(os.tmpdir()) && path.basename(dataDir).startsWith("cinecruzeiro-e2e-")) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
async function start() {
  if (postgresE2e) {
    await assertDisposableTestDatabase();
    execFileSync(process.execPath, [path.join(__dirname, "db-migrate.js")], { cwd: root, env, stdio: "inherit" });
    const store = require("../backend/db/postgresStore");
    try { await store.writeDbToPostgres(e2eFixture, { importSnapshot: true }); }
    finally { await store.closePostgres(); }
  }
  run("backend-e2e", process.execPath, ["backend/server.js"], { PORT: "4000" });
  run("frontend-e2e", process.execPath, [require.resolve("next/dist/bin/next"), "dev"], { PORT: String(frontendPort) });
}

start().catch((error) => { console.error(error); void shutdown(1); });
