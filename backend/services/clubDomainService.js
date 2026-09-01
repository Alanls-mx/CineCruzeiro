const crypto = require("crypto");

const CREDIT_STATUSES = new Set(["available", "reserved", "redeemed", "expired", "cancelled"]);

function id(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
}

function money(value) {
  return Number(Math.max(0, Number(value || 0)).toFixed(2));
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Number(days || 0)));
  return date.toISOString();
}

function releaseExpiredReservations(db, now = new Date()) {
  const timestamp = now.getTime();
  for (const credit of db.subscriptionCreditUnits || []) {
    if (!CREDIT_STATUSES.has(credit.status)) credit.status = "available";
    if (credit.status === "available" && new Date(credit.expiresAt).getTime() <= timestamp) {
      credit.status = "expired";
      credit.updatedAt = now.toISOString();
    }
    if (credit.status === "reserved" && new Date(credit.reservationExpiresAt || 0).getTime() <= timestamp) {
      credit.status = new Date(credit.expiresAt).getTime() <= timestamp ? "expired" : "available";
      credit.reservedAt = "";
      credit.reservationExpiresAt = "";
      credit.reservedOrderId = "";
      credit.updatedAt = now.toISOString();
    }
  }
  for (const redemption of db.subscriptionCreditRedemptions || []) {
    if (redemption.status !== "reserved") continue;
    const credit = (db.subscriptionCreditUnits || []).find((item) => item.id === redemption.subscriptionCreditId);
    if (!credit || credit.status !== "reserved") {
      redemption.status = "released";
      redemption.releasedAt = now.toISOString();
      redemption.updatedAt = now.toISOString();
    }
  }
}

function issueCycle(db, { subscription, plan, payment = null, cycleStart, cycleEnd, idempotencyKey, now = new Date() }) {
  db.subscriptionCycles ||= [];
  db.subscriptionPayments ||= [];
  db.subscriptionCreditUnits ||= [];
  const existing = db.subscriptionCycles.find((cycle) => cycle.idempotencyKey === idempotencyKey);
  if (existing) return existing;

  const startedAt = new Date(cycleStart || now).toISOString();
  const endedAt = new Date(cycleEnd).toISOString();
  const accounting = plan.accounting || plan.accountingConfig || {};
  const cycle = {
    id: id("ciclo-clube"),
    subscriptionId: subscription.id,
    customerId: subscription.userId,
    planId: plan.id,
    cycleStart: startedAt,
    cycleEnd: endedAt,
    status: "active",
    sourcePaymentId: payment?.id || "",
    idempotencyKey,
    planSnapshot: { ...plan },
    accountingSnapshot: { ...accounting },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  db.subscriptionCycles.unshift(cycle);

  if (payment) {
    const paymentKey = `subscription-payment:${payment.provider || "unknown"}:${payment.providerPaymentId || payment.id}`;
    if (!db.subscriptionPayments.some((item) => item.idempotencyKey === paymentKey)) {
      db.subscriptionPayments.unshift({
        id: id("mensalidade"),
        subscriptionId: subscription.id,
        cycleId: cycle.id,
        customerId: subscription.userId,
        provider: payment.provider || subscription.provider || "manual_admin",
        providerPaymentId: payment.providerPaymentId || payment.id || "",
        amount: money(payment.amount ?? plan.monthlyPrice),
        currency: payment.currency || "BRL",
        status: "approved",
        idempotencyKey: paymentKey,
        approvedAt: payment.approvedAt || now.toISOString(),
        metadata: payment.metadata || {},
        createdAt: payment.createdAt || now.toISOString(),
        updatedAt: now.toISOString()
      });
    }
  }

  const configuredQuantity = Math.max(0, Math.floor(Number(plan.includedTickets || plan.ticketsPerCycle || 0)));
  const previousAvailable = db.subscriptionCreditUnits.filter((credit) => credit.subscriptionId === subscription.id && credit.status === "available");
  if (!plan.allowCreditRollover) {
    previousAvailable.forEach((credit) => {
      credit.status = "expired";
      credit.updatedAt = now.toISOString();
    });
  }
  const accumulated = plan.allowCreditRollover ? previousAvailable.length : 0;
  const cap = Number(plan.maxAccumulatedCredits || 0);
  const quantity = cap > 0 ? Math.max(0, Math.min(configuredQuantity, cap - accumulated)) : configuredQuantity;
  const referenceValue = money(plan.creditReferenceValue || 0);
  const validityDays = Number(plan.creditValidityDays || 0);
  const expiresAt = validityDays > 0 ? addDays(startedAt, validityDays) : addDays(endedAt, plan.gracePeriodDays || 0);
  for (let index = 0; index < quantity; index += 1) {
    db.subscriptionCreditUnits.unshift({
      id: id("credito-unidade"),
      subscriptionId: subscription.id,
      customerId: subscription.userId,
      cycleId: cycle.id,
      referenceValue,
      status: "available",
      issuedAt: now.toISOString(),
      expiresAt,
      reservedAt: "",
      reservationExpiresAt: "",
      reservedOrderId: "",
      redeemedAt: "",
      cancelledAt: "",
      rolloverFromId: "",
      metadata: { position: index + 1 },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
  }
  return cycle;
}

function eligibleCredits(db, subscriptionId, now = new Date()) {
  releaseExpiredReservations(db, now);
  return (db.subscriptionCreditUnits || [])
    .filter((credit) => credit.subscriptionId === subscriptionId && credit.status === "available" && new Date(credit.expiresAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
}

function reserveCredits(db, { subscription, order, ticketPrices, reservationExpiresAt, idempotencyKey, now = new Date() }) {
  db.subscriptionCreditRedemptions ||= [];
  const existing = db.subscriptionCreditRedemptions.filter((item) => item.orderId === order.id && item.status === "reserved");
  if (existing.length) return existing;
  const prices = ticketPrices.map(money);
  const credits = eligibleCredits(db, subscription.id, now);
  if (credits.length < prices.length) {
    const error = new Error("Créditos do Clube insuficientes para os ingressos selecionados.");
    error.statusCode = 409;
    error.code = "CLUB_CREDITS_EXHAUSTED";
    throw error;
  }
  const expiresAt = new Date(reservationExpiresAt || new Date(now.getTime() + 15 * 60 * 1000)).toISOString();
  return prices.map((basePrice, index) => {
    const credit = credits[index];
    const referenceValue = credit.referenceValue > 0 ? money(credit.referenceValue) : basePrice;
    const creditAmount = money(Math.min(basePrice, referenceValue));
    const additionalPaymentAmount = money(basePrice - creditAmount);
    credit.status = "reserved";
    credit.reservedAt = now.toISOString();
    credit.reservationExpiresAt = expiresAt;
    credit.reservedOrderId = order.id;
    credit.updatedAt = now.toISOString();
    const redemption = {
      id: id("resgate-clube"),
      subscriptionCreditId: credit.id,
      subscriptionId: subscription.id,
      orderId: order.id,
      ticketId: "",
      sessionId: order.sessionId || "",
      status: "reserved",
      basePrice,
      creditAmount,
      additionalPaymentAmount,
      idempotencyKey: `${idempotencyKey}:credit:${index + 1}`,
      reservedAt: now.toISOString(),
      redeemedAt: "",
      releasedAt: "",
      metadata: {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    db.subscriptionCreditRedemptions.unshift(redemption);
    return redemption;
  });
}

function redeemReservedCredits(db, order, tickets, now = new Date()) {
  const redemptions = (db.subscriptionCreditRedemptions || []).filter((item) => item.orderId === order.id && item.status === "reserved");
  redemptions.forEach((redemption, index) => {
    const credit = (db.subscriptionCreditUnits || []).find((item) => item.id === redemption.subscriptionCreditId);
    if (!credit || credit.status !== "reserved" || credit.reservedOrderId !== order.id) {
      const error = new Error("A reserva de crédito do Clube não está mais disponível.");
      error.statusCode = 409;
      error.code = "CLUB_CREDIT_RESERVATION_LOST";
      throw error;
    }
    const ticket = tickets[index];
    credit.status = "redeemed";
    credit.redeemedAt = now.toISOString();
    credit.reservationExpiresAt = "";
    credit.updatedAt = now.toISOString();
    redemption.status = "redeemed";
    redemption.ticketId = ticket?.id || "";
    redemption.redeemedAt = now.toISOString();
    redemption.updatedAt = now.toISOString();
    if (ticket) {
      ticket.basePrice = redemption.basePrice;
      ticket.subscriptionCreditAmount = redemption.creditAmount;
      ticket.additionalPaymentAmount = redemption.additionalPaymentAmount;
      ticket.paymentSource = "subscription_credit";
      ticket.subscriptionCreditId = credit.id;
      ticket.ticketType = "Clube Cine Cruzeiro";
    }
  });
  return redemptions;
}

function releaseOrderCredits(db, orderId, now = new Date()) {
  for (const redemption of db.subscriptionCreditRedemptions || []) {
    if (redemption.orderId !== orderId || redemption.status !== "reserved") continue;
    const credit = (db.subscriptionCreditUnits || []).find((item) => item.id === redemption.subscriptionCreditId);
    if (credit?.status === "reserved" && credit.reservedOrderId === orderId) {
      credit.status = new Date(credit.expiresAt).getTime() <= now.getTime() ? "expired" : "available";
      credit.reservedAt = "";
      credit.reservationExpiresAt = "";
      credit.reservedOrderId = "";
      credit.updatedAt = now.toISOString();
    }
    redemption.status = "released";
    redemption.releasedAt = now.toISOString();
    redemption.updatedAt = now.toISOString();
  }
}

function creditCounts(db, subscriptionId, now = new Date()) {
  releaseExpiredReservations(db, now);
  return (db.subscriptionCreditUnits || [])
    .filter((item) => item.subscriptionId === subscriptionId)
    .reduce((counts, item) => ({ ...counts, [item.status]: Number(counts[item.status] || 0) + 1 }), {
      available: 0, reserved: 0, redeemed: 0, expired: 0, cancelled: 0
    });
}

function calculateGoodsDiscount(items, plan) {
  const percent = Math.min(90, Math.max(0, Number(plan.concessionDiscountPercent || 0)));
  const excluded = new Set(plan.excludedConcessionIds || []);
  return (items || []).map((item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const originalUnitPrice = money(item.unitPrice);
    const discount = excluded.has(item.id) ? 0 : money(quantity * originalUnitPrice * (percent / 100));
    return {
      ...item,
      originalPrice: originalUnitPrice,
      clubDiscount: discount,
      finalPrice: money(originalUnitPrice - discount / Math.max(1, quantity)),
      clubDiscountExcluded: excluded.has(item.id)
    };
  });
}

function orderBreakdown({ ticketSubtotal = 0, goods = [], creditAmount = 0, ticketDiscount = 0, freeGoodsDiscount = 0 }) {
  const serviceSubtotal = money(ticketSubtotal);
  const goodsSubtotal = money(goods.reduce((sum, item) => sum + Number(item.originalPrice ?? item.unitPrice ?? 0) * Number(item.quantity || 0), 0));
  const goodsDiscount = money(goods.reduce((sum, item) => sum + Number(item.clubDiscount || 0), 0));
  const clubDiscount = money(ticketDiscount + goodsDiscount + freeGoodsDiscount);
  const clubCreditsApplied = money(Math.min(creditAmount, Math.max(0, serviceSubtotal - ticketDiscount)));
  const orderTotal = money(Math.max(0, serviceSubtotal + goodsSubtotal - clubDiscount - clubCreditsApplied));
  return { serviceSubtotal, goodsSubtotal, clubCreditsApplied, clubDiscount, additionalPayment: orderTotal, orderTotal };
}

module.exports = {
  calculateGoodsDiscount,
  creditCounts,
  eligibleCredits,
  issueCycle,
  orderBreakdown,
  redeemReservedCredits,
  releaseExpiredReservations,
  releaseOrderCredits,
  reserveCredits
};
