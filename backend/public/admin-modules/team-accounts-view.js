((root) => {
  function createTeamAccountsView({ state, $, document, api, confirm, creationPlaceholder, paginateAdminItems, escapeHtml, staffAvatarMarkup, adminRoleLabel, renderAdminListPager, currentUser, syncCreationControl, setDisabled, renderStaffAvatar, upsertAdminCollection, renderCustomerUsers, loadAdminUser, showSuccess, showToast, removeAdminCollectionItem, renderAccountSecuritySummary }) {
    const ALL_ADMIN_PERMISSIONS = [
      "dashboard.view", "ticket_finance.view", "ticket_finance.export", "ticket_finance.configure",
      "movies.view", "movies.create", "movies.edit", "movies.delete", "sessions.manage",
      "rooms.view", "rooms.create", "rooms.edit", "rooms.delete", "sessions.autocorrect",
      "ticket_types.view", "ticket_types.create", "ticket_types.edit", "ticket_types.delete",
      "box_office.sell", "box_office.courtesy", "tickets.view", "tickets.validate",
      "orders.view", "orders.edit", "orders.cancel", "orders.archive", "orders.delete", "orders.refund", "orders.print", "orders.resend", "payments.view",
      "concessions.view", "concessions.sell", "concessions.edit", "concessions.delete", "concessions.refund",
      "marketing.view", "marketing.manage", "social_studio.view", "social_studio.create", "social_studio.delete",
      "club.view", "club.manage", "club.credits",
      "integrations.view", "integrations.manage", "logs.view", "logs.delete", "users.manage", "settings.view", "settings.manage", "media.manage"
    ];

    const ADMIN_PERMISSION_PRESETS = {
      owner: [...ALL_ADMIN_PERMISSIONS],
      manager: ALL_ADMIN_PERMISSIONS.filter((permission) => !["integrations.view", "integrations.manage", "settings.manage", "users.manage", "logs.delete"].includes(permission)),
      operator: ["dashboard.view", "movies.view", "rooms.view", "tickets.view", "tickets.validate", "orders.view", "orders.print", "payments.view", "box_office.sell", "concessions.view", "concessions.sell"]
    };

    function selectedUserPermissions() {
      return [...document.querySelectorAll("#userPermissions input:checked")].map((input) => input.value);
    }

    function syncUserPermissionEditor(permissions = null) {
      const custom = Boolean($("userUseCustomPermissions")?.checked);
      const role = $("userRole")?.value || "operator";
      const selected = new Set(Array.isArray(permissions) ? permissions : ADMIN_PERMISSION_PRESETS[role] || []);
      document.querySelectorAll("#userPermissions input").forEach((input) => {
        input.checked = selected.has(input.value);
        input.disabled = !custom || role === "owner";
      });
      if ($("userUseCustomPermissions")) {
        $("userUseCustomPermissions").disabled = role === "owner";
        if (role === "owner") $("userUseCustomPermissions").checked = false;
      }
      $("userPermissions")?.classList.toggle("is-readonly", !custom || role === "owner");
    }

    function renderUsers() {
      const items = (state.content?.users || []).filter((item) => item.role !== "customer");
      if (state.creating.user) {
        $("usersList").innerHTML = creationPlaceholder("Novo usuário", "Cadastre operador, gerente ou dono no quadro à direita.");
        fillUserForm(null);
        return;
      }
      const pagination = paginateAdminItems(items, "users", "selectedUserId");
      $("usersList").innerHTML = items.length
        ? pagination.pageItems.map((item) => `
            <button class="list-item ${item.id === state.selectedUserId ? "active" : ""}" type="button" data-admin-select-kind="user" data-admin-select-id="${escapeHtml(item.id)}">
              <span class="staff-list-identity">
                <span class="staff-avatar" aria-hidden="true">${staffAvatarMarkup(item)}</span>
                <span><span class="list-title">${escapeHtml(item.name)}</span>
                <span class="list-meta">${escapeHtml(item.email || "sem email")} • ${escapeHtml(adminRoleLabel(item.role))} • ${item.twoFactorEnabled ? "2FA ativo" : "2FA pendente"}${item.useCustomPermissions ? " • acesso personalizado" : ""}</span>
                </span>
              </span>
              <span class="badge">${item.active ? "ativo" : "off"}</span>
            </button>
          `).join("") + renderAdminListPager("users", pagination, "conta(s)")
        : `<div class="empty-state"><strong>Ninguém na equipe</strong><span>Adicione uma conta administrativa para conceder acesso ao painel.</span></div>`;
      fillUserForm(currentUser());
    }

    function selectUser(id) {
      state.creating.user = false;
      state.selectedUserId = id;
      renderUsers();
    }

    function newUser() {
      state.creating.user = true;
      state.selectedUserId = "";
      $("usersList").innerHTML = creationPlaceholder("Novo usuário", "Cadastre operador, gerente ou dono no quadro à direita.");
      fillUserForm(null);
    }

    function fillUserForm(item) {
      syncCreationControl("user", "cancelUserCreateButton", "deleteUserButton", Boolean(item));
      setDisabled("deleteUserButton", !item);
      $("userId").value = item?.id || "";
      $("userName").value = item?.name || "";
      $("userEmail").value = item?.email || "";
      $("userPassword").value = "";
      $("userPassword").required = !item;
      $("userPicture").value = item?.picture || "";
      $("userRemovePhoto").disabled = !item?.picture;
      renderStaffAvatar($("userAvatar"), item || {});
      $("userRole").value = item?.role === "editor" ? "manager" : item?.role || "operator";
      $("userActive").checked = item?.active !== false;
      $("userUseCustomPermissions").checked = Boolean(item?.useCustomPermissions);
      syncUserPermissionEditor(item?.useCustomPermissions ? (item.effectivePermissions || item.adminPermissions) : null);
    }

    async function saveUser(event) {
      event.preventDefault();
      if (state.savingUser) return;
      state.savingUser = true;
      const button = $("userForm").querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        const payload = {
          id: $("userId").value || undefined,
          name: $("userName").value,
          email: $("userEmail").value,
          password: $("userPassword").value || undefined,
          ...($("userPicture").value !== (currentUser()?.picture || "") ? { picture: $("userPicture").value } : {}),
          accountType: "team",
          role: $("userRole").value,
          active: $("userActive").checked,
          useCustomPermissions: $("userUseCustomPermissions").checked,
          adminPermissions: selectedUserPermissions()
        };
        const existingId = $("userId").value;
        const saved = existingId
          ? await api(`/api/users/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
        state.creating.user = false;
        state.selectedUserId = saved.id;
        $("userPassword").value = "";
        upsertAdminCollection("users", saved);
        renderUsers();
        renderCustomerUsers();
        if (saved.id === state.adminUser?.id) await loadAdminUser();
        showSuccess("Usuário salvo", `${saved.name} foi atualizado.`);
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        state.savingUser = false;
        if (button) button.disabled = false;
      }
    }

    async function saveAdminSecurityPolicy(event) {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        const result = await api("/api/admin/security-policy", {
          method: "PUT",
          body: JSON.stringify({ adminTwoFactorRequired: $("adminTwoFactorRequired").checked })
        });
        if (state.content?.settings) state.content.settings.adminTwoFactorRequired = result.adminTwoFactorRequired;
        if (state.twoFactorStatus) state.twoFactorStatus.requiredByPolicy = result.adminTwoFactorRequired;
        renderAccountSecuritySummary();
        showSuccess("Política atualizada", result.adminTwoFactorRequired ? "O 2FA agora é obrigatório para todas as contas do painel." : "Cada conta poderá ativar ou desativar o próprio 2FA.");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        if (button) button.disabled = false;
      }
    }

    async function deleteUser() {
      const item = currentUser();
      if (!item || !confirm(`Excluir ${item.name}?`)) return;
      try {
        await api(`/api/users/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        state.selectedUserId = "";
        removeAdminCollectionItem("users", item.id);
        renderUsers();
        renderCustomerUsers();
        showToast("Usuário excluído.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { ADMIN_PERMISSION_PRESETS, selectedUserPermissions, syncUserPermissionEditor, renderUsers, selectUser, newUser, fillUserForm, saveUser, saveAdminSecurityPolicy, deleteUser };
  }

  const api = Object.freeze({ createTeamAccountsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.teamAccountsView = api; }
})(globalThis);
