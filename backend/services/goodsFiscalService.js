class NfceProvider {
  async issue() {
    throw new Error("NFC-e provider não configurado.");
  }

  async getStatus() {
    throw new Error("NFC-e provider não configurado.");
  }

  async cancel() {
    throw new Error("NFC-e provider não configurado.");
  }
}

class GoodsFiscalService {
  constructor({ provider = null } = {}) {
    this.provider = provider;
  }

  prepare(db, order, trigger = "goods_delivered") {
    db.goodsFiscalDocuments ||= [];
    if (!Array.isArray(order.goodsItems) || !order.goodsItems.length) {
      order.goodsFiscalStatus = "not_required";
      return null;
    }
    const idempotencyKey = `goods-fiscal:${order.id}`;
    const existing = db.goodsFiscalDocuments.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    const document = {
      id: `fiscal-mercadorias-${order.id}`,
      orderId: order.id,
      status: "waiting_trigger",
      trigger: trigger === "payment_approved" ? "payment_approved" : "goods_delivered",
      provider: "",
      providerDocumentId: "",
      documentNumber: "",
      series: "",
      accessKey: "",
      protocol: "",
      xmlReference: "",
      danfeReference: "",
      idempotencyKey,
      issuedAt: "",
      cancelledAt: "",
      errorCode: "",
      errorMessage: "",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.goodsFiscalDocuments.unshift(document);
    order.goodsFiscalStatus = document.status;
    order.goodsFiscalTrigger = document.trigger;
    return document;
  }

  async issue(db, order) {
    const document = this.prepare(db, order, order.goodsFiscalTrigger);
    if (!document || document.status === "authorized") return document;
    if (!this.provider) return document;
    document.status = "pending";
    document.updatedAt = new Date().toISOString();
    try {
      const result = await this.provider.issue({ order, document, idempotencyKey: document.idempotencyKey });
      Object.assign(document, result, { status: result.status || "authorized", updatedAt: new Date().toISOString() });
    } catch (error) {
      document.status = "error";
      document.errorCode = String(error.code || "PROVIDER_ERROR");
      document.errorMessage = String(error.message || "Falha no provider fiscal").slice(0, 500);
      document.updatedAt = new Date().toISOString();
    }
    order.goodsFiscalStatus = document.status;
    return document;
  }
}

module.exports = { GoodsFiscalService, NfceProvider };
