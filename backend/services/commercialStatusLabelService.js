function paymentStatusLabel(status = "") {
  return {
    approved: "Pago",
    paid: "Pago",
    pending: "Aguardando pagamento",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    rejected: "Pagamento recusado",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function orderStatusLabel(status = "") {
  return {
    paid: "Pago",
    paid_pending_print: "Pago; aguardando impressão",
    pending: "Pendente",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    draft: "Rascunho",
    test: "Teste"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function originLabel(origin = "") {
  return {
    online: "Site",
    box_office: "Bilheteria",
    club: "Clube",
    manual: "Bilheteria"
  }[String(origin || "").toLowerCase()] || origin || "Site";
}

function methodLabel(method = "") {
  return {
    pix: "Pix",
    external_pix: "Pix",
    point_qr: "Pix na Point",
    PIX: "Pix",
    credit_card: "Cartão",
    CREDIT_CARD: "Cartão",
    cash: "Dinheiro",
    card_terminal: "Débito/crédito na Point",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
    courtesy: "Cortesia",
    club_credit: "Crédito do Clube",
    CLUB_CREDIT: "Crédito do Clube"
  }[String(method || "")] || method || "Nao informado";
}

function providerLabel(provider = "") {
  return {
    open_finance: "Pix legado",
    mercado_pago: "Mercado Pago",
    pag_bank: "PagBank",
    box_office: "Bilheteria",
    admin: "Administração",
    internal_club: "Clube",
    external_manual: "Registro manual",
    manual_external: "Maquininha externa"
  }[String(provider || "").toLowerCase()] || provider || "Manual";
}

function campaignStatusLabel(status = "") {
  return {
    draft: "Rascunho",
    scheduled: "Agendada",
    queued: "Na fila",
    sending: "Enviando",
    sent: "Concluída",
    completed: "Concluída",
    completed_with_errors: "Concluída com falhas",
    cancelled: "Cancelada",
    failed: "Falhou"
  }[String(status || "")] || "Rascunho";
}

module.exports = { paymentStatusLabel, orderStatusLabel, originLabel, methodLabel, providerLabel, campaignStatusLabel };
