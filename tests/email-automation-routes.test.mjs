import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createEmailAutomationRoutes } = require("../backend/services/emailAutomationRoutes.js");

function fixture(authorized = false) {
  const responses = [];
  const handle = createEmailAutomationRoutes({
    emailAutomationAuthorized: () => authorized,
    emailAutomationContext: () => ({ movies: [] }),
    sendJson: (_res, status, body, headers) => responses.push({ status, body, headers })
  });
  const request = (pathname, method = "GET") => handle({
    req: { url: pathname, headers: {} }, res: {}, pathname, method, db: {}
  });
  return { request, responses };
}

test("token gate remains before context and unknown automation routes", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/email-automation/context"), true);
  assert.equal(responses[0].status, 503);
  assert.equal(responses[0].body.error.code, "EMAIL_AUTOMATION_UNAVAILABLE");
  assert.equal(await request("/api/email-automation/unknown"), true);
  assert.equal(responses.length, 2);
});

test("authorized context preserves no-store response", async () => {
  const { request, responses } = fixture(true);
  assert.equal(await request("/api/email-automation/context"), true);
  assert.deepEqual(responses, [{ status: 200, body: { context: { movies: [] } }, headers: { "Cache-Control": "no-store" } }]);
  assert.equal(await request("/api/email-automation/unknown"), false);
});

test("unrelated routes do not check token or call integrations", async () => {
  const { request, responses } = fixture();
  assert.equal(await request("/api/health"), false);
  assert.deepEqual(responses, []);
});
