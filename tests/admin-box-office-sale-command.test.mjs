import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeSaleCommand } = require("../backend/public/admin-modules/box-office-sale-command.js");

test("Point double-submit sends one sale and a timeout retains its request identity", async () => {
  const oldStorage = globalThis.sessionStorage;
  const stored = new Map();
  globalThis.sessionStorage = { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
  try {
    const fields = new Map();
    const $ = (id) => {
      if (!fields.has(id)) fields.set(id, { value: "", disabled: false, textContent: "" });
      return fields.get(id);
    };
    const state = { saleMode: "registered", manualSaleItems: [{ movieId: "movie-qa", sessionId: "session-qa", ticketItems: [{ id: "type-qa", quantity: 1 }], selectedSeatIds: ["A1"], seatHoldToken: "hold-qa" }], manualConcessionQuantities: {}, manualSelectedSeatIds: ["A1"] };
    $("manualCustomerUserId").value = "user-qa";
    let calls = 0;
    let rejectFirst;
    const api = async (_path, options) => {
      calls++;
      assert.equal(options.method, "POST");
      return new Promise((_resolve, reject) => { rejectFirst = reject; });
    };
    const view = createBoxOfficeSaleCommand({ state, $, api,
      document: { querySelector: () => ({ value: "point_debit" }) }, showToast: () => {}, showSuccess: () => {},
      manualSaleDraft: () => null, manualDraftSeatSelectionComplete: () => true,
      manualTicketDeliveryMethod: () => "online", manualConcessionItems: () => [], closeManualSeatRealtime: () => {},
      renderManualSaleItems: () => {}, startPointPaymentTracking: () => {}, loadContent: () => {}, loadManualSeatMap: () => {}
    });
    const event = { preventDefault() {} };
    const first = view.createManualTicket(event);
    const key = state.pointCheckoutKey;
    await view.createManualTicket(event);
    assert.equal(calls, 1);
    assert.ok(key);
    rejectFirst(new Error("timeout"));
    await first;
    assert.equal(state.pointCheckoutKey, key);
    assert.equal(stored.get("cine_admin_point_checkout_key"), key);
    assert.equal(state.manualSaleItems.length, 1);
  } finally {
    globalThis.sessionStorage = oldStorage;
  }
});
