((root) => {
  function createRoomListView({ state, $, creationPlaceholder, paginateAdminItems, renderAdminListPager, escapeHtml, api, confirm, currentRoom, syncCreationControl, setDisabled, defaultRoomSeatDraft, renderRoomSeatEditor, upsertAdminCollection, removeAdminCollectionItem, renderRooms, renderRoomOptions, renderGlobalSessions, updateSessionScheduleSuggestion, showToast }) {
    function renderRoomList() {
      const rooms = state.content?.rooms || [];
      if (state.creating.room) {
        $("roomsList").innerHTML = creationPlaceholder("Nova sala", "Cadastre nome, capacidade e tecnologia no quadro à direita.");
        return;
      }
      if (!rooms.length) {
        $("roomsList").innerHTML = `
          <div class="empty-state">
            <strong>Nenhuma sala cadastrada</strong>
            <span>Cadastre a sala principal para organizar as sessões.</span>
          </div>
        `;
        return;
      }

      const pagination = paginateAdminItems(rooms, "rooms", "selectedRoomId");
      $("roomsList").innerHTML = pagination.pageItems
        .map((room) => {
          const active = room.id === state.selectedRoomId ? "active" : "";
          return `
            <button class="list-item ${active}" type="button" data-admin-select-kind="room" data-admin-select-id="${escapeHtml(room.id)}">
              <span>
                <span class="list-title">${escapeHtml(room.name)}</span>
                <span class="list-meta">${Number(room.capacity || 0)} lugares • ${escapeHtml(room.technology || "sem tecnologia cadastrada")}</span>
              </span>
              <span class="badge">${escapeHtml(room.status)}</span>
            </button>
          `;
        })
        .join("") + renderAdminListPager("rooms", pagination, "sala(s)");
    }

    function selectRoom(id) {
      state.creating.room = false;
      state.selectedRoomId = id;
      renderRooms();
    }

    function newRoom() {
      state.creating.room = true;
      state.selectedRoomId = "";
      $("roomsList").innerHTML = creationPlaceholder("Nova sala", "Cadastre nome, capacidade e tecnologia no quadro à direita.");
      fillRoomForm(null);
    }

    function fillRoomForm(room) {
      syncCreationControl("room", "cancelRoomCreateButton", "deleteRoomButton", Boolean(room));
      setDisabled("deleteRoomButton", !room);
      $("roomId").value = room?.id || "";
      $("roomName").value = room?.name || "";
      $("roomCapacity").value = room?.capacity || 80;
      $("roomTechnology").value = room?.technology || "";
      $("roomCleanupMinutes").value = String(room?.cleanupMinutes ?? 20);
      $("roomStatus").value = room?.status || "active";
      state.roomSeatDraft = defaultRoomSeatDraft(room);
      state.roomSeatSelection = null;
      renderRoomSeatEditor();
    }

    async function saveRoom(event) {
      event.preventDefault();
      try {
        const payload = {
          id: $("roomId").value || undefined,
          name: $("roomName").value,
          capacity: Number($("roomCapacity").value || 80),
          technology: $("roomTechnology").value,
          cleanupMinutes: Number($("roomCleanupMinutes").value),
          status: $("roomStatus").value,
          seatSelectionEnabled: Boolean(state.roomSeatDraft?.enabled),
          seatTypes: state.roomSeatDraft?.seatTypes || [],
          seatLayout: {
            screenLabel: state.roomSeatDraft?.screenLabel || "TELA",
            rows: state.roomSeatDraft?.rows || []
          }
        };
        if (payload.seatSelectionEnabled && !payload.seatLayout.rows.some((row) => row.seats.some((seat) => seat.enabled !== false))) {
          throw new Error("Gere o mapa e mantenha ao menos uma poltrona disponível antes de salvar.");
        }
        const existingId = $("roomId").value;
        const saved = existingId
          ? await api(`/api/rooms/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/rooms", { method: "POST", body: JSON.stringify(payload) });
        state.creating.room = false;
        state.selectedRoomId = saved.id;
        upsertAdminCollection("rooms", saved);
        if (existingId) {
          const label = `${saved.name}${saved.technology ? ` (${saved.technology})` : ""}`;
          (state.content?.movies || []).forEach((movie) => (movie.sessions || []).forEach((session) => {
            if (session.roomId === saved.id) session.room = label;
          }));
          (state.content?.orders || []).forEach((order) => { if (order.sessionRoomId === saved.id || order.roomId === saved.id) order.sessionRoom = label; });
          (state.content?.tickets || []).forEach((ticket) => { if (ticket.sessionRoomId === saved.id || ticket.roomId === saved.id) ticket.sessionRoom = label; });
        }
        renderRooms();
        renderRoomOptions();
        renderGlobalSessions();
        updateSessionScheduleSuggestion();
        showToast("Sala salva.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function deleteRoom() {
      const room = currentRoom();
      if (!room || !confirm(`Excluir ${room.name}?`)) return;
      try {
        await api(`/api/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" });
        state.selectedRoomId = "";
        removeAdminCollectionItem("rooms", room.id);
        renderRooms();
        renderRoomOptions();
        showToast("Sala excluida.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { renderRoomList, selectRoom, newRoom, fillRoomForm, saveRoom, deleteRoom };
  }

  const api = Object.freeze({ createRoomListView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.roomListView = api; }
})(globalThis);
