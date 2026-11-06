((root) => {
  function bindSalesAndTicketEvents({
    $, addManualSaleItem, cancelConcessionCounterPayment, cancelCreation, cancelPointPayment, clearImageField,
    clearManualSaleItems, closeConcessionOrderOverlay, createConcessionCounterSale, createManualTicket, deleteConcession, deleteTicket,
    loadConcessionDailySales, loadManualSeatMap, manualSessionDateDisplay, manualSessionDateIso, maskManualSessionDate, newConcession,
    newTicket, pollConcessionCounterPayment, pollPointPayment, printConcessionCounterReceipt, refreshPaymentsOnly, renderConcessionCounterSale,
    renderConcessionCounterSummary, renderConcessionDailySales, renderConcessionPreview, renderConcessions, renderIssuedTickets, renderManualSaleOptions,
    renderManualSaleSummary, renderManualSessionOptions, renderManualTicketTypes, renderOrders, renderSaleMode, renderValidationSessionScope,
    resetConcessionCounterSale, resetPointPaymentPanel, saveConcession, saveTicket, scheduleBoxOfficeCustomerSearch, setBoxOfficeTab,
    setConcessionTab, setSaleMode, startQrReader, state, stopQrReader, syncConcessionStockFields,
    toggleManualCodeBox, toggleQrTorch, updateValidationSessionLock, uploadAdminImage, validateTicketByCode
  }) {
    $("newTicketButton").addEventListener("click", newTicket);
    $("cancelTicketCreateButton").addEventListener("click", () => cancelCreation("ticket"));
    $("ticketForm").addEventListener("submit", saveTicket);
    $("deleteTicketButton").addEventListener("click", deleteTicket);
    ["issuedTicketMovieFilter", "issuedTicketSessionFilter", "issuedTicketDateFilter", "issuedTicketStatusFilter", "issuedTicketRoomFilter"].forEach((id) => {
      $(id)?.addEventListener("change", (event) => {
        const key = {
          issuedTicketMovieFilter: "movieId",
          issuedTicketSessionFilter: "sessionId",
          issuedTicketDateFilter: "date",
          issuedTicketStatusFilter: "status",
          issuedTicketRoomFilter: "room"
        }[id];
        state.issuedTicketsPage = 1;
        state.issuedTicketFilters[key] = event.target.value;
        if (id === "issuedTicketMovieFilter") state.issuedTicketFilters.sessionId = "";
        renderIssuedTickets();
      });
    });
    $("manualTicketForm").addEventListener("submit", createManualTicket);
    $("manualTicketForm").addEventListener("input", renderManualSaleSummary);
    $("manualTicketForm").addEventListener("change", renderManualSaleSummary);
    $("pointPaymentRetryButton")?.addEventListener("click", () => pollPointPayment({ manual: true }));
    $("pointPaymentCancelButton")?.addEventListener("click", cancelPointPayment);
    $("pointPaymentNewSaleButton")?.addEventListener("click", resetPointPaymentPanel);
    $("manualSessionDate").addEventListener("input", (event) => {
      const rawValue = event.target.value;
      event.target.value = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
        ? manualSessionDateDisplay(rawValue)
        : maskManualSessionDate(rawValue);
      if (manualSessionDateIso(event.target.value)) renderManualSaleOptions();
    });
    $("manualSessionDate").addEventListener("blur", renderManualSaleOptions);
    $("manualMovieSelect").addEventListener("change", renderManualSessionOptions);
    $("manualSessionSelect").addEventListener("change", () => {
      renderManualTicketTypes();
      void loadManualSeatMap();
    });
    $("manualAddMovieButton").addEventListener("click", addManualSaleItem);
    $("manualClearSaleButton").addEventListener("click", clearManualSaleItems);
    $("manualCustomerSearch").addEventListener("input", () => scheduleBoxOfficeCustomerSearch());
    $("manualCustomerSearch").addEventListener("focus", () => scheduleBoxOfficeCustomerSearch({ immediate: true }));
    document.querySelectorAll("[data-sale-mode]").forEach((button) => {
      button.addEventListener("click", () => setSaleMode(button.dataset.saleMode));
    });
    document.querySelectorAll("input[name='guestTicketDeliveryMethod']").forEach((input) => {
      input.addEventListener("change", renderSaleMode);
    });
    document.querySelectorAll("[data-box-office-tab]").forEach((button) => {
      button.addEventListener("click", () => setBoxOfficeTab(button.dataset.boxOfficeTab));
    });
    document.querySelectorAll("[data-order-filter]").forEach((group) => {
      group.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
          group.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
          state.ordersPage = 1;
          state.todayOrdersPage = 1;
          state.orderFilters[group.dataset.orderFilter] = button.dataset.value;
          renderOrders();
        });
      });
    });
    $("ordersSearch").addEventListener("input", () => {
      state.ordersPage = 1;
      state.orderFilters.allQuery = $("ordersSearch").value.trim();
      renderOrders();
    });
    $("ordersStatusFilter")?.addEventListener("change", (event) => {
      state.ordersPage = 1;
      state.orderFilters.allStatus = event.target.value || "all";
      renderOrders();
    });
    [
      ["paymentFilterStatus", "status"],
      ["paymentFilterMethod", "method"],
      ["paymentFilterOrigin", "origin"],
      ["paymentFilterProvider", "provider"]
    ].forEach(([id, key]) => {
      $(id).addEventListener("change", async () => {
        state.paymentFilters[key] = $(id).value;
        await refreshPaymentsOnly();
      });
    });
    $("startQrButton").addEventListener("click", startQrReader);
    $("stopQrButton").addEventListener("click", stopQrReader);
    $("torchQrButton").addEventListener("click", toggleQrTorch);
    $("manualCodeToggle").addEventListener("click", toggleManualCodeBox);
    $("ticketValidationSessionLock").addEventListener("change", updateValidationSessionLock);
    $("ticketValidationSessionSelect").addEventListener("change", (event) => {
      state.validationSessionId = event.target.value;
      renderValidationSessionScope();
    });
    $("validateTicketButton").addEventListener("click", () => validateTicketByCode());
    $("ticketValidationCode").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        validateTicketByCode();
      }
    });

    $("newConcessionButton").addEventListener("click", newConcession);
    $("cancelConcessionCreateButton").addEventListener("click", () => cancelCreation("concession"));
    $("concessionForm").addEventListener("submit", saveConcession);
    $("deleteConcessionButton").addEventListener("click", deleteConcession);
    $("concessionImageUpload").addEventListener("change", () => uploadAdminImage("concessionImageUpload", "concessionImageUrl", "", "concessions", renderConcessionPreview));
    $("concessionImageUrl").addEventListener("input", renderConcessionPreview);
    $("concessionImageClear").addEventListener("click", () => clearImageField("concessionImageUrl", "concessionImagePreview", "Imagem do produto"));
    ["concessionStock", "concessionStockUnit", "concessionUsagePerSale"].forEach((id) => {
      $(id)?.addEventListener(id === "concessionStockUnit" ? "change" : "input", syncConcessionStockFields);
    });

    document.querySelectorAll("[data-concession-tab]").forEach((button) => {
      button.addEventListener("click", () => setConcessionTab(button.dataset.concessionTab));
    });
    $("concessionCounterForm")?.addEventListener("submit", createConcessionCounterSale);
    document.querySelectorAll("input[name='concessionCounterPaymentMethod']").forEach((input) => {
      input.addEventListener("change", renderConcessionCounterSummary);
    });
    $("concessionCounterSearch")?.addEventListener("input", (event) => {
      state.concessionCounterSearch = event.target.value;
      state.concessionCounterPage = 1;
      renderConcessionCounterSale();
    });
    $("concessionCounterCategory")?.addEventListener("change", (event) => {
      state.concessionCounterCategory = event.target.value || "all";
      state.concessionCounterPage = 1;
      renderConcessionCounterSale();
    });
    $("concessionCounterClearButton")?.addEventListener("click", () => {
      state.concessionCounterQuantities = {};
      renderConcessionCounterSale();
    });
    $("concessionCounterPaymentRetryButton")?.addEventListener("click", () => void pollConcessionCounterPayment({ manual: true }));
    $("concessionCounterPaymentCancelButton")?.addEventListener("click", cancelConcessionCounterPayment);
    $("concessionCounterPrintButton")?.addEventListener("click", () => printConcessionCounterReceipt());
    $("concessionCounterNewSaleButton")?.addEventListener("click", resetConcessionCounterSale);
    document.querySelectorAll("[data-concession-cat]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-concession-cat]").forEach((b) => b.classList.toggle("active", b === button));
        state.concessionCategoryFilter = button.dataset.concessionCat;
        state.concessionsPage = 1;
        state.selectedConcessionId = "";
        renderConcessions();
      });
    });
    document.querySelectorAll('[data-concession-filter="status"] button').forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll('[data-concession-filter="status"] button').forEach((b) => b.classList.toggle("active", b === button));
        state.concessionStatusFilter = button.dataset.value;
        renderConcessionDailySales();
      });
    });
    $("concessionSalesRefresh")?.addEventListener("click", () => void loadConcessionDailySales());
    $("concessionSalesDate")?.addEventListener("change", () => void loadConcessionDailySales());
    $("concessionSalesArchived")?.addEventListener("change", () => renderConcessionDailySales());

    $("concessionOrderCloseButton")?.addEventListener("click", closeConcessionOrderOverlay);
    $("concessionOrderModalCloseAction")?.addEventListener("click", closeConcessionOrderOverlay);
    $("concessionOrderOverlay")?.addEventListener("click", (event) => {
      if (event.target === $("concessionOrderOverlay")) closeConcessionOrderOverlay();
    });
    document.querySelectorAll("[data-scanner-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.scannerBack === "concessions") {
          setConcessionTab("todaySales");
        } else {
          setBoxOfficeTab("todaySales");
        }
      });
    });
  }
  const api = Object.freeze({ bindSalesAndTicketEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindSalesAndTicketEvents = api; }
})(globalThis);
