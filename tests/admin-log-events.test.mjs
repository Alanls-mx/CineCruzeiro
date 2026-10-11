import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { bindLogEvents } = require("../backend/public/admin-modules/log-events.js");

test("eventos de logs carregam antes do painel e preservam filtros e acoes", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/log-events.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /CineAdminModules\.logEvents\.bindLogEvents/);

  const listeners = new Map();
  const elements = new Map(["logsRefreshButton", "logsExportButton", "logsPruneButton", "logsLevel", "logsCategory", "logsFrom", "logsTo", "logsSearch"].map((id) => [id, {
    value: "",
    addEventListener(name, callback) {
      assert.equal(listeners.has(`${id}:${name}`), false, `Listener duplicado: ${id}:${name}`);
      listeners.set(`${id}:${name}`, callback);
    }
  }]));
  const viewButtons = ["business", "technical"].map((logsView) => ({
    dataset: { logsView },
    classList: { toggle(name, active) { assert.equal(name, "active"); this.active = active; } },
    addEventListener(name, callback) { listeners.set(`${logsView}:${name}`, callback); }
  }));
  const calls = [];
  const state = { logsView: "business", logFilters: { level: "", search: "" }, logsSearchTimer: null };
  bindLogEvents({
    $: (id) => elements.get(id),
    document: { querySelectorAll: () => viewButtons },
    state,
    loadLogs: (options) => calls.push(["load", options]),
    exportLogs: () => calls.push(["export"]),
    pruneLogs: () => calls.push(["prune"])
  });
  assert.equal(listeners.size, 10);
  listeners.get("technical:click")();
  assert.equal(state.logsView, "technical");
  assert.deepEqual(viewButtons.map((button) => button.classList.active), [false, true]);
  elements.get("logsLevel").value = " warning ";
  listeners.get("logsLevel:change")();
  assert.equal(state.logFilters.level, "warning");
  listeners.get("logsRefreshButton:click")();
  listeners.get("logsExportButton:click")();
  listeners.get("logsPruneButton:click")();
  elements.get("logsSearch").value = " pedido ";
  listeners.get("logsSearch:input")();
  assert.equal(state.logFilters.search, "pedido");
  await new Promise((resolve) => setTimeout(resolve, 380));
  assert.deepEqual(calls, [["load", { page: 1 }], ["load", { page: 1 }], ["load", undefined], ["export"], ["prune"], ["load", { page: 1 }]]);
});
