import { test } from "node:test";
import assert from "node:assert/strict";
import tasksFactory from "../backend/services/backendMaintenanceTasks.js";

test("maintenance factory does not start work and coalesces concurrent attachment sweeps", async () => {
  let reads = 0;
  let releaseRead;
  const delayedRead = new Promise((resolve) => { releaseRead = resolve; });
  const tasks = tasksFactory.createBackendMaintenanceTasks({
    readDb: async () => { reads += 1; await delayedRead; return { settings: { emailAttachments: [] } }; },
    postgresEnabled: () => false,
    path: await import("node:path"),
    fs: { stat: async () => null, unlink: async () => {} },
    emailAttachmentRoot: "synthetic",
    logEvent: () => {}
  });
  assert.equal(reads, 0);
  const first = tasks.runEmailAttachmentMaintenance();
  const second = tasks.runEmailAttachmentMaintenance();
  assert.equal(reads, 1);
  releaseRead();
  await Promise.all([first, second]);
  await tasks.runEmailAttachmentMaintenance();
  assert.equal(reads, 2);
});

test("log retention runs only when PostgreSQL is enabled", async () => {
  let prunes = 0;
  let enabled = false;
  const tasks = tasksFactory.createBackendMaintenanceTasks({
    postgresEnabled: () => enabled,
    pruneSystemLogsFromPostgres: async () => { prunes += 1; return { total: 0 }; },
    businessLogEvents: new Set(),
    logEvent: () => {}
  });
  assert.equal(prunes, 0);
  await tasks.runSystemLogMaintenance();
  assert.equal(prunes, 0);
  enabled = true;
  await tasks.runSystemLogMaintenance();
  assert.equal(prunes, 1);
});
