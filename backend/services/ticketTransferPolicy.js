const DEFAULT_TRANSFER_LIMITS = Object.freeze({
  maxPerTicketPerWindow: 1,
  maxOutgoingPerWindow: 10,
  maxIncomingPerWindow: 20,
  windowMs: 24 * 60 * 60 * 1000,
  cooldownMs: 30 * 1000
});

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function transferLimits(env = process.env) {
  return {
    maxPerTicketPerWindow: boundedInteger(env.TICKET_TRANSFER_MAX_PER_TICKET_DAY, DEFAULT_TRANSFER_LIMITS.maxPerTicketPerWindow, 1, 10),
    maxOutgoingPerWindow: boundedInteger(env.TICKET_TRANSFER_MAX_PER_USER_DAY, DEFAULT_TRANSFER_LIMITS.maxOutgoingPerWindow, 1, 100),
    maxIncomingPerWindow: boundedInteger(env.TICKET_TRANSFER_MAX_INCOMING_DAY, DEFAULT_TRANSFER_LIMITS.maxIncomingPerWindow, 1, 200),
    windowMs: boundedInteger(env.TICKET_TRANSFER_WINDOW_MINUTES, DEFAULT_TRANSFER_LIMITS.windowMs / 60000, 10, 7 * 24 * 60) * 60000,
    cooldownMs: boundedInteger(env.TICKET_TRANSFER_COOLDOWN_SECONDS, DEFAULT_TRANSFER_LIMITS.cooldownMs / 1000, 5, 3600) * 1000
  };
}

function transferTimestamp(transfer = {}) {
  const timestamp = new Date(transfer.transferredAt || transfer.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function retryAfterForWindow(records, now, windowMs) {
  const oldest = records.reduce((minimum, transfer) => Math.min(minimum, transferTimestamp(transfer) || now), now);
  return Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
}

function reject(code, message, statusCode, retryAfter = 0) {
  return { ok: false, code, message, statusCode, retryAfter };
}

function evaluateTicketTransfer(transfers = [], context = {}, limits = transferLimits(), nowValue = Date.now()) {
  const now = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue || Date.now());
  const history = Array.isArray(transfers) ? transfers : [];
  const ticketHistory = history
    .filter((transfer) => String(transfer.ticketId || "") === String(context.ticketId || ""))
    .sort((left, right) => transferTimestamp(right) - transferTimestamp(left));

  const windowStart = now - limits.windowMs;
  const recentTicketTransfers = ticketHistory.filter((transfer) => transferTimestamp(transfer) > windowStart);
  if (recentTicketTransfers.length >= limits.maxPerTicketPerWindow) {
    return reject(
      "TICKET_TRANSFER_DAILY_LIMIT_REACHED",
      "Aguarde o fim do período de 24 horas. Este ingresso já foi transferido uma vez neste intervalo.",
      429,
      retryAfterForWindow(recentTicketTransfers, now, limits.windowMs)
    );
  }

  const latestTicketTransferAt = transferTimestamp(ticketHistory[0]);
  if (latestTicketTransferAt && latestTicketTransferAt + limits.cooldownMs > now) {
    const retryAfter = Math.max(1, Math.ceil((latestTicketTransferAt + limits.cooldownMs - now) / 1000));
    return reject("TICKET_TRANSFER_COOLDOWN", "Aguarde alguns instantes antes de transferir este ingresso novamente.", 429, retryAfter);
  }

  if (context.fromUserId) {
    const outgoing = history.filter((transfer) =>
      String(transfer.fromUserId || "") === String(context.fromUserId) && transferTimestamp(transfer) > windowStart
    );
    if (outgoing.length >= limits.maxOutgoingPerWindow) {
      return reject(
        "TICKET_TRANSFER_USER_LIMIT_REACHED",
        `Sua conta atingiu o limite de ${limits.maxOutgoingPerWindow} transferencia(s) neste periodo.`,
        429,
        retryAfterForWindow(outgoing, now, limits.windowMs)
      );
    }
  }

  if (context.toUserId) {
    const incoming = history.filter((transfer) =>
      String(transfer.toUserId || "") === String(context.toUserId) && transferTimestamp(transfer) > windowStart
    );
    if (incoming.length >= limits.maxIncomingPerWindow) {
      return reject(
        "TICKET_TRANSFER_RECIPIENT_LIMIT_REACHED",
        "O destinatario atingiu o limite temporario de ingressos recebidos.",
        429,
        retryAfterForWindow(incoming, now, limits.windowMs)
      );
    }
  }

  return { ok: true };
}

module.exports = {
  DEFAULT_TRANSFER_LIMITS,
  evaluateTicketTransfer,
  transferLimits,
  _test: { boundedInteger, retryAfterForWindow, transferTimestamp }
};
