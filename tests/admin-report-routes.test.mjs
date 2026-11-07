import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminReportRoutes } = require("../backend/services/adminReportRoutes.js");

function fixture(overrides = {}) {
  const responses = [];
  const calls = [];
  const handle = createAdminReportRoutes({
    parseAdminPeriod: () => ({ start: "2026-01-01", end: "2026-01-31" }),
    ticketDistributorReport: (_db, args) => { calls.push(args); return { totals: { quantity: 0 } }; },
    sendJson: (_res, status, body) => responses.push({ status, body }),
    ...overrides
  });
  const request = (pathname, method = "GET", db = { settings: {} }) => handle({
    req: { url: pathname, headers: { host: "localhost" } }, res: {}, pathname, method, db
  });
  return { request, responses, calls };
}

test("report route import and composition have no persistence or export effects", async () => {
  const { request, responses, calls } = fixture();
  assert.equal(await request("/api/admin/unrelated"), false);
  assert.deepEqual(responses, []);
  assert.deepEqual(calls, []);
});

test("ticket distributor read keeps response payload and filters", async () => {
  const { request, responses, calls } = fixture();
  assert.equal(await request("/api/admin/reports/ticket-distributor?movieId=movie-1"), false);
  // The dispatcher supplies pathname separately from URL, as the real server does.
  const actual = fixture();
  assert.equal(await actual.request("/api/admin/reports/ticket-distributor"), true);
  assert.deepEqual(actual.calls, [{ period: { start: "2026-01-01", end: "2026-01-31" }, movieId: "" }]);
  assert.deepEqual(actual.responses, [{ status: 200, body: { totals: { quantity: 0 } } }]);
  assert.deepEqual(responses, []);
  assert.deepEqual(calls, []);
});

test("invalid distributor settings keep 422 and do not write", async () => {
  const { request, responses } = fixture({ readBody: async () => ({ distributorPercent: 101 }),
    writeDb: async () => { throw new Error("must not write"); } });
  assert.equal(await request("/api/admin/reports/ticket-distributor/settings", "PUT"), true);
  assert.deepEqual(responses, [{ status: 422, body: {
    error: "Informe percentuais entre 0 e 100 e uma taxa do Clube maior ou igual a zero."
  } }]);
});
