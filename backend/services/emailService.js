const nodemailer = require("nodemailer");
const integrationConfigService = require("./integrationConfigService");

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
  return `<a href="${htmlEscape(url)}" style="display:inline-block;background:${secondary ? "#172554" : "#facc15"};color:${secondary ? "#eff6ff" : "#020617"};padding:13px 16px;border-radius:8px;text-decoration:none;font-weight:900;margin:6px 8px 6px 0">${htmlEscape(label)}</a>`;
}

function absoluteUrl(value, siteUrl = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(siteUrl || "").replace(/\/+$/, "");
  return base ? `${base}${raw.startsWith("/") ? raw : `/${raw}`}` : raw;
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
    <div style="margin:0;background:#060a12;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#f8fafc">
      <div style="max-width:680px;margin:0 auto">
        <div style="padding:8px 0 18px">
          ${logo}
          <span style="display:block;margin-top:6px;color:#93c5fd;font-size:13px">Cinema de rua, ingresso digital e atendimento de bairro.</span>
        </div>
        <div style="background:#0d1728;padding:28px;border-radius:12px;box-shadow:0 22px 70px rgba(0,0,0,.34)">
          ${options.kicker ? `<p style="margin:0 0 10px;color:#60a5fa;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase">${htmlEscape(options.kicker)}</p>` : ""}
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.12;color:#fff">${htmlEscape(title)}</h1>
          <div style="font-size:15px;line-height:1.65;color:#dbeafe">${body}</div>
        </div>
        <p style="margin:18px 0 0;color:#93a4bd;font-size:12px;line-height:1.6">Mensagem automática do Cine Cruzeiro. Se você não reconhece esta ação, entre em contato com o cinema.${unsubscribeFooter}</p>
      </div>
    </div>`;
}

function extrasSummary(items = []) {
  if (!items.length) return "Sem extras comprados neste pedido.";
  return items.map((item) => `${htmlEscape(item.name || "Extra")} x${Number(item.quantity || 0)}`).join(" · ");
}

function ticketCard(ticket = {}, options = {}) {
  const posterUrl = absoluteUrl(ticket.posterUrl, options.siteUrl);
  const poster = posterUrl
    ? `<td style="width:116px;padding-right:16px;vertical-align:top"><img src="${htmlEscape(posterUrl)}" width="108" alt="${htmlEscape(ticket.movieTitle || "Filme")}" style="display:block;width:108px;max-width:108px;border-radius:8px;border:0"></td>`
    : "";
  const wallet = ticket.googleWalletUrl ? button("Adicionar ao Google Wallet", ticket.googleWalletUrl, true) : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#09111f;border-radius:10px">
      <tr>
        ${poster}
        <td style="padding:16px;vertical-align:top">
          <p style="margin:0 0 6px;color:#60a5fa;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Ingresso digital</p>
          <h2 style="margin:0 0 10px;color:#fff;font-size:22px;line-height:1.16">${htmlEscape(ticket.movieTitle || "Cine Cruzeiro")}</h2>
          <p style="margin:0 0 12px;color:#facc15;font-size:16px;font-weight:900">${htmlEscape(ticket.sessionDate || "")} às ${htmlEscape(ticket.sessionTime || "")}</p>
          <p style="margin:0;color:#cbd5e1">${htmlEscape(ticket.sessionRoom || "Sala Cruzeiro")}<br>${htmlEscape(ticket.sessionFormat || "Sessão")}<br>Assento: ${htmlEscape(ticket.seat || "Livre")}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
            <tr>
              <td style="padding:8px 10px;background:#111827;border-radius:8px;color:#bfdbfe;font-size:12px">Tipo<br><strong style="color:#fff;font-size:14px">${htmlEscape(ticket.ticketType || "Ingresso")}</strong></td>
              <td style="width:10px"></td>
              <td style="padding:8px 10px;background:#111827;border-radius:8px;color:#bfdbfe;font-size:12px">Código<br><strong style="color:#fff;font-size:14px">${htmlEscape(ticket.code || "-")}</strong></td>
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
      <p>Para manter sua conta protegida, confirme este endereço de e-mail.</p>
      <p>${button("Confirmar e-mail", verificationUrl)}</p>
      <p>O link expira em 1 hora.</p>
    `, { kicker: "Verificação", logoUrl: options.logoUrl }),
    text: `Confirme seu e-mail: ${verificationUrl}`
  }, "email_verification.requested", { email, verificationUrl });
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

async function sendPromotionCampaign(db, input = {}) {
  const recipients = input.recipients || [];
  if (!recipients.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      const ok = await sendTransactional(db, {
        to: recipient.email,
        subject: input.subject,
        html: baseLayout(input.subject, `
          <p>Olá${recipient.name ? `, ${htmlEscape(recipient.name)}` : ""}.</p>
          <p>${htmlEscape(input.message).replace(/\n/g, "<br>")}</p>
          ${input.ctaUrl ? `<p>${button(input.ctaLabel || "Ver promoção", input.ctaUrl)}</p>` : ""}
        `, { kicker: "Promoção", unsubscribeUrl: recipient.unsubscribeUrl, kind: "marketing", logoUrl: input.logoUrl }),
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
  sendTicketTransfer,
  sendTicketDelivery,
  sendPromotionCampaign,
  _test: {
    baseLayout,
    ticketCard
  }
};
