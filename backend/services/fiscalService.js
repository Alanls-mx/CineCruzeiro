const crypto = require("crypto");
const integrationConfigService = require("./integrationConfigService");

const PROVIDER = "focus_nfe";
const BASE_URLS = {
  sandbox: "https://homologacao.focusnfe.com.br/v2",
  production: "https://api.focusnfe.com.br/v2"
};

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function referenceForOrder(orderId) {
  const hash = crypto.createHash("sha256").update(String(orderId || "")).digest("hex").slice(0, 24).toUpperCase();
  return `CC${hash}`;
}

function configFor(db) {
  return integrationConfigService.resolvedConfig(db, "fiscal") || {};
}

function missingConfiguration(config = {}) {
  const required = [
    ["apiToken", "token da Focus NFe"],
    ["cnpj", "CNPJ do cinema"],
    ["municipalRegistration", "inscrição municipal"],
    ["municipalityCode", "código IBGE do município"],
    ["serviceListItem", "item da lista de serviço"],
    ["municipalTaxCode", "código tributário municipal"]
  ];
  return required.filter(([key]) => !String(config[key] || "").trim()).map(([, label]) => label);
}

function configured(config = {}) {
  return Boolean(config.enabled && missingConfiguration(config).length === 0);
}

function concessionAmount(order = {}) {
  return money((order.concessionItems || []).reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity || 0));
    return sum + quantity * money(item.unitPrice ?? item.price);
  }, 0));
}

function serviceAmount(order = {}, config = {}) {
  const total = money(order.totalPrice ?? order.total);
  if (config.includeConcessionsInServiceAmount) return total;
  return money(Math.max(0, total - concessionAmount(order)));
}

function customerTaxId(order = {}) {
  return digits(order.customerCpf || order.customerTaxId);
}

function customerValidation(order = {}) {
  const taxId = customerTaxId(order);
  if (![11, 14].includes(taxId.length)) return "Informe CPF ou CNPJ válido do cliente para emitir a nota.";
  if (!String(order.customerName || "").trim()) return "Informe o nome do cliente para emitir a nota.";
  return "";
}

function statusHistory(status, actor = "system", detail = "") {
  return { status, actor, detail, at: new Date().toISOString() };
}

function createDocument(order, config = {}, options = {}) {
  const now = new Date().toISOString();
  const missing = missingConfiguration(config);
  const customerError = customerValidation(order);
  const amount = serviceAmount(order, config);
  let status = "queued";
  let lastError = "";
  if (!config.enabled || missing.length) {
    status = "pending_configuration";
    lastError = `Configuração fiscal incompleta: ${missing.join(", ") || "integração desativada"}.`;
  } else if (customerError) {
    status = "pending_customer_data";
    lastError = customerError;
  } else if (amount <= 0) {
    status = "not_applicable";
    lastError = "O pedido não possui valor de serviço elegível para NFS-e.";
  }
  const reference = referenceForOrder(order.id);
  return {
    id: `nfse-${reference.toLowerCase()}`,
    orderId: order.id,
    reference,
    type: "nfse",
    provider: PROVIDER,
    environment: config.environment === "production" ? "production" : "sandbox",
    status,
    customerName: order.customerName || "",
    customerEmail: String(order.customerEmail || "").trim().toLowerCase(),
    customerTaxId: customerTaxId(order),
    amount: money(order.totalPrice ?? order.total),
    serviceAmount: amount,
    concessionAmount: concessionAmount(order),
    invoiceNumber: "",
    verificationCode: "",
    providerStatus: "",
    municipalUrl: "",
    pdfUrl: "",
    xmlUrl: "",
    lastError,
    attempts: 0,
    autoIssued: Boolean(options.autoIssued),
    emailStatus: "pending",
    emailSentAt: "",
    issuedAt: "",
    authorizedAt: "",
    cancelledAt: "",
    metadata: { includeConcessionsInServiceAmount: Boolean(config.includeConcessionsInServiceAmount) },
    history: [statusHistory(status, options.actor || "system", lastError)],
    createdAt: now,
    updatedAt: now
  };
}

function descriptionFor(order, config = {}) {
  const template = String(config.serviceDescription || "Ingressos e serviços cinematográficos do pedido {{pedido}}");
  return template
    .replace(/{{\s*pedido\s*}}/gi, String(order.reference || order.id || ""))
    .replace(/{{\s*cliente\s*}}/gi, String(order.customerName || ""));
}

function buildPayload(order, document, config = {}) {
  const taxId = customerTaxId(order);
  const recipient = {
    razao_social: String(order.customerName || "Cliente Cine Cruzeiro").trim(),
    email: String(order.customerEmail || "").trim(),
    telefone: digits(order.customerPhone || "")
  };
  if (taxId.length === 14) recipient.cnpj = taxId;
  else recipient.cpf = taxId;
  if (!recipient.telefone) delete recipient.telefone;
  if (!recipient.email) delete recipient.email;

  const payload = {
    data_emissao: new Date().toISOString(),
    natureza_operacao: String(config.natureOperation || "1"),
    optante_simples_nacional: Boolean(config.simpleNational),
    incentivador_cultural: Boolean(config.culturalIncentive),
    prestador: {
      cnpj: digits(config.cnpj),
      inscricao_municipal: String(config.municipalRegistration || "").trim(),
      codigo_municipio: digits(config.municipalityCode)
    },
    tomador: recipient,
    servico: {
      valor_servicos: money(document.serviceAmount),
      iss_retido: Boolean(config.issWithheld),
      item_lista_servico: String(config.serviceListItem || "").trim(),
      codigo_tributario_municipio: String(config.municipalTaxCode || "").trim(),
      discriminacao: descriptionFor(order, config),
      codigo_municipio: digits(config.municipalityCode)
    }
  };
  const rate = Number(config.issRate || 0);
  if (rate > 0) payload.servico.aliquota = rate;
  if (String(config.specialTaxRegime || "").trim()) payload.regime_especial_tributacao = String(config.specialTaxRegime).trim();
  return payload;
}

function baseUrl(config = {}) {
  return BASE_URLS[config.environment === "production" ? "production" : "sandbox"];
}

function authHeader(config = {}) {
  return `Basic ${Buffer.from(`${String(config.apiToken || "")}:`).toString("base64")}`;
}

async function providerRequest(config, pathname, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(config.timeout || 15000));
  try {
    const response = await fetch(`${baseUrl(config)}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: authHeader(config),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok) {
      const details = Array.isArray(payload.erros) ? payload.erros.map((item) => item.mensagem || item.message || item.codigo).filter(Boolean).join("; ") : "";
      const error = new Error(details || payload.mensagem || payload.message || `Focus NFe respondeu HTTP ${response.status}.`);
      error.statusCode = response.status;
      error.providerPayload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function absoluteProviderUrl(value, config = {}) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl(config)}/${url.replace(/^\/+/, "")}`;
}

function applyProviderResult(document, payload = {}, config = {}) {
  const now = new Date().toISOString();
  const providerStatus = String(payload.status || payload.situacao || "processando_autorizacao");
  const errors = Array.isArray(payload.erros)
    ? payload.erros.map((item) => item.mensagem || item.message || item.codigo).filter(Boolean).join("; ")
    : "";
  const authorized = ["autorizado", "authorized"].includes(providerStatus.toLowerCase());
  const cancelled = ["cancelado", "cancelled"].includes(providerStatus.toLowerCase());
  const failed = /erro|rejeitad|cancelad/.test(providerStatus.toLowerCase()) && !cancelled;
  const status = authorized ? "authorized" : cancelled ? "cancelled" : failed ? "error" : "processing";
  document.status = status;
  document.providerStatus = providerStatus;
  document.invoiceNumber = String(payload.numero || payload.numero_nfse || document.invoiceNumber || "");
  document.verificationCode = String(payload.codigo_verificacao || document.verificationCode || "");
  document.municipalUrl = String(payload.url || document.municipalUrl || "");
  document.pdfUrl = absoluteProviderUrl(payload.url_danfse || payload.caminho_pdf_nota_fiscal || document.pdfUrl, config);
  document.xmlUrl = absoluteProviderUrl(payload.caminho_xml_nota_fiscal || payload.url_xml || document.xmlUrl, config);
  document.lastError = errors;
  document.updatedAt = now;
  if (authorized) document.authorizedAt ||= now;
  if (cancelled) document.cancelledAt ||= now;
  document.history ||= [];
  const last = document.history[document.history.length - 1];
  if (last?.status !== status || errors) document.history.push(statusHistory(status, "focus_nfe", errors || providerStatus));
  return document;
}

async function issue(document, order, config) {
  const payload = buildPayload(order, document, config);
  document.attempts = Number(document.attempts || 0) + 1;
  document.issuedAt ||= new Date().toISOString();
  const result = await providerRequest(config, `/nfse?ref=${encodeURIComponent(document.reference)}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return applyProviderResult(document, result, config);
}

async function consult(document, config) {
  const result = await providerRequest(config, `/nfse/${encodeURIComponent(document.reference)}`, { method: "GET" });
  return applyProviderResult(document, result, config);
}

async function testConnection(config) {
  if (!configured(config)) return { ok: false, message: `Complete: ${missingConfiguration(config).join(", ")}.` };
  try {
    await providerRequest(config, "/hooks", { method: "GET" });
    return { ok: true, message: `Focus NFe conectada no ambiente de ${config.environment === "production" ? "produção" : "homologação"}.` };
  } catch (error) {
    return { ok: false, message: `Focus NFe recusou a conexão: ${error.message}` };
  }
}

async function download(document, format, config) {
  const normalized = String(format || "pdf").toLowerCase() === "xml" ? "xml" : "pdf";
  const url = normalized === "xml" ? document.xmlUrl : document.pdfUrl;
  if (!url) throw Object.assign(new Error(`A ${normalized.toUpperCase()} ainda não está disponível.`), { statusCode: 409 });
  const response = await fetch(url, { headers: { Authorization: authHeader(config) } });
  if (!response.ok) throw Object.assign(new Error(`Não foi possível baixar a ${normalized.toUpperCase()} no provedor fiscal.`), { statusCode: response.status });
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: normalized === "xml" ? "application/xml; charset=utf-8" : "application/pdf",
    filename: `nota-fiscal-${document.invoiceNumber || document.reference}.${normalized}`
  };
}

module.exports = {
  PROVIDER,
  configFor,
  configured,
  missingConfiguration,
  referenceForOrder,
  concessionAmount,
  serviceAmount,
  customerValidation,
  createDocument,
  buildPayload,
  applyProviderResult,
  issue,
  consult,
  testConnection,
  download
};
