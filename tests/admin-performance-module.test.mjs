import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createPerformanceView } = require("../backend/public/admin-modules/performance-view.js");

test("performance view retains peak, charts and escaped alerts", () => {
  const elements = new Map(["perfKpiGrid", "perfCpuChartContainer", "perfLatencyChartContainer", "performanceAlerts", "performanceSlowRoutes"].map((id) => [id, { innerHTML: "", className: "", hidden: false }]));
  const view = createPerformanceView({
    $: (id) => elements.get(id),
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  });
  const metrics = { cpuPercent: 65, memoryTotal: 100, memoryUsed: 50, diskTotal: 100, diskAvailable: 50, sampledAt: "2026-10-10T12:00:00Z" };
  view.renderPerformanceKpis(metrics, []);
  view.renderPerformanceKpis({ ...metrics, cpuPercent: 30 }, []);
  assert.match(elements.get("perfKpiGrid").innerHTML, /Pico na sessão: <strong>65%/);
  view.renderPerformanceCharts([metrics], metrics);
  assert.match(elements.get("perfCpuChartContainer").innerHTML, /perf-chart-svg/);
  view.renderPerformanceAlerts([{ message: "<script>" }]);
  assert.doesNotMatch(elements.get("performanceAlerts").innerHTML, /<script>/);
  view.renderPerformanceSlowRoutes([{ route: "GET /test", requestP95Ms: 250, requestCount: 1 }]);
  assert.match(elements.get("performanceSlowRoutes").innerHTML, /GET \/test/);
});

test("performance module loads before the admin controller", () => {
  const html = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/performance-view.js") < html.indexOf("admin.js?v="));
});
