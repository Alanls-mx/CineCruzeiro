function createAdminContentPresenter({ getContent, roleAlias, adminHasPermission, campaignCustomerPool, publicCampaign }) {
  function getAdminContent(db, adminUser) {
    const content = getContent(db, { includePrivate: true });
    content.auditLogs = [];
    const isOwner = roleAlias(adminUser?.role) === "owner";

    content.emailCustomers = adminHasPermission(adminUser, "marketing.view")
      ? campaignCustomerPool(db).map(({ emailUnsubscribeToken, ...customer }) => customer)
      : [];
    content.emailCampaigns = adminHasPermission(adminUser, "marketing.view")
      ? (db.emailCampaigns || []).map(publicCampaign)
      : [];

    if (!adminHasPermission(adminUser, "users.manage")) content.users = [];
    if (!isOwner) {
      content.subscriptionAccountingRules = [];
      content.subscriptionPlans = (content.subscriptionPlans || []).map(({ accounting, ...plan }) => plan);
    }
    if (!adminHasPermission(adminUser, "orders.view")) {
      content.orders = [];
    }
    if (!adminHasPermission(adminUser, "payments.view")) content.payments = [];
    if (!adminHasPermission(adminUser, "tickets.view")) content.tickets = [];
    if (!adminHasPermission(adminUser, "logs.view")) {
      content.auditLogs = [];
    }
    if (!adminHasPermission(adminUser, "club.view")) {
      content.subscriptionPlans = [];
      content.subscriptions = [];
      content.subscriptionCredits = [];
      content.subscriptionUsage = [];
      content.subscriptionCycles = [];
      content.subscriptionPayments = [];
      content.subscriptionCreditUnits = [];
      content.subscriptionCreditRedemptions = [];
    }

    return content;
  }
  return { getAdminContent };
}

module.exports = { createAdminContentPresenter };
