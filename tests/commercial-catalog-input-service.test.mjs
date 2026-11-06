import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { createCommercialCatalogInputService } = require("../backend/services/commercialCatalogInputService.js");
const input = createCommercialCatalogInputService({
  slugify: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  storedLocalUploadUrl: (value) => String(value || "").startsWith("/uploads/") ? value : ""
});

test("commercial input keeps product inventory, coupon rules and ad validation", () => {
  const product = input.normalizeConcession({ name: "Combo", price: 25, stock: 2.5555, stockUnit: "kg", usagePerSale: 0.3333, imageUrl: "https://foreign.test/a.png", tags: "pipoca, bebida" });
  assert.equal(product.id, "combo");
  assert.equal(product.price, 25);
  assert.equal(product.stock, 2.555);
  assert.equal(product.usagePerSale, 0.333);
  assert.equal(product.imageUrl, "");
  assert.deepEqual(product.tags, ["pipoca", "bebida"]);

  const coupon = input.normalizePromotion({ title: "Promo", couponCode: " a b!1 ", value: 10, discountType: "amount" });
  assert.equal(coupon.couponCode, "AB1");
  assert.equal(coupon.value, 10);
  input.assertPromotionRules({ promotions: [] }, coupon);
  assert.throws(() => input.assertPromotionRules({ promotions: [{ id: "other", couponCode: "AB1" }] }, coupon), { code: "COUPON_CODE_DUPLICATE", statusCode: 409 });
  assert.throws(() => input.assertPromotionRules({ promotions: [] }, { ...coupon, discountType: "percent", value: 101 }), { code: "COUPON_PERCENT_INVALID", statusCode: 422 });

  const ad = input.normalizeAd({ title: "Campanha", imageUrl: "/uploads/ad.png", startsAt: "2026-11-01T12:00:00Z", endsAt: "2026-11-02T12:00:00Z" });
  assert.equal(ad.imageUrl, "/uploads/ad.png");
  assert.equal(ad.placement, "movie");
  assert.throws(() => input.normalizeAd({ startsAt: "2026-11-03", endsAt: "2026-11-02" }), { code: "AD_PERIOD_INVALID", statusCode: 422 });
});
