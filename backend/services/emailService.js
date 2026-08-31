const nodemailer = require("nodemailer");
const integrationConfigService = require("./integrationConfigService");
const { brazilianDate } = require("../utils/dateFormat");

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

async function sendSmtp(db, message) {
  const config = emailConfig(db);
  if (!smtpConfigured(config)) return false;
  const fromName = config.fromName || "Cine Cruzeiro";
  const mailer = transporter(config);
  await mailer.sendMail({
    from: `"${fromName.replace(/"/g, "")}" <${config.fromEmail}>`,
    replyTo: config.replyTo || config.fromEmail,
    ...message
  });
  return true;
}

function webhookAttachments(message = {}) {
  return (message.attachments || []).map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType || "application/octet-stream",
    contentBase64: Buffer.isBuffer(attachment.content)
      ? attachment.content.toString("base64")
      : Buffer.from(String(attachment.content || ""), "utf8").toString("base64")
  }));
}

async function sendWebhook(db, message, event = "email.transactional", data = {}) {
  const config = emailConfig(db);
  if (!webhookConfigured(config)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(config.timeout || 10000));
  try {
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Origin-Client": "CineCruzeiro-Backend",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...(config.webhookSecret ? { "X-Cine-Cruzeiro-Email-Secret": config.webhookSecret } : {})
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        source: "cine-cruzeiro",
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: webhookAttachments(message),
        data
      })
    }).catch(() => null);
    return Boolean(response?.ok);
  } finally {
    clearTimeout(timer);
  }
}

async function sendTransactional(db, message, event, data = {}) {
  const sentBySmtp = await sendSmtp(db, message).catch((error) => {
    console.warn("[email] SMTP delivery failed", { event, to: message.to, message: error.message });
    return false;
  });
  if (sentBySmtp) return true;
  return sendWebhook(db, message, event, data).catch((error) => {
    console.warn("[email] webhook delivery failed", { event, to: message.to, message: error.message });
    return false;
  });
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

function button(label, url, secondary = false) {
  if (!url) return "";
  return `<a href="${htmlEscape(url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:${secondary ? "#172554" : "#facc15"};color:${secondary ? "#eff6ff" : "#020617"};padding:13px 16px;border-radius:8px;text-decoration:none;font-weight:900;line-height:1.2;margin:6px 8px 6px 0;word-break:break-word">${htmlEscape(label)}</a>`;
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

function baseLayout(title, body, options = {}) {
  const isMarketing = options.kind === "marketing";
  const unsubscribeFooter = isMarketing && options.unsubscribeUrl
    ? `<br><a href="${htmlEscape(options.unsubscribeUrl)}" style="color:#facc15;text-decoration:underline;text-underline-offset:3px">Não desejo receber mais emails</a>`
    : "";
  const logo = options.logoUrl
    ? `<img src="${htmlEscape(options.logoUrl)}" width="126" alt="Cine Cruzeiro" style="display:block;width:126px;max-width:40%;height:auto;border:0;margin:0 0 14px">`
    : `<strong style="display:block;color:#facc15;font-size:12px;letter-spacing:.18em;text-transform:uppercase">Cine Cruzeiro</strong>`;
  return `
    ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${htmlEscape(options.preheader)}</div>` : ""}
    <div style="margin:0;background:#060a12;padding:18px;font-family:'Segoe UI',Helvetica,sans-serif;color:#f8fafc;box-sizing:border-box;width:100%">
      <div style="max-width:680px;width:100%;margin:0 auto;box-sizing:border-box">
        <div style="padding:8px 0 18px">
          ${logo}
          <span style="display:block;margin-top:6px;color:#93c5fd;font-size:13px">Cinema de rua, ingresso digital e atendimento de bairro.</span>
        </div>
        <div style="background:#0d1728;padding:22px;border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.34);box-sizing:border-box;overflow-wrap:break-word">
          ${options.kicker ? `<p style="margin:0 0 10px;color:#60a5fa;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase">${htmlEscape(options.kicker)}</p>` : ""}
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;color:#fff;word-break:break-word">${htmlEscape(title)}</h1>
          <div style="font-size:15px;line-height:1.65;color:#dbeafe;overflow-wrap:break-word">${body}</div>
        </div>
        <p style="margin:18px 0 0;color:#93a4bd;font-size:12px;line-height:1.6">Mensagem automática do Cine Cruzeiro. Se você não reconhece esta ação, entre em contato com o cinema.${unsubscribeFooter}</p>
      </div>
    </div>`;
}

function sanitizeCampaignHtml(value) {
  return String(value || "")
    .replace(/<(script|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|iframe|object|embed|form)[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
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

async function sendFiscalDocument(db, document = {}, order = {}, options = {}) {
  const email = String(document.customerEmail || order.customerEmail || "").trim().toLowerCase();
  if (!email || document.status !== "authorized") return false;
  const links = [
    button("Baixar nota fiscal em PDF", options.pdfUrl || document.pdfUrl),
    button("Baixar XML", options.xmlUrl || document.xmlUrl, true),
    button("Consultar na prefeitura", document.municipalUrl, true)
  ].filter(Boolean).join("");
  return sendTransactional(db, {
    to: email,
    subject: `Nota fiscal do pedido ${order.reference || order.id || document.reference}`,
    html: baseLayout("Sua nota fiscal está disponível", `
      <p>Olá, <strong>${htmlEscape(document.customerName || order.customerName || "cliente")}</strong>.</p>
      <p>A NFS-e vinculada ao seu pedido foi autorizada e segue anexada a este e-mail.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#09111f;border-radius:10px">
        <tr><td style="padding:16px;color:#dbeafe;line-height:1.7;overflow-wrap:anywhere">
          <strong style="color:#fff">Pedido:</strong> ${htmlEscape(order.reference || order.id || "-")}<br>
          <strong style="color:#fff">Número da nota:</strong> ${htmlEscape(document.invoiceNumber || "-")}<br>
          <strong style="color:#fff">Código de verificação:</strong> ${htmlEscape(document.verificationCode || "-")}<br>
          <strong style="color:#fff">Valor de serviços:</strong> ${money(document.serviceAmount)}
        </td></tr>
      </table>
      <div style="margin-top:16px">${links}</div>
    `, { kicker: "Nota fiscal autorizada", logoUrl: options.logoUrl }),
    text: `Nota fiscal ${document.invoiceNumber || document.reference} autorizada para o pedido ${order.reference || order.id}.`,
    attachments: options.attachments || []
  }, "fiscal_document.authorized", {
    fiscalDocumentId: document.id,
    orderId: document.orderId,
    invoiceNumber: document.invoiceNumber,
    attachments: (options.attachments || []).map((item) => item.filename)
  });
}

async function sendPromotionCampaign(db, input = {}) {
  const recipients = input.recipients || [];
  if (!recipients.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      const personalizedHtml = String(input.html || "").replace(/\{\{\s*nome\s*\}\}/gi, htmlEscape(recipient.name || "cliente"));
      const campaignBody = input.mode === "html"
        ? sanitizeCampaignHtml(personalizedHtml)
        : `
          <p>Olá${recipient.name ? `, ${htmlEscape(recipient.name)}` : ""}.</p>
          <p>${htmlEscape(input.message).replace(/\n/g, "<br>")}</p>
          ${input.ctaUrl ? `<p>${button(input.ctaLabel || "Ver promoção", input.ctaUrl)}</p>` : ""}
        `;
      const ok = await sendTransactional(db, {
        to: recipient.email,
        subject: input.subject,
        html: baseLayout(input.headline || input.subject, campaignBody, { kicker: "Promoção", preheader: input.preheader, unsubscribeUrl: recipient.unsubscribeUrl, kind: "marketing", logoUrl: input.logoUrl }),
        text: `${input.message}${input.ctaUrl ? `\n${input.ctaUrl}` : ""}`
      }, "email.promotion", { campaignSubject: input.subject });
      sent += ok ? 1 : 0;
      failed += ok ? 0 : 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
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
  sendFiscalDocument,
  sendPromotionCampaign,
  _test: {
    baseLayout,
    ticketCard,
    absoluteUrl
  }
};
