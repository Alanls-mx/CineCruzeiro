((root) => {
  function createEmailCampaignEditor({ state, $, API_BASE, EMAIL_CAMPAIGN_TEMPLATES, api, campaignEmailLogoUrl, campaignObjectiveCatalogType, campaignTemplateAbsoluteUrl, campaignTemplateDefinition, campaignTemplateHtml, campaignTemplateLogo, campaignTemplateTheme, campaignTemplateVariant, couponRuleLabel, currentMovie, emailCampaignTemplateLabel, escapeHtml, loadEmailCampaignHistory, money, normalizedSearchText, randomClientId, resolveCampaignTemplateClient, selectedCampaignCatalogItem, selectedCampaignCatalogMovies, selectedCampaignClubPlan, selectedCampaignConcessions, selectedCampaignMovie, selectedCampaignMovies, showToast, document, window }) {
    function emailCampaignPayload(action = "draft") {
      const variant = campaignTemplateVariant();
      const brand = {
        name: $("emailBrandName")?.value.trim() || "Cine Cruzeiro",
        logoUrl: $("emailBrandLogoUrl")?.value.trim() || "",
        footer: $("emailBrandFooter")?.value.trim() || ""
      };
      const movieId = $("emailCampaignMovie")?.value || "";
      const explicitMovieIds = [...new Set([
        ...Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
        movieId
      ].filter(Boolean))];
      const movieIds = explicitMovieIds.length || campaignTemplateDefinition().layout !== "weekly"
        ? explicitMovieIds
        : selectedCampaignMovies().map((movie) => String(movie.id));
      return {
        id: state.emailCampaignDraftId || undefined,
        idempotencyKey: state.emailCampaignIdempotencyKey,
        action,
        subject: $("emailCampaignSubject")?.value.trim() || "",
        mode: "template",
        templateId: $("emailCampaignTemplate")?.value || "announcement",
        objective: $("emailCampaignObjective")?.value || state.emailCampaignObjective || "announcement",
        templateSelectionMode: state.emailCampaignTemplateSelectionMode || "automatic",
        preheader: $("emailCampaignPreheader")?.value.trim() || "",
        headline: $("emailCampaignHeadline")?.value.trim() || "",
        message: $("emailCampaignMessage")?.value || "",
        html: state.emailCampaignUseCanonicalHtml ? campaignCanonicalHtmlWithEdits() : campaignTemplateHtml(),
        ctaLabel: $("emailCampaignCtaLabel")?.value.trim() || "",
        ctaUrl: campaignTemplateAbsoluteUrl($("emailCampaignCtaUrl")?.value) || "",
        recipientMode: $("emailCampaignAudience")?.value || "all",
        reactivationDays: Number($("emailCampaignReactivationDays")?.value || 90),
        customerIds: [...state.emailCampaignSelectedIds],
        recipientSearch: $("emailCampaignRecipientSearch")?.value.trim() || "",
        couponId: $("emailCampaignCoupon")?.value || "",
        movieId,
        movieIds,
        concessionId: $("emailCampaignConcession")?.value || "",
        concessionIds: [...new Set([...(Array.from($("emailCampaignConcessions")?.selectedOptions || []).map((option) => option.value)), $("emailCampaignConcession")?.value || ""].filter(Boolean))],
        clubPlanId: $("emailCampaignClubPlan")?.value || "",
        clubOffer: $("emailCampaignClubOffer")?.value.trim() || "",
        attachments: state.emailCampaignAttachments,
        variables: {
          ...campaignPreviewVariables(),
          ...state.emailCampaignVariables,
          ...(variant?.variantId ? { email_model_variant: variant.variantId } : {})
        },
        contentBlocks: [],
        imageUrl: $("emailCampaignImageUrl")?.value.trim() || "",
        imageAlt: $("emailCampaignImageAlt")?.value.trim() || "",
        imageLink: $("emailCampaignImageLink")?.value.trim() || "",
        headlineColor: $("emailCampaignHeadlineColor")?.value || "#ffffff",
        textColor: $("emailCampaignTextColor")?.value || "#dbeafe",
        buttonColor: $("emailCampaignButtonColor")?.value || "#facc15",
        visualStyleLabel: variant?.name || "",
        scheduleAt: $("emailCampaignScheduleAt")?.value ? new Date($("emailCampaignScheduleAt").value).toISOString() : "",
        brand
      };
    }

    function ensureCampaignBrandLogoInTemplate(template, logoValue = $("emailBrandLogoUrl")?.value, brandName = $("emailBrandName")?.value || "Cine Cruzeiro") {
      if (!template?.content || template.content.querySelector('[data-campaign-brand="true"], [data-campaign-field="logo"]')) return;
      const firstCell = template.content.querySelector("table td");
      if (!firstCell) return;
      firstCell.insertAdjacentHTML("afterbegin", campaignTemplateLogo(
        campaignTemplateAbsoluteUrl(campaignEmailLogoUrl(logoValue)),
        brandName || "Cine Cruzeiro"
      ));
    }

    function campaignHtmlWithRequiredBrand(source, brand = {}) {
      const template = document.createElement("template");
      template.innerHTML = String(source || "");
      ensureCampaignBrandLogoInTemplate(template, brand.logoUrl, brand.name || "Cine Cruzeiro");
      return template.innerHTML;
    }

    function campaignCanonicalHtmlWithEdits() {
      const source = $("emailCampaignHtml")?.value || "";
      if (!source) return campaignTemplateHtml();
      const template = document.createElement("template");
      template.innerHTML = source;
      ensureCampaignBrandLogoInTemplate(template);
      const setText = (selector, value, multiline = false) => {
        template.content.querySelectorAll(selector).forEach((node) => {
          node.textContent = String(value || "");
          if (multiline) node.innerHTML = node.innerHTML.replace(/\r?\n/g, "<br>");
        });
      };
      setText('[data-campaign-field="headline"]', $("emailCampaignHeadline")?.value);
      setText('[data-campaign-field="message"]', $("emailCampaignMessage")?.value, true);
      setText('[data-campaign-field="footer"]', $("emailBrandFooter")?.value);
      setText('[data-campaign-field="movie-title"]', selectedCampaignMovie()?.title || $("emailCampaignHeadline")?.value);
      template.content.querySelectorAll('[data-campaign-field="logo"]').forEach((node) => {
        const src = campaignTemplateAbsoluteUrl(campaignEmailLogoUrl($("emailBrandLogoUrl")?.value));
        if (src) node.setAttribute("src", src);
        node.setAttribute("alt", $("emailBrandName")?.value || "Cine Cruzeiro");
      });
      template.content.querySelectorAll('[data-campaign-field="image"]').forEach((node) => {
        const src = campaignTemplateAbsoluteUrl($("emailCampaignImageUrl")?.value);
        if (src) node.setAttribute("src", src);
        node.setAttribute("alt", $("emailCampaignImageAlt")?.value || "Imagem da campanha");
        const link = campaignTemplateAbsoluteUrl($("emailCampaignImageLink")?.value);
        if (link && node.parentElement?.tagName === "A") node.parentElement.setAttribute("href", link);
      });
      template.content.querySelectorAll('[data-campaign-cta-index="0"]').forEach((node) => {
        node.textContent = $("emailCampaignCtaLabel")?.value || node.textContent;
        const href = campaignTemplateAbsoluteUrl($("emailCampaignCtaUrl")?.value);
        if (href) node.setAttribute("href", href);
      });
      const headlineColor = campaignColor($("emailCampaignHeadlineColor")?.value, "#ffffff");
      const textColor = campaignColor($("emailCampaignTextColor")?.value, "#dbeafe");
      const buttonColor = campaignColor($("emailCampaignButtonColor")?.value, "#facc15");
      template.content.querySelectorAll('[data-campaign-field="headline"]').forEach((node) => { node.style.color = headlineColor; });
      template.content.querySelectorAll('[data-campaign-field="message"]').forEach((node) => { node.style.color = textColor; });
      template.content.querySelectorAll('[data-campaign-cta-index="0"]').forEach((node) => {
        node.style.background = buttonColor;
        node.style.borderColor = buttonColor;
      });
      return template.innerHTML;
    }

    function clearCampaignCanonicalHtml() {
      state.emailCampaignUseCanonicalHtml = false;
      if ($("emailCampaignHtml")) $("emailCampaignHtml").value = "";
    }

    async function refreshEmailCampaignRecipients() {
      const payload = emailCampaignPayload();
      const result = await api("/api/admin/email/campaigns/preview", { method: "POST", body: JSON.stringify(payload) });
      syncCampaignTemplateResolution(result.templateResolution || resolveCampaignTemplateClient());
      if (result.templateResolution?.templateId && result.templateResolution.templateId !== payload.templateId) {
        applyEmailCampaignTemplate(result.templateResolution.templateId, { fillDefaults: false });
      }
      state.emailCampaignRecipients = state.content?.emailCustomers || [];
      $("emailCampaignRecipientCount").textContent = `${result.count || 0} destinatário(s) elegível(is)`;
      $("emailCampaignReviewRecipients").textContent = String(result.count || 0);
      updateEmailCampaignContext();
      const list = $("emailCampaignRecipients");
      const manual = ["selected", "birthday_manual"].includes(payload.recipientMode);
      if ($("emailCampaignReactivationField")) $("emailCampaignReactivationField").hidden = payload.recipientMode !== "reactivation";
      if ($("emailCampaignBirthdayNotice")) $("emailCampaignBirthdayNotice").hidden = payload.recipientMode !== "birthday_manual";
      list.hidden = !manual;
      if (manual) {
        const term = normalizedSearchText(payload.recipientSearch);
        const customers = state.emailCampaignRecipients.filter((item) => !term || normalizedSearchText(`${item.name} ${item.email}`).includes(term));
        list.innerHTML = customers.length ? customers.map((item) => `
          <label class="campaign-recipient-row"><input type="checkbox" data-campaign-recipient="${escapeHtml(item.id)}" ${state.emailCampaignSelectedIds.has(item.id) ? "checked" : ""} /><span><strong>${escapeHtml(item.name || "Cliente")}</strong><small>${escapeHtml(item.email)}</small></span></label>
        `).join("") : `<div class="empty-state"><strong>Nenhum cliente encontrado</strong><span>Clientes descadastrados ficam fora da seleção.</span></div>`;
      }
      renderEmailCampaignPreview();
    }

    function campaignPreviewVariables() {
      const coupon = (state.content?.promotions || []).find((item) => item.id === $("emailCampaignCoupon")?.value);
      const movie = selectedCampaignMovie();
      const concessions = selectedCampaignConcessions();
      const plan = selectedCampaignClubPlan();
      const audience = campaignAudienceLabel($("emailCampaignAudience")?.value);
      const brandName = $("emailBrandName")?.value.trim() || "Cine Cruzeiro";
      const movieLink = movie ? campaignTemplateAbsoluteUrl(`/filmes/${movie.slug || movie.id}`) : "";
      const planLink = plan ? campaignTemplateAbsoluteUrl(`/clube/assinar/${plan.id}`) : "";
      const firstConcession = concessions[0];
      const benefits = Array.isArray(plan?.benefits) ? plan.benefits.filter(Boolean).slice(0, 8).join(" · ") : "";
      return {
        ...campaignBuiltInVariables({ coupon, movie, concessions, plan, audience, brandName, movieLink, planLink, benefits }),
        ...state.emailCampaignVariables,
        nome: "Cliente de teste",
        email: "cliente@exemplo.com",
        codigo_cupom: coupon?.couponCode || "SELECIONE_UM_CUPOM",
        validade_cupom: coupon?.endsAt ? new Date(coupon.endsAt).toLocaleDateString("pt-BR") : "defina um cupom",
        link_cupom: $("emailCampaignCtaUrl")?.value || `${API_BASE}/filmes`,
        nome_item: firstConcession?.name || "item selecionado",
        preco_item: firstConcession ? money(firstConcession.price || 0) : "",
        imagem_item: firstConcession?.imageUrl || ""
      };
    }

    function campaignAudienceLabel(value = "all") {
      return {
        all: "Todos os clientes com marketing ativo",
        active: "Clientes ativos recentemente",
        recent: "Clientes ativos recentemente",
        purchased: "Clientes com compras aprovadas",
        reactivation: "Clientes sem comprar no período escolhido",
        birthday_manual: "Aniversariantes selecionados manualmente",
        selected: "Clientes selecionados manualmente"
      }[String(value || "all")] || "Todos os clientes com marketing ativo";
    }

    function campaignBuiltInVariables({ coupon, movie, concessions = [], plan, audience, brandName, movieLink, planLink, benefits } = {}) {
      const firstConcession = concessions[0];
      const concessionItems = concessions.map((item) => `${item.name || "Item"} (${money(item.price || 0)})`).join(" · ");
      const movieSessions = (movie?.sessions || []).filter((session) => session.date && session.time).slice(0, 6).map((session) => `${new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR")} às ${session.time}`).join(" · ");
      const movieGenre = Array.isArray(movie?.genres) ? movie.genres[0] : movie?.genre || "";
      return {
        nome_cinema: brandName || "Cine Cruzeiro",
        primeiro_nome: "Cliente",
        data_envio: new Date().toLocaleDateString("pt-BR"),
        publico_oferta: audience || "Todos os clientes com marketing ativo",
        nome_filme: movie?.title || "",
        link_filme: movieLink || "",
        sessoes_filme: movieSessions,
        duracao_filme: movie?.duration || "",
        classificacao_filme: movie?.rating || movie?.classification || "",
        genero_filme: movieGenre,
        nome_item: firstConcession?.name || "",
        descricao_item: firstConcession?.description || "",
        preco_item: firstConcession ? money(firstConcession.price || 0) : "",
        itens_bomboniere: concessionItems,
        link_bomboniere: campaignTemplateAbsoluteUrl("/filmes"),
        nome_plano: plan?.name || "",
        preco_plano: plan ? `${money(plan.monthlyPrice || 0)}/mês` : "",
        creditos_clube: plan ? String(plan.includedTickets || 0) : "",
        beneficios_clube: benefits || "",
        imagem_plano: plan?.imageUrl || "",
        link_plano: planLink || "",
        titulo_cupom: coupon?.title || "",
        desconto_cupom: coupon ? couponRuleLabel(coupon) : "",
        validade_oferta: coupon?.endsAt ? new Date(coupon.endsAt).toLocaleDateString("pt-BR") : ""
      };
    }

    function syncCampaignTemplateResolution(resolution = resolveCampaignTemplateClient()) {
      const activeVariant = state.emailCampaignTemplateVariant;
      if (!resolution.incomplete && activeVariant && !(resolution.compatibleTemplates || []).includes(activeVariant.templateId)) {
        state.emailCampaignTemplateVariant = null;
        delete state.emailCampaignVariables.email_model_variant;
      }
      state.emailCampaignTemplateResolution = resolution;
      state.emailCampaignTemplateSelectionMode = resolution.templateSelectionMode || state.emailCampaignTemplateSelectionMode || "automatic";
      state.emailCampaignTemplate = resolution.templateId || "announcement";
      const objective = resolution.objective || $("emailCampaignObjective")?.value || state.emailCampaignObjective || "announcement";
      state.emailCampaignObjective = objective;
      if ($("emailCampaignObjective")) $("emailCampaignObjective").value = objective;
      const select = $("emailCampaignTemplate");
      if (select) {
        const options = resolution.compatibleTemplates || [];
        const current = select.value;
        select.innerHTML = (options.length ? options : [resolution.templateId || "announcement"]).map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(emailCampaignTemplateLabel(id))}</option>`).join("");
        select.value = options.includes(current) ? current : (resolution.templateId || "announcement");
      }
      if ($("emailCampaignResolvedTemplate")) $("emailCampaignResolvedTemplate").textContent = resolution.templateId ? emailCampaignTemplateLabel(resolution.templateId) : "Aguardando conteúdo";
      if ($("emailCampaignTemplateReason")) $("emailCampaignTemplateReason").textContent = resolution.reason || "Selecione o conteúdo para montarmos o layout correto.";
      if ($("emailCampaignTemplateOverride")) $("emailCampaignTemplateOverride").hidden = !(resolution.compatibleTemplates || []).length || resolution.compatibleTemplates.length < 2;
      if ($("emailCampaignTemplateOverridePanel")) $("emailCampaignTemplateOverridePanel").hidden = state.emailCampaignTemplateSelectionMode !== "manual";
      document.querySelectorAll("[data-campaign-objective]").forEach((button) => {
        const active = button.dataset.campaignObjective === objective;
        button.classList.toggle("active", active);
        button.setAttribute("aria-checked", String(active));
      });
      updateEmailCampaignContext();
    }

    let emailCampaignResolutionTimer = null;

    function scheduleEmailCampaignResolution() {
      clearTimeout(emailCampaignResolutionTimer);
      emailCampaignResolutionTimer = setTimeout(() => { void refreshEmailCampaignRecipients().catch(() => null); }, 180);
    }

    function applyEmailCampaignTemplate(templateId, { fillDefaults = true } = {}) {
      const select = $("emailCampaignTemplate");
      const template = EMAIL_CAMPAIGN_TEMPLATES[templateId] || EMAIL_CAMPAIGN_TEMPLATES.announcement;
      const previous = EMAIL_CAMPAIGN_TEMPLATES[select?.value] || EMAIL_CAMPAIGN_TEMPLATES.announcement;
      if (select) select.value = templateId in EMAIL_CAMPAIGN_TEMPLATES ? templateId : "announcement";
      state.emailCampaignTemplate = select?.value || "announcement";
      document.querySelectorAll('[data-campaign-template-panel="media"]').forEach((panel) => { panel.hidden = !template.media; });
      if ($("emailCampaignMediaHint")) $("emailCampaignMediaHint").textContent = template.mediaLabel || "Imagem controlada pelo modelo";
      if ($("emailCampaignCouponField")) $("emailCampaignCouponField").hidden = !["coupon", "promotion"].includes(state.emailCampaignTemplate);
      const catalogPanel = $("emailCampaignCatalogPanel");
      const catalogType = template.catalog || campaignObjectiveCatalogType();
      if (catalogPanel) catalogPanel.hidden = !catalogType;
      if ($("emailCampaignMovieField")) $("emailCampaignMovieField").hidden = catalogType !== "movie" || template.layout === "weekly" || $("emailCampaignObjective")?.value === "programming";
      if ($("emailCampaignMoviesField")) $("emailCampaignMoviesField").hidden = catalogType !== "movie" || ($("emailCampaignObjective")?.value !== "programming" && template.layout !== "weekly");
      if ($("emailCampaignConcessionField")) $("emailCampaignConcessionField").hidden = catalogType !== "concessions";
      if ($("emailCampaignClubPlanField")) $("emailCampaignClubPlanField").hidden = catalogType !== "clubPlan";
      if ($("emailCampaignClubOfferField")) $("emailCampaignClubOfferField").hidden = $("emailCampaignObjective")?.value !== "club" || !["clubNews", "clubPlan"].includes(template.layout);
      if (fillDefaults) {
        const variantDefaults = campaignTemplateVariant(templateId)?.defaults || {};
        if (previous.catalog !== template.catalog) {
          if ($("emailCampaignCtaUrl")) $("emailCampaignCtaUrl").value = template.ctaUrl;
          if ($("emailCampaignImageUrl")) $("emailCampaignImageUrl").value = "";
          if ($("emailCampaignImageAlt")) $("emailCampaignImageAlt").value = "";
          if ($("emailCampaignImageLink")) $("emailCampaignImageLink").value = "";
        }
        const defaults = { emailCampaignSubject: variantDefaults.subject || template.subject, emailCampaignPreheader: variantDefaults.preheader || "", emailCampaignHeadline: variantDefaults.headline || template.headline, emailCampaignMessage: variantDefaults.message || template.message, emailCampaignCtaLabel: variantDefaults.ctaLabel || template.ctaLabel, emailCampaignCtaUrl: variantDefaults.ctaUrl || template.ctaUrl };
        const previousDefaults = { emailCampaignSubject: previous.subject, emailCampaignPreheader: "", emailCampaignHeadline: previous.headline, emailCampaignMessage: previous.message, emailCampaignCtaLabel: previous.ctaLabel, emailCampaignCtaUrl: previous.ctaUrl };
        Object.entries(defaults).forEach(([id, value]) => {
          if ($(id) && (!$(id).value.trim() || $(id).value.trim() === previousDefaults[id])) $(id).value = value;
        });
        const theme = campaignTemplateTheme();
        if (theme.headline && $("emailCampaignHeadlineColor")) $("emailCampaignHeadlineColor").value = theme.headline;
        if (theme.text && $("emailCampaignTextColor")) $("emailCampaignTextColor").value = theme.text;
        if (theme.accent && $("emailCampaignButtonColor")) $("emailCampaignButtonColor").value = theme.accent;
        syncCampaignColorControls();
      }
      if ($("emailCampaignHtml") && !state.emailCampaignUseCanonicalHtml) $("emailCampaignHtml").value = campaignTemplateHtml();
      renderEmailCampaignCatalogSummary();
      syncCampaignTemplateResolution(state.emailCampaignTemplateResolution || resolveCampaignTemplateClient());
      renderEmailCampaignPreview({ inspector: false });
    }

    function renderEmailCampaignCatalogSummary() {
      const target = $("emailCampaignCatalogSummary");
      if (!target) return;
      const template = campaignTemplateDefinition();
      const item = selectedCampaignCatalogItem();
      if (!template.catalog) {
        target.innerHTML = "";
        return;
      }
      if (!item || (Array.isArray(item) && !item.length)) {
        target.innerHTML = `<span>Selecione um item para usar os dados reais do catálogo neste e-mail.</span>`;
        return;
      }
      const imageUrl = Array.isArray(item) ? (item[0]?.posterUrl || item[0]?.imageUrl || "") : item.posterUrl || item.imageUrl || "";
      const meta = template.catalog === "movie"
        ? Array.isArray(item)
          ? `${item.length} filme(s) · ${item.reduce((total, movie) => total + (movie.sessions || []).length, 0)} sessão(ões) cadastrada(s)`
          : `${(item.sessions || []).length} sessão(ões) cadastrada(s)${item.duration ? ` · ${String(item.duration)}` : ""}`
        : template.catalog === "concessions"
          ? `${item.length} item(ns) selecionado(s) · ${money(item.reduce((sum, entry) => sum + Number(entry.price || 0), 0))}`
          : `${money(item.monthlyPrice || 0)}/mês · ${Number(item.includedTickets || 0)} ingresso(s)`;
      const itemName = Array.isArray(item) ? item.map((entry) => entry.title || entry.name || "Item").join(", ") : item.title || item.name || "Item selecionado";
      target.innerHTML = `${imageUrl ? `<img src="${escapeHtml(campaignTemplateAbsoluteUrl(imageUrl))}" alt="" />` : ""}<span><strong>${escapeHtml(itemName)}</strong><small>${escapeHtml(meta)}</small></span>`;
    }

    function interpolateCampaignPreview(value) {
      const variables = campaignPreviewVariables();
      return String(value || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => escapeHtml(variables[String(key).toLowerCase()] ?? ""));
    }

    function renderEmailCampaignVariables() {
      const target = $("emailCampaignVariables");
      if (!target) return;
      const entries = Object.entries(state.emailCampaignVariables || {});
      target.innerHTML = entries.length
        ? entries.map(([key, value]) => `<span class="campaign-custom-variable-chip"><span>{{${escapeHtml(key)}}} = ${escapeHtml(value)}</span><button type="button" data-campaign-variable-remove="${escapeHtml(key)}" aria-label="Remover ${escapeHtml(key)}">×</button></span>`).join("")
        : `<span class="helper-text">Nenhuma variável personalizada configurada.</span>`;
    }

    function insertCampaignVariable(key) {
      const token = `{{${key}}}`;
      const target = $("emailCampaignMessage");
      if (!target) return;
      const start = Number.isInteger(target.selectionStart) ? target.selectionStart : target.value.length;
      const end = Number.isInteger(target.selectionEnd) ? target.selectionEnd : target.value.length;
      target.value = `${target.value.slice(0, start)}${token}${target.value.slice(end)}`;
      target.focus();
      target.selectionStart = target.selectionEnd = start + token.length;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function campaignSafeUrl(value) {
      const raw = String(value || "").trim();
      if (!raw || /^(javascript|data|vbscript):/i.test(raw)) return "";
      if (/^\/\//.test(raw)) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      if (!raw.startsWith("/")) return "";
      const basePath = String(API_BASE || "").replace(/\/$/, "");
      return basePath && raw !== basePath && !raw.startsWith(`${basePath}/`) ? `${basePath}${raw}` : raw;
    }

    function campaignEditorAssetUrl(value) {
      const safe = campaignSafeUrl(value);
      if (!safe) return "";
      try {
        return new URL(safe, window.location.origin).href;
      } catch {
        return safe;
      }
    }

    function campaignColor(value, fallback) {
      const normalized = String(value || "").trim();
      return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
    }

    function renderEmailCampaignPreview(options = {}) {
      const preview = $("emailCampaignPreview");
      if (!preview) return;
      const payload = emailCampaignPayload();
      const message = sanitizeCampaignHtmlPreview(interpolateCampaignPreview(payload.html));
      preview.innerHTML = `<div class="campaign-email-mock ${state.emailCampaignPreviewMode === "mobile" ? "mobile" : ""}"><div class="campaign-email-body">${message || `<div class="campaign-compose-empty">Preencha os campos do modelo para visualizar o e-mail.</div>`}</div><small class="campaign-email-unsubscribe" title="Obrigatório em campanhas de marketing">Não desejo receber mais emails</small></div>`;
      $("emailCampaignReviewSubject").textContent = interpolateCampaignPreview(payload.subject || "Ainda não definido");
      if ($("emailCampaignReviewTemplate")) $("emailCampaignReviewTemplate").textContent = campaignTemplateDefinition().label;
      $("emailCampaignReviewSchedule").textContent = payload.scheduleAt ? new Date(payload.scheduleAt).toLocaleString("pt-BR") : "Enviar agora";
      if ($("emailCampaignReviewOffer")) {
        const template = campaignTemplateDefinition();
        const movies = selectedCampaignCatalogMovies();
        const concessions = selectedCampaignConcessions();
        const plan = selectedCampaignClubPlan();
        const coupon = (state.content?.promotions || []).find((item) => item.id === $("emailCampaignCoupon")?.value);
        const linked = movies.length > 1 ? `${movies.length} filmes da programação` : movies[0]?.title || plan?.name || (concessions.length ? `${concessions.length} item(ns) da bomboniere` : coupon?.title) || "Sem item de catálogo";
        $("emailCampaignReviewOffer").textContent = `${linked} · ${campaignAudienceLabel($("emailCampaignAudience")?.value)} · ${template.mediaLabel || "Sem imagem adicional"}`;
      }
      const attachments = $("emailCampaignAttachments");
      if (attachments) attachments.innerHTML = state.emailCampaignAttachments.length ? state.emailCampaignAttachments.map((item) => `<span class="campaign-attachment-chip">${escapeHtml(item.filename)} <button type="button" data-campaign-remove-attachment="${escapeHtml(item.id)}" aria-label="Remover anexo">×</button></span>`).join("") : `<span class="helper-text">Nenhum anexo adicionado.</span>`;
      renderEmailCampaignVariables();
      updateEmailCampaignContext();
    }

    function syncCampaignColorControls() {
      [["emailCampaignHeadlineColor", "emailCampaignHeadlineColorValue", "#ffffff"], ["emailCampaignTextColor", "emailCampaignTextColorValue", "#dbeafe"], ["emailCampaignButtonColor", "emailCampaignButtonColorValue", "#facc15"]].forEach(([colorId, valueId, fallback]) => {
        const color = $(colorId);
        const value = $(valueId);
        if (!color || !value) return;
        const normalized = campaignColor(value.value || color.value, fallback);
        color.value = normalized;
        value.value = normalized;
      });
    }

    function bindCampaignColorControls() {
      [["emailCampaignHeadlineColor", "emailCampaignHeadlineColorValue", "#ffffff"], ["emailCampaignTextColor", "emailCampaignTextColorValue", "#dbeafe"], ["emailCampaignButtonColor", "emailCampaignButtonColorValue", "#facc15"]].forEach(([colorId, valueId, fallback]) => {
        const color = $(colorId);
        const value = $(valueId);
        if (!color || !value) return;
        color.addEventListener("input", () => { value.value = color.value; renderEmailCampaignPreview(); });
        value.addEventListener("input", () => {
          const normalized = campaignColor(value.value, "");
          if (!normalized) return;
          color.value = normalized;
          renderEmailCampaignPreview();
        });
        value.addEventListener("blur", () => {
          value.value = campaignColor(value.value, color.value || fallback);
          color.value = value.value;
          renderEmailCampaignPreview();
        });
      });
    }

    function sanitizeCampaignHtmlPreview(value) {
      const documentPreview = new DOMParser().parseFromString(`<body>${String(value || "")}</body>`, "text/html");
      documentPreview.querySelectorAll("script,iframe,object,embed,form,base,meta,link").forEach((node) => node.remove());
      documentPreview.body.querySelectorAll("*").forEach((node) => {
        [...node.attributes].forEach((attribute) => {
          const name = attribute.name.toLowerCase();
          if (/^on/.test(name) || name === "srcdoc") node.removeAttribute(attribute.name);
          if (["href", "src", "action", "formaction"].includes(name) && /^(javascript|data|vbscript):/i.test(attribute.value.trim())) node.removeAttribute(attribute.name);
        });
      });
      return documentPreview.body.innerHTML;
    }

    function renderEmailBrandLogoPreview() {
      const preview = $("emailBrandLogoPreview");
      if (!preview) return;
      const src = campaignEditorAssetUrl(campaignEmailLogoUrl($("emailBrandLogoUrl")?.value));
      preview.innerHTML = src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml($("emailBrandName")?.value || "Cine Cruzeiro")}">` : "Nenhuma logo configurada";
    }

    function syncEmailCampaignMode() {
      applyEmailCampaignTemplate($("emailCampaignTemplate")?.value || "announcement", { fillDefaults: false });
      updateEmailCampaignWorkspaceState();
    }

    function updateEmailCampaignWorkspaceState() {
      const workspace = $("emailCampaignWorkspace");
      if (!workspace) return;
      workspace.classList.toggle("is-content-step", ["objective", "content"].includes(state.emailCampaignStep));
    }

    function updateEmailCampaignContext() {
      const stepLabels = { objective: "Objetivo", content: "Conteúdo", audience: "Destinatários", review: "Revisão" };
      const count = Number(String($("emailCampaignReviewRecipients")?.textContent || "0").replace(/\D/g, "")) || 0;
      if ($("emailCampaignContextStep")) $("emailCampaignContextStep").textContent = stepLabels[state.emailCampaignStep] || "Destinatários";
      if ($("emailCampaignContextAudience")) $("emailCampaignContextAudience").textContent = `${count.toLocaleString("pt-BR")} pessoa${count === 1 ? "" : "s"}`;
      if ($("emailCampaignContextTemplate")) $("emailCampaignContextTemplate").textContent = state.emailCampaignTemplateResolution?.templateId ? campaignTemplateDefinition().label : "Aguardando conteúdo";
    }

    function setEmailCampaignStep(step) {
      state.emailCampaignStep = step;
      document.querySelectorAll("[data-campaign-step]").forEach((button) => button.classList.toggle("active", button.dataset.campaignStep === step));
      document.querySelectorAll("[data-campaign-step-panel]").forEach((panel) => {
        const active = panel.dataset.campaignStepPanel === step;
        panel.hidden = !active;
        panel.classList.toggle("active", active);
      });
      $("emailCampaignBackButton").hidden = step === "objective";
      $("emailCampaignNextButton").hidden = step === "review";
      $("emailCampaignSubmitButton").hidden = step !== "review";
      if (step === "review") void refreshEmailCampaignRecipients();
      if (step === "content") applyEmailCampaignTemplate($("emailCampaignTemplate")?.value || "announcement", { fillDefaults: false });
      updateEmailCampaignWorkspaceState();
      updateEmailCampaignContext();
    }

    async function saveEmailCampaign(event, action = "draft") {
      event?.preventDefault?.();
      const resultNode = $("emailCampaignResult");
      try {
        if (action === "send" && campaignTemplateDefinition().coupon && !$("emailCampaignCoupon")?.value) throw new Error("Selecione o cupom que será aplicado neste modelo.");
        if (action === "send" && campaignTemplateDefinition().catalog && !selectedCampaignCatalogItem()) throw new Error("Selecione o conteúdo do catálogo que será apresentado neste modelo.");
        const payload = emailCampaignPayload(action);
        if (action === "send") {
          const estimate = await api("/api/admin/email/campaigns/preview", { method: "POST", body: JSON.stringify(payload) });
          const count = Number(estimate.count || 0);
          if (count >= 500) {
            const confirmation = window.prompt(`Esta campanha será enviada para aproximadamente ${count.toLocaleString("pt-BR")} clientes. Mensagens já enviadas não poderão ser interrompidas. Digite ENVIAR para confirmar.`);
            if (confirmation !== "ENVIAR") return;
          }
        }
        const path = state.emailCampaignDraftId ? `/api/admin/email/campaigns/${encodeURIComponent(state.emailCampaignDraftId)}` : "/api/admin/email/campaigns";
        let result = await api(path, { method: state.emailCampaignDraftId ? "PUT" : "POST", body: JSON.stringify(payload) });
        if (action === "send" && state.emailCampaignDraftId) {
          result = await api(`/api/admin/email/campaigns/${encodeURIComponent(state.emailCampaignDraftId)}/send`, { method: "POST" });
        }
        state.emailCampaignDraftId = result.campaign?.id || state.emailCampaignDraftId;
        if (action === "send") {
          state.emailCampaignDraftId = "";
          state.emailCampaignIdempotencyKey = randomClientId("campanha");
          state.emailCampaignTemplateVariant = null;
          delete state.emailCampaignVariables.email_model_variant;
          clearCampaignCanonicalHtml();
        }
        if (resultNode) resultNode.textContent = action === "send" ? "Campanha colocada na fila de envio." : "Rascunho salvo.";
        await loadEmailCampaignHistory({ silent: true });
        showToast(action === "send" ? "Campanha enfileirada" : "Rascunho salvo");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    async function sendEmailCampaign(event) {
      event.preventDefault();
      await saveEmailCampaign(event, "send");
    }

    async function sendEmailCampaignTest() {
      try {
        const to = $("emailCampaignTestEmail").value.trim();
        if (!to) throw new Error("Informe o endereço que receberá o teste.");
        if (campaignTemplateDefinition().coupon && !$("emailCampaignCoupon")?.value) throw new Error("Selecione o cupom antes de enviar o teste.");
        if (campaignTemplateDefinition().catalog && !selectedCampaignCatalogItem()) throw new Error("Selecione o conteúdo do catálogo antes de enviar o teste.");
        await api("/api/admin/email/campaigns/test", { method: "POST", body: JSON.stringify({ ...emailCampaignPayload(), to }) });
        showToast("E-mail de teste enviado");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    function renderEmailCampaignControls() {
      const coupon = $("emailCampaignCoupon");
      if (coupon) {
        const current = coupon.value;
        coupon.innerHTML = `<option value="">Nenhum cupom</option>${(state.content?.promotions || []).filter((item) => item.couponCode && (item.active !== false || (item.autoManagedByCampaign && item.sourceCampaignId === state.emailCampaignDraftId))).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.couponCode)} · ${escapeHtml(item.title)}${item.active === false ? " · ativa no envio" : ""}</option>`).join("")}`;
        coupon.value = current;
      }
      const catalogSelects = [
        ["emailCampaignMovie", state.content?.movies || [], "Selecione um filme", (item) => item.title || "Filme sem título"],
        ["emailCampaignClubPlan", (state.content?.subscriptionPlans || []).filter((item) => item.active !== false), "Selecione um plano", (item) => `${item.name || "Plano"} · ${money(item.monthlyPrice || 0)}/mês`]
      ];
      catalogSelects.forEach(([id, items, placeholder, label]) => {
        const select = $(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(label(item))}</option>`).join("")}`;
        select.value = items.some((item) => String(item.id) === current) ? current : "";
      });
      const moviesSelect = $("emailCampaignMovies");
      if (moviesSelect) {
        const selectedIds = new Set(Array.from(moviesSelect.selectedOptions).map((option) => option.value));
        moviesSelect.innerHTML = (state.content?.movies || [])
          .filter((item) => item.status !== "hidden")
          .map((item) => `<option value="${escapeHtml(item.id)}" ${selectedIds.has(String(item.id)) ? "selected" : ""}>${escapeHtml(item.title || "Filme sem título")}</option>`)
          .join("");
      }
      const concessionSelect = $("emailCampaignConcessions");
      if (concessionSelect) {
        const selectedIds = new Set([
          ...state.emailCampaignConcessionIds,
          $("emailCampaignConcession")?.value || ""
        ].filter(Boolean).map(String));
        concessionSelect.innerHTML = (state.content?.concessions || [])
          .filter((item) => item.active !== false)
          .map((item) => `<option value="${escapeHtml(item.id)}" ${selectedIds.has(String(item.id)) ? "selected" : ""}>${escapeHtml(item.name || "Produto")} · ${escapeHtml(money(item.price || 0))}</option>`)
          .join("");
        state.emailCampaignConcessionIds = Array.from(concessionSelect.selectedOptions).map((option) => option.value);
      }
      const movieSelect = $("emailCampaignImageMovie");
      if (movieSelect) {
        const currentUrl = $("emailCampaignImageUrl")?.value || "";
        const currentMovie = movieSelect.value;
        movieSelect.innerHTML = `<option value="">Nenhum pôster selecionado</option>${(state.content?.movies || []).filter((movie) => movie.posterUrl).map((movie) => `<option value="${escapeHtml(movie.id)}">${escapeHtml(movie.title || "Filme sem título")}</option>`).join("")}`;
        movieSelect.value = currentMovie;
        if (!movieSelect.value && currentUrl) {
          const match = (state.content?.movies || []).find((movie) => movie.posterUrl === currentUrl);
          if (match) movieSelect.value = match.id;
        }
      }
      syncCampaignColorControls();
      const branding = state.content?.settings?.emailBranding || {};
      if ($("emailBrandName") && !$("emailBrandName").value) $("emailBrandName").value = branding.name || "Cine Cruzeiro";
      if ($("emailBrandLogoUrl") && !$('emailBrandLogoUrl').value) $("emailBrandLogoUrl").value = campaignEmailLogoUrl(branding.logoUrl);
      if ($("emailBrandFooter") && !$('emailBrandFooter').value) $("emailBrandFooter").value = branding.footer || "Mensagem automática do Cine Cruzeiro.";
      renderEmailBrandLogoPreview();
      applyEmailCampaignTemplate($("emailCampaignTemplate")?.value || "announcement", { fillDefaults: true });
      void refreshEmailCampaignRecipients().catch(() => null);
    }

    function syncCampaignImageMovieSelect() {
      const select = $("emailCampaignImageMovie");
      if (!select) return;
      const selectedMovie = (state.content?.movies || []).find((movie) => movie.id === select.value);
      if (!selectedMovie) {
        const imageUrl = $("emailCampaignImageUrl")?.value || "";
        const match = (state.content?.movies || []).find((movie) => movie.posterUrl && movie.posterUrl === imageUrl);
        if (match) select.value = match.id;
      }
    }

    return { emailCampaignPayload, ensureCampaignBrandLogoInTemplate, campaignHtmlWithRequiredBrand, campaignCanonicalHtmlWithEdits, clearCampaignCanonicalHtml, refreshEmailCampaignRecipients, campaignPreviewVariables, campaignAudienceLabel, campaignBuiltInVariables, syncCampaignTemplateResolution, scheduleEmailCampaignResolution, applyEmailCampaignTemplate, renderEmailCampaignCatalogSummary, interpolateCampaignPreview, renderEmailCampaignVariables, insertCampaignVariable, campaignSafeUrl, campaignEditorAssetUrl, campaignColor, renderEmailCampaignPreview, syncCampaignColorControls, bindCampaignColorControls, sanitizeCampaignHtmlPreview, renderEmailBrandLogoPreview, syncEmailCampaignMode, updateEmailCampaignWorkspaceState, updateEmailCampaignContext, setEmailCampaignStep, saveEmailCampaign, sendEmailCampaign, sendEmailCampaignTest, renderEmailCampaignControls, syncCampaignImageMovieSelect };
  }

  const api = Object.freeze({ createEmailCampaignEditor });
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.CineAdminModules ||= {}; root.CineAdminModules.emailCampaignEditor = api; }
})(globalThis);
