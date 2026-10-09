import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

test("cadastro e perfil validam sobrenome, telefone e CPF no backend", { timeout: 30000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cine-customer-validation-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(temp, "db.json");
  await fs.writeFile(dataFile, JSON.stringify({
    settings: { adminTwoFactorRequired: false }, users: [{ id: "qa-owner", name: "Administrador QA", email: "qa-owner@example.test", role: "owner", active: true, passwordHash: "" }],
    movies: [], rooms: [], orders: [], tickets: []
  }));
  const child = spawn(process.execPath, ["backend/server.js"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port), BIND_HOST: "127.0.0.1", NODE_ENV: "test", DATA_STORE: "json", CINE_DATA_FILE: dataFile,
      CINE_UPLOADS_DIR: path.join(temp, "uploads"), CINE_EMAIL_ATTACHMENTS_DIR: path.join(temp, "email"),
      CINE_TICKET_DOCUMENTS_DIR: path.join(temp, "tickets"), JWT_SECRET: "customer-validation-test-secret",
      MOVIE_IMAGE_MAINTENANCE_ENABLED: "false", FRONTEND_URL: base, CINE_PUBLIC_BACKEND_URL: base,
      ADMIN_EMAIL: "qa-owner@example.test", ADMIN_PASSWORD: "Admin-contact-only-2026!"
    }
  });
  child.stdout.resume();
  child.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Backend exited: ${child.exitCode}`);
      try { ready = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, "isolated backend ready");
    const post = async (pathname, payload, cookie = "") => {
      const response = await fetch(`${base}${pathname}`, {
        method: pathname === "/api/me" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(payload)
      });
      return { response, body: await response.json() };
    };
    const account = { email: "ana@example.test", password: "Senha-forte-2026!" };
    for (const [name, fields, code] of [
      ["sem sobrenome", { firstName: "Ana", lastName: "" }, "CUSTOMER_NAME_INVALID"],
      ["nome legado isolado", { name: "Ana" }, "CUSTOMER_NAME_INVALID"],
      ["telefone com letras", { firstName: "Ana", lastName: "Silva", phone: "1199999999a" }, "CUSTOMER_PHONE_INVALID"],
      ["CPF pontuado", { firstName: "Ana", lastName: "Silva", cpf: "123.456.789-01" }, "CUSTOMER_CPF_INVALID"]
    ]) {
      const result = await post("/api/auth/register", { ...account, ...fields });
      assert.equal(result.response.status, 422, name);
      assert.equal(result.body.error.code, code, name);
    }
    const created = await post("/api/auth/register", { ...account, firstName: "Ana", lastName: "Silva", phone: "11999999999", cpf: "12345678901" });
    assert.equal(created.response.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.user.name, "Ana Silva");
    assert.equal(created.body.user.phone, "11999999999");
    assert.equal(created.body.user.cpf, "12345678901");
    const cookie = created.response.headers.get("set-cookie")?.split(";")[0] || "";
    const badProfile = await post("/api/me", { name: "Ana", phone: "11999999999" }, cookie);
    assert.equal(badProfile.response.status, 422);
    assert.equal(badProfile.body.error.code, "CUSTOMER_NAME_INVALID");
    const badPhone = await post("/api/me", { name: "Ana Silva", phone: "(11) 99999-9999" }, cookie);
    assert.equal(badPhone.response.status, 422);
    assert.equal(badPhone.body.error.code, "CUSTOMER_PHONE_INVALID");
    const badEvent = await post("/api/events", {
      event: "private_rental.inquiry",
      data: { name: "Ana Silva", email: "ana@example.test", phone: "1199999999a" }
    });
    assert.equal(badEvent.response.status, 422);
    assert.equal(badEvent.body.error.code, "CUSTOMER_PHONE_INVALID");
    const admin = await post("/api/admin/login", { email: "qa-owner@example.test", password: "Admin-contact-only-2026!" });
    assert.equal(admin.response.status, 200);
    const adminCookie = admin.response.headers.get("set-cookie")?.split(";")[0] || "";
    const badAdminCustomer = await post("/api/users", {
      name: "Cliente QA", email: "outro@example.test", accountType: "customer", cpf: "123.456.789-01"
    }, adminCookie);
    assert.equal(badAdminCustomer.response.status, 422);
    assert.equal(badAdminCustomer.body.error.code, "CUSTOMER_CPF_INVALID");
    const missingAdminSurname = await post("/api/users", {
      name: "Ana", email: "outro@example.test", accountType: "customer", cpf: "12345678901"
    }, adminCookie);
    assert.equal(missingAdminSurname.response.status, 422);
    assert.equal(missingAdminSurname.body.error.code, "USER_NAME_INVALID");
    const stored = JSON.parse(await fs.readFile(dataFile, "utf8"));
    stored.users.find((user) => user.id === created.body.user.id).name = "Ana";
    await fs.writeFile(dataFile, JSON.stringify(stored));
    for (const endpoint of ["/api/payments/pix", "/api/payments/card"]) {
      const checkout = await post(endpoint, {}, cookie);
      assert.equal(checkout.response.status, 422, endpoint);
      assert.equal(checkout.body.error.code, "CUSTOMER_LAST_NAME_REQUIRED", endpoint);
    }
    const completedProfile = await post("/api/me", { name: "Ana Silva", phone: "11999999999", cpf: "12345678901" }, cookie);
    assert.equal(completedProfile.response.status, 200);
    assert.equal(completedProfile.body.user.name, "Ana Silva");
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    const expectedParent = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(path.resolve(temp).startsWith(expectedParent) && path.basename(temp).startsWith("cine-customer-validation-"));
    await fs.rm(temp, { recursive: true, force: true });
  }
});
