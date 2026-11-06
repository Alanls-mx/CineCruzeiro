((root) => {
  function createRoomSeatEditor({ state, $, escapeHtml, trashIcon, accessibilityIcon, obeseSeatIcon, showToast, confirm }) {
    function defaultRoomSeatDraft(room = null) {
      const seatTypes = Array.isArray(room?.seatTypes) && room.seatTypes.length
        ? structuredClone(room.seatTypes)
        : [{ id: "standard", name: "Padrão", color: "#2563eb", description: "Poltrona convencional" }];
      return {
        enabled: Boolean(room?.seatSelectionEnabled),
        screenLabel: room?.seatLayout?.screenLabel || "TELA",
        seatTypes,
        rows: Array.isArray(room?.seatLayout?.rows) ? structuredClone(room.seatLayout.rows).map((row) => ({
          ...row,
          seats: (row.seats || []).map((seat) => ({
            ...seat,
            accessibility: ["wheelchair", "obese"].includes(seat.accessibility) ? seat.accessibility : "",
            customLabel: seat.customLabel === true || !new RegExp(`^${String(row.label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`, "i").test(String(seat.label || ""))
          }))
        })) : []
      };
    }

    function roomSeatAccessibilityLabel(value) {
      if (value === "wheelchair") return "Cadeirante";
      if (value === "obese") return "Pessoa obesa";
      return "Sem marcador";
    }

    function roomSeatAccessibilityIcon(value) {
      if (value === "wheelchair") return accessibilityIcon;
      if (value === "obese") return obeseSeatIcon;
      return "";
    }

    function roomSeatColor(seat) {
      return seat?.color || state.roomSeatDraft?.seatTypes?.find((type) => type.id === seat?.typeId)?.color || "#2563eb";
    }

    function roomSeatTypeOptions(selectedId) {
      return (state.roomSeatDraft?.seatTypes || []).map((type) => `
        <option value="${escapeHtml(type.id)}" ${type.id === selectedId ? "selected" : ""}>${escapeHtml(type.name)}</option>
      `).join("");
    }

    function roomSeatTargets(selection = state.roomSeatSelection) {
      const rows = state.roomSeatDraft?.rows || [];
      if (!selection) return [];
      if (selection.kind === "seat") return rows.flatMap((row) => row.seats).filter((seat) => seat.id === selection.seatId);
      if (selection.kind === "row") return rows.find((row) => row.id === selection.rowId)?.seats || [];
      if (selection.kind === "column") return rows.map((row) => row.seats[selection.columnIndex]).filter(Boolean);
      return [];
    }

    function selectedRoomSeatRow() {
      return (state.roomSeatDraft?.rows || []).find((row) => row.id === state.roomSeatSelection?.rowId) || null;
    }

    function uniqueRoomSeatId(prefix = "seat") {
      const ids = new Set((state.roomSeatDraft?.rows || []).flatMap((row) => row.seats.map((seat) => seat.id)));
      let id = `${prefix}-${Date.now().toString(36)}`;
      let suffix = 1;
      while (ids.has(id)) id = `${prefix}-${Date.now().toString(36)}-${suffix++}`;
      return id;
    }

    function nextRoomRowLabel() {
      const labels = new Set((state.roomSeatDraft?.rows || []).map((row) => String(row.label || "").toUpperCase()));
      for (let code = 65; code <= 90; code += 1) {
        const label = String.fromCharCode(code);
        if (!labels.has(label)) return label;
      }
      return `F${labels.size + 1}`;
    }

    function renumberRoomSeatRow(row) {
      (row?.seats || []).forEach((seat, index) => {
        if (seat.customLabel !== true) seat.label = `${row?.label || "P"}${index + 1}`;
      });
    }

    function createRoomSeat(row, typeId) {
      return {
        id: uniqueRoomSeatId(`${row.id}-seat`),
        label: `${row?.label || "P"}${(row?.seats || []).length + 1}`,
        customLabel: false,
        typeId: typeId || state.roomSeatDraft?.seatTypes?.[0]?.id || "standard",
        color: "",
        accessibility: "",
        enabled: true,
        aisleAfter: false
      };
    }

    function renderRoomSeatTypes() {
      const draft = state.roomSeatDraft || defaultRoomSeatDraft();
      const target = $("roomSeatTypes");
      if (!target) return;
      target.innerHTML = draft.seatTypes.map((type) => `
        <div class="room-seat-type-row" data-seat-type-id="${escapeHtml(type.id)}">
          <input type="color" value="${escapeHtml(type.color || "#2563eb")}" aria-label="Cor de ${escapeHtml(type.name)}" data-seat-type-field="color" />
          <input value="${escapeHtml(type.name)}" maxlength="40" aria-label="Nome do tipo de poltrona" data-seat-type-field="name" />
          <input value="${escapeHtml(type.description || "")}" maxlength="120" placeholder="Descrição opcional" aria-label="Descrição do tipo de poltrona" data-seat-type-field="description" />
          <button class="icon-button danger" type="button" title="Remover tipo" aria-label="Remover ${escapeHtml(type.name)}" data-remove-seat-type="${escapeHtml(type.id)}">${trashIcon}</button>
        </div>
      `).join("");
    }

    function renderRoomSeatSelectionPanel() {
      const panel = $("roomSeatSelectionPanel");
      if (!panel) return;
      const selection = state.roomSeatSelection;
      const targets = roomSeatTargets(selection);
      if (!selection || !targets.length) {
        state.roomSeatSelection = null;
        panel.innerHTML = `
          <div class="room-seat-selection-empty">
            <strong>Nenhum elemento selecionado</strong>
            <span>Selecione uma cadeira, fileira ou coluna para editar, adicionar ou excluir.</span>
          </div>`;
        return;
      }
    
      const first = targets[0];
      const typeId = targets.every((seat) => seat.typeId === first.typeId) ? first.typeId : "";
      const color = targets.every((seat) => (seat.color || "") === (first.color || ""))
        ? roomSeatColor(first)
        : "#2563eb";
      const accessibility = targets.every((seat) => (seat.accessibility || "") === (first.accessibility || ""))
        ? first.accessibility || ""
        : "mixed";
      const row = selection.kind === "row" ? selectedRoomSeatRow() : null;
      const seat = selection.kind === "seat" ? first : null;
      const title = selection.kind === "seat"
        ? `Cadeira ${seat.label}`
        : selection.kind === "row"
          ? `Fileira ${row?.label || ""}`
          : `Coluna ${Number(selection.columnIndex) + 1}`;
      const subtitle = selection.kind === "seat"
        ? "Alterações desta cadeira"
        : `${targets.length} cadeira(s) serão alteradas em conjunto`;
      const labelField = selection.kind === "seat" || selection.kind === "row" ? `
        <label>
          ${selection.kind === "seat" ? "Identificação" : "Nome da fileira"}
          <input data-seat-selection-field="label" maxlength="16" value="${escapeHtml(selection.kind === "seat" ? seat.label : row?.label || "")}" />
        </label>` : "";
      const availabilityField = selection.kind === "seat" ? `
        <label class="check-field">
          <input type="checkbox" data-seat-selection-field="enabled" ${seat.enabled !== false ? "checked" : ""} />
          <span>Cadeira disponível</span>
        </label>` : "";
      const aisleField = selection.kind === "seat" ? `
        <label class="check-field">
          <input type="checkbox" data-seat-selection-field="aisleAfter" ${seat.aisleAfter ? "checked" : ""} />
          <span>Corredor depois</span>
        </label>` : "";
      const actions = selection.kind === "seat" ? `
          <button class="ghost-button" type="button" data-seat-selection-action="seat-before">Adicionar antes</button>
          <button class="ghost-button" type="button" data-seat-selection-action="seat-after">Adicionar depois</button>
          <button class="danger-button" type="button" data-seat-selection-action="seat-delete">Excluir cadeira</button>`
        : selection.kind === "row" ? `
          <button class="ghost-button" type="button" data-seat-selection-action="row-before">Adicionar fileira acima</button>
          <button class="ghost-button" type="button" data-seat-selection-action="row-after">Adicionar fileira abaixo</button>
           <button class="ghost-button" type="button" data-seat-selection-action="row-seat-left">Adicionar cadeira à esquerda</button>
           <button class="ghost-button" type="button" data-seat-selection-action="row-seat-right">Adicionar cadeira à direita</button>
          <button class="danger-button" type="button" data-seat-selection-action="row-delete">Excluir fileira</button>`
        : `
          <button class="ghost-button" type="button" data-seat-selection-action="column-before">Adicionar coluna à esquerda</button>
          <button class="ghost-button" type="button" data-seat-selection-action="column-after">Adicionar coluna à direita</button>
          <button class="danger-button" type="button" data-seat-selection-action="column-delete">Excluir coluna</button>`;
    
      panel.innerHTML = `
        <div class="room-seat-selection-head">
          <div class="room-seat-selection-title"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
          <button class="icon-button" type="button" title="Fechar edição" aria-label="Fechar edição" data-seat-selection-action="clear">×</button>
        </div>
        <div class="room-seat-selection-fields">
          ${labelField}
          <label>
            Tipo de poltrona
            <select data-seat-selection-field="typeId">
              ${typeId ? roomSeatTypeOptions(typeId) : `<option value="">Tipos diferentes</option>${roomSeatTypeOptions("")}`}
            </select>
          </label>
          <label class="room-seat-color-field">
            <span>Cor personalizada</span>
            <input type="color" value="${escapeHtml(color)}" data-seat-selection-field="color" aria-label="Cor personalizada" />
            <button class="ghost-button" type="button" data-seat-selection-action="color-reset">Usar tipo</button>
          </label>
          <fieldset class="room-seat-accessibility-field">
            <legend>Marcador da cadeira</legend>
            <div class="room-seat-marker-options">
              <button type="button" class="${accessibility === "" ? "is-active" : ""}" data-seat-accessibility="" aria-pressed="${accessibility === ""}">Nenhum</button>
              <button type="button" class="${accessibility === "wheelchair" ? "is-active" : ""}" data-seat-accessibility="wheelchair" aria-pressed="${accessibility === "wheelchair"}">${accessibilityIcon}<span>Cadeirante</span></button>
              <button type="button" class="${accessibility === "obese" ? "is-active" : ""}" data-seat-accessibility="obese" aria-pressed="${accessibility === "obese"}">${obeseSeatIcon}<span>Pessoa obesa</span></button>
            </div>
          </fieldset>
          ${availabilityField}
          ${aisleField}
        </div>
        <div class="room-seat-selection-actions">${actions}</div>`;
    }

    function renderRoomSeatMap(renderSelectionPanel = true) {
      const draft = state.roomSeatDraft || defaultRoomSeatDraft();
      const target = $("roomSeatMap");
      if (!target) return;
      $("roomSeatScreen").textContent = draft.screenLabel || "TELA";
      const enabled = draft.rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat.enabled !== false).length, 0);
      const blocked = draft.rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat.enabled === false).length, 0);
      $("roomSeatCount").textContent = `${enabled} poltrona(s) disponível(is)${blocked ? ` • ${blocked} bloqueada(s)` : ""}`;
      $("roomCapacity").value = enabled || Number($("roomCapacity").value || 1);
      const selected = state.roomSeatSelection;
      const columnCount = draft.rows.reduce((max, row) => Math.max(max, row.seats.length), 0);
      const columnHead = `
        <div class="room-seat-column-head" aria-label="Colunas da sala">
          <span class="room-seat-column-spacer"></span>
          ${Array.from({ length: columnCount }, (_, columnIndex) => {
            const aisleAfter = draft.rows.some((row) => row.seats[columnIndex]?.aisleAfter);
            return `<button type="button" class="room-seat-column-button ${selected?.kind === "column" && selected.columnIndex === columnIndex ? "is-selected" : ""} ${aisleAfter ? "has-aisle" : ""}" data-room-seat-column="${columnIndex}" aria-label="Editar coluna ${columnIndex + 1}">${columnIndex + 1}</button>`;
          }).join("")}
        </div>`;
      target.innerHTML = draft.rows.length ? columnHead + draft.rows.map((row) => `
        <div class="room-seat-row">
          <button type="button" class="room-seat-row-label ${selected?.kind === "row" && selected.rowId === row.id ? "is-selected" : ""}" data-room-seat-row-id="${escapeHtml(row.id)}" aria-label="Editar fileira ${escapeHtml(row.label)}">${escapeHtml(row.label)}</button>
          ${(row.seats || []).map((seat, columnIndex) => `
            <button
              type="button"
              class="room-seat-button ${seat.enabled === false ? "is-blocked" : ""} ${seat.aisleAfter ? "has-aisle" : ""} ${seat.accessibility ? "has-accessibility" : ""} ${(selected?.kind === "seat" && selected.seatId === seat.id) || (selected?.kind === "column" && selected.columnIndex === columnIndex) || (selected?.kind === "row" && selected.rowId === row.id) ? "is-selected" : ""}"
              style="--seat-color:${escapeHtml(roomSeatColor(seat))}"
              data-room-seat-id="${escapeHtml(seat.id)}"
              title="${escapeHtml(seat.label)} • ${escapeHtml(state.roomSeatDraft.seatTypes.find((type) => type.id === seat.typeId)?.name || "Padrão")}${seat.accessibility ? ` • ${escapeHtml(roomSeatAccessibilityLabel(seat.accessibility))}` : ""}${seat.enabled === false ? " • bloqueada" : ""}"
            >${seat.accessibility ? `<span class="room-seat-button-marker">${roomSeatAccessibilityIcon(seat.accessibility)}</span>` : ""}<span class="room-seat-button-label">${escapeHtml(seat.label)}</span></button>
          `).join("")}
        </div>
      `).join("") : `<div class="empty-state"><strong>Mapa ainda não gerado</strong><span>Defina filas, poltronas e corredor; depois clique em Gerar mapa.</span></div>`;
      if (renderSelectionPanel) renderRoomSeatSelectionPanel();
    }

    function renderRoomSeatEditor() {
      const draft = state.roomSeatDraft || defaultRoomSeatDraft();
      $("roomSeatSelectionEnabled").checked = draft.enabled;
      $("roomSeatEditor").hidden = !draft.enabled;
      $("roomCapacity").readOnly = draft.enabled;
      $("roomCapacityHelp").textContent = draft.enabled ? "Calculada automaticamente pelas poltronas disponíveis no mapa." : "Usada para sessões sem lugares marcados.";
      $("roomSeatScreenLabel").value = draft.screenLabel || "TELA";
      if (draft.rows.length) {
        $("roomSeatRows").value = draft.rows.length;
        $("roomSeatColumns").value = Math.max(...draft.rows.map((row) => row.seats.length), 1);
        const aisle = draft.rows[0]?.seats?.findIndex((seat) => seat.aisleAfter);
        $("roomSeatAisleAfter").value = aisle >= 0 ? aisle + 1 : 0;
      }
      renderRoomSeatTypes();
      renderRoomSeatMap();
    }

    function generateRoomSeatMap() {
      const rowCount = Math.max(1, Math.min(40, Number($("roomSeatRows").value || 1)));
      const columnCount = Math.max(1, Math.min(80, Number($("roomSeatColumns").value || 1)));
      const aisleAfter = Math.max(0, Math.min(columnCount - 1, Number($("roomSeatAisleAfter").value || 0)));
      if (state.roomSeatDraft?.rows?.length && !confirm("Gerar um novo mapa substituirá o desenho atual desta sala. Continuar?")) return;
      const defaultTypeId = state.roomSeatDraft?.seatTypes?.[0]?.id || "standard";
      state.roomSeatDraft.rows = Array.from({ length: rowCount }, (_, rowIndex) => {
        const label = rowIndex < 26 ? String.fromCharCode(65 + rowIndex) : `F${rowIndex + 1}`;
        const rowId = `row-${rowIndex + 1}`;
        return {
          id: rowId,
          label,
          seats: Array.from({ length: columnCount }, (_, seatIndex) => ({
            id: `${rowId}-seat-${seatIndex + 1}`,
            label: `${label}${seatIndex + 1}`,
            typeId: defaultTypeId,
            color: "",
            accessibility: "",
            customLabel: false,
            enabled: true,
            aisleAfter: aisleAfter > 0 && seatIndex + 1 === aisleAfter
          }))
        };
      });
      state.roomSeatSelection = null;
      renderRoomSeatMap();
    }

    function addRoomSeatType() {
      const id = `tipo-${Date.now().toString(36)}`;
      state.roomSeatDraft.seatTypes.push({ id, name: `Tipo ${state.roomSeatDraft.seatTypes.length + 1}`, color: "#0f766e", description: "" });
      renderRoomSeatTypes();
      renderRoomSeatMap();
    }

    function removeRoomSeatType(id) {
      if (state.roomSeatDraft.seatTypes.length <= 1) {
        showToast("A sala precisa manter pelo menos um tipo de poltrona.", "error");
        return;
      }
      const fallback = state.roomSeatDraft.seatTypes.find((type) => type.id !== id)?.id;
      state.roomSeatDraft.seatTypes = state.roomSeatDraft.seatTypes.filter((type) => type.id !== id);
      state.roomSeatDraft.rows.forEach((row) => row.seats.forEach((seat) => { if (seat.typeId === id) seat.typeId = fallback; }));
      renderRoomSeatTypes();
      renderRoomSeatMap();
    }

    function selectRoomSeatElement(selection) {
      state.roomSeatSelection = selection;
      renderRoomSeatMap();
    }

    function updateRoomSeatSelectionField(field, value) {
      const selection = state.roomSeatSelection;
      const targets = roomSeatTargets(selection);
      if (!selection || !targets.length) return;
      if (field === "label") {
        if (selection.kind === "seat") {
          targets[0].label = String(value || "").trim().slice(0, 16) || targets[0].label;
          targets[0].customLabel = true;
        }
        if (selection.kind === "row") {
          const row = selectedRoomSeatRow();
          if (!row) return;
          const previous = String(row.label || "");
          const next = String(value || "").trim().slice(0, 8) || previous;
          row.label = next;
          row.seats.forEach((seat) => {
            if (new RegExp(`^${previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`, "i").test(seat.label)) {
              seat.label = `${next}${seat.label.slice(previous.length)}`;
            }
          });
          renumberRoomSeatRow(row);
        }
      } else if (field === "typeId" && value) {
        targets.forEach((seat) => {
          seat.typeId = value;
          seat.color = "";
        });
      } else if (field === "color") {
        targets.forEach((seat) => { seat.color = value; });
      } else if (field === "enabled") {
        targets.forEach((seat) => { seat.enabled = Boolean(value); });
      } else if (field === "aisleAfter" && selection.kind === "seat") {
        targets[0].aisleAfter = Boolean(value);
      } else if (field === "accessibility" && ["", "wheelchair", "obese"].includes(value)) {
        targets.forEach((seat) => { seat.accessibility = value; });
      }
      renderRoomSeatMap(field === "typeId" || field === "accessibility");
    }

    function insertRoomSeatAt(row, index, typeId) {
      const seat = createRoomSeat(row, typeId);
      row.seats.splice(Math.max(0, Math.min(index, row.seats.length)), 0, seat);
      renumberRoomSeatRow(row);
      return seat;
    }

    function insertRoomSeatRow(index) {
      const rows = state.roomSeatDraft.rows;
      if (rows.length >= 40) return showToast("O mapa permite no máximo 40 fileiras.", "error");
      const label = nextRoomRowLabel();
      const row = { id: `row-${Date.now().toString(36)}`, label, seats: [] };
      const columnCount = Math.max(1, ...rows.map((candidate) => candidate.seats.length));
      const typeId = state.roomSeatDraft.seatTypes[0]?.id || "standard";
      rows.splice(Math.max(0, Math.min(index, rows.length)), 0, row);
      for (let column = 0; column < columnCount; column += 1) row.seats.push(createRoomSeat(row, typeId));
      state.roomSeatSelection = { kind: "row", rowId: row.id };
    }

    function insertRoomSeatColumn(index) {
      const rows = state.roomSeatDraft.rows;
      const maxColumns = Math.max(0, ...rows.map((row) => row.seats.length));
      if (maxColumns >= 80) return showToast("O mapa permite no máximo 80 colunas.", "error");
      rows.forEach((row) => insertRoomSeatAt(row, index, row.seats[Math.max(0, index - 1)]?.typeId));
      state.roomSeatSelection = { kind: "column", columnIndex: Math.max(0, index) };
    }

    function handleRoomSeatSelectionAction(action) {
      const selection = state.roomSeatSelection;
      const rows = state.roomSeatDraft?.rows || [];
      if (!selection) return;
      if (action === "clear") {
        state.roomSeatSelection = null;
        return renderRoomSeatMap();
      }
      if (action === "color-reset") {
        roomSeatTargets(selection).forEach((seat) => { seat.color = ""; });
        return renderRoomSeatMap();
      }
    
      if (selection.kind === "seat") {
        const row = rows.find((candidate) => candidate.seats.some((seat) => seat.id === selection.seatId));
        const seatIndex = row?.seats.findIndex((seat) => seat.id === selection.seatId) ?? -1;
        if (!row || seatIndex < 0) return;
        if (action === "seat-before" || action === "seat-after") {
          const nextSeat = insertRoomSeatAt(row, seatIndex + (action === "seat-after" ? 1 : 0), row.seats[seatIndex].typeId);
          state.roomSeatSelection = { kind: "seat", seatId: nextSeat.id };
        }
        if (action === "seat-delete") {
          const total = rows.reduce((sum, candidate) => sum + candidate.seats.length, 0);
          if (total <= 1) return showToast("A sala precisa manter pelo menos uma cadeira.", "error");
          if (!confirm(`Excluir a cadeira ${row.seats[seatIndex].label}? A alteração será confirmada ao salvar a sala.`)) return;
          row.seats.splice(seatIndex, 1);
          renumberRoomSeatRow(row);
          state.roomSeatSelection = null;
        }
      } else if (selection.kind === "row") {
        const rowIndex = rows.findIndex((row) => row.id === selection.rowId);
        if (rowIndex < 0) return;
        if (action === "row-before" || action === "row-after") insertRoomSeatRow(rowIndex + (action === "row-after" ? 1 : 0));
        if (action === "row-seat-left" || action === "row-seat-right") {
          const row = rows[rowIndex];
          if (row.seats.length >= 80) return showToast("Uma fileira permite no máximo 80 cadeiras.", "error");
          const addLeft = action === "row-seat-left";
          const seat = insertRoomSeatAt(row, addLeft ? 0 : row.seats.length, (addLeft ? row.seats[0] : row.seats.at(-1))?.typeId);
          state.roomSeatSelection = { kind: "seat", seatId: seat.id };
        }
        if (action === "row-delete") {
          if (rows.length <= 1) return showToast("A sala precisa manter pelo menos uma fileira.", "error");
          if (!confirm(`Excluir a fileira ${rows[rowIndex].label} e todas as suas cadeiras?`)) return;
          rows.splice(rowIndex, 1);
          state.roomSeatSelection = null;
        }
      } else if (selection.kind === "column") {
        const columnIndex = Number(selection.columnIndex);
        if (action === "column-before" || action === "column-after") insertRoomSeatColumn(columnIndex + (action === "column-after" ? 1 : 0));
        if (action === "column-delete") {
          const maxColumns = Math.max(0, ...rows.map((row) => row.seats.length));
          if (maxColumns <= 1) return showToast("A sala precisa manter pelo menos uma coluna.", "error");
          if (!confirm(`Excluir a coluna ${columnIndex + 1} em todas as fileiras?`)) return;
          rows.forEach((row) => {
            if (row.seats[columnIndex]) row.seats.splice(columnIndex, 1);
            renumberRoomSeatRow(row);
          });
          state.roomSeatSelection = null;
        }
      }
      renderRoomSeatMap();
    }

    return { defaultRoomSeatDraft, roomSeatAccessibilityLabel, roomSeatAccessibilityIcon, roomSeatColor, roomSeatTypeOptions, roomSeatTargets, selectedRoomSeatRow, uniqueRoomSeatId, nextRoomRowLabel, renumberRoomSeatRow, createRoomSeat, renderRoomSeatTypes, renderRoomSeatSelectionPanel, renderRoomSeatMap, renderRoomSeatEditor, generateRoomSeatMap, addRoomSeatType, removeRoomSeatType, selectRoomSeatElement, updateRoomSeatSelectionField, insertRoomSeatAt, insertRoomSeatRow, insertRoomSeatColumn, handleRoomSeatSelectionAction };
  }

  const api = Object.freeze({ createRoomSeatEditor });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.roomSeatEditor = api; }
})(globalThis);
