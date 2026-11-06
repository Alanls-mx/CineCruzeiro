import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficePointController } = require("../backend/public/admin-modules/box-office-point-controller.js");

function fixture(api = async () => ({})) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: false, disabled: false, textContent: "", innerHTML: "", dataset: {} });
    return elements.get(id);
  };
  const storage = { removeItem: () => {}, setItem: () => {} };
  const state = { pointPaymentId: "payment-qa", pointPaymentPollAttempts: 0, localPointPrintJobs: new Set(), localPointPrintStatus: "" };
  let listeners = 0;
  const controller = createBoxOfficePointController({ state, $, api, API_BASE: "", window: {
    addEventListener: (name) => { if (name === "cine-desktop-print-result") listeners++; }, cineDesktop: null
  }, document: { querySelector: () => ({ hidden: false }) }, localStorage: storage, sessionStorage: storage,
  confirm: () => true, money: String, escapeHtml: String, showToast: () => {}, adminCan: () => false,
  loadContent: async () => {}, renderConcessionCounterPayment: () => {},
  scheduleConcessionCounterPaymentPoll: () => {}, stopConcessionCounterPaymentPolling: () => {}, renderManualSaleItems: () => {}
  });
  return { controller, $, state, listeners };
}

test("Point registers one print listener and retains pending, declined and print-pending states", () => {
  const { controller, $, state, listeners } = fixture();
  assert.equal(listeners, 1);
  controller.renderPointPayment({ payment: { id: "payment-qa", status: "pending", amount: 10 }, orders: [] });
  assert.equal($("pointPaymentPanel").dataset.status, "pending");
  assert.match($("pointPaymentTitle").textContent, /Aguardando/);
  controller.renderPointPayment({ payment: { id: "payment-qa", status: "rejected", amount: 10 }, orders: [] });
  assert.equal($("pointPaymentPanel").dataset.status, "rejected");
  assert.match($("pointPaymentTitle").textContent, /recusado/);
  controller.renderPointPayment({ payment: { id: "payment-qa", status: "approved", amount: 10 },
    orders: [{ id: "order-qa", status: "paid_pending_print" }], pointPrint: { status: "queued" }, completed: false });
  assert.equal($("pointPaymentPanel").dataset.status, "approved");
  assert.match($("pointPaymentTitle").textContent, /aguardando impressão/);
  assert.equal($("pointPaymentNewSaleButton").hidden, true);
  assert.equal(state.pointPaymentSnapshot.orders[0].status, "paid_pending_print");
});

test("Point cancellation sends one request while the first is in flight", async () => {
  let calls = 0;
  let release;
  const { controller } = fixture(async () => { calls++; return new Promise((resolve) => { release = resolve; }); });
  const first = controller.cancelPointPayment();
  await controller.cancelPointPayment();
  assert.equal(calls, 1);
  release({ payment: { id: "payment-qa", status: "cancelled", amount: 10 }, orders: [] });
  await first;
});
