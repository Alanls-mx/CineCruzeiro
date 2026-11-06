import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createCatalogReadHandler } = require("../backend/services/catalogReadHandler.js");

test("catalog reads keep public cache and admin marketing projection after lookup", async () => {
  const calls = [];
  const handler = createCatalogReadHandler({
    sendJson: (res, status, value, headers) => { calls.push("reply"); Object.assign(res, { status, value, headers }); },
    getContent: () => ({ movies: [{ id: "synthetic" }] }),
    getAdminContent: (_db, user) => ({ users: user.id === "admin" ? [{ id: "synthetic-user" }] : [] }),
    postgresEnabled: () => true,
    adminHasPermission: (user) => user.marketing === true,
    emailCampaignRepository: { listCampaigns: async () => { calls.push("lookup"); return { campaigns: [{ id: "campaign" }], page: 1, pages: 1, pageSize: 25, total: 1, totals: {} }; } },
    publicCampaign: (campaign) => ({ id: campaign.id })
  });
  const publicResponse = {};
  assert.equal(handler.handlePublicContentRoute({ res: publicResponse, pathname: "/api/content", method: "GET", db: {} }), true);
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers["Cache-Control"], "public, max-age=15, stale-while-revalidate=45");
  assert.equal(handler.handlePublicContentRoute({ res: {}, pathname: "/api/content", method: "PUT", db: {} }), false);

  calls.length = 0;
  const adminResponse = {};
  assert.equal(await handler.handleAdminContentRoute({ req: { adminUser: { id: "admin", marketing: true } }, res: adminResponse, pathname: "/api/admin/content", method: "GET", db: {} }), true);
  assert.deepEqual(calls, ["lookup", "reply"]);
  assert.deepEqual(adminResponse.value.emailCampaigns, [{ id: "campaign" }]);

  calls.length = 0;
  const restricted = {};
  await handler.handleAdminContentRoute({ req: { adminUser: { id: "admin", marketing: false } }, res: restricted, pathname: "/api/admin/content", method: "GET", db: {} });
  assert.deepEqual(calls, ["reply"]);
  assert.equal(restricted.value.emailCampaigns, undefined);
});
