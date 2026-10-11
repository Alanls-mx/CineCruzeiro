function createEmailCampaignPresenter({ normalizeEmailBrand }) {
  function publicCampaign(campaign = {}) {
    const { customerIds, html, message, contentBlocks, attachments, ...safe } = campaign;
    return {
      ...safe,
      attachments: (attachments || []).map(({ path, ...item }) => item),
      customerCount: Number(campaign.recipientCount || campaign.recipients || 0),
      hasHtml: campaign.hasHtml ?? Boolean(html),
      hasMessage: campaign.hasMessage ?? Boolean(message),
      hasBlocks: campaign.hasBlocks ?? Boolean(contentBlocks?.length),
      metricsSupported: {
        sent: true,
        failed: true,
        delivered: campaign.delivered !== null,
        bounced: campaign.bounced !== null,
        opened: campaign.opened !== null,
        clicked: campaign.clicked !== null
      }
    };
  }

  function campaignDetails(campaign = {}) {
    return {
      ...publicCampaign(campaign),
      message: String(campaign.message || ""),
      html: String(campaign.html || ""),
      contentBlocks: Array.isArray(campaign.contentBlocks) ? campaign.contentBlocks : [],
      customerIds: Array.isArray(campaign.customerIds) ? campaign.customerIds : [],
      variables: campaign.variables || {},
      brand: normalizeEmailBrand(campaign.brand || {}),
      recipientSearch: campaign.recipientSearch || ""
    };
  }

  return { publicCampaign, campaignDetails };
}

module.exports = { createEmailCampaignPresenter };
