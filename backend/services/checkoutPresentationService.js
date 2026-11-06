const { toCustomerTicketDto } = require("./customerTicketDtoService");

function findExistingCheckout(db, order, method) {
  const existingOrder = (db.orders || []).find((item) =>
    item.id === order.id || (order.idempotencyKey && item.idempotencyKey === order.idempotencyKey)
  );
  if (!existingOrder) return null;
  const payment = (db.payments || []).find((item) => item.orderId === existingOrder.id && (!method || item.method === method));
  return {
    order: existingOrder,
    payment,
    tickets: (db.tickets || []).filter((ticket) => ticket.orderId === existingOrder.id)
  };
}

function createCheckoutPresentationService({ enrichTicket }) {
function sanitizeCheckoutOrder(order) {
  if (!order) return null;
  const { customerName, customerEmail, customerPhone, customerCpf, metadata, ...safeOrder } = order;
  return safeOrder;
}

function sanitizeCheckoutPayment(payment) {
  if (!payment) return null;
  const { metadata, raw, ...safePayment } = payment;
  return safePayment;
}

function sanitizeCheckoutTicket(ticket) {
  if (!ticket) return null;
  return toCustomerTicketDto(ticket);
}

function checkoutResponse(db, order, payment, tickets = []) {
  return {
    order: sanitizeCheckoutOrder(order),
    payment: sanitizeCheckoutPayment(payment),
    tickets: tickets.map((ticket) => sanitizeCheckoutTicket(enrichTicket(db, ticket)))
  };
}

  return { checkoutResponse };
}

module.exports = { findExistingCheckout, createCheckoutPresentationService };
