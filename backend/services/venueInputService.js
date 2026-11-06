function createVenueInputService({ slugify }) {
  function normalizeRoom(input, existing = {}) {
    const cleanupMinutes = Number(input.cleanupMinutes ?? existing.cleanupMinutes ?? 20);
    if (!Number.isInteger(cleanupMinutes) || cleanupMinutes < 0 || cleanupMinutes > 120) {
      throw Object.assign(new Error("Informe um intervalo de limpeza entre 0 e 120 minutos inteiros."), { statusCode: 422, code: "ROOM_CLEANUP_INVALID" });
    }
    const name = String(input.name || existing.name || "Nova Sala").trim();
    const rawTypes = Array.isArray(input.seatTypes) ? input.seatTypes : (Array.isArray(existing.seatTypes) ? existing.seatTypes : []);
    const seatTypes = rawTypes.map((type, index) => ({
      id: String(type.id || slugify(type.name || "") || `tipo-${index + 1}`).trim(),
      name: String(type.name || `Tipo ${index + 1}`).trim().slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(String(type.color || "")) ? String(type.color) : "#2563eb",
      description: String(type.description || "").trim().slice(0, 120)
    })).filter((type, index, items) => type.id && items.findIndex((item) => item.id === type.id) === index);
    if (!seatTypes.length) seatTypes.push({ id: "standard", name: "Padrão", color: "#2563eb", description: "Poltrona convencional" });
    const allowedTypeIds = new Set(seatTypes.map((type) => type.id));
    const rawRows = Array.isArray(input.seatLayout?.rows)
      ? input.seatLayout.rows
      : (Array.isArray(existing.seatLayout?.rows) ? existing.seatLayout.rows : []);
    const seenSeatIds = new Set();
    const rows = rawRows.slice(0, 40).map((row, rowIndex) => {
      const rowLabel = String(row.label || String.fromCharCode(65 + rowIndex)).trim().slice(0, 8);
      const rowId = String(row.id || slugify(rowLabel) || `fila-${rowIndex + 1}`).trim();
      const seats = (Array.isArray(row.seats) ? row.seats : []).slice(0, 80).map((seat, seatIndex) => {
        const label = String(seat.label || `${rowLabel}${seatIndex + 1}`).trim().slice(0, 16);
        const typeId = allowedTypeIds.has(String(seat.typeId || "")) ? String(seat.typeId) : seatTypes[0].id;
        return {
          id: String(seat.id || `${rowId}-${seatIndex + 1}`).trim(),
          label,
          typeId,
          color: /^#[0-9a-f]{6}$/i.test(String(seat.color || "")) ? String(seat.color) : "",
          accessibility: ["wheelchair", "obese"].includes(String(seat.accessibility || "")) ? String(seat.accessibility) : "",
          customLabel: seat.customLabel === true,
          enabled: seat.enabled !== false,
          aisleAfter: Boolean(seat.aisleAfter)
        };
      }).filter((seat) => {
        if (!seat.id || seenSeatIds.has(seat.id)) return false;
        seenSeatIds.add(seat.id);
        return true;
      });
      return { id: rowId, label: rowLabel, seats };
    }).filter((row) => row.seats.length);
    const seatSelectionEnabled = input.seatSelectionEnabled !== undefined
      ? Boolean(input.seatSelectionEnabled)
      : Boolean(existing.seatSelectionEnabled);
    const enabledSeatCount = rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat.enabled !== false).length, 0);
    return {
      id: String(input.id || existing.id || slugify(name) || `sala-${Date.now()}`),
      name,
      capacity: seatSelectionEnabled && enabledSeatCount ? enabledSeatCount : Math.max(1, Number(input.capacity ?? existing.capacity ?? 80)),
      technology: input.technology || existing.technology || "",
      cleanupMinutes,
      status: input.status || existing.status || "active",
      seatSelectionEnabled,
      seatTypes,
      seatLayout: {
        screenLabel: String(input.seatLayout?.screenLabel || existing.seatLayout?.screenLabel || "TELA").trim().slice(0, 40),
        rows
      }
    };
  }

  function normalizeTicketType(input, existing = {}) {
    const name = String(input.name || existing.name || "Ingresso").trim();
    return {
      id: String(input.id || existing.id || slugify(name) || `ingresso-${Date.now()}`),
      name,
      price: Number(input.price ?? existing.price ?? 10),
      description: input.description || existing.description || "",
      bundleQuantity: Math.max(1, Math.min(20, Math.floor(Number(input.bundleQuantity ?? existing.bundleQuantity ?? 1) || 1))),
      active: input.active !== undefined ? Boolean(input.active) : existing.active !== false
    };
  }
  return { normalizeRoom, normalizeTicketType };
}

module.exports = { createVenueInputService };
