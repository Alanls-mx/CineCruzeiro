import test from "node:test";
import assert from "node:assert/strict";
import financeModule from "../backend/services/concessionFinanceService.js";

const { summarizeConcessionFinance } = financeModule;

test("detalha a receita da bomboniere por produto e origem do desconto", () => {
  const summary = summarizeConcessionFinance([{
    order: {
      id: "order-1",
      couponCode: "CINE5",
      concessionItems: [
        { id: "popcorn", name: "Pipoca Grande", quantity: 2, unitPrice: 10, originalPrice: 10, clubDiscount: 2 },
        { id: "soda", name: "Refrigerante", quantity: 1, unitPrice: 8, originalPrice: 8 }
      ],
      clubBenefits: {
        freeConcessionItems: [{ concessionId: "soda", quantity: 1, unitPrice: 8 }]
      }
    },
    breakdown: {
      concessionGross: 28,
      concessionRevenue: 13,
      concessionClubDiscount: 2,
      concessionFreeDiscount: 8,
      concessionCouponDiscount: 5,
      concessionAdjustment: 0
    }
  }]);

  assert.deepEqual({
    gross: summary.grossRevenue,
    net: summary.netRevenue,
    discounts: summary.discountTotal,
    identified: summary.identifiedDiscountTotal,
    club: summary.clubDiscount,
    free: summary.freeItemDiscount,
    coupon: summary.couponDiscount,
    quantity: summary.itemQuantity,
    orders: summary.orders,
    discountedOrders: summary.discountedOrders
  }, {
    gross: 28,
    net: 13,
    discounts: 15,
    identified: 15,
    club: 2,
    free: 8,
    coupon: 5,
    quantity: 3,
    orders: 1,
    discountedOrders: 1
  });

  const popcorn = summary.products.find((item) => item.id === "popcorn");
  const soda = summary.products.find((item) => item.id === "soda");
  assert.deepEqual({
    gross: popcorn.grossRevenue,
    club: popcorn.clubDiscount,
    coupon: popcorn.couponDiscount,
    net: popcorn.netRevenue,
    quantity: popcorn.quantity,
    clubQuantity: popcorn.clubDiscountedQuantity,
    couponQuantity: popcorn.couponDiscountedQuantity
  }, { gross: 20, club: 2, coupon: 5, net: 13, quantity: 2, clubQuantity: 2, couponQuantity: 2 });
  assert.deepEqual(popcorn.couponCodes, ["CINE5"]);
  assert.deepEqual({
    gross: soda.grossRevenue,
    free: soda.freeItemDiscount,
    net: soda.netRevenue,
    quantity: soda.quantity,
    freeQuantity: soda.freeQuantity
  }, { gross: 8, free: 8, net: 0, quantity: 1, freeQuantity: 1 });
});

test("distribui ajustes de conciliação sem perder o total aprovado", () => {
  const summary = summarizeConcessionFinance([{
    order: {
      id: "order-2",
      concessionItems: [
        { id: "combo", name: "Combo Família", quantity: 1, unitPrice: 25 },
        { id: "candy", name: "Chocolate", quantity: 1, unitPrice: 10 }
      ]
    },
    breakdown: {
      concessionGross: 35,
      concessionRevenue: 34,
      concessionClubDiscount: 0,
      concessionFreeDiscount: 0,
      concessionCouponDiscount: 0,
      concessionAdjustment: -1
    }
  }]);

  assert.equal(summary.netRevenue, 34);
  assert.equal(summary.reconciliationAdjustment, -1);
  assert.equal(summary.products.reduce((total, item) => total + item.netRevenue, 0), 34);
});

test("separa reembolso de desconto e zera a receita dos produtos devolvidos", () => {
  const summary = summarizeConcessionFinance([{
    order: {
      id: "order-refund",
      concessionRefund: { status: "completed", amount: 18 },
      concessionItems: [{ id: "combo", name: "Combo", quantity: 2, unitPrice: 10, originalPrice: 10, clubDiscount: 2 }]
    },
    breakdown: {
      concessionGross: 20,
      concessionRevenue: 0,
      concessionRefunded: 18,
      concessionClubDiscount: 2,
      concessionFreeDiscount: 0,
      concessionCouponDiscount: 0,
      concessionAdjustment: 0
    }
  }]);
  assert.equal(summary.grossRevenue, 20);
  assert.equal(summary.discountTotal, 2);
  assert.equal(summary.refundTotal, 18);
  assert.equal(summary.netRevenue, 0);
  assert.equal(summary.refundedQuantity, 2);
  assert.equal(summary.products[0].refundTotal, 18);
  assert.equal(summary.products[0].refundedQuantity, 2);
});

test("pedido integralmente reembolsado não permanece como receita da bomboniere", () => {
  const summary = summarizeConcessionFinance([{
    order: {
      id: "order-full-refund",
      status: "refunded",
      concessionItems: [{ id: "drink", name: "Refrigerante", quantity: 2, unitPrice: 8 }]
    },
    breakdown: {
      concessionGross: 16,
      concessionRevenue: 0,
      concessionRefunded: 16,
      concessionClubDiscount: 0,
      concessionFreeDiscount: 0,
      concessionCouponDiscount: 0,
      concessionAdjustment: 0
    }
  }]);
  assert.equal(summary.netRevenue, 0);
  assert.equal(summary.refundTotal, 16);
  assert.equal(summary.refundedQuantity, 2);
});
