import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createOrderManagementActions } = require("../backend/public/admin-modules/order-management-actions.js");

function fixture(api) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: false, innerHTML: "", textContent: "", value: "" });
    return elements.get(id);
  };
  const order = { id: "order-qa", status: "paid", totalPrice: 35, customerName: "Pessoa QA" };
  const state = { content: { orders: [order] }, selectedOrderId: order.id };
  const events = [];
  const actions = createOrderManagementActions({ state, $, api,
    currentOrder: () => order, loadContent: async () => events.push("refreshed"),
    confirm: () => true, money: String,
    orderReference: (item) => item.id, orderStatusLabel: (status) => status,
    paymentForOrder: () => null, showToast: (message, kind) => events.push([message, kind])
  });
  return { actions, $, state, events, order };
}

test("partial refund is single-flight and closes the modal only after the API resolves", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requests = [];
  const { actions, $, state, events } = fixture(async (path, options) => { requests.push([path, options]); return pending; });
  $("orderCustomerEmail").value = "qa@example.test";
  const first = actions.executeOrderRefundTickets();
  await actions.executeOrderRefundTickets();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/orders/order-qa/refund-tickets");
  assert.deepEqual(JSON.parse(requests[0][1].body), {});
  assert.equal(state.selectedOrderId, "order-qa");
  assert.deepEqual(events, []);
  release({ message: "Reembolso confirmado" });
  await first;
  assert.equal(state.selectedOrderId, "");
  assert.equal($("orderCustomerEmail").value, "");
  assert.equal($("orderOverlay").hidden, true);
  assert.deepEqual(events, ["refreshed", ["Reembolso confirmado", undefined]]);
});

test("cancellation timeout keeps the order selected and exposes the server error", async () => {
  const requests = [];
  const { actions, state, events, order } = fixture(async (path, options) => {
    requests.push([path, options]);
    throw new Error("Consulta inconclusiva");
  });
  await actions.cancelOrDeleteOrder();
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/orders/order-qa");
  assert.equal(requests[0][1].method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0][1].body), { action: "cancel" });
  assert.equal(order.status, "paid");
  assert.equal(state.selectedOrderId, "order-qa");
  assert.deepEqual(events, [["Consulta inconclusiva", "error"]]);
});

test("permanent deletion asks for EXCLUIR, without a reason field", async () => {
  const requests = [];
  const { actions, $, order } = fixture(async (path, options) => {
    requests.push({ path, options });
    return { deleted: true };
  });
  const html = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="permanentDeleteReason"/);
  actions.openPermanentDelete(order.id);
  assert.equal($("permanentDeleteOverlay").hidden, false);
  $("permanentDeleteConfirmation").value = "EXCLUIR";
  await actions.permanentlyDeleteSelectedOrder({ preventDefault() {} });
  assert.equal(requests[0].path, "/api/orders/order-qa/permanent");
  assert.deepEqual(JSON.parse(requests[0].options.body), { confirmation: "EXCLUIR" });
  assert.equal($("permanentDeleteOverlay").hidden, true);
});
