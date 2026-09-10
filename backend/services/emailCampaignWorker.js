const crypto = require("crypto");

function positiveInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function createEmailCampaignWorker(options = {}) {
  const repository = options.repository;
  const readDb = options.readDb;
  const resolveAudience = options.resolveAudience;
  const deliver = options.deliver;
  const decorateRecipient = options.decorateRecipient || ((recipient) => recipient);
  const log = options.log || (() => {});
  const workerId = options.workerId || `email-worker-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  const pollMs = positiveInteger(options.pollMs ?? process.env.EMAIL_CAMPAIGN_POLL_MS, 5000, 1000, 60000);
  const leaseMs = positiveInteger(options.leaseMs ?? process.env.EMAIL_CAMPAIGN_LEASE_MS, 120000, 30000, 900000);
  const batchSize = positiveInteger(options.batchSize ?? process.env.EMAIL_CAMPAIGN_BATCH_SIZE, 20, 1, 100);
  const maxAttempts = positiveInteger(options.maxAttempts ?? process.env.EMAIL_CAMPAIGN_MAX_ATTEMPTS, 3, 1, 5);
  const concurrency = positiveInteger(options.concurrency ?? process.env.EMAIL_CAMPAIGN_CONCURRENCY, 2, 1, 10);
  let timer = null;
  let running = false;
  let stopped = true;

  async function processRecipient(db, campaign, recipient, audienceByKey) {
    const source = audienceByKey.get(recipient.customerId) || audienceByKey.get(recipient.email) || recipient;
    const personalized = await decorateRecipient(db, campaign, { ...source, ...recipient });
    const attempt = await repository.startAttempt(recipient, "smtp");
    let outcome;
    try {
      outcome = await deliver(db, campaign, personalized, {
        campaignId: campaign.id,
        recipientId: recipient.id,
        recipientKey: recipient.recipientKey,
        deliveryId: recipient.deliveryId,
        attemptId: attempt.id,
        templateId: campaign.templateId
      });
    } catch (error) {
      outcome = {
        status: "unknown",
        provider: "unknown",
        errorCode: "DELIVERY_UNCAUGHT_ERROR",
        errorMessage: String(error?.message || "Falha sem confirmação do provedor.").slice(0, 1000)
      };
    }
    if (outcome.status === "retryable_failed" && recipient.attemptCount >= maxAttempts) {
      outcome = { ...outcome, status: "failed", retryable: true, errorCode: outcome.errorCode || "RETRY_LIMIT_REACHED" };
    }
    await repository.completeAttempt({ recipient, attemptId: attempt.id, outcome });
    log(outcome.status === "sent" ? "info" : "warn", "email_campaign.delivery_finished", {
      campaignId: campaign.id,
      recipientId: recipient.id,
      deliveryId: recipient.deliveryId,
      attemptId: attempt.id,
      workerId,
      provider: outcome.provider,
      status: outcome.status,
      errorCode: outcome.errorCode || ""
    });
  }

  async function processCampaign(campaign) {
    let db = await readDb();
    let audience;
    try {
      audience = resolveAudience(db, campaign);
      if (!audience.recipients.length) throw new Error("Nenhum destinatário elegível com consentimento de marketing.");
      await repository.snapshotRecipients(campaign.id, audience.recipients);
    } catch (error) {
      const failed = await repository.failCampaign(campaign.id, workerId, error.message);
      log("error", "email_campaign.audience_failed", { campaignId: campaign.id, workerId, message: error.message });
      if (failed) log("warn", `email_campaign.${failed.status}`, { campaignId: campaign.id, workerId, sent: failed.sent, failed: failed.failed });
      return;
    }

    const audienceByKey = new Map();
    audience.recipients.forEach((recipient) => {
      if (recipient.id) audienceByKey.set(String(recipient.id), recipient);
      if (recipient.email) audienceByKey.set(String(recipient.email).toLowerCase(), recipient);
    });

    while (!stopped) {
      const current = await repository.getCampaign(campaign.id);
      if (!current || current.status === "cancelled") return;
      if (!(await repository.heartbeatCampaign(campaign.id, workerId))) return;
      try {
        db = await readDb();
        audience = resolveAudience(db, current);
        if (!audience.recipients.length) throw new Error("Nenhum destinatário continua elegível para esta campanha.");
        await repository.snapshotRecipients(campaign.id, audience.recipients);
        audienceByKey.clear();
        audience.recipients.forEach((recipient) => {
          if (recipient.id) audienceByKey.set(String(recipient.id), recipient);
          if (recipient.email) audienceByKey.set(String(recipient.email).toLowerCase(), recipient);
        });
      } catch (error) {
        const failed = await repository.failCampaign(campaign.id, workerId, error.message);
        log("error", "email_campaign.revalidation_failed", { campaignId: campaign.id, workerId, message: error.message, status: failed?.status || "failed" });
        return;
      }
      const recipients = await repository.claimRecipients(campaign.id, workerId, batchSize, maxAttempts);
      if (!recipients.length) {
        const final = await repository.reconcileCampaign(campaign.id, workerId);
        if (final?.status === "sending") {
          const deferred = await repository.deferCampaign(campaign.id, workerId);
          log("info", "email_campaign.retry_deferred", { campaignId: campaign.id, workerId, scheduleAt: deferred?.scheduleAt || "" });
        } else if (final) {
          log(final.status === "completed" ? "info" : "warn", `email_campaign.${final.status}`, {
            campaignId: campaign.id,
            workerId,
            processed: final.processed,
            sent: final.sent,
            failed: final.failed
          });
        }
        return;
      }
      for (let index = 0; index < recipients.length; index += concurrency) {
        const currentCampaign = await repository.getCampaign(campaign.id);
        if (!currentCampaign || currentCampaign.status === "cancelled") return;
        await Promise.all(recipients.slice(index, index + concurrency).map((recipient) => processRecipient(db, currentCampaign, recipient, audienceByKey)));
        await repository.heartbeatCampaign(campaign.id, workerId);
      }
      const status = await repository.reconcileCampaign(campaign.id, workerId);
      if (!status || status.status !== "sending") {
        if (status) log(status.status === "completed" ? "info" : "warn", `email_campaign.${status.status}`, {
          campaignId: campaign.id,
          workerId,
          processed: status.processed,
          sent: status.sent,
          failed: status.failed
        });
        return;
      }
    }
  }

  async function tick() {
    if (running || stopped) return;
    running = true;
    try {
      const campaign = await repository.claimCampaign(workerId, leaseMs);
      if (campaign) {
        log("info", "email_campaign.claimed", { campaignId: campaign.id, workerId });
        await processCampaign(campaign);
      }
    } catch (error) {
      log("error", "email_campaign.worker_failed", { workerId, message: error.message });
    } finally {
      running = false;
    }
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    timer = setInterval(() => { void tick(); }, pollMs);
    timer.unref?.();
    void tick();
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, tick, processCampaign, workerId, config: { pollMs, leaseMs, batchSize, maxAttempts, concurrency } };
}

module.exports = { createEmailCampaignWorker, _test: { positiveInteger } };
