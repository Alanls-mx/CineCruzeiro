function attachQuickSaleAttendeeNames(order, requestedNames) {
  const required = (order.ticketItems || []).reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.ticketQuantity ?? Number(item.quantity || 0) * Number(item.bundleQuantity || 1)))), 0);
  const names = Array.isArray(requestedNames) ? requestedNames : [];
  const normalized = names.map((value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
  if (required < 1 || normalized.length !== required || normalized.some((name) => name.length < 2 || name.length > 80 || !/\p{L}/u.test(name) || /[\p{Cc}\p{Cf}]/u.test(name))) {
    const error = new Error(`Informe o nome de cada um dos ${required} ingresso(s) da venda rápida.`);
    error.statusCode = 422;
    error.code = "BOX_OFFICE_ATTENDEE_NAMES_INVALID";
    throw error;
  }
  order.attendeeNames = normalized;
  return order;
}

module.exports = { attachQuickSaleAttendeeNames };
