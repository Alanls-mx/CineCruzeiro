function createFullOrderRefundCoordinator({
  withCriticalMutation,
  readDb,
  writeDb,
  refundError,
  orderPayment,
  orderTickets,
  isOrderSessionExpired,
  cancelOrder,
  refundProviderConfig,
  paymentService,
  prepareRefund,
  appendOrderAudit,
  structuredCloneSafe,
  broadcastReleasedOrderSeats,
  submitFullRefund,
  logEvent,
  goodsFiscalService,
  eachStockedOrderItem,
  adjustConcessionStock,
}) {
  async function cancelOrderWithRefund(orderId, reason, adminUser) {
    const prepared = await withCriticalMutation(async () => {
      const db = await readDb();
      const order = (db.orders || []).find((item) => item.id === orderId);
      if (!order) throw refundError("ORDER_NOT_FOUND", "Pedido nao encontrado.", 404);
      const payment = orderPayment(db, orderId);
      const existing = payment?.metadata?.cancellationRefund;
      if (existing?.status === "completed") return { completed: true, order, payment };
      if (["cancelled", "refunded"].includes(order.status) && !existing) {
        return { completed: true, manualRefundRequired: order.refundStatus === "required", order, payment };
      }

      const tickets = orderTickets(db, orderId) || [];
      const hasUsedTickets = tickets.some((t) => t.status === "used");
      const hasFulfilledConcessions = (order.concessionItems || []).some((item) => Number(item.fulfilledQuantity || 0) > 0) || Boolean(order.concessionsFulfilledAt);

      if (!existing && isOrderSessionExpired(order, db)) {
        throw refundError("SESSION_EXPIRED", "A sessão deste pedido já expirou; cancelamento e reembolso indisponíveis.", 409);
      }
      if (!existing && hasUsedTickets && hasFulfilledConcessions) {
        throw refundError("ORDER_ALREADY_VALIDATED", "Este pedido já foi totalmente validado e consumido no cinema; cancelamento e reembolso indisponíveis.", 409);
      }
      if (!existing && hasUsedTickets) {
        throw refundError("TICKETS_ALREADY_USED", "Os ingressos deste pedido já foram validados no cinema e não podem ser estornados. Você pode reembolsar separadamente a bomboniere pendente.", 409);
      }
      if (!existing && hasFulfilledConcessions) {
        throw refundError("CONCESSIONS_ALREADY_FULFILLED", "Os itens de bomboniere já foram entregues ao cliente e não podem ser estornados. Você pode reembolsar separadamente os ingressos pendentes.", 409);
      }

      if (!existing && (!payment || payment.status !== "approved" || Number(payment.amount) === 0)) {
        cancelOrder(db, order, reason, adminUser);
        await writeDb(db);
        return { completed: true, order, payment };
      }
      const config = refundProviderConfig(db, payment);
      const token = payment?.provider === "pag_bank" ? config.accessToken : paymentService.getMercadoPagoAccessToken(config);
      const sandboxRefund = config.environment === "sandbox";
      let manualRefundReason = !token && !sandboxRefund
        ? "A integração do provedor original não está configurada para executar a devolução automaticamente."
        : "";
      let refund = existing || null;
      if (!manualRefundReason && !refund) {
        try {
          refund = prepareRefund(payment, order);
        } catch (error) {
          manualRefundReason = error.message || "A forma de pagamento exige devolucao manual.";
        }
      }
      if (manualRefundReason) {
        if (!['cancelled', 'refunded'].includes(order.status)) cancelOrder(db, order, reason, adminUser);
        const now = new Date().toISOString();
        order.refundStatus = "required";
        order.manualRefundRequired = true;
        order.manualRefundReason = manualRefundReason;
        order.archived = true;
        order.archivedAt = now;
        order.archivedBy = adminUser?.id || "system";
        order.archivedReason = "Pedido cancelado (devolução manual)";
        payment.refundStatus = "required";
        payment.metadata = {
          ...(payment.metadata || {}),
          manualRefund: {
            status: "required",
            reason: manualRefundReason,
            requestedAt: payment.metadata?.manualRefund?.requestedAt || now,
            requestedBy: adminUser?.id || ""
          }
        };
        appendOrderAudit(order, { action: "refund.manual_required", reason: manualRefundReason, updatedBy: adminUser?.id || "", createdAt: now });
        await writeDb(db);
        return { completed: true, manualRefundRequired: true, manualRefundReason, order, payment };
      }
      order.refundStatus = "pending";
      payment.refundStatus = "pending";
      payment.metadata = { ...payment.metadata, cancellationRefund: refund };
      appendOrderAudit(order, { action: "refund.pending", refundId: refund.id, updatedBy: adminUser?.id || "" });
      await writeDb(db);
      return { refund: structuredCloneSafe(refund), token, config };
    });
    if (prepared.completed) {
      if (typeof broadcastReleasedOrderSeats === "function") {
        await broadcastReleasedOrderSeats(prepared.order);
      }
      return prepared;
    }
    // The durable key is committed before calling the provider, outside the database lock.
    let confirmation;
    try {
      confirmation = await submitFullRefund(prepared.refund, prepared.token, undefined, prepared.config);
    } catch (error) {
      logEvent("warn", "order.refund_pending", { orderId, refundId: prepared.refund.id, code: error.code || "REFUND_NETWORK_ERROR" });
      throw refundError("REFUND_PENDING", error.code ? error.message : "Sem confirmacao do reembolso. Tente novamente para consultar a mesma operacao; nao crie uma devolucao manual duplicada.");
    }
    const result = await withCriticalMutation(async () => {
      const db = await readDb();
      const order = (db.orders || []).find((item) => item.id === orderId);
      const payment = orderPayment(db, orderId);
      const refund = payment?.metadata?.cancellationRefund;
      if (!order || refund?.id !== prepared.refund.id) throw refundError("REFUND_STATE_CONFLICT", "Devolucao confirmada no provedor; conciliacao local necessaria.");
      if (refund.status !== "completed") {
        if (order.status !== "cancelled") cancelOrder(db, order, reason, adminUser);
        const now = new Date().toISOString();
        Object.assign(refund, confirmation, { status: "completed", completedAt: now });
        Object.assign(payment, { status: "refunded", refundStatus: "completed", refundedAt: now, updatedAt: now });
        Object.assign(order, { status: "refunded", paymentStatus: "refunded", refundStatus: "completed", refundedAt: now, updatedAt: now });
        order.archived = true;
        order.archivedAt = now;
        order.archivedBy = adminUser?.id || "system";
        order.archivedReason = "Pedido cancelado e reembolsado";
        order.concessionStatus = "cancelled";
        order.concessionCancelledAt = now;
        order.concessionCancelledBy = adminUser?.id || "";
        order.concessionCancellationReason = "Reembolsado";
        (order.concessionItems || []).forEach((item) => {
          item.status = "cancelled";
          item.refundStatus = "completed";
          item.refundedQuantity = Number(item.quantity || 0);
          item.refundedAt = now;
        });
        if (typeof goodsFiscalService !== "undefined") goodsFiscalService.cancelUnissued(db, order, "order_refunded", new Date(now));
        if (order.stockReservationStatus === "sold") {
          eachStockedOrderItem(db, order, (item, quantity) => {
            adjustConcessionStock(item, quantity);
            item.sold = Math.max(0, Number(item.sold || 0) - quantity);
          });
          order.stockReservationStatus = "released";
          order.stockReleasedAt = now;
        }
        orderTickets(db, orderId).forEach((ticket) => { ticket.status = "refunded"; ticket.refundedAt = now; });
        appendOrderAudit(order, { action: "refund", refundId: refund.id, amount: refund.amount, updatedBy: adminUser?.id || "", createdAt: now });
        await writeDb(db);
      }
      return { order, payment, refund };
    });
    if (typeof broadcastReleasedOrderSeats === "function") {
      await broadcastReleasedOrderSeats(result.order);
    }
    return result;
  }

  return { cancelOrderWithRefund };
}

module.exports = { createFullOrderRefundCoordinator };
