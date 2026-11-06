((root) => {
  function createBoxOfficeSaleSummary({ state, $, document, escapeHtml, money, manualSaleDraft, manualConcessionItems, manualSessionDateDisplay }) {
    function manualSaleSummaryCustomer() {
      if (state.saleMode === "quick") return "Venda rápida";
      if (state.saleMode === "registered") return state.selectedCustomer?.name || "Cliente não selecionado";
      return $("manualCustomerName")?.value.trim() || "Cliente avulso";
    }

    function manualSaleSummaryMode() {
      return {
        registered: "Cliente cadastrado",
        guest: "Cliente avulso",
        quick: "Venda rápida"
      }[state.saleMode] || "Venda";
    }

    function manualSaleSummaryPayment() {
      const method = document.querySelector("input[name='manualPaymentMethod']:checked")?.value || "cash";
      return {
        cash: "Dinheiro",
        point_debit: "Débito na Point",
        point_credit: "Crédito na Point",
        point_card: "Cartão na Point",
        point_qr: "Pix na Point",
        courtesy: "Cortesia"
      }[method] || "Pagamento";
    }

    function manualTicketDeliveryMethod() {
      if (state.saleMode === "quick") return "physical";
      if (state.saleMode === "registered") return "online";
      return document.querySelector("input[name='guestTicketDeliveryMethod']:checked")?.value === "online"
        ? "online"
        : "physical";
    }

    function manualTicketDeliveryLabel() {
      return manualTicketDeliveryMethod() === "online" ? "Ingresso online" : "Impressão física";
    }

    function renderManualSaleSummary() {
      const target = $("manualSaleSummary");
      if (!target) return;
      const draft = manualSaleDraft();
      const saleItems = state.manualSaleItems.length ? state.manualSaleItems : draft ? [draft] : [];
      const concessionsById = new Map((state.content?.concessions || []).map((item) => [String(item.id), item]));
      const concessions = manualConcessionItems().map((item) => ({
        ...item,
        product: concessionsById.get(String(item.id))
      })).filter((item) => item.product);
      const ticketCount = saleItems.reduce((sum, item) => sum + (item.ticketSummary || []).reduce((ticketSum, ticket) => (
        ticketSum + Number(ticket.quantity || 0) * Math.max(1, Number(ticket.bundleQuantity || 1))
      ), 0), 0);
      const seatLabels = saleItems.flatMap((item) => item.selectedSeatLabels || []);
      const concessionsCount = concessions.reduce((sum, item) => sum + item.quantity, 0);
      const ticketsTotal = saleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const concessionsTotal = concessions.reduce((sum, item) => sum + item.quantity * Number(item.product.price || 0), 0);
      const total = ticketsTotal + concessionsTotal;
      const isDraft = !state.manualSaleItems.length && Boolean(draft);

      const saleItemsMarkup = saleItems.length ? saleItems.map((item) => {
        const date = item.sessionDate ? manualSessionDateDisplay(item.sessionDate) : "";
        const session = [date, item.sessionTime, item.sessionFormat].filter(Boolean).join(" • ");
        return `
          <article class="manual-sale-summary-session">
            <div class="manual-sale-summary-session-title">
              <strong>${escapeHtml(item.movieTitle || "Filme")}</strong>
              ${isDraft ? `<span>Em edição</span>` : ""}
            </div>
            <small>${escapeHtml(session)}</small>
            <div class="manual-sale-summary-lines">
              ${(item.ticketSummary || []).map((ticket) => `
                <div>
                  <span><b>${Number(ticket.quantity || 0)}×</b> ${escapeHtml(ticket.name || "Ingresso")}</span>
                  <strong>${money(Number(ticket.quantity || 0) * Number(ticket.unitPrice || 0))}</strong>
                </div>
              `).join("")}
            </div>
            ${(item.selectedSeatLabels || []).length ? `
              <div class="manual-sale-summary-seats">
                <span>Poltronas</span>
                <div>${item.selectedSeatLabels.map((label) => `<b>${escapeHtml(label)}</b>`).join("")}</div>
              </div>
            ` : ""}
          </article>`;
      }).join("") : `
        <div class="manual-sale-summary-empty">
          <strong>Nenhum ingresso selecionado</strong>
          <span>Escolha a sessão e a quantidade para iniciar a venda.</span>
        </div>`;

      const concessionsMarkup = concessions.length ? `
        <section class="manual-sale-summary-section">
          <div class="manual-sale-summary-section-title">
            <span>Bomboniere</span>
            <strong>${concessionsCount} ${concessionsCount === 1 ? "item" : "itens"}</strong>
          </div>
          <div class="manual-sale-summary-lines">
            ${concessions.map((item) => `
              <div>
                <span><b>${item.quantity}×</b> ${escapeHtml(item.product.name)}</span>
                <strong>${money(item.quantity * Number(item.product.price || 0))}</strong>
              </div>
            `).join("")}
          </div>
        </section>` : "";
      target.innerHTML = `
        <div class="manual-sale-summary-heading">
          <div>
            <span>Venda em andamento</span>
            <h2 id="manualSaleSummaryTitle">Resumo da venda</h2>
          </div>
          <span class="manual-sale-summary-mode">${escapeHtml(manualSaleSummaryMode())}</span>
        </div>
        <div class="manual-sale-summary-customer">
          <span>Cliente</span>
          <strong>${escapeHtml(manualSaleSummaryCustomer())}</strong>
          <small>${escapeHtml(manualTicketDeliveryLabel())}</small>
        </div>
        <section class="manual-sale-summary-section">
          <div class="manual-sale-summary-section-title">
            <span>Ingressos</span>
            <strong>${ticketCount} ${ticketCount === 1 ? "ingresso" : "ingressos"}</strong>
          </div>
          <div class="manual-sale-summary-sessions">${saleItemsMarkup}</div>
        </section>
        ${concessionsMarkup}
        <div class="manual-sale-summary-footer">
          <div>
            <span>${escapeHtml(manualSaleSummaryPayment())}</span>
            ${seatLabels.length ? `<small>${seatLabels.length} ${seatLabels.length === 1 ? "poltrona selecionada" : "poltronas selecionadas"}</small>` : ""}
          </div>
          <strong>${money(total)}</strong>
        </div>`;
    }

    return { manualSaleSummaryCustomer, manualSaleSummaryMode, manualSaleSummaryPayment, manualTicketDeliveryMethod, manualTicketDeliveryLabel, renderManualSaleSummary };
  }
  const api = Object.freeze({ createBoxOfficeSaleSummary });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficeSaleSummary = api; }
})(globalThis);
