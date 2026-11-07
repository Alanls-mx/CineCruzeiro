"use strict";

function createEmailAutomationRoutes({
  appFrontendUrl,
  applyCampaignTemplateResolution,
  buildEmailAutomationPlan,
  createPersistedCampaign,
  eligibleCampaignRecipients,
  emailAutomationAuthorized,
  emailAutomationContext,
  emailCampaignRepository,
  findPersistedCampaignByIdempotencyKey,
  integrationConfigService,
  listPersistedCampaigns,
  logEvent,
  normalizeCampaignInput,
  postgresEnabled,
  publicCampaign,
  readBody,
  sendJson,
}) {
  return async function handleEmailAutomationRoute({ req, res, pathname, method, db }) {
  if (pathname.startsWith("/api/email-automation/") && !emailAutomationAuthorized(req)) {
    const configured = Boolean(process.env.EMAIL_AUTOMATION_TOKEN || process.env.N8N_EMAIL_SHARED_SECRET);
    sendJson(res, configured ? 401 : 503, { error: { code: "EMAIL_AUTOMATION_UNAVAILABLE", message: configured ? "Credencial de automação de e-mail inválida." : "A automação de e-mail ainda não foi configurada." } });
    return true;
  }
  if (pathname === "/api/email-automation/context" && method === "GET") {
    sendJson(res, 200, { context: emailAutomationContext(db) }, { "Cache-Control": "no-store" });
    return true;
  }
  if (pathname === "/api/email-automation/campaigns" && method === "POST") {
    const body = await readBody(req);
    const recent = await listPersistedCampaigns({ page: 1, pageSize: 30, order: "desc" });
    const plan = buildEmailAutomationPlan(db, body, { history: recent.campaigns || [], siteUrl: appFrontendUrl() });
    if (plan.skipped) {
      logEvent("info", "email_automation.skipped", { type: plan.type, reason: plan.reason });
      sendJson(res, 200, { plan, created: false }, { "Cache-Control": "no-store" });
      return true;
    }
    const duplicate = await findPersistedCampaignByIdempotencyKey(plan.campaign.idempotencyKey);
    if (duplicate) {
      sendJson(res, 200, {
        plan: { type: plan.type, warnings: plan.warnings, signals: plan.signals },
        campaign: publicCampaign(duplicate),
        created: false,
        idempotent: true,
        deliveryMode: duplicate.status === "draft" ? "draft" : "existing",
        deliveryReady: Boolean(integrationConfigService.resolvedConfig(db, "email")?.configured)
      }, { "Cache-Control": "no-store" });
      return true;
    }
    const campaign = normalizeCampaignInput(plan.campaign, { brand: db.settings?.emailBranding || {} });
    const eligibility = eligibleCampaignRecipients(db, campaign);
    applyCampaignTemplateResolution(campaign, eligibility.templateResolution);
    const configuredMode = String(process.env.EMAIL_AUTOMATION_MODE || "draft").toLowerCase() === "send" ? "send" : "draft";
    const emailConfig = integrationConfigService.resolvedConfig(db, "email");
    const deliveryReady = Boolean(emailConfig?.enabled && emailConfig?.configured);
    const shouldSend = configuredMode === "send" && deliveryReady;
    campaign.status = shouldSend ? "queued" : "draft";
    campaign.createdBy = "n8n";
    campaign.recipientCount = eligibility.recipients.length;
    campaign.eligibility = eligibility.report;
    if (!eligibility.recipients.length) {
      logEvent("info", "email_automation.skipped", { type: plan.type, reason: "no_recipients" });
      sendJson(res, 200, { plan: { ...plan, skipped: true, reason: "Nenhum destinatário elegível para esta automação." }, created: false }, { "Cache-Control": "no-store" });
      return true;
    }
    if (shouldSend) campaign.queuedAt = new Date().toISOString();
    const persisted = await createPersistedCampaign(campaign);
    if (persisted.created && postgresEnabled() && shouldSend) await emailCampaignRepository.snapshotRecipients(campaign.id, eligibility.recipients);
    logEvent("info", shouldSend ? "email_automation.queued" : "email_automation.draft_created", {
      campaignId: persisted.campaign.id,
      type: plan.type,
      recipients: eligibility.recipients.length,
      idempotent: !persisted.created
    });
    sendJson(res, persisted.created ? 201 : 200, {
      plan: { type: plan.type, warnings: plan.warnings, signals: plan.signals },
      campaign: publicCampaign(persisted.campaign),
      created: persisted.created,
      idempotent: !persisted.created,
      deliveryMode: shouldSend ? "queued" : "draft",
      deliveryReady
    }, { "Cache-Control": "no-store" });
    return true;
  }
    return false;
  };
}

module.exports = { createEmailAutomationRoutes };
