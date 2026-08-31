const { test, expect } = require("@playwright/test");

const BACKEND = "http://127.0.0.1:4000";

test("sessão com vendas exige confirmação, sincroniza horário e cancelamento invalida ingresso", async ({ request }) => {
  const login = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(login.ok()).toBeTruthy();

  const sale = await request.post(`${BACKEND}/api/box-office/sales`, {
    data: {
      saleMode: "quick",
      paymentMethod: "cash",
      saleItems: [{
        movieId: "filme-e2e",
        sessionId: "sessao-e2e",
        ticketItems: [{ id: "inteira-e2e", quantity: 1 }],
        selectedSeatIds: [],
        autoAssignSeats: false
      }],
      concessionItems: []
    }
  });
  expect(sale.status()).toBe(201);
  const sold = await sale.json();
  const order = sold.orders[0];
  const ticket = sold.tickets[0];

  const sessionBody = {
    date: order.sessionDate,
    dateChanged: true,
    time: "20:30",
    format: "2D Dublado",
    room: "Sala Livre E2E",
    ticketTypeIds: ["inteira-e2e", "meia-e2e"],
    status: "available"
  };
  const unconfirmed = await request.put(`${BACKEND}/api/movies/filme-e2e/sessions/sessao-e2e`, { data: sessionBody });
  expect(unconfirmed.status()).toBe(409);
  expect((await unconfirmed.json()).error.code).toBe("SESSION_CHANGE_CONFIRMATION_REQUIRED");

  const confirmed = await request.put(`${BACKEND}/api/movies/filme-e2e/sessions/sessao-e2e`, {
    data: { ...sessionBody, confirmSalesImpact: true, changeReason: "Ajuste operacional E2E" }
  });
  expect(confirmed.ok()).toBeTruthy();
  expect((await confirmed.json()).time).toBe("20:30");

  let content = await (await request.get(`${BACKEND}/api/admin/content`)).json();
  expect(content.orders.find((item) => item.id === order.id).sessionTime).toBe("20:30");
  expect(content.tickets.find((item) => item.id === ticket.id).sessionTime).toBe("20:30");
  expect(content.auditLogs.some((item) => item.action === "session.updated" && item.entityId === "sessao-e2e")).toBeTruthy();

  const deletion = await request.delete(`${BACKEND}/api/movies/filme-e2e/sessions/sessao-e2e`);
  expect(deletion.status()).toBe(409);
  expect((await deletion.json()).error.code).toBe("SESSION_HAS_HISTORY");

  const cancelled = await request.put(`${BACKEND}/api/movies/filme-e2e/sessions/sessao-e2e`, {
    data: {
      ...sessionBody,
      time: "20:30",
      status: "cancelled",
      confirmSalesImpact: true,
      changeReason: "Sessão cancelada no teste E2E"
    }
  });
  expect(cancelled.ok()).toBeTruthy();
  content = await (await request.get(`${BACKEND}/api/admin/content`)).json();
  const cancelledTicket = content.tickets.find((item) => item.id === ticket.id);
  const affectedOrder = content.orders.find((item) => item.id === order.id);
  const affectedPayment = content.payments.find((item) => item.orderId === order.id);
  expect(cancelledTicket.status).toBe("cancelled");
  expect(affectedOrder.refundStatus).toBe("required");
  expect(affectedPayment.refundStatus).toBe("required");
  expect(content.auditLogs.some((item) => item.action === "session.cancelled" && item.entityId === "sessao-e2e")).toBeTruthy();

  const validation = await request.post(`${BACKEND}/api/tickets/validate`, { data: { code: ticket.code } });
  expect(validation.status()).toBe(409);
});
