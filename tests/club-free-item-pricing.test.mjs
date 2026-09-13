import test from "node:test";
import assert from "node:assert/strict";
import clubDomainService from "../backend/services/clubDomainService.js";

test("item grátis não recebe também desconto percentual do Clube", () => {
  const [item] = clubDomainService.calculateGoodsDiscount([
    { id: "pipoca", quantity: 2, unitPrice: 20, discountableQuantity: 1 }
  ], { concessionDiscountPercent: 15 });

  assert.equal(item.clubDiscount, 3);
  assert.equal(item.discountableQuantity, 1);
});

test("cupom é rateado somente sobre quantidades pagas após a gratuidade", () => {
  const items = [
    { id: "pipoca", quantity: 2, unitPrice: 20 },
    { id: "refrigerante", quantity: 1, unitPrice: 10 }
  ];
  const freeItems = [{ concessionId: "pipoca", quantity: 1 }];
  const allocations = clubDomainService.allocateGoodsCouponDiscount(items, freeItems, 15);

  assert.deepEqual(allocations, [10, 5]);
});
