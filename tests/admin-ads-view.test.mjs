import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAdsView } = require("../backend/public/admin-modules/ads-view.js");

function fixture() {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      innerHTML: "", textContent: "", value: "", checked: false, hidden: false,
      dataset: {}, setAttribute(name, value) { this[name] = value; }
    });
    return elements.get(id);
  };
  const ad = { id: "ad-1", title: "Oferta <QA>", active: true, impressions: 5, clicks: 1 };
  const state = { content: { ads: [ad], settings: { adsEnabled: true } }, creating: { ad: false }, selectedAdId: ad.id, adsStatusUpdating: false };
  const calls = [];
  const view = createAdsView({
    state, $, api: async (url, options) => {
      calls.push([url, options]);
      return url === "/api/ads/status" ? { enabled: false } : {};
    },
    cleanAdminAssetUrl: (value) => value, confirm: () => true,
    creationPlaceholder: () => "", currentAd: () => state.content.ads.find((item) => item.id === state.selectedAdId),
    datetimeIsoValue: (value) => value, datetimeLocalValue: (value) => value || "",
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    loadContent: async () => {}, paginateAdminItems: (items) => ({ pageItems: items }), renderAdminImagePreview() {},
    renderAdminListPager: () => "", renderMarketingOverview() {}, setAdminSubtab() {}, setDisabled() {},
    showSuccess: (...args) => calls.push(args), showToast() {}, syncCreationControl() {}
  });
  return { view, state, $, calls };
}

test("ads module loads before admin and retains explicit integration", async () => {
  const html = await fs.readFile(new URL("../backend/public/admin.html", import.meta.url), "utf8");
  assert.ok(html.indexOf("admin-modules/ads-view.js") < html.indexOf('src="admin.js'));
  const admin = await fs.readFile(new URL("../backend/public/admin.js", import.meta.url), "utf8");
  assert.match(admin, /CineAdminModules\.adsView\.createAdsView/);
  assert.doesNotMatch(admin, /function renderAds\(/);
});

test("ads view renders escaped data and keeps status toggle endpoint", async () => {
  const { view, state, $, calls } = fixture();
  view.renderAds();
  assert.match($("adsList").innerHTML, /Oferta &lt;QA&gt;/);
  assert.equal($("adTitle").value, "Oferta <QA>");
  assert.equal($("adsMasterToggle")["aria-checked"], "true");
  await view.toggleAdsStatus();
  assert.equal(calls[0][0], "/api/ads/status");
  assert.deepEqual(JSON.parse(calls[0][1].body), { enabled: false });
  assert.equal(state.content.settings.adsEnabled, false);
  assert.equal($("adsMasterToggle")["aria-checked"], "false");
});
