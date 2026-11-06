function createPointPaymentStateService({
  paymentStatusAfterWebhook,
  pointPaymentOrders,
  orderRequiresConfirmedPrint,
  stagePaidOrderForPrint,
  finalizePaidOrder,
  releaseConcessionReservation,
}) {
  function applyPointPaymentStatus(db, payment, providerPayment = {}) {
    const now = new Date().toISOString();
    const nextStatus = paymentStatusAfterWebhook(payment.status, providerPayment.status || payment.status || "pending");
    payment.status = nextStatus;
    payment.updatedAt = now;
    if (providerPayment.externalReference) payment.providerReference = providerPayment.externalReference;
    payment.metadata = {
      ...(payment.metadata || {}),
      terminalId: providerPayment.terminalId || payment.metadata?.terminalId || "",
      providerStatus: providerPayment.providerStatus || payment.metadata?.providerStatus || "",
      statusDetail: providerPayment.statusDetail || payment.metadata?.statusDetail || "",
      paymentMethod: providerPayment.paymentMethod || payment.metadata?.paymentMethod || "",
      providerPaymentTransactionId: providerPayment.paymentId || payment.metadata?.providerPaymentTransactionId || "",
      lastPointSyncAt: now
    };
    if (nextStatus === "approved") payment.approvedAt ||= now;
    if (nextStatus === "expired") payment.expiredAt ||= now;
    if (nextStatus === "cancelled") payment.cancelledAt ||= now;
    if (nextStatus === "refunded") payment.refundedAt ||= now;

    const orders = pointPaymentOrders(db, payment);
    if (payment.metadata?.cancellationRefund) return { orders, tickets: [], newlyPaidOrders: [] };
    const approvedAfterClosure = nextStatus === "approved" && (
      !orders.length || orders.some((order) => ["cancelled", "expired", "rejected", "refunded"].includes(String(order.status || "")))
    );
    const providerDisagreesWithPaidOrder = orders.some((order) => order.status === "paid")
      && ["refunded", "cancelled", "expired", "rejected"].includes(String(providerPayment.status || ""));
    const reconciliationRequired = approvedAfterClosure || providerDisagreesWithPaidOrder;
    if (reconciliationRequired) {
      payment.metadata.reconciliationRequired = true;
      payment.metadata.reconciliationReason = !orders.length ? "point_order_missing"
        : providerDisagreesWithPaidOrder ? "point_provider_disagrees_with_paid_order" : "point_approved_after_order_closed";
      payment.metadata.reconciliationRequiredAt ||= now;
    }
    const newlyPaidOrders = [];
    const tickets = [];
    for (const order of orders) {
      if (reconciliationRequired) continue;
      if (nextStatus === "approved") {
        if (orderRequiresConfirmedPrint(order)) {
          tickets.push(...stagePaidOrderForPrint(db, order, payment, payment.method === "courtesy" ? "courtesy" : "box_office"));
          continue;
        }
        const wasPaid = order.status === "paid";
        const orderTickets = finalizePaidOrder(db, order, payment, "box_office");
        tickets.push(...orderTickets);
        if (!wasPaid && order.status === "paid") newlyPaidOrders.push(order);
        continue;
      }
      if (["expired", "cancelled", "rejected", "refunded"].includes(nextStatus) && order.status !== "paid") {
        releaseConcessionReservation(db, order);
        delete order.pendingPrintTickets;
        order.status = nextStatus === "rejected" ? "cancelled" : nextStatus;
        order.paymentStatus = nextStatus;
        order.updatedAt = now;
      } else if (order.status !== "paid") {
        order.status = "pending_payment";
        order.paymentStatus = nextStatus;
        order.updatedAt = now;
      }
    }
    return { orders, tickets, newlyPaidOrders, reconciliationRequired };
  }

  return { applyPointPaymentStatus };
}

module.exports = { createPointPaymentStateService };
