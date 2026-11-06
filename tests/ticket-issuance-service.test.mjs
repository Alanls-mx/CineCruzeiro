import { test } from "node:test";
import assert from "node:assert/strict";
import issuance from "../backend/services/ticketIssuanceService.js";
import codeService from "../backend/services/ticketCodeService.js";

const { buildTicketsForOrder } = issuance.createTicketIssuanceService({
  todayIsoDate: () => "2026-11-06",
  fallbackCustomerName: "Cliente da instalação"
});

test("pacote gera um ingresso e QR distintos por unidade e mantém assentos", () => {
  const order = {
    id: "pedido", sessionId: "sessao", ticketItems: [{ name: "Combo", quantity: 1, bundleQuantity: 2, ticketQuantity: 2 }],
    selectedSeats: [{ id: "A1", label: "A1" }, { id: "A2", label: "A2" }]
  };
  const tickets = buildTicketsForOrder(order, { tickets: [], orders: [] });
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets.map((ticket) => ticket.seatId), ["A1", "A2"]);
  assert.deepEqual(tickets.map((ticket) => ticket.ticketNumber), [1, 2]);
  assert.notEqual(tickets[0].code, tickets[1].code);
  assert.notEqual(tickets[0].qrToken, tickets[1].qrToken);
  assert.equal(tickets[0].customerName, "Cliente da instalação");
  assert.equal(tickets[0].sessionDate, "2026-11-06");
  assert.deepEqual(codeService.parseQrPayload(tickets[0].qrPayload), { version: 3, code: tickets[0].code, token: tickets[0].qrToken });
});

test("numeração respeita ingressos emitidos e pendentes de impressão", () => {
  const db = {
    tickets: [{ ticketNumber: 4, code: "CC-00000001" }],
    orders: [{ pendingPrintTickets: [{ ticketNumber: 8, code: "CC-00000002" }] }]
  };
  const [ticket] = buildTicketsForOrder({ id: "pedido", fullTicketsCount: 1 }, db, "courtesy");
  assert.equal(ticket.ticketNumber, 9);
  assert.equal(ticket.paymentSource, "courtesy");
});
