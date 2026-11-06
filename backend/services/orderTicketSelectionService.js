function ticketTypesForSession(db, session) {
  const activeTicketTypes = (db.ticketTypes || []).filter((ticketType) => ticketType.active !== false);
  const allowedIds = Array.isArray(session?.ticketTypeIds) && session.ticketTypeIds.length
    ? new Set(session.ticketTypeIds.map(String))
    : new Set(activeTicketTypes.map((ticketType) => ticketType.id));
  return activeTicketTypes.filter((ticketType) => allowedIds.has(ticketType.id));
}

function resolveOrderTicketItems(db, order, session) {
  const availableTypes = ticketTypesForSession(db, session);
  const byId = new Map(availableTypes.map((ticketType) => [ticketType.id, ticketType]));
  const requested = Array.isArray(order.ticketItems) ? order.ticketItems : [];
  const normalized = [];

  const addItem = (ticketType, quantity) => {
    const safeQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
    const bundleQuantity = Math.max(1, Math.min(20, Math.floor(Number(ticketType?.bundleQuantity || 1))));
    if (!ticketType || !safeQuantity) return;
    const existing = normalized.find((item) => item.id === ticketType.id);
    if (existing) {
      existing.quantity += safeQuantity;
      existing.ticketQuantity = existing.quantity * bundleQuantity;
      return;
    }
    normalized.push({
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description || "",
      quantity: safeQuantity,
      bundleQuantity,
      ticketQuantity: safeQuantity * bundleQuantity,
      unitPrice: Math.max(0, Number(ticketType.price || 0))
    });
  };

  if (requested.length) {
    requested.forEach((item) => {
      const ticketType = byId.get(String(item.id || item.ticketTypeId || ""));
      if (!ticketType) {
        const error = new Error("Um dos tipos de ingresso selecionados não está disponível nesta sessão.");
        error.statusCode = 409;
        error.code = "SESSION_TICKET_TYPE_UNAVAILABLE";
        throw error;
      }
      addItem(ticketType, item.quantity);
    });
    return normalized;
  }

  // Compatibilidade com pedidos antigos criados antes dos tipos por sessão.
  const fullType = availableTypes.find((ticketType) => /inteira|normal|adulto/i.test(ticketType.name))
    || availableTypes.find((ticketType) => !/meia/i.test(ticketType.name))
    || availableTypes[0];
  const halfType = availableTypes.find((ticketType) => /meia/i.test(ticketType.name))
    || availableTypes[1]
    || availableTypes[0];
  addItem(fullType, order.fullTicketsCount);
  addItem(halfType, order.halfTicketsCount);
  return normalized;
}

module.exports = { ticketTypesForSession, resolveOrderTicketItems };
