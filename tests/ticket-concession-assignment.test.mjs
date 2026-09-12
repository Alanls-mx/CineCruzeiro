import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  assignConcessionsToTicket,
  concessionOrdersForTicket,
  concessionTicketIdForOrder,
  pendingConcessionOrdersForTicket
} = require("../backend/services/ticketConcessionAssignmentService");

function database() {
  return {
    tickets: [
      { id: "ticket-a", orderId: "order-a", createdAt: "2026-09-12T10:00:00.000Z" },
      { id: "ticket-b", orderId: "order-a", createdAt: "2026-09-12T10:01:00.000Z" },
      { id: "ticket-c", orderId: "order-b", createdAt: "2026-09-12T11:00:00.000Z" }
    ],
    orders: [
      { id: "order-a", concessionItems: [{ id: "popcorn", quantity: 1 }] },
      { id: "order-b", concessionItems: [{ id: "soda", quantity: 2 }] }
    ]
  };
}

test("vincula a bomboniere ao primeiro ingresso do pedido por compatibilidade", () => {
  const db = database();
  assert.equal(concessionTicketIdForOrder(db, db.orders[0]), "ticket-a");
  assert.deepEqual(concessionOrdersForTicket(db, db.tickets[0]).map((order) => order.id), ["order-a"]);
});

test("mantém a bomboniere com outro ingresso ativo sem mover valores entre pedidos", () => {
  const db = database();
  const originalItems = db.orders[0].concessionItems;
  assignConcessionsToTicket([db.orders[0]], "ticket-c", "2026-09-12T12:00:00.000Z");

  assert.equal(db.orders[0].concessionTicketId, "ticket-c");
  assert.equal(db.orders[0].concessionTicketUpdatedAt, "2026-09-12T12:00:00.000Z");
  assert.equal(db.orders[0].concessionItems, originalItems);
  assert.equal(db.orders[0].id, "order-a");
  assert.deepEqual(concessionOrdersForTicket(db, db.tickets[2]).map((order) => order.id), ["order-a", "order-b"]);
});

test("ignora associação explícita quando o ingresso não existe", () => {
  const db = database();
  db.orders[0].concessionTicketId = "ticket-removido";
  assert.equal(concessionTicketIdForOrder(db, db.orders[0]), "ticket-a");
});

test("não reassocia bomboniere entregue, cancelada ou reembolsada", () => {
  const db = database();
  db.orders[0].status = "paid";
  db.orders[0].concessionItems[0].fulfilledQuantity = 1;
  db.orders[1].status = "paid";
  db.orders[1].concessionRefund = { status: "completed" };

  assert.deepEqual(pendingConcessionOrdersForTicket(db, db.tickets[0]), []);
  assert.deepEqual(pendingConcessionOrdersForTicket(db, db.tickets[2]), []);
});

test("retorna somente pedidos pagos com itens aguardando retirada", () => {
  const db = database();
  db.orders[0].status = "paid";
  db.orders[1].status = "pending";

  assert.deepEqual(pendingConcessionOrdersForTicket(db, db.tickets[0]).map((order) => order.id), ["order-a"]);
  assert.deepEqual(pendingConcessionOrdersForTicket(db, db.tickets[2]), []);
});
