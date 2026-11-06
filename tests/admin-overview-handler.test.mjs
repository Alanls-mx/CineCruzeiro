import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminOverviewHandler } = require("../backend/services/adminOverviewHandler.js");

test("overview routes keep dashboard period and marketing counters", async () => {
  const calls = [];
  const handler = createAdminOverviewHandler({
    sendJson: (res, status, body) => Object.assign(res, { status, body }),
    adminDashboard: (_db, options) => ({ period: options.period }),
    parseAdminPeriod: (url) => url.searchParams.get("period"),
    listPersistedCampaigns: async () => { calls.push("campaigns"); return { campaigns: [{ id: "campaign", sent: 3, recipientCount: 5 }], total: 1 }; },
    postgresEnabled: () => false,
    emailCampaignRepository: {},
    adIsVisible: (ad) => ad.active,
    couponUsageSummary: () => ({ usageCount: 2 }),
    publicCampaign: (campaign) => ({ id: campaign.id })
  });
  const req = { url: "/api/dashboard?period=7d", headers: { host: "local.test" } };
  const dashboard = {};
  assert.equal(await handler({ req, res: dashboard, pathname: "/api/dashboard", method: "GET", db: {} }), true);
  assert.deepEqual(dashboard, { status: 200, body: { period: "7d" } });

  const marketing = {};
  assert.equal(await handler({ req, res: marketing, pathname: "/api/admin/marketing/overview", method: "GET", db: {
    settings: { adsEnabled: true }, ads: [{ active: true, impressions: 10, clicks: 2 }], promotions: [{ id: "coupon", active: true }]
  } }), true);
  assert.deepEqual(calls, ["campaigns"]);
  assert.equal(marketing.status, 200);
  assert.equal(marketing.body.email.sent, 3);
  assert.equal(marketing.body.ads.ctr, 20);
  assert.equal(marketing.body.coupons.uses, 2);
  assert.deepEqual(marketing.body.recentCampaigns, [{ id: "campaign" }]);
  assert.equal(await handler({ req, res: {}, pathname: "/api/admin/marketing/overview", method: "POST", db: {} }), false);
});
