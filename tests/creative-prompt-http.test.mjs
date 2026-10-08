import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));

test("rotas do Studio isolam permissões e pasta de upload", { timeout: 60000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "creative-prompt-http-"));
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const password = "Creative-prompt-test-only-123";
  const salt = "creative-prompt-test";
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, "sha256").toString("base64url");
  const dataFile = path.join(temp, "db.json");
  await fs.writeFile(dataFile, JSON.stringify({
    settings: { cinemaName: "Cine Cruzeiro QA", adminTwoFactorRequired: false },
    movies: [],
    users: [{ id: "creative-manager", name: "Marketing QA", email: "creative-manager@example.test",
      role: "manager", active: true, useCustomPermissions: true,
      adminPermissions: ["marketing.view", "marketing.manage"],
      passwordHash: `pbkdf2_sha256$1000$${salt}$${hash}` }]
  }));
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1", NODE_ENV: "test",
      DATA_STORE: "json", DATABASE_URL: "", POSTGRES_URL: "", CINE_DATA_FILE: dataFile,
      CINE_UPLOADS_DIR: path.join(temp, "uploads"), CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"),
      CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"), JWT_SECRET: "creative-prompt-test-secret",
      MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base }
  });
  child.stdout.resume();
  child.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, "isolated backend ready");
    const unauthenticated = await fetch(`${base}/api/admin/creative-prompts/status`);
    assert.equal(unauthenticated.status, 401);
    const login = await fetch(`${base}/api/admin/login`, { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "creative-manager@example.test", password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const status = await fetch(`${base}/api/admin/creative-prompts/status`, { headers });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).databaseReady, false);
    const categories = await fetch(`${base}/api/admin/creative-prompts/categories`, { headers });
    assert.equal(categories.status, 200);
    assert.equal(Object.keys((await categories.json()).categories).length, 9);
    const unavailable = await fetch(`${base}/api/admin/creative-prompts/directions`, {
      method: "POST", headers, body: JSON.stringify({ movieId: "missing" })
    });
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error.code, "CREATIVE_PROMPT_DATABASE_REQUIRED");
    const png = (await sharp({ create: { width: 16, height: 16, channels: 3,
      background: { r: 130, g: 30, b: 80 } } }).png().toBuffer()).toString("base64");
    const body = JSON.stringify({ data: `data:image/png;base64,${png}`, filename: "art.png",
      contentType: "image/png", folder: "outside" });
    const upload = await fetch(`${base}/api/admin/creative-prompts/images`, { method: "POST", headers, body });
    assert.equal(upload.status, 201, await upload.text());
    const generic = await fetch(`${base}/api/uploads/images`, { method: "POST", headers, body });
    assert.equal(generic.status, 403);
    const files = await fs.readdir(path.join(temp, "uploads", "creative-prompts"));
    assert.equal(files.length, 1);
    await assert.rejects(() => fs.access(path.join(temp, "uploads", "outside")));
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await fs.rm(temp, { recursive: true, force: true });
  }
});
