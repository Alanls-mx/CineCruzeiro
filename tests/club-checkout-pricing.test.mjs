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

test("cupom, plano e crédito são rateados por tipo sem alterar o total", () => {
  const summary = summarizeClubCreditItems({
    ticketItems: [
      { id: "inteira", name: "Inteira", quantity: 1, unitPrice: 10 },
      { id: "meia", name: "Meia Entrada", quantity: 1, unitPrice: 5 }
    ],
    couponTicketDiscount: 3,
    clubBenefits: { ticketDiscount: 2.4 }
  }, { creditReferenceValue: 4 });

  assert.deepEqual(JSON.parse(JSON.stringify(summary.items)), [
    {
      ticketTypeId: "inteira", ticketTypeName: "Inteira", quantity: 1,
      originalUnitPrice: 10, originalTotalPrice: 10,
      discountedUnitPrice: 6.4, discountedTotalPrice: 6.4,
      couponDiscountAmount: 2, planDiscountAmount: 1.6,
      creditAmount: 4, additionalPaymentAmount: 2.4
    },
    {
      ticketTypeId: "meia", ticketTypeName: "Meia Entrada", quantity: 1,
      originalUnitPrice: 5, originalTotalPrice: 5,
      discountedUnitPrice: 3.2, discountedTotalPrice: 3.2,
      couponDiscountAmount: 1, planDiscountAmount: 0.8,
      creditAmount: 3.2, additionalPaymentAmount: 0
    }
  ]);
  assert.equal(summary.totalAmount, 7.2);
  assert.equal(Number(summary.items.reduce((sum, item) => sum + item.discountedTotalPrice, 0).toFixed(2)), 9.6);
});
