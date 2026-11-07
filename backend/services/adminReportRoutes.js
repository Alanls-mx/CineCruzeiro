"use strict";

function createAdminReportRoutes({
  adminDashboard,
  brazilianDate,
  csvResponse,
  logEvent,
  normalizeTicketDistributorRules,
  parseAdminPeriod,
  postgresEnabled,
  readBody,
  repositoryAudit,
  responseCorsOrigin,
  securityHeaders,
  sendJson,
  settingsRepository,
  ticketDistributorCategoryLabel,
  ticketDistributorDateTime,
  ticketDistributorReport,
  ticketDistributorReportPdf,
  ticketDistributorStatusLabel,
  writeDb,
}) {
  return async function handleAdminReportRoute({ req, res, pathname, method, db }) {
  if (pathname === "/api/admin/reports/dashboard.csv" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const period = parseAdminPeriod(url);
    const dashboard = adminDashboard(db, { period });
    csvResponse(res, `dashboard-cine-cruzeiro-${period.start}-${period.end}.csv`,
      ["Indicador", "Valor", "Período inicial", "Período final"],
      [
        ["Receita aprovada", Number(dashboard.revenuePeriod || 0).toFixed(2), period.start, period.end],
        ["Receita de ingressos", Number(dashboard.ticketRevenue || 0).toFixed(2), period.start, period.end],
        ["Receita de bomboniere", Number(dashboard.concessionRevenue || 0).toFixed(2), period.start, period.end],
        ["Receita do Clube", Number(dashboard.clubRevenue || 0).toFixed(2), period.start, period.end],
        ["Créditos do Clube emitidos", dashboard.club?.creditsIssued || 0, period.start, period.end],
        ["Créditos do Clube utilizados", dashboard.club?.creditsUsed || 0, period.start, period.end],
        ["Créditos do Clube expirados", dashboard.club?.creditsExpired || 0, period.start, period.end],
        ["Ingressos resgatados pelo Clube", dashboard.club?.clubTickets || 0, period.start, period.end],
        ["Complementos pagos", Number(dashboard.club?.topUps || 0).toFixed(2), period.start, period.end],
        ["Cortesias", dashboard.club?.courtesies || 0, period.start, period.end],
        ["Descontos do Clube na bomboniere", Number(dashboard.club?.goodsDiscount || 0).toFixed(2), period.start, period.end],
        ["NFC-e autorizadas", dashboard.club?.goodsFiscal?.authorized || 0, period.start, period.end],
        ["NFC-e pendentes ou com erro", Number(dashboard.club?.goodsFiscal?.pending || 0) + Number(dashboard.club?.goodsFiscal?.waiting_trigger || 0) + Number(dashboard.club?.goodsFiscal?.error || 0), period.start, period.end],
        ["Pagamentos aprovados", dashboard.approvedPayments || 0, period.start, period.end],
        ["Valor em pagamentos pendentes", Number(dashboard.pendingPaymentsAmount || 0).toFixed(2), period.start, period.end],
        ["Pagamentos recusados ou cancelados", dashboard.rejectedPayments || 0, period.start, period.end],
        ["Pedidos pagos", dashboard.salesPeriod || 0, period.start, period.end],
        ["Ingressos vendidos", dashboard.ticketsSold || 0, period.start, period.end],
        ["Sessões ativas consideradas", dashboard.capacity?.sessions || 0, period.start, period.end],
        ["Sessões em andamento", dashboard.capacity?.inProgress || 0, period.start, period.end]
      ]
    );
    return true;
  }

  if (["/api/admin/reports/ticket-distributor.csv", "/api/admin/reports/ticket-distributor.pdf"].includes(pathname) && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const period = parseAdminPeriod(url);
    const report = ticketDistributorReport(db, {
      period,
      movieId: String(url.searchParams.get("movieId") || "").trim(),
      includeDetails: true
    });
    const extension = pathname.endsWith(".pdf") ? "pdf" : "csv";
    const filename = `repasse-bilheteria-${period.start}-a-${period.end}.${extension}`;
    logEvent("info", "ticket_distributor_report.exported", {
      format: extension,
      periodStart: period.start,
      periodEnd: period.end,
      movieId: report.movieId || "",
      tickets: report.totals?.quantity || 0,
      distributorCost: report.totals?.distributorCost || 0
    });

    if (extension === "pdf") {
      const pdf = ticketDistributorReportPdf(report, db.settings?.cinemaName || "Cine Cruzeiro");
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store"
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin"
      });
      res.end(pdf);
      return true;
    }

    const details = [...(report.details || [])].sort((a, b) => String(a.sessionDate || "").localeCompare(String(b.sessionDate || ""))
      || String(a.sessionTime || "").localeCompare(String(b.sessionTime || ""))
      || String(a.movieTitle || "").localeCompare(String(b.movieTitle || ""), "pt-BR")
      || String(a.ticketCode || "").localeCompare(String(b.ticketCode || "")));
    const rows = details.map((item) => [
      item.movieTitle,
      brazilianDate(item.sessionDate),
      item.sessionTime,
      item.room,
      item.format,
      item.orderReference,
      item.ticketCode,
      item.seat,
      item.type,
      ticketDistributorCategoryLabel(item.category),
      ticketDistributorStatusLabel(item.ticketStatus),
      ticketDistributorDateTime(item.recognizedAt),
      Number(item.standardFullPrice || 0).toFixed(2).replace(".", ","),
      Number(item.paidAmount || 0).toFixed(2).replace(".", ","),
      item.ruleLabel,
      Number(item.appliedPercent || 0).toFixed(2).replace(".", ","),
      Number(item.appliedFixedFee || 0).toFixed(2).replace(".", ","),
      Number(item.distributorCost || 0).toFixed(2).replace(".", ","),
      Number(item.cinemaNet || 0).toFixed(2).replace(".", ","),
      brazilianDate(report.period?.start),
      brazilianDate(report.period?.end),
      ticketDistributorDateTime(report.generatedAt)
    ]);
    rows.push([
      "TOTAL DO PERÍODO", "", "", "", "", "", "", "", "", "", "", "",
      "", Number(report.totals?.grossRevenue || 0).toFixed(2).replace(".", ","), "", "", "",
      Number(report.totals?.distributorCost || 0).toFixed(2).replace(".", ","),
      Number(report.totals?.cinemaNet || 0).toFixed(2).replace(".", ","),
      brazilianDate(report.period?.start), brazilianDate(report.period?.end), ticketDistributorDateTime(report.generatedAt)
    ]);
    csvResponse(res, filename, [
      "Filme", "Data da sessão", "Horário", "Sala", "Formato", "Pedido", "Código do ingresso", "Assento",
      "Tipo de ingresso", "Categoria", "Status", "Pagamento reconhecido em", "Inteira padrão (R$)",
      "Pago pelo cliente (R$)", "Regra de repasse", "Percentual aplicado (%)", "Taxa fixa aplicada (R$)",
      "Repasse à distribuidora (R$)", "Resultado do cinema (R$)", "Início do período", "Fim do período", "Relatório emitido em"
    ], rows);
    return true;
  }

  if (pathname === "/api/admin/reports/ticket-distributor" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const period = parseAdminPeriod(url);
    sendJson(res, 200, ticketDistributorReport(db, {
      period,
      movieId: String(url.searchParams.get("movieId") || "").trim()
    }));
    return true;
  }

  if (pathname === "/api/admin/reports/ticket-distributor/settings" && method === "PUT") {
    const body = await readBody(req);
    const previous = db.settings?.ticketDistributorRules || {};
    for (const key of ["distributorPercent", "courtesyPercent", "clubTicketFee"]) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (body[key] === null || String(body[key]).trim() === "" || !Number.isFinite(value) || value < 0 || (key !== "clubTicketFee" && value > 100)) {
        sendJson(res, 422, { error: "Informe percentuais entre 0 e 100 e uma taxa do Clube maior ou igual a zero." });
        return true;
      }
    }
    const rules = normalizeTicketDistributorRules({ ...previous, ...body });
    db.settings.ticketDistributorRules = rules;
    if (postgresEnabled()) {
      await settingsRepository.patchAppSettings({ ticketDistributorRules: rules }, {
        audit: repositoryAudit(req, "settings", "ticket-distributor-rules", previous, rules)
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, rules);
    return true;
  }
    return false;
  };
}

module.exports = { createAdminReportRoutes };
