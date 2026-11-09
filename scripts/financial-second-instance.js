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
  const refundFile = path.resolve(process.env.CINE_FINANCIAL_REFUND_FILE || "");
  const reconcileFile = path.resolve(process.env.CINE_FINANCIAL_RECONCILE_FILE || "");
  if (path.dirname(callFile) !== path.resolve(os.tmpdir()) || !path.basename(callFile).startsWith("cine-financial-calls-")) {
    throw new Error("Arquivo de chamadas sintéticas fora do diretório descartável.");
  }
  if (path.dirname(refundFile) !== path.resolve(os.tmpdir()) || !path.basename(refundFile).startsWith("cine-financial-refunds-")) {
    throw new Error("Arquivo de estornos sintéticos fora do diretório descartável.");
  }
  if (path.dirname(reconcileFile) !== path.resolve(os.tmpdir()) || !path.basename(reconcileFile).startsWith("cine-financial-reconcile-")) {
    throw new Error("Arquivo de reconciliação sintética fora do diretório descartável.");
  }
  await assertDisposableTestDatabase(process.env.TEST_DATABASE_URL);
  const paymentService = require("../backend/services/paymentService");
  const originalCreate = paymentService.createMercadoPagoOrderPayment;
  let acceptedLost = null;
  paymentService.createMercadoPagoOrderPayment = async (order, config, options) => {
    fs.appendFileSync(callFile, `${options.idempotencyKey || order.idempotencyKey || order.id}\n`);
    const accepted = await originalCreate(order, config, options);
    if (order.id === process.env.CINE_FINANCIAL_LOST_KEY) {
      acceptedLost = { ...accepted, id: "ORD_TEST_CROSS_RECOVERY", status: "approved",
        raw: { currency_id: "BRL" } };
      throw Object.assign(new Error("Synthetic response lost after acceptance"), { statusCode: 504 });
    }
    return accepted;
  };
  paymentService.searchMercadoPagoOrdersByReference = async (reference) => {
    fs.appendFileSync(reconcileFile, `${reference}\n`);
    return acceptedLost && reference === process.env.CINE_FINANCIAL_LOST_KEY
      ? { total: 1, orders: [acceptedLost] } : { total: 0, orders: [] };
  };
  const refundService = require("../backend/services/orderRefundService");
  const originalRefund = refundService.submitFullRefund;
  refundService.submitFullRefund = async (refund, ...args) => {
    fs.appendFileSync(refundFile, `${refund.id}\n`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    return originalRefund(refund, ...args);
  };
  const server = require("../backend/server.js");
  process.on("message", (message) => {
    if (message?.type !== "reconcile" || !acceptedLost) return;
    void server.testOnlinePaymentReconciliation.reconcile(message.paymentId)
      .then((result) => process.send?.({ type: "reconciled", result }))
      .catch((error) => process.send?.({ type: "reconciled", error: error.code || error.message }));
  });
  if (server.listening) process.send?.({ type: "ready" });
  else server.once("listening", () => process.send?.({ type: "ready" }));
}

start().catch((error) => { console.error(error); process.exitCode = 1; });
