function createAdminOverviewHandler({ sendJson, adminDashboard, parseAdminPeriod, listPersistedCampaigns, postgresEnabled, emailCampaignRepository, adIsVisible, couponUsageSummary, publicCampaign }) {
  return async function handleAdminOverviewRoutes({ req, res, pathname, method, db }) {
  if ((pathname === "/api/dashboard" || pathname === "/api/admin/dashboard") && method === "GET") {
    const dashboardUrl = new URL(req.url, `http://${req.headers.host}`);
    sendJson(res, 200, adminDashboard(db, { period: parseAdminPeriod(dashboardUrl) }));
    return true;
  }

  if (pathname === "/api/admin/marketing/overview" && method === "GET") {
    const campaignResult = await listPersistedCampaigns({ page: 1, pageSize: 100, order: "desc" });
    const campaigns = campaignResult.campaigns || [];
    const sumCampaign = (field) => campaigns.reduce((total, campaign) => total + Math.max(0, Number(campaign[field] || 0)), 0);
    const emailMetrics = postgresEnabled()
      ? await emailCampaignRepository.aggregateCampaignMetrics()
      : {
          campaigns: Number(campaignResult.total || campaigns.length),
          recipients: sumCampaign("recipientCount"),
          sent: sumCampaign("sent"),
          delivered: sumCampaign("delivered"),
          opened: sumCampaign("opened"),
          clicked: sumCampaign("clicked"),
          failed: sumCampaign("failed"),
          deliveredSupported: campaigns.some((campaign) => campaign.delivered !== null && campaign.delivered !== undefined),
          openedSupported: campaigns.some((campaign) => campaign.opened !== null && campaign.opened !== undefined),
          clickedSupported: campaigns.some((campaign) => campaign.clicked !== null && campaign.clicked !== undefined)
        };
    const ads = db.ads || [];
    const promotions = db.promotions || [];
    const adImpressions = ads.reduce((total, ad) => total + Math.max(0, Number(ad.impressions || 0)), 0);
    const adClicks = ads.reduce((total, ad) => total + Math.max(0, Number(ad.clicks || 0)), 0);
    sendJson(res, 200, {
      email: emailMetrics,
      ads: {
        enabled: db.settings?.adsEnabled !== false,
        total: ads.length,
        active: db.settings?.adsEnabled === false ? 0 : ads.filter((ad) => adIsVisible(ad)).length,
        impressions: adImpressions,
        clicks: adClicks,
        ctr: adImpressions ? Number(((adClicks / adImpressions) * 100).toFixed(2)) : 0
      },
      coupons: {
        total: promotions.length,
        active: promotions.filter((promotion) => promotion.active !== false && !promotion.archivedAt).length,
        uses: promotions.reduce((total, promotion) => total + Number(couponUsageSummary(db, promotion).usageCount || 0), 0)
      },
      recentCampaigns: campaigns.slice(0, 5).map(publicCampaign),
      topAds: ads.slice().sort((a, b) => Number(b.clicks || 0) - Number(a.clicks || 0) || Number(b.impressions || 0) - Number(a.impressions || 0)).slice(0, 5)
    });
    return true;
  }

    return false;
  };
}

module.exports = { createAdminOverviewHandler };
