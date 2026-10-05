const crypto = require("node:crypto");
const pagBankPaymentService = require("./pagBankPaymentService");

function supportedAutomaticRefund(payment) {
  return (payment.provider === "mercado_pago" && /^ORD[A-Z0-9]+$/i.test(payment.providerPaymentId || ""))
    || (payment.provider === "pag_bank" && /^ORDE_[A-Za-z0-9-]+$/.test(payment.providerPaymentId || "") && /^CHAR_[A-Za-z0-9-]+$/.test(payment.metadata?.transactionId || ""));
}

function refundError(code, message, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function prepareRefund(payment, order, now = new Date().toISOString()) {
  const existing = payment.metadata?.cancellationRefund;
  if (existing) return existing;
  if (!supportedAutomaticRefund(payment)) {
    throw refundError("REFUND_PROVIDER_UNSUPPORTED", "Esta forma de pagamento exige devolucao manual. Nenhum reembolso foi executado.");
  }
  if ((payment.metadata?.relatedOrderIds || []).length > 1) {
    throw refundError("REFUND_SHARED_PAYMENT", "A cobranca inclui varios pedidos. O reembolso integral deve ser conciliado para todos eles; este pedido nao foi cancelado.");
  }
  if (payment.status !== "approved") throw refundError("REFUND_PAYMENT_NOT_APPROVED", "Somente pagamentos aprovados podem ser reembolsados.");
  const amount = Number(order.totalPrice);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== Math.round(Number(payment.amount) * 100)) {
    throw refundError("REFUND_AMOUNT_MISMATCH", "Pedido e pagamento possuem valores diferentes. Concilie a cobranca antes de reembolsar.");
  }
  const priorRefundedAmount = Number(payment.refundedAmount || 0);
  const remainingAmount = payment.provider === "pag_bank" ? Number((amount - priorRefundedAmount).toFixed(2)) : amount;
  if (remainingAmount <= 0) throw refundError("REFUND_ALREADY_COMPLETED", "O valor do pagamento já foi devolvido.");
  return {
    id: crypto.randomUUID(),
    orderId: order.id,
    providerOrderId: payment.providerPaymentId,
    provider: payment.provider,
    transactionId: payment.metadata?.transactionId || "",
    amount: remainingAmount,
    full: true,
    priorRefundedAmount,
    status: "pending",
    createdAt: now
  };
}

function prepareConcessionRefund(payment, order, amount, now = new Date().toISOString()) {
  const existing = order.concessionRefund;
  if (existing) return existing;
  if (!supportedAutomaticRefund(payment)) {
    throw refundError("REFUND_PROVIDER_UNSUPPORTED", "Esta forma de pagamento exige devolucao manual. Nenhum reembolso foi executado.");
  }
  if ((payment.metadata?.relatedOrderIds || []).length > 1) {
    throw refundError("REFUND_SHARED_PAYMENT", "A cobranca inclui varios pedidos. A bomboniere precisa ser conciliada manualmente; nenhum reembolso foi executado.");
  }
  if (payment.status !== "approved") throw refundError("REFUND_PAYMENT_NOT_APPROVED", "Somente pagamentos aprovados podem ser reembolsados.");
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount + Number(payment.refundedAmount || 0) > Number(payment.amount || 0) + 0.001) {
    throw refundError("REFUND_AMOUNT_INVALID", "O valor calculado para a bomboniere nao pode ser reembolsado automaticamente.");
  }
  const full = Math.round(normalizedAmount * 100) === Math.round(Number(payment.amount || 0) * 100);
  const transactionId = String(payment.metadata?.transactionId || "").trim();
  if (!full && !transactionId) {
    throw refundError("REFUND_TRANSACTION_MISSING", "O pagamento nao possui a transacao exigida pelo Mercado Pago para um reembolso parcial.");
  }
  return { id: crypto.randomUUID(), orderId: order.id, provider: payment.provider, providerOrderId: payment.providerPaymentId, transactionId, scope: "concessions", amount: normalizedAmount, priorRefundedAmount: Number(payment.refundedAmount || 0), full, status: "pending", createdAt: now };
}

async function submitPagBankRefund(refund, config) {
  if (!config?.accessToken) throw refundError("REFUND_NOT_CONFIGURED", "Configure o PagBank antes de solicitar o reembolso.", 412);
  let cancelError;
  try {
    await pagBankPaymentService.cancelCharge(refund.transactionId, refund.amount, config, refund.id);
  } catch (error) {
    cancelError = error;
  }
  const confirmed = await pagBankPaymentService.fetchOrder(refund.providerOrderId, config);
  const charge = confirmed?.raw?.charges?.find((item) => item.id === refund.transactionId);
  const refundedCents = Number(charge?.amount?.summary?.refunded || 0);
  const expectedCents = Math.round((Number(refund.priorRefundedAmount || 0) + Number(refund.amount)) * 100);
  if (confirmed?.id !== refund.providerOrderId || refundedCents < expectedCents) {
    if (cancelError && cancelError.statusCode !== 409) throw cancelError;
    throw refundError("REFUND_CONFIRMATION_PENDING", "O PagBank ainda não confirmou a devolução. Tente novamente usando a mesma referência.");
  }
  return { providerStatus: charge?.status || "REFUNDED", providerRefundIds: [refund.transactionId] };
}

async function submitFullRefund(refund, accessToken, request = fetch, providerConfig = {}) {
  if (refund.provider === "pag_bank") return submitPagBankRefund(refund, providerConfig);
  if (!accessToken) throw refundError("REFUND_NOT_CONFIGURED", "Configure o Mercado Pago antes de solicitar o reembolso.", 412);
  const response = await request(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(refund.providerOrderId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": refund.id },
    body: "{}",
    signal: AbortSignal.timeout(20000)
  });
  let data = await response.json().catch(() => ({}));
  let confirmedResponse = response.ok;
  if (response.status === 409) {
    const status = await request(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(refund.providerOrderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000)
    });
    data = await status.json().catch(() => ({}));
    confirmedResponse = status.ok;
  }
  if (!confirmedResponse) {
    throw refundError("REFUND_PROVIDER_PENDING", "O Mercado Pago nao confirmou a devolucao. Consulte o pagamento e tente novamente: a mesma chave sera reutilizada para evitar duplicidade.", 409);
  }
  if (String(data.id) !== String(refund.providerOrderId) || ![data.status, data.status_detail].includes("refunded")) {
    throw refundError("REFUND_CONFIRMATION_PENDING", "Reembolso solicitado, ainda sem confirmacao integral do Mercado Pago.", 409);
  }
  return {
    providerStatus: data.status,
    providerRefundIds: (data.transactions?.refunds || []).map((entry) => String(entry.id || "")).filter(Boolean)
  };
}

async function submitConcessionRefund(refund, accessToken, request = fetch, providerConfig = {}) {
  if (refund.provider === "pag_bank") return submitPagBankRefund(refund, providerConfig);
  if (!accessToken) throw refundError("REFUND_NOT_CONFIGURED", "Configure o Mercado Pago antes de solicitar o reembolso.", 412);
  const body = refund.full ? {} : { transactions: [{ id: refund.transactionId, amount: Number(refund.amount).toFixed(2) }] };
  const response = await request(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(refund.providerOrderId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": refund.id },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  let data = await response.json().catch(() => ({}));
  let confirmedResponse = response.ok;
  if (response.status === 409) {
    const statusResponse = await request(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(refund.providerOrderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000)
    });
    data = await statusResponse.json().catch(() => ({}));
    confirmedResponse = statusResponse.ok;
  }
  if (!confirmedResponse) throw refundError("REFUND_PROVIDER_PENDING", "O Mercado Pago nao confirmou a devolucao. Tente novamente: a mesma chave sera reutilizada para evitar duplicidade.");
  const status = String(data.status_detail || data.status || "");
  const expected = refund.full ? "refunded" : "partially_refunded";
  if (String(data.id) !== String(refund.providerOrderId) || status !== expected) {
    throw refundError("REFUND_CONFIRMATION_PENDING", "Reembolso solicitado, ainda sem confirmacao do Mercado Pago.");
  }
  return {
    providerStatus: data.status || "",
    providerStatusDetail: data.status_detail || "",
    providerRefundIds: (data.transactions?.refunds || []).map((entry) => String(entry.id || "")).filter(Boolean)
  };
}

function prepareTicketRefund(payment, order, amount, now = new Date().toISOString()) {
  const existing = order.ticketRefund;
  if (existing) return existing;
  if (!supportedAutomaticRefund(payment)) {
    throw refundError("REFUND_PROVIDER_UNSUPPORTED", "Esta forma de pagamento exige devolucao manual. Nenhum reembolso foi executado.");
  }
  if ((payment.metadata?.relatedOrderIds || []).length > 1) {
    throw refundError("REFUND_SHARED_PAYMENT", "A cobranca inclui varios pedidos. O estorno precisa ser conciliado manualmente; nenhum reembolso foi executado.");
  }
  if (payment.status !== "approved") throw refundError("REFUND_PAYMENT_NOT_APPROVED", "Somente pagamentos aprovados podem ser reembolsados.");
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount + Number(payment.refundedAmount || 0) > Number(payment.amount || 0) + 0.001) {
    throw refundError("REFUND_AMOUNT_INVALID", "O valor calculado para os ingressos nao pode ser reembolsado automaticamente.");
  }
  const full = Math.round(normalizedAmount * 100) === Math.round(Number(payment.amount || 0) * 100);
  const transactionId = String(payment.metadata?.transactionId || "").trim();
  if (!full && !transactionId) {
    throw refundError("REFUND_TRANSACTION_MISSING", "O pagamento nao possui a transacao exigida pelo Mercado Pago para um reembolso parcial.");
  }
  return { id: crypto.randomUUID(), orderId: order.id, provider: payment.provider, providerOrderId: payment.providerPaymentId, transactionId, scope: "tickets", amount: normalizedAmount, priorRefundedAmount: Number(payment.refundedAmount || 0), full, status: "pending", createdAt: now };
}

async function submitPartialRefund(refund, accessToken, request = fetch, providerConfig = {}) {
  return submitConcessionRefund(refund, accessToken, request, providerConfig);
}

module.exports = { prepareRefund, prepareConcessionRefund, prepareTicketRefund, submitFullRefund, submitConcessionRefund, submitPartialRefund, supportedAutomaticRefund, refundError };
