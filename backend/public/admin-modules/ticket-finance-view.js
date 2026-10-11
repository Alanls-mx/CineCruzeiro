((root) => {
  function createTicketFinanceView({ state, $, api, adminCan, setDisabled, showToast, escapeHtml, money, document, apiBase }) {
    function query() {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const from = $("ticketFinanceFrom")?.value || state.dashboardFrom || today;
      const to = $("ticketFinanceTo")?.value || state.dashboardTo || today;
      if (from > to) throw new Error("A data final deve ser igual ou posterior à inicial.");
      const params = new URLSearchParams({ period: "custom", from, to });
      const movieId = $("ticketFinanceMovie")?.value || "";
      if (movieId) params.set("movieId", movieId);
      return params.toString();
    }

    async function load() {
      if (!adminCan("ticket_finance.view")) return;
      const requestId = (state.ticketFinanceRequestId || 0) + 1;
      state.ticketFinanceRequestId = requestId;
      const button = $("ticketFinanceRefresh");
      if (button) button.disabled = true;
      $("ticketFinanceRows").setAttribute("aria-busy", "true");
      $("ticketFinanceRows").innerHTML = `<tr><td colspan="5">Atualizando apuração...</td></tr>`;
      ["ticketFinanceQuantity", "ticketFinanceGross", "ticketFinanceDistributor", "ticketFinanceNet", "ticketFinanceMargin"].forEach((id) => { $(id).textContent = "—"; });
      ["ticketFinanceExportCsv", "ticketFinanceExportPdf"].forEach((id) => setDisabled(id, true));
      try {
        const report = await api(`/api/admin/reports/ticket-distributor?${query()}`);
        if (state.ticketFinanceRequestId !== requestId) return;
        state.ticketFinanceReport = report;
        render();
        ["ticketFinanceExportCsv", "ticketFinanceExportPdf"].forEach((id) => setDisabled(id, false));
      } catch (error) {
        if (state.ticketFinanceRequestId !== requestId) return;
        state.ticketFinanceReport = null;
        render();
        showToast(error.message, "error");
      } finally {
        if (state.ticketFinanceRequestId === requestId) {
          if (button) button.disabled = false;
          $("ticketFinanceRows").removeAttribute("aria-busy");
        }
      }
    }

    function render() {
      if (!$("ticketFinanceRows") || !adminCan("ticket_finance.view")) return;
      const report = state.ticketFinanceReport;
      if (!report) {
        $("ticketFinanceRows").innerHTML = `<tr><td colspan="5">Não foi possível carregar a apuração neste momento.</td></tr>`;
        return;
      }
      if ($("ticketFinanceFrom") && !$("ticketFinanceFrom").value) $("ticketFinanceFrom").value = report.period?.start || "";
      if ($("ticketFinanceTo") && !$("ticketFinanceTo").value) $("ticketFinanceTo").value = report.period?.end || "";
      if ($("ticketFinanceMovie")) {
        const selected = $("ticketFinanceMovie").value || report.movieId || "";
        $("ticketFinanceMovie").innerHTML = `<option value="">Todos os filmes</option>${(report.movies || []).map((movie) => `<option value="${escapeHtml(movie.id)}">${escapeHtml(movie.title)}</option>`).join("")}`;
        $("ticketFinanceMovie").value = selected;
      }
      if ($("ticketFinanceDistributorPercent")) $("ticketFinanceDistributorPercent").value = Number(report.rules?.distributorPercent ?? 50);
      if ($("ticketFinanceCourtesyPercent")) $("ticketFinanceCourtesyPercent").value = Number(report.rules?.courtesyPercent ?? 50);
      if ($("ticketFinanceClubFee")) $("ticketFinanceClubFee").value = Number(report.rules?.clubTicketFee ?? 10).toFixed(2);
      const totals = report.totals || {};
      $("ticketFinanceQuantity").textContent = Number(totals.quantity || 0);
      $("ticketFinanceGross").textContent = money(totals.grossRevenue || 0);
      $("ticketFinanceDistributor").textContent = money(totals.distributorCost || 0);
      $("ticketFinanceNet").textContent = money(totals.cinemaNet || 0);
      $("ticketFinanceNet").classList.toggle("negative", Number(totals.cinemaNet || 0) < 0);
      $("ticketFinanceMargin").textContent = `${Number(totals.retentionPercent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do faturamento`;
      $("ticketFinanceRows").innerHTML = (report.rows || []).length
        ? report.rows.map((row) => `<tr>
            <td><strong>${escapeHtml(row.type)}</strong><small>${row.category === "club" ? "Receita reconhecida no Clube" : row.category === "courtesy" ? "Custo de indicação / marketing" : "Ingresso pago"}</small></td>
            <td>${Number(row.quantity || 0)}</td>
            <td>${money(row.grossRevenue || 0)}</td>
            <td>${money(row.distributorCost || 0)}</td>
            <td class="${Number(row.cinemaNet || 0) < 0 ? "negative" : "positive"}">${money(row.cinemaNet || 0)}</td>
          </tr>`).join("")
        : `<tr><td colspan="5">Nenhum ingresso reconhecido no período selecionado.</td></tr>`;
    }

    async function saveRules(event) {
      event.preventDefault();
      if (!adminCan("ticket_finance.configure")) return;
      try {
        await api("/api/admin/reports/ticket-distributor/settings", {
          method: "PUT",
          body: JSON.stringify({
            distributorPercent: Number($("ticketFinanceDistributorPercent").value),
            courtesyPercent: Number($("ticketFinanceCourtesyPercent").value),
            clubTicketFee: Number($("ticketFinanceClubFee").value)
          })
        });
        await load();
        showToast("Regras de repasse atualizadas.");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function download(format) {
      if (!adminCan("ticket_finance.export")) return;
      let params;
      try { params = query(); } catch (error) { showToast(error.message, "error"); return; }
      const extension = format === "csv" ? "csv" : "pdf";
      const link = document.createElement("a");
      link.href = `${apiBase}/api/admin/reports/ticket-distributor.${extension}?${params}`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast(extension === "pdf" ? "Preparando demonstrativo para a distribuidora." : "Preparando memória de cálculo detalhada.");
    }

    function bindEvents() {
      $("ticketFinanceRefresh")?.addEventListener("click", load);
      $("ticketFinanceExportPdf")?.addEventListener("click", () => download("pdf"));
      $("ticketFinanceExportCsv")?.addEventListener("click", () => download("csv"));
      $("ticketFinanceRulesForm")?.addEventListener("submit", saveRules);
      ["ticketFinanceMovie", "ticketFinanceFrom", "ticketFinanceTo"].forEach((id) => $(id)?.addEventListener("change", load));
    }

    return { query, load, render, saveRules, download, bindEvents };
  }

  const api = Object.freeze({ createTicketFinanceView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.ticketFinanceView = api; }
})(globalThis);
