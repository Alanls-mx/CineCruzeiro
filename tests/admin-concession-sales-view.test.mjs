import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createConcessionSalesView } = require("../backend/public/admin-modules/concession-sales-view.js");

function fixture() {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { innerHTML: "", textContent: "", value: "", checked: false, hidden: false });
    return elements.get(id);
  };
  const order = {
    id: "concession-order-1", purchasedAt: "2026-10-10T13:00:00-03:00",
    sessionDate: "2099-10-10", sessionTime: "13:00", status: "paid",
    customerName: "Cliente <QA>", paymentMethod: "Pix",
    items: [{ id: "popcorn", name: "Pipoca <QA>", quantity: 1, fulfilledQuantity: 0, originalUnitPrice: 10 }],
    finance: { grossRevenue: 10, netRevenue: 10 }, refundEligibility: { allowed: false }
  };
  const state = {
    concessionSalesData: { summary: { netRevenue: 10, grossRevenue: 10, itemQuantity: 1 }, groups: [{ title: "Balcão", orders: [order] }] },
    content: { tickets: [], sessions: [] }, concessionDailySalesPage: 1
  };
  const calls = [];
  const view = createConcessionSalesView({
    state, $, document: { hidden: false },
    api: async (url) => { calls.push(url); return state.concessionSalesData; },
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    money: (value) => `R$ ${Number(value).toFixed(2)}`,
    financialStatusEventHtml: () => "",
    showToast: (...args) => calls.push(args), adminCan: () => true,
    executeConcessionRefund: () => {}, toggleConcessionArchive: () => {}, deleteConcessionOrder: () => {}
  });
  return { view, state, $, order, calls };
}

test("concession sales module loads before admin and keeps one explicit factory", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/concession-sales-view.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /CineAdminModules\.concessionSalesView\.createConcessionSalesView/);
  assert.doesNotMatch(admin, /function renderConcessionDailySales\(/);
});

test("concession sales list and detail retain filters, escaping and status", () => {
  const { view, $, order, state } = fixture();
  view.renderConcessionDailySales();
  assert.match($("concessionDailySales").innerHTML, /Pipoca &lt;QA&gt;/);
  assert.match($("concessionDailySales").innerHTML, /Cliente &lt;QA&gt;/);
  assert.match($("concessionSalesSummary").innerHTML, /R\$ 10\.00/);
  assert.equal(view.isOrderEffectivelyActive(order), true);
  view.openConcessionOrderDetail(order.id);
  assert.equal(state.selectedConcessionOrderId, order.id);
  assert.equal($("concessionOrderOverlay").hidden, false);
  assert.match($("concessionOrderDetailBody").innerHTML, /Pipoca &lt;QA&gt;/);
  assert.equal($("concessionModalRefundButton").hidden, true);
  order.archived = true;
  view.renderConcessionDailySales();
  assert.match($("concessionDailySales").innerHTML, /Nenhum pedido encontrado/);
  $("concessionSalesArchived").checked = true;
  view.renderConcessionDailySales();
  assert.match($("concessionDailySales").innerHTML, /is-archived/);
  assert.equal(view.isOrderEffectivelyArchived(order), true);
});

test("concession sales request uses the selected date", async () => {
  const { view, $, calls } = fixture();
  $("concessionSalesDate").value = "2026-10-10";
  await view.loadConcessionDailySales();
  assert.deepEqual(calls, ["/api/admin/concession-sales?date=2026-10-10"]);
});
