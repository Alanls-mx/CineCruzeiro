import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createInfrastructureRoutes } = require("../backend/services/infrastructureRoutes.js");

test("infrastructure routes preserve health and desktop dispatch contracts", async () => {
  let postgres = false;
  let production = false;
  let checkedMigration;
  const routes = createInfrastructureRoutes({
    checkPostgresReadiness: async (migration) => { checkedMigration = migration; return { ready: false }; },
    latestSchemaMigration: "synthetic-migration.sql",
    isProduction: () => production,
    postgresEnabled: () => postgres,
    sendJson: (res, status, body, headers) => Object.assign(res, { status, body, headers }),
    serveDesktopUpdate: async (res, pathname) => Object.assign(res, { status: 200, pathname })
  });
  const live = {};
  assert.equal(await routes.handleHealthRoute({ res: live, pathname: "/api/health/live", method: "GET" }), true);
  assert.deepEqual(live, { status: 200, body: { status: "alive" }, headers: { "Cache-Control": "no-store" } });
  assert.equal(checkedMigration, undefined);

  const ready = {};
  assert.equal(await routes.handleHealthRoute({ res: ready, pathname: "/api/health/ready", method: "GET" }), true);
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: "ready" });

  production = true;
  const unavailable = {};
  await routes.handleHealthRoute({ res: unavailable, pathname: "/api/health", method: "GET" });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, { status: "not_ready" });

  postgres = true;
  const postgresReady = {};
  await routes.handleHealthRoute({ res: postgresReady, pathname: "/api/health/ready", method: "GET" });
  assert.equal(checkedMigration, "synthetic-migration.sql");
  assert.equal(postgresReady.status, 503);

  const desktop = {};
  assert.equal(await routes.handleDesktopUpdateRoute({ res: desktop, pathname: "/api/desktop/update/latest.ini", method: "GET" }), true);
  assert.deepEqual(desktop, { status: 200, pathname: "/api/desktop/update/latest.ini" });
  assert.equal(await routes.handleDesktopUpdateRoute({ res: {}, pathname: "/api/desktop/update/latest.ini", method: "POST" }), false);
  assert.equal(await routes.handleHealthRoute({ res: {}, pathname: "/api/health", method: "POST" }), false);
});
