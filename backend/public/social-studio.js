(function socialStudioModule() {
  "use strict";

  const root = document.getElementById("socialStudioRoot");
  if (!root) return;

  const basePath = (() => {
    const pathname = window.location.pathname || "";
    const adminIndex = pathname.indexOf("/admin");
    return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
  })();
  const draftKey = "cinecruzeiro.socialStudio.draft.v2";
  const state = {
    context: null,
    previewUrl: "",
    previewBlob: null,
    previewCache: new Map(),
    previewTimer: null,
    previewAbort: null,
    autosaveTimer: null,
    loading: false,
    resolving: false,
    previewing: false,
    generating: false,
    initialized: false,
    resolveVersion: 0,
    previewVersion: 0,
    historyPage: 1,
    historyPageSize: 6,
    readyCollection: "catalog",
    notices: [],
    previewZoom: 86
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

  async function requestImage(path, body, signal) {
    const response = await fetch(`${basePath}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || data.error || "Não foi possível gerar a prévia.");
    }
    return response.blob();
  }

  function notify(message, type = "ok") {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else setStatus(message, type);
  }

  function currentTemplate() {
    const id = document.querySelector("[name='socialStudioTemplate']:checked")?.value || "movie-price";
    return state.context?.templates?.find((template) => template.id === id) || state.context?.templates?.[0] || null;
  }

  function currentFormat() {
    const id = document.getElementById("socialStudioFormat")?.value;
    return state.context?.formats?.find((format) => format.id === id) || state.context?.formats?.[0] || null;
  }

  function renderShell() {
    root.innerHTML = `
      <form id="socialStudioForm" class="social-studio-shell">
        <header class="social-studio-toolbar">
          <div class="social-studio-heading">
            <h2>Social Studio</h2>
            <p>Crie campanhas com os filmes, produtos e planos já cadastrados.</p>
          </div>
          <div class="social-studio-toolbar-actions">
            <span id="socialStudioAutosaveState" class="social-save-state" data-state="idle">Rascunho local</span>
            <button id="socialStudioPreviewButton" class="ghost-button" type="button" data-requires-create>Atualizar prévia</button>
            <button id="socialStudioCampaignButton" class="ghost-button" type="button" data-requires-create>Gerar campanha</button>
            <button id="socialStudioGenerateButton" class="primary-button" type="submit" data-requires-create>Gerar arte</button>
          </div>
        </header>

        <section class="social-ready-library" aria-labelledby="socialStudioReadyTitle">
          <header class="social-ready-head">
            <div>
              <h3 id="socialStudioReadyTitle">Posts prontos para publicar</h3>
              <p>Textos, imagens e legendas já organizados. Abra para ajustar ou gere a arte final em um clique.</p>
            </div>
            <div id="socialStudioReadyFilters" class="social-ready-filters" role="tablist" aria-label="Coleções de posts prontos"></div>
          </header>
          <div id="socialStudioReadyGrid" class="social-ready-grid"></div>
        </section>

        <div class="social-studio-workspace">
          <aside class="social-template-library" aria-labelledby="socialStudioTemplateTitle">
            <div class="social-pane-heading">
              <h3 id="socialStudioTemplateTitle">O que divulgar</h3>
              <p>Escolha uma composição profissional.</p>
            </div>
            <div id="socialStudioTemplates" class="social-template-groups"></div>
            <div id="socialStudioBrand" class="social-studio-brand"></div>
          </aside>

          <main class="social-preview-pane" aria-labelledby="socialStudioPreviewTitle">
            <div class="social-preview-toolbar">
              <div>
                <h3 id="socialStudioPreviewTitle">Prévia da campanha</h3>
                <p id="socialStudioPreviewMeta">Instagram Feed · 1080 × 1350</p>
              </div>
              <label class="social-preview-zoom">Zoom
                <input id="socialStudioPreviewZoom" type="range" min="58" max="100" step="2" value="86" />
                <output id="socialStudioPreviewZoomValue">86%</output>
              </label>
            </div>
            <div id="socialStudioPreviewCanvas" class="social-preview-canvas">
              <div id="socialStudioPreviewStage" class="social-studio-preview-stage">
                <div class="social-studio-preview-empty">
                  <strong>Preparando sua primeira composição</strong>
                  <small>A prévia será atualizada automaticamente.</small>
                </div>
                <div id="socialStudioSafeArea" class="social-story-safe-area" hidden aria-hidden="true"></div>
              </div>
            </div>
            <div class="social-preview-footer">
              <div id="socialStudioNotices" class="social-studio-notices" aria-live="polite"></div>
              <button id="socialStudioPreviewDownload" class="ghost-button" type="button" disabled>Baixar prévia</button>
            </div>
            <p id="socialStudioStatus" class="social-studio-status" role="status"></p>
          </main>

          <aside class="social-properties-pane">
            <div class="social-editor-tabs" role="tablist" aria-label="Edição da campanha">
              <button class="active" type="button" role="tab" aria-selected="true" data-social-editor-tab="art">Arte</button>
              <button type="button" role="tab" aria-selected="false" data-social-editor-tab="caption">Legenda</button>
            </div>

            <div id="socialStudioArtPanel" class="social-editor-panel">
              <details class="social-property-section" open>
                <summary>Conteúdo</summary>
                <div class="social-property-body">
                  <label id="socialStudioMovieField" data-social-field="movie">Filme<select id="socialStudioMovie" data-requires-create></select></label>
                  <label id="socialStudioConcessionField" data-social-field="concession">Produto ou combo<select id="socialStudioConcession" data-requires-create></select></label>
                  <label id="socialStudioClubField" data-social-field="clubPlan">Plano do clube<select id="socialStudioClub" data-requires-create></select></label>
                  <label data-social-field="title">Título<input id="socialStudioTitle" maxlength="160" data-requires-create /></label>
                  <label data-social-field="subtitle">Chamada<input id="socialStudioSubtitle" maxlength="120" data-requires-create /></label>
                  <label data-social-field="date">Data<input id="socialStudioDate" maxlength="60" data-requires-create /></label>
                  <label data-social-field="auxiliaryText">Texto auxiliar<textarea id="socialStudioAuxiliary" rows="3" maxlength="260" data-requires-create></textarea></label>
                  <label data-social-field="cta">Chamada do botão<input id="socialStudioCta" maxlength="60" data-requires-create /></label>
                </div>
              </details>

              <details class="social-property-section" data-social-field="price">
                <summary>Preço e promoção</summary>
                <div class="social-property-body">
                  <label>Preço ou condição<input id="socialStudioPrice" maxlength="60" data-requires-create /></label>
                  <p class="social-field-help">Sem preço cadastrado, o layout muda para uma chamada de sessões.</p>
                </div>
              </details>

              <details class="social-property-section" data-social-field="image">
                <summary>Imagem principal</summary>
                <div class="social-property-body">
                  <fieldset class="social-choice-fieldset">
                    <legend>Origem</legend>
                    <div class="social-segmented" id="socialStudioImageModes">
                      <label><input type="radio" name="socialStudioImageMode" value="automatic" checked data-requires-create /><span>Automático</span></label>
                      <label><input type="radio" name="socialStudioImageMode" value="backdrop" data-requires-create /><span>Backdrop</span></label>
                      <label><input type="radio" name="socialStudioImageMode" value="poster" data-requires-create /><span>Pôster</span></label>
                      <label><input type="radio" name="socialStudioImageMode" value="upload" data-requires-create /><span>Upload</span></label>
                    </div>
                  </fieldset>
                  <label class="upload-field">Substituir nesta arte
                    <input id="socialStudioImageUpload" type="file" accept="image/jpeg,image/png,image/webp" data-requires-create />
                    <span>JPG, PNG ou WebP de até 5 MB.</span>
                  </label>
                  <div class="social-image-file">
                    <span id="socialStudioImageState">Imagem automática</span>
                    <button id="socialStudioImageClear" class="ghost-button" type="button" hidden data-requires-create>Remover upload</button>
                  </div>
                  <input id="socialStudioImageUrl" type="hidden" />
                  <label>Enquadramento
                    <select id="socialStudioImagePreset" data-requires-create>
                      <option value="automatic">Automático</option><option value="center">Centro</option>
                      <option value="left">Esquerda</option><option value="right">Direita</option>
                      <option value="top">Topo</option><option value="bottom">Inferior</option>
                    </select>
                  </label>
                  <div class="social-range-row">
                    <label>Zoom da imagem <output id="socialStudioImageScaleValue">100%</output><input id="socialStudioImageScale" type="range" min="100" max="180" step="2" value="100" data-requires-create /></label>
                    <label>Posição horizontal <output id="socialStudioImageXValue">50%</output><input id="socialStudioImageX" type="range" min="0" max="100" step="1" value="50" data-requires-create /></label>
                    <label>Posição vertical <output id="socialStudioImageYValue">50%</output><input id="socialStudioImageY" type="range" min="0" max="100" step="1" value="50" data-requires-create /></label>
                  </div>
                </div>
              </details>

              <details class="social-property-section" data-social-field="advanced">
                <summary>Identidade visual</summary>
                <div class="social-property-body">
                  <fieldset class="social-choice-fieldset">
                    <legend>Estilo</legend>
                    <div id="socialStudioStyles" class="social-style-grid"></div>
                  </fieldset>
                  <label>Paleta
                    <select id="socialStudioPalette" data-requires-create>
                      <option value="automatic">Automática pelo filme</option>
                      <option value="brand">Somente identidade do cinema</option>
                      <option value="dynamic">Cores do filme</option>
                    </select>
                  </label>
                  <fieldset class="social-choice-fieldset">
                    <legend>Assinatura do pôster</legend>
                    <div id="socialStudioSignatures" class="social-signature-grid"></div>
                  </fieldset>
                  <label>Posição da assinatura
                    <select id="socialStudioSignaturePosition" data-requires-create>
                      <option value="automatic">Automática pelo modelo</option>
                      <option value="top-left">Superior esquerda</option>
                      <option value="top-center">Superior central</option>
                      <option value="top-right">Superior direita</option>
                      <option value="bottom-right">Inferior direita</option>
                    </select>
                  </label>
                  <div class="social-range-row">
                    <label>Tamanho da assinatura <output id="socialStudioSignatureScaleValue">100%</output><input id="socialStudioSignatureScale" type="range" min="70" max="135" step="5" value="100" data-requires-create /></label>
                  </div>
                  <div class="social-brand-note"><span id="socialStudioBrandSwatches"></span><p>A logo, o botão e os detalhes institucionais permanecem fiéis ao cinema.</p></div>
                </div>
              </details>

              <details class="social-property-section" data-social-field="advanced">
                <summary>Configurações avançadas</summary>
                <div class="social-property-body">
                  <label>Posição do conteúdo
                    <select id="socialStudioContentPosition" data-requires-create><option value="bottom">Inferior</option><option value="center">Centro</option><option value="top">Topo</option></select>
                  </label>
                  <label>Alinhamento
                    <select id="socialStudioAlignment" data-requires-create><option value="left">Esquerda</option><option value="center">Centralizado</option></select>
                  </label>
                  <div class="social-range-row">
                    <label>Intensidade do overlay <output id="socialStudioOverlayValue">72%</output><input id="socialStudioOverlay" type="range" min="20" max="100" step="2" value="72" data-requires-create /></label>
                    <label>Escurecimento <output id="socialStudioDarkenValue">8%</output><input id="socialStudioDarken" type="range" min="0" max="55" step="1" value="8" data-requires-create /></label>
                    <label>Desfoque <output id="socialStudioBlurValue">0</output><input id="socialStudioBlur" type="range" min="0" max="16" step="1" value="0" data-requires-create /></label>
                    <label>Tamanho do título <output id="socialStudioTitleScaleValue">100%</output><input id="socialStudioTitleScale" type="range" min="80" max="125" step="1" value="100" data-requires-create /></label>
                  </div>
                </div>
              </details>

              <details class="social-property-section">
                <summary>Arquivo final</summary>
                <div class="social-property-body social-output-grid">
                  <label>Formato<select id="socialStudioFormat" data-requires-create></select></label>
                  <label>Arquivo<select id="socialStudioOutput" data-requires-create><option value="png">PNG em alta qualidade</option><option value="jpg">JPG em alta qualidade</option></select></label>
                </div>
              </details>
            </div>

            <div id="socialStudioCaptionPanel" class="social-editor-panel" hidden>
              <div class="social-caption-editor">
                <div><h3>Legenda sugerida</h3><p>Revise o texto antes de publicar na rede social.</p></div>
                <textarea id="socialStudioCaption" rows="14" maxlength="1800" data-requires-create></textarea>
                <button id="socialStudioCopyCaption" class="ghost-button" type="button">Copiar legenda</button>
              </div>
            </div>
          </aside>
        </div>
      </form>

      <section class="social-studio-history" aria-labelledby="socialStudioHistoryTitle">
        <div class="social-studio-history-head">
          <div><h3 id="socialStudioHistoryTitle">Campanhas recentes</h3><p>Visualize, duplique, baixe ou exclua artes já geradas.</p></div>
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

  function templateThumb(template) {
    const movie = state.context?.movies?.find((item) => String(item.id) === String(document.getElementById("socialStudioMovie")?.value))
      || state.context?.movies?.[0];
    const concession = state.context?.concessions?.[0];
    const image = template.type === "movie"
      ? movie?.backdropUrl || movie?.posterUrl
      : template.type === "concession" ? concession?.imageUrl : "";
    const price = template.id === "movie-price" || template.type === "concession";
    return `<span class="social-template-thumb social-template-thumb--${escapeHtml(template.type)}">
      ${image ? `<img src="${escapeHtml(assetUrl(image))}" alt="" loading="lazy" />` : ""}
      <i aria-hidden="true"></i>
      <b>${escapeHtml(template.id === "movie-premiere" ? "ESTREIA" : template.id === "online-ticket" ? "COMPRE ONLINE" : template.type === "club" ? "CLUBE" : "EM CARTAZ")}</b>
      <em>${price ? "R$ 14" : "GARANTA SEU LUGAR"}</em>
    </span>`;
  }

  function renderTemplates() {
    const groups = new Map();
    state.context.templates.forEach((template) => {
      const category = template.category || "OUTROS";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(template);
    });
    let index = 0;
    document.getElementById("socialStudioTemplates").innerHTML = [...groups.entries()].map(([category, templates]) => `
      <section class="social-template-group">
        <h4>${escapeHtml(category)}</h4>
        <div class="social-template-grid">
          ${templates.map((template) => {
            const checked = index++ === 0 ? "checked" : "";
            return `<label class="social-template-option">
              <input type="radio" name="socialStudioTemplate" value="${escapeHtml(template.id)}" ${checked} data-requires-create />
              <span>${templateThumb(template)}<strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.description || "")}</small></span>
            </label>`;
          }).join("")}
        </div>
      </section>`).join("");
  }

  function renderStyles(selected = "") {
    const template = currentTemplate();
    const allowed = template?.styles || ["clean"];
    const styles = (state.context.styles || []).filter((style) => allowed.includes(style.id));
    document.getElementById("socialStudioStyles").innerHTML = styles.map((style, index) => `
      <label><input type="radio" name="socialStudioStyle" value="${escapeHtml(style.id)}" ${style.id === selected || (!selected && index === 0) ? "checked" : ""} data-requires-create /><span>${escapeHtml(style.name)}</span></label>`).join("");
  }

  function renderSignatures(selected = "automatic") {
    const brand = state.context?.brand || {};
    const signatures = state.context?.signatures || [];
    const container = document.getElementById("socialStudioSignatures");
    if (!container) return;
    container.innerHTML = signatures.map((signature) => {
      const source = signature.id === "classic" ? brand.logoUrl : signature.imageUrl;
      const preview = source
        ? `<img src="${escapeHtml(assetUrl(source))}" alt="" loading="lazy" />`
        : `<span aria-hidden="true">${signature.id === "automatic" ? "AUTO" : "—"}</span>`;
      return `<label title="${escapeHtml(signature.description || signature.name)}">
        <input type="radio" name="socialStudioSignature" value="${escapeHtml(signature.id)}" ${signature.id === selected ? "checked" : ""} data-requires-create />
        <span class="social-signature-option">${preview}<strong>${escapeHtml(signature.name)}</strong></span>
      </label>`;
    }).join("");
  }

  function renderContext() {
    const context = state.context;
    renderTemplates();
    fillSelect("socialStudioFormat", context.formats, "Nenhum formato", (item) => `${item.name} · ${item.width} × ${item.height}`);
    fillSelect("socialStudioMovie", context.movies, "Nenhum filme disponível", (item) => `${item.title || "Filme sem título"}${item.catalogued === false ? " · pré-lançamento editorial" : ""}`);
    fillSelect("socialStudioConcession", context.concessions, "Nenhum produto disponível", (item) => item.name || "Produto sem nome");
    fillSelect("socialStudioClub", context.clubPlans, "Nenhum plano disponível", (item) => item.name || "Plano sem nome");
    if (context.recommendedMovieId) document.getElementById("socialStudioMovie").value = context.recommendedMovieId;
    const brand = context.brand || {};
    document.getElementById("socialStudioBrand").innerHTML = `${brand.logoUrl ? `<img src="${escapeHtml(assetUrl(brand.logoUrl))}" alt="" />` : ""}<span><strong>${escapeHtml(brand.name)}</strong><small>Identidade aplicada automaticamente</small></span>`;
    document.getElementById("socialStudioBrandSwatches").innerHTML = [brand.primaryColor, brand.secondaryColor, brand.accentColor]
      .filter(Boolean).map((color) => `<i style="--swatch:${escapeHtml(color)}"></i>`).join("");
    renderStyles();
    renderSignatures();
    renderReadyPosts();
    updateFieldVisibility();
    applyCapabilities();
    renderHistory();
    updatePreviewMeta();
  }

  function renderReadyPosts() {
    const posts = state.context?.readyPosts || [];
    const catalogCount = posts.filter((post) => post.collection === "catalog").length;
    const editorialCount = posts.filter((post) => post.collection === "editorial").length;
    const filters = [
      { id: "catalog", label: "Filmes cadastrados", count: catalogCount },
      { id: "editorial", label: "Próximos lançamentos", count: editorialCount }
    ];
    document.getElementById("socialStudioReadyFilters").innerHTML = filters.map((filter) => `
      <button type="button" role="tab" aria-selected="${state.readyCollection === filter.id ? "true" : "false"}" class="${state.readyCollection === filter.id ? "active" : ""}" data-social-ready-filter="${filter.id}">
        ${escapeHtml(filter.label)} <span>${filter.count}</span>
      </button>`).join("");
    const visible = posts.filter((post) => post.collection === state.readyCollection);
    document.getElementById("socialStudioReadyGrid").innerHTML = visible.length ? visible.map((post) => {
      const caption = String(post.caption || "").replace(/\s+/g, " ").trim();
      return `<article class="social-ready-card">
        <div class="social-ready-poster">
          ${post.imageUrl ? `<img src="${escapeHtml(assetUrl(post.imageUrl))}" alt="" loading="lazy" />` : ""}
          <span>${escapeHtml(post.badge || "Post pronto")}</span>
        </div>
        <div class="social-ready-copy">
          <strong>${escapeHtml(post.title)}</strong>
          <small>${escapeHtml(post.description || "")}</small>
          <p>${escapeHtml(caption.slice(0, 170))}${caption.length > 170 ? "…" : ""}</p>
          <div class="social-ready-source">
            <span>${escapeHtml(post.sourceName || "")}</span>
            ${post.sourceUrl ? `<a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="noreferrer">Consultar fonte</a>` : ""}
          </div>
        </div>
        <div class="social-ready-actions">
          <button class="ghost-button" type="button" data-social-ready-action="edit" data-social-ready-id="${escapeHtml(post.id)}" data-requires-create>Abrir no editor</button>
          <button class="primary-button" type="button" data-social-ready-action="create" data-social-ready-id="${escapeHtml(post.id)}" data-requires-create>Criar arte</button>
        </div>
      </article>`;
    }).join("") : `<div class="social-studio-empty"><strong>Nenhum post nesta coleção</strong><span>Os posts serão montados conforme o catálogo receber novos filmes.</span></div>`;
  }

  function findReadyPost(id) {
    return (state.context?.readyPosts || []).find((post) => String(post.id) === String(id));
  }

  async function openReadyPost(post) {
    if (!post) return;
    applyDraft({ ...post.draft, caption: post.caption }, post.caption);
    renderNotices(post.notices || []);
    saveDraftLocal();
    await updatePreview({ force: true });
    document.querySelector(".social-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    notify("Post pronto aberto no editor.");
  }

  function showSavedPost(post) {
    if (!post?.imageUrl) return;
    if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = assetUrl(post.imageUrl);
    state.previewBlob = null;
    document.getElementById("socialStudioPreviewStage").innerHTML = `<img src="${escapeHtml(state.previewUrl)}" alt="${escapeHtml(post.title || "Arte social")}" /><div id="socialStudioSafeArea" class="social-story-safe-area" ${post.formatId === "story" ? "" : "hidden"} aria-hidden="true"></div>`;
    document.getElementById("socialStudioPreviewMeta").textContent = `${post.formatName || "Arte"} · ${post.width} × ${post.height} · ${String(post.outputType || "png").toUpperCase()}`;
    document.getElementById("socialStudioPreviewDownload").disabled = false;
  }

  async function createReadyPost(post, button) {
    if (!post || state.generating) return;
    state.generating = true;
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Criando...";
    setStatus(`Criando a arte pronta de ${post.title}...`, "loading");
    try {
      const result = await request("/api/admin/social-studio/posts", {
        method: "POST",
        body: JSON.stringify({ ...post.draft, caption: post.caption })
      });
      state.context.history = result.history || [result.post, ...(state.context.history || [])];
      state.historyPage = 1;
      renderHistory();
      showSavedPost(result.post);
      setStatus("Arte pronta adicionada ao histórico.", "ok");
      notify(`Post de ${post.title} criado com sucesso.`);
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    } finally {
      state.generating = false;
      button.disabled = state.context?.capabilities?.create === false;
      button.textContent = originalLabel;
    }
  }

  function applyCapabilities() {
    const canCreate = state.context?.capabilities?.create !== false;
    document.querySelectorAll("[data-requires-create]").forEach((control) => { control.disabled = !canCreate; });
    if (!canCreate) {
      const stateLabel = document.getElementById("socialStudioAutosaveState");
      stateLabel.textContent = "Somente visualização";
      stateLabel.dataset.state = "locked";
    }
  }

  function updateFieldVisibility() {
    const fields = new Set(currentTemplate()?.fields || []);
    document.querySelectorAll("[data-social-field]").forEach((element) => {
      element.hidden = !fields.has(element.dataset.socialField);
    });
    const movieTemplate = currentTemplate()?.type === "movie";
    document.getElementById("socialStudioImageModes").querySelectorAll("label").forEach((label) => {
      const value = label.querySelector("input")?.value;
      label.hidden = !movieTemplate && ["backdrop", "poster"].includes(value);
    });
    renderStyles(document.querySelector("[name='socialStudioStyle']:checked")?.value || "");
  }

  function value(id, fallback = "") {
    const field = document.getElementById(id);
    return field ? field.value : fallback;
  }

  function checked(name, fallback = "") {
    return document.querySelector(`[name='${name}']:checked`)?.value || fallback;
  }

  function payload() {
    return {
      templateId: checked("socialStudioTemplate", "movie-price"),
      formatId: value("socialStudioFormat", "feed_portrait"),
      outputType: value("socialStudioOutput", "png"),
      style: checked("socialStudioStyle", "cinematic"),
      movieId: value("socialStudioMovie"),
      concessionId: value("socialStudioConcession"),
      clubPlanId: value("socialStudioClub"),
      title: value("socialStudioTitle"),
      subtitle: value("socialStudioSubtitle"),
      price: value("socialStudioPrice"),
      date: value("socialStudioDate"),
      auxiliaryText: value("socialStudioAuxiliary"),
      cta: value("socialStudioCta"),
      imageUrl: value("socialStudioImageUrl"),
      imageMode: checked("socialStudioImageMode", "automatic"),
      imagePreset: value("socialStudioImagePreset", "automatic"),
      imagePositionX: Number(value("socialStudioImageX", 50)),
      imagePositionY: Number(value("socialStudioImageY", 50)),
      imageScale: Number(value("socialStudioImageScale", 100)),
      overlayIntensity: Number(value("socialStudioOverlay", 72)),
      darken: Number(value("socialStudioDarken", 8)),
      blur: Number(value("socialStudioBlur", 0)),
      contentPosition: value("socialStudioContentPosition", "bottom"),
      alignment: value("socialStudioAlignment", "left"),
      titleScale: Number(value("socialStudioTitleScale", 100)),
      paletteMode: value("socialStudioPalette", "automatic"),
      signatureId: checked("socialStudioSignature", "automatic"),
      signaturePosition: value("socialStudioSignaturePosition", "automatic"),
      signatureScale: Number(value("socialStudioSignatureScale", 100)),
      caption: value("socialStudioCaption")
    };
  }

  function setControl(id, nextValue) {
    const field = document.getElementById(id);
    if (field && nextValue !== undefined && nextValue !== null) field.value = nextValue;
  }

  function setRadio(name, nextValue) {
    if (!nextValue) return;
    const radio = document.querySelector(`[name='${name}'][value='${CSS.escape(String(nextValue))}']`);
    if (radio) radio.checked = true;
  }

  function applyDraft(draft, caption = "") {
    setRadio("socialStudioTemplate", draft.templateId);
    updateFieldVisibility();
    renderStyles(draft.style);
    setRadio("socialStudioStyle", draft.style);
    renderSignatures(draft.signatureId || "automatic");
    setRadio("socialStudioSignature", draft.signatureId || "automatic");
    setRadio("socialStudioImageMode", draft.imageMode || "automatic");
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
      socialStudioImagePreset: draft.imagePreset,
      socialStudioImageX: draft.imagePositionX,
      socialStudioImageY: draft.imagePositionY,
      socialStudioImageScale: draft.imageScale,
      socialStudioOverlay: draft.overlayIntensity,
      socialStudioDarken: draft.darken,
      socialStudioBlur: draft.blur,
      socialStudioContentPosition: draft.contentPosition,
      socialStudioAlignment: draft.alignment,
      socialStudioTitleScale: draft.titleScale,
      socialStudioPalette: draft.paletteMode,
      socialStudioSignaturePosition: draft.signaturePosition,
      socialStudioSignatureScale: draft.signatureScale,
      socialStudioCaption: caption || draft.caption
    };
    Object.entries(fields).forEach(([id, nextValue]) => setControl(id, nextValue));
    document.getElementById("socialStudioImageState").textContent = draft.imageUrl ? "Imagem personalizada" : "Imagem automática";
    document.getElementById("socialStudioImageClear").hidden = !draft.imageUrl;
    syncRangeOutputs();
    updateFieldVisibility();
    updatePreviewMeta();
  }

  function setStatus(message, kind = "") {
    const status = document.getElementById("socialStudioStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = kind;
  }

  function renderNotices(notices = []) {
    state.notices = notices;
    const container = document.getElementById("socialStudioNotices");
    if (!container) return;
    container.innerHTML = notices.map((notice) => `<p data-type="${escapeHtml(notice.type || "info")}">${escapeHtml(notice.message)}</p>`).join("");
  }

  function updatePreviewMeta() {
    const format = currentFormat();
    const output = value("socialStudioOutput", "png").toUpperCase();
    if (format) {
      document.getElementById("socialStudioPreviewMeta").textContent = `${format.name} · ${format.width} × ${format.height} · ${output}`;
      const stage = document.getElementById("socialStudioPreviewStage");
      stage.style.setProperty("--social-preview-ratio", `${format.width} / ${format.height}`);
      document.getElementById("socialStudioSafeArea").hidden = format.id !== "story";
    }
  }

  function syncRangeOutputs() {
    const pairs = [
      ["socialStudioImageScale", "socialStudioImageScaleValue", "%"],
      ["socialStudioImageX", "socialStudioImageXValue", "%"],
      ["socialStudioImageY", "socialStudioImageYValue", "%"],
      ["socialStudioOverlay", "socialStudioOverlayValue", "%"],
      ["socialStudioDarken", "socialStudioDarkenValue", "%"],
      ["socialStudioBlur", "socialStudioBlurValue", ""],
      ["socialStudioTitleScale", "socialStudioTitleScaleValue", "%"],
      ["socialStudioSignatureScale", "socialStudioSignatureScaleValue", "%"]
    ];
    pairs.forEach(([inputId, outputId, suffix]) => {
      const input = document.getElementById(inputId);
      const output = document.getElementById(outputId);
      if (input && output) output.textContent = `${input.value}${suffix}`;
    });
  }

  function previewCacheKey(data) {
    return JSON.stringify({ ...data, caption: undefined });
  }

  function cachePreview(key, blob) {
    state.previewCache.set(key, blob);
    if (state.previewCache.size > 8) state.previewCache.delete(state.previewCache.keys().next().value);
  }

  function displayPreview(blob, alt = "Prévia da arte social") {
    if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
    state.previewBlob = blob;
    state.previewUrl = URL.createObjectURL(blob);
    const stage = document.getElementById("socialStudioPreviewStage");
    stage.innerHTML = `<img src="${state.previewUrl}" alt="${escapeHtml(alt)}" /><div id="socialStudioSafeArea" class="social-story-safe-area" ${currentFormat()?.id === "story" ? "" : "hidden"} aria-hidden="true"></div><span class="social-preview-progress" aria-hidden="true"></span>`;
    document.getElementById("socialStudioPreviewDownload").disabled = false;
  }

  async function updatePreview(options = {}) {
    if (state.context?.capabilities?.create === false) return;
    const data = payload();
    const key = previewCacheKey(data);
    if (!options.force && state.previewCache.has(key)) {
      displayPreview(state.previewCache.get(key), data.title);
      setStatus("Prévia atualizada.", "ok");
      return;
    }
    const version = ++state.previewVersion;
    state.previewing = true;
    state.previewAbort?.abort();
    state.previewAbort = new AbortController();
    document.getElementById("socialStudioPreviewStage")?.classList.add("is-rendering");
    setStatus("Atualizando a composição...", "loading");
    try {
      const blob = await requestImage("/api/admin/social-studio/preview", data, state.previewAbort.signal);
      if (version !== state.previewVersion) return;
      cachePreview(key, blob);
      displayPreview(blob, data.title);
      setStatus("Prévia atualizada automaticamente.", "ok");
    } catch (error) {
      if (error.name !== "AbortError" && version === state.previewVersion) setStatus(error.message, "error");
    } finally {
      if (version === state.previewVersion) {
        state.previewing = false;
        document.getElementById("socialStudioPreviewStage")?.classList.remove("is-rendering");
      }
    }
  }

  function schedulePreview(delay = 420) {
    window.clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(() => updatePreview(), delay);
  }

  function saveDraftLocal() {
    if (state.context?.capabilities?.create === false) return;
    const label = document.getElementById("socialStudioAutosaveState");
    label.textContent = "Salvando...";
    label.dataset.state = "saving";
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(payload()));
        label.textContent = "Rascunho salvo";
        label.dataset.state = "saved";
      } catch {
        label.textContent = "Rascunho apenas nesta sessão";
        label.dataset.state = "error";
      }
    }, 320);
  }

  function restoreDraftLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (!saved || !state.context.templates.some((template) => template.id === saved.templateId)) return false;
      applyDraft(saved, saved.caption || "");
      setStatus("Rascunho local restaurado.", "ok");
      return true;
    } catch {
      return false;
    }
  }

  async function resolveDefaults(options = {}) {
    const version = ++state.resolveVersion;
    state.resolving = true;
    setStatus("Carregando dados atuais do painel...", "loading");
    try {
      const base = payload();
      if (options.resetCopy !== false) {
        ["title", "subtitle", "price", "date", "auxiliaryText", "cta", "caption"].forEach((key) => { base[key] = undefined; });
      }
      const result = await request("/api/admin/social-studio/resolve", { method: "POST", body: JSON.stringify(base) });
      if (version !== state.resolveVersion) return;
      applyDraft(result.draft, result.caption);
      renderNotices(result.notices || []);
      saveDraftLocal();
      await updatePreview({ force: true });
    } catch (error) {
      if (version === state.resolveVersion) setStatus(error.message, "error");
    } finally {
      if (version === state.resolveVersion) state.resolving = false;
    }
  }

  async function generatePost(event) {
    event?.preventDefault();
    if (state.generating) return;
    state.generating = true;
    const button = document.getElementById("socialStudioGenerateButton");
    button.disabled = true;
    button.textContent = "Gerando...";
    setStatus("Gerando e salvando o arquivo final...", "loading");
    try {
      const result = await request("/api/admin/social-studio/posts", { method: "POST", body: JSON.stringify(payload()) });
      state.context.history = result.history || [result.post, ...(state.context.history || [])];
      state.historyPage = 1;
      renderHistory();
      setStatus("Arte adicionada ao histórico.", "ok");
      notify("Arte social gerada com sucesso.");
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    } finally {
      state.generating = false;
      button.disabled = state.context?.capabilities?.create === false;
      button.textContent = "Gerar arte";
    }
  }

  async function generateCampaign() {
    if (state.generating) return;
    state.generating = true;
    const button = document.getElementById("socialStudioCampaignButton");
    button.disabled = true;
    button.textContent = "Gerando 3 formatos...";
    setStatus("Adaptando a campanha para Feed, quadrado e Story...", "loading");
    try {
      const result = await request("/api/admin/social-studio/campaigns", { method: "POST", body: JSON.stringify(payload()) });
      state.context.history = result.history || [...(result.posts || []), ...(state.context.history || [])];
      state.historyPage = 1;
      renderHistory();
      setStatus("Campanha criada em três formatos.", "ok");
      notify("Campanha gerada com Feed, quadrado e Story.");
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    } finally {
      state.generating = false;
      button.disabled = state.context?.capabilities?.create === false;
      button.textContent = "Gerar campanha";
    }
  }

  function downloadPreview() {
    if (!state.previewUrl) return;
    const extension = value("socialStudioOutput") === "jpg" ? "jpg" : "png";
    const link = document.createElement("a");
    link.href = state.previewUrl;
    link.download = `previa-${value("socialStudioFormat")}.${extension}`;
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
    setControl("socialStudioImageUrl", result.url);
    setRadio("socialStudioImageMode", "upload");
    document.getElementById("socialStudioImageState").textContent = file.name;
    document.getElementById("socialStudioImageClear").hidden = false;
    saveDraftLocal();
    await updatePreview({ force: true });
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
          <div class="social-history-badges"><span>${escapeHtml(post.templateName || "Arte")}</span><span data-status="ready">${post.status === "draft" ? "Rascunho" : "Pronta"}</span></div>
          <strong>${escapeHtml(post.title || post.templateName)}</strong>
          <span>${escapeHtml(post.contentName || post.title || "")}</span>
          <small>${escapeHtml(post.formatName || post.formatId || "")} · ${String(post.outputType || "png").toUpperCase()}</small>
          <time>${post.createdAt ? new Date(post.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}</time>
        </div>
        <div class="social-history-actions">
          <button class="ghost-button" type="button" data-social-action="view" data-social-id="${escapeHtml(post.id)}">Visualizar</button>
          ${state.context.capabilities?.create !== false ? `<button class="ghost-button" type="button" data-social-action="duplicate" data-social-id="${escapeHtml(post.id)}">Duplicar</button>` : ""}
          <a class="ghost-button" href="${basePath}/api/admin/social-studio/posts/${encodeURIComponent(post.id)}/download">Baixar</a>
          ${state.context.capabilities?.delete ? `<button class="danger-button" type="button" data-social-action="delete" data-social-id="${escapeHtml(post.id)}">Excluir</button>` : ""}
        </div>
      </article>`).join("") : `<div class="social-studio-empty"><strong>Nenhuma campanha criada</strong><span>Gere sua primeira arte para iniciar o histórico.</span></div>`;
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
      showSavedPost(post);
      document.querySelector(".social-preview-pane")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (button.dataset.socialAction === "duplicate") {
      const postPayload = post.payload || {};
      applyDraft({ ...postPayload, formatId: postPayload.formatId || post.formatId, outputType: postPayload.outputType || post.outputType }, post.caption || "");
      renderNotices([]);
      saveDraftLocal();
      await updatePreview({ force: true });
      document.querySelector(".social-studio-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  function switchEditorTab(tab) {
    document.querySelectorAll("[data-social-editor-tab]").forEach((button) => {
      const active = button.dataset.socialEditorTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.getElementById("socialStudioArtPanel").hidden = tab !== "art";
    document.getElementById("socialStudioCaptionPanel").hidden = tab !== "caption";
  }

  function bindEvents() {
    const form = document.getElementById("socialStudioForm");
    form.addEventListener("submit", generatePost);
    document.getElementById("socialStudioPreviewButton").addEventListener("click", () => updatePreview({ force: true }));
    document.getElementById("socialStudioCampaignButton").addEventListener("click", generateCampaign);
    document.getElementById("socialStudioPreviewDownload").addEventListener("click", downloadPreview);
    document.getElementById("socialStudioReadyFilters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-ready-filter]");
      if (!button) return;
      state.readyCollection = button.dataset.socialReadyFilter;
      renderReadyPosts();
      applyCapabilities();
    });
    document.getElementById("socialStudioReadyGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-ready-action]");
      if (!button || button.disabled) return;
      const post = findReadyPost(button.dataset.socialReadyId);
      if (button.dataset.socialReadyAction === "edit") openReadyPost(post).catch((error) => notify(error.message, "error"));
      if (button.dataset.socialReadyAction === "create") createReadyPost(post, button);
    });
    document.getElementById("socialStudioTemplates").addEventListener("change", async () => {
      updateFieldVisibility();
      await resolveDefaults({ resetCopy: true });
    });
    ["socialStudioMovie", "socialStudioConcession", "socialStudioClub"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => resolveDefaults({ resetCopy: true }));
    });
    form.addEventListener("input", (event) => {
      syncRangeOutputs();
      saveDraftLocal();
      if (event.target.id !== "socialStudioCaption" && event.target.id !== "socialStudioPreviewZoom") schedulePreview(460);
    });
    form.addEventListener("change", (event) => {
      if (event.target.matches("[name='socialStudioTemplate'], #socialStudioMovie, #socialStudioConcession, #socialStudioClub, #socialStudioImageUpload")) return;
      updatePreviewMeta();
      saveDraftLocal();
      if (event.target.id !== "socialStudioCaption") schedulePreview(80);
    });
    document.getElementById("socialStudioImageUpload").addEventListener("change", (event) => {
      uploadCustomImage(event.target.files?.[0]).catch((error) => notify(error.message, "error"));
    });
    document.getElementById("socialStudioImageClear").addEventListener("click", async () => {
      setControl("socialStudioImageUrl", "");
      setControl("socialStudioImageUpload", "");
      setRadio("socialStudioImageMode", "automatic");
      document.getElementById("socialStudioImageState").textContent = "Imagem automática";
      document.getElementById("socialStudioImageClear").hidden = true;
      saveDraftLocal();
      await updatePreview({ force: true });
    });
    document.getElementById("socialStudioPreviewZoom").addEventListener("input", (event) => {
      state.previewZoom = Number(event.target.value);
      document.getElementById("socialStudioPreviewZoomValue").textContent = `${state.previewZoom}%`;
      document.getElementById("socialStudioPreviewStage").style.setProperty("--social-preview-zoom", `${state.previewZoom}%`);
    });
    document.querySelector(".social-editor-tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-editor-tab]");
      if (button) switchEditorTab(button.dataset.socialEditorTab);
    });
    document.getElementById("socialStudioCopyCaption").addEventListener("click", async () => {
      const caption = value("socialStudioCaption");
      try {
        await navigator.clipboard.writeText(caption);
        notify("Legenda copiada.");
      } catch {
        document.getElementById("socialStudioCaption").select();
        document.execCommand("copy");
        notify("Legenda copiada.");
      }
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
      if (state.context?.capabilities?.create === false) {
        setStatus("Você pode consultar o histórico, mas não possui permissão para criar artes.", "");
        return;
      }
      const restored = restoreDraftLocal();
      if (restored) await updatePreview({ force: true });
      else await resolveDefaults({ resetCopy: true });
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
