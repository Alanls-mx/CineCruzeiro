"use strict";

function createAdminPaymentsReadHandler({
  cardTerminalProvider,
  inDateRange,
  integrationConfigService,
  methodLabel,
  movieForOrder,
  orderStatusLabel,
  originLabel,
  parseAdminPeriod,
  paymentStatusLabel,
  providerLabel,
  sendJson,
  shortOrderReference,
}) {
  return function handleAdminPaymentsRead({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/payments" && method === "GET") {
    const paymentsUrl = new URL(req.url, `http://${req.headers.host}`);
    const period = parseAdminPeriod(paymentsUrl);
    const statusFilter = paymentsUrl.searchParams.get("status") || "";
    const methodFilter = paymentsUrl.searchParams.get("method") || "";
    const originFilter = paymentsUrl.searchParams.get("origin") || "";
    const providerFilter = paymentsUrl.searchParams.get("provider") || "";
    const paymentOrder = (payment) => (db.orders || []).find((item) => item.id === payment.orderId) || {};
    const statusEventAt = (payment, order = paymentOrder(payment)) => {
      if (statusFilter === "refunded") return payment.refundedAt || order.refundedAt || order.concessionRefund?.completedAt || payment.updatedAt || payment.createdAt;
      if (statusFilter === "approved") return payment.approvedAt || order.paidAt || payment.updatedAt || payment.createdAt;
      if (statusFilter === "expired") return payment.expiredAt || order.expiredAt || payment.updatedAt || payment.createdAt;
      return payment.approvedAt || payment.refundedAt || payment.expiredAt || payment.createdAt;
    };
    let rows = (db.payments || []).filter((payment) => inDateRange(statusEventAt(payment), period.start, period.end));
    if (statusFilter) rows = rows.filter((payment) => {
      const order = paymentOrder(payment);
      if (statusFilter === "refunded") return payment.status === "refunded"
        || payment.refundStatus === "completed"
        || Number(payment.refundedAmount || 0) > 0
        || order.concessionRefund?.status === "completed";
      return String(payment.status || "") === statusFilter;
    });
    if (methodFilter) rows = rows.filter((payment) => String(payment.method || "") === methodFilter);
    if (providerFilter) rows = rows.filter((payment) => String(payment.provider || "") === providerFilter);
    if (originFilter) {
      rows = rows.filter((payment) => {
        const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
        return String(order.origin || "online") === originFilter;
      });
    }
    sendJson(res, 200, {
      period,
      cardTerminal: {
        configured: cardTerminalProvider.configured(integrationConfigService.resolvedConfig(db, "mercadoPago") || {}),
        provider: providerLabel(cardTerminalProvider.providerName())
      },
      payments: rows.sort((a, b) => String(statusEventAt(b)).localeCompare(String(statusEventAt(a)))).slice(0, 200).map((payment) => {
        const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
        return {
          ...payment,
          approvedAt: payment.approvedAt || order.paidAt || "",
          refundedAt: payment.refundedAt || order.refundedAt || order.concessionRefund?.completedAt || "",
          expiredAt: payment.expiredAt || order.expiredAt || "",
          orderReference: shortOrderReference(order),
          orderStatusLabel: orderStatusLabel(order.status),
          statusLabel: paymentStatusLabel(payment.status),
          methodLabel: methodLabel(payment.method),
          providerLabel: providerLabel(payment.provider),
          originLabel: originLabel(order.origin || "online"),
          customerName: order.customerName || "Cliente",
          movieTitle: order.movieTitle || movieForOrder(db, order)?.title || ""
        };
      })
    });
    return true;
  }
    return false;
  };
}

module.exports = { createAdminPaymentsReadHandler };
