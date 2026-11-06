import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminCustomerHandler } = require("../backend/services/adminCustomerHandler.js");
const { createAdminCustomerSearchService } = require("../backend/services/adminCustomerSearchService.js");

test("customer lookup keeps the existing search and strips private fields", () => {
  const search = createAdminCustomerSearchService({
    adminRoles: () => new Set(["owner", "manager"]),
    sanitizeUser: ({ id, name, email }) => ({ id, name, email })
  });
  const handler = createAdminCustomerHandler({ adminCustomerSearch: search,
    sendJson: (res, status, body) => Object.assign(res, { status, body })
  });
  const response = {};
  const db = { users: [{ id: "customer", role: "customer", name: "Cliente Teste", email: "cliente@example.test", cpf: "12345678901", passwordHash: "private" }] };
  assert.equal(handler({ req: { url: "/api/admin/customers?query=Cliente", headers: { host: "local.test" } }, res: response, pathname: "/api/admin/customers", method: "GET", db }), true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { customers: [{ id: "customer", name: "Cliente Teste", email: "cliente@example.test" }] });
  assert.equal(handler({ req: {}, res: {}, pathname: "/api/admin/customers", method: "POST", db }), false);
});
