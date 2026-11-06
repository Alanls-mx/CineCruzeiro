((root) => {
  function createSessionSeatDetailView({ $, accessibilityIcon, escapeHtml, manualSeatColor, obeseSeatIcon, openOrderView, orderReference, sessionSeatDateTime, sessionSeatStatusLabels, state }) {
    function renderSessionSeatDetail() {
      const view = state.sessionSeatView;
      const seat = view?.map?.rows.flatMap((row) => row.seats).find((item) => item.id === view.seatId);
      const target = $("sessionSeatDetail");
      if (!seat) {
        target.innerHTML = `<div class="session-seat-detail-empty"><strong>Selecione uma poltrona</strong><p>O status e as informações disponíveis da compra aparecem aqui.</p></div>`;
        return;
      }
      const purchase = seat.purchase;
      target.innerHTML = `
        <span class="mini-label">Poltrona ${escapeHtml(seat.label)}</span>
        <h3>${escapeHtml(sessionSeatStatusLabels[seat.status] || seat.status)}</h3>
        <dl>
          <div><dt>Tipo</dt><dd>${escapeHtml(seat.typeName || "Padrão")}</dd></div>
          ${seat.accessibility ? `<div><dt>Acessibilidade</dt><dd>${escapeHtml(seat.accessibility === "wheelchair" ? "Cadeirante" : seat.accessibility === "obese" ? "Pessoa obesa" : seat.accessibility)}</dd></div>` : ""}
          ${purchase ? `
            <div><dt>Comprador</dt><dd>${escapeHtml(purchase.customerName)}</dd></div>
            <div><dt>Pedido</dt><dd>${escapeHtml(purchase.orderReference || purchase.orderId)}</dd></div>
            <div><dt>Situação</dt><dd>${escapeHtml(purchase.orderStatus === "paid" ? "Pago" : purchase.orderStatus === "paid_pending_print" ? "Pago, aguardando impressão" : purchase.orderStatus === "pending_payment" ? "Aguardando pagamento" : purchase.orderStatus || "Não informada")}</dd></div>
            <div><dt>Pedido criado</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.createdAt))}</dd></div>
            ${purchase.paidAt ? `<div><dt>Pagamento aprovado</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.paidAt))}</dd></div>` : ""}
            ${purchase.paymentMethod ? `<div><dt>Pagamento</dt><dd>${escapeHtml(purchase.paymentMethod === "PIX" ? "Pix" : purchase.paymentMethod === "CREDIT_CARD" ? "Cartão" : purchase.paymentMethod)}</dd></div>` : ""}
            ${purchase.ticketType ? `<div><dt>Ingresso</dt><dd>${escapeHtml(purchase.ticketType)}</dd></div>` : ""}
            <div><dt>Origem</dt><dd>${escapeHtml(purchase.origin === "box_office" ? "Bilheteria" : purchase.origin === "online" ? "Site" : purchase.origin || "Não informada")}</dd></div>
            ${purchase.usedAt ? `<div><dt>Entrada validada</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.usedAt))}</dd></div>` : ""}
          ` : seat.status === "held" ? `<div><dt>Reserva</dt><dd>Temporária, ainda sem compra concluída.</dd></div>` : ""}
        </dl>
        ${purchase?.orderId ? `<button class="ghost-button" type="button" data-session-seat-order="${escapeHtml(purchase.orderId)}">Abrir pedido</button>` : ""}`;
      target.querySelector("[data-session-seat-order]")?.addEventListener("click", () => {
        $("sessionSeatDialog").close();
        openOrderView(purchase.orderId);
      });
    }

    function renderSessionSeatDialog() {
      const view = state.sessionSeatView;
      const map = view?.map;
      if (!map) return;
      $("sessionSeatTitle").textContent = map.movieTitle || "Mapa da sala";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(map.date || "") ? map.date.split("-").reverse().join("/") : map.date || "";
      $("sessionSeatSubtitle").textContent = `${map.roomName} · ${date} · ${map.time}`;
      $("sessionSeatSummary").innerHTML = [
        ["Livre", map.counts.available], ["Ocupada", map.counts.sold],
        ["Pagamento pendente", map.counts.pending], ["Reserva temporária", map.counts.held], ["Bloqueada", map.counts.blocked]
      ].map(([label, count]) => `<span><strong>${count}</strong>${label}</span>`).join("");
      if (!map.enabled || !map.rows.length) {
        $("sessionSeatMap").innerHTML = `<div class="ongoing-seat-empty">Esta sessão não possui mapa de poltronas configurado.</div>`;
        renderSessionSeatDetail();
        return;
      }
      $("sessionSeatMap").innerHTML = `
        <div class="session-seat-map-content">
          <div class="room-seat-screen">${escapeHtml(map.screenLabel)}</div>
          <div class="session-seat-map" aria-label="Mapa da sala ${escapeHtml(map.roomName)}">
            ${map.rows.map((row) => `<div class="session-seat-row">
              <span class="room-seat-row-label">${escapeHtml(row.label)}</span>
              <div class="session-seat-row-seats">${row.seats.map((seat) => `<button type="button"
                class="session-seat-button is-${escapeHtml(seat.status)} ${seat.aisleAfter ? "has-aisle" : ""} ${view.seatId === seat.id ? "is-current" : ""}"
                style="--seat-color:${manualSeatColor(seat.color)}"
                data-session-seat-id="${escapeHtml(seat.id)}"
                aria-label="${escapeHtml(`${seat.label}, ${seat.typeName}, ${sessionSeatStatusLabels[seat.status] || seat.status}`)}"
                aria-pressed="${view.seatId === seat.id}">${seat.accessibility === "wheelchair" ? accessibilityIcon : seat.accessibility === "obese" ? obeseSeatIcon : ""}<span>${escapeHtml(seat.label)}</span></button>`).join("")}</div>
              <span class="room-seat-row-label" aria-hidden="true">${escapeHtml(row.label)}</span>
            </div>`).join("")}
          </div>
          <div class="session-seat-legend">${Object.entries(sessionSeatStatusLabels).map(([status, label]) => `<span><i class="is-${status}"></i>${label}</span>`).join("")}</div>
        </div>`;
      $("sessionSeatMap").querySelectorAll("[data-session-seat-id]").forEach((button) => {
        button.addEventListener("click", () => {
          view.seatId = button.dataset.sessionSeatId;
          $("sessionSeatMap").querySelectorAll("[data-session-seat-id]").forEach((seatButton) => {
            const selected = seatButton.dataset.sessionSeatId === view.seatId;
            seatButton.classList.toggle("is-current", selected);
            seatButton.setAttribute("aria-pressed", String(selected));
          });
          renderSessionSeatDetail();
        });
      });
      renderSessionSeatDetail();
    }
    return { renderSessionSeatDetail, renderSessionSeatDialog };
  }
  const api = Object.freeze({ createSessionSeatDetailView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.sessionSeatDetailView = api; }
})(globalThis);
