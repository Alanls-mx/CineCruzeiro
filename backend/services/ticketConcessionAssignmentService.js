function orderTicketsSorted(db, orderId) {
  return (db.tickets || [])
    .filter((ticket) => ticket.orderId === orderId)
    .sort((left, right) => String(left.createdAt || left.id || "").localeCompare(String(right.createdAt || right.id || "")));
}

function concessionTicketIdForOrder(db, order) {
  if (!order || !(order.concessionItems || []).length) return "";
  const explicit = String(order.concessionTicketId || "").trim();
  if (explicit && (db.tickets || []).some((ticket) => ticket.id === explicit)) return explicit;
  return orderTicketsSorted(db, order.id)[0]?.id || "";
}

function concessionOrdersForTicket(db, ticket) {
  if (!ticket) return [];
  return (db.orders || []).filter((order) =>
    (order.concessionItems || []).length > 0 && concessionTicketIdForOrder(db, order) === ticket.id
  );
}

function concessionItemPending(item = {}) {
  return item.status !== "cancelled"
    && item.refundStatus !== "completed"
    && Number(item.quantity || 0) > Number(item.fulfilledQuantity || 0);
}

function pendingConcessionOrdersForTicket(db, ticket) {
  return concessionOrdersForTicket(db, ticket).filter((order) =>
    order.status === "paid"
    && order.concessionStatus !== "cancelled"
    && !order.concessionCancelledAt
    && order.concessionRefund?.status !== "completed"
    && (order.concessionItems || []).some(concessionItemPending)
  );
}

function assignConcessionsToTicket(orders = [], ticketId, updatedAt = new Date().toISOString()) {
  for (const order of orders) {
    order.concessionTicketId = ticketId;
    order.concessionTicketUpdatedAt = updatedAt;
  }
  return orders;
}

module.exports = {
  assignConcessionsToTicket,
  concessionItemPending,
  concessionOrdersForTicket,
  concessionTicketIdForOrder,
  orderTicketsSorted,
  pendingConcessionOrdersForTicket
};
