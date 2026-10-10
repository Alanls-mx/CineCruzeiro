import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createPromotionsView } = require("../backend/public/admin-modules/promotions-view.js");

function fixture() {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: "", textContent: "", value: "", checked: false, hidden: false,
      dataset: {}, classList: { toggle() {} }, setAttribute() {}
    });
    return elements.get(id);
  };
  const coupon = { id: "coupon-1", title: "Promo <QA>", couponCode: "QA", value: 10, discountType: "percent", active: true, usageCount: 1 };
  const state = {
    content: { promotions: [coupon], movies: [] }, selectedPromotionId: coupon.id,
    creating: { promotion: false }, promotionView: "active", promotionUsageHistory: [],
    promotionUsageMeta: null, promotionUsageCouponId: "", promotionUsageRequestToken: 0,
    promotionUsageLoading: false
  };
  const requests = [];
  const view = createPromotionsView({
    state, $, api: async (url) => {
      requests.push(url);
      return { usages: [{ orderId: "order-1", customerName: "Pessoa <QA>", discountAmount: 10, orderTotal: 50 }], total: 1, discountGranted: 10, page: 1, pages: 1 };
    },
    confirm: () => true, creationPlaceholder: () => "", currentPromotion: () => state.content.promotions.find((item) => item.id === state.selectedPromotionId),
    datetimeIsoValue: (value) => value, datetimeLocalValue: (value) => value || "",
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    money: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
    paginateAdminItems: (items) => ({ pageItems: items }), removeAdminCollectionItem() {}, renderAdminListPager: () => "",
    setAdminSubtab() {}, setDisabled() {}, showSuccess() {}, showToast() {}, syncCreationControl() {}, upsertAdminCollection() {}
  });
  return { view, state, $, coupon, requests };
}

test("promotions module loads before admin without duplicating its controller", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/promotions-view.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /CineAdminModules\.promotionsView\.createPromotionsView/);
  assert.doesNotMatch(admin, /function renderPromotions\(/);
});

test("promotions view preserves listing, archive filter and escaped usage history", async () => {
  const { view, state, $, coupon, requests } = fixture();
  state.promotionUsageCouponId = coupon.id;
  view.renderPromotions();
  assert.match($("promotionsList").innerHTML, /Promo &lt;QA&gt;/);
  assert.match($("promotionsList").innerHTML, /10%/);
  await view.loadPromotionUsage(coupon.id);
  assert.deepEqual(requests, ["/api/promotions/coupon-1/usage?page=1&pageSize=20"]);
  assert.match($("promotionUsageHistory").innerHTML, /Pessoa &lt;QA&gt;/);
  coupon.archivedAt = "2026-10-10T13:00:00Z";
  view.setPromotionView("archived");
  assert.match($("promotionsList").innerHTML, /Promo &lt;QA&gt;/);
  assert.equal(state.promotionView, "archived");
});
