"use strict";

function createCheckoutPreviewRoutes({
  getCustomerUser, readBody, normalizePaymentOrder, repriceOrderFromCatalog,
  activeClubPlanForBenefits, assertClubPlanEligibility, applyClubPlanBenefits,
  summarizeClubCreditItems, sendJson
}) {
  return async function handleCheckoutPreviewRoutes({ req, res, pathname, method, db }) {
    if (pathname === "/api/coupons/preview" && method === "POST") {
      const customerUser = getCustomerUser(req, db);
      if (!customerUser) {
        sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para aplicar um cupom." } });
        return true;
      }
      const body = await readBody(req);
      const input = body.order || body;
      const normalizedOrder = normalizePaymentOrder(input);
      normalizedOrder.customerUserId = customerUser.id;
      normalizedOrder.customerEmail = customerUser.email || "";
      normalizedOrder.customerCpf = customerUser.cpf || "";
      const pricedOrder = repriceOrderFromCatalog(db, normalizedOrder, { assignSeats: false });
      const subtotal = Number((Number(pricedOrder.totalPrice || 0) + Number(pricedOrder.couponDiscount || 0)).toFixed(2));
      sendJson(res, 200, {
        valid: true,
        coupon: {
          id: pricedOrder.couponId,
          code: pricedOrder.couponCode,
          title: pricedOrder.couponTitle,
          discountValue: pricedOrder.couponDiscount,
          allowsClubStacking: pricedOrder.couponAllowsClubStacking
        },
        subtotal,
        total: pricedOrder.totalPrice
      }, { "Cache-Control": "no-store" });
      return true;
    }

    if (pathname === "/api/checkout/club-benefits/preview" && method === "POST") {
      const customerUser = getCustomerUser(req, db);
      if (!customerUser) {
        sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar os benefícios do Clube." } });
        return true;
      }
      const body = await readBody(req);
      const input = body.order || body;
      const normalizedOrder = normalizePaymentOrder({
        ...input,
        customerUserId: customerUser.id,
        customerName: customerUser.name || "Cliente Cine Cruzeiro",
        customerEmail: customerUser.email || "",
        customerPhone: customerUser.phone || "",
        customerCpf: customerUser.cpf || "",
        useClubBenefits: input.useClubBenefits !== false
      });
      const pricedOrder = repriceOrderFromCatalog(db, normalizedOrder, { assignSeats: false });
      const subtotal = Number(pricedOrder.totalPrice || 0);
      const membership = activeClubPlanForBenefits(db, customerUser.id);
      if (!membership) {
        throw Object.assign(new Error("Nenhuma assinatura ativa foi encontrada para aplicar os benefícios."), {
          statusCode: 409,
          code: "NO_ACTIVE_SUBSCRIPTION"
        });
      }
      const { plan } = membership;
      if (normalizedOrder.useClubCredits) assertClubPlanEligibility(plan, pricedOrder);
      if (normalizedOrder.useClubBenefits) applyClubPlanBenefits(db, pricedOrder, customerUser);
      const creditSummary = normalizedOrder.useClubCredits ? summarizeClubCreditItems(pricedOrder, plan) : null;
      if (creditSummary) {
        pricedOrder.totalPrice = Math.max(0, Number((Number(pricedOrder.totalPrice || 0) - creditSummary.totalAmount).toFixed(2)));
      }
      sendJson(res, 200, {
        valid: true,
        plan: { id: plan.id, name: plan.name || "Clube Cine Cruzeiro" },
        coupon: pricedOrder.couponId ? {
          discountValue: Number(pricedOrder.couponDiscount || 0),
          originalDiscountValue: Number(pricedOrder.couponOriginalDiscount || pricedOrder.couponDiscount || 0),
          appliedAfterClubCredits: pricedOrder.couponAppliedAfterClubCredits === true
        } : null,
        benefits: pricedOrder.clubBenefits || null,
        creditSummary,
        subtotal,
        total: pricedOrder.totalPrice
      }, { "Cache-Control": "no-store" });
      return true;
    }
    return false;
  };
}

module.exports = { createCheckoutPreviewRoutes };
