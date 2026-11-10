import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("troca administrativa persiste antes da resposta e preserva finanças", { timeout: 60000 }, async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "cine-session-change-"));
  const file = path.join(temp, "db.json");
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  await writeFile(file, JSON.stringify({
    settings: { cinemaName: "Cinema de teste", adminTwoFactorRequired: false },
    movies: [
      { id: "old", title: "Antigo", sessions: [{ id: "s-old", date: "2099-01-01", time: "18:00", roomId: "room-old", status: "available" }] },
      { id: "new", title: "Novo", sessions: [{ id: "s-new", date: "2099-01-02", time: "20:00", roomId: "room-new", status: "available" }] }
    ],
    rooms: ["room-old", "room-new"].map((id) => ({ id, name: id, capacity: 2, seatSelectionEnabled: true,
      seatLayout: { rows: [{ id: "A", label: "A", seats: [{ id: "A1", label: "A1", enabled: true }, { id: "A2", label: "A2", enabled: true }] }] } })),
    orders: [{ id: "order", status: "paid", movieId: "old", sessionId: "s-old", selectedSeatIds: ["A1"],
      selectedSeats: [{ id: "A1", label: "A1" }], totalPrice: 37, customerEmail: "customer@example.test" }],
    payments: [{ id: "payment", orderId: "order", status: "approved", amount: 37 }],
    tickets: [{ id: "ticket", orderId: "order", movieId: "old", movieTitle: "Antigo", sessionId: "s-old",
      sessionDate: "2099-01-01", sessionTime: "18:00", sessionRoom: "room-old", seatId: "A1", seat: "A1",
      code: "CC-00000001", qrToken: "old-token", status: "active", customerName: "Cliente Teste", customerEmail: "customer@example.test" }]
  }));
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root, stdio: "ignore", windowsHide: true,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), BIND_HOST: "127.0.0.1", DATA_STORE: "json",
      CINE_DATA_FILE: file, CINE_UPLOADS_DIR: path.join(temp, "uploads"), CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"),
      CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"), ADMIN_EMAIL: "qa@example.test",
      ADMIN_PASSWORD: "qa-session-change-only-123456", JWT_SECRET: "qa-session-change-local-secret", FRONTEND_URL: base,
      CINE_PUBLIC_BACKEND_URL: base, MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", GOOGLE_WALLET_SYNC_OBJECTS: "false",
      EMAIL_WEBHOOK_URL: "", SMTP_HOST: "", PAYMENTS_MODE: "test" }
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`Servidor de teste terminou: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(ready, true);
    const endpoint = "/api/admin/tickets/ticket/session-change";
    assert.equal((await fetch(`${base}${endpoint}`)).status, 401);
    const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "qa@example.test", password: "qa-session-change-only-123456" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const options = await fetch(`${base}${endpoint}?sessionId=s-new`, { headers });
    assert.equal(options.status, 200);
    assert.deepEqual((await options.json()).seats.map((item) => item.id), ["A1", "A2"]);
    const body = JSON.stringify({ sessionId: "s-new", seatId: "A2" });
    assert.equal((await fetch(`${base}${endpoint}`, { method: "POST", headers: { ...headers, Origin: "https://foreign.example" }, body })).status, 403);
    const changed = await fetch(`${base}${endpoint}`, { method: "POST", headers, body });
    const raw = await changed.text();
    assert.equal(changed.status, 200, raw);
    const data = JSON.parse(raw);
    assert.equal(data.ticket.sessionId, "s-new");
    const stored = JSON.parse(await readFile(file, "utf8"));
    assert.equal(stored.tickets[0].sessionId, "s-new");
    assert.deepEqual(stored.orders[0].selectedSeatIds, []);
    assert.equal(stored.orders[0].totalPrice, 37);
    assert.equal(stored.orders[0].sessionId, "s-old");
    assert.equal(stored.payments[0].amount, 37);
    assert.ok(stored.auditLogs.some((item) => item.action?.includes("session-change")));
    const repeat = await fetch(`${base}${endpoint}`, { method: "POST", headers, body });
    assert.equal(repeat.status, 200);
    assert.equal((await repeat.json()).unchanged, true);
  } finally {
    child.kill();
    await rm(temp, { recursive: true, force: true });
  }
});
