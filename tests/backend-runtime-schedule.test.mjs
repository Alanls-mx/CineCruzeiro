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
    "subscription", "movie", "attachment", "studio", "workers-start", "system-log", "crm-prune"
  ]);
  assert.deepEqual(timers.map((timer) => timer.ms), [60000, 21600000, 60000, 21600000, 86400000, 86400000, 15000]);
  schedule.start();
  assert.equal(timers.length, 7);
  timers[0].callback();
  assert.equal(calls.at(-1), "studio");
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
