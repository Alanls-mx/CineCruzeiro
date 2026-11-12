import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeSessionView } = require("../backend/public/admin-modules/box-office-session-view.js");

test("box office session options exclude ended, cancelled and not-yet-sellable screenings", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", disabled: false, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const localStart = new Date(Date.now() + 60 * 60 * 1000)
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo", hour12: false });
  const [date, localTime] = localStart.split(" ");
  const time = localTime.slice(0, 5);
  const state = { content: { movies: [{ id: "movie-1", title: "Filme QA", sessions: [
    { id: "s1", date, time, status: "active", format: "2D", room: "Sala 1" },
    { id: "s2", date, time, status: "cancelled", format: "2D", room: "Sala 1" },
    { id: "s3", date: "2099-10-10", time: "21:00", status: "active", format: "2D", room: "Sala 1" }
  ] }], calendar: { today: date } }, manualSaleItems: [] };
  let seatMapLoads = 0;
  const view = createBoxOfficeSessionView({ state, $, escapeHtml: String, money: String,
    sessionTicketTypes: () => [], renderSaleMode: () => {}, renderManualSaleItems: () => {},
    loadManualSeatMap: () => { seatMapLoads++; }, closeManualSeatRealtime: () => {}, updateManualTotal: () => {}, reconcileManualSeatSelection: () => {}
  });
  view.renderManualSaleOptions();
  assert.equal($("manualMovieSelect").value, "movie-1");
  assert.match($("manualSessionSelect").innerHTML, /s1/);
  assert.doesNotMatch($("manualSessionSelect").innerHTML, /s2/);
  assert.equal(view.isManualSessionSellable(state.content.movies[0].sessions[2]), false);
  assert.equal(seatMapLoads, 1);
});

test("box office clears an unavailable session from the basket and hides its seat map", () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", innerHTML: "", textContent: "", disabled: false, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const state = { content: { movies: [{ id: "movie-1", title: "Filme futuro", sessions: [
    { id: "s-future", date: "2099-10-10", time: "21:00", status: "active" }
  ] }], calendar: { today: "2026-11-12" } }, manualSaleItems: [{ movieId: "movie-1", sessionId: "s-future" }] };
  const closed = [];
  let rendered = 0;
  const view = createBoxOfficeSessionView({ state, $, escapeHtml: String, money: String,
    sessionTicketTypes: () => [], renderSaleMode: () => {}, renderManualSaleItems: () => { rendered++; },
    loadManualSeatMap: () => {}, closeManualSeatRealtime: (...args) => closed.push(args),
    updateManualTotal: () => {}, reconcileManualSeatSelection: () => {}
  });
  view.renderManualSaleOptions();
  assert.deepEqual(state.manualSaleItems, []);
  assert.deepEqual(closed, [["s-future", true]]);
  assert.equal($("manualMovieSelect").disabled, true);
  assert.equal($("manualSessionSelect").disabled, true);
  assert.equal($("manualAddMovieButton").disabled, true);
  assert.match($("manualSessionAvailability").textContent, /Nenhuma sessão aberta para venda/);
  assert.equal(rendered, 1);
});
