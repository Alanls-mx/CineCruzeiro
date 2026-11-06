((root) => {
  function createAdminLogView({ $, escapeHtml, loadLogs, logCategoryLabel, logDate, logLevelLabel, logPresentation, logReferenceItems, state }) {
    function renderLogs() {
      const data = state.logs || { logs: [], last24Hours: {}, page: 1, pages: 1, total: 0 };
      const stats = data.last24Hours || {};
      if ($("logsStats")) {
        $("logsStats").innerHTML = [
          ["Resultados encontrados", Number(data.total || 0), "all"],
          ["Precisa de ação · 24h", Number(stats.error || 0), "error"],
          ["Atenção · 24h", Number(stats.warn || 0), "warn"],
          ["Operações normais · 24h", Number(stats.info || 0), "info"]
        ].map(([label, value, tone]) => `<div class="log-stat ${tone}"><span>${label}</span><strong>${value}</strong></div>`).join("");
      }
      if ($("logsResultsSummary")) {
        const viewLabel = state.logsView === "technical" ? "Diagnóstico técnico" : "Visão do cinema";
        $("logsResultsSummary").innerHTML = `<strong>${escapeHtml(viewLabel)}</strong><span>${Number(data.total || 0)} ocorrência(s), da mais recente para a mais antiga.</span>`;
      }
      if ($("logsList")) {
        $("logsList").innerHTML = data.logs?.length
          ? data.logs.map((log) => {
            const presentation = logPresentation(log);
            const references = logReferenceItems(log);
            const technical = state.logsView === "technical";
            return `
            <details class="log-entry log-${escapeHtml(log.level || "info")}">
              <summary>
                <span class="log-level">${escapeHtml(logLevelLabel(log.level))}</span>
                <span class="log-main"><strong>${escapeHtml(presentation.title)}</strong><small>${escapeHtml(presentation.description)}</small></span>
                <span class="log-category">${escapeHtml(logCategoryLabel(log.category))}</span>
                <time datetime="${escapeHtml(log.createdAt || "")}">${escapeHtml(logDate(log.createdAt))}</time>
              </summary>
              <div class="log-details">
                <div class="log-readable-detail">
                  <p>${escapeHtml(presentation.description)}</p>
                  <dl>
                    <div><dt>Responsável</dt><dd>${escapeHtml(log.actorEmail || log.actorUserId || "Ação automática do sistema")}</dd></div>
                    <div><dt>Assunto</dt><dd>${escapeHtml(logCategoryLabel(log.category))}</dd></div>
                    ${references.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("")}
                  </dl>
                </div>
                ${technical ? `<details class="log-technical-detail"><summary>Ver dados para suporte técnico</summary><dl><div><dt>Evento</dt><dd>${escapeHtml(log.event || "-")}</dd></div><div><dt>Requisição</dt><dd>${escapeHtml(log.requestId || "-")}</dd></div><div><dt>Rota</dt><dd>${escapeHtml([log.method, log.path].filter(Boolean).join(" ") || "-")}</dd></div><div><dt>Resposta</dt><dd>${escapeHtml(log.statusCode ? String(log.statusCode) : "-")}</dd></div></dl><pre>${escapeHtml(JSON.stringify(log.metadata || {}, null, 2))}</pre></details>` : ""}
              </div>
            </details>
          `; }).join("")
          : `<div class="empty-state"><strong>Nenhuma ocorrência encontrada</strong><span>Está tudo tranquilo neste período ou os filtros não encontraram resultados.</span></div>`;
      }
      if ($("logsPagination")) {
        $("logsPagination").innerHTML = `
          <button class="ghost-button" type="button" data-log-page="${Math.max(1, Number(data.page || 1) - 1)}" ${Number(data.page || 1) <= 1 ? "disabled" : ""}>Anterior</button>
          <span>Página ${Number(data.page || 1)} de ${Number(data.pages || 1)}</span>
          <button class="ghost-button" type="button" data-log-page="${Math.min(Number(data.pages || 1), Number(data.page || 1) + 1)}" ${Number(data.page || 1) >= Number(data.pages || 1) ? "disabled" : ""}>Próxima</button>
        `;
        $("logsPagination").querySelectorAll("[data-log-page]").forEach((button) => button.addEventListener("click", () => loadLogs({ page: Number(button.dataset.logPage) })));
      }
    }
    return { renderLogs };
  }
  const api = Object.freeze({ createAdminLogView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.adminLogView = api; }
})(globalThis);
