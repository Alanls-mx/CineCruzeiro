import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeSeatMap } = require("../backend/public/admin-modules/box-office-seat-map.js");

test("realtime map keeps my hold and leaves another buyer's hold unavailable", () => {
  const state = {
    manualSeatMapStatus: "idle", manualSeatMapSessionId: "session-qa",
    manualSeatRealtimeChannels: new Map(), manualSelectedSeatIds: ["A1"],
    manualSeatMap: { rows: [{ seats: [
      { id: "A1", status: "held", heldByMe: true, enabled: true },
      { id: "A2", status: "available", enabled: true }
    ] }] }
  };
  const map = createBoxOfficeSeatMap({ state, $: () => ({ hidden: true }), api: async () => ({}),
    API_BASE: "", showToast: () => {}, escapeHtml: String, accessibilityIcon: "", obeseSeatIcon: "",
    currentManualTicketTypes: () => [{ id: "type-qa", bundleQuantity: 1 }],
    manualTicketItems: () => [{ id: "type-qa", quantity: 1 }],
    currentManualMovieSession: () => ({}), renderManualSaleSummary: () => {}
  });
  map.applyManualSeatRealtimeState([], [
    { seatId: "A1", heldByMe: true }, { seatId: "A2", heldByMe: false }
  ]);
  assert.equal(state.manualSeatMap.rows[0].seats[0].status, "held");
  assert.equal(state.manualSeatMap.rows[0].seats[1].status, "held");
  assert.deepEqual(state.manualSelectedSeatIds, ["A1"]);
  state.manualSelectedSeatIds = ["A2"];
  map.reconcileManualSeatSelection();
  assert.deepEqual(state.manualSelectedSeatIds, []);
});
