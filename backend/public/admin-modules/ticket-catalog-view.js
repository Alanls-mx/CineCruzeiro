((root) => {
  function createTicketCatalogView({ state, $, activatePanel, api, confirm, creationPlaceholder, currentTicket, escapeHtml, issuedTicketSessionLabel, money, movieById, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, setDisabled, showToast, syncCreationControl, ticketStatusText, upsertAdminCollection }) {
    const pendingActions = new Set();
    async function once(key, action, event) {
      event?.preventDefault?.();
      if (pendingActions.has(key)) return;
      pendingActions.add(key);
      try { return await action(); }
      finally { pendingActions.delete(key); }
    }

    function renderTickets() {
      const tickets = state.content?.ticketTypes || [];
      if (state.creating.ticket) {
        $("ticketsList").innerHTML = creationPlaceholder("Novo tipo de ingresso", "Defina nome, preço e disponibilidade no quadro à direita.");
        fillTicketForm(null);
        renderIssuedTickets();
        return;
      }
      if (!tickets.length) {
        $("ticketsList").innerHTML = `
          <div class="empty-state">
            <strong>Nenhum ingresso cadastrado</strong>
            <span>Crie o ticket promocional base para liberar vendas.</span>
          </div>
        `;
        fillTicketForm(null);
        renderIssuedTickets();
        return;
      }

      const pagination = paginateAdminItems(tickets, "ticketTypes", "selectedTicketId");
      $("ticketsList").innerHTML = pagination.pageItems
        .map((ticket) => {
          const active = ticket.id === state.selectedTicketId ? "active" : "";
          return `
            <button class="list-item ${active}" type="button" data-admin-select-kind="ticket" data-admin-select-id="${escapeHtml(ticket.id)}">
              <span>
                <span class="list-title">${escapeHtml(ticket.name)}</span>
                <span class="list-meta">${escapeHtml(ticket.description || "Sem descrição")}${Number(ticket.bundleQuantity || 1) > 1 ? ` • gera ${Number(ticket.bundleQuantity)} ingressos por unidade` : ""}</span>
              </span>
              <span class="badge">${money(ticket.price)}</span>
            </button>
          `;
        })
        .join("") + renderAdminListPager("ticketTypes", pagination, "tipo(s)");
      fillTicketForm(currentTicket());
      renderIssuedTickets();
    }

    function renderIssuedTicketFilters(tickets) {
      const movieSelect = $("issuedTicketMovieFilter");
      const sessionSelect = $("issuedTicketSessionFilter");
      const roomSelect = $("issuedTicketRoomFilter");
      if (!movieSelect || !sessionSelect || !roomSelect) return;

      const movies = [...new Map(tickets.map((ticket) => [ticket.movieId, ticket.movieTitle || movieById(ticket.movieId)?.title]).filter(([id]) => id)).entries()]
        .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
      movieSelect.innerHTML = `<option value="">Todos</option>${movies.map(([id, title]) => `<option value="${escapeHtml(id)}">${escapeHtml(title || id)}</option>`).join("")}`;
      movieSelect.value = state.issuedTicketFilters.movieId;

      const sessionTickets = state.issuedTicketFilters.movieId ? tickets.filter((ticket) => ticket.movieId === state.issuedTicketFilters.movieId) : tickets;
      const sessions = [...new Map(sessionTickets.map((ticket) => [ticket.sessionId, issuedTicketSessionLabel(ticket)]).filter(([id]) => id)).entries()]
        .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
      sessionSelect.innerHTML = `<option value="">Todas</option>${sessions.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label || id)}</option>`).join("")}`;
      sessionSelect.value = state.issuedTicketFilters.sessionId;

      const rooms = [...new Set(tickets.map((ticket) => ticket.sessionRoom).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      roomSelect.innerHTML = `<option value="">Todas</option>${rooms.map((room) => `<option value="${escapeHtml(room)}">${escapeHtml(room)}</option>`).join("")}`;
      roomSelect.value = state.issuedTicketFilters.room;
      $("issuedTicketDateFilter").value = state.issuedTicketFilters.date;
      $("issuedTicketStatusFilter").value = state.issuedTicketFilters.status;
    }

    function filteredIssuedTickets() {
      const filters = state.issuedTicketFilters;
      return (state.content?.tickets || [])
        .filter((ticket) => !filters.movieId || ticket.movieId === filters.movieId)
        .filter((ticket) => !filters.sessionId || ticket.sessionId === filters.sessionId)
        .filter((ticket) => !filters.date || ticket.sessionDate === filters.date)
        .filter((ticket) => !filters.status || ticket.status === filters.status)
        .filter((ticket) => !filters.room || ticket.sessionRoom === filters.room)
        .sort((a, b) => String(`${b.sessionDate || ""} ${b.sessionTime || ""}`).localeCompare(String(`${a.sessionDate || ""} ${a.sessionTime || ""}`)));
    }

    function renderIssuedTickets() {
      const allTickets = state.content?.tickets || [];
      if (!$("issuedTicketsList")) return;
      renderIssuedTicketFilters(allTickets);
      const tickets = filteredIssuedTickets();
      if (!tickets.length) {
        $("issuedTicketsList").innerHTML = `
          <div class="empty-state">
            <strong>Nenhum ingresso encontrado</strong>
            <span>Altere os filtros ou emita uma venda para visualizar os tickets vinculados às sessões.</span>
          </div>
        `;
        return;
      }
      const pageSize = state.issuedTicketsPageSize || 5;
      const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
      state.issuedTicketsPage = Math.min(Math.max(1, state.issuedTicketsPage || 1), totalPages);
      const start = (state.issuedTicketsPage - 1) * pageSize;
      const pageItems = tickets.slice(start, start + pageSize);

      $("issuedTicketsList").innerHTML = `
        <div class="issued-tickets-pager-bar">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, tickets.length)}</strong> de <strong>${tickets.length}</strong> ingresso(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.issuedTicketsPage <= 1 ? "disabled" : ""} data-static-pager="issued-tickets" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.issuedTicketsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.issuedTicketsPage >= totalPages ? "disabled" : ""} data-static-pager="issued-tickets" data-page-delta="1">Próxima →</button>
          </div>
        </div>
        <div class="issued-tickets-rows">
          ${pageItems.map((ticket) => `
            <article class="issued-ticket-row">
              <div>
                <strong>${escapeHtml(ticket.movieTitle || "Filme não identificado")}</strong>
                <span>${escapeHtml(issuedTicketSessionLabel(ticket) || "Sessão não identificada")}</span>
              </div>
              <div>
                <span class="mini-label">Sala</span>
                <strong>${escapeHtml(ticket.sessionRoom || "Sala não informada")}</strong>
              </div>
              <div>
                <span class="mini-label">Assento</span>
                <strong>${escapeHtml(ticket.seat || "Lugar livre")}</strong>
              </div>
              <div>
                <span class="mini-label">Tipo</span>
                <strong>${escapeHtml(ticket.ticketType || "Ingresso")}</strong>
              </div>
              <div>
                <span class="mini-label">Cliente</span>
                <strong>${escapeHtml(ticket.customerName || ticket.customerEmail || "Cliente")}</strong>
              </div>
              <div>
                <span class="mini-label">Pedido</span>
                <button class="text-button" type="button" data-admin-ticket-action="order" data-admin-ticket-value="${escapeHtml(ticket.orderId || ticket.orderReference || "")}">${escapeHtml(ticket.orderReference || ticket.orderId || "-")}</button>
              </div>
              <div>
                <span class="mini-label">Status</span>
                <span class="status-pill status-${escapeHtml(ticket.status || "unknown")}">${escapeHtml(ticketStatusText(ticket.status))}</span>
              </div>
              <button class="ghost-button" type="button" data-admin-session-action="tickets" data-admin-session-id="${escapeHtml(ticket.sessionId || "")}">Sessão</button>
            </article>
          `).join("")}
        </div>
      `;
    }

    function changeIssuedTicketsPage(delta) {
      const tickets = filteredIssuedTickets();
      const pageSize = state.issuedTicketsPageSize || 5;
      const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
      state.issuedTicketsPage = Math.min(Math.max(1, (state.issuedTicketsPage || 1) + delta), totalPages);
      renderIssuedTickets();
    }

    function showSessionTickets(sessionId) {
      if (!sessionId) return;
      const ticket = (state.content?.tickets || []).find((item) => item.sessionId === sessionId);
      state.issuedTicketsPage = 1;
      state.issuedTicketFilters.sessionId = sessionId;
      state.issuedTicketFilters.movieId = ticket?.movieId || state.issuedTicketFilters.movieId || "";
      activatePanel("ticketsPanel", { scroll: true });
      renderIssuedTickets();
    }

    function selectTicket(id) {
      state.creating.ticket = false;
      state.selectedTicketId = id;
      renderTickets();
    }

    function newTicket() {
      state.creating.ticket = true;
      state.selectedTicketId = "";
      $("ticketsList").innerHTML = creationPlaceholder("Novo tipo de ingresso", "Defina nome, preço e disponibilidade no quadro à direita.");
      fillTicketForm(null);
    }

    function fillTicketForm(ticket) {
      syncCreationControl("ticket", "cancelTicketCreateButton", "deleteTicketButton", Boolean(ticket));
      setDisabled("deleteTicketButton", !ticket);
      $("ticketId").value = ticket?.id || "";
      $("ticketName").value = ticket?.name || "";
      $("ticketPrice").value = ticket?.price ?? 10;
      $("ticketBundleQuantity").value = ticket?.bundleQuantity ?? 1;
      $("ticketDescription").value = ticket?.description || "";
      $("ticketActive").checked = ticket?.active !== false;
    }

    async function saveTicket(event) {
      event.preventDefault();
      try {
        const payload = {
          id: $("ticketId").value || undefined,
          name: $("ticketName").value,
          price: Number($("ticketPrice").value || 0),
          bundleQuantity: Math.max(1, Number($("ticketBundleQuantity").value || 1)),
          description: $("ticketDescription").value,
          active: $("ticketActive").checked
        };
        const existingId = $("ticketId").value;
        const saved = existingId
          ? await api(`/api/ticket-types/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/ticket-types", { method: "POST", body: JSON.stringify(payload) });
        state.creating.ticket = false;
        state.selectedTicketId = saved.id;
        upsertAdminCollection("ticketTypes", saved);
        renderTickets();
        showToast("Ingresso salvo.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function deleteTicket() {
      const ticket = currentTicket();
      if (!ticket || !confirm(`Excluir ${ticket.name}?`)) return;
      try {
        await api(`/api/ticket-types/${encodeURIComponent(ticket.id)}`, { method: "DELETE" });
        state.selectedTicketId = "";
        removeAdminCollectionItem("ticketTypes", ticket.id);
        renderTickets();
        showToast("Ingresso excluído.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { renderTickets, renderIssuedTicketFilters, filteredIssuedTickets, renderIssuedTickets, changeIssuedTicketsPage, showSessionTickets, selectTicket, newTicket, fillTicketForm,
      saveTicket: (event) => once("ticket-save", () => saveTicket(event), event),
      deleteTicket: () => once("ticket-delete", () => deleteTicket()) };
  }

  const api = Object.freeze({ createTicketCatalogView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.ticketCatalogView = api; }
})(globalThis);
