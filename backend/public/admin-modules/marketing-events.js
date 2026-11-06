((root) => {
  function bindMarketingEvents({
    $, api, applyEmailCampaignTemplate, campaignTemplateDefinition, clearCampaignCanonicalHtml, clearImageField,
    insertCampaignVariable, loadEmailCampaignHistory, loadEmailTemplateLibrary, previewEmailTemplateLibraryItem, refreshEmailCampaignRecipients, renderAdminImagePreview,
    renderEmailBrandLogoPreview, renderEmailCampaignCatalogSummary, renderEmailCampaignPreview, renderEmailTemplateLibrary, resolveCampaignTemplateClient, saveClubVisualSettings,
    saveEmailCampaign, saveSettings, scheduleEmailCampaignResolution, selectedCampaignClubPlan, selectedCampaignConcession, selectedCampaignMovie,
    sendEmailCampaign, sendEmailCampaignTest, setEmailCampaignStep, setEmailTemplateLibraryFavorite, showSuccess, showToast,
    state, syncCampaignTemplateResolution, syncEmailCampaignMode, syncTransparentImagePreviews, uploadAdminImage, useEmailTemplateLibraryItem
  }) {
    $("settingsForm").addEventListener("submit", saveSettings);
    $("clubVisualForm")?.addEventListener("submit", saveClubVisualSettings);
    $("eventTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
    $("clubTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
    $("emailCampaignForm")?.addEventListener("submit", sendEmailCampaign);
    $("emailTemplateLibraryToggle")?.addEventListener("click", () => {
      state.emailTemplateLibraryOpen = !state.emailTemplateLibraryOpen;
      renderEmailTemplateLibrary();
      if (state.emailTemplateLibraryOpen && !state.emailTemplateLibrary) void loadEmailTemplateLibrary();
    });
    $("emailTemplateLibrarySearch")?.addEventListener("input", (event) => {
      state.emailTemplateLibrarySearch = event.target.value.trim();
      state.emailTemplateLibraryPage = 1;
      clearTimeout(state.emailTemplateLibrarySearchTimer);
      state.emailTemplateLibrarySearchTimer = setTimeout(() => void loadEmailTemplateLibrary(), 300);
    });
    ["emailTemplateLibrarySort", "emailTemplateLibraryOrigin", "emailTemplateLibraryStyle", "emailTemplateLibraryGenre", "emailTemplateLibraryContent", "emailTemplateLibraryFavorites"].forEach((id) => $(id)?.addEventListener("change", () => {
      state.emailTemplateLibraryPage = 1;
      void loadEmailTemplateLibrary();
    }));
    $("emailTemplateLibraryCategories")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template-library-category]");
      if (!button) return;
      state.emailTemplateLibraryCategory = button.dataset.templateLibraryCategory || "all";
      state.emailTemplateLibraryPage = 1;
      void loadEmailTemplateLibrary();
    });
    $("emailTemplateLibraryGrid")?.addEventListener("click", (event) => {
      const retry = event.target.closest("[data-template-library-retry]");
      if (retry) return void loadEmailTemplateLibrary();
      const favorite = event.target.closest("[data-template-library-favorite]");
      if (favorite) {
        const item = (state.emailTemplateLibrary?.items || []).find((entry) => entry.id === favorite.dataset.templateLibraryFavorite);
        return void setEmailTemplateLibraryFavorite(favorite.dataset.templateLibraryFavorite, !item?.favorite).catch((error) => showToast(error.message, "error"));
      }
      const preview = event.target.closest("[data-template-library-preview]");
      if (preview) return void previewEmailTemplateLibraryItem(preview.dataset.templateLibraryPreview);
      const use = event.target.closest("[data-template-library-use]");
      if (use) {
        const item = (state.emailTemplateLibrary?.items || []).find((entry) => entry.id === use.dataset.templateLibraryUse);
        return void useEmailTemplateLibraryItem(item).catch((error) => showToast(error.message, "error"));
      }
    });
    $("emailTemplateLibraryPager")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template-library-page]");
      if (!button || button.disabled) return;
      state.emailTemplateLibraryPage = Number(button.dataset.templateLibraryPage || 1);
      void loadEmailTemplateLibrary();
    });
    $("emailTemplatePreviewClose")?.addEventListener("click", () => $("emailTemplatePreviewDialog")?.close());
    $("emailTemplatePreviewDialog")?.addEventListener("click", (event) => {
      if (event.target === $("emailTemplatePreviewDialog")) $("emailTemplatePreviewDialog").close();
    });
    $("emailTemplatePreviewFavorite")?.addEventListener("click", () => {
      const item = state.emailTemplateLibraryPreviewItem;
      if (!item) return;
      void setEmailTemplateLibraryFavorite(item.id, !item.favorite).then(() => {
        item.favorite = !item.favorite;
        $("emailTemplatePreviewFavorite").textContent = item.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
      }).catch((error) => showToast(error.message, "error"));
    });
    $("emailTemplatePreviewArchive")?.addEventListener("click", () => {
      const item = state.emailTemplateLibraryPreviewItem;
      if (!item || !window.confirm("Arquivar esta referência na biblioteca? A campanha original será preservada.")) return;
      void api(`/api/admin/email/template-library/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ action: "archive", value: true }) })
        .then(() => { $("emailTemplatePreviewDialog")?.close(); return loadEmailTemplateLibrary({ silent: true }); })
        .then(() => showToast("Referência arquivada. A campanha original foi preservada."))
        .catch((error) => showToast(error.message, "error"));
    });
    $("emailTemplatePreviewUse")?.addEventListener("click", () => void useEmailTemplateLibraryItem().catch((error) => showToast(error.message, "error")));
    document.querySelectorAll("[data-template-preview-size]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-template-preview-size]").forEach((item) => item.classList.toggle("active", item === button));
      $("emailTemplatePreviewContent")?.classList.toggle("mobile", button.dataset.templatePreviewSize === "mobile");
    }));
    document.querySelectorAll("[data-campaign-objective]").forEach((button) => button.addEventListener("click", () => {
      state.emailCampaignObjective = button.dataset.campaignObjective;
      state.emailCampaignTemplateSelectionMode = "automatic";
      clearCampaignCanonicalHtml();
      if ($("emailCampaignObjective")) $("emailCampaignObjective").value = state.emailCampaignObjective;
      const resolution = resolveCampaignTemplateClient();
      syncCampaignTemplateResolution(resolution);
      applyEmailCampaignTemplate(resolution.templateId || "announcement", { fillDefaults: true });
      scheduleEmailCampaignResolution();
    }));
    $("emailCampaignTemplateOverride")?.addEventListener("click", () => {
      state.emailCampaignTemplateSelectionMode = "manual";
      if ($("emailCampaignTemplateOverridePanel")) $("emailCampaignTemplateOverridePanel").hidden = false;
      const resolution = resolveCampaignTemplateClient();
      syncCampaignTemplateResolution({ ...resolution, templateSelectionMode: "manual" });
    });
    $("emailCampaignTemplate")?.addEventListener("change", () => {
      state.emailCampaignTemplateSelectionMode = "manual";
      clearCampaignCanonicalHtml();
      applyEmailCampaignTemplate($("emailCampaignTemplate").value, { fillDefaults: false });
      syncCampaignTemplateResolution(resolveCampaignTemplateClient());
      scheduleEmailCampaignResolution();
    });
    $("emailCampaignAudience")?.addEventListener("change", () => void refreshEmailCampaignRecipients());
    $("emailCampaignReactivationDays")?.addEventListener("change", () => void refreshEmailCampaignRecipients());
    $("emailCampaignRecipientSearch")?.addEventListener("input", () => void refreshEmailCampaignRecipients());
    $("emailCampaignRecipients")?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-campaign-recipient]");
      if (!input) return;
      if (input.checked) state.emailCampaignSelectedIds.add(input.dataset.campaignRecipient);
      else state.emailCampaignSelectedIds.delete(input.dataset.campaignRecipient);
      void refreshEmailCampaignRecipients();
    });
    $("emailCampaignDraftButton")?.addEventListener("click", () => void saveEmailCampaign(null, "draft"));
    $("emailCampaignTestButton")?.addEventListener("click", sendEmailCampaignTest);
    $("emailCampaignNextButton")?.addEventListener("click", () => {
      const next = { objective: "content", content: "audience", audience: "review" }[state.emailCampaignStep] || "review";
      setEmailCampaignStep(next);
    });
    $("emailCampaignBackButton")?.addEventListener("click", () => {
      const previous = { content: "objective", audience: "content", review: "audience" }[state.emailCampaignStep] || "objective";
      setEmailCampaignStep(previous);
    });
    document.querySelectorAll("[data-campaign-step]").forEach((button) => button.addEventListener("click", () => setEmailCampaignStep(button.dataset.campaignStep)));
    document.querySelectorAll("[data-campaign-preview]").forEach((button) => button.addEventListener("click", () => {
      state.emailCampaignPreviewMode = button.dataset.campaignPreview;
      document.querySelectorAll("[data-campaign-preview]").forEach((item) => item.classList.toggle("active", item === button));
      renderEmailCampaignPreview();
    }));
    document.querySelectorAll("[data-campaign-variable]").forEach((button) => button.addEventListener("click", () => insertCampaignVariable(button.dataset.campaignVariable)));
    $("emailCampaignVariableAdd")?.addEventListener("click", () => {
      const key = $("emailCampaignVariableKey")?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const value = $("emailCampaignVariableValue")?.value.trim();
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(key || "")) { showToast("Use um nome iniciado por letra, sem espaços.", "error"); return; }
      if (!value) { showToast("Informe o valor ou URL do placeholder.", "error"); return; }
      state.emailCampaignVariables = { ...state.emailCampaignVariables, [key]: value };
      $("emailCampaignVariableKey").value = "";
      $("emailCampaignVariableValue").value = "";
      renderEmailCampaignPreview();
    });
    $("emailCampaignVariables")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-campaign-variable-remove]");
      if (!button) return;
      const next = { ...state.emailCampaignVariables };
      delete next[button.dataset.campaignVariableRemove];
      state.emailCampaignVariables = next;
      renderEmailCampaignPreview();
    });
    $("emailCampaignImageMovie")?.addEventListener("change", () => {
      const movie = (state.content?.movies || []).find((item) => item.id === $("emailCampaignImageMovie")?.value);
      if (!movie) {
        $("emailCampaignImageUrl").value = "";
        $("emailCampaignImageAlt").value = "";
      } else {
        $("emailCampaignImageUrl").value = movie.posterUrl || "";
        $("emailCampaignImageAlt").value = `Pôster de ${movie.title || "filme"}`;
      }
      renderEmailCampaignPreview();
    });
    ["emailCampaignMovie", "emailCampaignClubPlan"].forEach((id) => $(id)?.addEventListener("change", () => {
      clearCampaignCanonicalHtml();
      const template = campaignTemplateDefinition();
      const item = template.catalog === "movie" ? selectedCampaignMovie() : template.catalog === "clubPlan" ? selectedCampaignClubPlan() : null;
      if (item) {
        const imageUrl = item.posterUrl || item.imageUrl || "";
        $("emailCampaignImageUrl").value = imageUrl;
        $("emailCampaignImageAlt").value = template.catalog === "movie" ? `Pôster de ${item.title || "filme"}` : `Imagem de ${item.name || "item"}`;
        const destination = template.catalog === "movie" ? `/filmes/${item.slug || item.id}` : template.catalog === "clubPlan" ? `/clube/assinar/${item.id}` : "/filmes";
        $("emailCampaignImageLink").value = destination;
        $("emailCampaignCtaUrl").value = destination;
      }
      renderEmailCampaignCatalogSummary();
      renderEmailCampaignPreview();
      scheduleEmailCampaignResolution();
    }));
    $("emailCampaignMovies")?.addEventListener("change", () => {
      clearCampaignCanonicalHtml();
      renderEmailCampaignPreview();
      scheduleEmailCampaignResolution();
    });
    $("emailCampaignConcessions")?.addEventListener("change", () => {
      clearCampaignCanonicalHtml();
      state.emailCampaignConcessionIds = Array.from($("emailCampaignConcessions").selectedOptions).map((option) => option.value);
      const first = selectedCampaignConcession();
      if (first) {
        $("emailCampaignImageUrl").value = first.imageUrl || "";
        $("emailCampaignImageAlt").value = `Imagem de ${first.name || "item"}`;
        $("emailCampaignImageLink").value = "/filmes";
        $("emailCampaignCtaUrl").value = "/filmes";
      }
      renderEmailCampaignCatalogSummary();
      renderEmailCampaignPreview();
      scheduleEmailCampaignResolution();
    });
    $("emailCampaignClubOffer")?.addEventListener("input", () => { clearCampaignCanonicalHtml(); renderEmailCampaignPreview(); });
    $("emailCampaignImageUpload")?.addEventListener("change", () => uploadAdminImage("emailCampaignImageUpload", "emailCampaignImageUrl", "", "email-campaign", () => {
      $("emailCampaignImageMovie").value = "";
      if (!$('emailCampaignImageAlt').value) $('emailCampaignImageAlt').value = "Imagem da campanha";
      renderEmailCampaignPreview();
    }));
    ["emailCampaignSubject", "emailCampaignPreheader", "emailCampaignHeadline", "emailCampaignMessage", "emailCampaignCtaLabel", "emailCampaignCtaUrl", "emailCampaignImageUrl", "emailCampaignImageAlt", "emailCampaignImageLink", "emailCampaignScheduleAt", "emailBrandName", "emailBrandLogoUrl", "emailBrandFooter"].forEach((id) => $(id)?.addEventListener("input", () => {
      if (["emailBrandName", "emailBrandLogoUrl"].includes(id)) renderEmailBrandLogoPreview();
      renderEmailCampaignPreview();
    }));
    $("emailCampaignCoupon")?.addEventListener("change", () => { clearCampaignCanonicalHtml(); renderEmailCampaignPreview(); scheduleEmailCampaignResolution(); });
    $("emailCampaignAttachmentUpload")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (state.emailCampaignAttachments.length >= 5) { showToast("Limite de 5 anexos por campanha.", "error"); return; }
      try {
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        const result = await api("/api/admin/email/attachments", { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, data }) });
        state.emailCampaignAttachments.push(result.attachment);
        renderEmailCampaignPreview();
      } catch (error) { showToast(error.message, "error"); }
    });
    $("emailCampaignAttachments")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-campaign-remove-attachment]");
      if (!button) return;
      state.emailCampaignAttachments = state.emailCampaignAttachments.filter((item) => item.id !== button.dataset.campaignRemoveAttachment);
      renderEmailCampaignPreview();
    });
    $("emailCampaignHistoryControls")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-campaign-history-filter]");
      if (!button) return;
      state.emailCampaignHistoryFilter = button.dataset.campaignHistoryFilter || "all";
      state.emailCampaignHistoryPage = 1;
      void loadEmailCampaignHistory();
    });
    $("emailCampaignHistoryPager")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-campaign-history-page]");
      if (!button || button.disabled) return;
      state.emailCampaignHistoryPage = Number(button.dataset.campaignHistoryPage || 1);
      void loadEmailCampaignHistory();
    });
    $("emailCampaignHistoryPageSize")?.addEventListener("change", (event) => {
      state.emailCampaignHistoryPageSize = Number(event.target.value || 25);
      state.emailCampaignHistoryPage = 1;
      void loadEmailCampaignHistory();
    });
    $("emailCampaignHistorySearch")?.addEventListener("input", (event) => {
      state.emailCampaignHistorySearch = event.target.value.trim();
      state.emailCampaignHistoryPage = 1;
      clearTimeout(state.emailCampaignHistorySearchTimer);
      state.emailCampaignHistorySearchTimer = setTimeout(() => void loadEmailCampaignHistory(), 350);
    });
    $("emailBrandSaveButton")?.addEventListener("click", async () => {
      try {
        const saved = await api("/api/admin/email/branding", { method: "PUT", body: JSON.stringify({ name: $("emailBrandName").value.trim(), logoUrl: $("emailBrandLogoUrl").value.trim(), footer: $("emailBrandFooter").value.trim() }) });
        state.content.settings.emailBranding = saved.branding || {};
        renderEmailBrandLogoPreview();
        renderEmailCampaignPreview();
        showSuccess("Identidade salva", "A identidade ficará disponível para os próximos envios.");
        showToast("Alterações salvas.");
      } catch (error) { showToast(error.message, "error"); }
    });
    syncEmailCampaignMode();
    [
      ["eventHeroImageUpload", "eventHeroImageUrl", "eventHeroImagePreview", "events/hero", "Prévia da imagem principal", "eventHeroImageClear"],
      ["eventGamesImageUpload", "eventGamesImageUrl", "eventGamesImagePreview", "events/games", "Prévia de games", "eventGamesImageClear"],
      ["eventPartiesImageUpload", "eventPartiesImageUrl", "eventPartiesImagePreview", "events/parties", "Prévia de festas", "eventPartiesImageClear"],
      ["eventCorporateImageUpload", "eventCorporateImageUrl", "eventCorporateImagePreview", "events/corporate", "Prévia corporativa", "eventCorporateImageClear"],
      ["eventGalleryImageUpload", "eventGalleryImageUrl", "eventGalleryImagePreview", "events/gallery", "Prévia da galeria", "eventGalleryImageClear"],
      ["clubHeroImageUpload", "clubHeroImageUrl", "clubHeroImagePreview", "club/hero", "Prévia do hero", "clubHeroImageClear"],
      ["clubBannerImageUpload", "clubBannerImageUrl", "clubBannerImagePreview", "club/banner", "Prévia do banner", "clubBannerImageClear"],
      ["clubPlanImageUpload", "clubPlanImageUrl", "clubPlanImagePreview", "club/plans", "Prévia do plano", "clubPlanImageClear"]
    ].forEach(([uploadId, inputId, previewId, folder, label, clearId]) => {
      $(uploadId)?.addEventListener("change", () => uploadAdminImage(uploadId, inputId, previewId, folder, async () => {
        if (uploadId !== "clubPlanImageUpload") return;
        showToast("Imagem enviada. Revise a prévia e clique em Salvar plano.");
      }));
      $(inputId)?.addEventListener("input", () => renderAdminImagePreview(inputId, previewId, label));
      $(clearId)?.addEventListener("click", () => clearImageField(inputId, previewId, label));
    });
  }
  const api = Object.freeze({ bindMarketingEvents });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.bindMarketingEvents = api; }
})(globalThis);
