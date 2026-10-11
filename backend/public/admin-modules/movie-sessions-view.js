((root) => {
  function createMovieSessionsView({ state, $, currentMovie, escapeHtml, globalSessionStatusLabel,
    money, sessionTicketTypes, trashIcon }) {
    function renderSessions(sessions) {
      if (!sessions.length) {
        $("sessionsList").innerHTML = `
          <div class="empty-state">
            <strong>Nenhuma sessão cadastrada</strong>
            <span>O filme está salvo normalmente. Adicione um horário apenas quando a programação estiver definida.</span>
            <button class="ghost-button" type="button" data-admin-command="open-session-editor">${$("movieId").value ? "Adicionar primeira sessão" : "Salvar rascunho e adicionar sessão"}</button>
          </div>
        `;
        return;
      }

      const sortedSessions = [...sessions].sort((a, b) => {
        const byDate = String(a.date || "9999-12-31").localeCompare(String(b.date || "9999-12-31"));
        if (byDate) return byDate;
        const byTime = String(a.time || "23:59").localeCompare(String(b.time || "23:59"));
        return byTime || String(a.id || "").localeCompare(String(b.id || ""));
      });
      const pageSize = state.movieSessionsPageSize || 5;
      const totalPages = Math.max(1, Math.ceil(sortedSessions.length / pageSize));
      state.movieSessionsPage = Math.min(Math.max(1, state.movieSessionsPage || 1), totalPages);
      const start = (state.movieSessionsPage - 1) * pageSize;
      const pageItems = sortedSessions.slice(start, start + pageSize);

      const pagerMarkup = `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, sortedSessions.length)}</strong> de <strong>${sortedSessions.length}</strong> sessão(ões)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.movieSessionsPage <= 1 ? "disabled" : ""} data-static-pager="movie-sessions" data-page-delta="-1">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.movieSessionsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.movieSessionsPage >= totalPages ? "disabled" : ""} data-static-pager="movie-sessions" data-page-delta="1">Próxima →</button>
          </div>
        </div>
      `;

      $("sessionsList").innerHTML = `
        ${pagerMarkup}
        <div class="sessions-list">
          ${pageItems.map((session) => {
            const linkedTickets = (state.content?.tickets || []).filter((ticket) => ticket.sessionId === session.id);
            const sold = linkedTickets.filter((ticket) => ["active", "used"].includes(ticket.status)).length;
            const capacity = Number(session.capacity || linkedTickets[0]?.sessionCapacity || 0);
            const allowedTypes = sessionTicketTypes(session);
            const ticketTypeSummary = allowedTypes.length
              ? allowedTypes.map((ticketType) => `${ticketType.name} ${money(ticketType.price)}`).join(" • ")
              : "Sem ingressos liberados";
            return `
              <div class="session-row">
                <div class="session-row-primary">
                  <time>${escapeHtml(session.time || "--:--")}</time>
                  <span>${escapeHtml(globalSessionStatusLabel(session.status))}</span>
                </div>
                <span title="${escapeHtml(`${session.date ? `${new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} • ` : ""}${session.format || "Formato não informado"} • ${session.room || "Sala não informada"}`)}">${session.date ? `${escapeHtml(new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }))} • ` : ""}${escapeHtml(session.format)} • ${escapeHtml(session.room)}</span>
                <span title="${escapeHtml(ticketTypeSummary)}">${escapeHtml(ticketTypeSummary)}${capacity ? ` • ${sold}/${capacity} vendidos` : linkedTickets.length ? ` • ${linkedTickets.length} ingresso(s)` : ""}</span>
                <div class="session-row-actions">
                  <button class="ghost-button" type="button" data-admin-session-action="tickets" data-admin-session-id="${escapeHtml(session.id)}">Ingressos</button>
                  <button class="ghost-button" type="button" data-admin-session-action="edit" data-admin-session-id="${escapeHtml(session.id)}">Editar</button>
                  <button class="icon-button danger-icon" type="button" data-admin-session-action="remove" data-admin-session-id="${escapeHtml(session.id)}" aria-label="Excluir sessão">${trashIcon}</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function changeMovieSessionsPage(delta) {
      const sessions = currentMovie()?.sessions || [];
      const pageSize = state.movieSessionsPageSize || 5;
      const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
      state.movieSessionsPage = Math.min(Math.max(1, (state.movieSessionsPage || 1) + delta), totalPages);
      renderSessions(sessions);
    }

    return { renderSessions, changeMovieSessionsPage };
  }

  const api = Object.freeze({ createMovieSessionsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.movieSessionsView = api; }
})(globalThis);
