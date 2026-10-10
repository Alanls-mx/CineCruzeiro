import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAdminLogsHandler } = require("../backend/services/adminLogsHandler.js");

function fixture() {
  const responses = [];
  const calls = [];
  const handler = createAdminLogsHandler({
    BUSINESS_LOG_EVENTS: new Set(["payment.confirmed"]),
    businessLogVisible: () => true,
    getPerformanceMonitor: () => ({ snapshot: () => ({ cpu: 42 }) }),
    listSystemLogsFromPostgres: async (filters) => ({ filters }),
    logEvent: (...args) => calls.push(args),
    openPerformanceStream: () => calls.push("stream"),
    postgresDiagnostics: () => ({ healthy: true }),
    postgresEnabled: () => false,
    pruneSystemLogsFromPostgres: async () => ({ total: 3 }),
    readBody: async () => ({ retentionDays: 30, technicalRetentionDays: 2 }),
    releaseInfo: { version: "qa" },
    sendJson: (_res, status, body) => responses.push({ status, body })
  });
  const req = { method: "GET", url: "/api/admin/logs", headers: { host: "localhost" }, adminUser: { id: "owner" } };
  const db = { auditLogs: [{ id: "audit-1", action: "payment confirmed", at: "2026-10-10T00:00:00Z" }] };
  return { handler, responses, calls, req, db };
}

test("admin logs handler preserves list filters and JSON response", async () => {
  const { handler, responses, req, db } = fixture();
  req.url = "/api/admin/logs?page=2&pageSize=10&search=payment&view=technical";
  assert.equal(await handler({ req, res: {}, pathname: "/api/admin/logs", method: "GET", db }), true);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.total, 1);
  assert.equal(responses[0].body.page, 2);
  assert.equal(responses[0].body.pageSize, 10);
  assert.equal(responses[0].body.logs.length, 0);
  assert.equal(await handler({ req, res: {}, pathname: "/api/other", method: "GET", db }), false);
});

test("admin logs handler retains performance stream and retention audit", async () => {
  const { handler, responses, calls, req, db } = fixture();
  await handler({ req, res: {}, pathname: "/api/admin/logs/performance", method: "GET", db });
  assert.deepEqual(responses[0].body, { cpu: 42, database: null, release: { version: "qa" } });
  await handler({ req, res: {}, pathname: "/api/admin/logs/performance/stream", method: "GET", db });
  assert.ok(calls.includes("stream"));
  await handler({ req, res: {}, pathname: "/api/admin/logs", method: "DELETE", db });
  assert.equal(responses.at(-1).body.retentionDays, 30);
  assert.equal(responses.at(-1).body.technicalRetentionDays, 2);
  assert.equal(calls[1][1], "logs.retention_applied");
});
