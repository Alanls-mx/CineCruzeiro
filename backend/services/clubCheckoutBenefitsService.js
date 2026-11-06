function createClubCheckoutBenefitsService({
  activeSubscriptionForUser,
  subscriptionCanUseCredit,
  currentSubscriptionCredit,
  ticketSubtotalForOrder,
  ticketUnitsForOrder,
  calculateCouponDiscountForAmounts,
  calculateClubTicketDiscount,
  clubDomainService,
}) {
function clubSavingsSummary(db, subscription) {
  const summary = {
    total: 0,
    tickets: 0,
    concessions: 0,
    freeItems: 0,
    clubCredits: 0,
    benefitedOrders: 0
  };

  (db.orders || [])
    .filter((order) => order.status === "paid" && order.clubSubscriptionId === subscription.id)
    .forEach((order) => {
      const benefits = order.clubBenefits && typeof order.clubBenefits === "object" ? order.clubBenefits : {};
      const ticketDiscount = Math.max(0, Number(benefits.ticketDiscount || 0));
      const concessionsRefunded = order.concessionRefund?.status === "completed";
      const concessionDiscount = concessionsRefunded ? 0 : Math.max(0, Number(benefits.concessionDiscount || 0));
      const freeItemsDiscount = concessionsRefunded ? 0 : Math.max(0, Number(benefits.freeConcessionDiscount || 0));
      const creditValue = Math.max(0, Number(order.clubCreditsApplied || 0));
      const total = ticketDiscount + concessionDiscount + freeItemsDiscount + creditValue;
      if (total <= 0) return;
      summary.tickets += ticketDiscount + creditValue;
      summary.concessions += concessionDiscount;
      summary.freeItems += freeItemsDiscount;
      summary.clubCredits += creditValue;
      summary.total += total;
      summary.benefitedOrders += 1;
    });

  Object.keys(summary).forEach((key) => {
    if (key !== "benefitedOrders") summary[key] = Number(summary[key].toFixed(2));
  });
  return summary;
}

function activeClubPlanForBenefits(db, userId) {
  if (!userId) return null;
  const subscription = activeSubscriptionForUser(db, userId);
  if (!subscription || !subscriptionCanUseCredit(subscription)) return null;
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId && item.active !== false);
  return plan ? { subscription, plan } : null;
}

function reservedFreeConcessionQuantity(db, subscription, concessionId, currentOrderId = "") {
  const credit = currentSubscriptionCredit(db, subscription);
  const cycleStart = new Date(credit?.cycleStart || subscription.currentPeriodStart || subscription.cycleStart || 0).getTime();
  const cycleEnd = new Date(credit?.cycleEnd || subscription.currentPeriodEnd || subscription.cycleEnd || 0).getTime();
  if (!Number.isFinite(cycleStart) || !Number.isFinite(cycleEnd)) return 0;
  const now = Date.now();
  return (db.orders || []).reduce((sum, existingOrder) => {
    if (existingOrder.id === currentOrderId || existingOrder.clubSubscriptionId !== subscription.id) return sum;
    if (!["pending_payment", "paid", "paid_pending_print"].includes(existingOrder.status)) return sum;
    if (existingOrder.concessionRefund?.status === "completed") return sum;
    if (existingOrder.status === "pending_payment" && existingOrder.reservationExpiresAt && new Date(existingOrder.reservationExpiresAt).getTime() <= now) return sum;
    const createdAt = new Date(existingOrder.createdAt || 0).getTime();
    if (createdAt < cycleStart || createdAt >= cycleEnd) return sum;
    const claim = (existingOrder.clubBenefits?.freeConcessionItems || []).find((item) => item.concessionId === concessionId);
    return sum + Number(claim?.quantity || 0);
  }, 0);
}

function prioritizeFreeConcessionsBeforeDiscounts(db, order, freeConcessionItems) {
  const coupon = (db.promotions || []).find((item) => item.id === order.couponId);
  if (!coupon || !order.couponAllowsClubStacking || !freeConcessionItems.length) return;

  const freeByItem = new Map(freeConcessionItems.map((item) => [String(item.concessionId), Number(item.quantity || 0)]));
  const concessionAmounts = (order.concessionItems || []).map((item) => {
    const paidQuantity = Math.max(0, Number(item.quantity || 0) - Number(freeByItem.get(String(item.id)) || 0));
    return Number((paidQuantity * Number(item.unitPrice || 0)).toFixed(2));
  });
  const concessionTotal = Number(concessionAmounts.reduce((sum, amount) => sum + amount, 0).toFixed(2));
  const ticketTotal = ticketSubtotalForOrder(db, order);
  const membership = order.useClubCredits ? activeClubPlanForBenefits(db, order.customerUserId) : null;
  const referenceValue = Math.max(0, Number(membership?.plan?.creditReferenceValue || 0));
  const creditAmount = membership
    ? ticketUnitsForOrder(order).reduce((sum, unit) => sum + Math.min(unit.unitPrice, referenceValue > 0 ? referenceValue : unit.unitPrice), 0)
    : 0;
  const couponTicketBase = Math.max(0, Number((ticketTotal - creditAmount).toFixed(2)));
  const pricing = calculateCouponDiscountForAmounts(coupon, couponTicketBase, concessionTotal);
  const allocations = clubDomainService.allocateGoodsCouponDiscount(order.concessionItems, freeConcessionItems, pricing.concessionDiscount);

  order.concessionItems = (order.concessionItems || []).map((item, index) => ({
    ...item,
    couponDiscount: allocations[index] || 0
  }));
  order.couponOriginalDiscount = Number(order.couponOriginalDiscount ?? order.couponDiscount ?? 0);
  order.couponDiscount = pricing.discountValue;
  order.couponTicketDiscount = pricing.ticketDiscount;
  order.couponConcessionDiscount = pricing.concessionDiscount;
  order.couponAppliedAfterClubFreeItems = true;
  order.discountValue = pricing.discountValue;
  const grossConcessions = (order.concessionItems || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  order.totalPrice = Math.max(0, Number((ticketTotal + grossConcessions - pricing.discountValue).toFixed(2)));
}

function applyClubPlanBenefits(db, order, user) {
  if (!order?.useClubBenefits) return { order, subscription: null, plan: null };
  if (order.couponId && !order.couponAllowsClubStacking) {
    order.clubBenefitsSkippedReason = "coupon_not_combinable";
    return { order, subscription: null, plan: null };
  }
  if (!user) {
    const error = new Error("Entre na sua conta para aplicar os benefícios do Clube.");
    error.statusCode = 401;
    error.code = "CLUB_AUTH_REQUIRED";
    throw error;
  }
  const benefit = activeClubPlanForBenefits(db, user.id);
  if (!benefit) {
    const error = new Error("Nenhuma assinatura ativa foi encontrada para aplicar os benefícios.");
    error.statusCode = 409;
    error.code = "NO_ACTIVE_SUBSCRIPTION";
    throw error;
  }
  const { subscription, plan } = benefit;
  const ticketSubtotal = ticketSubtotalForOrder(db, order);
  let ticketNetAfterCoupon = Math.max(0, Number((ticketSubtotal - Number(order.couponTicketDiscount || 0)).toFixed(2)));
  const ticketDiscountPercent = Math.min(90, Math.max(0, Number(plan.ticketDiscountPercent || 0)));
  const concessionDiscountPercent = Math.min(90, Math.max(0, Number(plan.concessionDiscountPercent || 0)));
  const freeConcessionItems = [];
  let freeConcessionDiscount = 0;

  for (const configured of plan.freeConcessionItems || []) {
    const concessionId = String(configured.concessionId || configured.id || "");
    const item = (order.concessionItems || []).find((candidate) => candidate.id === concessionId);
    if (!item) continue;
    const limit = Math.min(20, Math.max(0, Number(configured.quantityPerCycle || configured.quantity || 0)));
    const used = reservedFreeConcessionQuantity(db, subscription, concessionId, order.id);
    const quantity = Math.min(Number(item.quantity || 0), Math.max(0, limit - used));
    if (!quantity) continue;
    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
    freeConcessionItems.push({ concessionId, name: item.name, quantity, unitPrice });
    freeConcessionDiscount += quantity * unitPrice;
  }

  prioritizeFreeConcessionsBeforeDiscounts(db, order, freeConcessionItems);
  ticketNetAfterCoupon = Math.max(0, Number((ticketSubtotal - Number(order.couponTicketDiscount || 0)).toFixed(2)));

  const ticketDiscount = calculateClubTicketDiscount(order, ticketNetAfterCoupon, ticketDiscountPercent);
  const excludedConcessionIds = new Set(plan.excludedConcessionIds || []);
  let concessionDiscount = 0;
  order.concessionItems = clubDomainService.calculateGoodsDiscount((order.concessionItems || []).map((item) => {
    const freeQuantity = Number(freeConcessionItems.find((entry) => entry.concessionId === item.id)?.quantity || 0);
    return { ...item, discountableQuantity: Math.max(0, Number(item.quantity || 0) - freeQuantity) };
  }), { ...plan, concessionDiscountPercent, excludedConcessionIds: [...excludedConcessionIds] }).map((item) => {
    const paidQuantity = Number(item.discountableQuantity || 0);
    const paidSubtotalAfterCoupon = Math.max(0, paidQuantity * Number(item.unitPrice || 0) - Number(item.couponDiscount || 0));
    const fullDiscount = item.clubDiscountExcluded ? 0 : Number((paidSubtotalAfterCoupon * (concessionDiscountPercent / 100)).toFixed(2));
    concessionDiscount += fullDiscount;
    const freeDiscount = Number(freeConcessionItems.find((entry) => entry.concessionId === item.id)?.quantity || 0) * Number(item.unitPrice || 0);
    return {
      ...item,
      clubDiscount: fullDiscount,
      clubFreeDiscount: Number(freeDiscount.toFixed(2)),
      finalPrice: Number(Math.max(0, Number(item.unitPrice || 0) - fullDiscount / Math.max(1, Number(item.quantity || 1))).toFixed(2))
    };
  });
  const clubDiscount = Math.min(Number(order.totalPrice || 0), Number((ticketDiscount + freeConcessionDiscount + concessionDiscount).toFixed(2)));

  order.discountValue = Number((Number(order.discountValue || 0) + clubDiscount).toFixed(2));
  order.totalPrice = Math.max(0, Number((Number(order.totalPrice || 0) - clubDiscount).toFixed(2)));
  order.clubSubscriptionId = subscription.id;
  order.clubBenefits = {
    planId: plan.id,
    ticketDiscountPercent,
    concessionDiscountPercent,
    ticketDiscount: Number(ticketDiscount.toFixed(2)),
    concessionDiscount: Number(concessionDiscount.toFixed(2)),
    freeConcessionDiscount: Number(freeConcessionDiscount.toFixed(2)),
    totalDiscount: clubDiscount,
    freeConcessionItems
  };
  return { order, subscription, plan };
}

  return { clubSavingsSummary, activeClubPlanForBenefits, reservedFreeConcessionQuantity, applyClubPlanBenefits };
}

module.exports = { createClubCheckoutBenefitsService };
