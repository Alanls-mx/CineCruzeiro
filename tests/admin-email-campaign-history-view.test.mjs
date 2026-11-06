import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createEmailCampaignHistoryView } = require("../backend/public/admin-modules/email-campaign-history-view.js");

test("campaign history keeps filters and pagination across repeated renders", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { innerHTML: "" });
    return elements.get(id);
  };
  const state = { content: { emailCampaigns: [] }, emailCampaignHistoryFilter: "drafts",
    emailCampaignHistorySearch: "estreia", emailCampaignHistoryPage: 2, emailCampaignHistoryPageSize: 25 };
  const requests = [];
  const view = createEmailCampaignHistoryView({ state, $, escapeHtml: String,
    EMAIL_CAMPAIGN_TEMPLATES: { announcement: { label: "Comunicado" } },
    api: async (path) => {
      requests.push(path);
      return { campaigns: [{ id: "campaign", subject: "Estreia QA", templateId: "announcement", status: "draft" }],
        page: 2, pages: 3, pageSize: 25, total: 51, totals: { draft: 51 } };
    } });
  await view.loadEmailCampaignHistory();
  view.renderEmailCampaigns();
  assert.equal(requests.length, 1);
  assert.match(requests[0], /page=2/);
  assert.match(requests[0], /status=drafts/);
  assert.match(requests[0], /search=estreia/);
  assert.match($("emailCampaignHistory").innerHTML, /Estreia QA/);
  assert.match($("emailCampaignHistoryControls").innerHTML, /data-campaign-history-filter="drafts"/);
  assert.match($("emailCampaignHistoryPager").innerHTML, /data-campaign-history-page="3"/);
  assert.equal(state.emailCampaignHistoryTimer, null);
});

test("campaign send confirmation prevents a request when declined", async () => {
  const requests = [];
  const view = createEmailCampaignHistoryView({ state: {}, window: { confirm: () => false },
    api: async (path) => { requests.push(path); } });
  await view.sendExistingEmailCampaign("campaign");
  assert.deepEqual(requests, []);
});
