(() => {
  const $s = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const endpoint = "/api/admin/canva-studio";
  const studio = { loaded: false, overview: null, templates: [], campaigns: [], activeId: "", running: false, tab: "create" };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const canManage = () => ["owner", "master"].includes(state.adminUser?.role) || (state.adminUser?.effectivePermissions || []).includes("integrations.manage");
  const safeCanvaUrl = (value) => { try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "canva.com" || url.hostname.endsWith(".canva.com")) ? url.href : ""; } catch { return ""; } };
  const imageUrl = (value) => {
    try {
      const local = String(value || "");
      const source = /^\/(?:uploads|images)\//.test(local) ? `${API_BASE}${local}` : local;
      const url = new URL(source, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };

  function message(value, error = false) {
    const node = $s("studioMessage");
    node.textContent = value || "";
    node.hidden = !value;
    node.classList.toggle("error", error);
  }
  function tab(name) {
    studio.tab = name;
    document.querySelectorAll("[data-studio-tab]").forEach((button) => {
      const active = button.dataset.studioTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-studio-view]").forEach((view) => {
      view.hidden = view.dataset.studioView !== name;
      view.classList.toggle("active", !view.hidden);
    });
    if (name === "campaigns") void loadCampaigns();
    if (name === "templates") void loadTemplates();
    if (name === "connection") void loadOverview();
  }

  async function loadOverview() {
    try {
      const data = await api(`${endpoint}/overview`);
      studio.overview = data;
      studio.loaded = true;
      $s("studioCreateButton").disabled = !data.configured || !data.connection?.connected;
      $s("studioConnectionBadge").textContent = data.connection?.connected ? "Canva conectado" : "Canva não conectado";
      $s("studioConnectionBadge").classList.toggle("muted", !data.connection?.connected);
      const select = $s("studioMovie");
      const previous = select.value;
      select.innerHTML = `<option value="">Selecione um filme</option>${(data.movies || []).map((movie) => `<option value="${esc(movie.id)}">${esc(movie.title)}</option>`).join("")}`;
      select.value = previous;
      movieChanged();
      renderConnection();
      if (!data.configured) message("Configure o app Canva em Integrações para começar.");
      else if (!data.connection?.connected) message("Conecte sua conta Canva para validar templates e criar campanhas.");
      else message("");
    } catch (error) { message(error.message, true); }
  }

  function renderConnection() {
    const overview = studio.overview;
    if (!overview) return;
    const configured = overview.configured;
    const connected = overview.connection?.connected;
    $s("studioConnectionBody").innerHTML = `
      <p><strong>${connected ? "Canva conectado" : configured ? "Aguardando conexão" : "Configuração pendente"}</strong></p>
      <p>${connected ? `Conta ${esc(overview.connection.accountId || "conectada")}. Os templates cadastrados nessa conta podem ser validados e usados em campanhas.` : configured ? "Autorize a conta que possui acesso aos Brand Templates." : "Crie um app no Canva Developers e configure Client ID, Client Secret e URL de retorno em Integrações."}</p>
      <div class="studio-form-actions">
        ${configured && canManage() ? `<button class="primary-button" type="button" data-studio-action="connect">${connected ? "Reconectar Canva" : "Conectar Canva"}</button>` : ""}
        ${canManage() ? `<button class="ghost-button" type="button" data-studio-action="integrations">Abrir Integrações</button>` : ""}
      </div>
      <p><a href="https://www.canva.dev/" target="_blank" rel="noopener noreferrer">Canva Developers</a> · <a href="https://www.canva.dev/docs/apps/rest-apis/autofill-guide/" target="_blank" rel="noopener noreferrer">Guia oficial de Autofill</a></p>`;
  }

  function movieChanged() {
    const movie = studio.overview?.movies?.find((entry) => entry.id === $s("studioMovie").value);
    const preview = $s("studioMoviePreview");
    preview.innerHTML = movie ? `${movie.posterUrl ? `<img src="${esc(imageUrl(movie.posterUrl))}" alt="Pôster de ${esc(movie.title)}" />` : ""}<div><strong>${esc(movie.title)}</strong><small>${esc(Array.isArray(movie.genre) ? movie.genre.join(", ") : movie.genre || "Gênero não informado")}</small><small>${(movie.sessions || []).length} sessão(ões) cadastrada(s)</small></div>` : "<span>Selecione um filme para começar.</span>";
    const session = $s("studioSession");
    session.innerHTML = `<option value="">Selecione uma sessão</option>${(movie?.sessions || []).map((entry) => `<option value="${esc(entry.id)}">${esc(entry.date || String(entry.startsAt || "").slice(0, 10))} · ${esc(entry.time || entry.timeLabel || String(entry.startsAt || "").slice(11, 16))}</option>`).join("")}`;
  }

  function campaignTypeChanged() {
    $s("studioSessionField").hidden = document.querySelector('input[name="studioType"]:checked')?.value !== "session";
  }

  async function loadTemplates() {
    try { studio.templates = (await api(`${endpoint}/templates`)).templates || []; renderTemplates(); }
    catch (error) { message(error.message, true); }
  }
  function renderTemplates() {
    $s("studioTemplateList").innerHTML = studio.templates.length ? studio.templates.map((item) => `<div class="studio-list-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.metadata?.family || "Sem família")} · ${item.validation?.valid ? item.active ? "Ativo" : "Válido, inativo" : "Pendente de validação"}</small>${item.last_error ? `<small>${esc(item.last_error)}</small>` : ""}</div><div class="studio-row-actions">${canManage() ? `<button class="ghost-button" type="button" data-studio-action="edit-template" data-id="${esc(item.id)}">Editar</button><button class="ghost-button" type="button" data-studio-action="validate-template" data-id="${esc(item.id)}">Validar</button><button class="ghost-button" type="button" data-studio-action="fixture-template" data-id="${esc(item.id)}">Testar com filme</button><button class="ghost-button" type="button" data-studio-action="toggle-template" data-id="${esc(item.id)}">${item.active ? "Desativar" : "Ativar"}</button>` : ""}</div></div>`).join("") : `<div class="studio-empty">Nenhum Brand Template registrado. Crie templates com campos Autofill no Canva e adicione suas referências aqui.</div>`;
  }
  function openTemplate(item = null) {
    const form = $s("studioTemplateForm");
    form.hidden = false;
    $s("studioTemplateFormTitle").textContent = item ? "Editar template" : "Novo template";
    $s("studioTemplateLocalId").value = item?.id || "";
    $s("studioTemplateName").value = item?.name || "";
    $s("studioTemplateCanvaId").value = item?.canva_template_id || "";
    $s("studioTemplateFamily").value = item?.metadata?.family || "hero";
    $s("studioTemplateOrientation").value = item?.metadata?.orientation || "portrait";
    $s("studioTemplateTitleCapacity").value = item?.metadata?.titleCapacity || "long";
    $s("studioTemplateInfoCapacity").value = item?.metadata?.informationCapacity || "medium";
    $s("studioTemplateProfiles").value = (item?.metadata?.profiles || []).join(", ");
    form.querySelectorAll('.studio-template-types input[type="checkbox"]').forEach((input) => { input.checked = (item?.metadata?.campaignTypes || ["campaign"]).includes(input.value); });
    form.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  async function saveTemplate(event) {
    event.preventDefault();
    const id = $s("studioTemplateLocalId").value;
    const previous = studio.templates.find((item) => item.id === id);
    const body = { id: id || undefined, name: $s("studioTemplateName").value, canvaTemplateId: $s("studioTemplateCanvaId").value, active: previous?.active || false, metadata: { ...(previous?.metadata || {}), family: $s("studioTemplateFamily").value, orientation: $s("studioTemplateOrientation").value, titleCapacity: $s("studioTemplateTitleCapacity").value, informationCapacity: $s("studioTemplateInfoCapacity").value, profiles: $s("studioTemplateProfiles").value.split(",").map((value) => value.trim()).filter(Boolean), campaignTypes: [...$s("studioTemplateForm").querySelectorAll('.studio-template-types input:checked')].map((input) => input.value) } };
    try { await api(`${endpoint}/templates`, { method: "POST", body: JSON.stringify(body) }); $s("studioTemplateForm").hidden = true; message("Template salvo. Valide os campos Autofill antes de ativar."); await loadTemplates(); }
    catch (error) { message(error.message, true); }
  }

  async function loadCampaigns() {
    try { studio.campaigns = (await api(`${endpoint}/campaigns`)).campaigns || []; renderCampaigns(); }
    catch (error) { message(error.message, true); }
  }
  function renderCampaigns() {
    $s("studioCampaignList").innerHTML = studio.campaigns.length ? studio.campaigns.map((item) => `<div class="studio-list-row"><div><strong>${esc(item.movieTitle)}</strong><small>${esc(item.type)} · ${new Date(item.createdAt).toLocaleDateString("pt-BR")} · ${esc(item.status)}</small></div><div class="studio-row-actions"><button class="ghost-button" type="button" data-studio-action="open-campaign" data-id="${esc(item.id)}">Abrir</button><button class="ghost-button" type="button" data-studio-action="duplicate-campaign" data-id="${esc(item.id)}">Duplicar</button></div></div>`).join("") : `<div class="studio-empty">Nenhuma campanha criada ainda.</div>`;
  }

  function renderCampaign(campaign) {
    const done = campaign.status === "completed" || campaign.status === "failed";
    const options = campaign.options || [];
    $s("studioResult").innerHTML = `<div class="studio-section-heading"><h2>${esc(campaign.movieTitle)}</h2><span>${esc(campaign.stage || campaign.status)}</span></div>
      <div class="studio-options">${options.map((option, index) => `<article class="studio-option">${option.previewUrl ? `<img src="${esc(imageUrl(option.previewUrl))}" alt="Prévia ${index + 1} do design" />` : `<div class="studio-option-placeholder">${option.status === "completed" ? "Prévia temporariamente indisponível" : esc(option.status === "failed" ? "Falha" : "Preparando design")}</div>`}<div class="studio-option-content"><strong>Opção ${String.fromCharCode(65 + index)} · ${esc(option.templateName)}</strong><small>${esc(option.status === "failed" ? option.error?.message || "Falha no Canva" : option.status === "completed" ? "Pronto para editar" : "Canva Autofill em andamento")}</small><div class="studio-option-actions">${option.designId ? `<button class="primary-button" type="button" data-studio-action="edit-design" data-url="${esc(safeCanvaUrl(option.editUrl))}" ${option.editUrl ? "" : "disabled"}>Editar no Canva</button><button class="ghost-button" type="button" data-studio-action="export-design" data-campaign="${esc(campaign.id)}" data-id="${esc(option.templateId)}" data-format="png">PNG</button><button class="ghost-button" type="button" data-studio-action="export-design" data-campaign="${esc(campaign.id)}" data-id="${esc(option.templateId)}" data-format="jpg">JPG</button>` : ""}</div></div></article>`).join("")}</div>`;
    if (done && campaign.status === "failed") message(campaign.error?.message || "A campanha não pôde ser criada. Verifique as alternativas.", true);
  }

  async function openCampaign(id, resume = true) {
    studio.activeId = id;
    tab("create");
    try {
      const campaign = (await api(`${endpoint}/campaigns/${encodeURIComponent(id)}`)).campaign;
      renderCampaign(campaign);
      if (resume && !["completed", "failed"].includes(campaign.status)) void runCampaign(id);
    } catch (error) { message(error.message, true); }
  }
  async function runCampaign(id) {
    if (studio.running) return;
    studio.running = true;
    $s("studioCreateButton").disabled = true;
    try {
      for (let step = 0; step < 80 && studio.activeId === id; step++) {
        const data = await api(`${endpoint}/campaigns/${encodeURIComponent(id)}/advance`, { method: "POST", body: "{}" });
        renderCampaign(data.campaign);
        if (["completed", "failed"].includes(data.campaign.status)) { await openCampaign(id, false); await loadCampaigns(); return; }
        await pause(data.campaign.stage === "autofill_wait" || data.campaign.stage === "upload_wait" ? 2500 : 300);
      }
      message("A criação continua no Canva. Abra esta campanha novamente para atualizar.");
    } catch (error) { message(error.message, true); }
    finally { studio.running = false; $s("studioCreateButton").disabled = false; }
  }
  async function createCampaign(event) {
    event.preventDefault();
    const type = document.querySelector('input[name="studioType"]:checked')?.value || "campaign";
    const movieId = $s("studioMovie").value;
    const sessionId = $s("studioSession").value;
    if (!movieId || (type === "session" && !sessionId)) { message("Selecione o filme e a sessão para continuar.", true); return; }
    try {
      message("");
      $s("studioCreateButton").disabled = true;
      studio.pendingRequestKey ||= crypto.randomUUID();
      const requestKey = studio.pendingRequestKey;
      const result = await api(`${endpoint}/campaigns`, { method: "POST", body: JSON.stringify({ movieId, type, sessionId, requestKey }) });
      studio.pendingRequestKey = "";
      studio.activeId = result.campaign.id;
      renderCampaign(result.campaign);
      void runCampaign(result.campaign.id);
    } catch (error) { message(error.message, true); $s("studioCreateButton").disabled = false; }
  }

  async function exportDesign(campaignId, optionId, format) {
    try {
      let result;
      for (let attempt = 0; attempt < 25; attempt++) {
        result = (await api(`${endpoint}/campaigns/${encodeURIComponent(campaignId)}/options/${encodeURIComponent(optionId)}/exports`, { method: "POST", body: JSON.stringify({ format }) })).export;
        if (result.status === "success") break;
        if (result.status === "failed") throw new Error(result.error?.message || "Exportação falhou no Canva.");
        await pause(2500);
      }
      const url = (result?.urls || []).map(safeCanvaUrl).find(Boolean);
      if (!url) throw new Error("O arquivo ainda não está disponível. Tente novamente em instantes.");
      window.open(url, "_blank", "noopener,noreferrer");
      message("Exportação pronta. O link temporário do Canva foi aberto.");
    } catch (error) { message(error.message, true); }
  }

  async function act(event) {
    const button = event.target.closest("[data-studio-action]");
    if (!button) return;
    const { studioAction: action, id } = button.dataset;
    try {
      if (action === "integrations") { activatePanel("integrationsPanel", { scroll: true }); return; }
      if (action === "connect") { const result = await api(`${endpoint}/oauth/start`, { method: "POST", body: "{}" }); window.location.assign(result.url); return; }
      if (action === "edit-template") { openTemplate(studio.templates.find((item) => item.id === id)); return; }
      if (action === "validate-template") { await api(`${endpoint}/templates/${encodeURIComponent(id)}/validate`, { method: "POST", body: "{}" }); await loadTemplates(); message("Campos do template verificados no Canva."); return; }
      if (action === "fixture-template") { const movieId = $s("studioMovie").value; if (!movieId) throw new Error("Selecione um filme em Criar campanha antes de testar o template."); const type = document.querySelector('input[name="studioType"]:checked')?.value || "campaign"; const result = (await api(`${endpoint}/templates/${encodeURIComponent(id)}/fixture`, { method: "POST", body: JSON.stringify({ movieId, type, sessionId: $s("studioSession").value }) })).fixture; message(result.compatible ? `${result.templateName}: compatível com este filme e objetivo.` : `${result.templateName}: incompatível. Assets ausentes: ${result.missingAssets.join(", ") || "verifique campos e objetivo"}.`, !result.compatible); return; }
      if (action === "toggle-template") { const item = studio.templates.find((entry) => entry.id === id); if (!item?.validation?.valid && !item?.active) throw new Error("Valide o template antes de ativá-lo."); await api(`${endpoint}/templates`, { method: "POST", body: JSON.stringify({ id, name: item.name, canvaTemplateId: item.canva_template_id, metadata: item.metadata, active: !item.active }) }); await loadTemplates(); return; }
      if (action === "open-campaign") { await openCampaign(id); return; }
      if (action === "duplicate-campaign") { const result = await api(`${endpoint}/campaigns/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: "{}" }); await openCampaign(result.campaign.id); return; }
      if (action === "edit-design") { const url = safeCanvaUrl(button.dataset.url); if (url) window.open(url, "_blank", "noopener,noreferrer"); return; }
      if (action === "export-design") { button.disabled = true; await exportDesign(button.dataset.campaign, id, button.dataset.format); button.disabled = false; }
    } catch (error) { message(error.message, true); button.disabled = false; }
  }

  document.querySelectorAll("[data-studio-tab]").forEach((button) => button.addEventListener("click", () => tab(button.dataset.studioTab)));
  $s("studioMovie").addEventListener("change", movieChanged);
  document.querySelectorAll('input[name="studioType"]').forEach((input) => input.addEventListener("change", campaignTypeChanged));
  $s("studioCreateForm").addEventListener("submit", createCampaign);
  $s("studioTemplateForm").addEventListener("submit", saveTemplate);
  $s("studioNewTemplate").addEventListener("click", () => openTemplate());
  $s("studioCancelTemplate").addEventListener("click", () => { $s("studioTemplateForm").hidden = true; });
  $s("studioRefreshCampaigns").addEventListener("click", loadCampaigns);
  $s("studioPanel").addEventListener("click", act);
  document.addEventListener("admin:panel", (event) => { if (event.detail.panel === "studioPanel" && !studio.loaded) void loadOverview(); });
  if ($s("studioPanel").classList.contains("active")) void loadOverview();
})();
