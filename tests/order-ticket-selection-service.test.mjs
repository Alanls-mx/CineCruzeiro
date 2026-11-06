import { test } from "node:test";
import assert from "node:assert/strict";
import selection from "../backend/services/orderTicketSelectionService.js";

const db = {
  ticketTypes: [
    { id: "full", name: "Inteira", price: 18, active: true },
    { id: "half", name: "Meia", price: 9, active: true },
    { id: "bundle", name: "Combo", price: 30, bundleQuantity: 2, active: true },
    { id: "inactive", name: "Antigo", price: 1, active: false }
  ]
};

test("seleção mantém quantidade comercial e quantidade de ingressos de um pacote", () => {
  const session = { ticketTypeIds: ["bundle"] };
  const items = selection.resolveOrderTicketItems(db, {
    ticketItems: [{ id: "bundle", quantity: 1 }, { ticketTypeId: "bundle", quantity: 2 }]
  }, session);
  assert.deepEqual(items, [{
    id: "bundle", name: "Combo", description: "", quantity: 3,
    bundleQuantity: 2, ticketQuantity: 6, unitPrice: 30
  }]);
});

test("tipo inativo ou fora da sessão mantém o conflito comercial existente", () => {
  for (const id of ["inactive", "half"]) {
    assert.throws(
      () => selection.resolveOrderTicketItems(db, { ticketItems: [{ id, quantity: 1 }] }, { ticketTypeIds: ["full"] }),
      (error) => error.statusCode === 409 && error.code === "SESSION_TICKET_TYPE_UNAVAILABLE"
    );
  }
});

test("pedido legado resolve inteira e meia no catálogo da sessão", () => {
  const items = selection.resolveOrderTicketItems(db, { fullTicketsCount: 2, halfTicketsCount: 1 }, { ticketTypeIds: ["full", "half"] });
  assert.deepEqual(items.map(({ id, quantity, ticketQuantity, unitPrice }) => ({ id, quantity, ticketQuantity, unitPrice })), [
    { id: "full", quantity: 2, ticketQuantity: 2, unitPrice: 18 },
    { id: "half", quantity: 1, ticketQuantity: 1, unitPrice: 9 }
  ]);
});
