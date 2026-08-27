const assert = require("assert");
const point = require("../backend/services/cardTerminalProvider");

const originalFetch = global.fetch;
const calls = [];

global.fetch = async (url, options = {}) => {
  calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
  if (url.endsWith("/terminals/v1/list")) {
    return new Response(JSON.stringify({ data: [{ id: "PAX_A910__123", name: "Caixa", status: "active", operating_mode: "PDV" }] }), { status: 200 });
  }
  if (url.endsWith("/cancel")) {
    return new Response(JSON.stringify({ id: "ORD_POINT_1", external_reference: "point-venda-1", status: "canceled", total_amount: "35.00" }), { status: 200 });
  }
  if (url.endsWith("/v1/orders/ORD_POINT_1")) {
    return new Response(JSON.stringify({
      id: "ORD_POINT_1",
      external_reference: "point-venda-1",
      status: "processed",
      status_detail: "accredited",
      total_amount: "35.00",
      total_paid_amount: "35.00",
      config: { point: { terminal_id: "PAX_A910__123" } },
      transactions: { payments: [{ id: "PAY_POINT_1", amount: "35.00", paid_amount: "35.00", payment_method: { id: "master", type: "credit_card" } }] }
    }), { status: 200 });
  }
  return new Response(JSON.stringify({
    id: "ORD_POINT_1",
    external_reference: "point-venda-1",
    status: "created",
    total_amount: "35.00",
    config: { point: { terminal_id: "PAX_A910__123" } },
    transactions: { payments: [{ amount: "35.00" }] }
  }), { status: 201 });
};

async function run() {
  const config = {
    enabled: true,
    pointEnabled: true,
    accessToken: "TEST_TOKEN_SECRET",
    pointDeviceId: "PAX_A910__123",
    pointPrintOnTerminal: "seller_ticket",
    pointExpirationTime: "PT15M"
  };

  assert.equal(point.configured(config), true);
  assert.equal(point.configured({ ...config, pointDeviceId: "" }), false);

  const created = await point.createPayment({ id: "venda 1", totalPrice: 35 }, config, {
    externalReference: "point-venda-1",
    idempotencyKey: "idem-point-venda-1",
    ticketNumber: "bilheteria-1",
    description: "Dois ingressos Cine Cruzeiro"
  });
  assert.equal(created.status, "pending");
  assert.equal(created.id, "ORD_POINT_1");
  const createCall = calls.find((call) => call.url.endsWith("/v1/orders") && call.options.method === "POST");
  assert.ok(createCall);
  assert.equal(createCall.options.headers["X-Idempotency-Key"], "idem-point-venda-1");
  assert.equal(createCall.body.type, "point");
  assert.equal(createCall.body.external_reference, "point-venda-1");
  assert.equal(createCall.body.transactions.payments[0].amount, "35.00");
  assert.equal(createCall.body.config.point.terminal_id, "PAX_A910__123");
  assert.equal(createCall.body.config.point.print_on_terminal, "seller_ticket");
  assert.equal(createCall.body.expiration_time, "PT15M");
  assert.equal(createCall.options.headers.Authorization, "Bearer TEST_TOKEN_SECRET");
  assert.equal(JSON.stringify(createCall.body).includes("TEST_TOKEN_SECRET"), false);

  const approved = await point.getStatus("ORD_POINT_1", config);
  assert.equal(approved.status, "approved");
  assert.equal(approved.paymentId, "PAY_POINT_1");
  assert.equal(approved.paymentMethod, "master");
  assert.equal(approved.paidAmount, 35);

  const terminals = await point.listTerminals(config);
  assert.deepEqual(terminals.map((terminal) => terminal.id), ["PAX_A910__123"]);
  assert.equal(terminals[0].operatingMode, "PDV");

  const cancelled = await point.cancelPayment("ORD_POINT_1", config, { idempotencyKey: "cancel-1" });
  assert.equal(cancelled.status, "cancelled");
  const cancelCall = calls.find((call) => call.url.endsWith("/cancel"));
  assert.equal(cancelCall.options.headers["X-Idempotency-Key"], "cancel-1");

  assert.equal(point.safeReference("Venda balcão: sessão 19:00"), "Venda-balcao-sessao-19-00");
  console.log("Mercado Pago Point tests passed");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
  });
