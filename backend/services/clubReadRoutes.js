// Commercial read routes mounted at their original dispatcher slots.
function createClubReadRoutes(deps) {
  const { sendJson, assetRecord, getCustomerUser, subscriptionSummary, adminSubscriptionPresenter } = deps;

  async function handlePublicClubRead({ req, res, pathname, method, db }) {
    if (pathname === "/api/subscription-plans" && method === "GET") {
        sendJson(
          res,
          200,
          (db.subscriptionPlans || []).filter((plan) => plan.active !== false).map((plan) => assetRecord(plan, ["imageUrl"])),
          { "Cache-Control": "public, max-age=30, stale-while-revalidate=90" }
        );
        return true;
      }

    if (pathname === "/api/me/subscriptions" && method === "GET") {
        const user = getCustomerUser(req, db);
        if (!user) {
          sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar o Clube." } });
          return true;
        }
        sendJson(res, 200, { subscriptions: subscriptionSummary(db, user.id) });
        return true;
      }
    return false;
  }

  async function handleAdminClubPlanRead({ req, res, pathname, method, db }) {
    if (pathname === "/api/admin/subscription-plans" && method === "GET") {
        sendJson(res, 200, db.subscriptionPlans || []);
        return true;
      }
    return false;
  }

  async function handleAdminClubSubscriptionRead({ req, res, pathname, method, db }) {
    if (pathname === "/api/admin/subscriptions" && method === "GET") {
        sendJson(res, 200, adminSubscriptionPresenter.list(db));
        return true;
      }
    return false;
  }

  return { handlePublicClubRead, handleAdminClubPlanRead, handleAdminClubSubscriptionRead };
}

module.exports = { createClubReadRoutes };
