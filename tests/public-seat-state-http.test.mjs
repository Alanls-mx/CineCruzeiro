import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const root = fileURLToPath(new URL("..", import.meta.url));
const testJwtSecret = "local-checkout-access-test-secret";

function signedCookie(name, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", testJwtSecret).update(encoded).digest("base64url");
  return `${name}=${encoded}.${signature}`;
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("mapa publico diferencia Pix pendente de venda e nao publica settings privados", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "cine-seat-state-"));
  const port = await unusedPort();
  const dataFile = path.join(tempDir, "db.json");
  const future = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await writeFile(dataFile, JSON.stringify({
    settings: { cinemaName: "Cinema Teste", futureSecret: "private-only", integrations: { mercadoPago: { accessToken: "private-token" } } },
    users: [
      { id: "buyer-1", name: "Comprador Um", role: "customer", active: true, sessionVersion: 0 },
      { id: "buyer-2", name: "Comprador Dois", role: "customer", active: true, sessionVersion: 0 }
    ],
    movies: [{ id: "movie-1", title: "Filme Teste", status: "now_playing", sessions: [{ id: "session-1", roomId: "room-1", date: "2099-01-01", time: "20:00" }] }],
    rooms: [{ id: "room-1", name: "Sala 1", seatSelectionEnabled: true, seatLayout: { screenLabel: "TELA", rows: [{ id: "A", label: "A", seats: [
      { id: "A1", label: "A1", enabled: true }, { id: "A2", label: "A2", enabled: true }, { id: "A3", label: "A3", enabled: true }
    ] }] } }],
    orders: [
      { id: "pending", customerUserId: "buyer-1", customerName: "Comprador Um", customerEmail: "buyer@example.test", customerCpf: "12345678900", sessionId: "session-1", status: "pending_payment", selectedSeatIds: ["A1"], reservationExpiresAt: future },
      { id: "paid", sessionId: "session-1", status: "paid", selectedSeatIds: ["A2"] },
      { id: "expired", sessionId: "session-1", status: "pending_payment", selectedSeatIds: ["A3"], reservationExpiresAt: past }
    ],
    payments: [{ id: "payment-1", orderId: "pending", status: "pending", method: "pix", amount: 10, metadata: { secret: "internal" }, raw: { token: "internal" } }]
  }));

  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", JWT_SECRET: testJwtSecret, PORT: String(port), HOST: "127.0.0.1", DATA_STORE: "json", CINE_DATA_FILE: dataFile,
      MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", GOOGLE_WALLET_SYNC_OBJECTS: "false" },
    stdio: "ignore"
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Servidor de teste saiu com ${child.exitCode}.`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) { ready = true; break; }
      } catch { /* Aguardando o servidor local. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "Servidor local nao iniciou.");
    for (const endpoint of ["/api/admin/content", "/api/orders"]) {
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
      assert.equal(response.status, 401);
    }
    const customerCrossSite = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: "cine_customer=fake", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }
    });
    assert.equal(customerCrossSite.status, 403);
    for (const endpoint of ["/api/auth/login", "/api/admin/login"]) {
      const blocked = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
        body: "{}"
      });
      assert.equal(blocked.status, 403);
      assert.equal((await blocked.json()).error.code, "CUSTOMER_CSRF_BLOCKED");
    }
    const sameOriginLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${port}` },
      body: "{}"
    });
    assert.equal(sameOriginLogin.status, 401);
    const checkoutUrl = `http://127.0.0.1:${port}/api/checkout/orders/pending`;
    const validUntil = Date.now() + 60_000;
    const ownerCookie = signedCookie("cine_customer", { sub: "buyer-1", sv: 0, exp: validUntil });
    const otherCookie = signedCookie("cine_customer", { sub: "buyer-2", sv: 0, exp: validUntil });
    const orderProof = signedCookie("cine_checkout", { orderIds: ["pending"], exp: validUntil });
    assert.equal((await fetch(checkoutUrl)).status, 404);
    assert.equal((await fetch(checkoutUrl, { headers: { Cookie: ownerCookie } })).status, 200);
    const withProof = await fetch(checkoutUrl, { headers: { Cookie: orderProof } });
    assert.equal(withProof.status, 200);
    assert.equal(withProof.headers.get("cache-control"), "private, no-store, max-age=0");
    const checkout = await withProof.json();
    assert.equal(checkout.order.customerEmail, undefined);
    assert.equal(checkout.order.customerCpf, undefined);
    assert.equal(checkout.payment.metadata, undefined);
    assert.equal(checkout.payment.raw, undefined);
    const expiredProof = signedCookie("cine_checkout", { orderIds: ["pending"], exp: Date.now() - 1000 });
    assert.equal((await fetch(checkoutUrl, { headers: { Cookie: expiredProof } })).status, 404);
    assert.equal((await fetch(checkoutUrl, { headers: { Cookie: `${otherCookie}; ${orderProof}` } })).status, 404);
    const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST", headers: { Cookie: `${ownerCookie}; ${orderProof}`, Origin: `http://127.0.0.1:${port}` }
    });
    assert.equal(logout.status, 200);
    const clearedCookies = logout.headers.getSetCookie();
    assert.equal(clearedCookies.length, 2);
    assert.ok(clearedCookies.some((cookie) => cookie.startsWith("cine_customer=") && cookie.includes("Max-Age=0")));
    assert.ok(clearedCookies.some((cookie) => cookie.startsWith("cine_checkout=") && cookie.includes("Max-Age=0")));
    const legacyCatalog = await fetch(`http://127.0.0.1:${port}/api/commercial/catalog?token=legacy-test`);
    assert.equal(legacyCatalog.status, 404);
    assert.equal(legacyCatalog.headers.get("cache-control"), "no-store");
    assert.equal(legacyCatalog.headers.get("referrer-policy"), "no-referrer");
    assert.equal(legacyCatalog.headers.get("deprecation"), "true");
    const seats = await fetch(`http://127.0.0.1:${port}/api/sessions/session-1/seats`).then((response) => response.json());
    assert.deepEqual(seats.rows[0].seats.map((seat) => seat.status), ["held", "unavailable", "available"]);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime/seats`);
    try {
      await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
      const state = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebSocket nao enviou mapa inicial.")), 3000);
        socket.on("message", (raw) => {
          const message = JSON.parse(String(raw));
          if (message.type !== "session_state") return;
          clearTimeout(timer);
          resolve(message);
        });
      });
      socket.send(JSON.stringify({ type: "join_session", sessionId: "session-1", ownerToken: "test-owner" }));
      const current = await state;
      assert.deepEqual(current.occupiedSeatIds, ["A2"]);
      assert.deepEqual(current.reservedSeatIds, ["A1"]);
    } finally {
      socket.close();
    }
    const content = await fetch(`http://127.0.0.1:${port}/api/content`).then((response) => response.json());
    assert.equal(content.settings.cinemaName, "Cinema Teste");
    assert.equal(content.settings.futureSecret, undefined);
    assert.equal(content.settings.integrations, undefined);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(tempDir, { recursive: true, force: true });
  }
});
