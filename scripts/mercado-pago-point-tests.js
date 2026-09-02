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
  if (url.endsWith("/terminals/v1/actions")) {
    return new Response(JSON.stringify({
      id: "PRINT_ACTION_1",
      type: "print",
      external_reference: "print-venda-1",
      status: "created",
      config: { point: { terminal_id: "PAX_A910__123", subtype: "custom" } }
    }), { status: 201 });
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
    description: "Dois ingressos Cine Cruzeiro",
    defaultPaymentType: "qr"
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
  assert.equal(createCall.body.config.payment_method.default_type, "qr");
  assert.equal(createCall.body.expiration_time, "PT15M");
  assert.equal(createCall.options.headers.Authorization, "Bearer TEST_TOKEN_SECRET");
  assert.equal(JSON.stringify(createCall.body).includes("TEST_TOKEN_SECRET"), false);

  await point.createPayment({ id: "venda-debito", totalPrice: 20 }, config, {
    externalReference: "point-venda-debito",
    idempotencyKey: "idem-point-debito",
    defaultPaymentType: "debit_card"
  });
  await point.createPayment({ id: "venda-credito", totalPrice: 20 }, config, {
    externalReference: "point-venda-credito",
    idempotencyKey: "idem-point-credito",
    defaultPaymentType: "credit_card"
  });
  const debitCall = calls.find((call) => call.options.headers?.["X-Idempotency-Key"] === "idem-point-debito");
  const creditCall = calls.find((call) => call.options.headers?.["X-Idempotency-Key"] === "idem-point-credito");
  assert.equal(debitCall.body.config.payment_method.default_type, "debit_card");
  assert.equal(creditCall.body.config.payment_method.default_type, "credit_card");

  const approved = await point.getStatus("ORD_POINT_1", config);
  assert.equal(approved.status, "approved");
  assert.equal(approved.paymentId, "PAY_POINT_1");
  assert.equal(approved.paymentMethod, "master");
  assert.equal(approved.paidAmount, 35);

  const terminals = await point.listTerminals(config);
  assert.deepEqual(terminals.map((terminal) => terminal.id), ["PAX_A910__123"]);
  assert.equal(terminals[0].operatingMode, "PDV");

  const printOrders = [{
    concessionItems: [
      { id: "pipoca", name: "Pipoca Grande", quantity: 2, unitPrice: 18 },
      { id: "refrigerante", name: "Coca-Cola 500ML", quantity: 1, unitPrice: 9 }
    ]
  }];
  const printContent = point.ticketPrintContent([{
    movieTitle: "Filme de Teste",
    sessionDate: "2026-08-27",
    sessionTime: "19:00",
    sessionFormat: "2D Dublado",
    sessionRoom: "Sala Cruzeiro",
    ticketType: "Inteira",
    code: "CC-ABCDEF123456",
    qrPayload: "CINECRUZEIRO:TICKET:CC-ABCDEF123456"
  }], printOrders);
  assert.ok(printContent.includes("27/08/2026 19:00"));
  assert.ok(printContent.includes("{qr}CINECRUZEIRO:TICKET:CC-ABCDEF123456{/qr}"));
  assert.ok(printContent.includes("BOMBONIERE"));
  assert.ok(printContent.includes("2x Pipoca Grande - R$ 36,00"));
  assert.ok(printContent.includes("1x Coca-Cola 500ML - R$ 9,00"));

  const printed = await point.createTicketPrint([{
    movieTitle: "Filme de Teste",
    sessionDate: "2026-08-27",
    sessionTime: "19:00",
    sessionFormat: "2D Dublado",
    sessionRoom: "Sala Cruzeiro",
    ticketType: "Inteira",
    code: "CC-ABCDEF123456",
    qrPayload: "CINECRUZEIRO:TICKET:CC-ABCDEF123456"
  }], config, {
    externalReference: "print-venda-1",
    idempotencyKey: "idem-print-venda-1",
    orders: printOrders
  });
  assert.equal(printed.id, "PRINT_ACTION_1");
  assert.equal(printed.status, "created");
  const printCall = calls.find((call) => call.url.endsWith("/terminals/v1/actions"));
  assert.equal(printCall.options.headers["X-Idempotency-Key"], "idem-print-venda-1");
  assert.equal(printCall.body.type, "print");
  assert.equal(printCall.body.config.point.terminal_id, "PAX_A910__123");
  assert.equal(printCall.body.config.point.subtype, "custom");
  assert.ok(printCall.body.content.includes("Filme de Teste"));
  assert.ok(printCall.body.content.includes("Pipoca Grande"));

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
