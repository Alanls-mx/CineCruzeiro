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

test("seat map clears and stays hidden when no session is selected", async () => {
  const section = { hidden: false };
  const state = {
    manualSeatMapStatus: "ready", manualSeatMapSessionId: "old-session", manualSeatMap: { enabled: true },
    manualSeatRequestToken: 0, manualSelectedSeatIds: ["A1"], manualSaleItems: [],
    manualSeatRealtimeChannels: new Map(), manualSeatRealtimeSessionId: ""
  };
  let requests = 0;
  const map = createBoxOfficeSeatMap({ state, $: (id) => id === "manualSeatSection" ? section : null,
    api: async () => { requests++; }, API_BASE: "", showToast: () => {}, escapeHtml: String,
    accessibilityIcon: "", obeseSeatIcon: "", currentManualTicketTypes: () => [],
    manualTicketItems: () => [], currentManualMovieSession: () => ({ session: undefined }),
    renderManualSaleSummary: () => {}
  });
  await map.loadManualSeatMap();
  assert.equal(section.hidden, true);
  assert.equal(state.manualSeatMapStatus, "idle");
  assert.equal(state.manualSeatMapSessionId, "");
  assert.equal(state.manualSeatMap, null);
  assert.deepEqual(state.manualSelectedSeatIds, []);
  assert.equal(requests, 0);
});
