import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = fs.readFileSync(path.join(root, "backend/server.js"), "utf8");
const admin = fs.readFileSync(path.join(root, "backend/public/admin.js"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "backend/public/admin.html"), "utf8");
const orderStatusMigration = fs.readFileSync(path.join(root, "backend/db/migrations/037_orders_print_fulfillment_status.sql"), "utf8");

function extract(name) {
  const start = server.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = server.indexOf("\nfunction ", start + 1);
  return server.slice(start, end < 0 ? undefined : end);
}

function fulfillment() {
  const context = vm.createContext({
    buildTicketsForOrder: (order) => [{ id: `ticket-${order.id}`, orderId: order.id, code: `CC-${order.id}`, status: "active" }],
    ticketUnitPricesForOrder: () => [10],
    confirmConcessionStock: () => {},
    materializeOrderAccounting: () => {}
  });
  vm.runInContext([
    extract("orderRequiresConfirmedPrint"),
    extract("stagePaidOrderForPrint"),
    extract("finalizePaidOrder")
  ].join("\n"), context);
  return context;
}

test("a venda presencial paga só ativa o ingresso depois da confirmação de impressão", () => {
  const { orderRequiresConfirmedPrint, stagePaidOrderForPrint, finalizePaidOrder } = fulfillment();
  const order = { id: "sale-1", saleMode: "quick", selectedSeatIds: ["A1"] };
  const payment = { status: "approved" };
  const db = { orders: [order], tickets: [], orderServiceItems: [] };

  assert.equal(orderRequiresConfirmedPrint(order), true);
  const staged = stagePaidOrderForPrint(db, order, payment);
  assert.equal(order.status, "paid_pending_print");
  assert.equal(staged.length, 1);
  assert.equal(db.tickets.length, 0);
  assert.equal(order.printFulfillment.status, "pending");

  const issued = finalizePaidOrder(db, order, payment, "box_office");
  assert.equal(order.status, "paid");
  assert.equal(issued.length, 1);
  assert.equal(db.tickets.length, 1);
  assert.equal(order.pendingPrintTickets, undefined);
  assert.equal(order.printFulfillment.status, "printed");
  assert.equal(finalizePaidOrder(db, order, payment, "box_office").length, 1);
  assert.equal(db.tickets.length, 1);
});

test("a entrega online não é rotulada como impressão física", () => {
  const { orderRequiresConfirmedPrint, finalizePaidOrder } = fulfillment();
  const order = { id: "online-1", saleMode: "registered", ticketDeliveryMethod: "online" };
  const db = { orders: [order], tickets: [], orderServiceItems: [] };

  assert.equal(orderRequiresConfirmedPrint(order), false);
  finalizePaidOrder(db, order, { status: "approved" }, "online");
  assert.equal(order.status, "paid");
  assert.equal(order.printFulfillment, undefined);
});

test("o schema aceita o estágio pago aguardando impressão", () => {
  assert.match(orderStatusMigration, /'paid_pending_print'/);
  assert.match(orderStatusMigration, /ADD CONSTRAINT orders_status_check/);
  assert.match(server, /LATEST_SCHEMA_MIGRATION = "037_orders_print_fulfillment_status\.sql"/);
});

test("a bilheteria exibe a recuperação da impressão na aba correta", () => {
  const boxOfficeStart = adminHtml.indexOf('id="boxOfficeNewSale"');
  const boxOfficeEnd = adminHtml.indexOf('id="boxOfficeValidateTicket"');
  const printPanel = adminHtml.indexOf('id="pointPaymentPanel"');
  assert.ok(boxOfficeStart < printPanel && printPanel < boxOfficeEnd);
  assert.match(admin, /document\.querySelector\("#boxOfficeNewSale \.box-office-sale-workspace"\)\.hidden = true/);
  assert.match(admin, /document\.querySelector\("#boxOfficeNewSale \.box-office-sale-workspace"\)\.hidden = false/);
});

test("uma venda física em dinheiro exige impressora instalada antes de criar pedido", () => {
  const preflight = admin.indexOf("const printer = await window.cineDesktop.checkPrinter()");
  const createSale = admin.indexOf('const result = await api("/api/box-office/sales"');
  assert.ok(preflight > 0 && preflight < createSale);
  assert.match(admin, /if \(!printer\.ready\)/);
});

test("a reimpressão no aplicativo usa a impressora nativa", () => {
  const start = admin.indexOf("function printOrderTicket(orderId)");
  const end = admin.indexOf("\nasync function resendOrderTicket", start);
  const source = admin.slice(start, end);
  assert.match(source, /window\.cineDesktop\.printUrl\(url, `order-\$\{orderId\}`\)/);
  assert.ok(source.indexOf("window.cineDesktop.printUrl") < source.indexOf("window.open(url"));
  assert.match(admin, /\^\(order-\|ticket-\)/);
});
