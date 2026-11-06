import { test } from "node:test";
import assert from "node:assert/strict";
import benefitsFactory from "../backend/services/clubCheckoutBenefitsService.js";
import pricing from "../backend/services/checkoutPricingService.js";
import clubDomainService from "../backend/services/clubDomainService.js";

const benefits = benefitsFactory.createClubCheckoutBenefitsService({
  activeSubscriptionForUser: (_db, userId) => userId === "cliente" ? { id: "assinatura", planId: "plano" } : null,
  subscriptionCanUseCredit: () => true,
  currentSubscriptionCredit: () => null,
  ticketSubtotalForOrder: pricing.ticketSubtotalForOrder,
  ticketUnitsForOrder: pricing.ticketUnitsForOrder,
  calculateCouponDiscountForAmounts: pricing.calculateCouponDiscountForAmounts,
  calculateClubTicketDiscount: pricing.calculateClubTicketDiscount,
  clubDomainService
});

test("benefício aplica descontos sem alterar regra de ingresso convencional", () => {
  const db = { subscriptionPlans: [{ id: "plano", active: true, ticketDiscountPercent: 10, concessionDiscountPercent: 20 }], orders: [] };
  const order = { useClubBenefits: true, ticketItems: [{ quantity: 1, unitPrice: 20 }], concessionItems: [{ id: "pipoca", quantity: 1, unitPrice: 5 }], totalPrice: 25 };
  benefits.applyClubPlanBenefits(db, order, { id: "cliente" });
  assert.equal(order.clubBenefits.ticketDiscount, 2);
  assert.equal(order.clubBenefits.concessionDiscount, 1);
  assert.equal(order.totalPrice, 22);
  const conventional = { useClubBenefits: false, totalPrice: 25 };
  benefits.applyClubPlanBenefits(db, conventional, { id: "cliente" });
  assert.deepEqual(conventional, { useClubBenefits: false, totalPrice: 25 });
});

test("assinatura inexistente e usuário ausente preservam erros de elegibilidade", () => {
  const db = { subscriptionPlans: [], orders: [] };
  assert.throws(() => benefits.applyClubPlanBenefits(db, { useClubBenefits: true }, null),
    (error) => error.code === "CLUB_AUTH_REQUIRED" && error.statusCode === 401);
  assert.throws(() => benefits.applyClubPlanBenefits(db, { useClubBenefits: true }, { id: "outro" }),
    (error) => error.code === "NO_ACTIVE_SUBSCRIPTION" && error.statusCode === 409);
});
