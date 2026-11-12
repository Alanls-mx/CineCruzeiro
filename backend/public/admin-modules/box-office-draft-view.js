((root) => {
  function createBoxOfficeDraftView({ state, $, document, adminAssetUrl, escapeHtml, money, showToast, trashIcon, currentManualMovieSession, currentManualTicketTypes, manualSeatById, manualRequestedSeatCount, closeManualSeatRealtime, loadManualSeatMap, renderManualTicketTypes, updateManualTotal, renderManualSaleSummary }) {
    function manualConcessionItems() {
      return Object.entries(state.manualConcessionQuantities || {})
        .map(([id, quantity]) => ({ id, quantity: Math.max(0, Number(quantity || 0)) }))
        .filter((item) => item.id && item.quantity > 0);
    }

    function renderManualConcessions() {
      const target = $("manualConcessions");
      if (!target) return;
      const section = $("manualConcessionsSection");
      if (section) section.hidden = false;
      const products = (state.content?.concessions || []).filter((item) => item.active !== false);
      const productIds = new Set(products.map((item) => item.id));
      state.manualConcessionQuantities = Object.fromEntries(
        Object.entries(state.manualConcessionQuantities || {}).filter(([id, quantity]) => productIds.has(id) && Number(quantity) > 0)
      );
      const selectedCount = manualConcessionItems().reduce((sum, item) => sum + item.quantity, 0);
      if ($("manualConcessionsCount")) $("manualConcessionsCount").textContent = selectedCount ? `${selectedCount} item(ns)` : "Nenhum item";
      target.innerHTML = products.length
        ? products.map((item) => {
          const finiteStock = item.stock !== null && item.stock !== undefined && item.stock !== "";
          const stock = finiteStock ? Math.max(0, Number(item.stock || 0)) : null;
          const max = Math.max(1, Math.min(Number(item.maxPerOrder || 8), stock ?? Number(item.maxPerOrder || 8)));
          const quantity = Math.min(max, Number(state.manualConcessionQuantities[item.id] || 0));
          if (quantity > 0) state.manualConcessionQuantities[item.id] = quantity;
          return `
            <article class="manual-concession-item ${stock === 0 ? "unavailable" : ""}">
              ${item.imageUrl ? `<img class="manual-concession-image" src="${escapeHtml(adminAssetUrl(item.imageUrl))}" alt="" loading="lazy" />` : `<span class="manual-concession-image manual-concession-image--empty" aria-hidden="true">◈</span>`}
              <div class="manual-concession-copy">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${money(item.price)}${stock !== null ? ` · ${stock} em estoque` : ""}</span>
              </div>
              <div class="stepper">
                <button type="button" data-manual-concession-step="-1" data-concession-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" ${quantity <= 0 ? "disabled" : ""}>-</button>
                <input type="number" min="0" max="${max}" value="${quantity}" data-manual-concession-quantity="${escapeHtml(item.id)}" aria-label="Quantidade de ${escapeHtml(item.name)}" ${stock === 0 ? "disabled" : ""} />
                <button type="button" data-manual-concession-step="1" data-concession-id="${escapeHtml(item.id)}" aria-label="Adicionar ${escapeHtml(item.name)}" ${stock === 0 || quantity >= max ? "disabled" : ""}>+</button>
              </div>
            </article>`;
        }).join("")
        : `<div class="manual-sale-empty">Nenhum produto ativo na bomboniere.</div>`;
      target.querySelectorAll("[data-manual-concession-step]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.concessionId;
        const product = products.find((item) => item.id === id);
        if (!product) return;
        const finiteStock = product.stock !== null && product.stock !== undefined && product.stock !== "";
        const max = Math.max(1, Math.min(Number(product.maxPerOrder || 8), finiteStock ? Number(product.stock || 0) : Number(product.maxPerOrder || 8)));
        state.manualConcessionQuantities[id] = Math.max(0, Math.min(max, Number(state.manualConcessionQuantities[id] || 0) + Number(button.dataset.manualConcessionStep || 0)));
        renderManualConcessions();
        updateManualTotal();
      }));
      target.querySelectorAll("[data-manual-concession-quantity]").forEach((input) => input.addEventListener("change", () => {
        const product = products.find((item) => item.id === input.dataset.manualConcessionQuantity);
        if (!product) return;
        const finiteStock = product.stock !== null && product.stock !== undefined && product.stock !== "";
        const max = Math.max(1, Math.min(Number(product.maxPerOrder || 8), finiteStock ? Number(product.stock || 0) : Number(product.maxPerOrder || 8)));
        state.manualConcessionQuantities[product.id] = Math.max(0, Math.min(max, Number(input.value || 0)));
        renderManualConcessions();
        updateManualTotal();
      }));
    }

    function manualTicketItems() {
      return [...document.querySelectorAll("#manualTicketTypes [data-manual-ticket-quantity]")]
        .map((input) => ({ id: input.dataset.manualTicketQuantity, quantity: Math.max(0, Number(input.value || 0)) }))
        .filter((item) => item.id && item.quantity > 0);
    }

    function manualSaleDraft() {
      const { movie, session } = currentManualMovieSession();
      const ticketItems = manualTicketItems();
      if (!movie || !session || !ticketItems.length) return null;
      const ticketTypes = new Map(currentManualTicketTypes().map((ticketType) => [ticketType.id, ticketType]));
      const subtotal = ticketItems.reduce((sum, item) => sum + item.quantity * Number(ticketTypes.get(item.id)?.price || 0), 0);
      const selectedSeatIds = state.manualSeatMap?.enabled ? [...state.manualSelectedSeatIds] : [];
      const seatChannel = state.manualSeatRealtimeChannels.get(session.id);
      const attendeeCount = ticketItems.reduce((sum, item) => sum + item.quantity * Math.max(1, Number(ticketTypes.get(item.id)?.bundleQuantity || 1)), 0);
      return {
        movieId: movie.id,
        movieTitle: movie.title,
        sessionId: session.id,
        sessionDate: session.date || "",
        sessionTime: session.time || "",
        sessionFormat: session.format || "",
        ticketItems,
        attendeeNames: (state.manualAttendeeNamesBySession?.[session.id] || []).slice(0, attendeeCount),
        ticketSummary: ticketItems.map((item) => ({
          ...item,
          name: ticketTypes.get(item.id)?.name || "Ingresso",
          unitPrice: Number(ticketTypes.get(item.id)?.price || 0),
          bundleQuantity: Math.max(1, Number(ticketTypes.get(item.id)?.bundleQuantity || 1))
        })),
        seatSelectionEnabled: Boolean(state.manualSeatMap?.enabled),
        selectedSeatIds,
        seatHoldToken: seatChannel?.ownerToken || "",
        selectedSeatLabels: selectedSeatIds.map((seatId) => manualSeatById(seatId)?.label || seatId),
        subtotal
      };
    }

    function manualDraftSeatSelectionComplete(draft) {
      if (!draft?.seatSelectionEnabled) return true;
      const required = draft.ticketSummary.reduce((sum, ticket) => sum + ticket.quantity * ticket.bundleQuantity, 0);
      return required > 0 && draft.selectedSeatIds.length === required;
    }

    function addManualSaleItem() {
      const draft = manualSaleDraft();
      if (!draft) {
        showToast("Selecione ao menos um ingresso para adicionar este filme.", "error");
        return;
      }
      if (!manualDraftSeatSelectionComplete(draft)) {
        showToast(`Selecione ${manualRequestedSeatCount()} poltrona(s) antes de adicionar esta sessão.`, "error");
        return;
      }
      const existingIndex = state.manualSaleItems.findIndex((item) => item.sessionId === draft.sessionId);
      if (existingIndex >= 0) {
        state.manualSaleItems.splice(existingIndex, 1, draft);
        showToast("Quantidades da sessão atualizadas.");
      } else {
        state.manualSaleItems.push(draft);
        showToast(`${draft.movieTitle} adicionado à venda.`);
      }
      renderManualSaleItems();
      renderManualTicketTypes();
    }

    function removeManualSaleItem(sessionId) {
      state.manualSaleItems = state.manualSaleItems.filter((item) => item.sessionId !== sessionId);
      const reopenCurrentSession = state.manualSeatMapSessionId === sessionId;
      closeManualSeatRealtime(sessionId, true);
      renderManualSaleItems();
      if (reopenCurrentSession) void loadManualSeatMap();
    }

    function clearManualSaleItems() {
      state.manualSaleItems = [];
      state.manualAttendeeNamesBySession = {};
      const reopenCurrentSession = Boolean(state.manualSeatMapSessionId);
      closeManualSeatRealtime("", true);
      renderManualSaleItems();
      if (reopenCurrentSession) void loadManualSeatMap();
    }

    function renderManualSaleItems() {
      const target = $("manualSaleItems");
      if (!target) return;
      const count = state.manualSaleItems.length;
      $("manualSaleBasketCount").textContent = count
        ? `${count} ${count === 1 ? "filme adicionado" : "filmes adicionados"}`
        : "Nenhum filme adicionado";
      $("manualClearSaleButton").hidden = count === 0;
      target.innerHTML = count
        ? state.manualSaleItems.map((item) => `
          <article class="manual-sale-item">
            <div class="manual-sale-item-main">
              <strong>${escapeHtml(item.movieTitle)}</strong>
              <span>${escapeHtml([item.sessionDate, item.sessionTime, item.sessionFormat].filter(Boolean).join(" • "))}</span>
              <small>${item.ticketSummary.map((ticket) => `${ticket.quantity}× ${escapeHtml(ticket.name)}`).join(" · ")}</small>
              ${item.selectedSeatLabels?.length ? `<small>Poltronas: ${escapeHtml(item.selectedSeatLabels.join(", "))}</small>` : ""}
            </div>
            <strong class="manual-sale-item-price">${money(item.subtotal)}</strong>
            <button class="icon-button danger" type="button" data-remove-manual-session="${escapeHtml(item.sessionId)}" aria-label="Remover ${escapeHtml(item.movieTitle)} desta venda">
              ${trashIcon}
            </button>
          </article>
        `).join("")
        : `<div class="manual-sale-empty">Escolha uma sessão e adicione-a para atribuir vários filmes ao cliente.</div>`;
      target.querySelectorAll("[data-remove-manual-session]").forEach((button) => {
        button.addEventListener("click", () => removeManualSaleItem(button.dataset.removeManualSession));
      });
      updateManualTotal();
      renderManualConcessions();
      const submitButton = $("manualSaleSubmitButton");
      if (submitButton) {
        submitButton.textContent = count > 1
          ? `Finalizar venda de ${count} filmes`
          : state.saleMode === "quick" ? "Finalizar venda rápida" : "Finalizar venda";
      }
      renderManualSaleSummary();
    }

    function renderQuickSaleNames() {
      const section = $("manualQuickSaleNamesSection");
      const target = $("manualQuickSaleNames");
      if (!section || !target) return;
      const items = state.manualSaleItems.length ? state.manualSaleItems : [manualSaleDraft()].filter(Boolean);
      section.hidden = state.saleMode !== "quick" || items.length === 0;
      if (section.hidden) { target.innerHTML = ""; return; }
      state.manualAttendeeNamesBySession ||= {};
      target.innerHTML = items.map((item) => {
        const count = item.ticketSummary.reduce((sum, ticket) => sum + ticket.quantity * ticket.bundleQuantity, 0);
        const ticketLabels = item.ticketSummary.flatMap((ticket) => Array.from({ length: ticket.quantity * ticket.bundleQuantity }, () => ticket.name));
        const names = (state.manualAttendeeNamesBySession[item.sessionId] || item.attendeeNames || []).slice(0, count);
        state.manualAttendeeNamesBySession[item.sessionId] = names;
        item.attendeeNames = [...names];
        return `<div class="manual-quick-sale-group"><strong>${escapeHtml(item.movieTitle)} · ${escapeHtml([item.sessionDate, item.sessionTime].filter(Boolean).join(" • "))}</strong>
          <div class="manual-quick-sale-names-grid">${Array.from({ length: count }, (_, index) => `<label>Ingresso ${index + 1} · ${escapeHtml(ticketLabels[index] || "Ingresso")}${item.selectedSeatLabels?.[index] ? ` · ${escapeHtml(item.selectedSeatLabels[index])}` : ""}<input type="text" required maxlength="80" autocomplete="name" data-quick-attendee-session="${escapeHtml(item.sessionId)}" data-quick-attendee-index="${index}" value="${escapeHtml(names[index] || "")}" placeholder="Nome e sobrenome" /></label>`).join("")}</div></div>`;
      }).join("");
      target.querySelectorAll("[data-quick-attendee-session]").forEach((input) => input.addEventListener("input", () => {
        const sessionId = input.dataset.quickAttendeeSession;
        const index = Number(input.dataset.quickAttendeeIndex);
        const names = state.manualAttendeeNamesBySession[sessionId] ||= [];
        names[index] = input.value;
        const basketItem = state.manualSaleItems.find((item) => item.sessionId === sessionId);
        if (basketItem) basketItem.attendeeNames = [...names];
      }));
    }

    return { manualConcessionItems, renderManualConcessions, manualTicketItems, manualSaleDraft, manualDraftSeatSelectionComplete, addManualSaleItem, removeManualSaleItem, clearManualSaleItems, renderManualSaleItems, renderQuickSaleNames };
  }
  const api = Object.freeze({ createBoxOfficeDraftView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficeDraftView = api; }
})(globalThis);
