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

  await new Promise((resolve) => setTimeout(resolve, 150));
  second.send(JSON.stringify({ type: "heartbeat", requestId: "delayed-heartbeat", seatIds: ["A1"] }));
  const heartbeat = await nextMessage(second, (message) => message.requestId === "delayed-heartbeat");
  assert.equal(heartbeat.type, "heartbeat_ack");
  assert.equal(holds.get("A1"), "cliente-2");

  const contenders = await Promise.all(Array.from({ length: 20 }, (_, index) => connect(url, `concorrente-${index}`)));
  const outcomes = await Promise.all(contenders.map((socket, index) => {
    const requestId = `many-select-${index}`;
    socket.send(JSON.stringify({ type: "select_seat", requestId, seatId: "A2" }));
    return nextMessage(socket, (message) => message.requestId === requestId);
  }));
  assert.equal(outcomes.filter((message) => message.type === "select_seat_confirmed").length, 1);
  assert.equal(outcomes.filter((message) => message.type === "select_seat_rejected" && message.code === "SEAT_ALREADY_HELD").length, 19);

  const winnerIndex = outcomes.findIndex((message) => message.type === "select_seat_confirmed");
  const winnerToken = `concorrente-${winnerIndex}`;
  contenders[winnerIndex].close();
  const reconnectedWinner = new WebSocket(url);
  await new Promise((resolve, reject) => {
    reconnectedWinner.once("open", resolve);
    reconnectedWinner.once("error", reject);
  });
  const recoveredStatePromise = nextMessage(reconnectedWinner, (message) => message.type === "session_state");
  reconnectedWinner.send(JSON.stringify({ type: "join_session", requestId: "winner-reconnect", sessionId: "session-1", ownerToken: winnerToken }));
  const recoveredState = await recoveredStatePromise;
  assert.equal(recoveredState.heldSeats.some((seat) => seat.seatId === "A2" && seat.heldByMe), true);

  first.close();
  second.close();
  contenders.forEach((socket) => socket.close());
  reconnectedWinner.close();
  realtime.close();
  await new Promise((resolve) => server.close(resolve));
  console.log("seat realtime tests: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
