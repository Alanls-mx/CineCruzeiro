import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createDesktopUpdateHandler } = require("../backend/services/desktopUpdateHandler.js");

test("desktop updates preserve manifest, binary and missing file responses", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cine-desktop-update-"));
  const updateDir = path.join(root, "downloads", "desktop", "v-test");
  await fs.mkdir(updateDir, { recursive: true });
  await fs.writeFile(path.join(root, "downloads", "desktop", "latest.ini"), "[Current]\n");
  await fs.writeFile(path.join(updateDir, "latest.ini"), "[Version]\n");
  await fs.writeFile(path.join(updateDir, "app.exe"), Buffer.from([1, 2, 3]));
  const handler = createDesktopUpdateHandler({
    PUBLIC_DIR: root,
    pathIsInside: (parent, candidate) => {
      const relative = path.relative(path.resolve(parent), path.resolve(candidate));
      return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
    },
    sendJson: (res, status, body) => { res.status = status; res.body = body; },
    securityHeaders: () => ({ "X-Content-Type-Options": "nosniff" }),
    MIME_TYPES: { ".ini": "text/plain; charset=utf-8", ".exe": "application/vnd.microsoft.portable-executable" }
  });
  const response = () => ({ writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } });
  try {
    const manifest = response();
    await handler(manifest, "/api/desktop/update/latest.ini");
    assert.equal(manifest.status, 200);
    assert.equal(manifest.headers["Cache-Control"], "no-store");
    assert.equal(manifest.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(manifest.body.toString(), "[Current]\n");

    const versionedManifest = response();
    await handler(versionedManifest, "/api/desktop/update/v-test/latest.ini");
    assert.equal(versionedManifest.status, 200);
    assert.equal(versionedManifest.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.equal(versionedManifest.body.toString(), "[Version]\n");

    const binary = response();
    await handler(binary, "/api/desktop/update/v-test/app.exe");
    assert.equal(binary.status, 200);
    assert.equal(binary.headers["Cache-Control"], "public, max-age=31536000, immutable");
    assert.deepEqual(binary.body, Buffer.from([1, 2, 3]));

    for (const url of ["/api/desktop/update/", "/api/desktop/update/missing.ini", "/api/desktop/update/../missing.ini"]) {
      const missing = response();
      await handler(missing, url);
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.body, { error: "Atualização não encontrada" });
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
