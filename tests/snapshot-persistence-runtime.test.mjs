import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import persistenceModule from "../backend/services/snapshotPersistenceRuntime.js";

test("JSON snapshot remains atomic and nested mutations share one serialized owner", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cine-snapshot-runtime-"));
  const dataFile = path.join(directory, "synthetic.json");
  const events = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  try {
    await fs.writeFile(dataFile, JSON.stringify({ value: 1 }));
    const runtime = persistenceModule.createSnapshotPersistenceRuntime({
      dataFile, isProduction: () => false, postgresEnabled: () => false,
      normalizeDb: (db) => ({ ...db, normalized: true }),
      appendAuditLog: (db) => { db.audit = "appended"; }
    });
    assert.deepEqual(await runtime.readDb(), { value: 1, normalized: true });
    const first = runtime.withCriticalMutation(async () => {
      events.push("first-start");
      await runtime.withCriticalMutation(() => { events.push("nested"); });
      await gate;
      const db = await runtime.readDb();
      db.value += 1;
      await runtime.writeDb(db);
      events.push("first-end");
    });
    const second = runtime.withCriticalMutation(async () => {
      events.push("second-start");
      const db = await runtime.readDb();
      db.value += 1;
      await runtime.writeDb(db);
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ["first-start", "nested"]);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(events, ["first-start", "nested", "first-end", "second-start"]);
    assert.deepEqual(JSON.parse(await fs.readFile(dataFile, "utf8")), { value: 3, normalized: true, audit: "appended" });
    assert.deepEqual(await fs.readdir(directory), ["synthetic.json"]);
    await assert.rejects(runtime.withCriticalMutation(() => { throw new Error("synthetic failure"); }), /synthetic failure/);
    await runtime.withCriticalMutation(() => { events.push("after-failure"); });
    assert.equal(events.at(-1), "after-failure");
  } finally {
    release?.();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("PostgreSQL path tracks normalized reads, delegates lock and rejects unconfigured production", async () => {
  const fixture = { movies: [{ id: "synthetic" }] };
  const calls = [];
  let enabled = true;
  const normalize = (db) => { db.normalized = true; return db; };
  const runtime = persistenceModule.createSnapshotPersistenceRuntime({
    dataFile: "unused-test-path", isProduction: () => true, postgresEnabled: () => enabled,
    readDbFromPostgres: async (options) => { calls.push(["read", options]); return structuredClone(fixture); },
    normalizeDb: normalize,
    rememberSnapshot: (db) => { calls.push(["track", db.normalized]); },
    appendAuditLog: (db) => { db.audited = true; },
    writeDbToPostgres: async (db, options) => { calls.push(["write", db.normalized, options.normalize === normalize]); },
    withPostgresMutationLock: async (callback) => { calls.push(["lock"]); return callback(); }
  });
  const read = await runtime.readDb({ includeAuditLogs: true });
  assert.equal(read.normalized, true);
  assert.deepEqual(calls[0], ["read", { includeAuditLogs: true, trackChanges: false }]);
  assert.deepEqual(calls[1], ["track", true]);
  await runtime.withCriticalMutation(async () => runtime.writeDb(read));
  assert.deepEqual(calls.slice(2).map((entry) => entry[0]), ["lock", "write"]);
  assert.deepEqual(calls.at(-1), ["write", true, true]);
  assert.equal(read.audited, true);
  enabled = false;
  await assert.rejects(runtime.readDb(), { code: "POSTGRES_REQUIRED_IN_PRODUCTION", statusCode: 500 });
});
