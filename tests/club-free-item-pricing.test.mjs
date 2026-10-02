import test from "node:test";
import assert from "node:assert/strict";
import clubDomainService from "../backend/services/clubDomainService.js";
import paymentService from "../backend/services/paymentService.js";

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

test("cada pagamento aprovado do provedor emite no máximo um ciclo do Clube", () => {
  const db = { subscriptionPayments: [{ provider: "mercado_pago", providerPaymentId: "pagamento-1", status: "approved" }] };
  assert.equal(clubDomainService.shouldIssueSubscriptionPaymentCycle(db, { provider: "mercado_pago", providerPaymentId: "pagamento-1" }), false);
  assert.equal(clubDomainService.shouldIssueSubscriptionPaymentCycle(db, { provider: "mercado_pago", providerPaymentId: "pagamento-2" }), true);
  assert.equal(clubDomainService.shouldIssueSubscriptionPaymentCycle(db, { provider: "mercado_pago", providerPaymentId: "" }), false);
});

test("a renovação usa a data real de aprovação quando disponível", () => {
  const payment = paymentService.normalizeMercadoPagoAuthorizedPayment({
    debit_date: "2026-10-02T12:00:00.000-03:00",
    payment: { id: "pagamento-3", status: "approved", date_approved: "2026-10-02T12:01:00.000-03:00" }
  });
  assert.equal(payment.approvedAt, "2026-10-02T12:01:00.000-03:00");
});
