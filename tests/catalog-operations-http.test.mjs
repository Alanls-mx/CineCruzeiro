import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
test("catalog, sessions and accounting HTTP regressions in isolated JSON storage", { timeout: 90000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-catalog-test-"));
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(temp, "db.json");
  const past = { id: "past", date: "2020-01-01", time: "19:00", room: "Sala", roomId: "room", format: "2D", status: "available", ticketTypeIds: ["full"], priceFull: 20, priceHalf: 20 };
  const future = { ...past, id: "future", date: "2099-01-01" };
  const movies = [
    { id: "history", title: "Filme com histórico", slug: "history", sessions: [past] },
    { id: "unused", title: "Filme sem vínculos", slug: "unused", sessions: [] },
    { id: "booked", title: "Filme reservado", slug: "booked", sessions: [future] }
  ].map((movie) => ({ ...movie, workflowStatus: "draft", status: "upcoming", duration: "120 min", genre: [], rating: "L", metadata: {} }));
  await fs.writeFile(dataFile, JSON.stringify({
    settings: { cinemaName: "Cine Cruzeiro QA", adminTwoFactorRequired: false },
    movies,
    rooms: [{ id: "room", name: "Sala", capacity: 50, status: "active" }],
    ticketTypes: [{ id: "full", name: "Inteira", active: true, price: 20 }],
    orders: [{ id: "historical", movieId: "history", sessionId: "past", status: "paid", totalPrice: 20, paidAt: "2020-01-01T18:00:00Z", createdAt: "2020-01-01T18:00:00Z" }],
    tickets: [
      { id: "issued", movieId: "booked", sessionId: "future", orderId: "future-order", code: "QA-TEST", status: "active" },
      { id: "historical-ticket", movieId: "history", sessionId: "past", orderId: "historical", code: "QA-PAST", status: "used", ticketType: "Inteira", price: 20 }
    ],
    users: [{ id: "qa-owner", name: "QA", email: "catalog-qa@example.test", role: "owner", active: true, passwordHash: "" }]
  }));
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1", NODE_ENV: "test", DATA_STORE: "json", CINE_DATA_FILE: dataFile,
      CINE_UPLOADS_DIR: path.join(temp, "uploads"), CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"), CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"),
      ADMIN_EMAIL: "catalog-qa@example.test", ADMIN_PASSWORD: "catalog-qa-only-123456", JWT_SECRET: "catalog-qa-local-secret-never-deploy", MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", PAYMENTS_MODE: "test", TEST_PAYMENTS_AUTO_APPROVE: "false", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base }
  });
  // Drain diagnostics without exposing environment-derived information.
  child.stdout.resume();
  child.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}`);
      try { const response = await fetch(`${base}/api/health`); ready = response.ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, "isolated backend ready");
    for (const endpoint of ["/api/admin/whatsapp", "/api/admin/whatsapp/api/session", "/api/admin/whatsapp/api/staff", "/admin/whatsapp/", "/admin//whatsapp/index.html", "/admin/whatsapp/assets/old.js", "/whatsapp/webhook"]) {
      for (const method of ["GET", "POST"]) {
        const retired = await fetch(`${base}${endpoint}`, { method });
        assert.equal(retired.status, 410, `${method} ${endpoint}`);
        assert.equal((await retired.json()).error.code, "MODULE_REMOVED");
      }
    }
    const login = await fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "catalog-qa@example.test", password: "catalog-qa-only-123456" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const directShell = await fetch(`${base}/admin/admin.html`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(directShell.status, 200, "admin shell no longer depends on removed WhatsApp permission");
    const request = async (url, method = "GET", body) => {
      const response = await fetch(`${base}${url}`, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await request("/api/movies/booked", "DELETE")).status, 409);
    const removed = await request("/api/movies/history", "DELETE");
    assert.equal(removed.status, 200, JSON.stringify(removed.data));
    assert.equal(removed.data.deleted, true);
    assert.equal(removed.data.historyPreserved, true);
    assert.equal((await request("/api/movies/unused", "DELETE")).data.historyPreserved, false);
    const content = await request("/api/admin/content");
    assert.equal(content.status, 200);
    assert.equal(content.data.movies.some((movie) => ["history", "unused"].includes(movie.id)), false);
    const stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
    assert.equal(stored.orders.find((order) => order.id === "historical").totalPrice, 20);
    assert.ok(stored.movies.find((movie) => movie.id === "history").metadata.catalogDeletedAt);
    assert.equal(stored.movies.some((movie) => movie.id === "unused"), false);
    assert.equal((await request("/api/movies/history", "PUT", { title: "Restore accidentally" })).status, 404);
    assert.equal((await request("/api/movies/history/sessions", "POST", future)).status, 404);
    const reordered = await request("/api/movies/order", "PUT", { ids: ["booked"] });
    assert.equal(reordered.data.movies.some((movie) => movie.id === "history"), false);
    const recreated = await request("/api/movies", "POST", { id: "history", slug: "history", title: "Novo cadastro", workflowStatus: "draft" });
    assert.equal(recreated.status, 201, JSON.stringify(recreated.data));
    assert.notEqual(recreated.data.id, "history");
    for (const values of [{ date: "2026-02-30", time: "19:00" }, { date: "2099-01-02", time: "25:00" }]) {
      const result = await request("/api/movies/booked/sessions", "POST", { ...future, id: "invalid", ...values });
      assert.equal(result.status, 422, JSON.stringify(result.data));
    }
    const report = await request("/api/admin/reports/ticket-distributor?period=custom&from=2020-01-01&to=2020-01-01");
    assert.equal(report.status, 200);
    assert.equal(report.data.period.start, "2020-01-01");
    assert.equal(report.data.totals.quantity, 1);
    assert.equal(report.data.totals.grossRevenue, 20);
    const dashboard = await request("/api/admin/dashboard?period=custom&from=2020-01-01&to=2020-01-01");
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.data.chart.length, 1);
    assert.equal((await request("/api/admin/reports/ticket-distributor?period=custom&from=2026-10-03&to=2026-10-01")).status, 422);
    assert.equal((await request("/api/admin/reports/ticket-distributor/settings", "PUT", { distributorPercent: 101 })).status, 422);
    assert.equal((await request("/api/admin/reports/ticket-distributor/settings", "PUT", { distributorPercent: 60, courtesyPercent: 30, clubTicketFee: 12 })).status, 200);
    const rules = await request("/api/admin/reports/ticket-distributor/settings", "PUT", { clubTicketFee: 10 });
    assert.equal(rules.data.distributorPercent, 60);
    assert.equal(rules.data.courtesyPercent, 30);

    if (process.env.CATALOG_UI_CHECK === "1") {
      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await page.context().addCookies([{ name: cookie.split("=")[0], value: cookie.slice(cookie.indexOf("=") + 1), url: base }]);
        await page.goto(`${base}/admin/#moviesPanel`);
        await page.locator("#movieCatalogSearch").waitFor({ state: "visible" });
        await page.locator("#moviesList .movie-row").first().waitFor();
        await page.locator("#movieTitle").fill("Edição não salva");
        await page.locator("#movieCatalogSearch").fill("nada encontrado");
        await page.waitForFunction(() => document.querySelector("#moviesList").textContent.includes("Nenhum filme encontrado"));
        assert.equal(await page.locator("#movieTitle").inputValue(), "Edição não salva");
        await page.locator("#movieCatalogSearch").fill("");
        const output = path.join(root, "scratch", "catalog-polish-qa");
        await fs.mkdir(output, { recursive: true });
        await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true, animations: "disabled" });
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.screenshot({ path: path.join(output, "tablet.png"), fullPage: true, animations: "disabled" });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true, animations: "disabled" });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      } finally { await browser.close(); }
    }
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
    // Only the fresh test-owned directory may be removed.
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(temp).startsWith("cine-catalog-test-"));
    await fs.rm(temp, { recursive: true, force: true });
  }
});
