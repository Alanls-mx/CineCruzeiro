const { isOrderFinanciallySettled, recognitionDate, paymentFinancialState } = require("./financialRecognitionService");
const { summarizeConcessionFinance } = require("./concessionFinanceService");
const cardTerminalProvider = require("./cardTerminalProvider");
const integrationConfigService = require("./integrationConfigService");

function createAdminDashboardService({
  todayIsoDate, sessionStartsAt, normalizedSessionStatus, sessionWithCurrentRoom,
  finishedSessionEndsAt, orderPayment, paymentStatusLabel, orderStatusLabel,
  originLabel, methodLabel, providerLabel, inDateRange, compareMetric,
  shortOrderReference, movieForOrder, recognizedTicketCount, sessionCapacity,
  sessionAvailabilityStatus, orderFinancialBreakdown
}) {
function adminDashboard(db, options = {}) {
  const now = new Date();
  const today = todayIsoDate();
  const period = options.period || { period: "today", start: today, end: today, previousStart: today, previousEnd: today, days: 1 };
  const paymentForOrder = (order) => orderPayment(db, order.id);
  const paidOrders = (db.orders || []).filter((order) => isOrderFinanciallySettled(order, paymentForOrder(order)));
  const periodOrders = (db.orders || []).filter((order) => inDateRange(order.createdAt, period.start, period.end));
  const periodSettledOrders = paidOrders.filter((order) => inDateRange(recognitionDate(order, paymentForOrder(order)), period.start, period.end));
  const previousSettledOrders = paidOrders.filter((order) => inDateRange(recognitionDate(order, paymentForOrder(order)), period.previousStart, period.previousEnd));
  const periodBreakdowns = periodSettledOrders.map((order) => orderFinancialBreakdown(db, order));
  const breakdownByOrderId = new Map(periodBreakdowns.map((item) => [item.orderId, item]));
  const periodPaidOrders = periodSettledOrders.filter((order) => Number(breakdownByOrderId.get(order.id)?.totalRevenue || 0) > 0);
  const previousBreakdowns = new Map(previousSettledOrders.map((order) => [order.id, orderFinancialBreakdown(db, order)]));
  const previousPaidOrders = previousSettledOrders.filter((order) => Number(previousBreakdowns.get(order.id)?.totalRevenue || 0) > 0);
  const todayOrders = paidOrders.filter((order) => {
    if (!inDateRange(recognitionDate(order, paymentForOrder(order)), today, today)) return false;
    return orderFinancialBreakdown(db, order).totalRevenue > 0;
  });
  const ticketCountForOrders = (orders) => recognizedTicketCount(db, orders);
  const ticketsSold = ticketCountForOrders(periodPaidOrders);
  const todaySessions = (db.movies || [])
    .flatMap((movie) => (movie.sessions || []).filter((session) => {
      const status = normalizedSessionStatus(session);
      const endsAt = finishedSessionEndsAt(movie, session);
      return session.date === today
        && !["cancelled", "hidden", "archived"].includes(status)
        && (!endsAt || endsAt.getTime() > now.getTime());
    }).map((session) => {
      const currentSession = sessionWithCurrentRoom(db, session);
      const sold = (db.tickets || []).filter((ticket) => ticket.sessionId === session.id && !["cancelled", "refunded", "expired"].includes(ticket.status)).length;
      const capacity = sessionCapacity(db, currentSession);
      const startsAt = sessionStartsAt(currentSession);
      const endsAt = finishedSessionEndsAt(movie, currentSession);
      const isInProgress = Boolean(startsAt && endsAt && startsAt.getTime() <= now.getTime() && endsAt.getTime() > now.getTime());
      return {
        movie: {
          id: movie.id,
          slug: movie.slug || movie.id,
          title: movie.title,
          posterUrl: movie.posterUrl || "",
          rating: movie.rating || "L"
        },
        session: currentSession,
        sold,
        capacity,
        occupancyRate: capacity ? Math.round((sold / capacity) * 100) : 0,
        status: isInProgress ? "Em andamento" : sessionAvailabilityStatus(currentSession, sold, capacity),
        isInProgress,
        startsAt: startsAt?.toISOString() || "",
        endsAt: endsAt?.toISOString() || "",
        remainingMinutes: isInProgress ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 60000)) : 0
      };
    }))
    .sort((a, b) => Number(b.isInProgress) - Number(a.isInProgress) || String(a.session.time).localeCompare(String(b.session.time)));
  const upcomingSessions = todaySessions.slice(0, 8);
  const roomCapacity = Number((db.rooms || []).find((room) => room.status === "active")?.capacity || 120);
  const occupied = todaySessions.reduce((total, item) => total + item.sold, 0);
  const totalCapacity = todaySessions.reduce((total, item) => total + item.capacity, 0) || roomCapacity;
  const groupCount = (items, getter) => items.reduce((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const groupOrderRevenue = (orders, getter) => orders.reduce((acc, order) => {
    const key = getter(order);
    const breakdown = breakdownByOrderId.get(order.id) || orderFinancialBreakdown(db, order);
    acc[key] = Number((acc[key] || 0) + breakdown.totalRevenue).toFixed(2) * 1;
    return acc;
  }, {});
  const revenueByMovie = {};
  const orderBreakdowns = periodPaidOrders.map((order) => breakdownByOrderId.get(order.id));
  const concessionSummary = summarizeConcessionFinance(periodSettledOrders.map((order) => ({
    order,
    breakdown: breakdownByOrderId.get(order.id) || orderFinancialBreakdown(db, order)
  })));
  periodPaidOrders.forEach((order) => {
    const movie = movieForOrder(db, order);
    const movieTitle = order.movieTitle || movie?.title || "Filme não identificado";
    const breakdown = breakdownByOrderId.get(order.id) || orderFinancialBreakdown(db, order);
    revenueByMovie[movieTitle] = (revenueByMovie[movieTitle] || 0) + breakdown.ticketRevenue;
  });
  const concessionRevenue = Number(orderBreakdowns.reduce((total, item) => total + item.concessionRevenue, 0).toFixed(2));
  const ticketRevenue = Number(orderBreakdowns.reduce((total, item) => total + item.ticketRevenue, 0).toFixed(2));
  const paidOrderRevenue = Number((ticketRevenue + concessionRevenue).toFixed(2));
  const orderRefunds = Number(periodBreakdowns.reduce((total, item) => total + Number(item.refundTotal || 0), 0).toFixed(2));
  const orderApprovedBeforeRefunds = Number(periodBreakdowns.reduce((total, item) => total + Number(item.approvedBeforeRefunds || 0), 0).toFixed(2));
  const lowStockProducts = (db.concessions || [])
    .filter((item) => item.active !== false && item.stock !== "" && item.stock !== undefined && Number(item.stock || 0) <= 5)
    .map((item) => ({ id: item.id, name: item.name, imageUrl: item.imageUrl || "", stock: Number(item.stock || 0) }))
    .slice(0, 6);
  const latestOrders = periodOrders.slice(0, 8).map((order) => {
    const breakdown = orderFinancialBreakdown(db, order);
    const financiallySettled = isOrderFinanciallySettled(order, paymentForOrder(order));
    return {
      id: order.id,
      reference: shortOrderReference(order),
      customerName: order.customerName || order.customer?.name || "Cliente",
      movieTitle: order.movieTitle || movieForOrder(db, order)?.title || "Filme",
      status: orderStatusLabel(order.status),
      origin: originLabel(order.origin || "online"),
      paymentMethod: methodLabel(order.paymentMethod),
      totalPrice: financiallySettled ? Number(breakdown.totalRevenue || 0) : Number(order.totalPrice || 0),
      originalTotal: Number(order.totalPrice || 0),
      refundedAmount: Number(breakdown.refundTotal || 0),
      createdAt: order.createdAt || ""
    };
  });
  const paymentsInPeriod = (db.payments || []).filter((payment) => inDateRange(payment.approvedAt || payment.refundedAt || payment.createdAt, period.start, period.end));
  const paymentSummary = paymentsInPeriod.reduce((summary, payment) => {
    const rawStatus = String(payment.status || "").toLowerCase();
    const financialState = paymentFinancialState(payment);
    const status = financialState.fullyRefunded
      ? "refunded"
      : financialState.approved ? "approved"
      : ["pending", "processing", "pending_payment"].includes(rawStatus)
        ? "pending"
        : ["rejected", "cancelled", "canceled"].includes(rawStatus)
          ? "failed"
          : rawStatus === "expired" ? "expired" : "other";
    summary[status] ||= { count: 0, amount: 0 };
    summary[status].count += 1;
    const recognizedAmount = status === "approved" ? financialState.netAmount : status === "refunded" ? financialState.refundedAmount : Number(payment.amount || 0);
    summary[status].amount = Number((summary[status].amount + recognizedAmount).toFixed(2));
    if (status === "approved" && financialState.refundedAmount > 0) {
      summary.refunded ||= { count: 0, amount: 0 };
      summary.refunded.count += 1;
      summary.refunded.amount = Number((summary.refunded.amount + financialState.refundedAmount).toFixed(2));
    }
    return summary;
  }, {});
  const clubFinanceForRange = (start, end) => {
    const detailed = (db.subscriptionPayments || [])
      .filter((payment) => isOrderFinanciallySettled({}, payment) && inDateRange(payment.approvedAt || payment.createdAt, start, end));
    const source = detailed.length ? detailed : (db.payments || [])
      .filter((payment) => payment.metadata?.kind === "club_subscription" && isOrderFinanciallySettled({}, payment) && inDateRange(payment.approvedAt || payment.createdAt, start, end));
    return source.reduce((result, payment) => {
      const state = paymentFinancialState(payment);
      result.gross += state.approved || state.fullyRefunded ? state.amount : 0;
      result.refunds += state.refundedAmount;
      result.net += state.netAmount;
      return result;
    }, { gross: 0, refunds: 0, net: 0 });
  };
  const clubFinance = clubFinanceForRange(period.start, period.end);
  const previousClubFinance = clubFinanceForRange(period.previousStart, period.previousEnd);
  const clubRevenue = Number(clubFinance.net.toFixed(2));
  const previousClubRevenue = Number(previousClubFinance.net.toFixed(2));
  const refundsPeriod = Number((orderRefunds + clubFinance.refunds).toFixed(2));
  const approvedGrossRevenue = Number((orderApprovedBeforeRefunds + clubFinance.gross).toFixed(2));
  const clubRedemptions = (db.subscriptionCreditRedemptions || []).filter((item) => inDateRange(item.redeemedAt || item.createdAt, period.start, period.end));
  const clubTopUps = clubRedemptions.reduce((total, item) => total + Number(item.additionalPaymentAmount || 0), 0);
  const courtesies = (db.tickets || []).filter((ticket) => ticket.paymentSource === "courtesy" && inDateRange(ticket.createdAt, period.start, period.end)).length;
  const clubTickets = (db.tickets || []).filter((ticket) => ticket.paymentSource === "subscription_credit" && inDateRange(ticket.createdAt, period.start, period.end)).length;
  const clubGoodsDiscount = (db.orderGoodsItems || []).filter((item) => inDateRange(item.createdAt, period.start, period.end)).reduce((total, item) => total + Number(item.clubDiscount || 0), 0);
  const fiscalCounts = (db.goodsFiscalDocuments || []).filter((item) => inDateRange(item.createdAt, period.start, period.end)).reduce((counts, item) => ({
    ...counts,
    [item.status]: Number(counts[item.status] || 0) + 1
  }), {});
  const revenueComposition = [
    {
      key: "tickets",
      label: "Ingressos",
      amount: ticketRevenue,
      grossAmount: Number(periodBreakdowns.reduce((total, item) => total + Number(item.ticketGross || 0), 0).toFixed(2)),
      discountAmount: Number(periodBreakdowns.reduce((total, item) => total + Math.max(0, Number(item.ticketGross || 0) - Number(item.ticketRevenueBeforeRefund || 0)), 0).toFixed(2)),
      refundAmount: Number(periodBreakdowns.reduce((total, item) => total + Number(item.ticketRefunded || 0), 0).toFixed(2)),
      hint: `${ticketsSold} ingresso(s) válidos`
    },
    { key: "concessions", label: "Bomboniere", amount: concessionRevenue, grossAmount: concessionSummary.grossRevenue, discountAmount: concessionSummary.discountTotal, refundAmount: concessionSummary.refundTotal, hint: `${concessionSummary.itemQuantity} item(ns) em ${concessionSummary.orders} pedido(s)` },
    { key: "club", label: "Assinaturas do Clube", amount: clubRevenue, grossAmount: Number(clubFinance.gross.toFixed(2)), refundAmount: Number(clubFinance.refunds.toFixed(2)), hint: "Mensalidades aprovadas menos devoluções" }
  ];
  const attentionPayments = paymentsInPeriod.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    if (["rejected", "cancelled"].includes(status)) return true;
    if (payment.refundStatus === "required" || payment.refundStatus === "pending") return true;
    if (["pending", "processing"].includes(status)) {
      const ageMinutes = (Date.now() - new Date(payment.createdAt || Date.now()).getTime()) / 60000;
      return ageMinutes > 20;
    }
    return false;
  }).slice(0, 8);
  const chart = [];
  for (let index = 0; index < period.days; index += 1) {
    const date = new Date(`${period.start}T12:00:00`);
    date.setDate(date.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const orders = periodPaidOrders.filter((order) => inDateRange(recognitionDate(order, paymentForOrder(order)), key, key));
    const dayClubFinance = clubFinanceForRange(key, key);
    chart.push({
      date: key,
      revenue: Number((orders.reduce((total, order) => total + (breakdownByOrderId.get(order.id) || orderFinancialBreakdown(db, order)).totalRevenue, 0) + dayClubFinance.net).toFixed(2)),
      orders: orders.length,
      tickets: ticketCountForOrders(orders)
    });
  }
  const clubSubscriptions = db.subscriptions || [];
  const newSubscribers = clubSubscriptions.filter((item) => inDateRange(item.createdAt || item.startedAt, period.start, period.end)).length;
  const cancelledSubscriptions = clubSubscriptions.filter((item) => inDateRange(item.cancelledAt, period.start, period.end)).length;
  const activeSubscriptions = clubSubscriptions.filter((item) => item.status === "active");
  const recurringRevenueEstimate = activeSubscriptions.reduce((total, subscription) => {
    const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
    return total + Number(plan?.monthlyPrice || plan?.price || 0);
  }, 0);
  const periodUsers = (db.users || []).filter((user) => user.role === "customer" && inDateRange(user.createdAt, period.start, period.end));
  const problematicStatuses = ["pending", "processing", "rejected", "cancelled"];
  return {
    period,
    revenueToday: Number((todayOrders.reduce((total, order) => total + orderFinancialBreakdown(db, order).totalRevenue, 0) + clubFinanceForRange(today, today).net).toFixed(2)),
    revenuePeriod: Number((paidOrderRevenue + clubRevenue).toFixed(2)),
    revenueMonth: Number((paidOrderRevenue + clubRevenue).toFixed(2)),
    approvedGrossRevenue,
    refundsPeriod,
    comparison: {
      revenue: compareMetric(paidOrderRevenue + clubRevenue, previousPaidOrders.reduce((total, order) => total + previousBreakdowns.get(order.id).totalRevenue, 0) + previousClubRevenue),
      sales: compareMetric(periodPaidOrders.length, previousPaidOrders.length),
      tickets: compareMetric(ticketsSold, ticketCountForOrders(previousPaidOrders))
    },
    salesToday: todayOrders.length,
    salesPeriod: periodPaidOrders.length,
    salesMonth: periodPaidOrders.length,
    ticketsSold,
    averageTicket: periodPaidOrders.length ? paidOrderRevenue / periodPaidOrders.length : 0,
    averageConcessionOrder: concessionSummary.orders ? concessionRevenue / concessionSummary.orders : 0,
    customers: (db.users || []).filter((user) => user.role === "customer").length,
    newCustomers: periodUsers.length,
    activeSubscriptions: activeSubscriptions.length,
    pendingPayments: paymentSummary.pending?.count || 0,
    pendingPaymentsAmount: paymentSummary.pending?.amount || 0,
    approvedPayments: paymentSummary.approved?.count || 0,
    approvedPaymentsAmount: paymentSummary.approved?.amount || 0,
    rejectedPayments: paymentSummary.failed?.count || 0,
    rejectedPaymentsAmount: paymentSummary.failed?.amount || 0,
    problematicPayments: paymentsInPeriod.filter((payment) => problematicStatuses.includes(String(payment.status || "").toLowerCase())).length,
    concessionRevenue,
    concessionSummary,
    ticketRevenue,
    clubRevenue,
    revenueComposition,
    revenueByMovie: Object.entries(revenueByMovie)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 8)
      .map(([name, amount]) => ({ name, amount })),
    capacity: {
      roomCapacity: totalCapacity,
      occupied,
      sessions: todaySessions.length,
      inProgress: todaySessions.filter((item) => item.isInProgress).length,
      occupancyRate: totalCapacity ? Math.round((occupied / totalCapacity) * 100) : 0
    },
    salesByOrigin: groupCount(periodOrders, (order) => originLabel(order.origin || "online")),
    revenueByOrigin: groupOrderRevenue(periodPaidOrders, (order) => originLabel(order.origin || "online")),
    paymentMethods: groupCount(periodOrders, (order) => methodLabel(order.paymentMethod)),
    revenueByMethod: groupOrderRevenue(periodPaidOrders, (order) => methodLabel(order.paymentMethod)),
    reconciliation: Object.entries(paymentSummary).reduce((result, [status, summary]) => {
      const label = {
        approved: "Aprovado líquido",
        pending: "Pendente",
        failed: "Recusado ou cancelado",
        refunded: "Reembolsado",
        expired: "Expirado",
        other: "Outro"
      }[status] || status;
      result[label] = Number(summary.amount || 0);
      return result;
    }, {}),
    paymentSummary,
    upcomingSessions,
    todaySessions,
    chart,
    attentionPayments: attentionPayments.map((payment) => {
      const order = (db.orders || []).find((item) => item.id === payment.orderId) || {};
      return {
        id: payment.id,
        orderId: payment.orderId,
        orderReference: shortOrderReference(order),
        status: paymentStatusLabel(payment.status),
        method: methodLabel(payment.method),
        provider: providerLabel(payment.provider),
        amount: Number(payment.amount || 0),
        message: payment.refundStatus ? "Reembolso pendente" : ["pending", "processing"].includes(payment.status) ? "Aguardando confirmação há muito tempo" : paymentStatusLabel(payment.status),
        createdAt: payment.createdAt || ""
      };
    }),
    topProducts: concessionSummary.products.slice(0, 6).map((item) => ({ ...item, revenue: item.netRevenue })),
    lowStockProducts,
    club: {
      activeSubscriptions: activeSubscriptions.length,
      newSubscribers,
      cancellations: cancelledSubscriptions,
      recurringRevenueEstimate,
      revenue: clubRevenue,
      creditsIssued: (db.subscriptionCreditUnits || []).length
        ? (db.subscriptionCreditUnits || []).filter((item) => inDateRange(item.issuedAt, period.start, period.end)).length
        : (db.subscriptionCredits || []).filter((item) => inDateRange(item.cycleStart || item.createdAt, period.start, period.end)).reduce((total, item) => total + Number(item.total || 0), 0),
      creditsUsed: clubRedemptions.filter((item) => item.status === "redeemed").length,
      creditsExpired: (db.subscriptionCreditUnits || []).filter((item) => item.status === "expired" && inDateRange(item.updatedAt || item.expiresAt, period.start, period.end)).length,
      clubTickets,
      topUps: Number(clubTopUps.toFixed(2)),
      courtesies,
      goodsDiscount: Number(clubGoodsDiscount.toFixed(2)),
      goodsFiscal: fiscalCounts
    },
    cardTerminal: {
      configured: cardTerminalProvider.configured(integrationConfigService.resolvedConfig(db, "mercadoPago") || {}),
      provider: providerLabel(cardTerminalProvider.providerName())
    },
    latestOrders,
    generatedAt: now.toISOString()
  };
}
  return adminDashboard;
}

module.exports = { createAdminDashboardService };
