// Characterizes the shutdown of the exact installed Git object in isolation.
// This is an expected-negative probe, not a release-cut approval test.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const repo = fileURLToPath(new URL("..", import.meta.url));
const installedSha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(installedSha || "")) {
  throw new Error("Informe o SHA completo confirmado da release instalada.");
}
execFileSync("git", ["cat-file", "-e", `${installedSha}^{commit}`], { cwd: repo, stdio: "ignore" });

const root = await mkdtemp(path.join(tmpdir(), "cine-installed-release-probe-"));
const oldRoot = path.join(root, "old");
assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
let worktreeAdded = false;
let dependencyLinkAdded = false;
let child;
let streamReader;
try {
  execFileSync("git", ["worktree", "add", "--detach", oldRoot, installedSha], { cwd: repo, stdio: "ignore" });
  worktreeAdded = true;
  await symlink(path.join(repo, "node_modules"), path.join(oldRoot, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  dependencyLinkAdded = true;
  const dataFile = path.join(root, "fixture.json");
  await writeFile(dataFile, JSON.stringify({
    settings: { adminTwoFactorRequired: false },
    users: [{ id: "probe-admin", name: "Probe Admin", email: "probe-admin@example.test", role: "owner", active: true, passwordHash: "" }],
    movies: [], rooms: [], orders: [], tickets: []
  }));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  child = spawn(process.execPath, ["-e", `require('./backend/server'); process.on('message', (message) => {
    if (message === 'stop') process.emit('SIGTERM');
  });`], {
    cwd: oldRoot, stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true,
    env: {
      ...process.env, NODE_ENV: "test", DATA_STORE: "json", PAYMENTS_MODE: "test",
      DATABASE_URL: "", POSTGRES_URL: "", TEST_DATABASE_URL: "", PORT: String(port), BIND_HOST: "127.0.0.1",
      CINE_DATA_FILE: dataFile, CINE_UPLOADS_DIR: path.join(root, "uploads"),
      CINE_EMAIL_ATTACHMENTS_DIR: path.join(root, "email"), CINE_TICKET_DOCUMENTS_DIR: path.join(root, "tickets"),
      JWT_SECRET: "installed-release-probe-synthetic-secret", FRONTEND_URL: `http://127.0.0.1:${port}`,
      CINE_PUBLIC_BACKEND_URL: `http://127.0.0.1:${port}`, ADMIN_EMAIL: "probe-admin@example.test",
      ADMIN_PASSWORD: "Probe-password-2026!", MOVIE_IMAGE_MAINTENANCE_ENABLED: "false",
      NODE_PATH: path.join(repo, "node_modules")
    }
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk; });
  child.stderr.on("data", (chunk) => { childOutput += chunk; });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    if (child.exitCode !== null) throw new Error(`Installed release exited early: ${childOutput.slice(-1000)}`);
    try { ready = (await fetch(`${base}/api/health/live`)).ok; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, childOutput.slice(-1000));

  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "probe-admin@example.test", password: "Probe-password-2026!" })
  });
  assert.equal(login.status, 200, `Synthetic admin login: ${await login.text()}`);
  const adminCookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(adminCookie);
  const stream = await fetch(`${base}/api/admin/logs/performance/stream`, { headers: { Cookie: adminCookie } });
  assert.equal(stream.status, 200);
  streamReader = stream.body.getReader();
  await streamReader.read(); // consume the initial event, then leave the stream active

  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime/seats`);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  const closeCode = new Promise((resolve) => socket.once("close", resolve));
  const startedAt = Date.now();
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  child.send("stop");
  const result = await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Old release did not exit within 15 seconds")), 15000))
  ]);
  const socketCode = await closeCode;
  const streamResult = await Promise.race([
    streamReader.read().then((chunk) => chunk.done ? "closed" : "event").catch(() => "aborted"),
    new Promise((resolve) => setTimeout(() => resolve("still_open"), 2000))
  ]);
  const elapsedMs = Date.now() - startedAt;
  process.stdout.write(`${JSON.stringify({ installedSha, result, socketCode, streamResult, elapsedMs,
    drainedWebSocket: socketCode === 1000 || socketCode === 1012 })}\n`);
  assert.equal(socketCode === 1000 || socketCode === 1012, false,
    "Probe unexpectedly observed a graceful WebSocket close; re-evaluate the drain conclusion.");
} finally {
  if (streamReader) await streamReader.cancel().catch(() => {});
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  if (dependencyLinkAdded) await unlink(path.join(oldRoot, "node_modules"));
  if (worktreeAdded) execFileSync("git", ["worktree", "remove", "--force", oldRoot], { cwd: repo, stdio: "ignore" });
  await rm(root, { recursive: true, force: true });
}
