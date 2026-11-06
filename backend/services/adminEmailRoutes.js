"use strict";

const crypto = require("crypto");

function createAdminEmailRoutes({
  appFrontendUrl,
  applyCampaignTemplateResolution,
  armCampaignCoupon,
  buildTemplateLibrary,
  campaignCustomerPool,
  campaignDetails,
  campaignRecipients,
  createPersistedCampaign,
  definitionFor,
  deletePersistedCampaign,
  eligibleCampaignRecipients,
  emailCampaignRepository,
  emailService,
  findPersistedCampaign,
  integrationConfigService,
  listPersistedCampaigns,
  logEvent,
  normalizeCampaignInput,
  normalizeEmailBrand,
  normalizeEmailLogoUrl,
  persistAutoCampaignCoupon,
  postgresEnabled,
  publicCampaign,
  readBody,
  removeAutoCampaignCoupon,
  repositoryAudit,
  resolveCampaignAttachments,
  sendJson,
  settingsRepository,
  storeEmailAttachment,
  syncCampaignCouponSchedule,
  updateLibraryPreference,
  updatePersistedCampaign,
  validCampaignTemplate,
  validateCampaignAttachmentTotal,
  variantFor,
  writeDb,
}) {
  return async function handleAdminEmailRoute({ req, res, pathname, method, db }) {
  const emailCampaignMatch = pathname.match(/^\/api\/admin\/email\/campaigns\/([^/]+)(?:\/(send|cancel|duplicate|delete|recipients|retry-failures))?$/);
  const emailTemplateLibraryMatch = pathname.match(/^\/api\/admin\/email\/template-library\/([^/]+)$/);
  if (pathname === "/api/admin/email/template-library" && method === "GET") {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const campaignResult = await listPersistedCampaigns({ page: 1, pageSize: 100, order: "desc" });
    const moviesById = new Map((db.movies || []).map((item) => [String(item.id), item]));
    const couponsById = new Map((db.promotions || []).map((item) => [String(item.id), item]));
    const concessionsById = new Map((db.concessions || []).map((item) => [String(item.id), item]));
    const plansById = new Map((db.subscriptionPlans || []).map((item) => [String(item.id), item]));
    const indexedCampaigns = (campaignResult.campaigns || []).map((campaign) => {
      const movie = moviesById.get(String(campaign.movieId || ""));
      const coupon = couponsById.get(String(campaign.couponId || ""));
      const plan = plansById.get(String(campaign.clubPlanId || ""));
      const concessionNames = (campaign.concessionIds || []).map((id) => concessionsById.get(String(id))?.name).filter(Boolean);
      return {
        ...campaign,
        movieTitle: movie?.title || "",
        moviePosterUrl: movie?.posterUrl || "",
        genres: Array.isArray(movie?.genres) ? movie.genres : String(movie?.genre || "").split(",").map((item) => item.trim()).filter(Boolean),
        couponTitle: coupon?.title || coupon?.couponCode || "",
        clubPlanName: plan?.name || "",
        itemTitle: concessionNames.join(", ")
      };
    });
    const selectedMovie = (db.movies || []).find((movie) => String(movie.id) === String(params.get("movieId") || ""));
    const library = buildTemplateLibrary({
      campaigns: indexedCampaigns,
      preferences: db.settings?.emailTemplateLibrary || {},
      filters: {
        page: params.get("page"),
        pageSize: params.get("pageSize"),
        search: String(params.get("search") || "").slice(0, 160),
        category: params.get("category") || "all",
        objective: params.get("objective") || "",
        visualStyle: params.get("visualStyle") || "",
        genre: params.get("genre") || "",
        content: params.get("content") || "",
        origin: params.get("origin") || "",
        sort: params.get("sort") || "recommended",
        favorites: params.get("favorites") === "true",
        includeArchived: params.get("includeArchived") === "true"
      },
      context: {
        templateId: params.get("templateId") || "",
        objective: params.get("contextObjective") || "",
        genres: Array.isArray(selectedMovie?.genres)
          ? selectedMovie.genres
          : String(selectedMovie?.genre || "").split(",").map((item) => item.trim()).filter(Boolean)
      }
    });
    sendJson(res, 200, {
      ...library,
      capabilities: {
        existingHtmlPreserved: true,
        deterministicModels: true,
        modelCount: library.systemModelCount
      }
    });
    return true;
  }
  if (emailTemplateLibraryMatch && method === "GET") {
    const itemId = decodeURIComponent(emailTemplateLibraryMatch[1]);
    if (itemId.startsWith("campaign:")) {
      const campaign = await findPersistedCampaign(itemId.slice("campaign:".length));
      if (!campaign) {
        sendJson(res, 404, { error: { code: "EMAIL_TEMPLATE_REFERENCE_NOT_FOUND", message: "A referência de e-mail não existe mais." } });
        return true;
      }
      sendJson(res, 200, { item: { id: itemId, sourceType: "campaign", campaign: campaignDetails(campaign) } });
      return true;
    }
    const variantId = itemId.replace(/^system:/, "");
    const variant = variantFor(variantId);
    if (!variant || !validCampaignTemplate(variant.templateId)) {
      sendJson(res, 404, { error: { code: "EMAIL_TEMPLATE_NOT_FOUND", message: "Modelo de e-mail não encontrado." } });
      return true;
    }
    sendJson(res, 200, { item: { id: `system:${variant.id}`, sourceType: "system", ...definitionFor(variant.templateId), ...variant } });
    return true;
  }
  if (emailTemplateLibraryMatch && method === "PATCH") {
    const itemId = decodeURIComponent(emailTemplateLibraryMatch[1]);
    const body = await readBody(req);
    const action = ["archive", "use"].includes(body.action) ? body.action : "favorite";
    db.settings ||= {};
    db.settings.emailTemplateLibrary = updateLibraryPreference(db.settings.emailTemplateLibrary || {}, itemId, action, body.value !== false);
    if (postgresEnabled()) {
      await settingsRepository.updateSection("emailTemplateLibrary", db.settings.emailTemplateLibrary, {
        audit: repositoryAudit(req, "settings", "emailTemplateLibrary", null, { itemId, action, value: body.value !== false })
      });
    } else {
      await writeDb(db);
    }
    logEvent("info", `email_template_library.${action}`, { itemId, value: body.value !== false, actorUserId: req.adminUser?.id || "" });
    sendJson(res, 200, { preferences: db.settings.emailTemplateLibrary });
    return true;
  }
  if (pathname === "/api/admin/email/branding" && method === "GET") {
    sendJson(res, 200, { branding: normalizeEmailBrand(db.settings?.emailBranding || {}) });
    return true;
  }
  if (pathname === "/api/admin/email/branding" && method === "PUT") {
    const body = await readBody(req);
    db.settings.emailBranding = {
      ...(db.settings.emailBranding || {}),
      name: String(body.name || "Cine Cruzeiro").trim().slice(0, 80),
      logoUrl: normalizeEmailLogoUrl(String(body.logoUrl || "").trim().slice(0, 1000)),
      tagline: String(body.tagline || "").trim().slice(0, 180),
      footer: String(body.footer || "").trim().slice(0, 400),
      socialLinks: Array.isArray(body.socialLinks) ? body.socialLinks.slice(0, 5).map((item) => ({ label: String(item.label || "").trim().slice(0, 30), url: String(item.url || "").trim().slice(0, 500) })) : (db.settings.emailBranding.socialLinks || [])
    };
    if (postgresEnabled()) {
      await settingsRepository.updateSection("emailBranding", db.settings.emailBranding, {
        audit: repositoryAudit(req, "settings", "emailBranding", null, db.settings.emailBranding)
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { branding: db.settings.emailBranding });
    return true;
  }
  if (pathname === "/api/admin/email/attachments" && method === "POST") {
    const body = await readBody(req);
    const attachment = await storeEmailAttachment(body);
    db.settings.emailAttachments ||= [];
    db.settings.emailAttachments.unshift(attachment);
    db.settings.emailAttachments = db.settings.emailAttachments.slice(0, 100);
    if (postgresEnabled()) await settingsRepository.prependArrayItem("emailAttachments", attachment, 100);
    else await writeDb(db);
    const { path: privatePath, ...safeAttachment } = attachment;
    sendJson(res, 201, { attachment: safeAttachment });
    return true;
  }
  if (pathname === "/api/admin/email/campaigns" && method === "GET") {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const statusGroups = {
      drafts: ["draft"], scheduled: ["scheduled"], processing: ["queued", "sending"],
      completed: ["completed"], errors: ["completed_with_errors", "failed"], cancelled: ["cancelled"]
    };
    const status = params.get("status") || "";
    const result = await listPersistedCampaigns({
      page: params.get("page"), pageSize: params.get("pageSize"),
      statuses: statusGroups[status] || (status ? [status] : []),
      templateId: params.get("template") || "", origin: params.get("origin") || "",
      creator: params.get("creator") || "", from: params.get("from") || "", to: params.get("to") || "",
      item: String(params.get("item") || "").slice(0, 180), order: params.get("order") || "desc",
      search: String(params.get("search") || "").slice(0, 160)
    });
    sendJson(res, 200, { ...result, campaigns: result.campaigns.map(publicCampaign) });
    return true;
  }

  if (pathname === "/api/admin/email/campaigns/preview" && method === "POST") {
    const body = await readBody(req);
    const eligibility = eligibleCampaignRecipients(db, body);
    const recipients = eligibility.recipients;
    sendJson(res, 200, {
      count: recipients.length,
      sample: recipients.slice(0, 8).map(({ id, name, email, hasPurchased }) => ({ id, name, email, hasPurchased })),
      suppressed: campaignCustomerPool(db).length - recipients.length,
      eligibility: eligibility.report,
      templateResolution: eligibility.templateResolution
    });
    return true;
  }

  if (pathname === "/api/admin/email/campaigns/test" && method === "POST") {
    const body = await readBody(req);
    body.attachments = resolveCampaignAttachments(db, body.attachments);
    validateCampaignAttachmentTotal(body.attachments);
    const to = String(body.to || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      sendJson(res, 400, { error: { code: "EMAIL_TEST_INVALID", message: "Informe um endereço válido para o teste." } });
      return true;
    }
    const emailConfig = integrationConfigService.resolvedConfig(db, "email");
    if (!(emailConfig?.enabled && emailConfig?.configured)) {
      sendJson(res, 412, { error: { code: "EMAIL_CHANNEL_NOT_CONFIGURED", message: "Configure e ative o SMTP ou webhook de e-mail em Integrações antes do teste." } });
      return true;
    }
    const campaign = normalizeCampaignInput(body, { brand: db.settings?.emailBranding || {} });
    const eligibility = eligibleCampaignRecipients(db, campaign);
    applyCampaignTemplateResolution(campaign, eligibility.templateResolution);
    const result = await emailService.sendPromotionTest(db, {
      ...campaign,
      to,
      logoUrl: normalizeEmailLogoUrl(campaign.brand?.logoUrl),
      brand: normalizeEmailBrand(campaign.brand || db.settings?.emailBranding || {}),
      siteUrl: appFrontendUrl()
    });
    sendJson(res, result.sent ? 200 : 502, { ok: result.sent > 0, ...result });
    return true;
  }

  if (pathname === "/api/admin/email/campaigns" && method === "POST") {
    const body = await readBody(req);
    body.attachments = resolveCampaignAttachments(db, body.attachments);
    validateCampaignAttachmentTotal(body.attachments);
    const campaign = normalizeCampaignInput(body, { brand: body.brand || db.settings?.emailBranding || {} });
    if (!campaign.subject || !String(campaign.html || campaign.message || "").trim()) {
      sendJson(res, 400, { error: { code: "EMAIL_CAMPAIGN_INVALID", message: "Informe o assunto e o conteúdo da campanha." } });
      return true;
    }
    const shouldSend = body.action === "send" || body.sendNow === true;
    const shouldSchedule = Boolean(campaign.scheduleAt && new Date(campaign.scheduleAt).getTime() > Date.now());
    const eligibility = eligibleCampaignRecipients(db, campaign);
    applyCampaignTemplateResolution(campaign, eligibility.templateResolution);
    campaign.status = shouldSchedule ? "scheduled" : shouldSend ? "queued" : "draft";
    campaign.createdBy = req.adminUser?.id || "";
    campaign.recipientCount = eligibility.recipients.length;
    campaign.eligibility = eligibility.report;
    if (["queued", "scheduled"].includes(campaign.status)) {
      campaign.queuedAt = new Date().toISOString();
      if (!eligibility.recipients.length) {
        sendJson(res, 409, { error: { code: "NO_EMAIL_RECIPIENTS", message: "Nenhum destinatário pode usar a oferta desta campanha." } });
        return true;
      }
    }
    const persisted = await createPersistedCampaign(campaign);
    if (persisted.created && postgresEnabled() && ["queued", "scheduled"].includes(campaign.status)) {
      await emailCampaignRepository.snapshotRecipients(campaign.id, eligibility.recipients);
    }
    logEvent("info", "email_campaign.created", { campaignId: persisted.campaign.id, actorUserId: req.adminUser?.id || "", status: persisted.campaign.status, idempotent: !persisted.created });
    if (persisted.created && persisted.campaign.status === "scheduled") {
      logEvent("info", "email_campaign.scheduled", { campaignId: persisted.campaign.id, actorUserId: req.adminUser?.id || "", scheduleAt: persisted.campaign.scheduleAt });
    }
    if (persisted.created && persisted.campaign.status === "queued") {
      logEvent("info", "email_campaign.queued", { campaignId: persisted.campaign.id, actorUserId: req.adminUser?.id || "", recipients: eligibility.recipients.length });
    }
    sendJson(res, persisted.created ? 201 : 200, { campaign: publicCampaign(persisted.campaign), queued: persisted.campaign.status === "queued", idempotent: !persisted.created });
    return true;
  }

  if (emailCampaignMatch && emailCampaignMatch[1]) {
    const campaignId = decodeURIComponent(emailCampaignMatch[1]);
    const action = emailCampaignMatch[2] || "";
    const existing = await findPersistedCampaign(campaignId);
    if (!existing) {
      sendJson(res, 404, { error: { code: "EMAIL_CAMPAIGN_NOT_FOUND", message: "Campanha não encontrada." } });
      return true;
    }
    if (action === "recipients" && method === "GET") {
      if (!postgresEnabled()) {
        sendJson(res, 200, { recipients: [], page: 1, pages: 1, pageSize: 25, total: 0 });
        return true;
      }
      const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
      sendJson(res, 200, await emailCampaignRepository.listRecipients(campaignId, { page: params.get("page"), pageSize: params.get("pageSize"), status: params.get("status") || "" }));
      return true;
    }
    if (!action && method === "GET") {
      sendJson(res, 200, { campaign: campaignDetails(existing) });
      return true;
    }
    if ((!action || action === "delete") && method === "DELETE") {
      if (!["draft", "failed", "cancelled"].includes(existing.status)) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_DELETE_LOCKED", message: "Só rascunhos, campanhas com falha ou canceladas podem ser excluídos." } });
        return true;
      }
      if (!(await deletePersistedCampaign(campaignId))) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_DELETE_LOCKED", message: "A campanha mudou de estado e não pode mais ser excluída." } });
        return true;
      }
      await removeAutoCampaignCoupon(campaignId, existing.autoCouponId || existing.couponId).catch((error) => {
        logEvent("warn", "email_campaign.auto_coupon_cleanup_failed", { campaignId, error: error.message });
      });
      logEvent("info", "email_campaign.deleted", { campaignId, actorUserId: req.adminUser?.id || "" });
      sendJson(res, 200, { deleted: true, id: campaignId });
      return true;
    }
    if (action === "cancel" && method === "POST") {
      let cancelled;
      if (postgresEnabled()) cancelled = await emailCampaignRepository.transitionCampaign(campaignId, "cancelled", { from: ["scheduled", "queued", "sending"] });
      else {
        existing.status = "cancelled";
        existing.cancelledAt = new Date().toISOString();
        cancelled = await updatePersistedCampaign(campaignId, existing, ["scheduled", "queued", "sending"]);
      }
      if (!cancelled) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_STATE", message: "Esta campanha não pode ser cancelada no estado atual." } });
        return true;
      }
      const linkedCoupon = (db.promotions || []).find((item) => item.autoManagedByCampaign === true && String(item.sourceCampaignId || "") === String(campaignId));
      if (linkedCoupon) await persistAutoCampaignCoupon({ ...linkedCoupon, active: false, autoCouponActivationScheduled: false, updatedAt: new Date().toISOString() });
      logEvent("info", "email_campaign.cancelled", { campaignId, actorUserId: req.adminUser?.id || "" });
      sendJson(res, 200, { campaign: publicCampaign(cancelled) });
      return true;
    }
    if (action === "send" && method === "POST") {
      if (!["draft", "failed"].includes(existing.status)) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_STATE", message: "Só campanhas em rascunho ou com falha podem ser enviadas." } });
        return true;
      }
      const emailConfig = integrationConfigService.resolvedConfig(db, "email");
      if (!(emailConfig?.enabled && emailConfig?.configured)) {
        sendJson(res, 412, { error: { code: "EMAIL_CHANNEL_NOT_CONFIGURED", message: "Configure e ative o SMTP ou webhook de e-mail em Integrações antes do disparo." } });
        return true;
      }
      const autoCouponIndex = (db.promotions || []).findIndex((item) => item.autoManagedByCampaign === true && String(item.sourceCampaignId || "") === String(existing.id));
      let autoCouponUpdate = null;
      if (autoCouponIndex >= 0) {
        const scheduleAt = existing.scheduleAt && new Date(existing.scheduleAt).getTime() > Date.now() ? existing.scheduleAt : "";
        autoCouponUpdate = armCampaignCoupon(db.promotions[autoCouponIndex], { ...existing, scheduleAt }, new Date());
        db.promotions[autoCouponIndex] = autoCouponUpdate;
      }
      const eligibility = eligibleCampaignRecipients(db, existing);
      applyCampaignTemplateResolution(existing, eligibility.templateResolution);
      if (!eligibility.recipients.length) {
        sendJson(res, 409, { error: { code: "NO_EMAIL_RECIPIENTS", message: "Nenhum destinatário pode usar a oferta desta campanha." } });
        return true;
      }
      if (autoCouponUpdate) await persistAutoCampaignCoupon(autoCouponUpdate);
      const targetStatus = existing.scheduleAt && new Date(existing.scheduleAt).getTime() > Date.now() ? "scheduled" : "queued";
      let queued;
      if (postgresEnabled()) {
        await emailCampaignRepository.snapshotRecipients(campaignId, eligibility.recipients);
        queued = await emailCampaignRepository.transitionCampaign(campaignId, targetStatus, { from: ["draft", "failed"] });
      } else {
        existing.status = targetStatus;
        existing.error = "";
        existing.recipientCount = eligibility.recipients.length;
        existing.eligibility = eligibility.report;
        queued = await updatePersistedCampaign(campaignId, existing);
      }
      logEvent("info", targetStatus === "scheduled" ? "email_campaign.scheduled" : "email_campaign.queued", { campaignId, actorUserId: req.adminUser?.id || "", recipients: eligibility.recipients.length, scheduleAt: existing.scheduleAt || "" });
      sendJson(res, 202, { campaign: publicCampaign(queued || existing) });
      return true;
    }
    if (action === "retry-failures" && method === "POST") {
      if (!postgresEnabled()) {
        sendJson(res, 409, { error: { code: "POSTGRES_REQUIRED", message: "O reenvio seletivo requer o armazenamento PostgreSQL." } });
        return true;
      }
      const retry = await emailCampaignRepository.retryFailures(campaignId);
      if (!retry || !retry.retried) {
        sendJson(res, 409, { error: { code: "NO_RETRYABLE_RECIPIENTS", message: "Não há falhas confirmadas e seguras para reenviar. Resultados incertos exigem revisão manual." } });
        return true;
      }
      logEvent("info", "email_campaign.failures_requeued", { campaignId, actorUserId: req.adminUser?.id || "", recipients: retry.retried });
      sendJson(res, 202, { campaign: publicCampaign(retry.campaign), retried: retry.retried });
      return true;
    }
    if (action === "duplicate" && method === "POST") {
      const legacyMessage = existing.legacyReadOnly && !String(existing.message || "").trim()
        ? (existing.contentBlocks || [])
          .filter((block) => ["heading", "text", "kicker", "signature"].includes(block.type))
          .map((block) => String(block.content || "").trim())
          .filter(Boolean)
          .join("\n\n")
        : existing.message;
      const duplicate = normalizeCampaignInput({
        ...existing,
        mode: existing.legacyReadOnly ? "template" : existing.mode,
        message: legacyMessage,
        id: `campanha-email-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        idempotencyKey: "",
        subject: `${existing.subject || "Campanha"} - cópia`,
        scheduleAt: ""
      }, {});
      Object.assign(duplicate, { status: "draft", createdBy: req.adminUser?.id || "", createdAt: new Date().toISOString(), sent: 0, failed: 0, processed: 0, recipientCount: 0, completedAt: "", startedAt: "" });
      duplicate.recipientCount = campaignRecipients(db, duplicate).length;
      const persisted = await createPersistedCampaign(duplicate);
      logEvent("info", "email_campaign.duplicated", { campaignId: persisted.campaign.id, sourceCampaignId: campaignId, actorUserId: req.adminUser?.id || "" });
      sendJson(res, 201, { campaign: publicCampaign(persisted.campaign) });
      return true;
    }
    if (method === "PUT") {
      if (!["draft", "failed"].includes(existing.status)) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_LOCKED", message: "Campanhas enviadas ou em processamento não podem ser editadas." } });
        return true;
      }
      if (existing.legacyReadOnly) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_LEGACY_READ_ONLY", message: "Este rascunho usa o editor visual antigo. Duplique-o para converter ao modelo atual sem perder o conteúdo original." } });
        return true;
      }
      const body = await readBody(req);
      body.attachments = resolveCampaignAttachments(db, body.attachments);
      validateCampaignAttachmentTotal(body.attachments);
      const updated = normalizeCampaignInput(body, existing);
      const autoCouponIndex = (db.promotions || []).findIndex((item) => item.autoManagedByCampaign === true && String(item.sourceCampaignId || "") === String(updated.id));
      let autoCouponUpdate = null;
      if (autoCouponIndex >= 0 && String(updated.scheduleAt || "") !== String(existing.scheduleAt || "")) {
        autoCouponUpdate = {
          ...syncCampaignCouponSchedule(db.promotions[autoCouponIndex], updated),
          active: false,
          autoCouponActivationScheduled: false
        };
        db.promotions[autoCouponIndex] = autoCouponUpdate;
      }
      const eligibility = eligibleCampaignRecipients(db, updated);
      applyCampaignTemplateResolution(updated, eligibility.templateResolution);
      updated.status = "draft";
      updated.recipientCount = eligibility.recipients.length;
      updated.eligibility = eligibility.report;
      const persisted = await updatePersistedCampaign(campaignId, updated);
      if (!persisted) {
        sendJson(res, 409, { error: { code: "EMAIL_CAMPAIGN_LOCKED", message: "A campanha mudou de estado e não pode mais ser editada." } });
        return true;
      }
      if (autoCouponUpdate) await persistAutoCampaignCoupon(autoCouponUpdate);
      logEvent("info", "email_campaign.updated", {
        campaignId,
        actorUserId: req.adminUser?.id || "",
        changed: ["subject", "templateId", "recipientMode", "couponId", "movieId", "concessionIds", "clubPlanId", "scheduleAt"]
          .filter((key) => JSON.stringify(existing[key] ?? null) !== JSON.stringify(updated[key] ?? null))
      });
      sendJson(res, 200, { campaign: publicCampaign(persisted) });
      return true;
    }
  }
    return false;
  };
}

module.exports = { createAdminEmailRoutes };
