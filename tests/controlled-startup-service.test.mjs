import assert from "node:assert/strict";
import { test } from "node:test";
import startupModule from "../backend/services/controlledStartupService.js";

test("ordinary startup leaves existing routes and workers available", () => {
  const gate = startupModule.createControlledStartupService();
  assert.equal(gate.stage(), "full");
  assert.equal(gate.allowsRequest("/api/payments/card", "POST"), true);
  assert.equal(gate.allowsSocket(), true);
  assert.equal(gate.allowsWorkers(), true);
  assert.equal(gate.allowsIntegrations(), true);
  assert.equal(gate.readinessAllowed(), true);
  assert.equal(gate.advance(), "full");
});

test("controlled startup fails closed and advances only one category per signal", () => {
  const transitions = [];
  const gate = startupModule.createControlledStartupService({
    enabled: true,
    onTransition: (from, to) => transitions.push([from, to])
  });
  assert.equal(gate.stage(), "preflight");
  assert.equal(gate.allowsRequest("/api/health/live", "GET"), true);
  assert.equal(gate.allowsRequest("/api/webhooks/mercado-pago", "POST"), false);
  assert.equal(gate.allowsRequest("/api/payments/pix", "POST"), false);
  assert.equal(gate.allowsRequest("/api/admin/payments", "GET"), false);
  assert.equal(gate.allowsSocket(), false);
  assert.equal(gate.allowsWorkers(), false);
  assert.equal(gate.allowsIntegrations(), false);
  assert.equal(gate.readinessAllowed(), false);

  assert.equal(gate.advance(), "auth");
  assert.equal(gate.allowsRequest("/api/admin/login/2fa", "POST"), true);
  assert.equal(gate.allowsRequest("/api/auth/login", "POST"), true);
  assert.equal(gate.allowsRequest("/api/webhooks/pag-bank", "POST"), false);
  assert.equal(gate.advance(), "callbacks");
  assert.equal(gate.allowsRequest("/api/webhooks/pag-bank", "POST"), true);
  assert.equal(gate.allowsRequest("/api/payments/card", "POST"), false);
  assert.equal(gate.advance(), "checkout");
  assert.equal(gate.allowsRequest("/api/payments/card", "POST"), true);
  assert.equal(gate.allowsRequest("/api/checkout/club-credit", "POST"), true);
  assert.equal(gate.allowsRequest("/api/checkout/club-benefits/preview", "GET"), true);
  assert.equal(gate.allowsRequest("/api/admin/social-studio/campaigns", "POST"), false);
  assert.equal(gate.allowsSocket(), true);
  assert.equal(gate.allowsWorkers(), false);
  assert.equal(gate.advance(), "workers");
  assert.equal(gate.allowsWorkers(), true);
  assert.equal(gate.allowsRequest("/api/admin/social-studio/campaigns", "POST"), false);
  assert.equal(gate.advance(), "full");
  assert.equal(gate.readinessAllowed(), true);
  assert.equal(gate.allowsIntegrations(), true);
  assert.equal(gate.allowsRequest("/api/admin/social-studio/campaigns", "POST"), true);
  assert.equal(gate.advance(), "full");
  assert.deepEqual(transitions, [
    ["preflight", "auth"], ["auth", "callbacks"], ["callbacks", "checkout"],
    ["checkout", "workers"], ["workers", "full"]
  ]);
});
