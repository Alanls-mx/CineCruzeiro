import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createRoomSeatEditor } = require("../backend/public/admin-modules/room-seat-editor.js");

test("room layout generation and repeated rendering keep one shared draft", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "" });
    return elements.get(id);
  };
  const state = { roomSeatSelection: null };
  const editor = createRoomSeatEditor({ state, $, escapeHtml: String, trashIcon: "X",
    accessibilityIcon: "W", obeseSeatIcon: "O", confirm: () => true, showToast: () => {} });
  state.roomSeatDraft = editor.defaultRoomSeatDraft();
  $("roomSeatRows").value = "2";
  $("roomSeatColumns").value = "3";
  editor.generateRoomSeatMap();
  assert.equal(state.roomSeatDraft.rows.length, 2);
  assert.equal(state.roomSeatDraft.rows[0].seats.length, 3);
  assert.match($("roomSeatCount").textContent, /6 poltrona/);
  editor.renderRoomSeatMap();
  assert.equal(state.roomSeatDraft.rows[0].seats.length, 3);
  const seatId = state.roomSeatDraft.rows[0].seats[0].id;
  editor.selectRoomSeatElement({ kind: "seat", seatId });
  editor.handleRoomSeatSelectionAction("seat-after");
  assert.equal(state.roomSeatDraft.rows[0].seats.length, 4);
  assert.equal(state.roomSeatSelection.kind, "seat");
});
