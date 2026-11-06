function createCatalogReadHandler({
  sendJson, getContent, getAdminContent, postgresEnabled, adminHasPermission, emailCampaignRepository, publicCampaign
}) {
  function handlePublicContentRoute({ res, pathname, method, db }) {
    if (pathname !== "/api/content" || method !== "GET") return false;
    sendJson(res, 200, getContent(db), {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=45"
    });
    return true;
  }

  async function handleAdminContentRoute({ req, res, pathname, method, db }) {
    if (pathname !== "/api/admin/content" || method !== "GET") return false;
    const content = getAdminContent(db, req.adminUser);
    if (postgresEnabled() && adminHasPermission(req.adminUser, "marketing.view")) {
      const history = await emailCampaignRepository.listCampaigns({ page: 1, pageSize: 25 });
      content.emailCampaigns = history.campaigns.map(publicCampaign);
      content.emailCampaignPagination = { page: history.page, pages: history.pages, pageSize: history.pageSize, total: history.total, totals: history.totals };
    }
    sendJson(res, 200, content);
    return true;
  }

  return { handlePublicContentRoute, handleAdminContentRoute };
}

module.exports = { createCatalogReadHandler };
