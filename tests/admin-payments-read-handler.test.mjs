import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminPaymentsReadHandler } = require("../backend/services/adminPaymentsReadHandler.js");

const responses = [];
const handle = createAdminPaymentsReadHandler({
  cardTerminalProvider: { configured: () => false, providerName: () => "mercado_pago" },
  inDateRange: () => true,
  integrationConfigService: { resolvedConfig: () => ({}) },
  methodLabel: (value) => value,
  movieForOrder: () => null,
  orderStatusLabel: (value) => value,
  originLabel: (value) => value,
  parseAdminPeriod: () => ({ start: "2026-11-01", end: "2026-11-30" }),
  paymentStatusLabel: (value) => value,
  providerLabel: (value) => value,
  sendJson: (_res, status, body) => responses.push({ status, body }),
  shortOrderReference: (order) => order.id
});

test("payments read filters status without writing or calling provider", () => {
  const pathname = "/api/admin/payments";
  const db = {
    orders: [{ id: "order-1", status: "paid", customerName: "Cliente", movieTitle: "Filme", origin: "online" }],
    payments: [
      { id: "pay-1", orderId: "order-1", status: "approved", method: "pix", createdAt: "2026-11-06" },
      { id: "pay-2", orderId: "order-1", status: "pending", method: "card", createdAt: "2026-11-06" }
    ]
  };
  assert.equal(handle({ req: { url: `${pathname}?status=approved`, headers: { host: "localhost" } }, res: {}, pathname, method: "GET", db }), true);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.payments.length, 1);
  assert.equal(responses[0].body.payments[0].id, "pay-1");
  assert.equal(responses[0].body.payments[0].orderReference, "order-1");
  assert.equal(handle({ req: { url: pathname, headers: {} }, res: {}, pathname, method: "POST", db }), false);
});
