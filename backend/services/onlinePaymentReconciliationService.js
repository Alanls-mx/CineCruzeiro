const crypto = require("node:crypto");
const { appendIntentHistory, intentOf, providerAccountFingerprint } = require("./onlineCheckoutIntentService");

const LEASE_MS = 90_000;
const MAX_ATTEMPTS = 6;

function createOnlinePaymentReconciliationService({ withCriticalMutation, readDb, writeDb,
  activeOnlinePaymentProvider, paymentService, pagBankPaymentService,
  createPaymentRecord, finalize, logEvent }) {
  function accountFingerprint(active) {
    const token = active.provider === "pag_bank"
      ? pagBankPaymentService.token(active.config)
      : paymentService.getMercadoPagoAccessToken(active.config);
    return providerAccountFingerprint(active.provider, active.config, token);
  }

  async function claim(paymentId) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = db.payments.find((item) => item.id === paymentId);
      const order = payment && db.orders.find((item) => item.id === payment.orderId);
      const intent = intentOf(payment);
      if (!order || !intent || !["unknown", "result_known", "sending", "reconciling"].includes(intent.state)) return null;
      const now = Date.now();
      if (intent.state === "sending" && Date.parse(intent.leaseUntil || "") > now) return null;
      if (Date.parse(intent.reconcileLeaseUntil || "") > now || Date.parse(intent.nextReconcileAt || "") > now) return null;
      if (Number(intent.reconcileAttempts || 0) >= MAX_ATTEMPTS) {
        appendIntentHistory(intent, "review_required", "reconcile_limit");
        await writeDb(db);
        return null;
      }
      const active = activeOnlinePaymentProvider(db);
      if (active.provider !== payment.provider || accountFingerprint(active) !== intent.providerAccountFingerprint
        || intent.installationId !== String(process.env.CINE_INSTANCE_SLUG || process.env.NEXT_PUBLIC_CINEMA_SLUG || "default")) {
        appendIntentHistory(intent, "review_required", "provider_account_or_installation_changed");
        await writeDb(db);
        return null;
      }
      if (payment.status !== "processing" && intent.state !== "result_known") return null;
      intent.reconcileClaim = crypto.randomUUID();
      intent.reconcileLeaseUntil = new Date(now + LEASE_MS).toISOString();
      intent.reconcileAttempts = Number(intent.reconcileAttempts || 0) + 1;
      appendIntentHistory(intent, "reconciling");
      await writeDb(db);
      return { paymentId, orderId: order.id, provider: payment.provider, providerPaymentId: payment.providerPaymentId,
        reference: String(order.id).slice(0, 64), amountCents: Math.round(Number(payment.amount) * 100),
        createdAt: payment.createdAt, claim: intent.reconcileClaim, config: active.config };
    });
  }

  async function lookup(work) {
    if (work.provider === "pag_bank") {
      if (!work.providerPaymentId) return { review: "pagbank_order_id_missing" };
      return { result: await pagBankPaymentService.fetchOrder(work.providerPaymentId, work.config) };
    }
    if (work.provider !== "mercado_pago") return { review: "provider_unsupported" };
    if (work.providerPaymentId) return { result: await paymentService.fetchMercadoPagoOrder(work.providerPaymentId, work.config) };
    const found = await paymentService.searchMercadoPagoOrdersByReference(work.reference, work.createdAt, work.config);
    if (!found) return {};
    if (!Number.isInteger(found.total) || found.total > 1 || found.orders.length > 1) return { review: "reference_ambiguous" };
    return { result: found.orders[0] || null };
  }

  async function finish(work, outcome) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = db.payments.find((item) => item.id === work.paymentId);
      const order = payment && db.orders.find((item) => item.id === payment.orderId);
      const intent = intentOf(payment);
      if (!order || !intent || intent.reconcileClaim !== work.claim || intent.state !== "reconciling") return "superseded";
      if (outcome.review) {
        appendIntentHistory(intent, "review_required", outcome.review);
      } else if (!outcome.result) {
        intent.nextReconcileAt = new Date(Date.now() + Math.min(60 * 60_000, 30_000 * (2 ** (intent.reconcileAttempts - 1)))).toISOString();
        appendIntentHistory(intent, "unknown", "lookup_unavailable");
      } else {
        const found = outcome.result;
        const rawCurrency = String(found.raw?.currency_id || found.raw?.currency || "").toUpperCase();
        const wrong = !found.id || found.provider !== payment.provider
          || found.externalReference !== work.reference
          || Math.round(Number(found.amount) * 100) !== work.amountCents
          || (payment.provider === "mercado_pago" && rawCurrency !== "BRL")
          || (payment.provider === "pag_bank" && rawCurrency && rawCurrency !== "BRL")
          || (payment.providerPaymentId && String(payment.providerPaymentId).toLowerCase() !== String(found.id).toLowerCase());
        if (wrong) appendIntentHistory(intent, "review_required", "authority_mismatch");
        else if (!["approved", "pending", "rejected", "cancelled", "expired", "refunded"].includes(found.status)) {
          intent.nextReconcileAt = new Date(Date.now() + 60_000).toISOString();
          appendIntentHistory(intent, "unknown", "authority_inconclusive");
        } else {
          if (!payment.providerPaymentId) {
            const received = createPaymentRecord(order, found, payment.method);
            payment.providerPaymentId = received.providerPaymentId;
            payment.providerReference = received.providerReference;
            payment.metadata = { ...payment.metadata, ...received.metadata, onlineIntent: intent };
            if (order.status === "pending_payment") {
              payment.qrCode = received.qrCode;
              payment.qrCodeBase64 = received.qrCodeBase64;
              payment.ticketUrl = received.ticketUrl;
              payment.checkoutUrl = received.checkoutUrl;
            }
            payment.expiresAt = received.expiresAt;
          }
          appendIntentHistory(intent, "result_known", "authority_confirmed");
          await writeDb(db);
          return "known";
        }
      }
      intent.reconcileLeaseUntil = "";
      await writeDb(db);
      return intent.state;
    });
  }

  async function reconcile(paymentId) {
    const work = await claim(paymentId);
    if (!work) return "skipped";
    let outcome;
    try { outcome = await lookup(work); }
    catch (error) {
      logEvent("warn", "online_payment.reconcile_lookup_failed", { paymentId, code: String(error.code || "LOOKUP_FAILED").slice(0, 60) });
      outcome = {};
    }
    const state = await finish(work, outcome);
    if (state !== "known") return state;
    // A webhook may have completed the same payment during the GET. finalize is
    // idempotent and re-reads the snapshot under the same critical mutation lock.
    const settled = await finalize(paymentId, outcome.result);
    return settled ? "completed" : "retry";
  }

  async function scan({ limit = 8 } = {}) {
    const db = await readDb();
    const now = Date.now();
    const candidates = db.payments.filter((payment) => {
      const intent = intentOf(payment);
      return intent && ["unknown", "result_known", "sending", "reconciling"].includes(intent.state)
        && (!intent.nextReconcileAt || Date.parse(intent.nextReconcileAt) <= now)
        && (intent.state !== "sending" || Date.parse(intent.leaseUntil || "") <= now);
    }).slice(0, limit);
    for (const payment of candidates) await reconcile(payment.id);
    return candidates.length;
  }

  return { reconcile, scan };
}

module.exports = { createOnlinePaymentReconciliationService };
