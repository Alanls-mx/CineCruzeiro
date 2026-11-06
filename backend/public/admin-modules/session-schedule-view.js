((root) => {
  function createSessionScheduleView({ state, $, adminAssetUrl, currentMovie, escapeHtml, money, openSessionSeatMap, renderAdminListPager }) {
    function adminTodayKey() {
      return state.content?.calendar?.today || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    }

    function globalSessionRoomKey(session = {}) {
      if (session.roomId) return `id:${session.roomId}`;
      const label = String(session.room || "").trim().toLocaleLowerCase("pt-BR");
      const room = (state.content?.rooms || []).find((candidate) => {
        const name = String(candidate.name || "").toLocaleLowerCase("pt-BR");
        return label === name || label.startsWith(`${name} (`);
      });
      return room ? `id:${room.id}` : `label:${label || "sem-sala"}`;
    }

    function globalSessionDuration(movie = {}) {
      const raw = String(movie.duration || "").trim().toLowerCase();
      const hours = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*h/)?.[1]?.replace(",", ".") || 0);
      const minutes = Number(raw.match(/(\d+)\s*(?:m|min)/)?.[1] || raw.match(/h\s*(\d+)\s*$/)?.[1] || 0);
      if (hours || minutes) return Math.max(1, Math.round(hours * 60 + minutes));
      const numeric = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
      return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 100;
    }

    function sessionTimeMinutes(value = "") {
      const match = String(value).match(/^(\d{2}):(\d{2})$/);
      if (!match) return Number.NaN;
      return Number(match[1]) * 60 + Number(match[2]);
    }

    function minutesAsSessionTime(value) {
      const hours = String(Math.floor(value / 60)).padStart(2, "0");
      const minutes = String(value % 60).padStart(2, "0");
      return `${hours}:${minutes}`;
    }

    function suggestedSessionSchedule() {
      const date = String($("sessionDate")?.value || "").slice(0, 10);
      const room = String($("sessionRoom")?.value || "").trim();
      const movie = currentMovie();
      if (!movie || !date || !room) return null;

      const duration = globalSessionDuration({ ...movie, duration: $("movieDuration")?.value || movie.duration });
      const selectedRoomId = $("sessionRoom")?.selectedOptions[0]?.dataset.roomId;
      const selectedRoom = (state.content?.rooms || []).find((item) => item.id === selectedRoomId);
      const turnaround = Number(selectedRoom?.cleanupMinutes ?? 20);
      const roomKey = globalSessionRoomKey({ room, roomId: selectedRoomId });
      const dayStart = globalSessionTime({ date, time: "00:00" });
      const occupied = globalSessionEntries()
        .filter((entry) => entry.session.id !== state.editingSessionId
          && entry.roomKey === roomKey
          && !["cancelled", "hidden", "archived"].includes(String(entry.session.status || "").toLowerCase()))
        .map((entry) => ({
          start: (entry.startsAt - dayStart) / 60000,
          end: (entry.endsAt - dayStart) / 60000
        }))
        .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end));

      const candidates = [];
      for (let minute = 19 * 60; minute <= (24 * 60) - duration; minute += 5) candidates.push(minute);
      for (let minute = 14 * 60; minute < 19 * 60 && minute <= (24 * 60) - duration; minute += 5) candidates.push(minute);
      const minimumStart = date === adminTodayKey()
        ? sessionTimeMinutes(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())) + 45
        : 0;
      const suggested = candidates.find((start) => start >= minimumStart && !occupied.some((slot) => (
        start < slot.end + turnaround && start + duration + turnaround > slot.start
      )));
      return {
        date,
        time: Number.isFinite(suggested) ? minutesAsSessionTime(suggested) : "",
        duration,
        turnaround
      };
    }

    function updateSessionScheduleSuggestion({ apply = false } = {}) {
      const target = $("sessionScheduleSuggestion");
      const useButton = $("sessionUseSuggestedTime");
      if (!target) return;
      if (state.editingSessionId) {
        const roomId = $("sessionRoom")?.selectedOptions[0]?.dataset.roomId;
        const room = (state.content?.rooms || []).find((item) => item.id === roomId);
        const cleanupMinutes = Number(room?.cleanupMinutes ?? 20);
        target.textContent = `O horário existente será mantido até que você o altere. A sala exige ${cleanupMinutes} min de limpeza entre sessões.`;
        useButton.hidden = true;
        return;
      }
      const suggestion = suggestedSessionSchedule();
      if (!suggestion) {
        target.textContent = "Escolha a data e a sala para calcular um horário livre.";
        useButton.hidden = true;
        return;
      }
      if (!suggestion.time) {
        target.textContent = "Não foi encontrada uma janela livre entre 14:00 e 00:00. Consulte a agenda global de sessões.";
        useButton.hidden = true;
        return;
      }
      if (apply && !state.sessionTimeManuallyEdited) $("sessionTime").value = suggestion.time;
      const dateLabel = new Date(`${suggestion.date}T12:00:00`).toLocaleDateString("pt-BR");
      target.textContent = `Horário livre sugerido: ${suggestion.time} em ${dateLabel}, considerando ${suggestion.duration} min de filme e ${suggestion.turnaround} min de intervalo na sala.`;
      useButton.hidden = $("sessionTime").value === suggestion.time;
      useButton.dataset.suggestedTime = suggestion.time;
    }

    function globalSessionTime(session = {}) {
      const date = String(session.date || "").slice(0, 10);
      const time = String(session.time || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return Number.MAX_SAFE_INTEGER;
      const parsed = new Date(`${date}T${time}:00-03:00`).getTime();
      return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    }

    function globalSessionEntries() {
      return (state.content?.movies || []).flatMap((movie) => (movie.sessions || []).map((session) => ({
        movie,
        session,
        startsAt: globalSessionTime(session),
        endsAt: globalSessionTime(session) + globalSessionDuration(movie) * 60 * 1000,
        roomKey: globalSessionRoomKey(session)
      }))).sort((a, b) => a.startsAt - b.startsAt || a.roomKey.localeCompare(b.roomKey) || String(a.movie.title || "").localeCompare(String(b.movie.title || "")));
    }

    function globalSessionConflictMap(entries) {
      const conflicts = new Map();
      entries.forEach((entry, index) => {
        if (["cancelled", "hidden", "archived"].includes(String(entry.session.status || "").toLowerCase())) return;
        for (let cursor = index + 1; cursor < entries.length; cursor += 1) {
          const candidate = entries[cursor];
          const room = (state.content?.rooms || []).find((item) => `id:${item.id}` === entry.roomKey);
          const gapMs = Number(room?.cleanupMinutes ?? 20) * 60000;
          if (candidate.startsAt >= entry.endsAt + gapMs) break;
          if (candidate.roomKey !== entry.roomKey || ["cancelled", "hidden", "archived"].includes(String(candidate.session.status || "").toLowerCase())) continue;
          if (entry.startsAt < candidate.endsAt + gapMs && candidate.startsAt < entry.endsAt + gapMs) {
            conflicts.set(entry.session.id, [...(conflicts.get(entry.session.id) || []), candidate]);
            conflicts.set(candidate.session.id, [...(conflicts.get(candidate.session.id) || []), entry]);
          }
        }
      });
      return conflicts;
    }

    function globalSessionStatusLabel(status = "") {
      return { available: "Disponível", filling_fast: "Últimos lugares", sold_out: "Esgotada", cancelled: "Cancelada", hidden: "Oculta", archived: "Arquivada" }[String(status || "available").toLowerCase()] || "Disponível";
    }

    function renderGlobalSessionOptions() {
      const rooms = state.content?.rooms || [];
      const movies = [...(state.content?.movies || [])].sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      const creatableMovies = movies.filter((movie) => movie.workflowStatus !== "archived");
      $("globalSessionsRoom").innerHTML = `<option value="">Todas as salas</option>${rooms.map((room) => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`).join("")}`;
      $("globalSessionsMovie").innerHTML = `<option value="">Todos os filmes</option>${movies.map((movie) => `<option value="${escapeHtml(movie.id)}">${escapeHtml(movie.title)}</option>`).join("")}`;
      $("globalSessionCreateMovie").innerHTML = creatableMovies.length
        ? creatableMovies.map((movie) => `<option value="${escapeHtml(movie.id)}">${escapeHtml(movie.title)}</option>`).join("")
        : `<option value="">Cadastre um filme primeiro</option>`;
      $("globalSessionCreateButton").disabled = !creatableMovies.length;
      $("globalSessionsRoom").value = state.globalSessionFilters.roomId;
      $("globalSessionsMovie").value = state.globalSessionFilters.movieId;
      $("globalSessionsStatus").value = state.globalSessionFilters.status;
      $("globalSessionsConflictsOnly").checked = state.globalSessionFilters.conflictsOnly;
    }

    function renderGlobalSessions() {
      if (!$("globalSessionsList")) return;
      if (!state.globalSessionFilters.from) state.globalSessionFilters.from = adminTodayKey();
      renderGlobalSessionOptions();
      $("globalSessionsFrom").value = state.globalSessionFilters.from;
      $("globalSessionsTo").value = state.globalSessionFilters.to;

      const entries = globalSessionEntries();
      const conflicts = globalSessionConflictMap(entries);
      const filters = state.globalSessionFilters;
      const filtered = entries.filter((entry) => {
        const status = String(entry.session.status || "available").toLowerCase();
        return (!filters.from || entry.session.date >= filters.from)
          && (!filters.to || entry.session.date <= filters.to)
          && (!filters.roomId || entry.roomKey === `id:${filters.roomId}`)
          && (!filters.movieId || entry.movie.id === filters.movieId)
          && (!filters.status || (filters.status === "active" ? !["cancelled", "hidden", "archived"].includes(status) : status === filters.status))
          && (!filters.conflictsOnly || conflicts.has(entry.session.id));
      });
      const conflictCount = filtered.filter((entry) => conflicts.has(entry.session.id)).length;
      const pageSize = state.globalSessionsPageSize || 12;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      state.globalSessionsPage = Math.min(Math.max(1, state.globalSessionsPage || 1), totalPages);
      const start = (state.globalSessionsPage - 1) * pageSize;
      const pageItems = filtered.slice(start, start + pageSize);
      const roomCount = new Set(filtered.map((entry) => entry.roomKey)).size;
      $("globalSessionsSummary").innerHTML = `
        <div><span>Sessões encontradas</span><strong>${filtered.length}</strong></div>
        <div><span>Salas na agenda</span><strong>${roomCount}</strong></div>
        <div class="${conflictCount ? "has-conflict" : "is-clear"}"><span>Sessões em conflito</span><strong>${conflictCount}</strong></div>
        <p>${conflictCount ? "Há horários sobrepostos. Abra as sessões sinalizadas para corrigir a programação." : "Nenhuma sobreposição encontrada nos filtros atuais."}</p>`;

      if (!pageItems.length) {
        $("globalSessionsList").innerHTML = `<div class="empty-state"><strong>Nenhuma sessão encontrada</strong><span>Ajuste o período ou os filtros para consultar outra parte da programação.</span></div>`;
        return;
      }
      let lastDate = "";
      $("globalSessionsList").innerHTML = pageItems.map((entry) => {
        const dateHeading = entry.session.date !== lastDate
          ? `<div class="global-session-date"><strong>${new Date(`${entry.session.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong><span>${entry.session.date}</span></div>`
          : "";
        lastDate = entry.session.date;
        const related = conflicts.get(entry.session.id) || [];
        const conflictCopy = related.length ? `Conflita com ${related.map((item) => `${item.movie.title} às ${item.session.time}`).join(", ")}` : "";
        return `${dateHeading}
          <article class="global-session-row ${related.length ? "has-conflict" : ""}">
            <time datetime="${escapeHtml(`${entry.session.date}T${entry.session.time}`)}">${escapeHtml(entry.session.time || "--:--")}</time>
            <div class="global-session-movie">
              <span class="global-session-poster">${entry.movie.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(entry.movie.posterUrl))}" alt="" />` : escapeHtml(entry.movie.rating || "L")}</span>
              <span><strong>${escapeHtml(entry.movie.title || "Filme sem título")}</strong><small>${escapeHtml(entry.session.format || "Formato não informado")}</small></span>
            </div>
            <div class="global-session-room"><strong>${escapeHtml(entry.session.room || "Sala não informada")}</strong><small>${escapeHtml(globalSessionStatusLabel(entry.session.status))}</small></div>
            <div class="global-session-alert">${related.length ? `<strong>Conflito de horário</strong><small>${escapeHtml(conflictCopy)}</small>` : `<span>Horário livre</span>`}</div>
            <div class="global-session-actions">
              <button class="ghost-button" type="button" data-session-seat-map="${escapeHtml(entry.session.id)}">Mapa</button>
              <button class="ghost-button" type="button" data-admin-session-action="global-edit" data-admin-movie-id="${escapeHtml(entry.movie.id)}" data-admin-session-id="${escapeHtml(entry.session.id)}">Editar</button>
            </div>
          </article>`;
      }).join("") + renderAdminListPager("globalSessions", { page: state.globalSessionsPage, pageSize, totalPages, start, pageItems, total: filtered.length }, "sessão(ões)");
      $("globalSessionsList").querySelectorAll("[data-session-seat-map]").forEach((button) => {
        button.addEventListener("click", () => void openSessionSeatMap(button.dataset.sessionSeatMap));
      });
    }

    function roomForGlobalSession(session = {}) {
      if (session.roomId) {
        const byId = (state.content?.rooms || []).find((room) => room.id === session.roomId);
        if (byId) return byId;
      }
      const label = String(session.room || "").toLocaleLowerCase("pt-BR");
      return (state.content?.rooms || []).find((room) => {
        const name = String(room.name || "").toLocaleLowerCase("pt-BR");
        return name && (label === name || label.startsWith(`${name} (`));
      }) || null;
    }

    function sessionTicketRevenue(entry, tickets) {
      const orderIds = new Set(tickets.map((ticket) => ticket.orderId).filter(Boolean));
      return (state.content?.orders || []).filter((order) => orderIds.has(order.id) && order.status === "paid").reduce((total, order) => {
        const clubTicketDiscount = Number(order.clubBenefits?.ticketDiscount || 0);
        const couponTicketDiscount = Number(order.couponTicketDiscount || 0);
        return total + Math.max(0, Number(order.serviceSubtotal || 0) - Number(order.clubCreditsApplied || 0) - clubTicketDiscount - couponTicketDiscount);
      }, 0);
    }

    function renderOngoingSessions() {
      const target = $("ongoingSessionsList");
      if (!target) return;
      const now = Date.now();
      const entries = globalSessionEntries().filter((entry) =>
        entry.startsAt <= now
        && entry.endsAt > now
        && !["cancelled", "hidden", "archived"].includes(String(entry.session.status || "").toLowerCase())
      );
      if (!entries.length) {
        target.innerHTML = `<div class="empty-state"><strong>Nenhuma sessão em andamento</strong><span>Quando um filme estiver dentro do horário programado, a operação da sala aparecerá aqui.</span></div>`;
        return;
      }
      if (!entries.some((entry) => entry.session.id === state.selectedOngoingSessionId)) state.selectedOngoingSessionId = entries[0].session.id;
      const selected = entries.find((entry) => entry.session.id === state.selectedOngoingSessionId) || entries[0];
      const tickets = (state.content?.tickets || []).filter((ticket) => ticket.sessionId === selected.session.id && !["cancelled", "refunded", "pending_payment"].includes(String(ticket.status || "")));
      const orders = new Set(tickets.map((ticket) => ticket.orderId).filter(Boolean));
      const room = roomForGlobalSession(selected.session);
      target.innerHTML = `
        <div class="ongoing-session-tabs">
          ${entries.map((entry) => `<button class="${entry.session.id === selected.session.id ? "active" : ""}" type="button" data-ongoing-session="${escapeHtml(entry.session.id)}">
            <strong>${escapeHtml(entry.movie.title || "Filme")}</strong><span>${escapeHtml(entry.session.time || "--:--")} · ${escapeHtml(entry.session.room || "Sala")}</span>
          </button>`).join("")}
        </div>
        <article class="ongoing-session-detail">
          <div class="ongoing-session-summary">
            <div>
              <span class="mini-label">Em andamento</span>
              <h2>${escapeHtml(selected.movie.title || "Filme sem título")}</h2>
              <p>${escapeHtml(selected.session.room || room?.name || "Sala não informada")} · ${escapeHtml(selected.session.format || "Formato não informado")}</p>
            </div>
            <div class="ongoing-session-times"><span>Início<strong>${escapeHtml(selected.session.time || "--:--")}</strong></span><span>Término<strong>${new Date(selected.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></span></div>
          </div>
          <div class="ongoing-session-kpis">
            <div><span>Ingressos emitidos</span><strong>${tickets.length}</strong></div>
            <div><span>Pedidos pagos</span><strong>${orders.size}</strong></div>
            <div><span>Receita de ingressos</span><strong>${money(sessionTicketRevenue(selected, tickets))}</strong></div>
          </div>
          <div class="ongoing-session-map-wrap">
            <div><span class="mini-label">Mapa da sala</span><p>Consulte a ocupação atual e os detalhes de cada poltrona.</p></div>
            <button class="ghost-button" type="button" data-session-seat-map="${escapeHtml(selected.session.id)}">Abrir mapa</button>
          </div>
        </article>`;
      target.querySelectorAll("[data-ongoing-session]").forEach((button) => {
        button.addEventListener("click", () => {
          state.selectedOngoingSessionId = button.dataset.ongoingSession;
          renderOngoingSessions();
        });
      });
      target.querySelector("[data-session-seat-map]")?.addEventListener("click", (event) => {
        void openSessionSeatMap(event.currentTarget.dataset.sessionSeatMap);
      });
    }

    return { adminTodayKey, globalSessionRoomKey, globalSessionDuration, sessionTimeMinutes, minutesAsSessionTime, suggestedSessionSchedule, updateSessionScheduleSuggestion, globalSessionTime, globalSessionEntries, globalSessionConflictMap, globalSessionStatusLabel, renderGlobalSessionOptions, renderGlobalSessions, roomForGlobalSession, sessionTicketRevenue, renderOngoingSessions };
  }

  const api = Object.freeze({ createSessionScheduleView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.sessionScheduleView = api; }
})(globalThis);
