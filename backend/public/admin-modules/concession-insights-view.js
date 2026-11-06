((root) => {
  function createConcessionInsightsView({ $, escapeHtml, money, state }) {
    function changeConcessionBreakdownPage(delta) {
      state.concessionBreakdownPage = Math.max(1, (state.concessionBreakdownPage || 1) + delta);
      renderConcessionInsights();
    }

    function renderConcessionInsights() {
      const insights = $("concessionInsights");
      const discountSummary = $("concessionDiscountSummary");
      const salesBreakdown = $("concessionSalesBreakdown");
      if (!insights || !discountSummary || !salesBreakdown) return;

      const financeSource = state.concessionFinanceData || state.dashboard || {};
      const summary = financeSource.concessionSummary;
      const period = financeSource.period || {};
      const formatDate = (value) => value
        ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
        : "";
      const periodLabel = period.start && period.end
        ? period.start === period.end
          ? `Pedidos pagos em ${formatDate(period.start)}.`
          : `Pedidos pagos de ${formatDate(period.start)} a ${formatDate(period.end)}.`
        : "Somente pedidos pagos no período selecionado.";
      if ($("concessionFinancePeriod")) $("concessionFinancePeriod").textContent = periodLabel;

      if (!summary) {
        insights.innerHTML = `<div class="empty-state compact"><strong>Carregando resultado financeiro</strong><span>Os valores serão conciliados com os pedidos pagos.</span></div>`;
        discountSummary.innerHTML = "";
        salesBreakdown.innerHTML = "";
        return;
      }

      const products = Array.isArray(summary.products) ? summary.products : [];
      insights.innerHTML = `
        <div class="mini-insight"><span>Receita líquida</span><strong>${money(summary.netRevenue)}</strong><small>Valor aprovado atribuído à bomboniere</small></div>
        <div class="mini-insight"><span>Venda bruta</span><strong>${money(summary.grossRevenue)}</strong><small>Antes de benefícios e cupons</small></div>
        <div class="mini-insight"><span>Descontos concedidos</span><strong>${money(summary.discountTotal)}</strong><small>${Number(summary.discountedOrders || 0)} pedido(s) com desconto</small></div>
        <div class="mini-insight"><span>Reembolsos</span><strong>${money(summary.refundTotal)}</strong><small>${Number(summary.refundedQuantity || 0)} item(ns) devolvido(s)</small></div>
        <div class="mini-insight"><span>Volume registrado</span><strong>${Number(summary.itemQuantity || 0)} item(ns)</strong><small>Distribuídos em ${Number(summary.orders || 0)} pedido(s)</small></div>
      `;

      const adjustment = Number(summary.reconciliationAdjustment || 0);
      discountSummary.innerHTML = `
        <div class="concession-formula" aria-label="Fórmula da receita líquida">
          <span><small>Venda bruta</small><strong>${money(summary.grossRevenue)}</strong></span>
          <b aria-hidden="true">−</b>
          <span><small>Descontos identificados</small><strong>${money(summary.identifiedDiscountTotal ?? summary.discountTotal)}</strong></span>
          ${Number(summary.refundTotal || 0) > 0 ? `<b aria-hidden="true">−</b><span><small>Reembolsos confirmados</small><strong>${money(summary.refundTotal)}</strong></span>` : ""}
          ${Math.abs(adjustment) > 0.009 ? `<b aria-hidden="true">${adjustment >= 0 ? "+" : "−"}</b><span><small>Ajuste de conciliação</small><strong>${money(Math.abs(adjustment))}</strong></span>` : ""}
          <b aria-hidden="true">=</b>
          <span class="is-net"><small>Receita líquida</small><strong>${money(summary.netRevenue)}</strong></span>
        </div>
        <div class="concession-discount-sources">
          <span><small>Desconto do Clube</small><strong>${money(summary.clubDiscount)}</strong></span>
          <span><small>Itens grátis do Clube</small><strong>${money(summary.freeItemDiscount)}</strong></span>
          <span><small>Cupons aplicados</small><strong>${money(summary.couponDiscount)}</strong></span>
        </div>
      `;

      const pageSize = state.concessionBreakdownPageSize || 5;
      const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
      state.concessionBreakdownPage = Math.min(Math.max(1, state.concessionBreakdownPage || 1), totalPages);
      const start = (state.concessionBreakdownPage - 1) * pageSize;
      const pageProducts = products.slice(start, start + pageSize);

      const pagerMarkup = products.length > pageSize ? `
        <div class="table-pagination-bar" style="margin-bottom: 12px;">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageProducts.length, products.length)}</strong> de <strong>${products.length}</strong> produto(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.concessionBreakdownPage <= 1 ? "disabled" : ""} data-static-pager="concession-breakdown" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.concessionBreakdownPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.concessionBreakdownPage >= totalPages ? "disabled" : ""} data-static-pager="concession-breakdown" data-page-delta="1">Próxima →</button>
          </div>
        </div>
      ` : "";

      salesBreakdown.innerHTML = products.length
        ? `${pagerMarkup}${pageProducts.map((item) => {
            const gross = Number(item.grossRevenue || 0);
            const net = Number(item.netRevenue || 0);
            const unitPrice = Number(item.minimumUnitPrice || 0) === Number(item.maximumUnitPrice || 0)
              ? `${money(item.minimumUnitPrice)} por unidade`
              : `${money(item.minimumUnitPrice)} a ${money(item.maximumUnitPrice)} por unidade`;
            const benefitNotes = [
              Number(item.clubDiscountedQuantity || 0) ? `${Number(item.clubDiscountedQuantity)} item(ns) com desconto do Clube` : "",
              Number(item.freeQuantity || 0) ? `${Number(item.freeQuantity)} item(ns) grátis pelo Clube` : "",
              Number(item.couponDiscountedQuantity || 0)
                ? `${Number(item.couponDiscountedQuantity)} item(ns) com ${Array.isArray(item.couponCodes) && item.couponCodes.length ? `cupom ${item.couponCodes.join(", ")}` : "cupom"}`
                : "",
              Number(item.refundedQuantity || 0) ? `${Number(item.refundedQuantity)} item(ns) reembolsado(s)` : ""
            ].filter(Boolean);
            return `
              <article class="concession-breakdown-row">
                <div class="concession-breakdown-product">
                  <strong>${escapeHtml(item.name || "Produto")}</strong>
                  <span>${Number(item.quantity || 0)} unidade(s) em ${Number(item.orders || 0)} pedido(s) • ${unitPrice}</span>
                  ${benefitNotes.length ? `<small>${benefitNotes.map(escapeHtml).join(" • ")}</small>` : `<small>Vendido sem desconto neste período</small>`}
                </div>
                <dl aria-label="Composição financeira de ${escapeHtml(item.name || "Produto")}">
                  <div><dt>Bruto</dt><dd>${money(gross)}</dd></div>
                  <div class="${Number(item.clubDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Clube</dt><dd>${Number(item.clubDiscount || 0) > 0 ? `− ${money(item.clubDiscount)}` : money(0)}</dd></div>
                  <div class="${Number(item.freeItemDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Itens grátis</dt><dd>${Number(item.freeItemDiscount || 0) > 0 ? `− ${money(item.freeItemDiscount)}` : money(0)}</dd></div>
                  <div class="${Number(item.couponDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Cupom</dt><dd>${Number(item.couponDiscount || 0) > 0 ? `− ${money(item.couponDiscount)}` : money(0)}</dd></div>
                  <div class="${Number(item.refundTotal || 0) > 0 ? "is-refund" : "is-empty"}"><dt>Reembolso</dt><dd>${Number(item.refundTotal || 0) > 0 ? `− ${money(item.refundTotal)}` : money(0)}</dd></div>
                  <div class="${Math.abs(Number(item.reconciliationAdjustment || 0)) > 0.009 ? "" : "is-empty"}"><dt>Ajuste</dt><dd>${Math.abs(Number(item.reconciliationAdjustment || 0)) > 0.009 ? `${Number(item.reconciliationAdjustment) >= 0 ? "+" : "−"} ${money(Math.abs(Number(item.reconciliationAdjustment)))}` : money(0)}</dd></div>
                  <div class="is-net"><dt>Líquido</dt><dd>${money(net)}</dd></div>
                </dl>
              </article>`;
          }).join("")}`
        : `<div class="empty-state"><strong>Nenhuma venda paga no período</strong><span>Quando um pedido com produtos da bomboniere for aprovado, cada item e desconto aparecerá detalhado aqui.</span></div>`;
    }
    return { changeConcessionBreakdownPage, renderConcessionInsights };
  }
  const api = Object.freeze({ createConcessionInsightsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.concessionInsightsView = api; }
})(globalThis);
