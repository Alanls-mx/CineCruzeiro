import { test } from "node:test";
import assert from "node:assert/strict";
import creditFactory from "../backend/services/clubOrderCreditService.js";
import pricing from "../backend/services/checkoutPricingService.js";
import clubDomainService from "../backend/services/clubDomainService.js";

const subscription = { id: "assinatura", planId: "plano", userId: "cliente" };
const creditOrders = creditFactory.createClubOrderCreditService({
  activeSubscriptionForUser: () => subscription,
  subscriptionCanUseCredit: () => true,
  assertClubPlanEligibility: pricing.assertClubPlanEligibility,
  ticketUnitPricesForOrder: pricing.ticketUnitPricesForOrder,
  clubDomainService,
  discountedTicketUnitsForOrder: pricing.discountedTicketUnitsForOrder,
  summarizeClubCreditItems: pricing.summarizeClubCreditItems,
  consumeSubscriptionCredit: () => ({ id: "uso" }),
  syncSubscriptionCreditMirror: () => {},
  creditBenefitLabel: "Crédito do cinema"
});

function fixture() {
  return {
    subscriptions: [subscription],
    subscriptionPlans: [{ id: "plano", active: true, creditReferenceValue: 10, allowPriceDifference: true }],
    subscriptionCreditUnits: [{ id: "credito", subscriptionId: "assinatura", status: "available", expiresAt: "2099-01-01T00:00:00.000Z", referenceValue: 10 }],
    subscriptionCreditRedemptions: []
  };
}

test("reserva, consumo e repetição preservam um único crédito para o pedido", () => {
  const db = fixture();
  const order = { id: "pedido", useClubCredits: true, sessionId: "sessao", ticketItems: [{ id: "inteira", name: "Inteira", quantity: 1, unitPrice: 10 }], totalPrice: 10 };
  creditOrders.reserveClubCreditsForOrder(db, order, { id: "cliente" }, "chave");
  assert.equal(order.totalPrice, 0);
  assert.equal(db.subscriptionCreditUnits[0].status, "reserved");
  const tickets = [{ id: "ingresso", ticketType: "Inteira" }];
  creditOrders.consumePendingClubCredit(db, order, tickets, "cliente");
  assert.equal(db.subscriptionCreditUnits[0].status, "redeemed");
  assert.equal(order.clubCreditPending, false);
  assert.equal(tickets[0].metadata.clubBenefitLabel, "Crédito do cinema");
  assert.equal(creditOrders.consumePendingClubCredit(db, order, tickets, "cliente"), null);
  assert.equal(db.subscriptionCreditRedemptions.length, 1);
});

test("cupom não combinável recusa a reserva antes de consumir crédito", () => {
  const db = fixture();
  assert.throws(() => creditOrders.reserveClubCreditsForOrder(db, { id: "pedido", useClubCredits: true, couponId: "cupom" }, { id: "cliente" }, "chave"),
    (error) => error.code === "COUPON_CLUB_NOT_COMBINABLE" && error.statusCode === 409);
  assert.equal(db.subscriptionCreditUnits[0].status, "available");
});
