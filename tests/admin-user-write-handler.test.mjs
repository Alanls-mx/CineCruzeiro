import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminUserWriteHandler } = require("../backend/services/adminUserWriteHandler.js");

test("admin user writes preserve owner protection, session revocation and response ordering", async () => {
  const events = [];
  let body;
  const db = { users: [
    { id: "owner", email: "owner@example.test", role: "owner", active: true, sessionVersion: 2 },
    { id: "staff", email: "staff@example.test", role: "operator", active: true, sessionVersion: 4, adminPermissions: [] }
  ] };
  const handler = createAdminUserWriteHandler({
    roleAlias: (role) => role,
    normalizeUser: (input, existing = {}) => ({ ...existing, ...input }),
    adminUserPayload: (input, existing = {}) => ({ ...existing, ...input }),
    postgresEnabled: () => false,
    userRepository: {},
    repositoryAudit: () => ({}),
    writeDb: async () => { events.push("persist"); },
    sanitizeUser: ({ passwordHash, ...user }) => user,
    readBody: async () => body,
    sendJson: (res, status, value) => { events.push("reply"); Object.assign(res, { status, value }); }
  });
  const manager = { adminUser: { id: "staff", role: "operator" } };
  const owner = { adminUser: { id: "owner", role: "owner" } };

  body = { id: "other-owner", email: "other@example.test", role: "owner" };
  const forbidden = {};
  assert.equal(await handler({ req: manager, res: forbidden, pathname: "/api/users", method: "POST", db }), true);
  assert.equal(forbidden.status, 403);
  assert.deepEqual(events, ["reply"]);

  body = { id: "customer", email: "customer@example.test", role: "customer" };
  events.length = 0;
  const created = {};
  assert.equal(await handler({ req: owner, res: created, pathname: "/api/users", method: "POST", db }), true);
  assert.equal(created.status, 201);
  assert.deepEqual(events, ["persist", "reply"]);

  body = { active: false };
  events.length = 0;
  const lastOwner = {};
  assert.equal(await handler({ req: owner, res: lastOwner, pathname: "/api/users/owner", method: "PUT", db }), true);
  assert.equal(lastOwner.status, 409);
  assert.deepEqual(events, ["reply"]);

  body = { role: "manager" };
  events.length = 0;
  const updated = {};
  assert.equal(await handler({ req: owner, res: updated, pathname: "/api/users/staff", method: "PUT", db }), true);
  assert.equal(updated.status, 200);
  assert.equal(updated.value.sessionVersion, 5);
  assert.deepEqual(events, ["persist", "reply"]);
  assert.equal(await handler({ req: owner, res: {}, pathname: "/api/users/staff", method: "DELETE", db }), false);
});
