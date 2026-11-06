import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createAdminContentPresenter } = require("../backend/services/adminContentPresenter.js");

test("admin content keeps PII, marketing and finance behind existing permissions", () => {
  const presenter = createAdminContentPresenter({
    getContent: () => ({ users: [{ id: "u" }], orders: [{ id: "o" }], payments: [{ id: "p" }], tickets: [{ id: "t" }], auditLogs: [{ id: "log" }],
      subscriptionPlans: [{ id: "plan", accounting: { private: true } }], subscriptions: [{ id: "sub" }], subscriptionCredits: [{ id: "credit" }],
      subscriptionUsage: [], subscriptionCycles: [], subscriptionPayments: [], subscriptionCreditUnits: [], subscriptionCreditRedemptions: [], subscriptionAccountingRules: [{ id: "rule" }] }),
    roleAlias: (role) => role,
    adminHasPermission: (user, permission) => user.permissions.includes(permission),
    campaignCustomerPool: () => [{ id: "u", emailUnsubscribeToken: "secret-token" }],
    publicCampaign: (campaign) => ({ id: campaign.id })
  });
  const db = { emailCampaigns: [{ id: "campaign", secret: "private" }] };
  const restricted = presenter.getAdminContent(db, { role: "operator", permissions: [] });
  for (const field of ["users", "orders", "payments", "tickets", "emailCustomers", "emailCampaigns", "subscriptionPlans", "subscriptions", "subscriptionCredits", "auditLogs"]) {
    assert.deepEqual(restricted[field], [], field);
  }
  const marketing = presenter.getAdminContent(db, { role: "manager", permissions: ["marketing.view", "club.view"] });
  assert.deepEqual(marketing.emailCustomers, [{ id: "u" }]);
  assert.deepEqual(marketing.emailCampaigns, [{ id: "campaign" }]);
  assert.deepEqual(marketing.subscriptionPlans, [{ id: "plan" }]);
  assert.deepEqual(marketing.subscriptionAccountingRules, []);
  const owner = presenter.getAdminContent(db, { role: "owner", permissions: ["users.manage", "orders.view", "payments.view", "tickets.view", "club.view"] });
  assert.equal(owner.users.length, 1);
  assert.equal(owner.orders.length, 1);
  assert.equal(owner.payments.length, 1);
  assert.equal(owner.subscriptionAccountingRules.length, 1);
});
