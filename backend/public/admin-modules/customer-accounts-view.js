((root) => {
  function createCustomerAccountsView({ state, $, api, confirm, creationPlaceholder, currentCustomerAccount, escapeHtml,
    normalizedSearchText, removeAdminCollectionItem, renderUsers, setDisabled, showSuccess, showToast,
    syncCreationControl, twoFactorDate, upsertAdminCollection }) {
    function filteredCustomerAccounts() {
      const query = normalizedSearchText(state.customerAccountsSearch || "");
      const digits = query.replace(/\D/g, "");
      return (state.content?.users || [])
        .filter((item) => item.role === "customer")
        .filter((item) => {
          if (!query) return true;
          return [item.name, item.email].some((value) => normalizedSearchText(value).includes(query))
            || (digits && [item.phone, item.cpf].some((value) => String(value || "").replace(/\D/g, "").includes(digits)));
        });
    }
    
    function renderCustomerUsers() {
      if (!$("customerUsersList")) return;
      const items = filteredCustomerAccounts();
      if (state.creating.customerUser) {
        $("customerUsersList").innerHTML = creationPlaceholder("Novo cliente", "Cadastre uma conta comum no formulário ao lado. Ela não terá acesso ao painel.");
        fillCustomerUserForm(null);
        return;
      }
      const pageSize = state.customerAccountsPageSize || 10;
      const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
      state.customerAccountsPage = Math.min(Math.max(1, state.customerAccountsPage || 1), totalPages);
      const start = (state.customerAccountsPage - 1) * pageSize;
      const pageItems = items.slice(start, start + pageSize);
      const pagerMarkup = items.length > pageSize ? `
        <div class="table-pagination-bar customer-pagination-bar">
          <span>Exibindo <strong>${start + 1}-${Math.min(start + pageItems.length, items.length)}</strong> de <strong>${items.length}</strong> cliente(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.customerAccountsPage <= 1 ? "disabled" : ""} data-static-pager="customer-accounts" data-page-delta="-1">Anterior</button>
            <span class="pager-page-indicator">Página ${state.customerAccountsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.customerAccountsPage >= totalPages ? "disabled" : ""} data-static-pager="customer-accounts" data-page-delta="1">Próxima</button>
          </div>
        </div>
      ` : "";
      $("customerUsersList").innerHTML = items.length
        ? `${pageItems.map((item) => `
            <button class="list-item ${item.id === state.selectedCustomerAccountId ? "active" : ""}" type="button" data-admin-select-kind="customer" data-admin-select-id="${escapeHtml(item.id)}">
              <span>
                <span class="list-title">${escapeHtml(item.name)}</span>
                <span class="list-meta">${escapeHtml(item.email || "sem e-mail")} • ${item.emailVerified ? "e-mail verificado" : "verificação pendente"}</span>
              </span>
              <span class="badge">${item.active ? "ativo" : "off"}</span>
            </button>
          `).join("")}${pagerMarkup}`
        : `<div class="empty-state"><strong>${state.customerAccountsSearch ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</strong><span>${state.customerAccountsSearch ? "Revise o nome, e-mail, telefone ou CPF pesquisado." : "As contas criadas no site também aparecerão aqui."}</span></div>`;
      fillCustomerUserForm(currentCustomerAccount());
    }
    
    function changeCustomerAccountsPage(delta) {
      state.customerAccountsPage = Math.max(1, (state.customerAccountsPage || 1) + delta);
      renderCustomerUsers();
      $("customerUsersList")?.closest(".surface")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    
    function selectCustomerAccount(id) {
      state.creating.customerUser = false;
      state.selectedCustomerAccountId = id;
      renderCustomerUsers();
    }
    
    function newCustomerUser() {
      state.creating.customerUser = true;
      state.selectedCustomerAccountId = "";
      renderCustomerUsers();
    }
    
    function fillCustomerUserForm(item) {
      syncCreationControl("customerUser", "cancelCustomerUserCreateButton", "deleteCustomerUserButton", Boolean(item));
      setDisabled("deleteCustomerUserButton", !item);
      $("customerUserId").value = item?.id || "";
      const [customerFirstName = "", ...customerLastName] = String(item?.name || "").trim().split(/\s+/);
      $("customerUserName").value = customerFirstName;
      $("customerUserLastName").value = customerLastName.join(" ");
      $("customerUserEmail").value = item?.email || "";
      $("customerUserPhone").value = String(item?.phone || "").replace(/\D/g, "").slice(0, 11);
      $("customerUserCpf").value = String(item?.cpf || "").replace(/\D/g, "").slice(0, 11);
      $("customerUserPassword").value = "";
      $("customerUserPassword").required = !item;
      $("customerUserActive").checked = item?.active !== false;
      $("customerAccountStatus").textContent = item
        ? `${item.emailVerified ? "E-mail verificado" : "E-mail ainda não verificado"}. Criada em ${twoFactorDate(item.createdAt || "") || "data não informada"}.`
        : "A nova conta será criada como cliente, sem qualquer permissão administrativa.";
    }
    
    async function saveCustomerUser(event) {
      event.preventDefault();
      try {
        const payload = {
          id: $("customerUserId").value || undefined,
          name: `${$("customerUserName").value.trim()} ${$("customerUserLastName").value.trim()}`.trim(),
          email: $("customerUserEmail").value,
          phone: $("customerUserPhone").value,
          cpf: $("customerUserCpf").value,
          password: $("customerUserPassword").value || undefined,
          active: $("customerUserActive").checked,
          accountType: "customer"
        };
        const existingId = $("customerUserId").value;
        const saved = existingId
          ? await api(`/api/users/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
        state.creating.customerUser = false;
        state.selectedCustomerAccountId = saved.id;
        $("customerUserPassword").value = "";
        upsertAdminCollection("users", saved);
        const savedIndex = filteredCustomerAccounts().findIndex((item) => item.id === saved.id);
        if (savedIndex >= 0) state.customerAccountsPage = Math.floor(savedIndex / (state.customerAccountsPageSize || 10)) + 1;
        renderCustomerUsers();
        renderUsers();
        showSuccess("Cliente salvo", `${saved.name} continua com acesso somente ao site e à própria conta.`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }
    
    async function deleteCustomerUser() {
      const item = currentCustomerAccount();
      if (!item || !confirm(`Excluir a conta de cliente de ${item.name}?`)) return;
      try {
        await api(`/api/users/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        state.selectedCustomerAccountId = "";
        removeAdminCollectionItem("users", item.id);
        renderCustomerUsers();
        renderUsers();
        showToast("Conta de cliente excluída.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    return { filteredCustomerAccounts, renderCustomerUsers, changeCustomerAccountsPage, selectCustomerAccount,
      newCustomerUser, fillCustomerUserForm, saveCustomerUser, deleteCustomerUser };
  }

  const api = Object.freeze({ createCustomerAccountsView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.customerAccountsView = api; }
})(globalThis);
