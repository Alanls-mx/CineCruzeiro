import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const root = fileURLToPath(new URL("..", import.meta.url));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeEnvironment = Object.fromEntries([
  "PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"
].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));

test("controlled startup gates actual HTTP and WebSocket entry before advancing", { timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cine-controlled-startup-"));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  await writeFile(path.join(dir, "db.json"), JSON.stringify({
    settings: { adminTwoFactorRequired: false }, users: [], movies: [], rooms: [], orders: [], tickets: []
  }));
  const child = spawn(process.execPath, ["-e", `require('./backend/server'); process.on('message', (message) => {
    if (message === 'advance') { process.emit('SIGUSR2'); process.send('advanced'); }
  });`], {
    cwd: root, stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
    env: {
      ...safeEnvironment, DATABASE_URL: "", POSTGRES_URL: "", DATA_STORE: "json", PAYMENTS_MODE: "test",
      CINE_CONTROLLED_STARTUP: "1", NODE_ENV: "test", PORT: String(port), BIND_HOST: "127.0.0.1",
      CINE_DATA_FILE: path.join(dir, "db.json"), CINE_UPLOADS_DIR: path.join(dir, "uploads"),
      CINE_EMAIL_ATTACHMENTS_DIR: path.join(dir, "email"), CINE_TICKET_DOCUMENTS_DIR: path.join(dir, "tickets"),
      JWT_SECRET: "controlled-startup-fixture-secret", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base
    }
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const response = (route, method = "GET") => fetch(`${base}${route}`, { method });
  const advance = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("startup advance timed out")), 3000);
    child.once("message", () => { clearTimeout(timeout); resolve(); });
    child.send("advance");
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${output.slice(-1000)}`);
      try { ready = (await response("/api/health/live")).ok; } catch {}
      if (ready) break;
      await wait(100);
    }
    assert.equal(ready, true, output.slice(-1000));
    assert.equal((await response("/api/health/ready")).status, 503);
    const blocked = await response("/api/payments/pix", "POST");
    assert.equal(blocked.status, 503);
    assert.equal(blocked.headers.get("retry-after"), "30");
    assert.equal((await blocked.json()).error.code, "RELEASE_STARTUP_PENDING");
    assert.equal((await response("/api/webhooks/mercado-pago", "POST")).status, 503);

    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime/seats`);
    const status = await new Promise((resolve, reject) => {
      socket.once("unexpected-response", (_request, rejected) => resolve(rejected.statusCode));
      socket.once("error", reject);
    });
    assert.equal(status, 503);
    socket.terminate();

    await advance(); // auth
    assert.notEqual((await response("/api/admin/login", "POST")).status, 503);
    assert.equal((await response("/api/webhooks/mercado-pago", "POST")).status, 503);
    await advance(); // callbacks
    assert.notEqual((await response("/api/webhooks/mercado-pago", "POST")).status, 503);
    assert.equal((await response("/api/payments/pix", "POST")).status, 503);
    await advance(); // checkout
    assert.notEqual((await response("/api/movies")).status, 503);
    assert.equal((await response("/api/admin/social-studio/campaigns", "POST")).status, 503);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
