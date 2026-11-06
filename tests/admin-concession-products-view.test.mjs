import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createConcessionProductsView } = require("../backend/public/admin-modules/concession-products-view.js");

test("product filters survive repeated renders and the shared catalog changes after API response", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", checked: false, innerHTML: "" });
    return elements.get(id);
  };
  const state = { content: { concessions: [
    { id: "combo", name: "Combo QA", category: "combo", active: true, price: 20 },
    { id: "drink", name: "Bebida QA", category: "drink", active: true, price: 8 }
  ] }, creating: { concession: false }, selectedConcessionId: "combo", concessionCategoryFilter: "combo", pendingImages: {} };
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const view = createConcessionProductsView({ state, $,
    api: async (path, options) => { calls.push([path, options]); return pending; },
    adminAssetUrl: String, cleanAdminAssetUrl: String,
    creationPlaceholder: () => "Novo produto", currentConcession: () => state.content.concessions.find((item) => item.id === state.selectedConcessionId),
    escapeHtml: String, formatConcessionStock: () => "", money: String,
    paginateAdminItems: (items) => ({ pageItems: items }), renderAdminListPager: () => "",
    renderConcessionInsights: () => {}, syncConcessionStockFields: () => {}, syncCreationControl: () => {}, setDisabled: () => {},
    upsertAdminCollection: (key, item) => { state.content[key].push(item); }, showSuccess: () => {}, showToast: () => {}
  });
  view.renderConcessions();
  view.renderConcessions();
  assert.match($("concessionsList").innerHTML, /Combo QA/);
  assert.doesNotMatch($("concessionsList").innerHTML, /Bebida QA/);
  view.newConcession();
  $("concessionName").value = "Novo QA";
  $("concessionPrice").value = "10";
  const saving = view.saveConcession({ preventDefault() {} });
  assert.equal(state.content.concessions.length, 2);
  assert.equal(calls[0][0], "/api/concessions");
  assert.equal(JSON.parse(calls[0][1].body).price, 10);
  release({ id: "new", name: "Novo QA", category: "combo", price: 10 });
  await saving;
  assert.equal(state.content.concessions.length, 3);
});
