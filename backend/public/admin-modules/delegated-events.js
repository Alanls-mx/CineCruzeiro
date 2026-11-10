((root) => {
  function bindDelegatedEvents({
    $, activatePanel, adjustClubCredit, applySessionAutocorrect, archiveOrderAdmin, cancelEmailCampaign,
    cancelOrDeleteOrder, changeAdminListPage, changeBoxOfficeCustomer, changeClubSubscriptionsPage, changeClubUsagePage, changeConcessionBreakdownPage,
    changeConcessionDailySalesPage, changeCustomerAccountsPage, changeDashLatestOrdersPage, changeDashMoviePage, changeDashSessionsPage, changeDashTopProductsPage,
    changeIssuedTicketsPage, changeMovieSessionsPage, changeOrdersPage, changePaymentsPage, changeWebhookHistoryPage, clearSessionAutocorrectPreview,
    closeAdminDrawer, closeAdminProfileMenu, closeConcessionOrderOverlay, closeFloatingActionMenu, closeIntegrationConfig, closeResponsiveSelects,
    closeTwoFactorSettings, copyCommercialCatalogLink, copyCommercialCatalogToken, copyTicketCode, createSessionFromDashboard, deleteClubSubscription,
    deleteEmailCampaign, duplicateEmailCampaign, editEmailCampaign, generateCommercialCatalogToken, importTmdbMovie, loadPromotionUsage,
    openConcessionOrderDetail, openGlobalSessionEditor, openIntegrationConfig, openOrderEdit, openOrderView, openPermanentDelete, openTicketSessionChange,
    openSessionDashboardDetail, openSessionEditor, printOrderTicket, printPhysicalTicket, removeSession, requestLocalPointPaymentPrint,
    resendOrderTicket, resendWebhookRun, resolvePendingSalePrint, restoreOrderAdmin, retryCrmDeadLetters, retryEmailCampaignFailures,
    retryPendingSalePrint, revealCommercialCatalogToken, scanNextTicket, selectAd, selectBoxOfficeCustomerById, selectClubPlan,
    selectConcession, selectCustomerAccount, selectPromotion, selectRoom, selectTicket, selectUser,
    sendExistingEmailCampaign, setBoxOfficeTab, showChartHintFromPoint, showSessionTickets, showWebhookRun, testIntegration,
    toggleEmailCampaignMenu, toggleIntegration, toggleOrderMenu, updateClubSubscription, viewClubSubscription, viewEmailCampaignReport
  }) {
    const handleSessionTicketAction = window.CineAdminModules.sessionTicketActions.createSessionTicketActionHandler({
      openSessionDashboardDetail, showSessionTickets, openSessionEditor, removeSession,
      openGlobalSessionEditor, copyTicketCode, openOrderView, openTicketSessionChange
    });

    document.addEventListener("mouseover", (event) => showChartHintFromPoint(event.target));
    document.addEventListener("focusin", (event) => showChartHintFromPoint(event.target));
    document.addEventListener("error", (event) => {
      if (event.target.matches?.("img[data-admin-image-fallback]")) {
        event.target.parentElement.textContent = "Imagem indisponível";
      }
    }, true);
    document.addEventListener("click", (event) => {
      const staticPager = event.target.closest?.("[data-static-pager][data-page-delta]");
      if (staticPager && !staticPager.disabled) {
        const pagers = {
          "concession-daily-sales": changeConcessionDailySalesPage,
          "movie-sessions": changeMovieSessionsPage,
          "issued-tickets": changeIssuedTicketsPage,
          payments: changePaymentsPage,
          "concession-breakdown": changeConcessionBreakdownPage,
          "customer-accounts": changeCustomerAccountsPage,
          "club-subscriptions": changeClubSubscriptionsPage,
          "club-usage": changeClubUsagePage,
          "webhook-history": changeWebhookHistoryPage
        };
        const pager = Object.hasOwn(pagers, staticPager.dataset.staticPager) ? pagers[staticPager.dataset.staticPager] : null;
        const delta = Number(staticPager.dataset.pageDelta);
        if (pager && (delta === -1 || delta === 1)) pager(delta);
        return;
      }
      const adminPanel = event.target.closest?.("[data-admin-panel]");
      if (adminPanel && ["ordersPanel", "concessionsPanel", "clubPanel"].includes(adminPanel.dataset.adminPanel)) {
        activatePanel(adminPanel.dataset.adminPanel, { scroll: true });
        return;
      }
      const adminCommand = event.target.closest?.("[data-admin-command]");
      if (adminCommand && !adminCommand.disabled) {
        const commands = {
          "show-box-office-payments": () => setBoxOfficeTab("payments"),
          "create-session-from-dashboard": createSessionFromDashboard,
          "open-session-editor": () => openSessionEditor(),
          "clear-session-autocorrect": clearSessionAutocorrectPreview,
          "apply-session-autocorrect": applySessionAutocorrect,
          "change-box-office-customer": changeBoxOfficeCustomer,
          "scan-next-ticket": scanNextTicket,
          "reveal-commercial-token": revealCommercialCatalogToken,
          "copy-commercial-token": copyCommercialCatalogToken,
          "copy-commercial-link": copyCommercialCatalogLink,
          "retry-crm-dead-letters": retryCrmDeadLetters,
          "generate-commercial-token": generateCommercialCatalogToken
        };
        const command = Object.hasOwn(commands, adminCommand.dataset.adminCommand) ? commands[adminCommand.dataset.adminCommand] : null;
        if (command) void command();
        return;
      }
      const adminClose = event.target.closest?.("[data-admin-close]");
      if (adminClose && ["campaign-report", "subscription-detail"].includes(adminClose.dataset.adminClose)) {
        const container = adminClose.closest(`.${adminClose.dataset.adminClose}`);
        if (container) container.hidden = true;
        return;
      }
      if (event.target.closest?.("[data-chart-hint-date]")) {
        showChartHintFromPoint(event.target);
        return;
      }
      const dashPager = event.target.closest?.("[data-dash-pager][data-page-delta]");
      if (dashPager) {
        const pagers = {
          movies: changeDashMoviePage,
          sessions: changeDashSessionsPage,
          products: changeDashTopProductsPage,
          orders: changeDashLatestOrdersPage
        };
        const pager = Object.hasOwn(pagers, dashPager.dataset.dashPager) ? pagers[dashPager.dataset.dashPager] : null;
        if (pager) pager(Number(dashPager.dataset.pageDelta));
        return;
      }
      const orderPager = event.target.closest?.("[data-order-page-target][data-page-delta]");
      if (orderPager) {
        changeOrdersPage(Number(orderPager.dataset.pageDelta), orderPager.dataset.orderPageTarget);
        return;
      }
      const adminListPager = event.target.closest?.("[data-admin-list-page][data-page-delta]");
      if (adminListPager) {
        changeAdminListPage(adminListPager.dataset.adminListPage, Number(adminListPager.dataset.pageDelta));
        return;
      }
      const tmdbMovie = event.target.closest?.("[data-tmdb-movie-id]");
      if (tmdbMovie) {
        void importTmdbMovie(tmdbMovie.dataset.tmdbMovieId);
        return;
      }
      const adminSelection = event.target.closest?.("[data-admin-select-kind][data-admin-select-id]");
      if (adminSelection) {
        const selectors = {
          room: selectRoom,
          ticket: selectTicket,
          concession: selectConcession,
          promotion: selectPromotion,
          ad: selectAd,
          user: selectUser,
          customer: selectCustomerAccount
        };
        const selector = Object.hasOwn(selectors, adminSelection.dataset.adminSelectKind)
          ? selectors[adminSelection.dataset.adminSelectKind] : null;
        if (selector) selector(adminSelection.dataset.adminSelectId);
        return;
      }
      const promotionUsage = event.target.closest?.("[data-promotion-usage-id][data-promotion-usage-page]");
      if (promotionUsage) {
        void loadPromotionUsage(promotionUsage.dataset.promotionUsageId, Number(promotionUsage.dataset.promotionUsagePage));
        return;
      }
      const pointPrint = event.target.closest?.("[data-point-print-action][data-point-print-id]");
      if (pointPrint) {
        const id = pointPrint.dataset.pointPrintId;
        const action = pointPrint.dataset.pointPrintAction;
        if (action === "retry") void retryPendingSalePrint(id);
        else if (action === "reprint") void requestLocalPointPaymentPrint(id, { manual: true });
        else if (action === "resolve") void resolvePendingSalePrint(id, pointPrint.dataset.pointResolution === "refund" ? "refund" : "cancel");
        else if (action === "ticket") printPhysicalTicket(id);
        return;
      }
      const customerResult = event.target.closest?.("[data-box-office-customer-id]");
      if (customerResult) {
        selectBoxOfficeCustomerById(customerResult.dataset.boxOfficeCustomerId);
        return;
      }
      const clubPlan = event.target.closest?.("[data-club-plan-id]");
      if (clubPlan) {
        selectClubPlan(clubPlan.dataset.clubPlanId);
        return;
      }
      const clubSubscription = event.target.closest?.("[data-club-subscription-action][data-club-subscription-id]");
      if (clubSubscription) {
        const id = clubSubscription.dataset.clubSubscriptionId;
        const action = clubSubscription.dataset.clubSubscriptionAction;
        if (action === "view") void viewClubSubscription(id);
        else if (action === "credit") void adjustClubCredit(id);
        else if (action === "delete") void deleteClubSubscription(id);
        else if (["active", "paused", "cancelled"].includes(action)) void updateClubSubscription(id, action);
        return;
      }
      const integration = event.target.closest?.("[data-integration-action][data-integration-key]");
      if (integration) {
        const key = integration.dataset.integrationKey;
        const action = integration.dataset.integrationAction;
        if (action === "config") void openIntegrationConfig(key);
        else if (action === "test") void testIntegration(key);
        else if (action === "enable" || action === "disable") void toggleIntegration(key, action === "enable");
        return;
      }
      const webhook = event.target.closest?.("[data-webhook-action][data-webhook-id]");
      if (webhook) {
        if (webhook.dataset.webhookAction === "show") showWebhookRun(webhook.dataset.webhookId);
        else if (webhook.dataset.webhookAction === "resend") void resendWebhookRun(webhook.dataset.webhookId);
        return;
      }
      if (handleSessionTicketAction(event)) return;
      const floating = $("floatingActionMenu");
      const floatingAction = event.target.closest?.("[data-floating-order-action], [data-floating-campaign-action]");
      if (floatingAction && floating && !floating.hidden && floating.contains(floatingAction)) {
        const orderActions = {
          view: openOrderView,
          edit: openOrderEdit,
          print: printOrderTicket,
          resend: resendOrderTicket,
          cancel: cancelOrDeleteOrder,
          restore: restoreOrderAdmin,
          archive: archiveOrderAdmin,
          delete: openPermanentDelete
        };
        const campaignActions = {
          edit: editEmailCampaign,
          send: sendExistingEmailCampaign,
          report: viewEmailCampaignReport,
          retry: retryEmailCampaignFailures,
          cancel: cancelEmailCampaign,
          duplicate: duplicateEmailCampaign,
          delete: deleteEmailCampaign
        };
        const orderKey = floatingAction.dataset.floatingOrderAction;
        const campaignKey = floatingAction.dataset.floatingCampaignAction;
        const orderAction = Object.hasOwn(orderActions, orderKey) ? orderActions[orderKey] : null;
        const campaignAction = Object.hasOwn(campaignActions, campaignKey) ? campaignActions[campaignKey] : null;
        if (orderAction && floating.dataset.orderId) {
          orderAction(floating.dataset.orderId);
          closeFloatingActionMenu();
        } else if (campaignAction && floating.dataset.campaignId) {
          void campaignAction(floating.dataset.campaignId).finally(closeFloatingActionMenu);
        }
        return;
      }
      const campaignMenu = event.target.closest?.("[data-admin-campaign-action='menu'][data-admin-campaign-id]");
      if (campaignMenu) {
        toggleEmailCampaignMenu(campaignMenu.dataset.adminCampaignId, { currentTarget: campaignMenu, stopPropagation() {} });
        return;
      }
      const orderAction = event.target.closest?.("[data-admin-order-action][data-admin-order-id]");
      if (orderAction) {
        const orderId = orderAction.dataset.adminOrderId;
        if (orderAction.dataset.adminOrderAction === "concession") openConcessionOrderDetail(orderId);
        else if (orderAction.dataset.adminOrderAction === "view") openOrderView(orderId);
        else if (orderAction.dataset.adminOrderAction === "menu") {
          toggleOrderMenu(orderId, { currentTarget: orderAction, stopPropagation() {} });
          return;
        }
      }
      if (floating && !floating.hidden && !floating.contains(event.target)) closeFloatingActionMenu();
      if (!event.target.closest?.(".admin-profile")) closeAdminProfileMenu();
      if (!event.target.closest?.(".responsive-select")) closeResponsiveSelects();
      if (!event.target.closest?.(".context-menu")) {
        document.querySelectorAll(".context-menu-popover").forEach((menu) => {
          menu.hidden = true;
        });
      }
      document.querySelectorAll(".movie-row.drag-over").forEach((row) => row.classList.remove("drag-over"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFloatingActionMenu();
        closeAdminProfileMenu();
        closeAdminDrawer();
        closeIntegrationConfig();
        if (!$("twoFactorOverlay")?.hidden) closeTwoFactorSettings();
        if (!$("concessionOrderOverlay")?.hidden) closeConcessionOrderOverlay();
        closeResponsiveSelects();
        document.querySelectorAll(".context-menu-popover").forEach((menu) => {
          menu.hidden = true;
        });
      }
    });
  }
  const api = Object.freeze({ bindDelegatedEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindDelegatedEvents = api; }
})(globalThis);
