import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTeamAccountsView } = require("../backend/public/admin-modules/team-accounts-view.js");

function fixture(apiOverride) {
  const elements = new Map();
  const calls = [];
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: "", checked: false, disabled: false, innerHTML: "", required: false,
      classList: { toggle() {} }, querySelector: () => ({ disabled: false })
    });
    return elements.get(id);
  };
  const inputs = [{ value: "movies.view" }, { value: "users.manage" }];
  const document = { querySelectorAll: () => inputs };
  const state = {
    content: { users: [
      { id: "owner", name: "Ana Silva", email: "ana@example.test", role: "owner", active: true },
      { id: "customer", name: "Cliente", role: "customer", active: true }
    ], settings: {} },
    creating: { user: false }, selectedUserId: "owner", adminUser: { id: "other" }
  };
  const view = createTeamAccountsView({ state, $, document,
    api: apiOverride || (async (path, options) => {
      calls.push([path, options]);
      return { ...JSON.parse(options.body), id: "new" };
    }),
    confirm: () => true, creationPlaceholder: () => "Nova conta",
    paginateAdminItems: (items) => ({ pageItems: items }),
    escapeHtml: String, staffAvatarMarkup: () => "AS", adminRoleLabel: (role) => role,
    renderAdminListPager: () => "", currentUser: () => state.content.users.find((item) => item.id === state.selectedUserId),
    syncCreationControl: () => {}, setDisabled: () => {}, renderStaffAvatar: () => {},
    upsertAdminCollection: (key, item) => { state.content[key].push(item); },
    renderCustomerUsers: () => calls.push(["renderCustomerUsers"]), loadAdminUser: async () => {},
    showSuccess: () => {}, showToast: (message, kind) => calls.push(["toast", message, kind]),
    removeAdminCollectionItem: (key, id) => { state.content[key] = state.content[key].filter((item) => item.id !== id); },
    renderAccountSecuritySummary: () => {}
  });
  return { view, state, $, inputs, calls };
}

test("repeated team rendering preserves one presentation path and excludes customers", () => {
  const { view, $, inputs } = fixture();
  view.renderUsers();
  view.renderUsers();
  assert.match($("usersList").innerHTML, /Ana Silva/);
  assert.doesNotMatch($("usersList").innerHTML, /Cliente/);
  assert.equal($("userName").value, "Ana Silva");
  assert.equal($("userPassword").required, false);
  assert.equal($("userUseCustomPermissions").disabled, true);
  assert.ok(inputs.every((input) => input.disabled));
});

test("team creation sends one request and clears the saving flag after an API error", async () => {
  const { view, $, state, calls } = fixture();
  view.newUser();
  $("userName").value = "Operador QA";
  $("userEmail").value = "operator@example.test";
  $("userPassword").value = "synthetic-password";
  $("userRole").value = "operator";
  await view.saveUser({ preventDefault() {} });
  const requests = calls.filter(([path]) => path === "/api/users");
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].method, "POST");
  assert.equal(JSON.parse(requests[0][1].body).accountType, "team");
  assert.equal(state.savingUser, false);

  const failing = fixture(async () => { throw new Error("falha sintética"); });
  failing.view.newUser();
  await failing.view.saveUser({ preventDefault() {} });
  assert.equal(failing.state.savingUser, false);
  assert.deepEqual(failing.calls.find(([kind]) => kind === "toast"), ["toast", "falha sintética", "error"]);
});
