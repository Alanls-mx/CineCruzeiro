((root) => {
  function bindDashboardAndOverlayEvents({
    $, activatePanel, cancelOrDeleteOrder, closeAdminDrawer, closeIntegrationConfig, closeOrderOverlay,
    closePermanentDelete, executeOrderRefundConcessions, executeOrderRefundTickets, exportLogs, hideSuccess, loadConcessionDailySales,
    loadConcessionFinance, loadLogs, logoutAdmin, openPermanentDelete, permanentlyDeleteSelectedOrder, pruneLogs,
    refreshDashboardOnly, refreshPaymentsOnly, renderDashboardChart, runWebhookBatch, saveIntegration, saveOrderEdit,
    simulateWebhook, state, testIntegration, toggleIntegration
  }) {
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.addEventListener("click", () => {
        activatePanel(button.dataset.panel, { scroll: true });
        closeAdminDrawer();
      });
    });

    $("logoutButton").addEventListener("click", logoutAdmin);
    $("successCloseButton").addEventListener("click", hideSuccess);
    $("successOverlay").addEventListener("click", (event) => {
      if (event.target === $("successOverlay")) hideSuccess();
    });
    $("orderOverlayCloseButton").addEventListener("click", closeOrderOverlay);
    $("orderOverlay").addEventListener("click", (event) => {
      if (event.target === $("orderOverlay")) closeOrderOverlay();
    });
    $("orderEditorForm").addEventListener("submit", saveOrderEdit);
    $("orderCancelButton").addEventListener("click", () => cancelOrDeleteOrder());
    $("orderRefundTicketsButton")?.addEventListener("click", () => executeOrderRefundTickets());
    $("orderRefundConcessionsButton")?.addEventListener("click", () => executeOrderRefundConcessions());
    $("orderPermanentDeleteButton").addEventListener("click", () => openPermanentDelete());
    $("permanentDeleteCloseButton").addEventListener("click", closePermanentDelete);
    $("permanentDeleteBackButton").addEventListener("click", closePermanentDelete);
    $("permanentDeleteOverlay").addEventListener("click", (event) => {
      if (event.target === $("permanentDeleteOverlay")) closePermanentDelete();
    });
    $("permanentDeleteForm").addEventListener("submit", permanentlyDeleteSelectedOrder);
    $("integrationForm").addEventListener("submit", saveIntegration);
    $("integrationCloseButton").addEventListener("click", closeIntegrationConfig);
    $("integrationOverlay").addEventListener("click", (event) => {
      if (event.target === $("integrationOverlay")) closeIntegrationConfig();
    });
    $("integrationTestButton").addEventListener("click", () => {
      if (state.selectedIntegrationKey) testIntegration(state.selectedIntegrationKey);
    });
    $("integrationDisableButton").addEventListener("click", () => {
      const key = state.selectedIntegrationKey;
      const current = state.integrations?.integrations?.[key];
      if (key && current) toggleIntegration(key, !current.enabled);
    });
    window.CineAdminModules.logEvents.bindLogEvents({ $, document, state, loadLogs, exportLogs, pruneLogs });
    $("webhookSimulateButton")?.addEventListener("click", simulateWebhook);
    $("webhookBatchButton")?.addEventListener("click", runWebhookBatch);
    $("webhookTestAction")?.addEventListener("change", () => {
      const action = $("webhookTestAction").value;
      if (action === "order.action_required") $("webhookTestStatus").value = "action_required";
      else if (action === "order.cancelled") $("webhookTestStatus").value = "cancelled";
      else if (action === "order.refunded") $("webhookTestStatus").value = "refunded";
      else if (action === "order.processed") $("webhookTestStatus").value = "processed";
    });
    document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.dashboardPeriod = button.dataset.dashboardPeriod;
        document.querySelectorAll("[data-dashboard-period]").forEach((item) => item.classList.toggle("active", item === button));
        const custom = state.dashboardPeriod === "custom";
        $("dashboardFrom").hidden = !custom;
        $("dashboardTo").hidden = !custom;
        await refreshDashboardOnly();
        await refreshPaymentsOnly();
      });
    });
    document.querySelectorAll("[data-dashboard-metric]").forEach((button) => {
      button.addEventListener("click", () => {
        state.dashboardMetric = button.dataset.dashboardMetric;
        document.querySelectorAll("[data-dashboard-metric]").forEach((item) => item.classList.toggle("active", item === button));
        if ($("dashChartHint")) $("dashChartHint").textContent = "";
        renderDashboardChart(state.dashboard?.chart || []);
      });
    });
    document.querySelectorAll("[data-dash-channel-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.dashChannelTab;
        document.querySelectorAll("[data-dash-channel-tab]").forEach((item) => item.classList.toggle("active", item === button));
        if ($("dashChannelTabOrigin")) $("dashChannelTabOrigin").hidden = tab !== "origin";
        if ($("dashChannelTabMethods")) $("dashChannelTabMethods").hidden = tab !== "methods";
        if ($("dashChannelTabClub")) $("dashChannelTabClub").hidden = tab !== "club";
      });
    });
    ["dashboardFrom", "dashboardTo"].forEach((id) => {
      $(id).addEventListener("change", async () => {
        state.dashboardFrom = $("dashboardFrom").value;
        state.dashboardTo = $("dashboardTo").value;
        if (state.dashboardPeriod === "custom") {
          await refreshDashboardOnly();
          await refreshPaymentsOnly();
        }
      });
    });
    document.querySelectorAll("[data-concession-period]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.concessionPeriod = button.dataset.concessionPeriod;
        document.querySelectorAll("[data-concession-period]").forEach((item) => item.classList.toggle("active", item === button));
        const custom = state.concessionPeriod === "custom";
        if ($("concessionCustomDates")) $("concessionCustomDates").hidden = !custom;
        await loadConcessionFinance();
      });
    });
    ["concessionFrom", "concessionTo"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("change", async () => {
          state.concessionFrom = $("concessionFrom").value;
          state.concessionTo = $("concessionTo").value;
          if (state.concessionPeriod === "custom") {
            await loadConcessionFinance();
          }
        });
      }
    });
    $("concessionFinanceRefreshBtn")?.addEventListener("click", async () => {
      await loadConcessionFinance();
    });
  }
  const api = Object.freeze({ bindDashboardAndOverlayEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindDashboardAndOverlayEvents = api; }
})(globalThis);
