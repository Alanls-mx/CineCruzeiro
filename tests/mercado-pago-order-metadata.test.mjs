import test from "node:test";
import assert from "node:assert/strict";
import paymentService from "../backend/services/paymentService.js";

const config = { environment: "sandbox", publicKey: "TEST-public", accessToken: "TEST-private" };

async function captureOrder(order, options = {}, respond = (request) => new Response(JSON.stringify({
  id: "mp-order",
  transactions: { payments: [{ status: "processed", status_detail: "accredited", amount: request.body.total_amount }] }
}), { status: 201, headers: { "content-type": "application/json" } })) {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, request) => {
    captured = { body: JSON.parse(request.body), headers: request.headers };
    return respond({ ...request, body: captured.body });
  };
  try {
    await paymentService.createMercadoPagoOrderPayment(order, config, {
      method: "credit_card", sandboxTest: true,
      card: { token: "card-token", paymentMethodId: "visa", installments: 1 },
      ...options
    });
    return captured;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function header(headers, name) {
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

test("SDK oficial cria Order com itens, comprador, fatura, idempotência e Device ID", async () => {
  const { body, headers } = await captureOrder({
    id: "order-123", movieTitle: "Filme teste", totalPrice: 29.99,
    customerEmail: "cliente@example.com", customerName: "Maria Silva Souza",
    customerCpf: "123.456.789-09", customerRegisteredAt: "2024-02-03T14:15:16.000Z",
    ticketItems: [{ id: "inteira", name: "Inteira", quantity: 2, unitPrice: 12.5 }],
    concessionItems: [{ id: "pipoca", name: "Pipoca pequena", quantity: 1, unitPrice: 7 }]
  }, { deviceId: "device-session-123", statementDescriptor: "CINE CRUZEIRO" });

  assert.deepEqual(body.payer, {
    email: "cliente@example.com", first_name: "Maria", last_name: "Silva Souza",
    identification: { type: "CPF", number: "12345678909" }
  });
  assert.equal(body.additional_info["payer.registration_date"], "2024-02-03T14:15:16.000Z");
  assert.equal(body.transactions.payments[0].payment_method.statement_descriptor, "CINE CRUZEIRO");
  assert.equal(header(headers, "X-meli-session-id"), "device-session-123");
  assert.equal(header(headers, "X-Idempotency-Key"), "order-123");
  assert.ok(header(headers, "X-Product-Id"));
  assert.match(header(headers, "User-Agent"), /^MercadoPago Node\.js SDK/);
  assert.equal(body.items.reduce((sum, item) => sum + item.quantity, 0), 3);
  assert.equal(body.items.reduce((sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity, 0), 2999);
  assert.ok(body.items.every((item) => item.title && item.category_id && Number(item.unit_price) >= 0));
  assert.ok(body.items.some((item) => item.title.includes("Inteira") && item.category_id === "tickets"));
  assert.ok(body.items.some((item) => item.title.includes("Pipoca") && item.category_id === "food"));
});

test("Mercado Pago nao inventa nome, CPF nem data de cadastro ausentes", async () => {
  const { body, headers } = await captureOrder({
    id: "order-124", totalPrice: 10, customerEmail: "cliente@example.com",
    ticketItems: [{ id: "inteira", quantity: 1, unitPrice: 10 }]
  });
  assert.deepEqual(body.payer, { email: "cliente@example.com" });
  assert.equal(body.additional_info, undefined);
  assert.equal(headers["X-meli-session-id"], undefined);
  assert.equal(body.transactions.payments[0].payment_method.statement_descriptor, "CINE CRUZEIRO");
});

test("Mercado Pago recusa itens que nao compoem o total cobrado", async () => {
  await assert.rejects(captureOrder({
    id: "order-125", totalPrice: 11, customerEmail: "cliente@example.com",
    ticketItems: [{ id: "inteira", quantity: 1, unitPrice: 10 }]
  }), { code: "MERCADO_PAGO_ITEMS_TOTAL_MISMATCH" });
});

test("SDK mantém o mapeamento do Mercado Pago para pagador de teste inválido", async () => {
  await assert.rejects(captureOrder({
    id: "order-126", totalPrice: 10, customerEmail: "test@testuser.com",
    ticketItems: [{ id: "inteira", quantity: 1, unitPrice: 10 }]
  }, {}, () => new Response(JSON.stringify({
    message: "Invalid users involved",
    cause: [{ code: "invalid_users_involved" }]
  }), { status: 422, headers: { "content-type": "application/json" } })), {
    code: "MERCADO_PAGO_INVALID_USERS_INVOLVED",
    statusCode: 422
  });
});

test("Order de Pix não inclui descritor exclusivo de cartão", async () => {
  const { body } = await captureOrder({
    id: "order-pix", totalPrice: 10, customerEmail: "cliente@example.com",
    ticketItems: [{ id: "inteira", quantity: 1, unitPrice: 10 }]
  }, { method: "pix" });
  assert.equal(body.transactions.payments[0].payment_method.id, "pix");
  assert.equal(body.transactions.payments[0].payment_method.statement_descriptor, undefined);
});
