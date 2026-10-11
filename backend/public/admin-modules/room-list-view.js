((root) => {
  function createRoomListView({ state, $, creationPlaceholder, paginateAdminItems, renderAdminListPager, escapeHtml }) {
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

    return { renderRoomList };
  }

  const api = Object.freeze({ createRoomListView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.roomListView = api; }
})(globalThis);
