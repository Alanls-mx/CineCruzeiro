const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");

let pool;
const transactionContext = new AsyncLocalStorage();
const CINEMA_TIME_ZONE = process.env.CINEMA_TIME_ZONE || "America/Sao_Paulo";

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function postgresEnabled() {
  return Boolean(databaseUrl()) && process.env.DATA_STORE !== "json";
}

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl() });
  }
  return pool;
}

function contextClient() {
  return transactionContext.getStore()?.client || null;
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function jsonValue(value, fallback = null) {
  if (value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { value };
    }
  }
  return value;
}

function jsonParam(value, fallback = null) {
  const normalized = jsonValue(value, fallback);
  return normalized === null ? null : JSON.stringify(normalized);
}

function pgDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
  return "";
}

function cinemaIsoDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CINEMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function mapMovie(row, sessions) {
  return {
    id: row.id,
    slug: row.slug || row.id,
    workflowStatus: row.workflow_status || (row.status === "hidden" ? "archived" : "published"),
    sortOrder: num(row.sort_order, 100),
    status: row.status,
    title: row.title,
    originalTitle: row.original_title || "",
    synopsis: row.synopsis || "",
    duration: row.duration || "",
    director: row.director || "",
    metadata: row.metadata || {},
    genre: asArray(row.genre),
    rating: row.rating || "L",
    posterUrl: row.poster_url || "",
    backdropUrl: row.backdrop_url || "",
    trailerYoutubeId: row.trailer_youtube_id || undefined,
    trailerVideoUrl: row.trailer_video_url || undefined,
    localTrailerUrl: row.local_trailer_url || undefined,
    trailerSourceUrl: row.trailer_source_url || undefined,
    trailerCacheStatus: row.trailer_cache_status || "idle",
    trailerCacheError: row.trailer_cache_error || "",
    isHighlight: Boolean(row.is_highlight),
    highlightTrailerBackground: row.highlight_trailer_background !== false,
    releaseDate: row.release_date ? String(row.release_date).slice(0, 10) : "",
    autoPublish: Boolean(row.auto_publish),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : "",
    tag: row.tag || "",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
    sessions: sessions.map((session) => ({
      id: session.id,
      date: cinemaIsoDate(session.starts_at),
      time: session.time_label,
      format: session.format,
      room: session.room_label || session.room_id || "",
      ticketTypeIds: asArray(session.ticket_type_ids),
      priceFull: num(session.price_full, 10),
      priceHalf: num(session.price_half, 10),
      status: session.status || "available"
    }))
  };
}

async function loadDbFromPostgres() {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    // A single pg client must execute queries sequentially. Promise.all here only
    // queued work on the same socket and emits a deprecation warning in pg 8.
    const settings = await client.query("SELECT value FROM settings WHERE key = 'app'");
    const rooms = await client.query("SELECT * FROM rooms ORDER BY name");
    const ticketTypes = await client.query("SELECT * FROM ticket_types ORDER BY name");
    const movies = await client.query("SELECT * FROM movies ORDER BY sort_order, title");
    const sessions = await client.query(`
      SELECT sessions.*,
        COALESCE(
          array_agg(session_ticket_types.ticket_type_id ORDER BY session_ticket_types.position)
            FILTER (WHERE session_ticket_types.ticket_type_id IS NOT NULL),
          '{}'
        ) AS ticket_type_ids
      FROM sessions
      LEFT JOIN session_ticket_types ON session_ticket_types.session_id = sessions.id
      GROUP BY sessions.id
      ORDER BY sessions.time_label
    `);
    const concessions = await client.query("SELECT * FROM concessions ORDER BY sort_order, name");
    const inventory = await client.query("SELECT * FROM concession_inventory");
    const promotions = await client.query("SELECT * FROM promotions ORDER BY created_at");
    const ads = await client.query("SELECT * FROM ads ORDER BY created_at");
    const users = await client.query("SELECT * FROM users ORDER BY created_at");
    const orders = await client.query("SELECT * FROM orders ORDER BY created_at DESC");
    const orderItems = await client.query("SELECT * FROM order_items");
    const payments = await client.query("SELECT * FROM payments ORDER BY created_at DESC");
    const tickets = await client.query("SELECT * FROM tickets ORDER BY created_at DESC");
    const webhookEvents = await client.query("SELECT * FROM webhook_events ORDER BY created_at DESC");
    const auditLogs = await client.query("SELECT * FROM audit_logs ORDER BY created_at DESC");
    const subscriptionPlans = await client.query("SELECT * FROM subscription_plans ORDER BY monthly_price, name").catch(() => ({ rows: [] }));
    const subscriptionCredits = await client.query("SELECT * FROM subscription_credits ORDER BY cycle_start DESC").catch(() => ({ rows: [] }));
    const subscriptions = await client.query("SELECT * FROM subscriptions ORDER BY created_at DESC").catch(() => ({ rows: [] }));
    const subscriptionUsage = await client.query("SELECT * FROM subscription_usage ORDER BY used_at DESC").catch(() => ({ rows: [] }));
    const subscriptionCycles = await client.query("SELECT * FROM subscription_cycles ORDER BY cycle_start DESC").catch(() => ({ rows: [] }));
    const subscriptionPayments = await client.query("SELECT * FROM subscription_payments ORDER BY created_at DESC").catch(() => ({ rows: [] }));
    const subscriptionCreditUnits = await client.query("SELECT * FROM subscription_credit_units ORDER BY issued_at DESC").catch(() => ({ rows: [] }));
    const subscriptionCreditRedemptions = await client.query("SELECT * FROM subscription_credit_redemptions ORDER BY created_at DESC").catch(() => ({ rows: [] }));
    const subscriptionAccountingRules = await client.query("SELECT * FROM subscription_accounting_rule_versions ORDER BY effective_from DESC").catch(() => ({ rows: [] }));
    const orderServiceItems = await client.query("SELECT * FROM order_service_items ORDER BY created_at").catch(() => ({ rows: [] }));
    const orderGoodsItems = await client.query("SELECT * FROM order_goods_items ORDER BY created_at").catch(() => ({ rows: [] }));
    const goodsFiscalDocuments = await client.query("SELECT * FROM goods_fiscal_documents ORDER BY created_at DESC").catch(() => ({ rows: [] }));

    const inventoryById = new Map(inventory.rows.map((item) => [item.concession_id, item]));
    const sessionsByMovie = new Map();
    sessions.rows.forEach((session) => {
      const list = sessionsByMovie.get(session.movie_id) || [];
      list.push(session);
      sessionsByMovie.set(session.movie_id, list);
    });
    const orderItemsByOrder = new Map();
    orderItems.rows.forEach((item) => {
      const list = orderItemsByOrder.get(item.order_id) || [];
      list.push(item);
      orderItemsByOrder.set(item.order_id, list);
    });

    const appSettings = settings.rows[0]?.value || {};

    return {
      settings: appSettings,
      integrations: appSettings.integrations || {},
      emailCampaigns: appSettings.emailCampaigns || [],
      rooms: rooms.rows.map((row) => ({
        id: row.id,
        name: row.name,
        capacity: row.capacity,
        technology: row.technology || "",
        status: row.status,
        seatSelectionEnabled: Boolean(row.seat_selection_enabled),
        seatTypes: asArray(row.seat_types),
        seatLayout: row.seat_layout && typeof row.seat_layout === "object"
          ? row.seat_layout
          : { screenLabel: "TELA", rows: [] }
      })),
      ticketTypes: ticketTypes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: num(row.price, 10),
        description: row.description || "",
        bundleQuantity: Math.max(1, Number(row.bundle_quantity || 1)),
        active: row.active !== false
      })),
      movies: movies.rows.map((row) => mapMovie(row, sessionsByMovie.get(row.id) || [])),
      concessions: concessions.rows.map((row) => {
        const inventoryItem = inventoryById.get(row.id);
        const stock = inventoryItem?.available;
        return {
          id: row.id,
          sku: row.sku || "",
          name: row.name,
          description: row.description || "",
          imageUrl: row.image_url || "",
          badge: row.badge || "",
          price: num(row.price),
          compareAt: row.compare_at === null ? "" : num(row.compare_at),
          category: row.category || "combo",
          stock: stock === null || stock === undefined ? "" : Number(stock),
          reserved: inventoryItem?.reserved === null || inventoryItem?.reserved === undefined ? 0 : Number(inventoryItem.reserved),
          sold: inventoryItem?.sold === null || inventoryItem?.sold === undefined ? 0 : Number(inventoryItem.sold),
          maxPerOrder: row.max_per_order,
          featured: Boolean(row.featured),
          sortOrder: row.sort_order,
          tags: asArray(row.tags),
          comboItems: asArray(row.combo_items),
          active: row.active !== false
        };
      }),
      promotions: promotions.rows.map((row) => ({
        ...(row.metadata || {}),
        id: row.id,
        title: row.title,
        description: row.description || "",
        discountType: row.discount_type,
        value: num(row.value),
        couponCode: row.coupon_code || "",
        startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : "",
        endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : "",
        active: row.active !== false
      })),
      ads: ads.rows.map((row) => ({
        ...(row.metadata || {}),
        id: row.id,
        title: row.title,
        description: row.description || "",
        imageUrl: row.image_url || "",
        linkUrl: row.cta_url || "",
        ctaLabel: row.cta_label || "",
        placement: row.placement || "",
        active: row.active !== false
      })),
      users: users.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || "",
        cpf: row.cpf || "",
        passwordHash: row.password_hash || "",
        authProvider: row.auth_provider || "email",
        googleSub: row.google_sub || "",
        picture: row.picture || "",
        emailVerified: Boolean(row.email_verified),
        pendingEmail: row.pending_email || "",
        emailVerificationHash: row.email_verification_hash || "",
        emailVerificationExpiresAt: row.email_verification_expires_at ? new Date(row.email_verification_expires_at).toISOString() : "",
        emailVerificationRequestedAt: row.email_verification_requested_at ? new Date(row.email_verification_requested_at).toISOString() : "",
        passwordResetHash: row.password_reset_hash || "",
        passwordResetExpiresAt: row.password_reset_expires_at ? new Date(row.password_reset_expires_at).toISOString() : "",
        passwordResetRequestedAt: row.password_reset_requested_at ? new Date(row.password_reset_requested_at).toISOString() : "",
        emailUnsubscribedAt: row.email_unsubscribed_at ? new Date(row.email_unsubscribed_at).toISOString() : "",
        emailUnsubscribeToken: row.email_unsubscribe_token || "",
        twoFactorEnabled: Boolean(row.two_factor_enabled),
        twoFactorSecret: row.two_factor_secret || "",
        twoFactorPendingSecret: row.two_factor_pending_secret || "",
        twoFactorRecoveryCodes: Array.isArray(row.two_factor_recovery_codes) ? row.two_factor_recovery_codes : [],
        twoFactorConfirmedAt: row.two_factor_confirmed_at ? new Date(row.two_factor_confirmed_at).toISOString() : "",
        twoFactorUpdatedAt: row.two_factor_updated_at ? new Date(row.two_factor_updated_at).toISOString() : "",
        adminPermissions: Array.isArray(row.admin_permissions) ? row.admin_permissions : [],
        useCustomPermissions: Boolean(row.use_custom_permissions),
        sessionVersion: Number(row.session_version || 0),
        role: row.role || "customer",
        active: row.active !== false,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
      })),
      orders: orders.rows.map((row) => {
        const metadata = row.metadata || {};
        const items = orderItemsByOrder.get(row.id) || [];
        return {
          ...metadata,
          id: row.id,
          customerName: row.customer_name,
          customerEmail: row.customer_email || "",
          customerPhone: row.customer_phone || "",
          customerCpf: row.customer_cpf || "",
          movieId: row.movie_id || metadata.movieId || "",
          sessionId: row.session_id || metadata.sessionId || "",
          status: row.status,
          discountValue: num(row.discount_total),
          totalPrice: num(row.total),
          serviceSubtotal: num(row.service_subtotal ?? metadata.serviceSubtotal),
          goodsSubtotal: num(row.goods_subtotal ?? metadata.goodsSubtotal),
          clubCreditsApplied: num(row.club_credits_applied ?? metadata.clubCreditsApplied),
          clubDiscount: num(row.club_discount ?? metadata.clubDiscount),
          additionalPayment: num(row.additional_payment ?? metadata.additionalPayment),
          serviceFiscalStatus: row.service_fiscal_status || metadata.serviceFiscalStatus || "not_applicable",
          goodsFiscalStatus: row.goods_fiscal_status || metadata.goodsFiscalStatus || "not_required",
          goodsFiscalTrigger: row.goods_fiscal_trigger || metadata.goodsFiscalTrigger || "goods_delivered",
          reservationExpiresAt: row.reservation_expires_at ? new Date(row.reservation_expires_at).toISOString() : "",
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : metadata.createdAt || "",
          concessionItems: items
            .filter((item) => item.item_type === "concession" || item.item_type === "addon")
            .map((item) => ({
              id: item.item_id,
              name: item.name,
              quantity: item.quantity,
              unitPrice: num(item.unit_price),
              ...(item.metadata || {})
            })),
          ticketItems: items.some((item) => item.item_type === "ticket")
            ? items.filter((item) => item.item_type === "ticket").map((item) => ({
                id: item.item_id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: num(item.unit_price),
                ...(item.metadata || {})
              }))
            : asArray(metadata.ticketItems)
        };
      }),
      payments: payments.rows.map((row) => ({
        ...(row.metadata || {}),
        id: row.id,
        orderId: row.order_id,
        method: row.method,
        provider: row.provider,
        providerPaymentId: row.provider_payment_id || "",
        providerReference: row.provider_reference || "",
        status: row.status,
        amount: num(row.amount),
        currency: row.currency,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : "",
        approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : "",
        expiredAt: row.expired_at ? new Date(row.expired_at).toISOString() : "",
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : "",
        refundedAt: row.refunded_at ? new Date(row.refunded_at).toISOString() : ""
      })),
      tickets: tickets.rows.map((row) => ({
        ...(row.metadata || {}),
        id: row.id,
        orderId: row.order_id,
        movieId: row.movie_id || "",
        sessionId: row.session_id || "",
        code: row.code,
        qrPayload: row.qr_payload,
        ticketType: row.ticket_type,
        status: row.status,
        customerName: row.customer_name || "",
        customerEmail: row.customer_email || "",
        customerPhone: row.customer_phone || "",
        customerCpf: row.customer_cpf || "",
        source: row.source,
        ticketNumber: Number(row.ticket_number || 0),
        basePrice: num(row.base_price),
        subscriptionCreditAmount: num(row.subscription_credit_amount),
        additionalPaymentAmount: num(row.additional_payment_amount),
        paymentSource: row.payment_source || "standard",
        subscriptionCreditId: row.subscription_credit_id || row.metadata?.subscriptionCreditId || "",
        usedAt: row.used_at ? new Date(row.used_at).toISOString() : "",
        usedBy: row.used_by || "",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
      })),
      webhookEvents: webhookEvents.rows.map((row) => ({
        ...(row.payload || {}),
        provider: row.provider,
        eventId: row.event_id,
        providerPaymentId: row.provider_payment_id || "",
        orderId: row.order_id || "",
        status: row.status || "",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
      })),
      auditLogs: auditLogs.rows.map((row) => ({
        id: row.id,
        userId: row.user_id || "",
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id || "",
        before: row.before,
        after: row.after,
        ip: row.ip || "",
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
      })),
      subscriptionPlans: subscriptionPlans.rows.map((row) => ({
        id: row.id,
        name: row.name,
        monthlyPrice: num(row.monthly_price),
        price: num(row.monthly_price),
        includedTickets: Number(row.included_tickets || 0),
        ticketsPerCycle: Number(row.included_tickets || 0),
        billingCycle: row.billing_cycle || "monthly",
        benefits: asArray(row.benefits),
        ticketDiscountPercent: num(row.ticket_discount_percent),
        concessionDiscountPercent: num(row.concession_discount_percent),
        freeConcessionItems: asArray(row.free_concession_items),
        creditReferenceValue: row.credit_reference_value === null ? null : num(row.credit_reference_value),
        creditValidityDays: row.credit_validity_days === null ? null : Number(row.credit_validity_days),
        allowCreditRollover: Boolean(row.allow_credit_rollover),
        maxAccumulatedCredits: row.max_accumulated_credits === null ? null : Number(row.max_accumulated_credits),
        gracePeriodDays: Number(row.grace_period_days || 0),
        allowPriceDifference: row.allow_price_difference !== false,
        excludedConcessionIds: asArray(row.excluded_concession_ids),
        eligibleFormats: asArray(row.eligible_formats),
        eligibleSessionIds: asArray(row.eligible_session_ids),
        cancellationRules: row.cancellation_rules || {},
        accounting: row.accounting_config || {},
        imageUrl: row.image_url || "",
        isFeatured: Boolean(row.is_featured),
        displayOrder: Number(row.display_order || 100),
        providerPlanId: row.provider_plan_id || "",
        mercadoPagoPlanId: row.mercado_pago_plan_id || row.provider_plan_id || "",
        active: row.active !== false,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
      })),
      subscriptions: subscriptions.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        status: row.status,
        provider: row.provider || "manual_admin",
        providerSubscriptionId: row.provider_subscription_id || "",
        providerPlanId: row.provider_plan_id || "",
        providerStatus: row.provider_status || "",
        providerPaymentId: row.provider_payment_id || "",
        paymentStatus: row.payment_status || (row.status === "active" ? "approved" : "pending"),
        paymentExpiresAt: row.payment_expires_at ? new Date(row.payment_expires_at).toISOString() : "",
        paymentExpiredAt: row.payment_expired_at ? new Date(row.payment_expired_at).toISOString() : "",
        approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : "",
        preferredPaymentMethod: row.preferred_payment_method || "",
        externalBillingPending: Boolean(row.external_billing_pending),
        checkoutUrl: row.checkout_url || "",
        lastAuthorizedPaymentId: row.last_authorized_payment_id || "",
        lastProviderPaymentId: row.last_provider_payment_id || "",
        cycleStart: row.cycle_start ? new Date(row.cycle_start).toISOString() : "",
        cycleEnd: row.cycle_end ? new Date(row.cycle_end).toISOString() : "",
        nextBillingAt: row.next_billing_at ? new Date(row.next_billing_at).toISOString() : "",
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : "",
        currentPeriodKey: row.current_period_key || "",
        currentPeriodStart: row.current_period_start ? new Date(row.current_period_start).toISOString() : "",
        currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end).toISOString() : "",
        creditsAvailable: Number(row.credits_available || 0),
        creditsUsed: Number(row.credits_used || 0),
        assignedBy: row.assigned_by || "",
        assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : "",
        renewedAt: row.renewed_at ? new Date(row.renewed_at).toISOString() : "",
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : "",
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        cancellationRequestedAt: row.cancellation_requested_at ? new Date(row.cancellation_requested_at).toISOString() : "",
        billingCancelledAt: row.billing_cancelled_at ? new Date(row.billing_cancelled_at).toISOString() : "",
        benefitsUntil: row.benefits_until ? new Date(row.benefits_until).toISOString() : "",
        cancellationMode: row.cancellation_mode || "",
        reactivationBlocked: Boolean(row.reactivation_blocked),
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : "",
        archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : "",
        archivedBy: row.archived_by || "",
        history: asArray(row.history),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
      })),
      subscriptionCredits: subscriptionCredits.rows.map((row) => ({
        id: row.id,
        subscriptionId: row.subscription_id,
        cycleStart: row.cycle_start ? new Date(row.cycle_start).toISOString() : "",
        cycleEnd: row.cycle_end ? new Date(row.cycle_end).toISOString() : "",
        total: Number(row.total || 0),
        used: Number(row.used || 0),
        remaining: Number(row.remaining || 0),
        rolloverFromId: row.rollover_from_id || "",
        metadata: row.metadata || {},
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : "",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ""
      })),
      subscriptionUsage: subscriptionUsage.rows.map((row) => ({
        id: row.id,
        subscriptionId: row.subscription_id,
        creditId: row.credit_id || "",
        userId: row.user_id,
        orderId: row.order_id || "",
        ticketId: row.ticket_id || "",
        movieId: row.movie_id || "",
        sessionId: row.session_id || "",
        monthKey: row.month_key || "",
        creditsUsed: Math.max(1, Number(row.credits_used || row.metadata?.creditsUsed || 1)),
        idempotencyKey: row.idempotency_key || "",
        refundedAt: row.refunded_at ? new Date(row.refunded_at).toISOString() : "",
        refundedBy: row.refunded_by || "",
        refundReason: row.refund_reason || "",
        metadata: row.metadata || {},
        usedAt: row.used_at ? new Date(row.used_at).toISOString() : ""
      })),
      subscriptionCycles: subscriptionCycles.rows.map((row) => ({
        id: row.id, subscriptionId: row.subscription_id, customerId: row.customer_id, planId: row.plan_id,
        cycleStart: row.cycle_start?.toISOString?.() || "", cycleEnd: row.cycle_end?.toISOString?.() || "",
        status: row.status, sourcePaymentId: row.source_payment_id || "", idempotencyKey: row.idempotency_key,
        planSnapshot: row.plan_snapshot || {}, accountingSnapshot: row.accounting_snapshot || {},
        createdAt: row.created_at?.toISOString?.() || "", updatedAt: row.updated_at?.toISOString?.() || ""
      })),
      subscriptionPayments: subscriptionPayments.rows.map((row) => ({
        id: row.id, subscriptionId: row.subscription_id, cycleId: row.cycle_id || "", customerId: row.customer_id,
        provider: row.provider, providerPaymentId: row.provider_payment_id || "", amount: num(row.amount), currency: row.currency,
        status: row.status, idempotencyKey: row.idempotency_key,
        approvedAt: row.approved_at?.toISOString?.() || "", failedAt: row.failed_at?.toISOString?.() || "",
        cancelledAt: row.cancelled_at?.toISOString?.() || "", refundedAt: row.refunded_at?.toISOString?.() || "",
        metadata: row.metadata || {}, createdAt: row.created_at?.toISOString?.() || "", updatedAt: row.updated_at?.toISOString?.() || ""
      })),
      subscriptionCreditUnits: subscriptionCreditUnits.rows.map((row) => ({
        id: row.id, subscriptionId: row.subscription_id, customerId: row.customer_id, cycleId: row.cycle_id,
        referenceValue: num(row.reference_value), status: row.status,
        issuedAt: row.issued_at?.toISOString?.() || "", expiresAt: row.expires_at?.toISOString?.() || "",
        reservedAt: row.reserved_at?.toISOString?.() || "", reservationExpiresAt: row.reservation_expires_at?.toISOString?.() || "",
        reservedOrderId: row.reserved_order_id || "", redeemedAt: row.redeemed_at?.toISOString?.() || "",
        cancelledAt: row.cancelled_at?.toISOString?.() || "", rolloverFromId: row.rollover_from_id || "",
        metadata: row.metadata || {}, createdAt: row.created_at?.toISOString?.() || "", updatedAt: row.updated_at?.toISOString?.() || ""
      })),
      subscriptionCreditRedemptions: subscriptionCreditRedemptions.rows.map((row) => ({
        id: row.id, subscriptionCreditId: row.subscription_credit_id, subscriptionId: row.subscription_id,
        orderId: row.order_id, ticketId: row.ticket_id || "", sessionId: row.session_id || "", status: row.status,
        basePrice: num(row.base_price), creditAmount: num(row.credit_amount), additionalPaymentAmount: num(row.additional_payment_amount),
        idempotencyKey: row.idempotency_key, reservedAt: row.reserved_at?.toISOString?.() || "",
        redeemedAt: row.redeemed_at?.toISOString?.() || "", releasedAt: row.released_at?.toISOString?.() || "",
        metadata: row.metadata || {}, createdAt: row.created_at?.toISOString?.() || "", updatedAt: row.updated_at?.toISOString?.() || ""
      })),
      subscriptionAccountingRules: subscriptionAccountingRules.rows.map((row) => ({
        id: row.id, planId: row.plan_id, ruleVersion: row.rule_version, effectiveFrom: row.effective_from?.toISOString?.() || "",
        ticketComponentValue: row.ticket_component_value === null ? null : num(row.ticket_component_value),
        benefitsComponentValue: row.benefits_component_value === null ? null : num(row.benefits_component_value),
        configuration: row.configuration || {}, createdBy: row.created_by || "", createdAt: row.created_at?.toISOString?.() || ""
      })),
      orderServiceItems: orderServiceItems.rows.map((row) => ({
        id: row.id, orderId: row.order_id, ticketId: row.ticket_id || "", itemId: row.item_id, name: row.name,
        quantity: Number(row.quantity), unitPrice: num(row.unit_price), basePrice: num(row.base_price),
        subscriptionCreditAmount: num(row.subscription_credit_amount), additionalPaymentAmount: num(row.additional_payment_amount),
        paymentSource: row.payment_source, subscriptionCreditId: row.subscription_credit_id || "", metadata: row.metadata || {},
        createdAt: row.created_at?.toISOString?.() || ""
      })),
      orderGoodsItems: orderGoodsItems.rows.map((row) => ({
        id: row.id, orderId: row.order_id, concessionId: row.concession_id || "", sku: row.sku || "", name: row.name,
        quantity: Number(row.quantity), originalUnitPrice: num(row.original_unit_price), clubDiscount: num(row.club_discount),
        finalUnitPrice: num(row.final_unit_price), metadata: row.metadata || {}, createdAt: row.created_at?.toISOString?.() || ""
      })),
      goodsFiscalDocuments: goodsFiscalDocuments.rows.map((row) => ({
        id: row.id, orderId: row.order_id, status: row.status, trigger: row.trigger, provider: row.provider || "",
        providerDocumentId: row.provider_document_id || "", documentNumber: row.document_number || "", series: row.series || "",
        accessKey: row.access_key || "", protocol: row.protocol || "", xmlReference: row.xml_reference || "", danfeReference: row.danfe_reference || "",
        idempotencyKey: row.idempotency_key, issuedAt: row.issued_at?.toISOString?.() || "", cancelledAt: row.cancelled_at?.toISOString?.() || "",
        errorCode: row.error_code || "", errorMessage: row.error_message || "", metadata: row.metadata || {},
        createdAt: row.created_at?.toISOString?.() || "", updatedAt: row.updated_at?.toISOString?.() || ""
      }))
    };
  } finally {
    if (!existingClient) client.release();
  }
}

const SNAPSHOT_CACHE_TTL_MS = 500;
let snapshotCache = null;
let snapshotCacheExpiresAt = 0;
let snapshotLoadPromise = null;

function cloneSnapshot(snapshot) {
  return structuredClone(snapshot);
}

function invalidateSnapshotCache() {
  snapshotCache = null;
  snapshotCacheExpiresAt = 0;
}

async function readDbFromPostgres() {
  // Reads made inside a critical mutation must observe the transaction directly.
  if (contextClient()) return loadDbFromPostgres();

  if (snapshotCache && Date.now() < snapshotCacheExpiresAt) {
    return cloneSnapshot(snapshotCache);
  }

  if (!snapshotLoadPromise) {
    snapshotLoadPromise = loadDbFromPostgres()
      .then((snapshot) => {
        snapshotCache = cloneSnapshot(snapshot);
        snapshotCacheExpiresAt = Date.now() + SNAPSHOT_CACHE_TTL_MS;
        return snapshot;
      })
      .finally(() => {
        snapshotLoadPromise = null;
      });
  }

  return cloneSnapshot(await snapshotLoadPromise);
}

async function query(client, text, params = []) {
  return client.query(text, params);
}

async function withPostgresMutationLock(callback) {
  if (contextClient()) return callback();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(318642901, 20260823)");
    const result = await transactionContext.run({ client }, callback);
    await client.query("COMMIT");
    invalidateSnapshotCache();
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function writeDbToPostgres(db) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    if (!existingClient) await client.query("BEGIN");
    const settingsPayload = {
      ...(db.settings || {}),
      integrations: db.integrations || db.settings?.integrations || {},
      emailCampaigns: db.emailCampaigns || db.settings?.emailCampaigns || []
    };
    await query(client, "INSERT INTO settings (key, value, updated_at) VALUES ('app', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [settingsPayload]);

    await query(client, "DELETE FROM subscription_credit_redemptions").catch(() => null);
    await query(client, "DELETE FROM subscription_credit_units").catch(() => null);
    await query(client, "DELETE FROM subscription_payments").catch(() => null);
    await query(client, "DELETE FROM subscription_cycles").catch(() => null);
    await query(client, "DELETE FROM subscription_accounting_rule_versions").catch(() => null);
    await query(client, "DELETE FROM goods_fiscal_documents").catch(() => null);
    await query(client, "DELETE FROM order_service_items").catch(() => null);
    await query(client, "DELETE FROM order_goods_items").catch(() => null);
    await query(client, "DELETE FROM subscription_usage").catch(() => null);
    await query(client, "DELETE FROM subscription_credits").catch(() => null);
    await query(client, "DELETE FROM subscriptions").catch(() => null);
    await query(client, "DELETE FROM subscription_plans").catch(() => null);
    await query(client, "DELETE FROM order_items");
    await query(client, "DELETE FROM tickets");
    await query(client, "DELETE FROM payments");
    await query(client, "DELETE FROM orders");
    await query(client, "DELETE FROM sessions");
    await query(client, "DELETE FROM session_ticket_types");
    await query(client, "DELETE FROM concession_inventory");
    await query(client, "DELETE FROM concessions");
    await query(client, "DELETE FROM promotions");
    await query(client, "DELETE FROM ads");
    await query(client, "DELETE FROM audit_logs");
    await query(client, "DELETE FROM webhook_events");
    await query(client, "DELETE FROM ticket_types");
    await query(client, "DELETE FROM movies");
    await query(client, "DELETE FROM rooms");
    await query(client, "DELETE FROM users");

    for (const user of asArray(db.users)) {
      await query(client, `INSERT INTO users (id, name, email, phone, cpf, password_hash, auth_provider, google_sub, picture, email_verified, pending_email, email_verification_hash, email_verification_expires_at, email_verification_requested_at, password_reset_hash, password_reset_expires_at, password_reset_requested_at, email_unsubscribed_at, email_unsubscribe_token, two_factor_enabled, two_factor_secret, two_factor_pending_secret, two_factor_recovery_codes, two_factor_confirmed_at, two_factor_updated_at, admin_permissions, use_custom_permissions, session_version, role, active, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),$9,$10,$11,NULLIF($12,''),NULLIF($13,'')::timestamptz,NULLIF($14,'')::timestamptz,NULLIF($15,''),NULLIF($16,'')::timestamptz,NULLIF($17,'')::timestamptz,NULLIF($18,'')::timestamptz,NULLIF($19,''),$20,NULLIF($21,''),NULLIF($22,''),$23::jsonb,NULLIF($24,'')::timestamptz,NULLIF($25,'')::timestamptz,$26::jsonb,$27,$28,$29,$30,COALESCE(NULLIF($31,'')::timestamptz, now()),COALESCE(NULLIF($32,'')::timestamptz, now()))`, [
        user.id,
        user.name,
        user.email,
        user.phone || "",
        user.cpf || "",
        user.passwordHash || "",
        user.authProvider || "email",
        user.googleSub || "",
        user.picture || "",
        Boolean(user.emailVerified),
        user.pendingEmail || "",
        user.emailVerificationHash || "",
        user.emailVerificationExpiresAt || "",
        user.emailVerificationRequestedAt || "",
        user.passwordResetHash || "",
        user.passwordResetExpiresAt || "",
        user.passwordResetRequestedAt || "",
        user.emailUnsubscribedAt || "",
        user.emailUnsubscribeToken || "",
        Boolean(user.twoFactorEnabled),
        user.twoFactorSecret || "",
        user.twoFactorPendingSecret || "",
        JSON.stringify(Array.isArray(user.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes : []),
        user.twoFactorConfirmedAt || "",
        user.twoFactorUpdatedAt || "",
        JSON.stringify(Array.isArray(user.adminPermissions) ? user.adminPermissions : []),
        Boolean(user.useCustomPermissions),
        Number(user.sessionVersion || 0),
        user.role || "customer",
        user.active !== false,
        user.createdAt || null,
        user.updatedAt || null
      ]);
    }

    for (const room of asArray(db.rooms)) {
      await query(client, "INSERT INTO rooms (id, name, capacity, technology, status, seat_selection_enabled, seat_types, seat_layout) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)", [
        room.id,
        room.name,
        Number(room.capacity || 120),
        room.technology || "",
        room.status || "active",
        Boolean(room.seatSelectionEnabled),
        JSON.stringify(asArray(room.seatTypes)),
        JSON.stringify(room.seatLayout && typeof room.seatLayout === "object" ? room.seatLayout : { screenLabel: "TELA", rows: [] })
      ]);
    }
    const firstRoomId = asArray(db.rooms)[0]?.id || "sala-cruzeiro";

    for (const ticket of asArray(db.ticketTypes)) {
      await query(client, "INSERT INTO ticket_types (id, name, price, description, active, bundle_quantity) VALUES ($1,$2,$3,$4,$5,$6)", [
        ticket.id,
        ticket.name,
        num(ticket.price, 10),
        ticket.description || "",
        ticket.active !== false,
        Math.max(1, Number(ticket.bundleQuantity || 1))
      ]);
    }

    for (const movie of asArray(db.movies)) {
      await query(client, `INSERT INTO movies (id, slug, workflow_status, sort_order, status, title, original_title, synopsis, duration, director, metadata, genre, rating, poster_url, backdrop_url, trailer_youtube_id, trailer_video_url, local_trailer_url, trailer_source_url, trailer_cache_status, trailer_cache_error, is_highlight, highlight_trailer_background, release_date, auto_publish, published_at, tag)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NULLIF($24,'')::date,$25,NULLIF($26,'')::timestamptz,$27)`, [
        movie.id,
        movie.slug || movie.id,
        movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published"),
        num(movie.sortOrder, 100),
        movie.status || "upcoming",
        movie.title,
        movie.originalTitle || "",
        movie.synopsis || "",
        movie.duration || "",
        movie.director || "",
        JSON.stringify(movie.metadata || {}),
        asArray(movie.genre),
        movie.rating || "L",
        movie.posterUrl || "",
        movie.backdropUrl || "",
        movie.trailerYoutubeId || "",
        movie.trailerVideoUrl || "",
        movie.localTrailerUrl || "",
        movie.trailerSourceUrl || "",
        movie.trailerCacheStatus || "idle",
        movie.trailerCacheError || "",
        Boolean(movie.isHighlight),
        movie.highlightTrailerBackground !== false,
        pgDate(movie.releaseDate),
        Boolean(movie.autoPublish),
        movie.publishedAt || "",
        movie.tag || ""
      ]);

      for (const session of asArray(movie.sessions)) {
      const sessionDate = pgDate(session.date);
      const sessionTime = String(session.time || "00:00").trim();
      const startsAt = sessionDate && /^\d{2}:\d{2}$/.test(sessionTime) ? `${sessionDate} ${sessionTime}:00-03` : "";
      await query(client, `INSERT INTO sessions (id, movie_id, room_id, starts_at, time_label, room_label, format, price_full, price_half, status)
          VALUES ($1,$2,$3,NULLIF($4,'')::timestamptz,$5,$6,$7,$8,$9,$10)`, [
          session.id,
          movie.id,
          firstRoomId,
          startsAt,
          session.time,
          session.room || "",
          session.format,
          num(session.priceFull, 10),
          num(session.priceHalf, 10),
          session.status || "available"
        ]);
        for (const [position, ticketTypeId] of asArray(session.ticketTypeIds).entries()) {
          if (!asArray(db.ticketTypes).some((ticketType) => ticketType.id === ticketTypeId)) continue;
          await query(client, `INSERT INTO session_ticket_types (session_id, ticket_type_id, position)
            VALUES ($1,$2,$3) ON CONFLICT (session_id, ticket_type_id) DO UPDATE SET position = EXCLUDED.position`, [
            session.id,
            ticketTypeId,
            (position + 1) * 10
          ]);
        }
      }
    }

    for (const item of asArray(db.concessions)) {
      await query(client, `INSERT INTO concessions (id, sku, name, description, image_url, badge, price, compare_at, category, max_per_order, featured, sort_order, tags, combo_items, active)
        VALUES ($1,NULLIF($2,''),$3,$4,$5,$6,$7,NULLIF($8,'')::numeric,$9,$10,$11,$12,$13,$14,$15)`, [
        item.id,
        item.sku || "",
        item.name,
        item.description || "",
        item.imageUrl || "",
        item.badge || "",
        num(item.price),
        item.compareAt === "" || item.compareAt === undefined ? "" : String(item.compareAt),
        item.category || "combo",
        Number(item.maxPerOrder || 8),
        Boolean(item.featured),
        Number(item.sortOrder || 100),
        asArray(item.tags),
        JSON.stringify(asArray(item.comboItems)),
        item.active !== false
      ]);
      await query(client, "INSERT INTO concession_inventory (concession_id, available, reserved, sold) VALUES ($1,$2,$3,$4)", [
        item.id,
        item.stock === "" || item.stock === undefined ? null : Number(item.stock || 0),
        Number(item.reserved || 0),
        Number(item.sold || 0)
      ]);
    }

    for (const item of asArray(db.promotions)) {
      await query(client, `INSERT INTO promotions (id, title, description, discount_type, value, coupon_code, starts_at, ends_at, active, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::timestamptz,NULLIF($8,'')::timestamptz,$9,$10)`, [
        item.id,
        item.title,
        item.description || "",
        item.discountType || "fixed_price",
        num(item.value),
        item.couponCode || "",
        item.startsAt || "",
        item.endsAt || "",
        item.active !== false,
        item
      ]);
    }

    for (const item of asArray(db.ads)) {
      await query(client, "INSERT INTO ads (id, title, description, image_url, cta_label, cta_url, placement, active, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
        item.id,
        item.title,
        item.description || "",
        item.imageUrl || "",
        item.ctaLabel || "",
        item.linkUrl || item.ctaUrl || "",
        item.placement || "",
        item.active !== false,
        item
      ]);
    }

    const movieIds = new Set(asArray(db.movies).map((movie) => movie.id));
    const sessionIds = new Set(asArray(db.movies).flatMap((movie) => asArray(movie.sessions).map((session) => session.id)));
    const userIds = new Set(asArray(db.users).map((user) => user.id));
    for (const order of asArray(db.orders)) {
      await query(client, `INSERT INTO orders (id, customer_user_id, customer_name, customer_email, customer_phone, customer_cpf, movie_id, session_id, status, subtotal, discount_total, total, currency, reservation_expires_at, idempotency_key, service_subtotal, goods_subtotal, club_credits_applied, club_discount, additional_payment, service_fiscal_status, goods_fiscal_status, goods_fiscal_trigger, metadata, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'BRL',NULLIF($13,'')::timestamptz,NULLIF($14,''),$15,$16,$17,$18,$19,$20,$21,$22,$23,COALESCE(NULLIF($24,'')::timestamptz, now()),now())`, [
        order.id,
        userIds.has(order.customerUserId) ? order.customerUserId : null,
        order.customerName || "Cliente Cine Cruzeiro",
        order.customerEmail || "",
        order.customerPhone || "",
        order.customerCpf || "",
        movieIds.has(order.movieId) ? order.movieId : null,
        sessionIds.has(order.sessionId) ? order.sessionId : null,
        order.status === "pix_pending" ? "pending_payment" : order.status || "pending_payment",
        num(order.totalPrice),
        num(order.discountValue),
        num(order.totalPrice),
        order.reservationExpiresAt || "",
        order.idempotencyKey || "",
        num(order.serviceSubtotal ?? asArray(order.ticketItems).reduce((sum, item) => sum + Number(item.quantity || 0) * num(item.unitPrice), 0)),
        num(order.goodsSubtotal),
        num(order.clubCreditsApplied),
        num(order.clubDiscount),
        num(order.additionalPayment ?? order.totalPrice),
        order.serviceFiscalStatus || "not_applicable",
        order.goodsFiscalStatus || "not_required",
        order.goodsFiscalTrigger || "goods_delivered",
        order,
        order.createdAt || ""
      ]);

      for (const item of asArray(order.concessionItems)) {
        await query(client, "INSERT INTO order_items (order_id, item_type, item_id, name, quantity, unit_price, total_price, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [
          order.id,
          item.category === "promocao" ? "promotion" : "concession",
          item.id,
          item.name,
          Number(item.quantity || 1),
          num(item.unitPrice),
          Number(item.quantity || 1) * num(item.unitPrice),
          item
        ]);
      }
      for (const item of asArray(order.ticketItems)) {
        await query(client, "INSERT INTO order_items (order_id, item_type, item_id, name, quantity, unit_price, total_price, metadata) VALUES ($1,'ticket',$2,$3,$4,$5,$6,$7)", [
          order.id,
          item.id,
          item.name || "Ingresso",
          Number(item.quantity || 1),
          num(item.unitPrice),
          Number(item.quantity || 1) * num(item.unitPrice),
          item
        ]);
      }
    }

    for (const payment of asArray(db.payments)) {
      if (!asArray(db.orders).some((order) => order.id === payment.orderId)) continue;
      await query(client, `INSERT INTO payments (id, order_id, method, provider, provider_payment_id, provider_reference, status, amount, currency, created_at, updated_at, approved_at, expired_at, cancelled_at, refunded_at, metadata)
        VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),$7,$8,$9,COALESCE(NULLIF($10,'')::timestamptz, now()),COALESCE(NULLIF($11,'')::timestamptz, now()),NULLIF($12,'')::timestamptz,NULLIF($13,'')::timestamptz,NULLIF($14,'')::timestamptz,NULLIF($15,'')::timestamptz,$16)`, [
        payment.id,
        payment.orderId,
        payment.method || "pix",
        payment.provider || "open_finance",
        payment.providerPaymentId || "",
        payment.providerReference || "",
        payment.status || "pending",
        num(payment.amount || payment.totalPrice),
        payment.currency || "BRL",
        payment.createdAt || "",
        payment.updatedAt || "",
        payment.approvedAt || "",
        payment.expiredAt || "",
        payment.cancelledAt || "",
        payment.refundedAt || "",
        payment
      ]);
    }

    for (const ticket of asArray(db.tickets)) {
      if (!asArray(db.orders).some((order) => order.id === ticket.orderId)) continue;
      await query(client, `INSERT INTO tickets (id, order_id, movie_id, session_id, code, qr_payload, ticket_type, status, customer_name, customer_email, customer_phone, customer_cpf, source, used_at, used_by, ticket_number, base_price, subscription_credit_amount, additional_payment_amount, payment_source, subscription_credit_id, metadata, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULLIF($14,'')::timestamptz,$15,$16,$17,$18,$19,$20,$21,$22,COALESCE(NULLIF($23,'')::timestamptz, now()))`, [
        ticket.id,
        ticket.orderId,
        movieIds.has(ticket.movieId) ? ticket.movieId : null,
        sessionIds.has(ticket.sessionId) ? ticket.sessionId : null,
        ticket.code,
        ticket.qrPayload,
        ticket.ticketType || "Inteira",
        ticket.status || "active",
        ticket.customerName || "",
        ticket.customerEmail || "",
        ticket.customerPhone || "",
        ticket.customerCpf || "",
        ticket.source || "online",
        ticket.usedAt || "",
        ticket.usedBy || "",
        Number(ticket.ticketNumber || (asArray(db.tickets).indexOf(ticket) + 1)),
        num(ticket.basePrice),
        num(ticket.subscriptionCreditAmount),
        num(ticket.additionalPaymentAmount),
        ticket.paymentSource || "standard",
        null,
        ticket,
        ticket.createdAt || ""
      ]);
    }

    for (const plan of asArray(db.subscriptionPlans)) {
      await query(client, `INSERT INTO subscription_plans (id, name, monthly_price, included_tickets, billing_cycle, benefits, ticket_discount_percent, concession_discount_percent, free_concession_items, image_url, is_featured, display_order, provider_plan_id, mercado_pago_plan_id, active, credit_reference_value, credit_validity_days, allow_credit_rollover, max_accumulated_credits, grace_period_days, allow_price_difference, excluded_concession_ids, eligible_formats, eligible_session_ids, cancellation_rules, accounting_config, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULLIF($17,0),$18,NULLIF($19,0),$20,$21,$22,$23,$24,$25,$26,COALESCE(NULLIF($27,'')::timestamptz, now()),COALESCE(NULLIF($28,'')::timestamptz, now()))`, [
        plan.id,
        plan.name,
        num(plan.monthlyPrice ?? plan.price),
        Number(plan.includedTickets ?? plan.ticketsPerCycle ?? 0),
        plan.billingCycle || "monthly",
        JSON.stringify(asArray(plan.benefits)),
        num(plan.ticketDiscountPercent),
        num(plan.concessionDiscountPercent),
        JSON.stringify(asArray(plan.freeConcessionItems)),
        plan.imageUrl || "",
        Boolean(plan.isFeatured),
        Number(plan.displayOrder || 100),
        plan.providerPlanId || plan.mercadoPagoPlanId || "",
        plan.mercadoPagoPlanId || plan.providerPlanId || "",
        plan.active !== false,
        plan.creditReferenceValue === null || plan.creditReferenceValue === undefined ? null : num(plan.creditReferenceValue),
        Number(plan.creditValidityDays || 0),
        Boolean(plan.allowCreditRollover),
        Number(plan.maxAccumulatedCredits || 0),
        Number(plan.gracePeriodDays || 0),
        plan.allowPriceDifference !== false,
        JSON.stringify(asArray(plan.excludedConcessionIds)),
        JSON.stringify(asArray(plan.eligibleFormats)),
        JSON.stringify(asArray(plan.eligibleSessionIds)),
        JSON.stringify(plan.cancellationRules || {}),
        JSON.stringify(plan.accounting || plan.accountingConfig || {}),
        plan.createdAt || "",
        plan.updatedAt || ""
      ]);
    }

    const planIds = new Set(asArray(db.subscriptionPlans).map((plan) => plan.id));
    const persistedSubscriptionIds = new Set();
    for (const subscription of asArray(db.subscriptions)) {
      if (!userIds.has(subscription.userId) || !planIds.has(subscription.planId)) continue;
      await query(client, `INSERT INTO subscriptions (id, user_id, plan_id, status, provider, provider_subscription_id, provider_plan_id, provider_status, provider_payment_id, payment_status, payment_expires_at, payment_expired_at, approved_at, preferred_payment_method, external_billing_pending, checkout_url, last_authorized_payment_id, last_provider_payment_id, cycle_start, cycle_end, next_billing_at, started_at, current_period_key, current_period_start, current_period_end, credits_available, credits_used, assigned_by, assigned_at, renewed_at, cancelled_at, cancel_at_period_end, cancellation_requested_at, billing_cancelled_at, benefits_until, cancellation_mode, reactivation_blocked, ended_at, archived_at, archived_by, history, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),$10,NULLIF($11,'')::timestamptz,NULLIF($12,'')::timestamptz,NULLIF($13,'')::timestamptz,NULLIF($14,''),$15,NULLIF($16,''),NULLIF($17,''),NULLIF($18,''),NULLIF($19,'')::timestamptz,NULLIF($20,'')::timestamptz,NULLIF($21,'')::timestamptz,NULLIF($22,'')::timestamptz,$23,NULLIF($24,'')::timestamptz,NULLIF($25,'')::timestamptz,$26,$27,$28,NULLIF($29,'')::timestamptz,NULLIF($30,'')::timestamptz,NULLIF($31,'')::timestamptz,$32,NULLIF($33,'')::timestamptz,NULLIF($34,'')::timestamptz,NULLIF($35,'')::timestamptz,NULLIF($36,''),$37,NULLIF($38,'')::timestamptz,NULLIF($39,'')::timestamptz,$40,$41,COALESCE(NULLIF($42,'')::timestamptz, now()),COALESCE(NULLIF($43,'')::timestamptz, now()))`, [
        subscription.id,
        subscription.userId,
        subscription.planId,
        subscription.status || "active",
        subscription.provider || "manual_admin",
        subscription.providerSubscriptionId || "",
        subscription.providerPlanId || "",
        subscription.providerStatus || "",
        subscription.providerPaymentId || "",
        subscription.paymentStatus || (subscription.status === "active" ? "approved" : "pending"),
        subscription.paymentExpiresAt || "",
        subscription.paymentExpiredAt || "",
        subscription.approvedAt || "",
        subscription.preferredPaymentMethod || "",
        Boolean(subscription.externalBillingPending),
        subscription.checkoutUrl || "",
        subscription.lastAuthorizedPaymentId || "",
        subscription.lastProviderPaymentId || "",
        subscription.cycleStart || subscription.currentPeriodStart || "",
        subscription.cycleEnd || subscription.currentPeriodEnd || "",
        subscription.nextBillingAt || "",
        subscription.startedAt || "",
        subscription.currentPeriodKey || "",
        subscription.currentPeriodStart || "",
        subscription.currentPeriodEnd || "",
        Number(subscription.creditsAvailable || 0),
        Number(subscription.creditsUsed || 0),
        userIds.has(subscription.assignedBy) ? subscription.assignedBy : null,
        subscription.assignedAt || "",
        subscription.renewedAt || "",
        subscription.cancelledAt || "",
        Boolean(subscription.cancelAtPeriodEnd),
        subscription.cancellationRequestedAt || "",
        subscription.billingCancelledAt || "",
        subscription.benefitsUntil || "",
        subscription.cancellationMode || "",
        Boolean(subscription.reactivationBlocked),
        subscription.endedAt || "",
        subscription.archivedAt || "",
        userIds.has(subscription.archivedBy) ? subscription.archivedBy : null,
        JSON.stringify(asArray(subscription.history)),
        subscription.createdAt || "",
        subscription.updatedAt || ""
      ]);
      persistedSubscriptionIds.add(subscription.id);
    }

    for (const credit of asArray(db.subscriptionCredits)) {
      if (!persistedSubscriptionIds.has(credit.subscriptionId)) continue;
      await query(client, `INSERT INTO subscription_credits (id, subscription_id, cycle_start, cycle_end, total, used, remaining, rollover_from_id, metadata, created_at, updated_at)
        VALUES ($1,$2,NULLIF($3,'')::timestamptz,NULLIF($4,'')::timestamptz,$5,$6,$7,NULLIF($8,''),$9,COALESCE(NULLIF($10,'')::timestamptz, now()),COALESCE(NULLIF($11,'')::timestamptz, now()))`, [
        credit.id,
        credit.subscriptionId,
        credit.cycleStart || "",
        credit.cycleEnd || "",
        Number(credit.total || 0),
        Number(credit.used || 0),
        Number(credit.remaining || 0),
        credit.rolloverFromId || "",
        JSON.stringify(credit.metadata || {}),
        credit.createdAt || "",
        credit.updatedAt || ""
      ]);
    }

    const orderIds = new Set(asArray(db.orders).map((order) => order.id));
    const ticketIds = new Set(asArray(db.tickets).map((ticket) => ticket.id));
    for (const usage of asArray(db.subscriptionUsage)) {
      if (!persistedSubscriptionIds.has(usage.subscriptionId) || !userIds.has(usage.userId)) continue;
      await query(client, `INSERT INTO subscription_usage (id, subscription_id, credit_id, user_id, order_id, ticket_id, movie_id, session_id, month_key, credits_used, idempotency_key, refunded_at, refunded_by, refund_reason, metadata, used_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULLIF($11,''),NULLIF($12,'')::timestamptz,NULLIF($13,''),$14,$15,COALESCE(NULLIF($16,'')::timestamptz, now()))`, [
        usage.id,
        usage.subscriptionId,
        usage.creditId || null,
        usage.userId,
        orderIds.has(usage.orderId) ? usage.orderId : null,
        ticketIds.has(usage.ticketId) ? usage.ticketId : null,
        movieIds.has(usage.movieId) ? usage.movieId : null,
        sessionIds.has(usage.sessionId) ? usage.sessionId : null,
        usage.monthKey || "",
        Math.max(1, Number(usage.creditsUsed || usage.metadata?.creditsUsed || 1)),
        usage.idempotencyKey || "",
        usage.refundedAt || "",
        usage.refundedBy || "",
        usage.refundReason || "",
        JSON.stringify(usage.metadata || {}),
        usage.usedAt || ""
      ]);
    }

    for (const rule of asArray(db.subscriptionAccountingRules)) {
      if (!planIds.has(rule.planId)) continue;
      await query(client, `INSERT INTO subscription_accounting_rule_versions
        (id, plan_id, rule_version, effective_from, ticket_component_value, benefits_component_value, configuration, created_by, created_at)
        VALUES ($1,$2,$3,NULLIF($4,'')::timestamptz,$5,$6,$7,$8,COALESCE(NULLIF($9,'')::timestamptz, now()))`, [
        rule.id, rule.planId, rule.ruleVersion, rule.effectiveFrom || rule.createdAt || new Date().toISOString(),
        rule.ticketComponentValue === null || rule.ticketComponentValue === undefined ? null : num(rule.ticketComponentValue),
        rule.benefitsComponentValue === null || rule.benefitsComponentValue === undefined ? null : num(rule.benefitsComponentValue),
        JSON.stringify(rule.configuration || {}), userIds.has(rule.createdBy) ? rule.createdBy : null, rule.createdAt || ""
      ]);
    }

    const persistedCycleIds = new Set();
    for (const cycle of asArray(db.subscriptionCycles)) {
      if (!persistedSubscriptionIds.has(cycle.subscriptionId) || !userIds.has(cycle.customerId) || !planIds.has(cycle.planId)) continue;
      await query(client, `INSERT INTO subscription_cycles
        (id, subscription_id, customer_id, plan_id, cycle_start, cycle_end, status, source_payment_id, idempotency_key, plan_snapshot, accounting_snapshot, created_at, updated_at)
        VALUES ($1,$2,$3,$4,NULLIF($5,'')::timestamptz,NULLIF($6,'')::timestamptz,$7,NULLIF($8,''),$9,$10,$11,COALESCE(NULLIF($12,'')::timestamptz, now()),COALESCE(NULLIF($13,'')::timestamptz, now()))`, [
        cycle.id, cycle.subscriptionId, cycle.customerId, cycle.planId, cycle.cycleStart, cycle.cycleEnd, cycle.status || "active",
        cycle.sourcePaymentId || "", cycle.idempotencyKey, JSON.stringify(cycle.planSnapshot || {}), JSON.stringify(cycle.accountingSnapshot || {}),
        cycle.createdAt || "", cycle.updatedAt || ""
      ]);
      persistedCycleIds.add(cycle.id);
    }

    for (const payment of asArray(db.subscriptionPayments)) {
      if (!persistedSubscriptionIds.has(payment.subscriptionId) || !userIds.has(payment.customerId)) continue;
      await query(client, `INSERT INTO subscription_payments
        (id, subscription_id, cycle_id, customer_id, provider, provider_payment_id, amount, currency, status, idempotency_key, approved_at, failed_at, cancelled_at, refunded_at, metadata, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),$7,$8,$9,$10,NULLIF($11,'')::timestamptz,NULLIF($12,'')::timestamptz,NULLIF($13,'')::timestamptz,NULLIF($14,'')::timestamptz,$15,COALESCE(NULLIF($16,'')::timestamptz, now()),COALESCE(NULLIF($17,'')::timestamptz, now()))`, [
        payment.id, payment.subscriptionId, persistedCycleIds.has(payment.cycleId) ? payment.cycleId : null, payment.customerId,
        payment.provider || "unknown", payment.providerPaymentId || "", num(payment.amount), payment.currency || "BRL", payment.status || "pending",
        payment.idempotencyKey, payment.approvedAt || "", payment.failedAt || "", payment.cancelledAt || "", payment.refundedAt || "",
        JSON.stringify(payment.metadata || {}), payment.createdAt || "", payment.updatedAt || ""
      ]);
    }

    const persistedCreditUnitIds = new Set();
    for (const credit of asArray(db.subscriptionCreditUnits)) {
      if (!persistedSubscriptionIds.has(credit.subscriptionId) || !persistedCycleIds.has(credit.cycleId) || !userIds.has(credit.customerId)) continue;
      await query(client, `INSERT INTO subscription_credit_units
        (id, subscription_id, customer_id, cycle_id, reference_value, status, issued_at, expires_at, reserved_at, reservation_expires_at, reserved_order_id, redeemed_at, cancelled_at, rollover_from_id, metadata, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::timestamptz,NULLIF($8,'')::timestamptz,NULLIF($9,'')::timestamptz,NULLIF($10,'')::timestamptz,$11,NULLIF($12,'')::timestamptz,NULLIF($13,'')::timestamptz,$14,$15,COALESCE(NULLIF($16,'')::timestamptz, now()),COALESCE(NULLIF($17,'')::timestamptz, now()))`, [
        credit.id, credit.subscriptionId, credit.customerId, credit.cycleId, num(credit.referenceValue), credit.status || "available",
        credit.issuedAt, credit.expiresAt, credit.reservedAt || "", credit.reservationExpiresAt || "",
        orderIds.has(credit.reservedOrderId) ? credit.reservedOrderId : null, credit.redeemedAt || "", credit.cancelledAt || "", null,
        JSON.stringify(credit.metadata || {}), credit.createdAt || "", credit.updatedAt || ""
      ]);
      persistedCreditUnitIds.add(credit.id);
    }

    for (const ticket of asArray(db.tickets)) {
      if (persistedCreditUnitIds.has(ticket.subscriptionCreditId)) {
        await query(client, "UPDATE tickets SET subscription_credit_id = $2 WHERE id = $1", [ticket.id, ticket.subscriptionCreditId]);
      }
    }

    for (const redemption of asArray(db.subscriptionCreditRedemptions)) {
      if (!persistedCreditUnitIds.has(redemption.subscriptionCreditId) || !orderIds.has(redemption.orderId)) continue;
      await query(client, `INSERT INTO subscription_credit_redemptions
        (id, subscription_credit_id, subscription_id, order_id, ticket_id, session_id, status, base_price, credit_amount, additional_payment_amount, idempotency_key, reserved_at, redeemed_at, released_at, metadata, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULLIF($12,'')::timestamptz,NULLIF($13,'')::timestamptz,NULLIF($14,'')::timestamptz,$15,COALESCE(NULLIF($16,'')::timestamptz, now()),COALESCE(NULLIF($17,'')::timestamptz, now()))`, [
        redemption.id, redemption.subscriptionCreditId, redemption.subscriptionId, redemption.orderId,
        ticketIds.has(redemption.ticketId) ? redemption.ticketId : null, sessionIds.has(redemption.sessionId) ? redemption.sessionId : null,
        redemption.status || "reserved", num(redemption.basePrice), num(redemption.creditAmount), num(redemption.additionalPaymentAmount),
        redemption.idempotencyKey, redemption.reservedAt, redemption.redeemedAt || "", redemption.releasedAt || "",
        JSON.stringify(redemption.metadata || {}), redemption.createdAt || "", redemption.updatedAt || ""
      ]);
    }

    for (const item of asArray(db.orderServiceItems)) {
      if (!orderIds.has(item.orderId)) continue;
      await query(client, `INSERT INTO order_service_items
        (id, order_id, ticket_id, item_id, name, quantity, unit_price, base_price, subscription_credit_amount, additional_payment_amount, payment_source, subscription_credit_id, metadata, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE(NULLIF($14,'')::timestamptz, now()))`, [
        item.id, item.orderId, ticketIds.has(item.ticketId) ? item.ticketId : null, item.itemId, item.name, Number(item.quantity || 1),
        num(item.unitPrice), num(item.basePrice), num(item.subscriptionCreditAmount), num(item.additionalPaymentAmount), item.paymentSource || "standard",
        persistedCreditUnitIds.has(item.subscriptionCreditId) ? item.subscriptionCreditId : null, JSON.stringify(item.metadata || {}), item.createdAt || ""
      ]);
    }

    for (const item of asArray(db.orderGoodsItems)) {
      if (!orderIds.has(item.orderId)) continue;
      await query(client, `INSERT INTO order_goods_items
        (id, order_id, concession_id, sku, name, quantity, original_unit_price, club_discount, final_unit_price, metadata, created_at)
        VALUES ($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8,$9,$10,COALESCE(NULLIF($11,'')::timestamptz, now()))`, [
        item.id, item.orderId, asArray(db.concessions).some((entry) => entry.id === item.concessionId) ? item.concessionId : null,
        item.sku || "", item.name, Number(item.quantity || 1), num(item.originalUnitPrice), num(item.clubDiscount), num(item.finalUnitPrice),
        JSON.stringify(item.metadata || {}), item.createdAt || ""
      ]);
    }

    for (const document of asArray(db.goodsFiscalDocuments)) {
      if (!orderIds.has(document.orderId)) continue;
      await query(client, `INSERT INTO goods_fiscal_documents
        (id, order_id, status, trigger, provider, provider_document_id, document_number, series, access_key, protocol, xml_reference, danfe_reference, idempotency_key, issued_at, cancelled_at, error_code, error_message, metadata, created_at, updated_at)
        VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),NULLIF($12,''),$13,NULLIF($14,'')::timestamptz,NULLIF($15,'')::timestamptz,NULLIF($16,''),NULLIF($17,''),$18,COALESCE(NULLIF($19,'')::timestamptz, now()),COALESCE(NULLIF($20,'')::timestamptz, now()))`, [
        document.id, document.orderId, document.status || "not_required", document.trigger || "goods_delivered", document.provider || "",
        document.providerDocumentId || "", document.documentNumber || "", document.series || "", document.accessKey || "", document.protocol || "",
        document.xmlReference || "", document.danfeReference || "", document.idempotencyKey, document.issuedAt || "", document.cancelledAt || "",
        document.errorCode || "", document.errorMessage || "", JSON.stringify(document.metadata || {}), document.createdAt || "", document.updatedAt || ""
      ]);
    }

    for (const event of asArray(db.webhookEvents)) {
      await query(client, "INSERT INTO webhook_events (provider, event_id, provider_payment_id, order_id, status, payload, created_at) VALUES ($1,$2,$3,$4,$5,$6,COALESCE(NULLIF($7,'')::timestamptz, now()))", [
        event.provider || "unknown",
        event.eventId || `${event.provider || "event"}-${Date.now()}`,
        event.providerPaymentId || "",
        event.orderId || "",
        event.status || "",
        event,
        event.createdAt || ""
      ]);
    }

    for (const log of asArray(db.auditLogs)) {
      await query(client, "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before, after, ip, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE(NULLIF($8,'')::timestamptz, now()))", [
        userIds.has(log.userId) ? log.userId : null,
        log.action || "unknown",
        log.entityType || "system",
        log.entityId || "",
        jsonParam(log.before),
        jsonParam(log.after),
        log.ip || "",
        log.createdAt || log.at || ""
      ]);
    }

    if (!existingClient) {
      await client.query("COMMIT");
      invalidateSnapshotCache();
    }
  } catch (error) {
    if (!existingClient) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (!existingClient) client.release();
  }
}

async function appendAuditLogToPostgres(log) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    await query(client, "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before, after, ip, created_at) VALUES ((SELECT id FROM users WHERE id = $1),$2,$3,$4,$5,$6,$7,COALESCE(NULLIF($8,'')::timestamptz, now()))", [
      log.userId || null,
      log.action || "unknown",
      log.entityType || "system",
      log.entityId || "",
      jsonParam(log.before),
      jsonParam(log.after),
      log.ip || "",
      log.createdAt || log.at || ""
    ]);
    if (!existingClient) invalidateSnapshotCache();
  } finally {
    if (!existingClient) client.release();
  }
}

async function appendSystemLogToPostgres(log) {
  if (!postgresEnabled()) return null;
  const client = await getPool().connect();
  try {
    const result = await query(client, `INSERT INTO system_logs
      (level, category, event, message, request_id, actor_user_id, actor_email, method, path, status_code, duration_ms, ip, user_agent, metadata, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE(NULLIF($15,'')::timestamptz, now()))
      RETURNING id`, [
      log.level || "info",
      log.category || "system",
      log.event || "system.event",
      log.message || "",
      log.requestId || "",
      log.actorUserId || "",
      log.actorEmail || "",
      log.method || "",
      log.path || "",
      Number.isFinite(Number(log.statusCode)) ? Number(log.statusCode) : null,
      Number.isFinite(Number(log.durationMs)) ? Math.max(0, Math.round(Number(log.durationMs))) : null,
      log.ip || "",
      log.userAgent || "",
      jsonParam(log.metadata, {}),
      log.createdAt || ""
    ]);
    return result.rows[0]?.id || null;
  } finally {
    client.release();
  }
}

async function listSystemLogsFromPostgres(filters = {}) {
  const client = await getPool().connect();
  try {
    const values = [];
    const where = [];
    const add = (clause, value) => {
      values.push(value);
      where.push(clause.replace("?", `$${values.length}`));
    };
    if (filters.level) add("level = ?", filters.level);
    if (filters.category) {
      values.push(filters.category, `${filters.category}.%`, `${filters.category}_%`);
      const index = values.length;
      where.push(`(category = $${index - 2} OR event LIKE $${index - 1} OR event LIKE $${index})`);
    }
    if (filters.view !== "technical") {
      values.push(filters.businessEvents || []);
      where.push(`(level = 'error' OR event = ANY($${values.length}::text[]))`);
    }
    if (filters.from) add("created_at >= NULLIF(?, '')::timestamptz", filters.from);
    if (filters.to) add("created_at <= NULLIF(?, '')::timestamptz", filters.to);
    if (filters.search) {
      values.push(`%${filters.search}%`);
      const index = values.length;
      where.push(`(event ILIKE $${index} OR message ILIKE $${index} OR actor_email ILIKE $${index} OR path ILIKE $${index} OR request_id ILIKE $${index} OR metadata::text ILIKE $${index})`);
    }
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(filters.pageSize || 50)));
    const predicate = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await query(client, `SELECT COUNT(*)::INTEGER AS total FROM system_logs ${predicate}`, values);
    values.push(pageSize, (page - 1) * pageSize);
    const rows = await query(client, `SELECT * FROM system_logs ${predicate} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    const statsValues = [];
    let statsVisibility = "";
    if (filters.view !== "technical") {
      statsValues.push(filters.businessEvents || []);
      statsVisibility = `AND (level = 'error' OR event = ANY($1::text[]))`;
    }
    const stats = await query(client, `SELECT level, COUNT(*)::INTEGER AS total FROM system_logs
      WHERE created_at >= now() - interval '24 hours' ${statsVisibility} GROUP BY level`, statsValues);
    return {
      logs: rows.rows.map((row) => ({
        id: row.id,
        level: row.level,
        category: row.category,
        event: row.event,
        message: row.message || "",
        requestId: row.request_id || "",
        actorUserId: row.actor_user_id || "",
        actorEmail: row.actor_email || "",
        method: row.method || "",
        path: row.path || "",
        statusCode: row.status_code,
        durationMs: row.duration_ms,
        ip: row.ip || "",
        userAgent: row.user_agent || "",
        metadata: row.metadata || {},
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : ""
      })),
      total: Number(count.rows[0]?.total || 0),
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(Number(count.rows[0]?.total || 0) / pageSize)),
      last24Hours: Object.fromEntries(stats.rows.map((row) => [row.level, Number(row.total || 0)]))
    };
  } finally {
    client.release();
  }
}

async function pruneSystemLogsFromPostgres(retentionDays = 90) {
  const days = Math.min(3650, Math.max(1, Number(retentionDays || 90)));
  const result = await getPool().query("DELETE FROM system_logs WHERE created_at < now() - ($1::text || ' days')::interval", [String(days)]);
  return Number(result.rowCount || 0);
}

async function checkPostgresReadiness(expectedMigration = "") {
  if (!postgresEnabled()) return { ready: false, database: false, migrations: false };
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    if (!expectedMigration) return { ready: true, database: true, migrations: true };
    const result = await client.query(
      "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE filename = $1) AS applied",
      [String(expectedMigration)]
    );
    const migrations = Boolean(result.rows[0]?.applied);
    return { ready: migrations, database: true, migrations };
  } catch {
    return { ready: false, database: false, migrations: false };
  } finally {
    client.release();
  }
}

function mapSeatHold(row) {
  return {
    sessionId: row.session_id,
    seatId: row.seat_id,
    ownerToken: row.owner_token,
    connectionId: row.connection_id || "",
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : ""
  };
}

async function listActiveSeatHolds(sessionId) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    const result = await client.query(
      "SELECT * FROM seat_holds WHERE session_id = $1 AND expires_at > now() ORDER BY seat_id",
      [String(sessionId || "")]
    );
    return result.rows.map(mapSeatHold);
  } finally {
    if (!existingClient) client.release();
  }
}

async function acquireSeatHold({ sessionId, seatId, ownerToken, connectionId = "", ttlMs = 120000 }) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    const expiresAt = new Date(Date.now() + Math.min(300000, Math.max(30000, Number(ttlMs || 120000))));
    const result = await client.query(`
      INSERT INTO seat_holds (session_id, seat_id, owner_token, connection_id, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (session_id, seat_id) DO UPDATE SET
        owner_token = EXCLUDED.owner_token,
        connection_id = EXCLUDED.connection_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
      WHERE seat_holds.expires_at <= now() OR seat_holds.owner_token = EXCLUDED.owner_token
      RETURNING *
    `, [String(sessionId || ""), String(seatId || ""), String(ownerToken || ""), String(connectionId || ""), expiresAt]);
    return result.rows[0] ? mapSeatHold(result.rows[0]) : null;
  } finally {
    if (!existingClient) client.release();
  }
}

async function releaseSeatHold({ sessionId, seatId, ownerToken }) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    const result = await client.query(
      "DELETE FROM seat_holds WHERE session_id = $1 AND seat_id = $2 AND owner_token = $3 RETURNING *",
      [String(sessionId || ""), String(seatId || ""), String(ownerToken || "")]
    );
    return result.rows[0] ? mapSeatHold(result.rows[0]) : null;
  } finally {
    if (!existingClient) client.release();
  }
}

async function releaseSeatHoldsForOwner({ sessionId, ownerToken }) {
  const existingClient = contextClient();
  const client = existingClient || await getPool().connect();
  try {
    const result = await client.query(
      "DELETE FROM seat_holds WHERE session_id = $1 AND owner_token = $2 RETURNING *",
      [String(sessionId || ""), String(ownerToken || "")]
    );
    return result.rows.map(mapSeatHold);
  } finally {
    if (!existingClient) client.release();
  }
}

module.exports = {
  postgresEnabled,
  readDbFromPostgres,
  writeDbToPostgres,
  withPostgresMutationLock,
  appendAuditLogToPostgres,
  appendSystemLogToPostgres,
  listSystemLogsFromPostgres,
  pruneSystemLogsFromPostgres,
  checkPostgresReadiness,
  listActiveSeatHolds,
  acquireSeatHold,
  releaseSeatHold,
  releaseSeatHoldsForOwner,
  cinemaIsoDate
};
