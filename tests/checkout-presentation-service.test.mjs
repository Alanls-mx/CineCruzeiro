import { test } from "node:test";
import assert from "node:assert/strict";
import presentation from "../backend/services/checkoutPresentationService.js";

const { checkoutResponse } = presentation.createCheckoutPresentationService({
  enrichTicket: (_db, ticket) => ({ ...ticket, movieTitle: "Filme", status: "active" })
});

test("resposta do checkout não expõe dados pessoais nem metadados de pagamento", () => {
  const result = checkoutResponse({},
    { id: "pedido", customerName: "Pessoa", customerEmail: "pessoa@example.test", customerCpf: "123", customerPhone: "11", metadata: { secret: true } },
    { id: "pagamento", status: "pending", raw: { token: "privado" }, metadata: { secret: true } },
    [{ id: "ingresso", code: "CC-12345678", customerCpf: "123" }]);
  assert.deepEqual(result.order, { id: "pedido" });
  assert.deepEqual(result.payment, { id: "pagamento", status: "pending" });
  assert.equal(result.tickets[0].code, "CC-12345678");
  assert.equal(result.tickets[0].movieTitle, "Filme");
  assert.equal(JSON.stringify(result).includes("customerCpf"), false);
});

test("reuso de checkout respeita método e chave de idempotência", () => {
  const db = {
    orders: [{ id: "pedido", idempotencyKey: "chave" }],
    payments: [{ orderId: "pedido", method: "pix" }],
    tickets: [{ orderId: "pedido", id: "ingresso" }]
  };
  assert.equal(presentation.findExistingCheckout(db, { id: "outro", idempotencyKey: "chave" }, "pix").tickets[0].id, "ingresso");
  assert.equal(presentation.findExistingCheckout(db, { id: "outro", idempotencyKey: "chave" }, "credit_card").payment, undefined);
});
