#!/usr/bin/env node

import assert from "node:assert/strict";
import { after, test } from "node:test";

const PRODUCTION_BASE = "https://lumixengine.com/projects/cinecruzeiro";
const BASE = String(process.env.BASE_URL || PRODUCTION_BASE).replace(/\/+$/, "");
const TARGET = new URL(BASE);
const IS_LOCAL = ["127.0.0.1", "localhost"].includes(TARGET.hostname);
const IS_PRODUCTION = BASE === PRODUCTION_BASE;
const REQUEST_TIMEOUT_MS = 10_000;
const RESPONSE_LIMIT_BYTES = 512 * 1024;
const REQUEST_DELAY_MS = IS_PRODUCTION ? 150 : 0;
const MAX_REQUESTS = 40;
const FAKE_ID = "00000000-0000-4000-8000-000000000000";

if (!IS_LOCAL && !IS_PRODUCTION) {
  throw new Error(`Alvo recusado: ${BASE}. Use localhost ou ${PRODUCTION_BASE}.`);
}
if (IS_LOCAL && TARGET.protocol !== "http:") {
  throw new Error("O alvo local deve usar HTTP.");
}
if (IS_PRODUCTION && TARGET.protocol !== "https:") {
  throw new Error("A auditoria de produção exige HTTPS.");
}

let requestCount = 0;
let lastRequestAt = 0;

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function header(response, name) {
  return response.headers[name.toLowerCase()] || "";
}

function containsSensitiveKey(value, path = "root") {
  const blocked = /^(password|passwordhash|twofactorsecret|recoverycodes|access_?token|client_?secret|webhook_?secret|private_?key|database_?url|integrationsecretkey|jwtsecret)$/i;
  if (!value || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (blocked.test(key)) return childPath;
    const nested = containsSensitiveKey(child, childPath);
    if (nested) return nested;
  }
  return null;
}

function exposesPaymentArtifact(value) {
  if (!value || typeof value !== "object") return false;
  return ["qrCode", "qr_code", "qrCodeBase64", "point_of_interaction", "ticketUrl", "checkoutUrl"]
    .some((key) => value[key] != null)
    || Object.values(value).some((child) => exposesPaymentArtifact(child));
}

async function request(path, { method = "GET", headers = {}, body, redirect = "manual" } = {}) {
  requestCount += 1;
  assert.ok(requestCount <= MAX_REQUESTS, `limite defensivo de ${MAX_REQUESTS} requisições excedido`);

  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) await sleep(REQUEST_DELAY_MS - elapsed);
  lastRequestAt = Date.now();

  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/json, text/plain;q=0.9, text/html;q=0.8",
      "User-Agent": "CineCruzeiro-Defensive-Audit/1.0",
      ...headers,
    },
    body,
  });
  const contentLength = Number(response.headers.get("content-length") || 0);
  assert.ok(!contentLength || contentLength <= RESPONSE_LIMIT_BYTES, `resposta excede ${RESPONSE_LIMIT_BYTES} bytes em ${path}`);
  const raw = Buffer.from(await response.arrayBuffer());
  assert.ok(raw.length <= RESPONSE_LIMIT_BYTES, `corpo excede ${RESPONSE_LIMIT_BYTES} bytes em ${path}`);
  const text = raw.toString("utf8");
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const responseHeaders = Object.fromEntries([...response.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
  return { status: response.status, headers: responseHeaders, text, json };
}

function post(path, body, headers = {}) {
  return request(path, {
    method: "POST",
    headers: {
      Origin: TARGET.origin,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function assertProtected(response, label) {
  assert.ok([401, 403, 404, 405].includes(response.status), `${label} respondeu ${response.status}`);
  assert.equal(response.json?.stack, undefined, `${label} expôs stack trace`);
  assert.equal(exposesPaymentArtifact(response.json), false, `${label} expôs artefato de pagamento`);
}

console.log(`\nAuditoria defensiva: ${BASE}`);
console.log(`Modo: ${IS_PRODUCTION ? "produção, leitura e abuso simulado de baixo impacto" : "localhost"}\n`);

test("páginas públicas usam headers defensivos e cache adequado", async () => {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(header(home, "content-security-policy"), /default-src 'self'/i);
  assert.match(header(home, "content-security-policy"), /object-src 'none'/i);
  if (IS_PRODUCTION) {
    assert.match(header(home, "x-content-type-options"), /nosniff/i);
    assert.match(header(home, "x-frame-options"), /deny|sameorigin/i);
    assert.match(header(home, "referrer-policy"), /strict-origin|no-referrer/i);
    assert.match(header(home, "permissions-policy"), /camera=\(\)/i);
    assert.match(header(home, "cache-control"), /no-store|private/i);
    const hsts = header(home, "strict-transport-security");
    const maxAge = Number(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
    assert.ok(maxAge >= 31_536_000, `HSTS fraco: ${hsts || "ausente"}`);
    assert.match(hsts, /includeSubDomains/i);
    assert.match(home.text, /<link[^>]+rel="canonical"[^>]+href="https:\/\/lumixengine\.com\/projects\/cinecruzeiro\/"/i);
  }

  const account = await request("/conta");
  assert.equal(account.status, 200);
  assert.match(header(account, "cache-control"), /no-store|private|no-cache/i);
  assert.doesNotMatch(header(account, "cache-control"), /s-maxage/i);
  assert.doesNotMatch(header(account, "x-nextjs-cache"), /^HIT$/i);
  assert.doesNotMatch(account.text, /passwordHash|twoFactorSecret|customerCpf|customerEmail/i);
});

test("health público não revela banco ou estado de migrations", async () => {
  const response = await request("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { status: "ok" });
});

test("CORS não reflete origem arbitrária com credenciais", async () => {
  const response = await request("/api/health/live", { headers: { Origin: "https://evil.example" } });
  const allowOrigin = header(response, "access-control-allow-origin");
  const allowCredentials = header(response, "access-control-allow-credentials");
  assert.notEqual(allowOrigin, "https://evil.example");
  assert.ok(!(allowOrigin === "*" && /true/i.test(allowCredentials)));
});

test("catálogo público não expõe estoque, contas, pedidos ou segredos", async () => {
  const response = await request("/api/content");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.json?.movies));
  assert.equal(response.json?.users, undefined);
  assert.equal(response.json?.orders, undefined);
  assert.equal(response.json?.payments, undefined);
  assert.equal(response.json?.auditLogs, undefined);
  assert.equal(containsSensitiveKey(response.json), null);
  for (const item of response.json?.concessions || []) {
    assert.equal("stock" in item, false, `${item.name} expõe stock`);
    assert.equal("reserved" in item, false, `${item.name} expõe reserved`);
    assert.equal("sold" in item, false, `${item.name} expõe sold`);
  }
  const familyCombo = (response.json?.concessions || []).find((item) => item.id === "combo-familia");
  if (familyCombo) assert.equal(Number(familyCombo.price), 42, "Combo Família ainda está com preço de teste");
});

test("robots exclui áreas privadas da indexação", async () => {
  const response = await request("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.text, /Disallow:\s*\/projects\/cinecruzeiro\/admin/i);
  assert.match(response.text, /Disallow:\s*\/projects\/cinecruzeiro\/api/i);
  assert.match(response.text, /Disallow:\s*\/projects\/cinecruzeiro\/conta/i);
});

test("pagamento anônimo com preço adulterado não cria cobrança", { skip: IS_PRODUCTION ? "pagamentos live não são auditados" : false }, async () => {
  const response = await post("/api/payments/pix", {
    method: "pix",
    order: {
      id: `audit-${FAKE_ID}`,
      idempotencyKey: `audit-${FAKE_ID}`,
      sessionId: "sessao-inexistente-auditoria",
      selectedSeatIds: ["A1"],
      ticketItems: [{ id: "ingresso-inteiro", quantity: 1, price: 0.01 }],
      total: 0.01,
      totalPrice: 0.01,
    },
  });
  assert.equal(response.status, 401);
  assert.equal(response.json?.error?.code, "AUTH_REQUIRED");
  assert.equal(exposesPaymentArtifact(response.json), false);
});

test("cartão anônimo não inicia pedido nem devolve dados do provedor", { skip: IS_PRODUCTION ? "pagamentos live não são auditados" : false }, async () => {
  const response = await post("/api/payments/card", {
    order: { id: `audit-card-${FAKE_ID}`, sessionId: "sessao-inexistente-auditoria", totalPrice: 0.01 },
    cardToken: "token-falso-auditoria",
    paymentMethodId: "visa",
    installments: 1,
  });
  assert.equal(response.status, 401);
  assert.equal(response.json?.error?.code, "AUTH_REQUIRED");
  assert.equal(exposesPaymentArtifact(response.json), false);
});

test("ingresso e pedido de outro usuário permanecem inacessíveis", async () => {
  const checks = [
    ["GET", `/api/me/tickets/${FAKE_ID}/download`],
    ["POST", `/api/me/tickets/${FAKE_ID}/transfer`],
    ["GET", `/api/checkout/orders/${FAKE_ID}`],
  ];
  for (const [method, path] of checks) {
    const response = method === "POST" ? await post(path, { email: "destino-inexistente@example.invalid" }) : await request(path);
    assertProtected(response, path);
  }
});

test("rotas administrativas não respondem com dados sem autenticação", async () => {
  for (const path of ["/api/admin/me", "/api/admin/content", "/api/admin/dashboard", "/api/integrations", "/api/users"]) {
    const response = await request(path);
    assertProtected(response, path);
    assert.equal(containsSensitiveKey(response.json), null, `${path} expôs campo sensível`);
  }
});

test("login usa erro genérico e não expõe stack ou cookies", async () => {
  const response = await post("/api/auth/login", {
    email: "conta-inexistente-auditoria@example.invalid",
    password: "Senha-invalida-auditoria-2026!",
  });
  assert.equal(response.status, 401);
  assert.equal(response.json?.error?.message, "E-mail ou senha invalidos.");
  assert.equal(response.json?.stack, undefined);
  assert.equal(header(response, "set-cookie"), "");
});

test("origem externa não pode executar mutação autenticável", async () => {
  const response = await post("/api/coupons/preview", { order: { couponCode: "AUDIT" } }, {
    Origin: "https://evil.example",
    "Sec-Fetch-Site": "cross-site",
  });
  assert.ok([401, 403].includes(response.status), `origem externa respondeu ${response.status}`);
  assert.equal(exposesPaymentArtifact(response.json), false);
});

test("JSON inválido e rota inexistente não devolvem detalhes internos", async () => {
  const malformed = await request("/api/auth/login", {
    method: "POST",
    headers: { Origin: TARGET.origin, "Content-Type": "application/json" },
    body: "{json-invalido",
  });
  assert.ok([400, 401].includes(malformed.status));
  assert.equal(malformed.json?.stack, undefined);
  assert.doesNotMatch(malformed.text, /node_modules|backend[\\/]server\.js|postgresql:\/\//i);

  const missing = await request(`/api/recurso-inexistente-${FAKE_ID}`);
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.text, /node_modules|backend[\\/]server\.js|postgresql:\/\//i);
});

test("login aplica bloqueio progressivo com Retry-After", { skip: IS_PRODUCTION ? "não provoca rate limit em produção" : false }, async () => {
  const email = `rate-limit-${Date.now()}@example.invalid`;
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await post("/api/auth/login", { email, password: "Senha-invalida-auditoria-2026!" });
  }
  assert.equal(response.status, 429);
  assert.match(header(response, "retry-after"), /^\d+$/);
});

test("rate limit agrupa IDs dinâmicos da mesma operação", { skip: IS_PRODUCTION ? "não provoca rate limit em produção" : false }, async () => {
  const auditIp = "203.0.113.88";
  let response;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    response = await post(`/api/me/tickets/audit-ticket-${attempt}/transfer`, {
      email: "destino-inexistente@example.invalid"
    }, { "X-Forwarded-For": auditIp });
  }
  assert.equal(response.status, 429);
  assert.equal(response.json?.error?.category, "ticket-transfer");
  assert.match(header(response, "retry-after"), /^\d+$/);
  assert.equal(header(response, "ratelimit-policy"), "8;w=600");
});

test("tentativa simples de travessia de caminho não lê arquivos", async () => {
  const response = await request("/uploads/%2e%2e%2f%2e%2e%2fetc%2fpasswd");
  assert.doesNotMatch(response.text, /root:.*:0:0:/);
  if (response.status === 200) {
    assert.match(header(response, "content-type"), /text\/html/i, "fallback 200 não devolveu HTML");
    assert.match(response.text, /<!doctype html>/i, "fallback 200 não devolveu a aplicação");
  } else {
    assert.ok([400, 403, 404].includes(response.status), `travessia respondeu ${response.status}`);
  }
});

after(() => {
  console.log(`\nAuditoria concluída com ${requestCount} requisições sequenciais.`);
});
