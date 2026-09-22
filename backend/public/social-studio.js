(function socialStudioModule() {
  "use strict";

  const root = document.getElementById("socialStudioRoot");
  if (!root) return;

  const basePath = (() => {
    const pathname = window.location.pathname || "";
    const adminIndex = pathname.indexOf("/admin");
    return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
  })();
  const draftKey = "cinecruzeiro.socialStudio.draft.v3";
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
    readyPage: 1,
    styleManuallySelected: false,
    notices: [],
    previewZoom: 86,
    activePostId: ""
  };
  state.compositionAdjustments = {};
  state.motionVersion = 0;
  state.directionFrames = { background: {}, hero: {} };
  state.variations = [];
  state.variationVersion = 0;
  state.polish = false;
  state.previewNotices = new Map();
  state.favoriteKey = "cinecruzeiro.socialStudio.favorites.v1";
  try { const saved = JSON.parse(localStorage.getItem(state.favoriteKey) || "[]"); state.favorites = Array.isArray(saved) ? saved.filter(item => item?.draft && item?.quality).slice(0, 8) : []; } catch { state.favorites = []; }
  const effectControls = [
    ["blur", "Desfoque do fundo", 0, 80, 1], ["darkening", "Escurecimento", 0, 80, 1],
    ["saturation", "Saturação", 0, 180, 5], ["contrast", "Contraste", 50, 160, 5],
    ["vignette", "Vinheta", 0, 80, 1], ["grain", "Granulação", 0, 8, 1],
    ["glow", "Luz ambiente", 0, 40, 1], ["blend", "Mistura com o fundo", 0, 100, 1], ["colorWash", "Banho de cor", 0, 35, 1]
  ];

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
    const id = document.querySelector("[name='socialStudioTemplate']:checked")?.value || "movie-premiere";
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
            <p>Campanhas do Cine Cruzeiro</p>
          </div>
          <div class="social-studio-toolbar-actions">
            <span id="socialStudioAutosaveState" class="social-save-state" data-state="idle">Rascunho local</span>
            <button id="socialStudioPreviewButton" class="ghost-button" type="button" data-requires-create>Atualizar prévia</button>
            <button id="socialStudioCampaignButton" class="ghost-button" type="button" data-requires-create>Gerar campanha</button>
            <button id="socialStudioVariationsButton" class="ghost-button" type="button" data-requires-create>Gerar variações</button>
            <button id="socialStudioGenerateButton" class="primary-button" type="submit" data-requires-create>Gerar arte</button>
          </div>
        </header>

        <section class="social-ready-library" aria-labelledby="socialStudioReadyTitle">
          <header class="social-ready-head">
            <div>
              <h3 id="socialStudioReadyTitle">Posts prontos para publicar</h3>
            </div>
            <div id="socialStudioReadyFilters" class="social-ready-filters" role="tablist" aria-label="Coleções de posts prontos"></div>
          </header>
          <div id="socialStudioReadyGrid" class="social-ready-grid"></div>
          <div id="socialStudioReadyPager" class="social-studio-history-pager"></div>
        </section>

        <div class="social-studio-workspace">
          <aside class="social-template-library" aria-labelledby="socialStudioTemplateTitle">
            <div class="social-pane-heading">
              <h3 id="socialStudioTemplateTitle">O que divulgar</h3>
            </div>
            <div id="socialStudioRecommendation" class="social-studio-recommendation" hidden></div>
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
              <button id="socialStudioManualEdit" class="primary-button" type="button" disabled>Editar detalhes</button>
              <button id="socialStudioPreviewDownload" class="ghost-button" type="button" disabled>Baixar prévia</button>
              <button id="socialStudioMotionPlay" class="ghost-button" type="button" data-requires-create>Reproduzir prévia</button>
            </div>
            <p id="socialStudioStatus" class="social-studio-status" role="status"></p>
            <section id="socialStudioVariations" class="social-variations" aria-label="Variações de composição" hidden></section>
            <section id="socialStudioFavorites" class="social-variations" aria-label="Composições favoritas" hidden></section>
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
                  <fieldset data-social-field="movies" class="social-choice-fieldset"><legend>Filmes e ordem</legend><div id="socialStudioMovieSelections"></div><label>Composição<select id="socialStudioMultiLayout" data-requires-create><option value="grid">Grade limpa</option><option value="editorial">Editorial</option><option value="summary">Resumo em lista</option><option value="poster-footer">Pôsteres com rodapé</option><option value="featured">Destaque + grade</option></select></label></fieldset>
                  <fieldset data-social-field="schedule" class="social-choice-fieldset"><legend>Programação</legend><label>Período<select id="socialStudioScheduleMode" data-requires-create><option value="today">Um dia</option><option value="week" selected>Sete dias</option></select></label><label>Data inicial<input id="socialStudioPeriodStart" type="date" data-requires-create /></label><label class="social-toggle"><input id="socialStudioShowSessions" type="checkbox" checked data-requires-create /> Mostrar horários por dia</label></fieldset>
                  <label id="socialStudioConcessionField" data-social-field="concession">Produto ou combo<select id="socialStudioConcession" data-requires-create></select></label>
                  <label id="socialStudioClubField" data-social-field="clubPlan">Plano do clube<select id="socialStudioClub" data-requires-create></select></label>
                  <label data-social-field="title">Título<input id="socialStudioTitle" maxlength="160" data-requires-create /></label>
                  <label data-social-field="subtitle">Chamada<input id="socialStudioSubtitle" maxlength="120" data-requires-create /></label>
                  <fieldset data-social-field="date" class="social-choice-fieldset"><legend>Data em destaque</legend><label>Significado<select id="socialStudioDateKind" data-requires-create><option value="release">Estreia</option><option value="presale">Abertura da pré-venda</option><option value="session">Sessão</option></select></label><label>Texto da data<input id="socialStudioDate" maxlength="60" data-requires-create /></label><label>Estreia confirmada<input id="socialStudioReleaseDate" type="date" data-requires-create /></label><label>Abertura da pré-venda<input id="socialStudioPresaleDate" type="date" data-requires-create /></label><label>Data da sessão<input id="socialStudioSessionDate" type="date" data-requires-create /></label></fieldset>
                  <label data-social-field="auxiliaryText">Texto auxiliar<textarea id="socialStudioAuxiliary" rows="3" maxlength="260" data-requires-create></textarea></label>
                  <label data-social-field="cta">Chamada final<input id="socialStudioCta" maxlength="60" data-requires-create /></label>
                  <label>Destino da chamada<input id="socialStudioActionDestination" type="url" placeholder="https://cinema.com.br" data-requires-create /></label>
                  <label>Tom dos textos<select id="socialStudioCopyTone" data-requires-create><option value="automatic">Automático</option><option value="cinematic">Cinematográfico</option><option value="commercial">Comercial</option><option value="fun">Divertido</option><option value="elegant">Elegante</option><option value="direct">Direto</option></select></label>
                  <label>Densidade<select id="socialStudioCopyDensity" data-requires-create><option value="short">Curta</option><option value="medium" selected>Média</option><option value="long">Longa</option></select></label>
                </div>
              </details>

              <details class="social-property-section" data-social-field="price">
                <summary>Preço e promoção</summary>
                <div class="social-property-body">
                  <label>Preço ou condição<input id="socialStudioPrice" maxlength="60" data-requires-create /></label>
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
                    <label>Posição horizontal <output id="socialStudioImageXValue">50%</output><input id="socialStudioImageX" type="range" min="0" max="100" step="1" value="50" data-requires-create /></label>
                    <label>Posição vertical <output id="socialStudioImageYValue">50%</output><input id="socialStudioImageY" type="range" min="0" max="100" step="1" value="50" data-requires-create /></label>
                  </div>
                </div>
              </details>

              <details class="social-property-section" data-social-field="advanced" open>
                <summary>Layout e cores</summary>
                <div class="social-property-body">
                  <label>Estilo visual<select id="socialStudioVisualStyle" data-requires-create><option value="cinematic">Cinematográfico</option><option value="impact">Impacto</option><option value="clean">Limpo</option><option value="minimal">Minimalista</option></select></label>
                  <fieldset class="social-choice-fieldset">
                    <legend>Composição</legend>
                    <div id="socialStudioStyles" class="social-style-grid"></div>
                  </fieldset>
                  <label>Destaque principal<select id="socialStudioEmphasis" data-requires-create><option value="automatic">Automático pela campanha</option><option value="film">Filme dominante</option><option value="date">Data ou preço dominante</option></select></label>
                  <label>Tratamento do hero<select id="socialStudioHeroMode" data-requires-create><option value="rectangle">Retangular</option><option value="soft-rectangle">Retângulo suave</option><option value="edge-dissolve" selected>Bordas dissolvidas</option><option value="full-blend">Integração completa</option><option value="floating">Flutuante</option></select></label>
                  <label>Paleta
                    <select id="socialStudioPalette" data-requires-create>
                      <option value="automatic">Automática pelo filme</option>
                      <option value="brand">Somente identidade do cinema</option>
                      <option value="dynamic">Cores do filme</option>
                    </select>
                  </label>
                  <fieldset class="social-choice-fieldset"><legend>Variações de cor</legend><div id="socialStudioPalettes" class="social-palette-grid"></div></fieldset>
                  <label>Atmosfera<select id="socialStudioCompositionPreset" data-requires-create><option value="automatic">Automática pelo gênero</option>${Object.entries(state.context.composition?.presets || {}).map(([id, preset]) => `<option value="${id}">${escapeHtml(preset.name)}</option>`).join("")}</select></label>
                  <label>Visual<select id="socialStudioCompositionLook" data-requires-create>${Object.entries(state.context.composition?.looks || {}).map(([id, look]) => `<option value="${id}" ${id === "cinematic" ? "selected" : ""}>${escapeHtml(look.name)}</option>`).join("")}</select></label>
                  <details class="social-composition-adjustments"><summary>Ajustes de composição</summary>
                    <label>Grade<select id="socialStudioDirectionGrid" data-requires-create><option value="automatic">Automática pelo layout</option><option value="thirds">Terços</option><option value="golden">Proporção áurea</option><option value="40-60">40 / 60</option><option value="60-40">60 / 40</option></select></label>
                    <label>Variação<input id="socialStudioDirectionSeed" type="number" value="0" min="0" max="9999" step="1" data-requires-create /></label>
                    <label class="social-composition-toggle"><input id="socialStudioSecondaryArtwork" type="checkbox" data-requires-create />Arte secundária</label>
                    <label>Primeiro plano<select id="socialStudioForeground" data-requires-create><option value="none">Nenhum</option><option value="fog">Névoa</option><option value="light-leak">Luz lateral</option><option value="dust">Partículas sutis</option><option value="gradient-light">Luz direcional</option></select></label>
                    <label>Sombra ambiente<input id="socialStudioHeroShadow" type="range" min="0" max="60" value="25" data-requires-create /></label>
                    ${[["background","Enquadramento do fundo"],["hero","Enquadramento do hero"]].map(([frame,label])=>`<details class="social-framing"><summary>${label}</summary><div class="social-framing-grid">${[["focusX","Posição horizontal",0,100],["focusY","Posição vertical",0,100],["scale","Escala (%)",70,150],["cropLeft","Recorte esquerdo (%)",0,40],["cropRight","Recorte direito (%)",0,40],["cropTop","Recorte superior (%)",0,40],["cropBottom","Recorte inferior (%)",0,40]].map(([key,name,min,max])=>`<label>${name}<input type="number" id="socialFrame-${frame}-${key}" data-direction-frame="${frame}" data-direction-key="${key}" placeholder="Automático" min="${min}" max="${max}" step="1" data-requires-create /></label>`).join("")}</div></details>`).join("")}
                    <label class="social-composition-toggle"><input id="socialStudioCompositionEnabled" type="checkbox" checked data-requires-create />Fundo cinematográfico</label>
                    ${effectControls.map(([key, label, min, max, step]) => `<label>${label}<output id="socialEffect-${key}-value"></output><input id="socialEffect-${key}" data-composition-effect="${key}" type="range" min="${min}" max="${max}" step="${step}" data-requires-create /></label>`).join("")}
                    <label>Transição das bordas<select id="socialEffect-mask" data-composition-effect="mask" data-requires-create>${[["cinematic-bottom", "Cinematográfica inferior"], ["fade-all", "Todas as bordas"], ["fade-bottom", "Inferior"], ["fade-top", "Superior"], ["fade-left", "Esquerda"], ["fade-right", "Direita"], ["radial", "Radial"], ["none", "Sem máscara"]].map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
                    <label>Luz e textura<select id="socialEffect-overlay" data-composition-effect="overlay" data-requires-create>${[["none", "Nenhuma"], ["fog", "Névoa"], ["dust", "Poeira sutil"], ["light-leak", "Luz lateral"], ["gradient-light", "Luz direcional"]].map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
                    <button id="socialStudioCompositionReset" class="ghost-button" type="button" data-requires-create>Restaurar ajustes do visual</button>
                  </details>
                  <fieldset class="social-choice-fieldset">
                    <legend>Assinatura do pôster</legend>
                    <div id="socialStudioSignatures" class="social-signature-grid"></div>
                  </fieldset>
                  <div class="social-range-row">
                    <label>Tamanho da assinatura <output id="socialStudioSignatureScaleValue">100%</output><input id="socialStudioSignatureScale" type="range" min="70" max="135" step="5" value="100" data-requires-create /></label>
                  </div>
                  <div class="social-brand-note"><span id="socialStudioBrandSwatches"></span></div>
                </div>
              </details>

              <details class="social-property-section" data-social-field="advanced">
                <summary>Configurações avançadas</summary>
                <div class="social-property-body">
                  <label>Alinhamento
                    <select id="socialStudioAlignment" data-requires-create><option value="left">Esquerda</option><option value="center">Centralizado</option></select>
                  </label>
                  <div class="social-range-row">
                    <label>Tamanho do título <output id="socialStudioTitleScaleValue">100%</output><input id="socialStudioTitleScale" type="range" min="80" max="125" step="1" value="100" data-requires-create /></label>
                  </div>
                </div>
              </details>

              <details class="social-property-section">
                <summary>Arquivo final</summary>
                <div class="social-property-body social-output-grid">
                  <label>Formato<select id="socialStudioFormat" data-requires-create></select></label>
                  <label>Arquivo<select id="socialStudioOutput" data-requires-create><option value="png">PNG em alta qualidade</option><option value="jpg">JPG em alta qualidade</option></select></label>
                  <label>Movimento da prévia<select id="socialStudioMotionPreset" data-requires-create><option value="slow-zoom">Aproximação suave</option><option value="pan-zoom">Deslocamento e aproximação</option><option value="reveal">Entrada gradual</option></select></label>
                  <label>Duração<select id="socialStudioMotionDuration" data-requires-create><option value="5">5 segundos</option><option value="8" selected>8 segundos</option><option value="10">10 segundos</option></select></label>
                  <label class="social-toggle"><input id="socialStudioAnimated" type="checkbox" data-requires-create /> Gerar versão animada</label>
                  <div id="socialStudioAnimationOptions" hidden><label>Formato animado<select id="socialStudioAnimationFormat" data-requires-create><option value="mp4">MP4</option><option value="webm">WebM</option><option value="gif">GIF</option></select></label><label>Preset<select id="socialStudioAnimationPreset" data-requires-create><option value="cinematic">Cinematográfico</option><option value="commercial">Comercial</option><option value="soft">Suave</option></select></label><label class="social-toggle"><input id="socialStudioAnimationLoop" type="checkbox" checked data-requires-create /> Repetir reprodução</label><button id="socialStudioAnimationExport" type="button" class="primary-button" data-requires-create>Exportar animação</button></div>
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
    return `<span class="social-template-thumb" data-template-preview="${escapeHtml(template.id)}"><span class="social-thumbnail-status">Sem imagem</span></span>`;
  }

  function invalidateThumbnails() {
    updateTemplatePreviews(payload());
  }

  function updateTemplatePreviews(data) {
    if(!state.context) return;
    const find=(items,id)=>(items || []).find(item=>String(item.id)===String(id));
    for (const template of state.context.templates) {
      const movie=find(state.context.movies,template.id==='multi-movies' ? data.movieIds?.[0] || data.movieId : data.movieId);
      const src=template.id==='concession-combo' ? find(state.context.concessions,data.concessionId)?.imageUrl : template.id==='club-plan' ? find(state.context.clubPlans,data.clubPlanId)?.imageUrl : movie?.posterUrl;
      const target=document.querySelector(`[data-template-preview="${CSS.escape(template.id)}"]`);
      const url=src?assetUrl(src):'';
      if(!target || target.dataset.source===url) continue;
      target.dataset.source=url;
      target.innerHTML=url?`<img src="${escapeHtml(url)}" alt="${escapeHtml(template.name)}" loading="lazy" decoding="async" />`:'<span class="social-thumbnail-status">Sem imagem</span>';
      target.querySelector('img')?.addEventListener('error',()=>{target.innerHTML='<span class="social-thumbnail-status">Sem imagem</span>';},{once:true});
    }
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
    const styles = [{id:"automatic",name:"Direção automática"},...(state.context.styles || []).filter((style) => allowed.includes(style.id) && ['hero-left','hero-right','hero-center','full-bleed','editorial','poster-dominant','typography-dominant','split','diagonal'].includes(style.id))];
    const movie = state.context.movies?.find((item) => String(item.id) === value("socialStudioMovie"));
    const poster = movie?.posterUrl || "";
    const names = { cinematic: "Cinema", impact: "Impacto", clean: "Editorial", minimal: "Galeria" };
    document.getElementById("socialStudioStyles").innerHTML = styles.map((style, index) => `
      <label><input type="radio" name="socialStudioStyle" value="${escapeHtml(style.id)}" ${style.id === selected || (!selected && index === 0) ? "checked" : ""} data-requires-create /><span><i class="social-layout-mini social-layout-mini--${escapeHtml(style.id)}" aria-hidden="true">${poster ? `<img src="${escapeHtml(assetUrl(poster))}" alt="" />` : ""}<b></b><em></em></i>${escapeHtml(names[style.id] || style.name)}</span></label>`).join("");
  }

  function syncCompositionControls() {
    const config = state.context.composition || {};
    const movie = state.context.movies?.find((item) => String(item.id) === value("socialStudioMovie"));
    const genre = [movie?.genre, ...(movie?.genres || [])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const inferred = /terror|horror|suspense/.test(genre) ? "horror" : /fantasia|fantasy/.test(genre) ? "fantasy" : /animacao|familia|infantil/.test(genre) ? "animation" : /acao|aventura/.test(genre) ? "action" : /romance/.test(genre) ? "romance" : /drama/.test(genre) ? "drama" : "neutral";
    const preset = value("socialStudioCompositionPreset", "automatic");
    const fx = { ...config.presets?.[preset === "automatic" ? inferred : preset], ...config.looks?.[value("socialStudioCompositionLook", "cinematic")], ...state.compositionAdjustments };
    effectControls.forEach(([key]) => {
      const next = key === "darkening" ? Math.round((1 - (fx.brightness ?? .65)) * 100) : ["contrast", "saturation"].includes(key) ? Math.round((fx[key] ?? 1) * 100) : fx[key] ?? 0;
      setControl(`socialEffect-${key}`, next);
      const output = document.getElementById(`socialEffect-${key}-value`);
      if (output) output.textContent = `${next}${key === "blur" ? " px" : "%"}`;
    });
    setControl("socialEffect-mask", fx.mask || "cinematic-bottom");
    setControl("socialEffect-overlay", fx.overlay || "none");
  }

  function movieGenreRecommendation() {
    if (currentTemplate()?.type !== "movie") return null;
    const movieId = document.getElementById("socialStudioMovie")?.value;
    const movie = (state.context?.movies || []).find((item) => String(item.id) === String(movieId));
    const genres = [movie?.genre, ...(movie?.genres || [])].filter(Boolean).join(" ")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/terror|horror|suspense/.test(genres)) return { style: "cinematic", label: "Cinematográfico escuro", reason: "terror ou suspense" };
    if (/animacao|familia|infantil/.test(genres)) return { style: "impact", label: "Impacto colorido", reason: "animação ou família" };
    if (/acao|aventura/.test(genres)) return { style: "impact", label: "Impacto", reason: "ação ou aventura" };
    if (/romance/.test(genres)) return { style: "clean", label: "Clean elegante", reason: "romance" };
    if (/drama/.test(genres)) return { style: "cinematic", label: "Cinematográfico", reason: "drama" };
    return { style: "cinematic", label: "Cinematográfico", reason: "composição versátil" };
  }

  function updateStyleRecommendation({ apply = false } = {}) {
    const recommendation = movieGenreRecommendation();
    const container = document.getElementById("socialStudioRecommendation");
    if (!container) return;
    container.hidden = !recommendation;
    if (!recommendation) return;
    container.innerHTML = `<strong>Recomendação automática</strong><span>${escapeHtml(recommendation.label)} para ${escapeHtml(recommendation.reason)}.</span>`;
    if (apply && !state.styleManuallySelected) {
      renderStyles("automatic");
      setRadio("socialStudioStyle", "automatic");
    }
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
    document.getElementById('socialStudioMovieSelections').innerHTML = Array.from({length:6},(_,index)=>`<label>Filme ${index+1}<select data-program-movie="${index}" data-requires-create><option value="">${index<2?'Selecionar filme':'Nenhum'}</option>${context.movies.filter(movie=>movie.catalogued!==false).map(movie=>`<option value="${escapeHtml(movie.id)}">${escapeHtml(movie.title)}</option>`).join('')}</select></label>`).join('');
    fillSelect("socialStudioConcession", context.concessions, "Nenhum produto disponível", (item) => item.name || "Produto sem nome");
    fillSelect("socialStudioClub", context.clubPlans, "Nenhum plano disponível", (item) => item.name || "Plano sem nome");
    if (context.recommendedMovieId) document.getElementById("socialStudioMovie").value = context.recommendedMovieId;
    const brand = context.brand || {};
    document.getElementById("socialStudioBrand").innerHTML = `${brand.logoUrl ? `<img src="${escapeHtml(assetUrl(brand.logoUrl))}" alt="" />` : ""}<span><strong>${escapeHtml(brand.name)}</strong><small>Identidade aplicada automaticamente</small></span>`;
    document.getElementById("socialStudioBrandSwatches").innerHTML = [brand.primaryColor, brand.secondaryColor, brand.accentColor]
      .filter(Boolean).map((color) => `<i style="--swatch:${escapeHtml(color)}"></i>`).join("");
    renderStyles();
    syncCompositionControls();
    document.getElementById("socialStudioPalettes").innerHTML = (context.palettes || []).map((palette, index) => `<label title="${escapeHtml(palette.name)}"><input type="radio" name="socialStudioPaletteId" value="${escapeHtml(palette.id)}" ${index === 0 ? "checked" : ""} data-requires-create /><span><i aria-hidden="true">${palette.colors.map((color) => `<b style="background:${escapeHtml(color)}"></b>`).join("")}</i><small>${escapeHtml(palette.name)}</small></span></label>`).join("");
    updateStyleRecommendation({ apply: true });
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
    const collection = posts.filter((post) => post.collection === state.readyCollection);
    const pages = Math.max(1, Math.ceil(collection.length / 3));
    state.readyPage = Math.min(state.readyPage, pages);
    const visible = collection.slice((state.readyPage - 1) * 3, state.readyPage * 3);
    document.getElementById("socialStudioReadyPager").innerHTML = `<button type="button" aria-label="Posts anteriores" data-ready-page="${state.readyPage - 1}" ${state.readyPage === 1 ? "disabled" : ""}>‹</button><span>${state.readyPage} de ${pages}</span><button type="button" aria-label="Próximos posts" data-ready-page="${state.readyPage + 1}" ${state.readyPage === pages ? "disabled" : ""}>›</button>`;
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
    clearTimeout(state.previewTimer);
    state.previewAbort?.abort();
    state.previewVersion++;
    stopMotion();
    if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = assetUrl(post.imageUrl);
    state.previewBlob = null;
    document.getElementById("socialStudioPreviewStage").innerHTML = `<img src="${escapeHtml(state.previewUrl)}" alt="${escapeHtml(post.title || "Arte social")}" /><div id="socialStudioSafeArea" class="social-story-safe-area" ${post.formatId === "story" ? "" : "hidden"} aria-hidden="true"></div>`;
    document.getElementById("socialStudioPreviewMeta").textContent = `${post.formatName || "Arte"} · ${post.width} × ${post.height} · ${String(post.outputType || "png").toUpperCase()}`;
    document.getElementById("socialStudioPreviewDownload").disabled = false;
    state.activePostId = String(post.id || "");
    const editButton = document.getElementById("socialStudioManualEdit");
    editButton.disabled = !post.editable || state.context?.capabilities?.create === false;
    editButton.title = post.editable ? "Abrir o editor visual desta arte" : "Gere uma nova arte com o Engine V2 para editar os elementos";
    if (post.payload) applyDraft(post.payload, post.caption || "");
    updateTemplatePreviews(payload(), state.previewUrl);
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
    const fixedSchedule=['sessions-today','sessions-week'].includes(currentTemplate()?.id);
    document.getElementById('socialStudioScheduleMode').disabled=fixedSchedule || state.context?.capabilities?.create===false;
    document.getElementById('socialStudioShowSessions').disabled=fixedSchedule || state.context?.capabilities?.create===false;
    if(fixedSchedule) {setControl('socialStudioScheduleMode',currentTemplate().id==='sessions-today'?'today':'week');document.getElementById('socialStudioShowSessions').checked=true;}
    document.getElementById("socialStudioImageModes").querySelectorAll("label").forEach((label) => {
      const value = label.querySelector("input")?.value;
      label.hidden = !movieTemplate && ["backdrop", "poster"].includes(value);
    });
    renderStyles(document.querySelector("[name='socialStudioStyle']:checked")?.value || "");
    updateStyleRecommendation();
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
      templateId: checked("socialStudioTemplate", "movie-premiere"),
      polish: state.polish,
      formatId: value("socialStudioFormat", "feed_portrait"),
      outputType: value("socialStudioOutput", "png"),
      style: checked("socialStudioStyle", "cinematic"),
      visualStyle:value('socialStudioVisualStyle','cinematic'),
      layoutId:checked('socialStudioStyle','automatic')==='automatic' ? undefined : checked('socialStudioStyle'),
      look:value('socialStudioCompositionLook','cinematic'),
      automaticStyle: checked("socialStudioStyle", "automatic") === "automatic",
      artDirection: { enabled:true, heroMode:value("socialStudioHeroMode","edge-dissolve"), emphasis:value("socialStudioEmphasis","automatic"),grid:value("socialStudioDirectionGrid","automatic"),seed:Number(value("socialStudioDirectionSeed",0)),background:{...state.directionFrames.background},hero:{...state.directionFrames.hero},secondary:document.getElementById("socialStudioSecondaryArtwork").checked,foreground:value("socialStudioForeground","none"),shadow:Number(value("socialStudioHeroShadow",25)) },
      movieId: value("socialStudioMovie"),
      movieIds: [...document.querySelectorAll('[data-program-movie]')].map(select=>select.value).filter(Boolean),
      multiLayout: value('socialStudioMultiLayout','grid'),
      scheduleMode: value('socialStudioScheduleMode','week'),
      periodStart: value('socialStudioPeriodStart'),
      showSessions: document.getElementById('socialStudioShowSessions').checked,
      animation: {enabled:document.getElementById('socialStudioAnimated').checked,format:value('socialStudioAnimationFormat','mp4'),preset:value('socialStudioAnimationPreset','cinematic'),duration:Number(value('socialStudioMotionDuration',8)),loop:document.getElementById('socialStudioAnimationLoop').checked},
      concessionId: value("socialStudioConcession"),
      clubPlanId: value("socialStudioClub"),
      title: value("socialStudioTitle"),
      copyTone:value('socialStudioCopyTone','automatic'),
      copyDensity:value('socialStudioCopyDensity','medium'),
      copyLocks:Object.fromEntries([...document.querySelectorAll('[data-copy-lock]')].map(el=>[el.dataset.copyLock,el.checked])),
      subtitle: value("socialStudioSubtitle"),
      price: value("socialStudioPrice"),
      date: value("socialStudioDate"),
      primaryDateKind:value('socialStudioDateKind','release'),
      releaseDate:value('socialStudioReleaseDate'),
      presaleStartDate:value('socialStudioPresaleDate'),
      sessionDate:value('socialStudioSessionDate'),
      actionDestination:value('socialStudioActionDestination'),
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
      paletteId: checked("socialStudioPaletteId", "automatic"),
      composition: { enabled: document.getElementById("socialStudioCompositionEnabled").checked, preset: value("socialStudioCompositionPreset", "automatic"), look: value("socialStudioCompositionLook", "cinematic"), adjustments: { ...state.compositionAdjustments } },
      motion: { animationPreset: value("socialStudioMotionPreset", "slow-zoom"), duration: Number(value("socialStudioMotionDuration", 8)), easing: "ease-in-out" },
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
    document.querySelectorAll('[data-program-movie]').forEach((select,index)=>{select.value=draft.movieIds?.[index] || '';});
    setControl('socialStudioMultiLayout',draft.multiLayout || 'grid');
    setControl('socialStudioScheduleMode',draft.scheduleMode || 'week');
    setControl('socialStudioPeriodStart',draft.periodStart || '');
    document.getElementById('socialStudioShowSessions').checked=draft.showSessions!==false;
    document.getElementById('socialStudioAnimated').checked=draft.animation?.enabled===true;
    document.getElementById('socialStudioAnimationOptions').hidden=!draft.animation?.enabled;
    setControl('socialStudioAnimationFormat',draft.animation?.format || 'mp4');
    setControl('socialStudioAnimationPreset',draft.animation?.preset || 'cinematic');
    document.getElementById('socialStudioAnimationLoop').checked=draft.animation?.loop!==false;
    state.polish = draft.polish === true;
    invalidateThumbnails();
    const templateId = draft.templateId === "cinema-club" ? "club-plan" : draft.templateId;
    setRadio("socialStudioTemplate", templateId);
    updateFieldVisibility();
    renderStyles(draft.automaticStyle ? "automatic" : draft.layoutId || draft.style);
    setRadio("socialStudioStyle", draft.automaticStyle ? "automatic" : draft.layoutId || draft.style);
    setRadio("socialStudioPaletteId", draft.paletteId || "automatic");
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
      socialStudioCopyTone:draft.copyTone || 'automatic',
      socialStudioCopyDensity:draft.copyDensity || 'medium',
      socialStudioSubtitle: draft.subtitle,
      socialStudioPrice: draft.price,
      socialStudioDate: draft.date,
      socialStudioVisualStyle:draft.visualStyle || 'cinematic',
      socialStudioDateKind:draft.primaryDateKind || 'release',
      socialStudioReleaseDate:draft.releaseDate || '',
      socialStudioPresaleDate:draft.presaleStartDate || '',
      socialStudioSessionDate:draft.sessionDate || '',
      socialStudioActionDestination:draft.actionDestination || state.context.brand?.posterWebsite || state.context.brand?.website || '',
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
    document.querySelectorAll('[data-copy-lock]').forEach(el=>{el.checked=draft.copyLocks?.[el.dataset.copyLock]===true;});
    state.compositionAdjustments = { ...draft.composition?.adjustments };
    setControl("socialStudioCompositionPreset", draft.composition?.preset || "automatic");
    setControl("socialStudioCompositionLook", draft.composition?.look || "cinematic");
    document.getElementById("socialStudioCompositionEnabled").checked = draft.composition?.enabled !== false;
    setControl("socialStudioMotionPreset", draft.motion?.animationPreset || "slow-zoom");
    setControl("socialStudioMotionDuration", draft.motion?.duration || 8);
    syncCompositionControls();
    const direction=draft.artDirection || {};
    setControl("socialStudioHeroMode",direction.heroMode || "edge-dissolve");
    setControl("socialStudioEmphasis",direction.emphasis || "automatic");
    setControl("socialStudioDirectionGrid",direction.grid || "automatic");
    setControl("socialStudioDirectionSeed",direction.seed || 0);
    setControl("socialStudioForeground",direction.foreground || "none");
    setControl("socialStudioHeroShadow",direction.shadow ?? 25);
    document.getElementById("socialStudioSecondaryArtwork").checked=direction.secondary===true;
    state.directionFrames={background:{...direction.background},hero:{...direction.hero}};
    document.querySelectorAll("[data-direction-frame]").forEach(field=>{const v=state.directionFrames[field.dataset.directionFrame][field.dataset.directionKey];field.value=v===undefined?"":field.dataset.directionKey==="scale"?Math.round(v*100):v;});
    document.getElementById("socialStudioImageState").textContent = draft.imageUrl ? "Imagem personalizada" : "Imagem automática";
    document.getElementById("socialStudioImageClear").hidden = !draft.imageUrl;
    syncRangeOutputs();
    updateFieldVisibility();
    updatePreviewMeta();
    updateStyleRecommendation();
    updateTemplatePreviews(payload());
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
    stopMotion();
    if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
    state.previewBlob = blob;
    state.previewUrl = URL.createObjectURL(blob);
    const stage = document.getElementById("socialStudioPreviewStage");
    stage.innerHTML = `<img src="${state.previewUrl}" alt="${escapeHtml(alt)}" /><div id="socialStudioSafeArea" class="social-story-safe-area" ${currentFormat()?.id === "story" ? "" : "hidden"} aria-hidden="true"></div><span class="social-preview-progress" aria-hidden="true"></span>`;
    document.getElementById("socialStudioPreviewDownload").disabled = false;
    state.activePostId = "";
    document.getElementById("socialStudioManualEdit").disabled = true;
    updateTemplatePreviews(payload(), state.previewUrl);
  }

  async function updatePreview(options = {}) {
    stopMotion();
    if (state.context?.capabilities?.create === false) return;
    const data = payload();
    const key = previewCacheKey(data);
    const version = ++state.previewVersion;
    state.previewAbort?.abort();
    if (!options.force && state.previewCache.has(key)) {
      state.previewing = false;
      displayPreview(state.previewCache.get(key), data.title);
      renderNotices(state.previewNotices.get(key) || []);
      setStatus("Prévia atualizada.", "ok");
      return;
    }
    state.previewing = true;
    state.previewAbort?.abort();
    state.previewAbort = new AbortController();
    document.getElementById("socialStudioPreviewStage")?.classList.add("is-rendering");
    setStatus("Atualizando a composição...", "loading");
    try {
      const resolved = await request('/api/admin/social-studio/resolve',{method:'POST',body:JSON.stringify(data),signal:state.previewAbort.signal});
      if(version!==state.previewVersion) return;
      renderNotices(resolved.notices || []);
      state.previewNotices.set(key,resolved.notices || []);
      if(state.previewNotices.size>8) state.previewNotices.delete(state.previewNotices.keys().next().value);
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

  function schedulePreview(delay = 300) {
    state.animationAbort?.abort();
    stopMotion();
    invalidateThumbnails();
    state.previewVersion++;
    state.previewAbort?.abort();
    window.clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(() => updatePreview(), delay);
  }

  function stopMotion() {
    document.getElementById('socialStudioEncodedPreview')?.remove();
    state.motionVersion++;
    state.motionAbort?.abort();
    state.motionAbort = null;
    state.motionPlaying = false;
    document.getElementById("socialStudioMotionPlanes")?.remove();
    const button = document.getElementById("socialStudioMotionPlay");
    if (button) { button.textContent = "Reproduzir prévia"; button.disabled = state.context?.capabilities?.create === false; }
  }

  async function playMotion() {
    if(document.getElementById('socialStudioAnimated').checked) { await generateAnimation(false); return; }
    if (state.motionPlaying || state.motionAbort) { stopMotion(); return; }
    clearTimeout(state.previewTimer);
    state.previewAbort?.abort();
    state.previewVersion++;
    const version = ++state.motionVersion;
    const controller = new AbortController();
    state.motionAbort = controller;
    const button = document.getElementById("socialStudioMotionPlay");
    button.textContent = "Cancelar preparação";
    setStatus("Preparando as camadas da prévia animada...", "loading");
    try {
      const data = await request("/api/admin/social-studio/motion-preview", { method: "POST", body: JSON.stringify(payload()), signal: controller.signal });
      if (version !== state.motionVersion) return;
      const container = document.createElement("div");
      container.id = "socialStudioMotionPlanes";
      container.className = `social-motion-planes social-motion--${data.motion.animationPreset}`;
      container.style.setProperty("--motion-duration", `${data.motion.duration}s`);
      await Promise.all(data.layers.map(async (layer) => {
        const img = new Image(); img.alt = ""; img.className = `social-motion-${layer.role}`; img.src = layer.src;
        container.appendChild(img);
        await img.decode();
      }));
      if (version !== state.motionVersion) return;
      document.getElementById("socialStudioPreviewStage").classList.remove("is-rendering");
      document.getElementById("socialStudioPreviewStage").appendChild(container);
      state.motionPlaying = true;
      button.textContent = "Parar prévia";
      setStatus("Prévia animada · download disponível em PNG ou JPG.", "ok");
    } catch (error) { if (error.name !== "AbortError") { stopMotion(); setStatus(error.message, "error"); } }
    finally { if (version === state.motionVersion) state.motionAbort = null; }
  }

  function variationCard(variation, index, favorite = false) {
    const quality = variation.quality || {};
    const source = favorite ? "favorite" : "variation";
    const favoriteSaved = state.favorites.some(item => previewCacheKey(item.draft) === previewCacheKey(variation.draft));
    return `<article class="social-variation ${variation.recommended ? "is-recommended" : ""}">
      <img src="${escapeHtml(variation.image)}" alt="${escapeHtml(variation.name)}" />
      <strong>${escapeHtml(variation.classification || "Favorita")} · ${quality.total ?? quality.score}/100</strong>
      <strong>${escapeHtml(variation.name)}</strong><span>${escapeHtml(variation.intent || "")}</span>
      <span>${escapeHtml(quality.explanation || "")}</span>
      <span>${variation.refined ? `Acabamento aplicado: ${variation.beforeQuality?.total ?? quality.total} → ${quality.total}` : "Composição avaliada"}</span>
      <details><summary>Pontuação por critério</summary><dl>${Object.entries({contrast:"Contraste",hierarchy:"Hierarquia",readability:"Leitura",balance:"Equilíbrio",branding:"Marca",commercialClarity:"Clareza comercial",safeArea:"Área segura",footer:"Rodapé"}).map(([key,label])=>`<div><dt>${label}</dt><dd>${quality[key] ?? "—"}</dd></div>`).join("")}</dl></details>
      <div class="social-variation-actions">${[["use","Usar esta"],["edit","Editar detalhes"],["similar","Gerar parecidas"],["hierarchy","Manter hierarquia"],["favorite",favorite ? "Remover favorita" : favoriteSaved ? "Favorita fixada" : "Fixar como favorita"]].map(([action,label])=>`<button type="button" class="${action === "use" ? "primary-button" : "ghost-button"}" data-curation-source="${source}" data-curation-index="${index}" data-curation-action="${action}" ${action === "favorite" && !favorite && favoriteSaved ? "disabled" : ""}>${label}</button>`).join("")}</div>
    </article>`;
  }

  function renderFavorites() {
    const target = document.getElementById("socialStudioFavorites");
    target.hidden = !state.favorites.length;
    target.innerHTML = `<h3>Favoritas neste navegador</h3><div class="social-variations-grid">${state.favorites.map((item,index)=>variationCard(item,index,true)).join("")}</div>`;
  }

  async function handleCurationAction(event) {
    const button = event.target.closest("[data-curation-action]");
    if (!button || button.disabled) return;
    const index = Number(button.dataset.curationIndex);
    const favorite = button.dataset.curationSource === "favorite";
    const variation = (favorite ? state.favorites : state.variations)[index];
    if (!variation) return;
    const action = button.dataset.curationAction;
    if (action === "favorite") {
      const next = favorite ? state.favorites.filter((_, itemIndex)=>itemIndex !== index) : [variation,...state.favorites].slice(0,8);
      try { localStorage.setItem(state.favoriteKey,JSON.stringify(next)); state.favorites=next; renderFavorites(); if(!favorite){button.textContent="Favorita fixada";button.disabled=true;} }
      catch { notify("Não foi possível salvar a favorita neste navegador.","error"); }
      return;
    }
    if (state.context?.capabilities?.create === false) return;
    if (["similar","hierarchy"].includes(action)) { await generateVariations({ variationMode: action, draft: variation.draft }); return; }
    if (state.generating) return;
    state.styleManuallySelected = true;
    applyDraft({...variation.draft,automaticStyle:false},variation.draft.caption || value("socialStudioCaption"));
    saveDraftLocal();
    await updatePreview({force:true});
    if(action === "edit") { const post = await generatePost(); if(post?.id) window.location.href=`${basePath}/social-editor?postId=${encodeURIComponent(post.id)}`; }
  }

  async function generateVariations(options = {}) {
    const button=document.getElementById("socialStudioVariationsButton");
    const version=++state.variationVersion,data={...(options.draft || payload()),variationMode:options.variationMode || "explore"},key=previewCacheKey(payload());
    state.variationAbort?.abort();
    state.variationAbort=new AbortController();
    button.disabled=true;button.textContent="Compondo variações...";
    const target=document.getElementById("socialStudioVariations");
    target.hidden=false;target.textContent="Analisando enquadramento, hierarquia e contraste...";
    try {
      const result=await request("/api/admin/social-studio/variations",{method:"POST",body:JSON.stringify(data),signal:state.variationAbort.signal});
      if(version!==state.variationVersion)return;
      if(key!==previewCacheKey(payload())) {target.textContent="A configuração mudou durante a geração. Gere novas variações para comparar.";return;}
      state.variations=result.variations;
      target.innerHTML=`<div class="social-variations-head"><h3>Melhores composições</h3><span>${result.evaluatedCount || result.variations.length} avaliadas · ${result.variations.length} selecionadas</span></div><div class="social-variations-grid">${result.variations.map((v,i)=>variationCard(v,i)).join("")}</div>${result.notices.map(n=>`<p>${escapeHtml(n)}</p>`).join("")}`;
      target.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
    } catch(error){if(version===state.variationVersion && error.name!=="AbortError")target.textContent=error.message;}
    finally {if(version===state.variationVersion){button.disabled=state.context?.capabilities?.create===false;button.textContent="Gerar variações";}}
  }

  async function generateAnimation(download = false) {
    if(state.context?.capabilities?.create===false || state.animationBusy) return;
    const data=payload(),key=previewCacheKey(data),button=document.getElementById('socialStudioAnimationExport');
    state.animationBusy=true;button.disabled=true;button.textContent='Preparando animação...';
    const controller=new AbortController();state.animationAbort=controller;
    setStatus('Gerando vídeo com tempo de leitura protegido...', 'loading');
    try {
      if(state.animationKey!==key || !state.animationUrl) {
        const blob=await requestImage('/api/admin/social-studio/animation',data,controller.signal);
        if(key!==previewCacheKey(payload())) {setStatus('A campanha mudou. Gere a animação atualizada.','warning');return;}
        if(state.animationUrl) URL.revokeObjectURL(state.animationUrl);
        state.animationUrl=URL.createObjectURL(blob);state.animationKey=key;
      }
      document.getElementById('socialStudioEncodedPreview')?.remove();
      const media=document.createElement(data.animation.format==='gif'?'img':'video');
      media.id='socialStudioEncodedPreview';media.src=state.animationUrl;
      if(media.tagName==='VIDEO') {media.controls=true;media.autoplay=true;media.muted=true;media.loop=data.animation.loop;media.playsInline=true;media.poster=state.previewUrl;}
      else media.alt='Prévia animada da campanha';
      document.getElementById('socialStudioPreviewStage').appendChild(media);
      const width=data.animation.format==='gif'?480:720,format=currentFormat();
      document.getElementById('socialStudioPreviewMeta').textContent=`Prévia animada · ${width} × ${Math.round(width*format.height/format.width/2)*2} · ${data.animation.format.toUpperCase()}`;
      if(download) {const link=document.createElement('a');link.href=state.animationUrl;link.download=`campanha.${data.animation.format}`;link.click();}
      setStatus('Animação pronta. A duração pode ser ampliada para preservar a leitura.','ok');
    } catch(error) {if(error.name!=='AbortError')setStatus(error.message,'error');}
    finally {state.animationBusy=false;state.animationAbort=null;button.disabled=state.context?.capabilities?.create===false;button.textContent='Exportar animação';}
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
    invalidateThumbnails();
    clearTimeout(state.previewTimer);
    state.previewVersion++;
    state.previewAbort?.abort();
    const version = ++state.resolveVersion;
    state.resolving = true;
    setStatus("Carregando dados atuais do painel...", "loading");
    try {
      const base = payload();
      if (options.resetCopy !== false) {
        const locks={title:'headline',subtitle:'kicker',auxiliaryText:'supportingText',cta:'cta',caption:'caption'};
        ["title", "subtitle", "price", "date", "auxiliaryText", "cta", "caption"].forEach((key) => { if(!base.copyLocks?.[locks[key]]) base[key] = undefined; });
        base.generateCopy=true;
        base.releaseDate=undefined;base.sessionDate=undefined;
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
      showSavedPost(result.post);
      setStatus("Arte adicionada ao histórico.", "ok");
      notify("Arte social gerada com sucesso.");
      return result.post;
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
          <div class="social-history-badges"><span>${escapeHtml(post.templateName || "Arte")}</span><span>${post.rendererVersion === "v2" ? "Engine V2" : "Legado"}</span><span data-status="ready">${post.hasEditedScene ? "Editada" : post.status === "draft" ? "Rascunho" : "Automática"}</span></div>
          <strong>${escapeHtml(post.title || post.templateName)}</strong>
          <span>${escapeHtml(post.contentName || post.title || "")}</span>
          <small>${escapeHtml(post.formatName || post.formatId || "")} · ${String(post.outputType || "png").toUpperCase()}</small>
          ${post.createdByName ? `<small>Criado por ${escapeHtml(post.createdByName)}</small>` : ""}
          <time>${post.createdAt ? new Date(post.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}</time>
        </div>
        <div class="social-history-actions">
          <button class="ghost-button" type="button" data-social-action="view" data-social-id="${escapeHtml(post.id)}">Visualizar</button>
          ${state.context.capabilities?.create !== false && post.editable ? `<button class="primary-button" type="button" data-social-action="edit-details" data-social-id="${escapeHtml(post.id)}">Editar detalhes</button>` : ""}
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
    if (button.dataset.socialAction === "edit-details") {
      window.location.href = `${basePath}/social-editor?postId=${encodeURIComponent(post.id)}`;
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
    for(const [field,id] of Object.entries({headline:'socialStudioTitle',kicker:'socialStudioSubtitle',supportingText:'socialStudioAuxiliary',cta:'socialStudioCta',caption:'socialStudioCaption'})) {
      const control=document.getElementById(id);
      const row=document.createElement('div');row.className='social-copy-actions';
      row.innerHTML=`<button type="button" class="ghost-button" data-copy-field="${field}" data-requires-create>Outra sugestão</button><label class="social-toggle"><input type="checkbox" data-copy-lock="${field}" data-requires-create /> Manter texto</label>`;
      const holder=control.closest('label');
      if(holder?.dataset.socialField) row.dataset.socialField=holder.dataset.socialField;
      (holder || control).insertAdjacentElement('afterend',row);
      row.querySelector('button').addEventListener('click',async event=>{
        const button=event.currentTarget;
        if(row.querySelector('input').checked) {setStatus('Este texto está marcado para ser mantido.');return;}
        button.disabled=true;
        const original=control.value,entityKey=JSON.stringify([payload().movieId,payload().templateId,payload().concessionId,payload().clubPlanId]);
        try {
          const result=await request('/api/admin/social-studio/copy',{method:'POST',body:JSON.stringify({...payload(),copySeed:state.copySeed=(state.copySeed || 0)+1})});
          if(control.value!==original || row.querySelector('input').checked || entityKey!==JSON.stringify([payload().movieId,payload().templateId,payload().concessionId,payload().clubPlanId])) return;
          control.value=result.bundle[field];saveDraftLocal();if(field!=='caption')schedulePreview();
        } catch(error) {setStatus(error.message,'error');} finally {button.disabled=false;}
      });
    }
    form.addEventListener("submit", generatePost);
    document.getElementById("socialStudioPreviewButton").addEventListener("click", () => updatePreview({ force: true }));
    document.getElementById("socialStudioCampaignButton").addEventListener("click", generateCampaign);
    document.getElementById("socialStudioPreviewDownload").addEventListener("click", downloadPreview);
    document.getElementById("socialStudioMotionPlay").addEventListener("click", playMotion);
    document.getElementById('socialStudioAnimationExport').addEventListener('click',()=>generateAnimation(true));
    document.getElementById('socialStudioAnimated').addEventListener('change',async event=>{
      const enabled=event.target.checked;
      document.getElementById('socialStudioAnimationOptions').hidden=!enabled;
      stopMotion();state.animationAbort?.abort();saveDraftLocal();
      if(enabled) {clearTimeout(state.previewTimer);await updatePreview({force:true});if(document.getElementById('socialStudioAnimated').checked)await generateAnimation(false);}
    });
    document.getElementById("socialStudioVariationsButton").addEventListener("click",generateVariations);
    document.getElementById("socialStudioVariations").addEventListener("click", event=>handleCurationAction(event).catch(error=>notify(error.message,"error")));
    document.getElementById("socialStudioFavorites").addEventListener("click", event=>handleCurationAction(event).catch(error=>notify(error.message,"error")));
    renderFavorites();
    document.getElementById("socialStudioCompositionReset").addEventListener("click", () => { state.compositionAdjustments = {}; syncCompositionControls(); saveDraftLocal(); schedulePreview(); });
    document.getElementById("socialStudioManualEdit").addEventListener("click", () => {
      if (state.activePostId) window.location.href = `${basePath}/social-editor?postId=${encodeURIComponent(state.activePostId)}`;
    });
    document.getElementById("socialStudioReadyFilters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-social-ready-filter]");
      if (!button) return;
      state.readyCollection = button.dataset.socialReadyFilter;
      state.readyPage = 1;
      renderReadyPosts();
      applyCapabilities();
    });
    document.getElementById("socialStudioReadyPager").addEventListener("click", (event) => {
      const button = event.target.closest("[data-ready-page]");
      if (!button || button.disabled) return;
      state.readyPage = Number(button.dataset.readyPage);
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
      document.getElementById(id).addEventListener("change", () => {
        if (id === "socialStudioMovie") {
          state.styleManuallySelected = false;
          updateStyleRecommendation({ apply: true });
        }
        resolveDefaults({ resetCopy: true });
      });
    });
    form.addEventListener("input", (event) => {
      if(event.target.id==='socialStudioAnimated') return;
      if (!["socialStudioCaption","socialStudioPreviewZoom"].includes(event.target.id)) document.getElementById("socialStudioVariations").hidden = true;
      const frame=event.target.dataset.directionFrame,frameKey=event.target.dataset.directionKey;
      if(frame&&frameKey){const next=event.target.valueAsNumber;if(!Number.isFinite(next))delete state.directionFrames[frame][frameKey];else state.directionFrames[frame][frameKey]=frameKey==="scale"?next/100:next;}
      const key = event.target.dataset.compositionEffect;
      if (key) {
        const next = event.target.value;
        state.compositionAdjustments[key === "darkening" ? "brightness" : key] = key === "darkening" ? 1 - Number(next) / 100 : ["saturation", "contrast"].includes(key) ? Number(next) / 100 : ["mask", "overlay"].includes(key) ? next : Number(next);
        syncCompositionControls();
      }
      syncRangeOutputs();
      saveDraftLocal();
      if (event.target.id !== "socialStudioCaption" && event.target.id !== "socialStudioPreviewZoom" && !event.target.matches("[name='socialStudioTemplate'], #socialStudioMovie, #socialStudioConcession, #socialStudioClub, #socialStudioImageUpload")) schedulePreview(300);
    });
    form.addEventListener("change", (event) => {
      if(event.target.id==='socialStudioAnimated') return;
      if (!["socialStudioCaption","socialStudioPreviewZoom"].includes(event.target.id)) document.getElementById("socialStudioVariations").hidden = true;
      if (["socialStudioCompositionPreset", "socialStudioCompositionLook"].includes(event.target.id)) { state.compositionAdjustments = {}; syncCompositionControls(); }
      if (event.target.matches("[name='socialStudioTemplate'], #socialStudioMovie, #socialStudioConcession, #socialStudioClub, #socialStudioImageUpload")) return;
      updatePreviewMeta();
      saveDraftLocal();
      if (event.target.name === "socialStudioStyle") {
        state.styleManuallySelected = true;
        updateStyleRecommendation();
      }
      if (event.target.id !== "socialStudioCaption") schedulePreview(300);
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
  if (new URLSearchParams(window.location.search).get("studio") === "1") socialTab?.click();
  if (socialTab?.classList.contains("active")) init();
})();
