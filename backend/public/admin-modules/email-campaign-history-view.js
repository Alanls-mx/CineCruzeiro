((root) => {
  function createEmailCampaignHistoryView({ state, $, api, escapeHtml, randomClientId, clearCampaignCanonicalHtml, renderEmailCampaignControls, syncCampaignImageMovieSelect, campaignEmailLogoUrl, setEmailCampaignStep, applyEmailCampaignTemplate, syncCampaignTemplateResolution, refreshEmailCampaignRecipients, showToast, window, document, EMAIL_CAMPAIGN_TEMPLATES }) {
    async function loadEmailCampaignHistory(options = {}) {
      const params = new URLSearchParams({
        page: String(state.emailCampaignHistoryPage || 1),
        pageSize: String(state.emailCampaignHistoryPageSize || 25)
      });
      if (state.emailCampaignHistoryFilter && state.emailCampaignHistoryFilter !== "all") params.set("status", state.emailCampaignHistoryFilter);
      if (state.emailCampaignHistorySearch) params.set("search", state.emailCampaignHistorySearch);
      if (!options.silent && $("emailCampaignHistory")) $("emailCampaignHistory").innerHTML = `<div class="skeleton-card compact"></div>`;
      const result = await api(`/api/admin/email/campaigns?${params.toString()}`);
      state.content ||= {};
      state.content.emailCampaigns = result.campaigns || [];
      state.emailCampaignHistoryMeta = result;
      renderEmailCampaigns();
    }

    function campaignHistoryCount(filter, totals = {}) {
      if (filter === "drafts") return Number(totals.draft || 0);
      if (filter === "scheduled") return Number(totals.scheduled || 0);
      if (filter === "processing") return Number(totals.queued || 0) + Number(totals.sending || 0);
      if (filter === "completed") return Number(totals.completed || 0) + Number(totals.sent || 0);
      if (filter === "errors") return Number(totals.completed_with_errors || 0) + Number(totals.failed || 0);
      if (filter === "cancelled") return Number(totals.cancelled || 0);
      return Object.values(totals).reduce((sum, value) => sum + Number(value || 0), 0);
    }

    function renderEmailCampaigns() {
      const history = $("emailCampaignHistory");
      if (!history) return;
      const controls = $("emailCampaignHistoryControls");
      const pager = $("emailCampaignHistoryPager");
      const filter = state.emailCampaignHistoryFilter || "all";
      const campaigns = state.content?.emailCampaigns || [];
      const meta = state.emailCampaignHistoryMeta || { page: 1, pages: 1, pageSize: state.emailCampaignHistoryPageSize, total: campaigns.length, totals: {} };
      const page = Number(meta.page || 1);
      const pageSize = Number(meta.pageSize || state.emailCampaignHistoryPageSize || 25);
      const totalPages = Number(meta.pages || 1);
      if (controls) {
        controls.innerHTML = EMAIL_CAMPAIGN_HISTORY_FILTERS.map(([value, label]) => {
          const count = campaignHistoryCount(value, meta.totals || {});
          const active = value === filter;
          return `<button type="button" class="${active ? "active" : ""}" data-campaign-history-filter="${value}" aria-pressed="${active}"><span>${escapeHtml(label)}</span><strong>${count}</strong></button>`;
        }).join("");
      }
      history.innerHTML = campaigns.length ? campaigns.map((item) => {
        const processing = ["queued", "sending"].includes(item.status);
        const delivery = processing
          ? `${item.processed || 0} / ${item.customerCount || 0} processados · ${item.sent || 0} enviados · ${item.failed || 0} falhas`
          : ["completed", "completed_with_errors", "failed", "sent"].includes(item.status)
            ? `${item.sent || 0} enviados · ${item.failed || 0} falhas`
            : `${item.customerCount || 0} destinatários`;
        const unsupported = item.metricsSupported?.opened || item.metricsSupported?.clicked ? "" : " · abertura e clique indisponíveis";
        const linked = emailCampaignHistoryLinkedLabel(item);
        const template = emailCampaignTemplateLabel(item.templateId || "announcement");
        const context = [template, linked].filter(Boolean).join(" · ");
        const subject = item.subject || "Sem assunto";
        return `<div class="campaign-history-row"><div class="campaign-history-main"><strong>${escapeHtml(subject)}</strong><small>${escapeHtml(context ? `${context} · ${delivery}${unsupported}` : `${delivery}${unsupported}`)} · ${item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}</small></div><div class="campaign-history-actions"><span class="campaign-status ${escapeHtml(item.status || "draft")}">${escapeHtml({ draft: "Rascunho", scheduled: "Agendada", queued: "Na fila", sending: "Enviando", sent: "Concluída", completed: "Concluída", completed_with_errors: "Concluída com falhas", failed: "Falhou", cancelled: "Cancelada" }[item.status] || "Rascunho")}</span><button class="icon-button campaign-history-menu-button" type="button" data-floating-menu-trigger data-admin-campaign-action="menu" data-admin-campaign-id="${escapeHtml(item.id)}" aria-label="Ações de ${escapeHtml(subject)}" aria-haspopup="menu" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle></svg></button></div></div>`;
      }).join("") : `<div class="empty-state"><strong>Nenhuma campanha ainda</strong><span>Salve um rascunho ou envie sua primeira comunicação.</span></div>`;
      if (pager) {
        const start = Number(meta.total || 0) ? (page - 1) * pageSize + 1 : 0;
        const end = Math.min(page * pageSize, Number(meta.total || 0));
        pager.innerHTML = `<span>${start}-${end} de ${Number(meta.total || 0)}</span><div><button type="button" class="ghost-button" data-campaign-history-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Anterior</button><button type="button" class="ghost-button" data-campaign-history-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Próxima</button></div>`;
      }
      clearTimeout(state.emailCampaignHistoryTimer);
      state.emailCampaignHistoryTimer = campaigns.some((item) => ["queued", "sending"].includes(item.status))
        ? setTimeout(() => void loadEmailCampaignHistory({ silent: true }).catch(() => null), 5000)
        : null;
    }

    function emailCampaignHistoryLinkedLabel(item = {}) {
      const movie = item.movieId ? (state.content?.movies || []).find((entry) => String(entry.id) === String(item.movieId)) : null;
      const plan = item.clubPlanId ? (state.content?.subscriptionPlans || []).find((entry) => String(entry.id) === String(item.clubPlanId)) : null;
      const concessionIds = Array.isArray(item.concessionIds) ? item.concessionIds : (item.concessionId ? [item.concessionId] : []);
      const concessions = concessionIds.map((id) => (state.content?.concessions || []).find((entry) => String(entry.id) === String(id))).filter(Boolean);
      const coupon = item.couponId ? (state.content?.promotions || []).find((entry) => String(entry.id) === String(item.couponId)) : null;
      if (movie) return movie.title || "Filme vinculado";
      if (plan) return plan.name || "Plano vinculado";
      if (concessions.length) return concessions.map((entry) => entry.name || "Produto").join(", ");
      if (coupon) return coupon.couponCode || coupon.title || "Cupom vinculado";
      return "";
    }

    function setCampaignField(id, value) {
      const field = $(id);
      if (field) field.value = value || "";
    }

    function setCampaignOpenLoading(id, loading) {
      const button = [...document.querySelectorAll("[data-campaign-edit]")].find((item) => item.dataset.campaignEdit === id);
      if (!button) return;
      button.disabled = loading;
      button.setAttribute("aria-busy", loading ? "true" : "false");
      button.textContent = loading ? "Abrindo..." : "Abrir";
    }

    function setCampaignDeleteLoading(id, loading) {
      const button = [...document.querySelectorAll("[data-campaign-delete]")].find((item) => item.dataset.campaignDelete === id);
      if (!button) return;
      button.disabled = loading;
      button.setAttribute("aria-busy", loading ? "true" : "false");
      button.textContent = loading ? "Excluindo..." : "Excluir";
    }

    async function editEmailCampaign(id) {
      try {
        setCampaignOpenLoading(id, true);
        showToast("Abrindo rascunho...");
        const result = await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}`);
        const campaign = result.campaign || {};
        state.emailCampaignDraftId = campaign.id || id;
        state.emailCampaignIdempotencyKey = campaign.idempotencyKey || randomClientId("campanha");
        state.emailCampaignSelectedIds = new Set((campaign.customerIds || []).map(String));
        state.emailCampaignAttachments = campaign.attachments || [];
        state.emailCampaignVariables = campaign.variables || {};
        state.emailCampaignTemplateVariant = null;
        state.emailCampaignConcessionIds = (campaign.concessionIds || (campaign.concessionId ? [campaign.concessionId] : [])).map(String);
        state.emailCampaignObjective = campaign.objective || (campaign.templateId === "weekly" ? "programming" : ["premiere", "last_chance"].includes(campaign.templateId) ? "movie" : ["promotion", "coupon"].includes(campaign.templateId) ? "offer" : ["concession", "combo"].includes(campaign.templateId) ? "concession" : ["club", "club_plan"].includes(campaign.templateId) ? "club" : campaign.templateId === "event" ? "event" : "announcement");
        state.emailCampaignTemplateSelectionMode = campaign.templateSelectionMode || "manual";
        state.emailCampaignUseCanonicalHtml = Boolean(campaign.html && (campaign.aiGenerated || campaign.variables?.email_model_variant));
        if ($("emailCampaignObjective")) $("emailCampaignObjective").value = state.emailCampaignObjective;
        setCampaignField("emailCampaignSubject", campaign.subject);
        setCampaignField("emailCampaignTemplate", campaign.templateId || "announcement");
        setCampaignField("emailCampaignPreheader", campaign.preheader);
        setCampaignField("emailCampaignHeadline", campaign.headline);
        setCampaignField("emailCampaignMessage", campaign.message);
        setCampaignField("emailCampaignHtml", campaign.html);
        setCampaignField("emailCampaignCtaLabel", campaign.ctaLabel);
        setCampaignField("emailCampaignCtaUrl", campaign.ctaUrl);
        setCampaignField("emailCampaignAudience", campaign.recipientMode || "all");
        setCampaignField("emailCampaignReactivationDays", String(campaign.reactivationDays || 90));
        setCampaignField("emailCampaignRecipientSearch", campaign.recipientSearch);
        setCampaignField("emailCampaignScheduleAt", campaign.scheduleAt ? new Date(campaign.scheduleAt).toISOString().slice(0, 16) : "");
        setCampaignField("emailCampaignCoupon", campaign.couponId);
        setCampaignField("emailCampaignMovie", campaign.movieId);
        setCampaignField("emailCampaignConcession", campaign.concessionId);
        setCampaignField("emailCampaignClubPlan", campaign.clubPlanId);
        setCampaignField("emailCampaignClubOffer", campaign.clubOffer);
        setCampaignField("emailCampaignImageUrl", campaign.imageUrl);
        setCampaignField("emailCampaignImageAlt", campaign.imageAlt);
        setCampaignField("emailCampaignImageLink", campaign.imageLink);
        syncCampaignImageMovieSelect();
        setCampaignField("emailBrandName", campaign.brand?.name);
        setCampaignField("emailBrandLogoUrl", campaignEmailLogoUrl(campaign.brand?.logoUrl));
        setCampaignField("emailBrandFooter", campaign.brand?.footer);
        setEmailCampaignStep("content");
        applyEmailCampaignTemplate(campaign.templateId || "announcement", { fillDefaults: false });
        renderEmailCampaignControls();
        if (state.emailCampaignUseCanonicalHtml) setCampaignField("emailCampaignHtml", campaign.html);
        if ($("emailCampaignMovies")) {
          const selectedMovies = new Set((campaign.movieIds || (campaign.movieId ? [campaign.movieId] : [])).map(String));
          Array.from($("emailCampaignMovies").options).forEach((option) => { option.selected = selectedMovies.has(String(option.value)); });
        }
        syncCampaignTemplateResolution({
          templateId: campaign.templateId || "announcement",
          objective: state.emailCampaignObjective,
          templateSelectionMode: state.emailCampaignTemplateSelectionMode,
          compatibleTemplates: campaign.compatibleTemplates || [],
          reason: campaign.templateReason || "Layout carregado do rascunho existente.",
          incomplete: false
        });
        void refreshEmailCampaignRecipients().catch(() => null);
        $("emailCampaignStatus").textContent = "Editando rascunho";
        $("emailCampaignForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("Rascunho aberto");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setCampaignOpenLoading(id, false);
      }
    }

    async function deleteEmailCampaign(id) {
      if (!window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.")) return;
      try {
        setCampaignDeleteLoading(id, true);
        await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (state.content?.emailCampaigns) state.content.emailCampaigns = state.content.emailCampaigns.filter((item) => item.id !== id);
        renderEmailCampaigns();
        if (state.emailCampaignDraftId === id) {
          state.emailCampaignDraftId = "";
          state.emailCampaignIdempotencyKey = randomClientId("campanha");
          state.emailCampaignVariables = {};
          state.emailCampaignAttachments = [];
          state.emailCampaignTemplateVariant = null;
          clearCampaignCanonicalHtml();
        }
        await loadEmailCampaignHistory({ silent: true });
        showToast("Rascunho excluído");
      } catch (error) {
        setCampaignDeleteLoading(id, false);
        showToast(error.message, "error");
      }
    }

    async function duplicateEmailCampaign(id) {
      try {
        await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
        await loadEmailCampaignHistory({ silent: true });
        showToast("Campanha duplicada como rascunho");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function sendExistingEmailCampaign(id) {
      if (!window.confirm("Colocar esta campanha na fila de envio agora?")) return;
      try {
        await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/send`, { method: "POST" });
        await loadEmailCampaignHistory({ silent: true });
        showToast("Campanha colocada na fila");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function cancelEmailCampaign(id) {
      if (!window.confirm("Cancelar esta campanha? Destinatários ainda pendentes não receberão a mensagem.")) return;
      try {
        await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/cancel`, { method: "POST" });
        await loadEmailCampaignHistory({ silent: true });
        showToast("Campanha cancelada");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function retryEmailCampaignFailures(id) {
      if (!window.confirm("Reenviar somente falhas confirmadas e elegíveis? Resultados incertos não serão reenviados.")) return;
      try {
        const result = await api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/retry-failures`, { method: "POST" });
        await loadEmailCampaignHistory({ silent: true });
        showToast(`${result.retried || 0} destinatário(s) recolocado(s) na fila`);
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function viewEmailCampaignReport(id) {
      const target = $("emailCampaignReport");
      if (!target) return;
      state.emailCampaignReportId = id;
      target.hidden = false;
      target.innerHTML = `<div class="skeleton-card compact"></div>`;
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      try {
        const [{ campaign }, failed, retryable, unknown] = await Promise.all([
          api(`/api/admin/email/campaigns/${encodeURIComponent(id)}`),
          api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/recipients?status=failed&pageSize=100`),
          api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/recipients?status=retryable_failed&pageSize=100`),
          api(`/api/admin/email/campaigns/${encodeURIComponent(id)}/recipients?status=unknown&pageSize=100`)
        ]);
        if (state.emailCampaignReportId !== id) return;
        const failures = [...(failed.recipients || []), ...(retryable.recipients || []), ...(unknown.recipients || [])];
        target.innerHTML = `
          <div class="campaign-report-head"><div><strong>${escapeHtml(campaign.subject || "Relatório da campanha")}</strong><small>${escapeHtml(campaign.error || "Resultados consolidados a partir dos destinatários persistidos.")}</small></div><button type="button" class="icon-button" aria-label="Fechar relatório" data-admin-close="campaign-report">×</button></div>
          <div class="campaign-report-grid">
            <div class="campaign-report-metric"><span>Elegíveis</span><strong>${Number(campaign.customerCount || 0)}</strong></div>
            <div class="campaign-report-metric"><span>Processados</span><strong>${Number(campaign.processed || 0)}</strong></div>
            <div class="campaign-report-metric"><span>Enviados</span><strong>${Number(campaign.sent || 0)}</strong></div>
            <div class="campaign-report-metric"><span>Falhas</span><strong>${Number(campaign.failed || 0)}</strong></div>
          </div>
          ${failures.length ? `<div class="campaign-recipient-failures"><strong>Entregas que exigem atenção</strong>${failures.map((item) => `<div class="campaign-recipient-failure"><span>${escapeHtml(item.name || item.email)}</span><span>${escapeHtml(item.provider || "Sem provedor")}</span><span>${escapeHtml(item.lastError || "Falha sem detalhe")}</span><span>${Number(item.attemptCount || 0)} tentativa(s)</span><time>${item.updatedAt ? new Date(item.updatedAt).toLocaleString("pt-BR") : "Sem horário"}</time></div>`).join("")}</div>` : `<div class="empty-state compact"><strong>Nenhuma falha registrada</strong><span>Não há destinatários com erro confirmado ou resultado incerto.</span></div>`}
        `;
      } catch (error) {
        target.innerHTML = `<div class="validation-result error">${escapeHtml(error.message)}</div>`;
      }
    }

    const EMAIL_CAMPAIGN_HISTORY_FILTERS = [
      ["all", "Todos"],
      ["drafts", "Rascunhos"],
      ["scheduled", "Agendadas"],
      ["processing", "Em processamento"],
      ["completed", "Concluídas"],
      ["errors", "Com falhas"],
      ["cancelled", "Canceladas"]
    ];

    function emailCampaignTemplateLabel(templateId) {
      const template = EMAIL_CAMPAIGN_TEMPLATES[templateId] || EMAIL_CAMPAIGN_TEMPLATES.announcement;
      return template.label || templateId || "Comunicado";
    }

    return { loadEmailCampaignHistory, campaignHistoryCount, renderEmailCampaigns, emailCampaignHistoryLinkedLabel, setCampaignField, setCampaignOpenLoading, setCampaignDeleteLoading, editEmailCampaign, deleteEmailCampaign, duplicateEmailCampaign, sendExistingEmailCampaign, cancelEmailCampaign, retryEmailCampaignFailures, viewEmailCampaignReport, emailCampaignTemplateLabel };
  }

  const api = Object.freeze({ createEmailCampaignHistoryView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.emailCampaignHistoryView = api; }
})(globalThis);
