const fs = require("node:fs");
const pointProvider = require("../backend/services/cardTerminalProvider");

if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URL || !process.env.CINE_POINT_CROSS_CALL_FILE) {
  throw new Error("A segunda instancia Point so pode iniciar no smoke PostgreSQL descartavel.");
}

pointProvider.terminalConnection = async () => ({ connected: true, terminal: { id: "smoke-point-terminal" } });
pointProvider.createPayment = async (order, _config, options) => {
  fs.appendFileSync(process.env.CINE_POINT_CROSS_CALL_FILE, `${options.idempotencyKey}\n`);
  return {
    id: "ORD-SMOKE-CROSS-INSTANCE", externalReference: options.externalReference,
    idempotencyKey: options.idempotencyKey, status: "pending", providerStatus: "at_terminal",
    amount: Number(order.totalPrice), terminalId: "smoke-point-terminal"
  };
};
pointProvider.getStatus = async (id) => {
  const db = await require("../backend/db/postgresStore").readDbFromPostgres({ trackChanges: false });
  const payment = (db.payments || []).find((item) => item.providerPaymentId === id);
  if (!payment) throw Object.assign(new Error("Mock Point order missing"), { statusCode: 404 });
  return {
    id, externalReference: payment.providerReference, status: "pending", providerStatus: "at_terminal",
    amount: Number(payment.amount), terminalId: "smoke-point-terminal"
  };
};

require("./test-postgres-safety").assertDisposableTestDatabase(process.env.TEST_DATABASE_URL)
  .then(() => require("../backend/server.js"))
  .catch((error) => { console.error(error); process.exitCode = 1; });
