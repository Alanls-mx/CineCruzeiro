import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeSessionView } = require("../backend/public/admin-modules/box-office-session-view.js");

test("box office session options exclude ended and cancelled screenings", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", disabled: false, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const date = "2099-10-10";
  const state = { content: { movies: [{ id: "movie-1", title: "Filme QA", sessions: [
    { id: "s1", date, time: "20:00", status: "active", format: "2D", room: "Sala 1" },
    { id: "s2", date, time: "21:00", status: "cancelled", format: "2D", room: "Sala 1" }
  ] }], calendar: { today: date } } };
  let seatMapLoads = 0;
  const view = createBoxOfficeSessionView({ state, $, escapeHtml: String, money: String,
    sessionTicketTypes: () => [], renderSaleMode: () => {}, renderManualSaleItems: () => {},
    loadManualSeatMap: () => { seatMapLoads++; }, updateManualTotal: () => {}, reconcileManualSeatSelection: () => {}
  });
  view.renderManualSaleOptions();
  assert.equal($("manualMovieSelect").value, "movie-1");
  assert.match($("manualSessionSelect").innerHTML, /s1/);
  assert.doesNotMatch($("manualSessionSelect").innerHTML, /s2/);
  assert.equal(seatMapLoads, 1);
});
