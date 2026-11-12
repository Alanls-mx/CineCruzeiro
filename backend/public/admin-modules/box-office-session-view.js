((root) => {
  function createBoxOfficeSessionView({ state, $, escapeHtml, money, sessionTicketTypes, renderSaleMode, renderManualSaleItems, loadManualSeatMap, closeManualSeatRealtime, updateManualTotal, reconcileManualSeatSelection }) {
    function manualSessionStartsAt(session = {}) {
      const date = String(session.date || "").slice(0, 10);
      const time = /^\d{2}:\d{2}$/.test(String(session.time || "")) ? session.time : "00:00";
      const parsed = new Date(`${date}T${time}:00-03:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function manualSessionDateIso(value = "") {
      const text = String(value || "").trim();
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const parts = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : null;
      if (!parts) return "";
      const [year, month, day] = parts.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 12));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        : "";
    }

    function manualSessionDateDisplay(value = "") {
      const iso = manualSessionDateIso(value);
      if (!iso) return String(value || "");
      const [year, month, day] = iso.split("-");
      return `${day}/${month}/${year}`;
    }

    function maskManualSessionDate(value = "") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
      return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
    }

    function isManualSessionSellable(session = {}, now = new Date()) {
      if (!session || ["sold_out", "cancelled", "hidden", "archived"].includes(String(session.status || "").trim().toLowerCase())) return false;
      const startsAt = manualSessionStartsAt(session);
      // Keep the box office aligned with sessionScheduleReadService.isSessionSellable.
      return startsAt ? startsAt.getTime() - 24 * 60 * 60 * 1000 <= now.getTime()
        && startsAt.getTime() + 10 * 60 * 1000 > now.getTime() : false;
    }

    function manualSessionsForDate(movie, date) {
      return (movie?.sessions || [])
        .filter((session) => session.date === date && isManualSessionSellable(session))
        .sort((a, b) => (manualSessionStartsAt(a)?.getTime() || 0) - (manualSessionStartsAt(b)?.getTime() || 0));
    }

    function renderManualSaleOptions() {
      const movies = state.content?.movies || [];
      const movieSelect = $("manualMovieSelect");
      const dateInput = $("manualSessionDate");
      if (!movieSelect || !dateInput) return;

      // A content refresh may remove or close a session already placed in the basket.
      // Release its holds and prevent the stale draft from reaching the sale endpoint.
      state.manualSaleItems = state.manualSaleItems.filter((item) => {
        const movie = movies.find((candidate) => candidate.id === item.movieId);
        const session = (movie?.sessions || []).find((candidate) => candidate.id === item.sessionId);
        if (session && isManualSessionSellable(session)) return true;
        closeManualSeatRealtime(item.sessionId, true);
        return false;
      });

      const sellableSessions = movies.flatMap((movie) => (movie.sessions || []).filter((session) => isManualSessionSellable(session)));
      const availableDates = [...new Set(sellableSessions.map((session) => session.date).filter(Boolean))].sort();
      const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
      if (!dateInput.value) dateInput.value = manualSessionDateDisplay(availableDates[0] || today);
      const selectedDate = manualSessionDateIso(dateInput.value);

      const moviesForDate = movies.filter((movie) => manualSessionsForDate(movie, selectedDate).length);
      const selectedMovieId = moviesForDate.some((movie) => movie.id === movieSelect.value)
        ? movieSelect.value
        : moviesForDate[0]?.id || "";
      movieSelect.innerHTML = moviesForDate.length ? moviesForDate
        .map((movie) => `<option value="${movie.id}">${escapeHtml(movie.title)}</option>`)
        .join("") : `<option value="">Sem filmes nesta data</option>`;
      movieSelect.value = selectedMovieId;
      movieSelect.disabled = moviesForDate.length === 0;
      renderManualSessionOptions();
      renderSaleMode();
      renderManualSaleItems();
    }

    function renderManualSessionOptions() {
      const movieId = $("manualMovieSelect")?.value;
      const movie = (state.content?.movies || []).find((item) => item.id === movieId);
      const selectedDate = manualSessionDateIso($("manualSessionDate")?.value || "");
      const sessions = manualSessionsForDate(movie, selectedDate);
      const selectedSessionId = sessions.some((session) => session.id === $("manualSessionSelect")?.value)
        ? $("manualSessionSelect").value
        : sessions[0]?.id || "";
      $("manualSessionSelect").innerHTML = sessions.length
        ? sessions.map((session) => `<option value="${session.id}">${escapeHtml(session.time)} • ${escapeHtml(session.format)} • ${escapeHtml(session.room || "Sala")}</option>`).join("")
        : `<option value="">Sem sessões disponíveis</option>`;
      if (selectedSessionId) $("manualSessionSelect").value = selectedSessionId;
      $("manualSessionSelect").disabled = sessions.length === 0;
      $("manualAddMovieButton").disabled = sessions.length === 0;
      const availability = $("manualSessionAvailability");
      if (availability) {
        const formattedDate = selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR") : "a data selecionada";
        availability.textContent = sessions.length
          ? `${sessions.length} ${sessions.length === 1 ? "sessão disponível" : "sessões disponíveis"} em ${formattedDate}. Sessões fora do período de venda não são exibidas.`
          : `Nenhuma sessão aberta para venda em ${formattedDate}. ${state.content?.movies?.some((item) => (item.sessions || []).some((session) => isManualSessionSellable(session))) ? "Escolha outra data." : "Volte quando a venda de uma sessão começar."}`;
      }
      renderManualTicketTypes();
      void loadManualSeatMap();
      updateManualTotal();
    }

    function currentManualMovieSession() {
      const movie = (state.content?.movies || []).find((item) => item.id === $("manualMovieSelect").value);
      const session = manualSessionsForDate(movie, manualSessionDateIso($("manualSessionDate")?.value || ""))
        .find((item) => item.id === $("manualSessionSelect").value);
      return { movie, session };
    }

    function currentManualTicketTypes() {
      const { session } = currentManualMovieSession();
      return sessionTicketTypes(session || {});
    }

    function renderManualTicketTypes() {
      const target = $("manualTicketTypes");
      if (!target) return;
      const ticketTypes = currentManualTicketTypes();
      target.innerHTML = ticketTypes.length
        ? ticketTypes.map((ticketType, index) => `
          <div class="quantity-line">
            <span>${escapeHtml(ticketType.name)}</span>
            <strong>${money(ticketType.price)}</strong>
            <div class="stepper">
              <button type="button" data-manual-ticket-step="-1" data-ticket-type-id="${escapeHtml(ticketType.id)}" aria-label="Remover ${escapeHtml(ticketType.name)}">-</button>
              <input type="number" min="0" value="${index === 0 ? 1 : 0}" data-manual-ticket-quantity="${escapeHtml(ticketType.id)}" aria-label="Quantidade de ${escapeHtml(ticketType.name)}" />
              <button type="button" data-manual-ticket-step="1" data-ticket-type-id="${escapeHtml(ticketType.id)}" aria-label="Adicionar ${escapeHtml(ticketType.name)}">+</button>
            </div>
          </div>
        `).join("")
        : `<div class="empty-state compact"><strong>Sem ingressos disponíveis</strong><span>Edite a sessão e atribua pelo menos um tipo de ingresso.</span></div>`;
      target.querySelectorAll("[data-manual-ticket-step]").forEach((button) => button.addEventListener("click", () => {
        const input = [...target.querySelectorAll("[data-manual-ticket-quantity]")]
          .find((candidate) => candidate.dataset.manualTicketQuantity === button.dataset.ticketTypeId);
        if (!input) return;
        input.value = Math.max(0, Number(input.value || 0) + Number(button.dataset.manualTicketStep || 0));
        reconcileManualSeatSelection();
        updateManualTotal();
      }));
      target.querySelectorAll("[data-manual-ticket-quantity]").forEach((input) => input.addEventListener("input", () => {
        input.value = Math.max(0, Number(input.value || 0));
        reconcileManualSeatSelection();
        updateManualTotal();
      }));
    }

    return { manualSessionStartsAt, manualSessionDateIso, manualSessionDateDisplay, maskManualSessionDate, isManualSessionSellable, manualSessionsForDate, renderManualSaleOptions, renderManualSessionOptions, currentManualMovieSession, currentManualTicketTypes, renderManualTicketTypes };
  }
  const api = Object.freeze({ createBoxOfficeSessionView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficeSessionView = api; }
})(globalThis);
