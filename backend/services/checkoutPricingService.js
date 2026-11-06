function ticketSubtotalForOrder(db, order) {
  if (Array.isArray(order.ticketItems) && order.ticketItems.length) {
    return Number(order.ticketItems.reduce((sum, item) => (
      sum + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unitPrice || 0))
    ), 0).toFixed(2));
  }
  const movie = (db.movies || []).find((item) => item.id === order.movieId);
  const session = (movie?.sessions || []).find((item) => item.id === order.sessionId);
  if (!session) return 0;
  const full = Math.max(0, Number(order.fullTicketsCount || 0));
  const half = Math.max(0, Number(order.halfTicketsCount || 0));
  return Number((full * Number(session.priceFull || 0) + half * Number(session.priceHalf || 0)).toFixed(2));
}

function ticketUnitsForOrder(order) {
  return (order.ticketItems || []).flatMap((item) => {
    const issuedQuantity = Math.max(1, Number(item.ticketQuantity || Number(item.quantity || 0) * Number(item.bundleQuantity || 1)));
    const totalCents = Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0) * 100);
    const unitCents = Math.floor(totalCents / issuedQuantity);
    const remainder = totalCents - unitCents * issuedQuantity;
    return Array.from({ length: issuedQuantity }, (_, index) => ({
      ticketTypeId: String(item.id || ""),
      ticketTypeName: String(item.name || "Ingresso"),
      unitPrice: (unitCents + (index < remainder ? 1 : 0)) / 100
    }));
  });
}

function ticketUnitPricesForOrder(order) {
  return ticketUnitsForOrder(order).map((item) => item.unitPrice);
}

function allocateDiscountAcrossAmounts(amounts, discountValue) {
  const cents = amounts.map((amount) => Math.max(0, Math.round(Number(amount || 0) * 100)));
  const subtotalCents = cents.reduce((sum, amount) => sum + amount, 0);
  const discountCents = Math.min(subtotalCents, Math.max(0, Math.round(Number(discountValue || 0) * 100)));
  if (!subtotalCents || !discountCents) return cents.map(() => 0);
  const allocations = cents.map((amount) => Math.floor(discountCents * amount / subtotalCents));
  let remainder = discountCents - allocations.reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; remainder > 0 && index < allocations.length; index = (index + 1) % allocations.length) {
    if (allocations[index] < cents[index]) {
      allocations[index] += 1;
      remainder -= 1;
    }
  }
  return allocations.map((amount) => amount / 100);
}

function calculateCouponDiscountForAmounts(coupon, ticketTotal, concessionTotal) {
  const appliesTo = ["tickets", "concessions"].includes(coupon?.appliesTo) ? coupon.appliesTo : "all";
  const normalizedTicketTotal = Math.max(0, Number(ticketTotal || 0));
  const normalizedConcessionTotal = Math.max(0, Number(concessionTotal || 0));
  const subtotal = Number((normalizedTicketTotal + normalizedConcessionTotal).toFixed(2));
  const eligibleSubtotal = appliesTo === "tickets" ? normalizedTicketTotal : appliesTo === "concessions" ? normalizedConcessionTotal : subtotal;
  const value = Math.max(0, Number(coupon?.value || 0));
  let discountValue = coupon?.discountType === "percent"
    ? eligibleSubtotal * Math.min(100, value) / 100
    : coupon?.discountType === "fixed_price"
      ? Math.max(0, eligibleSubtotal - value)
      : Math.min(eligibleSubtotal, value);
  if (Number(coupon?.maximumDiscount || 0) > 0) discountValue = Math.min(discountValue, Number(coupon.maximumDiscount));
  discountValue = Number(Math.min(eligibleSubtotal, Math.max(0, discountValue)).toFixed(2));
  const [ticketDiscount, concessionDiscount] = appliesTo === "tickets"
    ? [discountValue, 0]
    : appliesTo === "concessions"
      ? [0, discountValue]
      : allocateDiscountAcrossAmounts([normalizedTicketTotal, normalizedConcessionTotal], discountValue);
  return { discountValue, ticketDiscount, concessionDiscount };
}

function discountedTicketUnitsForOrder(order, plan = null) {
  const units = ticketUnitsForOrder(order);
  const prices = units.map((unit) => unit.unitPrice);
  const referenceValue = Math.max(0, Number(plan?.creditReferenceValue || 0));
  const creditFirstAmounts = order?.useClubCredits && plan
    ? prices.map((price) => Math.max(0, Number((price - Math.min(price, referenceValue > 0 ? referenceValue : price)).toFixed(2))))
    : prices;
  const couponAllocations = allocateDiscountAcrossAmounts(creditFirstAmounts, order?.couponTicketDiscount);
  const afterCoupon = prices.map((price, index) => Math.max(0, Number((price - couponAllocations[index]).toFixed(2))));
  const clubAllocations = allocateDiscountAcrossAmounts(afterCoupon, order?.clubBenefits?.ticketDiscount);
  return units.map((unit, index) => ({
    ...unit,
    couponDiscount: couponAllocations[index],
    planDiscount: clubAllocations[index],
    discountedPrice: Math.max(0, Number((unit.unitPrice - couponAllocations[index] - clubAllocations[index]).toFixed(2)))
  }));
}

function summarizeClubCreditItems(order, plan, redemptions = null) {
  const units = discountedTicketUnitsForOrder(order, plan);
  const referenceValue = Math.max(0, Number(plan?.creditReferenceValue || 0));
  const applied = units.map((unit, index) => {
    const redemption = redemptions?.[index];
    const creditAmount = Number(redemption?.creditAmount ?? Math.min(unit.unitPrice, referenceValue > 0 ? referenceValue : unit.unitPrice));
    return {
      ...unit,
      creditAmount: Number(creditAmount.toFixed(2)),
      additionalPaymentAmount: Number(Math.max(0, unit.discountedPrice - creditAmount).toFixed(2))
    };
  });
  const grouped = new Map();
  applied.forEach((item) => {
    const key = `${item.ticketTypeId}:${item.ticketTypeName}`;
    const current = grouped.get(key) || {
      ticketTypeId: item.ticketTypeId,
      ticketTypeName: item.ticketTypeName,
      quantity: 0,
      originalUnitPrice: item.unitPrice,
      originalTotalPrice: 0,
      discountedUnitPrice: item.discountedPrice,
      discountedTotalPrice: 0,
      couponDiscountAmount: 0,
      planDiscountAmount: 0,
      creditAmount: 0,
      additionalPaymentAmount: 0
    };
    current.quantity += 1;
    current.originalTotalPrice = Number((current.originalTotalPrice + item.unitPrice).toFixed(2));
    current.discountedTotalPrice = Number((current.discountedTotalPrice + item.discountedPrice).toFixed(2));
    current.couponDiscountAmount = Number((current.couponDiscountAmount + item.couponDiscount).toFixed(2));
    current.planDiscountAmount = Number((current.planDiscountAmount + item.planDiscount).toFixed(2));
    current.creditAmount = Number((current.creditAmount + item.creditAmount).toFixed(2));
    current.additionalPaymentAmount = Number((current.additionalPaymentAmount + item.additionalPaymentAmount).toFixed(2));
    grouped.set(key, current);
  });
  return {
    quantity: applied.length,
    totalAmount: Number(applied.reduce((sum, item) => sum + item.creditAmount, 0).toFixed(2)),
    items: [...grouped.values()]
  };
}

function calculateClubTicketDiscount(order, ticketNetAfterCoupon, ticketDiscountPercent) {
  if (order?.useClubCredits) return 0;
  return Number((Number(ticketNetAfterCoupon || 0) * (Number(ticketDiscountPercent || 0) / 100)).toFixed(2));
}

function assertClubPlanEligibility(plan, order) {
  if ((plan.eligibleFormats || []).length && !plan.eligibleFormats.includes(order.sessionFormat)) {
    const error = new Error("Este formato de sessão não aceita créditos deste plano.");
    error.statusCode = 409;
    error.code = "CLUB_SESSION_FORMAT_NOT_ELIGIBLE";
    throw error;
  }
  if ((plan.eligibleSessionIds || []).length && !plan.eligibleSessionIds.includes(order.sessionId)) {
    const error = new Error("Esta sessão não aceita créditos deste plano.");
    error.statusCode = 409;
    error.code = "CLUB_SESSION_NOT_ELIGIBLE";
    throw error;
  }
}

module.exports = {
  ticketSubtotalForOrder,
  ticketUnitsForOrder,
  ticketUnitPricesForOrder,
  allocateDiscountAcrossAmounts,
  calculateCouponDiscountForAmounts,
  discountedTicketUnitsForOrder,
  summarizeClubCreditItems,
  calculateClubTicketDiscount,
  assertClubPlanEligibility,
};
