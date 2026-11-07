"use strict";

function createAdminIntegrationRoutes({
  activeOnlinePaymentProvider,
  activeWebhookBatchJob,
  adminIntegrationsStatus,
  configureCrmWebhookWorker,
  configureDiscordWebhook,
  createCrmOutboxRepository,
  createWebhookBatchJob,
  ensureAdmin,
  getCrmWebhookWorker,
  integrationConfigService,
  isProduction,
  logEvent,
  outsidePostgresTransaction,
  postgresEnabled,
  readBody,
  readDb,
  repositoryAudit,
  roleAlias,
  runMercadoPagoWebhookSimulation,
  runWebhookBatchJob,
  sendJson,
  settingsRepository,
  testIntegrationProvider,
  webhookBatchJobSnapshot,
  webhookBatchJobs,
  webhookTesterEnabled,
  withCriticalMutation,
  writeDb,
}) {
  return async function handleAdminIntegrationRoute({ req, res, pathname, method, db }) {
  if (["/api/payments/config", "/api/payments/config/mercado-pago"].includes(pathname) && method === "GET") {
    const active = activeOnlinePaymentProvider(db);
    const config = active.config;
    const environment = active.provider === "mercado_pago"
      ? "production"
      : config?.environment === "production" ? "production" : "sandbox";
    sendJson(res, 200, {
      provider: active.provider,
      name: active.name,
      enabled: Boolean(config?.enabled),
      configured: Boolean(config?.configured),
      publicKey: config?.publicKey || "",
      environment,
      livePayments: !isProduction() || environment === "production",
      checkoutAvailable: !isProduction() || environment === "production"
        || (active.provider === "pag_bank" && environment === "sandbox"),
    }, { "Cache-Control": "no-store" });
    return true;
  }

  if ((pathname === "/api/integrations" || pathname === "/api/admin/integrations") && method === "GET") {
    sendJson(res, 200, { integrations: adminIntegrationsStatus(req, db) });
    return true;
  }

  const webhookSimulationBase = "/api/admin/integrations/mercadoPago/webhook-simulations";
  if (pathname === webhookSimulationBase && method === "GET") {
    sendJson(res, 200, {
      enabled: webhookTesterEnabled(),
      runs: (db.settings?.webhookSimulatorRuns || []).slice(0, 60),
      activeBatch: activeWebhookBatchJob() ? webhookBatchJobSnapshot(activeWebhookBatchJob()) : null
    });
    return true;
  }

  if (pathname === webhookSimulationBase && method === "POST") {
    const body = await readBody(req);
    const run = await runMercadoPagoWebhookSimulation(body);
    sendJson(res, 200, { run });
    return true;
  }

  if (pathname === `${webhookSimulationBase}/batch` && method === "POST") {
    const activeJob = activeWebhookBatchJob();
    if (activeJob) {
      sendJson(res, 409, { error: { code: "WEBHOOK_BATCH_IN_PROGRESS", message: "Já existe uma bateria de webhooks em execução." }, job: webhookBatchJobSnapshot(activeJob) });
      return true;
    }
    const job = createWebhookBatchJob();
    sendJson(res, 202, { job: webhookBatchJobSnapshot(job) });
    setImmediate(() => {
      outsidePostgresTransaction(() => { void runWebhookBatchJob(job); });
    });
    return true;
  }

  const webhookBatchStatusMatch = pathname.match(/^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations\/batch\/([^/]+)$/);
  if (webhookBatchStatusMatch && method === "GET") {
    const job = webhookBatchJobs.get(decodeURIComponent(webhookBatchStatusMatch[1]));
    if (!job) {
      sendJson(res, 404, { error: { code: "WEBHOOK_BATCH_NOT_FOUND", message: "A bateria de webhooks não está mais disponível." } });
      return true;
    }
    sendJson(res, 200, { job: webhookBatchJobSnapshot(job) });
    return true;
  }

  const webhookSimulationResendMatch = pathname.match(/^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations\/([^/]+)\/resend$/);
  if (webhookSimulationResendMatch && method === "POST") {
    const runId = decodeURIComponent(webhookSimulationResendMatch[1]);
    const source = (db.settings?.webhookSimulatorRuns || []).find((item) => item.id === runId);
    if (!source) {
      sendJson(res, 404, { error: { code: "WEBHOOK_SIMULATION_NOT_FOUND", message: "Simulação não encontrada no histórico." } });
      return true;
    }
    const replay = await runMercadoPagoWebhookSimulation({
      scenario: "duplicate",
      action: source.action,
      status: source.payload?.data?.status === "action_required" ? "action_required" : source.payload?.data?.status || "processed",
      amount: source.payload?.data?.total_amount || 10,
      resourceId: source.resourceId,
      externalReference: source.externalReference,
      requestId: source.requestId,
      timestamp: source.replay?.timestamp || Math.floor(Date.now() / 1000)
    });
    sendJson(res, 200, { run: replay });
    return true;
  }

  if (pathname === "/api/admin/integrations/commercialCatalog/access-token" && method === "GET") {
    if (roleAlias(req.adminUser?.role) !== "owner") {
      sendJson(res, 403, { error: { code: "COMMERCIAL_CATALOG_TOKEN_FORBIDDEN", message: "Somente o proprietário pode revelar o token do catálogo comercial." } }, { "Cache-Control": "no-store" });
      return true;
    }
    const catalogConfig = integrationConfigService.resolvedConfig(db, "commercialCatalog") || {};
    if (!catalogConfig.accessToken) {
      sendJson(res, 404, { error: { code: "COMMERCIAL_CATALOG_TOKEN_NOT_CONFIGURED", message: "Nenhum token foi configurado para o catálogo comercial." } }, { "Cache-Control": "no-store" });
      return true;
    }
    logEvent("warn", "integration.commercial_catalog.token_revealed", { actorUserId: req.adminUser.id });
    sendJson(res, 200, { token: catalogConfig.accessToken }, { "Cache-Control": "no-store" });
    return true;
  }

  if (pathname === "/api/admin/integrations/crm/outbox" && method === "GET") {
    if (!ensureAdmin(req, res, db, pathname, method)) return true;
    sendJson(res, 200, { outbox: await createCrmOutboxRepository().summary() });
    return true;
  }

  if (pathname === "/api/admin/integrations/crm/outbox/retry-dead" && method === "POST") {
    if (!ensureAdmin(req, res, db, pathname, method)) return true;
    const count = await createCrmOutboxRepository().retryDead();
    getCrmWebhookWorker().wake();
    logEvent("warn", "crm_webhook.dead_letters_requeued", { count, actorUserId: req.adminUser?.id || "" });
    sendJson(res, 200, { count, outbox: await createCrmOutboxRepository().summary() });
    return true;
  }

  const adminIntegrationMatch = pathname.match(/^\/api\/admin\/integrations\/([^/]+)(?:\/(test|enable|disable))?$/);
  if (adminIntegrationMatch) {
    const key = integrationConfigService.providerKey(decodeURIComponent(adminIntegrationMatch[1]));
    const action = adminIntegrationMatch[2] || "";
    if (!key) {
      sendJson(res, 404, { error: { code: "INTEGRATION_NOT_FOUND", message: "Integração não encontrada." } });
      return true;
    }
    if (method === "GET" && !action) {
      const integration = integrationConfigService.sanitizeConfig(db, key);
      if (key === "crm") integration.outbox = await createCrmOutboxRepository().summary();
      sendJson(res, 200, { integration });
      return true;
    }
    if (method === "PUT" && !action) {
      const body = await readBody(req);
      if (postgresEnabled()) {
        const before = integrationConfigService.sanitizeConfig(db, key);
        const saved = integrationConfigService.save(db, key, body, req.adminUser);
        const payloadToPersist = db.integrations?.[key] || db.settings?.integrations?.[key] || {};
        await settingsRepository.updateSectionKey("integrations", key, payloadToPersist, {
          audit: repositoryAudit(req, "integration", key, before, saved)
        });
        if (key === "discord") configureDiscordWebhook(db);
        if (key === "crm") configureCrmWebhookWorker(db);
        sendJson(res, 200, { integration: saved });
      } else {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const saved = integrationConfigService.save(lockedDb, key, body, req.adminUser);
          await writeDb(lockedDb);
          if (key === "discord") configureDiscordWebhook(lockedDb);
          if (key === "crm") configureCrmWebhookWorker(lockedDb);
          sendJson(res, 200, { integration: saved });
        });
      }
      return true;
    }
    if (method === "POST" && ["enable", "disable"].includes(action)) {
      if (postgresEnabled()) {
        const before = integrationConfigService.sanitizeConfig(db, key);
        const saved = integrationConfigService.setEnabled(db, key, action === "enable", req.adminUser);
        const payloadToPersist = db.integrations?.[key] || db.settings?.integrations?.[key] || {};
        await settingsRepository.updateSectionKey("integrations", key, payloadToPersist, {
          audit: repositoryAudit(req, "integration", key, before, saved)
        });
        if (key === "discord") configureDiscordWebhook(db);
        if (key === "crm") configureCrmWebhookWorker(db);
        sendJson(res, 200, { integration: saved });
      } else {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const saved = integrationConfigService.setEnabled(lockedDb, key, action === "enable", req.adminUser);
          await writeDb(lockedDb);
          if (key === "discord") configureDiscordWebhook(lockedDb);
          if (key === "crm") configureCrmWebhookWorker(lockedDb);
          sendJson(res, 200, { integration: saved });
        });
      }
      return true;
    }
    if (method === "POST" && action === "test") {
      const result = await testIntegrationProvider(db, key, req);
      if (postgresEnabled()) {
        const before = integrationConfigService.sanitizeConfig(db, key);
        if (key === "googleWallet" && result.ok && result.resolvedClassId) {
          if (db.integrations?.googleWallet) db.integrations.googleWallet.resolvedClassId = result.resolvedClassId;
          if (db.settings?.integrations?.googleWallet) db.settings.integrations.googleWallet.resolvedClassId = result.resolvedClassId;
        }
        const saved = integrationConfigService.setTestResult(db, key, result, req.adminUser);
        const payloadToPersist = db.integrations?.[key] || db.settings?.integrations?.[key] || {};
        await settingsRepository.updateSectionKey("integrations", key, payloadToPersist, {
          audit: repositoryAudit(req, "integration", key, before, saved)
        });
        sendJson(res, 200, { ...result, integration: saved });
      } else {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          if (key === "googleWallet" && result.ok && result.resolvedClassId) {
            if (lockedDb.integrations?.googleWallet) lockedDb.integrations.googleWallet.resolvedClassId = result.resolvedClassId;
            if (lockedDb.settings?.integrations?.googleWallet) lockedDb.settings.integrations.googleWallet.resolvedClassId = result.resolvedClassId;
          }
          const saved = integrationConfigService.setTestResult(lockedDb, key, result, req.adminUser);
          await writeDb(lockedDb);
          sendJson(res, 200, { ...result, integration: saved });
        });
      }
      return true;
    }
  }

  if (pathname === "/api/integrations/test" && method === "POST") {
    const body = await readBody(req);
    const statuses = adminIntegrationsStatus(req, db);
    const key = String(body.integration || "").trim();
    const item = statuses[key];
    if (!item) {
      sendJson(res, 404, { error: { code: "INTEGRATION_NOT_FOUND", message: "Integracao nao encontrada." } });
      return true;
    }
    const result = await testIntegrationProvider(db, key, req);
    sendJson(res, 200, { ...result, configured: Boolean(item.configured), integration: key });
    return true;
  }
    return false;
  };
}

module.exports = { createAdminIntegrationRoutes };
