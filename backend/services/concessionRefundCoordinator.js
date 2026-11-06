const crypto = require("node:crypto");

function createConcessionRefundCoordinator({
  withCriticalMutation, readDb, writeDb, refundError, orderPayment,
  isOrderSessionExpired, orderFinancialBreakdown, supportedAutomaticRefund,
  eachStockedOrderItem, adjustConcessionStock, goodsFiscalService, orderTickets,
  appendOrderAudit, refundProviderConfig, paymentService, prepareConcessionRefund,
  structuredCloneSafe, submitConcessionRefund, logEvent, broadcastReleasedOrderSeats
}) {
function concessionRefundEligibility(db, order, payment = orderPayment(db, order?.id)) {
  if (!order || !(order.concessionItems || []).some((item) => Number(item.quantity || 0) > 0)) return { allowed: false, reason: "Este pedido nao possui produtos da bomboniere." };
  if (order.concessionRefund?.status === "completed" || order.concessionStatus === "cancelled") return { allowed: false, completed: true, reason: "A bomboniere deste pedido ja foi cancelada/reembolsada." };
  if (isOrderSessionExpired(order, db)) {
    return { allowed: false, reason: "A sessão de cinema deste pedido já expirou. Itens da bomboniere não podem ser reembolsados após a sessão." };
  }
  if ((order.concessionItems || []).some((item) => Number(item.fulfilledQuantity || 0) > 0)) return { allowed: false, reason: "Ha produtos ja entregues. Faca a conciliacao manual antes de qualquer devolucao." };
  const fiscal = (db.goodsFiscalDocuments || []).find((item) => item.orderId === order.id);
  if (fiscal && !["waiting_trigger", "cancelled"].includes(String(fiscal.status || ""))) {
    return { allowed: false, reason: "A NFC-e ja entrou em processamento. Cancele ou concilie o documento fiscal antes do reembolso." };
  }
  const breakdown = orderFinancialBreakdown(db, order);
  const amount = order.concessionRefund?.amount ?? breakdown.concessionRevenue;
  if (Number(amount) <= 0) return { allowed: true, amount: 0, concessionCouponDiscount: breakdown.concessionCouponDiscount, complimentary: true, reason: "Produtos sem valor liquido; o cancelamento libera estoque e beneficios sem movimentar o pagamento." };
  if (!payment || payment.status !== "approved") return { allowed: false, reason: "O pagamento nao esta aprovado para reembolso automatico." };
  if (!supportedAutomaticRefund(payment)) return { allowed: false, reason: "A forma de pagamento exige conciliacao e devolucao manual." };
  if ((payment.metadata?.relatedOrderIds || []).length > 1) return { allowed: false, reason: "A cobranca agrupa varios pedidos e nao permite esta devolucao isolada." };
  const full = Math.round(Number(amount) * 100) === Math.round(Number(payment.amount || 0) * 100);
  if (!full && !String(payment.metadata?.transactionId || "").trim()) return { allowed: false, reason: "A transação parcial exigida pelo provedor não foi registrada neste pagamento." };
  return { allowed: true, amount: Number(Number(amount).toFixed(2)), concessionCouponDiscount: breakdown.concessionCouponDiscount, full, reason: `Reembolso calculado pelo servidor: R$ ${Number(amount).toFixed(2).replace(".", ",")}.` };
}

function completeConcessionCancellation(db, order, payment, refund, adminUser) {
  if (refund.status === "completed") return;
  const now = new Date().toISOString();
  refund.status = "completed";
  refund.completedAt = now;
  (order.concessionItems || []).forEach((item) => {
    item.refundStatus = "completed";
    item.refundedQuantity = Number(item.quantity || 0);
    item.refundedAt = now;
  });
  if (["reserved", "sold"].includes(order.stockReservationStatus)) {
    const previousStockStatus = order.stockReservationStatus;
    eachStockedOrderItem(db, order, (item, quantity) => {
      adjustConcessionStock(item, quantity);
      if (previousStockStatus === "sold") item.sold = Math.max(0, Number(item.sold || 0) - quantity);
      else item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
    });
    order.stockReservationStatus = "released";
    order.stockReleasedAt = now;
  }
  goodsFiscalService.cancelUnissued(db, order, "concession_refunded", new Date(now));
  order.concessionCancelledAt = now;
  order.updatedAt = now;
  if (payment) {
    payment.refundedAmount = Number((Number(payment.refundedAmount || 0) + Number(refund.amount || 0)).toFixed(2));
    payment.refundStatus = "completed";
    payment.updatedAt = now;
    payment.metadata = { ...(payment.metadata || {}), concessionRefund: refund };
  }
  order.concessionStatus = "cancelled";
  order.concessionCancelledAt = now;
  order.concessionCancelledBy = adminUser?.id || "";
  order.concessionCancellationReason = String(refund.reason || "Reembolsado").trim();
  const tickets = orderTickets(db, order.id) || [];
  const hasTickets = tickets.length > 0;
  const allTicketsCancelledOrRefunded = !hasTickets || tickets.every((t) => ["cancelled", "refunded"].includes(t.status));
  const allTicketsDone = !hasTickets || tickets.every((t) => ["cancelled", "refunded", "used"].includes(t.status));

  if (refund.full || !hasTickets || allTicketsCancelledOrRefunded) {
    if (payment) {
      payment.status = "refunded";
      payment.refundedAt = now;
    }
    order.status = "cancelled";
    order.paymentStatus = "refunded";
    order.refundStatus = "completed";
    order.refundedAt = now;
    order.cancelledAt = now;
    order.cancelledBy = adminUser?.id || "";
    order.cancellationReason = String(refund.reason || "Reembolsado").trim();
    tickets.forEach((ticket) => {
      ticket.status = "cancelled";
      ticket.cancelledAt = now;
      ticket.refundedAt = now;
    });
  }
  if (allTicketsDone) {
    order.archived = true;
    order.archivedAt = now;
    order.archivedBy = adminUser?.id || "system";
    order.archivedReason = "Bomboniere estornada e itens concluídos";
  }
  appendOrderAudit(order, { action: "concessions.refund", refundId: refund.id, amount: refund.amount, updatedBy: adminUser?.id || "", createdAt: now });
  appendOrderAudit(order, { action: "concessions.cancel", refundId: refund.id, updatedBy: adminUser?.id || "", createdAt: now });
}

async function refundOrderConcessions(orderId, reason, adminUser) {
  const prepared = await withCriticalMutation(async () => {
    const db = await readDb();
    const order = (db.orders || []).find((item) => item.id === orderId);
    if (!order) throw refundError("ORDER_NOT_FOUND", "Pedido nao encontrado.", 404);
    const payment = orderPayment(db, orderId);
    const eligibility = concessionRefundEligibility(db, order, payment);
    if (eligibility.completed) return { completed: true, order, payment, refund: order.concessionRefund };
    if (!eligibility.allowed) throw refundError("CONCESSION_REFUND_BLOCKED", eligibility.reason);
    if (eligibility.complimentary) {
      const refund = order.concessionRefund || { id: crypto.randomUUID(), orderId, scope: "concessions", amount: 0, couponDiscount: eligibility.concessionCouponDiscount, full: false, status: "pending", reason: String(reason || "Cancelamento da bomboniere"), createdAt: new Date().toISOString() };
      order.concessionRefund = refund;
      completeConcessionCancellation(db, order, payment, refund, adminUser);
      await writeDb(db);
      return { completed: true, order, payment, refund };
    }
    const config = refundProviderConfig(db, payment);
    const token = payment?.provider === "pag_bank" ? config.accessToken : paymentService.getMercadoPagoAccessToken(config);
    if (!token && config.environment !== "sandbox") throw refundError("REFUND_NOT_CONFIGURED", "Configure o provedor original antes de solicitar o reembolso.", 412);
    const refund = prepareConcessionRefund(payment, order, eligibility.amount);
    refund.reason ||= String(reason || "Cancelamento da bomboniere");
    refund.couponDiscount ??= eligibility.concessionCouponDiscount;
    order.concessionRefund = refund;
    payment.refundStatus = "pending";
    payment.metadata = { ...(payment.metadata || {}), concessionRefund: refund };
    await writeDb(db);
    return { refund: structuredCloneSafe(refund), token, config };
  });
  if (prepared.completed) {
    if (prepared.order?.status === "cancelled") {
      await broadcastReleasedOrderSeats(prepared.order);
    }
    return prepared;
  }
  let confirmation;
  try {
    confirmation = await submitConcessionRefund(prepared.refund, prepared.token, undefined, prepared.config);
  } catch (error) {
    logEvent("warn", "order.concession_refund_pending", { orderId, refundId: prepared.refund.id, code: error.code || "REFUND_NETWORK_ERROR" });
    throw refundError("REFUND_PENDING", error.code ? error.message : "Sem confirmacao do reembolso. Tente novamente para consultar a mesma operacao.");
  }
  const result = await withCriticalMutation(async () => {
    const db = await readDb();
    const order = (db.orders || []).find((item) => item.id === orderId);
    const payment = orderPayment(db, orderId);
    const refund = order?.concessionRefund;
    if (!order || refund?.id !== prepared.refund.id) throw refundError("REFUND_STATE_CONFLICT", "Devolucao confirmada no provedor; conciliacao local necessaria.");
    Object.assign(refund, confirmation);
    completeConcessionCancellation(db, order, payment, refund, adminUser);
    await writeDb(db);
    logEvent("info", "order.concession_refunded", { orderId, refundId: refund.id, amount: refund.amount });
    return { order, payment, refund };
  });
  if (result.order?.status === "cancelled") {
    await broadcastReleasedOrderSeats(result.order);
  }
  return result;
}

  return { concessionRefundEligibility, refundOrderConcessions };
}

module.exports = { createConcessionRefundCoordinator };
