const { test, expect } = require("@playwright/test");
const WebSocket = require("ws");
const crypto = require("crypto");

const BACKEND = "http://127.0.0.1:4000";

function tomorrowBr() {
  const date = new Date(Date.now() + 86400000);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

async function loginAdmin(page) {
  await page.goto(`${BACKEND}/admin`);
  await page.locator("#email").fill("admin-e2e@cine.local");
  await page.locator("#password").fill("Admin-e2e-2026!");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 10000 });
}

test("operador conclui venda rápida com ingresso e bomboniere pela interface do painel", async ({ page, request }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await loginAdmin(page);
  await page.getByRole("button", { name: "Bilheteria", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bilheteria" })).toBeVisible();
  await page.getByRole("button", { name: "Venda rápida" }).click();
  await page.locator("#manualSessionDate").fill(tomorrowBr());
  await page.locator("#manualSessionDate").press("Tab");
  await expect(page.locator("#manualMovieSelect")).toContainText("Filme E2E");
  await page.locator("#manualMovieSelect").selectOption("filme-e2e");
  await page.locator("#manualSessionSelect").selectOption("sessao-e2e");
  await expect(page.getByLabel("Quantidade de Ingresso Inteiro")).toHaveValue("1");
  await page.getByRole("button", { name: "Adicionar Pipoca E2E" }).click();
  await expect(page.getByLabel("Quantidade de Pipoca E2E")).toHaveValue("1");
  const summary = page.locator("#manualSaleSummary");
  await expect(summary).toContainText("Filme E2E");
  await expect(summary).toContainText("1× Ingresso Inteiro");
  await expect(summary).toContainText("1× Pipoca E2E");
  await expect(summary).toContainText("R$ 23,00");
  await expect(summary).toHaveCSS("position", "sticky");
  await page.getByRole("button", { name: "Adicionar filme à venda" }).click();
  await expect(page.locator("#manualSaleItems")).toContainText("Filme E2E");
  await expect(page.locator("#manualSaleItems")).toContainText("1× Ingresso Inteiro");
  await page.getByRole("button", { name: "Finalizar venda rápida" }).click();
  await expect(page.getByText("Venda finalizada")).toBeVisible({ timeout: 10000 });

  const login = await request.post(`${BACKEND}/api/admin/login`, {
    data: { email: "admin-e2e@cine.local", password: "Admin-e2e-2026!" }
  });
  expect(login.ok()).toBeTruthy();
  const contentResponse = await request.get(`${BACKEND}/api/admin/content`);
  const content = await contentResponse.json();
  const order = content.orders.find((item) => item.origin === "box_office" && item.saleMode === "quick");
  expect(order).toBeTruthy();
  expect(order.status).toBe("paid");
  expect(order.concessionItems).toEqual(expect.arrayContaining([expect.objectContaining({ id: "pipoca-e2e", quantity: 1 })]));
  expect(content.tickets.filter((ticket) => ticket.orderId === order.id)).toHaveLength(1);
});

function connectSeatClient(ownerToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("ws://127.0.0.1:4000/api/realtime/seats");
    const messages = [];
    const timer = setTimeout(() => reject(new Error("Timeout ao conectar no WebSocket de poltronas.")), 8000);
    socket.on("error", reject);
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      messages.push(message);
      if (message.type === "session_state") {
        clearTimeout(timer);
        resolve({ socket, messages });
      }
    });
    socket.on("open", () => socket.send(JSON.stringify({
      type: "join_session",
      requestId: crypto.randomUUID(),
      sessionId: "sessao-poltronas-e2e",
      ownerToken
    })));
  });
}

function selectSeat(client, seatId) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => reject(new Error("Timeout ao selecionar poltrona.")), 8000);
    const listener = (raw) => {
      const message = JSON.parse(String(raw));
      if (message.requestId !== requestId) return;
      if (!["select_seat_confirmed", "select_seat_rejected"].includes(message.type)) return;
      clearTimeout(timer);
      client.socket.off("message", listener);
      resolve(message);
    };
    client.socket.on("message", listener);
    client.socket.send(JSON.stringify({ type: "select_seat", requestId, seatId }));
  });
}

test("primeiro operador bloqueia a poltrona e o concorrente recebe rejeição imediata com broadcast", async () => {
  const first = await connectSeatClient("operador-e2e-1");
  const second = await connectSeatClient("operador-e2e-2");
  try {
    const results = await Promise.all([selectSeat(first, "A1"), selectSeat(second, "A1")]);
    expect(results.map((item) => item.type).sort()).toEqual(["select_seat_confirmed", "select_seat_rejected"]);
    const loser = results.find((item) => item.type === "select_seat_rejected");
    expect(loser.code).toBe("SEAT_ALREADY_HELD");
    await expect.poll(() => second.messages.some((message) => (
      message.type === "seat_status_changed" && message.seatId === "A1" && message.status === "held"
    ))).toBeTruthy();
  } finally {
    first.socket.close();
    second.socket.close();
  }
});

test("cliente móvel reconecta após rede temporariamente offline e recupera estado após refresh", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(target, args) {
        const socket = new target(...args);
        window.__lastSeatTestSocket = socket;
        return socket;
      }
    });
  });
  await page.goto("/checkout/sessao-poltronas-e2e");
  await expect(page.getByText(/Conectando à reserva|Reconectando à reserva/)).toHaveCount(0, { timeout: 10000 });
  await page.getByRole("button", { name: /^A2,/ }).click();
  await expect(page.getByRole("button", { name: /^A2,/ })).toHaveAttribute("aria-pressed", "true");
  await context.setOffline(true);
  await page.evaluate(() => window.__lastSeatTestSocket?.close());
  await expect(page.getByText("Reconectando à reserva de poltronas...")).toBeVisible({ timeout: 10000 });
  await context.setOffline(false);
  await expect(page.getByText(/Conectando à reserva|Reconectando à reserva/)).toHaveCount(0, { timeout: 15000 });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText(/Conectando à reserva|Reconectando à reserva/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Conectando à reserva|Reconectando à reserva/)).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole("button", { name: /^A2,/ })).toHaveAttribute("aria-pressed", "true");
});
