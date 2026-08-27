const crypto = require("crypto");

const API_BASE_URL = "https://api.mercadopago.com";

function providerError(message, statusCode = 502, code = "POINT_PROVIDER_ERROR", details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function accessToken(config = {}) {
  return String(config.accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
}

function terminalId(config = {}) {
  return String(config.pointTerminalId || config.pointDeviceId || "").trim();
}

function cardTerminalConfigured(config = {}) {
  return Boolean(config.enabled !== false && config.pointEnabled && accessToken(config) && terminalId(config));
}

function providerName() {
  return "mercado_pago";
}

function safeReference(value, fallback = "cine-cruzeiro") {
  const sanitized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return sanitized || `${fallback}-${Date.now()}`.slice(0, 64);
}

function decimalAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw providerError("O valor da venda presencial deve ser maior que zero.", 400, "POINT_INVALID_AMOUNT");
  }
  return number.toFixed(2);
}

function printText(value, maxLength = 80) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function brazilianDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : printText(value, 10);
}

function ticketPrintContent(tickets = []) {
  const normalized = (Array.isArray(tickets) ? tickets : []).filter(Boolean);
  if (!normalized.length) {
    throw providerError("Nenhum ingresso foi informado para impressão.", 400, "POINT_PRINT_TICKETS_MISSING");
  }

  let content = "{center}{w}{b}CINE CRUZEIRO{/b}{/w}{br}{s}INGRESSO FISICO{/s}{/center}{br}";
  normalized.forEach((ticket, index) => {
    const movie = printText(ticket.movieTitle || "Filme", 38);
    const date = brazilianDate(ticket.sessionDate);
    const time = printText(ticket.sessionTime, 5);
    const format = printText(ticket.sessionFormat, 24);
    const room = printText(ticket.sessionRoom || "Sala Cruzeiro", 30);
    const type = printText(ticket.ticketType || "Ingresso", 24);
    const code = printText(ticket.code, 42);
    const qrPayload = printText(ticket.qrPayload || ticket.code, 160);
    content += `{center}{b}${index + 1}/${normalized.length} - ${movie}{/b}{br}`;
    content += `${date} ${time}${format ? ` - ${format}` : ""}{br}`;
    content += `${room}{br}${type}{br}{s}${code}{/s}{br}`;
    content += `{qr}${qrPayload}{/qr}{br}--------------------------------{/center}{br}`;
  });
  content += "{center}{s}Apresente o QR Code na entrada.{/s}{/center}{br}";

  if (content.length > 4096) {
    throw providerError(
      "A venda possui ingressos demais para uma única impressão na Point. Use a impressão individual pelo painel.",
      400,
      "POINT_PRINT_CONTENT_TOO_LARGE",
      { contentLength: content.length, ticketCount: normalized.length }
    );
  }
  return content.padEnd(100, " ");
}

function normalizeStatus(order = {}) {
  const status = String(order.status || "").toLowerCase();
  const detail = String(order.status_detail || order.statusDetail || "").toLowerCase();
  if (status === "processed" && ["accredited", "approved", "partially_refunded"].includes(detail)) return "approved";
  if (["refunded", "charged_back"].includes(status) || ["refunded", "charged_back"].includes(detail)) return "refunded";
  if (["canceled", "cancelled"].includes(status) || ["canceled", "cancelled"].includes(detail)) return "cancelled";
  if (status === "expired" || detail === "expired") return "expired";
  if (["failed", "rejected"].includes(status) || ["failed", "rejected"].includes(detail)) return "rejected";
  if (["created", "at_terminal", "action_required", "processing"].includes(status)) return "pending";
  return status || "pending";
}

function normalizeOrder(order = {}) {
  const payments = Array.isArray(order.transactions?.payments) ? order.transactions.payments : [];
  const payment = payments[0] || {};
  return {
    id: String(order.id || ""),
    externalReference: String(order.external_reference || ""),
    status: normalizeStatus(order),
    providerStatus: String(order.status || ""),
    statusDetail: String(order.status_detail || payment.status_detail || ""),
    amount: Number(order.total_amount || payment.amount || 0),
    paidAmount: Number(order.total_paid_amount || payment.paid_amount || 0),
    terminalId: String(order.config?.point?.terminal_id || ""),
    paymentId: String(payment.id || ""),
    paymentMethod: String(payment.payment_method?.id || payment.payment_method?.type || ""),
    createdAt: order.date_created || order.created_date || "",
    updatedAt: order.last_updated || order.date_last_updated || "",
    raw: order
  };
}

async function request(pathname, config = {}, options = {}) {
  const token = accessToken(config);
  if (!token) throw providerError("Access Token do Mercado Pago não configurado.", 412, "POINT_ACCESS_TOKEN_MISSING");
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(Number(config.timeout || 15000))
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const message = payload.message || payload.error || payload.cause?.[0]?.description || `Mercado Pago Point respondeu HTTP ${response.status}.`;
    throw providerError(message, response.status, payload.code || "POINT_API_REJECTED", payload);
  }
  return payload;
}

async function listTerminals(config = {}) {
  const payload = await request("/terminals/v1/list", config);
  const terminals = Array.isArray(payload) ? payload : payload.data || payload.terminals || payload.devices || payload.results || [];
  return terminals.map((terminal) => ({
    id: String(terminal.id || terminal.terminal_id || ""),
    name: String(terminal.name || terminal.description || terminal.id || ""),
    status: String(terminal.status || ""),
    operatingMode: String(terminal.operating_mode || terminal.operatingMode || ""),
    raw: terminal
  }));
}

async function createPayment(order = {}, config = {}, options = {}) {
  if (!cardTerminalConfigured(config)) {
    throw providerError("Configure e habilite um Terminal ID do Mercado Pago Point.", 412, "POINT_NOT_CONFIGURED");
  }
  const externalReference = safeReference(options.externalReference || order.externalReference || order.id);
  const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID());
  const ticketNumber = safeReference(options.ticketNumber || externalReference);
  const payload = await request("/v1/orders", config, {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: {
      type: "point",
      external_reference: externalReference,
      description: String(options.description || order.description || "Venda presencial Cine Cruzeiro").slice(0, 255),
      expiration_time: String(config.pointExpirationTime || "PT15M"),
      transactions: { payments: [{ amount: decimalAmount(order.totalPrice ?? order.amount) }] },
      config: {
        point: {
          terminal_id: terminalId(config),
          print_on_terminal: config.pointPrintOnTerminal === "no_ticket" ? "no_ticket" : "seller_ticket",
          ticket_number: ticketNumber
        }
      }
    }
  });
  return { ...normalizeOrder(payload), idempotencyKey };
}

async function createTicketPrint(tickets = [], config = {}, options = {}) {
  if (!cardTerminalConfigured(config)) {
    throw providerError("Configure e habilite um Terminal ID do Mercado Pago Point.", 412, "POINT_NOT_CONFIGURED");
  }
  const externalReference = safeReference(options.externalReference || `ticket-print-${Date.now()}`);
  const idempotencyKey = String(options.idempotencyKey || crypto.randomUUID());
  const content = ticketPrintContent(tickets);
  const payload = await request("/terminals/v1/actions", config, {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: {
      type: "print",
      external_reference: externalReference,
      config: {
        point: {
          terminal_id: terminalId(config),
          subtype: "custom"
        }
      },
      content
    }
  });
  return {
    id: String(payload.id || ""),
    status: String(payload.status || "created"),
    externalReference: String(payload.external_reference || externalReference),
    terminalId: String(payload.config?.point?.terminal_id || terminalId(config)),
    subtype: String(payload.config?.point?.subtype || "custom"),
    idempotencyKey
  };
}

async function getStatus(providerOrderId, config = {}) {
  if (!providerOrderId) throw providerError("Order ID do Point não informado.", 400, "POINT_ORDER_ID_MISSING");
  return normalizeOrder(await request(`/v1/orders/${encodeURIComponent(providerOrderId)}`, config));
}

async function cancelPayment(providerOrderId, config = {}, options = {}) {
  if (!providerOrderId) throw providerError("Order ID do Point não informado.", 400, "POINT_ORDER_ID_MISSING");
  const payload = await request(`/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`, config, {
    method: "POST",
    headers: { "X-Idempotency-Key": String(options.idempotencyKey || crypto.randomUUID()) },
    body: {}
  });
  return normalizeOrder(payload);
}

async function refundPayment(providerOrderId, config = {}, options = {}) {
  if (!providerOrderId) throw providerError("Order ID do Point não informado.", 400, "POINT_ORDER_ID_MISSING");
  const payload = await request(`/v1/orders/${encodeURIComponent(providerOrderId)}/refund`, config, {
    method: "POST",
    headers: { "X-Idempotency-Key": String(options.idempotencyKey || crypto.randomUUID()) },
    body: options.amount ? { transactions: { payments: [{ amount: decimalAmount(options.amount) }] } } : {}
  });
  return normalizeOrder(payload);
}

function manualTerminalPaymentMetadata(input = {}, adminUser = {}) {
  return {
    terminalMode: "manual_external",
    terminalConfigured: false,
    terminalReference: String(input.terminalReference || input.reference || "").trim(),
    confirmedBy: adminUser.id || "",
    confirmedByEmail: adminUser.email || "",
    confirmedAt: new Date().toISOString()
  };
}

module.exports = {
  configured: cardTerminalConfigured,
  providerName,
  manualTerminalPaymentMetadata,
  listTerminals,
  createPayment,
  createTicketPrint,
  ticketPrintContent,
  getStatus,
  cancelPayment,
  refundPayment,
  normalizeOrder,
  normalizeStatus,
  safeReference
};
