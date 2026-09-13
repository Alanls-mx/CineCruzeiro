const crypto = require("crypto");

const SHORT_CODE_PATTERN = /^CC-\d{8}$/;
const LEGACY_CODE_PATTERN = /^CC-[A-F0-9]{8,32}$/;

function normalizeCode(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("CC2.") && raw.length <= 2048) {
    const parts = raw.split(".");
    if (parts.length === 3 && /^[A-Za-z0-9_-]+$/.test(parts[1]) && /^[A-Za-z0-9_-]+$/.test(parts[2])) {
      try {
        const legacy = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        const legacyCode = String(legacy?.c || "").toUpperCase();
        if (legacy?.v === 2 && LEGACY_CODE_PATTERN.test(legacyCode)) return legacyCode;
      } catch {
        // Invalid legacy payloads continue through normal parsing.
      }
    }
  }
  const match = raw.match(/(?:CINECRUZEIRO:TICKET:)?(CC-[A-Z0-9]{8,32})/i);
  return match ? match[1].toUpperCase() : raw.toUpperCase();
}

function deterministicLegacyAlias(code) {
  const digest = crypto.createHash("sha256").update(String(code || "")).digest();
  return `CC-${String(digest.readUInt32BE(0) % 100000000).padStart(8, "0")}`;
}

function displayCode(ticket = {}) {
  const code = normalizeCode(ticket.code || ticket.shortCode || "");
  if (SHORT_CODE_PATTERN.test(code)) return code;
  const persisted = normalizeCode(ticket.shortCode || "");
  if (SHORT_CODE_PATTERN.test(persisted)) return persisted;
  return LEGACY_CODE_PATTERN.test(code) ? deterministicLegacyAlias(code) : code;
}

function createTicketCode(existingTickets = []) {
  const existing = new Set((existingTickets || []).flatMap((ticket) => [
    normalizeCode(ticket?.code),
    normalizeCode(ticket?.shortCode),
    displayCode(ticket)
  ]).filter(Boolean));
  let code = "";
  do {
    code = `CC-${String(crypto.randomInt(0, 100000000)).padStart(8, "0")}`;
  } while (existing.has(code));
  return code;
}

function qrPayload(code) {
  return `CINECRUZEIRO:TICKET:${normalizeCode(code)}`;
}

function findTicketByCode(tickets = [], input) {
  const normalized = normalizeCode(input);
  const matches = (tickets || []).filter((ticket) => {
    const stored = normalizeCode(ticket?.code);
    return stored === normalized
      || normalizeCode(ticket?.shortCode) === normalized
      || displayCode(ticket) === normalized;
  });
  return matches.length === 1 ? matches[0] : null;
}

module.exports = {
  SHORT_CODE_PATTERN,
  createTicketCode,
  displayCode,
  findTicketByCode,
  normalizeCode,
  qrPayload
};
