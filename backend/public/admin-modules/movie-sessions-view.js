((root) => {
  function createMovieSessionsView({ state, $, currentMovie, escapeHtml, globalSessionStatusLabel,
    money, sessionTicketTypes, trashIcon, showToast, ticketStatusText, saveMovieWithAction, adminTodayKey, setMovieWizardStep, updateSessionScheduleSuggestion, applySessionMutation, renderMovies, showSuccess, api, setDisabled, confirm, Option, document }) {
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

    function renderSessionTicketTypeOptions(selectedIds = []) {
      const target = $("sessionTicketTypes");
      if (!target) return;
      const activeTypes = (state.content?.ticketTypes || []).filter((ticketType) => ticketType.active !== false);
      const selected = new Set(selectedIds.length ? selectedIds : activeTypes.map((ticketType) => ticketType.id));
      target.innerHTML = activeTypes.length
        ? activeTypes.map((ticketType) => `
          <label class="session-ticket-type-option">
            <input type="checkbox" value="${escapeHtml(ticketType.id)}" ${selected.has(ticketType.id) ? "checked" : ""} />
            <span class="session-ticket-type-copy">
              <strong>${escapeHtml(ticketType.name)}</strong>
              <small>${ticketType.description ? escapeHtml(ticketType.description) : "Tipo de ingresso ativo"}</small>
            </span>
            <span class="session-ticket-type-price">${money(ticketType.price)}</span>
          </label>
        `).join("")
        : `<div class="empty-state compact"><strong>Nenhum tipo de ingresso ativo</strong><span>Cadastre e ative os tipos na aba Ingressos antes de criar sessões.</span></div>`;
    }

    function renderRoomOptions() {
      const rooms = (state.content?.rooms || []).filter((room) => room.active !== false && (!room.status || room.status === "active"));
      $("sessionRoom").innerHTML = rooms
        .map((room) => `<option value="${escapeHtml(`${room.name} (${room.technology || "Sala"})`)}" data-room-id="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`)
        .join("") || `<option value="">Nenhuma sala ativa</option>`;
    }

    function closeSessionEditor() {
      state.editingSessionId = "";
      if ($("sessionEditor")) $("sessionEditor").hidden = true;
      if ($("sessionId")) $("sessionId").value = "";
      if ($("sessionLinkedTickets")) $("sessionLinkedTickets").hidden = true;
    }

    function syncSessionCreationMode() {
      const editing = Boolean(state.editingSessionId);
      const range = !editing && $("sessionCreationMode")?.value === "range";
      if ($("sessionCreationModeRow")) $("sessionCreationModeRow").hidden = editing;
      if ($("sessionDateEndField")) $("sessionDateEndField").hidden = !range;
      if ($("sessionWeekdays")) $("sessionWeekdays").hidden = !range;
      if ($("sessionDateLabel")) $("sessionDateLabel").textContent = range ? "De" : "Data";
      if ($("saveSessionButton")) $("saveSessionButton").textContent = editing ? "Salvar alterações" : range ? "Criar sessões" : "Adicionar sessão";
      if (range && !$("sessionDateEnd").value) $("sessionDateEnd").value = $("sessionDate").value;
    }

    function renderSessionLinkedTickets(sessionId) {
      const target = $("sessionLinkedTickets");
      if (!target) return;
      if (!sessionId) {
        target.hidden = true;
        target.innerHTML = "";
        return;
      }
      const linkedTickets = (state.content?.tickets || []).filter((ticket) => ticket.sessionId === sessionId);
      target.hidden = false;
      target.innerHTML = linkedTickets.length
        ? `
          <div class="session-linked-head">
            <strong>${linkedTickets.length} ingresso(s) vinculado(s)</strong>
            <button class="text-button" type="button" data-admin-session-action="tickets" data-admin-session-id="${escapeHtml(sessionId)}">Ver na aba Ingressos</button>
          </div>
          <div class="session-linked-list">
            ${linkedTickets.slice(0, 6).map((ticket) => `
              <span>${escapeHtml(ticket.displayCode || ticket.code || ticket.id)} • ${escapeHtml(ticketStatusText(ticket.status))} • ${escapeHtml(ticket.customerName || ticket.customerEmail || "Cliente")}</span>
            `).join("")}
          </div>
        `
        : `
          <div class="session-linked-head">
            <strong>Nenhum ingresso vinculado</strong>
            <span>Novas vendas desta sessão aparecerão aqui automaticamente.</span>
          </div>
        `;
    }

    async function openSessionEditor(sessionId = "") {
      if (!sessionId && !$("movieDuration").value.trim()) {
        showToast("Informe a duração do filme antes de criar sessões.", "error");
        setMovieWizardStep(1);
        $("movieDuration").focus();
        return;
      }
      let movieId = $("movieId").value || state.selectedMovieId;
      if (!movieId) {
        const saved = await saveMovieWithAction("draft", { quiet: true });
        if (!saved) return;
        movieId = saved.id;
        setMovieWizardStep(3);
      }
      const session = (state.movieDraftSessions || []).find((item) => item.id === sessionId);
      state.editingSessionId = session?.id || "";
      state.editingSessionOriginalDate = session?.date || "";
      state.editingSessionDateChanged = false;
      state.sessionTimeManuallyEdited = Boolean(session);
      $("sessionId").value = session?.id || "";
      const releaseDate = String($("movieReleaseDate").value || currentMovie()?.releaseDate || "").slice(0, 10);
      $("sessionDate").value = session?.date || (releaseDate >= adminTodayKey() ? releaseDate : adminTodayKey());
      $("sessionTime").value = session?.time || "";
      $("sessionFormat").value = session?.format || "2D Dublado";
      renderRoomOptions();
      if (session?.room) {
        const option = [...$("sessionRoom").options].find((item) => item.value === session.room || (session.roomId && item.dataset.roomId === session.roomId));
        if (option) $("sessionRoom").value = option.value;
        else {
          const legacy = new Option(`${session.room} (indisponível para novas sessões)`, session.room, true, true);
          legacy.dataset.roomId = session.roomId || "";
          $("sessionRoom").add(legacy);
        }
      }
      renderSessionTicketTypeOptions(Array.isArray(session?.ticketTypeIds) ? session.ticketTypeIds : []);
      $("sessionStatus").value = session?.status || "available";
      $("sessionCreationMode").value = "single";
      $("sessionDateEnd").value = session?.date || "";
      $("sessionEditorTitle").textContent = session ? "Editar sessão" : "Nova sessão";
      $("sessionEditor").hidden = false;
      syncSessionCreationMode();
      updateSessionScheduleSuggestion({ apply: !session });
      renderSessionLinkedTickets(session?.id || "");
      $("sessionDate").focus();
    }

    async function saveSession() {
      if (state.savingSession) return;
      const movieId = $("movieId").value || state.selectedMovieId;
      if (!movieId) {
        showToast("Salve o filme antes de adicionar uma sessão.", "error");
        return;
      }
      if (!$("sessionDate").value || !$("sessionTime").value || !$("sessionRoom").value || !$("sessionFormat").value) {
        showToast("Preencha data, horário, sala e formato da sessão.", "error");
        return;
      }
      const ticketTypeIds = [...document.querySelectorAll("#sessionTicketTypes input:checked")].map((input) => input.value);
      if (!ticketTypeIds.length) {
        showToast("Selecione pelo menos um tipo de ingresso para esta sessão.", "error");
        return;
      }
    
      const sessionId = state.editingSessionId;
      const range = !sessionId && $("sessionCreationMode").value === "range";
      if (range && !document.querySelector("#sessionWeekdays input:checked")) {
        showToast("Selecione pelo menos um dia da semana.", "error");
        return;
      }
      if (range && (!$('sessionDateEnd').value || $('sessionDateEnd').value < $('sessionDate').value)) {
        showToast("A data final precisa ser igual ou posterior à data inicial.", "error");
        return;
      }
      const payload = {
        date: $("sessionDate").value,
        dateChanged: !sessionId || state.editingSessionDateChanged,
        ...(range ? {
          dateFrom: $("sessionDate").value,
          dateTo: $("sessionDateEnd").value,
          times: [$("sessionTime").value],
          weekdays: [...document.querySelectorAll("#sessionWeekdays input:checked")].map((input) => Number(input.value))
        } : {}),
        time: $("sessionTime").value,
        format: $("sessionFormat").value,
        room: $("sessionRoom").value,
        roomId: $("sessionRoom").selectedOptions[0]?.dataset.roomId || "",
        ticketTypeIds,
        status: $("sessionStatus").value
      };
    
      if (sessionId) {
        const previous = (state.movieDraftSessions || []).find((item) => item.id === sessionId) || {};
        const sensitiveChange = ["date", "time", "room", "format"].some((field) => String(previous[field] || "") !== String(payload[field] || ""))
          || payload.status === "cancelled";
        const hasHistory = (state.content?.tickets || []).some((ticket) => ticket.sessionId === sessionId)
          || (state.content?.orders || []).some((order) => order.sessionId === sessionId);
        if (sensitiveChange && hasHistory) {
          if (!confirm("Esta sessão possui vendas. Confirmar a alteração pode mudar os dados dos ingressos já emitidos e, em caso de cancelamento, exigir reembolso.")) return;
          payload.confirmSalesImpact = true;
        }
      }
    
      try {
        state.savingSession = true;
        setDisabled("saveSessionButton", true);
        const endpoint = `/api/movies/${encodeURIComponent(movieId)}/sessions${sessionId ? `/${encodeURIComponent(sessionId)}` : ""}`;
        const persistSession = () => api(endpoint, { method: sessionId ? "PUT" : "POST", body: JSON.stringify(payload) });
        let result;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            result = await persistSession();
            break;
          } catch (error) {
            if (error.code === "SESSION_CHANGE_CONFIRMATION_REQUIRED" && !payload.confirmSalesImpact) {
              if (!confirm(error.message)) return;
              payload.confirmSalesImpact = true;
            } else if (error.code === "SESSION_ROOM_CONFLICT" && !payload.confirmRoomConflict) {
              const conflicts = error.payload?.error?.conflicts || [];
              const details = [...new Set(conflicts.map((conflict) => `${conflict.movieTitle} em ${new Date(`${conflict.date}T12:00:00`).toLocaleDateString("pt-BR")} às ${conflict.time}`))].join("\n");
              if (!confirm(`Conflito de sala detectado:\n\n${details}\n\nDeseja salvar mesmo assim?`)) return;
              payload.confirmRoomConflict = true;
            } else throw error;
          }
        }
        if (!result) throw new Error("Não foi possível confirmar a sessão. Revise a programação.");
        closeSessionEditor();
        if (range) (result.created || []).forEach((session) => applySessionMutation(movieId, session));
        else applySessionMutation(movieId, result);
        renderMovies({ preserveForm: true });
        setMovieWizardStep(3);
        if (range) {
          showSuccess("Programação criada", `${Number(result.totalCreated || 0)} sessão(ões) adicionada(s)${result.totalSkipped ? ` e ${result.totalSkipped} duplicada(s) ignorada(s)` : ""}.`);
        } else {
          const savedDate = result.date ? new Date(`${result.date}T12:00:00`).toLocaleDateString("pt-BR") : payload.date;
          showSuccess(sessionId ? "Sessão atualizada" : "Sessão adicionada", `${savedDate} às ${result.time || payload.time}.`);
        }
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        state.savingSession = false;
        setDisabled("saveSessionButton", false);
      }
    }

    async function removeSession(sessionId) {
      const movieId = $("movieId").value || state.selectedMovieId;
      const session = (state.movieDraftSessions || []).find((item) => item.id === sessionId);
      if (!movieId || !session || !confirm(`Excluir a sessão de ${session.time}?`)) return;
      try {
        await api(`/api/movies/${encodeURIComponent(movieId)}/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
        closeSessionEditor();
        applySessionMutation(movieId, session, true);
        renderMovies({ preserveForm: true });
        setMovieWizardStep(3);
        showToast("Sessão excluída.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { renderSessions, changeMovieSessionsPage, renderSessionTicketTypeOptions, renderRoomOptions, closeSessionEditor, syncSessionCreationMode, renderSessionLinkedTickets, openSessionEditor, saveSession, removeSession };
  }

  const api = Object.freeze({ createMovieSessionsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.movieSessionsView = api; }
})(globalThis);
