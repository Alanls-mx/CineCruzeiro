import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import integrationConfigService from "../backend/services/integrationConfigService.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const token = "catalog-integration-test-token";
const allowedOrigin = "https://partner.example.test";

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("catalogo comercial protege token, CORS e dados privados no HTTP", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cine-catalog-http-"));
  const port = await unusedPort();
  const secret = "catalog-http-local-only-secret";
  const previousSecret = process.env.INTEGRATION_SECRET_KEY;
  process.env.INTEGRATION_SECRET_KEY = secret;
  const db = {
    settings: { cinemaName: "Cinema Parceiro", internalCanary: "private-settings-canary" },
    integrations: {}, auditLogs: [],
    movies: [{ id: "movie-1", title: "Filme Publicado", status: "now_playing", privateCanary: "private-movie-canary", posterUrl: "/poster.webp", sessions: [] }],
    concessions: [{ id: "snack-1", name: "Pipoca", price: 12, active: true, imageUrl: "/pipoca.webp", cost: 2, privateCanary: "private-stock-canary" }],
    promotions: [{ id: "offer-1", name: "Oferta", active: true, description: "Desconto", privateCanary: "private-offer-canary" }],
    users: [{ id: "user-1", name: "Pessoa Privada", email: "private@example.test" }]
  };
  let child;
  try {
    integrationConfigService.save(db, "commercialCatalog", { accessToken: token, allowedOrigins: allowedOrigin, cacheSeconds: 90 }, { id: "test-admin" });
    integrationConfigService.setEnabled(db, "commercialCatalog", true, { id: "test-admin" });
    await writeFile(path.join(directory, "db.json"), JSON.stringify(db));
    child = spawn(process.execPath, ["backend/server.js"], {
      cwd: root,
      env: {
        ...process.env, NODE_ENV: "test", JWT_SECRET: secret, INTEGRATION_SECRET_KEY: secret,
        HOST: "127.0.0.1", PORT: String(port), DATA_STORE: "json",
        CINE_DATA_FILE: path.join(directory, "db.json"), CINE_UPLOADS_DIR: path.join(directory, "uploads"),
        MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", GOOGLE_WALLET_SYNC_OBJECTS: "false"
      },
      stdio: "ignore"
    });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Servidor de teste saiu com ${child.exitCode}.`);
      try {
        if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) { ready = true; break; }
      } catch { /* Aguardando o servidor local. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "Servidor local nao iniciou.");

    const endpoint = `http://127.0.0.1:${port}/api/commercial/catalog`;
    const missing = await fetch(endpoint, { headers: { Origin: allowedOrigin } });
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal(missing.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(missing.headers.get("access-control-allow-credentials"), "false");
    const wrong = await fetch(endpoint, { headers: { Authorization: "Bearer wrong-token", Origin: "https://other.example.test" } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.get("access-control-allow-origin"), null);
    assert.equal(wrong.headers.get("access-control-allow-credentials"), null);

    const options = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: allowedOrigin, "Access-Control-Request-Method": "GET" } });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(options.headers.get("access-control-allow-credentials"), "false");
    const blockedOptions = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: "https://other.example.test", "Access-Control-Request-Method": "GET" } });
    assert.equal(blockedOptions.headers.get("access-control-allow-origin"), null);

    const accepted = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Origin: allowedOrigin } });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.equal(accepted.headers.get("access-control-allow-credentials"), "false");
    assert.equal(accepted.headers.get("cache-control"), "private, max-age=90");
    const body = await accepted.json();
    assert.equal(body.catalog.name, "Cinema Parceiro");
    assert.equal(body.movies[0].title, "Filme Publicado");
    assert.equal(body.concessions[0].name, "Pipoca");
    assert.equal(body.promotions[0].title, "Oferta");
    const serialized = JSON.stringify(body);
    for (const privateValue of [token, secret, "private-settings-canary", "private-movie-canary", "private-stock-canary", "private-offer-canary", "private@example.test"]) {
      assert.equal(serialized.includes(privateValue), false, `Resposta revelou ${privateValue}`);
    }
    const otherOrigin = await fetch(endpoint, { headers: { "x-commercial-catalog-token": token, Origin: "https://other.example.test" } });
    assert.equal(otherOrigin.status, 200);
    assert.equal(otherOrigin.headers.get("access-control-allow-origin"), null);
  } finally {
    if (previousSecret === undefined) delete process.env.INTEGRATION_SECRET_KEY;
    else process.env.INTEGRATION_SECRET_KEY = previousSecret;
    if (child) {
      child.kill();
      await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); });
    }
    await rm(directory, { recursive: true, force: true });
  }
});
