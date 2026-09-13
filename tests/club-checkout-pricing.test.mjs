import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../backend/server.js", import.meta.url), "utf8");
const pricingSource = source.slice(
  source.indexOf("function ticketUnitsForOrder("),
  source.indexOf("\nfunction assertClubPlanEligibility(")
);
const context = { Array, Map, Math, Number, String };
const summarizeClubCreditItems = vm.runInNewContext(`${pricingSource}; summarizeClubCreditItems`, context);
const calculateClubTicketDiscount = vm.runInNewContext(`${pricingSource}; calculateClubTicketDiscount`, context);
const calculateCouponDiscountForAmounts = vm.runInNewContext(`${pricingSource}; calculateCouponDiscountForAmounts`, context);

test("créditos funcionam sem ativar o desconto percentual do plano", () => {
  const summary = summarizeClubCreditItems({
    ticketItems: [
      { id: "inteira", name: "Inteira", quantity: 1, unitPrice: 15 },
      { id: "meia", name: "Meia Entrada", quantity: 1, unitPrice: 7.5 }
    ]
  }, { creditReferenceValue: 10, ticketDiscountPercent: 50 });

  assert.deepEqual(JSON.parse(JSON.stringify(summary)), {
    quantity: 2,
    totalAmount: 17.5,
    items: [
      {
        ticketTypeId: "inteira", ticketTypeName: "Inteira", quantity: 1,
        originalUnitPrice: 15, originalTotalPrice: 15,
        discountedUnitPrice: 15, discountedTotalPrice: 15,
        couponDiscountAmount: 0, planDiscountAmount: 0,
        creditAmount: 10, additionalPaymentAmount: 5
      },
      {
        ticketTypeId: "meia", ticketTypeName: "Meia Entrada", quantity: 1,
        originalUnitPrice: 7.5, originalTotalPrice: 7.5,
        discountedUnitPrice: 7.5, discountedTotalPrice: 7.5,
        couponDiscountAmount: 0, planDiscountAmount: 0,
        creditAmount: 7.5, additionalPaymentAmount: 0
      }
    ]
  });
});

test("crédito tem prioridade sobre descontos do Clube e cupons", () => {
  assert.equal(calculateClubTicketDiscount({ useClubCredits: true }, 10, 20), 0);
  assert.equal(calculateClubTicketDiscount({ useClubCredits: false }, 10, 20), 2);
  assert.deepEqual(
    JSON.parse(JSON.stringify(calculateCouponDiscountForAmounts({ discountType: "percent", value: 20, appliesTo: "tickets" }, 0, 0))),
    { discountValue: 0, ticketDiscount: 0, concessionDiscount: 0 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(calculateCouponDiscountForAmounts({ discountType: "percent", value: 20, appliesTo: "tickets" }, 6, 0))),
    { discountValue: 1.2, ticketDiscount: 1.2, concessionDiscount: 0 }
  );

  const summary = summarizeClubCreditItems({
    ticketItems: [{ id: "inteira", name: "Inteira", quantity: 1, unitPrice: 10 }],
    couponTicketDiscount: 1.2,
    useClubCredits: true,
    clubBenefits: { ticketDiscount: 0 }
  }, { creditReferenceValue: 4 });

  assert.deepEqual(JSON.parse(JSON.stringify(summary.items)), [{
    ticketTypeId: "inteira", ticketTypeName: "Inteira", quantity: 1,
    originalUnitPrice: 10, originalTotalPrice: 10,
    discountedUnitPrice: 8.8, discountedTotalPrice: 8.8,
    couponDiscountAmount: 1.2, planDiscountAmount: 0,
    creditAmount: 4, additionalPaymentAmount: 4.8
  }]);
  assert.equal(summary.totalAmount, 4);
});
