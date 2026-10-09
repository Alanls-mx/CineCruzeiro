import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const root = fileURLToPath(new URL("..", import.meta.url));

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
    movies: [{ id: "movie-1", title: "Filme Teste", status: "now_playing", sessions: [{ id: "session-1", roomId: "room-1", date: "2099-01-01", time: "20:00" }] }],
    rooms: [{ id: "room-1", name: "Sala 1", seatSelectionEnabled: true, seatLayout: { screenLabel: "TELA", rows: [{ id: "A", label: "A", seats: [
      { id: "A1", label: "A1", enabled: true }, { id: "A2", label: "A2", enabled: true }, { id: "A3", label: "A3", enabled: true }
    ] }] } }],
    orders: [
      { id: "pending", sessionId: "session-1", status: "pending_payment", selectedSeatIds: ["A1"], reservationExpiresAt: future },
      { id: "paid", sessionId: "session-1", status: "paid", selectedSeatIds: ["A2"] },
      { id: "expired", sessionId: "session-1", status: "pending_payment", selectedSeatIds: ["A3"], reservationExpiresAt: past }
    ]
  }));

  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), HOST: "127.0.0.1", DATA_STORE: "json", CINE_DATA_FILE: dataFile,
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
