function moneyValue(value) {
  const number = Number(value || 0);
  return Number((Number.isFinite(number) ? number : 0).toFixed(2));
}

function itemGross(item = {}) {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitPrice = Math.max(0, Number(item.originalPrice ?? item.unitPrice ?? item.price ?? 0));
  return moneyValue(quantity * unitPrice);
}

function summarizeConcessionFinance(entries = []) {
  const products = new Map();
  let grossRevenue = 0;
  let netRevenue = 0;
  let clubDiscount = 0;
  let freeItemDiscount = 0;
  let couponDiscount = 0;
  let reconciliationAdjustment = 0;
  let refundTotal = 0;
  let refundedQuantity = 0;
  let itemQuantity = 0;
  let discountedOrders = 0;

  entries.forEach(({ order = {}, breakdown = {} }) => {
    const items = Array.isArray(order.concessionItems) ? order.concessionItems.filter((item) => Number(item.quantity || 0) > 0) : [];
    if (!items.length) return;
    const benefits = order.clubBenefits && typeof order.clubBenefits === "object" ? order.clubBenefits : {};
    const freeItems = new Map((benefits.freeConcessionItems || []).map((item) => [String(item.concessionId || item.id || ""), item]));
    const itemRows = items.map((item) => {
      const id = String(item.id || item.concessionId || item.name || "Produto");
      const quantity = Math.max(0, Number(item.quantity || 0));
      const gross = itemGross(item);
      const itemClubDiscount = Math.min(gross, Math.max(0, Number(item.clubDiscount || 0)));
      const free = freeItems.get(id);
      const freeQuantity = Math.min(quantity, Math.max(0, Number(free?.quantity || 0)));
      const requestedFreeDiscount = freeQuantity * Math.max(0, Number(free?.unitPrice ?? item.originalPrice ?? item.unitPrice ?? 0));
      const itemFreeDiscount = Math.min(Math.max(0, gross - itemClubDiscount), moneyValue(requestedFreeDiscount));
      return {
        id,
        name: String(item.name || id),
        quantity,
        gross,
        clubDiscount: moneyValue(itemClubDiscount),
        freeItemDiscount: moneyValue(itemFreeDiscount),
        freeQuantity,
        baseNet: moneyValue(Math.max(0, gross - itemClubDiscount - itemFreeDiscount)),
        originalUnitPrice: quantity ? moneyValue(gross / quantity) : 0
      };
    });
    const baseNetTotal = itemRows.reduce((sum, item) => sum + item.baseNet, 0);
    const orderCouponDiscount = Math.max(0, Number(breakdown.concessionCouponDiscount || 0));
    const orderAdjustment = Number(breakdown.concessionAdjustment || 0);
    let allocatedCoupon = 0;
    let allocatedAdjustment = 0;
    let allocatedRefund = 0;
    const orderRefund = Math.max(0, Number(breakdown.concessionRefunded || 0));

    itemRows.forEach((item, index) => {
      const last = index === itemRows.length - 1;
      const itemCouponDiscount = last
        ? moneyValue(orderCouponDiscount - allocatedCoupon)
        : moneyValue(baseNetTotal ? orderCouponDiscount * (item.baseNet / baseNetTotal) : 0);
      allocatedCoupon = moneyValue(allocatedCoupon + itemCouponDiscount);
      const beforeAdjustment = moneyValue(Math.max(0, item.baseNet - itemCouponDiscount));
      const adjustmentWeightTotal = Math.max(0, baseNetTotal - orderCouponDiscount);
      const itemAdjustment = last
        ? moneyValue(orderAdjustment - allocatedAdjustment)
        : moneyValue(adjustmentWeightTotal ? orderAdjustment * (beforeAdjustment / adjustmentWeightTotal) : 0);
      allocatedAdjustment = moneyValue(allocatedAdjustment + itemAdjustment);
      const revenueBeforeRefund = moneyValue(Math.max(0, beforeAdjustment + itemAdjustment));
      const refundBaseTotal = Math.max(0, baseNetTotal - orderCouponDiscount + orderAdjustment);
      const itemRefund = last
        ? moneyValue(orderRefund - allocatedRefund)
        : moneyValue(refundBaseTotal ? orderRefund * (revenueBeforeRefund / refundBaseTotal) : 0);
      allocatedRefund = moneyValue(allocatedRefund + itemRefund);
      const finalRevenue = moneyValue(Math.max(0, revenueBeforeRefund - itemRefund));
      const current = products.get(item.id) || {
        id: item.id,
        name: item.name,
        quantity: 0,
        orders: new Set(),
        grossRevenue: 0,
        clubDiscount: 0,
        freeItemDiscount: 0,
        couponDiscount: 0,
        reconciliationAdjustment: 0,
        refundTotal: 0,
        netRevenue: 0,
        refundedQuantity: 0,
        clubDiscountedQuantity: 0,
        couponDiscountedQuantity: 0,
        couponCodes: new Set(),
        freeQuantity: 0,
        minimumUnitPrice: item.originalUnitPrice,
        maximumUnitPrice: item.originalUnitPrice
      };
      current.quantity += item.quantity;
      current.orders.add(String(order.id || ""));
      current.grossRevenue += item.gross;
      current.clubDiscount += item.clubDiscount;
      current.freeItemDiscount += item.freeItemDiscount;
      current.couponDiscount += itemCouponDiscount;
      current.reconciliationAdjustment += itemAdjustment;
      current.refundTotal += itemRefund;
      current.netRevenue += finalRevenue;
      current.refundedQuantity += itemRefund > 0 || order.concessionRefund?.status === "completed" ? item.quantity : 0;
      current.clubDiscountedQuantity += item.clubDiscount > 0 ? Math.max(0, item.quantity - item.freeQuantity) : 0;
      current.couponDiscountedQuantity += itemCouponDiscount > 0 ? item.quantity : 0;
      if (itemCouponDiscount > 0 && order.couponCode) current.couponCodes.add(String(order.couponCode).toUpperCase());
      current.freeQuantity += item.freeQuantity;
      current.minimumUnitPrice = Math.min(current.minimumUnitPrice, item.originalUnitPrice);
      current.maximumUnitPrice = Math.max(current.maximumUnitPrice, item.originalUnitPrice);
      products.set(item.id, current);
    });

    grossRevenue += Number(breakdown.concessionGross || 0);
    netRevenue += Number(breakdown.concessionRevenue || 0);
    clubDiscount += Number(breakdown.concessionClubDiscount || 0);
    freeItemDiscount += Number(breakdown.concessionFreeDiscount || 0);
    couponDiscount += orderCouponDiscount;
    reconciliationAdjustment += orderAdjustment;
    refundTotal += orderRefund;
    itemQuantity += itemRows.reduce((sum, item) => sum + item.quantity, 0);
    refundedQuantity += order.concessionRefund?.status === "completed" ? itemRows.reduce((sum, item) => sum + item.quantity, 0) : 0;
    if (Number(breakdown.concessionGross || 0) - Number(breakdown.concessionRevenue || 0) - orderRefund > 0.009) discountedOrders += 1;
  });

  const productRows = [...products.values()].map((item) => ({
    ...item,
    orders: item.orders.size,
    couponCodes: [...item.couponCodes].sort(),
    grossRevenue: moneyValue(item.grossRevenue),
    clubDiscount: moneyValue(item.clubDiscount),
    freeItemDiscount: moneyValue(item.freeItemDiscount),
    couponDiscount: moneyValue(item.couponDiscount),
    reconciliationAdjustment: moneyValue(item.reconciliationAdjustment),
    refundTotal: moneyValue(item.refundTotal),
    netRevenue: moneyValue(item.netRevenue),
    discountTotal: moneyValue(Math.max(0, item.grossRevenue - item.netRevenue - item.refundTotal)),
    minimumUnitPrice: moneyValue(item.minimumUnitPrice),
    maximumUnitPrice: moneyValue(item.maximumUnitPrice)
  })).sort((left, right) => right.netRevenue - left.netRevenue || right.quantity - left.quantity || left.name.localeCompare(right.name, "pt-BR"));

  return {
    grossRevenue: moneyValue(grossRevenue),
    netRevenue: moneyValue(netRevenue),
    discountTotal: moneyValue(Math.max(0, grossRevenue - netRevenue - refundTotal)),
    identifiedDiscountTotal: moneyValue(clubDiscount + freeItemDiscount + couponDiscount),
    clubDiscount: moneyValue(clubDiscount),
    freeItemDiscount: moneyValue(freeItemDiscount),
    couponDiscount: moneyValue(couponDiscount),
    reconciliationAdjustment: moneyValue(reconciliationAdjustment),
    refundTotal: moneyValue(refundTotal),
    refundedQuantity,
    itemQuantity,
    orders: entries.filter(({ order }) => Array.isArray(order?.concessionItems) && order.concessionItems.some((item) => Number(item.quantity || 0) > 0)).length,
    discountedOrders,
    products: productRows
  };
}

module.exports = { summarizeConcessionFinance, _test: { itemGross, moneyValue } };
