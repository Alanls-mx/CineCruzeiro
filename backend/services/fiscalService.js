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

function nationalTaxCode(config = {}) {
  const explicit = digits(config.nationalTaxCode);
  if (explicit) return explicit;
  const legacyItem = digits(config.serviceListItem);
  return legacyItem ? legacyItem.padEnd(6, "0").slice(0, 6) : "";
}

function dpsNumberForDocument(document = {}) {
  const source = String(document.reference || document.orderId || document.id || "cine-cruzeiro");
  const hash = crypto.createHash("sha256").update(source).digest("hex").slice(0, 14);
  return String((BigInt(`0x${hash}`) % 999999999999999n) + 1n);
}

function missingConfiguration(config = {}) {
  const required = [
    ["apiToken", "token da Focus NFe"],
    ["cnpj", "CNPJ do cinema"],
    ["municipalRegistration", "inscrição municipal"],
    ["municipalityCode", "código IBGE do município"],
    ["nationalTaxCode", "código de tributação nacional do ISS (6 dígitos)"]
  ];
  return required.filter(([key]) => key === "nationalTaxCode" ? nationalTaxCode(config).length !== 6 : !String(config[key] || "").trim()).map(([, label]) => label);
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
    type: "nfsen",
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
    metadata: {
      fiscalStandard: "national",
      includeConcessionsInServiceAmount: Boolean(config.includeConcessionsInServiceAmount),
      seats: Array.isArray(order.selectedSeats) && order.selectedSeats.length ? order.selectedSeats.map((seat) => seat.label) : ["Lugar livre"]
    },
    history: [statusHistory(status, options.actor || "system", lastError)],
    createdAt: now,
    updatedAt: now
  };
}

function descriptionFor(order, config = {}) {
  const template = String(config.serviceDescription || "Ingressos e serviços cinematográficos do pedido {{pedido}}");
  const seats = Array.isArray(order.selectedSeats) && order.selectedSeats.length
    ? order.selectedSeats.map((seat) => seat.label).join(", ")
    : "Lugar livre";
  const hasSeatPlaceholder = /{{\s*assentos?\s*}}/i.test(template);
  const description = template
    .replace(/{{\s*pedido\s*}}/gi, String(order.reference || order.id || ""))
    .replace(/{{\s*cliente\s*}}/gi, String(order.customerName || ""))
    .replace(/{{\s*filme\s*}}/gi, String(order.movieTitle || ""))
    .replace(/{{\s*sessao\s*}}/gi, [order.sessionDate, order.sessionTime].filter(Boolean).join(" às "))
    .replace(/{{\s*sala\s*}}/gi, String(order.sessionRoom || ""))
    .replace(/{{\s*assentos?\s*}}/gi, seats);
  return hasSeatPlaceholder ? description : `${description} | Poltrona(s): ${seats}`;
}

function buildPayload(order, document, config = {}) {
  const taxId = customerTaxId(order);
  const now = new Date();
  const payload = {
    data_emissao: now.toISOString(),
    data_competencia: new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now),
    serie_dps: Number(config.dpsSeries || 1),
    numero_dps: dpsNumberForDocument(document),
    emitente_dps: 1,
    codigo_municipio_emissora: digits(config.municipalityCode),
    cnpj_prestador: digits(config.cnpj),
    inscricao_municipal_prestador: String(config.municipalRegistration || "").trim(),
    codigo_opcao_simples_nacional: config.simpleNational ? Number(config.simpleNationalProfile || 3) : 1,
    regime_especial_tributacao: Number(config.specialTaxRegime || 0),
    razao_social_tomador: String(order.customerName || "Cliente Cine Cruzeiro").trim(),
    email_tomador: String(order.customerEmail || "").trim(),
    telefone_tomador: digits(order.customerPhone || ""),
    codigo_municipio_prestacao: digits(config.municipalityCode),
    codigo_tributacao_nacional_iss: nationalTaxCode(config),
    descricao_servico: descriptionFor(order, config),
    valor_servico: money(document.serviceAmount),
    tributacao_iss: 1,
    tipo_retencao_iss: config.issWithheld ? 2 : 1
  };
  if (taxId.length === 14) payload.cnpj_tomador = taxId;
  else payload.cpf_tomador = taxId;
  if (!payload.telefone_tomador) delete payload.telefone_tomador;
  if (!payload.email_tomador) delete payload.email_tomador;
  if (!payload.inscricao_municipal_prestador) delete payload.inscricao_municipal_prestador;
  const municipalCode = String(config.municipalTaxCode || "").trim();
  if (/^[A-Za-z0-9]{1,3}$/.test(municipalCode)) payload.codigo_tributacao_municipal_iss = municipalCode;
  const rate = Number(config.issRate || 0);
  if (rate > 0) payload.percentual_aliquota_relativa_municipio = rate;
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
      const providerMessage = details || payload.mensagem || payload.message || `Focus NFe respondeu HTTP ${response.status}.`;
      const nationalEnvironmentError = /habilita_nfsen_(?:producao|homologacao)|ambiente nacional/i.test(providerMessage);
      const error = new Error(nationalEnvironmentError
        ? `${providerMessage} Na Focus NFe, abra a empresa do Cine Cruzeiro em Documentos Fiscais, habilite “Ambiente da NFS-e Nacional – ${config.environment === "production" ? "Produção" : "Homologação"}” e desabilite a NFS-e municipal antes de tentar novamente.`
        : providerMessage);
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
  const result = await providerRequest(config, `/nfsen?ref=${encodeURIComponent(document.reference)}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return applyProviderResult(document, result, config);
}

async function consult(document, config) {
  const result = await providerRequest(config, `/nfsen/${encodeURIComponent(document.reference)}`, { method: "GET" });
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
  nationalTaxCode,
  dpsNumberForDocument,
  createDocument,
  buildPayload,
  applyProviderResult,
  issue,
  consult,
  testConnection,
  download
};
