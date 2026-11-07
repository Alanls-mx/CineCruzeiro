function createClubSubscriptionSummary({ refreshSubscriptionCredits, currentSubscriptionCredit, shortOrderReference, clubDomainService, reservedFreeConcessionQuantity, subscriptionStatusLabel, isManualSubscription, clubSavingsSummary, subscriptionCanUseCredit }) {
  function subscriptionSummary(db, userId) {
    return (db.subscriptions || [])
      .filter((subscription) => subscription.userId === userId)
      .map((subscription) => {
        refreshSubscriptionCredits(db, subscription);
        const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
        const credit = currentSubscriptionCredit(db, subscription);
        const usage = (db.subscriptionUsage || []).filter((item) => item.subscriptionId === subscription.id).map((item) => {
          const order = (db.orders || []).find((candidate) => candidate.id === item.orderId);
          const ticket = (db.tickets || []).find((candidate) => candidate.id === item.ticketId)
            || (db.tickets || []).find((candidate) => candidate.orderId === item.orderId && candidate.movieId === item.movieId);
          const movie = (db.movies || []).find((candidate) => candidate.id === (item.movieId || order?.movieId));
          const basePrice = Number(ticket?.basePrice ?? ticket?.metadata?.originalBasePrice ?? 0);
          const paidAfterBenefits = Number(ticket?.additionalPaymentAmount ?? 0);
          const fallbackSavings = Number(ticket?.subscriptionCreditAmount ?? order?.clubCreditsApplied ?? 0)
            + Number(ticket?.metadata?.clubPlanDiscount ?? 0);
          return {
            ...item,
            movieTitle: movie?.title || order?.movieTitle || ticket?.movieTitle || "Filme não identificado",
            sessionDate: ticket?.sessionDate || order?.sessionDate || "",
            sessionTime: ticket?.sessionTime || order?.sessionTime || "",
            ticketType: ticket?.ticketType || "Ingresso",
            orderReference: shortOrderReference(order),
            savings: Number(Math.max(0, basePrice - paidAfterBenefits || fallbackSavings).toFixed(2))
          };
        });
        const detailedCredits = (db.subscriptionCreditUnits || []).filter((item) => item.subscriptionId === subscription.id);
        const counts = detailedCredits.length ? clubDomainService.creditCounts(db, subscription.id) : null;
        const freeItems = (plan?.freeConcessionItems || []).map((configured) => {
          const concession = (db.concessions || []).find((item) => item.id === configured.concessionId);
          const included = Math.max(0, Number(configured.quantityPerCycle || configured.quantity || 0));
          const used = reservedFreeConcessionQuantity(db, subscription, configured.concessionId);
          return {
            concessionId: configured.concessionId,
            name: concession?.name || "Item da bomboniere",
            included,
            used,
            remaining: Math.max(0, included - used),
            imageUrl: concession?.imageUrl || ""
          };
        });
        return {
          ...subscription,
          plan,
          statusLabel: subscriptionStatusLabel(subscription.status),
          credit,
          usage,
          cycleStart: subscription.cycleStart || subscription.currentPeriodStart || credit?.cycleStart || "",
          cycleEnd: subscription.cycleEnd || subscription.currentPeriodEnd || credit?.cycleEnd || "",
          billingMode: isManualSubscription(subscription) ? "manual" : "automatic",
          autoRenew: !isManualSubscription(subscription) && subscription.cancelAtPeriodEnd !== true,
          paymentRequired: !isManualSubscription(subscription),
          assignedManually: isManualSubscription(subscription),
          nextBillingAt: isManualSubscription(subscription) ? "" : (subscription.nextBillingAt || subscription.cycleEnd || ""),
          creditCounts: counts,
          savings: clubSavingsSummary(db, subscription),
          freeItems,
          creditsTotal: subscriptionCanUseCredit(subscription) ? (detailedCredits.length || Number(credit?.total || 0)) : 0,
          creditsRemaining: subscriptionCanUseCredit(subscription) ? (counts ? Number(counts.available || 0) : Math.max(0, Number(subscription.creditsAvailable || 0))) : 0,
          creditsReserved: counts ? Number(counts.reserved || 0) : 0,
          creditsUsed: subscriptionCanUseCredit(subscription) ? (counts ? Number(counts.redeemed || 0) : Number(subscription.creditsUsed || 0)) : 0,
          creditsExpired: counts ? Number(counts.expired || 0) : 0
        };
      });
  }
  return subscriptionSummary;
}

module.exports = { createClubSubscriptionSummary };
