const crypto = require("node:crypto");

function checkoutRequestFingerprint(order, method) {
  const relevant = {
    method,
    id: order.id,
    movieId: order.movieId,
    sessionId: order.sessionId,
    fullTicketsCount: order.fullTicketsCount,
    halfTicketsCount: order.halfTicketsCount,
    ticketItems: order.ticketItems,
    selectedSeatIds: order.selectedSeatIds,
    concessionItems: order.concessionItems,
    couponCode: order.couponCode,
    useClubCredits: order.useClubCredits,
    useClubBenefits: order.useClubBenefits
  };
  return crypto.createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function providerAccountFingerprint(provider, config, accessToken) {
  return crypto.createHash("sha256")
    .update(`${provider}:${config?.environment || "production"}:${accessToken || ""}`)
    .digest("hex");
}

function appendIntentHistory(intent, state, code = "") {
  intent.state = state;
  intent.updatedAt = new Date().toISOString();
  intent.history = [...(intent.history || []).slice(-7), { state, code, at: intent.updatedAt }];
  return intent;
}

function pendingCheckoutPayment(order, provider, method, fingerprint, accountFingerprint, idempotencyKey) {
  const now = new Date().toISOString();
  return {
    id: `pagamento-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: order.id,
    method,
    provider,
    providerPaymentId: "",
    providerReference: String(order.id).slice(0, 64),
    status: "processing",
    amount: Number(order.totalPrice || 0),
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    expiresAt: order.reservationExpiresAt,
    metadata: {
      onlineIntent: appendIntentHistory({
        idempotencyKey,
        fingerprint,
        installationId: String(process.env.CINE_INSTANCE_SLUG || process.env.NEXT_PUBLIC_CINEMA_SLUG || "default"),
        providerAccountFingerprint: accountFingerprint,
        claim: "",
        leaseUntil: "",
        attempts: 0
      }, "prepared")
    }
  };
}

function intentOf(payment) {
  return payment?.metadata?.onlineIntent || null;
}

function sameCheckoutIntent(payment, fingerprint, method, provider) {
  const intent = intentOf(payment);
  return Boolean(intent && intent.fingerprint === fingerprint && payment.method === method && payment.provider === provider);
}

module.exports = {
  checkoutRequestFingerprint,
  providerAccountFingerprint,
  appendIntentHistory,
  pendingCheckoutPayment,
  intentOf,
  sameCheckoutIntent
};
