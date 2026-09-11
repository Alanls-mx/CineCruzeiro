const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const MAX_MESSAGE_BYTES = 4096;
const MESSAGE_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 240;
const MAX_SELECTIONS_PER_WINDOW = 120;
const MAX_CONNECTIONS_PER_IP = 40;
const MAX_PROTOCOL_ERRORS = 5;

function requestIp(request) {
  const remoteAddress = String(request.socket.remoteAddress || "local").trim();
  const proxyIsLocal = remoteAddress === "::1" || remoteAddress === "127.0.0.1" || remoteAddress === "::ffff:127.0.0.1";
  if (!proxyIsLocal) return remoteAddress;
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",").map((value) => value.trim()).filter(Boolean);
  return forwarded.at(-1) || String(request.headers["x-real-ip"] || "").trim() || remoteAddress;
}

function consumeSocketLimit(socket, kind, limit) {
  const now = Date.now();
  const key = kind === "selection" ? "selectionRate" : "messageRate";
  const current = socket[key] || { count: 0, resetAt: now + MESSAGE_WINDOW_MS };
  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + MESSAGE_WINDOW_MS;
  }
  current.count += 1;
  socket[key] = current;
  return current.count <= limit;
}

function parseMessage(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
  if (!text || Buffer.byteLength(text, "utf8") > MAX_MESSAGE_BYTES) return null;
  try {
    const message = JSON.parse(text);
    return message && typeof message === "object" ? message : null;
  } catch {
    return null;
  }
}

function validIdentifier(value, max = 160) {
  const text = String(value || "").trim();
  return text.length >= 1 && text.length <= max && /^[a-zA-Z0-9._:-]+$/.test(text) ? text : "";
}

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function createSeatRealtimeService(server, options) {
  const path = options.path || "/api/realtime/seats";
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  function broadcast(sessionId, message, ownerToken = "") {
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN || client.seatSessionId !== sessionId) continue;
      send(client, {
        ...message,
        ...(ownerToken ? { heldByMe: client.seatOwnerToken === ownerToken } : {})
      });
    }
  }

  async function sendState(socket) {
    const state = await options.getSessionState(socket.seatSessionId, socket.seatOwnerToken);
    send(socket, { type: "session_state", ...state });
  }

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    if (pathname !== path) return;
    const origin = String(request.headers.origin || "").replace(/\/+$/, "");
    const allowedOrigins = options.allowedOrigins?.() || [];
    if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const ip = requestIp(request);
    const activeForIp = [...wss.clients].filter((client) => client.readyState === WebSocket.OPEN && client.clientIp === ip).length;
    if (activeForIp >= MAX_CONNECTIONS_PER_IP) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (websocket) => wss.emit("connection", websocket, request));
  });

  wss.on("connection", (socket, request) => {
    socket.connectionId = crypto.randomUUID();
    socket.clientIp = requestIp(request);
    socket.seatSessionId = "";
    socket.seatOwnerToken = "";
    socket.protocolErrors = 0;

    socket.on("message", async (raw) => {
      if (!consumeSocketLimit(socket, "message", MAX_MESSAGES_PER_WINDOW)) {
        send(socket, { type: "protocol_error", code: "RATE_LIMITED", message: "Muitas atualizacoes em pouco tempo." });
        socket.close(1008, "rate limited");
        return;
      }
      const message = parseMessage(raw);
      if (!message) {
        socket.protocolErrors += 1;
        send(socket, { type: "protocol_error", code: "INVALID_MESSAGE", message: "Mensagem WebSocket inválida." });
        if (socket.protocolErrors >= MAX_PROTOCOL_ERRORS) socket.close(1008, "invalid protocol messages");
        return;
      }

      const requestId = validIdentifier(message.requestId, 100) || crypto.randomUUID();
      try {
        if (message.type === "join_session") {
          const sessionId = validIdentifier(message.sessionId);
          const ownerToken = validIdentifier(message.ownerToken, 180);
          if (!sessionId || !ownerToken) throw Object.assign(new Error("Sessão ou token de reserva inválido."), { code: "INVALID_JOIN" });
          socket.seatSessionId = sessionId;
          socket.seatOwnerToken = ownerToken;
          send(socket, { type: "session_joined", requestId, sessionId });
          await sendState(socket);
          return;
        }

        if (!socket.seatSessionId || !socket.seatOwnerToken) {
          throw Object.assign(new Error("Entre na sessão antes de selecionar poltronas."), { code: "SESSION_NOT_JOINED" });
        }

        if (message.type === "select_seat") {
          if (!consumeSocketLimit(socket, "selection", MAX_SELECTIONS_PER_WINDOW)) {
            throw Object.assign(new Error("Muitas selecoes em pouco tempo."), { code: "RATE_LIMITED" });
          }
          const seatId = validIdentifier(message.seatId);
          if (!seatId) throw Object.assign(new Error("Poltrona inválida."), { code: "INVALID_SEAT" });
          const hold = await options.selectSeat({
            sessionId: socket.seatSessionId,
            seatId,
            ownerToken: socket.seatOwnerToken,
            connectionId: socket.connectionId
          });
          send(socket, { type: "select_seat_confirmed", requestId, sessionId: socket.seatSessionId, seatId, expiresAt: hold.expiresAt });
          broadcast(socket.seatSessionId, { type: "seat_status_changed", sessionId: socket.seatSessionId, seatId, status: "held", expiresAt: hold.expiresAt }, socket.seatOwnerToken);
          return;
        }

        if (message.type === "release_seat") {
          const seatId = validIdentifier(message.seatId);
          if (!seatId) throw Object.assign(new Error("Poltrona inválida."), { code: "INVALID_SEAT" });
          const released = await options.releaseSeat({ sessionId: socket.seatSessionId, seatId, ownerToken: socket.seatOwnerToken });
          send(socket, { type: "release_seat_confirmed", requestId, sessionId: socket.seatSessionId, seatId });
          if (released) broadcast(socket.seatSessionId, { type: "seat_status_changed", sessionId: socket.seatSessionId, seatId, status: "available" });
          return;
        }

        if (message.type === "heartbeat") {
          const seatIds = Array.isArray(message.seatIds) ? message.seatIds.map((seatId) => validIdentifier(seatId)).filter(Boolean).slice(0, 20) : [];
          for (const seatId of seatIds) {
            await options.selectSeat({ sessionId: socket.seatSessionId, seatId, ownerToken: socket.seatOwnerToken, connectionId: socket.connectionId });
          }
          send(socket, { type: "heartbeat_ack", requestId, sessionId: socket.seatSessionId });
          return;
        }

        throw Object.assign(new Error("Evento WebSocket não reconhecido."), { code: "UNKNOWN_EVENT" });
      } catch (error) {
        const seatId = validIdentifier(message.seatId);
        send(socket, {
          type: message.type === "select_seat" ? "select_seat_rejected" : "protocol_error",
          requestId,
          sessionId: socket.seatSessionId,
          seatId,
          code: error.code || "SEAT_REALTIME_ERROR",
          message: error.message || "Não foi possível atualizar a poltrona."
        });
      }
    });

    socket.on("error", (error) => options.onError?.(error));
  });

  return {
    broadcastSeatStatus(sessionId, seatId, status) {
      broadcast(sessionId, { type: "seat_status_changed", sessionId, seatId, status });
    },
    broadcastSessionRefresh(sessionId) {
      broadcast(sessionId, { type: "session_refresh_required", sessionId });
    },
    close() {
      wss.close();
    }
  };
}

module.exports = { createSeatRealtimeService };
