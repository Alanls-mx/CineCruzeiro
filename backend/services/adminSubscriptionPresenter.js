function createAdminSubscriptionPresenter({ refreshSubscriptionCredits, clubSavingsSummary, subscriptionStatusLabel,
  currentSubscriptionCredit, sanitizeUser, subscriptionSummary, enrichTicket }) {
  function list(db) {
    return {
      plans: db.subscriptionPlans || [],
      subscriptions: (db.subscriptions || []).map((subscription) => ({
        ...refreshSubscriptionCredits(db, subscription),
        savings: clubSavingsSummary(db, subscription),
        statusLabel: subscriptionStatusLabel(subscription.status),
        credit: currentSubscriptionCredit(db, subscription),
        plan: (db.subscriptionPlans || []).find((plan) => plan.id === subscription.planId) || null,
        user: sanitizeUser((db.users || []).find((user) => user.id === subscription.userId) || {})
      })),
      credits: db.subscriptionCredits || [],
      usage: db.subscriptionUsage || [],
      cycles: db.subscriptionCycles || [],
      payments: db.subscriptionPayments || [],
      creditUnits: db.subscriptionCreditUnits || [],
      redemptions: db.subscriptionCreditRedemptions || []
    };
  }

  function detail(db, id) {
    const subscription = (db.subscriptions || []).find((item) => item.id === id);
    if (!subscription) return null;
    const orderIds = new Set((db.subscriptionCreditRedemptions || [])
      .filter((item) => item.subscriptionId === id).map((item) => item.orderId));
    return {
      subscription: subscriptionSummary(db, subscription.userId).find((item) => item.id === id),
      cycles: (db.subscriptionCycles || []).filter((item) => item.subscriptionId === id).map((cycle) => ({
        ...cycle,
        creditsIssued: (db.subscriptionCreditUnits || []).filter((credit) => credit.cycleId === cycle.id).length
      })),
      payments: (db.subscriptionPayments || []).filter((item) => item.subscriptionId === id),
      credits: (db.subscriptionCreditUnits || []).filter((item) => item.subscriptionId === id),
      redemptions: (db.subscriptionCreditRedemptions || []).filter((item) => item.subscriptionId === id),
      tickets: (db.tickets || []).filter((item) => orderIds.has(item.orderId)).map((item) => enrichTicket(db, item)),
      orders: (db.orders || []).filter((item) => orderIds.has(item.id)),
      history: subscription.history || []
    };
  }

  return { list, detail };
}

module.exports = { createAdminSubscriptionPresenter };
