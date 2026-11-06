((root) => {
  function createBoxOfficeSeatMap({ state, $, api, API_BASE, showToast, escapeHtml, accessibilityIcon, obeseSeatIcon, currentManualTicketTypes, manualTicketItems, currentManualMovieSession, renderManualSaleSummary }) {
    function manualRequestedSeatCount() {
      const ticketTypes = new Map(currentManualTicketTypes().map((ticketType) => [String(ticketType.id), ticketType]));
      return manualTicketItems().reduce((sum, item) => {
        const bundleQuantity = Math.max(1, Math.floor(Number(ticketTypes.get(String(item.id))?.bundleQuantity || 1)));
        return sum + item.quantity * bundleQuantity;
      }, 0);
    }

    function manualSeatById(seatId) {
      return (state.manualSeatMap?.rows || []).flatMap((row) => row.seats || []).find((seat) => String(seat.id) === String(seatId));
    }

    function manualSeatColor(value, fallback = "#2563eb") {
      const color = String(value || "").trim();
      return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
    }

    function manualSeatOwnerStorageKey(sessionId) {
      return `cine_admin_manual_seat_owner:${String(sessionId || "")}`;
    }

    function manualSeatOwnerToken(sessionId) {
      const key = manualSeatOwnerStorageKey(sessionId);
      try {
        const stored = window.sessionStorage.getItem(key);
        if (/^admin-box-office-[a-z0-9-]+$/i.test(String(stored || ""))) return stored;
        const token = `admin-box-office-${crypto.randomUUID()}`;
        window.sessionStorage.setItem(key, token);
        return token;
      } catch {
        return `admin-box-office-${crypto.randomUUID()}`;
      }
    }

    function clearManualSeatOwnerToken(sessionId) {
      try {
        window.sessionStorage.removeItem(manualSeatOwnerStorageKey(sessionId));
      } catch {
        // A reserva ainda será descartada pelo tempo de expiração no servidor.
      }
    }

    function reconcileManualSeatSelection() {
      const required = manualRequestedSeatCount();
      const available = new Set((state.manualSeatMap?.rows || [])
        .flatMap((row) => row.seats || [])
        .filter((seat) => seat.status === "available" || seat.heldByMe)
        .map((seat) => String(seat.id)));
      const previous = [...state.manualSelectedSeatIds];
      state.manualSelectedSeatIds = state.manualSelectedSeatIds
        .map(String)
        .filter((seatId) => available.has(seatId))
        .slice(0, required);
      const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
      if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
      previous
        .filter((seatId) => !state.manualSelectedSeatIds.includes(seatId) && manualSeatById(seatId)?.heldByMe)
        .forEach((seatId) => void sendManualSeatRealtimeRequest("release_seat", seatId));
      renderManualSeatMap();
    }

    function closeManualSeatRealtime(sessionId = "", releaseSeats = false) {
      const ids = sessionId ? [sessionId] : [...state.manualSeatRealtimeChannels.keys()];
      ids.forEach((id) => {
        const channel = state.manualSeatRealtimeChannels.get(id);
        if (!channel) return;
        channel.disposed = true;
        window.clearTimeout(channel.reconnectTimer);
        window.clearInterval(channel.heartbeatTimer);
        if (releaseSeats && channel.socket?.readyState === WebSocket.OPEN) {
          channel.selectedSeatIds.forEach((seatId) => channel.socket.send(JSON.stringify({
            type: "release_seat",
            requestId: crypto.randomUUID(),
            seatId
          })));
        }
        if (releaseSeats) clearManualSeatOwnerToken(id);
        channel.pending.forEach((pending) => pending.resolve({ ok: false, message: "Conexão com as poltronas encerrada." }));
        channel.pending.clear();
        channel.socket?.close();
        state.manualSeatRealtimeChannels.delete(id);
      });
      if (!sessionId || state.manualSeatRealtimeSessionId === sessionId) {
        state.manualSeatRealtimeSessionId = "";
        state.manualSeatRealtimeOwnerToken = "";
      }
    }

    function applyManualSeatRealtimeState(occupiedSeatIds = [], heldSeats = []) {
      if (!state.manualSeatMap?.rows) return;
      const occupied = new Set(occupiedSeatIds.map(String));
      const held = new Map(heldSeats.map((seat) => [String(seat.seatId), seat]));
      state.manualSeatMap.rows.forEach((row) => {
        (row.seats || []).forEach((seat) => {
          const hold = held.get(String(seat.id));
          seat.heldByMe = Boolean(hold?.heldByMe);
          if (seat.enabled === false) seat.status = "blocked";
          else if (occupied.has(String(seat.id))) seat.status = "unavailable";
          else if (hold) seat.status = "held";
          else seat.status = "available";
        });
      });
      reconcileManualSeatSelection();
    }

    function applyManualSeatRealtimeChange(message) {
      const seat = manualSeatById(message.seatId);
      if (!seat || seat.enabled === false) return;
      seat.status = ["available", "held", "unavailable"].includes(String(message.status))
        ? String(message.status)
        : seat.status;
      seat.heldByMe = Boolean(message.heldByMe && seat.status === "held");
      reconcileManualSeatSelection();
    }

    function connectManualSeatRealtime(sessionId) {
      if (!sessionId) return;
      const previousSessionId = state.manualSeatRealtimeSessionId;
      if (previousSessionId && previousSessionId !== sessionId && !state.manualSaleItems.some((item) => item.sessionId === previousSessionId)) {
        closeManualSeatRealtime(previousSessionId, true);
      }
      state.manualSeatRealtimeSessionId = sessionId;
      let channel = state.manualSeatRealtimeChannels.get(sessionId);
      if (channel) {
        state.manualSeatRealtimeOwnerToken = channel.ownerToken;
        return;
      }
      channel = {
        sessionId,
        ownerToken: manualSeatOwnerToken(sessionId),
        socket: null,
        reconnectTimer: null,
        heartbeatTimer: null,
        selectedSeatIds: [],
        pendingSeatIds: new Set(),
        pending: new Map(),
        disposed: false
      };
      state.manualSeatRealtimeChannels.set(sessionId, channel);
      state.manualSeatRealtimeOwnerToken = channel.ownerToken;

      const connect = () => {
        if (channel.disposed) return;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const socket = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/api/realtime/seats`);
        channel.socket = socket;
        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({
            type: "join_session",
            requestId: crypto.randomUUID(),
            sessionId,
            ownerToken: channel.ownerToken
          }));
          window.clearInterval(channel.heartbeatTimer);
          channel.heartbeatTimer = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN && channel.selectedSeatIds.length) {
              socket.send(JSON.stringify({ type: "heartbeat", requestId: crypto.randomUUID(), seatIds: channel.selectedSeatIds }));
            }
          }, 35000);
        });
        socket.addEventListener("message", (event) => {
          let message;
          try { message = JSON.parse(String(event.data)); } catch { return; }
          const pending = channel.pending.get(String(message.requestId || ""));
          if (pending) {
            channel.pending.delete(String(message.requestId));
            channel.pendingSeatIds.delete(pending.seatId);
            window.clearTimeout(pending.timer);
            if (["select_seat_confirmed", "release_seat_confirmed"].includes(message.type)) pending.resolve({ ok: true });
            else pending.resolve({ ok: false, message: message.message || "Não foi possível atualizar a poltrona." });
          }
          if (state.manualSeatRealtimeSessionId !== sessionId) return;
          if (message.type === "session_state") {
            applyManualSeatRealtimeState(message.occupiedSeatIds || [], message.heldSeats || []);
          } else if (message.type === "seat_status_changed") {
            applyManualSeatRealtimeChange(message);
          } else if (message.type === "session_refresh_required") {
            void loadManualSeatMap({ preserveSelection: true });
          }
        });
        socket.addEventListener("close", () => {
          window.clearInterval(channel.heartbeatTimer);
          if (channel.socket === socket) channel.socket = null;
          if (channel.disposed) return;
          channel.reconnectTimer = window.setTimeout(connect, 1500);
        });
        socket.addEventListener("error", () => socket.close());
      };
      connect();
    }

    function sendManualSeatRealtimeRequest(type, seatId) {
      const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
      const socket = channel?.socket;
      if (!channel || !socket || socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve({ ok: false, message: "A sincronização das poltronas está reconectando. Aguarde um instante." });
      }
      const requestId = crypto.randomUUID();
      channel.pendingSeatIds.add(String(seatId));
      renderManualSeatMap();
      return new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          channel.pending.delete(requestId);
          channel.pendingSeatIds.delete(String(seatId));
          renderManualSeatMap();
          resolve({ ok: false, message: "A reserva da poltrona demorou para responder. Tente novamente." });
        }, 8000);
        channel.pending.set(requestId, { resolve, timer, seatId: String(seatId) });
        socket.send(JSON.stringify({ type, requestId, seatId }));
      });
    }

    async function loadManualSeatMap({ preserveSelection = false } = {}) {
      const { session } = currentManualMovieSession();
      const section = $("manualSeatSection");
      const requestToken = ++state.manualSeatRequestToken;
      const previousSessionId = state.manualSeatMapSessionId;
      const previousSelection = preserveSelection && previousSessionId === session?.id
        ? [...state.manualSelectedSeatIds]
        : [];
      state.manualSeatMapSessionId = session?.id || "";
      state.manualSeatMap = null;
      state.manualSelectedSeatIds = previousSelection;

      if (!session?.id) {
        if (previousSessionId && !state.manualSaleItems.some((item) => item.sessionId === previousSessionId)) {
          closeManualSeatRealtime(previousSessionId, true);
        }
        state.manualSeatMapStatus = "idle";
        if (section) section.hidden = true;
        return;
      }

      state.manualSeatMapStatus = "loading";
      connectManualSeatRealtime(session.id);
      if (section) section.hidden = false;
      renderManualSeatMap();
      try {
        const seatMap = await api(`/api/sessions/${encodeURIComponent(session.id)}/seats?ownerToken=${encodeURIComponent(state.manualSeatRealtimeOwnerToken)}`);
        if (requestToken !== state.manualSeatRequestToken || state.manualSeatMapSessionId !== session.id) return;
        state.manualSeatMap = seatMap;
        state.manualSeatMapStatus = "ready";
        const existingItem = state.manualSaleItems.find((item) => item.sessionId === session.id);
        state.manualSelectedSeatIds = previousSelection.length
          ? previousSelection
          : Array.isArray(existingItem?.selectedSeatIds) ? [...existingItem.selectedSeatIds] : [];
        reconcileManualSeatSelection();
      } catch (error) {
        if (requestToken !== state.manualSeatRequestToken) return;
        state.manualSeatMapStatus = "error";
        state.manualSeatMap = null;
        renderManualSeatMap(error.message);
      }
    }

    async function toggleManualSeat(seatId) {
      const seat = manualSeatById(seatId);
      const id = String(seatId);
      const selected = state.manualSelectedSeatIds.includes(id);
      if (!seat || (!selected && seat.status !== "available" && !seat.heldByMe)) return;
      const required = manualRequestedSeatCount();
      if (!required) {
        showToast("Selecione ao menos um ingresso antes de escolher as poltronas.", "error");
        return;
      }
      const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
      if (channel?.pendingSeatIds.has(id)) return;
      if (selected) {
        const result = await sendManualSeatRealtimeRequest("release_seat", id);
        if (!result.ok) return showToast(result.message, "error");
        state.manualSelectedSeatIds = state.manualSelectedSeatIds.filter((current) => current !== id);
        if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
      } else if (state.manualSelectedSeatIds.length < required) {
        const result = await sendManualSeatRealtimeRequest("select_seat", id);
        if (!result.ok) return showToast(result.message, "error");
        state.manualSelectedSeatIds.push(id);
        if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
      } else {
        showToast(`A quantidade atual permite selecionar ${required} poltrona(s).`, "error");
      }
      renderManualSeatMap();
    }

    function renderManualSeatMap(errorMessage = "") {
      const section = $("manualSeatSection");
      if (!section) return;
      const status = state.manualSeatMapStatus;
      const seatMap = state.manualSeatMap;
      const required = manualRequestedSeatCount();
      const selected = state.manualSelectedSeatIds.length;
      const statusTarget = $("manualSeatStatus");
      const mapShell = $("manualSeatMapShell");

      section.hidden = status === "idle" || (status === "ready" && !seatMap?.enabled);
      if (section.hidden) return;
      $("manualSeatCount").textContent = `${selected} de ${required}`;
      $("manualSeatCount").className = `status-pill ${required > 0 && selected === required ? "success" : "muted"}`;
      $("manualSeatDescription").textContent = required
        ? `Selecione ${required} poltrona(s), uma para cada ingresso que será emitido.`
        : "Escolha primeiro a quantidade e o tipo de ingresso.";
      $("manualSeatSelectionSummary").textContent = selected
        ? `Selecionadas: ${state.manualSelectedSeatIds.map((seatId) => manualSeatById(seatId)?.label || seatId).join(", ")}`
        : "";
      renderManualSaleSummary();

      if (status === "loading") {
        statusTarget.innerHTML = `<div class="manual-seat-loading" aria-label="Carregando mapa de poltronas"></div>`;
        mapShell.hidden = true;
        return;
      }
      if (status === "error") {
        statusTarget.innerHTML = `<div class="validation-result error">${escapeHtml(errorMessage || "Não foi possível carregar as poltronas desta sessão.")} <button type="button" class="text-button" data-reload-manual-seats>Tentar novamente</button></div>`;
        statusTarget.querySelector("[data-reload-manual-seats]")?.addEventListener("click", () => void loadManualSeatMap());
        mapShell.hidden = true;
        return;
      }

      statusTarget.innerHTML = "";
      mapShell.hidden = false;
      $("manualSeatScreen").textContent = seatMap?.screenLabel || "TELA";
      const typeById = new Map((seatMap?.seatTypes || []).map((type) => [String(type.id), type]));
      $("manualSeatLegend").innerHTML = [
        ...(seatMap?.seatTypes || []).map((type) => `<span><i style="--manual-seat-color:${manualSeatColor(type.color)}"></i>${escapeHtml(type.name)}</span>`),
        `<span><i class="is-unavailable"></i>Indisponível</span>`,
        `<span><i class="is-temporarily-reserved"></i>Reservada temporariamente</span>`,
        `<span><i class="is-selected"></i>Selecionada nesta venda</span>`,
        `<span>${accessibilityIcon}Cadeirante</span>`,
        `<span>${obeseSeatIcon}Pessoa obesa</span>`
      ].join("");
      const seatRows = seatMap?.rows || [];
      const seatRowsMarkup = seatRows.map((row) => `
        <div class="manual-seat-row">
          <span class="manual-seat-row-label">${escapeHtml(row.label)}</span>
          <div class="manual-seat-row-seats">
            ${(row.seats || []).map((seat) => {
              const type = typeById.get(String(seat.typeId));
              const isSelected = state.manualSelectedSeatIds.includes(String(seat.id));
              const heldByMe = seat.status === "held" && seat.heldByMe;
              const temporarilyReserved = seat.status === "held" && !seat.heldByMe;
              const unavailable = (seat.status !== "available" && !seat.heldByMe) || temporarilyReserved;
              const pending = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId)?.pendingSeatIds.has(String(seat.id));
              const accessibility = seat.accessibility === "wheelchair" ? "Cadeirante" : seat.accessibility === "obese" ? "Pessoa obesa" : "";
              return `<button
                type="button"
                class="manual-seat-button ${isSelected ? "is-selected" : ""} ${temporarilyReserved ? "is-temporarily-reserved" : unavailable ? "is-unavailable" : ""} ${pending ? "is-pending" : ""} ${accessibility ? "has-accessibility" : ""}"
                style="--manual-seat-color:${manualSeatColor(seat.color || type?.color)};${seat.aisleAfter ? "margin-right:24px" : ""}"
                data-manual-seat-id="${escapeHtml(seat.id)}"
                aria-label="${escapeHtml(`${seat.label}, ${type?.name || "Padrão"}${accessibility ? `, ${accessibility}` : ""}${temporarilyReserved ? ", reservada temporariamente por outra compra" : unavailable ? ", indisponível" : heldByMe ? ", reserva retomada nesta venda" : isSelected ? ", selecionada nesta venda" : ""}`)}"
                title="${escapeHtml(temporarilyReserved ? `${seat.label} • Reservada temporariamente por outra compra` : heldByMe ? `${seat.label} • Reserva retomada nesta venda` : `${seat.label} • ${type?.name || "Padrão"}`)}"
                aria-pressed="${isSelected}"
                ${unavailable || pending ? "disabled" : ""}
              >${seat.accessibility === "wheelchair" ? accessibilityIcon : seat.accessibility === "obese" ? obeseSeatIcon : ""}<span>${escapeHtml(seat.label)}</span></button>`;
            }).join("")}
          </div>
          <span class="manual-seat-row-label" aria-hidden="true">${escapeHtml(row.label)}</span>
        </div>
      `).join("");
      $("manualSeatMap").innerHTML = seatRowsMarkup;
      $("manualSeatMap").querySelectorAll("[data-manual-seat-id]").forEach((button) => {
        button.addEventListener("click", () => void toggleManualSeat(button.dataset.manualSeatId));
      });
    }

    return { manualRequestedSeatCount, manualSeatById, manualSeatColor, manualSeatOwnerStorageKey, manualSeatOwnerToken, clearManualSeatOwnerToken, reconcileManualSeatSelection, closeManualSeatRealtime, applyManualSeatRealtimeState, applyManualSeatRealtimeChange, connectManualSeatRealtime, sendManualSeatRealtimeRequest, loadManualSeatMap, toggleManualSeat, renderManualSeatMap };
  }
  const api = Object.freeze({ createBoxOfficeSeatMap });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.boxOfficeSeatMap = api; }
})(globalThis);
