import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createMaintenanceServer } = require("../backend/maintenanceServer.js");
const root = path.resolve(import.meta.dirname, "..");
const sha = "b".repeat(40);

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("maintenance denies GET side effects, writes and unsigned webhook without importing app", async () => {
  const server = createMaintenanceServer({ instance: "cinecruzeiro", expectedSha: sha,
    releaseInfo: () => ({ commit: sha }) });
  const base = await listen(server);
  try {
    const status = await fetch(`${base}/api/health/maintenance`);
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { mode: "quiescent", instance: "cinecruzeiro", commit: sha });
    for (const [method, endpoint] of [
      ["GET", "/api/box-office/point-payments/fake"],
      ["GET", "/api/health/ready"],
      ["GET", "/api/content"],
      ["POST", "/api/payments/pix"],
      ["POST", "/api/webhooks/mercado-pago"],
      ["POST", "/api/webhooks/pag-bank"],
      ["POST", "/api/admin/social-studio/automation/campaigns"]
    ]) {
      const response = await fetch(`${base}${endpoint}`, { method });
      assert.equal(response.status, 503, `${method} ${endpoint}`);
      assert.equal(response.headers.get("retry-after"), "60");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
    }
    const handshake = await new Promise((resolve, reject) => {
      const socket = net.connect(server.address().port, "127.0.0.1");
      let received = "";
      socket.once("error", reject);
      socket.on("data", (chunk) => { received += chunk.toString("utf8"); });
      socket.once("end", () => resolve(received));
      socket.once("connect", () => socket.write("GET /api/seats/ws HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGVzdA==\r\nSec-WebSocket-Version: 13\r\n\r\n"));
    });
    assert.match(handshake, /^HTTP\/1\.1 503 Service Unavailable/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("quiescent processes do not access an invalid database and are isolated", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cine-maintenance-"));
  const backend = path.join(directory, "backend");
  const services = path.join(backend, "services");
  await fs.mkdir(services, { recursive: true });
  for (const file of ["start.js", "maintenanceServer.js"]) {
    await fs.copyFile(path.join(root, "backend", file), path.join(backend, file));
  }
  await fs.copyFile(path.join(root, "backend", "services", "releaseInfoService.js"), path.join(services, "releaseInfoService.js"));
  await fs.writeFile(path.join(directory, "package.json"), JSON.stringify({ version: "0.1.0" }));
  await fs.writeFile(path.join(directory, "release-info.json"), JSON.stringify({ commit: sha }));
  const children = [];
  try {
    for (let index = 0; index < 2; index += 1) {
      const probe = net.createServer();
      await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
      const port = probe.address().port;
      await new Promise((resolve) => probe.close(resolve));
      const child = spawn(process.execPath, [path.join(backend, "start.js")], {
        cwd: directory, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CINE_OPERATION_MODE: "quiescent", CINE_INSTANCE_SLUG: "cinecruzeiro",
          CINE_EXPECTED_SHA: sha, DATABASE_URL: "postgres://unreachable.invalid/no_db",
          PORT: String(port), HOST: "127.0.0.1" }
      });
      children.push(child);
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/health/maintenance`, { signal: AbortSignal.timeout(200) });
          ready = response.status === 200;
          if (ready) break;
        } catch {}
        if (child.exitCode !== null) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(ready, `process ${index} did not start quiescent`);
    }
    assert.ok(children.every((child) => child.exitCode === null));
  } finally {
    for (const child of children) child.kill("SIGTERM");
    await Promise.all(children.map((child) => new Promise((resolve) => child.once("exit", resolve))));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("invalid mode and release identity fail before startup", async () => {
  assert.throws(() => createMaintenanceServer({ instance: "other", expectedSha: sha,
    releaseInfo: () => ({ commit: sha }) }), /MAINTENANCE_CONFIGURATION_INVALID/);
  assert.throws(() => createMaintenanceServer({ instance: "cinecruzeiro", expectedSha: sha,
    releaseInfo: () => ({ commit: "c".repeat(40) }) }), /MAINTENANCE_RELEASE_MISMATCH/);
  const child = spawn(process.execPath, [path.join(root, "backend", "start.js")], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CINE_OPERATION_MODE: "bad", CINE_INSTANCE_SLUG: "cinecruzeiro" }
  });
  const result = await new Promise((resolve) => child.once("exit", resolve));
  assert.notEqual(result, 0);
  const direct = spawn(process.execPath, [path.join(root, "backend", "server.js")], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CINE_OPERATION_MODE: "quiescent", DATABASE_URL: "postgres://unreachable.invalid/no_db" }
  });
  let diagnostic = "";
  direct.stderr.on("data", (chunk) => { diagnostic += chunk.toString("utf8"); });
  const directResult = await new Promise((resolve) => direct.once("exit", resolve));
  assert.notEqual(directResult, 0);
  assert.match(diagnostic, /CINE_OPERATION_MODE_INVALID/);
});
