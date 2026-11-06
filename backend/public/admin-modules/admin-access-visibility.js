((root) => {
  function createAdminAccessVisibility({ $, ADMIN_PERMISSION_PRESETS, activatePanel, setAdminSubtab, setBoxOfficeTab, setConcessionTab, state }) {
    function applyRbacVisibility() {
      const role = state.adminUser?.role || "";
      const owner = ["owner", "master"].includes(role);
      const permissions = new Set(state.adminUser?.effectivePermissions || ADMIN_PERMISSION_PRESETS[role] || []);
      const has = (permission) => owner || permissions.has(permission);
      const allowedPanels = new Set([
        (has("dashboard.view") || has("ticket_finance.view")) && "dashboardPanel",
        has("movies.view") && "moviesPanel",
        has("rooms.view") && "roomsPanel",
        (has("ticket_types.view") || has("tickets.view")) && "ticketsPanel",
        (has("box_office.sell") || has("orders.view") || has("tickets.validate") || has("payments.view")) && "ordersPanel",
        has("concessions.view") && "concessionsPanel",
        has("marketing.view") && "marketingPanel",
        has("club.view") && "clubPanel",
        "usersPanel",
        "myAccountPanel",
        has("integrations.view") && "integrationsPanel",
        has("logs.view") && "logsPanel"
      ].filter(Boolean));
      document.querySelectorAll(".nav-button[data-panel]").forEach((button) => {
        button.hidden = !allowedPanels.has(button.dataset.panel);
      });
      document.querySelectorAll("[data-owner-only='true']").forEach((element) => {
        if (element.classList.contains("nav-button")) return;
        if (element.matches("[data-admin-tab-panel]")) {
          const [group, tab] = String(element.dataset.adminTabPanel || "").split(":");
          element.hidden = !owner || state.adminSubtabs[group] !== tab;
          return;
        }
        element.hidden = !owner;
      });
      const teamTab = document.querySelector('[data-admin-tablist="accounts"] [data-admin-tab="team"]');
      if (teamTab) teamTab.hidden = !has("users.manage");
      const customersTab = document.querySelector('[data-admin-tablist="accounts"] [data-admin-tab="customers"]');
      if (customersTab) customersTab.hidden = !has("users.manage");
      if (!has("users.manage") && state.adminSubtabs.accounts !== "security") setAdminSubtab("accounts", "security");
      document.querySelectorAll("[data-permission]").forEach((element) => {
        if (element.matches("[data-admin-tab-panel]")) {
          const [group, tab] = String(element.dataset.adminTabPanel || "").split(":");
          // Permission grants access, not selection of an inactive tab.
          element.hidden = !has(element.dataset.permission) || state.adminSubtabs[group] !== tab;
          return;
        }
        element.hidden = !has(element.dataset.permission);
      });
      const setFormAccess = (id, allowed) => {
        const form = $(id);
        if (!form) return;
        form.classList.toggle("is-readonly", !allowed);
        form.querySelectorAll("input, select, textarea, button[type='submit']").forEach((control) => {
          control.disabled = !allowed;
        });
      };
      setFormAccess("movieForm", state.creating.movie ? has("movies.create") : has("movies.edit"));
      setFormAccess("roomForm", state.creating.room ? has("rooms.create") : has("rooms.edit"));
      setFormAccess("ticketForm", state.creating.ticket ? has("ticket_types.create") : has("ticket_types.edit"));
      setFormAccess("manualTicketForm", has("box_office.sell"));
      setFormAccess("concessionCounterForm", has("concessions.sell"));
      setFormAccess("concessionForm", has("concessions.edit"));
      setFormAccess("settingsForm", has("settings.manage"));
      setFormAccess("emailCampaignForm", has("marketing.manage"));
      setFormAccess("promotionForm", has("marketing.manage"));
      setFormAccess("adForm", has("marketing.manage"));
      setFormAccess("userForm", has("users.manage"));
      setFormAccess("customerUserForm", has("users.manage"));
      setFormAccess("clubVisualForm", has("club.manage"));
      setFormAccess("clubPlanForm", has("club.manage"));
      setFormAccess("clubAssignForm", has("club.manage"));
      setFormAccess("integrationForm", has("integrations.manage"));
      [
        ["newPromotionButton", "marketing.manage"],
        ["newAdButton", "marketing.manage"],
        ["adsMasterToggle", "marketing.manage"],
        ["emailBrandSaveButton", "marketing.manage"],
        ["newClubPlanButton", "club.manage"],
        ["newUserButton", "users.manage"],
        ["newCustomerUserButton", "users.manage"]
      ].forEach(([id, permission]) => {
        const element = $(id);
        if (element) element.hidden = !has(permission);
      });
      const activeBoxOfficeTab = document.querySelector("[data-box-office-tab].active");
      if (activeBoxOfficeTab?.hidden) {
        const firstAvailableTab = [...document.querySelectorAll(".box-office-tabs [data-box-office-tab]")].find((button) => !button.hidden);
        if (firstAvailableTab) setBoxOfficeTab(firstAvailableTab.dataset.boxOfficeTab);
      }
      const activeConcessionTab = document.querySelector("[data-concession-tab].active");
      if (activeConcessionTab?.hidden) {
        const firstAvailableTab = [...document.querySelectorAll(".concession-tabs [data-concession-tab]")].find((button) => !button.hidden);
        if (firstAvailableTab) setConcessionTab(firstAvailableTab.dataset.concessionTab);
      }
      const active = document.querySelector(".panel.active")?.id;
      if (active && !allowedPanels.has(active)) activatePanel(allowedPanels.has("dashboardPanel") ? "dashboardPanel" : "ordersPanel", { scroll: false });
    }
    return { applyRbacVisibility };
  }
  const api = Object.freeze({ createAdminAccessVisibility });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.adminAccessVisibility = api; }
})(globalThis);
