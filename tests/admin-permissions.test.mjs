import test from "node:test";
import assert from "node:assert/strict";
import permissions from "../backend/services/adminPermissionService.js";

test("legacy order permission expands without losing access", () => {
  const effective = permissions.effectiveAdminPermissions({ role: "operator", useCustomPermissions: true, adminPermissions: ["orders.manage"] });
  assert.ok(effective.includes("orders.view"));
  assert.ok(effective.includes("orders.refund"));
  assert.ok(effective.includes("orders.delete"));
});

test("operator preset can view orders but cannot refund or delete", () => {
  const user = { role: "operator" };
  assert.equal(permissions.adminHasPermission(user, "orders.view"), true);
  assert.equal(permissions.adminHasPermission(user, "orders.refund"), false);
  assert.equal(permissions.adminHasPermission(user, "orders.delete"), false);
  assert.equal(permissions.adminHasPermission(user, "ticket_finance.export"), false);
});

test("financial export is independently assignable", () => {
  const viewer = { role: "operator", useCustomPermissions: true, adminPermissions: ["ticket_finance.view"] };
  const exporter = { role: "operator", useCustomPermissions: true, adminPermissions: ["ticket_finance.view", "ticket_finance.export"] };
  assert.equal(permissions.adminHasPermission(viewer, "ticket_finance.export"), false);
  assert.equal(permissions.adminHasPermission(exporter, "ticket_finance.export"), true);
});
