import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import inputFactory from "../backend/services/emailCampaignInputService.js";

const inputService = inputFactory.createEmailCampaignInputService({
  crypto,
  validCampaignTemplate: (value, fallback) => value === "announcement" ? value : fallback,
  appFrontendUrl: () => "https://example.test"
});

test("campaign input preserves IDs, status and limits unsafe values", () => {
  const campaign = inputService.normalizeCampaignInput({
    subject: `  ${"A".repeat(200)}  `,
    status: "draft",
    variables: { nome: "reserved", PROMO: " cupom ", "bad-key": "discard" },
    customerIds: [1, 2],
    movieIds: [" m1 ", "m1", "m2"],
    accentColor: "not-a-color",
    scheduleAt: "invalid",
    contentBlocks: [{ type: "heading", content: "ignored in template mode" }]
  }, { id: "campaign-1", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(campaign.id, "campaign-1");
  assert.equal(campaign.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(campaign.subject.length, 180);
  assert.deepEqual(campaign.variables, { promo: "cupom" });
  assert.deepEqual(campaign.customerIds, ["1", "2"]);
  assert.deepEqual(campaign.movieIds, ["m1", "m2"]);
  assert.equal(campaign.accentColor, "#facc15");
  assert.equal(campaign.scheduleAt, "");
  assert.deepEqual(campaign.contentBlocks, []);
});

test("legacy blocks and installation logo remain compatible", () => {
  const brand = inputService.normalizeEmailBrand({ logoUrl: "/images/logo-display.webp", name: "Cinema sintético" });
  assert.equal(brand.logoUrl, "https://example.test/images/favicon-email.png");
  assert.equal(brand.name, "Cinema sintético");
  const campaign = inputService.normalizeCampaignInput({}, {
    id: "legacy-1",
    mode: "legacy_visual",
    contentBlocks: [{ id: "title!", type: "heading", color: "#FF00AA", content: "Olá" }],
    brand
  });
  assert.equal(campaign.mode, "legacy_visual");
  assert.equal(campaign.contentBlocks[0].id, "title");
  assert.equal(campaign.contentBlocks[0].color, "#ff00aa");
  assert.equal(campaign.brand.logoUrl, brand.logoUrl);
});
