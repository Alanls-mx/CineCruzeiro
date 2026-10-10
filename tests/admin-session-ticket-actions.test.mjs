import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createSessionTicketActionHandler } = require("../backend/public/admin-modules/session-ticket-actions.js");

test("session and ticket actions load before admin and dispatch exactly once", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/session-ticket-actions.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /sessionTicketActions\.createSessionTicketActionHandler/);
  assert.match(admin, /if \(handleSessionTicketAction\(event\)\) return;/);

  const calls = [];
  const handle = createSessionTicketActionHandler({
    openSessionDashboardDetail: (...args) => calls.push(["dashboard", ...args]),
    showSessionTickets: (...args) => calls.push(["tickets", ...args]),
    openSessionEditor: (...args) => calls.push(["edit", ...args]),
    removeSession: (...args) => calls.push(["remove", ...args]),
    openGlobalSessionEditor: (...args) => calls.push(["global-edit", ...args]),
    copyTicketCode: (...args) => calls.push(["copy", ...args]),
    openOrderView: (...args) => calls.push(["order", ...args])
  });
  const session = (action) => ({ target: { closest(selector) {
    return selector.startsWith("[data-admin-session-action]")
      ? { dataset: { adminSessionAction: action, adminSessionId: "s1", adminMovieId: "m1" } } : null;
  } } });
  const ticket = (action) => ({ target: { closest(selector) {
    return selector.startsWith("[data-admin-ticket-action]")
      ? { dataset: { adminTicketAction: action, adminTicketValue: "t1" } } : null;
  } } });
  for (const action of ["dashboard", "tickets", "edit", "remove", "global-edit"]) assert.equal(handle(session(action)), true);
  for (const action of ["copy", "order"]) assert.equal(handle(ticket(action)), true);
  assert.equal(handle({ target: { closest: () => null } }), false);
  assert.deepEqual(calls, [
    ["dashboard", "m1", "s1"], ["tickets", "s1"], ["edit", "s1"],
    ["remove", "s1"], ["global-edit", "m1", "s1"], ["copy", "t1"], ["order", "t1"]
  ]);
});
