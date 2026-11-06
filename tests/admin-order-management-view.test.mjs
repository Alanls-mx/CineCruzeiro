import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createOrderManagementView } = require("../backend/public/admin-modules/order-management-view.js");

function fixture(canEdit = false) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", value: "", hidden: false });
    return elements.get(id);
  };
  const state = { content: { orders: [], payments: [], movies: [], orderServiceItems: [], orderGoodsItems: [], goodsFiscalDocuments: [] } };
  const view = createOrderManagementView({ state, $, adminAssetUrl: String,
    adminCan: (permission) => canEdit && permission === "orders.edit",
    escapeHtml: (value) => String(value ?? "").replaceAll("<", "&lt;"),
    getOrderValidationSummary: () => ({ hasTickets: false, hasConcessions: false, ticketsValidated: false, ticketsCancelled: false, concessionsDelivered: false, concessionsCancelled: false }),
    isOrderEffectivelyArchived: () => false, isOrderFullyValidated: () => false, isOrderSessionExpired: () => false,
    money: (value) => `R$ ${Number(value || 0).toFixed(2)}`, orderReference: (order) => order.id,
    orderStatusLabel: (status) => status, paymentMethodLabel: (method) => method || "-",
    paymentStatusLabel: (status) => status || "-", providerLabel: (provider) => provider || "-"
  });
  return { $, state, view };
}

test("order modal preserves permissions and clears stale customer data", () => {
  const { $, state, view } = fixture(false);
  const order = { id: "order-qa", status: "pending_payment", createdAt: "2026-11-06T12:00:00Z",
    customerName: "Pessoa QA", customerEmail: "qa@example.test", customerPhone: "11999999999", customerCpf: "12345678901",
    operationalNotes: "Nota QA", totalPrice: 10 };
  state.content.orders = [order];
  view.fillOrderEditor(order, "edit");
  assert.equal($("orderEditFields").hidden, true);
  assert.equal($("orderSaveButton").hidden, true);
  assert.equal($("orderCustomerEmail").value, "qa@example.test");
  assert.equal(state.selectedOrderId, "order-qa");
  view.fillOrderEditor(null, "view");
  assert.equal(state.selectedOrderId, "");
  assert.equal($("orderDetailBody").innerHTML, "");
  for (const id of ["orderCustomerName", "orderCustomerPhone", "orderCustomerEmail", "orderCustomerCpf", "orderOperationalNotes"]) assert.equal($(id).value, "");
});

test("pending orders do not count as received revenue", () => {
  const { $, view } = fixture();
  view.renderTodaySalesSummary([
    { status: "pending_payment", totalPrice: 90, origin: "box_office", fullTicketsCount: 1 },
    { status: "paid", totalPrice: 10, origin: "online", fullTicketsCount: 1 }
  ]);
  assert.match($("todaySalesSummary").innerHTML, /Vendas hoje<\/span><strong>1<\/strong>/);
  assert.match($("todaySalesSummary").innerHTML, /Receita hoje<\/span><strong>R\$ 10\.00<\/strong>/);
  assert.doesNotMatch($("todaySalesSummary").innerHTML, /R\$ 90\.00/);
});
