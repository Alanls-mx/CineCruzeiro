import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createPaymentCenterView } = require("../backend/public/admin-modules/payment-center-view.js");

test("payment center preserves pending status and paginates without API side effects", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "" });
    return elements.get(id);
  };
  const state = { paymentsPage: 1, paymentsPageSize: 1, payments: {
    cardTerminal: { configured: true, provider: "Point" },
    payments: [
      { orderId: "order-pending", status: "pending", amount: 10, createdAt: "2026-11-06T12:00:00Z" },
      { orderId: "order-approved", status: "approved", amount: 20, createdAt: "2026-11-06T13:00:00Z" }
    ]
  } };
  const view = createPaymentCenterView({ state, $, escapeHtml: String,
    financialStatusEventHtml: () => "", money: (value) => `R$ ${value}`,
    originLabel: () => "Bilheteria", paymentMethodLabel: () => "Point",
    paymentStatusLabel: (value) => value, providerLabel: () => "Point",
    statusClass: (value) => value
  });
  view.renderPaymentsCenter();
  assert.match($("paymentsList").innerHTML, /order-pending/);
  assert.match($("paymentsList").innerHTML, /pending/);
  assert.doesNotMatch($("paymentsList").innerHTML, /order-approved/);
  view.changePaymentsPage(1);
  assert.match($("paymentsList").innerHTML, /order-approved/);
  assert.doesNotMatch($("paymentsList").innerHTML, /order-pending/);
  state.payments.payments = [];
  view.renderPaymentsCenter();
  assert.match($("paymentsList").innerHTML, /Nenhum pagamento encontrado/);
});
