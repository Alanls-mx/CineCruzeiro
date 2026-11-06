const crypto = require("node:crypto");

function createTicketRefundCoordinator({
  withCriticalMutation, readDb, writeDb, refundError, orderPayment, orderTickets,
  isOrderSessionExpired, orderFinancialBreakdown, supportedAutomaticRefund,
  appendOrderAudit, refundProviderConfig, paymentService, prepareTicketRefund,
  structuredCloneSafe, submitPartialRefund, logEvent, broadcastReleasedOrderSeats
}) {
function ticketRefundEligibility(db, order, payment = orderPayment(db, order?.id)) {
  if (!order) return { allowed: false, reason: "Pedido não encontrado." };
  const tickets = orderTickets(db, order.id) || [];
  if (!tickets.length) return { allowed: false, reason: "Este pedido não possui ingressos." };
  if (tickets.every((t) => ["cancelled", "refunded"].includes(String(t.status || "")))) {
    return { allowed: false, completed: true, reason: "Os ingressos deste pedido já foram cancelados/reembolsados." };
  }
  if (isOrderSessionExpired(order, db)) {
    return { allowed: false, reason: "A sessão de cinema deste pedido já expirou. Ingressos de sessões passadas não podem ser reembolsados." };
  }
  if (tickets.some((t) => t.status === "used")) {
    return { allowed: false, reason: "Há ingressos já validados no cinema. Ingressos utilizados não podem ser reembolsados." };
  }
  const breakdown = orderFinancialBreakdown(db, order);
  const amount = order.ticketRefund?.amount ?? breakdown.ticketRevenue;
  if (Number(amount) <= 0) {
    return { allowed: true, amount: 0, complimentary: true, reason: "Ingressos sem valor líquido cobrado; o cancelamento libera os assentos e cancela os bilhetes sem movimentar o pagamento." };
  }
  if (!payment || payment.status !== "approved") return { allowed: false, reason: "O pagamento não está aprovado para reembolso automático." };
  if (!supportedAutomaticRefund(payment)) return { allowed: false, reason: "A forma de pagamento exige conciliação e devolução manual." };
  if ((payment.metadata?.relatedOrderIds || []).length > 1) return { allowed: false, reason: "A cobrança agrupa vários pedidos e não permite este estorno isolado." };
  const full = Math.round(Number(amount) * 100) === Math.round(Number(payment.amount || 0) * 100);
  if (!full && !String(payment.metadata?.transactionId || "").trim()) return { allowed: false, reason: "A transação parcial exigida pelo provedor não foi registrada neste pagamento." };
  return { allowed: true, amount: Number(Number(amount).toFixed(2)), full, reason: `Reembolso de ingressos calculado pelo servidor: R$ ${Number(amount).toFixed(2).replace(".", ",")}.` };
}

function completeTicketCancellation(db, order, payment, refund, adminUser) {
  if (refund.status === "completed") return;
  const now = new Date().toISOString();
  refund.status = "completed";
  refund.completedAt = now;
  const tickets = orderTickets(db, order.id) || [];
  tickets.forEach((ticket) => {
    ticket.status = "refunded";
    ticket.cancelledAt = now;
    ticket.refundedAt = now;
    ticket.cancelledBy = adminUser?.id || "";
  });
  order.ticketRefund = refund;
  order.ticketsRefundedAt = now;
  order.updatedAt = now;
  if (payment) {
    payment.refundedAmount = Number((Number(payment.refundedAmount || 0) + Number(refund.amount || 0)).toFixed(2));
    payment.refundStatus = "completed";
    payment.updatedAt = now;
    payment.metadata = { ...(payment.metadata || {}), ticketRefund: refund };
  }
  const concessions = Array.isArray(order.concessionItems) ? order.concessionItems : [];
  const hasConcessions = concessions.length > 0;
  const allConcessionsDone = !hasConcessions || concessions.every((i) => ["cancelled", "refunded"].includes(i.status) || i.refundStatus === "completed" || Number(i.fulfilledQuantity || 0) >= Number(i.quantity || 0)) || Boolean(order.concessionsFulfilledAt) || ["cancelled", "refunded"].includes(order.concessionStatus);

  if (refund.full || !hasConcessions) {
    if (payment && refund.full) {
      payment.status = "refunded";
      payment.refundedAt = now;
    }
    if (!hasConcessions) {
      order.status = "refunded";
      order.paymentStatus = "refunded";
      order.refundStatus = "completed";
      order.refundedAt = now;
      order.cancelledAt = now;
      order.cancelledBy = adminUser?.id || "";
      order.cancellationReason = String(refund.reason || "Reembolso de ingressos").trim();
    }
  }
  if (allConcessionsDone) {
    order.archived = true;
    order.archivedAt = now;
    order.archivedBy = adminUser?.id || "system";
    order.archivedReason = "Ingressos estornados e itens concluídos";
  }
  appendOrderAudit(order, { action: "tickets.refund", refundId: refund.id, amount: refund.amount, updatedBy: adminUser?.id || "", createdAt: now });
  appendOrderAudit(order, { action: "tickets.cancel", refundId: refund.id, updatedBy: adminUser?.id || "", createdAt: now });
}

async function refundOrderTickets(orderId, reason, adminUser) {
  const prepared = await withCriticalMutation(async () => {
    const db = await readDb();
    const order = (db.orders || []).find((item) => item.id === orderId);
    if (!order) throw refundError("ORDER_NOT_FOUND", "Pedido não encontrado.", 404);
    const payment = orderPayment(db, orderId);
    const eligibility = ticketRefundEligibility(db, order, payment);
    if (eligibility.completed) return { completed: true, order, payment, refund: order.ticketRefund };
    if (!eligibility.allowed) throw refundError("TICKET_REFUND_BLOCKED", eligibility.reason);
    if (eligibility.complimentary) {
      const refund = order.ticketRefund || { id: crypto.randomUUID(), orderId, scope: "tickets", amount: 0, full: false, status: "pending", reason: String(reason || "Cancelamento de ingressos"), createdAt: new Date().toISOString() };
      order.ticketRefund = refund;
      completeTicketCancellation(db, order, payment, refund, adminUser);
      await writeDb(db);
      return { completed: true, order, payment, refund };
    }
    const config = refundProviderConfig(db, payment);
    const token = payment?.provider === "pag_bank" ? config.accessToken : paymentService.getMercadoPagoAccessToken(config);
    if (!token && config.environment !== "sandbox") throw refundError("REFUND_NOT_CONFIGURED", "Configure o provedor original antes de solicitar o reembolso.", 412);
    const refund = prepareTicketRefund(payment, order, eligibility.amount);
    refund.reason ||= String(reason || "Cancelamento de ingressos");
    order.ticketRefund = refund;
    payment.refundStatus = "pending";
    payment.metadata = { ...(payment.metadata || {}), ticketRefund: refund };
    await writeDb(db);
    return { refund: structuredCloneSafe(refund), token, config };
  });
  if (prepared.completed) {
    if (typeof broadcastReleasedOrderSeats === "function") {
      await broadcastReleasedOrderSeats(prepared.order);
    }
    return prepared;
  }
  let confirmation;
  try {
    confirmation = await submitPartialRefund(prepared.refund, prepared.token, undefined, prepared.config);
  } catch (error) {
    logEvent("warn", "order.ticket_refund_pending", { orderId, refundId: prepared.refund.id, code: error.code || "REFUND_NETWORK_ERROR" });
    throw refundError("REFUND_PENDING", error.code ? error.message : "Sem confirmacao do reembolso. Tente novamente para consultar a mesma operacao.");
  }
  const result = await withCriticalMutation(async () => {
    const db = await readDb();
    const order = (db.orders || []).find((item) => item.id === orderId);
    const payment = orderPayment(db, orderId);
    const refund = order?.ticketRefund;
    if (!order || refund?.id !== prepared.refund.id) throw refundError("REFUND_STATE_CONFLICT", "Devolucao confirmada no provedor; conciliacao local necessaria.");
    Object.assign(refund, confirmation);
    completeTicketCancellation(db, order, payment, refund, adminUser);
    await writeDb(db);
    logEvent("info", "order.ticket_refunded", { orderId, refundId: refund.id, amount: refund.amount });
    return { order, payment, refund };
  });
  if (typeof broadcastReleasedOrderSeats === "function") {
    await broadcastReleasedOrderSeats(result.order);
  }
  return result;
}

  return { ticketRefundEligibility, refundOrderTickets };
}

module.exports = { createTicketRefundCoordinator };
