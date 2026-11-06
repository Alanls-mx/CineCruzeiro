const crypto = require("crypto");

function createPointCreationCoordinator({
  withCriticalMutation,
  readDb,
  writeDb,
  pointPaymentOrders,
  pointProviderAccountFingerprint,
  cardTerminalProvider,
}) {
  async function claimPointCreation(paymentId) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId && item.metadata?.kind === "point_sale");
      if (!payment || payment.status !== "pending" || payment.providerPaymentId || payment.metadata?.pointCreateState === "review_required") return null;
      const orders = pointPaymentOrders(db, payment);
      if (!orders.length || orders.some((order) => order.status !== "pending_payment"
        || (order.reservationExpiresAt && Date.parse(order.reservationExpiresAt) <= Date.now()))) {
        if (payment.metadata.providerRequestSentAt) {
          payment.metadata.pointCreateState = "review_required";
          payment.metadata.reconciliationRequired = true;
          payment.metadata.reconciliationReason = "point_order_closed_before_recovery";
          await writeDb(db);
        }
        return null;
      }
      if (Date.parse(payment.metadata?.pointCreateLeaseUntil || "") > Date.now()) return null;
      if (!payment.metadata?.recoveryRequest?.idempotencyKey || !payment.metadata?.recoveryRequest?.externalReference) return null;
      payment.metadata.pointCreateState = "sending";
      payment.metadata.pointCreateAttempts = Number(payment.metadata.pointCreateAttempts || 0) + 1;
      payment.metadata.pointCreateClaim = crypto.randomUUID();
      payment.metadata.pointCreateLeaseUntil = new Date(Date.now() + 90_000).toISOString();
      payment.updatedAt = new Date().toISOString();
      await writeDb(db);
      return { recovery: payment.metadata.recoveryRequest, paymentId, claim: payment.metadata.pointCreateClaim,
        terminalId: payment.metadata.terminalId, accountFingerprint: payment.metadata.providerAccountFingerprint };
    });
  }

  async function markPointRequestSent(paymentId, claim) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId && item.metadata?.kind === "point_sale");
      if (!payment || payment.status !== "pending" || payment.providerPaymentId || payment.metadata?.pointCreateClaim !== claim) return false;
      if (!pointPaymentOrders(db, payment).length || pointPaymentOrders(db, payment).some((order) => order.status !== "pending_payment"
        || (order.reservationExpiresAt && Date.parse(order.reservationExpiresAt) <= Date.now()))) return false;
      payment.metadata.pointCreateState = "sending";
      payment.metadata.providerRequestSentAt = new Date().toISOString();
      payment.updatedAt = payment.metadata.providerRequestSentAt;
      await writeDb(db);
      return true;
    });
  }

  async function recordPointCreateUncertainty(paymentId, error) {
    await withCriticalMutation(async () => {
      const db = await readDb();
      const payment = (db.payments || []).find((item) => item.id === paymentId && item.metadata?.kind === "point_sale");
      if (!payment || payment.providerPaymentId) return;
      const notSent = error.code === "POINT_TERMINAL_PRECHECK_FAILED" && !payment.metadata.providerRequestSentAt;
      payment.metadata.pointCreateState = notSent ? "prepared"
        : error.code === "POINT_CONNECTION_LOST" ? "unknown" : "review_required";
      payment.metadata.reconnectRequired = true;
      payment.metadata.statusDetail = error.code === "POINT_CONNECTION_LOST" ? "reconnect_required" : "provider_create_failed";
      payment.metadata.pointCreateLeaseUntil = !notSent && error.code === "POINT_CONNECTION_LOST"
        ? payment.metadata.pointCreateLeaseUntil : "";
      payment.updatedAt = new Date().toISOString();
      await writeDb(db);
    });
  }

  async function attemptPointCreation(paymentId, config) {
    const claim = await claimPointCreation(paymentId);
    if (!claim) return null;
    let requestWasSent = false;
    try {
      if (String(config.pointDeviceId || config.pointTerminalId || "") !== claim.terminalId
        || (claim.accountFingerprint && pointProviderAccountFingerprint(config) !== claim.accountFingerprint)) {
        throw Object.assign(new Error("O terminal da intenção mudou. Restaure a configuração original antes de retomar."), { code: "POINT_TERMINAL_PRECHECK_FAILED" });
      }
      try {
        await cardTerminalProvider.terminalConnection(config);
      } catch (error) {
        error.code = "POINT_TERMINAL_PRECHECK_FAILED";
        throw error;
      }
      if (!await markPointRequestSent(paymentId, claim.claim)) return null;
      requestWasSent = true;
      return await cardTerminalProvider.createPayment({
        id: claim.recovery.externalReference,
        totalPrice: claim.recovery.totalPrice,
        description: claim.recovery.description
      }, config, claim.recovery);
    } catch (error) {
      if (requestWasSent || error.code === "POINT_TERMINAL_PRECHECK_FAILED") {
        await recordPointCreateUncertainty(paymentId, error);
      }
      throw error;
    }
  }

  return { claimPointCreation, markPointRequestSent, attemptPointCreation };
}

module.exports = { createPointCreationCoordinator };
