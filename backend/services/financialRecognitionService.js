const APPROVED_STATUSES = new Set(["approved", "paid", "processed"]);
const FULL_REFUND_STATUSES = new Set(["refunded", "charged_back", "chargeback"]);

function money(value) {
  const parsed = Number(value || 0);
  return Number((Number.isFinite(parsed) ? parsed : 0).toFixed(2));
}

function completedRefundAmount(refund) {
  if (!refund || typeof refund !== "object") return 0;
  const status = String(refund.status || refund.providerStatus || "").toLowerCase();
  const completed = refund.completedAt || refund.refundedAt || ["completed", "refunded", "partially_refunded"].includes(status);
  return completed ? Math.max(0, money(refund.amount)) : 0;
}

function paymentRefundedAmount(payment = {}) {
  const amount = Math.max(0, money(payment.amount || payment.totalPrice));
  const status = String(payment.status || "").toLowerCase();
  if (FULL_REFUND_STATUSES.has(status)) return amount;

  const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  const scopedRefunds = completedRefundAmount(metadata.ticketRefund) + completedRefundAmount(metadata.concessionRefund);
  const cancellationRefund = completedRefundAmount(metadata.cancellationRefund);
  const recorded = Math.max(0, money(payment.refundedAmount), money(scopedRefunds), money(cancellationRefund));
  return Math.min(amount, recorded);
}

function paymentFinancialState(payment = {}) {
  const amount = Math.max(0, money(payment.amount || payment.totalPrice));
  const status = String(payment.status || "").toLowerCase();
  const refundedAmount = paymentRefundedAmount(payment);
  const fullyRefunded = FULL_REFUND_STATUSES.has(status) || (amount > 0 && refundedAmount >= amount);
  const approved = APPROVED_STATUSES.has(status) && !fullyRefunded;
  return {
    amount,
    approved,
    fullyRefunded,
    refundedAmount,
    netAmount: approved ? money(Math.max(0, amount - refundedAmount)) : 0
  };
}

function isOrderFinanciallySettled(order = {}, payment = null) {
  if (payment) {
    const status = String(payment.status || "").toLowerCase();
    return APPROVED_STATUSES.has(status) || FULL_REFUND_STATUSES.has(status) || paymentRefundedAmount(payment) > 0;
  }
  return ["paid", "refunded"].includes(String(order.status || "").toLowerCase())
    || ["approved", "refunded"].includes(String(order.paymentStatus || "").toLowerCase());
}

function recognitionDate(order = {}, payment = null) {
  return payment?.approvedAt || order.paidAt || payment?.createdAt || order.createdAt || "";
}

function applyCompletedRefunds({ ticketRevenue = 0, concessionRevenue = 0, order = {}, payment = null } = {}) {
  const originalTicketRevenue = Math.max(0, money(ticketRevenue));
  const originalConcessionRevenue = Math.max(0, money(concessionRevenue));
  const totalRevenue = money(originalTicketRevenue + originalConcessionRevenue);
  const paymentState = paymentFinancialState(payment || {});
  const orderFullyRefunded = ["refunded"].includes(String(order.status || "").toLowerCase())
    || ["refunded"].includes(String(order.paymentStatus || "").toLowerCase())
    || paymentState.fullyRefunded;

  if (orderFullyRefunded) {
    return {
      ticketRevenue: 0,
      concessionRevenue: 0,
      ticketRefunded: originalTicketRevenue,
      concessionRefunded: originalConcessionRevenue,
      refundTotal: totalRevenue,
      fullyRefunded: true
    };
  }

  let ticketRefunded = Math.min(originalTicketRevenue, completedRefundAmount(order.ticketRefund));
  let concessionRefunded = Math.min(originalConcessionRevenue, completedRefundAmount(order.concessionRefund));
  const specificallyAllocated = money(ticketRefunded + concessionRefunded);
  const sharedPayment = Array.isArray(payment?.metadata?.relatedOrderIds) && payment.metadata.relatedOrderIds.length > 1;
  let unallocated = sharedPayment ? 0 : Math.max(0, money(paymentState.refundedAmount - specificallyAllocated));

  if (unallocated > 0 && totalRevenue > 0) {
    const availableTicket = Math.max(0, originalTicketRevenue - ticketRefunded);
    const availableConcession = Math.max(0, originalConcessionRevenue - concessionRefunded);
    const availableTotal = availableTicket + availableConcession;
    const ticketShare = availableTotal > 0 ? availableTicket / availableTotal : 0;
    const ticketAllocation = Math.min(availableTicket, money(unallocated * ticketShare));
    ticketRefunded = money(ticketRefunded + ticketAllocation);
    unallocated = money(unallocated - ticketAllocation);
    concessionRefunded = money(concessionRefunded + Math.min(availableConcession, unallocated));
  }

  return {
    ticketRevenue: money(Math.max(0, originalTicketRevenue - ticketRefunded)),
    concessionRevenue: money(Math.max(0, originalConcessionRevenue - concessionRefunded)),
    ticketRefunded: money(ticketRefunded),
    concessionRefunded: money(concessionRefunded),
    refundTotal: money(ticketRefunded + concessionRefunded),
    fullyRefunded: false
  };
}

module.exports = {
  APPROVED_STATUSES,
  FULL_REFUND_STATUSES,
  applyCompletedRefunds,
  completedRefundAmount,
  isOrderFinanciallySettled,
  paymentFinancialState,
  paymentRefundedAmount,
  recognitionDate
};
