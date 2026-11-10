import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createClubCommands } = require("../backend/public/admin-modules/club-commands.js");

test("credit adjustment sends one request and refreshes only after the API responds", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requests = [];
  const notices = [];
  let promptCount = 0;
  const commands = createClubCommands({
    state: {}, $: () => null,
    prompt: () => (++promptCount === 1 ? "2" : "não deve pedir motivo"),
    api: async (path, options) => { requests.push([path, options]); await pending; },
    loadContent: async () => notices.push("refreshed"),
    showSuccess: () => notices.push("success"),
    showToast: (message, kind) => notices.push([message, kind])
  });
  const first = commands.adjustClubCredit("subscription-qa");
  await commands.adjustClubCredit("subscription-qa");
  assert.equal(promptCount, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/admin/subscriptions/subscription-qa/credits/adjust");
  assert.deepEqual(JSON.parse(requests[0][1].body), { delta: 2 });
  assert.deepEqual(notices, []);
  release();
  await first;
  assert.deepEqual(notices, ["refreshed", "success"]);
});

test("assignment double submit is prevented and API errors remain visible", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requests = [];
  const notices = [];
  const elements = new Map([["clubAssignEmail", { value: "qa@example.test" }], ["clubAssignPlan", { value: "plan-qa" }]]);
  const commands = createClubCommands({
    state: {}, $: (id) => elements.get(id),
    api: async (path, options) => { requests.push([path, options]); await pending; throw new Error("API indisponível"); },
    showToast: (message, kind) => notices.push([message, kind])
  });
  let prevented = 0;
  const event = { preventDefault: () => { prevented += 1; } };
  const first = commands.assignClubSubscription(event);
  await commands.assignClubSubscription(event);
  assert.equal(prevented, 3);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0][1].body), { email: "qa@example.test", planId: "plan-qa", status: "active" });
  release();
  await first;
  assert.deepEqual(notices, [["API indisponível", "error"]]);
  assert.equal(elements.get("clubAssignEmail").value, "qa@example.test");
});

test("subscription cancellation keeps confirmation without requesting a reason", async () => {
  const requests = [];
  let approved = false;
  const commands = createClubCommands({
    state: {},
    confirm: () => approved,
    prompt: () => { throw new Error("motivo não deve ser solicitado"); },
    api: async (path, options) => requests.push([path, options]),
    loadContent: async () => {},
    showSuccess: () => {},
    showToast: (message) => { throw new Error(message); },
    clubStatusLabel: (status) => status
  });
  await commands.updateClubSubscription("subscription-qa", "cancelled");
  assert.equal(requests.length, 0);
  approved = true;
  await commands.updateClubSubscription("subscription-qa", "cancelled");
  assert.deepEqual(JSON.parse(requests[0][1].body), { status: "cancelled" });
});
