const crypto = require("crypto");
const { queryPostgres, withPostgresTransaction } = require("../db/postgresStore");

const CAMPAIGN_STATES = Object.freeze({
  draft: new Set(["scheduled", "queued"]),
  scheduled: new Set(["queued", "cancelled"]),
  queued: new Set(["sending", "cancelled"]),
  sending: new Set(["completed", "completed_with_errors", "failed", "cancelled"]),
  failed: new Set(["queued", "cancelled"]),
  completed_with_errors: new Set(["queued"]),
  completed: new Set(),
  cancelled: new Set()
});

const LIST_CAMPAIGN_COLUMNS = `
  id, subject, preheader, headline, template_id, mode, recipient_mode, recipient_search,
  coupon_id, movie_id, concession_id, concession_ids, club_plan_id, club_offer,
  status, schedule_at, created_by, created_at, updated_at, queued_at, started_at,
  completed_at, cancelled_at, failure_reason, requested_recipient_count,
  eligible_recipient_count, processed_count, sent_count, failed_count,
  delivered_count, bounced_count, opened_count, clicked_count, ai_metadata,
  eligibility_snapshot, worker_id, heartbeat_at,
  (html <> '') AS has_html, (message <> '') AS has_message,
  (legacy_content IS NOT NULL) AS has_blocks`;

function transitionAllowed(from, to) {
  return from === to || Boolean(CAMPAIGN_STATES[from]?.has(to));
}

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function campaignFromRow(row = {}) {
  const ai = row.ai_metadata || {};
  const legacy = row.legacy_content || {};
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key || "",
    subject: row.subject || "",
    preheader: row.preheader || "",
    kicker: row.kicker || "",
    headline: row.headline || "",
    message: row.message || "",
    html: row.html || "",
    templateId: row.template_id || "announcement",
    mode: row.mode === "legacy_visual" ? "legacy_visual" : row.mode || "template",
    recipientMode: row.recipient_mode || "all",
    recipientSearch: row.recipient_search || "",
    customerIds: Array.isArray(row.selected_customer_ids) ? row.selected_customer_ids.map(String) : [],
    reactivationDays: Number(row.reactivation_days || 90),
    couponId: row.coupon_id || "",
    movieId: row.movie_id || "",
    movieIds: Array.isArray(ai.movieIds) ? ai.movieIds.map(String) : (row.movie_id ? [String(row.movie_id)] : []),
    concessionId: row.concession_id || "",
    concessionIds: Array.isArray(row.concession_ids) ? row.concession_ids : [],
    clubPlanId: row.club_plan_id || "",
    clubOffer: row.club_offer || "",
    imageUrl: row.image_url || "",
    imageAlt: row.image_alt || "",
    imageLink: row.image_link || "",
    accentColor: row.accent_color || "#facc15",
    headlineColor: row.headline_color || "#ffffff",
    textColor: row.text_color || "#dbeafe",
    buttonColor: row.button_color || "#facc15",
    ctaLabel: row.cta_label || "",
    ctaUrl: row.cta_url || "",
    ctaButtons: Array.isArray(ai.ctaButtons) ? ai.ctaButtons : [],
    variables: row.variables || {},
    brand: row.brand_snapshot || {},
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    contentBlocks: Array.isArray(legacy.contentBlocks) ? legacy.contentBlocks : [],
    legacyReadOnly: row.mode === "legacy_visual",
    status: row.status || "draft",
    scheduleAt: iso(row.schedule_at),
    createdBy: row.created_by || "",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    queuedAt: iso(row.queued_at),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    error: row.failure_reason || "",
    recipientCount: Number(row.eligible_recipient_count || 0),
    requestedRecipientCount: Number(row.requested_recipient_count || 0),
    processed: Number(row.processed_count || 0),
    sent: Number(row.sent_count || 0),
    failed: Number(row.failed_count || 0),
    delivered: row.delivered_count === null ? null : Number(row.delivered_count),
    bounced: row.bounced_count === null ? null : Number(row.bounced_count),
    opened: row.opened_count === null ? null : Number(row.opened_count),
    clicked: row.clicked_count === null ? null : Number(row.clicked_count),
    aiGenerated: Boolean(ai.generated),
    aiProvider: ai.provider || "",
    aiProviderRequested: ai.requestedProvider || "",
    aiModel: ai.model || "",
    aiConfiguredModel: ai.configuredModel || "",
    aiModelResolutionReason: ai.modelResolutionReason || "",
    aiFallbackReason: ai.fallbackReason || "",
    aiFallbackMessage: ai.fallbackMessage || "",
    aiScenario: ai.scenario || "",
    objective: ai.objective || "",
    templateSelectionMode: ai.templateSelectionMode || "",
    templateReason: ai.templateReason || "",
    compatibleTemplates: Array.isArray(ai.compatibleTemplates) ? ai.compatibleTemplates : [],
    aiContext: ai.context || {},
    aiReferenceCampaignId: ai.referenceCampaignId || "",
    aiReferenceTemplateId: ai.referenceTemplateId || "",
    aiBrief: ai.brief || "",
    visualStyle: ai.visualStyle || "classic",
    visualStyleLabel: ai.visualStyleLabel || "",
    autoCouponId: ai.autoCouponId || "",
    aiMetadata: ai,
    eligibility: row.eligibility_snapshot || {},
    workerId: row.worker_id || "",
    heartbeatAt: iso(row.heartbeat_at),
    hasHtml: row.has_html === undefined ? Boolean(row.html) : Boolean(row.has_html),
    hasMessage: row.has_message === undefined ? Boolean(row.message) : Boolean(row.has_message),
    hasBlocks: row.has_blocks === undefined ? Boolean(legacy.contentBlocks?.length) : Boolean(row.has_blocks)
  };
}

function recipientFromRow(row = {}) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    customerId: row.customer_id || "",
    recipientKey: row.recipient_key,
    email: row.email,
    name: row.name_snapshot || "",
    deliveryId: row.delivery_id,
    status: row.status,
    suppressionReason: row.suppression_reason || "",
    eligibilityReason: row.eligibility_reason || "",
    attemptCount: Number(row.attempt_count || 0),
    manualRetryGranted: Boolean(row.manual_retry_granted),
    provider: row.provider || "",
    providerMessageId: row.provider_message_id || "",
    lastErrorCode: row.last_error_code || "",
    lastError: row.last_error || "",
    sentAt: iso(row.sent_at),
    failedAt: iso(row.failed_at),
    updatedAt: iso(row.updated_at)
  };
}

function campaignRecord(campaign = {}) {
  const aiMetadata = {
    ...(campaign.aiMetadata || {}),
    generated: Boolean(campaign.aiGenerated),
    provider: campaign.aiProvider || "",
    requestedProvider: campaign.aiProviderRequested || "",
    model: campaign.aiModel || "",
    configuredModel: campaign.aiConfiguredModel || "",
    modelResolutionReason: campaign.aiModelResolutionReason || "",
    fallbackReason: campaign.aiFallbackReason || "",
    fallbackMessage: campaign.aiFallbackMessage || "",
    scenario: campaign.aiScenario || "",
    context: campaign.aiContext || {},
    referenceCampaignId: campaign.aiReferenceCampaignId || "",
    referenceTemplateId: campaign.aiReferenceTemplateId || "",
    brief: campaign.aiBrief || "",
    visualStyle: campaign.visualStyle || campaign.aiMetadata?.visualStyle || "classic",
    visualStyleLabel: campaign.visualStyleLabel || campaign.aiMetadata?.visualStyleLabel || "",
    autoCouponId: campaign.autoCouponId || campaign.aiMetadata?.autoCouponId || "",
    objective: campaign.objective || campaign.aiMetadata?.objective || "",
    templateSelectionMode: campaign.templateSelectionMode || campaign.aiMetadata?.templateSelectionMode || "",
    templateReason: campaign.templateReason || campaign.aiMetadata?.templateReason || "",
    compatibleTemplates: campaign.compatibleTemplates || campaign.aiMetadata?.compatibleTemplates || [],
    movieIds: Array.isArray(campaign.movieIds) ? campaign.movieIds.map(String).slice(0, 20) : campaign.aiMetadata?.movieIds || [],
    ctaButtons: Array.isArray(campaign.ctaButtons) ? campaign.ctaButtons.slice(0, 3) : campaign.aiMetadata?.ctaButtons || []
  };
  return {
    id: campaign.id,
    idempotency_key: campaign.idempotencyKey || null,
    subject: campaign.subject || "",
    preheader: campaign.preheader || "",
    kicker: campaign.kicker || "",
    headline: campaign.headline || "",
    message: campaign.message || "",
    html: campaign.html || "",
    template_id: campaign.templateId || "announcement",
    mode: campaign.mode === "visual" ? "legacy_visual" : campaign.mode || "template",
    recipient_mode: campaign.recipientMode === "active" ? "recent" : campaign.recipientMode || "all",
    recipient_search: campaign.recipientSearch || "",
    selected_customer_ids: campaign.customerIds || [],
    reactivation_days: Number(campaign.reactivationDays || 90),
    coupon_id: campaign.couponId || "",
    movie_id: campaign.movieId || "",
    concession_id: campaign.concessionId || "",
    concession_ids: campaign.concessionIds || [],
    club_plan_id: campaign.clubPlanId || "",
    club_offer: campaign.clubOffer || "",
    image_url: campaign.imageUrl || "",
    image_alt: campaign.imageAlt || "",
    image_link: campaign.imageLink || "",
    accent_color: campaign.accentColor || "#facc15",
    headline_color: campaign.headlineColor || "#ffffff",
    text_color: campaign.textColor || "#dbeafe",
    button_color: campaign.buttonColor || "#facc15",
    cta_label: campaign.ctaLabel || "",
    cta_url: campaign.ctaUrl || "",
    variables: campaign.variables || {},
    brand_snapshot: campaign.brand || {},
    attachments: campaign.attachments || [],
    legacy_content: campaign.mode === "visual" || campaign.mode === "legacy_visual" || campaign.contentBlocks?.length
      ? { contentBlocks: campaign.contentBlocks || [] }
      : null,
    status: campaign.status || "draft",
    schedule_at: campaign.scheduleAt || null,
    created_by: campaign.createdBy || null,
    created_at: campaign.createdAt || new Date().toISOString(),
    updated_at: campaign.updatedAt || new Date().toISOString(),
    queued_at: campaign.queuedAt || null,
    started_at: campaign.startedAt || null,
    completed_at: campaign.completedAt || null,
    cancelled_at: campaign.cancelledAt || null,
    failure_reason: campaign.error || "",
    requested_recipient_count: Number(campaign.requestedRecipientCount || campaign.recipientCount || 0),
    eligible_recipient_count: Number(campaign.recipientCount || 0),
    processed_count: Number(campaign.processed || 0),
    sent_count: Number(campaign.sent || 0),
    failed_count: Number(campaign.failed || 0),
    delivered_count: campaign.delivered ?? null,
    bounced_count: campaign.bounced ?? null,
    opened_count: campaign.opened ?? null,
    clicked_count: campaign.clicked ?? null,
    ai_metadata: aiMetadata,
    eligibility_snapshot: campaign.eligibility || campaign.aiEligibility || {}
  };
}

async function createCampaign(campaign) {
  const record = campaignRecord(campaign);
  const columns = Object.keys(record);
  const values = columns.map((column) => {
    const value = record[column];
    return ["selected_customer_ids", "variables", "brand_snapshot", "attachments", "legacy_content", "ai_metadata", "eligibility_snapshot"].includes(column)
      ? JSON.stringify(value)
      : value;
  });
  const placeholders = values.map((_, index) => `$${index + 1}`);
  return withPostgresTransaction(async (client) => {
    const inserted = await client.query(`
      INSERT INTO email_campaigns (${columns.join(", ")}) VALUES (${placeholders.join(", ")})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    `, values);
    if (inserted.rows[0]) return { campaign: campaignFromRow(inserted.rows[0]), created: true };
    if (!record.idempotency_key) throw new Error("Não foi possível persistir a campanha.");
    const existing = await client.query("SELECT * FROM email_campaigns WHERE idempotency_key = $1", [record.idempotency_key]);
    if (!existing.rows[0]) throw new Error("Não foi possível localizar a campanha idempotente.");
    return { campaign: campaignFromRow(existing.rows[0]), created: false };
  });
}

async function getCampaign(id) {
  const result = await queryPostgres("SELECT * FROM email_campaigns WHERE id = $1 AND archived_at IS NULL", [id]);
  return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
}

async function listCampaigns(filters = {}) {
  const values = [];
  const where = ["archived_at IS NULL"];
  const add = (sql, value) => { values.push(value); where.push(sql.replace("?", `$${values.length}`)); };
  const statuses = Array.isArray(filters.statuses) ? filters.statuses.filter(Boolean) : [];
  if (statuses.length) add("status = ANY(?::text[])", statuses);
  if (filters.templateId) add("template_id = ?", filters.templateId);
  if (filters.origin === "ai") where.push("COALESCE((ai_metadata->>'generated')::boolean, false) = true");
  if (filters.origin === "manual") where.push("COALESCE((ai_metadata->>'generated')::boolean, false) = false");
  if (filters.creator) add("created_by = ?", filters.creator);
  if (filters.from) add("created_at >= ?::timestamptz", filters.from);
  if (filters.to) add("created_at <= ?::timestamptz", filters.to);
  if (filters.item) {
    values.push(filters.item);
    where.push(`(movie_id = $${values.length} OR coupon_id = $${values.length} OR club_plan_id = $${values.length} OR concession_id = $${values.length} OR $${values.length} = ANY(concession_ids))`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(subject ILIKE $${values.length} OR headline ILIKE $${values.length} OR movie_id ILIKE $${values.length} OR coupon_id ILIKE $${values.length})`);
  }
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const predicate = `WHERE ${where.join(" AND ")}`;
  const count = await queryPostgres(`SELECT COUNT(*)::integer AS total FROM email_campaigns ${predicate}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const direction = String(filters.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const result = await queryPostgres(`SELECT ${LIST_CAMPAIGN_COLUMNS} FROM email_campaigns ${predicate} ORDER BY created_at ${direction} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  const totals = await queryPostgres(`SELECT status, COUNT(*)::integer AS total FROM email_campaigns WHERE archived_at IS NULL GROUP BY status`);
  return {
    campaigns: result.rows.map(campaignFromRow),
    page,
    pageSize,
    total: Number(count.rows[0]?.total || 0),
    pages: Math.max(1, Math.ceil(Number(count.rows[0]?.total || 0) / pageSize)),
    totals: Object.fromEntries(totals.rows.map((row) => [row.status, Number(row.total)]))
  };
}

async function updateCampaign(id, campaign, allowedStates = ["draft", "failed"]) {
  const record = campaignRecord({ ...campaign, id });
  const immutable = new Set(["id", "idempotency_key", "created_at", "created_by", "updated_at", "processed_count", "sent_count", "failed_count", "delivered_count", "bounced_count", "opened_count", "clicked_count"]);
  const columns = Object.keys(record).filter((column) => !immutable.has(column));
  const values = columns.map((column) => ["selected_customer_ids", "variables", "brand_snapshot", "attachments", "legacy_content", "ai_metadata", "eligibility_snapshot"].includes(column) ? JSON.stringify(record[column]) : record[column]);
  values.push(id, allowedStates);
  const result = await queryPostgres(`UPDATE email_campaigns SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")}, updated_at = now()
    WHERE id = $${values.length - 1} AND status = ANY($${values.length}::text[]) RETURNING *`, values);
  return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
}

async function deleteCampaign(id) {
  return withPostgresTransaction(async (client) => {
    const found = await client.query("SELECT id, status FROM email_campaigns WHERE id = $1 AND archived_at IS NULL FOR UPDATE", [id]);
    if (!found.rowCount || !["draft", "failed", "cancelled"].includes(found.rows[0].status)) return false;
    const attempts = await client.query("SELECT EXISTS (SELECT 1 FROM email_delivery_attempts WHERE campaign_id = $1) AS present", [id]);
    if (found.rows[0].status === "draft" && !attempts.rows[0]?.present) {
      await client.query("DELETE FROM email_campaigns WHERE id = $1", [id]);
    } else {
      await client.query("UPDATE email_campaigns SET archived_at = now(), updated_at = now() WHERE id = $1", [id]);
    }
    return true;
  });
}

async function transitionCampaign(id, to, options = {}) {
  const from = options.from || Object.keys(CAMPAIGN_STATES).filter((state) => transitionAllowed(state, to));
  const fields = ["status = $2", "updated_at = now()"];
  const values = [id, to, from];
  if (to === "queued") fields.push("queued_at = now()", "failure_reason = ''", "locked_at = NULL", "heartbeat_at = NULL", "worker_id = NULL");
  if (to === "cancelled") fields.push("cancelled_at = now()", "locked_at = NULL", "heartbeat_at = NULL", "worker_id = NULL");
  const result = await withPostgresTransaction(async (client) => {
    const updated = await client.query(`UPDATE email_campaigns SET ${fields.join(", ")} WHERE id = $1 AND status = ANY($3::text[]) RETURNING *`, values);
    if (updated.rowCount && to === "cancelled") {
      await client.query(`UPDATE email_campaign_recipients SET status = 'cancelled', worker_id = NULL, locked_at = NULL, updated_at = now()
        WHERE campaign_id = $1 AND (status IN ('pending', 'retryable_failed') OR
          (status = 'processing' AND NOT EXISTS (SELECT 1 FROM email_delivery_attempts a WHERE a.campaign_recipient_id = email_campaign_recipients.id AND a.status = 'started')))`, [id]);
    }
    return updated;
  });
  return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
}

async function snapshotRecipients(campaignId, recipients = []) {
  return withPostgresTransaction(async (client) => {
    const activeKeys = [];
    for (const recipient of recipients) {
      const email = String(recipient.email || "").trim().toLowerCase();
      if (!email) continue;
      const key = recipient.id ? `user:${recipient.id}` : `email:${crypto.createHash("sha256").update(email).digest("hex")}`;
      activeKeys.push(key);
      const emailHash = crypto.createHash("sha256").update(email).digest("hex");
      await client.query(`INSERT INTO email_campaign_recipients
        (campaign_id, customer_id, recipient_key, email, name_snapshot, status, eligibility_reason)
        SELECT $1, NULLIF($2, ''), $3, $4, $5, 'pending', $6
        WHERE NOT EXISTS (SELECT 1 FROM email_suppressions WHERE email_hash = $7)
          AND ($2 = '' OR COALESCE((SELECT marketing_email_enabled FROM email_marketing_preferences WHERE user_id = $2), true))
        ON CONFLICT (campaign_id, recipient_key) DO UPDATE SET
          email = EXCLUDED.email, name_snapshot = EXCLUDED.name_snapshot,
          customer_id = EXCLUDED.customer_id, eligibility_reason = EXCLUDED.eligibility_reason,
          status = CASE WHEN email_campaign_recipients.suppression_reason = 'no_longer_eligible' THEN 'pending' ELSE email_campaign_recipients.status END,
          suppression_reason = CASE WHEN email_campaign_recipients.suppression_reason = 'no_longer_eligible' THEN '' ELSE email_campaign_recipients.suppression_reason END,
          updated_at = now()
        WHERE email_campaign_recipients.status IN ('pending', 'retryable_failed', 'failed', 'suppressed')`,
      [campaignId, String(recipient.id || ""), key, email, String(recipient.name || "").slice(0, 200), String(recipient.eligibilityReason || "eligible").slice(0, 200), emailHash]);
    }
    if (activeKeys.length) {
      await client.query(`UPDATE email_campaign_recipients SET status = 'suppressed', suppression_reason = 'no_longer_eligible', updated_at = now()
        WHERE campaign_id = $1 AND status IN ('pending', 'retryable_failed', 'failed') AND NOT (recipient_key = ANY($2::text[]))`, [campaignId, activeKeys]);
    } else {
      await client.query(`UPDATE email_campaign_recipients SET status = 'suppressed', suppression_reason = 'no_longer_eligible', updated_at = now()
        WHERE campaign_id = $1 AND status IN ('pending', 'retryable_failed', 'failed')`, [campaignId]);
    }
    await client.query(`UPDATE email_campaigns SET
      requested_recipient_count = $2,
      eligible_recipient_count = (SELECT COUNT(*) FROM email_campaign_recipients WHERE campaign_id = $1 AND status <> 'suppressed'),
      updated_at = now() WHERE id = $1`, [campaignId, recipients.length]);
    return recipients.length;
  });
}

async function claimCampaign(workerId, leaseMs = 120000) {
  const leaseSeconds = Math.max(30, Math.ceil(Number(leaseMs) / 1000));
  return withPostgresTransaction(async (client) => {
    await client.query(`UPDATE email_campaign_recipients r SET status = 'pending', worker_id = NULL, locked_at = NULL,
      processing_started_at = NULL, attempt_count = GREATEST(attempt_count - 1, 0), updated_at = now()
      WHERE r.status = 'processing' AND r.locked_at < now() - ($1::text || ' seconds')::interval
        AND NOT EXISTS (SELECT 1 FROM email_delivery_attempts a WHERE a.campaign_recipient_id = r.id AND a.status = 'started')`, [String(leaseSeconds)]);
    await client.query(`UPDATE email_campaign_recipients r SET status = 'unknown', worker_id = NULL, locked_at = NULL,
      last_error_code = 'WORKER_LOST_AFTER_ATTEMPT', last_error = 'O processo foi interrompido durante uma tentativa; revisão manual necessária.', updated_at = now()
      WHERE r.status = 'processing' AND r.locked_at < now() - ($1::text || ' seconds')::interval
        AND EXISTS (SELECT 1 FROM email_delivery_attempts a WHERE a.campaign_recipient_id = r.id AND a.status = 'started')`, [String(leaseSeconds)]);
    const found = await client.query(`SELECT id FROM email_campaigns
      WHERE archived_at IS NULL AND (
        status = 'queued' OR
        (status = 'scheduled' AND schedule_at <= now()) OR
        (status = 'sending' AND COALESCE(heartbeat_at, locked_at, started_at) < now() - ($1::text || ' seconds')::interval)
      ) ORDER BY COALESCE(schedule_at, queued_at, created_at) FOR UPDATE SKIP LOCKED LIMIT 1`, [String(leaseSeconds)]);
    if (!found.rowCount) return null;
    const result = await client.query(`UPDATE email_campaigns SET status = 'sending', worker_id = $2, locked_at = now(), heartbeat_at = now(),
      started_at = COALESCE(started_at, now()), updated_at = now() WHERE id = $1 AND status <> 'cancelled' RETURNING *`, [found.rows[0].id, workerId]);
    return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
  });
}

async function heartbeatCampaign(id, workerId) {
  const result = await queryPostgres("UPDATE email_campaigns SET heartbeat_at = now(), updated_at = now() WHERE id = $1 AND worker_id = $2 AND status = 'sending' RETURNING id", [id, workerId]);
  return Boolean(result.rowCount);
}

async function claimRecipients(campaignId, workerId, limit = 25, maxAttempts = 3) {
  return withPostgresTransaction(async (client) => {
    await client.query(`UPDATE email_campaign_recipients r SET status = 'suppressed', suppression_reason = 'marketing_opt_out', updated_at = now()
      WHERE r.campaign_id = $1 AND r.status IN ('pending', 'retryable_failed') AND (
        EXISTS (SELECT 1 FROM email_suppressions s WHERE s.email_hash = encode(digest(lower(r.email), 'sha256'), 'hex')) OR
        EXISTS (SELECT 1 FROM email_marketing_preferences p WHERE p.user_id = r.customer_id AND p.marketing_email_enabled = false)
      )`, [campaignId]);
    const rows = await client.query(`SELECT id FROM email_campaign_recipients
      WHERE campaign_id = $1 AND status IN ('pending', 'retryable_failed')
        AND (attempt_count < $2 OR manual_retry_granted = true)
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $3`, [campaignId, maxAttempts, Math.max(1, Math.min(100, Number(limit || 25)))]);
    if (!rows.rowCount) return [];
    const ids = rows.rows.map((row) => row.id);
    const claimed = await client.query(`UPDATE email_campaign_recipients SET status = 'processing', worker_id = $2, locked_at = now(),
      processing_started_at = now(), attempt_count = attempt_count + 1, updated_at = now()
      WHERE id = ANY($1::uuid[]) RETURNING *`, [ids, workerId]);
    return claimed.rows.map(recipientFromRow);
  });
}

async function startAttempt(recipient, provider) {
  return withPostgresTransaction(async (client) => {
    const result = await client.query(`INSERT INTO email_delivery_attempts
      (campaign_id, campaign_recipient_id, delivery_id, attempt_number, provider, status)
      VALUES ($1, $2, $3, $4, $5, 'started') RETURNING *`,
    [recipient.campaignId, recipient.id, recipient.deliveryId, recipient.attemptCount, provider]);
    await client.query("UPDATE email_campaign_recipients SET manual_retry_granted = false, updated_at = now() WHERE id = $1", [recipient.id]);
    return result.rows[0];
  });
}

async function completeAttempt({ recipient, attemptId, outcome }) {
  const status = ["sent", "retryable_failed", "failed", "unknown"].includes(outcome.status) ? outcome.status : "failed";
  return withPostgresTransaction(async (client) => {
    await client.query(`UPDATE email_delivery_attempts SET completed_at = now(), status = $2, retryable = $3,
      provider = $4, provider_message_id = $5, error_code = $6, error_message = $7, metadata = $8::jsonb WHERE id = $1`,
    [attemptId, status, status === "retryable_failed" || Boolean(outcome.retryable), outcome.provider || "unknown", outcome.providerMessageId || "", outcome.errorCode || "", outcome.errorMessage || "", JSON.stringify(outcome.metadata || {})]);
    const retryAt = status === "retryable_failed" ? new Date(Date.now() + Math.min(30 * 60 * 1000, 15000 * (2 ** Math.max(0, recipient.attemptCount - 1)))).toISOString() : null;
    await client.query(`UPDATE email_campaign_recipients SET status = $2, provider = $3, provider_message_id = $4,
      last_error_code = $5, last_error = $6, next_attempt_at = $7, sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
      failed_at = CASE WHEN $2 IN ('failed', 'retryable_failed', 'unknown') THEN now() ELSE failed_at END,
      worker_id = NULL, locked_at = NULL, updated_at = now() WHERE id = $1 AND status = 'processing'`,
    [recipient.id, status, outcome.provider || "", outcome.providerMessageId || "", outcome.errorCode || "", outcome.errorMessage || "", retryAt]);
  });
}

async function reconcileCampaign(id, workerId) {
  return withPostgresTransaction(async (client) => {
    const counts = await client.query(`SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','failed','retryable_failed','unknown','suppressed','cancelled'))::integer AS processed,
      COUNT(*) FILTER (WHERE status = 'sent')::integer AS sent,
      COUNT(*) FILTER (WHERE status IN ('failed','retryable_failed','unknown'))::integer AS failed,
      COUNT(*) FILTER (WHERE status IN ('pending','processing','retryable_failed'))::integer AS remaining,
      COUNT(*) FILTER (WHERE status = 'unknown')::integer AS uncertain
      FROM email_campaign_recipients WHERE campaign_id = $1`, [id]);
    const summary = counts.rows[0] || {};
    const current = await client.query("SELECT status FROM email_campaigns WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rowCount) return null;
    if (current.rows[0].status === "cancelled") {
      const cancelled = await client.query(`UPDATE email_campaigns SET processed_count = $2, sent_count = $3,
        failed_count = $4, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, summary.processed || 0, summary.sent || 0, summary.failed || 0]);
      return campaignFromRow(cancelled.rows[0]);
    }
    let status = "sending";
    if (Number(summary.remaining || 0) === 0) {
      status = Number(summary.sent || 0) === 0 && Number(summary.failed || 0) > 0 ? "failed"
        : Number(summary.failed || 0) > 0 ? "completed_with_errors" : "completed";
    }
    const result = await client.query(`UPDATE email_campaigns SET processed_count = $2, sent_count = $3, failed_count = $4,
      status = $5, completed_at = CASE WHEN $5 <> 'sending' THEN now() ELSE completed_at END,
      failure_reason = CASE WHEN $6 > 0 THEN 'Há entregas com resultado incerto; revise antes de reenviar.' ELSE failure_reason END,
      worker_id = CASE WHEN $5 = 'sending' THEN worker_id ELSE NULL END,
      locked_at = CASE WHEN $5 = 'sending' THEN locked_at ELSE NULL END,
      heartbeat_at = CASE WHEN $5 = 'sending' THEN now() ELSE NULL END, updated_at = now()
      WHERE id = $1 AND status <> 'cancelled' AND (worker_id = $7 OR $5 <> 'sending') RETURNING *`,
    [id, summary.processed || 0, summary.sent || 0, summary.failed || 0, status, summary.uncertain || 0, workerId]);
    return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
  });
}

async function failCampaign(id, workerId, message) {
  return withPostgresTransaction(async (client) => {
    await client.query(`UPDATE email_campaign_recipients SET status = 'failed', failed_at = now(),
      last_error_code = 'CAMPAIGN_VALIDATION_FAILED', last_error = $2, next_attempt_at = NULL,
      worker_id = NULL, locked_at = NULL, updated_at = now()
      WHERE campaign_id = $1 AND status IN ('pending', 'retryable_failed')`,
    [id, String(message || "Falha ao processar campanha").slice(0, 1000)]);
    const counts = await client.query(`SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','failed','unknown','suppressed','cancelled'))::integer AS processed,
      COUNT(*) FILTER (WHERE status = 'sent')::integer AS sent,
      COUNT(*) FILTER (WHERE status IN ('failed','unknown'))::integer AS failed
      FROM email_campaign_recipients WHERE campaign_id = $1`, [id]);
    const summary = counts.rows[0] || {};
    const status = Number(summary.sent || 0) > 0 ? "completed_with_errors" : "failed";
    const result = await client.query(`UPDATE email_campaigns SET status = $4, failure_reason = $3,
      processed_count = $5, sent_count = $6, failed_count = $7, completed_at = now(),
      worker_id = NULL, locked_at = NULL, heartbeat_at = NULL, updated_at = now()
      WHERE id = $1 AND worker_id = $2 RETURNING *`,
    [id, workerId, String(message || "Falha ao processar campanha").slice(0, 2000), status,
      summary.processed || 0, summary.sent || 0, summary.failed || 0]);
    return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
  });
}

async function deferCampaign(id, workerId) {
  const result = await queryPostgres(`UPDATE email_campaigns c SET status = 'scheduled',
    schedule_at = COALESCE((SELECT MIN(next_attempt_at) FROM email_campaign_recipients WHERE campaign_id = c.id AND status = 'retryable_failed'), now() + interval '15 seconds'),
    worker_id = NULL, locked_at = NULL, heartbeat_at = NULL, updated_at = now()
    WHERE c.id = $1 AND c.worker_id = $2 AND c.status = 'sending' RETURNING *`, [id, workerId]);
  return result.rows[0] ? campaignFromRow(result.rows[0]) : null;
}

async function listRecipients(campaignId, filters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  const values = [campaignId];
  const where = ["campaign_id = $1"];
  if (filters.status) { values.push(filters.status); where.push(`status = $${values.length}`); }
  const count = await queryPostgres(`SELECT COUNT(*)::integer AS total FROM email_campaign_recipients WHERE ${where.join(" AND ")}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const result = await queryPostgres(`SELECT * FROM email_campaign_recipients WHERE ${where.join(" AND ")} ORDER BY created_at LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { recipients: result.rows.map(recipientFromRow), page, pageSize, total: Number(count.rows[0]?.total || 0), pages: Math.max(1, Math.ceil(Number(count.rows[0]?.total || 0) / pageSize)) };
}

async function retryFailures(id) {
  return withPostgresTransaction(async (client) => {
    const campaign = await client.query("SELECT * FROM email_campaigns WHERE id = $1 FOR UPDATE", [id]);
    if (!campaign.rowCount || !["failed", "completed_with_errors"].includes(campaign.rows[0].status)) return null;
    const reset = await client.query(`UPDATE email_campaign_recipients r SET status = 'pending', next_attempt_at = NULL,
      manual_retry_granted = true, last_error_code = '', last_error = '', updated_at = now()
      WHERE campaign_id = $1 AND (
        status = 'retryable_failed' OR
        (status = 'failed' AND EXISTS (
          SELECT 1 FROM email_delivery_attempts a
          WHERE a.campaign_recipient_id = r.id AND a.attempt_number = r.attempt_count AND a.retryable = true
        ))
      ) RETURNING id`, [id]);
    if (!reset.rowCount) return { campaign: campaignFromRow(campaign.rows[0]), retried: 0 };
    const updated = await client.query(`UPDATE email_campaigns SET status = 'queued', queued_at = now(), completed_at = NULL,
      failure_reason = '', worker_id = NULL, locked_at = NULL, heartbeat_at = NULL, updated_at = now() WHERE id = $1 RETURNING *`, [id]);
    return { campaign: campaignFromRow(updated.rows[0]), retried: reset.rowCount };
  });
}

async function issueUnsubscribeToken(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await withPostgresTransaction(async (client) => {
    await client.query(`INSERT INTO email_marketing_preferences (user_id, marketing_email_enabled, opted_in_at, source, consent_version)
      VALUES ($1, true, now(), 'account', 'v2') ON CONFLICT (user_id) DO NOTHING`, [userId]);
    await client.query("INSERT INTO email_unsubscribe_tokens (token_hash, user_id) VALUES ($1, $2)", [hash, userId]);
  });
  return token;
}

async function findUnsubscribeUser(token) {
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const result = await queryPostgres(`SELECT t.user_id, u.email, u.name,
    COALESCE(p.marketing_email_enabled, u.email_unsubscribed_at IS NULL) AS marketing_email_enabled
    FROM email_unsubscribe_tokens t JOIN users u ON u.id = t.user_id
    LEFT JOIN email_marketing_preferences p ON p.user_id = u.id
    WHERE t.token_hash = $1 AND t.expires_at > now()`, [hash]);
  return result.rows[0] || null;
}

async function unsubscribeByToken(token, reason = "user_request") {
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  return withPostgresTransaction(async (client) => {
    const found = await client.query("SELECT user_id FROM email_unsubscribe_tokens WHERE token_hash = $1 AND expires_at > now() FOR UPDATE", [hash]);
    if (!found.rowCount) return null;
    const userId = found.rows[0].user_id;
    await client.query("UPDATE email_unsubscribe_tokens SET used_at = COALESCE(used_at, now()) WHERE token_hash = $1", [hash]);
    await client.query("UPDATE users SET email_unsubscribed_at = COALESCE(email_unsubscribed_at, now()), updated_at = now() WHERE id = $1", [userId]);
    await client.query(`INSERT INTO email_marketing_preferences
      (user_id, marketing_email_enabled, opted_out_at, source, consent_version, reason)
      VALUES ($1, false, now(), 'unsubscribe_link', 'v2', $2)
      ON CONFLICT (user_id) DO UPDATE SET marketing_email_enabled = false,
        opted_out_at = COALESCE(email_marketing_preferences.opted_out_at, now()), source = 'unsubscribe_link',
        consent_version = 'v2', reason = EXCLUDED.reason, updated_at = now()`, [userId, String(reason || "user_request").slice(0, 120)]);
    const user = await client.query("SELECT id, email, name FROM users WHERE id = $1", [userId]);
    if (user.rows[0]?.email) {
      const email = String(user.rows[0].email).trim().toLowerCase();
      await client.query(`INSERT INTO email_suppressions (email_hash, reason, source)
        VALUES ($1, $2, 'unsubscribe') ON CONFLICT (email_hash) DO UPDATE SET reason = EXCLUDED.reason, updated_at = now()`,
      [crypto.createHash("sha256").update(email).digest("hex"), String(reason || "user_request").slice(0, 120)]);
    }
    return user.rows[0] || { id: userId };
  });
}

async function listReferencedAttachmentIds() {
  const result = await queryPostgres(`SELECT DISTINCT attachment->>'id' AS id
    FROM email_campaigns, LATERAL jsonb_array_elements(attachments) AS attachment
    WHERE archived_at IS NULL AND COALESCE(attachment->>'id', '') <> ''`);
  return result.rows.map((row) => row.id);
}

module.exports = {
  CAMPAIGN_STATES,
  transitionAllowed,
  campaignFromRow,
  recipientFromRow,
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  transitionCampaign,
  snapshotRecipients,
  claimCampaign,
  heartbeatCampaign,
  claimRecipients,
  startAttempt,
  completeAttempt,
  reconcileCampaign,
  failCampaign,
  deferCampaign,
  listRecipients,
  retryFailures,
  issueUnsubscribeToken,
  findUnsubscribeUser,
  unsubscribeByToken,
  listReferencedAttachmentIds,
  _test: { campaignRecord }
};
