import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const password = "qa-private-account-12345";

test("account, catalog and cleaning interval workflows on an isolated backend", { timeout: 150000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-account-test-"));
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(temp, "db.json");
  await fs.writeFile(dataFile, JSON.stringify({
    settings: { cinemaName: "Cinema QA", adminTwoFactorRequired: false },
    movies: [{ id: "film", slug: "film", title: "Filme de teste", workflowStatus: "draft", status: "now_playing", duration: "120 min", director: "Diretor", synopsis: "Sinopse", genre: [], rating: "L", sessions: [], metadata: {} }],
    rooms: [{ id: "room", name: "Sala Principal", technology: "Laser", capacity: 60, status: "active", cleanupMinutes: 20 }, { id: "inactive", name: "Sala em manutenção", status: "maintenance", capacity: 20 }],
    ticketTypes: [{ id: "full", name: "Inteira", active: true, price: 20 }],
    orders: [], tickets: [], users: [{ id: "qa-owner", name: "Ana Lima", email: "owner@example.test", role: "owner", active: true, passwordHash: "" }]
  }));
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, PORT: String(port), BIND_HOST: "127.0.0.1", NODE_ENV: "test", DATA_STORE: "json", CINE_DATA_FILE: dataFile,
      CINE_UPLOADS_DIR: path.join(temp, "uploads"), CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"), CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"),
      ADMIN_EMAIL: "owner@example.test", ADMIN_PASSWORD: password, JWT_SECRET: "account-qa-local-secret-never-deploy", TWO_FACTOR_SECRET_KEY: Buffer.alloc(32, 7).toString("base64"), MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", PAYMENTS_MODE: "test", TEST_PAYMENTS_AUTO_APPROVE: "false", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base }
  });
  child.stdout.resume(); child.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready);
    const login = async (email, pass) => fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pass }) });
    const ownerLogin = await login("owner@example.test", password);
    assert.equal(ownerLogin.status, 200, JSON.stringify(await ownerLogin.clone().json()));
    let cookie = ownerLogin.headers.get("set-cookie").split(";")[0];
    const ownerCookie = cookie;
    const request = async (url, method = "GET", body, auth = cookie) => {
      const response = await fetch(`${base}${url}`, { method, headers: { Cookie: auth, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
    };
    const dashboard = await request("/api/admin/dashboard?period=today");
    assert.equal(dashboard.status, 200, JSON.stringify(dashboard.data));
    assert.equal(dashboard.data.revenuePeriod, 0);
    assert.ok(Array.isArray(dashboard.data.chart));
    assert.equal((await request("/api/concessions", "POST", { name: "Pipoca QA", price: 12, stock: 10 })).status, 201);
    assert.equal((await request("/api/promotions", "POST", { title: "Oferta QA", value: 5, couponCode: "OFERTAQA" })).status, 201);
    assert.equal((await request("/api/ads", "POST", { title: "Anúncio QA" })).status, 201);
    assert.equal((await request("/api/admin/logs")).status, 200);
    assert.equal((await request("/api/admin/logs/performance")).status, 200);
    assert.equal((await request("/api/admin/logs", "DELETE", { retentionDays: 30 })).status, 200);
    assert.equal((await request("/api/admin/me", "PATCH", { name: "Nobody" }, "")).status, 401);
    assert.equal((await request("/api/users", "POST", { name: "Operador QA", email: "operator@example.test", role: "operator", accountType: "team" })).status, 422);
    const created = await request("/api/users", "POST", { name: "Operador QA", email: "operator@example.test", role: "operator", accountType: "team", password });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const operatorLogin = await login("operator@example.test", password);
    cookie = operatorLogin.headers.get("set-cookie").split(";")[0];
    assert.equal((await request("/api/admin/logs")).status, 403);
    assert.equal((await request("/api/admin/logs", "DELETE", { retentionDays: 30 })).status, 403);
    const changed = await request("/api/admin/me", "PATCH", { name: "Operador Atualizado", role: "owner", adminPermissions: ["users.manage"], password: "injected-password" });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.equal(changed.data.user.name, "Operador Atualizado");
    assert.equal(changed.data.user.role, "operator");
    assert.equal(changed.data.user.passwordHash, undefined);
    assert.equal((await request(`/api/users/${created.data.id}`, "PUT", { role: "owner" })).status, 403);
    assert.equal((await request("/api/admin/me", "PATCH", { picture: "javascript:alert(1)" })).status, 422);
    const png = await require("sharp")({ create: { width: 80, height: 80, channels: 3, background: "#2563eb" } }).png().toBuffer();
    const photo = await request("/api/admin/profile/photo", "POST", { data: png.toString("base64"), contentType: "image/png", folder: "ignored" });
    assert.equal(photo.status, 201, JSON.stringify(photo.data));
    assert.match(photo.data.url, /^\/uploads\/profiles\//);
    assert.equal((await request("/api/admin/me", "PATCH", { picture: photo.data.url })).data.user.picture, photo.data.url);
    assert.equal((await request("/api/admin/me", "PATCH", { picture: "" })).data.user.picture, "");
    const teamPhoto = await request(`/api/users/${created.data.id}`, "PUT", { picture: photo.data.url }, ownerCookie);
    assert.equal(teamPhoto.status, 200, JSON.stringify(teamPhoto.data));
    assert.equal((await request("/api/admin/me")).data.user.picture, photo.data.url);
    assert.equal((await request("/api/admin/profile/photo", "POST", { data: Buffer.from("<svg></svg>").toString("base64"), contentType: "image/svg+xml" })).status, 415);
    const oldCookie = cookie;
    const newPassword = "qa-changed-private-67890";
    const credentials = { currentPassword: password, newPassword, confirmPassword: newPassword };
    assert.equal((await request("/api/admin/me/password", "POST", { ...credentials, currentPassword: "wrong" })).status, 422);
    assert.equal((await request("/api/admin/me/password", "POST", { ...credentials, confirmPassword: "different" })).status, 422);
    const passwordChange = await request("/api/admin/me/password", "POST", credentials);
    assert.equal(passwordChange.status, 200, JSON.stringify(passwordChange.data));
    cookie = passwordChange.cookie;
    assert.equal((await request("/api/admin/me", "GET", undefined, oldCookie)).status, 401);
    assert.equal((await request("/api/admin/me")).status, 200);
    assert.equal((await login("operator@example.test", password)).status, 401);
    assert.equal((await login("operator@example.test", newPassword)).status, 200);
    cookie = ownerCookie;

    const blanked = await request("/api/movies/film", "PUT", { director: "", synopsis: "", originalTitle: "", backdropUrl: "", trailerYoutubeId: "" });
    assert.equal(blanked.status, 200, JSON.stringify(blanked.data));
    assert.equal(blanked.data.director, ""); assert.equal(blanked.data.synopsis, "");
    for (const body of [{ title: " " }, { duration: "zero" }, { duration: "0" }, { duration: "-10" }, { duration: "1h 75min" }, { releaseDate: "2026-02-30" }]) {
      assert.equal((await request("/api/movies/film", "PUT", body)).status, 422, JSON.stringify(body));
    }
    assert.equal((await request("/api/movies/film", "PUT", { duration: "2h 10min" })).status, 200);
    assert.equal((await request("/api/movies/film", "PUT", { duration: "120" })).status, 200);
    await request("/api/movies/film", "PUT", { duration: "120 min" });
    const session = { date: "2099-01-01", time: "23:00", room: "Sala Principal (Laser)", roomId: "room", format: "2D Dublado", ticketTypeIds: ["full"] };
    assert.equal((await request("/api/movies/film/sessions", "POST", { ...session, roomId: "inactive", room: "Sala em manutenção" })).status, 422);
    assert.equal((await request("/api/movies/film/sessions", "POST", { ...session, roomId: "missing", room: "Unknown" })).status, 422);
    assert.equal((await request("/api/movies/film/sessions", "POST", { ...session, dateTo: "2099-01-02", weekdays: [] })).status, 422);
    const late = await request("/api/movies/film/sessions", "POST", session);
    assert.equal(late.status, 201, JSON.stringify(late.data));
    assert.equal((await request("/api/movies/film/sessions", "POST", session)).status, 409);
    const tooSoon = await request("/api/movies/film/sessions", "POST", { ...session, date: "2099-01-02", time: "01:19", confirmRoomConflict: true });
    assert.equal(tooSoon.status, 409);
    assert.equal(tooSoon.data.error.code, "SESSION_CLEANUP_CONFLICT");
    assert.equal((await request("/api/movies/film/sessions", "POST", { ...session, date: "2099-01-02", time: "01:20" })).status, 201);
    assert.equal((await request("/api/movies/film", "PUT", { sessions: [] })).status, 422);
    const raisedTooSoon = await request("/api/rooms/room", "PUT", { cleanupMinutes: 35 });
    assert.equal(raisedTooSoon.status, 409);
    assert.equal(raisedTooSoon.data.error.code, "ROOM_CLEANUP_CONFLICT");
    const durationTooLong = await request("/api/movies/film", "PUT", { duration: "130 min" });
    assert.equal(durationTooLong.status, 409);
    assert.equal(durationTooLong.data.error.code, "MOVIE_DURATION_SESSION_CONFLICT");
    assert.equal((await request("/api/movies/film", "PUT", { duration: "" })).status, 422);
    assert.equal((await request("/api/movies/film", "PUT", { duration: "110 min" })).status, 200);
    assert.equal((await request("/api/movies/film", "PUT", { duration: "120 min" })).status, 200);
    const latestSessions = (await request("/api/admin/content")).data.movies.find((movie) => movie.id === "film").sessions;
    const second = latestSessions.find((entry) => entry.date === "2099-01-02");
    assert.equal((await request(`/api/movies/film/sessions/${encodeURIComponent(second.id)}`, "PUT", { date: second.date, time: "01:35", room: second.room, roomId: second.roomId, format: second.format, ticketTypeIds: second.ticketTypeIds })).status, 200);
    assert.equal((await request("/api/rooms/room", "PUT", { cleanupMinutes: 35 })).data.cleanupMinutes, 35);
    assert.equal((await request("/api/rooms/room", "PUT", { cleanupMinutes: -1 })).status, 422);
    assert.equal((await request("/api/rooms/room", "PUT", { cleanupMinutes: 1.5 })).status, 422);
    assert.equal((await request("/api/rooms/room", "PUT", { cleanupMinutes: 121 })).status, 422);
    const restored = (await request("/api/admin/content")).data;
    assert.equal(restored.rooms.find((room) => room.id === "room").cleanupMinutes, 35);

    if (process.env.ADMIN_POLISH_UI === "1") {
      const { chromium, expect } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.context().addCookies([{ name: cookie.split("=")[0], value: cookie.slice(cookie.indexOf("=") + 1), url: base }]);
        await page.goto(`${base}/admin/#moviesPanel`);
        await page.locator('[data-panel="marketingPanel"]').click();
        await page.locator('[data-admin-tab="promotions"]').click();
        await expect(page.locator("#promotionsList")).toContainText("Oferta QA");
        await page.locator('[data-admin-select-kind="promotion"]').filter({ hasText: "Oferta QA" }).click();
        await expect(page.locator("#promotionTitle")).toHaveValue("Oferta QA");
        await page.locator("#archivedPromotionsTab").click();
        await expect(page.locator("#promotionsList")).toContainText("Nenhum cupom arquivado");
        await page.locator('[data-admin-tab="ads"]').click();
        await expect(page.locator("#adsList")).toContainText("Anúncio QA");
        await page.locator('[data-admin-select-kind="ad"]').filter({ hasText: "Anúncio QA" }).click();
        await expect(page.locator("#adTitle")).toHaveValue("Anúncio QA");
        await page.locator('[data-panel="moviesPanel"]').click();
        await expect(page.locator("#movieTitle")).toHaveValue("Filme de teste");
        await page.locator("#movieTitle").fill("Título em edição");
        await page.locator('[data-movie-step="3"]').click();
        await page.locator("#addSessionButton").click();
        await page.locator("#sessionDate").fill("2099-02-01");
        await expect(page.locator("#sessionRoom option")).toHaveCount(1);
        await expect(page.locator("#sessionScheduleSuggestion")).toContainText("35 min");
        await page.locator("#sessionTime").fill("18:00");
        await page.locator("#saveSessionButton").click();
        await expect(page.locator("#successOverlay")).toBeVisible();
        await page.locator("#successCloseButton").click();
        await expect(page.locator("#movieTitle")).toHaveValue("Título em edição");
        await expect(page.locator("#sessionsList")).toContainText("18:00");
        await page.locator("#addSessionButton").click();
        await page.locator("#sessionCreationMode").selectOption("range");
        for (const checkbox of await page.locator("#sessionWeekdays input").all()) await checkbox.uncheck();
        await page.locator("#saveSessionButton").click();
        await expect(page.locator("#toast")).toContainText("dia da semana");
        await page.locator("#cancelSessionButton").click();
        const output = path.join(root, "scratch", "admin-account-polish");
        await fs.mkdir(output, { recursive: true });
        await page.screenshot({ path: path.join(output, "sessions-desktop.png"), fullPage: true, animations: "disabled" });
        page.on("dialog", (dialog) => dialog.accept());
        await page.locator("#newMovieButton").click();
        await page.locator("#movieTitle").fill("Novo filme com sessão");
        await page.locator('[data-movie-step="1"]').click();
        await page.locator("#movieDuration").fill("100 min");
        await page.locator('[data-movie-step="3"]').click();
        await page.locator("#addSessionButton").click();
        await expect(page.locator("#movieId")).not.toHaveValue("");
        await expect(page.locator("#sessionEditor")).toBeVisible();
        await page.locator("#sessionDate").fill("2099-03-01");
        await page.locator("#sessionTime").fill("20:00");
        await page.locator("#saveSessionButton").click();
        await expect(page.locator("#successOverlay")).toBeVisible();
        await page.locator("#successCloseButton").click();
        await expect(page.locator("#sessionsList")).toContainText("20:00");
        await page.locator("#adminProfileButton").click();
        await page.locator('[data-profile-action="account"]').click();
        await expect(page.locator("#myAccountName")).toHaveValue("Ana Lima");
        await page.locator("#myAccountPhoto").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
        await expect(page.locator("#myAccountAvatar img")).toBeVisible();
        await page.locator("#myAccountForm button[type='submit']").click();
        await expect(page.locator("#myAccountFeedback")).toHaveText("Perfil atualizado.");
        await expect(page.locator("#adminProfileAvatar img")).toBeVisible();
        assert.ok(await page.locator("#adminProfileAvatar img").evaluate((img) => img.complete && img.naturalWidth > 0));
        await page.screenshot({ path: path.join(output, "account-desktop.png"), fullPage: true, animations: "disabled" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => document.querySelector(".sidebar").getBoundingClientRect().right <= 0);
        await page.screenshot({ path: path.join(output, "account-mobile.png"), fullPage: true, animations: "disabled" });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator("#myAccountTwoFactorButton").click();
        await page.locator('#twoFactorSetupForm input[name="password"]').fill(password);
        const setupResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/2fa/setup") && response.request().method() === "POST");
        await page.locator('#twoFactorSetupForm button[type="submit"]').click();
        const setup = await (await setupResponse).json();
        const { totp } = require("../backend/services/adminTwoFactorService");
        await page.locator('#twoFactorEnableForm input[name="code"]').fill(totp(setup.secret));
        await page.locator('#twoFactorEnableForm button[type="submit"]').click();
        await expect(page.locator('[data-two-factor-action="download-recovery"]')).toBeVisible();
        const downloadEvent = page.waitForEvent("download");
        await page.locator('[data-two-factor-action="download-recovery"]').click();
        const download = await downloadEvent;
        const codes = await fs.readFile(await download.path(), "utf8");
        assert.equal(codes.match(/[A-F0-9]{5}-[A-F0-9]{5}/g)?.length, 10);
        await page.locator('[data-two-factor-action="finish"]').click();
        await expect(page.locator("#twoFactorOverlay")).toBeHidden();
        await expect(page.locator("#myAccountSecurityState")).toContainText("2FA ativo");
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    }
    const stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
    const audit = stored.auditLogs.filter((entry) => entry.entityType === "user_security");
    assert.ok(audit.length > 0);
    assert.equal(JSON.stringify(audit).includes(password), false);
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill(); await exited;
    }
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(temp).startsWith("cine-account-test-"));
    await fs.rm(temp, { recursive: true, force: true });
  }
});
