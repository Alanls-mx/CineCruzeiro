((root) => {
  function createPaymentCenterView({ state, $, escapeHtml, financialStatusEventHtml, money, originLabel, paymentMethodLabel, paymentStatusLabel, providerLabel, statusClass }) {
    function changePaymentsPage(delta) {
      state.paymentsPage = Math.max(1, (state.paymentsPage || 1) + delta);
      renderPaymentsCenter();
    }

    function renderPaymentsCenter() {
      const target = $("paymentsList");
      if (!target) return;
      const data = state.payments || {};
      if ($("paymentProviderStatus")) {
        $("paymentProviderStatus").textContent = data.cardTerminal?.configured
          ? `Terminal Point integrado: ${data.cardTerminal.provider}.`
          : "Terminal Point não configurado. Ative a integração para receber Pix, débito ou crédito na Bilheteria.";
      }
      const allRows = data.payments || [];
      if (!allRows.length) {
        target.innerHTML = `<div class="empty-state"><strong>Nenhum pagamento encontrado.</strong><span>Ajuste os filtros ou selecione outro período.</span></div>`;
        return;
      }

      const pageSize = state.paymentsPageSize || 8;
      const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
      state.paymentsPage = Math.min(Math.max(1, state.paymentsPage || 1), totalPages);
      const start = (state.paymentsPage - 1) * pageSize;
      const rows = allRows.slice(start, start + pageSize);

      const pagerMarkup = `
        <div class="table-pagination-bar">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + rows.length, allRows.length)}</strong> de <strong>${allRows.length}</strong> pagamento(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.paymentsPage <= 1 ? "disabled" : ""} data-static-pager="payments" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.paymentsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.paymentsPage >= totalPages ? "disabled" : ""} data-static-pager="payments" data-page-delta="1">Próxima →</button>
          </div>
        </div>
      `;

      target.innerHTML = `
        ${pagerMarkup}
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Filme</th>
              <th>Origem</th>
              <th>Método</th>
              <th>Provider</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((payment) => `
              <tr class="order-table-row" data-admin-order-action="view" data-admin-order-id="${escapeHtml(payment.orderId)}">
                <td data-label="Pedido"><strong>${escapeHtml(payment.orderReference || payment.orderId)}</strong><br><span class="list-meta">${new Date(payment.createdAt).toLocaleString("pt-BR")}</span></td>
                <td data-label="Cliente">${escapeHtml(payment.customerName || "Cliente")}</td>
                <td data-label="Filme">${escapeHtml(payment.movieTitle || "-")}</td>
                <td data-label="Origem">${escapeHtml(payment.originLabel || originLabel(payment.origin))}</td>
                <td data-label="Método">${escapeHtml(payment.methodLabel || paymentMethodLabel(payment.method))}</td>
                <td data-label="Provider">${escapeHtml(payment.providerLabel || providerLabel(payment.provider))}</td>
                <td data-label="Valor"><strong>${money(payment.amount)}</strong></td>
                <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(payment.status)}">${escapeHtml(payment.statusLabel || paymentStatusLabel(payment.status))}</span>${financialStatusEventHtml(payment)}</div></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }

    return { changePaymentsPage, renderPaymentsCenter };
  }
  const api = Object.freeze({ createPaymentCenterView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.paymentCenterView = api; }
})(globalThis);
