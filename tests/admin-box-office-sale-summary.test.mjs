import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createBoxOfficeSaleSummary } = require("../backend/public/admin-modules/box-office-sale-summary.js");

test("sale summary displays ticket, concession and selected seat without API calls", () => {
  const elements = new Map([["manualSaleSummary", { innerHTML: "" }], ["manualCustomerName", { value: "Pessoa QA" }]]);
  const state = { saleMode: "guest", manualSaleItems: [{ movieTitle: "Filme QA", sessionDate: "2026-11-06", sessionTime: "20:00",
    ticketSummary: [{ name: "Inteira", quantity: 1, unitPrice: 10, bundleQuantity: 1 }], selectedSeatLabels: ["A1"], subtotal: 10 }],
    content: { concessions: [{ id: "product-qa", name: "Pipoca", price: 5 }] } };
  const view = createBoxOfficeSaleSummary({ state, $: (id) => elements.get(id),
    document: { querySelector: () => ({ value: "cash" }) }, escapeHtml: String,
    money: (amount) => `R$ ${amount}`, manualSaleDraft: () => null,
    manualConcessionItems: () => [{ id: "product-qa", quantity: 2 }],
    manualSessionDateDisplay: (date) => date
  });
  view.renderManualSaleSummary();
  assert.match(elements.get("manualSaleSummary").innerHTML, /Pessoa QA/);
  assert.match(elements.get("manualSaleSummary").innerHTML, /A1/);
  assert.match(elements.get("manualSaleSummary").innerHTML, /R\$ 20/);
});
