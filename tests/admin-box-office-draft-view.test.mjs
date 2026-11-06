import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeDraftView } = require("../backend/public/admin-modules/box-office-draft-view.js");

test("box office draft keeps the exact tickets, seats and hold token for submission", () => {
  const state = {
    manualConcessionQuantities: {}, manualSaleItems: [], manualSelectedSeatIds: ["A1"],
    manualSeatMap: { enabled: true }, manualSeatRealtimeChannels: new Map([["session-qa", { ownerToken: "hold-qa" }]])
  };
  const view = createBoxOfficeDraftView({ state, $: () => null,
    document: { querySelectorAll: () => [{ dataset: { manualTicketQuantity: "type-qa" }, value: "1" }] },
    adminAssetUrl: String, escapeHtml: String, money: String, showToast: () => {}, trashIcon: "",
    currentManualMovieSession: () => ({ movie: { id: "movie-qa", title: "Filme QA" }, session: { id: "session-qa", date: "2026-11-06", time: "20:00" } }),
    currentManualTicketTypes: () => [{ id: "type-qa", name: "Inteira", price: 10, bundleQuantity: 1 }],
    manualSeatById: () => ({ label: "A1" }), manualRequestedSeatCount: () => 1,
    closeManualSeatRealtime: () => {}, loadManualSeatMap: () => {}, renderManualTicketTypes: () => {},
    updateManualTotal: () => {}, renderManualSaleSummary: () => {}
  });
  const draft = view.manualSaleDraft();
  assert.equal(draft.subtotal, 10);
  assert.deepEqual(draft.ticketItems, [{ id: "type-qa", quantity: 1 }]);
  assert.deepEqual(draft.selectedSeatIds, ["A1"]);
  assert.equal(draft.seatHoldToken, "hold-qa");
  assert.equal(view.manualDraftSeatSelectionComplete(draft), true);
  assert.equal(view.manualDraftSeatSelectionComplete({ ...draft, selectedSeatIds: [] }), false);
});
