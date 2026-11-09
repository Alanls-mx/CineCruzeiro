import assert from "node:assert/strict";
import { test } from "node:test";
import scheduleModule from "../backend/services/backendRuntimeSchedule.js";

test("runtime schedule starts once, preserves trigger order and removes every timer", () => {
  const calls = [];
  const timers = [];
  const task = (name) => () => { calls.push(name); };
  const schedule = scheduleModule.createBackendRuntimeSchedule({
    runSubscriptionMaintenance: task("subscription"),
    runMovieImageMaintenance: task("movie"),
    runEmailAttachmentMaintenance: task("attachment"),
    runSystemLogMaintenance: task("system-log"),
    resumeSocialStudio: task("studio"),
    startPostgresWorkers: task("workers-start"),
    stopPostgresWorkers: task("workers-stop"),
    postgresEnabled: () => true,
    pruneCrmOutbox: task("crm-prune"),
    sendDiscordHealth: task("discord-health"),
    reconcileOnlinePayments: task("online-reconciliation"),
    subscriptionIntervalMs: 60000,
    setIntervalFn(callback, ms) {
      const timer = { callback, ms, unref: task("unref") };
      timers.push(timer);
      return timer;
    },
    clearIntervalFn: (timer) => { timer.cleared = true; }
  });
  assert.deepEqual(calls, []);
  schedule.start();
  assert.deepEqual(calls.filter((name) => name !== "unref"), [
    "subscription", "movie", "attachment", "studio", "workers-start", "system-log", "online-reconciliation", "crm-prune"
  ]);
  assert.deepEqual(timers.map((timer) => timer.ms), [60000, 30000, 21600000, 60000, 21600000, 86400000, 86400000, 15000]);
  schedule.start();
  assert.equal(timers.length, 8);
  timers[0].callback();
  assert.equal(calls.at(-1), "studio");
  timers[1].callback();
  assert.equal(calls.at(-1), "online-reconciliation");
  schedule.stop();
  assert.ok(timers.every((timer) => timer.cleared));
  assert.equal(calls.at(-1), "workers-stop");
  schedule.stop();
  assert.equal(calls.filter((name) => name === "workers-stop").length, 1);
});

test("JSON runtime does not start PostgreSQL workers or log maintenance", () => {
  const calls = [];
  const task = (name) => () => { calls.push(name); };
  const schedule = scheduleModule.createBackendRuntimeSchedule({
    runSubscriptionMaintenance: task("subscription"), runMovieImageMaintenance: task("movie"),
    runEmailAttachmentMaintenance: task("attachment"), runSystemLogMaintenance: task("system-log"),
    resumeSocialStudio: task("studio"), startPostgresWorkers: task("workers-start"),
    stopPostgresWorkers: task("workers-stop"), postgresEnabled: () => false,
    pruneCrmOutbox: task("crm-prune"), sendDiscordHealth: task("discord-health"),
    subscriptionIntervalMs: 60000,
    setIntervalFn: () => ({ unref() {} }), clearIntervalFn: () => {}
  });
  schedule.start();
  assert.equal(calls.includes("workers-start"), false);
  assert.equal(calls.includes("system-log"), false);
  schedule.stop();
});

test("controlled startup separates reconciliation, delivery workers and ancillary tasks", () => {
  const calls = [];
  const timers = [];
  const task = (name) => () => { calls.push(name); };
  const schedule = scheduleModule.createBackendRuntimeSchedule({
    runSubscriptionMaintenance: task("subscription"), runMovieImageMaintenance: task("movie"),
    runEmailAttachmentMaintenance: task("attachment"), runSystemLogMaintenance: task("log"),
    resumeSocialStudio: task("studio"), startPostgresWorkers: task("workers"),
    stopPostgresWorkers: task("stop-workers"), postgresEnabled: () => true,
    pruneCrmOutbox: task("prune"), sendDiscordHealth: task("health"),
    reconcileOnlinePayments: task("reconcile"), subscriptionIntervalMs: 60000,
    setIntervalFn(callback, ms) { const timer = { callback, ms }; timers.push(timer); return timer; },
    clearIntervalFn(timer) { timer.cleared = true; }
  });
  schedule.startReconciliation();
  schedule.startReconciliation();
  assert.deepEqual(calls, ["reconcile"]);
  assert.deepEqual(timers.map((timer) => timer.ms), [30000]);
  schedule.startWorkers();
  schedule.startWorkers();
  assert.deepEqual(calls, ["reconcile", "workers"]);
  schedule.start();
  assert.equal(calls.filter((name) => name === "reconcile").length, 1);
  assert.equal(calls.filter((name) => name === "workers").length, 1);
  assert.ok(calls.includes("studio"));
  schedule.stop();
  assert.ok(timers.every((timer) => timer.cleared));
  assert.equal(calls.filter((name) => name === "stop-workers").length, 1);
});

test("maintenance failures are observed without stopping the remaining schedule", async () => {
  const errors = [];
  const timers = [];
  const schedule = scheduleModule.createBackendRuntimeSchedule({
    runSubscriptionMaintenance: () => {},
    runMovieImageMaintenance: () => { throw new Error("image maintenance failed"); },
    runEmailAttachmentMaintenance: () => Promise.reject(new Error("attachment maintenance failed")),
    runSystemLogMaintenance: () => {},
    resumeSocialStudio: () => {},
    startPostgresWorkers: () => {},
    stopPostgresWorkers: () => {},
    postgresEnabled: () => false,
    pruneCrmOutbox: () => {},
    sendDiscordHealth: () => {},
    onTaskError: (name, error) => errors.push([name, error.message]),
    subscriptionIntervalMs: 60000,
    setIntervalFn(callback) { timers.push(callback); return { unref() {} }; },
    clearIntervalFn: () => {}
  });
  assert.doesNotThrow(() => schedule.start());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, [
    ["movie-image", "image maintenance failed"],
    ["email-attachment", "attachment maintenance failed"]
  ]);
  assert.equal(timers.length, 7);
  assert.doesNotThrow(() => timers[3]());
  assert.doesNotThrow(() => timers[4]());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors.slice(2), errors.slice(0, 2));
  schedule.stop();
});
