import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminEmailRoutes } = require("../backend/services/adminEmailRoutes.js");

function fixture(overrides = {}) {
  const responses = [];
  const calls = [];
  const deps = {
    normalizeEmailBrand: (brand) => ({ name: brand.name || "Cinema" }),
    findPersistedCampaign: async (id) => { calls.push(["find", id]); return null; },
    sendJson: (_res, status, body) => responses.push({ status, body }),
    ...overrides
  };
  const handle = createAdminEmailRoutes(deps);
  const request = (pathname, method = "GET", db = { settings: {} }) => handle({
    req: { url: pathname, headers: { host: "localhost" }, adminUser: { id: "staff-1" } },
    res: {}, pathname, method, db
  });
  return { request, responses, calls };
}

test("import and composition do not read recipients, persist or send email", async () => {
  const { request, responses, calls } = fixture();
  assert.deepEqual(calls, []);
  assert.equal(await request("/api/admin/unrelated"), false);
  assert.deepEqual(responses, []);
  assert.deepEqual(calls, []);
});

test("branding read preserves its status and payload", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/admin/email/branding", "GET", { settings: { emailBranding: { name: "Cruzeiro" } } }), true);
  assert.deepEqual(responses, [{ status: 200, body: { branding: { name: "Cruzeiro" } } }]);
});

test("missing campaign preserves the existing 404 contract", async () => {
  const { request, responses, calls } = fixture();
  assert.equal(await request("/api/admin/email/campaigns/absent"), true);
  assert.deepEqual(calls, [["find", "absent"]]);
  assert.deepEqual(responses, [{
    status: 404,
    body: { error: { code: "EMAIL_CAMPAIGN_NOT_FOUND", message: "Campanha não encontrada." } }
  }]);
});

test("unsupported campaign method falls through after lookup as before", async () => {
  const { request, responses, calls } = fixture();
  assert.equal(await request("/api/admin/email/campaigns/absent", "PATCH"), true);
  assert.deepEqual(calls, [["find", "absent"]]);
  assert.equal(responses[0].status, 404);
});
