const EVENTS = Object.freeze({
  CREATED: "subscription.created",
  PAYMENT_PENDING: "subscription.payment.pending",
  PAYMENT_APPROVED: "subscription.payment.approved",
  PAYMENT_FAILED: "subscription.payment.failed",
  CANCELLED: "subscription.cancelled",
  RENEWED: "subscription.renewed"
});

class SubscriptionPaymentProvider {
  async createSubscription() {
    throw new Error("Subscription provider não configurado.");
  }

  async getSubscription() {
    throw new Error("Subscription provider não configurado.");
  }

  async cancelSubscription() {
    throw new Error("Subscription provider não configurado.");
  }

  normalizeEvent(payload) {
    return payload;
  }
}

class MercadoPagoSubscriptionProvider extends SubscriptionPaymentProvider {
  constructor(paymentService) {
    super();
    this.paymentService = paymentService;
  }

  createSubscription(subscription, plan, customer, config, options) {
    return this.paymentService.createMercadoPagoSubscription(subscription, plan, customer, config, options);
  }

  getSubscription(subscriptionId, config) {
    return this.paymentService.fetchMercadoPagoSubscription(subscriptionId, config);
  }

  cancelSubscription(subscriptionId, config) {
    return this.paymentService.cancelMercadoPagoSubscription(subscriptionId, config);
  }

  normalizeEvent(payload = {}) {
    const status = this.paymentService.normalizeMercadoPagoSubscriptionStatus(payload.status);
    return {
      type: status === "active" ? EVENTS.PAYMENT_APPROVED : status === "payment_failed" ? EVENTS.PAYMENT_FAILED : status === "cancelled" ? EVENTS.CANCELLED : EVENTS.PAYMENT_PENDING,
      provider: "mercado_pago",
      providerSubscriptionId: payload.id || "",
      providerPaymentId: payload.paymentId || "",
      status,
      occurredAt: payload.occurredAt || new Date().toISOString(),
      raw: payload
    };
  }
}

module.exports = { EVENTS, MercadoPagoSubscriptionProvider, SubscriptionPaymentProvider };
