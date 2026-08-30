const assert = require("assert");
const http = require("http");
const { WebSocket } = require("ws");
const { createSeatRealtimeService } = require("../backend/services/seatRealtimeService");

function nextMessage(socket, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tempo esgotado aguardando evento WebSocket.")), timeoutMs);
    const listener = (raw) => {
      const message = JSON.parse(String(raw));
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off("message", listener);
      resolve(message);
    };
    socket.on("message", listener);
  });
}

async function connect(url, ownerToken) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  socket.send(JSON.stringify({ type: "join_session", requestId: `join-${ownerToken}`, sessionId: "session-1", ownerToken }));
  await nextMessage(socket, (message) => message.type === "session_joined");
  return socket;
}

async function main() {
  const holds = new Map();
  const server = http.createServer((_req, res) => res.end("ok"));
  const realtime = createSeatRealtimeService(server, {
    allowedOrigins: () => [],
    getSessionState: async (_sessionId, ownerToken) => ({
      occupiedSeatIds: [],
      heldSeats: [...holds.entries()].map(([seatId, owner]) => ({ seatId, heldByMe: owner === ownerToken }))
    }),
    selectSeat: async ({ seatId, ownerToken }) => {
      const current = holds.get(seatId);
      if (current && current !== ownerToken) throw Object.assign(new Error("Poltrona já selecionada."), { code: "SEAT_ALREADY_HELD" });
      holds.set(seatId, ownerToken);
      return { expiresAt: new Date(Date.now() + 120000).toISOString() };
    },
    releaseSeat: async ({ seatId, ownerToken }) => {
      if (holds.get(seatId) !== ownerToken) return null;
      holds.delete(seatId);
      return { seatId };
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `ws://127.0.0.1:${address.port}/api/realtime/seats`;
  const first = await connect(url, "cliente-1");
  const second = await connect(url, "cliente-2");

  const refreshEvent = nextMessage(first, (message) => message.type === "session_refresh_required");
  realtime.broadcastSessionRefresh("session-1");
  assert.equal((await refreshEvent).sessionId, "session-1");

  first.send(JSON.stringify({ type: "select_seat", requestId: "first-select", seatId: "A1" }));
  const firstAck = await nextMessage(first, (message) => message.requestId === "first-select");
  assert.equal(firstAck.type, "select_seat_confirmed");

  second.send(JSON.stringify({ type: "select_seat", requestId: "second-select", seatId: "A1" }));
  const rejected = await nextMessage(second, (message) => message.requestId === "second-select");
  assert.equal(rejected.type, "select_seat_rejected");
  assert.equal(rejected.code, "SEAT_ALREADY_HELD");

  first.send(JSON.stringify({ type: "release_seat", requestId: "first-release", seatId: "A1" }));
  await nextMessage(first, (message) => message.requestId === "first-release");
  second.send(JSON.stringify({ type: "select_seat", requestId: "second-retry", seatId: "A1" }));
  const retry = await nextMessage(second, (message) => message.requestId === "second-retry");
  assert.equal(retry.type, "select_seat_confirmed");

  first.close();
  second.close();
  realtime.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("seat realtime tests: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
