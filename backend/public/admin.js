const API_BASE = (() => {
  const pathname = window.location.pathname || "";
  const adminIndex = pathname.indexOf("/admin");
  return adminIndex > 0 ? pathname.slice(0, adminIndex) : "";
})();
const QR_SCAN_DURATION_MS = 30000;

function randomClientId(prefix) {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return `${prefix}-${Date.now()}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

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
  promotionView: "active",
  promotionUsageCouponId: "",
  promotionUsageHistory: [],
  promotionUsageMeta: null,
  promotionUsageLoading: false,
  promotionUsageRequestToken: 0,
  selectedAdId: "",
  selectedUserId: "",
  selectedIntegrationKey: "",
  selectedClubPlanId: "",
  selectedOrderId: "",
  dashboard: null,
  integrations: null,
  logs: null,
  logsPage: 1,
  logsPageSize: 40,
  logsView: "business",
  logFilters: { search: "", level: "", category: "", from: "", to: "" },
  webhookSimulatorRuns: [],
  selectedWebhookRunId: "",
  selectedCustomerAccountId: "",
  customerAccountsSearch: "",
  customerAccountsPage: 1,
  customerAccountsPageSize: 10,
  movieWizardStep: 0,
  movieDraftMetadata: {},
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
  concessionPeriod: "today",
  concessionFrom: "",
  concessionTo: "",
  concessionFinanceData: null,
  paymentsPage: 1,
  paymentsPageSize: 8,
  concessionDailySalesPage: 1,
  concessionDailySalesPageSize: 8,
  concessionBreakdownPage: 1,
  concessionBreakdownPageSize: 5,
  dashMoviePage: 1,
  dashMoviePageSize: 5,
  dashTopProductsPage: 1,
  dashTopProductsPageSize: 5,
  dashSessionsPage: 1,
  dashSessionsPageSize: 4,
  dashLatestOrdersPage: 1,
  dashLatestOrdersPageSize: 5,
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
  concessionTab: "todaySales",
  concessionCategoryFilter: "all",
  concessionStatusFilter: "all",
  concessionSalesData: null,
  selectedConcessionOrderId: null,
  saleMode: "registered",
  selectedCustomer: null,
  customerSearchResults: [],
  manualSaleItems: [],
  manualConcessionQuantities: {},
  manualSeatMap: null,
  manualSeatMapStatus: "idle",
  manualSeatMapSessionId: "",
  manualSelectedSeatIds: [],
  manualSeatRequestToken: 0,
  manualSeatRealtimeChannels: new Map(),
  manualSeatRealtimeSessionId: "",
  manualSeatRealtimeOwnerToken: "",
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
  qrPendingEntryCode: "",
  qrPendingConcessionCode: "",
  validationSessionLock: false,
  validationSessionId: "",
  validationMode: "entry",
  toastTimer: null,
  refreshStatusTimer: null,
  logsSearchTimer: null,
  twoFactorStatus: null,
  twoFactorSetup: null,
  twoFactorRecoveryCodes: [],
  emailCampaignStep: "objective",
  emailCampaignRecipients: [],
  emailCampaignSelectedIds: new Set(),
  emailCampaignAttachments: [],
  emailCampaignVariables: {},
  emailCampaignConcessionIds: [],
  emailCampaignClubOffer: "",
  emailCampaignPreviewMode: "desktop",
  emailCampaignTemplate: "announcement",
  emailCampaignObjective: "announcement",
  emailCampaignTemplateSelectionMode: "automatic",
  emailCampaignTemplateResolution: null,
  emailCampaignUseCanonicalHtml: false,
  emailCampaignDraftId: "",
  emailCampaignAiDraftId: "",
  emailCampaignAiPromptTemplateId: "",
  emailCampaignAiPromptDirty: false,
  emailCampaignHistoryFilter: "all",
  emailCampaignHistoryOrigin: "",
  emailCampaignHistorySearch: "",
  emailCampaignHistoryPage: 1,
  emailCampaignHistoryPageSize: 25,
  emailCampaignHistoryMeta: null,
  emailCampaignHistoryTimer: null,
  emailCampaignHistorySearchTimer: null,
  emailTemplateLibrary: null,
  emailTemplateLibraryOpen: false,
  emailTemplateLibraryCategory: "all",
  emailTemplateLibraryPage: 1,
  emailTemplateLibrarySearch: "",
  emailTemplateLibrarySearchTimer: null,
  emailTemplateLibraryPreviewItem: null,
  emailCampaignReportId: "",
  emailCampaignIdempotencyKey: randomClientId("campanha")
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

function datetimeLocalValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function datetimeIsoValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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
    const requestId = data.error?.requestId || response.headers.get("x-request-id") || "";
    const fallback = requestId
      ? `Não foi possível concluir a operação. Informe o código ${requestId} caso o problema continue.`
      : "Não foi possível concluir a operação. Tente novamente.";
    const error = new Error(data.error?.message || data.error || fallback);
    error.status = response.status;
    error.code = data.error?.code || "REQUEST_ERROR";
    error.requestId = requestId;
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
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  if (API_BASE && (cleanPath.startsWith("/uploads/") || cleanPath.startsWith("/images/") || cleanPath.startsWith("/trailers/"))) {
    return `${API_BASE}${cleanPath}`;
  }
  return cleanPath;
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

function concessionFinanceQuery() {
  const params = new URLSearchParams({ period: state.concessionPeriod || "today" });
  if (state.concessionPeriod === "custom") {
    if (state.concessionFrom) params.set("from", state.concessionFrom);
    if (state.concessionTo) params.set("to", state.concessionTo);
  }
  return params.toString();
}

async function loadConcessionFinance() {
  try {
    state.concessionFinanceData = await api(`/api/admin/dashboard?${concessionFinanceQuery()}`);
    renderConcessionInsights();
  } catch (error) {
    console.error("Erro ao carregar dados financeiros da bomboniere:", error);
  }
}

async function refreshDashboardOnly() {
  state.dashboard = await api(`/api/admin/dashboard?${dashboardQuery()}`);
  renderDashboard();
  if (!state.concessionFinanceData) {
    renderConcessionInsights();
  }
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
    const [content, dashboard, payments, integrations, templateLibrary] = await Promise.all([
      api("/api/admin/content"),
      api(`/api/admin/dashboard?${dashboardQuery()}`).catch(() => null),
      api(`/api/admin/payments?${dashboardQuery()}`).catch(() => null),
      isOwnerAdmin() ? api("/api/integrations").catch(() => null) : Promise.resolve(null),
      api("/api/admin/email/template-library?page=1&pageSize=18").catch(() => null)
    ]);
    state.content = cleanAdminContentAssets(content);
    state.emailCampaignHistoryMeta = content.emailCampaignPagination || state.emailCampaignHistoryMeta;
    state.dashboard = dashboard;
    state.payments = payments;
    state.integrations = integrations;
    state.emailTemplateLibrary = templateLibrary;
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
    showError(`Não foi possível sincronizar os dados do painel. ${error.message}`);
    showToast("A sincronização falhou. Confira a mensagem exibida no topo.", "error");
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
    renderEmailCampaignControls();
    renderEmailCampaigns();
    renderEmailTemplateLibrary();
    renderPromotions();
  renderAds();
  renderUsers();
  renderCustomerUsers();
  renderClub();
  renderIntegrations();
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
  ["moviesList", "roomsList", "ticketsList", "concessionsList", "promotionsList", "adsList", "usersList", "customerUsersList", "ordersList", "todayOrdersList", "paymentsList", "clubPlansList", "clubSubscriptionsList", "integrationsList", "logsList"].forEach((id) => {
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
    external_pix: "Pix registrado no balcão",
    point_qr: "Pix na Point",
    card_terminal: "Débito/crédito na Point",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
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
    "coupon.order_completed": { title: "Pedido concluído com cupom", description: "O desconto cobriu todo o pedido e os ingressos foram emitidos sem cobrança." },
    "payment.reconciled": { title: "Pagamento confirmado", description: "O pagamento foi localizado e conciliado com o pedido." },
    "payment.reconciliation_reference_mismatch": { title: "Pagamento não localizado no pedido", description: "A referência recebida não corresponde ao pedido e precisa ser conferida." },
    "payment.reconciliation_amount_mismatch": { title: "Valor do pagamento diferente", description: "O valor confirmado pelo provedor não corresponde ao total do pedido." },
    "order.concession_refund_pending": { title: "Reembolso da bomboniere pendente", description: "A devolução foi solicitada, mas ainda precisa de confirmação do Mercado Pago." },
    "order.concession_refunded": { title: "Bomboniere reembolsada", description: "Os produtos foram devolvidos pela forma de pagamento original sem cancelar os ingressos do pedido." },
    "ticket.used": { title: "Ingresso validado", description: "A entrada foi liberada e o ingresso foi marcado como utilizado." },
    "ticket.transferred": { title: "Ingresso transferido", description: "O ingresso foi enviado para outro cliente." },
    "ticket_email.failed": { title: "E-mail do ingresso não enviado", description: "O ingresso foi emitido, mas o e-mail não pôde ser entregue." },
    "ticket_email.pdf_failed": { title: "PDF do ingresso não gerado", description: "O sistema não conseguiu preparar o PDF anexado ao e-mail." },
    "box_office_sale.created": { title: "Venda concluída na bilheteria", description: method ? `A venda presencial foi registrada com pagamento em ${method}.` : "A venda presencial foi registrada com sucesso." },
    "box_office_point_sale.created": { title: "Pagamento enviado à Point", description: "A cobrança presencial foi enviada para o terminal selecionado." },
    "box_office_point_sale.synced": { title: "Pagamento da Point atualizado", description: "O status da venda presencial foi atualizado pelo Mercado Pago." },
    "box_office_point_sale.cancelled": { title: "Cobrança da Point cancelada", description: "A cobrança presencial foi cancelada no Mercado Pago." },
    "box_office_ticket_print.queued": { title: "Ingresso enviado para impressão", description: "A impressão física foi enviada para o terminal Point." },
    "box_office_ticket_print.failed": { title: "Ingresso não impresso", description: "A venda foi concluída, mas o terminal Point não recebeu a impressão." },
    "webhook.processed": { title: "Pagamento atualizado automaticamente", description: "O Mercado Pago confirmou uma mudança no pagamento do pedido." },
    "webhook.subscription.processed": { title: "Assinatura do Clube atualizada", description: "O Mercado Pago confirmou uma mudança na assinatura do cliente." },
    "webhook.payment.not_found": { title: "Pagamento sem pedido correspondente", description: "O provedor confirmou uma cobrança, mas o sistema não encontrou o pedido relacionado." },
    "webhook.subscription.not_found": { title: "Pagamento sem assinatura correspondente", description: "O provedor enviou uma atualização, mas a assinatura relacionada não foi encontrada." },
    "webhook.mercado_pago.rejected": { title: "Confirmação do Mercado Pago recusada", description: "A notificação recebida não passou pela verificação de segurança." },
    "subscription.pending_payment_expiration_failed": { title: "Plano pendente não cancelado", description: "O sistema não conseguiu cancelar automaticamente um plano sem pagamento." },
    "subscription.pending_payment_maintenance_failed": { title: "Revisão de planos pendentes falhou", description: "A rotina automática de assinaturas precisa ser conferida." },
    "email_verification.delivery_failed": { title: "E-mail de verificação não entregue", description: "A mensagem de confirmação do cadastro não pôde ser enviada." },
    "email_verification.delivery_missing_channel": { title: "Envio de verificação não configurado", description: "Não há um serviço de e-mail disponível para confirmar o cadastro do cliente." },
    "email_campaign.created": { title: "Campanha criada", description: "Uma campanha de e-mail foi salva no painel." },
    "email_campaign.updated": { title: "Campanha editada", description: "O conteúdo ou o público de uma campanha foi atualizado." },
    "email_campaign.duplicated": { title: "Campanha duplicada", description: "Uma cópia foi criada como novo rascunho." },
    "email_campaign.deleted": { title: "Campanha removida", description: "A campanha foi retirada do histórico visível; envios anteriores continuam auditáveis." },
    "email_campaign.scheduled": { title: "Campanha agendada", description: "O envio foi programado para a data definida no painel." },
    "email_campaign.queued": { title: "Campanha colocada na fila", description: "O envio aguarda processamento pelo serviço de e-mails." },
    "email_campaign.cancelled": { title: "Campanha cancelada", description: "Os destinatários ainda pendentes não receberão a campanha." },
    "email_campaign.completed": { title: "Campanha concluída", description: "Todos os destinatários elegíveis foram processados sem falhas confirmadas." },
    "email_campaign.completed_with_errors": { title: "Campanha concluída com falhas", description: "Parte dos e-mails foi enviada e parte precisa de atenção." },
    "email_campaign.failed": { title: "Campanha não enviada", description: "O processamento terminou sem entregas confirmadas." },
    "email_campaign.failures_requeued": { title: "Falhas recolocadas na fila", description: "Somente entregas com falha segura para nova tentativa serão processadas." },
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

let concessionSalesLoading = false;
async function loadConcessionDailySales() {
  if (concessionSalesLoading || document.hidden) return;
  concessionSalesLoading = true;
  const target = $("concessionDailySales");
  if (!target) { concessionSalesLoading = false; return; }
  try {
    const dateInput = $("concessionSalesDate");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    }
    const selectedDate = dateInput?.value || "";
    const data = await api(`/api/admin/concession-sales${selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : ""}`);
    state.concessionSalesData = data;
    renderConcessionDailySales();
  } catch (error) {
    target.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar as vendas</strong><span>${escapeHtml(error.message)}</span></div>`;
  } finally {
    concessionSalesLoading = false;
  }
}

function findConcessionOrder(orderId) {
  for (const group of state.concessionSalesData?.groups || []) {
    const found = group.orders.find((o) => o.id === orderId);
    if (found) return { order: found, group };
  }
  return null;
}

function getOrderTickets(order) {
  if (Array.isArray(order?.tickets) && order.tickets.length) return order.tickets;
  if (order?.id && Array.isArray(state.content?.tickets)) {
    return state.content.tickets.filter((t) => t.orderId === order.id);
  }
  return [];
}

function isOrderFullyValidated(order) {
  if (!order) return false;
  const tickets = getOrderTickets(order);
  const hasTickets = tickets.length > 0;
  const ticketsDone = !hasTickets || tickets.every((t) => ["validated", "cancelled"].includes(t.status));
  const concessionItems = Array.isArray(order.concessionItems || order.items) ? (order.concessionItems || order.items) : [];
  const hasConcessions = concessionItems.length > 0;
  const concessionsDone = !hasConcessions || Boolean(
    order.concessionDeliveryStatus === "delivered" ||
    order.concessionStatus === "cancelled" ||
    order.concessionsFulfilledAt ||
    (order.concessionValidation && order.concessionValidation.fulfilledItems >= order.concessionValidation.totalItems)
  );
  if (!hasTickets && !hasConcessions) return false;
  return ticketsDone && concessionsDone;
}

function orderSessionStartsAt(order = {}) {
  let date = String(order?.sessionDate || "").slice(0, 10);
  let time = String(order?.sessionTime || "").trim();
  if ((!date || !time) && order?.sessionId && Array.isArray(state.content?.sessions)) {
    const foundSession = state.content.sessions.find((s) => s.id === order.sessionId);
    if (foundSession) {
      date = date || String(foundSession.date || "").slice(0, 10);
      time = time || String(foundSession.time || "").trim();
    }
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOrderSessionExpired(order = {}) {
  if (!order) return false;
  const startsAt = orderSessionStartsAt(order);
  if (!startsAt) return false;
  return startsAt.getTime() <= Date.now();
}

function isOrderEffectivelyArchived(order) {
  if (!order) return false;
  if (order.archived === true) return true;
  if (["cancelled", "refunded"].includes(order.status)) return true;
  if (isOrderSessionExpired(order)) return true;
  if (order.status === "paid" && isOrderFullyValidated(order)) return true;
  return false;
}

function isOrderEffectivelyActive(order) {
  if (!order) return false;
  return !isOrderEffectivelyArchived(order);
}

function getOrderValidationSummary(order) {
  const tickets = getOrderTickets(order);
  const hasTickets = tickets.length > 0;
  const ticketsValidated = hasTickets && tickets.every((t) => ["validated", "cancelled"].includes(t.status)) && tickets.some((t) => t.status === "validated");
  const ticketsCancelled = hasTickets && tickets.every((t) => t.status === "cancelled");
  const ticketsPending = hasTickets && !ticketsValidated && !ticketsCancelled;

  const concessionItems = Array.isArray(order?.concessionItems || order?.items) ? (order.concessionItems || order.items) : [];
  const hasConcessions = concessionItems.length > 0;
  const concessionsDelivered = hasConcessions && Boolean(
    order.concessionDeliveryStatus === "delivered" ||
    order.concessionsFulfilledAt ||
    (order.concessionValidation && order.concessionValidation.fulfilledItems >= order.concessionValidation.totalItems)
  );
  const concessionsCancelled = hasConcessions && order.concessionStatus === "cancelled";
  const concessionsPending = hasConcessions && !concessionsDelivered && !concessionsCancelled;

  return {
    hasTickets,
    ticketsValidated,
    ticketsCancelled,
    ticketsPending,
    hasConcessions,
    concessionsDelivered,
    concessionsCancelled,
    concessionsPending
  };
}

function changeConcessionDailySalesPage(delta) {
  state.concessionDailySalesPage = Math.max(1, (state.concessionDailySalesPage || 1) + delta);
  renderConcessionDailySales();
}

function renderConcessionDailySales() {
  const target = $("concessionDailySales");
  if (!target) return;
  const data = state.concessionSalesData || { summary: {}, groups: [] };
  const summary = data.summary || {};
  const showArchived = Boolean($("concessionSalesArchived")?.checked);
  const statusFilter = state.concessionStatusFilter || "all";

  const summaryEl = $("concessionSalesSummary");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div><span>Receita Líquida</span><strong>${money(summary.netRevenue || 0)}</strong></div>
      <div><span>Venda Bruta</span><strong>${money(summary.grossRevenue || 0)}</strong></div>
      <div><span>Itens Vendidos</span><strong>${Number(summary.itemQuantity || 0)}</strong></div>
      <div><span>Descontos / Devoluções</span><strong>${money((Number(summary.discountTotal || 0)) + (Number(summary.refundTotal || 0)))}</strong></div>
    `;
  }

  const allOrdersWithGroup = [];
  for (const group of data.groups || []) {
    for (const order of group.orders || []) {
      allOrdersWithGroup.push({ order, group });
    }
  }

  const filtered = allOrdersWithGroup.filter(({ order }) => {
    const isArchived = isOrderEffectivelyArchived(order);
    if (!showArchived && isArchived) return false;
    if (statusFilter === "all") return true;

    const totalItems = (order.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);
    const fulfilledItems = (order.items || []).reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
    const isRefunded = Number(order.finance?.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
    const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;

    if (statusFilter === "refunded" || statusFilter === "cancelled") return isCancelled;
    if (statusFilter === "fulfilled") return !isCancelled && fulfilledItems >= totalItems && totalItems > 0;
    if (statusFilter === "pending") return !isCancelled && fulfilledItems < totalItems;
    return true;
  });

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state"><strong>Nenhum pedido encontrado</strong><span>Não há pedidos para o filtro selecionado nesta data.</span></div>`;
    return;
  }

  const pageSize = state.concessionDailySalesPageSize || 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.concessionDailySalesPage = Math.min(Math.max(1, state.concessionDailySalesPage || 1), totalPages);
  const start = (state.concessionDailySalesPage - 1) * pageSize;
  const pageOrders = filtered.slice(start, start + pageSize);

  const pagerMarkup = `
    <div class="table-pagination-bar">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageOrders.length, filtered.length)}</strong> de <strong>${filtered.length}</strong> pedido(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.concessionDailySalesPage <= 1 ? "disabled" : ""} onclick="changeConcessionDailySalesPage(-1)">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.concessionDailySalesPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.concessionDailySalesPage >= totalPages ? "disabled" : ""} onclick="changeConcessionDailySalesPage(1)">Próxima →</button>
      </div>
    </div>
  `;

  target.innerHTML = `
    ${pagerMarkup}
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Cliente</th>
          <th>Sessão / Balcão</th>
          <th>Itens da Bomboniere</th>
          <th>Total Líquido</th>
          <th>Pagamento</th>
          <th>Entrega</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${pageOrders.map(({ order, group }) => {
          const items = order.items || [];
          const finance = order.finance || {};
          const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
          const fulfilledItems = items.reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
          const isRefunded = Number(finance.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
          const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;
          const discountTotal = Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0) + Number(finance.couponDiscount || 0);

          let deliveryLabel = "Aguardando";
          let deliveryTone = "warn";
          if (isCancelled) {
            deliveryLabel = isRefunded ? "Cancelado (Reembolsado)" : "Cancelado";
            deliveryTone = "danger";
          } else if (totalItems > 0 && fulfilledItems >= totalItems) {
            deliveryLabel = "Entregue";
            deliveryTone = "ok";
          } else if (fulfilledItems > 0) {
            deliveryLabel = `${fulfilledItems}/${totalItems} entregue`;
            deliveryTone = "warn";
          }

          const orderTime = new Date(order.purchasedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

          return `
            <tr class="order-table-row ${order.archived ? "is-archived" : ""}" onclick="openConcessionOrderDetail('${escapeHtml(order.id)}')">
              <td data-label="Data/Hora">
                <strong>#${escapeHtml(order.id.slice(-8).toUpperCase())}</strong><br>
                <span class="list-meta">${orderTime}</span>
              </td>
              <td data-label="Cliente">
                <strong>${escapeHtml(order.customerName || "Cliente avulso")}</strong>
              </td>
              <td data-label="Sessão">
                <strong>${escapeHtml(group.title || "Balcão")}</strong><br>
                <span class="list-meta">${escapeHtml([group.time, group.room].filter(Boolean).join(" • ") || "Venda avulsa")}</span>
              </td>
              <td data-label="Itens">
                <div class="concession-item-chips">
                  ${items.map((item) => {
                    const itemRefunded = item.refundStatus === "completed" || item.status === "cancelled" || isCancelled;
                    const f = Number(item.fulfilledQuantity || 0);
                    const q = Number(item.quantity || 0);
                    const isF = f >= q && !itemRefunded;
                    const tone = itemRefunded ? "chip-refunded" : isF ? "chip-ok" : "chip-pending";
                    return `<span class="concession-chip ${tone}" title="${escapeHtml(item.name)}: ${itemRefunded ? "Cancelado / Reembolsado" : isF ? "Entregue" : `${f}/${q} retirado`}"><strong>${q}x</strong> ${escapeHtml(item.name)}</span>`;
                  }).join("")}
                </div>
              </td>
              <td data-label="Total">
                <strong>${money(finance.netRevenue || 0)}</strong>
                ${discountTotal > 0 ? `<br><span class="list-meta discount-tag">-${money(discountTotal)}</span>` : ""}
              </td>
              <td data-label="Pagamento">
                <strong>${escapeHtml(order.paymentMethod || "Pix")}</strong><br>
                <span class="list-meta">${escapeHtml(order.paymentStatus || "Aprovado")}</span>
              </td>
              <td data-label="Entrega">
                <div class="order-status-stack">
                  <span class="status-label ${deliveryTone}">${deliveryLabel}</span>
                  ${order.archived ? '<span class="status-label archived">Arquivado</span>' : ""}
                </div>
              </td>
              <td data-label="Ações" onclick="event.stopPropagation()">
                <button class="ghost-button" type="button" onclick="openConcessionOrderDetail('${escapeHtml(order.id)}')">Detalhes</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function openConcessionOrderDetail(orderId) {
  const match = findConcessionOrder(orderId);
  if (!match) {
    showToast("Pedido não encontrado nesta data.", "error");
    return;
  }
  const { order, group } = match;
  state.selectedConcessionOrderId = orderId;
  const overlay = $("concessionOrderOverlay");
  if (!overlay) return;

  const titleEl = $("concessionOrderModalTitle");
  const subtitleEl = $("concessionOrderModalSubtitle");
  const bodyEl = $("concessionOrderDetailBody");
  const refundBtn = $("concessionModalRefundButton");
  const archiveBtn = $("concessionModalArchiveButton");

  if (titleEl) titleEl.textContent = `Pedido #${order.id.slice(-8).toUpperCase()}`;
  if (subtitleEl) subtitleEl.textContent = `Registrado em ${new Date(order.purchasedAt).toLocaleString("pt-BR")}`;

  const items = order.items || [];
  const finance = order.finance || {};
  const totalItems = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const fulfilledItems = items.reduce((s, i) => s + Number(i.fulfilledQuantity || 0), 0);
  const isRefunded = Number(finance.refundTotal || 0) > 0 || order.refund?.status === "completed" || order.status === "refunded";
  const isCancelled = order.concessionStatus === "cancelled" || order.status === "cancelled" || isRefunded;

  let deliveryBadge = '<span class="status-label warn">Aguardando retirada</span>';
  if (isCancelled) {
    deliveryBadge = `<span class="status-label danger">${isRefunded ? "Cancelado (Reembolsado)" : "Cancelado"}</span>`;
  } else if (fulfilledItems >= totalItems && totalItems > 0) {
    deliveryBadge = `<span class="status-label ok">Entregue (${fulfilledItems}/${totalItems})</span>`;
  } else if (fulfilledItems > 0) {
    deliveryBadge = `<span class="status-label warn">Retirada parcial (${fulfilledItems}/${totalItems})</span>`;
  }

  bodyEl.innerHTML = `
    <section class="order-detail-section">
      <h3>Informações do pedido</h3>
      <dl>
        <div><dt>Código completo</dt><dd><code>${escapeHtml(order.id)}</code></dd></div>
        <div><dt>Cliente</dt><dd>${escapeHtml(order.customerName || "Cliente avulso")}</dd></div>
        <div><dt>Sessão / Balcão</dt><dd>${escapeHtml(group.title || "Balcão")}${group.time ? ` • ${escapeHtml([group.time, group.room].filter(Boolean).join(" • "))}` : ""}</dd></div>
        <div><dt>Pagamento</dt><dd>${escapeHtml(order.paymentMethod || "Pix")} • ${escapeHtml(order.paymentStatus || "Aprovado")}</dd></div>
        <div><dt>Status de entrega</dt><dd>${deliveryBadge}${order.archived ? ' <span class="status-label archived">Arquivado</span>' : ""}</dd></div>
      </dl>
    </section>

    <section class="order-detail-section">
      <h3>Itens do pedido (${totalItems} total)</h3>
      <div class="orders-table modal-compact-table">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd.</th>
              <th>Entregue</th>
              <th>Unitário</th>
              <th>Descontos</th>
              <th>Líquido</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => {
              const productFinance = (finance.products || []).find((p) => String(p.id) === String(item.id)) || {};
              const discount = Number(productFinance.discountTotal || 0);
              const isFulfilled = (item.fulfilledQuantity || 0) >= (item.quantity || 0);
              return `
                <tr>
                  <td><strong>${escapeHtml(item.name)}</strong>${item.refundStatus === "completed" ? '<br><small class="danger-text">Reembolsado</small>' : ""}</td>
                  <td>${Number(item.quantity || 0)}</td>
                  <td><span class="status-label ${isFulfilled ? "ok" : "warn"}">${Number(item.fulfilledQuantity || 0)}/${Number(item.quantity || 0)}</span></td>
                  <td>${money(item.originalUnitPrice)}</td>
                  <td>${discount > 0 ? `-${money(discount)}` : "-"}</td>
                  <td><strong>${money(productFinance.netRevenue || (item.quantity * item.originalUnitPrice - discount))}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="order-detail-section">
      <h3>Conciliação financeira</h3>
      <dl>
        <div><dt>Venda bruta</dt><dd>${money(finance.grossRevenue || 0)}</dd></div>
        ${Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0) > 0 ? `<div><dt>Desconto Clube</dt><dd class="is-discount">- ${money(Number(finance.clubDiscount || 0) + Number(finance.freeItemDiscount || 0))}</dd></div>` : ""}
        ${Number(finance.couponDiscount || 0) > 0 ? `<div><dt>Cupom${order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""}</dt><dd class="is-discount">- ${money(finance.couponDiscount)}</dd></div>` : ""}
        ${Number(finance.refundTotal || 0) > 0 ? `<div><dt>Reembolso</dt><dd class="is-refund">- ${money(finance.refundTotal)}</dd></div>` : ""}
        <div class="is-net"><dt>Receita líquida da bomboniere</dt><dd><strong>${money(finance.netRevenue || 0)}</strong></dd></div>
      </dl>
    </section>
  `;

  if (refundBtn) {
    const eligibility = order.refundEligibility || {};
    const fullyDelivered = fulfilledItems >= totalItems && totalItems > 0;
    if (eligibility.allowed && !isCancelled && !fullyDelivered) {
      refundBtn.hidden = false;
      const amt = Number(eligibility.amount || 0);
      refundBtn.textContent = amt > 0 ? `Reembolsar ${money(amt)}` : "Cancelar bomboniere";
      refundBtn.onclick = () => executeConcessionRefund(order.id, amt);
    } else {
      refundBtn.hidden = true;
    }
  }

  if (archiveBtn) {
    archiveBtn.textContent = order.archived ? "Desarquivar pedido" : "Arquivar pedido";
    archiveBtn.onclick = () => toggleConcessionArchive(order.id, order.archived);
  }

  overlay.hidden = false;
}

function closeConcessionOrderOverlay() {
  const overlay = $("concessionOrderOverlay");
  if (overlay) overlay.hidden = true;
  state.selectedConcessionOrderId = null;
}

async function executeConcessionRefund(orderId, amount) {
  const message = amount > 0
    ? `Reembolsar ${money(amount)} da bomboniere pela forma de pagamento original? Os ingressos permanecerão ativos.`
    : "Cancelar os itens da bomboniere e liberar estoque e benefícios?";
  if (!confirm(message)) return;

  const btn = $("concessionModalRefundButton");
  if (btn) btn.disabled = true;
  try {
    const result = await api(`/api/admin/concession-sales/${encodeURIComponent(orderId)}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelamento da bomboniere pelo painel" })
    });
    showToast(Number(result.refund?.amount || 0) > 0 ? "Bomboniere reembolsada com sucesso." : "Bomboniere cancelada.");
    closeConcessionOrderOverlay();
    await Promise.all([loadConcessionDailySales(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function toggleConcessionArchive(orderId, currentArchived) {
  const btn = $("concessionModalArchiveButton");
  if (btn) btn.disabled = true;
  try {
    await api(`/api/admin/concession-sales/${encodeURIComponent(orderId)}/archive`, {
      method: "POST",
      body: JSON.stringify({ archived: !currentArchived })
    });
    showToast(currentArchived ? "Pedido desarquivado." : "Pedido arquivado.");
    closeConcessionOrderOverlay();
    await loadConcessionDailySales();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

let performanceLoading = false;
let performanceStreamTimer = null;
let performanceIntervalMs = 15000;
let performanceHistoryCache = [];
let performancePeakCpu = 0;

function formatPerfUptime(seconds) {
  if (!seconds || seconds <= 0) return "--";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${seconds % 60}s`;
}

function formatPerfBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return "Indisponível";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

function buildSmoothSvgPath(points, minY, maxY) {
  if (!points || !points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    let cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    let cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    if (Math.abs(p1.y - p2.y) < 0.01) {
      cp1y = p1.y;
      cp2y = p2.y;
    }
    if (minY != null && maxY != null) {
      cp1y = Math.min(maxY, Math.max(minY, cp1y));
      cp2y = Math.min(maxY, Math.max(minY, cp2y));
    }
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function renderCapacityBar(percent, toneClass = "cpu") {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return `
    <div class="perf-bar-wrap" title="${clamped}%">
      <div class="perf-bar-fill tone-${toneClass}" style="width: ${clamped}%"></div>
    </div>
  `;
}

function renderPerformanceKpis(metrics, history) {
  const grid = $("perfKpiGrid");
  if (!grid) return;

  const cpu = metrics.cpuPercent != null ? Number(metrics.cpuPercent) : 0;
  performancePeakCpu = Math.max(performancePeakCpu, cpu);
  const cpuTone = cpu >= 85 ? "danger" : cpu >= 60 ? "amber" : "normal";
  const cpuBadge = cpu >= 85 ? "Sobrecarga" : cpu >= 60 ? "Moderado" : "Normal";

  const totalMem = Number(metrics.memoryTotal) || 1;
  const usedMem = Number(metrics.memoryUsed) || 0;
  const memPercent = Math.round((usedMem / totalMem) * 100);
  const memTone = memPercent >= 90 ? "danger" : memPercent >= 75 ? "amber" : "normal";

  const reqLatency = metrics.requestP95Ms;
  const latencyVal = reqLatency != null ? `${reqLatency} ms` : "Sem tráfego";
  const latencyTone = reqLatency == null ? "normal" : reqLatency < 250 ? "normal" : reqLatency < 800 ? "amber" : "danger";
  const latencyBadge = reqLatency == null ? "Ocioso" : reqLatency < 250 ? "Normal" : reqLatency < 800 ? "Atenção" : "Crítico";
  const latencyRatio = reqLatency != null ? Math.min(100, Math.round((reqLatency / 1500) * 100)) : 0;

  const diskTotal = Number(metrics.diskTotal) || 0;
  const diskAvail = Number(metrics.diskAvailable) || 0;
  const diskUsedPercent = diskTotal > 0 ? Math.round(((diskTotal - diskAvail) / diskTotal) * 100) : 0;
  const diskTone = diskUsedPercent >= 90 ? "danger" : diskUsedPercent >= 75 ? "amber" : "normal";

  const errors = Number(metrics.errors5xx) || 0;
  const reqCount = Number(metrics.requestCount) || 0;
  const externalLatency = metrics.externalRequestP95Ms != null ? `${metrics.externalRequestP95Ms} ms` : "Sem chamadas";
  const externalCount = Number(metrics.externalRequestCount) || 0;
  const healthBadge = errors === 0 ? "Estável" : `${errors} Falhas`;
  const healthTone = errors === 0 ? "normal" : "danger";

  grid.innerHTML = `
    <!-- Card 1: CPU -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Uso de CPU</span>
        <span class="perf-kpi-badge ${cpuTone}">${cpuBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${cpu}%</span>
          <span class="perf-kpi-pill-meta">${metrics.vcores || 2} vCPU</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(cpu, cpuTone === "danger" ? "danger" : cpuTone === "amber" ? "amber" : "cpu")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Pico na sessão: <strong>${performancePeakCpu}%</strong></span>
        <span>Amostras: <strong>15s</strong></span>
      </div>
    </div>

    <!-- Card 2: Memória RAM -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Memória RAM</span>
        <span class="perf-kpi-badge ${memTone}">${memPercent}% em uso</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${formatPerfBytes(usedMem)}</span>
          <span class="perf-kpi-pill-meta">de ${formatPerfBytes(totalMem)}</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(memPercent, memTone === "danger" ? "danger" : memTone === "amber" ? "amber" : "ram")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Backend (Node.js): <strong>${formatPerfBytes(metrics.processRss)}</strong></span>
        <span>Livre: <strong>${formatPerfBytes(totalMem - usedMem)}</strong></span>
      </div>
    </div>

    <!-- Card 3: Latência HTTP -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Latência interna HTTP (p95)</span>
        <span class="perf-kpi-badge ${latencyTone}">${latencyBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${latencyVal}</span>
          <span class="perf-kpi-pill-meta">Janela: 5m</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(latencyRatio, latencyTone === "danger" ? "danger" : latencyTone === "amber" ? "amber" : "latency")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Integrações: <strong>${externalLatency}</strong> em ${externalCount} reqs</span>
        <span>Tráfego total: <strong>${reqCount} reqs</strong></span>
      </div>
    </div>

    <!-- Card 4: Disco do Servidor -->
    <div class="perf-kpi-card">
      <div class="perf-kpi-head">
        <span class="perf-kpi-title">Disco do Servidor</span>
        <span class="perf-kpi-badge ${healthTone}">${healthBadge}</span>
      </div>
      <div class="perf-kpi-body">
        <div class="perf-kpi-num-row">
          <span class="perf-kpi-big-num">${formatPerfBytes(diskAvail)}</span>
          <span class="perf-kpi-pill-meta">livres de ${formatPerfBytes(diskTotal)}</span>
        </div>
        <div class="perf-kpi-bar-row">
          ${renderCapacityBar(diskUsedPercent, diskTone === "danger" ? "danger" : diskTone === "amber" ? "amber" : "disk")}
        </div>
      </div>
      <div class="perf-kpi-footer">
        <span>Uso em disco: <strong>${diskUsedPercent}%</strong></span>
        <span>Erros 5xx: <strong>${errors}</strong></span>
      </div>
    </div>
  `;
}

function buildPerfTimeLabels(samples, xFn, height) {
  if (!samples || !samples.length) return "";
  if (samples.length === 1) {
    const d = new Date(samples[0].sampledAt);
    const tStr = isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<text class="perf-axis-text" x="${xFn(0).toFixed(1)}" y="${height - 10}" text-anchor="middle">${tStr}</text>`;
  }

  const targetCount = Math.min(5, samples.length);
  const step = (samples.length - 1) / Math.max(1, targetCount - 1);
  const candidateIndices = [];
  for (let k = 0; k < targetCount; k++) {
    const idx = Math.round(k * step);
    if (!candidateIndices.includes(idx)) candidateIndices.push(idx);
  }

  const safeIndices = [];
  let lastX = -999;
  for (const idx of candidateIndices) {
    const posX = xFn(idx);
    if (posX - lastX >= 80) {
      safeIndices.push(idx);
      lastX = posX;
    }
  }

  const lastIdx = samples.length - 1;
  const lastPos = xFn(lastIdx);
  if (!safeIndices.includes(lastIdx)) {
    if (safeIndices.length > 0 && (lastPos - xFn(safeIndices[safeIndices.length - 1]) < 80)) {
      safeIndices[safeIndices.length - 1] = lastIdx;
    } else {
      safeIndices.push(lastIdx);
    }
  }

  return safeIndices.map((idx) => {
    const s = samples[idx];
    const d = new Date(s.sampledAt);
    const tStr = isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `<text class="perf-axis-text" x="${xFn(idx).toFixed(1)}" y="${height - 10}" text-anchor="middle">${tStr}</text>`;
  }).join("");
}

function renderPerformanceCharts(history, current) {
  let samples = Array.isArray(history) && history.length ? [...history] : [current];
  if (samples.length > 40) samples = samples.slice(-40);

  // Gráfico 1: CPU & RAM (%)
  const cpuContainer = $("perfCpuChartContainer");
  if (cpuContainer) {
    const width = 740;
    const height = 205;
    const padL = 42;
    const padR = 20;
    const padT = 16;
    const padB = 30;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const bottomY = height - padB;

    const x = (i) => padL + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yPct = (pct) => padT + (1 - Math.max(0, Math.min(100, pct || 0)) / 100) * innerH;

    const cpuPoints = samples.map((s, i) => ({ x: x(i), y: yPct(s.cpuPercent || 0), s }));
    const ramPoints = samples.map((s, i) => ({ x: x(i), y: yPct((s.memoryUsed / s.memoryTotal) * 100), s }));
    const appPoints = samples.map((s, i) => ({ x: x(i), y: yPct((s.processRss / s.memoryTotal) * 100), s }));

    const cpuLine = buildSmoothSvgPath(cpuPoints, padT, bottomY);
    const ramLine = buildSmoothSvgPath(ramPoints, padT, bottomY);
    const appLine = buildSmoothSvgPath(appPoints, padT, bottomY);

    const firstX = cpuPoints[0].x.toFixed(1);
    const lastX = cpuPoints[cpuPoints.length - 1].x.toFixed(1);
    const bottomYStr = bottomY.toFixed(1);

    const cpuArea = `${cpuLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;
    const ramArea = `${ramLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;

    const lastCpu = cpuPoints[cpuPoints.length - 1];
    const lastRam = ramPoints[ramPoints.length - 1];

    const gridLines = [0, 25, 50, 75, 100].map((pct) => {
      const lineY = yPct(pct).toFixed(1);
      return `
        <line class="perf-grid-line" x1="${padL}" y1="${lineY}" x2="${width - padR}" y2="${lineY}" />
        <text class="perf-axis-text" x="${padL - 8}" y="${Number(lineY) + 3}" text-anchor="end">${pct}%</text>
      `;
    }).join("");

    const timeLabels = buildPerfTimeLabels(samples, x, height);

    cpuContainer.innerHTML = `
      <svg class="perf-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cpuAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16" />
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="ramAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#818cf8" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#818cf8" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${ramArea}" fill="url(#ramAreaGrad)" />
        <path d="${cpuArea}" fill="url(#cpuAreaGrad)" />
        <path d="${ramLine}" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${appLine}" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="3 3" stroke-linecap="round" />
        <path d="${cpuLine}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="perf-live-dot" cx="${lastRam.x.toFixed(1)}" cy="${lastRam.y.toFixed(1)}" r="4" fill="#818cf8" />
        <circle class="perf-live-dot" cx="${lastCpu.x.toFixed(1)}" cy="${lastCpu.y.toFixed(1)}" r="4.5" fill="#38bdf8" stroke="#fff" stroke-width="1.5" />
        ${timeLabels}
      </svg>
      <div id="perfCpuTooltip" class="perf-tooltip-overlay" style="display:none;"></div>
    `;

    cpuContainer.onmousemove = (e) => {
      const rect = cpuContainer.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.round(relX * (samples.length - 1))));
      const s = samples[idx];
      const tip = $("perfCpuTooltip");
      if (tip && s) {
        tip.style.display = "block";
        const tStr = new Date(s.sampledAt).toLocaleTimeString("pt-BR");
        const ramUsedGb = formatPerfBytes(s.memoryUsed);
        tip.innerHTML = `<strong>${tStr}</strong> • CPU: <span style="color:#38bdf8">${s.cpuPercent}%</span> • RAM: <span style="color:#818cf8">${ramUsedGb} (${Math.round((s.memoryUsed/s.memoryTotal)*100)}%)</span> • Backend: <span style="color:#94a3b8">${formatPerfBytes(s.processRss)}</span>`;
      }
    };
    cpuContainer.onmouseleave = () => {
      const tip = $("perfCpuTooltip");
      if (tip) tip.style.display = "none";
    };
  }

  // Gráfico 2: Latência HTTP & Event Loop
  const latContainer = $("perfLatencyChartContainer");
  if (latContainer) {
    const width = 740;
    const height = 205;
    const padL = 46;
    const padR = 20;
    const padT = 16;
    const padB = 30;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const bottomY = height - padB;

    const maxMs = Math.max(80, ...samples.map((s) => Math.max(Number(s.requestP95Ms) || 0, Number(s.eventLoopP95Ms) || 0))) * 1.15;
    const x = (i) => padL + (samples.length === 1 ? innerW / 2 : (i / (samples.length - 1)) * innerW);
    const yMs = (ms) => padT + (1 - Math.max(0, Number(ms) || 0) / maxMs) * innerH;

    const latPoints = samples.map((s, i) => ({ x: x(i), y: yMs(s.requestP95Ms || 0), s }));
    const loopPoints = samples.map((s, i) => ({ x: x(i), y: yMs(s.eventLoopP95Ms || 0), s }));

    const latLine = buildSmoothSvgPath(latPoints, padT, bottomY);
    const loopLine = buildSmoothSvgPath(loopPoints, padT, bottomY);

    const firstX = latPoints[0].x.toFixed(1);
    const lastX = latPoints[latPoints.length - 1].x.toFixed(1);
    const bottomYStr = bottomY.toFixed(1);
    const latArea = `${latLine} L ${lastX} ${bottomYStr} L ${firstX} ${bottomYStr} Z`;

    const lastLat = latPoints[latPoints.length - 1];
    const lastLoop = loopPoints[loopPoints.length - 1];

    const gridLines = [0, 0.33, 0.66, 1].map((ratio) => {
      const val = Math.round(maxMs * ratio);
      const lineY = yMs(val).toFixed(1);
      return `
        <line class="perf-grid-line" x1="${padL}" y1="${lineY}" x2="${width - padR}" y2="${lineY}" />
        <text class="perf-axis-text" x="${padL - 8}" y="${Number(lineY) + 3}" text-anchor="end">${val}ms</text>
      `;
    }).join("");

    const timeLabels = buildPerfTimeLabels(samples, x, height);

    latContainer.innerHTML = `
      <svg class="perf-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <path d="${latArea}" fill="url(#latencyAreaGrad)" />
        <path d="${loopLine}" fill="none" stroke="#2dd4bf" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${latLine}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="perf-live-dot" cx="${lastLoop.x.toFixed(1)}" cy="${lastLoop.y.toFixed(1)}" r="3.5" fill="#2dd4bf" />
        <circle class="perf-live-dot" cx="${lastLat.x.toFixed(1)}" cy="${lastLat.y.toFixed(1)}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5" />
        ${timeLabels}
      </svg>
      <div id="perfLatTooltip" class="perf-tooltip-overlay" style="display:none;"></div>
    `;

    latContainer.onmousemove = (e) => {
      const rect = latContainer.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.min(samples.length - 1, Math.max(0, Math.round(relX * (samples.length - 1))));
      const s = samples[idx];
      const tip = $("perfLatTooltip");
      if (tip && s) {
        tip.style.display = "block";
        const tStr = new Date(s.sampledAt).toLocaleTimeString("pt-BR");
        const latStr = s.requestP95Ms != null ? `${s.requestP95Ms} ms` : "0 ms";
        tip.innerHTML = `<strong>${tStr}</strong> • Latência HTTP p95: <span style="color:#f59e0b">${latStr}</span> • Event Loop: <span style="color:#2dd4bf">${s.eventLoopP95Ms} ms</span>`;
      }
    };
    latContainer.onmouseleave = () => {
      const tip = $("perfLatTooltip");
      if (tip) tip.style.display = "none";
    };
  }
}

function renderPerformanceAlerts(alerts = []) {
  const alertsEl = $("performanceAlerts");
  if (!alertsEl) return;
  if (!alerts.length) {
    alertsEl.className = "perf-alerts-bar";
    alertsEl.innerHTML = `
      <div class="perf-alert-healthy">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
        <span>Todos os sistemas operando normalmente. Sem gargalos de CPU, memória, latência ou armazenamento.</span>
      </div>
    `;
    return;
  }
  alertsEl.className = "perf-alerts-bar has-alerts";
  alertsEl.innerHTML = alerts.map((alert) => `
    <div class="perf-alert-entry">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span><strong>Atenção:</strong> ${escapeHtml(alert.message)}</span>
    </div>
  `).join("");
}

function renderPerformanceSlowRoutes(routes = []) {
  const container = $("performanceSlowRoutes");
  if (!container) return;
  const items = (Array.isArray(routes) ? routes : []).filter((route) => route?.route && route.requestP95Ms != null);
  if (!items.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <div class="perf-slow-routes-head">
      <strong>Rotas com maior tempo de resposta</strong>
      <span>Janela móvel de 5 minutos</span>
    </div>
    <div class="perf-slow-routes-list">
      ${items.map((route) => `
        <div class="perf-slow-route-row">
          <code>${escapeHtml(route.route)}</code>
          <span>${route.externalDependency ? "Integração externa" : "Processamento interno"}</span>
          <strong>${Number(route.requestP95Ms || 0)} ms</strong>
          <small>${Number(route.requestCount || 0)} reqs${Number(route.errors5xx || 0) ? ` · ${Number(route.errors5xx)} erros` : ""}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function setPerformanceInterval(ms) {
  performanceIntervalMs = ms;
  document.querySelectorAll("[data-perf-interval]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.perfInterval) === ms);
  });
  const liveBadge = $("perfLiveBadge");
  if (liveBadge) {
    if (ms > 0) {
      liveBadge.className = "perf-live-pill live";
      const lbl = liveBadge.querySelector(".live-label");
      if (lbl) lbl.textContent = "AO VIVO";
      liveBadge.title = `Transmissão ativa a cada ${ms / 1000}s`;
    } else {
      liveBadge.className = "perf-live-pill paused";
      const lbl = liveBadge.querySelector(".live-label");
      if (lbl) lbl.textContent = "PAUSADO";
      liveBadge.title = "Telemetria em tempo real pausada";
    }
  }
  startPerformanceStream();
  if (ms > 0) void loadPerformance();
}

function startPerformanceStream() {
  if (performanceStreamTimer) {
    clearInterval(performanceStreamTimer);
    performanceStreamTimer = null;
  }
  if (performanceIntervalMs > 0) {
    performanceStreamTimer = setInterval(() => {
      if ($("logsPanel")?.classList.contains("active") && !document.hidden) {
        void loadPerformance();
      }
    }, performanceIntervalMs);
  }
}

function stopPerformanceStream() {
  if (performanceStreamTimer) {
    clearInterval(performanceStreamTimer);
    performanceStreamTimer = null;
  }
}

function setupPerformanceControls() {
  document.querySelectorAll("[data-perf-interval]").forEach((btn) => {
    btn.onclick = () => {
      const ms = Number(btn.dataset.perfInterval) || 0;
      setPerformanceInterval(ms);
    };
  });
  const refreshBtn = $("perfManualRefreshBtn");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      refreshBtn.classList.add("spinning");
      try {
        await loadPerformance();
      } finally {
        setTimeout(() => refreshBtn.classList.remove("spinning"), 500);
      }
    };
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && $("logsPanel")?.classList.contains("active")) {
      startPerformanceStream();
      void loadPerformance();
    } else if (document.hidden) {
      stopPerformanceStream();
    }
  });
}

async function loadPerformance() {
  if (performanceLoading || document.hidden) return;
  performanceLoading = true;
  try {
    const data = await api("/api/admin/logs/performance");
    const metrics = data?.current;
    if (!metrics) {
      if ($("performanceStatus")) $("performanceStatus").textContent = "Coletando primeira amostra de telemetria.";
      return;
    }

    if (Array.isArray(data.history) && data.history.length) {
      performanceHistoryCache = data.history;
    } else {
      performanceHistoryCache.push(metrics);
      if (performanceHistoryCache.length > 60) performanceHistoryCache.shift();
    }

    if ($("perfHostMeta")) $("perfHostMeta").textContent = `Host · ${metrics.vcores || 2} vCPU`;
    if ($("perfUptimeMeta")) $("perfUptimeMeta").textContent = `Uptime: ${formatPerfUptime(metrics.uptimeSeconds)}`;
    if ($("performanceStatus")) {
      $("performanceStatus").textContent = `Atualizado ${new Date(metrics.sampledAt).toLocaleTimeString("pt-BR")} · HTTP: últimos 5m${metrics.sampleCapped ? " (amostra limitada)" : ""}`;
    }

    renderPerformanceKpis(metrics, performanceHistoryCache);
    renderPerformanceCharts(performanceHistoryCache, metrics);
    renderPerformanceAlerts(metrics.alerts);
    renderPerformanceSlowRoutes(metrics.slowestRoutes);
  } catch (error) {
    if ($("performanceStatus")) $("performanceStatus").textContent = `Telemetria indisponível: ${error.message}`;
  } finally {
    performanceLoading = false;
  }
}

async function loadLogs(options = {}) {
  void loadPerformance();
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
  if (!confirm(`Remover logs da visão do cinema com mais de ${days} dias e logs do diagnóstico técnico com mais de 3 dias? Esta ação não apaga pedidos nem registros fiscais.`)) return;
  try {
    const result = await api("/api/admin/logs", {
      method: "DELETE",
      body: JSON.stringify({ retentionDays: days, technicalRetentionDays: 3 })
    });
    showSuccess("Logs organizados", result.message || "A política de retenção foi aplicada com sucesso.");
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

function renderMiniPager(page, totalPages, totalItems, onPrevCall, onNextCall, label = "item(ns)") {
  if (totalPages <= 1) return "";
  return `
    <div class="dash-card-pager">
      <span>Página <b>${page}</b> de <b>${totalPages}</b> (${totalItems} ${label})</span>
      <div class="dash-card-pager-controls">
        <button class="ghost-button" type="button" ${page <= 1 ? "disabled" : ""} onclick="${onPrevCall}">← Anterior</button>
        <button class="ghost-button" type="button" ${page >= totalPages ? "disabled" : ""} onclick="${onNextCall}">Próxima →</button>
      </div>
    </div>
  `;
}

function changeDashMoviePage(delta) {
  state.dashMoviePage = Math.max(1, (state.dashMoviePage || 1) + delta);
  renderDashboard();
}

function changeDashSessionsPage(delta) {
  state.dashSessionsPage = Math.max(1, (state.dashSessionsPage || 1) + delta);
  renderDashboard();
}

function changeDashTopProductsPage(delta) {
  state.dashTopProductsPage = Math.max(1, (state.dashTopProductsPage || 1) + delta);
  renderDashboard();
}

function changeDashLatestOrdersPage(delta) {
  state.dashLatestOrdersPage = Math.max(1, (state.dashLatestOrdersPage || 1) + delta);
  renderDashboard();
}

function renderDashboard() {
  const data = state.dashboard || {};
  const dashboardTime = (value) => value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "--:--";
  if ($("dashRevenueToday")) $("dashRevenueToday").textContent = money(data.revenueToday || 0);
  if ($("dashRevenueMonth")) $("dashRevenueMonth").textContent = money(data.revenuePeriod ?? data.revenueMonth ?? 0);
  if ($("dashSalesToday")) $("dashSalesToday").textContent = Number(data.salesToday || 0);
  if ($("dashSalesMonth")) $("dashSalesMonth").textContent = Number(data.salesPeriod ?? data.salesMonth ?? 0);
  if ($("dashTicketsSold")) $("dashTicketsSold").textContent = Number(data.ticketsSold || 0);
  if ($("dashAverageTicket")) $("dashAverageTicket").textContent = money(data.averageConcessionOrder || 0);
  if ($("dashAverageOccupancy")) $("dashAverageOccupancy").textContent = `${Number(data.capacity?.occupancyRate || 0)}%`;
  if ($("dashCustomers")) $("dashCustomers").textContent = Number(data.customers || 0);
  if ($("dashSubscriptions")) $("dashSubscriptions").textContent = Number(data.activeSubscriptions || 0);
  if ($("dashPendingPayments")) $("dashPendingPayments").textContent = Number(data.pendingPayments || 0);
  if ($("dashPendingPaymentsAmount")) $("dashPendingPaymentsAmount").textContent = `${money(data.pendingPaymentsAmount || 0)} em aberto no período`;
  if ($("dashConcessionRevenue")) $("dashConcessionRevenue").textContent = money(data.concessionRevenue || 0);
  if ($("dashApprovedGrossRevenue")) $("dashApprovedGrossRevenue").textContent = money(data.approvedGrossRevenue || 0);
  if ($("dashRefundsPeriod")) $("dashRefundsPeriod").textContent = money(data.refundsPeriod || 0);
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
  if ($("dashPaymentSummary")) {
    const paymentSummary = data.paymentSummary || {};
    const rows = [
      ["approved", "Aprovados líquidos", "payments-approved", "Valor aprovado após devoluções"],
      ["pending", "Em aberto", "payments-pending", "Ainda não entram na receita"],
      ["failed", "Recusados ou cancelados", "payments-failed", "Não geram receita"],
      ["refunded", "Reembolsados", "payments-refunded", "Saíram da receita"],
      ["expired", "Expirados", "payments-expired", "Não podem mais ser pagos"]
    ].filter(([key]) => Number(paymentSummary[key]?.count || 0) > 0 || key === "approved" || key === "pending");
    $("dashPaymentSummary").innerHTML = rows.map(([key, label, className, hint]) => `
      <div class="metric-row payment-summary-row ${className}">
        <span>${label}<small>${hint} • ${Number(paymentSummary[key]?.count || 0)} pagamento(s)</small></span>
        <strong>${money(paymentSummary[key]?.amount || 0)}</strong>
      </div>`).join("");
  }
  if ($("dashRevenueComposition")) {
    const entries = Array.isArray(data.revenueComposition) ? data.revenueComposition : [];
    const total = entries.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    $("dashRevenueComposition").innerHTML = entries.some((item) => Number(item.amount || 0) > 0)
      ? entries.map((item) => {
          const reconciliation = Number(item.grossAmount || 0) > 0 || Number(item.refundAmount || 0) > 0
            ? `${Number(item.grossAmount || 0) > 0 ? ` • bruto ${money(item.grossAmount)}` : ""}${Number(item.discountAmount || 0) > 0 ? ` • descontos ${money(item.discountAmount)}` : ""}${Number(item.refundAmount || 0) > 0 ? ` • reembolsos ${money(item.refundAmount)}` : ""}`
            : "";
          return `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.label || "Receita")}<small>${escapeHtml(item.hint || "")}${reconciliation}${total ? ` • ${Math.round((Number(item.amount || 0) / total) * 100)}% da receita` : ""}</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`;
        }).join("")
      : `<div class="empty-state compact"><strong>Sem receita aprovada</strong><span>Ingressos, bomboniere e assinaturas aparecerão aqui quando forem pagos.</span></div>`;
  }
  if ($("dashMovieRevenue")) {
    const movies = Array.isArray(data.revenueByMovie) ? data.revenueByMovie : [];
    const total = movies.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pageSize = state.dashMoviePageSize || 5;
    const totalPages = Math.max(1, Math.ceil(movies.length / pageSize));
    state.dashMoviePage = Math.min(Math.max(1, state.dashMoviePage || 1), totalPages);
    const start = (state.dashMoviePage - 1) * pageSize;
    const pageMovies = movies.slice(start, start + pageSize);

    $("dashMovieRevenue").innerHTML = movies.length
      ? pageMovies.map((item) => `
          <div class="metric-row finance-row">
            <span>${escapeHtml(item.name || "Filme")}<small>${total ? Math.round((Number(item.amount || 0) / total) * 100) : 0}% da receita de ingressos</small></span>
            <strong>${money(item.amount)}</strong>
          </div>`).join("") + renderMiniPager(state.dashMoviePage, totalPages, movies.length, "changeDashMoviePage(-1)", "changeDashMoviePage(1)", "filme(s)")
      : `<div class="empty-state compact"><strong>Sem receita por filme</strong><span>As vendas aprovadas por sessão entram nesta lista.</span></div>`;
  }
  if ($("dashUpcomingSessions")) {
    const sessions = data.todaySessions || data.upcomingSessions || [];
    const pageSize = state.dashSessionsPageSize || 4;
    const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
    state.dashSessionsPage = Math.min(Math.max(1, state.dashSessionsPage || 1), totalPages);
    const start = (state.dashSessionsPage - 1) * pageSize;
    const pageSessions = sessions.slice(start, start + pageSize);

    $("dashUpcomingSessions").innerHTML = sessions.length
      ? pageSessions.map((item) => `
          <div class="session-metric-row clickable-row ${item.isInProgress ? "is-in-progress" : ""}" onclick="openSessionDashboardDetail('${escapeHtml(item.movie?.id || "")}', '${escapeHtml(item.session?.id || "")}')">
            <div class="session-poster">${item.movie?.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(item.movie.posterUrl))}" alt="">` : `<span>${escapeHtml(item.movie?.rating || "L")}</span>`}</div>
            <div>
              <strong>${escapeHtml(item.movie?.title || "Filme")} • ${escapeHtml(item.session?.time || "-")}${item.isInProgress ? ` <em class="session-live-badge">EM ANDAMENTO</em>` : ""}</strong>
              <span>${escapeHtml(item.session?.format || "")}</span>
              <div class="mini-progress"><i style="width:${Math.min(100, Number(item.occupancyRate || 0))}%"></i></div>
              <small>${item.isInProgress ? `Termina às ${dashboardTime(item.endsAt)} • faltam ${Number(item.remainingMinutes || 0)} min • ` : ""}${Number(item.sold || 0)} / ${Number(item.capacity || 0)} • ${Number(item.occupancyRate || 0)}% • ${escapeHtml(item.status || "Boa disponibilidade")}</small>
            </div>
          </div>`).join("") + renderMiniPager(state.dashSessionsPage, totalPages, sessions.length, "changeDashSessionsPage(-1)", "changeDashSessionsPage(1)", "sessão(ões)")
      : `<div class="empty-state compact"><strong>Nenhuma sessão programada para hoje.</strong><span>Cadastre um horário quando a programação estiver definida.</span><button class="ghost-button" type="button" onclick="createSessionFromDashboard()">Criar sessão</button></div>`;
  }
  if ($("dashCapacity")) {
    const capacity = data.capacity || {};
    $("dashCapacity").innerHTML = `
      <div class="metric-row"><span>Sessões consideradas</span><strong>${Number(capacity.sessions || 0)}</strong></div>
      <div class="metric-row"><span>Lugares ocupados</span><strong>${Number(capacity.occupied || 0)}</strong></div>
      <div class="metric-row"><span>Lugares nas sessões ativas</span><strong>${Number(capacity.roomCapacity || 0)}</strong></div>
      <div class="metric-row"><span>Ocupação estimada</span><strong>${Number(capacity.occupancyRate || 0)}%</strong></div>
    `;
  }
  if ($("dashTopProducts")) {
    const products = data.topProducts || [];
    const pageSize = state.dashTopProductsPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
    state.dashTopProductsPage = Math.min(Math.max(1, state.dashTopProductsPage || 1), totalPages);
    const start = (state.dashTopProductsPage - 1) * pageSize;
    const pageProducts = products.slice(start, start + pageSize);

    $("dashTopProducts").innerHTML = products.length
      ? pageProducts.map((item) => `<div class="metric-row clickable-row" onclick="activatePanel('concessionsPanel', { scroll: true })"><span>${escapeHtml(item.name)}<small>${Number(item.quantity || 0)} item(ns) • bruto ${money(item.grossRevenue || 0)}${Number(item.discountTotal ?? (Number(item.grossRevenue || 0) - Number(item.netRevenue || 0))) > 0 ? ` • descontos ${money(item.discountTotal ?? (Number(item.grossRevenue || 0) - Number(item.netRevenue || 0)))}` : ""}${Number(item.refundTotal || 0) > 0 ? ` • reembolsos ${money(item.refundTotal)}` : ""} • líquido ${money(item.netRevenue ?? item.revenue ?? 0)}</small></span><strong>${money(item.netRevenue ?? item.revenue ?? 0)}</strong></div>`).join("") + renderMiniPager(state.dashTopProductsPage, totalPages, products.length, "changeDashTopProductsPage(-1)", "changeDashTopProductsPage(1)", "produto(s)")
      : `<div class="empty-state compact"><strong>Nenhum produto vendido no período.</strong><span>Produtos vendidos aparecerão aqui.</span><button class="ghost-button" type="button" onclick="activatePanel('concessionsPanel', { scroll: true })">Ver Bomboniere</button></div>`;
  }
  if ($("dashLatestOrders")) {
    const orders = data.latestOrders || [];
    const pageSize = state.dashLatestOrdersPageSize || 5;
    const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
    state.dashLatestOrdersPage = Math.min(Math.max(1, state.dashLatestOrdersPage || 1), totalPages);
    const start = (state.dashLatestOrdersPage - 1) * pageSize;
    const pageOrders = orders.slice(start, start + pageSize);

    $("dashLatestOrders").innerHTML = orders.length
      ? pageOrders.map((order) => `<div class="metric-row clickable-row" onclick="openOrderView('${escapeHtml(order.id)}')"><span>${escapeHtml(order.reference || orderReference(order))} • ${escapeHtml(order.customerName)}<small>${escapeHtml(order.movieTitle || "")} • ${escapeHtml(order.origin)} • ${escapeHtml(order.status)}</small></span><strong>${money(order.totalPrice)}</strong></div>`).join("") + renderMiniPager(state.dashLatestOrdersPage, totalPages, orders.length, "changeDashLatestOrdersPage(-1)", "changeDashLatestOrdersPage(1)", "pedido(s)")
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
      <div class="dash-club-compact-grid">
        <div class="dash-club-stat clickable-row" onclick="activatePanel('clubPanel', { scroll: true })">
          <span>Assinaturas ativas</span>
          <strong>${Number(club.activeSubscriptions || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Receita recorrente</span>
          <strong>${money(club.recurringRevenueEstimate || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Novos no período</span>
          <strong>${Number(club.newSubscribers || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Cancelamentos</span>
          <strong>${Number(club.cancellations || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Ingressos via Clube</span>
          <strong>${Number(club.clubTickets || 0)}</strong>
        </div>
        <div class="dash-club-stat">
          <span>Créditos usados</span>
          <strong>${Number(club.creditsUsed || 0)}</strong>
        </div>
      </div>
      <div class="dash-club-footer-link">
        <button class="ghost-button" type="button" onclick="activatePanel('clubPanel', { scroll: true })">
          Gerenciar Clube →
        </button>
      </div>
    `;
  }
  if ($("dashOperationalAlerts")) {
    const alerts = [];
    if (data.cardTerminal && !data.cardTerminal.configured) alerts.push(["Maquininha sem integração automática", "Vendas por cartão serão registradas manualmente."]);
    (data.lowStockProducts || []).forEach((item) => alerts.push([`Estoque baixo: ${item.name}`, `${item.stock} unidade(s) disponíveis.`]));
    (data.todaySessions || []).filter((item) => item.isInProgress).forEach((item) => alerts.push([`${item.movie.title} • sessão em andamento`, `Termina às ${dashboardTime(item.endsAt)} • faltam ${item.remainingMinutes} min.`]));
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
  const padLeft = 68;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 46;
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

  let dateIndices = [];
  if (rows.length <= 7) {
    dateIndices = rows.map((_, i) => i);
  } else {
    const maxLabels = Math.min(7, Math.max(4, Math.floor((width - padLeft - padRight) / 80)));
    const step = (rows.length - 1) / Math.max(1, maxLabels - 1);
    for (let k = 0; k < maxLabels; k++) {
      const idx = Math.round(k * step);
      if (!dateIndices.includes(idx)) dateIndices.push(idx);
    }
  }
  const dateSet = new Set(dateIndices);

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
          ${dateSet.has(index) ? `<text class="chart-date" x="${x(index)}" y="${height - 16}" text-anchor="middle">${dateLabel}</text>` : ""}
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
    card_terminal: "Débito/crédito na Point",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
    point_qr: "Pix na Point",
    external_pix: "Pix registrado no balcão",
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
  if (!$("movieDuration").value.trim()) {
    showToast("Informe a duração do filme antes de publicar.", "error");
    setMovieWizardStep(1);
    $("movieDuration").focus();
    return false;
  }
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
          <div class="movie-thumb">${movie.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(movie.posterUrl))}" alt="">` : `<span>${escapeHtml(movie.rating || "L")}</span>`}</div>
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
  state.movieDraftMetadata = structuredClone(movie?.metadata || {});
  $("movieDirector").value = movie?.director || "";
  $("movieTag").value = movie?.tag ?? "";
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
              ${movie.posterUrl ? `<img src="${escapeHtml(adminAssetUrl(movie.posterUrl))}" alt="">` : ""}
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
      slug: movie.slug || movie.id,
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
    const durationMessage = movie.duration
      ? ` Duração oficial importada: ${movie.duration}.`
      : " O TMDB não informou a duração; preencha esse campo antes de publicar.";
    $("tmdbMessage").textContent = (existingId
      ? "Dados importados no filme selecionado. Revise e salve para atualizar."
      : "Dados importados. Revise o status e salve o filme.") + durationMessage;
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

function upsertAdminCollection(collection, item) {
  if (!state.content || !item?.id) return;
  const items = Array.isArray(state.content[collection]) ? state.content[collection] : [];
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  state.content[collection] = items;
}

function removeAdminCollectionItem(collection, id) {
  if (!state.content) return;
  state.content[collection] = (state.content[collection] || []).filter((item) => item.id !== id);
}

function applySessionMutation(movieId, session, removed = false) {
  const movie = (state.content?.movies || []).find((item) => item.id === movieId);
  if (!movie || !session?.id) return;
  movie.sessions ||= [];
  const index = movie.sessions.findIndex((item) => item.id === session.id);
  if (removed) movie.sessions = movie.sessions.filter((item) => item.id !== session.id);
  else if (index >= 0) movie.sessions[index] = session;
  else movie.sessions.push(session);
  movie.sessions.sort((a, b) => String(`${a.date} ${a.time}`).localeCompare(String(`${b.date} ${b.time}`)));
  movie.updatedAt = new Date().toISOString();
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
      ...(state.movieDraftMetadata || {}),
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
    upsertAdminCollection("movies", saved);
    renderMovies();
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
    if (result.archived && result.movie) upsertAdminCollection("movies", result.movie);
    else removeAdminCollectionItem("movies", movie.id);
    renderMovies();
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

  if (sessionId) {
    const previous = (state.movieDraftSessions || []).find((item) => item.id === sessionId) || {};
    const sensitiveChange = ["date", "time", "room", "format"].some((field) => String(previous[field] || "") !== String(payload[field] || ""))
      || payload.status === "cancelled";
    const hasHistory = (state.content?.tickets || []).some((ticket) => ticket.sessionId === sessionId)
      || (state.content?.orders || []).some((order) => order.sessionId === sessionId);
    if (sensitiveChange && hasHistory) {
      if (!confirm("Esta sessão possui vendas. Confirmar a alteração pode mudar os dados dos ingressos já emitidos e, em caso de cancelamento, exigir reembolso.")) return;
      const reason = prompt("Informe o motivo da alteração:", "Ajuste operacional da sessão");
      if (reason === null) return;
      payload.confirmSalesImpact = true;
      payload.changeReason = reason.trim();
    }
  }

  try {
    setDisabled("saveSessionButton", true);
    const result = await api(`/api/movies/${encodeURIComponent(movieId)}/sessions${sessionId ? `/${encodeURIComponent(sessionId)}` : ""}`, {
      method: sessionId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    closeSessionEditor();
    if (range) (result.created || []).forEach((session) => applySessionMutation(movieId, session));
    else applySessionMutation(movieId, result);
    renderMovies();
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
    applySessionMutation(movieId, session, true);
    renderMovies();
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
    const saved = await api(`/api/movies/${encodeURIComponent(movie.id)}`, {
      method: "PUT",
      body: JSON.stringify({ ...movieData, workflowStatus: "archived", status: "hidden", isHighlight: false })
    });
    upsertAdminCollection("movies", saved);
    renderMovies();
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
    upsertAdminCollection("movies", copy);
    renderMovies();
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
        >${seat.accessibility ? `<span class="room-seat-button-marker">${roomSeatAccessibilityIcon(seat.accessibility)}</span>` : ""}<span class="room-seat-button-label">${escapeHtml(seat.label)}</span></button>
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
    upsertAdminCollection("rooms", saved);
    if (existingId) {
      const label = `${saved.name}${saved.technology ? ` (${saved.technology})` : ""}`;
      (state.content?.movies || []).forEach((movie) => (movie.sessions || []).forEach((session) => {
        if (session.roomId === saved.id) session.room = label;
      }));
      (state.content?.orders || []).forEach((order) => { if (order.sessionRoomId === saved.id || order.roomId === saved.id) order.sessionRoom = label; });
      (state.content?.tickets || []).forEach((ticket) => { if (ticket.sessionRoomId === saved.id || ticket.roomId === saved.id) ticket.sessionRoom = label; });
    }
    renderRooms();
    renderRoomOptions();
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
    removeAdminCollectionItem("rooms", room.id);
    renderRooms();
    renderRoomOptions();
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
    upsertAdminCollection("ticketTypes", saved);
    renderTickets();
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
    removeAdminCollectionItem("ticketTypes", ticket.id);
    renderTickets();
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
    if (state.orderFilters.archiveStatus === "archived") return isOrderEffectivelyArchived(order);
    if (state.orderFilters.archiveStatus === "active") return isOrderEffectivelyActive(order);
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
      ? "Os pedidos arquivados (validados por QR Code, cancelados ou reembolsados) ficam preservados aqui."
      : "Ajuste a busca ou aguarde uma nova venda."
  });
  const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
  let todayOrders = orders.filter((order) => isOrderEffectivelyActive(order) && String(order.createdAt || "").slice(0, 10) === today);
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
  const legacyCount = Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
  const itemCount = (order.ticketItems || []).reduce((total, item) => {
    const explicitTickets = Number(item.ticketQuantity || 0);
    const quantity = Math.max(0, Number(item.quantity || 0));
    const bundleQuantity = Math.max(1, Number(item.bundleQuantity || 1));
    return total + (explicitTickets > 0 ? explicitTickets : quantity * bundleQuantity);
  }, 0);
  const issuedCount = Array.isArray(order.tickets) ? order.tickets.length : 0;
  return Math.max(0, legacyCount, itemCount, issuedCount);
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
                const isArchived = isOrderEffectivelyArchived(order);
                return `
                <tr class="order-table-row ${isArchived ? "is-archived" : ""}" onclick="openOrderView('${escapeHtml(order.id)}')">
                  <td data-label="Data/Hora"><strong>${escapeHtml(orderReference(order))}</strong><br><span class="list-meta">${new Date(order.createdAt).toLocaleString("pt-BR")}</span></td>
                  <td data-label="Cliente">${escapeHtml(customerLabel)}<br><span class="list-meta">${escapeHtml(quickSale ? "Sem identificação do cliente" : order.customerPhone || order.customerEmail || "")}</span></td>
                  <td data-label="Filme/Sessão"><strong>${escapeHtml(order.movieTitle || "-")}</strong><br><span class="list-meta">${escapeHtml([order.sessionTime, order.sessionFormat].filter(Boolean).join(" • ") || "-")}</span></td>
                  <td data-label="Itens">${orderTicketCount(order)} ingresso(s)<br><span class="list-meta">${extras}</span>${tickets ? `<div class="ticket-code-row">${tickets}</div>` : ""}</td>
                  <td data-label="Total"><strong>${money(order.totalPrice)}</strong></td>
                  <td data-label="Pagamento">${escapeHtml(originLabel(order.origin || "online"))}<br><span class="list-meta">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span></td>
                  <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>${isArchived ? '<span class="status-label archived">Arquivado</span>' : ""}</div></td>
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
  const val = getOrderValidationSummary(order);
  const tickets = (order.tickets || []).map((ticket) => `
    <button class="copy-code" type="button" onclick="copyTicketCode('${escapeHtml(ticket.code)}')">${escapeHtml(ticket.code)}</button>
    <span class="list-meta">${escapeHtml(orderStatusLabel(ticket.status))}</span>
  `).join("<br>") || "-";
  const extras = (order.concessionItems || []).map((item) => `${escapeHtml(item.name || item.id)} x${Number(item.quantity || 0)}`).join("<br>") || "-";
  const history = (order.auditTrail || []).map((entry) => `${escapeHtml(entry.action || "alteração")} • ${new Date(entry.at || order.createdAt).toLocaleString("pt-BR")}`).join("<br>") || `Criação • ${new Date(order.createdAt).toLocaleString("pt-BR")}`;
  const serviceItems = (state.content?.orderServiceItems || []).filter((item) => item.orderId === order.id);
  const goodsItems = (state.content?.orderGoodsItems || []).filter((item) => item.orderId === order.id);
  const fiscalDocument = (state.content?.goodsFiscalDocuments || []).find((item) => item.orderId === order.id);
  const goodsFiscalLabel = {
    not_required: "Não necessária",
    waiting_trigger: "Aguardando entrega ou gatilho configurado",
    pending: "Em processamento",
    authorized: "Autorizada",
    contingency: "Em contingência",
    cancelled: "Cancelada",
    error: "Erro no provider fiscal"
  }[fiscalDocument?.status || order.goodsFiscalStatus] || "Não configurada";
  const serviceRows = serviceItems.map((item) => `${escapeHtml(item.name || "Ingresso")} • base ${money(item.basePrice)} • crédito ${money(item.subscriptionCreditAmount)} • complemento ${money(item.additionalPaymentAmount)}`).join("<br>") || "-";
  const goodsRows = goodsItems.map((item) => `${escapeHtml(item.name || item.sku || "Produto")} x${Number(item.quantity || 0)} • desconto ${money(item.clubDiscount)} • final ${money(Number(item.finalUnitPrice || 0) * Number(item.quantity || 0))}`).join("<br>") || "-";
  return `
    ${sectionHtml("Pedido", [
      ["Referência", orderReference(order)],
      ["Data", new Date(order.createdAt).toLocaleString("pt-BR")],
      ["Origem", originLabel(order.origin || "online")],
      ["Status", orderStatusLabel(order.status)],
      ["Arquivamento", isOrderEffectivelyArchived(order)
        ? `Arquivado ${order.archivedAt ? `em ${new Date(order.archivedAt).toLocaleString("pt-BR")}` : isOrderSessionExpired(order) ? "(sessão de cinema expirada)" : "(pedido concluído / cancelado)"}`
        : "Pedido ativo (aguardando validação ou pagamento)"]
    ])}
    ${sectionHtml("Cliente", [
      ["Tipo", order.saleMode === "quick" ? "Venda rápida" : order.customerUserId ? "Usuário cadastrado" : "Cliente avulso"],
      ["Nome", order.saleMode === "quick" ? "Sem identificação do cliente" : order.customerName || "Cliente avulso"],
      ["Contato", [order.customerPhone, order.customerEmail].filter(Boolean).join(" • ") || "-"]
    ])}
    ${sectionHtml("Sessão", [
      ["Filme", `${movie?.posterUrl ? `<img class="inline-poster" src="${escapeHtml(adminAssetUrl(movie.posterUrl))}" alt="">` : ""}${escapeHtml(order.movieTitle || movie?.title || "-")}`],
      ["Data e horário", [order.sessionDate, order.sessionTime].filter(Boolean).join(" • ") || order.sessionTime || "-"],
      ["Sala", order.sessionRoom || "Sala Cruzeiro"],
      ["Poltronas", Array.isArray(order.selectedSeats) && order.selectedSeats.length ? order.selectedSeats.map((seat) => seat.label).join(", ") : "Lugar livre"],
      ["Formato", order.sessionFormat || "-"]
    ])}
    ${sectionHtml("Ingressos", [
      ["Quantidade", `${orderTicketCount(order)} ingresso(s)`],
      ["Status no cinema", isOrderSessionExpired(order) ? "Sessão já expirada (Não reembolsável)" : val.ticketsValidated ? "Validados no cinema (Não reembolsável)" : val.ticketsCancelled ? "Cancelados / Reembolsados" : "Aguardando validação QR Code"],
      ["Códigos", tickets]
    ])}
    ${sectionHtml("Serviços de cinema", [
      ["Ingressos", serviceRows],
      ["Subtotal", money(order.serviceSubtotal || 0)],
      ["Créditos do Clube", money(order.clubCreditsApplied || 0)],
      ["Tratamento fiscal", "Conforme regra contábil vigente do Clube"]
    ])}
    ${sectionHtml("Mercadorias da bomboniere", [
      ["Status no balcão", val.concessionsDelivered ? "Entregue no balcão (Não reembolsável)" : val.concessionsCancelled ? "Cancelada / Reembolsada" : (order.concessionItems && order.concessionItems.length) ? "Aguardando retirada" : "Sem itens de bomboniere"],
      ["Produtos", goodsRows === "-" ? extras : goodsRows],
      ["Subtotal", money(order.goodsSubtotal || 0)],
      ["Status NFC-e", goodsFiscalLabel]
    ])}
    ${sectionHtml("Pagamento", [
      ["Método", paymentMethodLabel(payment?.method || order.paymentMethod)],
      ["Provider", providerLabel(payment?.provider || order.paymentProvider)],
      ["Valor", money(payment?.amount ?? order.totalPrice)],
      ["Complemento pago", money(order.additionalPayment || 0)],
      ["Status", paymentStatusLabel(payment?.status || order.paymentStatus)],
      ["Reembolso", order.refundStatus === "required" ? "Devolução manual necessária" : order.refundStatus === "completed" ? "Concluído" : order.refundStatus === "pending" ? "Em processamento" : "-"],
      ["Orientação", order.manualRefundReason || payment?.metadata?.manualRefund?.reason || "-"],
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

  const isArchived = isOrderEffectivelyArchived(order);
  const isCancelledOrRefunded = !order || ["cancelled", "refunded"].includes(order.status);
  const val = getOrderValidationSummary(order);
  const cancelBtn = $("orderCancelButton");
  const refundTicketsBtn = $("orderRefundTicketsButton");
  const refundConcessionsBtn = $("orderRefundConcessionsButton");

  if (isCancelledOrRefunded || isArchived || isOrderFullyValidated(order)) {
    cancelBtn.hidden = true;
    if (refundTicketsBtn) refundTicketsBtn.hidden = true;
    if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
  } else if (order.status === "paid") {
    if (val.hasTickets && val.hasConcessions) {
      if (!val.ticketsValidated && !val.concessionsDelivered) {
        cancelBtn.hidden = false;
        cancelBtn.textContent = "Cancelar pedido integral";
        if (refundTicketsBtn) {
          refundTicketsBtn.hidden = false;
          refundTicketsBtn.textContent = "Reembolsar apenas ingressos";
        }
        if (refundConcessionsBtn) {
          refundConcessionsBtn.hidden = false;
          refundConcessionsBtn.textContent = "Reembolsar apenas bomboniere";
        }
      } else if (val.ticketsValidated && !val.concessionsDelivered && val.concessionsPending) {
        cancelBtn.hidden = true;
        if (refundTicketsBtn) refundTicketsBtn.hidden = true;
        if (refundConcessionsBtn) {
          refundConcessionsBtn.hidden = false;
          refundConcessionsBtn.textContent = "Reembolsar bomboniere (ingressos já validados)";
        }
      } else if (val.concessionsDelivered && !val.ticketsValidated && val.ticketsPending) {
        cancelBtn.hidden = true;
        if (refundTicketsBtn) {
          refundTicketsBtn.hidden = false;
          refundTicketsBtn.textContent = "Reembolsar ingressos (bomboniere já entregue)";
        }
        if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
      } else {
        cancelBtn.hidden = true;
        if (refundTicketsBtn) refundTicketsBtn.hidden = true;
        if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
      }
    } else {
      cancelBtn.hidden = false;
      cancelBtn.textContent = "Cancelar pedido";
      if (refundTicketsBtn) refundTicketsBtn.hidden = true;
      if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
    }
  } else {
    cancelBtn.hidden = false;
    cancelBtn.textContent = "Cancelar pedido";
    if (refundTicketsBtn) refundTicketsBtn.hidden = true;
    if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
  }

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

async function executeOrderRefundTickets(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  const reason = prompt("Informe o motivo para reembolsar o valor dos ingressos deste pedido:", "Cancelamento de ingressos pelo painel");
  if (reason === null) return;
  try {
    const result = await api(`/api/orders/${encodeURIComponent(order.id)}/refund-tickets`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast(result.message || `Ingressos reembolsados: ${money(result.refundedAmount || 0)}`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function executeOrderRefundConcessions(orderId = state.selectedOrderId) {
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  const reason = prompt("Informe o motivo para reembolsar o valor da bomboniere deste pedido:", "Cancelamento de bomboniere pelo painel");
  if (reason === null) return;
  try {
    const result = await api(`/api/orders/${encodeURIComponent(order.id)}/refund-concessions`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast(result.message || `Bomboniere reembolsada: ${money(result.refundedAmount || 0)}`);
  } catch (error) {
    showToast(error.message, "error");
  }
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
  if (["cancelled", "refunded"].includes(order.status)) {
    showToast("Este pedido já foi cancelado. Agora ele pode ser arquivado ou excluído.", "error");
    return;
  }
  const draft = ["draft", "test"].includes(order.status);
  const action = draft ? "excluir" : "cancelar";
  const reason = prompt(`Informe o motivo para ${action} este pedido.${order.status === "paid" ? " O pagamento Mercado Pago aprovado sera reembolsado integralmente, quando elegivel." : ""}`);
  if (reason === null) return;
  try {
    const result = await api(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: draft ? "DELETE" : "PATCH",
      body: JSON.stringify(draft ? { reason } : { action: "cancel", reason })
    });
    await loadContent({ silent: true });
    closeOrderOverlay();
    showToast(result.manualRefundRequired
      ? `Pedido cancelado. ${result.manualRefundReason || "A devolução deve ser concluída manualmente."}`
      : result.order?.refundStatus === "completed"
      ? "Pedido reembolsado pelo Mercado Pago."
      : draft
      ? "Pedido excluído."
      : "Pedido cancelado.");
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
  document.querySelectorAll('[data-floating-menu-trigger][aria-expanded="true"]').forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
  menu.hidden = true;
  menu.innerHTML = "";
  menu.classList.remove("campaign-history-popover");
  menu.removeAttribute("role");
  menu.removeAttribute("aria-label");
  delete menu.dataset.campaignId;
  delete menu.dataset.orderId;
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
  floating.classList.remove("campaign-history-popover");
  floating.removeAttribute("role");
  floating.removeAttribute("aria-label");
  delete floating.dataset.campaignId;
  const order = (state.content?.orders || []).find((item) => item.id === orderId);
  if (!order) return;
  const isArchived = isOrderEffectivelyArchived(order);
  const terminated = ["cancelled", "refunded"].includes(order.status) || isOrderFullyValidated(order);
  if (!floating.hidden && floating.dataset.orderId === orderId) {
    closeFloatingActionMenu();
    return;
  }
  floating.dataset.orderId = orderId;
  floating.innerHTML = `
    <button type="button" onclick="openOrderView('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Visualizar</button>
    ${terminated ? "" : `<button type="button" onclick="openOrderEdit('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Editar</button>
    <button type="button" onclick="printOrderTicket('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Imprimir ingresso</button>
    <button type="button" onclick="resendOrderTicket('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Reenviar ingresso</button>`}
    ${isArchived || terminated ? "" : `<button type="button" onclick="cancelOrDeleteOrder('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Cancelar</button>`}
    ${order.archived
      ? `<button type="button" onclick="restoreOrderAdmin('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Restaurar pedido</button>`
      : isArchived
      ? ""
      : `<button type="button" onclick="archiveOrderAdmin('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Arquivar</button>`}
    <button class="danger-text" type="button" onclick="openPermanentDelete('${escapeHtml(orderId)}'); closeFloatingActionMenu()">Excluir permanentemente</button>
  `;
  positionFloatingMenu(anchor, floating);
}

function toggleEmailCampaignMenu(campaignId, event) {
  event?.stopPropagation();
  const floating = $("floatingActionMenu");
  const anchor = event?.currentTarget;
  if (!floating || !anchor) return;
  if (!floating.hidden && floating.dataset.campaignId === campaignId) {
    closeFloatingActionMenu();
    return;
  }
  const campaign = (state.content?.emailCampaigns || []).find((item) => String(item.id) === String(campaignId));
  if (!campaign) return;
  closeFloatingActionMenu();
  const editable = ["draft", "failed"].includes(campaign.status);
  const cancellable = ["scheduled", "queued", "sending"].includes(campaign.status);
  const reportable = ["queued", "sending", "completed", "completed_with_errors", "failed", "sent", "cancelled"].includes(campaign.status);
  const retryable = ["completed_with_errors", "failed"].includes(campaign.status);
  const safeId = escapeHtml(campaignId);
  floating.dataset.campaignId = campaignId;
  floating.classList.add("campaign-history-popover");
  floating.setAttribute("role", "menu");
  floating.setAttribute("aria-label", "Ações da campanha");
  floating.innerHTML = `
    ${editable ? `<button type="button" role="menuitem" data-campaign-edit="${safeId}" onclick="void editEmailCampaign('${safeId}').finally(closeFloatingActionMenu)">Abrir</button>` : ""}
    ${campaign.status === "draft" ? `<button type="button" role="menuitem" onclick="void sendExistingEmailCampaign('${safeId}').finally(closeFloatingActionMenu)">Enviar agora</button>` : ""}
    ${reportable ? `<button type="button" role="menuitem" onclick="void viewEmailCampaignReport('${safeId}').finally(closeFloatingActionMenu)">${["queued", "sending"].includes(campaign.status) ? "Ver progresso" : "Ver relatório"}</button>` : ""}
    ${retryable ? `<button type="button" role="menuitem" onclick="void retryEmailCampaignFailures('${safeId}').finally(closeFloatingActionMenu)">Reenviar falhas</button>` : ""}
    ${cancellable ? `<button class="danger-text" type="button" role="menuitem" onclick="void cancelEmailCampaign('${safeId}').finally(closeFloatingActionMenu)">Cancelar</button>` : ""}
    <button type="button" role="menuitem" data-campaign-duplicate="${safeId}" onclick="void duplicateEmailCampaign('${safeId}').finally(closeFloatingActionMenu)">Duplicar</button>
    ${["draft", "failed", "cancelled"].includes(campaign.status) ? `<button class="danger-text" type="button" role="menuitem" data-campaign-delete="${safeId}" onclick="void deleteEmailCampaign('${safeId}').finally(closeFloatingActionMenu)">Excluir</button>` : ""}
  `;
  anchor.setAttribute("aria-expanded", "true");
  positionFloatingMenu(anchor, floating);
  floating.querySelector("button")?.focus({ preventScroll: true });
}

async function copyTicketCode(code) {
  await navigator.clipboard?.writeText(code).catch(() => null);
  showToast("Código copiado.");
}

function printOrderTicket(orderId) {
  const popup = window.open(`${API_BASE}/api/admin/orders/${encodeURIComponent(orderId)}/print`, "_blank");
  if (popup) popup.opener = null;
  else showToast("Permita pop-ups para abrir a via PDV.", "error");
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

function changePaymentsPage(delta) {
  state.paymentsPage = Math.max(1, (state.paymentsPage || 1) + delta);
  renderPaymentsCenter();
}

function renderPaymentsCenter() {
  const target = $("paymentsList");
  if (!target) return;
  const data = state.payments || {};
  if ($("paymentProviderStatus")) {
    $("paymentProviderStatus").textContent = data.cardTerminal?.configured
      ? `Terminal Point integrado: ${data.cardTerminal.provider}.`
      : "Terminal Point não configurado. Ative a integração para receber Pix, débito ou crédito na Bilheteria.";
  }
  const allRows = data.payments || [];
  if (!allRows.length) {
    target.innerHTML = `<div class="empty-state"><strong>Nenhum pagamento encontrado.</strong><span>Ajuste os filtros ou selecione outro período.</span></div>`;
    return;
  }

  const pageSize = state.paymentsPageSize || 8;
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize));
  state.paymentsPage = Math.min(Math.max(1, state.paymentsPage || 1), totalPages);
  const start = (state.paymentsPage - 1) * pageSize;
  const rows = allRows.slice(start, start + pageSize);

  const pagerMarkup = `
    <div class="table-pagination-bar">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + rows.length, allRows.length)}</strong> de <strong>${allRows.length}</strong> pagamento(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.paymentsPage <= 1 ? "disabled" : ""} onclick="changePaymentsPage(-1)">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.paymentsPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.paymentsPage >= totalPages ? "disabled" : ""} onclick="changePaymentsPage(1)">Próxima →</button>
      </div>
    </div>
  `;

  target.innerHTML = `
    ${pagerMarkup}
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

function manualSessionDateIso(value = "") {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : null;
  if (!parts) return "";
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : "";
}

function manualSessionDateDisplay(value = "") {
  const iso = manualSessionDateIso(value);
  if (!iso) return String(value || "");
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function maskManualSessionDate(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

function isManualSessionSellable(session = {}, now = new Date()) {
  if (!session || ["sold_out", "cancelled", "hidden", "archived"].includes(String(session.status || "").trim().toLowerCase())) return false;
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
  if (!dateInput.value) dateInput.value = manualSessionDateDisplay(availableDates[0] || today);
  const selectedDate = manualSessionDateIso(dateInput.value);

  const moviesForDate = movies.filter((movie) => manualSessionsForDate(movie, selectedDate).length);
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
  const selectedDate = manualSessionDateIso($("manualSessionDate")?.value || "");
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
  void loadManualSeatMap();
  updateManualTotal();
}

function currentManualMovieSession() {
  const movie = (state.content?.movies || []).find((item) => item.id === $("manualMovieSelect").value);
  const session = manualSessionsForDate(movie, manualSessionDateIso($("manualSessionDate")?.value || ""))
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
    reconcileManualSeatSelection();
    updateManualTotal();
  }));
  target.querySelectorAll("[data-manual-ticket-quantity]").forEach((input) => input.addEventListener("input", () => {
    input.value = Math.max(0, Number(input.value || 0));
    reconcileManualSeatSelection();
    updateManualTotal();
  }));
}

function manualRequestedSeatCount() {
  const ticketTypes = new Map(currentManualTicketTypes().map((ticketType) => [String(ticketType.id), ticketType]));
  return manualTicketItems().reduce((sum, item) => {
    const bundleQuantity = Math.max(1, Math.floor(Number(ticketTypes.get(String(item.id))?.bundleQuantity || 1)));
    return sum + item.quantity * bundleQuantity;
  }, 0);
}

function manualSeatById(seatId) {
  return (state.manualSeatMap?.rows || []).flatMap((row) => row.seats || []).find((seat) => String(seat.id) === String(seatId));
}

function manualSeatColor(value, fallback = "#2563eb") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function reconcileManualSeatSelection() {
  const required = manualRequestedSeatCount();
  const available = new Set((state.manualSeatMap?.rows || [])
    .flatMap((row) => row.seats || [])
    .filter((seat) => seat.status === "available" || seat.heldByMe)
    .map((seat) => String(seat.id)));
  const previous = [...state.manualSelectedSeatIds];
  state.manualSelectedSeatIds = state.manualSelectedSeatIds
    .map(String)
    .filter((seatId) => available.has(seatId))
    .slice(0, required);
  const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
  if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
  previous
    .filter((seatId) => !state.manualSelectedSeatIds.includes(seatId) && manualSeatById(seatId)?.heldByMe)
    .forEach((seatId) => void sendManualSeatRealtimeRequest("release_seat", seatId));
  renderManualSeatMap();
}

function closeManualSeatRealtime(sessionId = "", releaseSeats = false) {
  const ids = sessionId ? [sessionId] : [...state.manualSeatRealtimeChannels.keys()];
  ids.forEach((id) => {
    const channel = state.manualSeatRealtimeChannels.get(id);
    if (!channel) return;
    channel.disposed = true;
    window.clearTimeout(channel.reconnectTimer);
    window.clearInterval(channel.heartbeatTimer);
    if (releaseSeats && channel.socket?.readyState === WebSocket.OPEN) {
      channel.selectedSeatIds.forEach((seatId) => channel.socket.send(JSON.stringify({
        type: "release_seat",
        requestId: crypto.randomUUID(),
        seatId
      })));
    }
    channel.pending.forEach((pending) => pending.resolve({ ok: false, message: "Conexão com as poltronas encerrada." }));
    channel.pending.clear();
    channel.socket?.close();
    state.manualSeatRealtimeChannels.delete(id);
  });
  if (!sessionId || state.manualSeatRealtimeSessionId === sessionId) {
    state.manualSeatRealtimeSessionId = "";
    state.manualSeatRealtimeOwnerToken = "";
  }
}

function applyManualSeatRealtimeState(occupiedSeatIds = [], heldSeats = []) {
  if (!state.manualSeatMap?.rows) return;
  const occupied = new Set(occupiedSeatIds.map(String));
  const held = new Map(heldSeats.map((seat) => [String(seat.seatId), seat]));
  state.manualSeatMap.rows.forEach((row) => {
    (row.seats || []).forEach((seat) => {
      const hold = held.get(String(seat.id));
      seat.heldByMe = Boolean(hold?.heldByMe);
      if (seat.enabled === false) seat.status = "blocked";
      else if (occupied.has(String(seat.id))) seat.status = "unavailable";
      else if (hold) seat.status = "held";
      else seat.status = "available";
    });
  });
  reconcileManualSeatSelection();
}

function applyManualSeatRealtimeChange(message) {
  const seat = manualSeatById(message.seatId);
  if (!seat || seat.enabled === false) return;
  seat.status = ["available", "held", "unavailable"].includes(String(message.status))
    ? String(message.status)
    : seat.status;
  seat.heldByMe = Boolean(message.heldByMe && seat.status === "held");
  reconcileManualSeatSelection();
}

function connectManualSeatRealtime(sessionId) {
  if (!sessionId) return;
  const previousSessionId = state.manualSeatRealtimeSessionId;
  if (previousSessionId && previousSessionId !== sessionId && !state.manualSaleItems.some((item) => item.sessionId === previousSessionId)) {
    closeManualSeatRealtime(previousSessionId, true);
  }
  state.manualSeatRealtimeSessionId = sessionId;
  let channel = state.manualSeatRealtimeChannels.get(sessionId);
  if (channel) {
    state.manualSeatRealtimeOwnerToken = channel.ownerToken;
    return;
  }
  channel = {
    sessionId,
    ownerToken: `admin-box-office-${crypto.randomUUID()}`,
    socket: null,
    reconnectTimer: null,
    heartbeatTimer: null,
    selectedSeatIds: [],
    pendingSeatIds: new Set(),
    pending: new Map(),
    disposed: false
  };
  state.manualSeatRealtimeChannels.set(sessionId, channel);
  state.manualSeatRealtimeOwnerToken = channel.ownerToken;

  const connect = () => {
    if (channel.disposed) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}${API_BASE}/api/realtime/seats`);
    channel.socket = socket;
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "join_session",
        requestId: crypto.randomUUID(),
        sessionId,
        ownerToken: channel.ownerToken
      }));
      window.clearInterval(channel.heartbeatTimer);
      channel.heartbeatTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN && channel.selectedSeatIds.length) {
          socket.send(JSON.stringify({ type: "heartbeat", requestId: crypto.randomUUID(), seatIds: channel.selectedSeatIds }));
        }
      }, 35000);
    });
    socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      const pending = channel.pending.get(String(message.requestId || ""));
      if (pending) {
        channel.pending.delete(String(message.requestId));
        channel.pendingSeatIds.delete(pending.seatId);
        window.clearTimeout(pending.timer);
        if (["select_seat_confirmed", "release_seat_confirmed"].includes(message.type)) pending.resolve({ ok: true });
        else pending.resolve({ ok: false, message: message.message || "Não foi possível atualizar a poltrona." });
      }
      if (state.manualSeatRealtimeSessionId !== sessionId) return;
      if (message.type === "session_state") {
        applyManualSeatRealtimeState(message.occupiedSeatIds || [], message.heldSeats || []);
      } else if (message.type === "seat_status_changed") {
        applyManualSeatRealtimeChange(message);
      } else if (message.type === "session_refresh_required") {
        void loadManualSeatMap({ preserveSelection: true });
      }
    });
    socket.addEventListener("close", () => {
      window.clearInterval(channel.heartbeatTimer);
      if (channel.socket === socket) channel.socket = null;
      if (channel.disposed) return;
      channel.reconnectTimer = window.setTimeout(connect, 1500);
    });
    socket.addEventListener("error", () => socket.close());
  };
  connect();
}

function sendManualSeatRealtimeRequest(type, seatId) {
  const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
  const socket = channel?.socket;
  if (!channel || !socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, message: "A sincronização das poltronas está reconectando. Aguarde um instante." });
  }
  const requestId = crypto.randomUUID();
  channel.pendingSeatIds.add(String(seatId));
  renderManualSeatMap();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      channel.pending.delete(requestId);
      channel.pendingSeatIds.delete(String(seatId));
      renderManualSeatMap();
      resolve({ ok: false, message: "A reserva da poltrona demorou para responder. Tente novamente." });
    }, 8000);
    channel.pending.set(requestId, { resolve, timer, seatId: String(seatId) });
    socket.send(JSON.stringify({ type, requestId, seatId }));
  });
}

async function loadManualSeatMap({ preserveSelection = false } = {}) {
  const { session } = currentManualMovieSession();
  const section = $("manualSeatSection");
  const requestToken = ++state.manualSeatRequestToken;
  const previousSessionId = state.manualSeatMapSessionId;
  const previousSelection = preserveSelection && previousSessionId === session?.id
    ? [...state.manualSelectedSeatIds]
    : [];
  state.manualSeatMapSessionId = session?.id || "";
  state.manualSeatMap = null;
  state.manualSelectedSeatIds = previousSelection;

  if (!session?.id) {
    if (previousSessionId && !state.manualSaleItems.some((item) => item.sessionId === previousSessionId)) {
      closeManualSeatRealtime(previousSessionId, true);
    }
    state.manualSeatMapStatus = "idle";
    if (section) section.hidden = true;
    return;
  }

  state.manualSeatMapStatus = "loading";
  connectManualSeatRealtime(session.id);
  if (section) section.hidden = false;
  renderManualSeatMap();
  try {
    const seatMap = await api(`/api/sessions/${encodeURIComponent(session.id)}/seats?ownerToken=${encodeURIComponent(state.manualSeatRealtimeOwnerToken)}`);
    if (requestToken !== state.manualSeatRequestToken || state.manualSeatMapSessionId !== session.id) return;
    state.manualSeatMap = seatMap;
    state.manualSeatMapStatus = "ready";
    const existingItem = state.manualSaleItems.find((item) => item.sessionId === session.id);
    state.manualSelectedSeatIds = previousSelection.length
      ? previousSelection
      : Array.isArray(existingItem?.selectedSeatIds) ? [...existingItem.selectedSeatIds] : [];
    reconcileManualSeatSelection();
  } catch (error) {
    if (requestToken !== state.manualSeatRequestToken) return;
    state.manualSeatMapStatus = "error";
    state.manualSeatMap = null;
    renderManualSeatMap(error.message);
  }
}

async function toggleManualSeat(seatId) {
  const seat = manualSeatById(seatId);
  const id = String(seatId);
  const selected = state.manualSelectedSeatIds.includes(id);
  if (!seat || (!selected && seat.status !== "available")) return;
  const required = manualRequestedSeatCount();
  if (!required) {
    showToast("Selecione ao menos um ingresso antes de escolher as poltronas.", "error");
    return;
  }
  const channel = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId);
  if (channel?.pendingSeatIds.has(id)) return;
  if (selected) {
    const result = await sendManualSeatRealtimeRequest("release_seat", id);
    if (!result.ok) return showToast(result.message, "error");
    state.manualSelectedSeatIds = state.manualSelectedSeatIds.filter((current) => current !== id);
    if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
  } else if (state.manualSelectedSeatIds.length < required) {
    const result = await sendManualSeatRealtimeRequest("select_seat", id);
    if (!result.ok) return showToast(result.message, "error");
    state.manualSelectedSeatIds.push(id);
    if (channel) channel.selectedSeatIds = [...state.manualSelectedSeatIds];
  } else {
    showToast(`A quantidade atual permite selecionar ${required} poltrona(s).`, "error");
  }
  renderManualSeatMap();
}

function renderManualSeatMap(errorMessage = "") {
  const section = $("manualSeatSection");
  if (!section) return;
  const status = state.manualSeatMapStatus;
  const seatMap = state.manualSeatMap;
  const required = manualRequestedSeatCount();
  const selected = state.manualSelectedSeatIds.length;
  const statusTarget = $("manualSeatStatus");
  const mapShell = $("manualSeatMapShell");

  section.hidden = status === "idle" || (status === "ready" && !seatMap?.enabled);
  if (section.hidden) return;
  $("manualSeatCount").textContent = `${selected} de ${required}`;
  $("manualSeatCount").className = `status-pill ${required > 0 && selected === required ? "success" : "muted"}`;
  $("manualSeatDescription").textContent = required
    ? `Selecione ${required} poltrona(s), uma para cada ingresso que será emitido.`
    : "Escolha primeiro a quantidade e o tipo de ingresso.";
  $("manualSeatSelectionSummary").textContent = selected
    ? `Selecionadas: ${state.manualSelectedSeatIds.map((seatId) => manualSeatById(seatId)?.label || seatId).join(", ")}`
    : "";
  renderManualSaleSummary();

  if (status === "loading") {
    statusTarget.innerHTML = `<div class="manual-seat-loading" aria-label="Carregando mapa de poltronas"></div>`;
    mapShell.hidden = true;
    return;
  }
  if (status === "error") {
    statusTarget.innerHTML = `<div class="validation-result error">${escapeHtml(errorMessage || "Não foi possível carregar as poltronas desta sessão.")} <button type="button" class="text-button" data-reload-manual-seats>Tentar novamente</button></div>`;
    statusTarget.querySelector("[data-reload-manual-seats]")?.addEventListener("click", () => void loadManualSeatMap());
    mapShell.hidden = true;
    return;
  }

  statusTarget.innerHTML = "";
  mapShell.hidden = false;
  $("manualSeatScreen").textContent = seatMap?.screenLabel || "TELA";
  const typeById = new Map((seatMap?.seatTypes || []).map((type) => [String(type.id), type]));
  $("manualSeatLegend").innerHTML = [
    ...(seatMap?.seatTypes || []).map((type) => `<span><i style="--manual-seat-color:${manualSeatColor(type.color)}"></i>${escapeHtml(type.name)}</span>`),
    `<span><i class="is-unavailable"></i>Indisponível</span>`,
    `<span><i class="is-temporarily-reserved"></i>Reservada temporariamente</span>`,
    `<span><i class="is-selected"></i>Selecionada nesta venda</span>`,
    `<span>${accessibilityIcon}Cadeirante</span>`,
    `<span>${obeseSeatIcon}Pessoa obesa</span>`
  ].join("");
  const seatRows = seatMap?.rows || [];
  const columnGuides = new Map();
  seatRows.forEach((row) => {
    const rowLabel = String(row.label || "").trim();
    const labels = (row.seats || []).map((seat) => {
      const seatLabel = String(seat.label || "").trim();
      return rowLabel && seatLabel.toLocaleUpperCase("pt-BR").startsWith(rowLabel.toLocaleUpperCase("pt-BR"))
        ? seatLabel.slice(rowLabel.length).trim() || seatLabel
        : seatLabel;
    });
    const aisles = (row.seats || []).map((seat) => Boolean(seat.aisleAfter));
    const signature = JSON.stringify({ labels, aisles });
    if (columnGuides.has(signature)) columnGuides.get(signature).rowLabels.push(rowLabel);
    else columnGuides.set(signature, { rowLabels: [rowLabel], labels, aisles });
  });
  const seatRowsMarkup = seatRows.map((row) => `
    <div class="manual-seat-row">
      <span class="manual-seat-row-label">${escapeHtml(row.label)}</span>
      <div class="manual-seat-row-seats">
        ${(row.seats || []).map((seat) => {
          const type = typeById.get(String(seat.typeId));
          const isSelected = state.manualSelectedSeatIds.includes(String(seat.id));
          const temporarilyReserved = seat.status === "held" && !seat.heldByMe;
          const unavailable = (seat.status !== "available" && !seat.heldByMe) || temporarilyReserved;
          const pending = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId)?.pendingSeatIds.has(String(seat.id));
          const accessibility = seat.accessibility === "wheelchair" ? "Cadeirante" : seat.accessibility === "obese" ? "Pessoa obesa" : "";
          return `<button
            type="button"
            class="manual-seat-button ${isSelected ? "is-selected" : ""} ${temporarilyReserved ? "is-temporarily-reserved" : unavailable ? "is-unavailable" : ""} ${pending ? "is-pending" : ""} ${accessibility ? "has-accessibility" : ""}"
            style="--manual-seat-color:${manualSeatColor(seat.color || type?.color)};${seat.aisleAfter ? "margin-right:24px" : ""}"
            data-manual-seat-id="${escapeHtml(seat.id)}"
            aria-label="${escapeHtml(`${seat.label}, ${type?.name || "Padrão"}${accessibility ? `, ${accessibility}` : ""}${temporarilyReserved ? ", reservada temporariamente por outra compra" : unavailable ? ", indisponível" : isSelected ? ", selecionada nesta venda" : ""}`)}"
            title="${escapeHtml(temporarilyReserved ? `${seat.label} • Reservada temporariamente por outra compra` : `${seat.label} • ${type?.name || "Padrão"}`)}"
            aria-pressed="${isSelected}"
            ${unavailable || pending ? "disabled" : ""}
          >${seat.accessibility === "wheelchair" ? accessibilityIcon : seat.accessibility === "obese" ? obeseSeatIcon : ""}<span>${escapeHtml(seat.label)}</span></button>`;
        }).join("")}
      </div>
      <span class="manual-seat-row-spacer" aria-hidden="true"></span>
    </div>
  `).join("");
  const columnGuideMarkup = [...columnGuides.values()].map((guide) => {
    const codes = guide.rowLabels.map((label) => /^[A-Z]$/i.test(label) ? label.toLocaleUpperCase("pt-BR").charCodeAt(0) : -1);
    const consecutive = codes.length > 2 && codes.every((code, index) => index === 0 || code === codes[index - 1] + 1);
    const groupedRowLabel = consecutive ? `${guide.rowLabels[0]}–${guide.rowLabels.at(-1)}` : guide.rowLabels.join(", ");
    return `
      <div class="manual-seat-column-footer" aria-label="Numeração das fileiras ${escapeHtml(groupedRowLabel)}">
        <span class="manual-seat-row-label">${columnGuides.size > 1 ? escapeHtml(groupedRowLabel) : ""}</span>
        <div class="manual-seat-column-labels">
          ${guide.labels.map((label, columnIndex) => `<span style="${guide.aisles[columnIndex] ? "margin-right:24px" : ""}">${escapeHtml(label)}</span>`).join("")}
        </div>
        <span class="manual-seat-row-spacer" aria-hidden="true"></span>
      </div>`;
  }).join("");
  $("manualSeatMap").innerHTML = seatRowsMarkup + columnGuideMarkup;
  $("manualSeatMap").querySelectorAll("[data-manual-seat-id]").forEach((button) => {
    button.addEventListener("click", () => void toggleManualSeat(button.dataset.manualSeatId));
  });
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
  const selectedSeatIds = state.manualSeatMap?.enabled ? [...state.manualSelectedSeatIds] : [];
  const seatChannel = state.manualSeatRealtimeChannels.get(session.id);
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
      unitPrice: Number(ticketTypes.get(item.id)?.price || 0),
      bundleQuantity: Math.max(1, Number(ticketTypes.get(item.id)?.bundleQuantity || 1))
    })),
    seatSelectionEnabled: Boolean(state.manualSeatMap?.enabled),
    selectedSeatIds,
    seatHoldToken: seatChannel?.ownerToken || "",
    selectedSeatLabels: selectedSeatIds.map((seatId) => manualSeatById(seatId)?.label || seatId),
    subtotal
  };
}

function manualDraftSeatSelectionComplete(draft) {
  if (!draft?.seatSelectionEnabled) return true;
  const required = draft.ticketSummary.reduce((sum, ticket) => sum + ticket.quantity * ticket.bundleQuantity, 0);
  return required > 0 && draft.selectedSeatIds.length === required;
}

function addManualSaleItem() {
  const draft = manualSaleDraft();
  if (!draft) {
    showToast("Selecione ao menos um ingresso para adicionar este filme.", "error");
    return;
  }
  if (!manualDraftSeatSelectionComplete(draft)) {
    showToast(`Selecione ${manualRequestedSeatCount()} poltrona(s) antes de adicionar esta sessão.`, "error");
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
  const reopenCurrentSession = state.manualSeatMapSessionId === sessionId;
  closeManualSeatRealtime(sessionId, true);
  renderManualSaleItems();
  if (reopenCurrentSession) void loadManualSeatMap();
}

function clearManualSaleItems() {
  state.manualSaleItems = [];
  const reopenCurrentSession = Boolean(state.manualSeatMapSessionId);
  closeManualSeatRealtime("", true);
  renderManualSaleItems();
  if (reopenCurrentSession) void loadManualSeatMap();
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
          ${item.selectedSeatLabels?.length ? `<small>Poltronas: ${escapeHtml(item.selectedSeatLabels.join(", "))}</small>` : ""}
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
  renderManualSaleSummary();
}

function manualSaleSummaryCustomer() {
  if (state.saleMode === "quick") return "Venda rápida";
  if (state.saleMode === "registered") return state.selectedCustomer?.name || "Cliente não selecionado";
  return $("manualCustomerName")?.value.trim() || "Cliente avulso";
}

function manualSaleSummaryMode() {
  return {
    registered: "Cliente cadastrado",
    guest: "Cliente avulso",
    quick: "Venda rápida"
  }[state.saleMode] || "Venda";
}

function manualSaleSummaryPayment() {
  const method = document.querySelector("input[name='manualPaymentMethod']:checked")?.value || "cash";
  return {
    cash: "Dinheiro",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
    point_card: "Cartão na Point",
    point_qr: "Pix na Point",
    courtesy: "Cortesia"
  }[method] || "Pagamento";
}

function manualTicketDeliveryMethod() {
  if (state.saleMode === "quick") return "physical";
  if (state.saleMode === "registered") return "online";
  return document.querySelector("input[name='guestTicketDeliveryMethod']:checked")?.value === "online"
    ? "online"
    : "physical";
}

function manualTicketDeliveryLabel() {
  return manualTicketDeliveryMethod() === "online" ? "Ingresso online" : "Impressão física";
}

function renderManualSaleSummary() {
  const target = $("manualSaleSummary");
  if (!target) return;
  const draft = manualSaleDraft();
  const saleItems = state.manualSaleItems.length ? state.manualSaleItems : draft ? [draft] : [];
  const concessionsById = new Map((state.content?.concessions || []).map((item) => [String(item.id), item]));
  const concessions = manualConcessionItems().map((item) => ({
    ...item,
    product: concessionsById.get(String(item.id))
  })).filter((item) => item.product);
  const ticketCount = saleItems.reduce((sum, item) => sum + (item.ticketSummary || []).reduce((ticketSum, ticket) => (
    ticketSum + Number(ticket.quantity || 0) * Math.max(1, Number(ticket.bundleQuantity || 1))
  ), 0), 0);
  const seatLabels = saleItems.flatMap((item) => item.selectedSeatLabels || []);
  const concessionsCount = concessions.reduce((sum, item) => sum + item.quantity, 0);
  const ticketsTotal = saleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const concessionsTotal = concessions.reduce((sum, item) => sum + item.quantity * Number(item.product.price || 0), 0);
  const total = ticketsTotal + concessionsTotal;
  const isDraft = !state.manualSaleItems.length && Boolean(draft);

  const saleItemsMarkup = saleItems.length ? saleItems.map((item) => {
    const date = item.sessionDate ? manualSessionDateDisplay(item.sessionDate) : "";
    const session = [date, item.sessionTime, item.sessionFormat].filter(Boolean).join(" • ");
    return `
      <article class="manual-sale-summary-session">
        <div class="manual-sale-summary-session-title">
          <strong>${escapeHtml(item.movieTitle || "Filme")}</strong>
          ${isDraft ? `<span>Em edição</span>` : ""}
        </div>
        <small>${escapeHtml(session)}</small>
        <div class="manual-sale-summary-lines">
          ${(item.ticketSummary || []).map((ticket) => `
            <div>
              <span><b>${Number(ticket.quantity || 0)}×</b> ${escapeHtml(ticket.name || "Ingresso")}</span>
              <strong>${money(Number(ticket.quantity || 0) * Number(ticket.unitPrice || 0))}</strong>
            </div>
          `).join("")}
        </div>
        ${(item.selectedSeatLabels || []).length ? `
          <div class="manual-sale-summary-seats">
            <span>Poltronas</span>
            <div>${item.selectedSeatLabels.map((label) => `<b>${escapeHtml(label)}</b>`).join("")}</div>
          </div>
        ` : ""}
      </article>`;
  }).join("") : `
    <div class="manual-sale-summary-empty">
      <strong>Nenhum ingresso selecionado</strong>
      <span>Escolha a sessão e a quantidade para iniciar a venda.</span>
    </div>`;

  const concessionsMarkup = concessions.length ? `
    <section class="manual-sale-summary-section">
      <div class="manual-sale-summary-section-title">
        <span>Bomboniere</span>
        <strong>${concessionsCount} ${concessionsCount === 1 ? "item" : "itens"}</strong>
      </div>
      <div class="manual-sale-summary-lines">
        ${concessions.map((item) => `
          <div>
            <span><b>${item.quantity}×</b> ${escapeHtml(item.product.name)}</span>
            <strong>${money(item.quantity * Number(item.product.price || 0))}</strong>
          </div>
        `).join("")}
      </div>
    </section>` : "";

  target.innerHTML = `
    <div class="manual-sale-summary-heading">
      <div>
        <span>Venda em andamento</span>
        <h2 id="manualSaleSummaryTitle">Resumo da venda</h2>
      </div>
      <span class="manual-sale-summary-mode">${escapeHtml(manualSaleSummaryMode())}</span>
    </div>
    <div class="manual-sale-summary-customer">
      <span>Cliente</span>
      <strong>${escapeHtml(manualSaleSummaryCustomer())}</strong>
      <small>${escapeHtml(manualTicketDeliveryLabel())}</small>
    </div>
    <section class="manual-sale-summary-section">
      <div class="manual-sale-summary-section-title">
        <span>Ingressos</span>
        <strong>${ticketCount} ${ticketCount === 1 ? "ingresso" : "ingressos"}</strong>
      </div>
      <div class="manual-sale-summary-sessions">${saleItemsMarkup}</div>
    </section>
    ${concessionsMarkup}
    <div class="manual-sale-summary-footer">
      <div>
        <span>${escapeHtml(manualSaleSummaryPayment())}</span>
        ${seatLabels.length ? `<small>${seatLabels.length} ${seatLabels.length === 1 ? "poltrona selecionada" : "poltronas selecionadas"}</small>` : ""}
      </div>
      <strong>${money(total)}</strong>
    </div>`;
}

async function createManualTicket(event) {
  event.preventDefault();
  const draft = manualSaleDraft();
  const saleItems = state.manualSaleItems.length ? state.manualSaleItems : draft ? [draft] : [];
  if (!saleItems.length) {
    showToast("Adicione ao menos um filme com ingressos à venda.", "error");
    return;
  }
  const incompleteSeatItem = saleItems.find((item) => !manualDraftSeatSelectionComplete(item));
  if (incompleteSeatItem) {
    showToast(`Complete a seleção de poltronas para ${incompleteSeatItem.movieTitle}.`, "error");
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
    const ticketDeliveryMethod = manualTicketDeliveryMethod();
    const guestEmail = $("manualCustomerEmail").value.trim();
    if (saleMode === "guest" && ticketDeliveryMethod === "online" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      showToast("Informe um e-mail válido para entregar o ingresso online.", "error");
      $("manualCustomerEmail").focus();
      return;
    }
    const payload = {
      fullTicketsCount: 0,
      halfTicketsCount: 0,
      saleItems: saleItems.map((item) => ({
        movieId: item.movieId,
        sessionId: item.sessionId,
        ticketItems: item.ticketItems,
        selectedSeatIds: item.selectedSeatIds || [],
        seatHoldToken: item.seatHoldToken || "",
        autoAssignSeats: false
      })),
      concessionItems: manualConcessionItems(),
      saleMode,
      ticketDeliveryMethod,
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
    state.manualSelectedSeatIds = [];
    closeManualSeatRealtime();
    renderManualSaleItems();
    if (["point_debit", "point_credit", "point_card", "point_qr"].includes(paymentMethod)) {
      startPointPaymentTracking(result);
      return;
    }
    await loadContent({ silent: true });
    const pointPrint = result.pointPrint || {};
    const ticketDelivery = orders[0]?.ticketDelivery || {};
    const deliveryMessage = ticketDelivery.message
      ? ` ${ticketDelivery.message}`
      : pointPrint.status === "queued"
        ? " Os ingressos foram enviados para impressão na Point."
        : pointPrint.message ? ` ${pointPrint.message}` : "";
    showSuccess(
      "Venda finalizada",
      `${orders.length} ${orders.length === 1 ? "pedido criado" : "pedidos criados"} e ${(result.tickets || []).length} ingresso(s) emitido(s).${deliveryMessage}`
    );
  } catch (error) {
    showToast(error.message, "error");
    if (["SEAT_UNAVAILABLE", "SEAT_LAYOUT_CHANGED", "SEAT_SELECTION_INCOMPLETE"].includes(error.payload?.error?.code)) {
      void loadManualSeatMap();
    }
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
  const pointPrint = data.pointPrint || state.pointPaymentSnapshot?.pointPrint || {};
  const ticketDelivery = orders[0]?.ticketDelivery || {};
  const onlineDelivery = orders.some((order) => order.ticketDeliveryMethod === "online");
  const status = payment.status || "pending";
  const finalStatus = ["approved", "rejected", "cancelled", "expired", "refunded"].includes(status);
  state.pointPaymentSnapshot = { payment, orders, tickets, pointPrint };

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
    approved: [
      "Pagamento aprovado e ingressos emitidos",
      onlineDelivery
        ? ticketDelivery.message || "Os ingressos digitais estão sendo enviados ao e-mail informado."
        : pointPrint.status === "queued"
        ? "A impressão com ingressos e bomboniere foi enviada automaticamente para a Point."
        : pointPrint.message || "A venda foi confirmada pelo Mercado Pago. Use as opções abaixo para imprimir novamente."
    ],
    rejected: ["Pagamento recusado", "Nenhum ingresso foi emitido. Inicie uma nova venda para tentar outra forma de pagamento."],
    cancelled: ["Cobrança cancelada", "A ordem foi cancelada no terminal e nenhum ingresso foi emitido."],
    expired: ["Tempo de pagamento encerrado", "A cobrança expirou sem aprovação e os ingressos não foram emitidos."],
    refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta cobrança."]
  }[status] || ["Aguardando pagamento na Point", "A cobrança foi enviada. Oriente o cliente a concluir o pagamento no terminal."];
  $("pointPaymentTitle").textContent = copy[0];
  $("pointPaymentMessage").textContent = copy[1];

  const printActions = $("pointPaymentPrintActions");
  if (status === "approved" && orders.length && !onlineDelivery) {
    printActions.hidden = false;
    printActions.innerHTML = `
      <strong>Impressão da venda</strong>
      <p>${pointPrint.status === "queued" ? "A via de balcão já foi enviada à Point. " : ""}${tickets.length} ingresso(s) emitido(s). Os botões abaixo permitem reimprimir pelo PDV ou impressora instalada neste computador.</p>
      <div class="button-row">
        ${tickets.map((ticket, index) => `<button class="ghost-button" type="button" onclick="printPhysicalTicket('${escapeHtml(ticket.id)}')">Abrir no PDV · ${escapeHtml(ticket.movieTitle || ticket.ticketType || `ingresso ${index + 1}`)}</button>`).join("")}
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
  if (!state.pointPaymentId || !confirm("Cancelar a cobrança enviada à Point? Nenhum ingresso será emitido.")) return;
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
  const ticketDeliveryMethod = manualTicketDeliveryMethod();
  const emailInput = $("manualCustomerEmail");
  const emailLabel = $("manualCustomerEmailLabel");
  if (emailInput) {
    emailInput.required = state.saleMode === "guest" && ticketDeliveryMethod === "online";
    emailInput.placeholder = emailInput.required ? "cliente@exemplo.com" : "cliente@exemplo.com (opcional)";
  }
  if (emailLabel) emailLabel.textContent = emailInput?.required ? "E-mail para entrega" : "E-mail opcional";
  if ($("manualSaleSubmitButton")) {
    $("manualSaleSubmitButton").textContent = state.saleMode === "quick" ? "Finalizar venda rápida" : "Finalizar venda";
  }
  if (state.saleMode === "quick") {
    $("manualCustomerName").value = "";
    $("manualCustomerEmail").value = "";
    $("manualCustomerPhone").value = "";
    $("manualCustomerCpf").value = "";
  }
  renderManualSaleSummary();
}

function clearSelectedCustomer() {
  state.selectedCustomer = null;
  $("manualCustomerUserId").value = "";
  $("manualSelectedCustomer").textContent = "Nenhum cliente selecionado.";
  renderManualSaleSummary();
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
  renderManualSaleSummary();
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
    renderManualSaleSummary();
    return;
  }
  const types = new Map(currentManualTicketTypes().map((ticketType) => [ticketType.id, ticketType]));
  const total = manualTicketItems().reduce((sum, item) => sum + item.quantity * Number(types.get(item.id)?.price || 0), 0) + concessionsTotal;
  if ($("manualTotalDisplay")) $("manualTotalDisplay").textContent = money(total);
  renderManualSaleSummary();
}

function mountScanner(target) {
  const scanner = $("sharedScannerShell");
  if (!scanner) return;
  const mount = target === "concessions" ? $("concessionScannerMount") : $("boxOfficeScannerMount");
  if (mount && scanner.parentElement !== mount) {
    mount.appendChild(scanner);
  }
  const backBtn = scanner.querySelector("[data-scanner-back]");
  const backText = $("scannerBackText");
  if (backBtn && backText) {
    if (target === "concessions") {
      backBtn.dataset.scannerBack = "concessions";
      backText.textContent = "Voltar à Bomboniere";
    } else {
      backBtn.dataset.scannerBack = "boxOffice";
      backText.textContent = "Voltar à Bilheteria";
    }
  }
}

function setConcessionTab(tab) {
  state.concessionTab = tab;
  document.querySelectorAll("[data-concession-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.concessionTab === tab);
  });
  const panelByTab = {
    todaySales: "concessionTodaySalesTab",
    products: "concessionProductsTab",
    finance: "concessionFinanceTab",
    validateQr: "concessionValidateQrTab"
  };
  Object.entries(panelByTab).forEach(([key, id]) => {
    const panel = $(id);
    if (panel) panel.classList.toggle("active", key === tab);
  });

  const newProductBtn = $("newConcessionButton");
  if (newProductBtn) {
    newProductBtn.style.display = tab === "products" ? "" : "none";
  }

  if (tab === "validateQr") {
    mountScanner("concessions");
    setTicketValidationMode("concessions");
    startQrReader();
  } else {
    if (state.boxOfficeTab !== "validateTicket" || !$("boxOfficePanel")?.classList.contains("active")) {
      stopQrReader();
    }
    if (tab === "todaySales") {
      void loadConcessionDailySales();
    } else if (tab === "products") {
      renderConcessions();
    } else if (tab === "finance") {
      renderConcessionInsights();
      void loadConcessionFinance();
    }
  }
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
    mountScanner("boxOffice");
    setTicketValidationMode("entry");
    startQrReader();
  } else {
    if (state.concessionTab !== "validateQr" || !$("concessionsPanel")?.classList.contains("active")) {
      stopQrReader();
    }
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
    .filter((session) => session.id && session.date >= today && !["cancelled", "hidden", "archived"].includes(String(session.status || "").toLowerCase()))
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
  state.qrPendingEntryCode = "";
  state.qrPendingConcessionCode = "";
  const concessionsMode = state.validationMode === "concessions";
  const scope = document.querySelector(".validation-scope");
  if (scope) scope.hidden = concessionsMode;
  const validateButton = $("validateTicketButton");
  if (validateButton) validateButton.textContent = concessionsMode ? "Conferir pedido" : "Conferir ingresso";
  const manualLabel = $("manualCodeLabelText");
  if (manualLabel) manualLabel.textContent = concessionsMode ? "Código do pedido ou ingresso" : "Código do ingresso";
  const instruction = $("scannerInstructionText");
  if (instruction) {
    instruction.textContent = concessionsMode
      ? "Aponte a câmera para o QR Code do pedido ou ingresso para retirar os itens da bomboniere."
      : "Aponte a câmera para o QR Code do ingresso. A validação acontece no servidor.";
  }
  const placeholderSubtitle = $("qrPlaceholderSubtitle");
  if (placeholderSubtitle) {
    placeholderSubtitle.textContent = concessionsMode
      ? "A câmera abrirá aqui para conferir a retirada dos itens da bomboniere."
      : "A câmera traseira abrirá aqui para validar o ingresso com segurança.";
  }
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
      copy: "Preparo e entrega registrados pelo operador.",
      action: "Escanear próximo"
    },
    concessionsPending: {
      title: "Confira o pedido",
      copy: "Marque cada item depois de confirmar que ele entrou em preparo. A baixa só acontece na confirmação final.",
      action: "Confirmar preparo e entrega"
    },
    entryPending: {
      title: "Confira o ingresso",
      copy: "Verifique os dados da sessão e libere a entrada somente depois de confirmar o ingresso com o cliente.",
      action: "Liberar entrada"
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
  const pendingConcessionConfirmation = type === "concessionsPending";
  const pendingEntryConfirmation = type === "entryPending";
  const detailsMarkup = details.length ? `<div class="scanner-result-details">${details.map(escapeHtml).join("<br>")}</div>` : "";
  const itemsMarkup = concessions.length ? `<div class="scanner-result-items">${concessions.map((item, index) => pendingConcessionConfirmation
    ? `<label><input type="checkbox" data-concession-confirmation="${index}" /><span><b>${Number(item.quantity || 0)}x</b> ${escapeHtml(item.name || item.id || "Item")} <small>está sendo preparado</small></span></label>`
    : `<span><b>${Number(item.quantity || 0)}x</b> ${escapeHtml(item.name || item.id || "Item")}</span>`).join("")}</div>` : "";
  const priorityMarkup = pendingConcessionConfirmation
    ? `<section class="scanner-order-priority"><span class="scanner-result-label">Itens do pedido</span>${itemsMarkup}</section>
       <div class="scanner-result-context"><span class="scanner-result-label">Filme e sessão vinculados</span>${detailsMarkup}</div>`
    : `${detailsMarkup}${itemsMarkup}`;
  target.className = `validation-result scanner-result ${type}`;
  target.innerHTML = `
    <strong>${escapeHtml(template.title)}</strong>
    ${priorityMarkup}
    <p>${template.copy}</p>
    ${pendingConcessionConfirmation
      ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmConcessionFulfillmentButton" type="button" disabled>${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" onclick="scanNextTicket()">Cancelar e ler outro QR</button></div>`
      : pendingEntryConfirmation
        ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmTicketEntryButton" type="button">${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" onclick="scanNextTicket()">Cancelar e ler outro QR</button></div>`
      : `<button class="primary-button full" type="button" onclick="scanNextTicket()">${escapeHtml(template.action)}</button>`}
  `;
  if (pendingConcessionConfirmation) {
    const checkboxes = [...target.querySelectorAll("[data-concession-confirmation]")];
    const confirmButton = target.querySelector("#confirmConcessionFulfillmentButton");
    const updateConfirmation = () => {
      confirmButton.disabled = !checkboxes.length || checkboxes.some((checkbox) => !checkbox.checked);
    };
    checkboxes.forEach((checkbox) => checkbox.addEventListener("change", updateConfirmation));
    confirmButton.addEventListener("click", () => confirmTicketConcessions(payload.code));
  } else if (pendingEntryConfirmation) {
    target.querySelector("#confirmTicketEntryButton")?.addEventListener("click", () => confirmTicketEntry(payload.code));
  }
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
    const isConcessions = state.validationMode === "concessions";
    const isConfirmation = isConcessions ? options.confirmConcessions : options.confirmEntry;
    const result = await api("/api/tickets/validate", {
      method: "POST",
      body: JSON.stringify({
        code: cleanCode,
        sessionId,
        mode: state.validationMode,
        action: isConfirmation ? "confirm" : "inspect"
      })
    });
    if (result.result === "ticket_pending_confirmation") {
      state.qrPendingEntryCode = cleanCode;
      setQrReaderActive(false, "Aguardando liberação do operador");
      renderTicketValidationResult("entryPending", {
        code: cleanCode,
        ticket: result.ticket
      });
    } else if (result.result === "concessions_pending_confirmation") {
      state.qrPendingConcessionCode = cleanCode;
      setQrReaderActive(false, "Aguardando conferência dos itens");
      renderTicketValidationResult("concessionsPending", {
        code: cleanCode,
        ticket: result.ticket,
        concessions: result.concessions
      });
    } else {
      state.qrPendingEntryCode = "";
      state.qrPendingConcessionCode = "";
      setQrReaderActive(
        false,
        result.result === "concessions_fulfilled" ? "Retirada confirmada" : "Entrada liberada"
      );
      renderTicketValidationResult(
        result.result === "concessions_fulfilled" ? "concessionsOk" : "ok",
        { ticket: result.ticket, concessions: result.concessions }
      );
    }
    if ($("ticketValidationCode")) $("ticketValidationCode").value = result.ticket?.code || cleanCode;
    navigator.vibrate?.(80);
    if (!result.confirmationRequired) await loadContent({ silent: true });
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
    if (options.autoRestart && !state.qrPendingEntryCode && !state.qrPendingConcessionCode) {
      state.qrAutoRestartTimer = setTimeout(() => {
        if (state.boxOfficeTab === "validateTicket" || state.concessionTab === "validateQr") startQrReader();
      }, 4200);
    }
  }
}

async function confirmTicketConcessions(code) {
  const cleanCode = String(code || state.qrPendingConcessionCode || "").trim();
  if (!cleanCode) {
    renderTicketValidationResult("invalid", { message: "Leia novamente o QR Code para confirmar este pedido." });
    return;
  }
  await validateTicketByCode(cleanCode, { confirmConcessions: true });
}

async function confirmTicketEntry(code) {
  const cleanCode = String(code || state.qrPendingEntryCode || "").trim();
  if (!cleanCode) {
    renderTicketValidationResult("invalid", { message: "Leia novamente o QR Code para liberar esta entrada." });
    return;
  }
  await validateTicketByCode(cleanCode, { confirmEntry: true });
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
  state.qrPendingEntryCode = "";
  state.qrPendingConcessionCode = "";
  if ($("ticketValidationResult")) {
    $("ticketValidationResult").className = "validation-result scanner-ready";
    $("ticketValidationResult").textContent = state.validationMode === "concessions"
      ? "Pronto para conferir o próximo pedido da bomboniere."
      : "Pronto para o próximo ingresso.";
  }
  startQrReader();
}

function renderConcessions() {
  const allItems = state.content?.concessions || [];
  renderConcessionInsights();
  if (state.creating.concession) {
    $("concessionsList").innerHTML = creationPlaceholder("Novo produto", "Preencha nome, preço, estoque e imagem por upload no quadro à direita.");
    fillConcessionForm(null);
    return;
  }
  const categoryFilter = state.concessionCategoryFilter || "all";
  const items = categoryFilter === "all"
    ? allItems
    : allItems.filter((item) => (item.category || "combo").toLowerCase() === categoryFilter.toLowerCase());

  if (!items.length) {
    const filterLabel = categoryFilter !== "all" ? ` na categoria "${categoryFilter}"` : "";
    $("concessionsList").innerHTML = `<div class="empty-state"><strong>Nenhum produto cadastrado${escapeHtml(filterLabel)}</strong><span>Crie produtos para aparecerem no checkout ou selecione outra categoria.</span></div>`;
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

function changeConcessionBreakdownPage(delta) {
  state.concessionBreakdownPage = Math.max(1, (state.concessionBreakdownPage || 1) + delta);
  renderConcessionInsights();
}

function renderConcessionInsights() {
  const insights = $("concessionInsights");
  const discountSummary = $("concessionDiscountSummary");
  const salesBreakdown = $("concessionSalesBreakdown");
  if (!insights || !discountSummary || !salesBreakdown) return;

  const financeSource = state.concessionFinanceData || state.dashboard || {};
  const summary = financeSource.concessionSummary;
  const period = financeSource.period || {};
  const formatDate = (value) => value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
    : "";
  const periodLabel = period.start && period.end
    ? period.start === period.end
      ? `Pedidos pagos em ${formatDate(period.start)}.`
      : `Pedidos pagos de ${formatDate(period.start)} a ${formatDate(period.end)}.`
    : "Somente pedidos pagos no período selecionado.";
  if ($("concessionFinancePeriod")) $("concessionFinancePeriod").textContent = periodLabel;

  if (!summary) {
    insights.innerHTML = `<div class="empty-state compact"><strong>Carregando resultado financeiro</strong><span>Os valores serão conciliados com os pedidos pagos.</span></div>`;
    discountSummary.innerHTML = "";
    salesBreakdown.innerHTML = "";
    return;
  }

  const products = Array.isArray(summary.products) ? summary.products : [];
  insights.innerHTML = `
    <div class="mini-insight"><span>Receita líquida</span><strong>${money(summary.netRevenue)}</strong><small>Valor aprovado atribuído à bomboniere</small></div>
    <div class="mini-insight"><span>Venda bruta</span><strong>${money(summary.grossRevenue)}</strong><small>Antes de benefícios e cupons</small></div>
    <div class="mini-insight"><span>Descontos concedidos</span><strong>${money(summary.discountTotal)}</strong><small>${Number(summary.discountedOrders || 0)} pedido(s) com desconto</small></div>
    <div class="mini-insight"><span>Reembolsos</span><strong>${money(summary.refundTotal)}</strong><small>${Number(summary.refundedQuantity || 0)} item(ns) devolvido(s)</small></div>
    <div class="mini-insight"><span>Volume registrado</span><strong>${Number(summary.itemQuantity || 0)} item(ns)</strong><small>Distribuídos em ${Number(summary.orders || 0)} pedido(s)</small></div>
  `;

  const adjustment = Number(summary.reconciliationAdjustment || 0);
  discountSummary.innerHTML = `
    <div class="concession-formula" aria-label="Fórmula da receita líquida">
      <span><small>Venda bruta</small><strong>${money(summary.grossRevenue)}</strong></span>
      <b aria-hidden="true">−</b>
      <span><small>Descontos identificados</small><strong>${money(summary.identifiedDiscountTotal ?? summary.discountTotal)}</strong></span>
      ${Number(summary.refundTotal || 0) > 0 ? `<b aria-hidden="true">−</b><span><small>Reembolsos confirmados</small><strong>${money(summary.refundTotal)}</strong></span>` : ""}
      ${Math.abs(adjustment) > 0.009 ? `<b aria-hidden="true">${adjustment >= 0 ? "+" : "−"}</b><span><small>Ajuste de conciliação</small><strong>${money(Math.abs(adjustment))}</strong></span>` : ""}
      <b aria-hidden="true">=</b>
      <span class="is-net"><small>Receita líquida</small><strong>${money(summary.netRevenue)}</strong></span>
    </div>
    <div class="concession-discount-sources">
      <span><small>Desconto do Clube</small><strong>${money(summary.clubDiscount)}</strong></span>
      <span><small>Itens grátis do Clube</small><strong>${money(summary.freeItemDiscount)}</strong></span>
      <span><small>Cupons aplicados</small><strong>${money(summary.couponDiscount)}</strong></span>
    </div>
  `;

  const pageSize = state.concessionBreakdownPageSize || 5;
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  state.concessionBreakdownPage = Math.min(Math.max(1, state.concessionBreakdownPage || 1), totalPages);
  const start = (state.concessionBreakdownPage - 1) * pageSize;
  const pageProducts = products.slice(start, start + pageSize);

  const pagerMarkup = products.length > pageSize ? `
    <div class="table-pagination-bar" style="margin-bottom: 12px;">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageProducts.length, products.length)}</strong> de <strong>${products.length}</strong> produto(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.concessionBreakdownPage <= 1 ? "disabled" : ""} onclick="changeConcessionBreakdownPage(-1)">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.concessionBreakdownPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.concessionBreakdownPage >= totalPages ? "disabled" : ""} onclick="changeConcessionBreakdownPage(1)">Próxima →</button>
      </div>
    </div>
  ` : "";

  salesBreakdown.innerHTML = products.length
    ? `${pagerMarkup}${pageProducts.map((item) => {
        const gross = Number(item.grossRevenue || 0);
        const net = Number(item.netRevenue || 0);
        const unitPrice = Number(item.minimumUnitPrice || 0) === Number(item.maximumUnitPrice || 0)
          ? `${money(item.minimumUnitPrice)} por unidade`
          : `${money(item.minimumUnitPrice)} a ${money(item.maximumUnitPrice)} por unidade`;
        const benefitNotes = [
          Number(item.clubDiscountedQuantity || 0) ? `${Number(item.clubDiscountedQuantity)} item(ns) com desconto do Clube` : "",
          Number(item.freeQuantity || 0) ? `${Number(item.freeQuantity)} item(ns) grátis pelo Clube` : "",
          Number(item.couponDiscountedQuantity || 0)
            ? `${Number(item.couponDiscountedQuantity)} item(ns) com ${Array.isArray(item.couponCodes) && item.couponCodes.length ? `cupom ${item.couponCodes.join(", ")}` : "cupom"}`
            : "",
          Number(item.refundedQuantity || 0) ? `${Number(item.refundedQuantity)} item(ns) reembolsado(s)` : ""
        ].filter(Boolean);
        return `
          <article class="concession-breakdown-row">
            <div class="concession-breakdown-product">
              <strong>${escapeHtml(item.name || "Produto")}</strong>
              <span>${Number(item.quantity || 0)} unidade(s) em ${Number(item.orders || 0)} pedido(s) • ${unitPrice}</span>
              ${benefitNotes.length ? `<small>${benefitNotes.map(escapeHtml).join(" • ")}</small>` : `<small>Vendido sem desconto neste período</small>`}
            </div>
            <dl aria-label="Composição financeira de ${escapeHtml(item.name || "Produto")}">
              <div><dt>Bruto</dt><dd>${money(gross)}</dd></div>
              <div class="${Number(item.clubDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Clube</dt><dd>${Number(item.clubDiscount || 0) > 0 ? `− ${money(item.clubDiscount)}` : money(0)}</dd></div>
              <div class="${Number(item.freeItemDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Itens grátis</dt><dd>${Number(item.freeItemDiscount || 0) > 0 ? `− ${money(item.freeItemDiscount)}` : money(0)}</dd></div>
              <div class="${Number(item.couponDiscount || 0) > 0 ? "is-discount" : "is-empty"}"><dt>Cupom</dt><dd>${Number(item.couponDiscount || 0) > 0 ? `− ${money(item.couponDiscount)}` : money(0)}</dd></div>
              <div class="${Number(item.refundTotal || 0) > 0 ? "is-refund" : "is-empty"}"><dt>Reembolso</dt><dd>${Number(item.refundTotal || 0) > 0 ? `− ${money(item.refundTotal)}` : money(0)}</dd></div>
              <div class="${Math.abs(Number(item.reconciliationAdjustment || 0)) > 0.009 ? "" : "is-empty"}"><dt>Ajuste</dt><dd>${Math.abs(Number(item.reconciliationAdjustment || 0)) > 0.009 ? `${Number(item.reconciliationAdjustment) >= 0 ? "+" : "−"} ${money(Math.abs(Number(item.reconciliationAdjustment)))}` : money(0)}</dd></div>
              <div class="is-net"><dt>Líquido</dt><dd>${money(net)}</dd></div>
            </dl>
          </article>`;
      }).join("")}`
    : `<div class="empty-state"><strong>Nenhuma venda paga no período</strong><span>Quando um pedido com produtos da bomboniere for aprovado, cada item e desconto aparecerá detalhado aqui.</span></div>`;
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
  if (state.concessionCategoryFilter && state.concessionCategoryFilter !== "all") {
    if ($("concessionCategory")) $("concessionCategory").value = state.concessionCategoryFilter;
  }
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
    upsertAdminCollection("concessions", saved);
    state.content.concessions.sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
    renderConcessions();
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
    removeAdminCollectionItem("concessions", item.id);
    renderConcessions();
    showToast("Produto excluído.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function fillSettingsForm() {
  const settings = state.content?.settings || {};
  $("settingAnnouncementEnabled").checked = settings.announcementEnabled !== false;
  $("settingAnnouncementText").value = settings.announcementText || "";
  $("eventStartingPrice").value = Number(settings.eventStartingPrice || 0);
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
        eventStartingPrice: Number($("eventStartingPrice").value || 0),
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

function emailCampaignPayload(action = "draft") {
  const brand = {
    name: $("emailBrandName")?.value.trim() || "Cine Cruzeiro",
    logoUrl: $("emailBrandLogoUrl")?.value.trim() || "",
    footer: $("emailBrandFooter")?.value.trim() || ""
  };
  const movieId = $("emailCampaignMovie")?.value || "";
  const movieIds = [...new Set([
    ...Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
    movieId
  ].filter(Boolean))];
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
    variables: { ...campaignPreviewVariables(), ...state.emailCampaignVariables },
    contentBlocks: [],
    imageUrl: $("emailCampaignImageUrl")?.value.trim() || "",
    imageAlt: $("emailCampaignImageAlt")?.value.trim() || "",
    imageLink: $("emailCampaignImageLink")?.value.trim() || "",
    headlineColor: $("emailCampaignHeadlineColor")?.value || "#ffffff",
    textColor: $("emailCampaignTextColor")?.value || "#dbeafe",
    buttonColor: $("emailCampaignButtonColor")?.value || "#facc15",
    scheduleAt: $("emailCampaignScheduleAt")?.value ? new Date($("emailCampaignScheduleAt").value).toISOString() : "",
    brand
  };
}

function campaignCanonicalHtmlWithEdits() {
  const source = $("emailCampaignHtml")?.value || "";
  if (!source) return campaignTemplateHtml();
  const template = document.createElement("template");
  template.innerHTML = source;
  const setText = (selector, value, multiline = false) => {
    template.content.querySelectorAll(selector).forEach((node) => {
      node.textContent = String(value || "");
      if (multiline) node.innerHTML = node.innerHTML.replace(/\r?\n/g, "<br>");
    });
  };
  setText('[data-campaign-field="headline"]', $("emailCampaignHeadline")?.value);
  setText('[data-campaign-field="message"]', $("emailCampaignMessage")?.value, true);
  setText('[data-campaign-field="footer"]', $("emailBrandFooter")?.value);
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

const EMAIL_CAMPAIGN_TEMPLATES = {
  announcement: {
    label: "Comunicado",
    family: "Relacionamento",
    layout: "announcement",
    kicker: "Cine Cruzeiro informa",
    subject: "Novidades do Cine Cruzeiro",
    headline: "Tem novidade no cinema",
    message: "Olá, {{nome}}. Preparamos uma novidade para você.",
    ctaLabel: "Ver programação",
    ctaUrl: "/filmes",
    media: true,
    mediaLabel: "Imagem opcional"
  },
  weekly: {
    label: "Programação da semana",
    family: "Programação",
    layout: "weekly",
    kicker: "Esta semana no Cine Cruzeiro",
    subject: "Sua programação de cinema para esta semana",
    headline: "Escolha sua próxima sessão",
    message: "Olá, {{nome}}. A programação da semana já está pronta.",
    ctaLabel: "Ver programação completa",
    ctaUrl: "/filmes",
    media: true,
    mediaLabel: "Pôsteres da programação + imagem opcional",
    catalog: "movie"
  },
  premiere: {
    label: "Grande estreia",
    family: "Programação",
    layout: "premiere",
    kicker: "Nova estreia",
    subject: "Uma nova estreia chegou ao Cine Cruzeiro",
    headline: "A próxima grande história começa aqui",
    message: "Olá, {{nome}}. Confira a nova estreia e escolha sua sessão.",
    ctaLabel: "Ver sessões",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Pôster automático do filme selecionado",
    catalog: "movie"
  },
  last_chance: {
    label: "Últimos dias",
    family: "Programação",
    layout: "lastChance",
    kicker: "Últimas sessões",
    subject: "Última chance para assistir no cinema",
    headline: "Não deixe para depois",
    message: "Olá, {{nome}}. Este filme está em seus últimos dias na nossa tela.",
    ctaLabel: "Garantir meu ingresso",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Pôster automático do filme selecionado",
    catalog: "movie"
  },
  promotion: {
    label: "Promoção",
    family: "Ofertas",
    layout: "promotion",
    kicker: "Oferta especial",
    subject: "Uma promoção especial para você",
    headline: "Cinema com uma condição especial",
    message: "Olá, {{nome}}. Aproveite esta condição por tempo limitado.",
    ctaLabel: "Aproveitar promoção",
    ctaUrl: "/filmes",
    media: true,
    mediaLabel: "Imagem opcional"
  },
  coupon: {
    label: "Cupom",
    family: "Ofertas",
    layout: "coupon",
    kicker: "Cupom de desconto",
    subject: "Seu cupom do Cine Cruzeiro chegou",
    headline: "Um desconto reservado para você",
    message: "Olá, {{nome}}. Use o código abaixo antes da data de validade.",
    ctaLabel: "Usar meu cupom",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Sem imagem adicional; código em destaque",
    coupon: true
  },
  concession: {
    label: "Produto da bomboniere",
    family: "Bomboniere",
    layout: "concession",
    kicker: "Para acompanhar o filme",
    subject: "Tem novidade na bomboniere",
    headline: "Seu cinema fica ainda melhor com esse sabor",
    message: "Olá, {{nome}}. Conheça este destaque da nossa bomboniere.",
    ctaLabel: "Ver na bomboniere",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Imagem automática do item selecionado",
    catalog: "concessions"
  },
  combo: {
    label: "Combo em destaque",
    family: "Bomboniere",
    layout: "combo",
    kicker: "Combo do cinema",
    subject: "Um combo especial para sua próxima sessão",
    headline: "Filme bom combina com bomboniere completa",
    message: "Olá, {{nome}}. Confira o combo escolhido para sua próxima visita.",
    ctaLabel: "Escolher uma sessão",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Imagens automáticas dos itens selecionados",
    catalog: "concessions"
  },
  club_plan: {
    label: "Plano do Clube",
    family: "Clube",
    layout: "clubPlan",
    kicker: "Clube Cine Cruzeiro",
    subject: "Um plano feito para quem ama cinema",
    headline: "Mais cinema, benefícios de verdade",
    message: "Olá, {{nome}}. Conheça um plano que acompanha o seu ritmo de cinema.",
    ctaLabel: "Assinar este plano",
    ctaUrl: "/clube",
    media: false,
    mediaLabel: "Imagem automática do plano selecionado",
    catalog: "clubPlan"
  },
  club: {
    label: "Novidades do Clube",
    family: "Clube",
    layout: "clubNews",
    kicker: "Clube Cine Cruzeiro",
    subject: "Novidades para membros do Clube",
    headline: "Mais cinema em cada visita",
    message: "Olá, {{nome}}. Conheça os benefícios preparados para membros do Clube.",
    ctaLabel: "Conhecer o Clube",
    ctaUrl: "/clube",
    media: true,
    mediaLabel: "Imagem do plano ou imagem opcional",
    catalog: "clubPlan"
  },
  birthday: {
    label: "Aniversário",
    family: "Relacionamento",
    layout: "birthday",
    kicker: "Hoje a sessão é sua",
    subject: "Feliz aniversário, {{nome}}!",
    headline: "Seu novo ciclo merece cinema",
    message: "Parabéns, {{nome}}! Desejamos um ano cheio de histórias inesquecíveis.",
    ctaLabel: "Escolher um filme",
    ctaUrl: "/filmes",
    media: false,
    mediaLabel: "Sem imagem adicional"
  },
  event: {
    label: "Evento especial",
    family: "Eventos",
    layout: "event",
    kicker: "Evento especial",
    subject: "Um evento especial no Cine Cruzeiro",
    headline: "Reserve esta data",
    message: "Olá, {{nome}}. Você está convidado para uma experiência especial no cinema.",
    ctaLabel: "Ver detalhes",
    ctaUrl: "/eventos",
    media: true,
    mediaLabel: "Imagem opcional"
  },
  ticket: {
    label: "Ingressos",
    family: "Serviço",
    layout: "ticket",
    kicker: "Seus ingressos",
    subject: "Informações sobre seus ingressos",
    headline: "Tudo pronto para sua sessão",
    message: "Olá, {{nome}}. Seus ingressos ficam disponíveis na sua conta. Chegue com antecedência e apresente o QR Code na entrada.",
    ctaLabel: "Ver meus ingressos",
    ctaUrl: "/conta/ingressos",
    media: false,
    mediaLabel: "Sem imagem adicional"
  },
  reactivation: {
    label: "Sentimos sua falta",
    family: "Relacionamento",
    layout: "reactivation",
    kicker: "A tela continua acesa",
    subject: "Sentimos sua falta no Cine Cruzeiro",
    headline: "Tem uma nova história esperando por você",
    message: "Olá, {{nome}}. Faz um tempo desde sua última visita. Venha conferir o que está em cartaz.",
    ctaLabel: "Voltar ao cinema",
    ctaUrl: "/filmes",
    media: true,
    mediaLabel: "Imagem opcional"
  }
};

function campaignObjectiveContext() {
  return {
    objective: $("emailCampaignObjective")?.value || state.emailCampaignObjective || "announcement",
    templateId: $("emailCampaignTemplate")?.value || state.emailCampaignTemplate || "announcement",
    templateSelectionMode: state.emailCampaignTemplateSelectionMode || "automatic",
    movie: selectedCampaignMovie(),
    movieIds: Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
    couponId: $("emailCampaignCoupon")?.value || "",
    concessions: selectedCampaignConcessions(),
    plan: selectedCampaignClubPlan(),
    recipientMode: $("emailCampaignAudience")?.value || "all"
  };
}

function resolveCampaignTemplateClient(context = campaignObjectiveContext()) {
  const objective = context.objective || "announcement";
  const movie = context.movie;
  const movieCount = new Set([...(context.movieIds || []), movie?.id].filter(Boolean).map(String)).size;
  const concessionCount = context.concessions?.length || 0;
  let scenario = "announcement";
  if (context.recipientMode === "birthday_manual") scenario = "birthday";
  else if (context.recipientMode === "reactivation") scenario = "reactivation";
  else if (context.couponId) scenario = "coupon";
  else if (objective === "concession") scenario = concessionCount > 1 ? "combo" : "concession";
  else if (objective === "club") scenario = context.plan ? "club_plan" : "club";
  else if (objective === "offer") scenario = "promotion";
  else if (objective === "event") scenario = "event";
  else if (objective === "programming") scenario = "programming";
  else if (objective === "movie") {
    if (!movie) return { templateId: "", reason: "Selecione o filme para montarmos o layout correto.", compatibleTemplates: [], scenario: "movie", incomplete: true, templateSelectionMode: "automatic" };
    const status = String(movie.status || "").toLowerCase();
    scenario = movie.lastChance === true || ["last_chance", "last_days", "ending_soon"].includes(status) ? "last_chance" : ["upcoming", "coming_soon", "em_breve"].includes(status) ? "premiere" : "now_playing";
  }
  const compatible = {
    announcement: ["announcement"], programming: ["weekly"], premiere: ["premiere", "weekly"], now_playing: ["weekly", "announcement"], last_chance: ["last_chance", "weekly"],
    promotion: ["promotion", "coupon"], coupon: ["coupon", "promotion"], concession: ["concession", "combo"], combo: ["combo", "concession"], club_plan: ["club_plan", "club"], club: ["club"],
    birthday: ["birthday", "announcement"], event: ["event", "announcement"], reactivation: ["reactivation", "announcement"]
  }[scenario] || ["announcement"];
  const incomplete = (objective === "movie" || objective === "programming") && movieCount === 0 || objective === "concession" && concessionCount === 0;
  const manual = context.templateSelectionMode === "manual" && compatible.includes(context.templateId);
  const reasons = {
    premiere: "Selecionado porque o filme ainda está em período de estreia.", now_playing: movieCount > 1 ? "Selecionado porque vários filmes foram escolhidos." : "Selecionado porque o filme está em cartaz.",
    last_chance: "Selecionado porque o catálogo marcou o filme como em últimas sessões.", programming: "Selecionado para apresentar a programação e as sessões disponíveis.", coupon: "Selecionado porque há um cupom válido vinculado à campanha.",
    promotion: "Selecionado para uma oferta editorial sem cupom vinculado.", concession: "Selecionado porque um item ativo da bomboniere foi escolhido.", combo: "Selecionado porque vários itens ativos da bomboniere foram escolhidos.",
    club_plan: "Selecionado porque um plano ativo do Clube foi escolhido.", club: "Selecionado para uma comunicação geral do Clube.", birthday: "Selecionado porque o público foi definido como aniversariantes.",
    reactivation: "Selecionado porque o público representa clientes sem compra recente.", event: "Selecionado porque o objetivo da campanha é um evento.", announcement: "Comunicação geral sem vínculo específico com catálogo."
  };
  return { templateId: incomplete ? "" : manual ? context.templateId : compatible[0], reason: incomplete ? objective === "concession" ? "Selecione ao menos um item ativo da bomboniere." : "Selecione o conteúdo para montarmos o layout correto." : manual ? "Layout escolhido manualmente e compatível com o conteúdo." : reasons[scenario], compatibleTemplates: incomplete ? [] : compatible, scenario, incomplete, templateSelectionMode: manual ? "manual" : "automatic" };
}

function syncCampaignTemplateResolution(resolution = resolveCampaignTemplateClient()) {
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

function campaignTemplateDefinition() {
  return EMAIL_CAMPAIGN_TEMPLATES[$("emailCampaignTemplate")?.value] || EMAIL_CAMPAIGN_TEMPLATES.announcement;
}

function campaignTemplateAbsoluteUrl(value) {
  const safe = campaignEditorAssetUrl(value);
  if (!safe) return "";
  try { return new URL(safe, window.location.origin).href; } catch { return safe; }
}

function campaignEmailLogoUrl(value) {
  const raw = String(value || "").trim() || `${API_BASE}/images/favicon-email.png`;
  return /\/images\/logo-display\.webp(?:[?#].*)?$/i.test(raw)
    ? raw.replace(/\/images\/logo-display\.webp(?:[?#].*)?$/i, "/images/favicon-email.png")
    : raw;
}

function selectedCampaignMovie() {
  return (state.content?.movies || []).find((item) => item.id === $("emailCampaignMovie")?.value) || null;
}

function selectedCampaignMovies() {
  const selectedIds = [
    ...Array.from($("emailCampaignMovies")?.selectedOptions || []).map((option) => option.value),
    $("emailCampaignMovie")?.value || ""
  ].filter(Boolean).map(String);
  const uniqueIds = [...new Set(selectedIds)];
  if (!uniqueIds.length) return (state.content?.movies || []).filter((item) => item.status !== "hidden");
  return uniqueIds
    .map((id) => (state.content?.movies || []).find((item) => String(item.id) === id))
    .filter((item) => item && item.status !== "hidden");
}

function selectedCampaignConcession() {
  return selectedCampaignConcessions()[0] || null;
}

function selectedCampaignConcessions() {
  const ids = Array.from($("emailCampaignConcessions")?.selectedOptions || []).map((option) => option.value);
  const fallback = $("emailCampaignConcession")?.value;
  if (fallback && !ids.includes(fallback)) ids.unshift(fallback);
  return ids.map((id) => (state.content?.concessions || []).find((item) => String(item.id) === String(id))).filter(Boolean);
}

function selectedCampaignClubPlan() {
  return (state.content?.subscriptionPlans || []).find((item) => item.id === $("emailCampaignClubPlan")?.value) || null;
}

function campaignObjectiveCatalogType() {
  return {
    movie: "movie",
    programming: "movie",
    concession: "concessions",
    club: "clubPlan"
  }[$("emailCampaignObjective")?.value || state.emailCampaignObjective] || "";
}

function selectedCampaignCatalogItem() {
  const type = campaignTemplateDefinition().catalog;
  return type === "movie" ? selectedCampaignMovie() : type === "concessions" ? selectedCampaignConcessions() : type === "clubPlan" ? selectedCampaignClubPlan() : null;
}

function campaignTemplateLogo(logoUrl, brandName, align = "left") {
  return `<div style="margin:0 0 22px;text-align:${align}">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" width="126" alt="${escapeHtml(brandName)}" style="display:inline-block;width:126px;max-width:45%;height:auto;border:0;background-color:transparent">` : `<strong style="color:#facc15;font-size:16px">${escapeHtml(brandName)}</strong>`}</div>`;
}

function campaignTemplateButton(label, url, color = "#facc15", align = "left") {
  return url && label ? `<div style="margin-top:24px;text-align:${align}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 19px;background:${color};color:#050912;text-decoration:none;font-weight:800;border-radius:6px">${escapeHtml(label)}</a></div>` : "";
}

function campaignTemplateMessage(message, color = "#dbeafe", align = "left") {
  return `<div style="color:${color};font-size:15px;line-height:1.65;text-align:${align}">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
}

function campaignTemplateImage(url, alt, link = "", options = {}) {
  if (!url) return "";
  const width = Number(options.width || 560);
  const radius = Number(options.radius ?? 8);
  const image = `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;max-height:${Number(options.maxHeight || 380)}px;height:auto;margin:0 auto;border:0;border-radius:${radius}px;object-fit:contain">`;
  return link ? `<a href="${escapeHtml(link)}" style="display:block;text-decoration:none">${image}</a>` : image;
}

function campaignMovieSessions(movie) {
  const sessions = (movie?.sessions || []).filter((session) => session.date && session.time).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 4);
  if (!sessions.length) return `<span style="color:#93a4bd;font-size:12px">Consulte os horários na programação.</span>`;
  return sessions.map((session) => {
    const date = new Date(`${session.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `<span style="display:inline-block;margin:4px 5px 0 0;padding:7px 9px;background:#172235;color:#f3f6fb;border-radius:5px;font-size:12px;font-weight:700">${escapeHtml(date)} · ${escapeHtml(session.time)}${session.format ? ` · ${escapeHtml(session.format)}` : ""}</span>`;
  }).join("");
}

function campaignTemplateShell(content, footer, options = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;margin:0 auto;background:${options.background || "#0d1728"};font-family:'Segoe UI',Arial,sans-serif"><tbody><tr><td style="padding:${options.padding || "28px"};border-top:${options.topBorder || "0"}">${content}<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid ${options.divider || "#233047"};color:${options.muted || "#93a4bd"};font-size:12px;line-height:1.5">${escapeHtml(footer)}</p></td></tr></tbody></table>`;
}

function campaignTemplateHtml() {
  const template = campaignTemplateDefinition();
  const brandName = $("emailBrandName")?.value.trim() || "Cine Cruzeiro";
  const logoUrl = campaignTemplateAbsoluteUrl(campaignEmailLogoUrl($("emailBrandLogoUrl")?.value));
  const headline = $("emailCampaignHeadline")?.value.trim() || template.headline;
  const message = $("emailCampaignMessage")?.value.trim() || template.message;
  const movie = selectedCampaignMovie();
  const concessions = selectedCampaignConcessions();
  const concession = concessions[0];
  const plan = selectedCampaignClubPlan();
  const catalogImage = template.catalog === "movie" ? movie?.posterUrl : template.catalog === "concessions" ? concession?.imageUrl : template.catalog === "clubPlan" ? plan?.imageUrl : "";
  const imageUrl = campaignTemplateAbsoluteUrl(catalogImage || (template.media ? $("emailCampaignImageUrl")?.value : ""));
  const imageAlt = $("emailCampaignImageAlt")?.value.trim() || headline;
  const imageLink = campaignTemplateAbsoluteUrl($("emailCampaignImageLink")?.value);
  const ctaLabel = $("emailCampaignCtaLabel")?.value.trim() || template.ctaLabel;
  const catalogUrl = template.catalog === "movie" && movie
    ? `/filmes/${movie.slug || movie.id}`
    : template.catalog === "clubPlan" && plan
      ? `/clube/assinar/${plan.id}`
      : template.ctaUrl;
  const ctaUrl = template.coupon ? "{{link_cupom}}" : campaignTemplateAbsoluteUrl($("emailCampaignCtaUrl")?.value || catalogUrl);
  const footer = $("emailBrandFooter")?.value.trim() || "Mensagem automática do Cine Cruzeiro.";
  const logo = (align = "left") => campaignTemplateLogo(logoUrl, brandName, align);
  const kicker = (color = "#60a5fa", align = "left") => `<p style="margin:0 0 9px;color:${color};font-size:11px;font-weight:800;text-transform:uppercase;text-align:${align}">${escapeHtml(template.kicker)}</p>`;
  const title = (color = "#ffffff", size = 30, align = "left") => `<h1 style="margin:0 0 18px;color:${color};font-size:${size}px;line-height:1.15;text-align:${align};word-break:normal">${escapeHtml(headline)}</h1>`;
  const linkedImage = campaignTemplateImage(imageUrl, imageAlt, imageLink || ctaUrl);

  if (template.layout === "premiere") {
    const genre = Array.isArray(movie?.genres) ? movie.genres[0] : Array.isArray(movie?.genre) ? movie.genre[0] : movie?.genre || "";
    const details = [movie?.duration ? String(movie.duration) : "", movie?.rating || movie?.classification || "", genre].filter(Boolean).join(" · ");
    return campaignTemplateShell(`${logo("center")}${linkedImage ? `<div style="margin:0 auto 22px;max-width:300px;padding:10px;background:#050912;border-radius:8px">${linkedImage}</div>` : ""}${kicker("#facc15", "center")}${title("#ffffff", 32, "center")}${details ? `<p style="margin:0 0 16px;color:#93a4bd;font-size:12px;text-align:center">${escapeHtml(details)}</p>` : ""}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin-top:18px;text-align:center">${campaignMovieSessions(movie)}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { topBorder: "4px solid #facc15" });
  }
  if (template.layout === "weekly") {
    const films = selectedCampaignMovies().slice(0, 4);
    const rows = films.map((item) => `<tr><td style="padding:12px 0;border-bottom:1px solid #233047"><strong style="display:block;color:#f3f6fb;font-size:14px">${escapeHtml(item.title || "Filme")}</strong><div style="margin-top:4px">${campaignMovieSessions(item)}</div></td></tr>`).join("") || `<tr><td style="padding:14px 0;color:#93a4bd">Cadastre filmes e sessões para preencher esta agenda.</td></tr>`;
    return campaignTemplateShell(`${logo()}${linkedImage ? `<div style="margin:0 0 20px">${linkedImage}</div>` : ""}${kicker("#67e8f9")}${title()}${campaignTemplateMessage(message)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;background:#09111f;border-radius:8px"><tbody>${rows}</tbody></table>${campaignTemplateButton(ctaLabel, ctaUrl, "#67e8f9")}`, footer, { background: "#07111d", topBorder: "4px solid #22d3ee" });
  }
  if (template.layout === "lastChance") {
    return campaignTemplateShell(`${logo("center")}${kicker("#fb7185", "center")}${linkedImage ? `<div style="margin:0 auto 20px;max-width:280px">${linkedImage}</div>` : ""}${title("#ffffff", 32, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:20px 0;padding:13px;background:#2a1019;color:#fecdd3;text-align:center;border-radius:6px;font-size:13px;font-weight:800">Últimas sessões disponíveis</div><div style="text-align:center">${campaignMovieSessions(movie)}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#fb7185", "center")}`, footer, { background: "#120a11", divider: "#42202b", topBorder: "4px solid #fb7185" });
  }
  if (template.layout === "promotion") {
    const coupon = (state.content?.promotions || []).find((item) => item.id === $("emailCampaignCoupon")?.value);
    const audience = campaignAudienceLabel($("emailCampaignAudience")?.value);
    return campaignTemplateShell(`${logo()}<div style="padding:24px;background:#facc15;border-radius:8px;color:#050912">${kicker("#4a3700")}${title("#050912", 34)}${campaignTemplateMessage(message, "#241b00")}${coupon ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid rgba(5,9,18,.28);font-size:13px;font-weight:800">${escapeHtml(coupon.title || "Oferta selecionada")} · ${escapeHtml(couponRuleLabel(coupon))}</p>` : ""}<p style="margin:10px 0 0;font-size:11px;font-weight:700;opacity:.75">Aplicável a: ${escapeHtml(audience)}</p>${campaignTemplateButton(ctaLabel, ctaUrl, "#050912")}</div>${linkedImage ? `<div style="margin-top:20px">${linkedImage}</div>` : ""}`, footer, { background: "#111827" });
  }
  if (template.layout === "coupon") {
    return campaignTemplateShell(`${logo("center")}${kicker("#45d6a1", "center")}${title("#ffffff", 30, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:24px 0;padding:24px 18px;background:#f3f6fb;border:2px dashed #45d6a1;border-radius:8px;text-align:center"><span style="display:block;color:#475569;font-size:11px;text-transform:uppercase">Seu código exclusivo</span><strong style="display:block;margin:8px 0;color:#07111d;font-size:30px;letter-spacing:.08em">{{codigo_cupom}}</strong><span style="color:#475569;font-size:13px">Válido até {{validade_cupom}}</span></div>${campaignTemplateButton(ctaLabel, ctaUrl, "#45d6a1", "center")}`, footer, { background: "#071710", divider: "#1d4938" });
  }
  if (["concession", "combo"].includes(template.layout)) {
    const productName = concession?.name || headline;
    const items = (concession?.comboItems || []).map((item) => `${Number(item.quantity || 1)}x ${item.name}`).join(" · ");
    const compareAt = Number(concession?.compareAt || 0);
    const price = Number(concession?.price || 0);
    const accent = template.layout === "combo" ? "#fb7185" : "#f59e0b";
    const products = concessions.length > 1 ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:separate;border-spacing:0 8px">${concessions.map((item) => `<tr><td style="padding:11px;background:#172235;color:#f3f6fb;font-size:13px;border-radius:6px 0 0 6px"><strong>${escapeHtml(item.name || "Produto")}</strong>${item.description ? `<br><span style="color:#93a4bd;font-size:11px">${escapeHtml(item.description)}</span>` : ""}</td><td style="padding:11px;background:#172235;color:${accent};font-size:13px;font-weight:900;text-align:right;border-radius:0 6px 6px 0">${escapeHtml(money(item.price || 0))}</td></tr>`).join("")}</table>` : "";
    return campaignTemplateShell(`${logo()}${kicker(accent)}${linkedImage ? `<div style="margin:0 0 20px;background:#050912;padding:18px;border-radius:8px">${linkedImage}</div>` : ""}${products}<p style="margin:0 0 5px;color:#93a4bd;font-size:12px">${escapeHtml(concession?.badge || (template.layout === "combo" ? "Combo em destaque" : "Destaque da bomboniere"))}</p><h1 style="margin:0;color:#fff;font-size:28px">${escapeHtml(concessions.length > 1 ? `${concessions.length} itens da bomboniere` : productName)}</h1>${concessions.length <= 1 && price ? `<p style="margin:10px 0 18px;color:${accent};font-size:28px;font-weight:900">${compareAt > price ? `<span style="margin-right:8px;color:#64748b;font-size:14px;text-decoration:line-through">${escapeHtml(money(compareAt))}</span>` : ""}${escapeHtml(money(price))}</p>` : ""}${items ? `<p style="margin:0 0 16px;padding:12px;background:#172235;color:#dbeafe;border-radius:6px;font-size:13px">${escapeHtml(items)}</p>` : ""}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, accent)}`, footer, { background: template.layout === "combo" ? "#160b12" : "#141008", topBorder: `4px solid ${accent}` });
  }
  if (template.layout === "clubPlan") {
    const benefits = (plan?.benefits || []).slice(0, 6).map((benefit) => `<tr><td width="22" valign="top" style="width:22px;padding:5px 0;color:#45d6a1;font-weight:900">✓</td><td style="padding:5px 0;color:#dbeafe;font-size:14px">${escapeHtml(benefit)}</td></tr>`).join("");
    return campaignTemplateShell(`${logo("center")}${kicker("#facc15", "center")}${linkedImage ? `<div style="margin:0 auto 18px;max-width:360px">${linkedImage}</div>` : ""}<h1 style="margin:0;text-align:center;color:#fff;font-size:30px">${escapeHtml(plan?.name || headline)}</h1>${plan ? `<p style="margin:9px 0 20px;text-align:center;color:#facc15;font-size:30px;font-weight:900">${escapeHtml(money(plan.monthlyPrice || 0))}<span style="font-size:13px;color:#93a4bd">/mês</span></p><div style="margin:0 auto 20px;max-width:390px;padding:12px;background:#172235;border-radius:7px;text-align:center;color:#dbeafe;font-size:13px"><strong style="color:#fff">${Number(plan.includedTickets || 0)} ingressos por mês</strong>${Number(plan.ticketDiscountPercent || 0) ? ` · ${Number(plan.ticketDiscountPercent)}% nos ingressos` : ""}${Number(plan.concessionDiscountPercent || 0) ? ` · ${Number(plan.concessionDiscountPercent)}% na bomboniere` : ""}</div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:420px">${benefits ? `<tbody>${benefits}</tbody>` : ""}</table><div style="margin-top:16px">${campaignTemplateMessage(message, "#dbeafe", "center")}</div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { background: "#081425", topBorder: "4px solid #facc15" });
  }
  if (template.layout === "birthday") {
    return campaignTemplateShell(`${logo("center")}<div style="padding:30px 20px;background:#172554;border-radius:8px;text-align:center">${kicker("#fda4af", "center")}${title("#ffffff", 34, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}<div style="margin:22px auto 0;width:54px;height:3px;background:#facc15"></div>${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}</div>`, footer, { background: "#090d1c" });
  }
  if (template.layout === "event") {
    return campaignTemplateShell(`${linkedImage ? `<div style="margin:-28px -28px 24px">${campaignTemplateImage(imageUrl, imageAlt, imageLink || ctaUrl, { width: 620, radius: 0, maxHeight: 330 })}</div>` : ""}${logo("center")}${kicker("#67e8f9", "center")}${title("#ffffff", 32, "center")}${campaignTemplateMessage(message, "#dbeafe", "center")}${campaignTemplateButton(ctaLabel, ctaUrl, "#67e8f9", "center")}`, footer, { background: "#07111d", topBorder: "4px solid #22d3ee" });
  }
  if (template.layout === "ticket") {
    return campaignTemplateShell(`${logo()}${kicker("#45d6a1")}${title()}<div style="margin:18px 0;padding:18px;background:#09111f;border:1px solid #233047;border-radius:7px"><strong style="display:block;color:#fff;font-size:16px">Ingresso digital disponível</strong><span style="display:block;margin-top:6px;color:#93a4bd;font-size:13px">Acesse sua conta para visualizar o QR Code, a sessão e a poltrona.</span></div>${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, "#45d6a1")}`, footer, { background: "#0b1523", topBorder: "4px solid #45d6a1" });
  }
  if (template.layout === "reactivation") {
    return campaignTemplateShell(`${logo()}${linkedImage ? `<div style="margin:0 0 22px">${linkedImage}</div>` : ""}${kicker("#60a5fa")}${title("#fff", 31)}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl, "#60a5fa")}`, footer, { background: "#0a1220", topBorder: "4px solid #4d8dff" });
  }
  if (template.layout === "clubNews") {
    const clubOffer = $("emailCampaignClubOffer")?.value.trim();
    const planDetails = plan ? `<div style="margin:18px auto;padding:14px;background:#172235;border-radius:7px;color:#dbeafe;text-align:center;font-size:13px"><strong style="display:block;color:#fff;font-size:16px">${escapeHtml(plan.name || "Plano do Clube")}</strong><span style="display:block;margin-top:5px;color:#facc15;font-size:20px;font-weight:900">${escapeHtml(money(plan.monthlyPrice || 0))}/mês</span><span style="display:block;margin-top:6px">${Number(plan.includedTickets || 0)} ingresso(s) por mês${Number(plan.ticketDiscountPercent || 0) ? ` · ${Number(plan.ticketDiscountPercent)}% de desconto` : ""}</span></div>` : "";
    return campaignTemplateShell(`${logo("center")}${kicker("#facc15", "center")}${title("#fff", 30, "center")}${linkedImage ? `<div style="margin:0 auto 20px;max-width:430px">${linkedImage}</div>` : ""}${planDetails}${clubOffer ? `<p style="margin:0 0 16px;padding:13px;background:#0d1728;border-top:3px solid #45d6a1;color:#dbeafe;font-size:14px">${escapeHtml(clubOffer).replace(/\n/g, "<br>")}</p>` : ""}${campaignTemplateMessage(message, "#dbeafe", "center")}${campaignTemplateButton(ctaLabel, ctaUrl, "#facc15", "center")}`, footer, { background: "#081425", topBorder: "4px solid #facc15" });
  }
  return campaignTemplateShell(`${logo()}${kicker()}${title()}${linkedImage ? `<div style="margin:0 0 22px">${linkedImage}</div>` : ""}${campaignTemplateMessage(message)}${campaignTemplateButton(ctaLabel, ctaUrl)}`, footer, { topBorder: "4px solid #4d8dff" });
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
    if (previous.catalog !== template.catalog) {
      if ($("emailCampaignCtaUrl")) $("emailCampaignCtaUrl").value = template.ctaUrl;
      if ($("emailCampaignImageUrl")) $("emailCampaignImageUrl").value = "";
      if ($("emailCampaignImageAlt")) $("emailCampaignImageAlt").value = "";
      if ($("emailCampaignImageLink")) $("emailCampaignImageLink").value = "";
    }
    const defaults = { emailCampaignSubject: template.subject, emailCampaignHeadline: template.headline, emailCampaignMessage: template.message, emailCampaignCtaLabel: template.ctaLabel, emailCampaignCtaUrl: template.ctaUrl };
    const previousDefaults = { emailCampaignSubject: previous.subject, emailCampaignHeadline: previous.headline, emailCampaignMessage: previous.message, emailCampaignCtaLabel: previous.ctaLabel, emailCampaignCtaUrl: previous.ctaUrl };
    Object.entries(defaults).forEach(([id, value]) => {
      if ($(id) && (!$(id).value.trim() || $(id).value.trim() === previousDefaults[id])) $(id).value = value;
    });
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
  const item = template.catalog === "movie" ? selectedCampaignMovie() : template.catalog === "concessions" ? selectedCampaignConcessions() : template.catalog === "clubPlan" ? selectedCampaignClubPlan() : null;
  if (!template.catalog) {
    target.innerHTML = "";
    return;
  }
  if (!item || (Array.isArray(item) && !item.length)) {
    target.innerHTML = `<span>Selecione um item para usar os dados reais do catálogo neste e-mail.</span>`;
    return;
  }
  const imageUrl = Array.isArray(item) ? (item[0]?.imageUrl || "") : item.posterUrl || item.imageUrl || "";
  const meta = template.catalog === "movie"
    ? `${(item.sessions || []).length} sessão(ões) cadastrada(s)${item.duration ? ` · ${String(item.duration)}` : ""}`
    : template.catalog === "concessions"
      ? `${item.length} item(ns) selecionado(s) · ${money(item.reduce((sum, entry) => sum + Number(entry.price || 0), 0))}`
      : `${money(item.monthlyPrice || 0)}/mês · ${Number(item.includedTickets || 0)} ingresso(s)`;
  const itemName = Array.isArray(item) ? item.map((entry) => entry.name || "Produto").join(", ") : item.title || item.name || "Item selecionado";
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
    const movie = selectedCampaignMovie();
    const concessions = selectedCampaignConcessions();
    const plan = selectedCampaignClubPlan();
    const coupon = (state.content?.promotions || []).find((item) => item.id === $("emailCampaignCoupon")?.value);
    const linked = movie?.title || plan?.name || (concessions.length ? `${concessions.length} item(ns) da bomboniere` : coupon?.title) || "Sem item de catálogo";
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

async function loadEmailCampaignHistory(options = {}) {
  const params = new URLSearchParams({
    page: String(state.emailCampaignHistoryPage || 1),
    pageSize: String(state.emailCampaignHistoryPageSize || 25)
  });
  if (state.emailCampaignHistoryFilter && state.emailCampaignHistoryFilter !== "all") params.set("status", state.emailCampaignHistoryFilter);
  if (state.emailCampaignHistoryOrigin) params.set("origin", state.emailCampaignHistoryOrigin);
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
        <div class="email-template-card-meta"><span>${escapeHtml(item.visualStyle || "editorial")}</span><span>${item.origin === "AI_GENERATED" ? "Gemini" : item.origin === "MANUAL" ? "Manual" : "Sistema"}</span></div>
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
      const html = campaign.html || `<div style="padding:32px;background:#0d1728;color:#fff;font-family:Arial,sans-serif"><h1>${escapeHtml(campaign.headline || campaign.subject || summary.name)}</h1><p>${escapeHtml(campaign.message || "")}</p></div>`;
      $("emailTemplatePreviewContent").innerHTML = '<iframe title="Prévia segura do modelo" sandbox="allow-popups"></iframe>';
      $("emailTemplatePreviewContent").querySelector("iframe").srcdoc = html;
    } else {
      $("emailTemplatePreviewContent").innerHTML = `<div class="email-template-system-preview"><span>${escapeHtml(summary.categoryLabel || "Modelo")}</span><strong>${escapeHtml(summary.name || "")}</strong><p>${escapeHtml(summary.description || "")}</p><small>O conteúdo real será montado pelo editor com os filmes, ofertas e público que você selecionar.</small></div>`;
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
  const objective = item.objective || "announcement";
  document.querySelector(`[data-campaign-objective="${objective}"]`)?.click();
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

async function prepareEmailTemplateAiVariation(item = null) {
  const assistant = document.querySelector(".campaign-ai-assistant");
  if (!assistant) return;
  let referenceId = item?.sourceType === "campaign" ? item.sourceId || "" : "";
  if (referenceId && item.status !== "DRAFT_REFERENCE") {
    const duplicated = await api(`/api/admin/email/campaigns/${encodeURIComponent(referenceId)}/duplicate`, { method: "POST" });
    referenceId = duplicated.campaign.id;
    state.content.emailCampaigns ||= [];
    state.content.emailCampaigns.unshift(duplicated.campaign);
  }
  assistant.open = true;
  if ($("emailCampaignAiObjective")) $("emailCampaignAiObjective").value = item?.objective || "announcement";
  if ($("emailCampaignAiMovie")) $("emailCampaignAiMovie").value = item?.movieId || "";
  if ($("emailCampaignAiMovies")) {
    const movieIds = new Set((item?.movieIds || []).map(String));
    Array.from($("emailCampaignAiMovies").options).forEach((option) => { option.selected = movieIds.has(String(option.value)); });
  }
  if ($("emailCampaignAiCoupon")) $("emailCampaignAiCoupon").value = item?.couponId || "";
  if ($("emailCampaignAiClubPlan")) $("emailCampaignAiClubPlan").value = item?.clubPlanId || "";
  if ($("emailCampaignAiConcessions")) {
    const concessionIds = new Set((item?.concessionIds || []).map(String));
    Array.from($("emailCampaignAiConcessions").options).forEach((option) => { option.selected = concessionIds.has(String(option.value)); });
  }
  if ($("emailCampaignAiAudience")) $("emailCampaignAiAudience").value = item?.recipientMode || "all";
  renderEmailCampaignAiControls();
  if (referenceId && $("emailCampaignAiCampaign")) {
    $("emailCampaignAiCampaign").value = referenceId;
  }
  if ($("emailCampaignAiBrief")) {
    $("emailCampaignAiBrief").value = item
      ? `Crie uma variação coerente deste modelo de ${item.categoryLabel || "campanha"}. Preserve a identidade do Cine Cruzeiro e use somente dados válidos do conteúdo selecionado.`
      : "Descreva aqui a finalidade, o público e a direção visual do novo modelo.";
  }
  renderEmailCampaignAiControls();
  $("emailTemplatePreviewDialog")?.close();
  assistant.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast(item ? "Referência preparada no assistente do Gemini." : "Assistente do Gemini aberto para criar o modelo.");
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
    return `<div class="campaign-history-row"><div class="campaign-history-main"><strong>${escapeHtml(subject)}</strong><small>${escapeHtml(context ? `${context} · ${delivery}${unsupported}` : `${delivery}${unsupported}`)} · ${item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}</small></div><div class="campaign-history-actions">${item.aiGenerated ? `<span class="campaign-history-ai">IA</span>` : ""}<span class="campaign-status ${escapeHtml(item.status || "draft")}">${escapeHtml({ draft: "Rascunho", scheduled: "Agendada", queued: "Na fila", sending: "Enviando", sent: "Concluída", completed: "Concluída", completed_with_errors: "Concluída com falhas", failed: "Falhou", cancelled: "Cancelada" }[item.status] || "Rascunho")}</span><button class="icon-button campaign-history-menu-button" type="button" data-floating-menu-trigger onclick="toggleEmailCampaignMenu('${escapeHtml(item.id)}', event)" aria-label="Ações de ${escapeHtml(subject)}" aria-haspopup="menu" aria-expanded="false"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle></svg></button></div></div>`;
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
    state.emailCampaignConcessionIds = (campaign.concessionIds || (campaign.concessionId ? [campaign.concessionId] : [])).map(String);
    state.emailCampaignObjective = campaign.objective || (campaign.templateId === "weekly" ? "programming" : ["premiere", "last_chance"].includes(campaign.templateId) ? "movie" : ["promotion", "coupon"].includes(campaign.templateId) ? "offer" : ["concession", "combo"].includes(campaign.templateId) ? "concession" : ["club", "club_plan"].includes(campaign.templateId) ? "club" : campaign.templateId === "event" ? "event" : "announcement");
    state.emailCampaignTemplateSelectionMode = campaign.templateSelectionMode || "manual";
    state.emailCampaignUseCanonicalHtml = Boolean(campaign.aiGenerated && campaign.html);
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
      <div class="campaign-report-head"><div><strong>${escapeHtml(campaign.subject || "Relatório da campanha")}</strong><small>${escapeHtml(campaign.error || "Resultados consolidados a partir dos destinatários persistidos.")}</small></div><button type="button" class="icon-button" aria-label="Fechar relatório" onclick="this.closest('.campaign-report').hidden=true">×</button></div>
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
  renderEmailCampaignAiControls();
  void refreshEmailCampaignRecipients().catch(() => null);
}

const EMAIL_CAMPAIGN_AI_OBJECTIVES = [
  ["movie", "Filme"],
  ["programming", "Programação"],
  ["offer", "Oferta ou cupom"],
  ["concession", "Bomboniere"],
  ["club", "Clube Cine Cruzeiro"],
  ["event", "Evento"],
  ["announcement", "Comunicado"]
];

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

function emailCampaignAiContext() {
  const objective = $("emailCampaignAiObjective")?.value || "announcement";
  const movieIds = objective === "programming"
    ? Array.from($("emailCampaignAiMovies")?.selectedOptions || []).map((option) => option.value)
    : [$("emailCampaignAiMovie")?.value || ""].filter(Boolean);
  const movie = (state.content?.movies || []).find((item) => String(item.id) === String(movieIds[0] || "")) || null;
  const concessions = objective === "concession"
    ? Array.from($("emailCampaignAiConcessions")?.selectedOptions || []).map((option) => (state.content?.concessions || []).find((item) => String(item.id) === String(option.value))).filter(Boolean)
    : [];
  const plan = objective === "club"
    ? (state.content?.subscriptionPlans || []).find((item) => String(item.id) === String($("emailCampaignAiClubPlan")?.value || "")) || null
    : null;
  return {
    objective,
    movie,
    movieId: movieIds[0] || "",
    movieIds,
    couponId: objective === "offer" ? $("emailCampaignAiCoupon")?.value || "" : "",
    concessions,
    plan,
    recipientMode: $("emailCampaignAiAudience")?.value || "all",
    templateSelectionMode: "automatic"
  };
}

function emailCampaignAiPromptTemplates() {
  return Array.isArray(state.content?.settings?.emailAiPromptTemplates)
    ? state.content.settings.emailAiPromptTemplates
    : [];
}

function renderEmailCampaignAiPromptEditor(activeScenario = "announcement", options = {}) {
  const select = $("emailCampaignAiPromptTemplate");
  const textarea = $("emailCampaignAiPromptText");
  if (!select || !textarea) return;
  const templates = emailCampaignAiPromptTemplates();
  if (!templates.length) {
    select.innerHTML = '<option value="">Modelos indisponíveis</option>';
    textarea.value = "";
    textarea.disabled = true;
    $("emailCampaignAiPromptSave").disabled = true;
    $("emailCampaignAiPromptReset").disabled = true;
    if ($("emailCampaignAiPromptStatus")) $("emailCampaignAiPromptStatus").textContent = "Não foi possível carregar os modelos.";
    return;
  }

  textarea.disabled = false;
  const activeTemplate = templates.find((item) => item.scenario === activeScenario) || templates.find((item) => item.id === "announcement") || templates[0];
  if ($("emailCampaignAiActivePrompt")) $("emailCampaignAiActivePrompt").textContent = `Em uso: ${activeTemplate.name}`;

  const previousId = state.emailCampaignAiPromptTemplateId || select.value;
  const nextId = options.followActive && !state.emailCampaignAiPromptDirty
    ? activeTemplate.id
    : (templates.some((item) => item.id === previousId) ? previousId : activeTemplate.id);
  select.innerHTML = templates.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.customized ? " · personalizado" : ""}</option>`).join("");
  select.value = nextId;
  state.emailCampaignAiPromptTemplateId = nextId;

  const selected = templates.find((item) => item.id === nextId) || activeTemplate;
  if (!state.emailCampaignAiPromptDirty || options.forceValue) textarea.value = selected.prompt || "";
  if ($("emailCampaignAiPromptDescription")) $("emailCampaignAiPromptDescription").textContent = selected.description || "Modelo de criação deste tipo de e-mail.";
  if ($("emailCampaignAiPromptSave")) $("emailCampaignAiPromptSave").disabled = false;
  if ($("emailCampaignAiPromptReset")) $("emailCampaignAiPromptReset").disabled = !selected.customized;
  if ($("emailCampaignAiPromptStatus") && (options.forceValue || !state.emailCampaignAiPromptDirty)) {
    $("emailCampaignAiPromptStatus").textContent = selected.customized ? "Modelo personalizado salvo." : "Usando o modelo padrão do sistema.";
  }
}

async function saveEmailCampaignAiPromptTemplate({ reset = false } = {}) {
  const id = state.emailCampaignAiPromptTemplateId || $("emailCampaignAiPromptTemplate")?.value || "";
  const prompt = $("emailCampaignAiPromptText")?.value.trim() || "";
  const button = reset ? $("emailCampaignAiPromptReset") : $("emailCampaignAiPromptSave");
  if (!id || (!reset && prompt.length < 80)) {
    showToast("O modelo precisa ter pelo menos 80 caracteres.", "error");
    return;
  }
  if (button) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  }
  if ($("emailCampaignAiPromptStatus")) $("emailCampaignAiPromptStatus").textContent = reset ? "Restaurando modelo..." : "Salvando modelo...";
  try {
    const result = await api("/api/admin/email/prompt-templates", {
      method: "PUT",
      body: JSON.stringify({ id, prompt, reset })
    });
    state.content.settings ||= {};
    state.content.settings.emailAiPromptTemplates = result.templates || [];
    state.emailCampaignAiPromptDirty = false;
    const scenario = $("emailCampaignAiScenario")?.value || "announcement";
    renderEmailCampaignAiPromptEditor(scenario, { forceValue: true });
    showToast(reset ? "Modelo padrão restaurado" : "Modelo de IA salvo", "ok");
  } catch (error) {
    if ($("emailCampaignAiPromptStatus")) $("emailCampaignAiPromptStatus").textContent = error.message || "Não foi possível salvar o modelo.";
    showToast(error.message || "Não foi possível salvar o modelo.", "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
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

function emailCampaignHistoryMatchesFilter(item, filter) {
  if (filter === "drafts") return !item.status || item.status === "draft";
  if (filter === "scheduled") return item.status === "scheduled";
  if (filter === "processing") return ["queued", "sending"].includes(item.status);
  if (filter === "completed") return ["completed", "sent"].includes(item.status);
  if (filter === "errors") return ["completed_with_errors", "failed"].includes(item.status);
  if (filter === "cancelled") return item.status === "cancelled";
  return true;
}

function renderEmailCampaignAiControls() {
  const objective = $("emailCampaignAiObjective");
  const movie = $("emailCampaignAiMovie");
  const movies = $("emailCampaignAiMovies");
  const coupon = $("emailCampaignAiCoupon");
  const plan = $("emailCampaignAiClubPlan");
  const concessions = $("emailCampaignAiConcessions");
  const template = $("emailCampaignAiTemplate");
  const reference = $("emailCampaignAiCampaign");
  if (!objective || !movie || !movies || !coupon || !plan || !concessions || !template || !reference) return;

  const currentObjective = objective.value || "announcement";
  objective.innerHTML = EMAIL_CAMPAIGN_AI_OBJECTIVES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  objective.value = EMAIL_CAMPAIGN_AI_OBJECTIVES.some(([value]) => value === currentObjective) ? currentObjective : "announcement";

  const currentMovie = movie.value;
  movie.innerHTML = `<option value="">Escolha conforme o objetivo</option>${(state.content?.movies || []).filter((item) => item.status !== "hidden").map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title || "Filme sem título")}</option>`).join("")}`;
  movie.value = (state.content?.movies || []).some((item) => item.id === currentMovie && item.status !== "hidden") ? currentMovie : "";

  const currentMovies = new Set(Array.from(movies.selectedOptions).map((option) => option.value));
  movies.innerHTML = (state.content?.movies || []).filter((item) => item.status !== "hidden").map((item) => `<option value="${escapeHtml(item.id)}" ${currentMovies.has(String(item.id)) ? "selected" : ""}>${escapeHtml(item.title || "Filme sem título")}</option>`).join("");

  const currentCoupon = coupon.value;
  coupon.innerHTML = `<option value="">Nenhum cupom</option>${(state.content?.promotions || []).filter((item) => item.couponCode && item.active !== false).map((item) => {
    const expired = item.endsAt && new Date(item.endsAt).getTime() < Date.now();
    const exhausted = Number(item.usageLimit || 0) > 0 && Number(item.usageCount || 0) >= Number(item.usageLimit);
    return `<option value="${escapeHtml(item.id)}" ${expired || exhausted ? "disabled" : ""}>${escapeHtml(item.couponCode)} · ${escapeHtml(item.title || "Cupom")}${expired ? " · expirado" : exhausted ? " · limite atingido" : ""}</option>`;
  }).join("")}`;
  coupon.value = (state.content?.promotions || []).some((item) => item.id === currentCoupon && item.couponCode && item.active !== false) ? currentCoupon : "";

  const currentPlan = plan.value;
  plan.innerHTML = `<option value="">Nenhum plano</option>${(state.content?.subscriptionPlans || []).filter((item) => item.active !== false).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || "Plano")} · ${escapeHtml(money(item.monthlyPrice || item.price || 0))}/mês</option>`).join("")}`;
  plan.value = (state.content?.subscriptionPlans || []).some((item) => item.id === currentPlan && item.active !== false) ? currentPlan : "";

  const selectedConcessions = new Set(Array.from(concessions.selectedOptions).map((option) => option.value));
  concessions.innerHTML = (state.content?.concessions || []).filter((item) => item.active !== false).map((item) => {
    const unavailable = item.stock !== "" && item.stock !== undefined && Number(item.stock || 0) <= 0;
    return `<option value="${escapeHtml(item.id)}" ${selectedConcessions.has(String(item.id)) && !unavailable ? "selected" : ""} ${unavailable ? "disabled" : ""}>${escapeHtml(item.name || "Produto")} · ${escapeHtml(money(item.price || 0))}${unavailable ? " · sem estoque" : ""}</option>`;
  }).join("");
  const context = emailCampaignAiContext();
  const resolution = resolveCampaignTemplateClient(context);
  $("emailCampaignAiScenario").value = resolution.scenario || "announcement";
  template.value = resolution.templateId || "";
  if ($("emailCampaignAiResolvedTemplate")) $("emailCampaignAiResolvedTemplate").textContent = resolution.templateId ? emailCampaignTemplateLabel(resolution.templateId) : "Aguardando conteúdo";
  if ($("emailCampaignAiTemplateReason")) $("emailCampaignAiTemplateReason").textContent = resolution.reason || "Selecione o conteúdo para montarmos o layout correto.";
  renderEmailCampaignAiPromptEditor(resolution.scenario || "announcement", { followActive: true });
  const visibleFields = {
    emailCampaignAiMovieField: ["movie", "offer"].includes(context.objective),
    emailCampaignAiMoviesField: context.objective === "programming",
    emailCampaignAiCouponField: context.objective === "offer",
    emailCampaignAiClubPlanField: context.objective === "club",
    emailCampaignAiConcessionsField: context.objective === "concession"
  };
  Object.entries(visibleFields).forEach(([id, visible]) => { if ($(id)) $(id).hidden = !visible; });
  const currentReference = reference.value;
  const compatibleTemplates = resolution.compatibleTemplates || [];
  const drafts = (state.content?.emailCampaigns || []).filter((item) => (!item.status || ["draft", "failed"].includes(item.status)) && compatibleTemplates.includes(item.templateId));
  reference.innerHTML = `<option value="">Nenhum rascunho</option>${drafts.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.subject || "Campanha sem assunto")} · ${escapeHtml(emailCampaignTemplateLabel(item.templateId))}</option>`).join("")}`;
  reference.value = drafts.some((item) => item.id === currentReference) ? currentReference : "";
  const button = $("emailCampaignAiGenerate");
  if (button) button.disabled = Boolean(resolution.incomplete);
  setEmailCampaignAiStatus(resolution.incomplete
    ? resolution.reason
    : `Layout ${emailCampaignTemplateLabel(resolution.templateId)} preparado automaticamente. Referências incompatíveis ficam fora da lista.`);
}

function setEmailCampaignAiStatus(message, kind = "") {
  const status = $("emailCampaignAiStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `campaign-ai-status${kind ? ` ${kind}` : ""}`;
}

async function generateEmailCampaignAiDraft() {
  const button = $("emailCampaignAiGenerate");
  if (!button || button.disabled) return;
  const context = emailCampaignAiContext();
  const resolution = resolveCampaignTemplateClient(context);
  if (resolution.incomplete) {
    setEmailCampaignAiStatus(resolution.reason, "warning");
    return;
  }
  const payload = {
    aiProvider: "gemini",
    objective: context.objective,
    scenario: resolution.scenario,
    movieId: context.movieId,
    movieIds: context.movieIds,
    couponId: context.couponId,
    clubPlanId: context.plan?.id || "",
    concessionIds: context.concessions.map((item) => item.id).filter(Boolean),
    referenceTemplateId: resolution.templateId,
    referenceCampaignId: $("emailCampaignAiCampaign")?.value || "",
    recipientMode: $("emailCampaignAiAudience")?.value || "all",
    brief: $("emailCampaignAiBrief")?.value.trim() || ""
  };
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  setEmailCampaignAiStatus("Analisando catálogo e referências...", "loading");
  const resultBox = $("emailCampaignAiResult");
  if (resultBox) resultBox.hidden = true;
  try {
    const result = await api("/api/admin/email/campaigns/ai-draft", { method: "POST", body: JSON.stringify(payload) });
    const campaign = result.campaign || {};
    const ai = result.ai || {};
    const eligibility = ai.eligibility || {};
    const warnings = Array.isArray(eligibility.warnings) ? eligibility.warnings : [];
    const generatedCoupon = ai.coupon || null;
    const providerLabel = `Google Gemini${ai.model ? ` (${ai.model})` : ""}`;
    state.emailCampaignAiDraftId = campaign.id || "";
    if (state.content) state.content.emailCampaigns = [campaign, ...(state.content.emailCampaigns || []).filter((item) => item.id !== campaign.id)];
    if (state.content && generatedCoupon?.id) {
      state.content.promotions = [generatedCoupon, ...(state.content.promotions || []).filter((item) => item.id !== generatedCoupon.id)];
      renderPromotions();
    }
    renderEmailCampaigns();
    setEmailCampaignAiStatus(`Rascunho criado por ${providerLabel}, com catálogo e público conferidos.`, "success");
    if ($("emailCampaignAiResultTitle")) $("emailCampaignAiResultTitle").textContent = `Rascunho criado por ${providerLabel}.`;
    if ($("emailCampaignAiResultSummary")) {
      const recipients = eligibility.recipients;
      const resolved = ai.templateResolution || campaign.templateResolution;
      const layout = resolved?.templateId ? ` Layout: ${emailCampaignTemplateLabel(resolved.templateId)}.` : "";
      const visual = ai.visualStyleLabel ? ` Direção visual: ${ai.visualStyleLabel}.` : "";
      const coupon = generatedCoupon?.couponCode ? ` Cupom ${generatedCoupon.couponCode} criado e vinculado para revisão.` : "";
      const schedule = ai.scheduleAt ? ` Envio agendado para ${new Date(ai.scheduleAt).toLocaleString("pt-BR")}.` : "";
      const promptModel = ai.promptTemplate?.name ? ` Modelo de instrução: ${ai.promptTemplate.name}.` : "";
      $("emailCampaignAiResultSummary").textContent = recipients
        ? `${recipients.eligible || 0} destinatário(s) elegível(is); ${recipients.excluded || 0} excluído(s) pelas regras da oferta.${layout}${promptModel}${visual}${coupon}${schedule}`
        : `Catálogo e datas validados. Confira a prévia antes de enviar.${layout}${promptModel}${visual}${coupon}${schedule}`;
    }
    const warningList = $("emailCampaignAiWarnings");
    if (warningList) {
      warningList.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
      warningList.hidden = !warnings.length;
    }
    if (resultBox) resultBox.hidden = false;
    showToast("Rascunho criado por Google Gemini", "ok");
  } catch (error) {
    const retryable = ["GEMINI_INVALID_RESPONSE", "GEMINI_EMPTY_RESPONSE", "GEMINI_TIMEOUT", "GEMINI_UNAVAILABLE"].includes(error.code);
    const message = `${error.message || "Não foi possível criar o rascunho."}${retryable ? " O briefing continua preenchido; tente novamente." : ""}`;
    setEmailCampaignAiStatus(message, "error");
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
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

function renderPromotions() {
  const items = state.content?.promotions || [];
  const activeItems = items.filter((item) => !item.archivedAt);
  const archivedItems = items.filter((item) => Boolean(item.archivedAt));
  const visibleItems = state.promotionView === "archived" ? archivedItems : activeItems;
  $("activePromotionsCount").textContent = String(activeItems.length);
  $("archivedPromotionsCount").textContent = String(archivedItems.length);
  $("activePromotionsTab").classList.toggle("active", state.promotionView === "active");
  $("activePromotionsTab").setAttribute("aria-selected", String(state.promotionView === "active"));
  $("archivedPromotionsTab").classList.toggle("active", state.promotionView === "archived");
  $("archivedPromotionsTab").setAttribute("aria-selected", String(state.promotionView === "archived"));
  if (state.creating.promotion) {
    $("promotionsList").innerHTML = creationPlaceholder("Novo cupom", "Configure a regra comercial no quadro à direita.");
    fillPromotionForm(null);
    return;
  }
  if (!visibleItems.some((item) => item.id === state.selectedPromotionId)) {
    state.selectedPromotionId = visibleItems[0]?.id || "";
  }
  $("promotionsList").innerHTML = visibleItems.length
    ? visibleItems.map((item) => `
        <button class="list-item ${item.id === state.selectedPromotionId ? "active" : ""}" type="button" onclick="selectPromotion('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="list-meta">${item.couponCode ? `${escapeHtml(item.couponCode)} • ${couponRuleLabel(item)} • ` : "promoção sem código • "}${couponStatusLabel(item)}</span>
          </span>
          <span class="badge">${Number(item.usageCount || 0)} uso(s)</span>
        </button>
      `).join("")
    : `<div class="empty-state"><strong>${state.promotionView === "archived" ? "Nenhum cupom arquivado" : "Nenhum cupom ativo"}</strong><span>${state.promotionView === "archived" ? "Cupons expirados e utilizados continuarão disponíveis aqui para consulta." : "Crie códigos de desconto com período e limites de uso."}</span></div>`;
  const selected = currentPromotion();
  fillPromotionForm(selected);
  if (selected && state.promotionUsageCouponId !== selected.id && !state.promotionUsageLoading) {
    void loadPromotionUsage(selected.id, 1);
  }
}

function couponRuleLabel(item) {
  if (item.discountType === "percent") return `${Number(item.value || 0)}%`;
  if (item.discountType === "fixed_price") return `preço final ${money(item.value)}`;
  return `${money(item.value)} de desconto`;
}

function couponStatusLabel(item) {
  if (item.archivedAt) return item.archiveReason === "expired" ? "arquivado após expirar" : "arquivado";
  if (item.active === false) return "inativo";
  const now = Date.now();
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return "agendado";
  if (item.endsAt && new Date(item.endsAt).getTime() < now) return "expirado";
  if (Number(item.usageLimit || 0) > 0 && Number(item.usageCount || 0) >= Number(item.usageLimit)) return "limite atingido";
  return "disponível";
}

function setPromotionView(view) {
  state.promotionView = view === "archived" ? "archived" : "active";
  state.creating.promotion = false;
  state.selectedPromotionId = "";
  state.promotionUsageCouponId = "";
  state.promotionUsageHistory = [];
  state.promotionUsageMeta = null;
  renderPromotions();
}

function selectPromotion(id) {
  state.creating.promotion = false;
  state.selectedPromotionId = id;
  state.promotionUsageCouponId = "";
  state.promotionUsageHistory = [];
  state.promotionUsageMeta = null;
  renderPromotions();
}

function newPromotion() {
  setAdminSubtab("marketing", "promotions");
  state.promotionView = "active";
  state.creating.promotion = true;
  state.selectedPromotionId = "";
  $("promotionsList").innerHTML = creationPlaceholder("Novo cupom", "Configure a regra comercial no quadro à direita.");
  fillPromotionForm(null);
}

function fillPromotionForm(item) {
  syncCreationControl("promotion", "cancelPromotionCreateButton", "deletePromotionButton", Boolean(item));
  const hasUsage = Number(item?.usageCount || 0) > 0;
  const archivedWithHistory = Boolean(item?.archivedAt && hasUsage);
  setDisabled("deletePromotionButton", !item || archivedWithHistory);
  if ($("deletePromotionButton")) {
    $("deletePromotionButton").textContent = archivedWithHistory ? "Arquivado" : hasUsage ? "Arquivar" : "Excluir";
  }
  $("promotionId").value = item?.id || "";
  $("promotionTitle").value = item?.title || "";
  $("promotionDescription").value = item?.description || "";
  $("promotionDiscountType").value = item?.discountType || "percent";
  $("promotionValue").value = item?.value ?? 10;
  $("promotionCouponCode").value = item?.couponCode || "";
  $("promotionAppliesTo").value = item?.appliesTo || "all";
  $("promotionMinimumOrderValue").value = Number(item?.minimumOrderValue || 0) || "";
  $("promotionMaximumDiscount").value = Number(item?.maximumDiscount || 0) || "";
  $("promotionUsageLimit").value = Number(item?.usageLimit || 0) || "";
  $("promotionPerCustomerLimit").value = Number(item?.perCustomerLimit || 0) || "";
  $("promotionStartsAt").value = datetimeLocalValue(item?.startsAt);
  $("promotionEndsAt").value = datetimeLocalValue(item?.endsAt);
  $("promotionFirstPurchaseOnly").checked = Boolean(item?.firstPurchaseOnly);
  $("promotionAllowClubStacking").checked = Boolean(item?.allowClubStacking);
  $("promotionActive").checked = item?.active !== false;
  const selectedMovies = new Set(item?.allowedMovieIds || []);
  $("promotionAllowedMovieIds").innerHTML = (state.content?.movies || [])
    .map((movie) => `<option value="${escapeHtml(movie.id)}" ${selectedMovies.has(movie.id) ? "selected" : ""}>${escapeHtml(movie.title)}</option>`)
    .join("");
  $("promotionUsageStats").innerHTML = item ? `
    <div class="coupon-usage-stat"><span>Status</span><strong>${couponStatusLabel(item)}</strong></div>
    <div class="coupon-usage-stat"><span>Utilizações pagas</span><strong>${Number(item.usageCount || 0)}</strong></div>
    <div class="coupon-usage-stat"><span>Desconto concedido</span><strong>${money(item.discountGranted)}</strong></div>
  ` : "";
  const archiveNotice = $("promotionArchiveNotice");
  archiveNotice.hidden = !item?.archivedAt;
  archiveNotice.innerHTML = item?.archivedAt
    ? `<strong>Cupom arquivado</strong><span>${item.archiveReason === "expired" ? "A validade terminou" : "Arquivado manualmente"} em ${escapeHtml(formatCouponUsageDate(item.archivedAt))}. O histórico financeiro foi preservado.</span>`
    : "";
  $("promotionUsageHistorySection").hidden = !item;
  renderPromotionUsageHistory();
}

function formatCouponUsageDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function couponOrderReference(orderId) {
  const suffix = String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "000000";
  return `#CC-${suffix}`;
}

function renderPromotionUsageHistory() {
  const container = $("promotionUsageHistory");
  const pager = $("promotionUsagePager");
  const summary = $("promotionUsageHistorySummary");
  if (!container || !pager || !summary) return;
  const item = currentPromotion();
  if (!item) {
    container.innerHTML = "";
    pager.innerHTML = "";
    return;
  }
  if (state.promotionUsageLoading) {
    summary.textContent = "Carregando as compras vinculadas a este cupom.";
    container.innerHTML = `<div class="coupon-history-loading"><span class="inline-spinner" aria-hidden="true"></span>Buscando histórico de uso...</div>`;
    pager.innerHTML = "";
    return;
  }
  const meta = state.promotionUsageMeta;
  summary.textContent = meta?.total
    ? `${meta.total} compra(s) paga(s), com ${money(meta.discountGranted)} concedidos em descontos.`
    : "Nenhuma compra paga utilizou este cupom.";
  container.innerHTML = state.promotionUsageHistory.length
    ? state.promotionUsageHistory.map((usage) => `
        <article class="coupon-history-row">
          <div class="coupon-history-customer">
            <strong>${escapeHtml(usage.customerName || "Cliente")}</strong>
            <span>${escapeHtml(usage.customerEmail || "E-mail não informado")}</span>
          </div>
          <div class="coupon-history-date">
            <span class="coupon-history-label">Data e hora</span>
            <strong>${escapeHtml(formatCouponUsageDate(usage.usedAt))}</strong>
          </div>
          <div class="coupon-history-session">
            <span class="coupon-history-label">Filme e sessão</span>
            <strong>${escapeHtml(usage.movieTitle || "Compra sem filme")}</strong>
            <span>${escapeHtml([usage.sessionDate, usage.sessionTime].filter(Boolean).join(" às ") || "Sessão não informada")}</span>
          </div>
          <div class="coupon-history-order">
            <span class="coupon-history-label">Pedido</span>
            <strong>${escapeHtml(couponOrderReference(usage.orderId))}</strong>
            <span>${escapeHtml([...(usage.ticketItems || []), ...(usage.concessionItems || [])].join(" · ") || "Itens não informados")}</span>
          </div>
          <div class="coupon-history-values">
            <span class="coupon-history-label">Desconto</span>
            <strong>${money(usage.discountAmount)}</strong>
            <span>Total ${money(usage.orderTotal)}</span>
          </div>
        </article>
      `).join("")
    : `<div class="empty-state compact"><strong>Sem utilizações</strong><span>O primeiro pagamento aprovado com este cupom aparecerá aqui.</span></div>`;
  if (!meta || meta.pages <= 1) {
    pager.innerHTML = "";
    return;
  }
  pager.innerHTML = `
    <button type="button" class="ghost-button" ${meta.page <= 1 ? "disabled" : ""} onclick="loadPromotionUsage('${item.id}', ${meta.page - 1})">Anterior</button>
    <span>Página ${meta.page} de ${meta.pages}</span>
    <button type="button" class="ghost-button" ${meta.page >= meta.pages ? "disabled" : ""} onclick="loadPromotionUsage('${item.id}', ${meta.page + 1})">Próxima</button>
  `;
}

async function loadPromotionUsage(couponId, page = 1) {
  if (!couponId) return;
  const requestToken = ++state.promotionUsageRequestToken;
  state.promotionUsageLoading = true;
  renderPromotionUsageHistory();
  try {
    const result = await api(`/api/promotions/${encodeURIComponent(couponId)}/usage?page=${Math.max(1, Number(page || 1))}&pageSize=20`);
    if (requestToken !== state.promotionUsageRequestToken || state.selectedPromotionId !== couponId) return;
    state.promotionUsageCouponId = couponId;
    state.promotionUsageHistory = result.usages || [];
    state.promotionUsageMeta = result;
  } catch (error) {
    if (requestToken !== state.promotionUsageRequestToken) return;
    state.promotionUsageCouponId = couponId;
    state.promotionUsageHistory = [];
    state.promotionUsageMeta = null;
    showToast(error.message, "error");
  } finally {
    if (requestToken === state.promotionUsageRequestToken) {
      state.promotionUsageLoading = false;
      renderPromotionUsageHistory();
    }
  }
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
      appliesTo: $("promotionAppliesTo").value,
      minimumOrderValue: Number($("promotionMinimumOrderValue").value || 0),
      maximumDiscount: Number($("promotionMaximumDiscount").value || 0),
      usageLimit: Number($("promotionUsageLimit").value || 0),
      perCustomerLimit: Number($("promotionPerCustomerLimit").value || 0),
      startsAt: datetimeIsoValue($("promotionStartsAt").value),
      endsAt: datetimeIsoValue($("promotionEndsAt").value),
      firstPurchaseOnly: $("promotionFirstPurchaseOnly").checked,
      allowClubStacking: $("promotionAllowClubStacking").checked,
      allowedMovieIds: Array.from($("promotionAllowedMovieIds").selectedOptions).map((option) => option.value),
      active: $("promotionActive").checked
    };
    const existingId = $("promotionId").value;
    const saved = existingId
      ? await api(`/api/promotions/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/promotions", { method: "POST", body: JSON.stringify(payload) });
    state.creating.promotion = false;
    state.selectedPromotionId = saved.id;
    state.promotionView = saved.archivedAt ? "archived" : "active";
    state.promotionUsageCouponId = "";
    upsertAdminCollection("promotions", saved);
    renderPromotions();
    showSuccess("Cupom salvo", `${saved.title} foi atualizado.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deletePromotion() {
  const item = currentPromotion();
  const hasUsage = Number(item?.usageCount || 0) > 0;
  if (!item || !confirm(hasUsage ? `Arquivar ${item.title}? O histórico de uso continuará disponível.` : `Excluir ${item.title}?`)) return;
  try {
    const result = await api(`/api/promotions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    state.selectedPromotionId = "";
    state.promotionUsageCouponId = "";
    state.promotionView = result.archived ? "archived" : state.promotionView;
    if (result.archived) upsertAdminCollection("promotions", result);
    else removeAdminCollectionItem("promotions", item.id);
    renderPromotions();
    showToast(result.archived ? "Cupom arquivado. O histórico foi preservado." : "Cupom excluído.");
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
  owner: ["dashboard.view", "movies.manage", "rooms.manage", "ticket_types.manage", "box_office.manage", "tickets.validate", "orders.manage", "concessions.manage", "marketing.manage", "club.manage", "integrations.manage", "logs.view", "settings.manage", "media.manage"],
  manager: ["dashboard.view", "movies.manage", "rooms.manage", "ticket_types.manage", "box_office.manage", "tickets.validate", "orders.manage", "concessions.manage", "marketing.manage", "club.manage", "logs.view", "media.manage"],
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
    upsertAdminCollection("users", saved);
    renderUsers();
    renderCustomerUsers();
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
  const pageSize = state.customerAccountsPageSize || 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  state.customerAccountsPage = Math.min(Math.max(1, state.customerAccountsPage || 1), totalPages);
  const start = (state.customerAccountsPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const pagerMarkup = items.length > pageSize ? `
    <div class="table-pagination-bar customer-pagination-bar">
      <span>Exibindo <strong>${start + 1}-${Math.min(start + pageItems.length, items.length)}</strong> de <strong>${items.length}</strong> cliente(s)</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.customerAccountsPage <= 1 ? "disabled" : ""} onclick="changeCustomerAccountsPage(-1)">Anterior</button>
        <span class="pager-page-indicator">Página ${state.customerAccountsPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.customerAccountsPage >= totalPages ? "disabled" : ""} onclick="changeCustomerAccountsPage(1)">Próxima</button>
      </div>
    </div>
  ` : "";
  $("customerUsersList").innerHTML = items.length
    ? `${pageItems.map((item) => `
        <button class="list-item ${item.id === state.selectedCustomerAccountId ? "active" : ""}" type="button" onclick="selectCustomerAccount('${item.id}')">
          <span>
            <span class="list-title">${escapeHtml(item.name)}</span>
            <span class="list-meta">${escapeHtml(item.email || "sem e-mail")} • ${item.emailVerified ? "e-mail verificado" : "verificação pendente"}</span>
          </span>
          <span class="badge">${item.active ? "ativo" : "off"}</span>
        </button>
      `).join("")}${pagerMarkup}`
    : `<div class="empty-state"><strong>${state.customerAccountsSearch ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</strong><span>${state.customerAccountsSearch ? "Revise o nome, e-mail, telefone ou CPF pesquisado." : "As contas criadas no site também aparecerão aqui."}</span></div>`;
  fillCustomerUserForm(currentCustomerAccount());
}

function changeCustomerAccountsPage(delta) {
  state.customerAccountsPage = Math.max(1, (state.customerAccountsPage || 1) + delta);
  renderCustomerUsers();
  $("customerUsersList")?.closest(".surface")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    upsertAdminCollection("users", saved);
    const savedIndex = filteredCustomerAccounts().findIndex((item) => item.id === saved.id);
    if (savedIndex >= 0) state.customerAccountsPage = Math.floor(savedIndex / (state.customerAccountsPageSize || 10)) + 1;
    renderCustomerUsers();
    renderUsers();
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
    removeAdminCollectionItem("users", item.id);
    renderCustomerUsers();
    renderUsers();
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
    removeAdminCollectionItem("users", item.id);
    renderUsers();
    renderCustomerUsers();
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
  const totalSavings = subscriptions.reduce((sum, subscription) => sum + Number(subscription.savings?.total || 0), 0);
  if ($("clubOverview")) {
    $("clubOverview").innerHTML = `
      <div class="mini-insight"><span>Planos ativos</span><strong>${plans.filter((plan) => plan.active !== false).length}</strong></div>
      <div class="mini-insight"><span>Assinaturas ativas</span><strong>${subscriptions.filter((item) => item.status === "active").length}</strong></div>
      <div class="mini-insight"><span>Créditos disponíveis</span><strong>${credits.reduce((sum, item) => sum + Number(item.remaining || 0), 0)}</strong></div>
      <div class="mini-insight"><span>Usos registrados</span><strong>${usage.length}</strong></div>
      <div class="mini-insight club-savings-overview"><span>Economia entregue</span><strong>${money(totalSavings)}</strong></div>
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
            const savings = subscription.savings || {};
            return `
              <div class="list-item static">
                <span class="subscription-identity">
                  <span class="list-title">${escapeHtml(user.name || user.email || "Cliente")}</span>
                  <span class="subscription-email">${escapeHtml(user.email || "E-mail não informado")}</span>
                  <span class="list-meta">${escapeHtml(plan.name || subscription.planId)} • ${clubStatusLabel(subscription.status)} • ${Number(credit?.remaining ?? subscription.creditsAvailable ?? 0)} de ${Number(credit?.total ?? plan.includedTickets ?? 0)} crédito(s)</span>
                  ${ending ? `<span class="subscription-ending-note">Cobrança encerrada; benefícios válidos até ${subscription.benefitsUntil ? new Date(subscription.benefitsUntil).toLocaleDateString("pt-BR") : "o fim do ciclo"}.</span>` : ""}
                  <span class="subscription-savings" aria-label="Economia obtida com o Clube">
                    <strong>${money(savings.total || 0)} economizados</strong>
                    <span>Ingressos ${money(savings.tickets || 0)} • Bomboniere ${money(Number(savings.concessions || 0) + Number(savings.freeItems || 0))} • ${Number(savings.benefitedOrders || 0)} pedido(s)</span>
                  </span>
                </span>
                <span class="table-actions">
                  <button class="ghost-button" type="button" onclick="viewClubSubscription('${escapeHtml(subscription.id)}')">Detalhes</button>
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

async function viewClubSubscription(subscriptionId) {
  const target = $("clubSubscriptionDetail");
  if (!target) return;
  target.hidden = false;
  target.innerHTML = `<div class="loading-state">Carregando histórico da assinatura...</div>`;
  try {
    const detail = await api(`/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`);
    const subscription = detail.subscription || {};
    const rows = (items, render, empty) => items?.length ? items.map(render).join("") : `<p class="helper-text">${escapeHtml(empty)}</p>`;
    target.innerHTML = `
      <div class="subscription-detail-heading">
        <div><div class="section-title">Histórico da assinatura</div><p class="helper-text">${escapeHtml(subscription.user?.name || subscription.user?.email || subscription.id || "Assinatura")}</p></div>
        <button class="icon-button" type="button" title="Fechar detalhes" aria-label="Fechar detalhes" onclick="this.closest('.subscription-detail').hidden=true">×</button>
      </div>
      <div class="subscription-detail-grid">
        <section><h3>Mensalidades</h3>${rows(detail.payments, (item) => `<p><strong>${money(item.amount)}</strong><span>${new Date(item.approvedAt || item.createdAt).toLocaleString("pt-BR")} • ${escapeHtml(item.provider || "manual")}</span></p>`, "Nenhuma mensalidade registrada.")}</section>
        <section><h3>Créditos individuais</h3>${rows(detail.credits, (item) => `<p><strong>${escapeHtml(item.status === "available" ? "Disponível" : item.status === "reserved" ? "Reservado" : item.status === "redeemed" ? "Utilizado" : item.status === "expired" ? "Expirado" : item.status)}</strong><span>${money(item.referenceValue)} • validade ${new Date(item.expiresAt).toLocaleDateString("pt-BR")}</span></p>`, "Nenhum crédito emitido.")}</section>
        <section><h3>Resgates</h3>${rows(detail.redemptions, (item) => `<p><strong>${money(item.creditAmount)} em crédito</strong><span>Base ${money(item.basePrice)} • complemento ${money(item.additionalPaymentAmount)} • ${escapeHtml(item.status)}</span></p>`, "Nenhum resgate registrado.")}</section>
        <section><h3>Ciclos</h3>${rows(detail.cycles, (item) => `<p><strong>${new Date(item.cycleStart).toLocaleDateString("pt-BR")} a ${new Date(item.cycleEnd).toLocaleDateString("pt-BR")}</strong><span>${Number(item.creditsIssued || 0)} crédito(s) emitido(s)</span></p>`, "Nenhum ciclo registrado.")}</section>
      </div>`;
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    target.innerHTML = `<div class="empty-state"><strong>Não foi possível abrir o histórico</strong><span>${escapeHtml(error.message)}</span></div>`;
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
  $("clubPlanCreditReferenceValue").value = plan?.creditReferenceValue ?? "";
  $("clubPlanCreditValidityDays").value = plan?.creditValidityDays ?? "";
  $("clubPlanMaxAccumulatedCredits").value = plan?.maxAccumulatedCredits ?? "";
  $("clubPlanGracePeriodDays").value = Number(plan?.gracePeriodDays || 0);
  $("clubPlanAllowRollover").checked = Boolean(plan?.allowCreditRollover);
  $("clubPlanAllowPriceDifference").checked = plan?.allowPriceDifference !== false;
  const eligibleFormats = new Set(plan?.eligibleFormats || []);
  document.querySelectorAll("#clubPlanEligibleFormats input").forEach((input) => {
    input.checked = eligibleFormats.has(input.value);
  });
  $("clubPlanEligibleSessions").value = (plan?.eligibleSessionIds || []).join(", ");
  if ($("clubPlanAccountingTickets")) $("clubPlanAccountingTickets").value = plan?.accounting?.ticketComponentValue ?? "";
  if ($("clubPlanAccountingBenefits")) $("clubPlanAccountingBenefits").value = plan?.accounting?.benefitsComponentValue ?? "";
  if ($("clubPlanAccountingVersion")) $("clubPlanAccountingVersion").value = plan?.accounting?.ruleVersion || "";
  if ($("clubPlanAccountingEffectiveFrom")) $("clubPlanAccountingEffectiveFrom").value = String(plan?.accounting?.effectiveFrom || "").slice(0, 10);
  if ($("clubNfceTrigger")) $("clubNfceTrigger").value = state.content?.settings?.nfceTrigger === "payment_approved" ? "payment_approved" : "goods_delivered";
  if ($("clubPlanCancelAtPeriodEnd")) $("clubPlanCancelAtPeriodEnd").checked = plan?.cancellationRules?.allowPeriodEnd !== false;
  if ($("clubPlanCancelImmediately")) $("clubPlanCancelImmediately").checked = plan?.cancellationRules?.allowImmediateBillingEnd !== false;
  if ($("clubPlanAccountingSection")) $("clubPlanAccountingSection").hidden = !isOwnerAdmin();
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
  renderClubPlanExcludedItems(plan);
  renderAdminImagePreview("clubPlanImageUrl", "clubPlanImagePreview", "Prévia do plano");
}

function renderClubPlanExcludedItems(plan) {
  const target = $("clubPlanExcludedItems");
  if (!target) return;
  const excluded = new Set(plan?.excludedConcessionIds || []);
  const concessions = (state.content?.concessions || []).filter((item) => item.active !== false);
  target.innerHTML = concessions.length
      ? concessions.map((item) => `
        <div class="benefit-product-row benefit-product-row-toggle">
          <label><input type="checkbox" data-club-eligible-item="${escapeHtml(item.id)}" ${excluded.has(String(item.id)) ? "" : "checked"} /><span>${escapeHtml(item.name)}</span></label>
        </div>`).join("")
    : `<div class="empty-state"><strong>Sem produtos ativos</strong><span>Cadastre a bomboniere antes de configurar a elegibilidade.</span></div>`;
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
    creditReferenceValue: $("clubPlanCreditReferenceValue").value === "" ? null : Number($("clubPlanCreditReferenceValue").value),
    creditValidityDays: $("clubPlanCreditValidityDays").value === "" ? null : Number($("clubPlanCreditValidityDays").value),
    allowCreditRollover: $("clubPlanAllowRollover").checked,
    maxAccumulatedCredits: $("clubPlanMaxAccumulatedCredits").value === "" ? null : Number($("clubPlanMaxAccumulatedCredits").value),
    gracePeriodDays: Number($("clubPlanGracePeriodDays").value || 0),
    allowPriceDifference: $("clubPlanAllowPriceDifference").checked,
    eligibleFormats: [...document.querySelectorAll("#clubPlanEligibleFormats input:checked")].map((input) => input.value),
    eligibleSessionIds: $("clubPlanEligibleSessions").value.split(",").map((item) => item.trim()).filter(Boolean),
    excludedConcessionIds: [...document.querySelectorAll("[data-club-eligible-item]:not(:checked)")].map((input) => input.dataset.clubEligibleItem),
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
  payload.cancellationRules = {
    allowPeriodEnd: $("clubPlanCancelAtPeriodEnd").checked,
    allowImmediateBillingEnd: $("clubPlanCancelImmediately").checked,
    preservePaidCreditsUntilCycleEnd: true
  };
  if (isOwnerAdmin()) {
    payload.accounting = {
      ticketComponentValue: $("clubPlanAccountingTickets").value === "" ? null : Number($("clubPlanAccountingTickets").value),
      benefitsComponentValue: $("clubPlanAccountingBenefits").value === "" ? null : Number($("clubPlanAccountingBenefits").value),
      ruleVersion: $("clubPlanAccountingVersion").value.trim(),
      effectiveFrom: $("clubPlanAccountingEffectiveFrom").value
    };
  }
  try {
    const saved = existingId
      ? await api(`/api/admin/subscription-plans/${encodeURIComponent(existingId)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/admin/subscription-plans", { method: "POST", body: JSON.stringify(payload) });
    if (isOwnerAdmin() && $("clubNfceTrigger")) {
      await api("/api/admin/goods-fiscal-settings", {
        method: "PUT",
        body: JSON.stringify({ nfceTrigger: $("clubNfceTrigger").value })
      });
    }
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
    gemini: "IA para campanhas",
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
            <li class="${escapeHtml(item.level || (item.ok ? "ok" : "error"))}">
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
      ${integration.key === "gemini" && (testResult?.requestId || integration.lastTestRequestId) ? `
        <div>
          <dt>ID da solicitação</dt>
          <dd>${escapeHtml(testResult?.requestId || integration.lastTestRequestId)}</dd>
        </div>
      ` : ""}
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

async function persistIntegrationForm({ close = true, announce = true } = {}) {
  const key = state.selectedIntegrationKey;
  if (!key) return null;
  const data = await api(`/api/admin/integrations/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(collectIntegrationForm())
  });
  state.integrations.integrations[key] = data.integration;
  renderIntegrations();
  if (close) closeIntegrationConfig();
  if (announce) showToast("Integração salva com segurança.");
  return data.integration;
}

async function saveIntegration(event) {
  event.preventDefault();
  const submitButton = event.submitter || $("integrationForm").querySelector('button[type="submit"]');
  const originalLabel = submitButton?.textContent || "Salvar configuração";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Salvando...";
  }
  try {
    await persistIntegrationForm();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
}

async function testIntegration(key) {
  const button = $("integrationTestButton");
  const originalLabel = button?.textContent || "Testar conexão";
  if (button) {
    button.disabled = true;
    button.textContent = "Salvando e testando...";
  }
  try {
    if (state.selectedIntegrationKey === key) {
      const formPayload = collectIntegrationForm();
      if (Object.keys(formPayload).length > 0) {
        await persistIntegrationForm({ close: false, announce: false });
      }
    }
    const result = await api(`/api/admin/integrations/${encodeURIComponent(key)}/test`, { method: "POST" });
    if (state.integrations?.integrations && result.integration) state.integrations.integrations[key] = result.integration;
    renderIntegrations();
    if (state.selectedIntegrationKey === key && $("integrationContext") && result.integration) {
      $("integrationContext").innerHTML = renderIntegrationContext(result.integration, result);
    }
    showToast(result.message || "Integração testada.", result.ok ? "ok" : "error");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
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
  const activeConcessionTab = document.querySelector("[data-concession-tab].active");
  if (activeConcessionTab?.hidden) {
    const firstAvailableTab = [...document.querySelectorAll(".concession-tabs [data-concession-tab]")].find((button) => !button.hidden);
    if (firstAvailableTab) setConcessionTab(firstAvailableTab.dataset.concessionTab);
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

  $("dashboardReportButton")?.addEventListener("click", () => window.open(`${API_BASE}/api/admin/reports/dashboard.csv?${dashboardQuery()}`, "_blank", "noopener"));

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
      if (!$("concessionOrderOverlay")?.hidden) closeConcessionOrderOverlay();
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
  $("orderRefundTicketsButton")?.addEventListener("click", () => executeOrderRefundTickets());
  $("orderRefundConcessionsButton")?.addEventListener("click", () => executeOrderRefundConcessions());
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
  $("concessionSalesRefresh")?.addEventListener("click", () => loadConcessionDailySales());
  $("concessionSalesDate")?.addEventListener("change", () => loadConcessionDailySales());
  $("concessionSalesArchived")?.addEventListener("change", () => loadConcessionDailySales());
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
  document.querySelectorAll("[data-dash-channel-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.dashChannelTab;
      document.querySelectorAll("[data-dash-channel-tab]").forEach((item) => item.classList.toggle("active", item === button));
      if ($("dashChannelTabOrigin")) $("dashChannelTabOrigin").hidden = tab !== "origin";
      if ($("dashChannelTabMethods")) $("dashChannelTabMethods").hidden = tab !== "methods";
      if ($("dashChannelTabClub")) $("dashChannelTabClub").hidden = tab !== "club";
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
  document.querySelectorAll("[data-concession-period]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.concessionPeriod = button.dataset.concessionPeriod;
      document.querySelectorAll("[data-concession-period]").forEach((item) => item.classList.toggle("active", item === button));
      const custom = state.concessionPeriod === "custom";
      if ($("concessionCustomDates")) $("concessionCustomDates").hidden = !custom;
      await loadConcessionFinance();
    });
  });
  ["concessionFrom", "concessionTo"].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener("change", async () => {
        state.concessionFrom = $("concessionFrom").value;
        state.concessionTo = $("concessionTo").value;
        if (state.concessionPeriod === "custom") {
          await loadConcessionFinance();
        }
      });
    }
  });
  $("concessionFinanceRefreshBtn")?.addEventListener("click", async () => {
    await loadConcessionFinance();
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
  $("manualTicketForm").addEventListener("input", renderManualSaleSummary);
  $("manualTicketForm").addEventListener("change", renderManualSaleSummary);
  $("pointPaymentRetryButton")?.addEventListener("click", () => pollPointPayment({ manual: true }));
  $("pointPaymentCancelButton")?.addEventListener("click", cancelPointPayment);
  $("pointPaymentNewSaleButton")?.addEventListener("click", resetPointPaymentPanel);
  $("manualSessionDate").addEventListener("input", (event) => {
    const rawValue = event.target.value;
    event.target.value = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? manualSessionDateDisplay(rawValue)
      : maskManualSessionDate(rawValue);
    if (manualSessionDateIso(event.target.value)) renderManualSaleOptions();
  });
  $("manualSessionDate").addEventListener("blur", renderManualSaleOptions);
  $("manualMovieSelect").addEventListener("change", renderManualSessionOptions);
  $("manualSessionSelect").addEventListener("change", () => {
    renderManualTicketTypes();
    void loadManualSeatMap();
  });
  $("manualAddMovieButton").addEventListener("click", addManualSaleItem);
  $("manualClearSaleButton").addEventListener("click", clearManualSaleItems);
  $("manualCustomerSearch").addEventListener("input", searchBoxOfficeCustomers);
  $("manualCustomerSearch").addEventListener("focus", searchBoxOfficeCustomers);
  document.querySelectorAll("[data-sale-mode]").forEach((button) => {
    button.addEventListener("click", () => setSaleMode(button.dataset.saleMode));
  });
  document.querySelectorAll("input[name='guestTicketDeliveryMethod']").forEach((input) => {
    input.addEventListener("change", renderSaleMode);
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

  document.querySelectorAll("[data-concession-tab]").forEach((button) => {
    button.addEventListener("click", () => setConcessionTab(button.dataset.concessionTab));
  });
  document.querySelectorAll("[data-concession-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-concession-cat]").forEach((b) => b.classList.toggle("active", b === button));
      state.concessionCategoryFilter = button.dataset.concessionCat;
      renderConcessions();
    });
  });
  document.querySelectorAll('[data-concession-filter="status"] button').forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll('[data-concession-filter="status"] button').forEach((b) => b.classList.toggle("active", b === button));
      state.concessionStatusFilter = button.dataset.value;
      renderConcessionDailySales();
    });
  });
  $("concessionSalesRefresh")?.addEventListener("click", () => void loadConcessionDailySales());
  $("concessionSalesDate")?.addEventListener("change", () => void loadConcessionDailySales());
  $("concessionSalesArchived")?.addEventListener("change", () => renderConcessionDailySales());

  $("concessionOrderCloseButton")?.addEventListener("click", closeConcessionOrderOverlay);
  $("concessionOrderModalCloseAction")?.addEventListener("click", closeConcessionOrderOverlay);
  $("concessionOrderOverlay")?.addEventListener("click", (event) => {
    if (event.target === $("concessionOrderOverlay")) closeConcessionOrderOverlay();
  });
  document.querySelectorAll("[data-scanner-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.scannerBack === "concessions") {
        setConcessionTab("todaySales");
      } else {
        setBoxOfficeTab("todaySales");
      }
    });
  });

  $("settingsForm").addEventListener("submit", saveSettings);
  $("clubVisualForm")?.addEventListener("submit", saveClubVisualSettings);
  $("eventTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
  $("clubTransparentImages")?.addEventListener("change", syncTransparentImagePreviews);
  $("emailCampaignForm")?.addEventListener("submit", sendEmailCampaign);
  $("emailCampaignAiGenerate")?.addEventListener("click", () => void generateEmailCampaignAiDraft());
  $("emailCampaignAiPromptTemplate")?.addEventListener("change", (event) => {
    state.emailCampaignAiPromptTemplateId = event.target.value;
    state.emailCampaignAiPromptDirty = false;
    renderEmailCampaignAiPromptEditor($("emailCampaignAiScenario")?.value || "announcement", { forceValue: true });
  });
  $("emailCampaignAiPromptText")?.addEventListener("input", () => {
    state.emailCampaignAiPromptDirty = true;
    if ($("emailCampaignAiPromptStatus")) $("emailCampaignAiPromptStatus").textContent = "Alterações ainda não salvas.";
  });
  $("emailCampaignAiPromptSave")?.addEventListener("click", () => void saveEmailCampaignAiPromptTemplate());
  $("emailCampaignAiPromptReset")?.addEventListener("click", () => void saveEmailCampaignAiPromptTemplate({ reset: true }));
  $("emailCampaignAiOpen")?.addEventListener("click", () => {
    if (state.emailCampaignAiDraftId) void editEmailCampaign(state.emailCampaignAiDraftId);
  });
  $("emailCampaignAiObjective")?.addEventListener("change", renderEmailCampaignAiControls);
  ["emailCampaignAiMovie", "emailCampaignAiMovies", "emailCampaignAiCoupon", "emailCampaignAiClubPlan", "emailCampaignAiConcessions", "emailCampaignAiAudience", "emailCampaignAiCampaign"]
    .forEach((id) => $(id)?.addEventListener("change", renderEmailCampaignAiControls));
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
  $("emailTemplatePreviewVariation")?.addEventListener("click", () => void prepareEmailTemplateAiVariation(state.emailTemplateLibraryPreviewItem).catch((error) => showToast(error.message, "error")));
  $("emailTemplateLibraryAiCreate")?.addEventListener("click", () => void prepareEmailTemplateAiVariation().catch((error) => showToast(error.message, "error")));
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
  $("emailCampaignHistoryOrigin")?.addEventListener("change", (event) => {
    state.emailCampaignHistoryOrigin = event.target.value;
    state.emailCampaignHistoryPage = 1;
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
  $("newPromotionButton").addEventListener("click", newPromotion);
  $("activePromotionsTab").addEventListener("click", () => setPromotionView("active"));
  $("archivedPromotionsTab").addEventListener("click", () => setPromotionView("archived"));
  $("cancelPromotionCreateButton").addEventListener("click", () => cancelCreation("promotion"));
  $("promotionForm").addEventListener("submit", savePromotion);
  $("promotionCouponCode").addEventListener("input", (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  });
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
    state.customerAccountsPage = 1;
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
  if (target !== "concessionsPanel" && target !== "boxOfficePanel") {
    stopQrReader();
  }
  if (target === "logsPanel") {
    startPerformanceStream();
    if (!state.logs) void loadLogs({ page: 1 });
    else void loadPerformance();
  } else {
    stopPerformanceStream();
  }
  if (target === "concessionsPanel") {
    setConcessionTab(state.concessionTab || "todaySales");
  } else if (target === "boxOfficePanel") {
    setBoxOfficeTab(state.boxOfficeTab || "newSale");
  }
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
window.setConcessionTab = setConcessionTab;
window.openConcessionOrderDetail = openConcessionOrderDetail;
window.closeConcessionOrderOverlay = closeConcessionOrderOverlay;
window.executeConcessionRefund = executeConcessionRefund;
window.toggleConcessionArchive = toggleConcessionArchive;
window.scanNextTicket = scanNextTicket;
window.importTmdbMovie = importTmdbMovie;
window.selectBoxOfficeCustomer = selectBoxOfficeCustomer;
window.selectBoxOfficeCustomerById = selectBoxOfficeCustomerById;
window.selectClubPlan = selectClubPlan;
window.updateClubSubscription = updateClubSubscription;
window.deleteClubPlan = deleteClubPlan;
window.adjustClubCredit = adjustClubCredit;
window.openIntegrationConfig = openIntegrationConfig;
window.testIntegration = testIntegration;
window.showWebhookRun = showWebhookRun;
window.resendWebhookRun = resendWebhookRun;
window.toggleIntegration = toggleIntegration;
window.loadPerformance = loadPerformance;
window.setPerformanceInterval = setPerformanceInterval;
window.startPerformanceStream = startPerformanceStream;
window.stopPerformanceStream = stopPerformanceStream;

async function initAdmin() {
  const logo = $("adminLogoImg");
  if (logo && API_BASE) logo.src = `${API_BASE}/images/logo-display.webp`;
  bindEvents();
  setupPerformanceControls();
  setBoxOfficeTab("newSale");
  const user = await loadAdminUser();
  if (user?.twoFactorSetupRequired) {
    setAdminSubtab("accounts", "security");
    activatePanel("usersPanel", { scroll: false });
    await openTwoFactorSettings();
    return;
  }
  await loadContent();
  if ($("logsPanel")?.classList.contains("active")) {
    startPerformanceStream();
    void loadPerformance();
  }
}

initAdmin();
