import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createClubView } = require("../backend/public/admin-modules/club-view.js");

test("club view renders current plans and escapes external names", () => {
  const elements = new Map(["clubOverview", "clubPlansList", "clubSubscriptionsList", "clubUsageList"].map((id) => [id, { innerHTML: "" }]));
  const state = {
    content: { subscriptionPlans: [{ id: "plan", name: "<script>", monthlyPrice: 25, includedTickets: 1 }], subscriptions: [], subscriptionCredits: [], subscriptionUsage: [], subscriptionPayments: [], users: [] },
    creating: { clubPlan: false }, selectedClubPlanId: "plan"
  };
  let filled = false;
  const view = createClubView({
    state, $: (id) => elements.get(id),
    adminAssetUrl: String,
    clubStatusLabel: String,
    creationPlaceholder: () => "",
    currentClubPlan: () => state.content.subscriptionPlans[0],
    escapeHtml: (value) => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    fillClubPlanForm: () => { filled = true; },
    filterClubSubscriptions: () => {},
    money: (value) => `R$ ${Number(value).toFixed(2)}`,
    paginateAdminItems: (items) => ({ pageItems: items }),
    renderAdminListPager: () => ""
  });
  view.renderClub();
  assert.equal(filled, true);
  assert.match(elements.get("clubPlansList").innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(elements.get("clubPlansList").innerHTML, /<script>/);
  assert.match(elements.get("clubOverview").innerHTML, /Desempenho do Clube/);
});

test("club module loads before the admin controller", () => {
  const html = readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/club-view.js") < html.indexOf("admin.js?v="));
});
