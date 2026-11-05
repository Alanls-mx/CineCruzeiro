#!/usr/bin/env node

// Synthetic Nginx experiment only. This is not the VPS configuration or a deploy artifact.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

const config = `events {}
http {
  server {
    listen 8080;
    server_name localhost;
    if ($uri ~ ^/projects/cinecruzeiro(/|$)) { return 503; }
    location = /projects/cinecruzeiro { return 200 "old-cinema"; }
    location ^~ /projects/cinecruzeiro/api/ { return 200 "old-api"; }
    location ^~ /projects/cinecruzeiro/admin/ { return 200 "old-admin"; }
    location ^~ /projects/cinecruzeiro/ { return 200 "old-frontend"; }
    location / { return 200 "neighbor"; }
  }
}
`;

function docker(...args) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 30_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`Docker ${args[0]} failed: ${result.error?.message || result.stderr?.trim() || result.status}`);
  }
  return result.stdout.trim();
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function upgradeStatus(port) {
  return await new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let response = "";
    socket.setTimeout(3000, () => socket.destroy(new Error("Upgrade timeout")));
    socket.once("error", reject);
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.includes("\r\n\r\n")) {
        resolve(response);
        socket.destroy();
      }
    });
    socket.once("connect", () => socket.write(
      "GET /projects/cinecruzeiro/api/seats/ws HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGVzdA==\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ));
  });
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cine-phase13-nginx-"));
  const configPath = path.join(directory, "nginx.conf");
  const name = `cine-phase13-${randomBytes(6).toString("hex")}`;
  let started = false;
  try {
    await fs.writeFile(configPath, config);
    const port = await freePort();
    docker("run", "--detach", "--rm", "--name", name,
      "--publish", `127.0.0.1:${port}:8080`, "--volume", `${configPath}:/etc/nginx/nginx.conf:ro`, "nginx:stable-alpine");
    started = true;
    docker("exec", name, "nginx", "-t");
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(500) });
        ready = response.status === 200;
        if (ready) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Nginx did not start");
    for (const [method, route] of [
      ["GET", "/projects/cinecruzeiro"],
      ["GET", "/projects/cinecruzeiro/"],
      ["GET", "/projects/cinecruzeiro/admin/settings"],
      ["GET", "/projects/cinecruzeiro/uploads/example"],
      ["GET", "/projects/cinecruzeiro/api/box-office/point-payments/example"],
      ["POST", "/projects/cinecruzeiro/api/payments/pix"],
      ["POST", "/projects/cinecruzeiro/api/webhooks/mercado-pago"]
    ]) {
      const response = await fetch(`${base}${route}`, { method });
      assert.equal(response.status, 503, `${method} ${route}`);
    }
    assert.match(await upgradeStatus(port), /^HTTP\/1\.1 503\b/);
    for (const route of ["/", "/projects/cine-estacao/", "/projects/cinecruzeiro-other/"]) {
      const response = await fetch(`${base}${route}`);
      assert.equal(response.status, 200, route);
      assert.equal(await response.text(), "neighbor", route);
    }
    console.log("PASS: synthetic Nginx cut isolates Cine Cruzeiro HTTP/WS; neighbor routes remain 200.");
  } finally {
    if (started) docker("rm", "--force", name);
    await fs.unlink(configPath).catch(() => {});
    await fs.rmdir(directory).catch(() => {});
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
