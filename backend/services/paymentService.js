const crypto = require("crypto");

const MERCADO_PAGO_TOKEN_ENV_KEYS = ["MERCADO_PAGO_ACCESS_TOKEN", "MP_ACCESS_TOKEN", "MERCADOPAGO_ACCESS_TOKEN"];
const MERCADO_PAGO_WEBHOOK_SECRET_ENV_KEYS = ["MERCADO_PAGO_WEBHOOK_SECRET", "MP_WEBHOOK_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"];
const MERCADO_PAGO_WEBHOOK_SECRET_SANDBOX_ENV_KEYS = ["MERCADO_PAGO_WEBHOOK_SECRET_SANDBOX", "MERCADO_PAGO_WEBHOOK_SECRET_TEST"];
const MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION_ENV_KEYS = ["MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION", "MERCADO_PAGO_WEBHOOK_SECRET_LIVE"];
const OPEN_FINANCE_PIX_ENDPOINT_ENV_KEYS = ["OPEN_FINANCE_PIX_ENDPOINT", "PIX_OPEN_FINANCE_ENDPOINT"];
const OPEN_FINANCE_PIX_STATUS_ENDPOINT_ENV_KEYS = ["OPEN_FINANCE_PIX_STATUS_ENDPOINT", "PIX_OPEN_FINANCE_STATUS_ENDPOINT"];
const OPEN_FINANCE_PIX_TOKEN_ENV_KEYS = ["OPEN_FINANCE_PIX_TOKEN", "PIX_OPEN_FINANCE_TOKEN"];
const OPEN_FINANCE_WEBHOOK_SECRET_ENV_KEYS = ["OPEN_FINANCE_WEBHOOK_SECRET", "PIX_OPEN_FINANCE_WEBHOOK_SECRET"];
const PAYMENTS_MODE_ENV_KEYS = ["PAYMENTS_MODE", "NODE_ENV"];
const MERCADO_PAGO_PIX_EXPIRATION_ENV_KEYS = ["MERCADO_PAGO_PIX_EXPIRATION_TIME", "MP_PIX_EXPIRATION_TIME"];

function getFirstEnv(keys) {
  const key = keys.find((name) => process.env[name]);
  return key ? { key, value: process.env[key] } : null;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isTestPaymentsMode() {
  return getFirstEnv(PAYMENTS_MODE_ENV_KEYS)?.value === "test";
}

function paymentError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getMercadoPagoAccessToken(config = {}) {
  return config.accessToken || getFirstEnv(MERCADO_PAGO_TOKEN_ENV_KEYS)?.value || "";
}

function getMercadoPagoWebhookSecret(config = {}) {
  return getMercadoPagoWebhookSecrets(config)[0] || "";
}

function getMercadoPagoWebhookSecrets(config = {}) {
  const environmentKeys = String(config.environment || "").toLowerCase() === "production"
    ? MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION_ENV_KEYS
    : MERCADO_PAGO_WEBHOOK_SECRET_SANDBOX_ENV_KEYS;
  return [
    config.webhookSecret,
    ...environmentKeys.map((key) => process.env[key]),
    ...MERCADO_PAGO_WEBHOOK_SECRET_ENV_KEYS.map((key) => process.env[key])
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

async function mercadoPagoRequest(path, options = {}, integrationConfig = {}) {
  const accessToken = getMercadoPagoAccessToken(integrationConfig);
  if (!accessToken) {
    throw paymentError("MERCADO_PAGO_NOT_CONFIGURED", "Configure Mercado Pago na Central de Integracoes para processar pagamentos.", 412);
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.errors?.[0]?.message || data.errors?.[0]?.code || data.cause?.[0]?.description || data.cause?.[0]?.code || "";
    const message = [data.message || data.error || "Mercado Pago recusou a operacao.", detail].filter(Boolean).join(" - ");
    const error = paymentError("MERCADO_PAGO_REQUEST_FAILED", message, response.status);
    error.raw = data;
    throw error;
  }
  return data;
}

function getOpenFinancePixConfig(config = {}) {
  return {
    endpoint: config.endpoint || getFirstEnv(OPEN_FINANCE_PIX_ENDPOINT_ENV_KEYS)?.value || "",
    statusEndpoint: config.statusEndpoint || getFirstEnv(OPEN_FINANCE_PIX_STATUS_ENDPOINT_ENV_KEYS)?.value || "",
    token: config.token || getFirstEnv(OPEN_FINANCE_PIX_TOKEN_ENV_KEYS)?.value || "",
    webhookSecret: config.webhookSecret || getFirstEnv(OPEN_FINANCE_WEBHOOK_SECRET_ENV_KEYS)?.value || ""
  };
}

function normalizeProviderPaymentStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["approved", "paid", "confirmed", "settled", "succeeded", "accredited", "processed"].includes(value)) return "approved";
  if (["processing", "in_process", "authorized", "pending_review"].includes(value)) return "processing";
  if (["rejected", "failed", "refused", "denied"].includes(value)) return "rejected";
  if (["expired", "timeout"].includes(value)) return "expired";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["refunded", "charged_back", "chargeback"].includes(value)) return "refunded";
  if (["action_required", "created", "waiting_transfer", "waiting_payment"].includes(value)) return "pending";
  return "pending";
}

function normalizeMercadoPagoSubscriptionStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["authorized", "active"].includes(value)) return "active";
  if (["pending"].includes(value)) return "pending_payment";
  if (["paused"].includes(value)) return "paused";
  if (["cancelled", "canceled"].includes(value)) return "cancelled";
  if (["rejected", "payment_failed", "past_due"].includes(value)) return "payment_failed";
  return "pending_payment";
}

function createPaymentRecord(order, providerPayment, method) {
  const status = normalizeProviderPaymentStatus(providerPayment.status);
  const now = new Date().toISOString();
  return {
    id: `pagamento-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: order.id,
    method,
    provider: providerPayment.provider,
    providerPaymentId: providerPayment.id,
    providerReference: order.id,
    status,
    amount: Number(order.totalPrice || 0),
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    approvedAt: status === "approved" ? now : "",
    expiredAt: status === "expired" ? now : "",
    cancelledAt: status === "cancelled" ? now : "",
    refundedAt: status === "refunded" ? now : "",
    metadata: {
      statusDetail: providerPayment.statusDetail || "",
      orderId: providerPayment.orderId || providerPayment.id || "",
      transactionId: providerPayment.transactionId || "",
      referenceId: providerPayment.referenceId || "",
      paymentMethodId: providerPayment.paymentMethodId || "",
      paymentMethodType: providerPayment.paymentMethodType || "",
      transactionSecurityUrl: providerPayment.transactionSecurityUrl || "",
      raw: providerPayment.raw || {}
    },
    qrCode: providerPayment.qrCode || "",
    qrCodeBase64: providerPayment.qrCodeBase64 || "",
    ticketUrl: providerPayment.ticketUrl || "",
    checkoutUrl: providerPayment.checkoutUrl || ""
  };
}

function moneyString(value) {
  return Number(value || 0).toFixed(2);
}

function recurringAmount(plan) {
  return Number(moneyString(plan.monthlyPrice ?? plan.price ?? 0));
}

function siteUrl(value) {
  return String(value || "http://localhost:3000").replace(/\/+$/, "");
}

function subscriptionReason(plan) {
  return `Clube Cine Cruzeiro - ${String(plan.name || "Plano").trim()}`.slice(0, 255);
}

function normalizeMercadoPagoSubscriptionPlan(data = {}) {
  return {
    provider: "mercado_pago",
    id: String(data.id || ""),
    status: data.status || "active",
    initPoint: data.init_point || "",
    sandboxInitPoint: data.sandbox_init_point || "",
    raw: data
  };
}

function normalizeMercadoPagoSubscription(data = {}) {
  return {
    provider: "mercado_pago",
    id: String(data.id || ""),
    planId: String(data.preapproval_plan_id || ""),
    status: data.status || "pending",
    localStatus: normalizeMercadoPagoSubscriptionStatus(data.status),
    initPoint: data.init_point || "",
    sandboxInitPoint: data.sandbox_init_point || "",
    checkoutUrl: data.init_point || data.sandbox_init_point || "",
    externalReference: data.external_reference || "",
    payerEmail: data.payer_email || "",
    nextPaymentDate: data.next_payment_date || data.auto_recurring?.next_payment_date || "",
    raw: data
  };
}

function normalizeMercadoPagoAuthorizedPayment(data = {}) {
  const paymentStatus = normalizeProviderPaymentStatus(data.payment?.status || data.summarized || data.status || "pending");
  return {
    provider: "mercado_pago",
    id: String(data.id || ""),
    preapprovalId: String(data.preapproval_id || ""),
    externalReference: String(data.external_reference || ""),
    status: String(data.status || ""),
    paymentId: String(data.payment?.id || ""),
    paymentStatus,
    statusDetail: String(data.payment?.status_detail || ""),
    amount: Number(data.transaction_amount || 0),
    raw: data
  };
}

async function createMercadoPagoSubscriptionPlan(plan, integrationConfig = {}, options = {}) {
  const amount = recurringAmount(plan);
  if (amount <= 0) {
    throw paymentError("SUBSCRIPTION_PLAN_AMOUNT_INVALID", "O plano precisa ter valor mensal maior que zero.", 422);
  }

  if (!getMercadoPagoAccessToken(integrationConfig) && isTestPaymentsMode()) {
    const id = `PPLAN_TEST_${String(plan.id || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, "_")}`;
    return normalizeMercadoPagoSubscriptionPlan({
      id,
      status: "active",
      init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${encodeURIComponent(id)}`,
      testMode: true
    });
  }

  const data = await mercadoPagoRequest("/preapproval_plan", {
    method: "POST",
    idempotencyKey: options.idempotencyKey || `cine-cruzeiro-plan-${String(plan.id || plan.name || "").slice(0, 48)}-${moneyString(amount)}`,
    body: {
      reason: subscriptionReason(plan),
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "BRL"
      },
      back_url: `${siteUrl(options.frontendUrl)}/conta`
    }
  }, integrationConfig);

  return normalizeMercadoPagoSubscriptionPlan(data);
}

async function createMercadoPagoSubscription(subscription, plan, user, integrationConfig = {}, options = {}) {
  const payerEmail = String(user?.email || "").trim().toLowerCase();
  if (!payerEmail) {
    throw paymentError("PAYER_EMAIL_REQUIRED", "Informe um e-mail para iniciar a assinatura recorrente.", 422);
  }

  if (!getMercadoPagoAccessToken(integrationConfig) && isTestPaymentsMode()) {
    const id = `PREAPPROVAL_TEST_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    return normalizeMercadoPagoSubscription({
      id,
      preapproval_plan_id: options.providerPlanId || "",
      status: process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE === "true" ? "authorized" : "pending",
      external_reference: subscription.id,
      payer_email: payerEmail,
      init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${encodeURIComponent(id)}`,
      testMode: true
    });
  }

  const providerPlanId = options.associatedPlan === false
    ? ""
    : String(options.providerPlanId || plan.providerPlanId || plan.mercadoPagoPlanId || "").trim();
  const body = {
    reason: subscriptionReason(plan),
    external_reference: String(subscription.id || "").slice(0, 64),
    payer_email: payerEmail,
    back_url: `${siteUrl(options.frontendUrl)}/conta`,
    ...(options.notificationUrl ? { notification_url: String(options.notificationUrl) } : {}),
    status: "pending",
    ...(providerPlanId
      ? { preapproval_plan_id: providerPlanId }
      : {
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: recurringAmount(plan),
            currency_id: "BRL"
          }
        })
  };

  const data = await mercadoPagoRequest("/preapproval", {
    method: "POST",
    idempotencyKey: options.idempotencyKey || `cine-cruzeiro-subscription-${subscription.id}`,
    body
  }, integrationConfig);

  return normalizeMercadoPagoSubscription(data);
}

async function fetchMercadoPagoSubscription(providerSubscriptionId, integrationConfig = {}) {
  if (!providerSubscriptionId) return null;
  if (!getMercadoPagoAccessToken(integrationConfig) && isTestPaymentsMode()) {
    return normalizeMercadoPagoSubscription({
      id: providerSubscriptionId,
      status: process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE === "true" ? "authorized" : "pending",
      testMode: true
    });
  }
  const data = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerSubscriptionId)}`, {}, integrationConfig);
  return normalizeMercadoPagoSubscription(data);
}

async function fetchMercadoPagoAuthorizedPayment(authorizedPaymentId, integrationConfig = {}) {
  if (!authorizedPaymentId) return null;
  if (!getMercadoPagoAccessToken(integrationConfig) && isTestPaymentsMode()) {
    return normalizeMercadoPagoAuthorizedPayment({
      id: authorizedPaymentId,
      preapproval_id: "",
      status: "processed",
      summarized: "approved",
      payment: {
        id: `PAYMENT_${authorizedPaymentId}`,
        status: process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE === "true" ? "approved" : "pending",
        status_detail: process.env.TEST_SUBSCRIPTIONS_AUTO_APPROVE === "true" ? "accredited" : "pending"
      },
      testMode: true
    });
  }
  const data = await mercadoPagoRequest(`/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`, {}, integrationConfig);
  return normalizeMercadoPagoAuthorizedPayment(data);
}

async function cancelMercadoPagoSubscription(providerSubscriptionId, integrationConfig = {}) {
  if (!providerSubscriptionId) return null;
  if (!getMercadoPagoAccessToken(integrationConfig) && isTestPaymentsMode()) {
    return normalizeMercadoPagoSubscription({ id: providerSubscriptionId, status: "cancelled", testMode: true });
  }
  const data = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerSubscriptionId)}`, {
    method: "PUT",
    body: { status: "cancelled" }
  }, integrationConfig);
  return normalizeMercadoPagoSubscription(data);
}

function splitName(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Cliente",
    lastName: parts.slice(1).join(" ") || "Cine Cruzeiro"
  };
}

function payerFromOrder(order) {
  const email = String(order.customerEmail || "").trim();
  if (!email) {
    throw paymentError("PAYER_EMAIL_REQUIRED", "Informe um e-mail para processar o pagamento online.", 422);
  }
  return {
    email
  };
}

function mercadoPagoItems(order) {
  const items = [];
  const ticketCount = Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
  if (ticketCount > 0) {
    items.push({
      title: `Ingressos - ${order.movieTitle || "Cine Cruzeiro"}`,
      unit_price: moneyString(Number(order.ticketSubtotal || order.totalPrice || 0) / ticketCount),
      quantity: ticketCount,
      description: `${order.movieTitle || "Filme"} ${order.sessionTime || ""}`.trim(),
      external_code: `${order.id}-tickets`,
      category_id: "tickets",
      type: "tickets"
    });
  }
  for (const item of order.concessionItems || []) {
    items.push({
      title: item.name || "Bomboniere",
      unit_price: moneyString(item.unitPrice || item.price || 0),
      quantity: Number(item.quantity || 1),
      description: item.name || "Item da bomboniere",
      external_code: item.id || item.sku || `${order.id}-extra`,
      category_id: "food",
      type: "food"
    });
  }
  return items.length ? items : [{
    title: `Cine Cruzeiro - ${order.movieTitle || "Pedido"}`,
    unit_price: moneyString(order.totalPrice),
    quantity: 1,
    description: "Pedido Cine Cruzeiro",
    external_code: order.id,
    category_id: "tickets",
    type: "tickets"
  }];
}

function extractMercadoPagoTransaction(data = {}) {
  return data.transactions?.payments?.[0] || {};
}

function normalizeMercadoPagoOrder(data = {}, method) {
  const transaction = extractMercadoPagoTransaction(data);
  const paymentMethod = transaction.payment_method || {};
  const transactionSecurity = paymentMethod.transaction_security || {};
  const transactionStatus = transaction.status || data.status || "pending";
  const statusDetail = transaction.status_detail || data.status_detail || "";
  return {
    provider: "mercado_pago",
    id: String(data.id || ""),
    orderId: String(data.id || ""),
    transactionId: String(transaction.id || ""),
    referenceId: String(transaction.reference_id || ""),
    status: normalizeProviderPaymentStatus(statusDetail === "accredited" ? "accredited" : transactionStatus),
    statusDetail,
    amount: Number(transaction.amount || data.total_amount || 0),
    externalReference: data.external_reference || "",
    paymentMethodId: paymentMethod.id || (method === "pix" ? "pix" : ""),
    paymentMethodType: paymentMethod.type || (method === "pix" ? "bank_transfer" : "credit_card"),
    qrCode: paymentMethod.qr_code || "",
    qrCodeBase64: paymentMethod.qr_code_base64 || "",
    ticketUrl: paymentMethod.ticket_url || "",
    checkoutUrl: transactionSecurity.url || "",
    transactionSecurityUrl: transactionSecurity.url || "",
    raw: data
  };
}

async function createMercadoPagoOrderPayment(order, integrationConfig = {}, options = {}) {
  const accessToken = getMercadoPagoAccessToken(integrationConfig);
  const method = options.method === "credit_card" ? "credit_card" : "pix";
  const amount = moneyString(order.totalPrice);
  const idempotencyKey = options.idempotencyKey || order.idempotencyKey || order.id || crypto.randomUUID();

  if (!accessToken && isTestPaymentsMode()) {
    const id = `ORD_TEST_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const transactionId = `PAY_TEST_${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    return {
      provider: "mercado_pago",
      id,
      orderId: id,
      transactionId,
      referenceId: order.id,
      status: process.env.TEST_PAYMENTS_AUTO_APPROVE === "true" && method === "credit_card" ? "approved" : "pending",
      statusDetail: method === "pix" ? "waiting_transfer" : "test_mode",
      amount: Number(order.totalPrice || 0),
      externalReference: order.id,
      paymentMethodId: method === "pix" ? "pix" : options.card?.paymentMethodId || "visa",
      paymentMethodType: method === "pix" ? "bank_transfer" : "credit_card",
      qrCode: method === "pix" ? `PIX TESTE CINE CRUZEIRO ${order.id}` : "",
      qrCodeBase64: "",
      ticketUrl: "",
      checkoutUrl: "",
      raw: { testMode: true, id, transactionId, method }
    };
  }

  if (!accessToken) {
    throw paymentError("MERCADO_PAGO_NOT_CONFIGURED", "Configure Mercado Pago na Central de Integracoes para processar pagamentos.", 412);
  }

  const paymentMethod = method === "pix"
    ? {
        id: "pix",
        type: "bank_transfer"
      }
    : {
        id: String(options.card?.paymentMethodId || "").trim(),
        type: String(options.card?.paymentTypeId || "credit_card").trim(),
        token: String(options.card?.token || "").trim(),
        installments: Math.max(1, Number(options.card?.installments || 1)),
        statement_descriptor: String(options.statementDescriptor || "CINE CRUZEIRO").slice(0, 22)
      };

  if (method === "credit_card" && (!paymentMethod.id || !paymentMethod.token)) {
    throw paymentError("CARD_TOKEN_REQUIRED", "Token do cartao e bandeira sao obrigatorios para Checkout Transparente.", 422);
  }

  const pixExpiration = getFirstEnv(MERCADO_PAGO_PIX_EXPIRATION_ENV_KEYS)?.value || "";
  const body = {
    type: "online",
    processing_mode: "automatic",
    total_amount: amount,
    external_reference: String(order.id || "").slice(0, 64),
    description: `Cine Cruzeiro - ${order.movieTitle || "Ingressos"}`.slice(0, 255),
    payer: payerFromOrder(order),
    transactions: {
      payments: [
        {
          amount,
          payment_method: paymentMethod,
          ...(method === "pix" && pixExpiration
            ? { expiration_time: pixExpiration }
            : {})
        }
      ]
    }
  };

  const response = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.errors?.[0]?.message || data.errors?.[0]?.code || data.cause?.[0]?.description || data.cause?.[0]?.code || "";
    const message = [data.message || data.error || "Mercado Pago recusou a criacao da order.", detail].filter(Boolean).join(" - ");
    const error = paymentError("MERCADO_PAGO_ORDER_REJECTED", message, response.status);
    error.raw = data;
    throw error;
  }

  return normalizeMercadoPagoOrder(data, method);
}

async function createOpenFinancePixPayment(order, integrationConfig = {}) {
  const config = getOpenFinancePixConfig(integrationConfig);
  if (!config.endpoint && isTestPaymentsMode()) {
    const id = `test-pix-${crypto.randomBytes(8).toString("hex")}`;
    return {
      provider: "open_finance",
      id,
      status: process.env.TEST_PAYMENTS_AUTO_APPROVE === "true" ? "approved" : "pending",
      statusDetail: "test_mode",
      qrCode: `PIX TESTE CINE CRUZEIRO ${order.id}`,
      qrCodeBase64: "",
      ticketUrl: "",
      raw: { testMode: true, id }
    };
  }
  if (!config.endpoint) {
    throw paymentError(
      "OPEN_FINANCE_PIX_NOT_CONFIGURED",
      "Configure OPEN_FINANCE_PIX_ENDPOINT no backend/.env para usar o provedor de Pix via Open Finance.",
      412
    );
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": order.idempotencyKey || order.id,
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
    },
    body: JSON.stringify({
      amount: Number(order.totalPrice.toFixed(2)),
      currency: "BRL",
      externalReference: order.id,
      description: `Cine Cruzeiro - ${order.movieTitle || "Ingressos"}`,
      payer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        document: order.customerCpf
      },
      metadata: {
        orderId: order.id,
        movieId: order.movieId,
        sessionId: order.sessionId
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw paymentError("OPEN_FINANCE_PIX_REJECTED", data.message || data.error || "Provedor Open Finance recusou a criacao do Pix.", response.status);
  }

  return {
    provider: "open_finance",
    id: String(data.id || data.paymentId || data.endToEndId || ""),
    status: normalizeProviderPaymentStatus(data.status || "pending"),
    statusDetail: data.statusDetail || data.status_detail || "",
    qrCode: data.qrCode || data.pixCopyPaste || data.copyPaste || "",
    qrCodeBase64: data.qrCodeBase64 || "",
    ticketUrl: data.ticketUrl || data.paymentUrl || "",
    raw: data
  };
}

function parseSignatureHeader(header) {
  return String(header || "").split(",").reduce((acc, part) => {
    const [key, ...rest] = part.split("=");
    if (key && rest.length) acc[key.trim().toLowerCase()] = rest.join("=").trim();
    return acc;
  }, {});
}

function timingSafeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || "")) || !/^[a-f0-9]{64}$/i.test(String(right || ""))) return false;
  const leftBuffer = Buffer.from(String(left || ""), "hex");
  const rightBuffer = Buffer.from(String(right || ""), "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requestHeader(req, name) {
  const expected = String(name || "").toLowerCase();
  const direct = req?.headers?.[expected];
  if (Array.isArray(direct)) return String(direct[0] || "").trim();
  if (direct !== undefined) return String(direct || "").trim();
  const found = Object.entries(req?.headers || {}).find(([key]) => String(key).toLowerCase() === expected);
  if (!found) return "";
  return String(Array.isArray(found[1]) ? found[1][0] : found[1] || "").trim();
}

function mercadoPagoManifest(dataId, requestId, ts) {
  const parts = [];
  // The Orders API signs the exact query-string value. Order IDs are
  // case-sensitive (for example, ORDTST...), so changing their casing breaks HMAC.
  const normalizedDataId = String(dataId || "").trim();
  if (normalizedDataId) parts.push(`id:${normalizedDataId};`);
  if (requestId) parts.push(`request-id:${requestId};`);
  if (ts) parts.push(`ts:${ts};`);
  return parts.join("");
}

function normalizeMercadoPagoWebhookOrder(body = {}) {
  const data = body?.type === "order" && body.data && typeof body.data === "object"
    ? body.data
    : null;
  if (!data?.id) return null;
  return normalizeMercadoPagoOrder(data);
}

function mercadoPagoSignatureDataId(url) {
  return String(url.searchParams.get("data.id") || "").trim();
}

function createMercadoPagoWebhookSignature({ dataId, requestId, timestamp } = {}, secret = "") {
  const ts = String(timestamp || Math.floor(Date.now() / 1000));
  const manifest = mercadoPagoManifest(dataId, requestId, ts);
  const hash = crypto.createHmac("sha256", String(secret || "")).update(manifest).digest("hex");
  return { header: `ts=${ts},v1=${hash}`, manifest, timestamp: ts };
}

function verifyMercadoPagoWebhook(req, url, body, config = {}) {
  const secrets = getMercadoPagoWebhookSecrets(config);
  if (!secrets.length) {
    throw paymentError("MERCADO_PAGO_WEBHOOK_SECRET_REQUIRED", "Configure o segredo do Webhook do Mercado Pago para validar notificacoes.", 412);
  }

  const signatureHeader = requestHeader(req, "x-signature");
  const requestId = requestHeader(req, "x-request-id");
  const dataId = mercadoPagoSignatureDataId(url);
  if (!signatureHeader) throw paymentError("MERCADO_PAGO_WEBHOOK_SIGNATURE_REQUIRED", "Header x-signature ausente.", 401);
  if (!requestId) throw paymentError("MERCADO_PAGO_WEBHOOK_REQUEST_ID_REQUIRED", "Header x-request-id ausente.", 401);
  if (!dataId) throw paymentError("MERCADO_PAGO_WEBHOOK_DATA_ID_REQUIRED", "Query parameter data.id ausente.", 401);

  const signature = parseSignatureHeader(signatureHeader);
  if (!signature.ts || !signature.v1) {
    throw paymentError("MERCADO_PAGO_WEBHOOK_SIGNATURE_MALFORMED", "Header x-signature malformado.", 401);
  }
  const manifest = mercadoPagoManifest(dataId, requestId, signature.ts);
  const verified = secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return signature.v1 && timingSafeEqualHex(signature.v1, expected);
  });

  if (!verified) {
    throw paymentError("MERCADO_PAGO_WEBHOOK_INVALID_SIGNATURE", "Assinatura do webhook Mercado Pago invalida.", 401);
  }

  return { verified: true, dataId, requestId, timestamp: signature.ts };
}

function verifyOpenFinanceWebhook(req, configInput = {}) {
  const config = getOpenFinancePixConfig(configInput);
  if (!config.webhookSecret) {
    if (isProduction()) {
      throw paymentError("OPEN_FINANCE_WEBHOOK_SECRET_REQUIRED", "Configure OPEN_FINANCE_WEBHOOK_SECRET para validar webhooks em producao.", 412);
    }
    return { verified: false, reason: "secret_not_configured_dev" };
  }

  const token = String(req.headers["x-webhook-token"] || req.headers["x-open-finance-token"] || "").trim();
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (token === config.webhookSecret || bearer === config.webhookSecret) {
    return { verified: true, mode: "shared_secret" };
  }

  throw paymentError("OPEN_FINANCE_WEBHOOK_INVALID_SIGNATURE", "Webhook Open Finance nao autorizado.", 401);
}

function verifyWebhookRequest(provider, req, url, body, config = {}) {
  if (provider === "mercado_pago") return verifyMercadoPagoWebhook(req, url, body, config);
  return verifyOpenFinanceWebhook(req, config);
}

async function fetchMercadoPagoOrder(providerPaymentId, integrationConfig = {}) {
  const accessToken = getMercadoPagoAccessToken(integrationConfig);
  if (!accessToken || !providerPaymentId) return null;

  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;

  return normalizeMercadoPagoOrder(data);
}

async function fetchOpenFinancePayment(providerPaymentId, integrationConfig = {}) {
  const config = getOpenFinancePixConfig(integrationConfig);
  if (!config.statusEndpoint || !providerPaymentId) return null;
  const endpoint = config.statusEndpoint.replace("{id}", encodeURIComponent(providerPaymentId));
  const response = await fetch(endpoint, {
    headers: {
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;

  return {
    id: String(data.id || data.paymentId || providerPaymentId),
    status: normalizeProviderPaymentStatus(data.status || "pending"),
    amount: Number(data.amount || data.value || 0),
    externalReference: data.externalReference || data.external_reference || "",
    raw: data
  };
}

async function fetchProviderPaymentStatus(provider, providerPaymentId, config = {}) {
  if (provider === "mercado_pago") return fetchMercadoPagoOrder(providerPaymentId, config);
  return fetchOpenFinancePayment(providerPaymentId, config);
}

module.exports = {
  createOpenFinancePixPayment,
  createMercadoPagoOrderPayment,
  createMercadoPagoSubscription,
  createMercadoPagoSubscriptionPlan,
  createMercadoPagoWebhookSignature,
  createPaymentRecord,
  cancelMercadoPagoSubscription,
  fetchMercadoPagoAuthorizedPayment,
  fetchMercadoPagoSubscription,
  fetchProviderPaymentStatus,
  getMercadoPagoAccessToken,
  getMercadoPagoWebhookSecret,
  normalizeMercadoPagoAuthorizedPayment,
  normalizeMercadoPagoSubscriptionStatus,
  normalizeMercadoPagoWebhookOrder,
  normalizeProviderPaymentStatus,
  verifyWebhookRequest
};
