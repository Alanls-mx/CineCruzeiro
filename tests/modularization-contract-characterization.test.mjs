import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { syntheticCinemaRecords } from "./fixtures/modularization-baseline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function declarations(file, names, context = {}) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  for (const name of names) assert.ok(found.some((node) => node.name?.text === name), `${name} ausente de ${file}`);
  const scope = vm.createContext(context);
  // Evaluate every declaration in source order, including duplicate declarations.
  vm.runInContext(found.map((node) => node.getText(ast)).join("\n"), scope);
  return scope;
}

test("o portão administrativo mantém a matriz atual por método e família", () => {
  const policy = declarations("backend/server.js", ["adminAuthRequired", "requiredAdminRoles", "requiredAdminPermission"]);
  const cases = [
    ["GET", "/api/health", false, "dashboard.view"],
    ["GET", "/api/content", false, "dashboard.view"],
    ["PUT", "/api/content", true, "settings.manage"],
    ["POST", "/api/admin/login", false, "dashboard.view"],
    ["GET", "/api/admin/logs", true, "logs.view"],
    ["DELETE", "/api/admin/logs", true, "logs.delete"],
    ["POST", "/api/movies", true, "movies.create"],
    ["POST", "/api/movies/baseline-movie/sessions", true, "sessions.manage"],
    ["GET", "/api/rooms", true, "rooms.view"],
    ["POST", "/api/admin/concession-counter-sales", true, "concessions.sell"],
    ["POST", "/api/box-office/sales", true, "box_office.sell"],
    ["POST", "/api/orders/baseline-order/refund-tickets", true, "orders.refund"],
    ["POST", "/api/payments/pix", false, "dashboard.view"],
    ["POST", "/api/webhooks/mercado-pago", false, "dashboard.view"],
    ["POST", "/api/studio/campaigns/generate", false, "dashboard.view"]
  ];
  for (const [method, route, required, permission] of cases) {
    assert.equal(policy.adminAuthRequired(route, method), required, `${method} ${route} auth`);
    assert.equal(policy.requiredAdminPermission(route, method), permission, `${method} ${route} permission`);
  }
  assert.deepEqual([...policy.requiredAdminRoles("/api/admin/logs", "DELETE")], ["owner"]);
  assert.deepEqual([...policy.requiredAdminRoles("/api/admin/content", "GET")], ["owner", "manager", "operator"]);
});

test("origem e CSRF mantêm a diferença entre leitura, login e sessão de cliente", () => {
  const policy = declarations("backend/server.js", ["originHost", "mutatesState", "adminOriginAllowed", "customerMutationOriginAllowed"], {
    URL,
    allowedCorsOrigins: () => ["https://front.example.test"], publicBackendUrl: () => "https://api.example.test",
    isProduction: () => true, parseCookies: (req) => req.cookies || {}
  });
  const request = (method, url, headers = {}, cookies = {}) => ({ method, url, headers: { host: "api.example.test", ...headers }, cookies });
  assert.equal(policy.adminOriginAllowed(request("POST", "/api/admin/me", { origin: "https://front.example.test" })), true);
  assert.equal(policy.adminOriginAllowed(request("POST", "/api/admin/me", { origin: "https://foreign.example.test" })), false);
  assert.equal(policy.adminOriginAllowed(request("POST", "/api/admin/me", { "sec-fetch-site": "cross-site" })), false);
  assert.equal(policy.customerMutationOriginAllowed(request("GET", "/api/payments/pix", { origin: "https://foreign.example.test" })), true);
  assert.equal(policy.customerMutationOriginAllowed(request("POST", "/api/auth/login", { origin: "https://foreign.example.test" })), false);
  assert.equal(policy.customerMutationOriginAllowed(request("POST", "/api/payments/pix", { origin: "https://foreign.example.test" }, { cine_customer: "synthetic" })), false);
});

test("a paginação extraída do Clube preserva o comportamento efetivo", () => {
  const file = "backend/public/admin-modules/club-view.js";
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const names = ["changeClubSubscriptionsPage", "filterClubSubscriptions"];
  const found = [];
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const name of names) assert.equal(found.filter((node) => node.name?.text === name).length, 1);
  const scope = vm.createContext({
    state: { content: syntheticCinemaRecords(), clubSubscriptionsPage: 1, clubSubscriptionsSearch: "" },
    renderClub: () => { scope.renders = (scope.renders || 0) + 1; },
    $: () => null
  });
  vm.runInContext(found.map((node) => node.getText(ast)).join("\n"), scope);
  scope.changeClubSubscriptionsPage(1);
  assert.equal(scope.state.clubSubscriptionsPage, 2, "a implementação efetiva não limita ao total de páginas");
  assert.equal(scope.renders, 1);
  scope.changeClubSubscriptionsPage(-9);
  assert.equal(scope.state.clubSubscriptionsPage, 1);
  scope.filterClubSubscriptions(" Cliente ");
  assert.equal(scope.state.clubSubscriptionsSearch, " Cliente ");
  assert.equal(scope.state.clubSubscriptionsPage, 1);
  assert.equal(scope.renders, 3, "cada ação renderiza uma vez");
});
