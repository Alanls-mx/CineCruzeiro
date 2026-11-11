const { test, expect } = require("@playwright/test");

const backend = "http://127.0.0.1:4000";

test("admin troca ingresso de filme e poltrona mantendo a venda", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${backend}/admin`);
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const sale = await page.request.post(`${backend}/api/box-office/sales`, { data: {
    saleMode: "guest", ticketDeliveryMethod: "online", customerName: "Cliente Troca",
    customerEmail: "troca@e2e.local", paymentMethod: "cash",
    saleItems: [{ movieId: "filme-e2e", sessionId: "sessao-e2e",
      ticketItems: [{ id: "inteira-e2e", quantity: 1 }], selectedSeatIds: [], autoAssignSeats: false }],
    concessionItems: []
  } });
  expect(sale.status()).toBe(201);
  const sold = await sale.json();
  const ticketId = sold.tickets[0].id;
  const orderId = sold.orders[0].id;
  await page.goto(`${backend}/admin#ticketsPanel`);
  const action = page.locator(`[data-admin-ticket-action="change-session"][data-admin-ticket-value="${ticketId}"]`);
  await expect(action).toBeVisible();
  await page.locator(`[data-admin-ticket-action="order"][data-admin-ticket-value="${orderId}"]`).click();
  await expect(page.locator("#orderOverlay")).toBeVisible();
  const orderAction = page.locator(`#orderDetailBody [data-admin-ticket-action="change-session"][data-admin-ticket-value="${ticketId}"]`);
  await expect(orderAction).toBeVisible();
  await orderAction.click();
  await expect(page.locator("#orderOverlay")).toBeHidden();
  await expect(page.locator("#ticketSessionChangeOverlay")).toBeVisible();
  await page.locator("#ticketSessionChangeSession").selectOption("sessao-poltronas-e2e");
  await expect(page.locator('#ticketSessionChangeSeat option[value="A1"]')).toHaveCount(1);
  await page.locator("#ticketSessionChangeSeat").selectOption("A1");
  await page.locator("#ticketSessionChangeSubmit").click();
  await expect(page.locator("#ticketSessionChangeOverlay")).toBeHidden();
  const content = await (await page.request.get(`${backend}/api/admin/content`)).json();
  const ticket = content.tickets.find((item) => item.id === ticketId);
  const order = content.orders.find((item) => item.id === orderId);
  expect(ticket.sessionId).toBe("sessao-poltronas-e2e");
  expect(ticket.movieId).toBe("filme-poltronas-e2e");
  expect(ticket.seat).toBe("A1");
  expect(order.totalPrice).toBe(sold.orders[0].totalPrice);
  expect(order.sessionId).toBe("sessao-e2e");
  expect(pageErrors).toEqual([]);
});
