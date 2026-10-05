const crypto = require("crypto");

function pagBankError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function baseUrl(config = {}) {
  return config.environment === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

function token(config = {}) {
  return String(config.accessToken || process.env.PAGBANK_ACCESS_TOKEN || process.env.PAGSEGURO_ACCESS_TOKEN || "").trim();
}

function toCents(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw pagBankError("PAGBANK_AMOUNT_INVALID", "O valor do pagamento deve ser maior que zero.", 422);
  return Math.round(value * 100);
}

function normalizedStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "approved";
  if (["AUTHORIZED", "IN_ANALYSIS"].includes(value)) return "processing";
  if (["DECLINED", "ERROR"].includes(value)) return "rejected";
  if (["CANCELED", "CANCELLED"].includes(value)) return "cancelled";
  if (["REFUNDED", "CHARGEBACK"].includes(value)) return "refunded";
  return "pending";
}

function normalizeOrder(data = {}, method = "") {
  const charge = Array.isArray(data.charges) ? data.charges[0] || {} : {};
  const qrCode = charge.qr_code
    || (Array.isArray(data.qr_codes) ? data.qr_codes[0] : null)
    || (Array.isArray(data.qr_code) ? data.qr_code[0] : data.qr_code)
    || {};
  const links = [...(charge.links || []), ...(qrCode.links || [])];
  const qrBase64Link = links.find((link) => link.rel === "QRCODE.BASE64")?.href || "";
  return {
    provider: "pag_bank",
    id: String(data.id || ""),
    orderId: String(data.id || ""),
    transactionId: String(charge.id || ""),
    referenceId: String(charge.reference_id || ""),
    status: normalizedStatus(charge.status),
    statusDetail: String(charge.payment_response?.message || charge.status || ""),
    amount: Number(charge.amount?.value || qrCode.amount?.value || 0) / 100,
    externalReference: String(data.reference_id || ""),
    paymentMethodId: String(charge.payment_method?.type || method).toLowerCase(),
    paymentMethodType: method === "pix" ? "bank_transfer" : "credit_card",
    qrCode: String(qrCode.text || ""),
    qrCodeBase64: "",
    qrCodeBase64Url: qrBase64Link,
    ticketUrl: "",
    checkoutUrl: "",
    expiresAt: String(charge.payment_method?.pix?.expiration_date || ""),
    raw: {
      id: String(data.id || ""),
      reference_id: String(data.reference_id || ""),
      charges: (data.charges || []).map((item) => ({
        id: item.id,
        status: item.status,
        amount: { value: item.amount?.value, summary: { refunded: item.amount?.summary?.refunded || 0 } },
        payment_method: { type: item.payment_method?.type }
      }))
    }
  };
}

async function request(path, config = {}, options = {}) {
  const accessToken = token(config);
  if (!accessToken) throw pagBankError("PAGBANK_NOT_CONFIGURED", "Configure o token PagBank em Integrações.", 412);
  const response = await fetch(`${baseUrl(config)}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "x-idempotency-key": options.idempotencyKey } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error_messages?.[0]?.description || data.error_messages?.[0]?.message || data.message || data.error || "Operação recusada pelo PagBank.";
    const whitelistRequired = response.status === 403 && /whitelist\s+access\s+required/i.test(String(detail));
    const resource = path.startsWith("/orders") ? "a API de Pedidos" : path.startsWith("/public-keys") ? "a API de Chaves Públicas" : "esta operação";
    const error = whitelistRequired
      ? pagBankError("PAGBANK_WHITELIST_REQUIRED", `A conta PagBank ainda não está liberada para ${resource} neste ambiente. Solicite a homologação e a inclusão na whitelist ao suporte PagBank.`, 412)
      : pagBankError("PAGBANK_REQUEST_FAILED", detail, response.status);
    error.raw = data;
    throw error;
  }
  return data;
}

function customerFromOrder(order) {
  const name = String(order.customerName || "").trim();
  const email = String(order.customerEmail || "").trim();
  const taxId = String(order.customerCpf || "").replace(/\D/g, "");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ![11, 14].includes(taxId.length)) {
    throw pagBankError("PAGBANK_CUSTOMER_INCOMPLETE", "Informe nome, e-mail e CPF/CNPJ válido para pagar com PagBank.", 422);
  }
  const phone = String(order.customerPhone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return {
    name,
    email,
    tax_id: taxId,
    ...(phone.length >= 10 && phone.length <= 11 ? { phones: [{ country: "55", area: phone.slice(0, 2), number: phone.slice(2), type: "MOBILE" }] } : {})
  };
}

async function createOrderPayment(order, config = {}, options = {}) {
  const method = options.method === "credit_card" ? "credit_card" : "pix";
  if (process.env.PAYMENTS_MODE === "test" && process.env.NODE_ENV !== "production") {
    return normalizeOrder({
      id: `ORDE_TEST_${crypto.randomUUID()}`,
      reference_id: order.id,
      charges: [{ id: `CHAR_TEST_${crypto.randomUUID()}`, reference_id: order.id, status: method === "credit_card" && process.env.TEST_PAYMENTS_AUTO_APPROVE === "true" ? "PAID" : "WAITING", amount: { value: toCents(order.totalPrice) }, payment_method: { type: method === "pix" ? "PIX" : "CREDIT_CARD" } }],
      qr_codes: method === "pix" ? [{ text: `PIX TESTE PAGBANK ${order.id}` }] : []
    }, method);
  }
  const card = options.card || {};
  if (method === "credit_card" && !String(card.encrypted || "").trim()) {
    throw pagBankError("PAGBANK_ENCRYPTED_CARD_REQUIRED", "Criptografe o cartão com o SDK PagBank antes de enviar o pagamento.", 422);
  }
  const cents = toCents(order.totalPrice);
  const body = {
    reference_id: String(order.id).slice(0, 64),
    customer: customerFromOrder(order),
    items: [{ reference_id: String(order.id).slice(0, 64), name: String(order.movieTitle || "Ingressos e bomboniere").slice(0, 100), quantity: 1, unit_amount: cents }],
    charges: [{
      reference_id: String(order.id).slice(0, 64),
      description: String(order.movieTitle || "Compra no cinema").slice(0, 64),
      amount: { value: cents, currency: "BRL" },
      payment_method: method === "pix"
        ? { type: "PIX", pix: { expiration_date: order.reservationExpiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString() } }
        : { type: "CREDIT_CARD", installments: Math.max(1, Number(card.installments || 1)), capture: true, card: { encrypted: String(card.encrypted), store: false }, holder: { name: String(card.holderName || order.customerName), tax_id: String(card.holderTaxId || order.customerCpf || "").replace(/\D/g, "") } }
    }],
    ...(options.notificationUrl ? { notification_urls: [options.notificationUrl] } : {})
  };
  const data = await request("/orders", config, { method: "POST", body, idempotencyKey: String(options.idempotencyKey || order.idempotencyKey || order.id) });
  const payment = normalizeOrder(data, method);
  if (!/^ORDE_[A-Za-z0-9-]+$/.test(payment.id)
    || !/^CHAR_[A-Za-z0-9-]+$/.test(payment.transactionId)
    || payment.externalReference !== body.reference_id
    || Math.round(payment.amount * 100) !== cents
    || (method === "pix" && payment.status === "pending" && !payment.qrCode)) {
    throw pagBankError("PAGBANK_ORDER_RESPONSE_INVALID", "O PagBank não confirmou os dados completos da cobrança. Consulte a operação antes de tentar novamente.", 502);
  }
  return payment;
}

async function fetchOrder(orderId, config = {}) {
  if (!orderId) return null;
  try {
    return normalizeOrder(await request(`/orders/${encodeURIComponent(orderId)}`, config));
  } catch (error) {
    if (error.statusCode === 404 || error.name === "TimeoutError") return null;
    throw error;
  }
}

async function cancelCharge(chargeId, amount, config = {}, idempotencyKey = "") {
  if (!/^CHAR_[A-Za-z0-9-]+$/.test(String(chargeId || ""))) {
    throw pagBankError("PAGBANK_CHARGE_ID_INVALID", "Identificador da cobrança PagBank inválido.", 422);
  }
  return request(`/charges/${encodeURIComponent(chargeId)}/cancel`, config, {
    method: "POST",
    idempotencyKey: idempotencyKey || `cancel-${chargeId}`,
    body: amount === undefined || amount === null ? {} : { amount: { value: toCents(amount) } }
  });
}

function verifyOrderWebhook(req, config = {}) {
  const signature = String(req.headers?.["x-authenticity-token"] || "").trim();
  const raw = req.rawBody;
  const accessToken = token(config);
  if (!accessToken || typeof raw !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw pagBankError("PAGBANK_WEBHOOK_SIGNATURE_REQUIRED", "Notificação PagBank sem assinatura válida.", 401);
  }
  const expected = crypto.createHash("sha256").update(`${accessToken}-${raw}`).digest();
  const received = Buffer.from(signature, "hex");
  if (!crypto.timingSafeEqual(expected, received)) {
    throw pagBankError("PAGBANK_WEBHOOK_INVALID_SIGNATURE", "Assinatura da notificação PagBank não confere.", 401);
  }
  return { verified: true };
}

function resolveWebhookOrder(body = {}, payments = []) {
  const chargeId = String(body.charges?.[0]?.id || (/^CHAR_[A-Za-z0-9-]+$/.test(String(body.id || "")) ? body.id : ""));
  const linkedPayment = chargeId
    ? payments.find((item) => item.provider === "pag_bank" && item.metadata?.transactionId === chargeId)
    : null;
  const orderId = String(body.metadata?.ps_order_id || body.charges?.[0]?.metadata?.ps_order_id
    || (/^ORDE_[A-Za-z0-9-]+$/.test(String(body.id || "")) ? body.id : "")
    || linkedPayment?.providerPaymentId || "");
  return { chargeId, orderId };
}

module.exports = { baseUrl, token, toCents, normalizedStatus, normalizeOrder, request, createOrderPayment, fetchOrder, cancelCharge, verifyOrderWebhook, resolveWebhookOrder };
