import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createEmailCampaignEditor } = require("../backend/public/admin-modules/email-campaign-editor.js");

test("campaign send blocks an incomplete coupon before any API request", async () => {
  const requests = [];
  const notices = [];
  const elements = new Map([["emailCampaignCoupon", { value: "" }], ["emailCampaignResult", { textContent: "" }]]);
  const editor = createEmailCampaignEditor({
    state: {}, $: (id) => elements.get(id) || null,
    campaignTemplateDefinition: () => ({ coupon: true }),
    api: async (path) => { requests.push(path); },
    showToast: (...args) => notices.push(args)
  });
  await editor.saveEmailCampaign({ preventDefault() {} }, "send");
  assert.deepEqual(requests, []);
  assert.deepEqual(notices[0], ["Selecione o cupom que será aplicado neste modelo.", "error"]);
});
