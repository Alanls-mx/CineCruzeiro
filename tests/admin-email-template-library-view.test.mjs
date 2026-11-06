import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createEmailTemplateLibraryView } = require("../backend/public/admin-modules/email-template-library-view.js");

test("template library exposes an API failure in the same grid", async () => {
  const grid = { innerHTML: "" };
  const view = createEmailTemplateLibraryView({ state: { emailTemplateLibraryPage: 1 },
    $: (id) => id === "emailTemplateLibraryGrid" ? grid : null,
    api: async () => { throw new Error("falha sintética"); }, escapeHtml: String });
  await view.loadEmailTemplateLibrary();
  assert.match(grid.innerHTML, /falha sintética/);
  assert.match(grid.innerHTML, /data-template-library-retry/);
});

test("template preview opens its modal and shows a failed request without adding listeners", async () => {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: "", innerHTML: "", disabled: false,
      showModal() { this.open = true; }, close() { this.open = false; },
      querySelector: () => ({ srcdoc: "" }) });
    return elements.get(id);
  };
  const state = { emailTemplateLibrary: { items: [{ id: "model", name: "Modelo QA", categoryLabel: "Filmes" }] } };
  const view = createEmailTemplateLibraryView({ state, $, escapeHtml: String,
    api: async () => { throw new Error("falha de rede"); } });
  await view.previewEmailTemplateLibraryItem("model");
  assert.equal($("emailTemplatePreviewDialog").open, true);
  assert.equal($("emailTemplatePreviewUse").disabled, true);
  assert.match($("emailTemplatePreviewContent").innerHTML, /falha de rede/);
  $("emailTemplatePreviewDialog").close();
  assert.equal($("emailTemplatePreviewDialog").open, false);
});
