const nodemailer = require("nodemailer");
const integrationConfigService = require("./integrationConfigService");

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function button(label, url) {
  return `<a href="${htmlEscape(url)}" style="display:inline-block;background:#facc15;color:#020617;padding:14px 18px;border-radius:8px;text-decoration:none;font-weight:900">${htmlEscape(label)}</a>`;
}

function baseLayout(title, body, options = {}) {
  const unsubscribeFooter = options.unsubscribeUrl
    ? `<br><a href="${htmlEscape(options.unsubscribeUrl)}" style="color:#facc15;text-decoration:underline;text-underline-offset:3px">Não desejo receber mais emails</a>`
    : "";
  return `
    <div style="margin:0;background:#060a12;padding:28px;font-family:Inter,Arial,sans-serif;color:#f8fafc">
      <div style="max-width:640px;margin:0 auto">
        <div style="padding:18px 0 22px">
          <strong style="display:block;color:#facc15;font-size:12px;letter-spacing:.18em;text-transform:uppercase">Cine Cruzeiro</strong>
          <span style="display:block;margin-top:6px;color:#93c5fd;font-size:13px">Cinema de rua, ingresso digital e atendimento de bairro.</span>
        </div>
        <div style="background:#0d1728;padding:30px;border-radius:14px;box-shadow:0 22px 70px rgba(0,0,0,.34)">
          ${options.kicker ? `<p style="margin:0 0 10px;color:#60a5fa;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase">${htmlEscape(options.kicker)}</p>` : ""}
          <h1 style="margin:0 0 16px;font-size:30px;line-height:1.08;color:#fff">${htmlEscape(title)}</h1>
          <div style="font-size:15px;line-height:1.7;color:#cbd5e1">${body}</div>
        </div>
        <p style="margin:18px 0 0;color:#93a4bd;font-size:12px;line-height:1.6">Mensagem automática do Cine Cruzeiro. Se você não reconhece esta ação, entre em contato com o cinema.${unsubscribeFooter}</p>
      </div>
    </div>`;
}

async function sendPasswordReset(db, email, resetUrl, options = {}) {
  return sendTransactional(db, {
    to: email,
    subject: "Redefina sua senha do Cine Cruzeiro",
    html: baseLayout("Redefinição de senha", `
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>${button("Criar nova senha", resetUrl)}</p>
      <p>O link expira em 30 minutos. Se você não pediu isso, ignore este e-mail.</p>
    `, { kicker: "Conta", unsubscribeUrl: options.unsubscribeUrl }),
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
    `, { kicker: "Verificação", unsubscribeUrl: options.unsubscribeUrl }),
    text: `Confirme seu e-mail: ${verificationUrl}`
  }, "email_verification.requested", { email, verificationUrl });
}

async function sendTicketDelivery(db, order, tickets = [], options = {}) {
  if (!order?.customerEmail || !tickets.length) return false;
  const ticketLines = tickets.map((ticket) => `<li><strong>${htmlEscape(ticket.code)}</strong> - ${htmlEscape(ticket.ticketType || "Ingresso")}</li>`).join("");
  return sendTransactional(db, {
    to: order.customerEmail,
    subject: `Pagamento aprovado: ${order.movieTitle || "Cine Cruzeiro"}`,
    html: baseLayout("Ingressos confirmados", `
      <p>Pagamento aprovado. Seus ingressos digitais já estão liberados na sua conta.</p>
      <p><strong>${htmlEscape(order.movieTitle || "")}</strong><br>${htmlEscape(order.sessionDate || "")} às ${htmlEscape(order.sessionTime || "")} - ${htmlEscape(order.sessionFormat || "")}</p>
      <ul>${ticketLines}</ul>
      <p>Acesse sua conta para visualizar QR Code, baixar ingresso ou adicionar à carteira.</p>
    `, { kicker: "Pagamento aprovado", unsubscribeUrl: options.unsubscribeUrl }),
    text: `Ingressos confirmados: ${tickets.map((ticket) => ticket.code).join(", ")}`
  }, "payment.approved", { orderId: order.id, ticketCodes: tickets.map((ticket) => ticket.code) });
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
      <p><strong>${htmlEscape(movieTitle)}</strong><br>${htmlEscape(ticket.sessionDate || "")} às ${htmlEscape(ticket.sessionTime || "")}</p>
      <p>O QR Code válido já está disponível em Meus ingressos.</p>
    `, { kicker: "Transferência", unsubscribeUrl: input.toUnsubscribeUrl }),
    text: `Você recebeu um ingresso para ${movieTitle}. Acesse sua conta do Cine Cruzeiro.`
  }, "ticket.transferred.received", { ticketId: ticket.id, fromUserId: fromUser.id, toUserId: toUser.id }) : false;

  const fromSent = fromUser.email ? await sendTransactional(db, {
    to: fromUser.email,
    subject: `Transferência concluída: ${movieTitle}`,
    html: baseLayout("Transferência concluída", `
      <p>O ingresso foi transferido para ${htmlEscape(toUser.email || "o destinatário")}.</p>
      <p>Por segurança, o QR Code anterior foi invalidado e não libera mais a entrada.</p>
    `, { kicker: "Transferência", unsubscribeUrl: input.fromUnsubscribeUrl }),
    text: `Transferência concluída. O QR Code anterior foi invalidado.`
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
        `, { kicker: "Promoção", unsubscribeUrl: recipient.unsubscribeUrl }),
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
  sendPromotionCampaign
};
