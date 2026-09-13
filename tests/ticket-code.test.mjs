import test from "node:test";
import assert from "node:assert/strict";
import ticketCodeService from "../backend/services/ticketCodeService.js";

test("novos ingressos usam código curto de oito dígitos", () => {
  const existing = Array.from({ length: 50 }, () => ({ code: ticketCodeService.createTicketCode() }));
  const code = ticketCodeService.createTicketCode(existing);
  assert.match(code, /^CC-\d{8}$/);
  assert.equal(existing.some((ticket) => ticket.code === code), false);
  assert.equal(ticketCodeService.qrPayload(code), `CINECRUZEIRO:TICKET:${code}`);
});

test("ingressos legados recebem alias curto sem invalidar código antigo", () => {
  const legacy = { code: "CC-57E5D58D1AD3709D1E8178FD82AEF8D9" };
  const shortCode = ticketCodeService.displayCode(legacy);
  assert.match(shortCode, /^CC-\d{8}$/);
  assert.equal(ticketCodeService.findTicketByCode([legacy], legacy.code), legacy);
  assert.equal(ticketCodeService.findTicketByCode([legacy], shortCode), legacy);
  assert.equal(ticketCodeService.normalizeCode(ticketCodeService.qrPayload(shortCode)), shortCode);
});

test("alias ambíguo nunca valida o ingresso errado", () => {
  const first = { code: "CC-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", shortCode: "CC-12345678" };
  const second = { code: "CC-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", shortCode: "CC-12345678" };
  assert.equal(ticketCodeService.findTicketByCode([first, second], "CC-12345678"), null);
});
