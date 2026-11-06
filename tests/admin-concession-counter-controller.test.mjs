import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createConcessionCounterController } = require("../backend/public/admin-modules/concession-counter-controller.js");

test("counter Point sale is single-flight and retains its idempotency key after timeout", async () => {
  const oldStorage = globalThis.sessionStorage;
  const stored = new Map();
  globalThis.sessionStorage = { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
  try {
    const elements = new Map();
    const $ = (id) => {
      if (!elements.has(id)) elements.set(id, { disabled: false, textContent: "", innerHTML: "", querySelectorAll: () => [] });
      return elements.get(id);
    };
    const state = { content: { concessions: [{ id: "product-qa", price: 5, active: true }] },
      concessionCounterQuantities: { "product-qa": 1 }, concessionCounterCategory: "all", concessionCounterSearch: "" };
    let calls = 0;
    let rejectFirst;
    const controller = createConcessionCounterController({ state, $, api: async (_url, options) => {
      calls++;
      assert.equal(JSON.parse(options.body).concessionItems[0].quantity, 1);
      return new Promise((_resolve, reject) => { rejectFirst = reject; });
    }, API_BASE: "", window: {}, document: { querySelector: () => ({ value: "point_debit" }) },
    localStorage: { removeItem: () => {}, setItem: () => {} }, sessionStorage: globalThis.sessionStorage,
    confirm: () => true, adminCan: () => false, money: String, escapeHtml: String,
    showToast: () => {}, showSuccess: () => {}, normalizedSearchText: String,
    adminAssetUrl: String, formatConcessionStock: () => "1", pointPaymentStatusLabel: String,
    retryPendingSalePrint: () => {}, requestLocalPointPaymentPrint: () => {}, desktopThermalPrinterAvailable: () => false,
    resolvePendingSalePrint: () => {}, loadContent: () => {}, loadConcessionDailySales: () => {},
    loadConcessionFinance: () => {}, loadDashboard: () => {}
    });
    const event = { preventDefault() {} };
    const first = controller.createConcessionCounterSale(event);
    const key = state.concessionCounterCheckoutKey;
    await controller.createConcessionCounterSale(event);
    assert.equal(calls, 1);
    rejectFirst(new Error("timeout"));
    await first;
    assert.equal(state.concessionCounterCheckoutKey, key);
    assert.equal(stored.get("cine_admin_concession_checkout_key"), key);
    assert.equal(state.concessionCounterQuantities["product-qa"], 1);
  } finally {
    globalThis.sessionStorage = oldStorage;
  }
});
