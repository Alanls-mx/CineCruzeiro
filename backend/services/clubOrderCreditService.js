function createClubOrderCreditService({
  activeSubscriptionForUser,
  subscriptionCanUseCredit,
  assertClubPlanEligibility,
  ticketUnitPricesForOrder,
  clubDomainService,
  discountedTicketUnitsForOrder,
  summarizeClubCreditItems,
  consumeSubscriptionCredit,
  syncSubscriptionCreditMirror,
  creditBenefitLabel,
}) {
function reserveClubCreditsForOrder(db, order, user, idempotencyKey) {
  if (!user || !order?.useClubCredits) return { subscription: null, plan: null, redemptions: [] };
  if (order.couponId && !order.couponAllowsClubStacking) {
    const error = new Error("Este cupom não pode ser combinado com créditos do Clube.");
    error.statusCode = 409;
    error.code = "COUPON_CLUB_NOT_COMBINABLE";
    throw error;
  }
  const subscription = activeSubscriptionForUser(db, user.id);
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription?.planId && item.active !== false);
  if (!subscription || !plan || !subscriptionCanUseCredit(subscription)) {
    const error = new Error("Você não possui assinatura ativa com créditos disponíveis.");
    error.statusCode = 409;
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }
  assertClubPlanEligibility(plan, order);
  const effectivePrices = ticketUnitPricesForOrder(order);
  const redemptions = clubDomainService.reserveCredits(db, {
    subscription,
    order,
    ticketPrices: effectivePrices,
    reservationExpiresAt: order.reservationExpiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    idempotencyKey: idempotencyKey || order.id
  });
  const creditFirstPricing = discountedTicketUnitsForOrder(order, plan);
  redemptions.forEach((redemption, index) => {
    redemption.additionalPaymentAmount = Number(Math.max(0, Number(creditFirstPricing[index]?.discountedPrice || 0) - Number(redemption.creditAmount || 0)).toFixed(2));
  });
  const creditAmount = Number(redemptions.reduce((sum, item) => sum + Number(item.creditAmount || 0), 0).toFixed(2));
  const additionalPayment = Number(redemptions.reduce((sum, item) => sum + Number(item.additionalPaymentAmount || 0), 0).toFixed(2));
  if (!plan.allowPriceDifference && additionalPayment > 0) {
    clubDomainService.releaseOrderCredits(db, order.id);
    const error = new Error("Este plano não permite pagar diferença em sessões mais caras.");
    error.statusCode = 409;
    error.code = "CLUB_PRICE_DIFFERENCE_NOT_ALLOWED";
    throw error;
  }
  order.clubSubscriptionId = subscription.id;
  order.clubBenefit = "subscription_credit";
  order.clubCreditQuantity = redemptions.length;
  order.clubCreditsApplied = creditAmount;
  order.clubCreditSummary = summarizeClubCreditItems(order, plan, redemptions);
  order.additionalPayment = additionalPayment;
  order.clubCreditPending = true;
  order.clubCreditIdempotencyKey = `${idempotencyKey || order.id}:club-credit`;
  order.discountValue = Number((Number(order.discountValue || 0) + creditAmount).toFixed(2));
  order.totalPrice = Math.max(0, Number((Number(order.totalPrice || 0) - creditAmount).toFixed(2)));
  return { subscription, plan, redemptions };
}

function consumePendingClubCredit(db, order, tickets, userId) {
  if (!order?.clubCreditPending || order.clubCreditUsageId) return null;
  const subscription = (db.subscriptions || []).find((item) => item.id === order.clubSubscriptionId);
  if (!subscription) return null;
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId) || null;
  const pricingUnits = discountedTicketUnitsForOrder(order, plan);
  const redemptions = clubDomainService.redeemReservedCredits(db, order, tickets);
  const usage = consumeSubscriptionCredit(db, subscription, {
    userId: userId || order.customerUserId,
    orderId: order.id,
    ticketId: tickets?.[0]?.id || "",
    movieId: order.movieId,
    sessionId: order.sessionId,
    quantity: order.clubCreditQuantity,
    idempotencyKey: order.clubCreditIdempotencyKey || `${order.id}:club-credit`
  });
  order.clubCreditUsageId = usage.id;
  order.clubCreditPending = false;
  subscription.updatedAt = new Date().toISOString();
  const ticketItemsByIndex = tickets.map((ticket, index) => {
    const redemption = redemptions[index];
    const pricing = pricingUnits[index] || { unitPrice: 0, couponDiscount: 0, planDiscount: 0, discountedPrice: 0 };
    const fallbackPrice = pricing.discountedPrice;
    ticket.metadata = {
      ...(ticket.metadata || {}),
      originalBasePrice: pricing.unitPrice,
      couponDiscount: pricing.couponDiscount,
      clubPlanDiscount: pricing.planDiscount,
      priceAfterDiscounts: pricing.discountedPrice,
      clubBenefitLabel: creditBenefitLabel
    };
    return {
      id: `servico-${order.id}-${index + 1}`,
      orderId: order.id,
      ticketId: ticket.id,
      itemId: ticket.id,
      name: ticket.ticketType || "Ingresso",
      quantity: 1,
      unitPrice: Number(redemption?.basePrice ?? fallbackPrice),
      basePrice: Number(redemption?.basePrice ?? fallbackPrice),
      subscriptionCreditAmount: Number(redemption?.creditAmount || 0),
      additionalPaymentAmount: Number(redemption?.additionalPaymentAmount ?? fallbackPrice),
      paymentSource: redemption ? "subscription_credit" : ticket.paymentSource || "standard",
      subscriptionCreditId: redemption?.subscriptionCreditId || "",
      metadata: {
        originalUnitPrice: pricing.unitPrice,
        couponDiscount: pricing.couponDiscount,
        clubPlanDiscount: pricing.planDiscount,
        priceAfterDiscounts: pricing.discountedPrice
      },
      createdAt: new Date().toISOString()
    };
  });
  db.orderServiceItems = (db.orderServiceItems || []).filter((item) => item.orderId !== order.id).concat(ticketItemsByIndex);
  return usage;
}

function refundSubscriptionCreditForUsage(db, usage, adminUser, reason) {
  if (!usage || usage.refundedAt) return false;
  const credit = (db.subscriptionCredits || []).find((item) => item.id === usage.creditId)
    || (db.subscriptionCredits || []).find((item) => item.subscriptionId === usage.subscriptionId && item.cycleStart === usage.cycleStart);
  const subscription = (db.subscriptions || []).find((item) => item.id === usage.subscriptionId);
  if (!credit || !subscription) return false;
  const creditsUsed = Math.max(1, Number(usage.creditsUsed || usage.metadata?.creditsUsed || 1));
  credit.used = Math.max(0, Number(credit.used || 0) - creditsUsed);
  credit.remaining = Math.min(Number(credit.total || 0), Number(credit.remaining || 0) + creditsUsed);
  credit.updatedAt = new Date().toISOString();
  usage.refundedAt = new Date().toISOString();
  usage.refundedBy = adminUser?.id || "";
  usage.refundReason = String(reason || "Credito devolvido por cancelamento").trim();
  const redemptions = (db.subscriptionCreditRedemptions || []).filter((item) => item.orderId === usage.orderId && item.subscriptionId === usage.subscriptionId && item.status === "redeemed");
  redemptions.forEach((redemption) => {
    const unit = (db.subscriptionCreditUnits || []).find((item) => item.id === redemption.subscriptionCreditId);
    if (unit && unit.status === "redeemed") {
      unit.status = new Date(unit.expiresAt).getTime() > Date.now() ? "available" : "expired";
      unit.redeemedAt = "";
      unit.reservedAt = "";
      unit.reservedOrderId = "";
      unit.updatedAt = usage.refundedAt;
    }
    redemption.status = "refunded";
    redemption.releasedAt = usage.refundedAt;
    redemption.updatedAt = usage.refundedAt;
  });
  syncSubscriptionCreditMirror(subscription, credit);
  subscription.history ||= [];
  subscription.history.push({ action: "credit_refund", usageId: usage.id, by: adminUser?.id || "", reason: usage.refundReason, at: usage.refundedAt });
  return true;
}

  return { reserveClubCreditsForOrder, consumePendingClubCredit, refundSubscriptionCreditForUsage };
}

module.exports = { createClubOrderCreditService };
