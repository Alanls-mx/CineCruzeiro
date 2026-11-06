import { test } from "node:test";
import assert from "node:assert/strict";
import handlerFactory from "../backend/services/pointPrintFailureResolutionHandler.js";

function fixture() {
  let persisted = {
    payments: [{ id: "payment", providerPaymentId: "ORDABC", status: "approved", metadata: { kind: "point_sale" } }],
    orders: [{ id: "order", status: "paid_pending_print", pendingPrintTickets: [{ id: "ticket" }], pointPrint: { status: "failed" }, concessionItems: [] }]
  };
  let commits = 0;
  let providerFails = false;
  let finalCommitFails = false;
  let allowed = true;
  const events = [];
  const handler = handlerFactory.createPointPrintFailureResolutionHandler({
    readBody: async () => ({ reason: "printer error" }),
    pointPaymentOrders: (db) => db.orders,
    sendJson: (_res, status, body) => { events.push(`response:${status}`); if (status === 200) assert.equal(body.resolution, "refunded"); },
    ensureAdminAction: (_req, _res, permission) => { events.push(`permission:${permission}`); return allowed; },
    withCriticalMutation: async (fn) => fn(),
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => {
      commits += 1;
      if (finalCommitFails && commits === 2) throw new Error("final commit failed");
      persisted = structuredClone(db);
      events.push(`commit:${commits}`);
    },
    integrationConfigService: { resolvedConfig: () => ({ environment: "synthetic" }) },
    cardTerminalProvider: { refundPayment: async (_providerId, _config, options) => {
      assert.equal(persisted.payments[0].metadata.printResolution.status, "pending");
      events.push(`provider:${options.idempotencyKey}`);
      if (providerFails) throw new Error("provider response lost");
      return { status: "refunded" };
    } },
    releaseConcessionReservation: () => {},
    appendOrderAudit: () => {},
    logEvent: () => {},
    broadcastReleasedOrderSeats: async () => { events.push("release-seats"); }
  });
  const invoke = () => handler({
    req: { adminUser: { id: "admin" } }, res: {}, db: structuredClone(persisted),
    pathname: "/api/box-office/point-payments/payment/resolve-print-failure", method: "POST"
  });
  return { invoke, events, read: () => persisted, failProvider: (value) => { providerFails = value; }, failFinalCommit: (value) => { finalCommitFails = value; }, allow: (value) => { allowed = value; } };
}

test("print failure writes intent before refund and releases rights after final commit", async () => {
  const state = fixture();
  assert.equal(await state.invoke(), true);
  assert.deepEqual(state.events, ["permission:orders.refund", "commit:1", "provider:print-failure-refund-payment", "commit:2", "response:200", "release-seats"]);
  assert.equal(state.read().orders[0].status, "refunded");
  assert.equal(state.read().orders[0].pendingPrintTickets, undefined);
});

test("lost provider response retains original identity and ticket block", async () => {
  const state = fixture();
  state.failProvider(true);
  await assert.rejects(state.invoke(), /provider response lost/);
  assert.equal(state.read().payments[0].metadata.printResolution.idempotencyKey, "print-failure-refund-payment");
  assert.equal(state.read().orders[0].status, "paid_pending_print");
  state.failProvider(false);
  await state.invoke();
  assert.equal(state.events.filter((event) => event === "provider:print-failure-refund-payment").length, 2);
});

test("failed final commit keeps pending resolution and no success response", async () => {
  const state = fixture();
  state.failFinalCommit(true);
  await assert.rejects(state.invoke(), /final commit failed/);
  assert.equal(state.read().orders[0].status, "paid_pending_print");
  assert.equal(state.read().payments[0].metadata.printResolution.status, "pending");
  assert.equal(state.events.some((event) => event.startsWith("response:")), false);
});

test("permission denial happens before mutation and provider call", async () => {
  const state = fixture();
  state.allow(false);
  assert.equal(await state.invoke(), true);
  assert.deepEqual(state.events, ["permission:orders.refund"]);
});
