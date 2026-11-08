"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertDisposableTestDatabase } = require("./test-postgres-safety");

async function start() {
  if (process.env.NODE_ENV !== "test" || process.env.DATA_STORE !== "postgres"
      || process.env.PAYMENTS_MODE !== "test" || !process.env.TEST_DATABASE_URL
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("A segunda instância financeira exige PostgreSQL descartável e provedor simulado.");
  }
  const callFile = path.resolve(process.env.CINE_FINANCIAL_CALL_FILE || "");
  if (path.dirname(callFile) !== path.resolve(os.tmpdir()) || !path.basename(callFile).startsWith("cine-financial-calls-")) {
    throw new Error("Arquivo de chamadas sintéticas fora do diretório descartável.");
  }
  await assertDisposableTestDatabase(process.env.TEST_DATABASE_URL);
  const paymentService = require("../backend/services/paymentService");
  const originalCreate = paymentService.createMercadoPagoOrderPayment;
  paymentService.createMercadoPagoOrderPayment = async (order, config, options) => {
    fs.appendFileSync(callFile, `${options.idempotencyKey || order.idempotencyKey || order.id}\n`);
    return originalCreate(order, config, options);
  };
  const server = require("../backend/server.js");
  if (server.listening) process.send?.({ type: "ready" });
  else server.once("listening", () => process.send?.({ type: "ready" }));
}

start().catch((error) => { console.error(error); process.exitCode = 1; });
