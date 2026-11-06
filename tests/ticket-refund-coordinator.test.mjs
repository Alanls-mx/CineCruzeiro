import { test } from "node:test";
import assert from "node:assert/strict";
import coordinatorFactory from "../backend/services/ticketRefundCoordinator.js";
import refundService from "../backend/services/orderRefundService.js";

function fixture() {
  let persisted = {
    orders: [{ id: "order", status: "paid", concessionItems: [] }],
    payments: [{ id: "payment", orderId: "order", provider: "mercado_pago", providerPaymentId: "ORDABC", status: "approved", amount: 10, metadata: { transactionId: "PAYABC" } }],
    tickets: [{ id: "ticket", orderId: "order", status: "active" }]
  };
  let commits = 0;
  let providerFails = false;
  let finalCommitFails = false;
  const events = [];
  const coordinator = coordinatorFactory.createTicketRefundCoordinator({
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
    orderTickets: (db, id) => db.tickets.filter((ticket) => ticket.orderId === id),
    isOrderSessionExpired: () => false,
    orderFinancialBreakdown: () => ({ ticketRevenue: 10 }),
    supportedAutomaticRefund: refundService.supportedAutomaticRefund,
    appendOrderAudit: () => {},
    refundProviderConfig: () => ({ accessToken: "synthetic", environment: "production" }),
    paymentService: { getMercadoPagoAccessToken: () => "synthetic" },
    prepareTicketRefund: refundService.prepareTicketRefund,
    structuredCloneSafe: structuredClone,
    submitPartialRefund: async (refund) => {
      events.push(`provider:${refund.id}`);
      if (providerFails) throw new Error("lost provider response");
      return { providerStatus: "refunded", providerRefundIds: ["synthetic-refund"] };
    },
    logEvent: () => {},
    broadcastReleasedOrderSeats: async () => { events.push("release-seats"); }
  });
  return { coordinator, events, read: () => persisted, failProvider: (value) => { providerFails = value; }, failFinalCommit: (value) => { finalCommitFails = value; } };
}

test("ticket refund persists intent before provider; tickets change only after confirmation", async () => {
  const state = fixture();
  const result = await state.coordinator.refundOrderTickets("order", "reason", { id: "admin" });
  assert.equal(state.events[0], "commit:1");
  assert.match(state.events[1], /^provider:/);
  assert.deepEqual(state.events.slice(2), ["commit:2", "release-seats"]);
  assert.equal(result.refund.status, "completed");
  assert.equal(state.read().tickets[0].status, "refunded");
  await state.coordinator.refundOrderTickets("order", "reason", { id: "admin" });
  assert.equal(state.events.filter((event) => event.startsWith("provider:")).length, 1);
});

test("lost response leaves ticket active and retries same refund identity", async () => {
  const state = fixture();
  state.failProvider(true);
  await assert.rejects(state.coordinator.refundOrderTickets("order", "reason", { id: "admin" }), (error) => error.code === "REFUND_PENDING");
  const refundId = state.read().orders[0].ticketRefund.id;
  assert.equal(state.read().tickets[0].status, "active");
  state.failProvider(false);
  await state.coordinator.refundOrderTickets("order", "reason", { id: "admin" });
  assert.deepEqual(state.events.filter((event) => event.startsWith("provider:")), [`provider:${refundId}`, `provider:${refundId}`]);
});

test("failed final commit retains pending intent and ticket rights", async () => {
  const state = fixture();
  state.failFinalCommit(true);
  await assert.rejects(state.coordinator.refundOrderTickets("order", "reason", { id: "admin" }), /final commit failed/);
  assert.equal(state.read().orders[0].ticketRefund.status, "pending");
  assert.equal(state.read().tickets[0].status, "active");
  assert.equal(state.events.includes("release-seats"), false);
});
