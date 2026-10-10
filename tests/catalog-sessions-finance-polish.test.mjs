import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import calendar from "../backend/services/calendarDateService.js";
import lifecycle from "../backend/services/movieCatalogLifecycleService.js";
import recognition from "../backend/services/financialRecognitionService.js";
import conflicts from "../backend/services/sessionRoomConflictService.js";
import autocorrect from "../backend/services/sessionScheduleAutocorrectService.js";

const source = fs.readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../backend/services/adminDashboardService.js", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
function extract(text, name) {
  const match = text.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, "m"));
  assert.ok(match, name);
  return match[0];
}
const context = vm.createContext({ ...calendar, crypto, todayIsoDate: () => "2026-10-01", URL });
vm.runInContext(["normalizeMovieSession", "sessionDatesInRange", "createMovieSessionBatch", "parseAdminPeriod", "sessionCommercialChanges"].map((name) => extract(source, name)).join("\n"), context);
const now = new Date("2026-10-01T15:00:00Z");
const movie = { id: "film", slug: "film", title: "Filme", duration: "120 min", sessions: [{ id: "session", date: "2026-10-02", time: "19:00", roomId: "room", status: "available" }] };

test("deletion preserves history through session references and club redemptions", () => {
  for (const key of ["orders", "tickets", "payments", "subscriptionUsage", "subscriptionCreditRedemptions"]) {
    assert.equal(lifecycle.movieHistory({ [key]: [{ sessionId: "session" }] }, movie), true, key);
  }
  assert.equal(lifecycle.movieHistory({ orders: [{ items: [{ movieId: "film" }] }] }, movie), true);
  assert.equal(lifecycle.movieHistory({}, movie), false);
});

test("catalog deletion is distinct from hide/archive and retains original identity", () => {
  const retained = lifecycle.deletedMovieRecord(movie, now);
  assert.equal(lifecycle.isDeletedMovie(retained), true);
  assert.equal(lifecycle.isDeletedMovie({ ...movie, status: "hidden", workflowStatus: "archived" }), false);
  assert.equal(retained.id, movie.id);
  assert.deepEqual(retained.sessions, movie.sessions);
  assert.equal(retained.metadata.catalogOriginalSlug, "film");
  assert.notEqual(retained.slug, movie.slug);
  assert.equal(retained.autoPublish, false);
});

test("future paid, reserved and issued tickets block movie deletion", () => {
  for (const db of [
    { orders: [{ movieId: "film", sessionId: "session", status: "paid" }] },
    { orders: [{ items: [{ sessionId: "session" }], status: "pending_payment" }] },
    { tickets: [{ sessionId: "session", status: "active" }] },
    { seatHolds: [{ sessionId: "session", expiresAt: "2026-10-01T16:00:00Z" }] }
  ]) assert.throws(() => lifecycle.assertMovieCanBeDeleted(db, movie, now), (error) => error.statusCode === 409);
});

test("historical sales and expired reservations allow removal without deleting history", () => {
  assert.doesNotThrow(() => lifecycle.assertMovieCanBeDeleted({ orders: [{ sessionId: "session", status: "paid" }] }, movie, new Date("2026-10-03")));
  assert.doesNotThrow(() => lifecycle.assertMovieCanBeDeleted({ orders: [{ sessionId: "session", status: "pending_payment", reservationExpiresAt: "2026-10-01T14:00:00Z" }] }, movie, now));
  assert.doesNotThrow(() => lifecycle.assertMovieCanBeDeleted({ tickets: [{ sessionId: "session", status: "refunded" }] }, movie, now));
});

test("deleted movies no longer occupy schedule or autocorrect slots", () => {
  const retained = lifecycle.deletedMovieRecord(movie, now);
  const candidate = { ...movie.sessions[0], id: "other" };
  assert.equal(conflicts.findSessionRoomConflicts({ movies: [retained], candidateMovie: movie, candidate }).length, 0);
  assert.equal(autocorrect.buildSessionAutocorrectPlan({ movies: [retained], now: now.getTime() }).changes.length, 0);
  assert.equal(conflicts.findSessionRoomConflicts({ movies: [movie], candidateMovie: movie, candidate }).length, 1);
});

const sessionInput = { date: "2026-10-02", time: "19:00", room: "Sala", format: "2D", ticketTypeIds: ["full"] };
const types = [{ id: "full", price: 20, active: true }];
test("single session rejects impossible calendar dates and times", () => {
  for (const date of ["2026-02-30", "2026-02-29", "2026-13-01"]) {
    assert.throws(() => context.normalizeMovieSession({ ...sessionInput, date }, "film", {}, types), (error) => error.statusCode === 422);
  }
  for (const time of ["24:00", "19:60", "99:99"]) {
    assert.throws(() => context.normalizeMovieSession({ ...sessionInput, time }, "film", {}, types), (error) => error.statusCode === 422);
    assert.equal(conflicts.sessionStartsAt({ ...sessionInput, time }), null);
  }
  assert.equal(context.normalizeMovieSession({ ...sessionInput, date: "2028-02-29" }, "film", {}, types).date, "2028-02-29");
});

test("batch rejects partial invalid times instead of silently dropping them", () => {
  assert.throws(() => context.createMovieSessionBatch({ ...sessionInput, times: ["19:00", "wrong"] }, "film", [], types), (error) => error.statusCode === 422);
  assert.throws(() => context.sessionDatesInRange("2026-02-30", "2026-03-03"), (error) => error.statusCode === 422);
  const batch = context.createMovieSessionBatch({ ...sessionInput, dateTo: "2026-10-03", times: ["19:00", "19:00"] }, "film", [], types);
  assert.equal(batch.created.length, 2);
});

test("room id change is commercial even when room labels match", () => {
  assert.deepEqual(Array.from(context.sessionCommercialChanges({ roomId: "a", room: "Sala" }, { roomId: "b", room: "Sala" })), ["roomId"]);
});

test("financial periods include exactly the requested days and previous range", () => {
  const one = context.parseAdminPeriod(new URL("http://localhost?period=custom&from=2026-10-01&to=2026-10-01"));
  assert.equal(one.days, 1);
  assert.equal(one.previousStart, "2026-09-30");
  assert.equal(one.previousEnd, "2026-09-30");
  const week = context.parseAdminPeriod(new URL("http://localhost?period=7d"));
  assert.equal(week.days, 7);
  assert.equal(week.previousStart, "2026-09-18");
  assert.equal(week.previousEnd, "2026-09-24");
});

test("financial reports reject inverted, invalid and excessive periods", () => {
  for (const dates of ["from=2026-10-02&to=2026-10-01", "from=2026-02-30&to=2026-03-02", "from=2020-01-01&to=2026-10-01"]) {
    assert.throws(() => context.parseAdminPeriod(new URL(`http://localhost?period=custom&${dates}`)), (error) => error.statusCode === 422);
  }
});

test("chart and total use the same Sao Paulo recognition date", () => {
  assert.match(dashboardSource, /periodPaidOrders\.filter\(\(order\) => inDateRange\(recognitionDate\(order, paymentForOrder\(order\)\), key, key\)\)/);
  const ctx = vm.createContext({ datePartsInSaoPaulo: (date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value])) });
  vm.runInContext(extract(source, "inDateRange"), ctx);
  assert.equal(ctx.inDateRange("2026-10-02T02:30:00Z", "2026-10-01", "2026-10-01"), true);
  assert.equal(ctx.inDateRange("2026-10-02T02:30:00Z", "2026-10-02", "2026-10-02"), false);
});

test("partial refund status retains net revenue and zero amount remains zero", () => {
  const payment = { status: "partially_refunded", amount: 100, refundedAmount: 30 };
  assert.equal(recognition.paymentFinancialState(payment).netAmount, 70);
  assert.equal(recognition.isOrderFinanciallySettled({}, payment), true);
  assert.equal(recognition.paymentFinancialState({ status: "approved", amount: 0, totalPrice: 80 }).amount, 0);
});

function financeUi() {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: "old", setAttribute() {}, removeAttribute() {} });
    return elements.get(id);
  };
  const requests = [];
  const ctx = vm.createContext({ $, state: {}, adminCan: () => true, ticketFinanceQuery: () => "period=today", setDisabled: (id, value) => { $(id).disabled = value; }, showToast() {}, renderTicketFinanceReport() {}, api: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) });
  vm.runInContext(extract(admin, "loadTicketFinanceReport"), ctx);
  return { ctx, requests, $ };
}

test("latest finance filter wins even when older HTTP response arrives last", async () => {
  const { ctx, requests, $ } = financeUi();
  const first = ctx.loadTicketFinanceReport();
  const second = ctx.loadTicketFinanceReport();
  requests[1].resolve({ id: "latest" });
  await second;
  requests[0].resolve({ id: "stale" });
  await first;
  assert.equal(ctx.state.ticketFinanceReport.id, "latest");
  assert.equal($("ticketFinanceRefresh").disabled, false);
});

test("finance failure clears previous report and prevents stale exports", async () => {
  const { ctx, requests, $ } = financeUi();
  ctx.state.ticketFinanceReport = { id: "old" };
  const call = ctx.loadTicketFinanceReport();
  requests[0].reject(new Error("offline"));
  await call;
  assert.equal(ctx.state.ticketFinanceReport, null);
  assert.equal($("ticketFinanceExportCsv").disabled, true);
  assert.notEqual($("ticketFinanceGross").textContent, "old");
});
