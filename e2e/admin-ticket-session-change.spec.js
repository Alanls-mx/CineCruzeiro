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
  await expect(page.locator("#orderOverlay [data-admin-ticket-action='change-session']")).toHaveCount(0);
  await page.locator("#orderOverlayCloseButton").click();
  await page.goto(`${backend}/admin#ordersPanel`);
  await page.locator('[data-box-office-tab="allOrders"]').click();
  await page.locator(`#ordersList [data-admin-order-action="menu"][data-admin-order-id="${orderId}"]`).click();
  const orderAction = page.locator(`#floatingActionMenu [data-floating-order-action="change-session"][data-ticket-id="${ticketId}"]`);
  await expect(orderAction).toHaveText("Trocar sessão");
  await orderAction.click();
  await expect(page.locator("#orderOverlay")).toBeHidden();
  await expect(page.locator("#ticketSessionChangeOverlay")).toBeVisible();
  await expect(page.locator("#ticketSessionChangeSummary")).toContainText(/\d{2}\/\d{2}\/\d{4} às \d{2}h\d{2}/);
  await expect(page.locator("#ticketSessionChangeSession option[value='sessao-troca-e2e']")).toContainText(/\d{2}\/\d{2}\/\d{4} às \d{2}h\d{2}/);
  await page.locator("#ticketSessionChangeSession").selectOption("sessao-troca-e2e");
  await expect(page.locator('#ticketSessionChangeSeat option[value="A1"]')).toHaveCount(1);
  await page.locator("#ticketSessionChangeSeat").selectOption("A1");
  await page.locator("#ticketSessionChangeSubmit").click();
  await expect(page.locator("#ticketSessionChangeOverlay")).toBeHidden();
  const content = await (await page.request.get(`${backend}/api/admin/content`)).json();
  const ticket = content.tickets.find((item) => item.id === ticketId);
  const order = content.orders.find((item) => item.id === orderId);
  expect(ticket.sessionId).toBe("sessao-troca-e2e");
  expect(ticket.movieId).toBe("filme-poltronas-e2e");
  expect(ticket.seat).toBe("A1");
  expect(order.totalPrice).toBe(sold.orders[0].totalPrice);
  expect(order.sessionId).toBe("sessao-e2e");
  expect(pageErrors).toEqual([]);
});
