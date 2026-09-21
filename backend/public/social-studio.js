(function socialStudioModule() {
  "use strict";

  const root = document.getElementById("socialStudioRoot");
  if (!root) return;

  const basePath = (() => {
    const pathname = window.location.pathname || "";
    const adminIndex = pathname.indexOf("/admin");
    return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
  })();
  const state = {
    context: null,
    previewUrl: "",
    loading: false,
    resolving: false,
    previewing: false,
    generating: false,
    initialized: false,
    resolveVersion: 0,
    previewVersion: 0,
    historyPage: 1,
    historyPageSize: 6
  };

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function assetUrl(value = "") {
    const url = String(value || "").trim();
    if (!url || /^(blob:|data:|https?:)/i.test(url)) return url;
    if (basePath && (url === basePath || url.startsWith(`${basePath}/`))) return url;
    return `${basePath}${url.startsWith("/") ? url : `/${url}`}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${basePath}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || data.error || "Não foi possível concluir a operação.");
    return data;
  }

  async function requestImage(path, payload) {
    const response = await fetch(`${basePath}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || data.error || "Não foi possível gerar a prévia.");
    }
    return response.blob();
  }

  function notify(message, type = "ok") {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else {
      const status = document.getElementById("socialStudioStatus");
      if (status) {
        status.textContent = message;
        status.dataset.state = type;
      }
    }
  }

  function templateIcon(id) {
    const icons = {
      "movie-price": '<path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/>',
      "movie-highlight": '<path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
      "movie-premiere": '<path d="M4 5h16v14H4z"/><path d="M8 5v14M16 5v14M4 9h4M16 9h4"/>',
      "online-ticket": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      "concession-combo": '<path d="M7 8h10l-1 13H8z"/><path d="M9 8V5h6v3M7 12h10"/>',
      "cinema-club": '<path d="M12 3v18M17 6H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[id] || icons["movie-price"]}</svg>`;
  }

  function renderShell() {
    root.innerHTML = `
      <section class="social-studio-intro">
        <div>
          <h2>Social Studio</h2>
          <p>Transforme a programação e as ofertas já cadastradas em artes prontas para as redes sociais.</p>
        </div>
        <div class="social-studio-brand" id="socialStudioBrand"></div>
      </section>
      <div class="social-studio-workspace">
        <form id="socialStudioForm" class="surface social-studio-editor">
          <div class="social-studio-section-head">
            <div><h3>Composição</h3><p>Escolha o modelo e ajuste apenas o que precisar.</p></div>
            <span id="socialStudioAutosaveState">Dados reais do painel</span>
          </div>
          <fieldset class="social-template-fieldset">
            <legend>Modelo</legend>
            <div id="socialStudioTemplates" class="social-template-grid"></div>
          </fieldset>
          <div class="social-studio-controls-grid">
            <label>Formato<select id="socialStudioFormat"></select></label>
            <label>Arquivo<select id="socialStudioOutput"><option value="png">PNG em alta qualidade</option><option value="jpg">JPG em alta qualidade</option></select></label>
            <label id="socialStudioMovieField">Filme<select id="socialStudioMovie"></select></label>
            <label id="socialStudioConcessionField" hidden>Produto ou combo<select id="socialStudioConcession"></select></label>
            <label id="socialStudioClubField" hidden>Plano do clube<select id="socialStudioClub"></select></label>
          </div>
          <div class="social-studio-copy-grid">
            <label>Título<input id="socialStudioTitle" maxlength="160" /></label>
            <label>Chamada<input id="socialStudioSubtitle" maxlength="120" /></label>
            <label>Preço ou condição<input id="socialStudioPrice" maxlength="60" /></label>
            <label>Data<input id="socialStudioDate" maxlength="60" /></label>
            <label class="wide">Texto auxiliar<textarea id="socialStudioAuxiliary" rows="3" maxlength="260"></textarea></label>
            <label>Botão visual<input id="socialStudioCta" maxlength="60" /></label>
          </div>
          <section class="social-studio-media-control" aria-labelledby="socialStudioMediaTitle">
            <div><h4 id="socialStudioMediaTitle">Imagem</h4><p>O pôster, backdrop ou produto é preenchido automaticamente. Um upload substitui essa escolha.</p></div>
            <div class="social-studio-upload-row">
              <label class="upload-field compact">Usar imagem personalizada<input id="socialStudioImageUpload" type="file" accept="image/jpeg,image/png,image/webp" /><span>JPG, PNG ou WebP de até 5 MB.</span></label>
              <div id="socialStudioImageState" class="social-studio-image-state">Imagem automática</div>
              <button id="socialStudioImageClear" class="ghost-button" type="button" hidden>Voltar à imagem automática</button>
            </div>
            <input id="socialStudioImageUrl" type="hidden" />
          </section>
          <label class="social-studio-caption">Sugestão de legenda<textarea id="socialStudioCaption" rows="7" maxlength="1800"></textarea></label>
          <div class="social-studio-actions">
            <button id="socialStudioPreviewButton" class="ghost-button" type="button">Atualizar prévia</button>
            <button id="socialStudioGenerateButton" class="primary-button" type="submit">Gerar e salvar arte</button>
          </div>
          <p id="socialStudioStatus" class="social-studio-status" role="status"></p>
        </form>
        <section class="surface social-studio-preview" aria-labelledby="socialStudioPreviewTitle">
          <div class="social-studio-preview-head">
            <div><h3 id="socialStudioPreviewTitle">Prévia</h3><p id="socialStudioPreviewMeta">Resolução final</p></div>
            <button id="socialStudioPreviewDownload" class="ghost-button" type="button" disabled>Baixar prévia</button>
          </div>
          <div id="socialStudioPreviewStage" class="social-studio-preview-stage">
            <div class="social-studio-preview-empty"><span>Selecione um modelo</span><small>A arte aparecerá aqui sem perder a proporção.</small></div>
          </div>
        </section>
      </div>
      <section class="social-studio-history" aria-labelledby="socialStudioHistoryTitle">
        <div class="social-studio-history-head">
          <div><h3 id="socialStudioHistoryTitle">Posts recentes</h3><p>Reabra uma composição, baixe o arquivo final ou use a arte como base.</p></div>
          <span id="socialStudioHistoryCount"></span>
        </div>
        <div id="socialStudioHistoryGrid" class="social-studio-history-grid"></div>
        <div id="socialStudioHistoryPager" class="social-studio-history-pager"></div>
      </section>`;
  }

  function fillSelect(id, items, emptyLabel, label) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = items.length
      ? items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(label(item))}</option>`).join("")
      : `<option value="">${escapeHtml(emptyLabel)}</option>`;
  }

  function currentTemplateId() {
    return document.querySelector("[name='socialStudioTemplate']:checked")?.value || "movie-price";
  }

  function renderContext() {
    const context = state.context;
    document.getElementById("socialStudioBrand").innerHTML = `${context.brand.logoUrl ? `<img src="${escapeHtml(assetUrl(context.brand.logoUrl))}" alt="" />` : ""}<span><strong>${escapeHtml(context.brand.name)}</strong><small>Identidade aplicada automaticamente</small></span>`;
    document.getElementById("socialStudioTemplates").innerHTML = context.templates.map((template, index) => `
      <label class="social-template-option">
        <input type="radio" name="socialStudioTemplate" value="${escapeHtml(template.id)}" ${index === 0 ? "checked" : ""} />
        <span>${templateIcon(template.id)}<strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.type === "movie" ? "Filme e programação" : template.type === "concession" ? "Bomboniere" : template.type === "club" ? "Clube" : "Institucional")}</small></span>
      </label>`).join("");
    fillSelect("socialStudioFormat", context.formats, "Nenhum formato", (item) => `${item.name} · ${item.width} × ${item.height}`);
    fillSelect("socialStudioMovie", context.movies, "Nenhum filme disponível", (item) => item.title || "Filme sem título");
    fillSelect("socialStudioConcession", context.concessions, "Nenhum produto disponível", (item) => item.name || "Produto sem nome");
    fillSelect("socialStudioClub", context.clubPlans, "Nenhum plano disponível", (item) => item.name || "Plano sem nome");
    if (context.recommendedMovieId) document.getElementById("socialStudioMovie").value = context.recommendedMovieId;
    applyCapabilities();
    updateEntityVisibility();
    renderHistory();
  }

  function applyCapabilities() {
    const canCreate = state.context?.capabilities?.create !== false;
    document.querySelectorAll("#socialStudioForm input, #socialStudioForm select, #socialStudioForm textarea, #socialStudioForm button").forEach((control) => {
      control.disabled = !canCreate;
    });
    const stateLabel = document.getElementById("socialStudioAutosaveState");
    if (!canCreate && stateLabel) stateLabel.textContent = "Somente visualização";
  }

  function updateEntityVisibility() {
    const templateId = currentTemplateId();
    document.getElementById("socialStudioMovieField").hidden = !templateId.startsWith("movie-");
    document.getElementById("socialStudioConcessionField").hidden = templateId !== "concession-combo";
    document.getElementById("socialStudioClubField").hidden = templateId !== "cinema-club";
  }

  function payload() {
    return {
      templateId: currentTemplateId(),
      formatId: document.getElementById("socialStudioFormat").value,
      outputType: document.getElementById("socialStudioOutput").value,
      movieId: document.getElementById("socialStudioMovie").value,
      concessionId: document.getElementById("socialStudioConcession").value,
      clubPlanId: document.getElementById("socialStudioClub").value,
      title: document.getElementById("socialStudioTitle").value,
      subtitle: document.getElementById("socialStudioSubtitle").value,
      price: document.getElementById("socialStudioPrice").value,
      date: document.getElementById("socialStudioDate").value,
      auxiliaryText: document.getElementById("socialStudioAuxiliary").value,
      cta: document.getElementById("socialStudioCta").value,
      imageUrl: document.getElementById("socialStudioImageUrl").value,
      caption: document.getElementById("socialStudioCaption").value
    };
  }

  function applyDraft(draft, caption = "") {
    const fields = {
      socialStudioFormat: draft.formatId,
      socialStudioOutput: draft.outputType,
      socialStudioMovie: draft.movieId,
      socialStudioConcession: draft.concessionId,
      socialStudioClub: draft.clubPlanId,
      socialStudioTitle: draft.title,
      socialStudioSubtitle: draft.subtitle,
      socialStudioPrice: draft.price,
      socialStudioDate: draft.date,
      socialStudioAuxiliary: draft.auxiliaryText,
      socialStudioCta: draft.cta,
      socialStudioImageUrl: draft.imageUrl,
      socialStudioCaption: caption || draft.caption
    };
    Object.entries(fields).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field && value !== undefined) field.value = value || "";
    });
    document.getElementById("socialStudioImageState").textContent = draft.imageUrl ? "Imagem personalizada" : "Imagem automática";
    document.getElementById("socialStudioImageClear").hidden = !draft.imageUrl;
    updatePreviewMeta();
  }

  async function resolveDefaults(options = {}) {
    const version = ++state.resolveVersion;
    state.resolving = true;
    setStatus("Preenchendo com os dados atuais...", "loading");
    try {
      const base = payload();
      if (options.resetCopy !== false) {
        ["title", "subtitle", "price", "date", "auxiliaryText", "cta", "caption"].forEach((key) => { base[key] = undefined; });
      }
      const result = await request("/api/admin/social-studio/resolve", { method: "POST", body: JSON.stringify(base) });
      if (version !== state.resolveVersion) return;
      applyDraft(result.draft, result.caption);
      setStatus("Campos atualizados com os dados do painel.", "ok");
      await updatePreview();
    } catch (error) {
      if (version === state.resolveVersion) setStatus(error.message, "error");
    } finally {
      if (version === state.resolveVersion) state.resolving = false;
    }
  }

  function setStatus(message, kind = "") {
    const status = document.getElementById("socialStudioStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  }

  function updatePreviewMeta() {
    const format = state.context?.formats?.find((item) => item.id === document.getElementById("socialStudioFormat")?.value);
    const output = document.getElementById("socialStudioOutput")?.value?.toUpperCase() || "PNG";
    if (format) document.getElementById("socialStudioPreviewMeta").textContent = `${format.width} × ${format.height} px · ${output}`;
    const stage = document.getElementById("socialStudioPreviewStage");
    if (stage && format) stage.style.setProperty("--social-preview-ratio", `${format.width} / ${format.height}`);
  }

  async function updatePreview() {
    if (state.context?.capabilities?.create === false) return;
    const version = ++state.previewVersion;
    state.previewing = true;
    const button = document.getElementById("socialStudioPreviewButton");
    if (button) button.disabled = true;
    setStatus("Renderizando prévia em alta resolução...", "loading");
    try {
      const blob = await requestImage("/api/admin/social-studio/preview", payload());
      if (version !== state.previewVersion) return;
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = URL.createObjectURL(blob);
      document.getElementById("socialStudioPreviewStage").innerHTML = `<img src="${state.previewUrl}" alt="Prévia da arte social" />`;
      document.getElementById("socialStudioPreviewDownload").disabled = false;
      setStatus("Prévia atualizada. O arquivo final manterá exatamente essa proporção.", "ok");
    } catch (error) {
      if (version === state.previewVersion) setStatus(error.message, "error");
    } finally {
      if (version === state.previewVersion) {
        state.previewing = false;
        if (button) button.disabled = state.context?.capabilities?.create === false;
      }
    }
  }

  async function generatePost(event) {
    event.preventDefault();
    if (state.generating) return;
    state.generating = true;
    const button = document.getElementById("socialStudioGenerateButton");
    button.disabled = true;
    button.textContent = "Gerando arquivo...";
    setStatus("Gerando e salvando a arte final...", "loading");
    try {
      const result = await request("/api/admin/social-studio/posts", { method: "POST", body: JSON.stringify(payload()) });
      state.context.history = result.history || [result.post, ...(state.context.history || [])];
      state.historyPage = 1;
      renderHistory();
      setStatus("Arte criada e adicionada ao histórico.", "ok");
      notify("Arte social gerada com sucesso.");
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    } finally {
      state.generating = false;
      button.disabled = state.context?.capabilities?.create === false;
      button.textContent = "Gerar e salvar arte";
    }
  }

  function downloadPreview() {
    if (!state.previewUrl) return;
    const format = document.getElementById("socialStudioFormat").value;
    const extension = document.getElementById("socialStudioOutput").value === "jpg" ? "jpg" : "png";
    const link = document.createElement("a");
    link.href = state.previewUrl;
    link.download = `previa-${format}.${extension}`;
    link.click();
  }

  async function uploadCustomImage(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
      notify("Use uma imagem JPG, PNG ou WebP de até 5 MB.", "error");
      return;
    }
    setStatus("Enviando imagem personalizada...", "loading");
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
      reader.readAsDataURL(file);
    });
    const result = await request("/api/admin/social-studio/uploads", {
      method: "POST",
      body: JSON.stringify({ data, filename: file.name, contentType: file.type })
    });
    document.getElementById("socialStudioImageUrl").value = result.url;
    document.getElementById("socialStudioImageState").textContent = file.name;
    document.getElementById("socialStudioImageClear").hidden = false;
    await updatePreview();
  }

  function renderHistory() {
    const history = state.context?.history || [];
    const totalPages = Math.max(1, Math.ceil(history.length / state.historyPageSize));
    state.historyPage = Math.min(Math.max(1, state.historyPage), totalPages);
    const start = (state.historyPage - 1) * state.historyPageSize;
    const pageItems = history.slice(start, start + state.historyPageSize);
    document.getElementById("socialStudioHistoryCount").textContent = `${history.length} arte${history.length === 1 ? "" : "s"}`;
    document.getElementById("socialStudioHistoryGrid").innerHTML = pageItems.length ? pageItems.map((post) => `
      <article class="social-history-item">
        <button class="social-history-preview" type="button" data-social-action="view" data-social-id="${escapeHtml(post.id)}" aria-label="Visualizar ${escapeHtml(post.title)}">
          <img src="${escapeHtml(assetUrl(post.imageUrl))}" alt="" loading="lazy" />
        </button>
        <div class="social-history-copy">
          <strong>${escapeHtml(post.title || post.templateName)}</strong>
          <span>${escapeHtml(post.templateName)} · ${escapeHtml(post.formatName)}</span>
          <time>${post.createdAt ? new Date(post.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}</time>
        </div>
        <div class="social-history-actions">
          <a class="ghost-button" href="${basePath}/api/admin/social-studio/posts/${encodeURIComponent(post.id)}/download">Baixar</a>
          ${state.context.capabilities?.create !== false ? `<button class="ghost-button" type="button" data-social-action="duplicate" data-social-id="${escapeHtml(post.id)}">Duplicar</button>` : ""}
          ${state.context.capabilities?.delete ? `<button class="danger-button" type="button" data-social-action="delete" data-social-id="${escapeHtml(post.id)}">Excluir</button>` : ""}
        </div>
      </article>`).join("") : `<div class="social-studio-empty"><strong>Nenhuma arte criada</strong><span>A primeira composição salva aparecerá aqui com seu arquivo e configuração.</span></div>`;
    document.getElementById("socialStudioHistoryPager").innerHTML = history.length > state.historyPageSize ? `
      <button class="ghost-button" type="button" data-social-page="${state.historyPage - 1}" ${state.historyPage <= 1 ? "disabled" : ""}>Anterior</button>
      <span>Página ${state.historyPage} de ${totalPages}</span>
      <button class="ghost-button" type="button" data-social-page="${state.historyPage + 1}" ${state.historyPage >= totalPages ? "disabled" : ""}>Próxima</button>` : "";
  }

  function findPost(id) {
    return (state.context?.history || []).find((item) => String(item.id) === String(id));
  }

  async function handleHistoryAction(button) {
    const post = findPost(button.dataset.socialId);
    if (!post) return;
    if (button.dataset.socialAction === "view") {
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = assetUrl(post.imageUrl);
      document.getElementById("socialStudioPreviewStage").innerHTML = `<img src="${escapeHtml(state.previewUrl)}" alt="${escapeHtml(post.title)}" />`;
      document.getElementById("socialStudioPreviewMeta").textContent = `${post.width} × ${post.height} px · ${String(post.outputType || "png").toUpperCase()}`;
      document.querySelector(".social-studio-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (button.dataset.socialAction === "duplicate") {
      const payloadData = post.payload || {};
      const template = document.querySelector(`[name='socialStudioTemplate'][value='${CSS.escape(payloadData.templateId || post.templateId)}']`);
      if (template) template.checked = true;
      applyDraft({ ...payloadData, formatId: payloadData.formatId || post.formatId, outputType: payloadData.outputType || post.outputType }, post.caption || "");
      updateEntityVisibility();
      await updatePreview();
      document.getElementById("socialStudioForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
      notify("Arte duplicada como nova composição.");
      return;
    }
    if (button.dataset.socialAction === "delete") {
      if (!window.confirm(`Excluir a arte "${post.title}" e remover o arquivo?`)) return;
      button.disabled = true;
      try {
        const result = await request(`/api/admin/social-studio/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
        state.context.history = result.history || state.context.history.filter((item) => item.id !== post.id);
        renderHistory();
        notify("Arte excluída do histórico.");
      } catch (error) {
        button.disabled = false;
        notify(error.message, "error");
      }
    }
  }

  function bindEvents() {
    document.getElementById("socialStudioForm").addEventListener("submit", generatePost);
    document.getElementById("socialStudioPreviewButton").addEventListener("click", updatePreview);
    document.getElementById("socialStudioPreviewDownload").addEventListener("click", downloadPreview);
    document.getElementById("socialStudioTemplates").addEventListener("change", async () => {
      updateEntityVisibility();
      await resolveDefaults({ resetCopy: true });
    });
    ["socialStudioMovie", "socialStudioConcession", "socialStudioClub"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => resolveDefaults({ resetCopy: true }));
    });
    ["socialStudioFormat", "socialStudioOutput"].forEach((id) => {
      document.getElementById(id).addEventListener("change", async () => {
        updatePreviewMeta();
        await updatePreview();
      });
    });
    document.getElementById("socialStudioImageUpload").addEventListener("change", (event) => {
      uploadCustomImage(event.target.files?.[0]).catch((error) => notify(error.message, "error"));
    });
    document.getElementById("socialStudioImageClear").addEventListener("click", async () => {
      document.getElementById("socialStudioImageUrl").value = "";
      document.getElementById("socialStudioImageUpload").value = "";
      document.getElementById("socialStudioImageState").textContent = "Imagem automática";
      document.getElementById("socialStudioImageClear").hidden = true;
      await updatePreview();
    });
    document.getElementById("socialStudioHistoryGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-action]");
      if (button) handleHistoryAction(button);
    });
    document.getElementById("socialStudioHistoryPager").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-page]");
      if (!button || button.disabled) return;
      state.historyPage = Number(button.dataset.socialPage || 1);
      renderHistory();
    });
  }

  async function init() {
    if (state.loading || state.initialized) return;
    state.loading = true;
    root.innerHTML = `<div class="social-studio-loading"><span class="loading-spinner"></span><strong>Preparando o Social Studio</strong><small>Carregando programação, produtos e identidade do cinema.</small></div>`;
    try {
      state.context = await request("/api/admin/social-studio/context");
      renderShell();
      renderContext();
      bindEvents();
      state.initialized = true;
      await resolveDefaults({ resetCopy: true });
    } catch (error) {
      root.innerHTML = `<div class="social-studio-load-error"><strong>Não foi possível abrir o Social Studio</strong><span>${escapeHtml(error.message)}</span><button id="socialStudioRetry" class="primary-button" type="button">Tentar novamente</button></div>`;
      document.getElementById("socialStudioRetry")?.addEventListener("click", () => { state.loading = false; init(); });
    } finally {
      state.loading = false;
    }
  }

  const socialTab = document.querySelector('[data-admin-tablist="marketing"] [data-admin-tab="social"]');
  socialTab?.addEventListener("click", init, { once: true });
  if (socialTab?.classList.contains("active")) init();
})();
