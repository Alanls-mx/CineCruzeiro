import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const { prepareRefund, submitFullRefund } = require("../backend/services/orderRefundService");
const { createPerformanceMonitor, percentile } = require("../backend/services/performanceMonitor");

const payment = () => ({ provider: "mercado_pago", providerPaymentId: "ORD123", status: "approved", amount: 12.34, metadata: {} });
const order = { id: "order1", totalPrice: 12.34 };

test("refund uses server amount and a durable operation key", () => {
  const p = payment();
  const refund = prepareRefund(p, order);
  assert.equal(refund.amount, 12.34);
  p.metadata.cancellationRefund = refund;
  assert.strictEqual(prepareRefund(p, order), refund);
});

test("refund refuses shared, inconsistent and non-provider payments", () => {
  for (const p of [
    { ...payment(), amount: 20 },
    { ...payment(), provider: "cash" },
    { ...payment(), status: "pending" },
    { ...payment(), metadata: { relatedOrderIds: ["order1", "order2"] } }
  ]) assert.throws(() => prepareRefund(p, order));
});

test("full refund sends empty body and reuses the same key on retries", async () => {
  const refund = prepareRefund(payment(), order);
  const keys = [];
  const request = async (url, options) => {
    assert.equal(url, "https://api.mercadopago.com/v1/orders/ORD123/refund");
    assert.equal(options.body, "{}");
    keys.push(options.headers["X-Idempotency-Key"]);
    return { ok: true, json: async () => ({ id: "ORD123", status: "refunded", transactions: { refunds: [{ id: "REF1" }] } }) };
  };
  await submitFullRefund(refund, "fake-test-token", request);
  await submitFullRefund(refund, "fake-test-token", request);
  assert.deepEqual(keys, [refund.id, refund.id]);
});

test("unknown, partial and failed provider responses never claim full refund", async () => {
  const refund = prepareRefund(payment(), order);
  for (const data of [{}, { id: "ORD123", status: "processed", status_detail: "partially_refunded" }, { id: "ORDOTHER", status: "refunded" }]) {
    await assert.rejects(submitFullRefund(refund, "fake", async () => ({ ok: true, json: async () => data })));
  }
  await assert.rejects(submitFullRefund(refund, "fake", async () => ({ ok: false, json: async () => ({}) })));
  await assert.rejects(submitFullRefund(refund, ""));
});

test("monitor reports host and process separately with bounded samples", async () => {
  assert.equal(percentile([], .95), null);
  assert.equal(percentile([100, 2, 3, 4], .95), 100);
  const monitor = createPerformanceMonitor({ diskPath: process.cwd(), intervalMs: 10 });
  try {
    for (let i = 0; i < 10; i++) monitor.record(2500, 500);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const snapshot = monitor.snapshot();
    assert.equal(snapshot.current.requestCount, 10);
    assert.equal(snapshot.current.errors5xx, 10);
    assert.ok(snapshot.current.memoryTotal > 0);
    assert.ok(snapshot.current.processRss > 0);
    assert.ok(snapshot.current.alerts.some((alert) => alert.code === "latency"));
    assert.ok(snapshot.current.alerts.some((alert) => alert.code === "http_errors"));
  } finally { monitor.close(); }
});

test("cancellation commits refund intent before provider I/O and retries without cancelling twice", async () => {
  const source = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
  const functionSource = source.slice(source.indexOf("async function cancelOrderWithRefund("), source.indexOf("\nfunction cancelOrder(db,"));
  const db = { orders: [{ ...order, status: "paid" }], payments: [payment()], tickets: [{ orderId: order.id, status: "active" }] };
  let locked = false;
  let writes = 0;
  let cancellations = 0;
  let attempts = 0;
  const ids = [];
  const context = {
    Date, Number, String, Math,
    withCriticalMutation: async (fn) => {
      assert.equal(locked, false);
      locked = true;
      try { return await fn(); } finally { locked = false; }
    },
    readDb: async () => db,
    writeDb: async () => { assert.equal(locked, true); writes++; },
    orderPayment: () => db.payments[0],
    orderTickets: () => db.tickets,
    prepareRefund,
    refundError: (code, message) => Object.assign(new Error(message), { code }),
    structuredCloneSafe: structuredClone,
    integrationConfigService: { resolvedConfig: () => ({}) },
    paymentService: { getMercadoPagoAccessToken: () => "fake" },
    cancelOrder: (_, item) => { cancellations++; item.status = "cancelled"; },
    logEvent: () => {},
    appendOrderAudit: () => {},
    eachStockedOrderItem: () => {},
    submitFullRefund: async (refund) => {
      assert.equal(locked, false);
      assert.ok(writes > 0);
      assert.equal(db.payments[0].metadata.cancellationRefund.id, refund.id);
      ids.push(refund.id);
      if (++attempts === 1) throw new Error("Network timeout");
      return { providerRefundIds: ["REF1"], providerStatus: "refunded" };
    }
  };
  const cancel = vm.runInNewContext(`${functionSource}; cancelOrderWithRefund`, context);
  await assert.rejects(cancel(order.id, "Teste", { id: "admin" }));
  assert.equal(db.orders[0].refundStatus, "pending");
  await cancel(order.id, "Teste", { id: "admin" });
  await cancel(order.id, "Teste", { id: "admin" });
  assert.equal(cancellations, 1);
  assert.equal(attempts, 2);
  assert.equal(ids[0], ids[1]);
  assert.equal(db.orders[0].status, "refunded");
  assert.equal(db.tickets[0].status, "refunded");
});
