function couponCode(value) {
  return String(value || "").trim().toUpperCase();
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function orderUsesCoupon(order, coupon) {
  if (!order || order.status !== "paid" || !coupon) return false;
  if (order.concessionRefund?.status === "completed") {
    const scope = String(coupon.appliesTo || "all");
    const hasTickets = (order.ticketItems || []).some((item) => Number(item.ticketQuantity ?? item.quantity ?? 0) > 0);
    if (scope === "concessions" || !hasTickets) return false;
  }
  if (order.couponId && coupon.id && String(order.couponId) === String(coupon.id)) return true;
  return Boolean(couponCode(coupon.couponCode) && couponCode(order.couponCode) === couponCode(coupon.couponCode));
}

function paidCouponOrders(db, coupon) {
  return (db.orders || []).filter((order) => orderUsesCoupon(order, coupon));
}

function effectiveCouponDiscount(order) {
  const granted = Number(order.couponDiscount || order.discountValue || 0);
  const reversed = order.concessionRefund?.status === "completed" ? Number(order.concessionRefund.couponDiscount || 0) : 0;
  return Math.max(0, granted - reversed);
}

function couponUsageSummary(db, coupon) {
  const orders = paidCouponOrders(db, coupon);
  return {
    usageCount: orders.length,
    discountGranted: Number(orders.reduce((sum, order) => sum + effectiveCouponDiscount(order), 0).toFixed(2))
  };
}

function archiveExpiredCoupons(db, now = new Date()) {
  const reference = validDate(now) || new Date();
  const archived = [];
  for (const coupon of db.promotions || []) {
    const endsAt = validDate(coupon.endsAt);
    if (!couponCode(coupon.couponCode) || !endsAt || endsAt.getTime() >= reference.getTime() || coupon.archivedAt) continue;
    coupon.active = false;
    coupon.archivedAt = reference.toISOString();
    coupon.archiveReason = "expired";
    coupon.updatedAt = reference.toISOString();
    archived.push({ id: coupon.id, title: coupon.title || "", couponCode: coupon.couponCode || "", endsAt: coupon.endsAt });
  }
  return { changed: archived.length > 0, archived };
}

function findCustomer(db, order) {
  const normalizedEmail = String(order.customerEmail || "").trim().toLowerCase();
  return (db.users || []).find((user) =>
    (order.customerUserId && String(user.id) === String(order.customerUserId)) ||
    (normalizedEmail && String(user.email || "").trim().toLowerCase() === normalizedEmail)
  ) || null;
}

function findMovie(db, order) {
  return (db.movies || []).find((movie) => String(movie.id) === String(order.movieId || order.archivedMovieId || "")) || null;
}

function usageDate(order) {
  return order.paidAt || order.paymentApprovedAt || order.approvedAt || order.updatedAt || order.createdAt || "";
}

function itemSummary(items = []) {
  return items
    .map((item) => {
      const quantity = Math.max(0, Number(item.ticketQuantity ?? item.quantity ?? 0));
      return quantity > 0 ? `${quantity}x ${item.name || item.title || item.id || "Item"}` : "";
    })
    .filter(Boolean);
}

function couponUsageHistory(db, coupon, options = {}) {
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(options.pageSize || 20))));
  const requestedPage = Math.max(1, Math.floor(Number(options.page || 1)));
  const orders = paidCouponOrders(db, coupon)
    .sort((left, right) => new Date(usageDate(right)).getTime() - new Date(usageDate(left)).getTime());
  const pages = Math.max(1, Math.ceil(orders.length / pageSize));
  const page = Math.min(requestedPage, pages);
  const start = (page - 1) * pageSize;
  const usages = orders.slice(start, start + pageSize).map((order) => {
    const customer = findCustomer(db, order);
    const movie = findMovie(db, order);
    return {
      orderId: order.id || "",
      usedAt: usageDate(order),
      customerId: order.customerUserId || customer?.id || "",
      customerName: order.customerName || customer?.name || "Cliente",
      customerEmail: order.customerEmail || customer?.email || "",
      movieId: order.movieId || order.archivedMovieId || movie?.id || "",
      movieTitle: order.movieTitle || movie?.title || "Compra sem filme",
      sessionId: order.sessionId || order.archivedSessionId || "",
      sessionDate: order.sessionDate || order.archivedSessionDate || "",
      sessionTime: order.sessionTime || order.archivedSessionTime || "",
      ticketItems: itemSummary(order.ticketItems),
      concessionItems: itemSummary(order.concessionItems),
      discountAmount: Number(effectiveCouponDiscount(order).toFixed(2)),
      orderTotal: Number(order.totalPrice || 0),
      paymentMethod: order.paymentMethod || ""
    };
  });
  return {
    ...couponUsageSummary(db, coupon),
    usages,
    page,
    pages,
    pageSize,
    total: orders.length
  };
}

module.exports = {
  archiveExpiredCoupons,
  couponUsageHistory,
  couponUsageSummary,
  orderUsesCoupon,
  _test: { effectiveCouponDiscount, itemSummary, paidCouponOrders, usageDate }
};
