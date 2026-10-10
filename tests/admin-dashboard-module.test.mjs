import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createDashboardView } = require("../backend/public/admin-modules/dashboard-view.js");

test("dashboard view keeps its indicators and chart contract", () => {
  const elements = new Map(["dashRevenueToday", "dashTicketsSold", "dashRevenueChart"].map((id) => [id, { textContent: "", innerHTML: "" }]));
  const state = {
    dashboard: { revenueToday: 25, ticketsSold: 2, chart: [{ date: "2026-10-10", revenue: 25, orders: 1, tickets: 2 }] },
    dashboardMetric: "revenue"
  };
  const view = createDashboardView({
    state,
    $: (id) => elements.get(id),
    money: (value) => `R$ ${Number(value).toFixed(2)}`,
    escapeHtml: String,
    renderMiniPager: () => "",
    adminAssetUrl: String,
    orderReference: () => "pedido"
  });

  view.renderDashboard();
  assert.equal(elements.get("dashRevenueToday").textContent, "R$ 25.00");
  assert.equal(elements.get("dashTicketsSold").textContent, 2);
  assert.match(elements.get("dashRevenueChart").innerHTML, /Receita por período/);

  state.dashboardMetric = "sales";
  view.renderDashboardChart(state.dashboard.chart);
  assert.match(elements.get("dashRevenueChart").innerHTML, /Vendas por período/);
});

test("dashboard module loads before the admin controller", () => {
  const html = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/dashboard-view.js") < html.indexOf("admin.js?v="));
});
