const API_BASE = (() => {
  const pathname = window.location.pathname || "";
  const adminIndex = pathname.indexOf("/admin");
  return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
})();
const QR_SCAN_DURATION_MS = 30000;

let state = {
  content: null,
  adminUser: null,
  selectedMovieId: "",
  selectedRoomId: "",
  roomSeatDraft: null,
  roomSeatSelection: null,
  selectedTicketId: "",
  selectedConcessionId: "",
  selectedPromotionId: "",
  selectedAdId: "",
  selectedUserId: "",
  selectedIntegrationKey: "",
  selectedClubPlanId: "",
  selectedOrderId: "",
  dashboard: null,
  integrations: null,
  fiscal: null,
  fiscalPage: 1,
  fiscalFilters: { search: "", status: "", from: "", to: "" },
  logs: null,
  logsPage: 1,
  logsPageSize: 40,
  logsView: "business",
  logFilters: { search: "", level: "", category: "", from: "", to: "" },
  webhookSimulatorRuns: [],
  selectedWebhookRunId: "",
  selectedCustomerAccountId: "",
  customerAccountsSearch: "",
  movieWizardStep: 0,
  movieDraftSessions: [],
  editingSessionId: "",
  editingSessionOriginalDate: "",
  editingSessionDateChanged: false,
  dashboardMetric: "revenue",
  adminSubtabs: {
    marketing: "overview",
    club: "overview",
    accounts: "team"
  },
  dashboardPeriod: "today",
  dashboardFrom: "",
  dashboardTo: "",
  payments: null,
  paymentFilters: {
    status: "",
    method: "",
    origin: "",
    provider: ""
  },
  orderFilters: {
    todayOrigin: "all",
    todayStatus: "all",
    archiveStatus: "active",
    allQuery: ""
  },
  issuedTicketFilters: {
    movieId: "",
    sessionId: "",
    date: "",
    status: "",
    room: ""
  },
  creating: {
    movie: false,
    room: false,
    ticket: false,
    concession: false,
    promotion: false,
    ad: false,
    user: false,
    customerUser: false,
    clubPlan: false
  },
  pendingImages: {},
  issuedTicketsPage: 1,
  issuedTicketsPageSize: 5,
  ordersPage: 1,
  ordersPageSize: 5,
  todayOrdersPage: 1,
  todayOrdersPageSize: 5,
  clubSubscriptionsPage: 1,
  clubSubscriptionsPageSize: 5,
  clubUsagePage: 1,
  clubUsagePageSize: 5,
  movieSessionsPage: 1,
  movieSessionsPageSize: 5,
  clubSubscriptionsSearch: "",
  boxOfficeTab: "newSale",
  saleMode: "registered",
  selectedCustomer: null,
  customerSearchResults: [],
  manualSaleItems: [],
  manualConcessionQuantities: {},
  pointPaymentId: "",
  pointPaymentTimer: null,
  pointPaymentSnapshot: null,
  pointPaymentSyncing: false,
  qrStream: null,
  qrScanTimer: null,
  qrCloseTimer: null,
  qrCountdownTimer: null,
  qrScanDeadline: 0,
  qrValidationLocked: false,
  qrLastValue: "",
  qrLastValueAt: 0,
  qrTorchOn: false,
  qrTorchTrack: null,
  qrCameraPermission: "unknown",
  qrAutoRestartTimer: null,
  validationSessionLock: false,
  validationSessionId: "",
  validationMode: "entry",
  toastTimer: null,
  refreshStatusTimer: null,
  logsSearchTimer: null,
  fiscalSearchTimer: null,
  twoFactorStatus: null,
  twoFactorSetup: null,
  twoFactorRecoveryCodes: []
};

const $ = (id) => document.getElementById(id);
const setDisabled = (id, disabled) => {
  const element = $(id);
  if (element) element.disabled = disabled;
};
const trashIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>`;
const accessibilityIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/></svg>`;
const obeseSeatIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>`;

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalizedSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function adminRoleLabel(role = "") {
  return {
    owner: "Dono",
    master: "Dono",
    manager: "Gerente",
    operator: "Operador",
    seller: "Operador",
    customer: "Cliente"
  }[String(role || "").toLowerCase()] || "Usuário";
}

function setStatus(label, type = "ok") {
  const el = $("syncStatus");
  if (!el) return;
  const color = type === "error" ? "#fb7185" : type === "loading" ? "#facc15" : "#34d399";
  const bg = type === "error" ? "rgba(251,113,133,.14)" : type === "loading" ? "rgba(250,204,21,.12)" : "rgba(52,211,153,.12)";
  el.innerHTML = `<span class="status-dot"></span>${escapeHtml(label)}`;
  el.style.background = bg;
  el.style.color = color;
}

function showToast(message, type = "ok") {
  const toast = $("toast");
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.className = `toast show ${type === "error" ? "error" : ""}`;
  state.toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function showSuccess(title, message) {
  $("successTitle").textContent = title;
  $("successMessage").textContent = message;
  $("successOverlay").hidden = false;
}

function hideSuccess() {
  $("successOverlay").hidden = true;
}

function showError(message) {
  const banner = $("errorBanner");
  banner.hidden = false;
  banner.textContent = message;
}

function clearError() {
  const banner = $("errorBanner");
  banner.hidden = true;
  banner.textContent = "";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = `${API_BASE}/admin`;
      return {};
    }
    const error = new Error(data.error?.message || data.error || "Erro ao falar com o backend");
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

async function loadAdminUser() {
  try {
    const data = await api("/api/admin/me");
    state.adminUser = data.user;
    $("adminUserBadge").textContent = `${data.user.name || data.user.email} • ${adminRoleLabel(data.user.role)}`;
    if ($("adminProfileName")) $("adminProfileName").textContent = data.user.name || data.user.email || "Usuário";
    if ($("adminProfileRole")) $("adminProfileRole").textContent = adminRoleLabel(data.user.role);
    renderAccountSecuritySummary();
    return data.user;
  } catch {
    // api() redirects to login on 401.
    return null;
  }
}

async function logoutAdmin() {
  await fetch(`${API_BASE}/api/admin/logout`, { method: "POST", credentials: "include" }).catch(() => null);
  window.location.href = `${API_BASE}/admin`;
}

function toggleAdminProfileMenu(force) {
  const menu = $("adminProfileMenu");
  const button = $("adminProfileButton");
  if (!menu || !button) return;
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

function closeAdminProfileMenu() {
  toggleAdminProfileMenu(false);
}

function closeTwoFactorSettings() {
  const overlay = $("twoFactorOverlay");
  if (state.adminUser?.twoFactorSetupRequired && !state.twoFactorStatus?.enabled) {
    showToast("Configure o 2FA para liberar o painel.", "error");
    return;
  }
  if (state.twoFactorRecoveryCodes.length && !window.confirm("Os códigos não serão exibidos novamente. Confirma que já os guardou?")) return;
  if (overlay) overlay.hidden = true;
  state.twoFactorSetup = null;
  state.twoFactorRecoveryCodes = [];
}

function twoFactorDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function renderTwoFactorSettings() {
  const body = $("twoFactorBody");
  if (!body) return;
  if (!state.twoFactorStatus) {
    body.innerHTML = `<div class="two-factor-loading"><span class="loading-spinner"></span>Carregando segurança da conta...</div>`;
    return;
  }
  if (state.twoFactorStatus.configurationReady === false) {
    body.innerHTML = `
      <div class="two-factor-status danger-zone">
        <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/></svg></span>
        <div><strong>2FA aguardando configuração do servidor</strong><span>A chave de proteção ainda não foi definida. Nenhuma configuração incompleta será salva.</span></div>
      </div>`;
    return;
  }
  if (state.twoFactorRecoveryCodes.length) {
    body.innerHTML = `
      <div class="two-factor-success">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <div><strong>2FA ativo</strong><span>Estes códigos aparecem uma única vez.</span></div>
      </div>
      <p class="two-factor-instruction">Guarde os códigos em um local seguro. Cada código substitui o autenticador apenas uma vez.</p>
      <div class="recovery-code-grid">${state.twoFactorRecoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div>
      <div class="button-row">
        <button class="primary-button" type="button" data-two-factor-action="copy-recovery">Copiar códigos</button>
        <button class="ghost-button" type="button" data-two-factor-action="download-recovery">Baixar arquivo</button>
        <button class="ghost-button" type="button" data-two-factor-action="finish">Concluir</button>
      </div>`;
    return;
  }
  if (state.twoFactorSetup) {
    const groupedSecret = String(state.twoFactorSetup.secret || "").match(/.{1,4}/g)?.join(" ") || "";
    body.innerHTML = `
      <div class="two-factor-setup-grid">
        <div class="authenticator-qr"><img src="${escapeHtml(state.twoFactorSetup.qrCodeDataUrl)}" alt="QR Code para configurar o aplicativo autenticador" /></div>
        <div class="two-factor-setup-copy">
          <h3>Conecte seu autenticador</h3>
          <ol><li>Abra Google Authenticator, Microsoft Authenticator, Authy ou equivalente.</li><li>Escaneie o QR Code.</li><li>Informe abaixo o código de 6 dígitos.</li></ol>
          <div class="manual-secret"><span>Chave manual</span><code>${escapeHtml(groupedSecret)}</code></div>
        </div>
      </div>
      <form id="twoFactorEnableForm" class="two-factor-action-form">
        <label>Código do aplicativo<input name="code" class="two-factor-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required /></label>
        <button class="primary-button" type="submit">Ativar autenticação em duas etapas</button>
      </form>
      <p class="helper-text">Os códigos mudam a cada 30 segundos. Se não conferir, ative data e hora automáticas no celular e tente o próximo código.</p>`;
    return;
  }
  if (state.twoFactorStatus.enabled) {
    body.innerHTML = `
      <div class="two-factor-status active">
        <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg></span>
        <div><strong>Autenticação em duas etapas ativa</strong><span>${state.twoFactorStatus.confirmedAt ? `Ativada em ${escapeHtml(twoFactorDate(state.twoFactorStatus.confirmedAt))}. ` : ""}${Number(state.twoFactorStatus.recoveryCodesRemaining || 0)} código(s) de recuperação disponível(is).</span></div>
      </div>
      <div class="two-factor-actions">
        <details>
          <summary>Gerar novos códigos de recuperação</summary>
          <p>Os códigos atuais serão invalidados imediatamente.</p>
          <form id="twoFactorRecoveryForm" class="two-factor-action-form compact">
            <label>Senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
            <label>Código do autenticador<input name="code" class="two-factor-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required /></label>
            <button class="ghost-button" type="submit">Gerar novos códigos</button>
          </form>
        </details>
        ${state.twoFactorStatus.requiredByPolicy ? `
        <div class="two-factor-policy-note"><strong>Proteção obrigatória</strong><span>A política da equipe exige 2FA. Para desativá-lo, o dono deve primeiro desligar a exigência global em Contas.</span></div>` : `
        <details class="danger-zone">
          <summary>Desativar 2FA</summary>
          <p>O painel voltará a aceitar apenas e-mail e senha.</p>
          <form id="twoFactorDisableForm" class="two-factor-action-form compact">
            <label>Senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
            <label>Código ou recuperação<input name="code" class="two-factor-code" autocomplete="one-time-code" maxlength="11" required /></label>
            <button class="danger-button" type="submit">Desativar 2FA</button>
          </form>
        </details>`}
      </div>`;
    return;
  }
  body.innerHTML = `
    <div class="two-factor-status">
      <span class="two-factor-status-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/></svg></span>
      <div><strong>2FA ainda não está ativo</strong><span>Depois da senha, o painel solicitará um código temporário do seu celular.</span></div>
    </div>
    <form id="twoFactorSetupForm" class="two-factor-action-form">
      <label>Confirme sua senha atual<input name="password" type="password" autocomplete="current-password" required /></label>
      <button class="primary-button" type="submit">Configurar aplicativo autenticador</button>
    </form>`;
}

async function loadTwoFactorStatus() {
  state.twoFactorStatus = null;
  renderTwoFactorSettings();
  state.twoFactorStatus = await api("/api/admin/2fa/status");
  renderTwoFactorSettings();
  renderAccountSecuritySummary();
}

function renderAccountSecuritySummary() {
  const target = $("accountSecuritySummary");
  if (!target) return;
  const enabled = Boolean(state.twoFactorStatus?.enabled ?? state.adminUser?.twoFactorEnabled);
  const required = Boolean(state.twoFactorStatus?.requiredByPolicy ?? state.content?.settings?.adminTwoFactorRequired);
  target.innerHTML = `
    <span class="security-state ${enabled ? "active" : "pending"}">${enabled ? "Protegida" : "Configuração pendente"}</span>
    <strong>${enabled ? "Seu acesso exige senha e código temporário" : "Adicione uma segunda etapa ao seu login"}</strong>
    <p>${required ? "A política atual exige 2FA para todas as contas administrativas." : "O 2FA é opcional na política atual, mas recomendado para contas administrativas."}</p>`;
}

async function openTwoFactorSettings() {
  closeAdminProfileMenu();
  $("twoFactorOverlay").hidden = false;
  state.twoFactorSetup = null;
  state.twoFactorRecoveryCodes = [];
  try {
    await loadTwoFactorStatus();
  } catch (error) {
    showToast(error.message, "error");
    closeTwoFactorSettings();
  }
}

function downloadRecoveryCodes() {
  const content = `Cine Cruzeiro - códigos de recuperação 2FA\n\n${state.twoFactorRecoveryCodes.join("\n")}\n\nCada código pode ser usado uma única vez.`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  link.download = "cine-cruzeiro-codigos-recuperacao.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminAssetUrl(value = "") {
  const url = String(value || "").trim();
  if (!url || /^(data:|https?:|blob:)/i.test(url)) return url;
  if (API_BASE && url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return url;
}

function cleanAdminAssetUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  const localBase = API_BASE || "";
  if (localBase && url.startsWith(`${localBase}/uploads/`)) return url.slice(localBase.length);
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
      const path = `${parsed.pathname}${parsed.search || ""}`;
      if (localBase && path.startsWith(`${localBase}/uploads/`)) return path.slice(localBase.length);
      if (path.startsWith("/uploads/")) return path;
    }
  } catch {
    // Mantem o valor original quando nao for URL parseavel.
  }
  return url;
}

function cleanAssetRecord(record, keys = []) {
  if (!record || typeof record !== "object") return record;
  const next = { ...record };
  keys.forEach((key) => {
    if (next[key]) next[key] = cleanAdminAssetUrl(next[key]);
  });
  return next;
}

function cleanAdminContentAssets(content) {
  if (!content) return content;
  return {
    ...content,
    settings: cleanAssetRecord(content.settings || {}, [
      "eventHeroImageUrl",
      "eventGamesImageUrl",
      "eventPartiesImageUrl",
      "eventCorporateImageUrl",
      "eventGalleryImageUrl",
      "clubHeroImageUrl",
      "clubBannerImageUrl"
    ]),
    concessions: (content.concessions || []).map((item) => cleanAssetRecord(item, ["imageUrl"])),
    promotions: (content.promotions || []).map((item) => cleanAssetRecord(item, ["imageUrl"])),
    ads: (content.ads || []).map((item) => cleanAssetRecord(item, ["imageUrl"])),
    subscriptionPlans: (content.subscriptionPlans || []).map((item) => cleanAssetRecord(item, ["imageUrl"])),
    movies: (content.movies || []).map((item) => cleanAssetRecord(item, ["posterUrl", "backdropUrl", "localTrailerUrl"]))
  };
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function workflowStatusLabel(status = "") {
  return {
    draft: "Rascunho",
    published: "Publicado",
    archived: "Arquivado"
  }[String(status || "").toLowerCase()] || "Publicado";
}

function publicMovieStatusLabel(status = "") {
  return {
    now_playing: "Em cartaz",
    upcoming: "Em breve",
    hidden: "Oculto"
  }[String(status || "").toLowerCase()] || "Em breve";
}

function moviePriorityState(movie = {}) {
  const tag = String(movie.tag || "").toLowerCase();
  const status = String(movie.status || "").toLowerCase();
  if (status === "hidden") return { label: "Oculto", className: "hidden" };
  if (tag.includes("pré-estreia") || tag.includes("pre-estreia")) return { label: "Pré-Estreia", className: "pre-premiere" };
  if (tag.includes("estreia")) return { label: "Estreia", className: "premiere" };
  if (status === "now_playing") return { label: "Em cartaz", className: "now" };
  return { label: "Em breve", className: "soon" };
}

function dashboardQuery() {
  const params = new URLSearchParams({ period: state.dashboardPeriod || "today" });
  if (state.dashboardPeriod === "custom") {
    if (state.dashboardFrom) params.set("from", state.dashboardFrom);
    if (state.dashboardTo) params.set("to", state.dashboardTo);
  }
  return params.toString();
}

async function refreshDashboardOnly() {
  state.dashboard = await api(`/api/admin/dashboard?${dashboardQuery()}`);
  renderDashboard();
}

async function refreshPaymentsOnly() {
  const params = new URLSearchParams(dashboardQuery());
  Object.entries(state.paymentFilters || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  state.payments = await api(`/api/admin/payments?${params.toString()}`).catch(() => null);
  renderPaymentsCenter();
}

async function loadContent(options = {}) {
  const silent = Boolean(options.silent);
  clearError();
  if (!silent) {
    setStatus("Sincronizando", "loading");
  } else {
    setDisabled("refreshButton", true);
    clearTimeout(state.refreshStatusTimer);
  }
  if (!silent && !state.content) renderLoading();
  try {
    const [content, dashboard, payments, integrations] = await Promise.all([
      api("/api/admin/content"),
      api(`/api/admin/dashboard?${dashboardQuery()}`).catch(() => null),
      api(`/api/admin/payments?${dashboardQuery()}`).catch(() => null),
      isOwnerAdmin() ? api("/api/integrations").catch(() => null) : Promise.resolve(null)
    ]);
    state.content = cleanAdminContentAssets(content);
    state.dashboard = dashboard;
    state.payments = payments;
    state.integrations = integrations;
    if (!state.creating.movie && !state.content.movies.some((movie) => movie.id === state.selectedMovieId)) {
      state.selectedMovieId = state.content.movies[0]?.id || "";
    }
    if (!state.creating.room) state.selectedRoomId ||= state.content.rooms[0]?.id || "";
    if (!state.creating.ticket) state.selectedTicketId ||= state.content.ticketTypes[0]?.id || "";
    if (!state.creating.concession) state.selectedConcessionId ||= state.content.concessions?.[0]?.id || "";
    if (!state.creating.promotion) state.selectedPromotionId ||= state.content.promotions?.[0]?.id || "";
    if (!state.creating.ad) state.selectedAdId ||= state.content.ads?.[0]?.id || "";
    const teamUsers = (state.content.users || []).filter((user) => user.role !== "customer");
    const customerUsers = (state.content.users || []).filter((user) => user.role === "customer");
    if (!state.creating.user && !teamUsers.some((user) => user.id === state.selectedUserId)) state.selectedUserId = teamUsers[0]?.id || "";
    if (!state.creating.customerUser && !customerUsers.some((user) => user.id === state.selectedCustomerAccountId)) state.selectedCustomerAccountId = customerUsers[0]?.id || "";
    if (!state.creating.clubPlan) state.selectedClubPlanId ||= state.content.subscriptionPlans?.[0]?.id || "";
    renderAll();
    if (!silent) {
      setStatus("Salvo");
    } else {
      setStatus("Salvo");
    }
  } catch (error) {
    console.error(error);
    setStatus("Erro", "error");
    showError(`Não foi possível sincronizar com o backend. ${error.message}`);
    showToast("Falha ao carregar dados do painel.", "error");
  } finally {
    if (silent) {
      state.refreshStatusTimer = setTimeout(() => setDisabled("refreshButton", false), 220);
    }
  }
}

function renderAll() {
  applyRbacVisibility();
  renderDashboard();
  renderInsights();
  renderMovies();
  renderRooms();
  renderTickets();
  renderOrders();
  renderPaymentsCenter();
  renderConcessions();
  renderMarketingOverview();
  renderPromotions();
  renderAds();
  renderUsers();
  renderCustomerUsers();
  renderClub();
  renderIntegrations();
  if (state.fiscal) renderFiscalDocuments();
  if (state.logs) renderLogs();
  fillSettingsForm();
  renderRoomOptions();
  renderManualSaleOptions();
  renderValidationSessionScope();
  if ($("adminTwoFactorRequired")) $("adminTwoFactorRequired").checked = state.content?.settings?.adminTwoFactorRequired !== false;
  renderAccountSecuritySummary();
  document.querySelectorAll("form[data-dirty-track]").forEach((form) => markFormClean(form));
}

function renderLoading() {
  ["moviesList", "roomsList", "ticketsList", "concessionsList", "promotionsList", "adsList", "usersList", "customerUsersList", "ordersList", "todayOrdersList", "paymentsList", "clubPlansList", "clubSubscriptionsList", "integrationsList", "logsList", "fiscalDocumentsList"].forEach((id) => {
    if ($(id)) {
      $(id).innerHTML = Array.from({ length: 4 }, () => `<div class="skeleton-card"></div>`).join("");
    }
  });

  if ($("ordersList")) {
    $("ordersList").innerHTML = `<div class="skeleton-card"></div>`;
  }
}

function logLevelLabel(level = "") {
  return { error: "Precisa de ação", warn: "Atenção", info: "Concluído", debug: "Diagnóstico" }[level] || "Informação";
}

function logCategoryLabel(category = "") {
  const normalized = String(category || "").toLowerCase();
  const exact = {
    payment: "Pagamentos",
    box_office: "Bilheteria",
    ticket: "Ingressos",
    subscription: "Clube",
    fiscal: "Notas fiscais",
    email: "E-mails",
    password_reset: "Acesso de clientes",
    email_verification: "Verificação de e-mail",
    admin: "Painel administrativo",
    admin_two_factor: "Segurança e 2FA",
    integration: "Integrações",
    google_wallet: "Carteira digital",
    webhook: "Confirmações automáticas",
    request: "Operação do sistema",
    logs: "Histórico",
    system: "Sistema"
  }[normalized];
  if (exact) return exact;
  if (normalized.startsWith("box_office")) return "Bilheteria";
  if (normalized.startsWith("ticket")) return "Ingressos";
  if (normalized.startsWith("subscription")) return "Clube";
  if (normalized.startsWith("fiscal")) return "Notas fiscais";
  if (normalized.includes("email")) return "E-mails";
  if (normalized.startsWith("google_wallet")) return "Carteira digital";
  return "Sistema";
}

function logPaymentMethod(value = "") {
  return {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    card: "Cartão",
    courtesy: "Cortesia",
    external_pix: "Pix no balcão",
    club_credit: "Crédito do Clube"
  }[String(value || "").toLowerCase()] || value;
}

function logFriendlyError(message = "") {
  const text = String(message || "").trim();
  if (!text) return "O sistema registrou uma ocorrência que precisa ser conferida.";
  const translations = [
    [/invalid input syntax for type timestamp with time zone/i, "Uma data ou horário foi enviado em formato inválido."],
    [/unauthorized|não autorizado|nao autorizado/i, "A operação foi recusada por falta de autorização."],
    [/not found|não encontrado|nao encontrado/i, "O registro solicitado não foi encontrado."],
    [/timeout|timed out/i, "O serviço demorou mais que o esperado para responder."],
    [/network|fetch failed|econnreset|econnrefused/i, "Não foi possível se comunicar com o serviço externo."],
    [/duplicate|already exists/i, "O registro já existia e não foi duplicado."],
    [/invalid signature/i, "A confirmação automática foi recusada por assinatura inválida."]
  ];
  return translations.find(([pattern]) => pattern.test(text))?.[1] || text;
}

function logAdminAction(log) {
  const path = String(log.path || "");
  const method = String(log.method || "").toUpperCase();
  const operation = method === "POST" ? "criado" : method === "DELETE" ? "excluído" : "atualizado";
  const resources = [
    [/\/users/, "Usuário"],
    [/\/movies/, "Filme"],
    [/\/rooms/, "Sala"],
    [/\/tickets/, "Ingresso"],
    [/\/orders/, "Pedido"],
    [/\/club/, "Clube"],
    [/\/concessions/, "Produto da bomboniere"],
    [/\/integrations/, "Integração"],
    [/\/fiscal/, "Nota fiscal"],
    [/\/marketing/, "Campanha"]
  ];
  const resource = resources.find(([pattern]) => pattern.test(path))?.[1] || "Configuração";
  return { title: `${resource} ${operation}`, description: "Uma alteração foi realizada pelo painel administrativo." };
}

function logPresentation(log = {}) {
  const event = String(log.event || "");
  const metadata = log.metadata || {};
  const method = logPaymentMethod(metadata.method || metadata.paymentMethod || "");
  const entries = {
    "payment.created": { title: "Pagamento iniciado", description: method ? `Uma cobrança por ${method} foi criada e aguarda confirmação.` : "Uma cobrança foi criada e aguarda confirmação." },
    "payment.reconciled": { title: "Pagamento confirmado", description: "O pagamento foi localizado e conciliado com o pedido." },
    "payment.reconciliation_reference_mismatch": { title: "Pagamento não localizado no pedido", description: "A referência recebida não corresponde ao pedido e precisa ser conferida." },
    "payment.reconciliation_amount_mismatch": { title: "Valor do pagamento diferente", description: "O valor confirmado pelo provedor não corresponde ao total do pedido." },
    "ticket.used": { title: "Ingresso validado", description: "A entrada foi liberada e o ingresso foi marcado como utilizado." },
    "ticket.transferred": { title: "Ingresso transferido", description: "O ingresso foi enviado para outro cliente." },
    "ticket_email.failed": { title: "E-mail do ingresso não enviado", description: "O ingresso foi emitido, mas o e-mail não pôde ser entregue." },
    "ticket_email.pdf_failed": { title: "PDF do ingresso não gerado", description: "O sistema não conseguiu preparar o PDF anexado ao e-mail." },
    "box_office_sale.created": { title: "Venda concluída na bilheteria", description: method ? `A venda presencial foi registrada com pagamento em ${method}.` : "A venda presencial foi registrada com sucesso." },
    "box_office_point_sale.created": { title: "Pagamento enviado à maquininha", description: "A cobrança presencial foi enviada para a Point selecionada." },
    "box_office_point_sale.synced": { title: "Pagamento da maquininha atualizado", description: "O status da venda presencial foi atualizado pelo Mercado Pago." },
    "box_office_point_sale.cancelled": { title: "Cobrança da maquininha cancelada", description: "A cobrança presencial foi cancelada no Mercado Pago." },
    "box_office_ticket_print.queued": { title: "Ingresso enviado para impressão", description: "A impressão física foi enviada para a maquininha Point." },
    "box_office_ticket_print.failed": { title: "Ingresso não impresso", description: "A venda foi concluída, mas a maquininha não recebeu a impressão." },
    "webhook.processed": { title: "Pagamento atualizado automaticamente", description: "O Mercado Pago confirmou uma mudança no pagamento do pedido." },
    "webhook.subscription.processed": { title: "Assinatura do Clube atualizada", description: "O Mercado Pago confirmou uma mudança na assinatura do cliente." },
    "webhook.payment.not_found": { title: "Pagamento sem pedido correspondente", description: "O provedor confirmou uma cobrança, mas o sistema não encontrou o pedido relacionado." },
    "webhook.subscription.not_found": { title: "Pagamento sem assinatura correspondente", description: "O provedor enviou uma atualização, mas a assinatura relacionada não foi encontrada." },
    "webhook.mercado_pago.rejected": { title: "Confirmação do Mercado Pago recusada", description: "A notificação recebida não passou pela verificação de segurança." },
    "subscription.pending_payment_expiration_failed": { title: "Plano pendente não cancelado", description: "O sistema não conseguiu cancelar automaticamente um plano sem pagamento." },
    "subscription.pending_payment_maintenance_failed": { title: "Revisão de planos pendentes falhou", description: "A rotina automática de assinaturas precisa ser conferida." },
    "fiscal.email_failed": { title: "Nota fiscal não enviada por e-mail", description: "A nota foi processada, mas não pôde ser entregue ao cliente." },
    "fiscal.email_attachment_failed": { title: "Anexo da nota fiscal não preparado", description: "O sistema não conseguiu anexar o arquivo da nota ao e-mail do cliente." },
    "fiscal.webhook_sync_failed": { title: "Nota fiscal não atualizada", description: "A resposta do emissor fiscal não pôde ser sincronizada." },
    "fiscal.maintenance_failed": { title: "Rotina de notas fiscais falhou", description: "Existem notas fiscais que podem precisar de revisão manual." },
    "email_verification.delivery_failed": { title: "E-mail de verificação não entregue", description: "A mensagem de confirmação do cadastro não pôde ser enviada." },
    "email_verification.delivery_missing_channel": { title: "Envio de verificação não configurado", description: "Não há um serviço de e-mail disponível para confirmar o cadastro do cliente." },
    "password_reset.delivery_failed": { title: "E-mail de recuperação não entregue", description: "A mensagem para redefinir a senha não pôde ser enviada." },
    "password_reset.delivery_missing_channel": { title: "Recuperação de senha não configurada", description: "Não há um serviço de e-mail disponível para enviar a recuperação de senha." },
    "password_reset.delivery_not_configured": { title: "Recuperação de senha indisponível", description: "As configurações necessárias para enviar a recuperação de senha estão incompletas." },
    "ticket_transfer_email.failed": { title: "Transferência não enviada por e-mail", description: "O ingresso foi transferido, mas o destinatário não recebeu a mensagem." },
    "ticket_transfer_pdf.failed": { title: "PDF da transferência não gerado", description: "O ingresso foi transferido, mas o PDF atualizado não pôde ser preparado." },
    "google_wallet.integration_failed": { title: "Carteira digital indisponível", description: "A conexão com o Google Wallet apresentou uma falha." },
    "logs.retention_applied": { title: "Histórico antigo organizado", description: "A política de retenção removeu registros técnicos antigos." },
    "logs.retention_failed": { title: "Histórico antigo não foi limpo", description: "A rotina de organização dos registros precisa ser executada novamente." },
    "admin_two_factor.setup_started": { title: "Configuração do 2FA iniciada", description: "O aplicativo autenticador foi preparado para esta conta administrativa." },
    "admin_two_factor.enabled": { title: "2FA ativado", description: "A conta administrativa passou a exigir senha e código temporário no login." },
    "admin_two_factor.disabled": { title: "2FA desativado", description: "A autenticação em duas etapas foi removida desta conta administrativa." },
    "admin_two_factor.recovery_codes_regenerated": { title: "Códigos de recuperação renovados", description: "Os códigos anteriores foram invalidados e substituídos." }
  };
  if (entries[event]) return entries[event];
  if (event === "admin.action") return logAdminAction(log);
  if (event === "request.failed") return { title: "Operação não concluída", description: logFriendlyError(log.message || metadata.message) };
  if (/\.failed$|_failed$/.test(event)) return { title: "Operação com falha", description: logFriendlyError(log.message || metadata.message) };
  return {
    title: logCategoryLabel(log.category),
    description: logFriendlyError(log.message || "Uma atividade foi registrada pelo sistema.")
  };
}

function logReferenceItems(log = {}) {
  const metadata = log.metadata || {};
  const candidates = [
    ["Pedido", metadata.orderId],
    ["Pagamento", metadata.paymentId || metadata.providerPaymentId],
    ["Ingresso", metadata.ticketId],
    ["Assinatura", metadata.subscriptionId],
    ["Nota fiscal", metadata.fiscalDocumentId],
    ["Sessão", metadata.sessionId],
    ["Cliente", metadata.customerEmail || metadata.email]
  ];
  return candidates.filter(([, value]) => value != null && String(value).trim()).slice(0, 4);
}

function logDate(value = "") {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function logFilterDate(value, endOfMinute = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (endOfMinute) date.setSeconds(59, 999);
  return date.toISOString();
}

async function loadLogs(options = {}) {
  state.logsPage = Math.max(1, Number(options.page || state.logsPage || 1));
  const params = new URLSearchParams({ page: String(state.logsPage), pageSize: String(state.logsPageSize) });
  params.set("view", state.logsView || "business");
  const filters = state.logFilters || {};
  if (filters.search) params.set("search", filters.search);
  if (filters.level) params.set("level", filters.level);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", logFilterDate(filters.from));
  if (filters.to) params.set("to", logFilterDate(filters.to, true));
  if ($("logsList")) $("logsList").innerHTML = Array.from({ length: 6 }, () => `<div class="skeleton-card"></div>`).join("");
  try {
    state.logs = await api(`/api/admin/logs?${params.toString()}`);
    renderLogs();
  } catch (error) {
    if ($("logsList")) $("logsList").innerHTML = `<div class="empty-state"><strong>Não foi possível carregar os logs</strong><span>${escapeHtml(error.message)}</span></div>`;
    showToast(error.message, "error");
  }
}

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

async function pruneLogs() {
  const days = Math.max(1, Number($("logsRetentionDays")?.value || 90));
  if (!confirm(`Remover logs com mais de ${days} dias? Esta ação não apaga o histórico auditável de pedidos.`)) return;
  try {
    const result = await api("/api/admin/logs", { method: "DELETE", body: JSON.stringify({ retentionDays: days }) });
    showSuccess("Logs organizados", result.message || "A política de retenção foi aplicada.");
    await loadLogs({ page: 1 });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function exportLogs() {
  const rows = (state.logs?.logs || []).map((log) => {
    const presentation = logPresentation(log);
    return [logDate(log.createdAt), logLevelLabel(log.level), logCategoryLabel(log.category), presentation.title, presentation.description, log.actorEmail || log.actorUserId || "Sistema"];
  });
  const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const payload = [["Data e hora", "Importância", "Assunto", "Ocorrência", "Explicação", "Responsável"], ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\ufeff${payload}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `historico-cine-cruzeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderInsights() {
  const movies = state.content?.movies || [];
  const nowPlaying = movies.filter((movie) => movie.status === "now_playing").length;
  const upcoming = movies.filter((movie) => movie.status === "upcoming").length;
  const sessions = movies.reduce((total, movie) => total + (movie.sessions?.length || 0), 0);
  const activeTickets = state.content?.ticketTypes?.filter((ticket) => ticket.active !== false) || [];
  const baseTicket = activeTickets[0]?.price ?? state.content?.ticketTypes?.[0]?.price ?? 0;

  $("statNowPlaying").textContent = nowPlaying;
  $("statUpcoming").textContent = upcoming;
  $("statSessions").textContent = sessions;
  $("statBaseTicket").textContent = money(baseTicket);
}

function renderDashboard() {
  const data = state.dashboard || {};
  if ($("dashRevenueToday")) $("dashRevenueToday").textContent = money(data.revenueToday || 0);
  if ($("dashRevenueMonth")) $("dashRevenueMonth").textContent = money(data.revenuePeriod ?? data.revenueMonth ?? 0);
  if ($("dashSalesToday")) $("dashSalesToday").textContent = Number(data.salesToday || 0);
  if ($("dashSalesMonth")) $("dashSalesMonth").textContent = Number(data.salesPeriod ?? data.salesMonth ?? 0);
  if ($("dashTicketsSold")) $("dashTicketsSold").textContent = Number(data.ticketsSold || 0);
  if ($("dashAverageTicket")) $("dashAverageTicket").textContent = money(data.averageTicket || 0);
  if ($("dashAverageOccupancy")) $("dashAverageOccupancy").textContent = `${Number(data.capacity?.occupancyRate || 0)}%`;
  if ($("dashCustomers")) $("dashCustomers").textContent = Number(data.customers || 0);
  if ($("dashSubscriptions")) $("dashSubscriptions").textContent = Number(data.activeSubscriptions || 0);
  if ($("dashPendingPayments")) $("dashPendingPayments").textContent = Number(data.problematicPayments ?? data.pendingPayments ?? 0);
  if ($("dashConcessionRevenue")) $("dashConcessionRevenue").textContent = money(data.concessionRevenue || 0);
  if ($("dashFiscalSummary")) {
    const fiscal = data.fiscal || {};
    $("dashFiscalSummary").textContent = fiscal.total
      ? `${Number(fiscal.authorized || 0)} autorizada(s), ${Number(fiscal.processing || 0)} em processamento e ${Number(fiscal.errors || 0)} com erro no período. ${money(fiscal.authorizedAmount || 0)} em serviços autorizados.`
      : "Nenhuma nota fiscal criada no período selecionado.";
  }
  if ($("dashRevenueCompare")) $("dashRevenueCompare").textContent = comparisonText(data.comparison?.revenue);
  if ($("dashSalesCompare")) $("dashSalesCompare").textContent = comparisonText(data.comparison?.sales);
  if ($("dashTicketsCompare")) $("dashTicketsCompare").textContent = comparisonText(data.comparison?.tickets);
  renderDashboardChart(data.chart || []);
  if ($("dashSalesOrigin")) {
    const entries = Object.entries(data.revenueByOrigin || data.salesByOrigin || {});
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    $("dashSalesOrigin").innerHTML = entries.length
      ? entries.map(([name, value]) => `<div class="metric-row clickable-row" onclick="activatePanel('ordersPanel', { scroll: true })"><span>${escapeHtml(name)}<small>${total ? Math.round((Number(value || 0) / total) * 100) : 0}% do período</small></span><strong>${money(value)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Sem vendas</strong><span>As origens aparecerão após os primeiros pedidos.</span></div>`;
  }
  if ($("dashPaymentMethods")) {
    const entries = Object.entries(data.revenueByMethod || data.paymentMethods || {});
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
    $("dashPaymentMethods").innerHTML = entries.length
      ? entries.map(([name, value]) => `<div class="metric-row clickable-row" onclick="setBoxOfficeTab('payments')"><span>${escapeHtml(name)}<small>${total ? Math.round((Number(value || 0) / total) * 100) : 0}% do período</small></span><strong>${money(value)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Sem pagamentos</strong><span>As formas usadas aparecerão aqui.</span></div>`;
  }
  if ($("dashRevenueComposition")) {
    const entries = Array.isArray(data.revenueComposition) ? data.revenueComposition : [];
    const total = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    $("dashRevenueComposition").innerHTML = entries.some((item) => Number(item.amount || 0) > 0)
      ? entries.map((item) => `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.label || "Receita")}<small>${escapeHtml(item.hint || "")}${total ? ` • ${Math.round((Number(item.amount || 0) / total) * 100)}%` : ""}</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`).join("")
      : `<div class="empty-state compact"><strong>Sem receita aprovada</strong><span>Ingressos, bomboniere e assinaturas aparecerão aqui quando forem pagos.</span></div>`;
  }
  if ($("dashMovieRevenue")) {
    const movies = Array.isArray(data.revenueByMovie) ? data.revenueByMovie : [];
    const total = movies.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    $("dashMovieRevenue").innerHTML = movies.length
      ? movies.map((item) => `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.name || "Filme")}<small>${total ? Math.round((Number(item.amount || 0) / total) * 100) : 0}% da receita de ingressos</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`).join("")
      : `<div class="empty-state compact"><strong>Sem receita por filme</strong><span>As vendas aprovadas por sessão entram nesta lista.</span></div>`;
  }
  if ($("dashUpcomingSessions")) {
    const sessions = data.todaySessions || data.upcomingSessions || [];
    $("dashUpcomingSessions").innerHTML = sessions.length
      ? sessions.map((item) => `
          <div class="session-metric-row clickable-row" onclick="openSessionDashboardDetail('${escapeHtml(item.movie?.id || "")}', '${escapeHtml(item.session?.id || "")}')">
            <div class="session-poster">${item.movie?.posterUrl ? `<img src="${escapeHtml(item.movie.posterUrl)}" alt="">` : `<span>${escapeHtml(item.movie?.rating || "L")}</span>`}</div>
            <div>
              <strong>${escapeHtml(item.movie?.title || "Filme")} • ${escapeHtml(item.session?.time || "-")}</strong>
              <span>${escapeHtml(item.session?.format || "")}</span>
              <div class="mini-progress"><i style="width:${Math.min(100, Number(item.occupancyRate || 0))}%"></i></div>
              <small>${Number(item.sold || 0)} / ${Number(item.capacity || 0)} • ${Number(item.occupancyRate || 0)}% • ${escapeHtml(item.status || "Boa disponibilidade")}</small>
            </div>
          </div>`).join("")
      : `<div class="empty-state compact"><strong>Nenhuma sessão programada para hoje.</strong><span>Cadastre um horário quando a programação estiver definida.</span><button class="ghost-button" type="button" onclick="createSessionFromDashboard()">Criar sessão</button></div>`;
  }
  if ($("dashCapacity")) {
    const capacity = data.capacity || {};
    $("dashCapacity").innerHTML = `
      <div class="metric-row"><span>Lugares ocupados</span><strong>${Number(capacity.occupied || 0)}</strong></div>
      <div class="metric-row"><span>Capacidade cadastrada</span><strong>${Number(capacity.roomCapacity || 0)}</strong></div>
      <div class="metric-row"><span>Ocupação estimada</span><strong>${Number(capacity.occupancyRate || 0)}%</strong></div>
    `;
  }
  if ($("dashTopProducts")) {
    const products = data.topProducts || [];
    $("dashTopProducts").innerHTML = products.length
      ? products.map((item) => `<div class="metric-row clickable-row" onclick="activatePanel('concessionsPanel', { scroll: true })"><span>${escapeHtml(item.name)}</span><strong>${Number(item.quantity || 0)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Nenhum produto vendido no período.</strong><span>Produtos vendidos aparecerão aqui.</span><button class="ghost-button" type="button" onclick="activatePanel('concessionsPanel', { scroll: true })">Ver Bomboniere</button></div>`;
  }
  if ($("dashLatestOrders")) {
    const orders = data.latestOrders || [];
    $("dashLatestOrders").innerHTML = orders.length
      ? orders.map((order) => `<div class="metric-row clickable-row" onclick="openOrderView('${escapeHtml(order.id)}')"><span>${escapeHtml(order.reference || orderReference(order))} • ${escapeHtml(order.customerName)}<small>${escapeHtml(order.movieTitle || "")} • ${escapeHtml(order.origin)} • ${escapeHtml(order.status)}</small></span><strong>${money(order.totalPrice)}</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Sem pedidos recentes</strong><span>As últimas vendas aparecerão aqui.</span></div>`;
  }
  if ($("dashAttentionPayments")) {
    const payments = data.attentionPayments || [];
    $("dashAttentionPayments").innerHTML = payments.length
      ? payments.map((payment) => `<div class="metric-row clickable-row alert-row" onclick="openOrderView('${escapeHtml(payment.orderId)}')"><span>${escapeHtml(payment.orderReference)}<small>${escapeHtml(payment.message)} • ${escapeHtml(payment.method)} • ${escapeHtml(payment.provider)}</small></span><strong>${money(payment.amount)}</strong></div>`).join("")
      : `<div class="empty-state compact success-state"><span class="success-mark" aria-hidden="true"></span><strong>Nenhum pagamento precisa de atenção.</strong><span>Pendências e falhas aparecerão aqui.</span></div>`;
  }
  if ($("dashClubMetrics")) {
    const club = data.club || {};
    $("dashClubMetrics").innerHTML = `
      <div class="metric-row clickable-row" onclick="activatePanel('clubPanel', { scroll: true })"><span>Assinaturas ativas</span><strong>${Number(club.activeSubscriptions || 0)}</strong></div>
      <div class="metric-row"><span>Novos assinantes no período</span><strong>${Number(club.newSubscribers || 0)}</strong></div>
      <div class="metric-row"><span>Cancelamentos no período</span><strong>${Number(club.cancellations || 0)}</strong></div>
      <div class="metric-row"><span>Receita recorrente estimada</span><strong>${money(club.recurringRevenueEstimate || 0)}</strong></div>
      <div class="metric-row"><span>Créditos usados</span><strong>${Number(club.creditsUsed || 0)}</strong></div>
    `;
  }
  if ($("dashOperationalAlerts")) {
    const alerts = [];
    if (data.cardTerminal && !data.cardTerminal.configured) alerts.push(["Maquininha sem integração automática", "Vendas por cartão serão registradas manualmente."]);
    (data.lowStockProducts || []).forEach((item) => alerts.push([`Estoque baixo: ${item.name}`, `${item.stock} unidade(s) disponíveis.`]));
    (data.todaySessions || []).filter((item) => ["Quase lotada", "Esgotada"].includes(item.status)).forEach((item) => alerts.push([`${item.movie.title} • ${item.session.time}`, item.status]));
    $("dashOperationalAlerts").innerHTML = alerts.length
      ? alerts.map(([title, text]) => `<div class="metric-row alert-row"><span>${escapeHtml(title)}<small>${escapeHtml(text)}</small></span><strong>Atenção</strong></div>`).join("")
      : `<div class="empty-state compact"><strong>Nenhum alerta operacional.</strong><span>Estoque, sessões e integrações estão sem bloqueios críticos.</span></div>`;
  }
}

function comparisonText(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "";
  const number = Number(value);
  if (!number) return "estável vs. período anterior";
  return `${number > 0 ? "+" : ""}${number}% vs. período anterior`;
}

function renderDashboardChart(rows) {
  const target = $("dashRevenueChart");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state compact"><strong>Nenhum dado disponível para este período.</strong><span>O gráfico será preenchido após as primeiras vendas.</span></div>`;
    return;
  }
  const width = 720;
  const height = 270;
  const padLeft = 62;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 44;
  const metric = state.dashboardMetric === "sales" ? "sales" : "revenue";
  const valueOf = (item) => metric === "sales" ? Number(item.orders || 0) : Number(item.revenue || 0);
  const maxValue = Math.max(1, ...rows.map(valueOf));
  const x = (index) => padLeft + (rows.length === 1 ? (width - padLeft - padRight) / 2 : (index / (rows.length - 1)) * (width - padLeft - padRight));
  const y = (value) => height - padBottom - (Number(value || 0) / maxValue) * (height - padTop - padBottom);
  const points = rows.map((item, index) => `${x(index)},${y(valueOf(item))}`).join(" ");
  const axisLabel = (value) => metric === "revenue" ? money(value).replace(",00", "") : String(Math.round(value));
  const gridLines = [0, 0.5, 1].map((ratio) => {
    const value = maxValue * ratio;
    const lineY = y(value);
    return `<g class="chart-axis"><line x1="${padLeft}" y1="${lineY}" x2="${width - padRight}" y2="${lineY}" /><text x="${padLeft - 10}" y="${lineY + 4}" text-anchor="end">${escapeHtml(axisLabel(value))}</text></g>`;
  }).join("");
  const showEvery = Math.max(1, Math.ceil(rows.length / 7));
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric === "revenue" ? "Receita" : "Vendas"} por período">
      ${gridLines}
      ${metric === "revenue" ? `<polyline class="chart-line" points="${points}" />` : ""}
      ${rows.map((item, index) => {
        const value = valueOf(item);
        const barWidth = Math.min(28, Math.max(7, 220 / rows.length));
        const barHeight = Math.max(value > 0 ? 3 : 0, height - padBottom - y(value));
        const dateLabel = new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return `
          ${metric === "sales" ? `<rect class="chart-bar" x="${x(index) - barWidth / 2}" y="${height - padBottom - barHeight}" width="${barWidth}" height="${barHeight}" rx="3" />` : ""}
          <circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="${rows.length === 1 ? 7 : 5}" tabindex="0"
            onmouseenter="showChartHint('${item.date}', ${Number(item.revenue || 0)}, ${Number(item.orders || 0)}, ${Number(item.tickets || 0)})"
            onfocus="showChartHint('${item.date}', ${Number(item.revenue || 0)}, ${Number(item.orders || 0)}, ${Number(item.tickets || 0)})"
            onclick="showChartHint('${item.date}', ${Number(item.revenue || 0)}, ${Number(item.orders || 0)}, ${Number(item.tickets || 0)})" />
          ${index % showEvery === 0 || index === rows.length - 1 ? `<text class="chart-date" x="${x(index)}" y="${height - 16}" text-anchor="middle">${dateLabel}</text>` : ""}
        `;
      }).join("")}
    </svg>
  `;
}

function showChartHint(date, revenue, orders, tickets) {
  if (!$("dashChartHint")) return;
  $("dashChartHint").textContent = `${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} • ${money(revenue)} • ${orders} pedido(s) • ${tickets} ingresso(s)`;
}

function openSessionDashboardDetail(movieId, sessionId) {
  activatePanel("ordersPanel", { scroll: true });
  setBoxOfficeTab("todaySales");
  showToast(`Sessão selecionada: ${sessionId || movieId}`);
}

function createSessionFromDashboard() {
  const movie = orderedMovies()[0];
  if (!movie) {
    activatePanel("moviesPanel", { scroll: true });
    newMovie();
    showToast("Cadastre o filme antes de criar a sessão.");
    return;
  }
  state.creating.movie = false;
  state.selectedMovieId = movie.id;
  activatePanel("moviesPanel", { scroll: true });
  renderMovies();
  setMovieWizardStep(3);
  openSessionEditor();
}

function currentMovie() {
  return state.content?.movies.find((movie) => movie.id === state.selectedMovieId) || null;
}

function currentRoom() {
  return state.content?.rooms.find((room) => room.id === state.selectedRoomId) || null;
}

function currentTicket() {
  return state.content?.ticketTypes.find((ticket) => ticket.id === state.selectedTicketId) || null;
}

function movieById(id) {
  return state.content?.movies?.find((movie) => movie.id === id) || null;
}

function sessionForIssuedTicket(ticket) {
  const movie = movieById(ticket.movieId);
  return movie?.sessions?.find((session) => session.id === ticket.sessionId) || null;
}

function issuedTicketSessionLabel(ticket) {
  const session = sessionForIssuedTicket(ticket);
  const date = ticket.sessionDate || session?.date || "";
  const time = ticket.sessionTime || session?.time || "";
  const format = ticket.sessionFormat || session?.format || "";
  return [date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "", time, format].filter(Boolean).join(" • ");
}

function ticketStatusText(status = "") {
  return {
    active: "Válido",
    pending_payment: "Aguardando pagamento",
    used: "Usado",
    archived: "Arquivado",
    cancelled: "Cancelado",
    refunded: "Estornado",
    expired: "Expirado"
  }[String(status || "").toLowerCase()] || status || "Indefinido";
}

function currentConcession() {
  return state.content?.concessions?.find((item) => item.id === state.selectedConcessionId) || null;
}

function currentPromotion() {
  return state.content?.promotions?.find((item) => item.id === state.selectedPromotionId) || null;
}

function currentAd() {
  return state.content?.ads?.find((item) => item.id === state.selectedAdId) || null;
}

function currentUser() {
  return state.content?.users?.find((item) => item.id === state.selectedUserId) || null;
}

function currentCustomerAccount() {
  return state.content?.users?.find((item) => item.id === state.selectedCustomerAccountId && item.role === "customer") || null;
}

function isOwnerAdmin() {
  return ["owner", "master"].includes(state.adminUser?.role);
}

function currentOrder() {
  return state.content?.orders?.find((item) => item.id === state.selectedOrderId) || null;
}

function currentClubPlan() {
  return state.content?.subscriptionPlans?.find((item) => item.id === state.selectedClubPlanId) || null;
}

function creationPlaceholder(title, message) {
  return `
    <div class="empty-state creation-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function syncCreationControl(type, cancelId, deleteId, hasItem) {
  const creating = Boolean(state.creating[type]);
  const cancelButton = $(cancelId);
  const deleteButton = $(deleteId);
  if (cancelButton) cancelButton.hidden = !creating;
  if (deleteButton) deleteButton.hidden = creating || !hasItem;
}

function cancelCreation(type) {
  const config = {
    movie: ["movies", "selectedMovieId", renderMovies, ["moviePosterUrl", "movieBackdropUrl"]],
    room: ["rooms", "selectedRoomId", renderRooms],
    ticket: ["ticketTypes", "selectedTicketId", renderTickets],
    concession: ["concessions", "selectedConcessionId", renderConcessions, ["concessionImageUrl"]],
    promotion: ["promotions", "selectedPromotionId", renderPromotions],
    ad: ["ads", "selectedAdId", renderAds, ["adImageUrl"]],
    user: ["users", "selectedUserId", renderUsers],
    customerUser: ["users", "selectedCustomerAccountId", renderCustomerUsers],
    clubPlan: ["subscriptionPlans", "selectedClubPlanId", renderClub, ["clubPlanImageUrl"]]
  }[type];
  if (!config) return;
  const [collectionKey, selectedKey, render, imageFields = []] = config;
  state.creating[type] = false;
  state[selectedKey] = type === "customerUser"
    ? state.content?.users?.find((item) => item.role === "customer")?.id || ""
    : type === "user"
      ? state.content?.users?.find((item) => item.role !== "customer")?.id || ""
      : state.content?.[collectionKey]?.[0]?.id || "";
  imageFields.forEach((field) => delete state.pendingImages[field]);
  render();
  showToast("Novo cadastro cancelado.");
}

function orderStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  return {
    paid: "Pago",
    approved: "Pago",
    pending_payment: "Aguardando pagamento",
    pix_pending: "Pix pendente",
    manual_sale: "Venda manual",
    pending: "Pendente",
    processing: "Processando",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    archived: "Arquivado",
    used: "Usado",
    draft: "Rascunho",
    test: "Teste"
  }[normalized] || humanizeEnum(status) || "Aguardando pagamento";
}

function paymentStatusLabel(status = "") {
  const normalized = String(status || "").toLowerCase();
  return {
    pending: "Aguardando pagamento",
    pending_payment: "Aguardando pagamento",
    pix_pending: "Pix pendente",
    manual_sale: "Venda manual",
    processing: "Processando",
    approved: "Pago",
    paid: "Pago",
    rejected: "Recusado",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    archived: "Arquivado"
  }[normalized] || humanizeEnum(status) || "Não informado";
}

function paymentMethodLabel(method = "") {
  const normalized = String(method || "").toLowerCase();
  return {
    pix_pending: "Pix pendente",
    pix: "Pix online",
    PIX: "Pix online",
    credit_card: "Cartão online",
    CREDIT_CARD: "Cartão online",
    cash: "Dinheiro",
    card_terminal: "Cartão na maquininha",
    external_pix: "Pix no balcão",
    manual_sale: "Venda manual",
    courtesy: "Cortesia",
    club_credit: "Crédito do Clube"
  }[normalized] || humanizeEnum(method) || "Não informado";
}

function providerLabel(provider = "") {
  return {
    open_finance: "Pix legado",
    mercado_pago: "Mercado Pago",
    box_office: "Bilheteria",
    admin: "Administração",
    internal_club: "Clube",
    external_manual: "Registro manual",
    manual_external: "Maquininha externa"
  }[String(provider || "").toLowerCase()] || humanizeEnum(provider) || "Manual";
}

function humanizeEnum(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^\w|\s\w/g, (letter) => letter.toUpperCase());
}

function orderReference(order = {}) {
  const raw = String(order.reference || order.id || "");
  return `#CC-${raw.replace(/[^a-zA-Z0-9]/g, "").slice(-5).toUpperCase() || "00000"}`;
}

function clubStatusLabel(status = "") {
  return {
    active: "Ativa",
    pending_payment: "Aguardando pagamento",
    pending: "Pagamento pendente",
    paused: "Pausada",
    ending: "Sem renovação",
    cancelled: "Cancelada",
    ended: "Encerrada",
    payment_failed: "Falha na renovação",
    past_due: "Falha na renovação",
    cancelled_by_admin: "Cancelada"
  }[String(status || "").toLowerCase()] || "Não informado";
}

function renderMovieMediaPreview(inputId, previewId, label) {
  const url = $(inputId)?.value || "";
  const preview = $(previewId);
  if (!preview) return;
  preview.innerHTML = url
    ? `<img src="${escapeHtml(adminAssetUrl(url))}" alt="${escapeHtml(label)}" onerror="this.parentElement.textContent='Imagem indisponível'" />`
    : `<span>${escapeHtml(label)}</span>`;
  const uploadRoot = preview.closest(".image-setting-grid, .media-grid");
  uploadRoot?.classList.toggle("has-image", Boolean(url));
  const action = uploadRoot?.querySelector(".upload-action-label");
  if (action) action.textContent = url ? "Trocar imagem" : "Escolher imagem";
}

const marketingImageFields = [
  ["eventHeroImageUrl", "eventHeroImagePreview", "Prévia da imagem principal"],
  ["eventGamesImageUrl", "eventGamesImagePreview", "Prévia de games"],
  ["eventPartiesImageUrl", "eventPartiesImagePreview", "Prévia de festas"],
  ["eventCorporateImageUrl", "eventCorporateImagePreview", "Prévia corporativa"],
  ["eventGalleryImageUrl", "eventGalleryImagePreview", "Prévia da galeria"]
];

const clubImageFields = [
  ["clubHeroImageUrl", "clubHeroImagePreview", "Prévia do hero"],
  ["clubBannerImageUrl", "clubBannerImagePreview", "Prévia do banner"]
];

function renderAdminImagePreview(inputId, previewId, label) {
  renderMovieMediaPreview(inputId, previewId, label);
}

function fillImageFields(fields, settings = {}) {
  fields.forEach(([inputId, previewId, label]) => {
    if ($(inputId)) $(inputId).value = settings[inputId] || "";
    renderAdminImagePreview(inputId, previewId, label);
  });
}

function collectImageSettings(fields) {
  return fields.reduce((payload, [inputId]) => {
    if ($(inputId)) payload[inputId] = cleanAdminAssetUrl($(inputId).value);
    return payload;
  }, {});
}

function clearImageField(inputId, previewId, label) {
  if ($(inputId)) $(inputId).value = "";
  state.pendingImages[inputId] = "";
  renderAdminImagePreview(inputId, previewId, label);
}

async function persistSettings(payload, title, message) {
  const saved = await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  state.content.settings = cleanAssetRecord(saved, [
    "eventHeroImageUrl",
    "eventGamesImageUrl",
    "eventPartiesImageUrl",
    "eventCorporateImageUrl",
    "eventGalleryImageUrl",
    "clubHeroImageUrl",
    "clubBannerImageUrl"
  ]);
  fillSettingsForm();
  showSuccess(title, message);
  showToast("Alterações salvas.");
}

function renderMoviePublishSummary() {
  const target = $("moviePublishSummary");
  if (!target) return;
  const sessions = state.movieDraftSessions || [];
  target.innerHTML = `
    <div><span>Título</span><strong>${escapeHtml($("movieTitle").value || "Sem título")}</strong></div>
    <div><span>Página</span><strong>/filmes/${escapeHtml($("movieSlug").value || slugify($("movieTitle").value) || "novo-filme")}</strong></div>
    <div><span>Status no site</span><strong>${publicMovieStatusLabel($("movieStatus").value)}</strong></div>
    <div><span>Sessões cadastradas</span><strong>${sessions.length}</strong></div>
    <div><span>Destaque da home</span><strong>${$("movieHighlight").checked ? "Sim" : "Não"}</strong></div>
  `;
}

function setMovieWizardStep(step) {
  const nextStep = Math.max(0, Math.min(4, Number(step || 0)));
  state.movieWizardStep = nextStep;
  document.querySelectorAll("[data-movie-step]").forEach((button) => {
    const buttonStep = Number(button.dataset.movieStep);
    button.classList.toggle("active", buttonStep === nextStep);
    button.classList.toggle("done", buttonStep < nextStep);
  });
  document.querySelectorAll("[data-movie-step-panel]").forEach((panel) => {
    panel.classList.toggle("active", Number(panel.dataset.movieStepPanel) === nextStep);
  });
  setDisabled("movieWizardBack", nextStep === 0);
  $("movieWizardNext").hidden = nextStep === 4;
  $("moviePublishButton").hidden = nextStep !== 4;
  if (nextStep === 4) renderMoviePublishSummary();
}

function validateMovieWizardStep(step, finalPublish = false) {
  if (step >= 0 && !$("movieTitle").value.trim()) {
    showToast("Informe o título do filme.", "error");
    setMovieWizardStep(0);
    $("movieTitle").focus();
    return false;
  }
  if (step >= 0 && !$("movieSlug").value.trim()) {
    $("movieSlug").value = slugify($("movieTitle").value);
  }
  if (!finalPublish) return true;
  if (!$("moviePosterUrl").value.trim()) {
    showToast("Adicione um pôster antes de publicar.", "error");
    setMovieWizardStep(2);
    return false;
  }
  return true;
}

function renderMovies() {
  const movies = [...(state.content?.movies || [])].sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
  if (state.creating.movie) {
    $("moviesList").innerHTML = creationPlaceholder("Novo filme em edição", "Preencha o quadro à direita e publique quando estiver pronto.");
    fillMovieForm(null);
    return;
  }
  if (!movies.length) {
    $("moviesList").innerHTML = `
      <div class="empty-state">
        <strong>Nenhum filme cadastrado</strong>
        <span>Use Novo Filme ou a busca TMDB para montar o catálogo.</span>
      </div>
    `;
    fillMovieForm(null);
    return;
  }

  $("moviesList").innerHTML = movies
    .map((movie) => {
      const sessionCount = movie.sessions?.length || 0;
      const active = movie.id === state.selectedMovieId ? "active" : "";
      const statusLabel = publicMovieStatusLabel(movie.status);
      const priorityState = moviePriorityState(movie);
      const workflowLabel = workflowStatusLabel(movie.workflowStatus);
      const release = movie.releaseDate ? ` • estreia ${new Date(`${movie.releaseDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "";
      const automation = movie.autoPublish ? " • auto" : "";
      const updated = movie.updatedAt ? ` • atualizado ${new Date(movie.updatedAt).toLocaleDateString("pt-BR")}` : "";
      return `
        <div class="movie-row ${active}" draggable="true" data-movie-id="${escapeHtml(movie.id)}" ondragstart="handleMovieDragStart(event, '${escapeHtml(movie.id)}')" ondragover="handleMovieDragOver(event)" ondragleave="handleMovieDragLeave(event)" ondragend="handleMovieDragEnd()" ondrop="handleMovieDrop(event, '${escapeHtml(movie.id)}')" onclick="selectMovie('${escapeHtml(movie.id)}')">
          <button class="drag-handle" type="button" draggable="true" aria-label="Arrastar para mudar prioridade" title="Arrastar para mudar prioridade" ondragstart="handleMovieDragStart(event, '${escapeHtml(movie.id)}')" ondragend="handleMovieDragEnd()" onclick="event.stopPropagation()">↕</button>
          <div class="movie-thumb">${movie.posterUrl ? `<img src="${escapeHtml(movie.posterUrl)}" alt="">` : `<span>${escapeHtml(movie.rating || "L")}</span>`}</div>
          <div>
            <span class="list-title">${escapeHtml(movie.title)}</span>
            <span class="movie-status-pill ${escapeHtml(priorityState.className)}"><span></span>${escapeHtml(priorityState.label)}</span>
            <span class="list-meta">${workflowLabel} • ${statusLabel} • ${sessionCount} sessões • ${escapeHtml(movie.duration || "-")} • ${escapeHtml(movie.rating || "L")}${release}${automation}${movie.isHighlight ? " • destaque" : ""}${updated}</span>
          </div>
          <div class="movie-row-actions" onclick="event.stopPropagation()">
            <button class="icon-button" type="button" onclick="toggleMovieMenu('${escapeHtml(movie.id)}')" aria-label="Ações do filme">•••</button>
            <div id="movieMenu-${escapeHtml(movie.id)}" class="context-menu-popover" hidden>
              <button type="button" onclick="duplicateMovie('${escapeHtml(movie.id)}')">Duplicar</button>
              <button type="button" onclick="moveMovie('${escapeHtml(movie.id)}', -1)">Mover para cima</button>
              <button type="button" onclick="moveMovie('${escapeHtml(movie.id)}', 1)">Mover para baixo</button>
              <button type="button" onclick="archiveMovie('${escapeHtml(movie.id)}')">Arquivar</button>
              <button class="danger-text" type="button" onclick="deleteMovie('${escapeHtml(movie.id)}')">Excluir</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  fillMovieForm(currentMovie());
}

function fillMovieForm(movie) {
  syncCreationControl("movie", "cancelMovieCreateButton", "deleteMovieButton", Boolean(movie));
  setDisabled("deleteMovieButton", !movie);
  setDisabled("addSessionButton", !movie);
  $("movieFormHint").textContent = movie ? `Editando ${movie.title}` : "Novo filme";
  $("movieId").value = movie?.id || "";
  $("movieWorkflowStatus").value = movie?.workflowStatus || "draft";
  $("movieTitle").value = movie?.title || "";
  $("movieOriginalTitle").value = movie?.originalTitle || "";
  $("movieSlug").value = movie?.slug || movie?.id || "";
  $("movieSlug").dataset.touched = movie ? "true" : "";
  $("movieStatus").value = movie?.status || "now_playing";
  $("movieRating").value = movie?.rating || "L";
  $("movieReleaseDate").value = movie?.releaseDate || "";
  $("movieAutoPublish").checked = Boolean(movie?.autoPublish);
  $("movieDuration").value = movie?.duration || "";
  $("movieDirector").value = movie?.director || "";
  $("movieTag").value = movie?.tag || "Em Breve";
  $("movieGenre").value = (movie?.genre || []).join(", ");
  $("movieSynopsis").value = movie?.synopsis || "";
  $("movieTrailer").value = movie?.trailerYoutubeId || "";
  $("movieHighlight").checked = Boolean(movie?.isHighlight);
  $("moviePosterUrl").value = movie?.posterUrl || "";
  $("movieBackdropUrl").value = movie?.backdropUrl || "";
  renderMovieMediaPreview("moviePosterUrl", "moviePosterPreview", "Prévia do pôster");
  renderMovieMediaPreview("movieBackdropUrl", "movieBackdropPreview", "Prévia do banner");
  state.movieDraftSessions = (movie?.sessions || []).map((session) => ({ ...session }));
  closeSessionEditor();
  renderSessions(state.movieDraftSessions);
  setMovieWizardStep(0);
}

async function searchTmdb() {
  const query = $("tmdbQuery").value.trim();
  if (!query) {
    $("tmdbMessage").textContent = "Digite um título para buscar.";
    showToast("Digite o titulo do filme antes de buscar.", "error");
    return;
  }

  setDisabled("tmdbSearchButton", true);
  $("tmdbMessage").textContent = "Buscando no TMDB...";
  $("tmdbResults").innerHTML = Array.from({ length: 3 }, () => `<div class="skeleton-card"></div>`).join("");

  try {
    const results = await api(`/api/tmdb/search?query=${encodeURIComponent(query)}`);
    if (!results.length) {
      $("tmdbMessage").textContent = "Nenhum filme encontrado com esse título.";
      $("tmdbResults").innerHTML = "";
      return;
    }

    $("tmdbMessage").textContent = "Selecione o filme correto para importar os dados.";
    $("tmdbResults").innerHTML = results
      .map(
        (movie) => `
          <button class="tmdb-result" type="button" onclick="importTmdbMovie('${movie.tmdbId}')">
            <span class="tmdb-thumb">
              ${movie.posterUrl ? `<img src="${movie.posterUrl}" alt="">` : ""}
            </span>
            <span>
              <strong>${escapeHtml(movie.title)}</strong>
              <small>${escapeHtml(movie.year || "Ano não informado")} • ${escapeHtml(movie.originalTitle || "")}</small>
            </span>
          </button>
        `
      )
      .join("");
  } catch (error) {
    $("tmdbMessage").textContent = error.message;
    showToast("TMDB não configurado ou indisponível.", "error");
    $("tmdbResults").innerHTML = "";
  } finally {
    setDisabled("tmdbSearchButton", false);
  }
}

async function importTmdbMovie(tmdbId) {
  $("tmdbMessage").textContent = "Importando dados oficiais...";
  try {
    const existing = currentMovie();
    const existingId = $("movieId").value || existing?.id || "";
    const movie = await api(`/api/tmdb/movie/${encodeURIComponent(tmdbId)}`);
    if (!existingId) state.selectedMovieId = "";
    fillMovieForm({
      ...movie,
      id: existingId || movie.id,
      slug: existing?.slug || movie.slug || movie.id,
      workflowStatus: existing?.workflowStatus || movie.workflowStatus || "draft",
      status: existing?.status || movie.status,
      isHighlight: Boolean(existing?.isHighlight),
      tag: existing?.tag || movie.tag,
      sessions: existing?.sessions || []
    });
    if (!existingId) {
      $("movieId").value = "";
      $("movieStatus").value = "upcoming";
    }
    $("tmdbMessage").textContent = existingId
      ? "Dados importados no filme selecionado. Revise e salve para atualizar."
      : "Dados importados. Revise o status e salve o filme.";
    showToast("Dados oficiais importados para o formulário.");
  } catch (error) {
    $("tmdbMessage").textContent = error.message;
    showToast("Não foi possível importar o filme.", "error");
  }
}

function renderSessions(sessions) {
  if (!sessions.length) {
    $("sessionsList").innerHTML = `
      <div class="empty-state">
        <strong>Nenhuma sessão cadastrada</strong>
        <span>O filme está salvo normalmente. Adicione um horário apenas quando a programação estiver definida.</span>
        ${$("movieId").value ? `<button class="ghost-button" type="button" onclick="openSessionEditor()">Adicionar primeira sessão</button>` : `<span class="empty-state-note">Salve o filme antes de cadastrar sessões.</span>`}
      </div>
    `;
    return;
  }

  const pageSize = state.movieSessionsPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  state.movieSessionsPage = Math.min(Math.max(1, state.movieSessionsPage || 1), totalPages);
  const start = (state.movieSessionsPage - 1) * pageSize;
  const pageItems = sessions.slice(start, start + pageSize);

  const pagerMarkup = `
    <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, sessions.length)}</strong> de <strong>${sessions.length}</strong> sessão(ões)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.movieSessionsPage <= 1 ? "disabled" : ""} onclick="changeMovieSessionsPage(-1)">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.movieSessionsPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.movieSessionsPage >= totalPages ? "disabled" : ""} onclick="changeMovieSessionsPage(1)">Próxima →</button>
      </div>
    </div>
  `;

  $("sessionsList").innerHTML = `
    ${pagerMarkup}
    <div class="sessions-list">
      ${pageItems
        .map(
          (session) => {
            const linkedTickets = (state.content?.tickets || []).filter((ticket) => ticket.sessionId === session.id);
            const sold = linkedTickets.filter((ticket) => !["cancelled", "refunded", "pending_payment"].includes(ticket.status)).length;
            const capacity = Number(session.capacity || linkedTickets[0]?.sessionCapacity || 0);
            const allowedTypes = sessionTicketTypes(session);
            const ticketTypeSummary = allowedTypes.length
              ? allowedTypes.map((ticketType) => `${ticketType.name} ${money(ticketType.price)}`).join(" • ")
              : "Sem ingressos liberados";
            return `
            <div class="session-row">
              <strong>${session.time}</strong>
              <span>${session.date ? `${new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR")} • ` : ""}${session.format} • ${session.room}</span>
              <span>${escapeHtml(ticketTypeSummary)}${capacity ? ` • ${sold}/${capacity} vendidos` : linkedTickets.length ? ` • ${linkedTickets.length} ingresso(s)` : ""}</span>
              <div class="session-row-actions">
                <button class="ghost-button" type="button" onclick="showSessionTickets('${escapeHtml(session.id)}')">Ingressos</button>
                <button class="ghost-button" type="button" onclick="openSessionEditor('${escapeHtml(session.id)}')">Editar</button>
                <button class="icon-button danger-icon" type="button" onclick="removeSession('${escapeHtml(session.id)}')" aria-label="Excluir sessão">${trashIcon}</button>
              </div>
            </div>
          `;
          }
        )
        .join("")}
    </div>
  `;
}

function changeMovieSessionsPage(delta) {
  const movie = currentMovie();
  const sessions = movie?.sessions || [];
  const pageSize = state.movieSessionsPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  state.movieSessionsPage = Math.min(Math.max(1, (state.movieSessionsPage || 1) + delta), totalPages);
  renderSessions(sessions);
}

function sessionTicketTypes(session = {}) {
  const activeTypes = (state.content?.ticketTypes || []).filter((ticketType) => ticketType.active !== false);
  const selectedIds = new Set(Array.isArray(session.ticketTypeIds) && session.ticketTypeIds.length ? session.ticketTypeIds : activeTypes.map((ticketType) => ticketType.id));
  return activeTypes.filter((ticketType) => selectedIds.has(ticketType.id));
}

function renderSessionTicketTypeOptions(selectedIds = []) {
  const target = $("sessionTicketTypes");
  if (!target) return;
  const activeTypes = (state.content?.ticketTypes || []).filter((ticketType) => ticketType.active !== false);
  const selected = new Set(selectedIds.length ? selectedIds : activeTypes.map((ticketType) => ticketType.id));
  target.innerHTML = activeTypes.length
    ? activeTypes.map((ticketType) => `
      <label class="session-ticket-type-option">
        <input type="checkbox" value="${escapeHtml(ticketType.id)}" ${selected.has(ticketType.id) ? "checked" : ""} />
        <span class="session-ticket-type-copy">
          <strong>${escapeHtml(ticketType.name)}</strong>
          <small>${ticketType.description ? escapeHtml(ticketType.description) : "Tipo de ingresso ativo"}</small>
        </span>
        <span class="session-ticket-type-price">${money(ticketType.price)}</span>
      </label>
    `).join("")
    : `<div class="empty-state compact"><strong>Nenhum tipo de ingresso ativo</strong><span>Cadastre e ative os tipos na aba Ingressos antes de criar sessões.</span></div>`;
}

function renderRoomOptions() {
  const rooms = state.content?.rooms || [];
  $("sessionRoom").innerHTML = rooms
    .map((room) => `<option value="${room.name} (${room.technology || "Sala"})">${room.name}</option>`)
    .join("");
}

function selectMovie(id) {
  state.creating.movie = false;
  state.selectedMovieId = id;
  renderMovies();
}

function orderedMovies() {
  return [...(state.content?.movies || [])].sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.title || "").localeCompare(String(b.title || "")));
}

async function saveMovieOrder(ids) {
  if (!ids.length) return;
  try {
    const result = await api("/api/movies/order", {
      method: "PUT",
      body: JSON.stringify({ ids })
    });
    state.content.movies = result.movies || state.content.movies;
    renderMovies();
    setStatus("Salvo");
    showToast("Prioridade dos filmes atualizada.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function moveMovie(id, direction) {
  const ids = orderedMovies().map((movie) => movie.id);
  const index = ids.indexOf(id);
  const nextIndex = index + Number(direction || 0);
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
  [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
  saveMovieOrder(ids);
}

function handleMovieDragStart(event, id) {
  event.stopPropagation();
  event.dataTransfer?.setData("text/plain", id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  document.querySelectorAll(".movie-row").forEach((row) => {
    row.classList.toggle("dragging", row.dataset.movieId === id);
  });
}

function handleMovieDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  event.currentTarget?.classList.add("drag-over");
}

function handleMovieDragLeave(event) {
  event.currentTarget?.classList.remove("drag-over");
}

function handleMovieDragEnd() {
  document.querySelectorAll(".movie-row.drag-over, .movie-row.dragging").forEach((row) => {
    row.classList.remove("drag-over", "dragging");
  });
}

function handleMovieDrop(event, targetId) {
  event.preventDefault();
  event.stopPropagation();
  handleMovieDragEnd();
  const sourceId = event.dataTransfer?.getData("text/plain");
  if (!sourceId || sourceId === targetId) return;
  const ids = orderedMovies().map((movie) => movie.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  saveMovieOrder(ids);
}

function toggleMovieMenu(movieId) {
  closeFloatingActionMenu();
  document.querySelectorAll(".context-menu-popover").forEach((menu) => {
    if (menu.id !== `movieMenu-${movieId}`) menu.hidden = true;
  });
  const menu = $(`movieMenu-${movieId}`);
  if (menu) menu.hidden = !menu.hidden;
}

function newMovie() {
  state.creating.movie = true;
  state.selectedMovieId = "";
  $("moviesList").innerHTML = creationPlaceholder("Novo filme em edição", "Preencha o quadro à direita e publique quando estiver pronto.");
  fillMovieForm(null);
  $("movieWorkflowStatus").value = "draft";
  $("movieStatus").value = "upcoming";
}

function getMoviePayload(action = "published") {
  const workflowStatus = action === "draft" ? "draft" : "published";
  const status = action === "draft" ? "hidden" : $("movieStatus").value;
  return {
    id: $("movieId").value || $("movieSlug").value || undefined,
    slug: $("movieSlug").value || slugify($("movieTitle").value),
    workflowStatus,
    status,
    title: $("movieTitle").value,
    originalTitle: $("movieOriginalTitle").value,
    synopsis: $("movieSynopsis").value,
    duration: $("movieDuration").value,
    director: $("movieDirector").value,
    genre: $("movieGenre").value.split(",").map((item) => item.trim()).filter(Boolean),
    rating: $("movieRating").value,
    releaseDate: $("movieReleaseDate").value,
    autoPublish: $("movieAutoPublish").checked,
    posterUrl: $("moviePosterUrl").value,
    backdropUrl: $("movieBackdropUrl").value,
    trailerYoutubeId: $("movieTrailer").value,
    isHighlight: $("movieHighlight").checked,
    tag: $("movieTag").value,
    sortOrder: Number(currentMovie()?.sortOrder ?? 100),
    metadata: {
      updatedFromAdmin: true
    }
  };
}

async function saveMovieWithAction(action = "published") {
  try {
    if (!validateMovieWizardStep(4, action === "published")) return;
    const payload = getMoviePayload(action);
    const existingId = $("movieId").value || state.selectedMovieId;
    if (existingId) payload.id = existingId;
    const saved = existingId
      ? await api(`/api/movies/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/movies", { method: "POST", body: JSON.stringify(payload) });
    state.creating.movie = false;
    state.selectedMovieId = saved.id;
    await loadContent({ silent: true });
    showToast(action === "draft" ? "Rascunho salvo." : "Filme publicado.");
    showSuccess(action === "draft" ? "Rascunho salvo" : "Filme publicado", `${saved.title} foi atualizado no catálogo administrativo.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function saveMovie(event) {
  event.preventDefault();
  await saveMovieWithAction("published");
}

async function deleteMovie(id = "") {
  const movie = id ? state.content?.movies?.find((item) => item.id === id) : currentMovie();
  if (!movie || !confirm(`Excluir ${movie.title}?`)) return;
  try {
    const result = await api(`/api/movies/${encodeURIComponent(movie.id)}`, { method: "DELETE" });
    state.selectedMovieId = "";
    await loadContent({ silent: true });
    showToast(result.archived ? "Filme arquivado por possuir histórico." : "Filme excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function closeSessionEditor() {
  state.editingSessionId = "";
  if ($("sessionEditor")) $("sessionEditor").hidden = true;
  if ($("sessionId")) $("sessionId").value = "";
  if ($("sessionLinkedTickets")) $("sessionLinkedTickets").hidden = true;
}

function syncSessionCreationMode() {
  const editing = Boolean(state.editingSessionId);
  const range = !editing && $("sessionCreationMode")?.value === "range";
  if ($("sessionCreationModeRow")) $("sessionCreationModeRow").hidden = editing;
  if ($("sessionDateEndField")) $("sessionDateEndField").hidden = !range;
  if ($("sessionWeekdays")) $("sessionWeekdays").hidden = !range;
  if ($("sessionDateLabel")) $("sessionDateLabel").textContent = range ? "De" : "Data";
  if ($("saveSessionButton")) $("saveSessionButton").textContent = editing ? "Salvar alterações" : range ? "Criar sessões" : "Adicionar sessão";
  if (range && !$("sessionDateEnd").value) $("sessionDateEnd").value = $("sessionDate").value;
}

function renderSessionLinkedTickets(sessionId) {
  const target = $("sessionLinkedTickets");
  if (!target) return;
  if (!sessionId) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  const linkedTickets = (state.content?.tickets || []).filter((ticket) => ticket.sessionId === sessionId);
  target.hidden = false;
  target.innerHTML = linkedTickets.length
    ? `
      <div class="session-linked-head">
        <strong>${linkedTickets.length} ingresso(s) vinculado(s)</strong>
        <button class="text-button" type="button" onclick="showSessionTickets('${escapeHtml(sessionId)}')">Ver na aba Ingressos</button>
      </div>
      <div class="session-linked-list">
        ${linkedTickets.slice(0, 6).map((ticket) => `
          <span>${escapeHtml(ticket.code || ticket.id)} • ${escapeHtml(ticketStatusText(ticket.status))} • ${escapeHtml(ticket.customerName || ticket.customerEmail || "Cliente")}</span>
        `).join("")}
      </div>
    `
    : `
      <div class="session-linked-head">
        <strong>Nenhum ingresso vinculado</strong>
        <span>Novas vendas desta sessão aparecerão aqui automaticamente.</span>
      </div>
    `;
}

function openSessionEditor(sessionId = "") {
  const movieId = $("movieId").value || state.selectedMovieId;
  if (!movieId) {
    showToast("Salve o filme antes de adicionar uma sessão.", "error");
    return;
  }
  const session = (state.movieDraftSessions || []).find((item) => item.id === sessionId);
  state.editingSessionId = session?.id || "";
  state.editingSessionOriginalDate = session?.date || "";
  state.editingSessionDateChanged = false;
  $("sessionId").value = session?.id || "";
  $("sessionDate").value = session?.date || "";
  $("sessionTime").value = session?.time || "19:00";
  $("sessionFormat").value = session?.format || "2D Dublado";
  if (session?.room && [...$("sessionRoom").options].some((option) => option.value === session.room)) {
    $("sessionRoom").value = session.room;
  }
  renderSessionTicketTypeOptions(Array.isArray(session?.ticketTypeIds) ? session.ticketTypeIds : []);
  $("sessionStatus").value = session?.status || "available";
  $("sessionCreationMode").value = "single";
  $("sessionDateEnd").value = session?.date || "";
  $("sessionEditorTitle").textContent = session ? "Editar sessão" : "Nova sessão";
  $("sessionEditor").hidden = false;
  syncSessionCreationMode();
  renderSessionLinkedTickets(session?.id || "");
  $("sessionDate").focus();
}

async function saveSession() {
  const movieId = $("movieId").value || state.selectedMovieId;
  if (!movieId) {
    showToast("Salve o filme antes de adicionar uma sessão.", "error");
    return;
  }
  if (!$("sessionDate").value || !$("sessionTime").value || !$("sessionRoom").value || !$("sessionFormat").value) {
    showToast("Preencha data, horário, sala e formato da sessão.", "error");
    return;
  }
  const ticketTypeIds = [...document.querySelectorAll("#sessionTicketTypes input:checked")].map((input) => input.value);
  if (!ticketTypeIds.length) {
    showToast("Selecione pelo menos um tipo de ingresso para esta sessão.", "error");
    return;
  }

  const sessionId = state.editingSessionId;
  const range = !sessionId && $("sessionCreationMode").value === "range";
  if (range && (!$('sessionDateEnd').value || $('sessionDateEnd').value < $('sessionDate').value)) {
    showToast("A data final precisa ser igual ou posterior à data inicial.", "error");
    return;
  }
  const payload = {
    date: $("sessionDate").value,
    dateChanged: !sessionId || state.editingSessionDateChanged,
    ...(range ? {
      dateFrom: $("sessionDate").value,
      dateTo: $("sessionDateEnd").value,
      times: [$("sessionTime").value],
      weekdays: [...document.querySelectorAll("#sessionWeekdays input:checked")].map((input) => Number(input.value))
    } : {}),
    time: $("sessionTime").value,
    format: $("sessionFormat").value,
    room: $("sessionRoom").value,
    ticketTypeIds,
    status: $("sessionStatus").value
  };

  try {
    setDisabled("saveSessionButton", true);
    const result = await api(`/api/movies/${encodeURIComponent(movieId)}/sessions${sessionId ? `/${encodeURIComponent(sessionId)}` : ""}`, {
      method: sessionId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    closeSessionEditor();
    await loadContent({ silent: true });
    setMovieWizardStep(3);
    if (range) {
      showSuccess("Programação criada", `${Number(result.totalCreated || 0)} sessão(ões) adicionada(s)${result.totalSkipped ? ` e ${result.totalSkipped} duplicada(s) ignorada(s)` : ""}.`);
    } else {
      const savedDate = result.date ? new Date(`${result.date}T12:00:00`).toLocaleDateString("pt-BR") : payload.date;
      showSuccess(sessionId ? "Sessão atualizada" : "Sessão adicionada", `${savedDate} às ${result.time || payload.time}.`);
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setDisabled("saveSessionButton", false);
  }
}

async function removeSession(sessionId) {
  const movieId = $("movieId").value || state.selectedMovieId;
  const session = (state.movieDraftSessions || []).find((item) => item.id === sessionId);
  if (!movieId || !session || !confirm(`Excluir a sessão de ${session.time}?`)) return;
  try {
    await api(`/api/movies/${encodeURIComponent(movieId)}/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    closeSessionEditor();
    await loadContent({ silent: true });
    setMovieWizardStep(3);
    showToast("Sessão excluída.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function archiveMovie(id) {
  const movie = state.content?.movies?.find((item) => item.id === id);
  if (!movie) return;
  try {
    const { sessions, ...movieData } = movie;
    await api(`/api/movies/${encodeURIComponent(movie.id)}`, {
      method: "PUT",
      body: JSON.stringify({ ...movieData, workflowStatus: "archived", status: "hidden", isHighlight: false })
    });
    await loadContent({ silent: true });
    showToast("Filme arquivado.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function duplicateMovie(id) {
  const movie = state.content?.movies?.find((item) => item.id === id);
  if (!movie) return;
  const slug = `${movie.slug || movie.id}-copia`;
  try {
    const copy = await api("/api/movies", {
      method: "POST",
      body: JSON.stringify({
        ...movie,
        id: slug,
        slug,
        title: `${movie.title} (cópia)`,
        workflowStatus: "draft",
        status: "hidden",
        isHighlight: false,
        sessions: []
      })
    });
    state.selectedMovieId = copy.id;
    await loadContent({ silent: true });
    showToast("Cópia criada como rascunho.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function enhanceImageUploads() {
  document.querySelectorAll('input[type="file"][accept*="image"]').forEach((input) => {
    const label = input.closest("label");
    if (!label || label.dataset.enhancedUpload) return;
    label.dataset.enhancedUpload = "true";
    label.classList.add("enhanced-upload");
    const action = document.createElement("span");
    action.className = "upload-action-label";
    action.textContent = "Escolher imagem";
    input.insertAdjacentElement("afterend", action);
    ["dragenter", "dragover"].forEach((eventName) => label.addEventListener(eventName, (event) => {
      event.preventDefault();
      label.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => label.addEventListener(eventName, (event) => {
      event.preventDefault();
      label.classList.remove("is-dragging");
    }));
    label.addEventListener("drop", (event) => {
      const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
      if (!file) {
        label.classList.add("is-error");
        showToast("Arraste uma imagem JPG, PNG ou WebP.", "error");
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function enhanceLongForms() {
  document.querySelectorAll("form[data-dirty-track]").forEach((form) => {
    let actions = form.querySelector(".wizard-actions, .button-row:last-of-type");
    if (!actions) {
      const primary = form.querySelector(":scope > .primary-button:last-of-type");
      if (primary) {
        actions = document.createElement("div");
        actions.className = "button-row";
        primary.before(actions);
        actions.append(primary);
      }
    }
    if (!actions || actions.querySelector(".unsaved-indicator")) return;
    actions.classList.add("sticky-form-actions");
    const indicator = document.createElement("span");
    indicator.className = "unsaved-indicator";
    indicator.textContent = "Alterações não salvas";
    indicator.hidden = true;
    actions.prepend(indicator);
    const markDirty = () => {
      form.dataset.dirty = "true";
      indicator.hidden = false;
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("reset", () => markFormClean(form.id));
  });
}

function markFormClean(formId) {
  const form = typeof formId === "string" ? $(formId) : formId;
  if (!form) return;
  form.dataset.dirty = "false";
  const indicator = form.querySelector(".unsaved-indicator");
  if (indicator) indicator.hidden = true;
}

async function uploadAdminImage(fileInputId, targetInputId, previewId, folder, afterUpload) {
  const input = $(fileInputId);
  const target = $(targetInputId);
  const uploadRoot = input?.closest(".image-setting-grid") || input?.closest(".media-grid") || input?.closest("label");
  const file = input?.files?.[0];
  if (!file) return;
  if (!target) {
    showToast("Campo de destino da imagem não encontrado. Reabra este menu e tente novamente.", "error");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showToast("Use JPG, PNG ou WebP.", "error");
    input.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Imagem muito grande. Limite de 5 MB.", "error");
    input.value = "";
    return;
  }

  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    input.disabled = true;
    uploadRoot?.classList.remove("is-error");
    uploadRoot?.classList.add("is-loading");
    const result = await api("/api/uploads/images", {
      method: "POST",
      body: JSON.stringify({
        data,
        filename: file.name,
        contentType: file.type,
        folder
      })
    });
    target.value = cleanAdminAssetUrl(result.url || result.publicUrl || "");
    state.pendingImages[targetInputId] = target.value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    if (previewId) renderMovieMediaPreview(targetInputId, previewId, file.name);
    if (typeof afterUpload === "function") await afterUpload({ ...result, url: target.value });
    showToast("Imagem enviada.");
  } catch (error) {
    uploadRoot?.classList.add("is-error");
    showToast(error.message, "error");
  } finally {
    uploadRoot?.classList.remove("is-loading");
    input.disabled = false;
    input.value = "";
  }
}

function uploadMovieImage(fileInputId, targetInputId, previewId, folder) {
  return uploadAdminImage(fileInputId, targetInputId, previewId, folder);
}

function defaultRoomSeatDraft(room = null) {
  const seatTypes = Array.isArray(room?.seatTypes) && room.seatTypes.length
    ? structuredClone(room.seatTypes)
    : [{ id: "standard", name: "Padrão", color: "#2563eb", description: "Poltrona convencional" }];
  return {
    enabled: Boolean(room?.seatSelectionEnabled),
    screenLabel: room?.seatLayout?.screenLabel || "TELA",
    seatTypes,
    rows: Array.isArray(room?.seatLayout?.rows) ? structuredClone(room.seatLayout.rows).map((row) => ({
      ...row,
      seats: (row.seats || []).map((seat) => ({
        ...seat,
        accessibility: ["wheelchair", "obese"].includes(seat.accessibility) ? seat.accessibility : "",
        customLabel: seat.customLabel === true || !new RegExp(`^${String(row.label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`, "i").test(String(seat.label || ""))
      }))
    })) : []
  };
}

function roomSeatAccessibilityLabel(value) {
  if (value === "wheelchair") return "Cadeirante";
  if (value === "obese") return "Pessoa obesa";
  return "Sem marcador";
}

function roomSeatAccessibilityIcon(value) {
  if (value === "wheelchair") return accessibilityIcon;
  if (value === "obese") return obeseSeatIcon;
  return "";
}

function roomSeatColor(seat) {
  return seat?.color || state.roomSeatDraft?.seatTypes?.find((type) => type.id === seat?.typeId)?.color || "#2563eb";
}

function roomSeatTypeOptions(selectedId) {
  return (state.roomSeatDraft?.seatTypes || []).map((type) => `
    <option value="${escapeHtml(type.id)}" ${type.id === selectedId ? "selected" : ""}>${escapeHtml(type.name)}</option>
  `).join("");
}

function roomSeatTargets(selection = state.roomSeatSelection) {
  const rows = state.roomSeatDraft?.rows || [];
  if (!selection) return [];
  if (selection.kind === "seat") return rows.flatMap((row) => row.seats).filter((seat) => seat.id === selection.seatId);
  if (selection.kind === "row") return rows.find((row) => row.id === selection.rowId)?.seats || [];
  if (selection.kind === "column") return rows.map((row) => row.seats[selection.columnIndex]).filter(Boolean);
  return [];
}

function selectedRoomSeatRow() {
  return (state.roomSeatDraft?.rows || []).find((row) => row.id === state.roomSeatSelection?.rowId) || null;
}

function uniqueRoomSeatId(prefix = "seat") {
  const ids = new Set((state.roomSeatDraft?.rows || []).flatMap((row) => row.seats.map((seat) => seat.id)));
  let id = `${prefix}-${Date.now().toString(36)}`;
  let suffix = 1;
  while (ids.has(id)) id = `${prefix}-${Date.now().toString(36)}-${suffix++}`;
  return id;
}

function nextRoomRowLabel() {
  const labels = new Set((state.roomSeatDraft?.rows || []).map((row) => String(row.label || "").toUpperCase()));
  for (let code = 65; code <= 90; code += 1) {
    const label = String.fromCharCode(code);
    if (!labels.has(label)) return label;
  }
  return `F${labels.size + 1}`;
}

function renumberRoomSeatRow(row) {
  (row?.seats || []).forEach((seat, index) => {
    if (seat.customLabel !== true) seat.label = `${row?.label || "P"}${index + 1}`;
  });
}

function createRoomSeat(row, typeId) {
  return {
    id: uniqueRoomSeatId(`${row.id}-seat`),
    label: `${row?.label || "P"}${(row?.seats || []).length + 1}`,
    customLabel: false,
    typeId: typeId || state.roomSeatDraft?.seatTypes?.[0]?.id || "standard",
    color: "",
    accessibility: "",
    enabled: true,
    aisleAfter: false
  };
}

function renderRoomSeatTypes() {
  const draft = state.roomSeatDraft || defaultRoomSeatDraft();
  const target = $("roomSeatTypes");
  if (!target) return;
  target.innerHTML = draft.seatTypes.map((type) => `
    <div class="room-seat-type-row" data-seat-type-id="${escapeHtml(type.id)}">
      <input type="color" value="${escapeHtml(type.color || "#2563eb")}" aria-label="Cor de ${escapeHtml(type.name)}" data-seat-type-field="color" />
      <input value="${escapeHtml(type.name)}" maxlength="40" aria-label="Nome do tipo de poltrona" data-seat-type-field="name" />
      <input value="${escapeHtml(type.description || "")}" maxlength="120" placeholder="Descrição opcional" aria-label="Descrição do tipo de poltrona" data-seat-type-field="description" />
      <button class="icon-button danger" type="button" title="Remover tipo" aria-label="Remover ${escapeHtml(type.name)}" data-remove-seat-type="${escapeHtml(type.id)}">${trashIcon}</button>
    </div>
  `).join("");
}

function renderRoomSeatSelectionPanel() {
  const panel = $("roomSeatSelectionPanel");
  if (!panel) return;
  const selection = state.roomSeatSelection;
  const targets = roomSeatTargets(selection);
  if (!selection || !targets.length) {
    state.roomSeatSelection = null;
    panel.innerHTML = `
      <div class="room-seat-selection-empty">
        <strong>Nenhum elemento selecionado</strong>
        <span>Selecione uma cadeira, fileira ou coluna para editar, adicionar ou excluir.</span>
      </div>`;
    return;
  }

  const first = targets[0];
  const typeId = targets.every((seat) => seat.typeId === first.typeId) ? first.typeId : "";
  const color = targets.every((seat) => (seat.color || "") === (first.color || ""))
    ? roomSeatColor(first)
    : "#2563eb";
  const accessibility = targets.every((seat) => (seat.accessibility || "") === (first.accessibility || ""))
    ? first.accessibility || ""
    : "mixed";
  const row = selection.kind === "row" ? selectedRoomSeatRow() : null;
  const seat = selection.kind === "seat" ? first : null;
  const title = selection.kind === "seat"
    ? `Cadeira ${seat.label}`
    : selection.kind === "row"
      ? `Fileira ${row?.label || ""}`
      : `Coluna ${Number(selection.columnIndex) + 1}`;
  const subtitle = selection.kind === "seat"
    ? "Alterações desta cadeira"
    : `${targets.length} cadeira(s) serão alteradas em conjunto`;
  const labelField = selection.kind === "seat" || selection.kind === "row" ? `
    <label>
      ${selection.kind === "seat" ? "Identificação" : "Nome da fileira"}
      <input data-seat-selection-field="label" maxlength="16" value="${escapeHtml(selection.kind === "seat" ? seat.label : row?.label || "")}" />
    </label>` : "";
  const availabilityField = selection.kind === "seat" ? `
    <label class="check-field">
      <input type="checkbox" data-seat-selection-field="enabled" ${seat.enabled !== false ? "checked" : ""} />
      <span>Cadeira disponível</span>
    </label>` : "";
  const aisleField = selection.kind === "seat" ? `
    <label class="check-field">
      <input type="checkbox" data-seat-selection-field="aisleAfter" ${seat.aisleAfter ? "checked" : ""} />
      <span>Corredor depois</span>
    </label>` : "";
  const actions = selection.kind === "seat" ? `
      <button class="ghost-button" type="button" data-seat-selection-action="seat-before">Adicionar antes</button>
      <button class="ghost-button" type="button" data-seat-selection-action="seat-after">Adicionar depois</button>
      <button class="danger-button" type="button" data-seat-selection-action="seat-delete">Excluir cadeira</button>`
    : selection.kind === "row" ? `
      <button class="ghost-button" type="button" data-seat-selection-action="row-before">Adicionar fileira acima</button>
      <button class="ghost-button" type="button" data-seat-selection-action="row-after">Adicionar fileira abaixo</button>
       <button class="ghost-button" type="button" data-seat-selection-action="row-seat-left">Adicionar cadeira à esquerda</button>
       <button class="ghost-button" type="button" data-seat-selection-action="row-seat-right">Adicionar cadeira à direita</button>
      <button class="danger-button" type="button" data-seat-selection-action="row-delete">Excluir fileira</button>`
    : `
      <button class="ghost-button" type="button" data-seat-selection-action="column-before">Adicionar coluna à esquerda</button>
      <button class="ghost-button" type="button" data-seat-selection-action="column-after">Adicionar coluna à direita</button>
      <button class="danger-button" type="button" data-seat-selection-action="column-delete">Excluir coluna</button>`;

  panel.innerHTML = `
    <div class="room-seat-selection-head">
      <div class="room-seat-selection-title"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
      <button class="icon-button" type="button" title="Fechar edição" aria-label="Fechar edição" data-seat-selection-action="clear">×</button>
    </div>
    <div class="room-seat-selection-fields">
      ${labelField}
      <label>
        Tipo de poltrona
        <select data-seat-selection-field="typeId">
          ${typeId ? roomSeatTypeOptions(typeId) : `<option value="">Tipos diferentes</option>${roomSeatTypeOptions("")}`}
        </select>
      </label>
      <label class="room-seat-color-field">
        <span>Cor personalizada</span>
        <input type="color" value="${escapeHtml(color)}" data-seat-selection-field="color" aria-label="Cor personalizada" />
        <button class="ghost-button" type="button" data-seat-selection-action="color-reset">Usar tipo</button>
      </label>
      <fieldset class="room-seat-accessibility-field">
        <legend>Marcador da cadeira</legend>
        <div class="room-seat-marker-options">
          <button type="button" class="${accessibility === "" ? "is-active" : ""}" data-seat-accessibility="" aria-pressed="${accessibility === ""}">Nenhum</button>
          <button type="button" class="${accessibility === "wheelchair" ? "is-active" : ""}" data-seat-accessibility="wheelchair" aria-pressed="${accessibility === "wheelchair"}">${accessibilityIcon}<span>Cadeirante</span></button>
          <button type="button" class="${accessibility === "obese" ? "is-active" : ""}" data-seat-accessibility="obese" aria-pressed="${accessibility === "obese"}">${obeseSeatIcon}<span>Pessoa obesa</span></button>
        </div>
      </fieldset>
      ${availabilityField}
      ${aisleField}
    </div>
    <div class="room-seat-selection-actions">${actions}</div>`;
}

function renderRoomSeatMap(renderSelectionPanel = true) {
  const draft = state.roomSeatDraft || defaultRoomSeatDraft();
  const target = $("roomSeatMap");
  if (!target) return;
  $("roomSeatScreen").textContent = draft.screenLabel || "TELA";
  const enabled = draft.rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat.enabled !== false).length, 0);
  const blocked = draft.rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat.enabled === false).length, 0);
  $("roomSeatCount").textContent = `${enabled} poltrona(s) disponível(is)${blocked ? ` • ${blocked} bloqueada(s)` : ""}`;
  $("roomCapacity").value = enabled || Number($("roomCapacity").value || 1);
  const selected = state.roomSeatSelection;
  const columnCount = draft.rows.reduce((max, row) => Math.max(max, row.seats.length), 0);
  const columnHead = `
    <div class="room-seat-column-head" aria-label="Colunas da sala">
      <span class="room-seat-column-spacer"></span>
      ${Array.from({ length: columnCount }, (_, columnIndex) => {
        const aisleAfter = draft.rows.some((row) => row.seats[columnIndex]?.aisleAfter);
        return `<button type="button" class="room-seat-column-button ${selected?.kind === "column" && selected.columnIndex === columnIndex ? "is-selected" : ""} ${aisleAfter ? "has-aisle" : ""}" data-room-seat-column="${columnIndex}" aria-label="Editar coluna ${columnIndex + 1}">${columnIndex + 1}</button>`;
      }).join("")}
    </div>`;
  target.innerHTML = draft.rows.length ? columnHead + draft.rows.map((row) => `
    <div class="room-seat-row">
      <button type="button" class="room-seat-row-label ${selected?.kind === "row" && selected.rowId === row.id ? "is-selected" : ""}" data-room-seat-row-id="${escapeHtml(row.id)}" aria-label="Editar fileira ${escapeHtml(row.label)}">${escapeHtml(row.label)}</button>
      ${(row.seats || []).map((seat, columnIndex) => `
        <button
          type="button"
          class="room-seat-button ${seat.enabled === false ? "is-blocked" : ""} ${seat.aisleAfter ? "has-aisle" : ""} ${seat.accessibility ? "has-accessibility" : ""} ${(selected?.kind === "seat" && selected.seatId === seat.id) || (selected?.kind === "column" && selected.columnIndex === columnIndex) || (selected?.kind === "row" && selected.rowId === row.id) ? "is-selected" : ""}"
          style="--seat-color:${escapeHtml(roomSeatColor(seat))}"
          data-room-seat-id="${escapeHtml(seat.id)}"
          title="${escapeHtml(seat.label)} • ${escapeHtml(state.roomSeatDraft.seatTypes.find((type) => type.id === seat.typeId)?.name || "Padrão")}${seat.accessibility ? ` • ${escapeHtml(roomSeatAccessibilityLabel(seat.accessibility))}` : ""}${seat.enabled === false ? " • bloqueada" : ""}"
          aria-label="Editar poltrona ${escapeHtml(seat.label)}${seat.accessibility ? `, ${escapeHtml(roomSeatAccessibilityLabel(seat.accessibility))}` : ""}"
        ><span class="room-seat-button-label">${escapeHtml(seat.label)}</span>${seat.accessibility ? `<span class="room-seat-button-marker">${roomSeatAccessibilityIcon(seat.accessibility)}</span>` : ""}</button>
      `).join("")}
    </div>
  `).join("") : `<div class="empty-state"><strong>Mapa ainda não gerado</strong><span>Defina filas, poltronas e corredor; depois clique em Gerar mapa.</span></div>`;
  if (renderSelectionPanel) renderRoomSeatSelectionPanel();
}

function renderRoomSeatEditor() {
  const draft = state.roomSeatDraft || defaultRoomSeatDraft();
  $("roomSeatSelectionEnabled").checked = draft.enabled;
  $("roomSeatEditor").hidden = !draft.enabled;
  $("roomCapacity").readOnly = draft.enabled;
  $("roomCapacityHelp").textContent = draft.enabled ? "Calculada automaticamente pelas poltronas disponíveis no mapa." : "Usada para sessões sem lugares marcados.";
  $("roomSeatScreenLabel").value = draft.screenLabel || "TELA";
  if (draft.rows.length) {
    $("roomSeatRows").value = draft.rows.length;
    $("roomSeatColumns").value = Math.max(...draft.rows.map((row) => row.seats.length), 1);
    const aisle = draft.rows[0]?.seats?.findIndex((seat) => seat.aisleAfter);
    $("roomSeatAisleAfter").value = aisle >= 0 ? aisle + 1 : 0;
  }
  renderRoomSeatTypes();
  renderRoomSeatMap();
}

function generateRoomSeatMap() {
  const rowCount = Math.max(1, Math.min(40, Number($("roomSeatRows").value || 1)));
  const columnCount = Math.max(1, Math.min(80, Number($("roomSeatColumns").value || 1)));
  const aisleAfter = Math.max(0, Math.min(columnCount - 1, Number($("roomSeatAisleAfter").value || 0)));
  if (state.roomSeatDraft?.rows?.length && !confirm("Gerar um novo mapa substituirá o desenho atual desta sala. Continuar?")) return;
  const defaultTypeId = state.roomSeatDraft?.seatTypes?.[0]?.id || "standard";
  state.roomSeatDraft.rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const label = rowIndex < 26 ? String.fromCharCode(65 + rowIndex) : `F${rowIndex + 1}`;
    const rowId = `row-${rowIndex + 1}`;
    return {
      id: rowId,
      label,
      seats: Array.from({ length: columnCount }, (_, seatIndex) => ({
        id: `${rowId}-seat-${seatIndex + 1}`,
        label: `${label}${seatIndex + 1}`,
        typeId: defaultTypeId,
        color: "",
        accessibility: "",
        customLabel: false,
        enabled: true,
        aisleAfter: aisleAfter > 0 && seatIndex + 1 === aisleAfter
      }))
    };
  });
  state.roomSeatSelection = null;
  renderRoomSeatMap();
}

function addRoomSeatType() {
  const id = `tipo-${Date.now().toString(36)}`;
  state.roomSeatDraft.seatTypes.push({ id, name: `Tipo ${state.roomSeatDraft.seatTypes.length + 1}`, color: "#0f766e", description: "" });
  renderRoomSeatTypes();
  renderRoomSeatMap();
}

function removeRoomSeatType(id) {
  if (state.roomSeatDraft.seatTypes.length <= 1) {
    showToast("A sala precisa manter pelo menos um tipo de poltrona.", "error");
    return;
  }
  const fallback = state.roomSeatDraft.seatTypes.find((type) => type.id !== id)?.id;
  state.roomSeatDraft.seatTypes = state.roomSeatDraft.seatTypes.filter((type) => type.id !== id);
  state.roomSeatDraft.rows.forEach((row) => row.seats.forEach((seat) => { if (seat.typeId === id) seat.typeId = fallback; }));
  renderRoomSeatTypes();
  renderRoomSeatMap();
}

function selectRoomSeatElement(selection) {
  state.roomSeatSelection = selection;
  renderRoomSeatMap();
}

function updateRoomSeatSelectionField(field, value) {
  const selection = state.roomSeatSelection;
  const targets = roomSeatTargets(selection);
  if (!selection || !targets.length) return;
  if (field === "label") {
    if (selection.kind === "seat") {
      targets[0].label = String(value || "").trim().slice(0, 16) || targets[0].label;
      targets[0].customLabel = true;
    }
    if (selection.kind === "row") {
      const row = selectedRoomSeatRow();
      if (!row) return;
      const previous = String(row.label || "");
      const next = String(value || "").trim().slice(0, 8) || previous;
      row.label = next;
      row.seats.forEach((seat) => {
        if (new RegExp(`^${previous.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+$`, "i").test(seat.label)) {
          seat.label = `${next}${seat.label.slice(previous.length)}`;
        }
      });
      renumberRoomSeatRow(row);
    }
  } else if (field === "typeId" && value) {
    targets.forEach((seat) => {
      seat.typeId = value;
      seat.color = "";
    });
  } else if (field === "color") {
    targets.forEach((seat) => { seat.color = value; });
  } else if (field === "enabled") {
    targets.forEach((seat) => { seat.enabled = Boolean(value); });
  } else if (field === "aisleAfter" && selection.kind === "seat") {
    targets[0].aisleAfter = Boolean(value);
  } else if (field === "accessibility" && ["", "wheelchair", "obese"].includes(value)) {
    targets.forEach((seat) => { seat.accessibility = value; });
  }
  renderRoomSeatMap(field === "typeId" || field === "accessibility");
}

function insertRoomSeatAt(row, index, typeId) {
  const seat = createRoomSeat(row, typeId);
  row.seats.splice(Math.max(0, Math.min(index, row.seats.length)), 0, seat);
  renumberRoomSeatRow(row);
  return seat;
}

function insertRoomSeatRow(index) {
  const rows = state.roomSeatDraft.rows;
  if (rows.length >= 40) return showToast("O mapa permite no máximo 40 fileiras.", "error");
  const label = nextRoomRowLabel();
  const row = { id: `row-${Date.now().toString(36)}`, label, seats: [] };
  const columnCount = Math.max(1, ...rows.map((candidate) => candidate.seats.length));
  const typeId = state.roomSeatDraft.seatTypes[0]?.id || "standard";
  rows.splice(Math.max(0, Math.min(index, rows.length)), 0, row);
  for (let column = 0; column < columnCount; column += 1) row.seats.push(createRoomSeat(row, typeId));
  state.roomSeatSelection = { kind: "row", rowId: row.id };
}

function insertRoomSeatColumn(index) {
  const rows = state.roomSeatDraft.rows;
  const maxColumns = Math.max(0, ...rows.map((row) => row.seats.length));
  if (maxColumns >= 80) return showToast("O mapa permite no máximo 80 colunas.", "error");
  rows.forEach((row) => insertRoomSeatAt(row, index, row.seats[Math.max(0, index - 1)]?.typeId));
  state.roomSeatSelection = { kind: "column", columnIndex: Math.max(0, index) };
}

function handleRoomSeatSelectionAction(action) {
  const selection = state.roomSeatSelection;
  const rows = state.roomSeatDraft?.rows || [];
  if (!selection) return;
  if (action === "clear") {
    state.roomSeatSelection = null;
    return renderRoomSeatMap();
  }
  if (action === "color-reset") {
    roomSeatTargets(selection).forEach((seat) => { seat.color = ""; });
    return renderRoomSeatMap();
  }

  if (selection.kind === "seat") {
    const row = rows.find((candidate) => candidate.seats.some((seat) => seat.id === selection.seatId));
    const seatIndex = row?.seats.findIndex((seat) => seat.id === selection.seatId) ?? -1;
    if (!row || seatIndex < 0) return;
    if (action === "seat-before" || action === "seat-after") {
      const nextSeat = insertRoomSeatAt(row, seatIndex + (action === "seat-after" ? 1 : 0), row.seats[seatIndex].typeId);
      state.roomSeatSelection = { kind: "seat", seatId: nextSeat.id };
    }
    if (action === "seat-delete") {
      const total = rows.reduce((sum, candidate) => sum + candidate.seats.length, 0);
      if (total <= 1) return showToast("A sala precisa manter pelo menos uma cadeira.", "error");
      if (!confirm(`Excluir a cadeira ${row.seats[seatIndex].label}? A alteração será confirmada ao salvar a sala.`)) return;
      row.seats.splice(seatIndex, 1);
      renumberRoomSeatRow(row);
      state.roomSeatSelection = null;
    }
  } else if (selection.kind === "row") {
    const rowIndex = rows.findIndex((row) => row.id === selection.rowId);
    if (rowIndex < 0) return;
    if (action === "row-before" || action === "row-after") insertRoomSeatRow(rowIndex + (action === "row-after" ? 1 : 0));
    if (action === "row-seat-left" || action === "row-seat-right") {
      const row = rows[rowIndex];
      if (row.seats.length >= 80) return showToast("Uma fileira permite no máximo 80 cadeiras.", "error");
      const addLeft = action === "row-seat-left";
      const seat = insertRoomSeatAt(row, addLeft ? 0 : row.seats.length, (addLeft ? row.seats[0] : row.seats.at(-1))?.typeId);
      state.roomSeatSelection = { kind: "seat", seatId: seat.id };
    }
    if (action === "row-delete") {
      if (rows.length <= 1) return showToast("A sala precisa manter pelo menos uma fileira.", "error");
      if (!confirm(`Excluir a fileira ${rows[rowIndex].label} e todas as suas cadeiras?`)) return;
      rows.splice(rowIndex, 1);
      state.roomSeatSelection = null;
    }
  } else if (selection.kind === "column") {
    const columnIndex = Number(selection.columnIndex);
    if (action === "column-before" || action === "column-after") insertRoomSeatColumn(columnIndex + (action === "column-after" ? 1 : 0));
    if (action === "column-delete") {
      const maxColumns = Math.max(0, ...rows.map((row) => row.seats.length));
      if (maxColumns <= 1) return showToast("A sala precisa manter pelo menos uma coluna.", "error");
      if (!confirm(`Excluir a coluna ${columnIndex + 1} em todas as fileiras?`)) return;
      rows.forEach((row) => {
        if (row.seats[columnIndex]) row.seats.splice(columnIndex, 1);
        renumberRoomSeatRow(row);
      });
      state.roomSeatSelection = null;
    }
  }
  renderRoomSeatMap();
}

function renderRooms() {
  const rooms = state.content?.rooms || [];
  if (state.creating.room) {
    $("roomsList").innerHTML = creationPlaceholder("Nova sala", "Cadastre nome, capacidade e tecnologia no quadro à direita.");
    fillRoomForm(null);
    return;
  }
  if (!rooms.length) {
    $("roomsList").innerHTML = `
      <div class="empty-state">
        <strong>Nenhuma sala cadastrada</strong>
        <span>Cadastre a sala principal para organizar as sessões.</span>
      </div>
    `;
    fillRoomForm(null);
    return;
  }

  $("roomsList").innerHTML = rooms
    .map((room) => {
      const active = room.id === state.selectedRoomId ? "active" : "";
      return `
        <button class="list-item ${active}" type="button" onclick="selectRoom('${room.id}')">
          <span>
            <span class="list-title">${room.name}</span>
            <span class="list-meta">${room.capacity} lugares • ${room.technology || "sem tecnologia cadastrada"}</span>
          </span>
          <span class="badge">${room.status}</span>
        </button>
      `;
    })
    .join("");
  fillRoomForm(currentRoom());
}

function selectRoom(id) {
  state.creating.room = false;
  state.selectedRoomId = id;
  renderRooms();
}

function newRoom() {
  state.creating.room = true;
  state.selectedRoomId = "";
  $("roomsList").innerHTML = creationPlaceholder("Nova sala", "Cadastre nome, capacidade e tecnologia no quadro à direita.");
  fillRoomForm(null);
}

function fillRoomForm(room) {
  syncCreationControl("room", "cancelRoomCreateButton", "deleteRoomButton", Boolean(room));
  setDisabled("deleteRoomButton", !room);
  $("roomId").value = room?.id || "";
  $("roomName").value = room?.name || "";
  $("roomCapacity").value = room?.capacity || 80;
  $("roomTechnology").value = room?.technology || "";
  $("roomStatus").value = room?.status || "active";
  state.roomSeatDraft = defaultRoomSeatDraft(room);
  state.roomSeatSelection = null;
  renderRoomSeatEditor();
}

async function saveRoom(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("roomId").value || undefined,
      name: $("roomName").value,
      capacity: Number($("roomCapacity").value || 80),
      technology: $("roomTechnology").value,
      status: $("roomStatus").value,
      seatSelectionEnabled: Boolean(state.roomSeatDraft?.enabled),
      seatTypes: state.roomSeatDraft?.seatTypes || [],
      seatLayout: {
        screenLabel: state.roomSeatDraft?.screenLabel || "TELA",
        rows: state.roomSeatDraft?.rows || []
      }
    };
    if (payload.seatSelectionEnabled && !payload.seatLayout.rows.some((row) => row.seats.some((seat) => seat.enabled !== false))) {
      throw new Error("Gere o mapa e mantenha ao menos uma poltrona disponível antes de salvar.");
    }
    const existingId = $("roomId").value;
    const saved = existingId
      ? await api(`/api/rooms/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/rooms", { method: "POST", body: JSON.stringify(payload) });
    state.creating.room = false;
    state.selectedRoomId = saved.id;
    await loadContent({ silent: true });
    showToast("Sala salva.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteRoom() {
  const room = currentRoom();
  if (!room || !confirm(`Excluir ${room.name}?`)) return;
  try {
    await api(`/api/rooms/${encodeURIComponent(room.id)}`, { method: "DELETE" });
    state.selectedRoomId = "";
    await loadContent({ silent: true });
    showToast("Sala excluida.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderTickets() {
  const tickets = state.content?.ticketTypes || [];
  if (state.creating.ticket) {
    $("ticketsList").innerHTML = creationPlaceholder("Novo tipo de ingresso", "Defina nome, preço e disponibilidade no quadro à direita.");
    fillTicketForm(null);
    renderIssuedTickets();
    return;
  }
  if (!tickets.length) {
    $("ticketsList").innerHTML = `
      <div class="empty-state">
        <strong>Nenhum ingresso cadastrado</strong>
        <span>Crie o ticket promocional base para liberar vendas.</span>
      </div>
    `;
    fillTicketForm(null);
    renderIssuedTickets();
    return;
  }

  $("ticketsList").innerHTML = tickets
    .map((ticket) => {
      const active = ticket.id === state.selectedTicketId ? "active" : "";
      return `
        <button class="list-item ${active}" type="button" onclick="selectTicket('${ticket.id}')">
          <span>
            <span class="list-title">${ticket.name}</span>
            <span class="list-meta">${ticket.description || "Sem descrição"}${Number(ticket.bundleQuantity || 1) > 1 ? ` • gera ${Number(ticket.bundleQuantity)} ingressos por unidade` : ""}</span>
          </span>
          <span class="badge">${money(ticket.price)}</span>
        </button>
      `;
    })
    .join("");
  fillTicketForm(currentTicket());
  renderIssuedTickets();
}

function renderIssuedTicketFilters(tickets) {
  const movieSelect = $("issuedTicketMovieFilter");
  const sessionSelect = $("issuedTicketSessionFilter");
  const roomSelect = $("issuedTicketRoomFilter");
  if (!movieSelect || !sessionSelect || !roomSelect) return;

  const movies = [...new Map(tickets.map((ticket) => [ticket.movieId, ticket.movieTitle || movieById(ticket.movieId)?.title]).filter(([id]) => id)).entries()]
    .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
  movieSelect.innerHTML = `<option value="">Todos</option>${movies.map(([id, title]) => `<option value="${escapeHtml(id)}">${escapeHtml(title || id)}</option>`).join("")}`;
  movieSelect.value = state.issuedTicketFilters.movieId;

  const sessionTickets = state.issuedTicketFilters.movieId ? tickets.filter((ticket) => ticket.movieId === state.issuedTicketFilters.movieId) : tickets;
  const sessions = [...new Map(sessionTickets.map((ticket) => [ticket.sessionId, issuedTicketSessionLabel(ticket)]).filter(([id]) => id)).entries()]
    .sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));
  sessionSelect.innerHTML = `<option value="">Todas</option>${sessions.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label || id)}</option>`).join("")}`;
  sessionSelect.value = state.issuedTicketFilters.sessionId;

  const rooms = [...new Set(tickets.map((ticket) => ticket.sessionRoom).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  roomSelect.innerHTML = `<option value="">Todas</option>${rooms.map((room) => `<option value="${escapeHtml(room)}">${escapeHtml(room)}</option>`).join("")}`;
  roomSelect.value = state.issuedTicketFilters.room;
  $("issuedTicketDateFilter").value = state.issuedTicketFilters.date;
  $("issuedTicketStatusFilter").value = state.issuedTicketFilters.status;
}

function filteredIssuedTickets() {
  const filters = state.issuedTicketFilters;
  return (state.content?.tickets || [])
    .filter((ticket) => !filters.movieId || ticket.movieId === filters.movieId)
    .filter((ticket) => !filters.sessionId || ticket.sessionId === filters.sessionId)
    .filter((ticket) => !filters.date || ticket.sessionDate === filters.date)
    .filter((ticket) => !filters.status || ticket.status === filters.status)
    .filter((ticket) => !filters.room || ticket.sessionRoom === filters.room)
    .sort((a, b) => String(`${b.sessionDate || ""} ${b.sessionTime || ""}`).localeCompare(String(`${a.sessionDate || ""} ${a.sessionTime || ""}`)));
}

function renderIssuedTickets() {
  const allTickets = state.content?.tickets || [];
  if (!$("issuedTicketsList")) return;
  renderIssuedTicketFilters(allTickets);
  const tickets = filteredIssuedTickets();
  if (!tickets.length) {
    $("issuedTicketsList").innerHTML = `
      <div class="empty-state">
        <strong>Nenhum ingresso encontrado</strong>
        <span>Altere os filtros ou emita uma venda para visualizar os tickets vinculados às sessões.</span>
      </div>
    `;
    return;
  }
  const pageSize = state.issuedTicketsPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
  state.issuedTicketsPage = Math.min(Math.max(1, state.issuedTicketsPage || 1), totalPages);
  const start = (state.issuedTicketsPage - 1) * pageSize;
  const pageItems = tickets.slice(start, start + pageSize);

  $("issuedTicketsList").innerHTML = `
    <div class="issued-tickets-pager-bar">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, tickets.length)}</strong> de <strong>${tickets.length}</strong> ingresso(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.issuedTicketsPage <= 1 ? "disabled" : ""} onclick="changeIssuedTicketsPage(-1)">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.issuedTicketsPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.issuedTicketsPage >= totalPages ? "disabled" : ""} onclick="changeIssuedTicketsPage(1)">Próxima →</button>
      </div>
    </div>
    <div class="issued-tickets-rows">
      ${pageItems.map((ticket) => `
        <article class="issued-ticket-row">
          <div>
            <strong>${escapeHtml(ticket.movieTitle || "Filme não identificado")}</strong>
            <span>${escapeHtml(issuedTicketSessionLabel(ticket) || "Sessão não identificada")}</span>
          </div>
          <div>
            <span class="mini-label">Sala</span>
            <strong>${escapeHtml(ticket.sessionRoom || "Sala não informada")}</strong>
          </div>
          <div>
            <span class="mini-label">Assento</span>
            <strong>${escapeHtml(ticket.seat || "Lugar livre")}</strong>
          </div>
          <div>
            <span class="mini-label">Tipo</span>
            <strong>${escapeHtml(ticket.ticketType || "Ingresso")}</strong>
          </div>
          <div>
            <span class="mini-label">Cliente</span>
            <strong>${escapeHtml(ticket.customerName || ticket.customerEmail || "Cliente")}</strong>
          </div>
          <div>
            <span class="mini-label">Pedido</span>
            <button class="text-button" type="button" onclick="openOrderView('${escapeHtml(ticket.orderId || ticket.orderReference || "")}')">${escapeHtml(ticket.orderReference || ticket.orderId || "-")}</button>
          </div>
          <div>
            <span class="mini-label">Status</span>
            <span class="status-pill status-${escapeHtml(ticket.status || "unknown")}">${escapeHtml(ticketStatusText(ticket.status))}</span>
          </div>
          <button class="ghost-button" type="button" onclick="showSessionTickets('${escapeHtml(ticket.sessionId || "")}')">Sessão</button>
        </article>
      `).join("")}
    </div>
  `;
}

function changeIssuedTicketsPage(delta) {
  const tickets = filteredIssuedTickets();
  const pageSize = state.issuedTicketsPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(tickets.length / pageSize));
  state.issuedTicketsPage = Math.min(Math.max(1, (state.issuedTicketsPage || 1) + delta), totalPages);
  renderIssuedTickets();
}

function showSessionTickets(sessionId) {
  if (!sessionId) return;
  const ticket = (state.content?.tickets || []).find((item) => item.sessionId === sessionId);
  state.issuedTicketsPage = 1;
  state.issuedTicketFilters.sessionId = sessionId;
  state.issuedTicketFilters.movieId = ticket?.movieId || state.issuedTicketFilters.movieId || "";
  activatePanel("ticketsPanel", { scroll: true });
  renderIssuedTickets();
}

function selectTicket(id) {
  state.creating.ticket = false;
  state.selectedTicketId = id;
  renderTickets();
}

function newTicket() {
  state.creating.ticket = true;
  state.selectedTicketId = "";
  $("ticketsList").innerHTML = creationPlaceholder("Novo tipo de ingresso", "Defina nome, preço e disponibilidade no quadro à direita.");
  fillTicketForm(null);
}

function fillTicketForm(ticket) {
  syncCreationControl("ticket", "cancelTicketCreateButton", "deleteTicketButton", Boolean(ticket));
  setDisabled("deleteTicketButton", !ticket);
  $("ticketId").value = ticket?.id || "";
  $("ticketName").value = ticket?.name || "";
  $("ticketPrice").value = ticket?.price ?? 10;
  $("ticketBundleQuantity").value = ticket?.bundleQuantity ?? 1;
  $("ticketDescription").value = ticket?.description || "";
  $("ticketActive").checked = ticket?.active !== false;
}

async function saveTicket(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("ticketId").value || undefined,
      name: $("ticketName").value,
      price: Number($("ticketPrice").value || 0),
      bundleQuantity: Math.max(1, Number($("ticketBundleQuantity").value || 1)),
      description: $("ticketDescription").value,
      active: $("ticketActive").checked
    };
    const existingId = $("ticketId").value;
    const saved = existingId
      ? await api(`/api/ticket-types/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/ticket-types", { method: "POST", body: JSON.stringify(payload) });
    state.creating.ticket = false;
    state.selectedTicketId = saved.id;
    await loadContent({ silent: true });
    showToast("Ingresso salvo.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteTicket() {
  const ticket = currentTicket();
  if (!ticket || !confirm(`Excluir ${ticket.name}?`)) return;
  try {
    await api(`/api/ticket-types/${encodeURIComponent(ticket.id)}`, { method: "DELETE" });
    state.selectedTicketId = "";
    await loadContent({ silent: true });
    showToast("Ingresso excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderOrders() {
  renderManualSaleOptions();
  const orders = state.content?.orders || [];
  const query = (state.orderFilters.allQuery || "").toLowerCase();
  let filteredOrders = orders.filter((order) => {
    if (state.orderFilters.archiveStatus === "archived") return order.archived === true;
    if (state.orderFilters.archiveStatus === "active") return order.archived !== true;
    return true;
  });
  filteredOrders = query
    ? filteredOrders.filter((order) => [
        orderReference(order),
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.movieTitle,
        order.sessionTime,
        order.saleMode,
        ...(order.tickets || []).map((ticket) => ticket.code)
      ].join(" ").toLowerCase().includes(query))
    : filteredOrders;
  renderOrdersTable("ordersList", filteredOrders, {
    compact: false,
    emptyTitle: state.orderFilters.archiveStatus === "archived" ? "Nenhum pedido arquivado" : "Nenhum pedido encontrado",
    emptyMessage: state.orderFilters.archiveStatus === "archived"
      ? "Os pedidos arquivados ficam preservados e podem ser restaurados aqui."
      : "Ajuste a busca ou aguarde uma nova venda."
  });
  const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
  let todayOrders = orders.filter((order) => order.archived !== true && String(order.createdAt || "").slice(0, 10) === today);
  if (state.orderFilters.todayOrigin !== "all") todayOrders = todayOrders.filter((order) => String(order.origin || "online") === state.orderFilters.todayOrigin);
  if (state.orderFilters.todayStatus !== "all") {
    todayOrders = todayOrders.filter((order) => {
      if (state.orderFilters.todayStatus === "pending") return ["pending", "pending_payment", "processing"].includes(order.status);
      return order.status === state.orderFilters.todayStatus;
    });
  }
  renderTodaySalesSummary(orders.filter((order) => String(order.createdAt || "").slice(0, 10) === today));
  renderOrdersTable("todayOrdersList", todayOrders, { compact: true });
}

function renderTodaySalesSummary(orders) {
  if (!$("todaySalesSummary")) return;
  const paid = orders.filter((order) => order.status === "paid");
  const revenue = paid.reduce((total, order) => total + Number(order.totalPrice || 0), 0);
  const tickets = paid.reduce((total, order) => total + orderTicketCount(order), 0);
  const boxOffice = paid.filter((order) => order.origin === "box_office").reduce((total, order) => total + Number(order.totalPrice || 0), 0);
  $("todaySalesSummary").innerHTML = `
    <div><span>Vendas hoje</span><strong>${paid.length}</strong></div>
    <div><span>Receita hoje</span><strong>${money(revenue)}</strong></div>
    <div><span>Ingressos</span><strong>${tickets}</strong></div>
    <div><span>Bilheteria</span><strong>${money(boxOffice)}</strong></div>
  `;
}

function orderTicketCount(order) {
  return Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
}

function renderOrdersTable(targetId, orders, options = {}) {
  const target = $(targetId);
  if (!target) return;
  if (!orders.length) {
    target.innerHTML = `
      <div class="empty-state">
        <strong>${escapeHtml(options.emptyTitle || "Nenhum pedido registrado ainda")}</strong>
        <span>${escapeHtml(options.emptyMessage || "As vendas online e de bilheteria aparecem aqui automaticamente.")}</span>
      </div>
    `;
    return;
  }

  const pageKey = targetId === "todayOrdersList" ? "todayOrdersPage" : "ordersPage";
  const sizeKey = targetId === "todayOrdersList" ? "todayOrdersPageSize" : "ordersPageSize";
  const pageSize = state[sizeKey] || 5;
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  state[pageKey] = Math.min(Math.max(1, state[pageKey] || 1), totalPages);
  const start = (state[pageKey] - 1) * pageSize;
  const pageItems = orders.slice(start, start + pageSize);

  const pagerMarkup = `
    <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, orders.length)}</strong> de <strong>${orders.length}</strong> pedido(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state[pageKey] <= 1 ? "disabled" : ""} onclick="changeOrdersPage(-1, '${targetId}')">← Anterior</button>
        <span class="pager-page-indicator">Página ${state[pageKey]} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state[pageKey] >= totalPages ? "disabled" : ""} onclick="changeOrdersPage(1, '${targetId}')">Próxima →</button>
      </div>
    </div>
  `;

  target.innerHTML = `
    ${pagerMarkup}
    <div class="orders-table">
      <table>
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Cliente</th>
            <th>Filme/Sessão</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Pagamento</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems
            .map(
              (order) => {
                const extras = (order.concessionItems || []).map((item) => `${escapeHtml(item.name)} x${Number(item.quantity || 0)}`).join("<br>") || "Sem extras";
                const tickets = (order.tickets || []).slice(0, 2).map((ticket) => `<button class="copy-code" type="button" onclick="event.stopPropagation(); copyTicketCode('${escapeHtml(ticket.code)}')">${escapeHtml(ticket.code)}</button>`).join(" ");
                const quickSale = order.saleMode === "quick";
                const customerLabel = quickSale ? "Venda rápida" : order.customerName || "Cliente avulso";
                return `
                <tr class="order-table-row ${order.archived ? "is-archived" : ""}" onclick="openOrderView('${escapeHtml(order.id)}')">
                  <td data-label="Data/Hora"><strong>${escapeHtml(orderReference(order))}</strong><br><span class="list-meta">${new Date(order.createdAt).toLocaleString("pt-BR")}</span></td>
                  <td data-label="Cliente">${escapeHtml(customerLabel)}<br><span class="list-meta">${escapeHtml(quickSale ? "Sem identificação do cliente" : order.customerPhone || order.customerEmail || "")}</span></td>
                  <td data-label="Filme/Sessão"><strong>${escapeHtml(order.movieTitle || "-")}</strong><br><span class="list-meta">${escapeHtml([order.sessionTime, order.sessionFormat].filter(Boolean).join(" • ") || "-")}</span></td>
                  <td data-label="Itens">${orderTicketCount(order)} ingresso(s)<br><span class="list-meta">${extras}</span>${tickets ? `<div class="ticket-code-row">${tickets}</div>` : ""}</td>
                  <td data-label="Total"><strong>${money(order.totalPrice)}</strong></td>
                  <td data-label="Pagamento">${escapeHtml(originLabel(order.origin || "online"))}<br><span class="list-meta">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span></td>
                  <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>${order.archived ? '<span class="status-label archived">Arquivado</span>' : ""}</div></td>
                  <td data-label="Ações" onclick="event.stopPropagation()">
                    <div class="context-menu">
                      <button class="ghost-button" type="button" onclick="openOrderView('${escapeHtml(order.id)}')">Visualizar</button>
                      <button class="icon-button" type="button" onclick="toggleOrderMenu('${escapeHtml(order.id)}', event)" aria-label="Ações do pedido">•••</button>
                    </div>
                  </td>
                </tr>
              `;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function changeOrdersPage(delta, targetId) {
  const pageKey = targetId === "todayOrdersList" ? "todayOrdersPage" : "ordersPage";
  state[pageKey] = Math.max(1, (state[pageKey] || 1) + delta);
  renderOrders();
}

function statusClass(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "approved", "manual_sale"].includes(normalized)) return "ok";
  if (["pending", "pending_payment", "pix_pending", "processing"].includes(normalized)) return "warn";
  if (["cancelled", "rejected", "refunded", "expired"].includes(normalized)) return "danger";
  return "";
}

function originLabel(origin = "") {
  return {
    online: "Site",
    box_office: "Bilheteria",
    club: "Clube",
    manual: "Bilheteria",
    manual_sale: "Venda manual",
    admin: "Painel",
    pix_pending: "Pix pendente"
  }[String(origin || "").toLowerCase()] || humanizeEnum(origin) || "Site";
}

function paymentForOrder(orderId) {
  return (state.content?.payments || []).find((payment) => payment.orderId === orderId) || null;
}

function movieForOrder(order) {
  return (state.content?.movies || []).find((movie) => movie.id === order.movieId) || null;
}

function sectionHtml(title, rows) {
  return `
    <section class="order-detail-section">
      <h3>${escapeHtml(title)}</h3>
      <dl>
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${String(value).includes("<") ? value : escapeHtml(value || "-")}</dd></div>`).join("")}
      </dl>
    </section>
  `;
}

function orderDetailHtml(order) {
  const payment = paymentForOrder(order.id);
  const movie = movieForOrder(order);
  const tickets = (order.tickets || []).map((ticket) => `
    <button class="copy-code" type="button" onclick="copyTicketCode('${escapeHtml(ticket.code)}')">${escapeHtml(ticket.code)}</button>
    <span class="list-meta">${escapeHtml(orderStatusLabel(ticket.status))}</span>
  `).join("<br>") || "-";
  const extras = (order.concessionItems || []).map((item) => `${escapeHtml(item.name || item.id)} x${Number(item.quantity || 0)}`).join("<br>") || "-";
  const history = (order.auditTrail || []).map((entry) => `${escapeHtml(entry.action || "alteração")} • ${new Date(entry.at || order.createdAt).toLocaleString("pt-BR")}`).join("<br>") || `Criação • ${new Date(order.createdAt).toLocaleString("pt-BR")}`;
  return `
    ${sectionHtml("Pedido", [
      ["Referência", orderReference(order)],
      ["Data", new Date(order.createdAt).toLocaleString("pt-BR")],
      ["Origem", originLabel(order.origin || "online")],
      ["Status", orderStatusLabel(order.status)],
      ["Arquivamento", order.archived ? `Arquivado em ${new Date(order.archivedAt || order.updatedAt).toLocaleString("pt-BR")}` : "Pedido ativo"]
    ])}
    ${sectionHtml("Cliente", [
      ["Tipo", order.saleMode === "quick" ? "Venda rápida" : order.customerUserId ? "Usuário cadastrado" : "Cliente avulso"],
      ["Nome", order.saleMode === "quick" ? "Sem identificação do cliente" : order.customerName || "Cliente avulso"],
      ["Contato", [order.customerPhone, order.customerEmail].filter(Boolean).join(" • ") || "-"]
    ])}
    ${sectionHtml("Sessão", [
      ["Filme", `${movie?.posterUrl ? `<img class="inline-poster" src="${escapeHtml(movie.posterUrl)}" alt="">` : ""}${escapeHtml(order.movieTitle || movie?.title || "-")}`],
      ["Data e horário", [order.sessionDate, order.sessionTime].filter(Boolean).join(" • ") || order.sessionTime || "-"],
      ["Sala", order.sessionRoom || "Sala Cruzeiro"],
      ["Poltronas", Array.isArray(order.selectedSeats) && order.selectedSeats.length ? order.selectedSeats.map((seat) => seat.label).join(", ") : "Lugar livre"],
      ["Formato", order.sessionFormat || "-"]
    ])}
    ${sectionHtml("Ingressos", [
      ["Quantidade", `${orderTicketCount(order)} ingresso(s)`],
      ["Códigos", tickets]
    ])}
    ${sectionHtml("Bomboniere", [["Produtos", extras]])}
    ${sectionHtml("Pagamento", [
      ["Método", paymentMethodLabel(payment?.method || order.paymentMethod)],
      ["Provider", providerLabel(payment?.provider || order.paymentProvider)],
      ["Valor", money(payment?.amount ?? order.totalPrice)],
      ["Status", paymentStatusLabel(payment?.status || order.paymentStatus)],
      ["Referência externa", payment?.providerPaymentId || payment?.providerReference || "-"]
    ])}
    ${sectionHtml("Histórico", [["Eventos", history], ["Observação", order.operationalNotes || "-"]])}
  `;
}

function fillOrderEditor(order, mode) {
  state.selectedOrderId = order?.id || "";
  $("orderOverlayTitle").textContent = mode === "edit" ? "Editar pedido" : "Visualizar pedido";
  $("orderOverlaySubtitle").textContent = order ? `${orderReference(order)} • ${orderStatusLabel(order.status)}` : "Pedido não encontrado.";
  $("orderDetailBody").innerHTML = order ? orderDetailHtml(order) : "";
  $("orderEditFields").hidden = mode !== "edit";
  $("orderSaveButton").hidden = mode !== "edit";
  $("orderCancelButton").hidden = !order || order.archived || order.status === "cancelled" || order.status === "refunded";
  $("orderPermanentDeleteButton").hidden = !order || !isOwnerAdmin();
  if (order) {
    $("orderCustomerName").value = order.customerName || "";
    $("orderCustomerPhone").value = order.customerPhone || "";
    $("orderCustomerEmail").value = order.customerEmail || "";
    $("orderCustomerCpf").value = order.customerCpf || "";
    $("orderOperationalNotes").value = order.operationalNotes || "";
  }
  $("orderOverlay").hidden = false;
}

function openOrderView(orderId) {
  fillOrderEditor((state.content?.orders || []).find((order) => order.id === orderId), "view");
}

function openOrderEdit(orderId) {
  fillOrderEditor((state.content?.orders || []).find((order) => order.id === orderId), "edit");
}

function closeOrderOverlay() {
  $("orderOverlay").hidden = true;
  state.selectedOrderId = "";
}

async function saveOrderEdit(event) {
  event.preventDefault();
  const order = currentOrder();
  if (!order) return;
  try {
    await api(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        customerName: $("orderCustomerName").value,
        customerPhone: $("orderCustomerPhone").value,
        customerEmail: $("orderCustomerEmail").value,
        customerCpf: $("orderCustomerCpf").value,
        operationalNotes: $("orderOperationalNotes").value,
        reason: "Edição pelo painel"
      })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast("Pedido atualizado.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function cancelOrDeleteOrder(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  const draft = ["draft", "test"].includes(order.status);
  const action = draft ? "excluir" : "cancelar";
  const reason = prompt(`Informe o motivo para ${action} este pedido:`);
  if (reason === null) return;
  try {
    await api(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: draft ? "DELETE" : "PATCH",
      body: JSON.stringify(draft ? { reason } : { action: "cancel", reason })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast(draft ? "Pedido excluído." : "Pedido cancelado.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function archiveOrderAdmin(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  const reason = prompt("Motivo para arquivar este pedido:");
  if (reason === null) return;
  try {
    await api(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "archive", reason })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast("Pedido arquivado.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function restoreOrderAdmin(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order || !order.archived || !confirm("Restaurar este pedido para a lista de ativos?")) return;
  try {
    await api(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "unarchive", reason: "Restaurado pelo painel" })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast("Pedido restaurado.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function closeFloatingActionMenu() {
  const menu = $("floatingActionMenu");
  if (!menu) return;
  menu.hidden = true;
  menu.innerHTML = "";
}

function positionFloatingMenu(anchor, menu) {
  const rect = anchor.getBoundingClientRect();
  menu.hidden = false;
  const menuRect = menu.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(Math.max(margin, rect.right - menuRect.width), window.innerWidth - menuRect.width - margin);
  const below = rect.bottom + 8;
  const above = rect.top - menuRect.height - 8;
  const top = below + menuRect.height + margin <= window.innerHeight ? below : Math.max(margin, above);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function toggleOrderMenu(orderId, event) {
  event?.stopPropagation();
  document.querySelectorAll(".context-menu-popover").forEach((menu) => {
    menu.hidden = true;
  });
  const floating = $("floatingActionMenu");
  const anchor = event?.currentTarget;
  if (!floating || !anchor) return;
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  if (!floating.hidden && floating.dataset.orderId === orderId) {
    closeFloatingActionMenu();
    return;
  }
  floating.dataset.orderId = orderId;
  floating.innerHTML = `
    <button type="button" onclick="openOrderView('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Visualizar</button>
    <button type="button" onclick="openOrderEdit('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Editar</button>
    <button type="button" onclick="printOrderTicket('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Imprimir ingresso</button>
    <button type="button" onclick="resendOrderTicket('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Reenviar ingresso</button>
    ${order.archived ? "" : `<button type="button" onclick="cancelOrDeleteOrder('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Cancelar</button>`}
    ${order.archived
      ? `<button type="button" onclick="restoreOrderAdmin('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Restaurar pedido</button>`
      : `<button type="button" onclick="archiveOrderAdmin('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Arquivar</button>`}
    <button class="danger-text" type="button" onclick="openPermanentDelete('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Excluir permanentemente</button>
  `;
  positionFloatingMenu(anchor, floating);
}

async function copyTicketCode(code) {
  await navigator.clipboard?.writeText(code).catch(() => null);
  showToast("Código copiado.");
}

function printOrderTicket(orderId) {
  openOrderView(orderId);
  setTimeout(() => window.print(), 120);
}

async function resendOrderTicket(orderId) {
  try {
    await api(`/api/orders/${encodeURIComponent(orderId)}/resend-ticket-email`, { method: "POST" });
    showToast("Ingresso reenviado por e-mail.");
    openOrderView(orderId);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openPermanentDelete(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  state.selectedOrderId = order.id;
  const payment = paymentForOrder(order.id);
  $("permanentDeleteSummary").textContent = `${orderReference(order)} • ${order.movieTitle || "Pedido"} • ${money(order.totalPrice)} • ${orderStatusLabel(order.status)}${payment && !["box_office", "admin", "external_manual", "manual_external", "internal_club"].includes(payment.provider) ? " • provider externo vinculado" : ""}`;
  $("permanentDeleteReason").value = "";
  $("permanentDeleteConfirmation").value = "";
  $("permanentDeleteOverlay").hidden = false;
}

function closePermanentDelete() {
  $("permanentDeleteOverlay").hidden = true;
}

async function permanentlyDeleteSelectedOrder(event) {
  event.preventDefault();
  const order = currentOrder();
  if (!order) return;
  try {
    await api(`/api/orders/${encodeURIComponent(order.id)}/permanent`, {
      method: "DELETE",
      body: JSON.stringify({
        reason: $("permanentDeleteReason").value,
        confirmation: $("permanentDeleteConfirmation").value
      })
    });
    await loadContent({ silent: true });
    closePermanentDelete();
    closeOrderOverlay();
    showToast("Pedido excluído permanentemente.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderPaymentsCenter() {
  const target = $("paymentsList");
  if (!target) return;
  const data = state.payments || {};
  if ($("paymentProviderStatus")) {
    $("paymentProviderStatus").textContent = data.cardTerminal?.configured
      ? `Maquininha integrada: ${data.cardTerminal.provider}.`
      : "Maquininha automática não configurada. Cartões de balcão são registrados manualmente.";
  }
  const rows = data.payments || [];
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state"><strong>Nenhum pagamento encontrado.</strong><span>Ajuste os filtros ou selecione outro período.</span></div>`;
    return;
  }
  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Filme</th>
          <th>Origem</th>
          <th>Método</th>
          <th>Provider</th>
          <th>Valor</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((payment) => `
          <tr class="order-table-row" onclick="openOrderView('${escapeHtml(payment.orderId)}')">
            <td data-label="Pedido"><strong>${escapeHtml(payment.orderReference || payment.orderId)}</strong><br><span class="list-meta">${new Date(payment.createdAt).toLocaleString("pt-BR")}</span></td>
            <td data-label="Cliente">${escapeHtml(payment.customerName || "Cliente")}</td>
            <td data-label="Filme">${escapeHtml(payment.movieTitle || "-")}</td>
            <td data-label="Origem">${escapeHtml(payment.originLabel || originLabel(payment.origin))}</td>
            <td data-label="Método">${escapeHtml(payment.methodLabel || paymentMethodLabel(payment.method))}</td>
            <td data-label="Provider">${escapeHtml(payment.providerLabel || providerLabel(payment.provider))}</td>
            <td data-label="Valor"><strong>${money(payment.amount)}</strong></td>
            <td data-label="Status"><span class="status-label ${statusClass(payment.status)}">${escapeHtml(payment.statusLabel || paymentStatusLabel(payment.status))}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function manualSessionStartsAt(session = {}) {
  const date = String(session.date || "").slice(0, 10);
  const time = /^\d{2}:\d{2}$/.test(String(session.time || "")) ? session.time : "00:00";
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isManualSessionSellable(session = {}, now = new Date()) {
  if (!session || session.status === "sold_out") return false;
  const startsAt = manualSessionStartsAt(session);
  return startsAt ? startsAt.getTime() + 10 * 60 * 1000 > now.getTime() : false;
}

function manualSessionsForDate(movie, date) {
  return (movie?.sessions || [])
    .filter((session) => session.date === date && isManualSessionSellable(session))
    .sort((a, b) => (manualSessionStartsAt(a)?.getTime() || 0) - (manualSessionStartsAt(b)?.getTime() || 0));
}

function renderManualSaleOptions() {
  const movies = state.content?.movies || [];
  const movieSelect = $("manualMovieSelect");
  const dateInput = $("manualSessionDate");
  if (!movieSelect || !dateInput) return;

  const sellableSessions = movies.flatMap((movie) => (movie.sessions || []).filter((session) => isManualSessionSellable(session)));
  const availableDates = [...new Set(sellableSessions.map((session) => session.date).filter(Boolean))].sort();
  const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
  dateInput.min = today;
  if (!dateInput.value) dateInput.value = availableDates[0] || today;

  const moviesForDate = movies.filter((movie) => manualSessionsForDate(movie, dateInput.value).length);
  const selectedMovieId = moviesForDate.some((movie) => movie.id === movieSelect.value)
    ? movieSelect.value
    : moviesForDate[0]?.id || "";
  movieSelect.innerHTML = moviesForDate.length ? moviesForDate
    .map((movie) => `<option value="${movie.id}">${escapeHtml(movie.title)}</option>`)
    .join("") : `<option value="">Sem filmes nesta data</option>`;
  movieSelect.value = selectedMovieId;
  movieSelect.disabled = moviesForDate.length === 0;
  renderManualSessionOptions();
  renderSaleMode();
  renderManualSaleItems();
}

function renderManualSessionOptions() {
  const movieId = $("manualMovieSelect")?.value;
  const movie = (state.content?.movies || []).find((item) => item.id === movieId);
  const selectedDate = $("manualSessionDate")?.value || "";
  const sessions = manualSessionsForDate(movie, selectedDate);
  const selectedSessionId = sessions.some((session) => session.id === $("manualSessionSelect")?.value)
    ? $("manualSessionSelect").value
    : sessions[0]?.id || "";
  $("manualSessionSelect").innerHTML = sessions.length
    ? sessions.map((session) => `<option value="${session.id}">${escapeHtml(session.time)} • ${escapeHtml(session.format)} • ${escapeHtml(session.room || "Sala")}</option>`).join("")
    : `<option value="">Sem sessões disponíveis</option>`;
  if (selectedSessionId) $("manualSessionSelect").value = selectedSessionId;
  $("manualSessionSelect").disabled = sessions.length === 0;
  $("manualAddMovieButton").disabled = sessions.length === 0;
  const availability = $("manualSessionAvailability");
  if (availability) {
    const formattedDate = selectedDate ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR") : "a data selecionada";
    availability.textContent = sessions.length
      ? `${sessions.length} ${sessions.length === 1 ? "sessão disponível" : "sessões disponíveis"} em ${formattedDate}. Sessões encerradas não são exibidas.`
      : `Nenhuma sessão disponível em ${formattedDate}. Escolha outra data.`;
  }
  renderManualTicketTypes();
  updateManualTotal();
}

function currentManualMovieSession() {
  const movie = (state.content?.movies || []).find((item) => item.id === $("manualMovieSelect").value);
  const session = manualSessionsForDate(movie, $("manualSessionDate")?.value || "")
    .find((item) => item.id === $("manualSessionSelect").value);
  return { movie, session };
}

function currentManualTicketTypes() {
  const { session } = currentManualMovieSession();
  return sessionTicketTypes(session || {});
}

function renderManualTicketTypes() {
  const target = $("manualTicketTypes");
  if (!target) return;
  const ticketTypes = currentManualTicketTypes();
  target.innerHTML = ticketTypes.length
    ? ticketTypes.map((ticketType, index) => `
      <div class="quantity-line">
        <span>${escapeHtml(ticketType.name)}</span>
        <strong>${money(ticketType.price)}</strong>
        <div class="stepper">
          <button type="button" data-manual-ticket-step="-1" data-ticket-type-id="${escapeHtml(ticketType.id)}" aria-label="Remover ${escapeHtml(ticketType.name)}">-</button>
          <input type="number" min="0" value="${index === 0 ? 1 : 0}" data-manual-ticket-quantity="${escapeHtml(ticketType.id)}" aria-label="Quantidade de ${escapeHtml(ticketType.name)}" />
          <button type="button" data-manual-ticket-step="1" data-ticket-type-id="${escapeHtml(ticketType.id)}" aria-label="Adicionar ${escapeHtml(ticketType.name)}">+</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state compact"><strong>Sem ingressos disponíveis</strong><span>Edite a sessão e atribua pelo menos um tipo de ingresso.</span></div>`;
  target.querySelectorAll("[data-manual-ticket-step]").forEach((button) => button.addEventListener("click", () => {
    const input = [...target.querySelectorAll("[data-manual-ticket-quantity]")]
      .find((candidate) => candidate.dataset.manualTicketQuantity === button.dataset.ticketTypeId);
    if (!input) return;
    input.value = Math.max(0, Number(input.value || 0) + Number(button.dataset.manualTicketStep || 0));
    updateManualTotal();
  }));
  target.querySelectorAll("[data-manual-ticket-quantity]").forEach((input) => input.addEventListener("input", updateManualTotal));
}

function manualConcessionItems() {
  return Object.entries(state.manualConcessionQuantities || {})
    .map(([id, quantity]) => ({ id, quantity: Math.max(0, Number(quantity || 0)) }))
    .filter((item) => item.id && item.quantity > 0);
}

function renderManualConcessions() {
  const target = $("manualConcessions");
  if (!target) return;
  const products = (state.content?.concessions || []).filter((item) => item.active !== false);
  const productIds = new Set(products.map((item) => item.id));
  state.manualConcessionQuantities = Object.fromEntries(
    Object.entries(state.manualConcessionQuantities || {}).filter(([id, quantity]) => productIds.has(id) && Number(quantity) > 0)
  );
  const selectedCount = manualConcessionItems().reduce((sum, item) => sum + item.quantity, 0);
  if ($("manualConcessionsCount")) $("manualConcessionsCount").textContent = selectedCount ? `${selectedCount} item(ns)` : "Nenhum item";
  target.innerHTML = products.length
    ? products.map((item) => {
      const finiteStock = item.stock !== null && item.stock !== undefined && item.stock !== "";
      const stock = finiteStock ? Math.max(0, Number(item.stock || 0)) : null;
      const max = Math.max(1, Math.min(Number(item.maxPerOrder || 8), stock ?? Number(item.maxPerOrder || 8)));
      const quantity = Math.min(max, Number(state.manualConcessionQuantities[item.id] || 0));
      if (quantity > 0) state.manualConcessionQuantities[item.id] = quantity;
      return `
        <article class="manual-concession-item ${stock === 0 ? "unavailable" : ""}">
          <div class="manual-concession-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${money(item.price)}${stock !== null ? ` · ${stock} em estoque` : ""}</span>
          </div>
          <div class="stepper">
            <button type="button" data-manual-concession-step="-1" data-concession-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" ${quantity <= 0 ? "disabled" : ""}>-</button>
            <input type="number" min="0" max="${max}" value="${quantity}" data-manual-concession-quantity="${escapeHtml(item.id)}" aria-label="Quantidade de ${escapeHtml(item.name)}" ${stock === 0 ? "disabled" : ""} />
            <button type="button" data-manual-concession-step="1" data-concession-id="${escapeHtml(item.id)}" aria-label="Adicionar ${escapeHtml(item.name)}" ${stock === 0 || quantity >= max ? "disabled" : ""}>+</button>
          </div>
        </article>`;
    }).join("")
    : `<div class="manual-sale-empty">Nenhum produto ativo na bomboniere.</div>`;
  target.querySelectorAll("[data-manual-concession-step]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.concessionId;
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const finiteStock = product.stock !== null && product.stock !== undefined && product.stock !== "";
    const max = Math.max(1, Math.min(Number(product.maxPerOrder || 8), finiteStock ? Number(product.stock || 0) : Number(product.maxPerOrder || 8)));
    state.manualConcessionQuantities[id] = Math.max(0, Math.min(max, Number(state.manualConcessionQuantities[id] || 0) + Number(button.dataset.manualConcessionStep || 0)));
    renderManualConcessions();
    updateManualTotal();
  }));
  target.querySelectorAll("[data-manual-concession-quantity]").forEach((input) => input.addEventListener("change", () => {
    const product = products.find((item) => item.id === input.dataset.manualConcessionQuantity);
    if (!product) return;
    const finiteStock = product.stock !== null && product.stock !== undefined && product.stock !== "";
    const max = Math.max(1, Math.min(Number(product.maxPerOrder || 8), finiteStock ? Number(product.stock || 0) : Number(product.maxPerOrder || 8)));
    state.manualConcessionQuantities[product.id] = Math.max(0, Math.min(max, Number(input.value || 0)));
    renderManualConcessions();
    updateManualTotal();
  }));
}

function manualTicketItems() {
  return [...document.querySelectorAll("#manualTicketTypes [data-manual-ticket-quantity]")]
    .map((input) => ({ id: input.dataset.manualTicketQuantity, quantity: Math.max(0, Number(input.value || 0)) }))
    .filter((item) => item.id && item.quantity > 0);
}

function manualSaleDraft() {
  const { movie, session } = currentManualMovieSession();
  const ticketItems = manualTicketItems();
  if (!movie || !session || !ticketItems.length) return null;
  const ticketTypes = new Map(currentManualTicketTypes().map((ticketType) => [ticketType.id, ticketType]));
  const subtotal = ticketItems.reduce((sum, item) => sum + item.quantity * Number(ticketTypes.get(item.id)?.price || 0), 0);
  return {
    movieId: movie.id,
    movieTitle: movie.title,
    sessionId: session.id,
    sessionDate: session.date || "",
    sessionTime: session.time || "",
    sessionFormat: session.format || "",
    ticketItems,
    ticketSummary: ticketItems.map((item) => ({
      ...item,
      name: ticketTypes.get(item.id)?.name || "Ingresso",
      unitPrice: Number(ticketTypes.get(item.id)?.price || 0)
    })),
    subtotal
  };
}

function addManualSaleItem() {
  const draft = manualSaleDraft();
  if (!draft) {
    showToast("Selecione ao menos um ingresso para adicionar este filme.", "error");
    return;
  }
  const existingIndex = state.manualSaleItems.findIndex((item) => item.sessionId === draft.sessionId);
  if (existingIndex >= 0) {
    state.manualSaleItems.splice(existingIndex, 1, draft);
    showToast("Quantidades da sessão atualizadas.");
  } else {
    state.manualSaleItems.push(draft);
    showToast(`${draft.movieTitle} adicionado à venda.`);
  }
  renderManualSaleItems();
  renderManualTicketTypes();
}

function removeManualSaleItem(sessionId) {
  state.manualSaleItems = state.manualSaleItems.filter((item) => item.sessionId !== sessionId);
  renderManualSaleItems();
}

function clearManualSaleItems() {
  state.manualSaleItems = [];
  renderManualSaleItems();
}

function renderManualSaleItems() {
  const target = $("manualSaleItems");
  if (!target) return;
  const count = state.manualSaleItems.length;
  $("manualSaleBasketCount").textContent = count
    ? `${count} ${count === 1 ? "filme adicionado" : "filmes adicionados"}`
    : "Nenhum filme adicionado";
  $("manualClearSaleButton").hidden = count === 0;
  target.innerHTML = count
    ? state.manualSaleItems.map((item) => `
      <article class="manual-sale-item">
        <div class="manual-sale-item-main">
          <strong>${escapeHtml(item.movieTitle)}</strong>
          <span>${escapeHtml([item.sessionDate, item.sessionTime, item.sessionFormat].filter(Boolean).join(" • "))}</span>
          <small>${item.ticketSummary.map((ticket) => `${ticket.quantity}× ${escapeHtml(ticket.name)}`).join(" · ")}</small>
        </div>
        <strong class="manual-sale-item-price">${money(item.subtotal)}</strong>
        <button class="icon-button danger" type="button" data-remove-manual-session="${escapeHtml(item.sessionId)}" aria-label="Remover ${escapeHtml(item.movieTitle)} desta venda">
          ${trashIcon}
        </button>
      </article>
    `).join("")
    : `<div class="manual-sale-empty">Escolha uma sessão e adicione-a para atribuir vários filmes ao cliente.</div>`;
  target.querySelectorAll("[data-remove-manual-session]").forEach((button) => {
    button.addEventListener("click", () => removeManualSaleItem(button.dataset.removeManualSession));
  });
  updateManualTotal();
  renderManualConcessions();
  const submitButton = $("manualSaleSubmitButton");
  if (submitButton) {
    submitButton.textContent = count > 1
      ? `Finalizar venda de ${count} filmes`
      : state.saleMode === "quick" ? "Finalizar venda rápida" : "Finalizar venda";
  }
}

async function createManualTicket(event) {
  event.preventDefault();
  const draft = manualSaleDraft();
  const saleItems = state.manualSaleItems.length ? state.manualSaleItems : draft ? [draft] : [];
  if (!saleItems.length) {
    showToast("Adicione ao menos um filme com ingressos à venda.", "error");
    return;
  }
  if (state.saleMode === "registered" && !$("manualCustomerUserId").value) {
    showToast("Selecione o usuário que receberá os ingressos.", "error");
    return;
  }

  const submitButton = $("manualSaleSubmitButton");
  try {
    submitButton.disabled = true;
    submitButton.textContent = "Finalizando venda...";
    const paymentMethod = document.querySelector("input[name='manualPaymentMethod']:checked")?.value || "cash";
    const saleMode = state.saleMode;
    const payload = {
      fullTicketsCount: 0,
      halfTicketsCount: 0,
      saleItems: saleItems.map((item) => ({
        movieId: item.movieId,
        sessionId: item.sessionId,
        ticketItems: item.ticketItems
      })),
      concessionItems: manualConcessionItems(),
      saleMode,
      paymentMethod,
      customerUserId: saleMode === "registered" ? $("manualCustomerUserId").value : "",
      customerName: saleMode === "quick" ? "" : $("manualCustomerName").value,
      customerEmail: saleMode === "quick" ? "" : $("manualCustomerEmail").value,
      customerPhone: saleMode === "quick" ? "" : $("manualCustomerPhone").value,
      customerCpf: saleMode === "quick" ? "" : $("manualCustomerCpf").value.replace(/\D/g, ""),
      createdAt: new Date().toISOString()
    };
    const result = await api("/api/box-office/sales", { method: "POST", body: JSON.stringify(payload) });
    const orders = result.orders || (result.order ? [result.order] : []);
    state.manualSaleItems = [];
    state.manualConcessionQuantities = {};
    renderManualSaleItems();
    if (paymentMethod === "card_terminal") {
      startPointPaymentTracking(result);
      return;
    }
    await loadContent({ silent: true });
    const pointPrint = result.pointPrint || {};
    const printMessage = pointPrint.status === "queued"
      ? " Os ingressos foram enviados para impressão na Point."
      : pointPrint.message ? ` ${pointPrint.message}` : "";
    showSuccess(
      "Venda finalizada",
      `${orders.length} ${orders.length === 1 ? "pedido criado" : "pedidos criados"} e ${(result.tickets || []).length} ingresso(s) emitido(s).${printMessage}`
    );
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    submitButton.disabled = false;
    renderManualSaleItems();
  }
}

function pointPaymentStatusLabel(status = "") {
  return {
    pending: "Aguardando no terminal",
    approved: "Pagamento aprovado",
    rejected: "Pagamento recusado",
    cancelled: "Cobrança cancelada",
    expired: "Cobrança expirada",
    refunded: "Pagamento estornado"
  }[status] || status || "Aguardando no terminal";
}

function stopPointPaymentPolling() {
  clearTimeout(state.pointPaymentTimer);
  state.pointPaymentTimer = null;
}

function renderPointPayment(data = {}) {
  const payment = data.payment || state.pointPaymentSnapshot?.payment || {};
  const orders = data.orders || state.pointPaymentSnapshot?.orders || [];
  const tickets = data.tickets || state.pointPaymentSnapshot?.tickets || [];
  const status = payment.status || "pending";
  const finalStatus = ["approved", "rejected", "cancelled", "expired", "refunded"].includes(status);
  state.pointPaymentSnapshot = { payment, orders, tickets };

  const panel = $("pointPaymentPanel");
  panel.hidden = false;
  panel.dataset.status = status;
  $("manualTicketForm").hidden = true;
  $("pointPaymentAmount").textContent = money(payment.amount);
  $("pointPaymentTerminal").textContent = payment.metadata?.terminalId || data.terminal?.id || "Terminal Point";
  $("pointPaymentReference").textContent = payment.providerReference || payment.providerPaymentId || "-";
  $("pointPaymentStatus").textContent = pointPaymentStatusLabel(status);
  $("pointPaymentRetryButton").hidden = status === "approved";
  $("pointPaymentCancelButton").hidden = finalStatus;
  $("pointPaymentNewSaleButton").hidden = !finalStatus;

  const copy = {
    approved: ["Pagamento aprovado e ingressos emitidos", "A venda foi confirmada pelo Mercado Pago. Imprima os ingressos físicos abaixo."],
    rejected: ["Pagamento recusado", "Nenhum ingresso foi emitido. Inicie uma nova venda para tentar outra forma de pagamento."],
    cancelled: ["Cobrança cancelada", "A ordem foi cancelada no terminal e nenhum ingresso foi emitido."],
    expired: ["Tempo de pagamento encerrado", "A cobrança expirou sem aprovação e os ingressos não foram emitidos."],
    refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta cobrança."]
  }[status] || ["Aguardando pagamento na maquininha", "A cobrança foi enviada. Oriente o cliente a concluir o pagamento no terminal."];
  $("pointPaymentTitle").textContent = copy[0];
  $("pointPaymentMessage").textContent = copy[1];

  const printActions = $("pointPaymentPrintActions");
  if (status === "approved" && orders.length) {
    printActions.hidden = false;
    printActions.innerHTML = `
      <strong>Ingressos físicos disponíveis</strong>
      <p>${tickets.length} ingresso(s) emitido(s). Abra o PDF individual para imprimir o ingresso físico.</p>
      <div class="button-row">
        ${tickets.map((ticket, index) => `<button class="ghost-button" type="button" onclick="printPhysicalTicket('${escapeHtml(ticket.id)}')">Imprimir ${escapeHtml(ticket.movieTitle || ticket.ticketType || `ingresso ${index + 1}`)}</button>`).join("")}
      </div>
    `;
  } else {
    printActions.hidden = true;
    printActions.innerHTML = "";
  }
}

function schedulePointPaymentPoll(delay = 2200) {
  stopPointPaymentPolling();
  if (!state.pointPaymentId) return;
  state.pointPaymentTimer = setTimeout(() => pollPointPayment(), delay);
}

async function pollPointPayment({ manual = false } = {}) {
  if (!state.pointPaymentId || state.pointPaymentSyncing) return;
  state.pointPaymentSyncing = true;
  const retryButton = $("pointPaymentRetryButton");
  if (manual) retryButton.disabled = true;
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.pointPaymentId)}`);
    renderPointPayment(result);
    if (result.payment?.status === "approved") {
      stopPointPaymentPolling();
      await loadContent({ silent: true });
      renderPointPayment(result);
      showToast("Pagamento aprovado. Ingressos liberados para impressão.");
    } else if (["rejected", "cancelled", "expired", "refunded"].includes(result.payment?.status)) {
      stopPointPaymentPolling();
      await loadContent({ silent: true });
    } else {
      schedulePointPaymentPoll();
    }
  } catch (error) {
    $("pointPaymentMessage").textContent = `${error.message} Tentaremos consultar novamente automaticamente.`;
    schedulePointPaymentPoll(3500);
  } finally {
    state.pointPaymentSyncing = false;
    retryButton.disabled = false;
  }
}

function startPointPaymentTracking(result) {
  state.pointPaymentId = result.payment?.id || "";
  renderPointPayment(result);
  if (result.payment?.status === "approved") {
    void loadContent({ silent: true }).then(() => renderPointPayment(result));
    return;
  }
  schedulePointPaymentPoll(1200);
}

async function cancelPointPayment() {
  if (!state.pointPaymentId || !confirm("Cancelar a cobrança enviada à maquininha? Nenhum ingresso será emitido.")) return;
  const button = $("pointPaymentCancelButton");
  button.disabled = true;
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.pointPaymentId)}/cancel`, { method: "POST" });
    stopPointPaymentPolling();
    renderPointPayment(result);
    await loadContent({ silent: true });
    showToast("Cobrança cancelada no Mercado Pago Point.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function resetPointPaymentPanel() {
  stopPointPaymentPolling();
  state.pointPaymentId = "";
  state.pointPaymentSnapshot = null;
  $("pointPaymentPanel").hidden = true;
  $("manualTicketForm").hidden = false;
  renderManualSaleItems();
  $("manualTicketForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function printPhysicalTicket(ticketId) {
  const popup = window.open(`${API_BASE}/api/admin/tickets/${encodeURIComponent(ticketId)}/print`, "_blank");
  if (popup) popup.opener = null;
  else showToast("O navegador bloqueou a abertura do PDF. Permita pop-ups para imprimir.", "error");
}

function setSaleMode(mode) {
  state.saleMode = mode;
  if (mode !== "registered") clearSelectedCustomer();
  renderSaleMode();
}

function renderSaleMode() {
  document.querySelectorAll("[data-sale-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.saleMode === state.saleMode);
  });
  const registered = $("registeredCustomerBox");
  const guest = $("guestCustomerBox");
  const quick = $("quickSaleBox");
  if (registered) registered.hidden = state.saleMode !== "registered";
  if (guest) guest.hidden = state.saleMode !== "guest";
  if (quick) quick.hidden = state.saleMode !== "quick";
  if ($("manualSaleSubmitButton")) {
    $("manualSaleSubmitButton").textContent = state.saleMode === "quick" ? "Finalizar venda rápida" : "Finalizar venda";
  }
  if (state.saleMode === "quick") {
    $("manualCustomerName").value = "";
    $("manualCustomerEmail").value = "";
    $("manualCustomerPhone").value = "";
    $("manualCustomerCpf").value = "";
  }
}

function clearSelectedCustomer() {
  state.selectedCustomer = null;
  $("manualCustomerUserId").value = "";
  $("manualSelectedCustomer").textContent = "Nenhum cliente selecionado.";
}

function selectBoxOfficeCustomer(customer) {
  state.selectedCustomer = customer;
  $("manualCustomerUserId").value = customer.id;
  $("manualCustomerName").value = customer.name || "";
  $("manualCustomerEmail").value = customer.email || "";
  $("manualCustomerPhone").value = customer.phone || "";
  $("manualCustomerCpf").value = customer.cpf || "";
  $("manualSelectedCustomer").textContent = `${customer.name} selecionado. Os ingressos serao vinculados a esta conta.`;
  $("manualCustomerResults").innerHTML = "";
}

function selectBoxOfficeCustomerById(customerId) {
  const customer = state.customerSearchResults.find((item) => item.id === customerId);
  if (customer) selectBoxOfficeCustomer(customer);
}

async function searchBoxOfficeCustomers() {
  const query = $("manualCustomerSearch").value.trim();
  const target = $("manualCustomerResults");
  const digits = query.replace(/\D/g, "");
  const keepSelection = state.selectedCustomer && (
    query === state.selectedCustomer.name ||
    query === state.selectedCustomer.email ||
    query === state.selectedCustomer.phone
  );
  if (!keepSelection) clearSelectedCustomer();
  if (query.length > 0 && query.length < 2 && digits.length < 3) {
    state.customerSearchResults = [];
    target.innerHTML = `<div class="empty-state compact"><strong>Continue digitando</strong><span>Busque por nome, e-mail, WhatsApp ou CPF.</span></div>`;
    return;
  }
  target.innerHTML = `<div class="skeleton-card compact"></div>`;
  try {
    const result = await api(`/api/admin/customers?query=${encodeURIComponent(query)}`);
    const customers = result.customers || [];
    state.customerSearchResults = customers;
    target.innerHTML = customers.length
      ? customers.map((customer) => `
          <button type="button" class="customer-result" onclick="selectBoxOfficeCustomerById('${escapeHtml(customer.id)}')">
            <strong>${escapeHtml(customer.name)}</strong>
            <span>${escapeHtml(customer.email || "")} ${customer.phone ? `- ${escapeHtml(customer.phone)}` : ""} ${customer.role ? `- ${escapeHtml(adminRoleLabel(customer.role))}` : ""}</span>
          </button>
        `).join("")
      : `<div class="empty-state compact"><strong>Nenhum cliente encontrado</strong><span>Use Cliente avulso ou Venda rapida.</span></div>`;
  } catch (error) {
    target.innerHTML = `<div class="validation-result error">${escapeHtml(error.message)}</div>`;
  }
}

function updateManualTotal() {
  const concessionsById = new Map((state.content?.concessions || []).map((item) => [item.id, item]));
  const concessionsTotal = manualConcessionItems().reduce((sum, item) => sum + item.quantity * Number(concessionsById.get(item.id)?.price || 0), 0);
  if (state.manualSaleItems.length) {
    const total = state.manualSaleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0) + concessionsTotal;
    if ($("manualTotalDisplay")) $("manualTotalDisplay").textContent = money(total);
    return;
  }
  const types = new Map(currentManualTicketTypes().map((ticketType) => [ticketType.id, ticketType]));
  const total = manualTicketItems().reduce((sum, item) => sum + item.quantity * Number(types.get(item.id)?.price || 0), 0) + concessionsTotal;
  if ($("manualTotalDisplay")) $("manualTotalDisplay").textContent = money(total);
}

function setBoxOfficeTab(tab) {
  state.boxOfficeTab = tab;
  document.querySelectorAll("[data-box-office-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.boxOfficeTab === tab);
  });
  const panelByTab = {
    newSale: "boxOfficeNewSale",
    todaySales: "boxOfficeTodaySales",
    allOrders: "boxOfficeAllOrders",
    payments: "boxOfficePayments",
    validateTicket: "boxOfficeValidateTicket"
  };
  Object.entries(panelByTab).forEach(([key, id]) => {
    const panel = $(id);
    if (panel) panel.classList.toggle("active", key === tab);
  });
  if (tab === "validateTicket") {
    startQrReader();
  } else {
    stopQrReader();
  }
}

function validationSessionOptions() {
  const today = state.content?.calendar?.today || new Date().toLocaleDateString("sv-SE");
  return (state.content?.movies || [])
    .flatMap((movie) => (movie.sessions || []).map((session) => ({
      ...session,
      movieId: movie.id,
      movieTitle: movie.title || "Filme"
    })))
    .filter((session) => session.id && session.date >= today && !["cancelled", "hidden"].includes(String(session.status || "").toLowerCase()))
    .sort((a, b) => String(`${a.date} ${a.time} ${a.movieTitle}`).localeCompare(String(`${b.date} ${b.time} ${b.movieTitle}`)));
}

function validationSessionLabel(session = {}) {
  const date = session.date
    ? new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
    : "Sem data";
  return `${date} • ${session.time || "--:--"} • ${session.movieTitle || "Filme"}${session.format ? ` • ${session.format}` : ""}`;
}

function renderValidationSessionScope() {
  const lock = $("ticketValidationSessionLock");
  const field = $("ticketValidationSessionField");
  const select = $("ticketValidationSessionSelect");
  const hint = $("ticketValidationSessionHint");
  if (!lock || !field || !select || !hint) return;

  const sessions = validationSessionOptions();
  if (!sessions.some((session) => session.id === state.validationSessionId)) {
    state.validationSessionId = sessions[0]?.id || "";
  }
  if (!sessions.length) state.validationSessionLock = false;

  lock.checked = state.validationSessionLock;
  lock.disabled = sessions.length === 0;
  field.hidden = !state.validationSessionLock;
  select.disabled = !state.validationSessionLock || sessions.length === 0;
  select.innerHTML = sessions.length
    ? sessions.map((session) => `<option value="${escapeHtml(session.id)}">${escapeHtml(validationSessionLabel(session))}</option>`).join("")
    : `<option value="">Nenhuma sessão futura disponível</option>`;
  if (state.validationSessionId) select.value = state.validationSessionId;

  const selected = sessions.find((session) => session.id === state.validationSessionId);
  hint.classList.toggle("locked", state.validationSessionLock && Boolean(selected));
  hint.textContent = state.validationSessionLock && selected
    ? `Proteção ativa: somente ${validationSessionLabel(selected)}.`
    : sessions.length
      ? "O leitor aceitará ingressos de qualquer sessão válida."
      : "Não há sessões futuras disponíveis para restringir o leitor.";
}

function updateValidationSessionLock() {
  state.validationSessionLock = Boolean($("ticketValidationSessionLock")?.checked);
  if (state.validationSessionLock && !state.validationSessionId) {
    state.validationSessionId = validationSessionOptions()[0]?.id || "";
  }
  renderValidationSessionScope();
  $("ticketValidationResult").className = "validation-result scanner-ready";
  $("ticketValidationResult").textContent = state.validationSessionLock
    ? "Filtro de sessão ativado. Ingressos de outras sessões serão recusados sem serem utilizados."
    : "Filtro removido. O leitor aceita qualquer sessão válida.";
}

function setTicketValidationMode(mode) {
  state.validationMode = mode === "concessions" ? "concessions" : "entry";
  document.querySelectorAll("[data-validation-mode]").forEach((button) => {
    const active = button.dataset.validationMode === state.validationMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const concessionsMode = state.validationMode === "concessions";
  const scope = document.querySelector(".validation-scope");
  if (scope) scope.hidden = concessionsMode;
  const validateButton = $("validateTicketButton");
  if (validateButton) validateButton.textContent = concessionsMode ? "Validar itens da bomboniere" : "Validar entrada";
  const result = $("ticketValidationResult");
  if (result) {
    result.className = "validation-result scanner-ready";
    result.textContent = concessionsMode
      ? "Leitor pronto para conferir e entregar os itens da bomboniere."
      : "Leitor pronto para validar a entrada.";
  }
}

function ticketResultDetails(ticket = {}) {
  return [
    ticket.movieTitle || "Ingresso Cine Cruzeiro",
    [ticket.sessionTime, ticket.sessionRoom || "Sala Cruzeiro"].filter(Boolean).join(" • "),
    [ticket.ticketType, ticket.sessionFormat].filter(Boolean).join(" • ")
  ].filter(Boolean);
}

function renderTicketValidationResult(type, payload = {}) {
  const target = $("ticketValidationResult");
  if (!target) return;
  const ticket = payload.ticket || {};
  const details = ticketResultDetails(ticket);
  const usedAt = ticket.usedAt ? new Date(ticket.usedAt).toLocaleString("pt-BR") : "";
  const operator = ticket.usedBy ? `por ${escapeHtml(ticket.usedBy)}` : "";
  const message = escapeHtml(payload.message || "");
  const templates = {
    ok: {
      title: "Ingresso válido",
      copy: "Entrada liberada",
      action: "Escanear próximo"
    },
    used: {
      title: "Ingresso já utilizado",
      copy: [usedAt ? `Validado em ${usedAt}` : "", operator].filter(Boolean).join("<br>") || "Este código já deu entrada.",
      action: "Escanear próximo"
    },
    expired: {
      title: "Sessão indisponível",
      copy: message || "Este ingresso está expirado, cancelado ou fora da janela de validação.",
      action: "Tentar novamente"
    },
    wrongSession: {
      title: "Ingresso de outra sessão",
      copy: message || "Este ingresso não pertence à sessão escolhida e não foi utilizado.",
      action: "Escanear próximo"
    },
    invalid: {
      title: "Ingresso inválido",
      copy: message || "Código não reconhecido, cancelado ou sem autorização.",
      action: "Tentar novamente"
    },
    offline: {
      title: "Sem conexão",
      copy: "Não foi possível validar este ingresso com segurança.",
      action: "Tentar novamente"
    },
    concessionsOk: {
      title: "Itens liberados",
      copy: "Entrega da bomboniere registrada.",
      action: "Escanear próximo"
    },
    concessionsUsed: {
      title: "Itens já entregues",
      copy: message || "A bomboniere deste pedido já foi retirada.",
      action: "Escanear próximo"
    },
    withoutConcessions: {
      title: "Pedido sem bomboniere",
      copy: message || "Este pedido não possui produtos para retirada.",
      action: "Escanear próximo"
    }
  };
  const template = templates[type] || templates.invalid;
  const concessions = Array.isArray(payload.concessions) ? payload.concessions : [];
  target.className = `validation-result scanner-result ${type}`;
  target.innerHTML = `
    <strong>${escapeHtml(template.title)}</strong>
    ${details.length ? `<div class="scanner-result-details">${details.map(escapeHtml).join("<br>")}</div>` : ""}
    ${concessions.length ? `<div class="scanner-result-items">${concessions.map((item) => `<span><b>${Number(item.quantity || 0)}x</b> ${escapeHtml(item.name || item.id || "Item")}</span>`).join("")}</div>` : ""}
    <p>${template.copy}</p>
    <button class="primary-button full" type="button" onclick="scanNextTicket()">${escapeHtml(template.action)}</button>
  `;
}

async function validateTicketByCode(code, options = {}) {
  const cleanCode = String(code || $("ticketValidationCode").value || "").trim();
  if (!cleanCode) {
    showToast("Informe ou leia um QR Code.", "error");
    return;
  }
  if (state.qrValidationLocked) return;
  state.qrValidationLocked = true;
  clearTimeout(state.qrAutoRestartTimer);
  setQrReaderActive(false, "Validando no servidor...");

  try {
    const sessionId = state.validationMode === "entry" && state.validationSessionLock ? state.validationSessionId : "";
    if (state.validationMode === "entry" && state.validationSessionLock && !sessionId) {
      showToast("Escolha a sessão permitida antes de validar.", "error");
      return;
    }
    const result = await api("/api/tickets/validate", {
      method: "POST",
      body: JSON.stringify({ code: cleanCode, sessionId, mode: state.validationMode })
    });
    renderTicketValidationResult(
      result.result === "concessions_fulfilled" ? "concessionsOk" : "ok",
      { ticket: result.ticket, concessions: result.concessions }
    );
    if ($("ticketValidationCode")) $("ticketValidationCode").value = result.ticket?.code || cleanCode;
    navigator.vibrate?.(80);
    await loadContent({ silent: true });
  } catch (error) {
    if (!navigator.onLine) {
      renderTicketValidationResult("offline");
    } else {
      const payload = error.payload || {};
      const resultType = payload.result === "concessions_already_fulfilled"
        ? "concessionsUsed"
        : payload.result === "without_concessions"
          ? "withoutConcessions"
        : payload.result === "used"
        ? "used"
        : payload.result === "wrong_session" || payload.error?.code === "TICKET_SESSION_MISMATCH"
          ? "wrongSession"
        : payload.result === "expired"
          ? "expired"
          : payload.error?.code === "TICKET_PAYMENT_PENDING"
            ? "expired"
            : payload.result === "invalid"
              ? "invalid"
              : /já validado|ja validado/i.test(error.message || "")
                ? "used"
                : /indispon|expir|sess|pago/i.test(error.message || "")
                  ? "expired"
                  : "invalid";
      renderTicketValidationResult(resultType, {
        ticket: payload.ticket,
        concessions: payload.concessions,
        message: payload.error?.message || error.message || "Não foi possível validar este ingresso."
      });
    }
  } finally {
    state.qrValidationLocked = false;
    if (options.autoRestart) {
      state.qrAutoRestartTimer = setTimeout(() => {
        if (state.boxOfficeTab === "validateTicket") startQrReader();
      }, 4200);
    }
  }
}

async function startQrReader() {
  stopQrReader();
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    renderTicketValidationResult("invalid", { message: "A câmera exige HTTPS em produção. Digite o código manualmente." });
    $("manualCodeBox").hidden = false;
    $("validateTicketButton").hidden = false;
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    renderTicketValidationResult("invalid", { message: "Este navegador não oferece câmera web. Digite o código manualmente." });
    $("manualCodeBox").hidden = false;
    $("validateTicketButton").hidden = false;
    return;
  }
  try {
    state.qrCameraPermission = "prompt";
    setQrReaderActive(true, "Solicitando permissão da câmera...");
    state.qrStream = await requestCameraStream();
    state.qrCameraPermission = "granted";
    const video = $("qrVideo");
    await prepareQrVideo(video, state.qrStream);
    state.qrTorchTrack = state.qrStream.getVideoTracks()[0] || null;
    await state.qrTorchTrack?.applyConstraints?.({ advanced: [{ focusMode: "continuous" }] }).catch(() => null);
    const cameraLabel = String(state.qrTorchTrack?.label || "").trim();
    setQrReaderActive(true, cameraLabel ? `Câmera ativa: ${cameraLabel}` : "Aponte para o QR Code");
    let detector = null;
    if ("BarcodeDetector" in window) {
      try {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    state.qrScanDeadline = Date.now() + QR_SCAN_DURATION_MS;
    updateQrCountdown();
    state.qrCountdownTimer = setInterval(updateQrCountdown, 250);
    state.qrCloseTimer = setTimeout(() => {
      stopQrReader("Tempo de leitura encerrado. Abra a camera novamente ou digite o codigo manualmente.");
    }, QR_SCAN_DURATION_MS);
    $("ticketValidationResult").className = "validation-result scanner-ready";
    $("ticketValidationResult").textContent = detector
      ? "Leitura automática ativa."
      : "Leitura alternativa ativa via jsQR.";

    state.qrScanTimer = setInterval(async () => {
      if (!video.videoWidth || state.qrValidationLocked) return;

      let value = "";
      try {
        if (detector) {
          const codes = await detector.detect(video).catch(() => []);
          value = codes[0]?.rawValue || "";
        }
        if (!value && window.jsQR && context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          value = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" })?.data || "";
        }
      } catch {
        // Uma falha isolada de leitura nao deve encerrar a camera.
      }

      const now = Date.now();
      if (value && (value !== state.qrLastValue || now - state.qrLastValueAt > 3000)) {
        state.qrLastValue = value;
        state.qrLastValueAt = now;
        if ($("ticketValidationCode")) $("ticketValidationCode").value = value;
        stopQrReader(state.validationMode === "concessions" ? "QR Code lido. Conferindo bomboniere..." : "QR Code lido. Validando ingresso...");
        validateTicketByCode(value, { autoRestart: true });
      }
    }, 420);
  } catch (error) {
    stopQrReader();
    state.qrCameraPermission = await getCameraPermissionState();
    renderCameraAccessError(error, state.qrCameraPermission);
    $("manualCodeBox").hidden = false;
    $("validateTicketButton").hidden = false;
  }
}

async function getCameraPermissionState() {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const permission = await navigator.permissions.query({ name: "camera" });
    return permission.state || "unknown";
  } catch {
    return "unknown";
  }
}

async function requestCameraStream() {
  const attempts = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    },
    {
      video: {
        facingMode: "environment"
      },
      audio: false
    },
    {
      video: true,
      audio: false
    }
  ];
  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(error?.name)) throw error;
    }
  }
  throw lastError || new Error("Camera unavailable");
}

async function prepareQrVideo(video, stream) {
  if (!video) throw new Error("Video do leitor nao encontrado.");
  video.muted = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("autoplay", "");
  video.srcObject = stream;
  try {
    if (!video.videoWidth) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("A câmera demorou para iniciar.")), 7000);
        if (video.readyState >= 1) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Não foi possível carregar a prévia da câmera."));
        };
      });
    }
    await video.play();
    await new Promise((resolve, reject) => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => reject(new Error("A câmera abriu, mas não enviou imagem.")), 5000);
      video.addEventListener("playing", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

function cameraRecoverySteps(permissionState = "unknown") {
  if (permissionState === "denied") {
    return [
      "Clique no cadeado ao lado do endereço do site.",
      "Altere Câmera para Permitir.",
      "Feche este aviso e toque em Solicitar acesso novamente."
    ];
  }
  return [
    "Confira se outro aplicativo não está usando a câmera.",
    "Toque em Solicitar acesso novamente para o navegador abrir a permissão.",
    "Se preferir, valide pelo código manual do ingresso."
  ];
}

function renderCameraAccessError(error, permissionState = "unknown") {
  const target = $("ticketValidationResult");
  const errorName = String(error?.name || "");
  const blocked = permissionState === "denied" || ["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(errorName);
  const unavailable = ["NotFoundError", "DevicesNotFoundError"].includes(errorName);
  const busy = ["NotReadableError", "TrackStartError", "AbortError"].includes(errorName);
  let title = "Não foi possível abrir a câmera";
  let message = "Feche outros aplicativos que usam a câmera e tente novamente.";
  let help = "Você também pode digitar o código do ingresso abaixo.";

  if (blocked) {
    title = "Permissão da câmera bloqueada";
    message = "Libere a câmera nas permissões deste site e tente novamente.";
    help = "No computador, use o cadeado ao lado do endereço. No celular, abra as permissões do navegador ou do site e selecione Câmera: Permitir.";
  } else if (unavailable) {
    title = "Nenhuma câmera encontrada";
    message = "Conecte ou ative uma câmera neste dispositivo.";
  } else if (busy) {
    title = "Câmera em uso por outro aplicativo";
    message = "Feche a câmera, videochamada ou outro leitor aberto e tente novamente.";
  }
  const steps = cameraRecoverySteps(permissionState);

  if (!target) return;
  target.className = "validation-result camera-access-result";
  target.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p>${escapeHtml(message)}</p>
    <span>${escapeHtml(help)}</span>
    <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    <button class="primary-button" type="button" data-camera-retry>Solicitar acesso novamente</button>
  `;
  target.querySelector("[data-camera-retry]")?.addEventListener("click", startQrReader);
  const startButton = $("startQrButton");
  if (startButton) startButton.textContent = "Solicitar câmera";
}

function updateQrCountdown() {
  const seconds = Math.max(0, Math.ceil((state.qrScanDeadline - Date.now()) / 1000));
  const counter = $("qrCountdown");
  if (counter) counter.textContent = `${seconds}s`;
}

function setQrReaderActive(active, status = "") {
  const frame = $("qrReaderFrame");
  if (frame) frame.classList.toggle("active", active);
  const startButton = $("startQrButton");
  const stopButton = $("stopQrButton");
  if (startButton) {
    startButton.disabled = active;
    if (active) startButton.textContent = "Abrindo câmera...";
    else if (state.qrCameraPermission === "granted") startButton.textContent = "Abrir câmera";
  }
  if (stopButton) stopButton.disabled = !active;
  const torchButton = $("torchQrButton");
  const hasTorch = Boolean(state.qrTorchTrack?.getCapabilities?.().torch);
  if (torchButton) {
    torchButton.disabled = !active || !hasTorch;
    torchButton.classList.toggle("active", state.qrTorchOn);
  }
  const statusElement = $("qrReaderStatus");
  if (statusElement) statusElement.textContent = status || (active ? "Câmera ativa" : "Câmera desligada");
  const counter = $("qrCountdown");
  if (counter && !active) counter.textContent = "30s";
}

function stopQrReader(message = "") {
  clearTimeout(state.qrAutoRestartTimer);
  if (state.qrScanTimer) {
    clearInterval(state.qrScanTimer);
    state.qrScanTimer = null;
  }
  if (state.qrCloseTimer) {
    clearTimeout(state.qrCloseTimer);
    state.qrCloseTimer = null;
  }
  if (state.qrCountdownTimer) {
    clearInterval(state.qrCountdownTimer);
    state.qrCountdownTimer = null;
  }
  state.qrScanDeadline = 0;
  state.qrTorchOn = false;
  state.qrTorchTrack = null;
  if (state.qrStream) {
    state.qrStream.getTracks().forEach((track) => track.stop());
    state.qrStream = null;
  }
  const video = $("qrVideo");
  if (video) video.srcObject = null;
  setQrReaderActive(false, message || "Câmera desligada");
  if (message && $("ticketValidationResult")) {
    $("ticketValidationResult").className = "validation-result";
    $("ticketValidationResult").textContent = message;
  }
}

async function toggleQrTorch() {
  const track = state.qrTorchTrack;
  if (!track?.getCapabilities?.().torch) return;
  state.qrTorchOn = !state.qrTorchOn;
  await track.applyConstraints({ advanced: [{ torch: state.qrTorchOn }] }).catch(() => {
    state.qrTorchOn = false;
    showToast("Lanterna indisponível neste aparelho.", "error");
  });
  setQrReaderActive(Boolean(state.qrStream), state.qrStream ? "Aponte para o QR Code" : "Câmera desligada");
}

function toggleManualCodeBox() {
  const box = $("manualCodeBox");
  const button = $("validateTicketButton");
  if (!box || !button) return;
  const nextHidden = !box.hidden;
  box.hidden = nextHidden;
  button.hidden = nextHidden;
  if (!nextHidden) $("ticketValidationCode")?.focus();
}

function scanNextTicket() {
  if ($("ticketValidationCode")) $("ticketValidationCode").value = "";
  state.qrLastValue = "";
  state.qrLastValueAt = 0;
  if ($("ticketValidationResult")) {
    $("ticketValidationResult").className = "validation-result scanner-ready";
    $("ticketValidationResult").textContent = "Pronto para o próximo ingresso.";
  }
  startQrReader();
}

function renderConcessions() {
  const items = state.content?.concessions || [];
  renderConcessionInsights();
  if (state.creating.concession) {
    $("concessionsList").innerHTML = creationPlaceholder("Novo produto", "Preencha nome, preço, estoque e imagem por upload no quadro à direita.");
    fillConcessionForm(null);
    return;
  }
  if (!items.length) {
    $("concessionsList").innerHTML = `<div class="empty-state"><strong>Nenhum produto cadastrado</strong><span>Crie combos para aparecerem no checkout.</span></div>`;
    fillConcessionForm(null);
    return;
  }

  $("concessionsList").innerHTML = items
    .map((item) => `
      <button class="list-item ${item.id === state.selectedConcessionId ? "active" : ""}" type="button" onclick="selectConcession('${item.id}')">
        <span>
          <span class="list-title">${escapeHtml(item.name)}</span>
          <span class="list-meta">${escapeHtml(item.category || "combo")} • ${item.active ? "ativo" : "inativo"}${item.featured ? " • destaque" : ""}${item.stock !== "" && item.stock !== undefined ? ` • estoque ${item.stock}` : ""}</span>
        </span>
        <span class="badge">${money(item.price)}</span>
      </button>
    `)
    .join("");
  fillConcessionForm(currentConcession());
}

function renderConcessionInsights() {
  const orders = state.content?.orders || [];
  const soldByItem = new Map();
  orders.forEach((order) => {
    (order.concessionItems || []).forEach((item) => {
      const current = soldByItem.get(item.id) || { name: item.name, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.quantity || 0) * Number(item.unitPrice || 0);
      soldByItem.set(item.id, current);
    });
  });

  const totalQuantity = [...soldByItem.values()].reduce((sum, item) => sum + item.quantity, 0);
  const totalRevenue = [...soldByItem.values()].reduce((sum, item) => sum + item.revenue, 0);
  const topItem = [...soldByItem.values()].sort((a, b) => b.quantity - a.quantity)[0];

  $("concessionInsights").innerHTML = `
    <div class="mini-insight"><span>Itens vendidos</span><strong>${totalQuantity}</strong></div>
    <div class="mini-insight"><span>Receita</span><strong>${money(totalRevenue)}</strong></div>
    <div class="mini-insight"><span>Mais vendido</span><strong>${escapeHtml(topItem?.name || "-")}</strong></div>
  `;
}

function selectConcession(id) {
  delete state.pendingImages.concessionImageUrl;
  state.creating.concession = false;
  state.selectedConcessionId = id;
  renderConcessions();
}

function newConcession() {
  delete state.pendingImages.concessionImageUrl;
  state.creating.concession = true;
  state.selectedConcessionId = "";
  $("concessionsList").innerHTML = creationPlaceholder("Novo produto", "Preencha nome, preço, estoque e imagem por upload no quadro à direita.");
  fillConcessionForm(null);
}

function fillConcessionForm(item) {
  syncCreationControl("concession", "cancelConcessionCreateButton", "deleteConcessionButton", Boolean(item));
  setDisabled("deleteConcessionButton", !item);
  $("concessionId").value = item?.id || "";
  $("concessionSku").value = item?.sku || "";
  $("concessionName").value = item?.name || "";
  $("concessionBadge").value = item?.badge || "";
  $("concessionDescription").value = item?.description || "";
  $("concessionImageUrl").value = Object.prototype.hasOwnProperty.call(state.pendingImages, "concessionImageUrl")
    ? state.pendingImages.concessionImageUrl
    : item?.imageUrl || "";
  $("concessionPrice").value = item?.price ?? 0;
  $("concessionCompareAt").value = item?.compareAt || "";
  $("concessionStock").value = item?.stock ?? "";
  $("concessionMaxPerOrder").value = item?.maxPerOrder ?? 8;
  $("concessionSortOrder").value = item?.sortOrder ?? 100;
  $("concessionTags").value = (item?.tags || []).join(", ");
  $("concessionCategory").value = item?.category || "combo";
  $("concessionComboItems").value = (item?.comboItems || []).map((comboItem) => `${comboItem.name} | ${comboItem.quantity}`).join("\n");
  $("concessionFeatured").checked = Boolean(item?.featured);
  $("concessionActive").checked = item?.active !== false;
  renderConcessionPreview();
}

function renderConcessionPreview() {
  const url = cleanAdminAssetUrl($("concessionImageUrl").value);
  $("concessionImagePreview").innerHTML = url
    ? `<img src="${escapeHtml(adminAssetUrl(url))}" alt="Prévia do produto" onerror="this.parentElement.innerHTML='<span>Imagem indisponível</span>'" />`
    : "<span>Imagem do produto</span>";
}

async function saveConcession(event) {
  event.preventDefault();
  const requestedImageUrl = cleanAdminAssetUrl($("concessionImageUrl").value);
  try {
    const payload = {
      id: $("concessionId").value || undefined,
      sku: $("concessionSku").value,
      name: $("concessionName").value,
      badge: $("concessionBadge").value,
      description: $("concessionDescription").value,
      imageUrl: requestedImageUrl,
      price: Number($("concessionPrice").value || 0),
      compareAt: $("concessionCompareAt").value,
      stock: $("concessionStock").value,
      maxPerOrder: Number($("concessionMaxPerOrder").value || 8),
      sortOrder: Number($("concessionSortOrder").value || 100),
      tags: $("concessionTags").value,
      category: $("concessionCategory").value,
      comboItems: $("concessionComboItems").value,
      featured: $("concessionFeatured").checked,
      active: $("concessionActive").checked
    };
    const existingId = $("concessionId").value;
    const saved = existingId
      ? await api(`/api/concessions/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/concessions", { method: "POST", body: JSON.stringify(payload) });
    state.creating.concession = false;
    state.selectedConcessionId = saved.id;
    if (requestedImageUrl && cleanAdminAssetUrl(saved.imageUrl) !== requestedImageUrl) {
      throw new Error("O produto foi salvo, mas a imagem não foi persistida. Envie o arquivo novamente.");
    }
    delete state.pendingImages.concessionImageUrl;
    await loadContent({ silent: true });
    showSuccess("Produto salvo", `${saved.name} ja pode aparecer na bomboniere do checkout.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteConcession() {
  const item = currentConcession();
  if (!item || !confirm(`Excluir ${item.name}?`)) return;
  try {
    await api(`/api/concessions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedConcessionId = "";
    await loadContent({ silent: true });
    showToast("Produto excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function fillSettingsForm() {
  const settings = state.content?.settings || {};
  $("settingAnnouncementEnabled").checked = settings.announcementEnabled !== false;
  $("settingAnnouncementText").value = settings.announcementText || "";
  $("eventTransparentImages").checked = settings.eventTransparentImages === true;
  $("clubTransparentImages").checked = settings.clubTransparentImages === true;
  fillImageFields(marketingImageFields, settings);
  fillImageFields(clubImageFields, settings);
  syncTransparentImagePreviews();
}

function syncTransparentImagePreviews() {
  marketingImageFields.forEach(([, previewId]) => {
    $(previewId)?.classList.toggle("transparent-preview", $("eventTransparentImages")?.checked === true);
  });
  clubImageFields.forEach(([, previewId]) => {
    $(previewId)?.classList.toggle("transparent-preview", $("clubTransparentImages")?.checked === true);
  });
}

function renderMarketingOverview() {
  if (!$("marketingOverview")) return;
  const settings = state.content?.settings || {};
  const promotions = state.content?.promotions || [];
  const ads = state.content?.ads || [];
  const coupons = promotions.filter((item) => item.couponCode);
  $("marketingOverview").innerHTML = `
    <div class="mini-insight"><span>Faixa superior</span><strong>${settings.announcementEnabled === false ? "Oculta" : "Visível"}</strong></div>
    <div class="mini-insight"><span>Promoções ativas</span><strong>${promotions.filter((item) => item.active !== false).length}</strong></div>
    <div class="mini-insight"><span>Cupons</span><strong>${coupons.length}</strong></div>
    <div class="mini-insight"><span>Anúncios ativos</span><strong>${ads.filter((item) => item.active !== false).length}</strong></div>
  `;
}

function setAdminSubtab(group, tab, options = {}) {
  const tabList = document.querySelector(`[data-admin-tablist="${group}"]`);
  const panel = document.querySelector(`[data-admin-tab-panel="${group}:${tab}"]`);
  if (!tabList || !panel) return;
  state.adminSubtabs[group] = tab;
  tabList.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const active = button.dataset.adminTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(`[data-admin-tab-panel^="${group}:"]`).forEach((item) => {
    const active = item === panel;
    item.hidden = !active;
    item.classList.toggle("active", active);
  });
  if (options.focus) panel.querySelector("input:not([type=hidden]), button, select, textarea")?.focus();
}

function bindAdminSubtabs() {
  document.querySelectorAll("[data-admin-tablist]").forEach((tabList) => {
    const group = tabList.dataset.adminTablist;
    tabList.setAttribute("role", "tablist");
    tabList.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.setAttribute("role", "tab");
      button.addEventListener("click", () => setAdminSubtab(group, button.dataset.adminTab));
    });
    setAdminSubtab(group, state.adminSubtabs[group] || tabList.querySelector("[data-admin-tab]")?.dataset.adminTab);
  });

  document.querySelectorAll("[data-marketing-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.marketingShortcut;
      setAdminSubtab("marketing", target);
      if (target === "promotions") newPromotion();
      if (target === "ads") newAd();
      if (target === "campaigns") $("emailCampaignSubject")?.focus();
    });
  });
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    await persistSettings(
      {
        announcementEnabled: $("settingAnnouncementEnabled").checked,
        announcementText: $("settingAnnouncementText").value,
        eventTransparentImages: $("eventTransparentImages").checked,
        ...collectImageSettings(marketingImageFields)
      },
      "Configurações salvas",
      "A home e a página de eventos já vão usar as novas definições."
    );
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function saveClubVisualSettings(event) {
  event.preventDefault();
  try {
    await persistSettings(
      {
        clubTransparentImages: $("clubTransparentImages").checked,
        ...collectImageSettings(clubImageFields)
      },
      "Visual do Clube salvo",
      "A página Clube já vai usar as novas imagens."
    );
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function sendEmailCampaign(event) {
  event.preventDefault();
  const resultNode = $("emailCampaignResult");
  if (resultNode) resultNode.textContent = "Enviando...";
  try {
    const result = await api("/api/admin/email/promotions", {
      method: "POST",
      body: JSON.stringify({
        subject: $("emailCampaignSubject").value,
        mode: $("emailCampaignMode").value,
        preheader: $("emailCampaignPreheader").value,
        headline: $("emailCampaignHeadline").value,
        message: $("emailCampaignMessage").value,
        html: $("emailCampaignHtml").value,
        ctaLabel: $("emailCampaignCtaLabel").value,
        ctaUrl: $("emailCampaignCtaUrl").value
      })
    });
    if (resultNode) resultNode.textContent = `${result.sent || 0} enviados, ${result.failed || 0} falharam.`;
    $("emailCampaignForm").reset();
    syncEmailCampaignMode();
    showSuccess("Campanha enviada", `${result.sent || 0} cliente(s) receberam o e-mail.`);
  } catch (error) {
    if (resultNode) resultNode.textContent = "";
    showToast(error.message, "error");
  }
}

function syncEmailCampaignMode() {
  const htmlMode = $("emailCampaignMode")?.value === "html";
  document.querySelectorAll("[data-email-campaign-visual]").forEach((node) => { node.hidden = htmlMode; });
  document.querySelectorAll("[data-email-campaign-html]").forEach((node) => { node.hidden = !htmlMode; });
  if ($("emailCampaignMessage")) $("emailCampaignMessage").required = !htmlMode;
  if ($("emailCampaignHtml")) $("emailCampaignHtml").required = htmlMode;
}

function renderPromotions() {
  const items = state.content?.promotions || [];
  if (state.creating.promotion) {
    $("promotionsList").innerHTML = creationPlaceholder("Nova promoção", "Crie a regra comercial no quadro à direita.");
    fillPromotionForm(null);
    return;
  }
  $("promotionsList").innerHTML = items.length
    ? items.map((item) => `
        <button class="list-item ${item.id === state.selectedPromotionId ? "active" : ""}" type="button" onclick="selectPromotion('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="list-meta">${item.couponCode ? `cupom ${escapeHtml(item.couponCode)} • ` : ""}${item.active ? "ativa" : "inativa"}</span>
          </span>
          <span class="badge">${Number(item.value || 0)}</span>
        </button>
      `).join("")
    : `<div class="empty-state"><strong>Nenhuma promocao</strong><span>Crie chamadas comerciais ou cupons.</span></div>`;
  fillPromotionForm(currentPromotion());
}

function selectPromotion(id) {
  state.creating.promotion = false;
  state.selectedPromotionId = id;
  renderPromotions();
}

function newPromotion() {
  setAdminSubtab("marketing", "promotions");
  state.creating.promotion = true;
  state.selectedPromotionId = "";
  $("promotionsList").innerHTML = creationPlaceholder("Nova promoção", "Crie a regra comercial no quadro à direita.");
  fillPromotionForm(null);
}

function fillPromotionForm(item) {
  syncCreationControl("promotion", "cancelPromotionCreateButton", "deletePromotionButton", Boolean(item));
  setDisabled("deletePromotionButton", !item);
  $("promotionId").value = item?.id || "";
  $("promotionTitle").value = item?.title || "";
  $("promotionDescription").value = item?.description || "";
  $("promotionDiscountType").value = item?.discountType || "fixed_price";
  $("promotionValue").value = item?.value ?? 10;
  $("promotionCouponCode").value = item?.couponCode || "";
  $("promotionActive").checked = item?.active !== false;
}

async function savePromotion(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("promotionId").value || undefined,
      title: $("promotionTitle").value,
      description: $("promotionDescription").value,
      discountType: $("promotionDiscountType").value,
      value: Number($("promotionValue").value || 0),
      couponCode: $("promotionCouponCode").value,
      active: $("promotionActive").checked
    };
    const existingId = $("promotionId").value;
    const saved = existingId
      ? await api(`/api/promotions/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/promotions", { method: "POST", body: JSON.stringify(payload) });
    state.creating.promotion = false;
    state.selectedPromotionId = saved.id;
    await loadContent({ silent: true });
    showSuccess("Promocao salva", `${saved.title} foi atualizada.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deletePromotion() {
  const item = currentPromotion();
  if (!item || !confirm(`Excluir ${item.title}?`)) return;
  try {
    await api(`/api/promotions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedPromotionId = "";
    await loadContent({ silent: true });
    showToast("Promocao excluida.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAds() {
  const items = state.content?.ads || [];
  if (state.creating.ad) {
    $("adsList").innerHTML = creationPlaceholder("Novo anúncio", "Envie a imagem por upload e defina onde o anúncio será exibido.");
    fillAdForm(null);
    return;
  }
  $("adsList").innerHTML = items.length
    ? items.map((item) => `
        <button class="list-item ${item.id === state.selectedAdId ? "active" : ""}" type="button" onclick="selectAd('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="list-meta">${escapeHtml(item.placement || "home")} • ${item.active ? "ativo" : "inativo"}</span>
          </span>
          <span class="badge">Ad</span>
        </button>
      `).join("")
    : `<div class="empty-state"><strong>Nenhum anuncio</strong><span>Crie banners e destaques comerciais.</span></div>`;
  fillAdForm(currentAd());
}

function selectAd(id) {
  state.creating.ad = false;
  state.selectedAdId = id;
  renderAds();
}

function newAd() {
  setAdminSubtab("marketing", "ads");
  state.creating.ad = true;
  state.selectedAdId = "";
  $("adsList").innerHTML = creationPlaceholder("Novo anúncio", "Envie a imagem por upload e defina onde o anúncio será exibido.");
  fillAdForm(null);
}

function fillAdForm(item) {
  syncCreationControl("ad", "cancelAdCreateButton", "deleteAdButton", Boolean(item));
  setDisabled("deleteAdButton", !item);
  $("adId").value = item?.id || "";
  $("adTitle").value = item?.title || "";
  $("adPlacement").value = item?.placement || "home";
  $("adImageUrl").value = item?.imageUrl || "";
  $("adLinkUrl").value = item?.linkUrl || "";
  $("adActive").checked = item?.active !== false;
  renderAdminImagePreview("adImageUrl", "adImagePreview", "Prévia do anúncio");
}

async function saveAd(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("adId").value || undefined,
      title: $("adTitle").value,
      placement: $("adPlacement").value,
      imageUrl: cleanAdminAssetUrl($("adImageUrl").value),
      linkUrl: $("adLinkUrl").value,
      active: $("adActive").checked
    };
    const existingId = $("adId").value;
    const saved = existingId
      ? await api(`/api/ads/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/ads", { method: "POST", body: JSON.stringify(payload) });
    state.creating.ad = false;
    state.selectedAdId = saved.id;
    await loadContent({ silent: true });
    showSuccess("Anúncio salvo", `${saved.title} foi atualizado.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteAd() {
  const item = currentAd();
  if (!item || !confirm(`Excluir ${item.title}?`)) return;
  try {
    await api(`/api/ads/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedAdId = "";
    await loadContent({ silent: true });
    showToast("Anúncio excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

const ADMIN_PERMISSION_PRESETS = {
  owner: ["dashboard.view", "movies.manage", "rooms.manage", "ticket_types.manage", "box_office.manage", "tickets.validate", "orders.manage", "concessions.manage", "marketing.manage", "club.manage", "fiscal.manage", "integrations.manage", "logs.view", "settings.manage", "media.manage"],
  manager: ["dashboard.view", "movies.manage", "rooms.manage", "ticket_types.manage", "box_office.manage", "tickets.validate", "orders.manage", "concessions.manage", "marketing.manage", "club.manage", "fiscal.manage", "logs.view", "media.manage"],
  operator: ["dashboard.view", "box_office.manage", "tickets.validate", "orders.manage"]
};

function selectedUserPermissions() {
  return [...document.querySelectorAll("#userPermissions input:checked")].map((input) => input.value);
}

function syncUserPermissionEditor(permissions = null) {
  const custom = Boolean($("userUseCustomPermissions")?.checked);
  const role = $("userRole")?.value || "operator";
  const selected = new Set(Array.isArray(permissions) ? permissions : ADMIN_PERMISSION_PRESETS[role] || []);
  document.querySelectorAll("#userPermissions input").forEach((input) => {
    input.checked = selected.has(input.value);
    input.disabled = !custom || role === "owner";
  });
  if ($("userUseCustomPermissions")) {
    $("userUseCustomPermissions").disabled = role === "owner";
    if (role === "owner") $("userUseCustomPermissions").checked = false;
  }
  $("userPermissions")?.classList.toggle("is-readonly", !custom || role === "owner");
}

function renderUsers() {
  const items = (state.content?.users || []).filter((item) => item.role !== "customer");
  if (state.creating.user) {
    $("usersList").innerHTML = creationPlaceholder("Novo usuário", "Cadastre operador, gerente ou dono no quadro à direita.");
    fillUserForm(null);
    return;
  }
  $("usersList").innerHTML = items.length
    ? items.map((item) => `
        <button class="list-item ${item.id === state.selectedUserId ? "active" : ""}" type="button" onclick="selectUser('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.name)}</span>
            <span class="list-meta">${escapeHtml(item.email || "sem email")} • ${escapeHtml(adminRoleLabel(item.role))} • ${item.twoFactorEnabled ? "2FA ativo" : "2FA pendente"}${item.useCustomPermissions ? " • acesso personalizado" : ""}</span>
          </span>
          <span class="badge">${item.active ? "ativo" : "off"}</span>
        </button>
      `).join("")
    : `<div class="empty-state"><strong>Ninguém na equipe</strong><span>Adicione uma conta administrativa para conceder acesso ao painel.</span></div>`;
  fillUserForm(currentUser());
}

function selectUser(id) {
  state.creating.user = false;
  state.selectedUserId = id;
  renderUsers();
}

function newUser() {
  state.creating.user = true;
  state.selectedUserId = "";
  $("usersList").innerHTML = creationPlaceholder("Novo usuário", "Cadastre operador, gerente ou dono no quadro à direita.");
  fillUserForm(null);
}

function fillUserForm(item) {
  syncCreationControl("user", "cancelUserCreateButton", "deleteUserButton", Boolean(item));
  setDisabled("deleteUserButton", !item);
  $("userId").value = item?.id || "";
  $("userName").value = item?.name || "";
  $("userEmail").value = item?.email || "";
  $("userPassword").value = "";
  $("userRole").value = item?.role === "editor" ? "manager" : item?.role || "operator";
  $("userActive").checked = item?.active !== false;
  $("userUseCustomPermissions").checked = Boolean(item?.useCustomPermissions);
  syncUserPermissionEditor(item?.useCustomPermissions ? item.adminPermissions : null);
}

async function saveUser(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("userId").value || undefined,
      name: $("userName").value,
      email: $("userEmail").value,
      password: $("userPassword").value || undefined,
      accountType: "team",
      role: $("userRole").value,
      active: $("userActive").checked,
      useCustomPermissions: $("userUseCustomPermissions").checked,
      adminPermissions: selectedUserPermissions()
    };
    const existingId = $("userId").value;
    const saved = existingId
      ? await api(`/api/users/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
    state.creating.user = false;
    state.selectedUserId = saved.id;
    $("userPassword").value = "";
    await loadContent({ silent: true });
    showSuccess("Usuário salvo", `${saved.name} foi atualizado.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function filteredCustomerAccounts() {
  const query = normalizedSearchText(state.customerAccountsSearch || "");
  const digits = query.replace(/\D/g, "");
  return (state.content?.users || [])
    .filter((item) => item.role === "customer")
    .filter((item) => {
      if (!query) return true;
      return [item.name, item.email].some((value) => normalizedSearchText(value).includes(query))
        || (digits && [item.phone, item.cpf].some((value) => String(value || "").replace(/\D/g, "").includes(digits)));
    });
}

function renderCustomerUsers() {
  if (!$("customerUsersList")) return;
  const items = filteredCustomerAccounts();
  if (state.creating.customerUser) {
    $("customerUsersList").innerHTML = creationPlaceholder("Novo cliente", "Cadastre uma conta comum no formulário ao lado. Ela não terá acesso ao painel.");
    fillCustomerUserForm(null);
    return;
  }
  $("customerUsersList").innerHTML = items.length
    ? items.map((item) => `
        <button class="list-item ${item.id === state.selectedCustomerAccountId ? "active" : ""}" type="button" onclick="selectCustomerAccount('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.name)}</span>
            <span class="list-meta">${escapeHtml(item.email || "sem e-mail")} • ${item.emailVerified ? "e-mail verificado" : "verificação pendente"}</span>
          </span>
          <span class="badge">${item.active ? "ativo" : "off"}</span>
        </button>
      `).join("")
    : `<div class="empty-state"><strong>${state.customerAccountsSearch ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</strong><span>${state.customerAccountsSearch ? "Revise o nome, e-mail, telefone ou CPF pesquisado." : "As contas criadas no site também aparecerão aqui."}</span></div>`;
  fillCustomerUserForm(currentCustomerAccount());
}

function selectCustomerAccount(id) {
  state.creating.customerUser = false;
  state.selectedCustomerAccountId = id;
  renderCustomerUsers();
}

function newCustomerUser() {
  state.creating.customerUser = true;
  state.selectedCustomerAccountId = "";
  renderCustomerUsers();
}

function fillCustomerUserForm(item) {
  syncCreationControl("customerUser", "cancelCustomerUserCreateButton", "deleteCustomerUserButton", Boolean(item));
  setDisabled("deleteCustomerUserButton", !item);
  $("customerUserId").value = item?.id || "";
  $("customerUserName").value = item?.name || "";
  $("customerUserEmail").value = item?.email || "";
  $("customerUserPhone").value = item?.phone || "";
  $("customerUserCpf").value = item?.cpf || "";
  $("customerUserPassword").value = "";
  $("customerUserPassword").required = !item;
  $("customerUserActive").checked = item?.active !== false;
  $("customerAccountStatus").textContent = item
    ? `${item.emailVerified ? "E-mail verificado" : "E-mail ainda não verificado"}. Criada em ${twoFactorDate(item.createdAt || "") || "data não informada"}.`
    : "A nova conta será criada como cliente, sem qualquer permissão administrativa.";
}

async function saveCustomerUser(event) {
  event.preventDefault();
  try {
    const payload = {
      id: $("customerUserId").value || undefined,
      name: $("customerUserName").value,
      email: $("customerUserEmail").value,
      phone: $("customerUserPhone").value,
      cpf: $("customerUserCpf").value,
      password: $("customerUserPassword").value || undefined,
      active: $("customerUserActive").checked,
      accountType: "customer"
    };
    const existingId = $("customerUserId").value;
    const saved = existingId
      ? await api(`/api/users/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
    state.creating.customerUser = false;
    state.selectedCustomerAccountId = saved.id;
    $("customerUserPassword").value = "";
    await loadContent({ silent: true });
    showSuccess("Cliente salvo", `${saved.name} continua com acesso somente ao site e à própria conta.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteCustomerUser() {
  const item = currentCustomerAccount();
  if (!item || !confirm(`Excluir a conta de cliente de ${item.name}?`)) return;
  try {
    await api(`/api/users/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedCustomerAccountId = "";
    await loadContent({ silent: true });
    showToast("Conta de cliente excluída.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function saveAdminSecurityPolicy(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    const result = await api("/api/admin/security-policy", {
      method: "PUT",
      body: JSON.stringify({ adminTwoFactorRequired: $("adminTwoFactorRequired").checked })
    });
    if (state.content?.settings) state.content.settings.adminTwoFactorRequired = result.adminTwoFactorRequired;
    if (state.twoFactorStatus) state.twoFactorStatus.requiredByPolicy = result.adminTwoFactorRequired;
    renderAccountSecuritySummary();
    showSuccess("Política atualizada", result.adminTwoFactorRequired ? "O 2FA agora é obrigatório para todas as contas do painel." : "Cada conta poderá ativar ou desativar o próprio 2FA.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteUser() {
  const item = currentUser();
  if (!item || !confirm(`Excluir ${item.name}?`)) return;
  try {
    await api(`/api/users/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedUserId = "";
    await loadContent({ silent: true });
    showToast("Usuário excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderClub() {
  const plans = [...(state.content?.subscriptionPlans || [])].sort((a, b) => Number(b.displayOrder ?? 100) - Number(a.displayOrder ?? 100));
  const subscriptions = state.content?.subscriptions || [];
  const credits = state.content?.subscriptionCredits || [];
  const usage = state.content?.subscriptionUsage || [];
  if ($("clubOverview")) {
    $("clubOverview").innerHTML = `
      <div class="mini-insight"><span>Planos ativos</span><strong>${plans.filter((plan) => plan.active !== false).length}</strong></div>
      <div class="mini-insight"><span>Assinaturas ativas</span><strong>${subscriptions.filter((item) => item.status === "active").length}</strong></div>
      <div class="mini-insight"><span>Créditos disponíveis</span><strong>${credits.reduce((sum, item) => sum + Number(item.remaining || 0), 0)}</strong></div>
      <div class="mini-insight"><span>Usos registrados</span><strong>${usage.length}</strong></div>
    `;
  }
  if ($("clubPlansList")) {
    $("clubPlansList").innerHTML = state.creating.clubPlan
      ? creationPlaceholder("Novo plano", "Configure nome, créditos, preço e imagem local no quadro à direita.")
      : plans.length
      ? plans.map((plan) => `
          <button class="list-item club-plan-item ${plan.id === state.selectedClubPlanId ? "active" : ""}" type="button" onclick="selectClubPlan('${escapeHtml(plan.id)}')">
            <span class="plan-thumb">${plan.imageUrl ? `<img src="${escapeHtml(adminAssetUrl(plan.imageUrl))}" alt="">` : `<span>Plano</span>`}</span>
            <span class="club-plan-list-copy">
              <span class="list-title">${escapeHtml(plan.name)}</span>
              <span class="list-meta">${Number(plan.includedTickets || 0)} ingresso(s) por mês${plan.isFeatured ? " • Recomendado" : ""}</span>
            </span>
            <span class="club-plan-list-side">
              <span class="badge">${money(plan.monthlyPrice)}</span>
              <span class="club-plan-list-status ${plan.active === false ? "inactive" : ""}"><i></i>${plan.active === false ? "Inativo" : "Ativo"}</span>
              <small>Prioridade ${Number(plan.displayOrder ?? 100)}</small>
            </span>
          </button>
        `).join("")
      : `<div class="empty-state"><strong>Nenhum plano cadastrado</strong><span>Crie planos para vender assinatura recorrente.</span></div>`;
  }
  fillClubPlanForm(currentClubPlan());
  if ($("clubAssignPlan")) {
    $("clubAssignPlan").innerHTML = plans
      .filter((plan) => plan.active !== false)
      .map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} - ${money(plan.monthlyPrice)}</option>`)
      .join("");
  }
  if ($("clubSubscriptionSearch")) {
    $("clubSubscriptionSearch").value = state.clubSubscriptionsSearch || "";
    $("clubSubscriptionSearch").oninput = (event) => filterClubSubscriptions(event.target.value);
  }
  if ($("clubSubscriptionsList")) {
    const users = state.content?.users || [];
    const search = String(state.clubSubscriptionsSearch || "").trim().toLocaleLowerCase("pt-BR");
    const sortedSubscriptions = [...subscriptions]
      .filter((subscription) => {
        if (!search) return true;
        const user = subscription.user || users.find((item) => item.id === subscription.userId) || {};
        const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
        return [user.name, user.email, plan.name, subscription.id]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    const pageSize = state.clubSubscriptionsPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(sortedSubscriptions.length / pageSize));
    state.clubSubscriptionsPage = Math.min(Math.max(1, state.clubSubscriptionsPage || 1), totalPages);
    const start = (state.clubSubscriptionsPage - 1) * pageSize;
    const pageItems = sortedSubscriptions.slice(start, start + pageSize);
    $("clubSubscriptionsList").innerHTML = sortedSubscriptions.length
      ? `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${start + 1}–${Math.min(start + pageItems.length, sortedSubscriptions.length)}</strong> de <strong>${sortedSubscriptions.length}</strong> assinatura(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.clubSubscriptionsPage <= 1 ? "disabled" : ""} onclick="changeClubSubscriptionsPage(-1)">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.clubSubscriptionsPage} de ${totalPages}</span>
            <button class="ghost-button" type="button" ${state.clubSubscriptionsPage >= totalPages ? "disabled" : ""} onclick="changeClubSubscriptionsPage(1)">Próxima →</button>
          </div>
        </div>
        <div class="list">
          ${pageItems.map((subscription) => {
            const user = subscription.user || users.find((item) => item.id === subscription.userId) || {};
            const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
            const credit = credits.find((item) => item.id === subscription.currentCreditId) || credits.find((item) => item.subscriptionId === subscription.id);
            const terminal = ["cancelled", "ended", "cancelled_by_admin"].includes(String(subscription.status || "").toLowerCase());
            const ending = String(subscription.status || "").toLowerCase() === "ending";
            const canReactivate = !subscription.reactivationBlocked
              && !["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())
              && String(subscription.provider || "") === "manual_admin"
              && String(subscription.status || "") === "paused";
            return `
              <div class="list-item static">
                <span class="subscription-identity">
                  <span class="list-title">${escapeHtml(user.name || user.email || "Cliente")}</span>
                  <span class="subscription-email">${escapeHtml(user.email || "E-mail não informado")}</span>
                  <span class="list-meta">${escapeHtml(plan.name || subscription.planId)} • ${clubStatusLabel(subscription.status)} • ${Number(credit?.remaining ?? subscription.creditsAvailable ?? 0)} de ${Number(credit?.total ?? plan.includedTickets ?? 0)} crédito(s)</span>
                  ${ending ? `<span class="subscription-ending-note">Cobrança encerrada; benefícios válidos até ${subscription.benefitsUntil ? new Date(subscription.benefitsUntil).toLocaleDateString("pt-BR") : "o fim do ciclo"}.</span>` : ""}
                </span>
                <span class="table-actions">
                  ${canReactivate ? `<button class="ghost-button" type="button" onclick="updateClubSubscription('${escapeHtml(subscription.id)}','active')">Ativar</button>` : ""}
                  ${!terminal && !ending && subscription.status === "active" ? `<button class="ghost-button" type="button" onclick="updateClubSubscription('${escapeHtml(subscription.id)}','paused')">Pausar</button>` : ""}
                  <button class="ghost-button" type="button" onclick="adjustClubCredit('${escapeHtml(subscription.id)}')">Ajustar crédito</button>
                  ${terminal
                    ? `<button class="danger-button" type="button" onclick="deleteClubSubscription('${escapeHtml(subscription.id)}')">Excluir</button>`
                    : ending ? "" : `<button class="danger-button" type="button" onclick="updateClubSubscription('${escapeHtml(subscription.id)}','cancelled')">Cancelar renovação</button>`}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      `
      : `<div class="empty-state"><strong>${search ? "Nenhuma assinatura encontrada" : "Nenhuma assinatura"}</strong><span>${search ? "Revise o nome, e-mail ou plano informado." : "Atribuições manuais e assinaturas externas aparecerão aqui."}</span></div>`;
  }
  if ($("clubUsageList")) {
    const usagePageSize = state.clubUsagePageSize || 5;
    const totalUsagePages = Math.max(1, Math.ceil(usage.length / usagePageSize));
    state.clubUsagePage = Math.min(Math.max(1, state.clubUsagePage || 1), totalUsagePages);
    const usageStart = (state.clubUsagePage - 1) * usagePageSize;
    const pageUsage = usage.slice(usageStart, usageStart + usagePageSize);

    $("clubUsageList").innerHTML = usage.length
      ? `
        <div class="issued-tickets-pager-bar" style="margin-bottom: var(--sp-8);">
          <span>Exibindo <strong>${usageStart + 1}–${Math.min(usageStart + pageUsage.length, usage.length)}</strong> de <strong>${usage.length}</strong> registro(s)</span>
          <div class="pager-controls">
            <button class="ghost-button" type="button" ${state.clubUsagePage <= 1 ? "disabled" : ""} onclick="changeClubUsagePage(-1)">← Anterior</button>
            <span class="pager-page-indicator">Página ${state.clubUsagePage} de ${totalUsagePages}</span>
            <button class="ghost-button" type="button" ${state.clubUsagePage >= totalUsagePages ? "disabled" : ""} onclick="changeClubUsagePage(1)">Próxima →</button>
          </div>
        </div>
        <div class="orders-table">
          <table>
            <thead><tr><th>Data</th><th>Assinatura</th><th>Pedido</th><th>Ingresso</th><th>Status</th></tr></thead>
            <tbody>
              ${pageUsage.map((item) => `
                <tr>
                  <td data-label="Data">${item.usedAt ? new Date(item.usedAt).toLocaleString("pt-BR") : "-"}</td>
                  <td data-label="Assinatura">${escapeHtml(item.subscriptionId || "-")}</td>
                  <td data-label="Pedido">${escapeHtml(item.orderId || "-")}</td>
                  <td data-label="Ingresso">${escapeHtml(item.ticketId || "-")}</td>
                  <td data-label="Status"><span class="badge ${item.refundedAt ? "muted" : ""}">${item.refundedAt ? "Crédito devolvido" : "Consumido"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div class="empty-state"><strong>Nenhum uso de crédito</strong><span>Os ingressos emitidos pelo Clube aparecerão aqui.</span></div>`;
  }
}

function changeClubSubscriptionsPage(delta) {
  const subscriptions = state.content?.subscriptions || [];
  const search = String(state.clubSubscriptionsSearch || "").trim().toLocaleLowerCase("pt-BR");
  const filtered = subscriptions.filter((subscription) => {
    if (!search) return true;
    const users = state.content?.users || [];
    const plans = state.content?.subscriptionPlans || [];
    const user = subscription.user || users.find((item) => item.id === subscription.userId) || {};
    const plan = subscription.plan || plans.find((item) => item.id === subscription.planId) || {};
    return [user.name, user.email, plan.name, subscription.id]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(search));
  });
  const pageSize = state.clubSubscriptionsPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.clubSubscriptionsPage = Math.min(Math.max(1, (state.clubSubscriptionsPage || 1) + delta), totalPages);
  renderClub();
}

function changeClubUsagePage(delta) {
  const usage = state.content?.subscriptionUsage || [];
  const pageSize = state.clubUsagePageSize || 5;
  const totalPages = Math.max(1, Math.ceil(usage.length / pageSize));
  state.clubUsagePage = Math.min(Math.max(1, (state.clubUsagePage || 1) + delta), totalPages);
  renderClub();
}

function fillClubPlanForm(plan) {
  if (!$("clubPlanForm")) return;
  syncCreationControl("clubPlan", "cancelClubPlanCreateButton", "deleteClubPlanButton", Boolean(plan));
  setDisabled("deleteClubPlanButton", !plan);
  $("clubPlanId").value = plan?.id || "";
  $("clubPlanName").value = plan?.name || "";
  $("clubPlanPrice").value = plan?.monthlyPrice ?? 24.9;
  $("clubPlanTickets").value = plan?.includedTickets ?? 3;
  $("clubPlanTicketDiscount").value = Number(plan?.ticketDiscountPercent || 0);
  $("clubPlanConcessionDiscount").value = Number(plan?.concessionDiscountPercent || 0);
  $("clubPlanImageUrl").value = Object.prototype.hasOwnProperty.call(state.pendingImages, "clubPlanImageUrl")
    ? state.pendingImages.clubPlanImageUrl
    : plan?.imageUrl || "";
  $("clubPlanDisplayOrder").value = plan?.displayOrder ?? 100;
  $("clubPlanFeatured").checked = Boolean(plan?.isFeatured);
  $("clubPlanBenefits").value = (plan?.benefits || []).join("\n");
  $("clubPlanActive").checked = plan?.active !== false;
  if ($("clubPlanEditorTitle")) $("clubPlanEditorTitle").textContent = plan?.name || "Novo plano";
  if ($("clubPlanEditorSubtitle")) {
    $("clubPlanEditorSubtitle").textContent = plan
      ? "Ajuste a oferta publicada sem alterar o histórico das assinaturas existentes."
      : "Preencha a oferta que será exibida na página do Clube.";
  }
  if ($("clubPlanEditorStatusText")) $("clubPlanEditorStatusText").textContent = plan?.active === false ? "Inativo" : "Ativo";
  $("clubPlanForm")?.classList.toggle("is-inactive", plan?.active === false);
  renderClubPlanFreeItems(plan);
  renderAdminImagePreview("clubPlanImageUrl", "clubPlanImagePreview", "Prévia do plano");
}

function renderClubPlanFreeItems(plan) {
  const target = $("clubPlanFreeItems");
  if (!target) return;
  const configured = new Map((plan?.freeConcessionItems || []).map((item) => [String(item.concessionId || item.id), Number(item.quantityPerCycle || item.quantity || 1)]));
  const concessions = (state.content?.concessions || []).filter((item) => item.active !== false);
  target.innerHTML = concessions.length
    ? concessions.map((item) => {
        const quantity = configured.get(String(item.id)) || 1;
        const checked = configured.has(String(item.id));
        return `
          <div class="benefit-product-row">
            <label><input type="checkbox" data-club-free-item="${escapeHtml(item.id)}" ${checked ? "checked" : ""} /> <span>${escapeHtml(item.name)}</span></label>
            <input type="number" min="1" max="20" step="1" value="${quantity}" data-club-free-quantity="${escapeHtml(item.id)}" aria-label="Quantidade grátis por ciclo de ${escapeHtml(item.name)}" />
          </div>`;
      }).join("")
    : `<div class="empty-state"><strong>Sem produtos ativos</strong><span>Cadastre itens na Bomboniere para incluí-los como benefício.</span></div>`;
}

function selectClubPlan(id) {
  delete state.pendingImages.clubPlanImageUrl;
  state.creating.clubPlan = false;
  state.selectedClubPlanId = id;
  renderClub();
}

function newClubPlan() {
  setAdminSubtab("club", "plans");
  delete state.pendingImages.clubPlanImageUrl;
  state.creating.clubPlan = true;
  state.selectedClubPlanId = "";
  $("clubPlansList").innerHTML = creationPlaceholder("Novo plano", "Configure nome, créditos, preço e imagem local no quadro à direita.");
  fillClubPlanForm(null);
}

function changeClubSubscriptionsPage(delta) {
  state.clubSubscriptionsPage = Math.max(1, Number(state.clubSubscriptionsPage || 1) + Number(delta || 0));
  renderClub();
}

function filterClubSubscriptions(value) {
  state.clubSubscriptionsSearch = String(value || "");
  state.clubSubscriptionsPage = 1;
  renderClub();
  const input = $("clubSubscriptionSearch");
  if (input) {
    input.value = state.clubSubscriptionsSearch;
    input.focus();
  }
}

async function saveClubPlan(event) {
  event.preventDefault();
  const existingId = $("clubPlanId").value || state.selectedClubPlanId;
  const requestedImageUrl = cleanAdminAssetUrl($("clubPlanImageUrl").value);
  const payload = {
    id: existingId || undefined,
    name: $("clubPlanName").value,
    monthlyPrice: Number($("clubPlanPrice").value || 0),
    includedTickets: Number($("clubPlanTickets").value || 0),
    ticketDiscountPercent: Number($("clubPlanTicketDiscount").value || 0),
    concessionDiscountPercent: Number($("clubPlanConcessionDiscount").value || 0),
    freeConcessionItems: [...document.querySelectorAll("[data-club-free-item]:checked")].map((input) => ({
      concessionId: input.dataset.clubFreeItem,
      quantityPerCycle: Number(document.querySelector(`[data-club-free-quantity="${CSS.escape(input.dataset.clubFreeItem)}"]`)?.value || 1)
    })),
    imageUrl: requestedImageUrl,
    displayOrder: Number($("clubPlanDisplayOrder").value || 100),
    isFeatured: $("clubPlanFeatured").checked,
    benefits: $("clubPlanBenefits").value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    active: $("clubPlanActive").checked
  };
  try {
    const saved = existingId
      ? await api(`/api/admin/subscription-plans/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/admin/subscription-plans", { method: "POST", body: JSON.stringify(payload) });
    state.creating.clubPlan = false;
    state.selectedClubPlanId = saved.id;
    if (requestedImageUrl && cleanAdminAssetUrl(saved.imageUrl) !== requestedImageUrl) {
      throw new Error("O plano foi salvo, mas a imagem não foi persistida. Envie o arquivo novamente.");
    }
    delete state.pendingImages.clubPlanImageUrl;
    await loadContent({ silent: true });
    showSuccess("Plano salvo", `${saved.name} foi atualizado no Clube Cine Cruzeiro.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteClubPlan() {
  const plan = currentClubPlan();
  if (!plan) return;
  const reason = prompt(`Motivo para excluir ou desativar ${plan.name}:`);
  if (reason === null) return;
  if (!confirm(`Confirmar exclusão/desativação do plano ${plan.name}?`)) return;
  try {
    const result = await api(`/api/admin/subscription-plans/${encodeURIComponent(plan.id)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason })
    });
    state.selectedClubPlanId = "";
    await loadContent({ silent: true });
    showToast(result.deactivated ? "Plano desativado porque possui histórico de assinaturas." : "Plano excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function assignClubSubscription(event) {
  event.preventDefault();
  try {
    await api("/api/admin/subscriptions/assign", {
      method: "POST",
      body: JSON.stringify({
        email: $("clubAssignEmail").value,
        planId: $("clubAssignPlan").value,
        status: "active"
      })
    });
    $("clubAssignEmail").value = "";
    state.clubSubscriptionsPage = 1;
    await loadContent({ silent: true });
    showSuccess("Assinatura atribuída", "O cliente já pode usar os créditos do Clube conforme o status do plano.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function updateClubSubscription(id, status) {
  const reason = status === "cancelled" ? prompt("Motivo do cancelamento:") : "Ajuste pelo painel";
  if (reason === null) return;
  try {
    await api(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason })
    });
    await loadContent({ silent: true });
    showSuccess("Assinatura atualizada", `Status alterado para ${clubStatusLabel(status)}.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteClubSubscription(id) {
  if (!confirm("Excluir esta assinatura cancelada do banco de dados?")) return;
  try {
    await api(`/api/admin/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadContent({ silent: true });
    showSuccess("Assinatura excluída", "A assinatura cancelada foi removida do cadastro do cliente.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function adjustClubCredit(id) {
  const deltaInput = prompt("Informe o ajuste de créditos. Use negativo para remover:");
  if (deltaInput === null) return;
  const delta = Number(deltaInput);
  if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
    showToast("Informe um número inteiro diferente de zero.", "error");
    return;
  }
  const reason = prompt("Motivo obrigatório do ajuste:");
  if (!reason) {
    showToast("Informe o motivo do ajuste.", "error");
    return;
  }
  try {
    await api(`/api/admin/subscriptions/${encodeURIComponent(id)}/credits/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta, reason })
    });
    await loadContent({ silent: true });
    showSuccess("Créditos ajustados", "O saldo do cliente foi atualizado com registro no histórico da assinatura.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function fiscalStatusLabel(status = "") {
  return {
    ready: "Pronta para emitir",
    queued: "Na fila",
    processing: "Processando",
    authorized: "Autorizada",
    pending_configuration: "Configuração pendente",
    pending_customer_data: "Dados do cliente pendentes",
    not_applicable: "Não aplicável",
    error: "Com erro",
    cancelled: "Cancelada"
  }[status] || status || "Pendente";
}

function fiscalDate(value = "") {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

async function loadFiscalDocuments(options = {}) {
  state.fiscalPage = Math.max(1, Number(options.page || state.fiscalPage || 1));
  const params = new URLSearchParams({ page: String(state.fiscalPage), pageSize: "25" });
  Object.entries(state.fiscalFilters || {}).forEach(([key, value]) => value && params.set(key, value));
  if ($("fiscalDocumentsList")) $("fiscalDocumentsList").innerHTML = `<tr><td colspan="6"><div class="skeleton-card compact"></div></td></tr>`;
  try {
    state.fiscal = await api(`/api/admin/fiscal-documents?${params.toString()}`);
    renderFiscalDocuments();
  } catch (error) {
    if ($("fiscalDocumentsList")) $("fiscalDocumentsList").innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>Não foi possível carregar as notas</strong><span>${escapeHtml(error.message)}</span></div></td></tr>`;
    showToast(error.message, "error");
  }
}

function renderFiscalDocuments() {
  const data = state.fiscal || {};
  const summary = data.summary || {};
  if ($("fiscalStats")) {
    $("fiscalStats").innerHTML = [
      ["Autorizadas", summary.authorized || 0, money(summary.authorizedAmount || 0)],
      ["Processando", summary.processing || 0, "Emissão ou consulta"],
      ["Pendentes", summary.pending || 0, "Configuração ou dados"],
      ["Com erro", summary.errors || 0, "Exigem revisão"],
      ["E-mails pendentes", summary.emailPending || 0, "Notas autorizadas"]
    ].map(([label, value, hint]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></div>`).join("");
  }
  if ($("fiscalOrderSelect")) {
    const current = $("fiscalOrderSelect").value;
    $("fiscalOrderSelect").innerHTML = `<option value="">Selecione um pedido</option>${(data.availableOrders || []).map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.reference)} • ${escapeHtml(order.customerName)} • ${money(order.totalPrice)}</option>`).join("")}`;
    if ([...$("fiscalOrderSelect").options].some((option) => option.value === current)) $("fiscalOrderSelect").value = current;
  }
  const config = data.configuration || {};
  if ($("fiscalConfigurationNotice")) {
    const ready = Boolean(config.enabled && config.configured);
    $("fiscalConfigurationNotice").hidden = ready;
    $("fiscalConfigurationNotice").innerHTML = ready ? "" : `<strong>Emissão ainda não configurada</strong><span>Cadastre Focus NFe, CNPJ, inscrição municipal e códigos tributários em Integrações. Os pedidos continuam registrados para emissão posterior.</span>${isOwnerAdmin() ? `<button class="ghost-button" type="button" onclick="openFiscalIntegration()">Abrir Integrações</button>` : ""}`;
  }
  const documents = data.documents || [];
  if ($("fiscalDocumentsList")) {
    $("fiscalDocumentsList").innerHTML = documents.length ? documents.map((document) => {
      const canIssue = ["ready", "queued", "pending_configuration", "pending_customer_data", "error"].includes(document.status);
      const authorized = document.status === "authorized";
      return `<tr>
        <td><strong>${escapeHtml(document.invoiceNumber || document.reference)}</strong><span>${escapeHtml(document.orderId)}<br>${fiscalDate(document.createdAt)}</span></td>
        <td><strong>${escapeHtml(document.customerName || "Cliente")}</strong><span>${escapeHtml(document.customerEmail || "Sem e-mail")}<br>${escapeHtml(document.customerTaxId || "CPF/CNPJ pendente")}</span></td>
        <td><strong>${money(document.serviceAmount || 0)}</strong><span>Pedido ${money(document.amount || 0)}${Number(document.concessionAmount || 0) ? ` • Bomboniere ${money(document.concessionAmount)}` : ""}</span></td>
        <td><span class="fiscal-status ${escapeHtml(document.status)}">${escapeHtml(fiscalStatusLabel(document.status))}</span>${document.lastError ? `<small title="${escapeHtml(document.lastError)}">${escapeHtml(document.lastError)}</small>` : `<small>${escapeHtml(document.providerStatus || "")}</small>`}</td>
        <td><strong>${document.emailStatus === "sent" ? "Enviada" : document.emailStatus === "error" ? "Falhou" : "Pendente"}</strong><span>${fiscalDate(document.emailSentAt)}</span></td>
        <td><div class="fiscal-actions">
          ${canIssue ? `<button class="primary-button" type="button" onclick="fiscalAction('${escapeHtml(document.id)}','issue')">Emitir</button>` : ""}
          ${["processing", "authorized", "error"].includes(document.status) ? `<button class="ghost-button" type="button" onclick="fiscalAction('${escapeHtml(document.id)}','sync')">Sincronizar</button>` : ""}
          ${authorized ? `<button class="ghost-button" type="button" onclick="downloadFiscal('${escapeHtml(document.id)}','pdf')">PDF</button><button class="ghost-button" type="button" onclick="downloadFiscal('${escapeHtml(document.id)}','xml')">XML</button><button class="ghost-button" type="button" onclick="fiscalAction('${escapeHtml(document.id)}','send-email')">Enviar e-mail</button>` : ""}
        </div></td>
      </tr>`;
    }).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>Nenhuma nota fiscal encontrada</strong><span>Prepare uma nota a partir de um pedido pago ou ajuste os filtros.</span></div></td></tr>`;
  }
  if ($("fiscalPagination")) {
    $("fiscalPagination").innerHTML = `<button class="ghost-button" type="button" data-fiscal-page="${Math.max(1, Number(data.page || 1) - 1)}" ${Number(data.page || 1) <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${Number(data.page || 1)} de ${Number(data.pages || 1)}</span><button class="ghost-button" type="button" data-fiscal-page="${Math.min(Number(data.pages || 1), Number(data.page || 1) + 1)}" ${Number(data.page || 1) >= Number(data.pages || 1) ? "disabled" : ""}>Próxima</button>`;
    $("fiscalPagination").querySelectorAll("[data-fiscal-page]").forEach((button) => button.addEventListener("click", () => loadFiscalDocuments({ page: Number(button.dataset.fiscalPage) })));
  }
}

async function createFiscalDocument() {
  const orderId = $("fiscalOrderSelect")?.value || "";
  if (!orderId) return showToast("Selecione um pedido pago.", "error");
  setDisabled("fiscalCreateButton", true);
  try {
    await api("/api/admin/fiscal-documents", { method: "POST", body: JSON.stringify({ orderId }) });
    await loadFiscalDocuments({ page: 1 });
    showSuccess("Nota preparada", "O pedido foi vinculado ao controle fiscal. Revise os dados e emita quando estiver pronto.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setDisabled("fiscalCreateButton", false);
  }
}

async function fiscalAction(id, action) {
  try {
    const result = await api(`/api/admin/fiscal-documents/${encodeURIComponent(id)}/${action}`, { method: "POST" });
    await loadFiscalDocuments();
    showSuccess(action === "send-email" ? "Nota enviada" : action === "sync" ? "Nota sincronizada" : "Emissão atualizada", result.message || (result.document ? fiscalStatusLabel(result.document.status) : "A ação fiscal foi concluída."));
  } catch (error) {
    showToast(error.message, "error");
    await loadFiscalDocuments();
  }
}

function downloadFiscal(id, format) {
  window.open(`${API_BASE}/api/admin/fiscal-documents/${encodeURIComponent(id)}/download?format=${encodeURIComponent(format)}`, "_blank", "noopener");
}

function fiscalReportQuery() {
  const params = new URLSearchParams();
  if (state.fiscalFilters.from || state.fiscalFilters.to) params.set("period", "custom");
  if (state.fiscalFilters.from) params.set("from", state.fiscalFilters.from);
  if (state.fiscalFilters.to) params.set("to", state.fiscalFilters.to);
  return params.toString();
}

function openFiscalIntegration() {
  activatePanel("integrationsPanel", { scroll: true });
  setTimeout(() => openIntegrationConfig("fiscal"), 80);
}

function renderIntegrations() {
  if (!$("integrationsList")) return;
  const entries = Object.entries(state.integrations?.integrations || {});
  $("integrationsList").innerHTML = entries.length
    ? entries.map(([key, item]) => `
        <div class="integration-item">
          <div class="integration-main">
            <div class="integration-title-row">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="integration-category">${escapeHtml(integrationCategory(key))}</span>
            </div>
            <span>${escapeHtml(item.purpose || "")}</span>
            <div class="integration-meta">
              <span class="badge ${item.enabled ? "" : "muted"}">${item.enabled ? "Ativa" : "Desativada"}</span>
              <span class="integration-status ${escapeHtml(item.status || "pending")}">${integrationStatusLabel(item)}</span>
              ${item.lastTestAt ? `<span>Último teste: ${escapeHtml(new Date(item.lastTestAt).toLocaleString("pt-BR"))}</span>` : ""}
            </div>
          </div>
          <div class="integration-actions">
            <button class="ghost-button" type="button" onclick="openIntegrationConfig('${escapeHtml(key)}')">Configurar</button>
            <button class="ghost-button" type="button" onclick="testIntegration('${escapeHtml(key)}')">Testar</button>
            <button class="${item.enabled ? "danger-button" : "primary-button"}" type="button" onclick="toggleIntegration('${escapeHtml(key)}', ${item.enabled ? "false" : "true"})">${item.enabled ? "Desativar" : "Ativar"}</button>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state"><strong>Acesso restrito</strong><span>Somente o proprietário pode ver integrações.</span></div>`;
}

function integrationCategory(key) {
  return {
    mercadoPago: "Pagamentos",
    googleLogin: "Login",
    googleWallet: "Carteira digital",
    tmdb: "Catálogo",
    email: "E-mail",
    fiscal: "Fiscal",
    analytics: "Medição",
    crm: "CRM"
  }[key] || "Integração";
}

function integrationStatusLabel(item) {
  if (item.enabled && item.configured) return "Operacional";
  if (item.configured) return "Configurada";
  return "Pendente";
}

function integrationSecurityHint(field, integration) {
  if (!field.secret) return "";
  const secret = integration.secrets?.[field.key];
  return secret?.hasValue
    ? `<small class="integration-field-hint">Valor salvo com segurança: ${escapeHtml(secret.masked)}. Preencha somente para substituir.</small>`
    : `<small class="integration-field-hint">Campo sensível. O valor será criptografado e ocultado após salvar.</small>`;
}

function integrationDiagnosticsMarkup(checks = [], diagnostics = {}) {
  const items = Array.isArray(checks) ? checks : [];
  const summary = diagnostics && Object.keys(diagnostics).length
    ? `
      <dl class="integration-diagnostics-meta">
        ${diagnostics.issuerId ? `<div><dt>Issuer</dt><dd>${escapeHtml(diagnostics.issuerId)}</dd></div>` : ""}
        ${diagnostics.classId ? `<div><dt>Class ID</dt><dd>${escapeHtml(diagnostics.classId)}</dd></div>` : ""}
        ${diagnostics.clientEmail ? `<div><dt>Service Account</dt><dd>${escapeHtml(diagnostics.clientEmail)}</dd></div>` : ""}
        ${diagnostics.passType ? `<div><dt>Tipo</dt><dd>${escapeHtml(diagnostics.passType)}</dd></div>` : ""}
        ${diagnostics.reviewStatus ? `<div><dt>Status Google</dt><dd>${escapeHtml(diagnostics.reviewStatus)}</dd></div>` : ""}
      </dl>
    `
    : "";
  return `
    <div class="integration-diagnostics">
      <strong>Diagnóstico</strong>
      ${items.length ? `
        <ol>
          ${items.map((item) => `
            <li class="${item.ok ? "ok" : "error"}">
              <span aria-hidden="true"></span>
              <div><b>${escapeHtml(item.label || item.key || "Verificação")}</b>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</div>
            </li>
          `).join("")}
        </ol>
      ` : `<p>Execute um teste para validar credenciais, Issuer e classe.</p>`}
      ${summary}
      ${diagnostics.demoModeNotice ? `<p class="integration-demo-note">${escapeHtml(diagnostics.demoModeNotice)}</p>` : ""}
    </div>
  `;
}

function renderIntegrationContext(integration, testResult = null) {
  const values = integration.values || {};
  return `
    <div class="integration-context-status">
      <span class="integration-status ${escapeHtml(integration.status || "pending")}">${integrationStatusLabel(integration)}</span>
      <strong>${integration.enabled ? "Ativa no sistema" : "Desativada"}</strong>
      <p>${integration.configured ? "Credenciais mínimas configuradas." : "Preencha os campos obrigatórios para usar esta integração."}</p>
    </div>
    <dl class="integration-context-list">
      <div>
        <dt>Área</dt>
        <dd>${escapeHtml(integrationCategory(integration.key))}</dd>
      </div>
      <div>
        <dt>Ambiente</dt>
        <dd>${escapeHtml(integration.environment === "sandbox" ? "Sandbox" : "Produção")}</dd>
      </div>
      ${integration.key === "googleWallet" ? `
        <div>
          <dt>Service Account</dt>
          <dd>${values.clientEmail ? escapeHtml(values.clientEmail) : "Não importada"}</dd>
        </div>
        <div>
          <dt>Credencial</dt>
          <dd>${values.serviceAccountConfigured ? "JSON salvo com segurança" : "Pendente"}</dd>
        </div>
      ` : ""}
      <div>
        <dt>Último teste</dt>
        <dd>${integration.lastTestAt ? escapeHtml(new Date(integration.lastTestAt).toLocaleString("pt-BR")) : "Ainda não testada"}</dd>
      </div>
      <div>
        <dt>Resultado</dt>
        <dd>${escapeHtml(testResult?.message || integration.lastTestMessage || "Sem mensagem registrada")}</dd>
      </div>
    </dl>
    ${integration.key === "googleWallet" ? integrationDiagnosticsMarkup(testResult?.checks, testResult?.diagnostics) : ""}
  `;
}

function integrationFieldInput(field, integration) {
  const value = integration.values?.[field.key] ?? "";
  if (field.type === "boolean") {
    return `
      <label class="check-field ${field.full ? "full" : ""}">
        <input type="checkbox" data-integration-field="${escapeHtml(field.key)}" data-integration-original="${value ? "true" : "false"}" ${value ? "checked" : ""} />
        <span>${escapeHtml(field.label)}</span>
      </label>
    `;
  }
  if (field.type === "select") {
    return `
      <label>
        ${escapeHtml(field.label)}
        <select data-integration-field="${escapeHtml(field.key)}" data-integration-original="${escapeHtml(String(value))}">
          ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option === "production" ? "Produção" : option === "sandbox" ? "Sandbox" : option)}</option>`).join("")}
        </select>
      </label>
    `;
  }
  const secret = integration.secrets?.[field.key];
  const placeholders = {
    publicKey: "Ex.: APP_USR-...",
    accessToken: "Cole o token de acesso",
    webhookSecret: "Cole o segredo do webhook",
    pointStoreId: "Ex.: STORE123",
    pointPosId: "Ex.: POS001",
    pointDeviceId: "Ex.: DEVICE001",
    clientId: "Ex.: 000000000000-abc.apps.googleusercontent.com",
    clientSecret: "Cole o segredo do cliente",
    redirectUri: "Ex.: https://seusite.com/api/auth/google/callback",
    issuerId: "Ex.: 3388000000020000000",
    classId: "Ex.: emissor.classe_ingresso",
    serviceAccountJson: "Cole o JSON completo da Service Account",
    origins: "Ex.: https://seusite.com",
    apiKey: "Cole a chave da API",
    bearerToken: "Cole o bearer token",
    fromEmail: "Ex.: ingressos@seusite.com",
    fromName: "Ex.: Cine Cruzeiro",
    replyTo: "Ex.: atendimento@seusite.com",
    notificationEmail: "Ex.: contato@seusite.com",
    smtpHost: "Ex.: smtp.seuprovedor.com",
    smtpPort: "Ex.: 587",
    smtpUser: "Ex.: ingressos@seusite.com",
    smtpPassword: "Cole a senha SMTP",
    webhookUrl: "Ex.: https://api.seusite.com/webhook",
    googleMeasurementId: "Ex.: G-XXXXXXXXXX",
    metaPixelId: "Ex.: 123456789012345",
    url: "Ex.: https://crm.seusite.com/webhook",
    secret: "Cole o segredo de assinatura",
    events: "Ex.: order.created,payment.approved",
    timeout: "Ex.: 8000",
    retryLimit: "Ex.: 2"
  };
  const placeholder = field.secret && secret?.hasValue ? "Valor já salvo; preencha apenas para substituir" : field.placeholder || placeholders[field.key] || "";
  const common = `data-integration-field="${escapeHtml(field.key)}" data-integration-original="${field.secret ? "" : escapeHtml(String(value))}" ${field.secret ? `data-secret="true" autocomplete="off" spellcheck="false"` : ""} placeholder="${escapeHtml(placeholder)}"`;
  const labelClass = field.multiline ? "full" : "";
  if (field.multiline) {
    return `
      <label class="${labelClass} integration-field ${field.secret ? "secret-field" : ""}">
        ${escapeHtml(field.label)}
        <textarea rows="${field.key === "serviceAccountJson" ? "7" : "4"}" ${common}></textarea>
        ${integrationSecurityHint(field, integration)}
      </label>
    `;
  }
  return `
    <label class="integration-field ${field.secret ? "secret-field" : ""}">
      ${escapeHtml(field.label)}
      <input type="${field.secret ? "password" : escapeHtml(field.type || "text")}" value="${field.secret ? "" : escapeHtml(value)}" ${common} />
      ${integrationSecurityHint(field, integration)}
    </label>
  `;
}

function webhookStep(label, stateValue, detail) {
  const stateClass = stateValue === "ok" ? "ok" : stateValue === "error" ? "error" : "muted";
  return `
    <li class="webhook-step ${stateClass}">
      <span class="webhook-step-mark" aria-hidden="true"></span>
      <span><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span>
    </li>
  `;
}

function renderWebhookRun(run) {
  const target = $("webhookTestResult");
  if (!target) return;
  if (!run) {
    target.innerHTML = `<div class="empty-state compact"><strong>Nenhum teste executado</strong><span>Simule uma notificação para acompanhar cada etapa do fluxo.</span></div>`;
    return;
  }
  const request = run.request || {};
  const processing = run.processing || {};
  const signatureRejectedAsExpected = run.expectedStatus === 401 && run.httpStatus === 401;
  const signatureState = run.signatureValid || signatureRejectedAsExpected ? "ok" : "error";
  const recognizedState = run.httpStatus === 401 ? "muted" : processing.recognized === false ? (run.scenario === "unknown_event" ? "ok" : "error") : "ok";
  const orderState = processing.orderLocated === true ? "ok" : processing.orderLocated === false ? (run.scenario === "resource_not_found" || run.scenario === "unknown_event" ? "ok" : "muted") : "muted";
  const stateUpdated = processing.stateUpdated === true ? "ok" : run.duplicate || run.expectedStatus !== 200 || run.scenario === "resource_not_found" || run.scenario === "unknown_event" ? "ok" : "muted";
  target.innerHTML = `
    <div class="webhook-result-head">
      <div>
        <span class="webhook-http ${run.passed ? "ok" : "error"}">HTTP ${escapeHtml(run.httpStatus || "sem resposta")}</span>
        <strong>${run.passed ? "Comportamento confirmado" : "Teste requer atenção"}</strong>
      </div>
      <span>${escapeHtml(`${Number(run.elapsedMs || 0)} ms`)}</span>
    </div>
    <dl class="webhook-result-meta">
      <div><dt>Evento</dt><dd>${escapeHtml(run.action || "")}</dd></div>
      <div><dt>Resource ID</dt><dd>${escapeHtml(run.resourceId || "")}</dd></div>
      <div><dt>Referência</dt><dd>${escapeHtml(run.externalReference || "")}</dd></div>
      <div><dt>Request ID</dt><dd>${escapeHtml(run.requestId || "")}</dd></div>
    </dl>
    <ol class="webhook-steps">
      ${webhookStep("Webhook recebido", run.httpStatus ? "ok" : "error", run.httpStatus ? `Resposta HTTP ${run.httpStatus}` : "Sem resposta do endpoint")}
      ${webhookStep("Headers obrigatórios", request.signaturePresent && request.requestIdPresent ? "ok" : run.expectedStatus === 401 ? "ok" : "error", `x-signature ${request.signaturePresent ? "presente" : "ausente"}; x-request-id ${request.requestIdPresent ? "presente" : "ausente"}`)}
      ${webhookStep("data.id da query", request.dataIdPresent ? "ok" : run.expectedStatus === 401 ? "ok" : "error", request.dataIdPresent ? "Parâmetro encontrado" : "Parâmetro ausente")}
      ${webhookStep("Validação da assinatura", signatureState, run.signatureValid ? "HMAC validado" : signatureRejectedAsExpected ? "Rejeição esperada confirmada" : "Assinatura não validada")}
      ${webhookStep("Evento interpretado", recognizedState, processing.recognized === false ? "Evento desconhecido aceito sem alteração" : run.httpStatus === 401 ? "Não processado após rejeição" : "Evento reconhecido")}
      ${webhookStep("Pedido localizado", orderState, processing.orderLocated === true ? "Pedido de teste encontrado" : processing.orderLocated === false ? "Nenhum pedido correspondente" : "Etapa não aplicável")}
      ${webhookStep("Estado e idempotência", stateUpdated, run.duplicate ? "Reenvio detectado sem duplicação" : processing.stateUpdated ? `Estado atualizado para ${processing.status || "novo status"}` : "Nenhuma duplicação ou alteração indevida")}
    </ol>
    <div class="webhook-result-message">${escapeHtml(run.result || "")}</div>
  `;
}

function renderWebhookHistory() {
  const target = $("webhookTestHistory");
  if (!target) return;
  const runs = state.webhookSimulatorRuns || [];
  $("webhookHistoryCount").textContent = runs.length ? `${runs.length} registro${runs.length === 1 ? "" : "s"}` : "Nenhum teste";
  target.innerHTML = runs.length ? runs.map((run) => `
    <div class="webhook-history-row ${state.selectedWebhookRunId === run.id ? "selected" : ""}">
      <button type="button" class="webhook-history-main" onclick="showWebhookRun('${escapeHtml(run.id)}')">
        <span>${escapeHtml(new Date(run.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}</span>
        <strong>${escapeHtml(run.action || "Evento")}</strong>
        <span class="truncate">${escapeHtml(run.resourceId || "")}</span>
        <span class="webhook-http ${run.passed ? "ok" : "error"}">${escapeHtml(String(run.httpStatus || "--"))}</span>
        <span>${escapeHtml(run.passed ? "Aprovado" : "Falhou")}</span>
      </button>
      <button class="ghost-button webhook-resend" type="button" onclick="resendWebhookRun('${escapeHtml(run.id)}')">Reenviar</button>
    </div>
  `).join("") : `<div class="empty-state compact"><strong>Console vazio</strong><span>Os testes recentes aparecerão aqui.</span></div>`;
}

function showWebhookRun(id) {
  const run = state.webhookSimulatorRuns.find((item) => item.id === id);
  if (!run) return;
  state.selectedWebhookRunId = id;
  renderWebhookRun(run);
  renderWebhookHistory();
}

async function loadWebhookSimulator() {
  const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations");
  state.webhookSimulatorRuns = data.runs || [];
  renderWebhookHistory();
  renderWebhookRun(state.webhookSimulatorRuns.find((item) => item.id === state.selectedWebhookRunId) || state.webhookSimulatorRuns[0]);
}

function webhookSimulationPayload() {
  return {
    action: $("webhookTestAction").value,
    status: $("webhookTestStatus").value,
    resourceId: $("webhookTestResourceId").value.trim(),
    externalReference: $("webhookTestExternalReference").value.trim(),
    amount: Number($("webhookTestAmount").value || 10),
    scenario: $("webhookTestScenario").value
  };
}

async function simulateWebhook() {
  const button = $("webhookSimulateButton");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Simulando...";
  try {
    const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations", {
      method: "POST",
      body: JSON.stringify(webhookSimulationPayload())
    });
    state.webhookSimulatorRuns.unshift(data.run);
    state.webhookSimulatorRuns = state.webhookSimulatorRuns.slice(0, 60);
    state.selectedWebhookRunId = data.run.id;
    renderWebhookRun(data.run);
    renderWebhookHistory();
    showToast(data.run.passed ? "Webhook testado com o comportamento esperado." : "O teste encontrou uma divergência.", data.run.passed ? "ok" : "error");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function runWebhookBatch() {
  const button = $("webhookBatchButton");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Executando 8 testes...";
  try {
    const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations/batch", { method: "POST" });
    await loadWebhookSimulator();
    const failed = Number(data.failed || 0);
    showSuccess("Bateria de Webhooks concluída", `${data.total} testes executados, ${data.passed} aprovados e ${failed} ${failed === 1 ? "falhou" : "falharam"}.`);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function resendWebhookRun(id) {
  try {
    const data = await api(`/api/admin/integrations/mercadoPago/webhook-simulations/${encodeURIComponent(id)}/resend`, { method: "POST" });
    state.webhookSimulatorRuns.unshift(data.run);
    state.webhookSimulatorRuns = state.webhookSimulatorRuns.slice(0, 60);
    state.selectedWebhookRunId = data.run.id;
    renderWebhookRun(data.run);
    renderWebhookHistory();
    showToast(data.run.duplicate ? "Idempotência confirmada: nenhuma duplicação." : "Webhook reenviado.", data.run.passed ? "ok" : "error");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function openIntegrationConfig(key) {
  try {
    const data = await api(`/api/admin/integrations/${encodeURIComponent(key)}`);
    const integration = data.integration;
    state.selectedIntegrationKey = integration.key;
    $("integrationTitle").textContent = integration.name;
    $("integrationSubtitle").textContent = integration.purpose || "Configure o provider selecionado.";
    $("integrationFields").innerHTML = (integration.fields || []).map((field) => integrationFieldInput(field, integration)).join("");
    if ($("integrationContext")) {
      $("integrationContext").innerHTML = renderIntegrationContext(integration);
    }
    $("integrationDisableButton").textContent = integration.enabled ? "Desativar" : "Ativar";
    $("integrationDisableButton").className = integration.enabled ? "danger-button" : "ghost-button";
    $("integrationTestButton").textContent = "Testar conexão";
    const webhookPanel = $("webhookTesterPanel");
    webhookPanel.hidden = integration.key !== "mercadoPago";
    $("integrationOverlay").hidden = false;
    if (integration.key === "mercadoPago") await loadWebhookSimulator();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function closeIntegrationConfig() {
  state.selectedIntegrationKey = "";
  if ($("integrationOverlay")) $("integrationOverlay").hidden = true;
}

function collectIntegrationForm() {
  const payload = {};
  $("integrationForm").querySelectorAll("[data-integration-field]").forEach((input) => {
    const key = input.dataset.integrationField;
    if (!key) return;
    if (input.type === "checkbox") {
      if (String(input.checked) === input.dataset.integrationOriginal) return;
      payload[key] = input.checked;
      return;
    }
    const value = input.value || "";
    if (input.dataset.secret === "true" && !value.trim()) return;
    if (input.dataset.secret !== "true" && value === (input.dataset.integrationOriginal || "")) return;
    payload[key] = value;
  });
  return payload;
}

async function saveIntegration(event) {
  event.preventDefault();
  const key = state.selectedIntegrationKey;
  if (!key) return;
  try {
    const data = await api(`/api/admin/integrations/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify(collectIntegrationForm())
    });
    state.integrations.integrations[key] = data.integration;
    renderIntegrations();
    closeIntegrationConfig();
    showToast("Integração salva com segurança.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function testIntegration(key) {
  try {
    const result = await api(`/api/admin/integrations/${encodeURIComponent(key)}/test`, { method: "POST" });
    if (state.integrations?.integrations && result.integration) state.integrations.integrations[key] = result.integration;
    renderIntegrations();
    if (state.selectedIntegrationKey === key && $("integrationContext") && result.integration) {
      $("integrationContext").innerHTML = renderIntegrationContext(result.integration, result);
    }
    showToast(result.message || "Integração testada.", result.ok ? "ok" : "error");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function toggleIntegration(key, enabled) {
  try {
    const result = await api(`/api/admin/integrations/${encodeURIComponent(key)}/${enabled ? "enable" : "disable"}`, { method: "POST" });
    if (state.integrations?.integrations) state.integrations.integrations[key] = result.integration;
    renderIntegrations();
    showToast(enabled ? "Integração ativada." : "Integração desativada.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function applyRbacVisibility() {
  const role = state.adminUser?.role || "";
  const owner = ["owner", "master"].includes(role);
  const permissions = new Set(state.adminUser?.effectivePermissions || ADMIN_PERMISSION_PRESETS[role] || []);
  const has = (permission) => owner || permissions.has(permission);
  const allowedPanels = new Set([
    has("dashboard.view") && "dashboardPanel",
    has("movies.manage") && "moviesPanel",
    has("rooms.manage") && "roomsPanel",
    (has("ticket_types.manage") || has("orders.manage")) && "ticketsPanel",
    (has("box_office.manage") || has("orders.manage") || has("tickets.validate") || has("dashboard.view")) && "ordersPanel",
    has("fiscal.manage") && "fiscalPanel",
    has("concessions.manage") && "concessionsPanel",
    has("marketing.manage") && "marketingPanel",
    has("club.manage") && "clubPanel",
    "usersPanel",
    has("integrations.manage") && "integrationsPanel",
    has("logs.view") && "logsPanel"
  ].filter(Boolean));
  document.querySelectorAll(".nav-button[data-panel]").forEach((button) => {
    button.hidden = !allowedPanels.has(button.dataset.panel);
  });
  document.querySelectorAll("[data-owner-only='true']").forEach((element) => {
    if (element.classList.contains("nav-button")) return;
    if (element.matches("[data-admin-tab-panel]")) {
      const [group, tab] = String(element.dataset.adminTabPanel || "").split(":");
      element.hidden = !owner || state.adminSubtabs[group] !== tab;
      return;
    }
    element.hidden = !owner;
  });
  const teamTab = document.querySelector('[data-admin-tablist="accounts"] [data-admin-tab="team"]');
  if (teamTab) teamTab.hidden = !owner;
  if (!owner && state.adminSubtabs.accounts !== "security") setAdminSubtab("accounts", "security");
  document.querySelectorAll("[data-permission]").forEach((element) => {
    element.hidden = !has(element.dataset.permission);
  });
  const activeBoxOfficeTab = document.querySelector("[data-box-office-tab].active");
  if (activeBoxOfficeTab?.hidden) {
    const firstAvailableTab = [...document.querySelectorAll(".box-office-tabs [data-box-office-tab]")].find((button) => !button.hidden);
    if (firstAvailableTab) setBoxOfficeTab(firstAvailableTab.dataset.boxOfficeTab);
  }
  const active = document.querySelector(".panel.active")?.id;
  if (active && !allowedPanels.has(active)) activatePanel(allowedPanels.has("dashboardPanel") ? "dashboardPanel" : "ordersPanel", { scroll: false });
}

function bindEvents() {
  bindAdminSubtabs();
  enhanceImageUploads();
  enhanceLongForms();
  const storedPanel = window.location.hash?.replace("#", "") || localStorage.getItem("cine_admin_panel") || "dashboardPanel";
  activatePanel(storedPanel, { scroll: false });
  document.body.classList.remove("admin-booting");
  setupResponsiveSelects();

  $("fiscalRefreshButton")?.addEventListener("click", () => loadFiscalDocuments());
  $("fiscalCreateButton")?.addEventListener("click", createFiscalDocument);
  $("fiscalExportButton")?.addEventListener("click", () => window.open(`${API_BASE}/api/admin/fiscal-reports.csv?${fiscalReportQuery()}`, "_blank", "noopener"));
  $("dashboardReportButton")?.addEventListener("click", () => window.open(`${API_BASE}/api/admin/reports/dashboard.csv?${dashboardQuery()}`, "_blank", "noopener"));
  [["fiscalStatusFilter", "status"], ["fiscalFrom", "from"], ["fiscalTo", "to"]].forEach(([id, key]) => {
    $(id)?.addEventListener("change", () => {
      state.fiscalFilters[key] = $(id).value;
      state.fiscalPage = 1;
      void loadFiscalDocuments({ page: 1 });
    });
  });
  $("fiscalSearch")?.addEventListener("input", () => {
    clearTimeout(state.fiscalSearchTimer);
    state.fiscalSearchTimer = setTimeout(() => {
      state.fiscalFilters.search = $("fiscalSearch").value.trim();
      state.fiscalPage = 1;
      void loadFiscalDocuments({ page: 1 });
    }, 280);
  });

  document.addEventListener("click", (event) => {
    const floating = $("floatingActionMenu");
    if (floating && !floating.hidden && !floating.contains(event.target)) closeFloatingActionMenu();
    if (!event.target.closest?.(".admin-profile")) closeAdminProfileMenu();
    if (!event.target.closest?.(".responsive-select")) closeResponsiveSelects();
    if (!event.target.closest?.(".context-menu")) {
      document.querySelectorAll(".context-menu-popover").forEach((menu) => {
        menu.hidden = true;
      });
    }
    document.querySelectorAll(".movie-row.drag-over").forEach((row) => row.classList.remove("drag-over"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeFloatingActionMenu();
      closeAdminProfileMenu();
      closeAdminDrawer();
      closeIntegrationConfig();
      if (!$("twoFactorOverlay")?.hidden) closeTwoFactorSettings();
      closeResponsiveSelects();
      document.querySelectorAll(".context-menu-popover").forEach((menu) => {
        menu.hidden = true;
      });
    }
  });

  $("adminMenuButton").addEventListener("click", () => toggleAdminDrawer());
  $("adminDrawerBackdrop").addEventListener("click", closeAdminDrawer);
  $("adminProfileButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAdminProfileMenu();
  });
  $("accountTwoFactorButton")?.addEventListener("click", () => void openTwoFactorSettings());
  $("adminSecurityPolicyForm")?.addEventListener("submit", saveAdminSecurityPolicy);
  $("profileLogoutButton")?.addEventListener("click", logoutAdmin);
  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.profileAction === "account") {
        closeAdminProfileMenu();
        activatePanel("usersPanel", { scroll: true });
        setAdminSubtab("accounts", "security", { focus: true });
        return;
      }
      closeAdminProfileMenu();
      showToast("Preferências adicionais estarão disponíveis em breve.");
    });
  });
  document.querySelectorAll("[data-validation-mode]").forEach((button) => {
    button.addEventListener("click", () => setTicketValidationMode(button.dataset.validationMode));
  });
  $("twoFactorCloseButton")?.addEventListener("click", closeTwoFactorSettings);
  $("twoFactorOverlay")?.addEventListener("click", (event) => {
    if (event.target === $("twoFactorOverlay")) closeTwoFactorSettings();
  });
  $("twoFactorBody")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector("button[type='submit']");
    const values = Object.fromEntries(new FormData(form).entries());
    if (submitButton) submitButton.disabled = true;
    try {
      if (form.id === "twoFactorSetupForm") {
        state.twoFactorSetup = await api("/api/admin/2fa/setup", { method: "POST", body: JSON.stringify(values) });
        renderTwoFactorSettings();
        return;
      }
      if (form.id === "twoFactorEnableForm") {
        const result = await api("/api/admin/2fa/enable", { method: "POST", body: JSON.stringify(values) });
        state.twoFactorSetup = null;
        state.twoFactorRecoveryCodes = result.recoveryCodes || [];
        state.twoFactorStatus = { enabled: true, recoveryCodesRemaining: state.twoFactorRecoveryCodes.length, confirmedAt: new Date().toISOString() };
        renderTwoFactorSettings();
        showToast("Autenticação em duas etapas ativada.");
        return;
      }
      if (form.id === "twoFactorRecoveryForm") {
        const result = await api("/api/admin/2fa/recovery-codes", { method: "POST", body: JSON.stringify(values) });
        state.twoFactorRecoveryCodes = result.recoveryCodes || [];
        renderTwoFactorSettings();
        showToast("Novos códigos gerados.");
        return;
      }
      if (form.id === "twoFactorDisableForm") {
        await api("/api/admin/2fa/disable", { method: "POST", body: JSON.stringify(values) });
        await loadTwoFactorStatus();
        closeTwoFactorSettings();
        showSuccess("2FA desativado", "Esta conta voltará a entrar somente com e-mail e senha.");
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (submitButton && submitButton.isConnected) submitButton.disabled = false;
    }
  });
  $("twoFactorBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-two-factor-action]");
    if (!button) return;
    const action = button.dataset.twoFactorAction;
    if (action === "download-recovery") downloadRecoveryCodes();
    if (action === "copy-recovery") {
      const text = state.twoFactorRecoveryCodes.join("\n");
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const field = document.createElement("textarea");
        field.value = text;
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
      }
      showToast("Códigos copiados.");
    }
    if (action === "finish") {
      state.twoFactorRecoveryCodes = [];
      await loadTwoFactorStatus();
      if (state.adminUser?.twoFactorSetupRequired && state.twoFactorStatus?.enabled) {
        state.adminUser.twoFactorSetupRequired = false;
        state.adminUser.twoFactorEnabled = true;
        closeTwoFactorSettings();
        await loadContent();
      }
    }
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      activatePanel(button.dataset.panel, { scroll: true });
      closeAdminDrawer();
    });
  });

  document.querySelectorAll("[data-goto-panel]").forEach((element) => {
    const openTargetPanel = () => {
      const panelId = element.dataset.gotoPanel;
      const navButton = document.querySelector(`.nav-button[data-panel="${panelId}"]`);
      if (!panelId || !$(panelId)) return;
      if (navButton?.hidden) {
        showToast("Seu perfil não possui permissão para abrir esta área.", "error");
        return;
      }
      activatePanel(panelId, { scroll: true });
      closeAdminDrawer();
    };
    element.addEventListener("click", openTargetPanel);
    if (element.getAttribute("role") === "button") {
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openTargetPanel();
      });
    }
  });

  $("logoutButton").addEventListener("click", logoutAdmin);
  $("successCloseButton").addEventListener("click", hideSuccess);
  $("successOverlay").addEventListener("click", (event) => {
    if (event.target === $("successOverlay")) hideSuccess();
  });
  $("orderOverlayCloseButton").addEventListener("click", closeOrderOverlay);
  $("orderOverlay").addEventListener("click", (event) => {
    if (event.target === $("orderOverlay")) closeOrderOverlay();
  });
  $("orderEditorForm").addEventListener("submit", saveOrderEdit);
  $("orderCancelButton").addEventListener("click", () => cancelOrDeleteOrder());
  $("orderPermanentDeleteButton").addEventListener("click", () => openPermanentDelete());
  $("permanentDeleteCloseButton").addEventListener("click", closePermanentDelete);
  $("permanentDeleteBackButton").addEventListener("click", closePermanentDelete);
  $("permanentDeleteOverlay").addEventListener("click", (event) => {
    if (event.target === $("permanentDeleteOverlay")) closePermanentDelete();
  });
  $("permanentDeleteForm").addEventListener("submit", permanentlyDeleteSelectedOrder);
  $("integrationForm").addEventListener("submit", saveIntegration);
  $("integrationCloseButton").addEventListener("click", closeIntegrationConfig);
  $("integrationOverlay").addEventListener("click", (event) => {
    if (event.target === $("integrationOverlay")) closeIntegrationConfig();
  });
  $("integrationTestButton").addEventListener("click", () => {
    if (state.selectedIntegrationKey) testIntegration(state.selectedIntegrationKey);
  });
  $("integrationDisableButton").addEventListener("click", () => {
    const key = state.selectedIntegrationKey;
    const current = state.integrations?.integrations?.[key];
    if (key && current) toggleIntegration(key, !current.enabled);
  });
  $("logsRefreshButton")?.addEventListener("click", () => loadLogs());
  $("logsExportButton")?.addEventListener("click", exportLogs);
  $("logsPruneButton")?.addEventListener("click", pruneLogs);
  document.querySelectorAll("[data-logs-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.logsView = button.dataset.logsView || "business";
      document.querySelectorAll("[data-logs-view]").forEach((item) => item.classList.toggle("active", item === button));
      loadLogs({ page: 1 });
    });
  });
  [["logsLevel", "level"], ["logsCategory", "category"], ["logsFrom", "from"], ["logsTo", "to"]].forEach(([id, key]) => {
    $(id)?.addEventListener("change", () => {
      state.logFilters[key] = $(id).value.trim();
      loadLogs({ page: 1 });
    });
  });
  $("logsSearch")?.addEventListener("input", () => {
    clearTimeout(state.logsSearchTimer);
    state.logFilters.search = $("logsSearch").value.trim();
    state.logsSearchTimer = setTimeout(() => loadLogs({ page: 1 }), 350);
  });
  $("webhookSimulateButton")?.addEventListener("click", simulateWebhook);
  $("webhookBatchButton")?.addEventListener("click", runWebhookBatch);
  $("webhookTestAction")?.addEventListener("change", () => {
    const action = $("webhookTestAction").value;
    if (action === "order.action_required") $("webhookTestStatus").value = "action_required";
    else if (action === "order.cancelled") $("webhookTestStatus").value = "cancelled";
    else if (action === "order.refunded") $("webhookTestStatus").value = "refunded";
    else if (action === "order.processed") $("webhookTestStatus").value = "processed";
  });
  document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.dashboardPeriod = button.dataset.dashboardPeriod;
      document.querySelectorAll("[data-dashboard-period]").forEach((item) => item.classList.toggle("active", item === button));
      const custom = state.dashboardPeriod === "custom";
      $("dashboardFrom").hidden = !custom;
      $("dashboardTo").hidden = !custom;
      await refreshDashboardOnly();
      await refreshPaymentsOnly();
    });
  });
  document.querySelectorAll("[data-dashboard-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboardMetric = button.dataset.dashboardMetric;
      document.querySelectorAll("[data-dashboard-metric]").forEach((item) => item.classList.toggle("active", item === button));
      if ($("dashChartHint")) $("dashChartHint").textContent = "";
      renderDashboardChart(state.dashboard?.chart || []);
    });
  });
  ["dashboardFrom", "dashboardTo"].forEach((id) => {
    $(id).addEventListener("change", async () => {
      state.dashboardFrom = $("dashboardFrom").value;
      state.dashboardTo = $("dashboardTo").value;
      if (state.dashboardPeriod === "custom") {
        await refreshDashboardOnly();
        await refreshPaymentsOnly();
      }
    });
  });
  $("newMovieButton").addEventListener("click", newMovie);
  $("cancelMovieCreateButton").addEventListener("click", () => cancelCreation("movie"));
  $("movieForm").addEventListener("submit", saveMovie);
  $("deleteMovieButton").addEventListener("click", () => deleteMovie());
  $("addSessionButton").addEventListener("click", () => openSessionEditor());
  $("sessionCreationMode").addEventListener("change", syncSessionCreationMode);
  $("sessionDate").addEventListener("change", () => {
    if (state.editingSessionId) {
      state.editingSessionDateChanged = $("sessionDate").value !== state.editingSessionOriginalDate;
    }
    if ($("sessionCreationMode").value === "range" && (!$("sessionDateEnd").value || $("sessionDateEnd").value < $("sessionDate").value)) {
      $("sessionDateEnd").value = $("sessionDate").value;
    }
  });
  $("saveSessionButton").addEventListener("click", saveSession);
  $("cancelSessionButton").addEventListener("click", closeSessionEditor);
  $("tmdbSearchButton").addEventListener("click", searchTmdb);
  $("movieWizardBack").addEventListener("click", () => setMovieWizardStep(state.movieWizardStep - 1));
  $("movieWizardNext").addEventListener("click", () => {
    if (validateMovieWizardStep(state.movieWizardStep)) setMovieWizardStep(state.movieWizardStep + 1);
  });
  $("movieDraftButton").addEventListener("click", () => saveMovieWithAction("draft"));
  document.querySelectorAll("[data-movie-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetStep = Number(button.dataset.movieStep);
      if (targetStep <= state.movieWizardStep || validateMovieWizardStep(state.movieWizardStep)) setMovieWizardStep(targetStep);
    });
  });
  $("movieTitle").addEventListener("input", () => {
    if (!$("movieId").value && !$("movieSlug").dataset.touched) $("movieSlug").value = slugify($("movieTitle").value);
  });
  $("movieSlug").addEventListener("input", () => {
    $("movieSlug").dataset.touched = "true";
    $("movieSlug").value = slugify($("movieSlug").value);
  });
  $("moviePosterUpload").addEventListener("change", () => uploadMovieImage("moviePosterUpload", "moviePosterUrl", "moviePosterPreview", "movies/posters"));
  $("movieBackdropUpload").addEventListener("change", () => uploadMovieImage("movieBackdropUpload", "movieBackdropUrl", "movieBackdropPreview", "movies/backdrops"));
  $("moviePosterUrl").addEventListener("input", () => renderMovieMediaPreview("moviePosterUrl", "moviePosterPreview", "Prévia do pôster"));
  $("movieBackdropUrl").addEventListener("input", () => renderMovieMediaPreview("movieBackdropUrl", "movieBackdropPreview", "Prévia do banner"));
  $("tmdbQuery").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchTmdb();
    }
  });

  $("newRoomButton").addEventListener("click", newRoom);
  $("cancelRoomCreateButton").addEventListener("click", () => cancelCreation("room"));
  $("roomForm").addEventListener("submit", saveRoom);
  $("deleteRoomButton").addEventListener("click", deleteRoom);
  $("roomSeatSelectionEnabled").addEventListener("change", (event) => {
    state.roomSeatDraft.enabled = event.target.checked;
    renderRoomSeatEditor();
  });
  $("generateRoomSeatsButton").addEventListener("click", generateRoomSeatMap);
  $("addRoomSeatTypeButton").addEventListener("click", addRoomSeatType);
  $("roomSeatScreenLabel").addEventListener("input", (event) => {
    state.roomSeatDraft.screenLabel = event.target.value;
    $("roomSeatScreen").textContent = event.target.value || "TELA";
  });
  $("roomSeatTypes").addEventListener("input", (event) => {
    const row = event.target.closest("[data-seat-type-id]");
    const field = event.target.dataset.seatTypeField;
    const type = state.roomSeatDraft.seatTypes.find((candidate) => candidate.id === row?.dataset.seatTypeId);
    if (!type || !field) return;
    type[field] = event.target.value;
    renderRoomSeatMap();
  });
  $("roomSeatTypes").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-seat-type]");
    if (button) removeRoomSeatType(button.dataset.removeSeatType);
  });
  $("roomSeatMap").addEventListener("click", (event) => {
    const seatButton = event.target.closest("[data-room-seat-id]");
    if (seatButton) return selectRoomSeatElement({ kind: "seat", seatId: seatButton.dataset.roomSeatId });
    const rowButton = event.target.closest("[data-room-seat-row-id]");
    if (rowButton) return selectRoomSeatElement({ kind: "row", rowId: rowButton.dataset.roomSeatRowId });
    const columnButton = event.target.closest("[data-room-seat-column]");
    if (columnButton) selectRoomSeatElement({ kind: "column", columnIndex: Number(columnButton.dataset.roomSeatColumn) });
  });
  $("roomSeatSelectionPanel").addEventListener("input", (event) => {
    const field = event.target.dataset.seatSelectionField;
    if (!field) return;
    updateRoomSeatSelectionField(field, event.target.type === "checkbox" ? event.target.checked : event.target.value);
  });
  $("roomSeatSelectionPanel").addEventListener("click", (event) => {
    const accessibilityButton = event.target.closest("[data-seat-accessibility]");
    if (accessibilityButton) return updateRoomSeatSelectionField("accessibility", accessibilityButton.dataset.seatAccessibility || "");
    const button = event.target.closest("[data-seat-selection-action]");
    if (button) handleRoomSeatSelectionAction(button.dataset.seatSelectionAction);
  });

  $("newTicketButton").addEventListener("click", newTicket);
  $("cancelTicketCreateButton").addEventListener("click", () => cancelCreation("ticket"));
  $("ticketForm").addEventListener("submit", saveTicket);
  $("deleteTicketButton").addEventListener("click", deleteTicket);
  ["issuedTicketMovieFilter", "issuedTicketSessionFilter", "issuedTicketDateFilter", "issuedTicketStatusFilter", "issuedTicketRoomFilter"].forEach((id) => {
    $(id)?.addEventListener("change", (event) => {
      const key = {
        issuedTicketMovieFilter: "movieId",
        issuedTicketSessionFilter: "sessionId",
        issuedTicketDateFilter: "date",
        issuedTicketStatusFilter: "status",
        issuedTicketRoomFilter: "room"
      }[id];
      state.issuedTicketsPage = 1;
      state.issuedTicketFilters[key] = event.target.value;
      if (id === "issuedTicketMovieFilter") state.issuedTicketFilters.sessionId = "";
      renderIssuedTickets();
    });
  });
  $("manualTicketForm").addEventListener("submit", createManualTicket);
  $("pointPaymentRetryButton")?.addEventListener("click", () => pollPointPayment({ manual: true }));
  $("pointPaymentCancelButton")?.addEventListener("click", cancelPointPayment);
  $("pointPaymentNewSaleButton")?.addEventListener("click", resetPointPaymentPanel);
  $("manualSessionDate").addEventListener("change", renderManualSaleOptions);
  $("manualMovieSelect").addEventListener("change", renderManualSessionOptions);
  $("manualSessionSelect").addEventListener("change", renderManualTicketTypes);
  $("manualAddMovieButton").addEventListener("click", addManualSaleItem);
  $("manualClearSaleButton").addEventListener("click", clearManualSaleItems);
  $("manualCustomerSearch").addEventListener("input", searchBoxOfficeCustomers);
  $("manualCustomerSearch").addEventListener("focus", searchBoxOfficeCustomers);
  document.querySelectorAll("[data-sale-mode]").forEach((button) => {
    button.addEventListener("click", () => setSaleMode(button.dataset.saleMode));
  });
  document.querySelectorAll("[data-box-office-tab]").forEach((button) => {
    button.addEventListener("click", () => setBoxOfficeTab(button.dataset.boxOfficeTab));
  });
  document.querySelectorAll("[data-order-filter]").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
        state.ordersPage = 1;
        state.todayOrdersPage = 1;
        state.orderFilters[group.dataset.orderFilter] = button.dataset.value;
        renderOrders();
      });
    });
  });
  $("ordersSearch").addEventListener("input", () => {
    state.ordersPage = 1;
    state.orderFilters.allQuery = $("ordersSearch").value.trim();
    renderOrders();
  });
  [
    ["paymentFilterStatus", "status"],
    ["paymentFilterMethod", "method"],
    ["paymentFilterOrigin", "origin"],
    ["paymentFilterProvider", "provider"]
  ].forEach(([id, key]) => {
    $(id).addEventListener("change", async () => {
      state.paymentFilters[key] = $(id).value;
      await refreshPaymentsOnly();
    });
  });
  $("startQrButton").addEventListener("click", startQrReader);
  $("stopQrButton").addEventListener("click", stopQrReader);
  $("torchQrButton").addEventListener("click", toggleQrTorch);
  $("manualCodeToggle").addEventListener("click", toggleManualCodeBox);
  $("ticketValidationSessionLock").addEventListener("change", updateValidationSessionLock);
  $("ticketValidationSessionSelect").addEventListener("change", (event) => {
    state.validationSessionId = event.target.value;
    renderValidationSessionScope();
  });
  $("validateTicketButton").addEventListener("click", () => validateTicketByCode());
  $("ticketValidationCode").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      validateTicketByCode();
    }
  });

  $("newConcessionButton").addEventListener("click", newConcession);
  $("cancelConcessionCreateButton").addEventListener("click", () => cancelCreation("concession"));
  $("concessionForm").addEventListener("submit", saveConcession);
  $("deleteConcessionButton").addEventListener("click", deleteConcession);
  $("concessionImageUpload").addEventListener("change", () => uploadAdminImage("concessionImageUpload", "concessionImageUrl", "", "concessions", renderConcessionPreview));
  $("concessionImageUrl").addEventListener("input", renderConcessionPreview);
  $("concessionImageClear").addEventListener("click", () => clearImageField("concessionImageUrl", "concessionImagePreview", "Imagem do produto"));

  $("settingsForm").addEventListener("submit", saveSettings);
  $("clubVisualForm")?.addEventListener("submit", saveClubVisualSettings);
  $("eventTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
  $("clubTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
  $("emailCampaignForm")?.addEventListener("submit", sendEmailCampaign);
  $("emailCampaignMode")?.addEventListener("change", syncEmailCampaignMode);
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
  $("newPromotionButton").addEventListener("click", newPromotion);
  $("cancelPromotionCreateButton").addEventListener("click", () => cancelCreation("promotion"));
  $("promotionForm").addEventListener("submit", savePromotion);
  $("deletePromotionButton").addEventListener("click", deletePromotion);
  $("newAdButton").addEventListener("click", newAd);
  $("cancelAdCreateButton").addEventListener("click", () => cancelCreation("ad"));
  $("adForm").addEventListener("submit", saveAd);
  $("deleteAdButton").addEventListener("click", deleteAd);
  $("adImageUpload").addEventListener("change", () => uploadAdminImage("adImageUpload", "adImageUrl", "adImagePreview", "ads"));
  $("adImageUrl").addEventListener("input", () => renderAdminImagePreview("adImageUrl", "adImagePreview", "Prévia do anúncio"));
  $("adImageClear").addEventListener("click", () => clearImageField("adImageUrl", "adImagePreview", "Prévia do anúncio"));

  $("newUserButton").addEventListener("click", newUser);
  $("cancelUserCreateButton").addEventListener("click", () => cancelCreation("user"));
  $("userForm").addEventListener("submit", saveUser);
  $("deleteUserButton").addEventListener("click", deleteUser);
  $("userRole")?.addEventListener("change", () => syncUserPermissionEditor());
  $("userUseCustomPermissions")?.addEventListener("change", () => syncUserPermissionEditor(selectedUserPermissions()));
  $("newCustomerUserButton")?.addEventListener("click", newCustomerUser);
  $("cancelCustomerUserCreateButton")?.addEventListener("click", () => cancelCreation("customerUser"));
  $("customerUserForm")?.addEventListener("submit", saveCustomerUser);
  $("deleteCustomerUserButton")?.addEventListener("click", deleteCustomerUser);
  $("customerAccountsSearch")?.addEventListener("input", (event) => {
    state.customerAccountsSearch = event.target.value;
    renderCustomerUsers();
  });

  $("newClubPlanButton").addEventListener("click", newClubPlan);
  $("clubPlanActive")?.addEventListener("change", (event) => {
    const active = Boolean(event.target.checked);
    $("clubPlanForm")?.classList.toggle("is-inactive", !active);
    if ($("clubPlanEditorStatusText")) $("clubPlanEditorStatusText").textContent = active ? "Ativo" : "Inativo";
  });
  $("cancelClubPlanCreateButton").addEventListener("click", () => cancelCreation("clubPlan"));
  $("clubPlanForm").addEventListener("submit", saveClubPlan);
  $("deleteClubPlanButton")?.addEventListener("click", deleteClubPlan);
  $("clubAssignForm").addEventListener("submit", assignClubSubscription);
}

function setupResponsiveSelects() {
  ["paymentFilterStatus", "paymentFilterMethod", "paymentFilterOrigin", "paymentFilterProvider"].forEach((id) => {
    const select = $(id);
    if (!select || select.dataset.responsiveSelectReady) return;
    select.dataset.responsiveSelectReady = "true";
    const wrapper = document.createElement("div");
    wrapper.className = "responsive-select";
    wrapper.dataset.selectId = id;
    wrapper.innerHTML = `
      <button class="responsive-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span></span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="responsive-select-menu" role="listbox" hidden></div>
    `;
    select.insertAdjacentElement("afterend", wrapper);

    const sync = () => syncResponsiveSelect(select, wrapper);
    sync();
    select.addEventListener("change", sync);
    wrapper.querySelector(".responsive-select-button").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = wrapper.querySelector(".responsive-select-menu");
      const willOpen = menu.hidden;
      closeResponsiveSelects();
      if (willOpen) {
        syncResponsiveSelect(select, wrapper);
        menu.hidden = false;
        wrapper.querySelector(".responsive-select-button").setAttribute("aria-expanded", "true");
        positionResponsiveSelectMenu(wrapper);
      }
    });
  });

  window.addEventListener("resize", positionOpenResponsiveSelect);
  window.addEventListener("scroll", positionOpenResponsiveSelect, true);
}

function syncResponsiveSelect(select, wrapper) {
  const selectedOption = select.options[select.selectedIndex] || select.options[0];
  const label = selectedOption?.textContent || "Selecionar";
  wrapper.querySelector(".responsive-select-button span").textContent = label;
  wrapper.querySelector(".responsive-select-menu").innerHTML = Array.from(select.options).map((option) => `
    <button type="button" role="option" aria-selected="${option.value === select.value}" data-value="${escapeHtml(option.value)}">
      ${escapeHtml(option.textContent || option.value || "Selecionar")}
    </button>
  `).join("");
  wrapper.querySelectorAll(".responsive-select-menu button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      select.value = button.dataset.value || "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeResponsiveSelects();
    });
  });
}

function positionResponsiveSelectMenu(wrapper) {
  const button = wrapper.querySelector(".responsive-select-button");
  const menu = wrapper.querySelector(".responsive-select-menu");
  if (!button || !menu || menu.hidden) return;
  const rect = button.getBoundingClientRect();
  const margin = 10;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const width = Math.min(Math.max(rect.width, 180), viewportWidth - margin * 2);
  const maxHeight = Math.min(300, viewportHeight - margin * 2);
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${maxHeight}px`;
  const height = Math.min(menu.scrollHeight || maxHeight, maxHeight);
  const below = rect.bottom + 6;
  const openAbove = below + height > viewportHeight - margin && rect.top > height + margin;
  const top = openAbove ? Math.max(margin, rect.top - height - 6) : Math.min(below, viewportHeight - height - margin);
  const left = Math.min(Math.max(margin, rect.left), viewportWidth - width - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function positionOpenResponsiveSelect() {
  document.querySelectorAll(".responsive-select-menu:not([hidden])").forEach((menu) => {
    const wrapper = menu.closest(".responsive-select");
    if (wrapper) positionResponsiveSelectMenu(wrapper);
  });
}

function closeResponsiveSelects() {
  document.querySelectorAll(".responsive-select-menu").forEach((menu) => {
    menu.hidden = true;
    menu.closest(".responsive-select")?.querySelector(".responsive-select-button")?.setAttribute("aria-expanded", "false");
  });
}

function toggleAdminDrawer(force) {
  const open = force ?? !document.body.classList.contains("admin-drawer-open");
  document.body.classList.toggle("admin-drawer-open", open);
  const button = $("adminMenuButton");
  const backdrop = $("adminDrawerBackdrop");
  if (button) button.setAttribute("aria-expanded", String(open));
  if (backdrop) backdrop.hidden = !open;
}

function closeAdminDrawer() {
  toggleAdminDrawer(false);
}

function activatePanel(panelId, options = {}) {
  const target = $(panelId) ? panelId : "dashboardPanel";
  document.querySelectorAll(".nav-button").forEach((item) => item.classList.toggle("active", item.dataset.panel === target));
  document.querySelectorAll(".panel").forEach((item) => item.classList.toggle("active", item.id === target));
  localStorage.setItem("cine_admin_panel", target);
  if (window.location.hash !== `#${target}`) {
    history.replaceState(null, "", `#${target}`);
  }
  if (options.scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "logsPanel" && !state.logs) void loadLogs({ page: 1 });
  if (target === "fiscalPanel" && !state.fiscal) void loadFiscalDocuments({ page: 1 });
}

window.selectMovie = selectMovie;
window.removeSession = removeSession;
window.archiveMovie = archiveMovie;
window.duplicateMovie = duplicateMovie;
window.deleteMovie = deleteMovie;
window.moveMovie = moveMovie;
window.toggleMovieMenu = toggleMovieMenu;
window.handleMovieDragStart = handleMovieDragStart;
window.handleMovieDragOver = handleMovieDragOver;
window.handleMovieDragLeave = handleMovieDragLeave;
window.handleMovieDragEnd = handleMovieDragEnd;
window.handleMovieDrop = handleMovieDrop;
window.selectRoom = selectRoom;
window.selectTicket = selectTicket;
window.showSessionTickets = showSessionTickets;
window.selectConcession = selectConcession;
window.selectPromotion = selectPromotion;
window.selectAd = selectAd;
window.selectUser = selectUser;
window.selectCustomerAccount = selectCustomerAccount;
window.openOrderView = openOrderView;
window.openOrderEdit = openOrderEdit;
window.cancelOrDeleteOrder = cancelOrDeleteOrder;
window.archiveOrderAdmin = archiveOrderAdmin;
window.restoreOrderAdmin = restoreOrderAdmin;
window.openPermanentDelete = openPermanentDelete;
window.toggleOrderMenu = toggleOrderMenu;
window.closeFloatingActionMenu = closeFloatingActionMenu;
window.copyTicketCode = copyTicketCode;
window.printOrderTicket = printOrderTicket;
window.printPhysicalTicket = printPhysicalTicket;
window.resendOrderTicket = resendOrderTicket;
window.showChartHint = showChartHint;
window.openSessionDashboardDetail = openSessionDashboardDetail;
window.activatePanel = activatePanel;
window.setBoxOfficeTab = setBoxOfficeTab;
window.scanNextTicket = scanNextTicket;
window.importTmdbMovie = importTmdbMovie;
window.selectBoxOfficeCustomer = selectBoxOfficeCustomer;
window.selectBoxOfficeCustomerById = selectBoxOfficeCustomerById;
window.selectClubPlan = selectClubPlan;
window.updateClubSubscription = updateClubSubscription;
window.deleteClubPlan = deleteClubPlan;
window.adjustClubCredit = adjustClubCredit;
window.openIntegrationConfig = openIntegrationConfig;
window.openFiscalIntegration = openFiscalIntegration;
window.fiscalAction = fiscalAction;
window.downloadFiscal = downloadFiscal;
window.testIntegration = testIntegration;
window.showWebhookRun = showWebhookRun;
window.resendWebhookRun = resendWebhookRun;
window.toggleIntegration = toggleIntegration;

async function initAdmin() {
  bindEvents();
  setBoxOfficeTab("newSale");
  const user = await loadAdminUser();
  if (user?.twoFactorSetupRequired) {
    setAdminSubtab("accounts", "security");
    activatePanel("usersPanel", { scroll: false });
    await openTwoFactorSettings();
    return;
  }
  await loadContent();
}

initAdmin();
