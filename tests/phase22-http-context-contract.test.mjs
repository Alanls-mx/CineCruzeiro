import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { AsyncLocalStorage } from "node:async_hooks";
import ts from "typescript";

const file = new URL("../backend/server.js", import.meta.url);
const ast = ts.createSourceFile("server.js", fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function functions(names, context) {
  const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  for (const name of names) assert.ok(declarations.some((node) => node.name?.text === name), `${name} ausente`);
  return vm.runInNewContext(`${declarations.map((node) => node.getText(ast)).join("\n")}\n({ ${names.join(", ")} })`, context);
}

test("contexto HTTP mantém requestId, identidade e redação separados após await concorrente", async () => {
  const requestContext = new AsyncLocalStorage();
  const lines = [];
  const outbound = [];
  const { logEvent, redactLogValue } = functions(["redactLogValue", "logEvent"], {
    requestContext, clientIp: () => "127.0.0.1", postgresEnabled: () => false,
    discordWebhookService: { enqueue: (entry) => outbound.push(entry) },
    console: { log: (line) => lines.push(JSON.parse(line)), error: (line) => lines.push(JSON.parse(line)) }
  });
  await Promise.all(["one", "two"].map((id) => requestContext.run({
    requestId: id, method: "GET", pathname: `/api/${id}`, req: { headers: {} }, adminUser: { id }
  }, async () => {
    await new Promise((resolve) => setTimeout(resolve, id === "one" ? 6 : 1));
    logEvent("info", "phase22.context", { marker: id, token: "secret" });
  })));
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.equal(line.requestId, line.marker);
    assert.equal(line.path, `/api/${line.marker}`);
    assert.equal(line.token, "[redacted]");
  }
  assert.equal(outbound.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(redactLogValue({ cpf: "123", nested: { password: "secret" } }))),
    { cpf: "[redacted]", nested: { password: "[redacted]" } });
});

test("cookies e CSP preservam flags, origens permitidas e modo de produção", () => {
  const context = { encodeURIComponent, isProduction: () => true,
    allowedCorsOrigins: () => ["https://front.example.test"], publicBackendUrl: () => "https://api.example.test",
    originHost: (value) => new URL(value).hostname };
  const { cookieSameSite, securityHeaders, adminCookie, customerCookie } = functions(
    ["cookieSameSite", "securityHeaders", "adminCookie", "customerCookie"], context);
  assert.equal(cookieSameSite(), "SameSite=None");
  assert.match(adminCookie("token", 0), /cine_admin=token; Path=\/; HttpOnly; SameSite=None; Max-Age=0; Secure/);
  assert.match(customerCookie("token"), /cine_customer=token; Path=\/; HttpOnly; SameSite=None; Max-Age=2592000; Secure/);
  const headers = securityHeaders({ "X-Contract": "kept" });
  assert.match(headers["Content-Security-Policy"], /script-src-attr 'none'/);
  assert.match(headers["Content-Security-Policy"], /sdk\.mercadopago\.com/);
  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["X-Contract"], "kept");
});
