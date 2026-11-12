import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { attachQuickSaleAttendeeNames } = require("../backend/services/boxOfficeAttendeeNames.js");
const { createTicketIssuanceService } = require("../backend/services/ticketIssuanceService.js");
const { ticketPrintContent } = require("../backend/services/cardTerminalProvider.js");
const { createSessionTicketManifestPdf } = require("../backend/services/sessionTicketManifestPdfService.js");

test("venda rápida exige um nome por ingresso físico, inclusive pacotes, antes da emissão", () => {
  const order = { id: "order-1", sessionId: "session-1", ticketItems: [{ name: "Pacote", quantity: 1, bundleQuantity: 2, ticketQuantity: 2 }], selectedSeats: [{ id: "A1", label: "A1" }, { id: "A2", label: "A2" }] };
  for (const names of [[], ["Ana Silva"], ["Ana Silva", ""], ["Ana Silva", "\u0000Bruno"]]) {
    assert.throws(() => attachQuickSaleAttendeeNames(order, names), (error) => error.statusCode === 422);
  }
  attachQuickSaleAttendeeNames(order, ["  Ana   Silva  ", "Bruno Lima"]);
  const tickets = createTicketIssuanceService({ todayIsoDate: () => "2026-11-12", fallbackCustomerName: "Cliente" }).buildTicketsForOrder(order, { tickets: [], orders: [] }, "box_office");
  assert.deepEqual(tickets.map((ticket) => ticket.customerName), ["Ana Silva", "Bruno Lima"]);
  assert.deepEqual(tickets.map((ticket) => ticket.seat), ["A1", "A2"]);
  const print = ticketPrintContent(tickets, [], "Cine Gama");
  assert.match(print, /Cliente: Ana Silva/);
  assert.match(print, /Cliente: Bruno Lima/);
});

test("PDF da sessão inclui online e presencial e exclui cancelados", () => {
  const { pdfRect, pdfLine, pdfWriteText, buildPdf } = require("../backend/services/ticketDocumentPdfService.js").createTicketDocumentPdfService({});
  const pdf = createSessionTicketManifestPdf({ pdfRect, pdfLine, pdfWriteText, buildPdf })({
    cinemaName: "Cine Gama",
    movie: { title: "Filme" }, session: { id: "s1", date: "2026-11-12", time: "20:00", room: "Sala 1" },
    generatedAt: new Date("2026-11-12T20:00:00Z"),
    tickets: [
      { sessionId: "s1", status: "active", code: "CC-1", customerName: "Ana Silva", source: "online", seat: "A1" },
      { sessionId: "s1", status: "used", code: "CC-2", customerName: "João da Silva", source: "box_office", seat: "A2" },
      { sessionId: "s1", status: "cancelled", code: "CC-3", customerName: "Cancelado" },
      { sessionId: "s2", status: "active", code: "CC-4", customerName: "Outra sessão" }
    ]
  });
  const content = pdf.toString("latin1");
  assert.match(content, /^%PDF-1\.4/);
  assert.match(content, /CINE GAMA/);
  assert.match(content, /Ana Silva/);
  assert.match(content, /Jo\\343o da Silva/);
  assert.match(content, /WinAnsiEncoding/);
  assert.match(content, /Presencial/);
  assert.match(content, /Online/);
  assert.doesNotMatch(content, /Cancelado|Outra sessao/);
  assert.match(content, /12\/11\/2026/);
});

test("lista longa da sessão é paginada com cabeçalho em cada página", () => {
  const { pdfRect, pdfLine, pdfWriteText, buildPdf } = require("../backend/services/ticketDocumentPdfService.js").createTicketDocumentPdfService({});
  const tickets = Array.from({ length: 29 }, (_, index) => ({ sessionId: "s1", status: "active", code: `CC-${index}`, customerName: `Cliente ${index}`, seat: `A${index + 1}`, source: "online" }));
  const pdf = createSessionTicketManifestPdf({ pdfRect, pdfLine, pdfWriteText, buildPdf })({ movie: { title: "Filme" }, session: { id: "s1" }, tickets });
  const content = pdf.toString("latin1");
  assert.match(content, /\/Count 2/);
  assert.equal((content.match(/LISTA DA SESS/g) || []).length, 2);
  assert.match(content, /Cliente 28/);
});
