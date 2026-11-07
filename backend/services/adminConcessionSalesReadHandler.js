// Commercial read routes mounted at their original dispatcher slots.
function createAdminConcessionSalesReadHandler(deps) {
  const { todayIsoDate, orderPayment, inDateRange, sessionForOrder, sessionStartsAt, finishedSessionEndsAt, orderFinancialBreakdown, summarizeConcessionFinance, methodLabel, paymentStatusLabel, concessionRefundEligibility, sendJson } = deps;

  async function handleAdminConcessionSalesRead({ req, res, pathname, method, db }) {
    if (pathname === "/api/admin/concession-sales" && method === "GET") {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const requestedDate = String(url.searchParams.get("date") || "").trim();
        const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayIsoDate();
        const groups = new Map();
        const financeEntries = [];
        for (const order of db.orders || []) {
          if (order.concessionDeletedAt) continue;
          const payment = orderPayment(db, order.id);
          const purchasedAt = order.paidAt || payment?.approvedAt || order.createdAt;
          if (!inDateRange(purchasedAt, selectedDate, selectedDate) || !(order.concessionItems || []).length) continue;
          const financiallyConfirmed = Boolean(payment?.approvedAt)
            || ["approved", "refunded"].includes(String(payment?.status || ""))
            || ["paid", "refunded", "cancelled"].includes(String(order.status || ""))
            || ["approved", "refunded", "cancelled"].includes(String(order.paymentStatus || ""));
          if (!financiallyConfirmed) continue;
          const session = sessionForOrder(db, order);
          const movie = (db.movies || []).find((item) => item.id === (session?.movieId || order.movieId));
          const counterSale = order.saleMode === "concession_counter";
          const key = counterSale ? `counter-sales-${selectedDate}` : session?.id || order.archivedSessionId || `${order.movieId || "avulso"}-${order.sessionDate || ""}-${order.sessionTime || ""}`;
          const start = session ? sessionStartsAt(session) : null;
          const end = session ? finishedSessionEndsAt(movie, session) : null;
          if (!groups.has(key)) groups.set(key, {
            id: key,
            title: counterSale ? "Balcão da bomboniere" : movie?.title || order.movieTitle || "Venda sem sessao",
            date: session?.date || order.sessionDate || "",
            time: counterSale ? "" : session?.time || order.sessionTime || "",
            room: counterSale ? "Venda presencial" : session?.room || order.sessionRoom || "",
            status: counterSale ? "Atendimento no balcão" : !session ? "Historico / sem sessao ativa" : end && end.getTime() <= Date.now() ? "Encerrada" : start && start.getTime() <= Date.now() ? "Em andamento" : "Programada",
            orders: []
          });
          const breakdown = orderFinancialBreakdown(db, order);
          const finance = summarizeConcessionFinance([{ order, breakdown }]);
          financeEntries.push({ order, breakdown });
          groups.get(key).orders.push({
            id: order.id, status: order.status, purchasedAt,
            approvedAt: payment?.approvedAt || order.paidAt || null,
            refundedAt: order.concessionRefund?.completedAt || payment?.refundedAt || order.refundedAt || null,
            customerName: order.customerName || "Cliente avulso",
            archived: Boolean(order.concessionArchived),
            concessionStatus: order.concessionStatus || (order.concessionRefund?.status === "completed" || ["cancelled", "refunded"].includes(order.status) ? "cancelled" : "active"),
            concessionCancelledAt: order.concessionCancelledAt || null,
            paymentMethod: methodLabel(payment?.method || order.paymentMethod),
            paymentStatus: paymentStatusLabel(payment?.status || order.paymentStatus),
            couponCode: order.couponCode || "",
            items: order.concessionItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              fulfilledQuantity: item.fulfilledQuantity || 0,
              originalUnitPrice: Number(item.originalPrice ?? item.unitPrice ?? item.price ?? 0),
              finalUnitPrice: Number(item.finalPrice ?? item.unitPrice ?? item.price ?? 0),
              clubDiscount: Number(item.clubDiscount || 0),
              refundStatus: item.refundStatus || ""
            })),
            finance,
            refund: order.concessionRefund || null,
            refundEligibility: concessionRefundEligibility(db, order, payment)
          });
        }
        const orderedGroups = [...groups.values()]
          .map((group) => ({ ...group, orders: group.orders.sort((a, b) => String(b.purchasedAt).localeCompare(String(a.purchasedAt))) }))
          .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        sendJson(res, 200, {
          date: selectedDate,
          summary: summarizeConcessionFinance(financeEntries),
          groups: orderedGroups
        });
        return true;
      }
    return false;
  }

  return { handleAdminConcessionSalesRead };
}

module.exports = { createAdminConcessionSalesReadHandler };
