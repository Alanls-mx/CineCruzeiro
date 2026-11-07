import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { toCustomerTicketDto } = require("../backend/services/customerTicketDtoService.js");
const { createCustomerTicketReadRoutes } = require("../backend/services/customerTicketReadRoutes.js");
const source = fs.readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const projectionCode = source.slice(source.indexOf("function enrichTicket("), source.indexOf("const { canTransferTicket }", source.indexOf("function enrichTicket(")));

const order = { id: "order-1", customerUserId: "owner", customerEmail: "owner@example.test", status: "paid", paymentStatus: "approved" };
const movie = { title: "Filme Sintético", posterUrl: "/uploads/poster.webp" };
const session = { id: "session-1", date: "2026-11-10", time: "20:00", room: "Sala 2", capacity: 50, status: "available" };
const room = { capacity: 50 };
const dependencies = {
  orderForTicket: () => order, movieForTicket: () => movie, sessionForTicket: () => session,
  roomForSession: () => room, roomDisplayLabel: () => "Sala 2",
  ticketArchiveAt: () => new Date("2026-11-11T03:00:00Z"),
  effectiveTicketStatus: (ticket) => ticket.status,
  sessionTicketStats: () => ({ sold: 2 }), todayIsoDate: () => "2026-11-07",
  orderTicketsSorted: (_db, orderId) => [{ id: "ticket-1", orderId }],
  concessionOrdersForTicket: () => [], pendingConcessionOrdersForTicket: () => [],
  ticketCanRedeemPendingConcessionsToday: () => false,
  assetRecord: (item) => item, canTransferTicket: (_db, ticket) => ({ ok: ticket.status === "active", message: "Indisponível" }),
  ticketCodeService: { displayCode: () => "CC-0001" }, ticketQrPayload: () => "display-only",
  publicAssetUrl: (value) => `/projects/cinema${value}`,
  shortOrderReference: () => "FILM-001"
};
const enrichTicket = vm.runInNewContext(`${projectionCode}\nenrichTicket`, dependencies);

test("projeção original distingue ingresso ativo, usado, cancelado e arquivado sem alterar estado", () => {
  for (const status of ["active", "used", "cancelled", "archived"]) {
    const ticket = { id: "ticket-1", orderId: "order-1", customerUserId: "owner", status, code: "secret-code", qrToken: "secret-token" };
    const before = JSON.stringify(ticket);
    const enriched = enrichTicket({}, ticket);
    const customer = toCustomerTicketDto(enriched);
    assert.equal(JSON.stringify(ticket), before);
    assert.equal(enriched.status, status);
    assert.equal(enriched.sessionAvailable, 48);
    assert.equal(enriched.posterUrl, "/projects/cinema/uploads/poster.webp");
    assert.equal(customer.archived, status !== "active");
    assert.equal(customer.code, status === "active" ? "CC-0001" : undefined);
    assert.equal(JSON.stringify(customer).includes("secret-token"), false);
    assert.equal(JSON.stringify(customer).includes("owner@example.test"), false);
  }
});

test("rota de detalhe consulta propriedade antes de projetar e não revela ingresso alheio", () => {
  const replies = [];
  let projected = 0;
  const routes = createCustomerTicketReadRoutes({
    getOwnedTicket: () => null,
    enrichTicket: () => { projected++; return {}; },
    toCustomerTicketDto,
    sendJson: (_res, status, payload) => replies.push({ status, payload })
  });
  assert.equal(routes.handleCustomerTicketDetailRead({ res: {}, method: "GET", action: "", db: {}, ticketId: "foreign", user: { id: "other" } }), true);
  assert.equal(replies[0].status, 404);
  assert.equal(replies[0].payload.error.code, "TICKET_NOT_FOUND");
  assert.equal(projected, 0);
});
