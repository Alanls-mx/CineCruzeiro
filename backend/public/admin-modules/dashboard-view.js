((root) => {
  function createDashboardView({ state, $, money, escapeHtml, renderMiniPager, adminAssetUrl, orderReference }) {
function renderDashboard() {
  const data = state.dashboard || {};
  const dashboardTime = (value) => value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "--:--";
  if ($("dashRevenueToday")) $("dashRevenueToday").textContent = money(data.revenueToday || 0);
  if ($("dashRevenueMonth")) $("dashRevenueMonth").textContent = money(data.revenuePeriod ?? data.revenueMonth ?? 0);
  if ($("dashSalesToday")) $("dashSalesToday").textContent = Number(data.salesToday || 0);
  if ($("dashSalesMonth")) $("dashSalesMonth").textContent = Number(data.salesPeriod ?? data.salesMonth ?? 0);
  if ($("dashTicketsSold")) $("dashTicketsSold").textContent = Number(data.ticketsSold || 0);
  if ($("dashAverageTicket")) $("dashAverageTicket").textContent = money(data.averageConcessionOrder || 0);
  if ($("dashAverageOccupancy")) $("dashAverageOccupancy").textContent = `${Number(data.capacity?.occupancyRate || 0)}%`;
  if ($("dashCustomers")) $("dashCustomers").textContent = Number(data.customers || 0);
  if ($("dashSubscriptions")) $("dashSubscriptions").textContent = Number(data.activeSubscriptions || 0);
  if ($("dashPendingPayments")) $("dashPendingPayments").textContent = Number(data.pendingPayments || 0);
  if ($("dashPendingPaymentsAmount")) $("dashPendingPaymentsAmount").textContent = `${money(data.pendingPaymentsAmount || 0)} em aberto no período`;
  if ($("dashConcessionRevenue")) $("dashConcessionRevenue").textContent = money(data.concessionRevenue || 0);
  if ($("dashApprovedGrossRevenue")) $("dashApprovedGrossRevenue").textContent = money(data.approvedGrossRevenue || 0);
  if ($("dashRefundsPeriod")) $("dashRefundsPeriod").textContent = money(data.refundsPeriod || 0);
  if ($("dashRevenueCompare")) $("dashRevenueCompare").textContent = comparisonText(data.comparison?.revenue);
  if ($("dashSalesCompare")) $("dashSalesCompare").textContent = comparisonText(data.comparison?.sales);
  if ($("dashTicketsCompare")) $("dashTicketsCompare").textContent = comparisonText(data.comparison?.tickets);
  renderDashboardChart(data.chart || []);
  if ($("dashSalesOrigin")) {
    const entries = Object.entries(data.revenueByOrigin || data.salesByOrigin || {});
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    $("dashSalesOrigin").innerHTML = entries.length
      ? entries.map(([name, value]) => `<div class="metric-row clickable-row" data-admin-panel="ordersPanel"><span>${escapeHtml(name)}<small>${total ? Math.round((Number(value || 0) / total) * 100) : 0}% do período</small></span><strong>${money(value)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Sem vendas</strong><span>As origens aparecerão após os primeiros pedidos.</span></div>`;
  }
  if ($("dashPaymentMethods")) {
    const entries = Object.entries(data.revenueByMethod || data.paymentMethods || {});
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    $("dashPaymentMethods").innerHTML = entries.length
      ? entries.map(([name, value]) => `<div class="metric-row clickable-row" data-admin-command="show-box-office-payments"><span>${escapeHtml(name)}<small>${total ? Math.round((Number(value || 0) / total) * 100) : 0}% do período</small></span><strong>${money(value)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Sem pagamentos</strong><span>As formas usadas aparecerão aqui.</span></div>`;
  }
  if ($("dashPaymentSummary")) {
    const paymentSummary = data.paymentSummary || {};
    const rows = [
      ["approved", "Aprovados líquidos", "payments-approved", "Valor aprovado após devoluções"],
      ["pending", "Em aberto", "payments-pending", "Ainda não entram na receita"],
      ["failed", "Recusados ou cancelados", "payments-failed", "Não geram receita"],
      ["refunded", "Reembolsados", "payments-refunded", "Saíram da receita"],
      ["expired", "Expirados", "payments-expired", "Não podem mais ser pagos"]
    ].filter(([key]) => Number(paymentSummary[key]?.count || 0) > 0 || key === "approved" || key === "pending");
    $("dashPaymentSummary").innerHTML = rows.map(([key, label, className, hint]) => `
      <div class="metric-row payment-summary-row ${className}">
        <span>${label}<small>${hint} • ${Number(paymentSummary[key]?.count || 0)} pagamento(s)</small></span>
        <strong>${money(paymentSummary[key]?.amount || 0)}</strong>
      </div>`).join("");
  }
  if ($("dashRevenueComposition")) {
    const entries = Array.isArray(data.revenueComposition) ? data.revenueComposition : [];
    const total = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    $("dashRevenueComposition").innerHTML = entries.some((item) => Number(item.amount || 0) > 0)
      ? entries.map((item) => {
          const reconciliation = Number(item.grossAmount || 0) > 0 || Number(item.refundAmount || 0) > 0
            ? `${Number(item.grossAmount || 0) > 0 ? ` • bruto ${money(item.grossAmount)}` : ""}${Number(item.discountAmount || 0) > 0 ? ` • descontos ${money(item.discountAmount)}` : ""}${Number(item.refundAmount || 0) > 0 ? ` • reembolsos ${money(item.refundAmount)}` : ""}`
            : "";
          return `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.label || "Receita")}<small>${escapeHtml(item.hint || "")}${reconciliation}${total ? ` • ${Math.round((Number(item.amount || 0) / total) * 100)}% da receita` : ""}</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`;
        }).join("")
      : `<div class="empty-state compact"><strong>Sem receita aprovada</strong><span>Ingressos, bomboniere e assinaturas aparecerão aqui quando forem pagos.</span></div>`;
  }
  if ($("dashMovieRevenue")) {
    const movies = Array.isArray(data.revenueByMovie) ? data.revenueByMovie : [];
    const total = movies.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pageSize = state.dashMoviePageSize || 5;
    const totalPages = Math.max(1, Math.ceil(movies.length / pageSize));
    state.dashMoviePage = Math.min(Math.max(1, state.dashMoviePage || 1), totalPages);
    const start = (state.dashMoviePage - 1) * pageSize;
    const pageMovies = movies.slice(start, start + pageSize);

    $("dashMovieRevenue").innerHTML = movies.length
      ? pageMovies.map((item) => `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.name || "Filme")}<small>${total ? Math.round((Number(item.amount || 0) / total) * 100) : 0}% da receita de ingressos</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`).join("") + renderMiniPager(state.dashMoviePage, totalPages, movies.length, "movies", "filme(s)")
      : `<div class="empty-state compact"><strong>Sem receita por filme</strong><span>As vendas aprovadas por sessão entram nesta lista.</span></div>`;
  }
  if ($("dashUpcomingSessions")) {
    const sessions = data.todaySessions || data.upcomingSessions || [];
    const pageSize = state.dashSessionsPageSize || 4;
    const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
    state.dashSessionsPage = Math.min(Math.max(1, state.dashSessionsPage || 1), totalPages);
    const start = (state.dashSessionsPage - 1) * pageSize;
    const pageSessions = sessions.slice(start, start + pageSize);

    $("dashUpcomingSessions").innerHTML = sessions.length
      ? pageSessions.map((item) => `
          <div class="session-metric-row clickable-row ${item.isInProgress ? "is-in-progress" : ""}" data-admin-session-action="dashboard" data-admin-movie-id="${escapeHtml(item.movie?.id || "")}" data-admin-session-id="${escapeHtml(item.session?.id || "")}">
            <div class="session-poster">${item.movie?.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(item.movie.posterUrl))}" alt="">` : `<span>${escapeHtml(item.movie?.rating || "L")}</span>`}</div>
            <div>
              <strong>${escapeHtml(item.movie?.title || "Filme")} • ${escapeHtml(item.session?.time || "-")}${item.isInProgress ? ` <em class="session-live-badge">EM ANDAMENTO</em>` : ""}</strong>
              <span>${escapeHtml(item.session?.format || "")}</span>
              <div class="mini-progress"><i style="width:${Math.min(100, Number(item.occupancyRate || 0))}%"></i></div>
              <small>${item.isInProgress ? `Termina às ${dashboardTime(item.endsAt)} • faltam ${Number(item.remainingMinutes || 0)} min • ` : ""}${Number(item.sold || 0)} / ${Number(item.capacity || 0)} • ${Number(item.occupancyRate || 0)}% • ${escapeHtml(item.status || "Boa disponibilidade")}</small>
            </div>
          </div>`).join("") + renderMiniPager(state.dashSessionsPage, totalPages, sessions.length, "sessions", "sessão(ões)")
      : `<div class="empty-state compact"><strong>Nenhuma sessão programada para hoje.</strong><span>Cadastre um horário quando a programação estiver definida.</span><button class="ghost-button" type="button" data-admin-command="create-session-from-dashboard">Criar sessão</button></div>`;
  }
  if ($("dashCapacity")) {
    const capacity = data.capacity || {};
    $("dashCapacity").innerHTML = `
      <div class="metric-row"><span>Sessões consideradas</span><strong>${Number(capacity.sessions || 0)}</strong></div>
      <div class="metric-row"><span>Lugares ocupados</span><strong>${Number(capacity.occupied || 0)}</strong></div>
      <div class="metric-row"><span>Lugares nas sessões ativas</span><strong>${Number(capacity.roomCapacity || 0)}</strong></div>
      <div class="metric-row"><span>Ocupação estimada</span><strong>${Number(capacity.occupancyRate || 0)}%</strong></div>
    `;
  }
  if ($("dashTopProducts")) {
    const products = data.topProducts || [];
    const pageSize = state.dashTopProductsPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    state.dashTopProductsPage = Math.min(Math.max(1, state.dashTopProductsPage || 1), totalPages);
    const start = (state.dashTopProductsPage - 1) * pageSize;
    const pageProducts = products.slice(start, start + pageSize);

    $("dashTopProducts").innerHTML = products.length
      ? pageProducts.map((item) => `<div class="metric-row clickable-row" data-admin-panel="concessionsPanel"><span>${escapeHtml(item.name)}<small>${Number(item.quantity || 0)} item(ns) • bruto ${money(item.grossRevenue || 0)}${Number(item.discountTotal ?? (Number(item.grossRevenue || 0) - Number(item.netRevenue || 0))) > 0 ? ` • descontos ${money(item.discountTotal ?? (Number(item.grossRevenue || 0) - Number(item.netRevenue || 0)))}` : ""}${Number(item.refundTotal || 0) > 0 ? ` • reembolsos ${money(item.refundTotal)}` : ""} • líquido ${money(item.netRevenue ?? item.revenue ?? 0)}</small></span><strong>${money(item.netRevenue ?? item.revenue ?? 0)}</strong></div>`).join("") + renderMiniPager(state.dashTopProductsPage, totalPages, products.length, "products", "produto(s)")
      : `<div class="empty-state compact"><strong>Nenhum produto vendido no período.</strong><span>Produtos vendidos aparecerão aqui.</span><button class="ghost-button" type="button" data-admin-panel="concessionsPanel">Ver Bomboniere</button></div>`;
  }
  if ($("dashLatestOrders")) {
    const orders = data.latestOrders || [];
    const pageSize = state.dashLatestOrdersPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
    state.dashLatestOrdersPage = Math.min(Math.max(1, state.dashLatestOrdersPage || 1), totalPages);
    const start = (state.dashLatestOrdersPage - 1) * pageSize;
    const pageOrders = orders.slice(start, start + pageSize);

    $("dashLatestOrders").innerHTML = orders.length
      ? pageOrders.map((order) => `<div class="metric-row clickable-row" data-admin-order-action="view" data-admin-order-id="${escapeHtml(order.id)}"><span>${escapeHtml(order.reference || orderReference(order))} • ${escapeHtml(order.customerName)}<small>${escapeHtml(order.movieTitle || "")} • ${escapeHtml(order.origin)} • ${escapeHtml(order.status)}</small></span><strong>${money(order.totalPrice)}</strong></div>`).join("") + renderMiniPager(state.dashLatestOrdersPage, totalPages, orders.length, "orders", "pedido(s)")
      : `<div class="empty-state compact"><strong>Sem pedidos recentes</strong><span>As últimas vendas aparecerão aqui.</span></div>`;
  }
  if ($("dashAttentionPayments")) {
    const payments = data.attentionPayments || [];
    $("dashAttentionPayments").innerHTML = payments.length
      ? payments.map((payment) => `<div class="metric-row clickable-row alert-row" data-admin-order-action="view" data-admin-order-id="${escapeHtml(payment.orderId)}"><span>${escapeHtml(payment.orderReference)}<small>${escapeHtml(payment.message)} • ${escapeHtml(payment.method)} • ${escapeHtml(payment.provider)}</small></span><strong>${money(payment.amount)}</strong></div>`).join("")
      : `<div class="empty-state compact success-state"><span class="success-mark" aria-hidden="true"></span><strong>Nenhum pagamento precisa de atenção.</strong><span>Pendências e falhas aparecerão aqui.</span></div>`;
  }
  if ($("dashClubMetrics")) {
    const club = data.club || {};
    $("dashClubMetrics").innerHTML = `
      <div class="dash-club-compact-grid">
        <div class="dash-club-stat clickable-row" data-admin-panel="clubPanel">
          <span>Assinaturas ativas</span>
          <strong>${Number(club.activeSubscriptions || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Receita recorrente</span>
          <strong>${money(club.recurringRevenueEstimate || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Novos no período</span>
          <strong>${Number(club.newSubscribers || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Cancelamentos</span>
          <strong>${Number(club.cancellations || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Ingressos via Clube</span>
          <strong>${Number(club.clubTickets || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Créditos usados</span>
          <strong>${Number(club.creditsUsed || 0)}</strong>
        </div>
      </div>
      <div class="dash-club-footer-link">
        <button class="ghost-button" type="button" data-admin-panel="clubPanel">
          Gerenciar Clube →
        </button>
      </div>
    `;
  }
  if ($("dashOperationalAlerts")) {
    const alerts = [];
    if (data.cardTerminal && !data.cardTerminal.configured) alerts.push(["Maquininha sem integração automática", "Vendas por cartão serão registradas manualmente."]);
    (data.lowStockProducts || []).forEach((item) => alerts.push([`Estoque baixo: ${item.name}`, `${item.stock} unidade(s) disponíveis.`]));
    (data.todaySessions || []).filter((item) => item.isInProgress).forEach((item) => alerts.push([`${item.movie.title} • sessão em andamento`, `Termina às ${dashboardTime(item.endsAt)} • faltam ${item.remainingMinutes} min.`]));
    (data.todaySessions || []).filter((item) => ["Quase lotada", "Esgotada"].includes(item.status)).forEach((item) => alerts.push([`${item.movie.title} • ${item.session.time}`, item.status]));
    $("dashOperationalAlerts").innerHTML = alerts.length
      ? alerts.map(([title, text]) => `<div class="metric-row alert-row"><span>${escapeHtml(title)}<small>${escapeHtml(text)}</small></span><strong>Atenção</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Nenhum alerta operacional.</strong><span>Estoque, sessões e integrações estão sem bloqueios críticos.</span></div>`;
  }
}

function comparisonText(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "";
  const number = Number(value);
  if (!number) return "estável vs. período anterior";
  return `${number > 0 ? "+" : ""}${number}% vs. período anterior`;
}

function renderDashboardChart(rows) {
  const target = $("dashRevenueChart");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state compact"><strong>Nenhum dado disponível para este período.</strong><span>O gráfico será preenchido após as primeiras vendas.</span></div>`;
    return;
  }
  const width = 720;
  const height = 270;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 46;
  const metric = state.dashboardMetric === "sales" ? "sales" : "revenue";
  const valueOf = (item) => metric === "sales" ? Number(item.orders || 0) : Number(item.revenue || 0);
  const maxValue = Math.max(1, ...rows.map(valueOf));
  const x = (index) => padLeft + (rows.length === 1 ? (width - padLeft - padRight) / 2 : (index / (rows.length - 1)) * (width - padLeft - padRight));
  const y = (value) => height - padBottom - (Number(value || 0) / maxValue) * (height - padTop - padBottom);
  const points = rows.map((item, index) => `${x(index)},${y(valueOf(item))}`).join(" ");
  const axisLabel = (value) => metric === "revenue" ? money(value).replace(",00", "") : String(Math.round(value));
  const gridLines = [0, 0.5, 1].map((ratio) => {
    const value = maxValue * ratio;
    const lineY = y(value);
    return `<g class="chart-axis"><line x1="${padLeft}" y1="${lineY}" x2="${width - padRight}" y2="${lineY}" /><text x="${padLeft - 10}" y="${lineY + 4}" text-anchor="end">${escapeHtml(axisLabel(value))}</text></g>`;
  }).join("");

  let dateIndices = [];
  if (rows.length <= 7) {
    dateIndices = rows.map((_, i) => i);
  } else {
    const maxLabels = Math.min(7, Math.max(4, Math.floor((width - padLeft - padRight) / 80)));
    const step = (rows.length - 1) / Math.max(1, maxLabels - 1);
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.round(k * step);
      if (!dateIndices.includes(idx)) dateIndices.push(idx);
    }
  }
  const dateSet = new Set(dateIndices);

  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric === "revenue" ? "Receita" : "Vendas"} por período">
      ${gridLines}
      ${metric === "revenue" ? `<polyline class="chart-line" points="${points}" />` : ""}
      ${rows.map((item, index) => {
        const value = valueOf(item);
        const barWidth = Math.min(28, Math.max(7, 220 / rows.length));
        const barHeight = Math.max(value > 0 ? 3 : 0, height - padBottom - y(value));
        const dateLabel = new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return `
          ${metric === "sales" ? `<rect class="chart-bar" x="${x(index) - barWidth / 2}" y="${height - padBottom - barHeight}" width="${barWidth}" height="${barHeight}" rx="3" />` : ""}
          <circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="${rows.length === 1 ? 7 : 5}" tabindex="0"
            data-chart-hint-date="${escapeHtml(item.date)}" data-chart-hint-revenue="${Number(item.revenue || 0)}"
            data-chart-hint-orders="${Number(item.orders || 0)}" data-chart-hint-tickets="${Number(item.tickets || 0)}" />
          ${dateSet.has(index) ? `<text class="chart-date" x="${x(index)}" y="${height - 16}" text-anchor="middle">${dateLabel}</text>` : ""}
        `;
      }).join("")}
    </svg>
  `;
}

function showChartHint(date, revenue, orders, tickets) {
  if (!$("dashChartHint")) return;
  $("dashChartHint").textContent = `${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} • ${money(revenue)} • ${orders} pedido(s) • ${tickets} ingresso(s)`;
}
    return { renderDashboard, renderDashboardChart, showChartHint };
  }

  const api = Object.freeze({ createDashboardView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.dashboardView = api;
  }
})(globalThis);
