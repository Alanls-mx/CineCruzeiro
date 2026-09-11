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

module.exports = { prepareRefund, submitFullRefund, refundError };
