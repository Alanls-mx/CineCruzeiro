// Commercial read routes mounted at their original dispatcher slots.
function createAdminOrderReadRoutes(deps) {
  const { postgresEnabled, orderRepository, orderPayment, orderTickets, enrichTicket, sendJson } = deps;

  async function handleAdminOrderListRead({ req, res, pathname, method, db }) {
    if (pathname === "/api/orders" && method === "GET") {
      sendJson(res, 200, postgresEnabled() ? await orderRepository.list() : db.orders);
      return true;
    }
    return false;
  }

  async function handleAdminOrderDetailRead({ req, res, pathname, method, db, adminOrderMatch }) {
    if (adminOrderMatch && method === "GET") {
      const orderId = decodeURIComponent(adminOrderMatch[1]);
      const order = postgresEnabled()
        ? await orderRepository.findById(orderId)
        : (db.orders || []).find((item) => item.id === orderId);
      if (!order) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return true;
      }
      sendJson(res, 200, {
        order,
        payment: orderPayment(db, order.id),
        tickets: orderTickets(db, order.id).map((ticket) => enrichTicket(db, ticket))
      });
      return true;
    }
    return false;
  }

  return { handleAdminOrderListRead, handleAdminOrderDetailRead };
}

module.exports = { createAdminOrderReadRoutes };
