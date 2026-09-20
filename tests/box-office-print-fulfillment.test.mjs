import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = fs.readFileSync(path.join(root, "backend/server.js"), "utf8");

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
