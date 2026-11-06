import { test } from "node:test";
import assert from "node:assert/strict";
import coordinatorFactory from "../backend/services/concessionRefundCoordinator.js";
import refundService from "../backend/services/orderRefundService.js";

function fixture() {
  let persisted = {
    orders: [{ id: "order", status: "paid", concessionItems: [{ quantity: 1, status: "reserved" }], stockReservationStatus: "reserved" }],
    payments: [{ id: "payment", orderId: "order", provider: "mercado_pago", providerPaymentId: "ORDABC", status: "approved", amount: 10, metadata: { transactionId: "PAYABC" } }],
    tickets: [{ id: "ticket", orderId: "order", status: "active" }],
    products: [{ id: "product", reserved: 1, stock: 0 }]
  };
  let commits = 0;
  let providerFails = false;
  let finalCommitFails = false;
  const events = [];
  const coordinator = coordinatorFactory.createConcessionRefundCoordinator({
    withCriticalMutation: async (fn) => fn(),
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => {
      commits += 1;
      if (finalCommitFails && commits === 2) throw new Error("final commit failed");
      persisted = structuredClone(db);
      events.push(`commit:${commits}`);
    },
    refundError: refundService.refundError,
    orderPayment: (db, id) => db.payments.find((payment) => payment.orderId === id),
    isOrderSessionExpired: () => false,
    orderFinancialBreakdown: () => ({ concessionRevenue: 5, concessionCouponDiscount: 0 }),
    supportedAutomaticRefund: refundService.supportedAutomaticRefund,
    eachStockedOrderItem: (db, _order, visit) => visit(db.products[0], 1),
    adjustConcessionStock: (product, amount) => { product.stock += amount; },
    goodsFiscalService: { cancelUnissued: () => {} },
    orderTickets: (db, id) => db.tickets.filter((ticket) => ticket.orderId === id),
    appendOrderAudit: () => {},
    refundProviderConfig: () => ({ accessToken: "synthetic", environment: "production" }),
    paymentService: { getMercadoPagoAccessToken: () => "synthetic" },
    prepareConcessionRefund: refundService.prepareConcessionRefund,
    structuredCloneSafe: structuredClone,
    submitConcessionRefund: async (refund) => {
      events.push(`provider:${refund.id}`);
      if (providerFails) throw new Error("lost provider response");
      return { providerStatus: "partially_refunded", providerRefundIds: ["synthetic-refund"] };
    },
    logEvent: () => {},
    broadcastReleasedOrderSeats: async () => { events.push("release-seats"); }
  });
  return { coordinator, events, read: () => persisted, failProvider: (value) => { providerFails = value; }, failFinalCommit: (value) => { finalCommitFails = value; } };
}

test("partial concession refund persists intent before provider and restores stock after confirmation", async () => {
  const state = fixture();
  const result = await state.coordinator.refundOrderConcessions("order", "reason", { id: "admin" });
  assert.match(state.events[1], /^provider:/);
  assert.deepEqual(state.events.filter((event) => event.startsWith("commit:")), ["commit:1", "commit:2"]);
  assert.equal(state.events[0], "commit:1");
  assert.equal(state.read().products[0].stock, 1);
  assert.equal(state.read().tickets[0].status, "active");
  assert.equal(result.refund.status, "completed");
  await state.coordinator.refundOrderConcessions("order", "reason", { id: "admin" });
  assert.equal(state.events.filter((event) => event.startsWith("provider:")).length, 1);
});

test("lost response retries same refund identity without releasing stock", async () => {
  const state = fixture();
  state.failProvider(true);
  await assert.rejects(state.coordinator.refundOrderConcessions("order", "reason", { id: "admin" }), (error) => error.code === "REFUND_PENDING");
  const refundId = state.read().orders[0].concessionRefund.id;
  assert.equal(state.read().products[0].stock, 0);
  state.failProvider(false);
  await state.coordinator.refundOrderConcessions("order", "reason", { id: "admin" });
  assert.deepEqual(state.events.filter((event) => event.startsWith("provider:")), [`provider:${refundId}`, `provider:${refundId}`]);
});

test("failed final commit retains original intent and reservation", async () => {
  const state = fixture();
  state.failFinalCommit(true);
  await assert.rejects(state.coordinator.refundOrderConcessions("order", "reason", { id: "admin" }), /final commit failed/);
  assert.equal(state.read().orders[0].concessionRefund.status, "pending");
  assert.equal(state.read().products[0].reserved, 1);
  assert.equal(state.events.includes("release-seats"), false);
});
