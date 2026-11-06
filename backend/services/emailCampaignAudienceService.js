function createEmailCampaignAudienceService({ emailUnsubscribeUrlForUser, filterOfferRecipients, scopeCampaignContext, resolveCampaignTemplate, resolveCampaignContext, validateCampaignTemporalClaims }) {
  function campaignCustomerPool(db) {
    return (db.users || [])
      .filter((user) => user.role === "customer" && user.active !== false && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(user.email || "")))
      .map((user) => ({
        id: user.id,
        name: user.name || "",
        email: String(user.email || "").toLowerCase(),
        emailUnsubscribedAt: user.emailUnsubscribedAt || "",
        emailUnsubscribeToken: user.emailUnsubscribeToken || "",
        hasPurchased: (db.orders || []).some((order) => order.customerUserId === user.id && ["paid", "approved"].includes(order.status)),
        lastPurchaseAt: (db.orders || [])
          .filter((order) => order.customerUserId === user.id && ["paid", "approved"].includes(order.status))
          .map((order) => order.paidAt || order.updatedAt || order.createdAt || "")
          .filter(Boolean)
          .sort()
          .at(-1) || ""
      }));
  }

  function campaignRecipients(db, campaign = {}) {
    const pool = campaignCustomerPool(db);
    const mode = campaign.recipientMode || campaign.audience || "all";
    const selected = new Set((campaign.customerIds || campaign.selectedUserIds || []).map(String));
    const term = String(campaign.recipientSearch || campaign.search || "").trim().toLowerCase();
    const now = Date.now();
    const reactivationDays = Math.max(30, Math.min(730, Number(campaign.reactivationDays || 90)));
    return pool.filter((user) => {
      if (user.emailUnsubscribedAt) return false;
      if (mode === "selected" && !selected.has(String(user.id))) return false;
      if (mode === "purchased" && !user.hasPurchased) return false;
      if (["active", "recent"].includes(mode)) {
        const lastPurchase = new Date(user.lastPurchaseAt || 0).getTime();
        if (!Number.isFinite(lastPurchase) || now - lastPurchase > 180 * 86400000) return false;
      }
      if (mode === "reactivation") {
        const lastPurchase = new Date(user.lastPurchaseAt || 0).getTime();
        if (!user.hasPurchased || !Number.isFinite(lastPurchase) || now - lastPurchase < reactivationDays * 86400000) return false;
      }
      if (mode === "birthday_manual" && !selected.has(String(user.id))) return false;
      if (term && !`${user.name} ${user.email}`.toLowerCase().includes(term)) return false;
      return true;
    }).map((user) => ({
      ...user,
      unsubscribeUrl: emailUnsubscribeUrlForUser(user)
    }));
  }

  function eligibleCampaignRecipients(db, campaign = {}, options = {}) {
    const { context, resolution } = resolveCampaignForInput(db, campaign, options);
    const baseRecipients = campaignRecipients(db, campaign);
    const recipientCheck = filterOfferRecipients(db, context, baseRecipients);
    return {
      ...context,
      templateResolution: resolution,
      recipients: recipientCheck.recipients,
      report: {
        ...context.report,
        recipients: {
          considered: baseRecipients.length,
          eligible: recipientCheck.recipients.length,
          excluded: recipientCheck.excluded,
          exclusionReasons: recipientCheck.reasons
        }
      }
    };
  }

  function resolveCampaignForInput(db, campaign = {}, options = {}) {
    const scopedCampaign = scopeCampaignContext(campaign);
    const preliminary = resolveCampaignTemplate(scopedCampaign);
    const validationScenario = preliminary.incomplete ? "announcement" : preliminary.scenario;
    const movieIds = [...new Set((scopedCampaign.movieIds || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 20);
    const movies = movieIds.map((id) => (db.movies || []).find((item) => String(item.id) === id));
    if (movies.some((movie) => !movie)) {
      const error = new Error("Um dos filmes selecionados não existe mais no catálogo.");
      error.statusCode = 409;
      error.code = "EMAIL_CAMPAIGN_MOVIE_NOT_FOUND";
      throw error;
    }
    if (movies.some((movie) => movie.workflowStatus === "archived" || movie.workflowStatus === "draft" || movie.status === "hidden")) {
      const error = new Error("Um dos filmes selecionados não está publicado para os clientes.");
      error.statusCode = 409;
      error.code = "EMAIL_CAMPAIGN_MOVIE_UNAVAILABLE";
      throw error;
    }
    const context = resolveCampaignContext(db, {
      ...scopedCampaign,
      scenario: validationScenario,
      requireClubPlan: preliminary.scenario === "club_plan"
    }, options);
    context.movies = movies;
    const temporalValidation = validateCampaignTemporalClaims({
      ...scopedCampaign,
      scenario: preliminary.scenario
    }, context, options);
    context.report.temporalValidation = temporalValidation;
    const resolution = resolveCampaignTemplate({
      ...scopedCampaign,
      ...context,
      objective: preliminary.objective,
      scenario: preliminary.scenario,
      movieIds: scopedCampaign.movieIds
    });
    return { context, resolution };
  }

  function applyCampaignTemplateResolution(campaign, resolution, { allowIncomplete = false } = {}) {
    if (resolution?.incomplete && !allowIncomplete) {
      const error = new Error(resolution.reason || "Selecione o conteúdo da campanha.");
      error.statusCode = 409;
      error.code = "EMAIL_CAMPAIGN_CONTEXT_REQUIRED";
      throw error;
    }
    if (resolution?.templateId) campaign.templateId = resolution.templateId;
    campaign.objective = resolution?.objective || campaign.objective || "announcement";
    campaign.aiScenario = resolution?.scenario || campaign.aiScenario || "announcement";
    campaign.templateSelectionMode = resolution?.templateSelectionMode || "automatic";
    campaign.templateReason = resolution?.reason || "";
    campaign.compatibleTemplates = Array.isArray(resolution?.compatibleTemplates) ? resolution.compatibleTemplates : [];
    campaign.templateIncomplete = Boolean(resolution?.incomplete);
    return campaign;
  }

  return { campaignCustomerPool, campaignRecipients, eligibleCampaignRecipients, resolveCampaignForInput, applyCampaignTemplateResolution };
}

module.exports = { createEmailCampaignAudienceService };
