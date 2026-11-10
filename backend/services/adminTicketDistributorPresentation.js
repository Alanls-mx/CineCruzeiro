"use strict";

function createAdminTicketDistributorPresentation({
  brazilianDate,
  brl,
  buildPdf,
  calculateTicketDistributorReport,
  inDateRange,
  isOrderFinanciallySettled,
  movieForOrder,
  normalizeTicketDistributorRules,
  orderFinancialBreakdown,
  orderPayment,
  orderTickets,
  pdfLine,
  pdfRect,
  pdfWriteText,
  recognitionDate,
  sessionForOrder,
  shortOrderReference,
  todayIsoDate,
}) {
function ticketDistributorReport(db, options = {}) {
  const today = todayIsoDate();
  const period = options.period || { start: today, end: today };
  const rules = normalizeTicketDistributorRules(db.settings?.ticketDistributorRules);
  const entries = [];
  const eligibleOrders = (db.orders || []).filter((order) => {
    const payment = orderPayment(db, order.id);
    const recognized = isOrderFinanciallySettled(order, payment) || String(order.paymentMethod || "") === "courtesy";
    return recognized
      && inDateRange(recognitionDate(order, payment) || order.paidAt || order.createdAt, period.start, period.end)
      && (!options.movieId || String(order.movieId || "") === String(options.movieId));
  });

  for (const order of eligibleOrders) {
    const tickets = orderTickets(db, order.id).filter((ticket) => !["cancelled", "refunded", "expired"].includes(String(ticket.status || "")));
    if (!tickets.length) continue;
    const breakdown = orderFinancialBreakdown(db, order);
    const session = sessionForOrder(db, order);
    const movie = movieForOrder(db, order);
    const room = (db.rooms || []).find((item) => String(item.id || "") === String(session?.roomId || order.roomId || ""));
    const recognizedAt = recognitionDate(order, orderPayment(db, order.id)) || order.paidAt || order.createdAt || "";
    const standardFullPrice = Math.max(0, Number(session?.priceFull ?? db.settings?.defaultTicketPrice ?? 0));
    const serviceByTicketId = new Map((db.orderServiceItems || [])
      .filter((item) => item.orderId === order.id && item.ticketId)
      .map((item) => [String(item.ticketId), item]));
    const paidTickets = tickets.filter((ticket) => !["subscription_credit", "club_credit", "courtesy"].includes(String(ticket.paymentSource || ticket.source || "standard")));
    const weights = paidTickets.map((ticket) => {
      const serviceItem = serviceByTicketId.get(String(ticket.id));
      return Math.max(0, Number(serviceItem?.basePrice ?? serviceItem?.unitPrice ?? ticket.basePrice ?? standardFullPrice));
    });
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let allocatedCents = 0;
    const revenueCents = Math.max(0, Math.round(Number(breakdown.ticketRevenue || 0) * 100));
    const paidIndex = new Map(paidTickets.map((ticket, index) => [ticket.id, index]));

    tickets.forEach((ticket) => {
      const source = String(ticket.paymentSource || ticket.source || "standard");
      const category = ["subscription_credit", "club_credit"].includes(source) ? "club" : source === "courtesy" ? "courtesy" : "paid";
      let paidAmount = 0;
      if (category === "paid") {
        const index = paidIndex.get(ticket.id);
        const last = index === paidTickets.length - 1;
        const cents = last
          ? Math.max(0, revenueCents - allocatedCents)
          : Math.max(0, Math.round(revenueCents * (weightTotal > 0 ? weights[index] / weightTotal : 1 / Math.max(1, paidTickets.length))));
        allocatedCents += cents;
        paidAmount = cents / 100;
      }
      entries.push({
        type: ticket.ticketType || (category === "club" ? "Clube de assinatura" : category === "courtesy" ? "Indicação / Cortesia" : "Ingresso"),
        category,
        paidAmount,
        standardFullPrice,
        movieId: ticket.sessionChangedAt ? ticket.movieId : order.movieId || movie?.id || ticket.movieId || "",
        movieTitle: ticket.sessionChangedAt ? ticket.movieTitle : order.movieTitle || movie?.title || ticket.movieTitle || "Filme não identificado",
        sessionId: ticket.sessionChangedAt ? ticket.sessionId : order.sessionId || session?.id || ticket.sessionId || "",
        sessionDate: ticket.sessionChangedAt ? ticket.sessionDate : order.sessionDate || session?.date || ticket.sessionDate || "",
        sessionTime: ticket.sessionChangedAt ? ticket.sessionTime : order.sessionTime || session?.time || ticket.sessionTime || "",
        room: ticket.sessionChangedAt ? ticket.sessionRoom : order.sessionRoom || session?.roomName || room?.name || room?.title || ticket.sessionRoom || "Sala não identificada",
        format: ticket.sessionChangedAt ? ticket.sessionFormat : order.sessionFormat || session?.format || ticket.sessionFormat || "",
        seat: ticket.seat || ticket.seatLabel || "Lugar livre",
        ticketCode: ticket.code || ticket.id || "",
        ticketStatus: ticket.status || "active",
        orderReference: shortOrderReference(order),
        recognizedAt
      });
    });
  }

  return {
    period: { start: period.start, end: period.end },
    movieId: options.movieId || "",
    generatedAt: new Date().toISOString(),
    movies: (db.movies || []).map((movie) => ({ id: movie.id, title: movie.title })).sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    ...calculateTicketDistributorReport(entries, rules, { includeDetails: Boolean(options.includeDetails) })
  };
}

function ticketDistributorCategoryLabel(category) {
  return {
    paid: "Ingresso pago",
    club: "Clube de assinatura",
    courtesy: "Indicação / Cortesia"
  }[String(category || "")] || "Ingresso pago";
}

function ticketDistributorStatusLabel(status) {
  return {
    active: "Válido",
    used: "Utilizado",
    archived: "Arquivado"
  }[String(status || "")] || String(status || "Não informado");
}

function ticketDistributorDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function ticketDistributorSessionSummary(details = []) {
  const grouped = new Map();
  for (const detail of details) {
    const key = [detail.movieId, detail.sessionId, detail.sessionDate, detail.sessionTime, detail.room].join(":");
    const current = grouped.get(key) || {
      movieTitle: detail.movieTitle,
      sessionDate: detail.sessionDate,
      sessionTime: detail.sessionTime,
      room: detail.room,
      format: detail.format,
      quantity: 0,
      grossRevenue: 0,
      distributorCost: 0,
      cinemaNet: 0
    };
    current.quantity += 1;
    current.grossRevenue = Number((current.grossRevenue + Number(detail.paidAmount || 0)).toFixed(2));
    current.distributorCost = Number((current.distributorCost + Number(detail.distributorCost || 0)).toFixed(2));
    current.cinemaNet = Number((current.cinemaNet + Number(detail.cinemaNet || 0)).toFixed(2));
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => String(a.sessionDate || "").localeCompare(String(b.sessionDate || ""))
    || String(a.sessionTime || "").localeCompare(String(b.sessionTime || ""))
    || String(a.movieTitle || "").localeCompare(String(b.movieTitle || ""), "pt-BR"));
}

function pdfCellText(value, maxChars) {
  const text = String(value || "-");
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 3))}...` : text;
}

function ticketDistributorReportPdf(report, cinemaName = "Cine Cruzeiro") {
  const width = 842;
  const height = 595;
  const margin = 36;
  const pages = [];
  const header = (title, subtitle) => [
    pdfRect(0, 0, width, height, "#ffffff"),
    pdfRect(0, 525, width, 70, "#07111f"),
    pdfWriteText(title, margin, 558, 19, { bold: true, color: "#ffffff" }),
    pdfWriteText(subtitle, margin, 538, 9, { color: "#cbd5e1" })
  ].join("");
  const tableHeading = (labels, columns, y) => {
    let content = pdfRect(margin, y - 7, width - margin * 2, 23, "#e8eef7");
    labels.forEach((label, index) => {
      content += pdfWriteText(label, columns[index], y, 7, { bold: true, color: "#334155" });
    });
    return content;
  };
  const selectedMovie = report.movieId
    ? (report.movies || []).find((movie) => String(movie.id) === String(report.movieId))?.title || "Filme selecionado"
    : "Todos os filmes";
  const totals = report.totals || {};
  let overview = header("Demonstrativo de repasse da bilheteria", `${cinemaName} | Documento para conferência da distribuidora`);
  overview += pdfWriteText(`Período financeiro: ${brazilianDate(report.period?.start)} a ${brazilianDate(report.period?.end)}`, margin, 500, 10, { bold: true, color: "#0f172a" });
  overview += pdfWriteText(`Filtro: ${selectedMovie} | Emitido em ${ticketDistributorDateTime(report.generatedAt)}`, margin, 483, 8, { color: "#64748b" });

  const metrics = [
    ["INGRESSOS", String(totals.quantity || 0)],
    ["FATURAMENTO BRUTO", brl(totals.grossRevenue)],
    ["REPASSE", brl(totals.distributorCost)],
    ["RETENÇÃO DO CINEMA", `${brl(totals.cinemaNet)} (${Number(totals.retentionPercent || 0).toFixed(2).replace(".", ",")}%)`]
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + index * 196;
    overview += pdfRect(x, 424, 182, 46, index === 2 ? "#fff7d6" : "#f1f5f9");
    overview += pdfWriteText(label, x + 10, 452, 7, { bold: true, color: "#64748b" });
    overview += pdfWriteText(value, x + 10, 434, 12, { bold: true, color: index === 2 ? "#9a6700" : "#0f172a" });
  });

  overview += pdfRect(margin, 369, width - margin * 2, 40, "#07111f");
  overview += pdfWriteText("REGRAS APLICADAS", margin + 12, 393, 7, { bold: true, color: "#93c5fd" });
  overview += pdfWriteText(`Pagos: ${report.rules?.distributorPercent || 0}% do valor pago | Cortesias: ${report.rules?.courtesyPercent || 0}% da inteira padrão | Clube: ${brl(report.rules?.clubTicketFee)} por bilhete`, margin + 12, 378, 9, { color: "#ffffff" });
  overview += pdfWriteText("Consolidado por tipo de ingresso", margin, 343, 12, { bold: true, color: "#0f172a" });
  const typeColumns = [margin + 8, 335, 430, 548, 665];
  overview += tableHeading(["TIPO / CATEGORIA", "QTD", "PAGO PELO CLIENTE", "REPASSE", "RESULTADO DO CINEMA"], typeColumns, 320);
  (report.rows || []).slice(0, 8).forEach((row, index) => {
    const y = 294 - index * 27;
    overview += pdfLine(margin, y - 8, width - margin, y - 8, "#e2e8f0", 0.6);
    overview += pdfWriteText(pdfCellText(`${row.type} | ${ticketDistributorCategoryLabel(row.category)}`, 42), typeColumns[0], y, 8, { bold: true, color: "#0f172a" });
    overview += pdfWriteText(String(row.quantity || 0), typeColumns[1], y, 8, { color: "#334155" });
    overview += pdfWriteText(brl(row.grossRevenue), typeColumns[2], y, 8, { color: "#334155" });
    overview += pdfWriteText(brl(row.distributorCost), typeColumns[3], y, 8, { color: "#334155" });
    overview += pdfWriteText(brl(row.cinemaNet), typeColumns[4], y, 8, { bold: true, color: Number(row.cinemaNet || 0) < 0 ? "#be123c" : "#047857" });
  });
  if (!(report.rows || []).length) overview += pdfWriteText("Nenhum ingresso reconhecido no período selecionado.", margin + 8, 294, 9, { color: "#64748b" });
  overview += pdfWriteText("Este documento considera somente ingressos reconhecidos financeiramente. Bomboniere e dados pessoais de clientes foram excluídos.", margin, 48, 8, { color: "#64748b" });
  pages.push(overview);

  const sessions = ticketDistributorSessionSummary(report.details || []);
  for (let offset = 0; offset < Math.max(1, sessions.length); offset += 14) {
    let page = header("Consolidado por filme e sessão", `Valores que compõem o período de ${brazilianDate(report.period?.start)} a ${brazilianDate(report.period?.end)}`);
    const columns = [margin + 6, 116, 300, 476, 530, 622, 716];
    page += tableHeading(["SESSÃO", "FILME", "SALA / FORMATO", "QTD", "FATURAMENTO", "REPASSE", "RETENÇÃO"], columns, 495);
    const slice = sessions.slice(offset, offset + 14);
    if (!slice.length) page += pdfWriteText("Nenhuma sessão reconhecida no período selecionado.", margin + 8, 456, 10, { color: "#64748b" });
    slice.forEach((row, index) => {
      const y = 464 - index * 30;
      page += pdfLine(margin, y - 10, width - margin, y - 10, "#e2e8f0", 0.6);
      page += pdfWriteText(`${brazilianDate(row.sessionDate)} ${row.sessionTime || ""}`, columns[0], y, 7, { bold: true, color: "#0f172a" });
      page += pdfWriteText(pdfCellText(row.movieTitle, 30), columns[1], y, 7, { bold: true, color: "#0f172a" });
      page += pdfWriteText(pdfCellText(`${row.room}${row.format ? ` | ${row.format}` : ""}`, 30), columns[2], y, 7, { color: "#334155" });
      page += pdfWriteText(String(row.quantity || 0), columns[3], y, 7, { color: "#334155" });
      page += pdfWriteText(brl(row.grossRevenue), columns[4], y, 7, { color: "#334155" });
      page += pdfWriteText(brl(row.distributorCost), columns[5], y, 7, { bold: true, color: "#9a6700" });
      page += pdfWriteText(brl(row.cinemaNet), columns[6], y, 7, { color: Number(row.cinemaNet || 0) < 0 ? "#be123c" : "#047857" });
    });
    pages.push(page);
    if (!sessions.length) break;
  }

  const details = [...(report.details || [])].sort((a, b) => String(a.sessionDate || "").localeCompare(String(b.sessionDate || ""))
    || String(a.sessionTime || "").localeCompare(String(b.sessionTime || ""))
    || String(a.movieTitle || "").localeCompare(String(b.movieTitle || ""), "pt-BR")
    || String(a.ticketCode || "").localeCompare(String(b.ticketCode || "")));
  for (let offset = 0; offset < Math.max(1, details.length); offset += 13) {
    let page = header("Memória de cálculo por ingresso", "Referências operacionais sem identificação pessoal do comprador");
    const columns = [margin + 6, 108, 262, 382, 468, 527, 586, 700];
    page += tableHeading(["SESSÃO", "FILME / SALA", "INGRESSO", "PEDIDO", "PAGO", "INTEIRA", "REGRA", "REPASSE"], columns, 495);
    const slice = details.slice(offset, offset + 13);
    if (!slice.length) page += pdfWriteText("Nenhum ingresso reconhecido no período selecionado.", margin + 8, 456, 10, { color: "#64748b" });
    slice.forEach((row, index) => {
      const y = 461 - index * 34;
      page += pdfLine(margin, y - 12, width - margin, y - 12, "#e2e8f0", 0.6);
      page += pdfWriteText(`${brazilianDate(row.sessionDate)} ${row.sessionTime || ""}`, columns[0], y, 6.7, { bold: true, color: "#0f172a" });
      page += pdfWriteText(pdfCellText(row.movieTitle, 25), columns[1], y, 6.7, { bold: true, color: "#0f172a" });
      page += pdfWriteText(pdfCellText(row.room, 25), columns[1], y - 10, 6, { color: "#64748b" });
      page += pdfWriteText(pdfCellText(`${row.type} | ${row.seat}`, 20), columns[2], y, 6.7, { color: "#334155" });
      page += pdfWriteText(pdfCellText(`${row.ticketCode} | ${ticketDistributorStatusLabel(row.ticketStatus)}`, 24), columns[2], y - 10, 6, { color: "#64748b" });
      page += pdfWriteText(row.orderReference || "-", columns[3], y, 6.7, { color: "#334155" });
      page += pdfWriteText(brl(row.paidAmount), columns[4], y, 6.7, { color: "#334155" });
      page += pdfWriteText(brl(row.standardFullPrice), columns[5], y, 6.7, { color: "#334155" });
      page += pdfWriteText(pdfCellText(row.ruleLabel, 20), columns[6], y, 6.7, { color: "#334155" });
      page += pdfWriteText(brl(row.distributorCost), columns[7], y, 6.7, { bold: true, color: "#9a6700" });
    });
    pages.push(page);
    if (!details.length) break;
  }

  return buildPdf(pages.map((page, index) => `${page}${pdfLine(margin, 28, width - margin, 28, "#cbd5e1", 0.5)}${pdfWriteText(`${cinemaName} | Demonstrativo de repasse`, margin, 13, 7, { color: "#64748b" })}${pdfWriteText(`Página ${index + 1} de ${pages.length}`, width - margin - 62, 13, 7, { color: "#64748b" })}`), { width, height });
}
  return { ticketDistributorReport, ticketDistributorCategoryLabel, ticketDistributorStatusLabel, ticketDistributorDateTime, ticketDistributorSessionSummary, ticketDistributorReportPdf };
}

module.exports = { createAdminTicketDistributorPresentation };
