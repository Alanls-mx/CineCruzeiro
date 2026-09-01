const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, ".e2e-data");
const dataFile = path.join(dataDir, "db.json");
const processes = [];

function isoDate(daysFromNow) {
  const date = new Date(Date.now() + daysFromNow * 86400000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function fixture() {
  const now = new Date().toISOString();
  const mercadoPago = {
    enabled: true,
    environment: "sandbox",
    publicKey: "TEST-e2e-public-key",
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
          date: isoDate(1),
          time: "19:00",
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
          date: isoDate(1),
          time: "21:00",
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
      passwordHash: "",
      authProvider: "email",
      emailVerified: true,
      createdAt: now
    }],
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

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(dataFile, JSON.stringify(fixture(), null, 2));

const env = {
  ...process.env,
  CINE_DATA_FILE: dataFile,
  DATA_STORE: "json",
  DATABASE_URL: "",
  POSTGRES_URL: "",
  PAYMENTS_MODE: "test",
  TEST_PAYMENTS_AUTO_APPROVE: "false",
  MERCADO_PAGO_WEBHOOK_SECRET: "e2e-webhook-secret",
  ADMIN_EMAIL: "admin-e2e@cine.local",
  ADMIN_PASSWORD: "Admin-e2e-2026!",
  CORS_ORIGIN: "http://127.0.0.1:3000,http://localhost:3000",
  NEXT_PUBLIC_CINE_WS_URL: "ws://127.0.0.1:4000",
  MOVIE_IMAGE_MAINTENANCE_ENABLED: "false"
};

function run(label, command) {
  const child = spawn(command, { cwd: root, env, shell: true, stdio: "pipe" });
  processes.push(child);
  child.stdout.on("data", (data) => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${label}] ${data}`));
  child.on("exit", (code) => {
    if (code && code !== 0) shutdown(code);
  });
}

function shutdown(code = 0) {
  while (processes.length) {
    const child = processes.pop();
    if (child && !child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
run("backend-e2e", "node backend/server.js");
run("frontend-e2e", "next dev");
