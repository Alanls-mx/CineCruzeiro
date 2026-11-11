((root) => {
  function createTicketSessionChangeView({ $, api, closeOrderOverlay, escapeHtml, formatAdminSessionDateTime, loadContent, showToast }) {
    let ticketId = "";
    let sessions = [];
    let submitting = false;
    let requestVersion = 0;
    const overlay = () => $("ticketSessionChangeOverlay");
    const sessionSelect = () => $("ticketSessionChangeSession");
    const seatSelect = () => $("ticketSessionChangeSeat");

    function close() {
      if (submitting) return;
      overlay().hidden = true;
      requestVersion += 1;
      ticketId = "";
      sessions = [];
      $("ticketSessionChangeForm").reset();
    }

    async function loadSeats() {
      const version = ++requestVersion;
      const selected = sessionSelect().value;
      seatSelect().disabled = true;
      seatSelect().innerHTML = `<option value="">Consultando poltronas…</option>`;
      if (!selected || !ticketId) return;
      try {
        const result = await api(`/api/admin/tickets/${encodeURIComponent(ticketId)}/session-change?sessionId=${encodeURIComponent(selected)}`);
        if (version !== requestVersion || sessionSelect().value !== selected || overlay().hidden) return;
        const seats = result.seats || [];
        seatSelect().disabled = !result.seatSelectionEnabled || !seats.length;
        seatSelect().required = Boolean(result.seatSelectionEnabled);
        seatSelect().innerHTML = result.seatSelectionEnabled
          ? `<option value="">${seats.length ? "Selecione uma poltrona" : "Nenhuma poltrona disponível"}</option>${seats.map((seat) => `<option value="${escapeHtml(seat.id)}">${escapeHtml(seat.label)}</option>`).join("")}`
          : `<option value="">Lugar livre</option>`;
        $("ticketSessionChangeSubmit").disabled = result.seatSelectionEnabled && !seats.length;
      } catch (error) {
        seatSelect().innerHTML = `<option value="">Não foi possível consultar</option>`;
        $("ticketSessionChangeSubmit").disabled = true;
        showToast(error.message, "error");
      }
    }

    async function open(id) {
      const version = ++requestVersion;
      ticketId = id;
      closeOrderOverlay();
      overlay().hidden = false;
      $("ticketSessionChangeSummary").textContent = "Carregando ingresso e sessões…";
      $("ticketSessionChangeSubmit").disabled = true;
      try {
        const result = await api(`/api/admin/tickets/${encodeURIComponent(id)}/session-change`);
        if (ticketId !== id || version !== requestVersion || overlay().hidden) return;
        const ticket = result.ticket || {};
        sessions = result.sessions || [];
        $("ticketSessionChangeSummary").textContent = `${ticket.customerName || ticket.customerEmail || "Cliente"} · ${ticket.movieTitle || "Filme"} · ${formatAdminSessionDateTime(ticket.sessionDate, ticket.sessionTime)} · ${ticket.seat || "Lugar livre"}`;
        sessionSelect().innerHTML = `<option value="">Selecione outra sessão</option>${sessions.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(`${session.movieTitle} · ${formatAdminSessionDateTime(session.date, session.time)} · ${session.room}`)}</option>`).join("")}`;
        seatSelect().innerHTML = `<option value="">Selecione uma sessão primeiro</option>`;
        if (!sessions.length) $("ticketSessionChangeSummary").textContent += " · Não há sessões futuras disponíveis.";
        $("ticketSessionChangeSubmit").disabled = !sessions.length;
      } catch (error) {
        showToast(error.message, "error");
        close();
      }
    }

    async function submit(event) {
      event.preventDefault();
      if (submitting || !ticketId || !sessionSelect().value) return;
      submitting = true;
      $("ticketSessionChangeSubmit").disabled = true;
      try {
        const result = await api(`/api/admin/tickets/${encodeURIComponent(ticketId)}/session-change`, {
          method: "POST", body: JSON.stringify({ sessionId: sessionSelect().value, seatId: seatSelect().value })
        });
        submitting = false;
        close();
        await loadContent({ silent: true });
        showToast(result.unchanged ? "O ingresso já está nesta sessão e poltrona."
          : result.emailSent ? "Sessão trocada. O cliente recebeu o aviso por e-mail."
          : "Sessão trocada, mas o e-mail não foi entregue. Confira a integração de e-mail.", result.unchanged || result.emailSent ? "ok" : "error");
      } catch (error) {
        submitting = false;
        $("ticketSessionChangeSubmit").disabled = false;
        showToast(error.message, "error");
      }
    }

    function bindEvents() {
      $("ticketSessionChangeClose").addEventListener("click", close);
      $("ticketSessionChangeCancel").addEventListener("click", close);
      $("ticketSessionChangeForm").addEventListener("submit", submit);
      sessionSelect().addEventListener("change", loadSeats);
      overlay().addEventListener("click", (event) => { if (event.target === overlay()) close(); });
      document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay().hidden) close(); });
    }
    return { open, close, bindEvents };
  }
  const api = Object.freeze({ createTicketSessionChangeView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.ticketSessionChangeView = api; }
})(globalThis);
