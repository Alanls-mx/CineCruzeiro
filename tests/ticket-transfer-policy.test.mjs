import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { evaluateTicketTransfer } = require("../backend/services/ticketTransferPolicy");

const NOW = Date.parse("2026-09-11T15:00:00.000Z");
const LIMITS = {
  maxPerTicket: 2,
  maxOutgoingPerWindow: 3,
  maxIncomingPerWindow: 4,
  windowMs: 24 * 60 * 60 * 1000,
  cooldownMs: 30 * 1000
};

function transfer(overrides = {}) {
  return {
    ticketId: "ticket-1",
    fromUserId: "user-a",
    toUserId: "user-b",
    transferredAt: new Date(NOW - 60 * 1000).toISOString(),
    ...overrides
  };
}

test("permite a transferência quando não há histórico", () => {
  assert.deepEqual(evaluateTicketTransfer([], {
    ticketId: "ticket-1",
    fromUserId: "user-a",
    toUserId: "user-b"
  }, LIMITS, NOW), { ok: true });
});

test("bloqueia o ingresso ao atingir o limite vitalício", () => {
  const result = evaluateTicketTransfer([
    transfer({ transferredAt: new Date(NOW - 2 * 60 * 1000).toISOString() }),
    transfer({ fromUserId: "user-b", toUserId: "user-c" })
  ], { ticketId: "ticket-1", fromUserId: "user-c", toUserId: "user-d" }, LIMITS, NOW);

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 409);
  assert.equal(result.code, "TICKET_TRANSFER_LIMIT_REACHED");
});

test("aplica intervalo mínimo entre transferências do mesmo ingresso", () => {
  const result = evaluateTicketTransfer([
    transfer({ transferredAt: new Date(NOW - 5 * 1000).toISOString() })
  ], { ticketId: "ticket-1", fromUserId: "user-b", toUserId: "user-c" }, LIMITS, NOW);

  assert.equal(result.code, "TICKET_TRANSFER_COOLDOWN");
  assert.equal(result.retryAfter, 25);
});

test("limita transferências enviadas por usuário dentro da janela", () => {
  const history = ["ticket-a", "ticket-b", "ticket-c"].map((ticketId, index) => transfer({
    ticketId,
    transferredAt: new Date(NOW - (index + 1) * 60 * 1000).toISOString()
  }));
  const result = evaluateTicketTransfer(history, {
    ticketId: "ticket-new",
    fromUserId: "user-a",
    toUserId: "user-c"
  }, LIMITS, NOW);

  assert.equal(result.code, "TICKET_TRANSFER_USER_LIMIT_REACHED");
  assert.ok(result.retryAfter > 0);
});

test("limita transferências recebidas por usuário dentro da janela", () => {
  const history = ["a", "b", "c", "d"].map((suffix, index) => transfer({
    ticketId: `ticket-${suffix}`,
    fromUserId: `sender-${suffix}`,
    toUserId: "recipient",
    transferredAt: new Date(NOW - (index + 1) * 60 * 1000).toISOString()
  }));
  const result = evaluateTicketTransfer(history, {
    ticketId: "ticket-new",
    fromUserId: "user-a",
    toUserId: "recipient"
  }, LIMITS, NOW);

  assert.equal(result.code, "TICKET_TRANSFER_RECIPIENT_LIMIT_REACHED");
});
