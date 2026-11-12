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

test("venda rápida bloqueia nomes faltantes e envia um por ingresso sem alterar o pagamento", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { cineDesktop: { checkPrinter: async () => ({ ready: true }) } };
  try {
    const fields = new Map();
    const $ = (id) => {
      if (!fields.has(id)) fields.set(id, { value: "", disabled: false, textContent: "" });
      return fields.get(id);
    };
    const item = { movieId: "m1", movieTitle: "Filme", sessionId: "s1", ticketItems: [{ id: "combo", quantity: 1 }], ticketSummary: [{ quantity: 1, bundleQuantity: 2 }], selectedSeatIds: ["A1", "A2"] };
    const state = { saleMode: "quick", manualSaleItems: [item], manualAttendeeNamesBySession: { s1: ["Ana Silva"] }, manualConcessionQuantities: {}, manualSelectedSeatIds: ["A1", "A2"] };
    const messages = [];
    const payloads = [];
    const command = createBoxOfficeSaleCommand({ state, $, api: async (_path, options) => { payloads.push(JSON.parse(options.body)); return { orders: [{ status: "paid" }], tickets: [{}, {}] }; },
      document: { querySelector: () => ({ value: "cash", focus() {} }) }, showToast: (message) => messages.push(message), showSuccess: () => {},
      manualSaleDraft: () => null, manualDraftSeatSelectionComplete: () => true, manualTicketDeliveryMethod: () => "physical", manualConcessionItems: () => [],
      closeManualSeatRealtime: () => {}, renderManualSaleItems: () => {}, startPointPaymentTracking: () => {}, loadContent: async () => {}, loadManualSeatMap: () => {}
    });
    await command.createManualTicket({ preventDefault() {} });
    assert.equal(payloads.length, 0);
    assert.match(messages[0], /2 ingresso/);
    state.manualAttendeeNamesBySession.s1.push("Bruno Lima");
    await command.createManualTicket({ preventDefault() {} });
    assert.deepEqual(payloads[0].saleItems[0].attendeeNames, ["Ana Silva", "Bruno Lima"]);
    assert.equal(payloads[0].paymentMethod, "cash");
  } finally {
    globalThis.window = previousWindow;
  }
});
