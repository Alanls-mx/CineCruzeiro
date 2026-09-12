const crypto = require("node:crypto");

function refundError(code, message, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function prepareRefund(payment, order, now = new Date().toISOString()) {
  const existing = payment.metadata?.cancellationRefund;
  if (existing) return existing;
  if (payment.provider !== "mercado_pago" || !/^ORD[A-Z0-9]+$/i.test(payment.providerPaymentId || "")) {
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
  return {
    id: crypto.randomUUID(),
    orderId: order.id,
    providerOrderId: payment.providerPaymentId,
    amount,
    status: "pending",
    createdAt: now
  };
}

function prepareConcessionRefund(payment, order, amount, now = new Date().toISOString()) {
  const existing = order.concessionRefund;
  if (existing) return existing;
  if (payment.provider !== "mercado_pago" || !/^ORD[A-Z0-9]+$/i.test(payment.providerPaymentId || "")) {
    throw refundError("REFUND_PROVIDER_UNSUPPORTED", "Esta forma de pagamento exige devolucao manual. Nenhum reembolso foi executado.");
  }
  if ((payment.metadata?.relatedOrderIds || []).length > 1) {
    throw refundError("REFUND_SHARED_PAYMENT", "A cobranca inclui varios pedidos. A bomboniere precisa ser conciliada manualmente; nenhum reembolso foi executado.");
  }
  if (payment.status !== "approved") throw refundError("REFUND_PAYMENT_NOT_APPROVED", "Somente pagamentos aprovados podem ser reembolsados.");
  const normalizedAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > Number(payment.amount || 0)) {
    throw refundError("REFUND_AMOUNT_INVALID", "O valor calculado para a bomboniere nao pode ser reembolsado automaticamente.");
  }
  const full = Math.round(normalizedAmount * 100) === Math.round(Number(payment.amount || 0) * 100);
  const transactionId = String(payment.metadata?.transactionId || "").trim();
  if (!full && !transactionId) {
    throw refundError("REFUND_TRANSACTION_MISSING", "O pagamento nao possui a transacao exigida pelo Mercado Pago para um reembolso parcial.");
  }
  return { id: crypto.randomUUID(), orderId: order.id, providerOrderId: payment.providerPaymentId, transactionId, scope: "concessions", amount: normalizedAmount, full, status: "pending", createdAt: now };
}

async function submitFullRefund(refund, accessToken, request = fetch) {
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

async function submitConcessionRefund(refund, accessToken, request = fetch) {
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

module.exports = { prepareRefund, prepareConcessionRefund, submitFullRefund, submitConcessionRefund, refundError };
