import { test } from "node:test";
import assert from "node:assert/strict";
import validationFactory from "../backend/services/ticketValidationService.js";
import ticketCodeService from "../backend/services/ticketCodeService.js";

let archives = 0;
const validation = validationFactory.createTicketValidationService({
  enrichTicket: (_db, ticket) => ({ id: ticket.id, status: ticket.status }),
  effectiveTicketStatus: (ticket) => ticket.status,
  sessionForTicket: () => null,
  checkAndAutoArchiveOrder: () => { archives += 1; }
});
const ticket = () => ({ id: "ingresso", code: "CC-12345678", qrToken: "a".repeat(32), orderId: "pedido", sessionId: "sessao", status: "active" });
const db = (orderStatus = "paid") => ({
  tickets: [ticket()], orders: [{ id: "pedido", sessionId: "sessao", status: orderStatus }],
  movies: [{ title: "Filme", sessions: [{ id: "sessao", date: "2026-11-06", time: "20:00" }, { id: "outra", date: "2026-11-07", time: "21:00" }] }]
});

test("QR de ingresso pago valida uma vez e mantém atribuição ao operador", () => {
  const state = db();
  const qr = ticketCodeService.qrPayload(state.tickets[0].code, state.tickets[0].qrToken);
  const used = validation.validateTicket(state, qr, { id: "operador" }, "sessao");
  assert.equal(used.status, "used");
  assert.equal(used.usedBy, "operador");
  assert.equal(archives, 1);
  assert.throws(() => validation.validateTicket(state, qr, { id: "operador" }, "sessao"),
    (error) => error.code === "TICKET_ALREADY_USED" && error.statusCode === 409);
});

test("pedido pendente e sessão divergente não liberam ingresso", () => {
  const pending = db("pending_payment");
  assert.throws(() => validation.inspectTicket(pending, "CC-12345678", "sessao"),
    (error) => error.code === "TICKET_PAYMENT_PENDING" && error.statusCode === 409);
  assert.throws(() => validation.inspectTicket(db(), "CC-12345678", "outra"),
    (error) => error.code === "TICKET_SESSION_MISMATCH" && error.statusCode === 409);
});
