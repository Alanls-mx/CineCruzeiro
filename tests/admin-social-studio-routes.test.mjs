import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminSocialStudioRoutes } = require("../backend/services/adminSocialStudioRoutes.js");

function fixture() {
  const responses = [];
  const calls = [];
  const handle = createAdminSocialStudioRoutes({
    socialStudioBrand: () => ({ id: "cinema-1" }),
    socialStudioContext: () => ({ templates: [] }),
    getSocialStudioAutomationOrchestrator: () => ({ list: async (options) => { calls.push(options); return []; } }),
    adminHasPermission: (_user, permission) => permission !== "social_studio.delete",
    sendJson: (_res, status, body, headers) => responses.push({ status, body, headers })
  });
  const request = (pathname, method = "GET") => handle({
    req: { adminUser: { id: "staff-1" }, headers: { host: "localhost" }, url: pathname },
    res: {}, pathname, method, db: { settings: {} }
  });
  return { request, responses, calls };
}

test("import and factory composition do not start automation or upload", async () => {
  const { request, calls, responses } = fixture();
  assert.deepEqual(calls, []);
  assert.equal(await request("/api/admin/unrelated"), false);
  assert.deepEqual(calls, []);
  assert.deepEqual(responses, []);
});

test("context keeps the no-store response and capability projection", async () => {
  const { request, calls, responses } = fixture();
  assert.equal(await request("/api/admin/social-studio/context"), true);
  assert.deepEqual(calls, [{ cinemaId: "cinema-1", limit: 8 }]);
  assert.equal(responses[0].status, 200);
  assert.deepEqual(responses[0].headers, { "Cache-Control": "no-store" });
  assert.deepEqual(responses[0].body.capabilities, { view: true, create: true, delete: false });
});

test("unknown post still has the same 404 contract", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/admin/social-studio/posts/missing"), true);
  assert.deepEqual(responses, [{ status: 404, body: {
    error: { code: "SOCIAL_POST_NOT_FOUND", message: "A arte não foi encontrada no histórico." }
  }, headers: undefined }]);
});
