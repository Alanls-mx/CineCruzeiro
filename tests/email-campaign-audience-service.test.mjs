import { test } from "node:test";
import assert from "node:assert/strict";
import audienceFactory from "../backend/services/emailCampaignAudienceService.js";

const audience = audienceFactory.createEmailCampaignAudienceService({
  emailUnsubscribeUrlForUser: (user) => `https://example.test/unsubscribe/${user.id}`,
  filterOfferRecipients: (_db, _context, recipients) => ({ recipients, excluded: 0, reasons: {} }),
  scopeCampaignContext: (campaign) => campaign,
  resolveCampaignTemplate: () => ({ scenario: "announcement", objective: "announcement", templateId: "announcement", incomplete: false }),
  resolveCampaignContext: () => ({ report: {} }),
  validateCampaignTemporalClaims: () => ({ valid: true })
});

const db = {
  users: [
    { id: "u1", role: "customer", active: true, name: "Cliente Um", email: "ONE@example.test" },
    { id: "u2", role: "customer", active: true, name: "Cliente Dois", email: "two@example.test", emailUnsubscribedAt: "2026-01-01" },
    { id: "u3", role: "admin", active: true, name: "Equipe", email: "team@example.test" }
  ],
  orders: [{ id: "o1", customerUserId: "u1", status: "paid", paidAt: "2026-01-02" }],
  movies: [{ id: "m1", workflowStatus: "published", status: "active" }]
};

test("audience excludes staff and unsubscribed customers and keeps purchase data", () => {
  const pool = audience.campaignCustomerPool(db);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].email, "one@example.test");
  assert.equal(pool[0].hasPurchased, true);
  assert.deepEqual(audience.campaignRecipients(db, { recipientMode: "purchased" }).map((user) => user.id), ["u1"]);
  assert.deepEqual(audience.campaignRecipients(db, { recipientMode: "selected", customerIds: ["u2"] }), []);
  const eligibility = audience.eligibleCampaignRecipients(db, { recipientMode: "all", movieIds: ["m1"] });
  assert.equal(eligibility.report.recipients.considered, 1);
  assert.equal(eligibility.recipients[0].unsubscribeUrl, "https://example.test/unsubscribe/u1");
});

test("campaign movie validation and incomplete template retain error contracts", () => {
  assert.throws(() => audience.resolveCampaignForInput(db, { movieIds: ["missing"] }), {
    code: "EMAIL_CAMPAIGN_MOVIE_NOT_FOUND", statusCode: 409
  });
  assert.throws(() => audience.resolveCampaignForInput({ ...db, movies: [{ id: "m1", workflowStatus: "draft" }] }, { movieIds: ["m1"] }), {
    code: "EMAIL_CAMPAIGN_MOVIE_UNAVAILABLE", statusCode: 409
  });
  assert.throws(() => audience.applyCampaignTemplateResolution({}, { incomplete: true, reason: "Escolha conteúdo" }), {
    code: "EMAIL_CAMPAIGN_CONTEXT_REQUIRED", statusCode: 409
  });
});
