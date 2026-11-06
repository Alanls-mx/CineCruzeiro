import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { syntheticCinemaRecords } from "./fixtures/modularization-baseline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("estáticos, health e preflight preservam status, redirecionamento e cache", { timeout: 30000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-static-baseline-"));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  await fs.writeFile(path.join(temp, "db.json"), JSON.stringify(syntheticCinemaRecords()));
  await fs.mkdir(path.join(temp, "uploads"), { recursive: true });
  await fs.writeFile(path.join(temp, "uploads", "characterization.txt"), "isolated upload");
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1", NODE_ENV: "test", DATA_STORE: "json",
      DATABASE_URL: "", POSTGRES_URL: "", TEST_DATABASE_URL: "", PAYMENTS_MODE: "test",
      CINE_DATA_FILE: path.join(temp, "db.json"), CINE_UPLOADS_DIR: path.join(temp, "uploads"),
      CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"), CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"),
      MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base }
  });
  child.stdout.resume(); child.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health/live`, { signal: AbortSignal.timeout(300) })).status === 200; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "isolated backend ready");
    const live = await fetch(`${base}/api/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: "alive" });
    assert.equal(live.headers.get("cache-control"), "no-store");
    assert.match(live.headers.get("content-type"), /^application\/json/);
    const options = await fetch(`${base}/api/health/live`, { method: "OPTIONS", headers: { Origin: "https://foreign.example.test" } });
    assert.equal(options.status, 204);
    assert.match(options.headers.get("vary"), /Origin/);
    assert.notEqual(options.headers.get("access-control-allow-origin"), "https://foreign.example.test");
    const shell = await fetch(`${base}/admin/`);
    assert.equal(shell.status, 200);
    assert.equal(shell.headers.get("cache-control"), "no-store");
    assert.match(await shell.text(), /admin-login|Entrar|Login/i);
    const direct = await fetch(`${base}/admin/admin.html`, { redirect: "manual" });
    assert.equal(direct.status, 302);
    assert.ok(direct.headers.get("location"));
    const script = await fetch(`${base}/admin/admin.js`);
    assert.equal(script.status, 200);
    assert.equal(script.headers.get("cache-control"), "no-store");
    assert.match(script.headers.get("content-type"), /javascript/);
    const missing = await fetch(`${base}/admin/missing-baseline-file.js`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "REQUEST_ERROR");
    const upload = await fetch(`${base}/uploads/characterization.txt`);
    assert.equal(upload.status, 200);
    assert.equal(upload.headers.get("cache-control"), "public, max-age=300, must-revalidate");
    assert.equal(await upload.text(), "isolated upload");
    const missingTrailer = await fetch(`${base}/trailers/missing-baseline.mp4`);
    assert.equal(missingTrailer.status, 404);
    const missingImage = await fetch(`${base}/images/missing-baseline.webp`);
    assert.equal(missingImage.status, 404);
    const missingUpdate = await fetch(`${base}/api/desktop/update/missing-baseline/latest.ini`);
    assert.equal(missingUpdate.status, 404);
    assert.equal((await missingUpdate.json()).error.code, "REQUEST_ERROR");
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
    assert.equal(path.dirname(temp), os.tmpdir());
    assert.match(path.basename(temp), /^cine-static-baseline-/);
    await fs.rm(temp, { recursive: true, force: true });
  }
});
