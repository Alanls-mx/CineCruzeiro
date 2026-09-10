const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const integrationConfigService = require("./integrationConfigService");
const { brazilianDate } = require("../utils/dateFormat");

function emailAttachmentRoot() {
  return path.resolve(process.env.CINE_EMAIL_ATTACHMENTS_DIR || path.join(__dirname, "..", "data", "email-attachments"));
}

function safeAttachmentPath(value) {
  if (!value || String(value).includes("\0")) return "";
  const root = emailAttachmentRoot();
  const target = path.resolve(String(value));
  const relative = path.relative(root, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return "";
  return target;
}

async function prepareAttachments(attachments = []) {
  const prepared = await Promise.all((Array.isArray(attachments) ? attachments : []).slice(0, 10).map(async (attachment = {}) => {
    if (!attachment.path) {
      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(String(attachment.content || ""), "utf8");
      return { ...attachment, content, path: undefined };
    }
    const filePath = safeAttachmentPath(attachment.path);
    if (!filePath) return null;
    const content = await fs.readFile(filePath).catch(() => null);
    return content ? { ...attachment, content, path: undefined } : null;
  }));
  return prepared.filter(Boolean);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function smtpConfigured(config = {}) {
  return Boolean(config.enabled && config.smtpHost && config.smtpUser && config.smtpPassword && config.fromEmail);
}

function webhookConfigured(config = {}) {
  return Boolean(config.enabled && config.webhookUrl);
}

function transporter(config) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort || 587),
    secure: Boolean(config.smtpSecure),
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword
    }
  });
}

function emailConfig(db) {
  return integrationConfigService.resolvedConfig(db, "email") || {};
}

function recipientFingerprint(value) {
  return crypto.createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex").slice(0, 16);
}

function smtpFailure(error = {}) {
  const code = String(error.code || "SMTP_ERROR");
  const command = String(error.command || "").toUpperCase();
  const responseCode = Number(error.responseCode || 0);
  const definitelyBeforeDelivery = ["CONN", "AUTH", "EHLO", "HELO"].includes(command) || code === "EAUTH" || code === "ECONNECTION";
  if (definitelyBeforeDelivery) {
    return { status: "retryable_failed", retryable: true, safeToFallback: true, errorCode: code, errorMessage: error.message || "Falha SMTP antes do envio." };
  }
  if (responseCode >= 500) {
    return { status: "failed", retryable: false, safeToFallback: true, errorCode: code, errorMessage: error.message || "Mensagem rejeitada pelo SMTP." };
  }
  if (responseCode >= 400) {
    return { status: "retryable_failed", retryable: true, safeToFallback: true, errorCode: code, errorMessage: error.message || "SMTP indisponível temporariamente." };
  }
  return { status: "unknown", retryable: false, safeToFallback: false, errorCode: code, errorMessage: error.message || "O SMTP não confirmou se aceitou a mensagem." };
}

async function sendSmtpDetailed(db, message) {
  const config = emailConfig(db);
  if (!smtpConfigured(config)) return { status: "unavailable", provider: "smtp", safeToFallback: true, errorCode: "SMTP_NOT_CONFIGURED", errorMessage: "SMTP não configurado." };
  const fromName = config.fromName || "Cine Cruzeiro";
  try {
    const info = await transporter(config).sendMail({
      from: `"${fromName.replace(/"/g, "")}" <${config.fromEmail}>`,
      replyTo: config.replyTo || config.fromEmail,
      ...message
    });
    if (Array.isArray(info.rejected) && info.rejected.length && !(info.accepted || []).length) {
      return { status: "failed", provider: "smtp", retryable: false, safeToFallback: true, providerMessageId: info.messageId || "", errorCode: "SMTP_RECIPIENT_REJECTED", errorMessage: "O servidor SMTP rejeitou o destinatário." };
    }
    return { status: "sent", provider: "smtp", retryable: false, safeToFallback: false, providerMessageId: info.messageId || "", metadata: { accepted: (info.accepted || []).length, rejected: (info.rejected || []).length, response: String(info.response || "").slice(0, 300) } };
  } catch (error) {
    return { provider: "smtp", ...smtpFailure(error) };
  }
}

async function webhookAttachments(message = {}) {
  const attachments = await prepareAttachments(message.attachments);
  return attachments.map((attachment) => {
    const content = attachment.content;
    return {
      filename: attachment.filename,
      contentType: attachment.contentType || "application/octet-stream",
      contentBase64: content.toString("base64")
    };
  });
}

async function sendWebhookDetailed(db, message, event, data = {}, correlation = {}) {
  const config = emailConfig(db);
  if (!webhookConfigured(config)) return { status: "unavailable", provider: "webhook", retryable: false, errorCode: "WEBHOOK_NOT_CONFIGURED", errorMessage: "Webhook não configurado." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(config.timeout || 10000));
  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Origin-Client": "CineCruzeiro-Backend",
        "X-Idempotency-Key": correlation.deliveryId || correlation.attemptId || "",
        ...(correlation.campaignId ? { "X-Campaign-Id": correlation.campaignId } : {}),
        ...(correlation.attemptId ? { "X-Attempt-Id": correlation.attemptId } : {}),
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...(config.webhookSecret ? { "X-Cine-Cruzeiro-Email-Secret": config.webhookSecret } : {})
      },
      body: JSON.stringify({
        version: 2,
        event,
        timestamp: new Date().toISOString(),
        source: "cine-cruzeiro",
        campaignId: correlation.campaignId || "",
        deliveryId: correlation.deliveryId || "",
        attemptId: correlation.attemptId || "",
        templateId: correlation.templateId || "",
        recipientKey: correlation.recipientKey || "",
        emailType: correlation.emailType || "marketing",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: await webhookAttachments(message),
        data
      })
    });
    const providerMessageId = response.headers.get("x-message-id") || response.headers.get("x-request-id") || "";
    if (response.ok) return { status: "sent", provider: "webhook", providerMessageId, retryable: false, metadata: { httpStatus: response.status } };
    if (response.status >= 500 || response.status === 429) return { status: "retryable_failed", provider: "webhook", retryable: true, errorCode: `WEBHOOK_HTTP_${response.status}`, errorMessage: "O webhook recusou temporariamente a entrega.", metadata: { httpStatus: response.status } };
    return { status: "failed", provider: "webhook", retryable: false, errorCode: `WEBHOOK_HTTP_${response.status}`, errorMessage: "O webhook rejeitou a entrega.", metadata: { httpStatus: response.status } };
  } catch (error) {
    return { status: "unknown", provider: "webhook", retryable: false, errorCode: error?.name === "AbortError" ? "WEBHOOK_TIMEOUT" : String(error?.code || "WEBHOOK_NETWORK_ERROR"), errorMessage: "O webhook não confirmou se recebeu a mensagem." };
  } finally {
    clearTimeout(timer);
  }
}

async function sendTransactional(db, message, event, data = {}) {
  const safeMessage = { ...message, attachments: await prepareAttachments(message.attachments) };
  const smtpResult = await sendSmtpDetailed(db, safeMessage);
  if (smtpResult.status === "sent") return true;
  if (!smtpResult.safeToFallback) {
    console.warn("[email] delivery result is uncertain; webhook fallback skipped", { event, recipient: recipientFingerprint(message.to), code: smtpResult.errorCode });
    return false;
  }
  const deliveryId = crypto.randomUUID();
  const webhookResult = await sendWebhookDetailed(db, safeMessage, event, data, {
    deliveryId,
    attemptId: crypto.randomUUID(),
    emailType: "transactional",
    recipientKey: recipientFingerprint(message.to)
  });
  if (webhookResult.status !== "sent") {
    console.warn("[email] webhook delivery failed", { event, recipient: recipientFingerprint(message.to), code: webhookResult.errorCode });
  }
  return webhookResult.status === "sent";
}

async function verifySmtp(db) {
  const config = emailConfig(db);
  if (!smtpConfigured(config)) {
    return { ok: false, message: "Informe host, porta, usuário, senha SMTP e e-mail remetente." };
  }
  try {
    await transporter(config).verify();
    return { ok: true, message: "SMTP autenticado e pronto para envio." };
  } catch (error) {
    return { ok: false, message: `SMTP recusou a conexão: ${error.message}` };
  }
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : fallback;
}

function button(label, url, secondary = false, options = {}) {
  const safeUrl = safeLink(url);
  if (!safeUrl) return "";
  const background = safeColor(options.background, secondary ? "#172554" : "#facc15");
  const foreground = safeColor(options.color, secondary ? "#eff6ff" : (background === "#facc15" ? "#020617" : "#ffffff"));
  return `<a href="${htmlEscape(safeUrl)}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:${background};color:${foreground};padding:13px 16px;border-radius:8px;text-decoration:none;font-weight:900;line-height:1.2;margin:6px 8px 6px 0;word-break:break-word">${htmlEscape(label)}</a>`;
}

function safeLink(value) {
  const raw = String(value || "").trim();
  if (!raw || /^(javascript|data|vbscript):/i.test(raw)) return "";
  return /^(https?:|mailto:|tel:|\/)/i.test(raw) ? raw : "";
}

function absoluteUrl(value, siteUrl = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    const base = new URL(String(siteUrl || ""));
    const basePath = base.pathname.replace(/\/+$/, "");
    const relative = raw.startsWith("/") ? raw : `/${raw}`;
    if (basePath && (relative === basePath || relative.startsWith(`${basePath}/`))) {
      return `${base.origin}${relative}`;
    }
    return `${base.origin}${basePath}${relative}`;
  } catch {
    return raw;
  }
}

function campaignImageBlock(input = {}, recipient = {}) {
  const rawImageUrl = interpolateCampaign(input.imageUrl || "", recipient, input.variables);
  if (!safeLink(rawImageUrl)) return "";
  const imageUrl = absoluteUrl(rawImageUrl, input.siteUrl || "");
  if (!/^https?:\/\//i.test(imageUrl)) return "";
  const alt = interpolateCampaign(input.imageAlt || "Imagem da campanha", recipient, input.variables).slice(0, 140);
  const rawLink = interpolateCampaign(input.imageLink || "", recipient, input.variables);
  const image = `<img src="${htmlEscape(imageUrl)}" width="640" alt="${htmlEscape(alt)}" style="display:block;width:100%;max-width:640px;height:auto;border:0;border-radius:8px;outline:0;text-decoration:none;margin:0 auto;background-color:#0d1728">`;
  const link = absoluteUrl(rawLink, input.siteUrl || "");
  const safeImageLink = rawLink && safeLink(rawLink) && /^https?:\/\//i.test(link) ? link : "";
  return `<div style="margin:0 0 18px;text-align:center">${safeImageLink ? `<a href="${htmlEscape(safeImageLink)}" style="display:block;text-decoration:none">${image}</a>` : image}</div>`;
}

function campaignBlockMedia(block, input, recipient) {
  const rawUrl = interpolateCampaignPlain(block.url || "", recipient, input.variables);
  if (!safeLink(rawUrl)) return "";
  const url = absoluteUrl(rawUrl, input.siteUrl || "");
  if (!/^https?:\/\//i.test(url)) return "";
  const rawLink = interpolateCampaignPlain(block.link || "", recipient, input.variables);
  const link = rawLink && safeLink(rawLink) ? absoluteUrl(rawLink, input.siteUrl || "") : "";
  const width = Math.max(4, Math.min(100, Number(block.width || (block.type === "icon" ? 12 : 70))));
  const alt = htmlEscape(interpolateCampaignPlain(block.alt || "Imagem", recipient, input.variables));
  const image = `<img src="${htmlEscape(url)}" width="${Math.round(640 * width / 100)}" alt="${alt}" style="display:inline-block;width:${width}%;max-width:100%;height:auto;border:0;border-radius:${block.type === "icon" ? 4 : 8}px;outline:0;text-decoration:none;background-color:#0d1728">`;
  return /^https?:\/\//i.test(link) ? `<a href="${htmlEscape(link)}" style="display:inline-block;text-decoration:none">${image}</a>` : image;
}

function renderCampaignContentBlocks(blocks = [], input = {}, recipient = {}) {
  return (blocks || []).map((block = {}) => {
    const align = ["left", "center", "right"].includes(block.align) ? block.align : "left";
    const color = safeColor(block.color, block.type === "heading" ? "#ffffff" : "#dbeafe");
    const content = htmlEscape(interpolateCampaignPlain(block.content || "", recipient, input.variables)).replace(/\n/g, "<br>");
    if (["logo", "image", "icon"].includes(block.type)) {
      const media = campaignBlockMedia(block, input, recipient);
      return media ? `<div style="margin:0 0 16px;text-align:${align}">${media}</div>` : "";
    }
    if (block.type === "heading") return `<h2 style="margin:0 0 16px;color:${color};font-size:${Math.max(18, Math.min(42, Number(block.fontSize || 28)))}px;line-height:1.18;text-align:${align};word-break:break-word">${content}</h2>`;
    if (block.type === "kicker") return `<p style="margin:0 0 10px;color:${color};font-size:${Math.max(9, Math.min(16, Number(block.fontSize || 12)))}px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-align:${align}">${content}</p>`;
    if (block.type === "text") return `<p style="margin:0 0 16px;color:${color};font-size:${Math.max(11, Math.min(24, Number(block.fontSize || 15)))}px;line-height:1.65;text-align:${align};overflow-wrap:break-word">${content}</p>`;
    if (block.type === "signature") return `<p style="margin:4px 0 16px;color:${color};font-size:${Math.max(11, Math.min(24, Number(block.fontSize || 14)))}px;line-height:1.55;text-align:${align};font-weight:700;overflow-wrap:break-word">${content}</p>`;
    if (block.type === "button") {
      const rawUrl = interpolateCampaignPlain(block.url || "", recipient, input.variables);
      return rawUrl && safeLink(rawUrl) ? `<div style="margin:0 0 16px;text-align:${align}">${button(interpolateCampaignPlain(block.content || "Abrir", recipient, input.variables), absoluteUrl(rawUrl, input.siteUrl || ""), false, { background: block.backgroundColor, color: block.color })}</div>` : "";
    }
    if (block.type === "divider") return `<div style="margin:8px 0 20px;text-align:center"><div style="display:inline-block;width:${Math.max(10, Math.min(100, Number(block.width || 100)))}%;border-top:1px solid ${color};font-size:0;line-height:0">&nbsp;</div></div>`;
    if (block.type === "social") {
      const links = (block.links || []).map((item) => {
        const rawUrl = interpolateCampaignPlain(item.url || "", recipient, input.variables);
        const url = rawUrl && safeLink(rawUrl) ? absoluteUrl(rawUrl, input.siteUrl || "") : "";
        return /^https?:\/\//i.test(url) ? `<a href="${htmlEscape(url)}" style="display:inline-block;margin:4px 10px 4px 0;color:${color};font-weight:700;text-decoration:underline">${htmlEscape(item.label || "Rede social")}</a>` : "";
      }).join("");
      return links ? `<div style="margin:0 0 16px;text-align:${align}">${links}</div>` : "";
    }
    if (block.type === "spacer") return `<div style="height:${Math.max(8, Math.min(80, Number(block.height || 24)))}px;line-height:0;font-size:0">&nbsp;</div>`;
    return "";
  }).join("");
}

function campaignBlocksText(blocks = [], recipient = {}, variables = {}) {
  return (blocks || []).flatMap((block) => {
    if (["heading", "kicker", "text", "signature"].includes(block.type)) return [interpolateCampaignPlain(block.content || "", recipient, variables)];
    if (block.type === "button") return [`${interpolateCampaignPlain(block.content || "Abrir", recipient, variables)}: ${interpolateCampaignPlain(block.url || "", recipient, variables)}`];
    return [];
  }).filter(Boolean).join("\n\n");
}

function baseLayout(title, body, options = {}) {
  const isMarketing = options.kind === "marketing";
  const unsubscribeFooter = isMarketing && options.unsubscribeUrl
    ? `<br><a href="${htmlEscape(options.unsubscribeUrl)}" style="color:#facc15;text-decoration:underline;text-underline-offset:3px">Não desejo receber mais emails</a>`
    : "";
  const brand = options.brand || {};
  const brandName = String(brand.name || "Cine Cruzeiro").trim().slice(0, 80);
  const tagline = String(brand.tagline || "Cinema de rua, ingresso digital e atendimento de bairro.").trim().slice(0, 180);
  const logoUrl = absoluteUrl(options.logoUrl || brand.logoUrl, options.siteUrl || "");
  const textColor = safeColor(options.textColor, "#dbeafe");
  const headlineColor = safeColor(options.headlineColor, "#ffffff");
  const logo = logoUrl
    ? `<img src="${htmlEscape(logoUrl)}" width="126" alt="${htmlEscape(brandName)}" style="display:block;width:126px;max-width:40%;height:auto;border:0;margin:0 0 14px;background-color:transparent">`
    : `<strong style="display:block;color:#facc15;font-size:12px;letter-spacing:.18em;text-transform:uppercase">${htmlEscape(brandName)}</strong>`;
  const footer = String(brand.footer || "Mensagem automática do Cine Cruzeiro. Se você não reconhece esta ação, entre em contato com o cinema.").trim().slice(0, 400);
  const socialLinks = Array.isArray(brand.socialLinks) ? brand.socialLinks.filter((link) => safeLink(link?.url)).slice(0, 5) : [];
  const socialFooter = socialLinks.length
    ? `<br><span style="display:inline-block;margin-top:6px">${socialLinks.map((link) => `<a href="${htmlEscape(safeLink(link.url))}" style="color:#93c5fd;text-decoration:underline;margin-right:10px">${htmlEscape(link.label || "Rede social")}</a>`).join("")}</span>`
    : "";
  return `
    ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${htmlEscape(options.preheader)}</div>` : ""}
    <div style="margin:0;background:#060a12;padding:18px;font-family:'Segoe UI',Helvetica,sans-serif;color:#f8fafc;box-sizing:border-box;width:100%">
      <div style="max-width:680px;width:100%;margin:0 auto;box-sizing:border-box">
        ${options.hideBrand ? "" : `<div style="padding:8px 0 18px">
          ${logo}
          <span style="display:block;margin-top:6px;color:#93c5fd;font-size:13px">${htmlEscape(tagline)}</span>
        </div>`}
        <div style="background:#0d1728;padding:22px;border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.34);box-sizing:border-box;overflow-wrap:break-word">
          ${options.hideTitle ? "" : `${options.kicker ? `<p style="margin:0 0 10px;color:#60a5fa;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase">${htmlEscape(options.kicker)}</p>` : ""}<h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;color:${headlineColor};word-break:break-word">${htmlEscape(title)}</h1>`}
          ${options.heroImageHtml || ""}
          <div style="font-size:15px;line-height:1.65;color:${textColor};overflow-wrap:break-word">${body}</div>
        </div>
        <p style="margin:18px 0 0;color:#93a4bd;font-size:12px;line-height:1.6">${options.hideFooterText ? "" : `${htmlEscape(footer)}${socialFooter}`}${unsubscribeFooter}</p>
      </div>
    </div>`;
}

function sanitizeCampaignHtml(value) {
  return String(value || "")
    .replace(/<(script|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|iframe|object|embed|form)[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|data|vbscript):[\s\S]*?\2/gi, '$1="#"');
}

function repairCampaignBrandLogoHtml(value, siteUrl = "") {
  const canonicalLogoUrl = absoluteUrl("/images/favicon-email.png", siteUrl);
  return String(value || "").replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\bsrc\s*=\s*(["'])([^"']+)\1/i);
    if (!source || !/\/images\/(?:favicon-email\.png|logo-display\.webp)(?:[?#][^"']*)?$/i.test(source[2])) return tag;

    let repaired = tag.replace(source[0], `src="${htmlEscape(canonicalLogoUrl || source[2])}"`);
    if (/\bstyle\s*=/i.test(repaired)) {
      repaired = repaired.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i, (_match, quote, css) => {
        const declarations = String(css || "")
          .split(";")
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .filter((declaration) => !/^background(?:-color)?\s*:/i.test(declaration));
        return `style=${quote}${declarations.join(";")}${declarations.length ? ";" : ""}background-color:transparent${quote}`;
      });
    }
    return repaired;
  });
}

function campaignVariableValues(recipient = {}, customVariables = {}) {
  const fullName = String(recipient.name || "cliente").trim();
  return {
    ...customVariables,
    nome: fullName,
    primeiro_nome: fullName.split(/\s+/)[0] || "cliente",
    email: recipient.email || "",
    codigo_cupom: recipient.couponCode || "",
    validade_cupom: recipient.couponExpiresAt || "",
    link_cupom: recipient.couponUrl || ""
  };
}

function interpolateCampaignPlain(value, recipient = {}, customVariables = {}) {
  const variables = campaignVariableValues(recipient, customVariables);
  return String(value || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => String(variables[String(key).toLowerCase()] ?? ""));
}

function interpolateCampaign(value, recipient = {}, customVariables = {}) {
  const variables = campaignVariableValues(recipient, customVariables);
  return String(value || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => htmlEscape(variables[String(key).toLowerCase()] ?? ""));
}

function extrasSummary(items = []) {
  if (!items.length) return "Sem extras comprados neste pedido.";
  return items.map((item) => `${htmlEscape(item.name || "Extra")} x${Number(item.quantity || 0)}`).join(" · ");
}

function ticketCard(ticket = {}, options = {}) {
  const posterUrl = absoluteUrl(ticket.posterUrl, options.siteUrl);
  const sessionDate = brazilianDate(ticket.sessionDate);
  const poster = posterUrl
    ? `<td style="width:128px;padding:0 16px 0 0;vertical-align:top"><img src="${htmlEscape(posterUrl)}" width="120" alt="${htmlEscape(ticket.movieTitle || "Filme")}" style="display:block;width:120px;max-width:120px;height:auto;border-radius:8px;border:0;outline:0;text-decoration:none"></td>`
    : "";
  const wallet = ticket.googleWalletUrl ? button("Adicionar ao Google Wallet", ticket.googleWalletUrl, true) : "";
  const clubValues = ticket.paymentSource === "subscription_credit"
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#111827;border-radius:8px"><tr><td style="padding:10px;color:#cbd5e1;font-size:12px">Ingresso nº <strong style="color:#fff">${htmlEscape(ticket.ticketNumber || "-")}</strong><br>Valor do ingresso: <strong style="color:#fff">${money(ticket.basePrice)}</strong><br>Crédito Clube utilizado: <strong style="color:#45d6a1">-${money(ticket.subscriptionCreditAmount)}</strong><br>Complemento pago: <strong style="color:#facc15">${money(ticket.additionalPaymentAmount)}</strong></td></tr></table>`
    : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#09111f;border-radius:10px;table-layout:fixed;overflow:hidden">
      <tr>
        <td style="padding:16px;vertical-align:top">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed">
            <tr>
              ${poster}
              <td style="vertical-align:top;min-width:0">
                <p style="margin:0 0 6px;color:#60a5fa;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Ingresso digital</p>
                <h2 style="margin:0 0 10px;color:#fff;font-size:21px;line-height:1.18;word-break:break-word">${htmlEscape(ticket.movieTitle || "Cine Cruzeiro")}</h2>
                <p style="margin:0 0 12px;color:#facc15;font-size:16px;font-weight:900;word-break:break-word">${htmlEscape(sessionDate)} às ${htmlEscape(ticket.sessionTime || "")}</p>
                <p style="margin:0;color:#cbd5e1;word-break:break-word">${htmlEscape(ticket.sessionRoom || "Sala Cruzeiro")}<br>${htmlEscape(ticket.sessionFormat || "Sessão")}<br>Poltrona: ${htmlEscape(ticket.seat || "Lugar livre")}</p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
            <tr>
              <td style="padding:8px 10px;background:#111827;border-radius:8px;color:#bfdbfe;font-size:12px;vertical-align:top">Tipo<br><strong style="color:#fff;font-size:14px;word-break:break-word">${htmlEscape(ticket.ticketType || "Ingresso")}</strong></td>
              <td style="width:10px"></td>
              <td style="padding:8px 10px;background:#111827;border-radius:8px;color:#bfdbfe;font-size:12px;vertical-align:top">Código<br><strong style="color:#fff;font-size:14px;word-break:break-all">${htmlEscape(ticket.code || "-")}</strong></td>
            </tr>
          </table>
          ${clubValues}
          <div style="margin-top:12px">${button("Ver meus ingressos", options.accountUrl)}${wallet}</div>
        </td>
      </tr>
    </table>`;
}

async function sendPasswordReset(db, email, resetUrl, options = {}) {
  return sendTransactional(db, {
    to: email,
    subject: "Redefina sua senha do Cine Cruzeiro",
    html: baseLayout("Redefinição de senha", `
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>${button("Criar nova senha", resetUrl)}</p>
      <p>O link expira em 30 minutos. Se você não pediu isso, ignore este e-mail.</p>
    `, { kicker: "Conta", logoUrl: options.logoUrl }),
    text: `Redefina sua senha: ${resetUrl}`
  }, "password_reset.requested", { email, resetUrl });
}

async function sendEmailVerification(db, email, verificationUrl, options = {}) {
  return sendTransactional(db, {
    to: email,
    subject: "Confirme seu e-mail no Cine Cruzeiro",
    html: baseLayout("Confirme seu e-mail", `
      <p style="margin:0 0 16px">Para manter sua conta protegida e receber seus ingressos com segurança, confirme este endereço de e-mail.</p>
      <p style="margin:0 0 16px">${button("Confirmar e-mail", verificationUrl)}</p>
      <div style="margin-top:18px;padding:14px 16px;background:#09111f;border-radius:8px;color:#bfdbfe;font-size:13px;line-height:1.6">
        Este link expira em 1 hora e pode ser usado apenas uma vez. Se você não criou uma conta no Cine Cruzeiro, ignore esta mensagem.
      </div>
    `, { kicker: "Verificação da conta", logoUrl: options.logoUrl }),
    text: `Confirme seu e-mail: ${verificationUrl}`
  }, "email_verification.requested", { email, verificationUrl });
}

function eventTypeLabel(value = "") {
  return {
    aniversario: "Aniversário ou festa",
    videogame: "Games",
    filme_classico: "Sessão privada",
    corporativo: "Evento corporativo",
    outro: "Outro formato"
  }[String(value || "")] || "Evento privado";
}

async function sendPrivateEventInquiry(db, inquiry = {}, options = {}) {
  const config = emailConfig(db);
  const notificationEmail = String(config.notificationEmail || config.replyTo || config.fromEmail || config.smtpUser || "").trim();
  if (!notificationEmail) return { inquiryDelivered: false, acknowledgementDelivered: false };
  const requesterEmail = String(inquiry.email || "").trim().toLowerCase();
  const eventLabel = eventTypeLabel(inquiry.eventType);
  const details = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#09111f;border-radius:10px">
      <tr><td style="padding:16px;color:#dbeafe;line-height:1.7;overflow-wrap:anywhere">
        <strong style="color:#fff">Cliente:</strong> ${htmlEscape(inquiry.name)}<br>
        <strong style="color:#fff">E-mail:</strong> ${htmlEscape(requesterEmail)}<br>
        <strong style="color:#fff">WhatsApp:</strong> ${htmlEscape(inquiry.phone)}<br>
        <strong style="color:#fff">Evento:</strong> ${htmlEscape(eventLabel)}<br>
        <strong style="color:#fff">Data desejada:</strong> ${htmlEscape(inquiry.desiredDate || "A combinar")}<br>
        <strong style="color:#fff">Público estimado:</strong> ${htmlEscape(inquiry.estimatedGuests || "Não informado")}
      </td></tr>
    </table>
    ${inquiry.notes ? `<div style="margin-top:16px;padding:14px 16px;background:#111827;border-radius:10px"><strong style="display:block;margin-bottom:6px;color:#60a5fa">Mensagem</strong><span style="white-space:pre-wrap;overflow-wrap:anywhere">${htmlEscape(inquiry.notes)}</span></div>` : ""}
  `;
  const inquiryDelivered = await sendTransactional(db, {
    to: notificationEmail,
    replyTo: requesterEmail,
    subject: `Novo pedido de evento: ${eventLabel} - ${inquiry.name}`,
    html: baseLayout("Nova solicitação de evento", details, { kicker: "Eventos" }),
    text: `Nova solicitação de evento\nCliente: ${inquiry.name}\nE-mail: ${requesterEmail}\nWhatsApp: ${inquiry.phone}\nEvento: ${eventLabel}\nData: ${inquiry.desiredDate || "A combinar"}\nPúblico: ${inquiry.estimatedGuests || "Não informado"}\nMensagem: ${inquiry.notes || ""}`
  }, "private_rental.inquiry", { source: inquiry.source || "eventos" });
  if (!inquiryDelivered) return { inquiryDelivered: false, acknowledgementDelivered: false };

  const acknowledgementDelivered = await sendTransactional(db, {
    to: requesterEmail,
    subject: "Recebemos sua solicitação de evento - Cine Cruzeiro",
    html: baseLayout("Sua solicitação chegou", `
      <p>Olá, <strong>${htmlEscape(inquiry.name)}</strong>.</p>
      <p>Recebemos seu pedido para <strong>${htmlEscape(eventLabel)}</strong>. Nossa equipe vai analisar a data, o tamanho do grupo e os detalhes enviados.</p>
      <p>Entraremos em contato em breve pelo WhatsApp <strong>${htmlEscape(inquiry.phone)}</strong> ou por este e-mail.</p>
      <div style="margin-top:18px;padding:14px 16px;background:#111827;border-radius:10px;color:#dbeafe">
        <strong style="display:block;margin-bottom:6px;color:#facc15">Resumo</strong>
        ${htmlEscape(inquiry.desiredDate || "Data a combinar")} · ${htmlEscape(inquiry.estimatedGuests || "Público a combinar")}
      </div>
    `, { kicker: "Eventos" }),
    text: `Olá, ${inquiry.name}. Recebemos sua solicitação de ${eventLabel}. Entraremos em contato em breve.`
  }, "private_rental.acknowledged", { source: inquiry.source || "eventos" });
  return { inquiryDelivered, acknowledgementDelivered };
}

async function sendTicketDelivery(db, order, tickets = [], options = {}) {
  if (!order?.customerEmail || !tickets.length) return false;
  const extras = tickets.flatMap((ticket) => ticket.extras || []);
  const ticketCards = tickets.map((ticket) => ticketCard(ticket, options)).join("");
  const totalLine = order.totalAmount || order.total
    ? `<p style="margin:12px 0 0;color:#facc15;font-weight:900">Total aprovado: ${money(order.totalAmount || order.total)}</p>`
    : "";
  return sendTransactional(db, {
    to: order.customerEmail,
    subject: `Pagamento aprovado: ${tickets[0]?.movieTitle || order.movieTitle || "Cine Cruzeiro"}`,
    html: baseLayout("Ingressos confirmados", `
      <p>Pagamento aprovado. Seus ingressos digitais já estão liberados na sua conta e seguem anexados em PDF.</p>
      ${ticketCards}
      <div style="margin:18px 0;padding:14px 16px;background:#111827;border-radius:10px">
        <p style="margin:0 0 6px;color:#60a5fa;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.12em">Bomboniere e extras</p>
        <p style="margin:0;color:#e5e7eb">${extrasSummary(extras)}</p>
        ${totalLine}
      </div>
    `, { kicker: "Pagamento aprovado", logoUrl: options.logoUrl }),
    text: `Ingressos confirmados: ${tickets.map((ticket) => ticket.code).join(", ")}`,
    attachments: options.attachments || []
  }, "payment.approved", {
    orderId: order.id,
    ticketCodes: tickets.map((ticket) => ticket.code),
    attachments: (options.attachments || []).map((item) => item.filename)
  });
}

async function sendTicketTransfer(db, input = {}) {
  const ticket = input.ticket || {};
  const fromUser = input.fromUser || {};
  const toUser = input.toUser || {};
  const movieTitle = ticket.movieTitle || input.movieTitle || "Cine Cruzeiro";
  const toSent = toUser.email ? await sendTransactional(db, {
    to: toUser.email,
    subject: `Ingresso transferido para você: ${movieTitle}`,
    html: baseLayout("Ingresso recebido", `
      <p>${htmlEscape(fromUser.name || "Um cliente")} transferiu um ingresso para sua conta.</p>
      ${ticketCard(ticket, input)}
      <p>O QR Code válido já está disponível em Meus ingressos. O código anterior foi invalidado por segurança.</p>
    `, { kicker: "Transferência", logoUrl: input.logoUrl }),
    text: `Você recebeu um ingresso para ${movieTitle}. Acesse sua conta do Cine Cruzeiro.`,
    attachments: input.attachments || []
  }, "ticket.transferred.received", { ticketId: ticket.id, fromUserId: fromUser.id, toUserId: toUser.id }) : false;

  const fromSent = fromUser.email ? await sendTransactional(db, {
    to: fromUser.email,
    subject: `Transferência concluída: ${movieTitle}`,
    html: baseLayout("Transferência concluída", `
      <p>O ingresso foi transferido para ${htmlEscape(toUser.email || "o destinatário")}.</p>
      <p>Por segurança, o QR Code anterior foi invalidado e não libera mais a entrada.</p>
      <p>${button("Ver meus ingressos", input.accountUrl)}</p>
    `, { kicker: "Transferência", logoUrl: input.logoUrl }),
    text: "Transferência concluída. O QR Code anterior foi invalidado."
  }, "ticket.transferred.sent", { ticketId: ticket.id, fromUserId: fromUser.id, toUserId: toUser.id }) : false;

  return Boolean(toSent || fromSent);
}

function promotionMessage(input = {}, recipient = {}) {
  const personalizedHtml = interpolateCampaign(input.html || "", recipient, input.variables);
  const personalizedMessage = interpolateCampaign(input.message || "", recipient, input.variables);
  const hasCanonicalHtml = Boolean(String(input.html || "").trim());
  const hasLegacyBlocks = input.mode === "legacy_visual" && Array.isArray(input.contentBlocks) && input.contentBlocks.length > 0;
  const rawCampaignBody = hasCanonicalHtml
    ? sanitizeCampaignHtml(personalizedHtml)
    : hasLegacyBlocks
      ? renderCampaignContentBlocks(input.contentBlocks, input, recipient)
      : `
        <p>Olá${recipient.name ? `, ${htmlEscape(recipient.name)}` : ""}.</p>
        <p>${htmlEscape(personalizedMessage).replace(/\n/g, "<br>")}</p>
        ${input.ctaUrl ? `<p>${button(input.ctaLabel || "Ver promoção", input.ctaUrl, false, { background: input.buttonColor })}</p>` : ""}
      `;
  const campaignBody = repairCampaignBrandLogoHtml(rawCampaignBody, input.siteUrl);
  const unsubscribeUrl = recipient.unsubscribeUrl || "";
  return {
    to: recipient.email,
    subject: interpolateCampaign(input.subject, recipient, input.variables),
    html: baseLayout(interpolateCampaign(input.headline || input.subject, recipient, input.variables), campaignBody, {
      kicker: "Promoção",
      preheader: interpolateCampaign(input.preheader, recipient, input.variables),
      unsubscribeUrl,
      kind: "marketing",
      logoUrl: input.logoUrl,
      brand: input.brand,
      siteUrl: input.siteUrl,
      heroImageHtml: hasCanonicalHtml || hasLegacyBlocks ? "" : campaignImageBlock(input, recipient),
      headlineColor: input.headlineColor,
      textColor: input.textColor,
      hideBrand: hasCanonicalHtml || hasLegacyBlocks,
      hideTitle: hasCanonicalHtml || hasLegacyBlocks,
      hideFooterText: hasCanonicalHtml || hasLegacyBlocks
    }),
    text: hasCanonicalHtml
      ? String(personalizedHtml).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : hasLegacyBlocks
        ? campaignBlocksText(input.contentBlocks, recipient, input.variables)
        : interpolateCampaign(`${input.message || ""}${input.ctaUrl ? `\n${input.ctaUrl}` : ""}`, recipient, input.variables),
    attachments: input.attachments || [],
    headers: unsubscribeUrl ? {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    } : {}
  };
}

async function sendMarketingDelivery(db, input = {}, recipient = {}, correlation = {}) {
  const message = promotionMessage(input, recipient);
  const config = emailConfig(db);
  const domain = String(config.fromEmail || "cinecruzeiro.local").split("@").pop().replace(/[^a-z0-9.-]/gi, "") || "cinecruzeiro.local";
  message.messageId = `<${correlation.deliveryId || correlation.attemptId}@${domain}>`;
  message.headers = {
    ...message.headers,
    "X-Cine-Campaign-Id": correlation.campaignId || "",
    "X-Cine-Delivery-Id": correlation.deliveryId || "",
    "X-Cine-Attempt-Id": correlation.attemptId || ""
  };
  const smtpResult = await sendSmtpDetailed(db, message);
  if (smtpResult.status === "sent" || smtpResult.status === "unknown" || !smtpResult.safeToFallback) return smtpResult;
  if (!webhookConfigured(config)) return smtpResult.status === "unavailable"
    ? { ...smtpResult, status: "failed", errorCode: "EMAIL_CHANNEL_NOT_CONFIGURED", errorMessage: "Nenhum canal de e-mail está configurado." }
    : smtpResult;
  const webhookResult = await sendWebhookDetailed(db, message, "email.campaign.delivery", {
    campaignSubject: input.subject,
    previousProvider: "smtp",
    previousOutcome: smtpResult.status
  }, { ...correlation, emailType: "marketing" });
  return { ...webhookResult, metadata: { ...(webhookResult.metadata || {}), smtpFallbackReason: smtpResult.errorCode || smtpResult.status } };
}

async function sendPromotionCampaign(db, input = {}) {
  const recipients = input.recipients || [];
  if (!recipients.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    const result = await sendMarketingDelivery(db, input, recipient, {
      campaignId: input.id || "test",
      deliveryId: recipient.deliveryId || crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
      templateId: input.templateId || "announcement",
      recipientKey: recipient.id ? `user:${recipient.id}` : "test"
    });
    sent += result.status === "sent" ? 1 : 0;
    failed += result.status === "sent" ? 0 : 1;
    input.onProgress?.({ index: index + 1, total: recipients.length, sent, failed });
  }
  return { sent, failed };
}

async function sendPromotionTest(db, input = {}) {
  return sendPromotionCampaign(db, {
    ...input,
    recipients: [{
      email: input.to,
      name: input.name || "administrador",
      unsubscribeUrl: "",
      couponCode: input.couponCode || "",
      couponExpiresAt: input.couponExpiresAt || "",
      couponUrl: input.couponUrl || ""
    }]
  });
}

async function sendIntegrationTest(db, to) {
  if (!to) return { ok: false, message: "Informe um e-mail remetente ou usuário admin para receber o teste." };
  const ok = await sendTransactional(db, {
    to,
    subject: "Teste de e-mail do Cine Cruzeiro",
    html: baseLayout("E-mail transacional funcionando", `
      <p>Este é um envio de teste do painel Cine Cruzeiro.</p>
      <p>Se esta mensagem chegou, SMTP/webhook estão aptos para recuperação de senha, verificação de e-mail, transferência de ingresso e confirmação de pagamento.</p>
    `, { kicker: "Integrações" }),
    text: "Teste de e-mail do Cine Cruzeiro recebido com sucesso."
  }, "email.integration.tested", { to });
  return ok
    ? { ok: true, message: `E-mail de teste enviado para ${to}.` }
    : { ok: false, message: "Não foi possível enviar o e-mail de teste. Confira SMTP/webhook, remetente e logs do backend." };
}

module.exports = {
  verifySmtp,
  sendIntegrationTest,
  sendPasswordReset,
  sendEmailVerification,
  sendPrivateEventInquiry,
  sendTicketTransfer,
  sendTicketDelivery,
  sendMarketingDelivery,
  sendPromotionCampaign,
  sendPromotionTest,
  _test: {
    baseLayout,
    ticketCard,
    absoluteUrl,
    sanitizeCampaignHtml,
    interpolateCampaign,
    safeLink,
    campaignImageBlock,
    repairCampaignBrandLogoHtml,
    renderCampaignContentBlocks,
    campaignBlocksText,
    prepareAttachments,
    safeAttachmentPath,
    webhookAttachments,
    promotionMessage,
    smtpFailure
  }
};
