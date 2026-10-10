((root) => {
  function createClubView({ state, $, adminAssetUrl, clubStatusLabel, creationPlaceholder, currentClubPlan, escapeHtml, fillClubPlanForm, filterClubSubscriptions, money, paginateAdminItems, renderAdminListPager }) {
function renderClub() {
  const plans = [...(state.content?.subscriptionPlans || [])].sort((a, b) => Number(b.displayOrder ?? 100) - Number(a.displayOrder ?? 100));
  const subscriptions = state.content?.subscriptions || [];
  const credits = state.content?.subscriptionCredits || [];
  const usage = state.content?.subscriptionUsage || [];
  const payments = state.content?.subscriptionPayments || [];
  const totalSavings = subscriptions.reduce((sum, subscription) => sum + Number(subscription.savings?.total || 0), 0);
  if ($("clubOverview")) {
    const now = new Date();
    const inCurrentMonth = (value) => {
      if (!value) return false;
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };
    const statusOf = (item) => String(item?.status || "").toLowerCase();
    const refundAmount = (payment) => {
      const explicit = Number(payment.refundedAmount || payment.refundAmount || payment.metadata?.refundedAmount || 0);
      if (explicit > 0) return Math.min(Number(payment.amount || 0), explicit);
      return ["refunded", "chargeback"].includes(statusOf(payment)) ? Number(payment.amount || 0) : 0;
    };
    const approvedThisMonth = payments.filter((payment) => payment.approvedAt && inCurrentMonth(payment.approvedAt));
    const refundedThisMonth = payments.filter((payment) => refundAmount(payment) > 0 && inCurrentMonth(payment.refundedAt || payment.updatedAt));
    const pendingThisMonth = payments.filter((payment) => statusOf(payment) === "pending" && inCurrentMonth(payment.createdAt));
    const grossThisMonth = approvedThisMonth.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const refundsThisMonth = refundedThisMonth.reduce((sum, payment) => sum + refundAmount(payment), 0);
    const netThisMonth = grossThisMonth - refundsThisMonth;
    const activeSubscriptions = subscriptions.filter((subscription) => statusOf(subscription) === "active");
    const endingSubscriptions = subscriptions.filter((subscription) => statusOf(subscription) === "ending");
    const monthlyRecurringEstimate = activeSubscriptions.reduce((sum, subscription) => {
      const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
      return sum + Number(plan.monthlyPrice || plan.price || 0);
    }, 0);
    const newThisMonth = subscriptions.filter((subscription) => inCurrentMonth(subscription.startedAt || subscription.createdAt)).length;
    const cancelledThisMonth = subscriptions.filter((subscription) => inCurrentMonth(subscription.cancelledAt)).length;
    const planRanking = plans.map((plan) => {
      const planSubscriptions = subscriptions.filter((subscription) => String(subscription.planId) === String(plan.id));
      const active = planSubscriptions.filter((subscription) => statusOf(subscription) === "active").length;
      const ending = planSubscriptions.filter((subscription) => statusOf(subscription) === "ending").length;
      return {
        plan,
        active,
        ending,
        total: planSubscriptions.length,
        recurring: active * Number(plan.monthlyPrice || plan.price || 0)
      };
    }).filter((item) => item.total > 0)
      .sort((a, b) => b.active - a.active || b.total - a.total || String(a.plan.name || "").localeCompare(String(b.plan.name || ""), "pt-BR"));
    const topPlan = planRanking.find((item) => item.active > 0 || item.total > 0);
    const rawMonthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now);
    const monthLabel = `${rawMonthLabel.charAt(0).toLocaleUpperCase("pt-BR")}${rawMonthLabel.slice(1)}`;
    const pendingAmount = pendingThisMonth.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const averagePayment = approvedThisMonth.length ? grossThisMonth / approvedThisMonth.length : 0;
    $("clubOverview").innerHTML = `
      <div class="club-overview-heading">
        <div><div class="section-title">Desempenho do Clube</div><p>Receita reconhecida e situação atual da base de assinantes.</p></div>
        <span class="club-period-label">${escapeHtml(monthLabel)}</span>
      </div>
      <div class="club-finance-kpis">
        <div class="club-finance-kpi primary"><span>Faturamento líquido no mês</span><strong>${money(netThisMonth)}</strong><small>${money(grossThisMonth)} recebidos · ${money(refundsThisMonth)} devolvidos</small></div>
        <div class="club-finance-kpi"><span>Receita recorrente estimada</span><strong>${money(monthlyRecurringEstimate)}</strong><small>${activeSubscriptions.length} assinatura(s) ativa(s) renováveis</small></div>
        <div class="club-finance-kpi"><span>Cobranças pendentes no mês</span><strong>${money(pendingAmount)}</strong><small>${pendingThisMonth.length} mensalidade(s) aguardando confirmação</small></div>
        <div class="club-finance-kpi"><span>Valor médio recebido</span><strong>${money(averagePayment)}</strong><small>${approvedThisMonth.length} mensalidade(s) aprovada(s) no mês</small></div>
      </div>
      <div class="club-overview-details">
        <section class="club-plan-ranking" aria-labelledby="club-plan-ranking-title">
          <div class="club-detail-heading"><div><h3 id="club-plan-ranking-title">Planos mais assinados</h3><p>Base ativa e estimativa mensal por plano.</p></div><strong>${escapeHtml(topPlan?.plan?.name || "Sem assinaturas")}</strong></div>
          <div class="club-ranking-list">
            ${planRanking.length ? planRanking.map((item, index) => `
              <div class="club-ranking-row">
                <span class="club-ranking-position">${index + 1}</span>
                <span class="club-ranking-name"><strong>${escapeHtml(item.plan.name || "Plano")}</strong><small>${item.total} assinatura(s) no histórico${item.ending ? ` · ${item.ending} encerrando` : ""}</small></span>
                <span class="club-ranking-active"><strong>${item.active}</strong><small>ativas</small></span>
                <span class="club-ranking-revenue"><strong>${money(item.recurring)}</strong><small>estimado/mês</small></span>
              </div>`).join("") : `<div class="empty-state compact"><strong>Nenhum plano cadastrado</strong><span>Os indicadores aparecerão após a criação dos planos.</span></div>`}
          </div>
        </section>
        <section class="club-member-summary" aria-labelledby="club-member-summary-title">
          <div class="club-detail-heading"><div><h3 id="club-member-summary-title">Movimento da base</h3><p>Leitura operacional do período atual.</p></div></div>
          <dl>
            <div><dt>Assinaturas ativas</dt><dd>${activeSubscriptions.length}</dd></div>
            <div><dt>Novas no mês</dt><dd>${newThisMonth}</dd></div>
            <div><dt>Canceladas no mês</dt><dd>${cancelledThisMonth}</dd></div>
            <div><dt>Encerrando no fim do ciclo</dt><dd>${endingSubscriptions.length}</dd></div>
            <div><dt>Créditos disponíveis</dt><dd>${credits.reduce((sum, item) => sum + Number(item.remaining || 0), 0)}</dd></div>
            <div><dt>Créditos utilizados</dt><dd>${usage.filter((item) => !item.refundedAt).length}</dd></div>
          </dl>
          <div class="club-savings-summary"><span>Economia entregue aos assinantes</span><strong>${money(totalSavings)}</strong></div>
        </section>
      </div>
    `;
  }
  if ($("clubPlansList")) {
    const planPagination = paginateAdminItems(plans, "clubPlans", "selectedClubPlanId");
    $("clubPlansList").innerHTML = state.creating.clubPlan
      ? creationPlaceholder("Novo plano", "Configure nome, créditos, preço e imagem local no quadro à direita.")
      : plans.length
      ? planPagination.pageItems.map((plan) => `
          <button class="list-item club-plan-item ${plan.id === state.selectedClubPlanId ? "active" : ""}" type="button" data-club-plan-id="${escapeHtml(plan.id)}">
            <span class="plan-thumb">${plan.imageUrl ? `<img src="${escapeHtml(adminAssetUrl(plan.imageUrl))}" alt="">` : `<span>Plano</span>`}</span>
            <span class="club-plan-list-copy">
              <span class="list-title">${escapeHtml(plan.name)}</span>
              <span class="list-meta">${Number(plan.includedTickets || 0)} ingresso(s) por mês${plan.isFeatured ? " • Recomendado" : ""}</span>
            </span>
            <span class="club-plan-list-side">
              <span class="badge">${money(plan.monthlyPrice)}</span>
              <span class="club-plan-list-status ${plan.active === false ? "inactive" : ""}"><i></i>${plan.active === false ? "Inativo" : "Ativo"}</span>
              <small>Prioridade ${Number(plan.displayOrder ?? 100)}</small>
            </span>
          </button>
        `).join("") + renderAdminListPager("clubPlans", planPagination, "plano(s)")
      : `<div class="empty-state"><strong>Nenhum plano cadastrado</strong><span>Crie planos para vender assinatura recorrente.</span></div>`;
  }
  fillClubPlanForm(currentClubPlan());
  if ($("clubAssignPlan")) {
    $("clubAssignPlan").innerHTML = plans
      .filter((plan) => plan.active !== false)
      .map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} - ${money(plan.monthlyPrice)}</option>`)
      .join("");
  }
  if ($("clubSubscriptionSearch")) {
    $("clubSubscriptionSearch").value = state.clubSubscriptionsSearch || "";
    $("clubSubscriptionSearch").oninput = (event) => filterClubSubscriptions(event.target.value);
  }
  if ($("clubSubscriptionsList")) {
    const users = state.content?.users || [];
    const search = String(state.clubSubscriptionsSearch || "").trim().toLocaleLowerCase("pt-BR");
    const sortedSubscriptions = [...subscriptions]
      .filter((subscription) => {
        if (!search) return true;
        const user = subscription.user || users.find((item) => item.id === subscription.userId) || {};
        const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
        return [user.name, user.email, plan.name, subscription.id]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const pageSize = state.clubSubscriptionsPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(sortedSubscriptions.length / pageSize));
    state.clubSubscriptionsPage = Math.min(Math.max(1, state.clubSubscriptionsPage || 1), totalPages);
    const start = (state.clubSubscriptionsPage - 1) * pageSize;
    const pageItems = sortedSubscriptions.slice(start, start + pageSize);
    $("clubSubscriptionsList").innerHTML = sortedSubscriptions.length
      ? `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, sortedSubscriptions.length)}</strong> de <strong>${sortedSubscriptions.length}</strong> assinatura(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.clubSubscriptionsPage <= 1 ? "disabled" : ""} data-static-pager="club-subscriptions" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.clubSubscriptionsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.clubSubscriptionsPage >= totalPages ? "disabled" : ""} data-static-pager="club-subscriptions" data-page-delta="1">Próxima →</button>
          </div>
        </div>
        <div class="list">
          ${pageItems.map((subscription) => {
            const user = subscription.user || users.find((item) => item.id === subscription.userId) || {};
            const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
            const credit = credits.find((item) => item.id === subscription.currentCreditId) || credits.find((item) => item.subscriptionId === subscription.id);
            const terminal = ["cancelled", "ended", "cancelled_by_admin"].includes(String(subscription.status || "").toLowerCase());
            const ending = String(subscription.status || "").toLowerCase() === "ending";
            const canReactivate = !subscription.reactivationBlocked
              && !["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())
              && String(subscription.provider || "") === "manual_admin"
              && String(subscription.status || "") === "paused";
            const savings = subscription.savings || {};
            return `
              <div class="list-item static">
                <span class="subscription-identity">
                  <span class="list-title">${escapeHtml(user.name || user.email || "Cliente")}</span>
                  <span class="subscription-email">${escapeHtml(user.email || "E-mail não informado")}</span>
                  <span class="list-meta">${escapeHtml(plan.name || subscription.planId)} • ${clubStatusLabel(subscription.status)} • ${Number(credit?.remaining ?? subscription.creditsAvailable ?? 0)} de ${Number(credit?.total ?? plan.includedTickets ?? 0)} crédito(s)</span>
                  ${ending ? `<span class="subscription-ending-note">Cobrança encerrada; benefícios válidos até ${subscription.benefitsUntil ? new Date(subscription.benefitsUntil).toLocaleDateString("pt-BR") : "o fim do ciclo"}.</span>` : ""}
                  <span class="subscription-savings" aria-label="Economia obtida com o Clube">
                    <strong>${money(savings.total || 0)} economizados</strong>
                    <span>Ingressos ${money(savings.tickets || 0)} • Bomboniere ${money(Number(savings.concessions || 0) + Number(savings.freeItems || 0))} • ${Number(savings.benefitedOrders || 0)} pedido(s)</span>
                  </span>
                </span>
                <span class="table-actions">
                  <button class="ghost-button" type="button" data-club-subscription-action="view" data-club-subscription-id="${escapeHtml(subscription.id)}">Detalhes</button>
                  ${canReactivate ? `<button class="ghost-button" type="button" data-club-subscription-action="active" data-club-subscription-id="${escapeHtml(subscription.id)}">Ativar</button>` : ""}
                  ${!terminal && !ending && subscription.status === "active" ? `<button class="ghost-button" type="button" data-club-subscription-action="paused" data-club-subscription-id="${escapeHtml(subscription.id)}">Pausar</button>` : ""}
                  <button class="ghost-button" type="button" data-club-subscription-action="credit" data-club-subscription-id="${escapeHtml(subscription.id)}">Ajustar crédito</button>
                  ${terminal
                    ? `<button class="danger-button" type="button" data-club-subscription-action="delete" data-club-subscription-id="${escapeHtml(subscription.id)}">Excluir</button>`
                    : ending ? "" : `<button class="danger-button" type="button" data-club-subscription-action="cancelled" data-club-subscription-id="${escapeHtml(subscription.id)}">Cancelar renovação</button>`}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      `
      : `<div class="empty-state"><strong>${search ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}</strong><span>${search ? "Revise o nome, e-mail ou plano informado." : "Atribuições manuais e assinaturas externas aparecerão aqui."}</span></div>`;
  }
  if ($("clubUsageList")) {
    const usagePageSize = state.clubUsagePageSize || 5;
    const totalUsagePages = Math.max(1, Math.ceil(usage.length / usagePageSize));
    state.clubUsagePage = Math.min(Math.max(1, state.clubUsagePage || 1), totalUsagePages);
    const usageStart = (state.clubUsagePage - 1) * usagePageSize;
    const pageUsage = usage.slice(usageStart, usageStart + usagePageSize);

    $("clubUsageList").innerHTML = usage.length
      ? `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${usageStart + 1}–${Math.min(usageStart + pageUsage.length, usage.length)}</strong> de <strong>${usage.length}</strong> registro(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.clubUsagePage <= 1 ? "disabled" : ""} data-static-pager="club-usage" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.clubUsagePage} de ${totalUsagePages}</span>
            <button class="ghost-button" type="button" ${state.clubUsagePage >= totalUsagePages ? "disabled" : ""} data-static-pager="club-usage" data-page-delta="1">Próxima →</button>
          </div>
        </div>
        <div class="orders-table">
          <table>
            <thead><tr><th>Data</th><th>Assinatura</th><th>Pedido</th><th>Ingresso</th><th>Status</th></tr></thead>
            <tbody>
              ${pageUsage.map((item) => `
                <tr>
                  <td data-label="Data">${item.usedAt ? new Date(item.usedAt).toLocaleString("pt-BR") : "-"}</td>
                  <td data-label="Assinatura">${escapeHtml(item.subscriptionId || "-")}</td>
                  <td data-label="Pedido">${escapeHtml(item.orderId || "-")}</td>
                  <td data-label="Ingresso">${escapeHtml(item.ticketId || "-")}</td>
                  <td data-label="Status"><span class="badge ${item.refundedAt ? "muted" : ""}">${item.refundedAt ? "Crédito devolvido" : "Consumido"}</span>${item.refundedAt ? `<small class="financial-event-time">Devolvido em ${new Date(item.refundedAt).toLocaleString("pt-BR")}</small>` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state"><strong>Nenhum uso de crédito</strong><span>Os ingressos emitidos pelo Clube aparecerão aqui.</span></div>`;
  }
}
    return { renderClub };
  }

  const api = Object.freeze({ createClubView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.clubView = api;
  }
})(globalThis);
