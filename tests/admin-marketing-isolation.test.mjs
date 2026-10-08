import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { chromium } from "@playwright/test";

const source = fs.readFileSync(new URL("../backend/public/admin.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../backend/public/admin.html", import.meta.url), "utf8");
const functions = ["setAdminSubtab", "applyRbacVisibility"].map((name) => {
  const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} must exist`);
  return match[0];
}).join("\n");

test("permission refresh keeps email campaigns separate from Social Studio", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(html.replace(/<script\b[^>]*>[^]*?<\/script>/gi, ""));
    await page.evaluate((code) => {
      window.state = {
        adminUser: { role: "owner" },
        adminSubtabs: { marketing: "campaigns", accounts: "security" },
        creating: {},
      };
      window.$ = (id) => document.getElementById(id);
      window.ADMIN_PERMISSION_PRESETS = {};
      // Exercise the production navigation and RBAC functions against the real admin markup.
      window.eval(code);
    }, functions);

    for (const tab of ["social", "campaigns", "overview", "home", "promotions", "ads", "campaigns"]) {
      const visible = await page.evaluate((selected) => {
        setAdminSubtab("marketing", selected);
        applyRbacVisibility();
        applyRbacVisibility();
        return [...document.querySelectorAll('[data-admin-tab-panel^="marketing:"]')]
          .filter((panel) => !panel.hidden).map((panel) => panel.dataset.adminTabPanel);
      }, tab);
      assert.deepEqual(visible, [`marketing:${tab}`], `only ${tab} may remain visible after refresh`);
    }

    const allowed = await page.evaluate(() => {
      state.adminUser = { role: "staff", effectivePermissions: ["marketing.view", "marketing.manage", "social_studio.view"] };
      setAdminSubtab("marketing", "campaigns");
      applyRbacVisibility();
      return {
        studioHidden: document.querySelector('[data-admin-tab-panel="marketing:social"]').hidden,
        emailHidden: document.querySelector('[data-admin-tab-panel="marketing:campaigns"]').hidden,
        emailDisabled: document.querySelector("#emailCampaignSubject").disabled,
      };
    });
    assert.deepEqual(allowed, { studioHidden: true, emailHidden: false, emailDisabled: false });

    const denied = await page.evaluate(() => {
      state.adminUser.effectivePermissions = ["marketing.view", "marketing.manage"];
      setAdminSubtab("marketing", "social");
      applyRbacVisibility();
      return {
        studioHidden: document.querySelector('[data-admin-tab-panel="marketing:social"]').hidden,
        studioTabHidden: document.querySelector('[data-admin-tablist="marketing"] [data-admin-tab="social"]').hidden,
      };
    });
    assert.deepEqual(denied, { studioHidden: true, studioTabHidden: true });

    const accounts = await page.evaluate(() => {
      state.adminUser = { role: "owner" };
      setAdminSubtab("accounts", "security");
      applyRbacVisibility();
      return [...document.querySelectorAll('[data-admin-tab-panel^="accounts:"]')]
        .filter((panel) => !panel.hidden).map((panel) => panel.dataset.adminTabPanel);
    });
    assert.deepEqual(accounts, ["accounts:security"]);
  } finally {
    await browser.close();
  }
});
