((root) => {
  function createEmailTemplateLibraryView({ state, $, api, escapeHtml, campaignTemplateAbsoluteUrl, campaignEmailLogoUrl, selectedCampaignMovie, selectedCampaignConcessions, selectedCampaignClubPlan, adminAssetUrl, campaignHtmlWithRequiredBrand, loadEmailCampaignHistory, editEmailCampaign, showToast, document, syncCampaignColorControls, resolveCampaignTemplateClient, syncCampaignTemplateResolution, applyEmailCampaignTemplate, setEmailCampaignStep }) {
    function emailTemplateLibraryQuery() {
      const params = new URLSearchParams({
        page: String(state.emailTemplateLibraryPage || 1),
        pageSize: "18",
        category: state.emailTemplateLibraryCategory || "all",
        sort: $("emailTemplateLibrarySort")?.value || "recommended"
      });
      if (state.emailTemplateLibrarySearch) params.set("search", state.emailTemplateLibrarySearch);
      if ($("emailTemplateLibraryOrigin")?.value) params.set("origin", $("emailTemplateLibraryOrigin").value);
      if ($("emailTemplateLibraryStyle")?.value) params.set("visualStyle", $("emailTemplateLibraryStyle").value);
      if ($("emailTemplateLibraryGenre")?.value) params.set("genre", $("emailTemplateLibraryGenre").value);
      if ($("emailTemplateLibraryContent")?.value) params.set("content", $("emailTemplateLibraryContent").value);
      if ($("emailTemplateLibraryFavorites")?.checked) params.set("favorites", "true");
      const resolution = state.emailCampaignTemplateResolution;
      if (resolution?.templateId) params.set("templateId", resolution.templateId);
      if (state.emailCampaignObjective) params.set("contextObjective", state.emailCampaignObjective);
      if ($("emailCampaignMovie")?.value) params.set("movieId", $("emailCampaignMovie").value);
      return params.toString();
    }

    async function loadEmailTemplateLibrary(options = {}) {
      const grid = $("emailTemplateLibraryGrid");
      if (!options.silent && grid) grid.innerHTML = '<div class="skeleton-card compact"></div><div class="skeleton-card compact"></div><div class="skeleton-card compact"></div>';
      try {
        state.emailTemplateLibrary = await api(`/api/admin/email/template-library?${emailTemplateLibraryQuery()}`);
        renderEmailTemplateLibrary();
      } catch (error) {
        if (grid) grid.innerHTML = `<div class="email-template-library-empty"><strong>Não foi possível carregar os modelos.</strong><span>${escapeHtml(error.message)}</span><button class="ghost-button" type="button" data-template-library-retry>Tentar novamente</button></div>`;
      }
    }

    function emailTemplateSystemPreviewHtml(item = {}) {
      const theme = item.theme || {};
      const defaults = item.defaults || {};
      const accent = theme.accent || "#facc15";
      const background = theme.background || "#0d1728";
      const surface = theme.surface || "#09111f";
      const headline = theme.headline || "#ffffff";
      const text = theme.text || "#dbeafe";
      const logoUrl = campaignTemplateAbsoluteUrl(campaignEmailLogoUrl(state.content?.settings?.emailBranding?.logoUrl));
      const movie = selectedCampaignMovie();
      const products = selectedCampaignConcessions();
      const plan = selectedCampaignClubPlan();
      const title = defaults.headline || item.name || "Modelo Cine Cruzeiro";
      const message = defaults.message || item.description || "Mensagem preparada para o público selecionado.";
      let feature = "";
      if (["premiere", "last_chance"].includes(item.templateId)) {
        const poster = movie?.posterUrl ? campaignTemplateAbsoluteUrl(movie.posterUrl) : "";
        feature = poster
          ? `<img src="${escapeHtml(poster)}" alt="" style="display:block;width:220px;max-width:72%;height:auto;margin:0 auto 22px;border:0">`
          : `<div style="width:180px;height:250px;margin:0 auto 22px;background:${surface};border:1px solid ${accent};color:${text};display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px">${escapeHtml(movie?.title || "Pôster do filme selecionado")}</div>`;
      } else if (item.templateId === "weekly") {
        feature = `<div style="margin:20px 0;background:${surface};padding:6px 16px">${["Filme e sessões confirmadas", "Outro destaque da programação", "Mais opções em cartaz"].map((label) => `<div style="padding:13px 0;border-bottom:1px solid #334155;color:${headline};font-size:14px;font-weight:700">${label}</div>`).join("")}</div>`;
      } else if (item.templateId === "coupon") {
        feature = `<div style="margin:22px 0;padding:22px;background:#f8fafc;border:2px dashed ${accent};color:#07111d;text-align:center"><small style="display:block;text-transform:uppercase">Código da campanha</small><strong style="display:block;margin-top:8px;font-size:28px">CINE20</strong><span style="display:block;margin-top:7px;font-size:12px">Validade e condições confirmadas</span></div>`;
      } else if (["promotion"].includes(item.templateId)) {
        feature = `<div style="margin:22px 0;padding:18px;background:${surface};border-left:4px solid ${accent};color:${text}"><strong style="display:block;color:${headline}">Benefício da campanha</strong><span style="display:block;margin-top:6px;font-size:13px">Condições, público e validade</span></div>`;
      } else if (["concession", "combo"].includes(item.templateId)) {
        const labels = products.length ? products.slice(0, 3).map((product) => product.name) : item.templateId === "combo" ? ["Produto 1", "Produto 2", "Produto 3"] : ["Produto selecionado"];
        feature = `<table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="margin:20px 0"><tr>${labels.map((label) => `<td style="padding:16px 10px;background:${surface};color:${headline};text-align:center;font-size:13px;font-weight:700">${escapeHtml(label)}</td>`).join("")}</tr></table>`;
      } else if (["club", "club_plan"].includes(item.templateId)) {
        feature = `<div style="margin:22px 0;padding:18px;background:${surface};color:${text};text-align:center"><strong style="display:block;color:${headline};font-size:18px">${escapeHtml(plan?.name || "Clube Cine Cruzeiro")}</strong><span style="display:block;margin-top:9px;font-size:13px">Benefícios e valores confirmados</span></div>`;
      } else if (item.templateId === "ticket") {
        feature = `<div style="margin:22px 0;padding:18px;background:${surface};border:1px solid #334155;color:${text}"><strong style="display:block;color:${headline}">Ingresso digital disponível</strong><span style="display:block;margin-top:7px;font-size:13px">QR Code, sessão e poltrona na conta do cliente</span></div>`;
      }
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;margin:0 auto;background:${background};font-family:Arial,sans-serif;color:${text}"><tr><td style="padding:24px 28px;border-top:4px solid ${accent}">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" width="112" alt="Cine Cruzeiro" style="display:block;width:112px;height:auto;margin:0 0 24px;border:0">` : ""}<div style="color:${accent};font-size:11px;font-weight:800;text-transform:uppercase">${escapeHtml(item.name || "Cine Cruzeiro")}</div><h1 style="margin:9px 0 16px;color:${headline};font-size:31px;line-height:1.12">${escapeHtml(title)}</h1>${feature}<p style="margin:0;color:${text};font-size:15px;line-height:1.65">${escapeHtml(message)}</p><div style="margin-top:22px"><span style="display:inline-block;padding:12px 18px;background:${accent};color:#050912;font-weight:800">${escapeHtml(defaults.ctaLabel || "Saiba mais")}</span></div><p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #334155;color:#94a3b8;font-size:11px">Mensagem automática do Cine Cruzeiro.</p></td></tr></table>`;
    }

    function renderEmailTemplateLibrary() {
      const body = $("emailTemplateLibraryBody");
      const toggle = $("emailTemplateLibraryToggle");
      if (!body || !toggle) return;
      body.hidden = !state.emailTemplateLibraryOpen;
      toggle.setAttribute("aria-expanded", String(state.emailTemplateLibraryOpen));
      toggle.textContent = state.emailTemplateLibraryOpen ? "Fechar biblioteca" : "Explorar modelos";
      if (!state.emailTemplateLibraryOpen) return;
      const library = state.emailTemplateLibrary || { items: [], categories: [], page: 1, pages: 1, total: 0 };
      const categories = $("emailTemplateLibraryCategories");
      if (categories) categories.innerHTML = (library.categories || []).map((category) => `<button type="button" class="${state.emailTemplateLibraryCategory === category.id ? "active" : ""}" data-template-library-category="${escapeHtml(category.id)}">${escapeHtml(category.label)} <span>${Number(category.count || 0)}</span></button>`).join("");
      if ($("emailTemplateLibraryCount")) $("emailTemplateLibraryCount").textContent = `${Number(library.total || 0)} modelo(s) encontrado(s)`;
      const styleSelect = $("emailTemplateLibraryStyle");
      if (styleSelect) {
        const selected = styleSelect.value;
        const styles = [...new Set([...(library.filters?.visualStyles || []), selected].filter(Boolean))].sort();
        styleSelect.innerHTML = '<option value="">Todos os estilos</option>' + styles.map((style) => `<option value="${escapeHtml(style)}">${escapeHtml(style)}</option>`).join("");
        styleSelect.value = selected;
      }
      const genreSelect = $("emailTemplateLibraryGenre");
      if (genreSelect) {
        const selected = genreSelect.value;
        const genres = [...new Set((state.content?.movies || []).flatMap((movie) => Array.isArray(movie.genres) ? movie.genres : String(movie.genre || "").split(",")).map((genre) => String(genre || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        genreSelect.innerHTML = '<option value="">Todos os gêneros</option>' + genres.map((genre) => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join("");
        genreSelect.value = selected;
      }
      const grid = $("emailTemplateLibraryGrid");
      if (grid) {
        grid.innerHTML = (library.items || []).length ? library.items.map((item) => {
          const image = item.imageUrl
            ? `<img src="${escapeHtml(adminAssetUrl(item.imageUrl))}" alt="" loading="lazy" />`
            : `<span class="email-template-library-monogram" aria-hidden="true">${escapeHtml(String(item.name || "M").slice(0, 1))}</span>`;
          return `<article class="email-template-card" data-template-library-id="${escapeHtml(item.id)}">
            <button class="email-template-card-preview" type="button" data-template-library-preview="${escapeHtml(item.id)}" aria-label="Visualizar ${escapeHtml(item.name)}">
              <span class="email-template-card-media">${image}<span>${escapeHtml(item.categoryLabel || "Modelo")}</span></span>
              <span class="email-template-card-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "Modelo do Cine Cruzeiro")}</small></span>
            </button>
            <div class="email-template-card-meta"><span>${escapeHtml(item.visualStyle || "editorial")}</span><span>${item.origin === "SAVED" ? "Referência salva" : "Modelo do sistema"}</span></div>
            <div class="email-template-card-actions">
              <button class="icon-button ${item.favorite ? "active" : ""}" type="button" data-template-library-favorite="${escapeHtml(item.id)}" aria-label="${item.favorite ? "Remover dos" : "Adicionar aos"} favoritos" title="Favorito">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>
              </button>
              <button class="ghost-button" type="button" data-template-library-preview="${escapeHtml(item.id)}">Prévia</button>
              <button class="primary-button" type="button" data-template-library-use="${escapeHtml(item.id)}">Usar</button>
            </div>
          </article>`;
        }).join("") : '<div class="email-template-library-empty"><strong>Nenhum modelo corresponde aos filtros.</strong><span>Altere a categoria ou os termos da busca.</span></div>';
      }
      const pager = $("emailTemplateLibraryPager");
      if (pager) {
        const page = Number(library.page || 1);
        const pages = Number(library.pages || 1);
        pager.innerHTML = `<button type="button" data-template-library-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${page} de ${pages}</span><button type="button" data-template-library-page="${page + 1}" ${page >= pages ? "disabled" : ""}>Próxima</button>`;
      }
      if ($("emailTemplateLibraryStatus")) $("emailTemplateLibraryStatus").textContent = library.capabilities?.massGenerationReason || "";
    }

    async function previewEmailTemplateLibraryItem(id) {
      const dialog = $("emailTemplatePreviewDialog");
      if (!dialog) return;
      const summary = (state.emailTemplateLibrary?.items || []).find((item) => item.id === id) || { id, name: "Modelo" };
      state.emailTemplateLibraryPreviewItem = summary;
      $("emailTemplatePreviewTitle").textContent = summary.name || "Prévia do modelo";
      $("emailTemplatePreviewCategory").textContent = summary.categoryLabel || "Modelo";
      $("emailTemplatePreviewContent").innerHTML = '<div class="skeleton-card"></div>';
      $("emailTemplatePreviewUse").disabled = true;
      dialog.showModal();
      try {
        const result = await api(`/api/admin/email/template-library/${encodeURIComponent(id)}`);
        state.emailTemplateLibraryPreviewItem = { ...summary, ...result.item };
        const campaign = result.item?.campaign;
        if (campaign) {
          const html = campaign.html
            ? campaignHtmlWithRequiredBrand(campaign.html, campaign.brand || {})
            : `<div style="padding:32px;background:#0d1728;color:#fff;font-family:Arial,sans-serif"><h1>${escapeHtml(campaign.headline || campaign.subject || summary.name)}</h1><p>${escapeHtml(campaign.message || "")}</p></div>`;
          $("emailTemplatePreviewContent").innerHTML = '<iframe title="Prévia segura do modelo" sandbox="allow-popups"></iframe>';
          $("emailTemplatePreviewContent").querySelector("iframe").srcdoc = html;
        } else {
          $("emailTemplatePreviewContent").innerHTML = '<iframe title="Prévia segura do modelo" sandbox="allow-popups"></iframe>';
          $("emailTemplatePreviewContent").querySelector("iframe").srcdoc = emailTemplateSystemPreviewHtml(state.emailTemplateLibraryPreviewItem);
        }
        $("emailTemplatePreviewFavorite").textContent = summary.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
        $("emailTemplatePreviewUse").disabled = false;
      } catch (error) {
        $("emailTemplatePreviewContent").innerHTML = `<div class="email-template-library-empty"><strong>Não foi possível abrir a prévia.</strong><span>${escapeHtml(error.message)}</span></div>`;
      }
    }

    async function setEmailTemplateLibraryFavorite(id, value) {
      await api(`/api/admin/email/template-library/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action: "favorite", value }) });
      await loadEmailTemplateLibrary({ silent: true });
    }

    async function useEmailTemplateLibraryItem(item = state.emailTemplateLibraryPreviewItem) {
      if (!item?.id) return;
      await api(`/api/admin/email/template-library/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ action: "use" }) });
      if (item.sourceType === "campaign") {
        const result = await api(`/api/admin/email/campaigns/${encodeURIComponent(item.sourceId)}/duplicate`, { method: "POST" });
        $("emailTemplatePreviewDialog")?.close();
        await loadEmailCampaignHistory({ silent: true });
        await editEmailCampaign(result.campaign.id);
        showToast("Uma cópia da referência foi aberta para edição.");
        return;
      }
      state.emailCampaignTemplateVariant = item;
      state.emailCampaignVariables.email_model_variant = item.variantId || item.sourceId || "";
      const objective = item.objective || "announcement";
      document.querySelector(`[data-campaign-objective="${objective}"]`)?.click();
      const variantDefaults = item.defaults || {};
      [
        ["emailCampaignSubject", variantDefaults.subject],
        ["emailCampaignPreheader", variantDefaults.preheader],
        ["emailCampaignHeadline", variantDefaults.headline],
        ["emailCampaignMessage", variantDefaults.message],
        ["emailCampaignCtaLabel", variantDefaults.ctaLabel],
        ["emailCampaignCtaUrl", variantDefaults.ctaUrl]
      ].forEach(([id, value]) => { if ($(id) && value) $(id).value = value; });
      if (item.theme?.headline && $("emailCampaignHeadlineColor")) $("emailCampaignHeadlineColor").value = item.theme.headline;
      if (item.theme?.text && $("emailCampaignTextColor")) $("emailCampaignTextColor").value = item.theme.text;
      if (item.theme?.accent && $("emailCampaignButtonColor")) $("emailCampaignButtonColor").value = item.theme.accent;
      syncCampaignColorControls();
      const resolution = resolveCampaignTemplateClient();
      if ((resolution.compatibleTemplates || []).includes(item.templateId)) {
        syncCampaignTemplateResolution({ ...resolution, templateId: item.templateId, templateSelectionMode: "manual" });
        if ($("emailCampaignTemplate")) $("emailCampaignTemplate").value = item.templateId;
        applyEmailCampaignTemplate(item.templateId, { fillDefaults: true });
      }
      $("emailTemplatePreviewDialog")?.close();
      setEmailCampaignStep(resolution.incomplete ? "objective" : "content");
      $("emailCampaignForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast(resolution.incomplete ? "Selecione o conteúdo para completar este modelo." : "Modelo aplicado ao editor.");
    }

    return { emailTemplateLibraryQuery, loadEmailTemplateLibrary, emailTemplateSystemPreviewHtml, renderEmailTemplateLibrary, previewEmailTemplateLibraryItem, setEmailTemplateLibraryFavorite, useEmailTemplateLibraryItem };
  }

  const api = Object.freeze({ createEmailTemplateLibraryView });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.emailTemplateLibraryView = api; }
})(globalThis);
