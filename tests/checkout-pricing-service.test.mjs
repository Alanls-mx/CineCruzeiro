import { test } from "node:test";
import assert from "node:assert/strict";
import pricing from "../backend/services/checkoutPricingService.js";

test("parcelas de pacote e desconto preservam os centavos", () => {
  const order = { ticketItems: [{ id: "combo", name: "Combo", quantity: 1, ticketQuantity: 3, unitPrice: 10 }], couponTicketDiscount: 1 };
  assert.deepEqual(pricing.ticketUnitPricesForOrder(order), [3.34, 3.33, 3.33]);
  const units = pricing.discountedTicketUnitsForOrder(order);
  assert.equal(units.reduce((sum, unit) => sum + unit.discountedPrice, 0).toFixed(2), "9.00");
  assert.equal(units.reduce((sum, unit) => sum + unit.couponDiscount, 0).toFixed(2), "1.00");
});

test("cupom restrito a bomboniere não desconta ingressos", () => {
  assert.deepEqual(pricing.calculateCouponDiscountForAmounts({ appliesTo: "concessions", discountType: "fixed_price", value: 5 }, 20, 8), {
    discountValue: 3, ticketDiscount: 0, concessionDiscount: 3
  });
});

test("plano do Clube recusa formato e sessão não elegíveis", () => {
  assert.throws(() => pricing.assertClubPlanEligibility({ eligibleFormats: ["2D"] }, { sessionFormat: "3D" }),
    (error) => error.code === "CLUB_SESSION_FORMAT_NOT_ELIGIBLE" && error.statusCode === 409);
  assert.throws(() => pricing.assertClubPlanEligibility({ eligibleSessionIds: ["sessao-a"] }, { sessionId: "sessao-b" }),
    (error) => error.code === "CLUB_SESSION_NOT_ELIGIBLE" && error.statusCode === 409);
});
