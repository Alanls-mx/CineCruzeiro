((root) => {
  function bindLogEvents({ $, document, state, loadLogs, exportLogs, pruneLogs }) {
    $("logsRefreshButton")?.addEventListener("click", () => loadLogs());
    $("logsExportButton")?.addEventListener("click", exportLogs);
    $("logsPruneButton")?.addEventListener("click", pruneLogs);
    document.querySelectorAll("[data-logs-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.logsView = button.dataset.logsView || "business";
        document.querySelectorAll("[data-logs-view]").forEach((item) => item.classList.toggle("active", item === button));
        loadLogs({ page: 1 });
      });
    });
    [["logsLevel", "level"], ["logsCategory", "category"], ["logsFrom", "from"], ["logsTo", "to"]].forEach(([id, key]) => {
      $(id)?.addEventListener("change", () => {
        state.logFilters[key] = $(id).value.trim();
        loadLogs({ page: 1 });
      });
    });
    $("logsSearch")?.addEventListener("input", () => {
      clearTimeout(state.logsSearchTimer);
      state.logFilters.search = $("logsSearch").value.trim();
      state.logsSearchTimer = setTimeout(() => loadLogs({ page: 1 }), 350);
    });
  }

  const api = Object.freeze({ bindLogEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CineAdminModules ||= {};
    root.CineAdminModules.logEvents = api;
  }
})(globalThis);
