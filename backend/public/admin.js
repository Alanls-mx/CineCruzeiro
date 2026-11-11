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
  adsStatusUpdating: false,
  selectedUserId: "",
  selectedIntegrationKey: "",
  selectedClubPlanId: "",
  selectedOrderId: "",
  dashboard: null,
  ticketFinanceReport: null,
  marketingOverviewData: null,
  integrations: null,
  logs: null,
  logsPage: 1,
  logsPageSize: 40,
  logsView: "business",
  logFilters: { search: "", level: "", category: "", from: "", to: "" },
  webhookSimulatorRuns: [],
  webhookBatchJob: null,
  webhookBatchPolling: false,
  webhookHistoryPage: 1,
  webhookHistoryPageSize: 8,
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
  sessionTimeManuallyEdited: false,
  dashboardMetric: "revenue",
  adminSubtabs: {
    marketing: "overview",
    club: "overview",
    accounts: "team",
    rooms: "registered"
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
    allStatus: "all",
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
  moviesPage: 1,
  moviesPageSize: 8,
  roomsPage: 1,
  roomsPageSize: 8,
  globalSessionsPage: 1,
  globalSessionsPageSize: 12,
  globalSessionFilters: { from: "", to: "", roomId: "", movieId: "", status: "active", conflictsOnly: false },
  selectedOngoingSessionId: "",
  sessionSeatView: null,
  sessionAutocorrectPlan: null,
  ticketTypesPage: 1,
  ticketTypesPageSize: 8,
  concessionsPage: 1,
  concessionsPageSize: 8,
  promotionsPage: 1,
  promotionsPageSize: 8,
  adsPage: 1,
  adsPageSize: 8,
  usersPage: 1,
  usersPageSize: 8,
  clubPlansPage: 1,
  clubPlansPageSize: 8,
  clubSubscriptionsSearch: "",
  boxOfficeTab: "newSale",
  concessionTab: localStorage.getItem("cine_admin_concession_tab") || "todaySales",
  concessionCategoryFilter: "all",
  concessionStatusFilter: "all",
  concessionSalesData: null,
  selectedConcessionOrderId: null,
  saleMode: "registered",
  selectedCustomer: null,
  customerSearchResults: [],
  customerSearchTimer: null,
  customerSearchRequestId: 0,
  manualSaleItems: [],
  manualConcessionQuantities: {},
  concessionCounterQuantities: {},
  concessionCounterSearch: "",
  concessionCounterCategory: "all",
  concessionCounterPage: 1,
  concessionCounterPageSize: 8,
  concessionCounterPaymentId: "",
  concessionCounterPaymentTimer: null,
  concessionCounterPaymentSnapshot: null,
  concessionCounterPaymentSyncing: false,
  concessionCounterLastOrderId: "",
  concessionCounterCheckoutKey: "",
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
  pointPaymentPollAttempts: 0,
  pointCheckoutKey: "",
  localPointPrintJobs: new Set(),
  localPointPrintStatus: "",
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
  emailCampaignTemplateVariant: null,
  emailCampaignDraftId: "",
  emailCampaignHistoryFilter: "all",
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
    renderStaffAvatar($("adminProfileAvatar"), data.user);
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
  if (open) menu.querySelector("button")?.focus();
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

const { renderTwoFactorSettings, renderAccountSecuritySummary } = window.CineAdminModules.twoFactorSettingsView.createTwoFactorSettingsView({ $, escapeHtml, state, twoFactorDate });

async function loadTwoFactorStatus() {
  state.twoFactorStatus = null;
  renderTwoFactorSettings();
  state.twoFactorStatus = await api("/api/admin/2fa/status");
  renderTwoFactorSettings();
  renderAccountSecuritySummary();
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

function staffAvatarMarkup(user = {}) {
  const initials = String(user.name || user.email || "?").trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const picture = String(user.picture || "");
  const safe = /^\/uploads\/[a-zA-Z0-9_./-]+$/.test(picture) || /^https:\/\//.test(picture);
  return `<span>${escapeHtml(initials)}</span>${safe ? `<img src="${escapeHtml(adminAssetUrl(picture))}" alt="" loading="lazy" />` : ""}`;
}

function renderStaffAvatar(target, user) {
  if (!target) return;
  target.innerHTML = staffAvatarMarkup(user);
  target.querySelector("img")?.addEventListener("error", (event) => event.target.remove(), { once: true });
}

function fillMyAccount() {
  const user = state.adminUser;
  if (!user) return;
  $("myAccountName").value = user.name || "";
  $("myAccountEmail").value = user.email || "";
  $("myAccountPicture").value = user.picture || "";
  $("myAccountIdentity").textContent = adminRoleLabel(user.role);
  renderStaffAvatar($("myAccountAvatar"), user);
  $("myAccountRemovePhoto").disabled = !user.picture;
  renderAccountSecuritySummary();
}

async function uploadProfilePhoto(prefix, input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    showToast("Envie uma foto JPG, PNG ou WebP de até 5 MB.", "error");
    input.value = "";
    return;
  }
  const form = input.closest("form");
  const submit = form.querySelector("button[type='submit']");
  input.disabled = true;
  if (submit) submit.disabled = true;
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
      reader.readAsDataURL(file);
    });
    const result = await api("/api/admin/profile/photo", { method: "POST", body: JSON.stringify({ data, contentType: file.type }) });
    $(prefix + "Picture").value = result.url;
    renderStaffAvatar($(prefix + "Avatar"), { name: $(prefix + "Name").value, picture: result.url });
    $(prefix + "RemovePhoto").disabled = false;
    showToast("Foto carregada. Salve o perfil para confirmar.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    input.disabled = false;
    input.value = "";
    if (submit) submit.disabled = false;
  }
}

async function saveMyAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.busy) return;
  const password = form.id === "myPasswordForm";
  const feedback = $(password ? "myPasswordFeedback" : "myAccountFeedback");
  const button = form.querySelector("button[type='submit']");
  const body = password ? Object.fromEntries(new FormData(form)) : { name: $("myAccountName").value, ...($("myAccountPicture").value !== state.adminUser.picture ? { picture: $("myAccountPicture").value } : {}) };
  form.dataset.busy = "true";
  button.disabled = true;
  feedback.textContent = "Salvando…";
  feedback.classList.remove("error");
  try {
    const result = await api(password ? "/api/admin/me/password" : "/api/admin/me", { method: password ? "POST" : "PATCH", body: JSON.stringify(body) });
    state.adminUser = result.user;
    if (state.content?.users) upsertAdminCollection("users", result.user);
    await loadAdminUser();
    if (password) form.reset();
    feedback.textContent = password ? "Senha alterada. As outras sessões foram encerradas." : "Perfil atualizado.";
  } catch (error) {
    feedback.textContent = error.message;
    feedback.classList.add("error");
  } finally {
    delete form.dataset.busy;
    button.disabled = false;
  }
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
    const [content, dashboard, payments, integrations, templateLibrary, marketingOverview, ticketFinanceReport] = await Promise.all([
      api("/api/admin/content"),
      api(`/api/admin/dashboard?${dashboardQuery()}`).catch(() => null),
      adminCan("payments.view") ? api(`/api/admin/payments?${dashboardQuery()}`).catch(() => null) : Promise.resolve(null),
      adminCan("integrations.view") ? api("/api/integrations").catch(() => null) : Promise.resolve(null),
      adminCan("marketing.view") ? api("/api/admin/email/template-library?page=1&pageSize=18").catch(() => null) : Promise.resolve(null),
      adminCan("marketing.view") ? api("/api/admin/marketing/overview").catch(() => null) : Promise.resolve(null),
      adminCan("ticket_finance.view") ? api(`/api/admin/reports/ticket-distributor?${dashboardQuery()}`).catch(() => null) : Promise.resolve(null)
    ]);
    state.content = cleanAdminContentAssets(content);
    state.emailCampaignHistoryMeta = content.emailCampaignPagination || state.emailCampaignHistoryMeta;
    state.dashboard = dashboard;
    state.payments = payments;
    state.integrations = integrations;
    state.emailTemplateLibrary = templateLibrary;
    state.marketingOverviewData = marketingOverview;
    state.ticketFinanceReport = ticketFinanceReport;
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
  renderTicketFinanceReport();
  renderInsights();
  renderMovies();
  renderRooms();
  renderTickets();
  renderOrders();
  renderPaymentsCenter();
  renderConcessions();
  renderConcessionCounterSale();
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
  refreshPointProviderControls();
  if (state.logs) renderLogs();
  fillSettingsForm();
  renderRoomOptions();
  renderManualSaleOptions();
  renderValidationSessionScope();
  if ($("adminTwoFactorRequired")) $("adminTwoFactorRequired").checked = state.content?.settings?.adminTwoFactorRequired !== false;
  renderAccountSecuritySummary();
  applyRbacVisibility();
  document.querySelectorAll("form[data-dirty-track]").forEach((form) => markFormClean(form));
}

function renderLoading() {
  ["moviesList", "roomsList", "globalSessionsList", "ticketsList", "concessionsList", "promotionsList", "adsList", "usersList", "customerUsersList", "ordersList", "todayOrdersList", "paymentsList", "clubPlansList", "clubSubscriptionsList", "integrationsList", "logsList"].forEach((id) => {
    if ($(id)) {
      $(id).innerHTML = Array.from({ length: 4 }, () => `<div class="skeleton-card"></div>`).join("");
    }
  });

  if ($("ordersList")) {
    $("ordersList").innerHTML = `<div class="skeleton-card"></div>`;
  }
}

const { logLevelLabel, logCategoryLabel, logPaymentMethod, logFriendlyError, logAdminAction, logDeploymentStageLabel, logOutageTypeLabel, logPerformanceAlert, logEventSummary, logPresentation, logReferenceItems, logDate, logFilterDate } = window.CineAdminModules.logPresentation;

const { loadConcessionDailySales, findConcessionOrder, getOrderTickets, isOrderFullyValidated, orderSessionStartsAt, isOrderSessionExpired, isOrderEffectivelyArchived, isOrderEffectivelyActive, getOrderValidationSummary, changeConcessionDailySalesPage, renderConcessionDailySales, openConcessionOrderDetail } = window.CineAdminModules.concessionSalesView.createConcessionSalesView({ state, $, api, document, escapeHtml, money, financialStatusEventHtml, showToast, adminCan, executeConcessionRefund, toggleConcessionArchive, deleteConcessionOrder });

const { query: ticketFinanceQuery, load: loadTicketFinanceReport, render: renderTicketFinanceReport, saveRules: saveTicketFinanceRules, download: downloadTicketFinanceReport, bindEvents: bindTicketFinanceEvents } = window.CineAdminModules.ticketFinanceView.createTicketFinanceView({ state, $, api, adminCan, setDisabled, showToast, escapeHtml, money, document, apiBase: API_BASE });

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
let performanceEventSource = null;
let performanceIntervalMs = 1;
let performanceHistoryCache = [];


function formatPerfUptime(seconds) {
  if (!seconds || seconds <= 0) return "--";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${seconds % 60}s`;
}

















const { renderPerformanceKpis, renderPerformanceCharts, renderPerformanceAlerts, renderPerformanceSlowRoutes } = window.CineAdminModules.performanceView.createPerformanceView({ $, escapeHtml });

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
      liveBadge.title = "Telemetria transmitida continuamente pelo servidor";
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
  stopPerformanceStream();
  if (performanceIntervalMs <= 0 || !window.EventSource) return;
  performanceEventSource = new EventSource(`${API_BASE}/api/admin/logs/performance/stream`, { withCredentials: true });
  performanceEventSource.onmessage = (event) => {
    try {
      updatePerformance(JSON.parse(event.data));
    } catch {
      if ($("performanceStatus")) $("performanceStatus").textContent = "Recebemos uma amostra inválida de telemetria.";
    }
  };
  performanceEventSource.onerror = () => {
    if ($("performanceStatus") && performanceIntervalMs > 0) {
      $("performanceStatus").textContent = "Conexão ao vivo interrompida; tentando reconectar…";
    }
  };
}

function stopPerformanceStream() {
  performanceEventSource?.close();
  performanceEventSource = null;
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
    updatePerformance(data);
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

const { renderLogs } = window.CineAdminModules.adminLogView.createAdminLogView({ $, escapeHtml, loadLogs, logCategoryLabel, logDate, logLevelLabel, logPresentation, logReferenceItems, state });

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
  const published = movies.filter((movie) => movie.workflowStatus === "published" && movie.status !== "hidden");
  const nowPlaying = published.filter((movie) => movie.status === "now_playing").length;
  const upcoming = published.filter((movie) => movie.status === "upcoming").length;
  const sessions = movies.reduce((total, movie) => total + (movie.sessions || []).filter((session) =>
    !["cancelled", "hidden", "archived"].includes(session.status)
    && new Date(`${session.date}T${session.time}:00-03:00`).getTime() + 10 * 60000 > Date.now()).length, 0);
  const activeTickets = state.content?.ticketTypes?.filter((ticket) => ticket.active !== false) || [];
  const baseTicket = activeTickets[0]?.price ?? state.content?.ticketTypes?.[0]?.price ?? 0;

  $("statNowPlaying").textContent = nowPlaying;
  $("statUpcoming").textContent = upcoming;
  $("statSessions").textContent = sessions;
  $("statBaseTicket").textContent = money(baseTicket);
}

function renderMiniPager(page, totalPages, totalItems, pagerKey, label = "item(ns)") {
  if (totalPages <= 1) return "";
  return `
    <div class="dash-card-pager">
      <span>Página <b>${page}</b> de <b>${totalPages}</b> (${totalItems} ${label})</span>
      <div class="dash-card-pager-controls">
        <button class="ghost-button" type="button" ${page <= 1 ? "disabled" : ""} data-dash-pager="${pagerKey}" data-page-delta="-1">← Anterior</button>
        <button class="ghost-button" type="button" ${page >= totalPages ? "disabled" : ""} data-dash-pager="${pagerKey}" data-page-delta="1">Próxima →</button>
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









const { renderDashboard, renderDashboardChart, showChartHint } = window.CineAdminModules.dashboardView.createDashboardView({
  state, $, money, escapeHtml, renderMiniPager, adminAssetUrl, orderReference
});

function showChartHintFromPoint(target) {
  const point = target.closest?.("[data-chart-hint-date]");
  if (!point) return;
  showChartHint(
    point.dataset.chartHintDate,
    Number(point.dataset.chartHintRevenue),
    Number(point.dataset.chartHintOrders),
    Number(point.dataset.chartHintTickets)
  );
}

function openSessionDashboardDetail(movieId, sessionId) {
  const ongoing = globalSessionEntries().find((entry) => entry.session.id === sessionId);
  if (ongoing && ongoing.startsAt <= Date.now() && ongoing.endsAt > Date.now()) {
    state.selectedOngoingSessionId = sessionId;
    activatePanel("roomsPanel", { scroll: true });
    setAdminSubtab("rooms", "ongoing");
    renderOngoingSessions();
    requestAnimationFrame(() => {
      $("ongoingSessionsList")?.querySelector("[data-ongoing-session].active")?.focus();
    });
    return;
  }

  const movie = (state.content?.movies || []).find((item) => String(item.id) === String(movieId));
  const session = (movie?.sessions || []).find((item) => String(item.id) === String(sessionId));
  if (movie && session && isManualSessionSellable(session)) {
    activatePanel("ordersPanel", { scroll: true });
    setBoxOfficeTab("newSale");
    setSaleMode("quick");

    const dateInput = $("manualSessionDate");
    if (dateInput) dateInput.value = manualSessionDateDisplay(session.date);
    renderManualSaleOptions();

    const movieSelect = $("manualMovieSelect");
    if (movieSelect) movieSelect.value = movie.id;
    renderManualSessionOptions();

    const sessionSelect = $("manualSessionSelect");
    if (sessionSelect) sessionSelect.value = session.id;
    renderManualTicketTypes();
    void loadManualSeatMap();
    updateManualTotal();
    showToast(`Venda rápida pronta para ${movie.title} às ${session.time}.`, "success");
    return;
  }

  activatePanel("ordersPanel", { scroll: true });
  setBoxOfficeTab("todaySales");
  showToast("Esta sessão não está disponível para venda rápida.", "error");
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

function adminCan(permission) {
  return isOwnerAdmin() || new Set(state.adminUser?.effectivePermissions || ADMIN_PERMISSION_PRESETS[state.adminUser?.role] || []).has(permission);
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
    paid_pending_print: "Pago; aguardando impressão",
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
    ? `<img src="${escapeHtml(adminAssetUrl(url))}" alt="${escapeHtml(label)}" data-admin-image-fallback />`
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

const { renderMoviePublishSummary, setMovieWizardStep, validateMovieWizardStep, renderMovies, fillMovieForm, movieFormSnapshot, confirmMovieNavigation, renderTmdbMissingFields } = window.CineAdminModules.movieCatalogView.createMovieCatalogView({
  state, $, document, escapeHtml, slugify, publicMovieStatusLabel, setDisabled, showToast, paginateAdminItems, creationPlaceholder, currentMovie, renderAdminListPager, moviePriorityState, workflowStatusLabel, adminAssetUrl, syncCreationControl, renderMovieMediaPreview, populateMovieCatalogPositions: (...args) => populateMovieCatalogPositions(...args), renderSessions: (...args) => renderSessions(...args), closeSessionEditor: (...args) => closeSessionEditor(...args), getMoviePayload: (...args) => getMoviePayload(...args), confirm
});

















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
  renderTmdbMissingFields([]);

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
          <button class="tmdb-result" type="button" data-tmdb-movie-id="${escapeHtml(movie.tmdbId)}">
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
    renderTmdbMissingFields([]);
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
    const missingFields = Array.isArray(movie.tmdbMissingFields) ? movie.tmdbMissingFields : [];
    const missingMessage = missingFields.length
      ? ` O TMDB não informou ${missingFields.length} ${missingFields.length === 1 ? "dado" : "dados"}; complete-os manualmente para finalizar o cadastro.`
      : " O TMDB retornou todos os dados compatíveis com este cadastro.";
    $("tmdbMessage").textContent = (existingId
      ? "Dados importados no filme selecionado. Revise e salve para atualizar."
      : "Dados importados. Revise o status e salve o filme.") + missingMessage;
    renderTmdbMissingFields(missingFields);
    showToast(missingFields.length ? "Alguns dados precisam ser completados manualmente." : "Dados oficiais importados para o formulário.", missingFields.length ? "warning" : "success");
  } catch (error) {
    $("tmdbMessage").textContent = error.message;
    showToast("Não foi possível importar o filme.", "error");
    renderTmdbMissingFields([]);
  }
}

function updatePerformance(data = {}) {
  const release = data.release;
  if ($("logsVersionMeta") && release) {
    const commit = release.commitShort ? ` · commit ${release.commitShort}` : "";
    const releaseName = release.release ? ` · release ${release.release}` : "";
    $("logsVersionMeta").textContent = `Versão atual: ${release.version || release.appVersion || "não informada"}${commit}${releaseName}`;
  }
  const metrics = data.current;
  if (!metrics) {
    if ($("performanceStatus")) $("performanceStatus").textContent = "Coletando primeira amostra de telemetria.";
    return;
  }

  if (Array.isArray(data.history) && data.history.length) {
    performanceHistoryCache = data.history;
  } else if (performanceHistoryCache.at(-1)?.sampledAt !== metrics.sampledAt) {
    performanceHistoryCache.push(metrics);
    if (performanceHistoryCache.length > 240) performanceHistoryCache.shift();
  }

  if ($("perfHostMeta")) $("perfHostMeta").textContent = `Host · ${metrics.vcores || 2} vCPU`;
  if ($("perfUptimeMeta")) $("perfUptimeMeta").textContent = `Uptime: ${formatPerfUptime(metrics.uptimeSeconds)}`;
  if ($("performanceStatus")) {
    $("performanceStatus").textContent = `Ao vivo · amostra ${new Date(metrics.sampledAt).toLocaleTimeString("pt-BR")} · HTTP: últimos 5m${metrics.sampleCapped ? " (amostra limitada)" : ""}`;
  }

  renderPerformanceKpis(metrics, performanceHistoryCache);
  renderPerformanceCharts(performanceHistoryCache, metrics);
  renderPerformanceAlerts(metrics.alerts);
  renderPerformanceSlowRoutes(metrics.slowestRoutes);
}

const { renderSessions, changeMovieSessionsPage, renderSessionTicketTypeOptions, renderRoomOptions, closeSessionEditor, syncSessionCreationMode, renderSessionLinkedTickets, openSessionEditor, saveSession, removeSession } = window.CineAdminModules.movieSessionsView.createMovieSessionsView({
  state, $, currentMovie, escapeHtml, globalSessionStatusLabel: (...args) => globalSessionStatusLabel(...args), money, sessionTicketTypes, trashIcon,
  showToast, ticketStatusText, saveMovieWithAction: (...args) => saveMovieWithAction(...args), adminTodayKey: (...args) => adminTodayKey(...args), setMovieWizardStep,
  updateSessionScheduleSuggestion: (...args) => updateSessionScheduleSuggestion(...args), applySessionMutation, renderMovies, showSuccess, api,
  setDisabled, confirm, Option, document
});

function sessionTicketTypes(session = {}) {
  const activeTypes = (state.content?.ticketTypes || []).filter((ticketType) => ticketType.active !== false);
  const selectedIds = new Set(Array.isArray(session.ticketTypeIds) && session.ticketTypeIds.length ? session.ticketTypeIds : activeTypes.map((ticketType) => ticketType.id));
  return activeTypes.filter((ticketType) => selectedIds.has(ticketType.id));
}





const { selectMovie, orderedMovies, movieCatalogNeighbors, movieCatalogPositionLabel, populateMovieCatalogPositions, renderMovieCatalogPositionPreview, loweredMoviePriorityMessage, saveMovieOrder, applyMovieCatalogPosition, moveMovie, handleMovieDragStart, handleMovieDragOver, handleMovieDragLeave, handleMovieDragEnd, handleMovieDrop, toggleMovieMenu, newMovie, getMoviePayload, saveMovieWithAction, saveMovie, deleteMovie, archiveMovie, duplicateMovie } = window.CineAdminModules.movieCatalogCommands.createMovieCatalogCommands({
  state, $, document, confirm, confirmMovieNavigation, renderMovies, escapeHtml, renderMoviePublishSummary, api, setStatus, showToast, closeFloatingActionMenu, creationPlaceholder, fillMovieForm, movieFormSnapshot, currentMovie, slugify, validateMovieWizardStep, setDisabled, upsertAdminCollection, showSuccess, removeAdminCollectionItem, closeSessionEditor: (...args) => closeSessionEditor(...args), renderGlobalSessions: (...args) => renderGlobalSessions(...args), renderInsights
});











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
  if (movieId === ($("movieId").value || state.selectedMovieId)) {
    state.movieDraftSessions = movie.sessions.map((item) => ({ ...item }));
    renderSessions(state.movieDraftSessions);
  }
  renderGlobalSessions();
  renderInsights();
}















































function enhanceImageUploads() {
  document.querySelectorAll('input[type="file"][accept*="image"]').forEach((input) => {
    const label = input.closest("label");
    if (!label || label.dataset.enhancedUpload || label.classList.contains("photo-picker")) return;
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

const { defaultRoomSeatDraft, roomSeatAccessibilityLabel, roomSeatAccessibilityIcon, roomSeatColor, roomSeatTypeOptions, roomSeatTargets, selectedRoomSeatRow, uniqueRoomSeatId, nextRoomRowLabel, renumberRoomSeatRow, createRoomSeat, renderRoomSeatTypes, renderRoomSeatSelectionPanel, renderRoomSeatMap, renderRoomSeatEditor, generateRoomSeatMap, addRoomSeatType, removeRoomSeatType, selectRoomSeatElement, updateRoomSeatSelectionField, insertRoomSeatAt, insertRoomSeatRow, insertRoomSeatColumn, handleRoomSeatSelectionAction } = window.CineAdminModules.roomSeatEditor.createRoomSeatEditor({ state, $, escapeHtml, trashIcon, accessibilityIcon, obeseSeatIcon, showToast, confirm });















































const { adminTodayKey, globalSessionRoomKey, globalSessionDuration, sessionTimeMinutes, minutesAsSessionTime, suggestedSessionSchedule, updateSessionScheduleSuggestion, globalSessionTime, globalSessionEntries, globalSessionConflictMap, globalSessionStatusLabel, renderGlobalSessionOptions, renderGlobalSessions, roomForGlobalSession, sessionTicketRevenue, renderOngoingSessions } = window.CineAdminModules.sessionScheduleView.createSessionScheduleView({ state, $, adminAssetUrl, currentMovie, escapeHtml, money, openSessionSeatMap, renderAdminListPager });































const sessionSeatStatusLabels = {
  available: "Livre",
  sold: "Ocupada",
  pending: "Aguardando pagamento",
  held: "Reservada temporariamente",
  blocked: "Bloqueada"
};

function sessionSeatDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

const { renderSessionSeatDetail, renderSessionSeatDialog } = window.CineAdminModules.sessionSeatDetailView.createSessionSeatDetailView({ $, accessibilityIcon, escapeHtml, manualSeatColor: (...args) => manualSeatColor(...args), obeseSeatIcon, openOrderView: (...args) => openOrderView(...args), orderReference, sessionSeatDateTime, sessionSeatStatusLabels, state });



async function loadSessionSeatMap() {
  const view = state.sessionSeatView;
  if (!view) return;
  const sessionId = view.sessionId;
  $("sessionSeatMap").innerHTML = `<div class="manual-seat-loading" aria-label="Carregando mapa de poltronas"></div>`;
  $("sessionSeatRefresh").disabled = true;
  try {
    const map = await api(`/api/admin/sessions/${encodeURIComponent(sessionId)}/seat-map`);
    if (state.sessionSeatView !== view) return;
    view.map = map;
    if (!map.rows.some((row) => row.seats.some((seat) => seat.id === view.seatId))) view.seatId = "";
    renderSessionSeatDialog();
  } catch (error) {
    if (state.sessionSeatView === view) $("sessionSeatMap").innerHTML = `<div class="validation-result error">${escapeHtml(error.message || "Não foi possível carregar o mapa da sala.")}</div>`;
  } finally {
    $("sessionSeatRefresh").disabled = false;
  }
}

async function openSessionSeatMap(sessionId) {
  const dialog = $("sessionSeatDialog");
  state.sessionSeatView = { sessionId: String(sessionId || ""), seatId: "", map: null };
  $("sessionSeatTitle").textContent = "Mapa da sala";
  $("sessionSeatSubtitle").textContent = "";
  $("sessionSeatSummary").innerHTML = "";
  $("sessionSeatDetail").innerHTML = "";
  if (!dialog.open) dialog.showModal();
  await loadSessionSeatMap();
}

function updateGlobalSessionFilters() {
  state.globalSessionFilters = {
    from: $("globalSessionsFrom").value,
    to: $("globalSessionsTo").value,
    roomId: $("globalSessionsRoom").value,
    movieId: $("globalSessionsMovie").value,
    status: $("globalSessionsStatus").value,
    conflictsOnly: $("globalSessionsConflictsOnly").checked
  };
  state.globalSessionsPage = 1;
  clearSessionAutocorrectPreview();
  renderGlobalSessions();
}

function openGlobalSessionEditor(movieId, sessionId = "") {
  if (!movieId) return showToast("Selecione um filme para criar a sessão.", "error");
  state.creating.movie = false;
  state.selectedMovieId = movieId;
  activatePanel("moviesPanel", { scroll: true });
  selectMovie(movieId);
  setMovieWizardStep(3);
  openSessionEditor(sessionId);
}

function sessionAutocorrectPayload() {
  return {
    from: state.globalSessionFilters.from,
    to: state.globalSessionFilters.to,
    roomId: state.globalSessionFilters.roomId,
    movieId: state.globalSessionFilters.movieId,
    turnaroundMinutes: Number($("sessionAutocorrectTurnaround")?.value ?? 20),
    stepMinutes: Number($("sessionAutocorrectStep")?.value || 5),
    includeSales: Boolean($("sessionAutocorrectIncludeSales")?.checked)
  };
}

function clearSessionAutocorrectPreview() {
  state.sessionAutocorrectPlan = null;
  const preview = $("sessionAutocorrectPreview");
  if (preview) {
    preview.hidden = true;
    preview.innerHTML = "";
  }
}

function renderSessionAutocorrectPreview(plan) {
  const preview = $("sessionAutocorrectPreview");
  if (!preview) return;
  const changes = plan.changes || [];
  const unresolved = plan.unresolved || [];
  const stepLabel = Number(plan.stepMinutes) > 1
    ? ` · Arredondamento: múltiplos de ${Number(plan.stepMinutes)} min`
    : "";
  preview.hidden = false;
  preview.innerHTML = `
    <div class="session-autocorrect-result-head">
      <div><strong>${changes.length ? `${changes.length} ajuste(s) sugerido(s)` : "Programação sem ajustes automáticos"}</strong><span>Intervalo operacional: ${Number(plan.turnaroundMinutes || 0)} min${stepLabel}.</span></div>
      <button class="icon-only-sm ghost-button" type="button" data-admin-command="clear-session-autocorrect" aria-label="Fechar sugestão"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    ${changes.length ? `<div class="session-autocorrect-changes">${changes.map((change) => `
      <article>
        <div><strong>${escapeHtml(change.movieTitle)}</strong><span>${escapeHtml(change.room)} · ${Number(change.durationMinutes)} min${change.hasSales ? " · possui vendas" : ""}</span></div>
        <div class="session-time-change"><span>${new Date(`${change.from.date}T12:00:00`).toLocaleDateString("pt-BR")} · ${escapeHtml(change.from.time)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><strong>${new Date(`${change.to.date}T12:00:00`).toLocaleDateString("pt-BR")} · ${escapeHtml(change.to.time)}</strong></div>
      </article>`).join("")}</div>` : `<div class="empty-state compact"><strong>Nenhuma sessão precisa ser movida.</strong><span>Os horários consultados já respeitam a duração dos filmes e o intervalo escolhido.</span></div>`}
    ${unresolved.length ? `<div class="session-autocorrect-unresolved"><strong>${unresolved.length} conflito(s) exigem revisão manual</strong>${unresolved.map((item) => `<span>${escapeHtml(item.movieTitle)} · ${escapeHtml(item.date)} às ${escapeHtml(item.time)} · ${escapeHtml(item.reason)}</span>`).join("")}</div>` : ""}
    <div class="button-row session-autocorrect-footer">
      <button class="ghost-button" type="button" data-admin-command="clear-session-autocorrect">Descartar sugestão</button>
      ${changes.length ? `<button id="sessionAutocorrectApplyButton" class="primary-button" type="button" data-admin-command="apply-session-autocorrect">Aplicar ${changes.length} correção(ões)</button>` : ""}
    </div>`;
}

async function previewSessionAutocorrect() {
  const button = $("sessionAutocorrectPreviewButton");
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Calculando horários...";
  try {
    const plan = await api("/api/admin/sessions/autocorrect", { method: "POST", body: JSON.stringify(sessionAutocorrectPayload()) });
    state.sessionAutocorrectPlan = plan;
    renderSessionAutocorrectPreview(plan);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function applySessionAutocorrect() {
  const plan = state.sessionAutocorrectPlan;
  if (!plan?.hash || !plan.changes?.length) return;
  const includesSales = plan.changes.some((change) => change.hasSales);
  const message = includesSales
    ? "Esta correção altera sessões com vendas e atualizará os dados dos ingressos emitidos. Deseja aplicar a sugestão?"
    : `Aplicar ${plan.changes.length} correção(ões) na programação?`;
  if (!confirm(message)) return;
  const button = $("sessionAutocorrectApplyButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Aplicando correções...";
  }
  try {
    const result = await api("/api/admin/sessions/autocorrect", {
      method: "POST",
      body: JSON.stringify({ ...sessionAutocorrectPayload(), apply: true, previewHash: plan.hash, confirmSalesImpact: includesSales })
    });
    clearSessionAutocorrectPreview();
    await loadContent({ silent: true });
    setAdminSubtab("rooms", "schedule");
    showSuccess("Programação corrigida", `${Number(result.applied || 0)} sessão(ões) foram reposicionadas sem criar novas sobreposições.`);
  } catch (error) {
    showToast(error.message, "error");
    if (error.code === "SESSION_AUTOCORRECT_PREVIEW_EXPIRED") clearSessionAutocorrectPreview();
  } finally {
    if (button) button.disabled = false;
  }
}

const { renderRoomList, selectRoom, newRoom, fillRoomForm, saveRoom, deleteRoom } = window.CineAdminModules.roomListView.createRoomListView({
  state, $, creationPlaceholder, paginateAdminItems, renderAdminListPager, escapeHtml,
  api, confirm, currentRoom, syncCreationControl, setDisabled, defaultRoomSeatDraft, renderRoomSeatEditor,
  upsertAdminCollection, removeAdminCollectionItem, renderRooms, renderRoomOptions, renderGlobalSessions,
  updateSessionScheduleSuggestion, showToast
});

function renderRooms() {
  renderGlobalSessions();
  renderOngoingSessions();
  renderRoomList();
  fillRoomForm(state.creating.room || !(state.content?.rooms || []).length ? null : currentRoom());
}











const { renderTickets, renderIssuedTicketFilters, filteredIssuedTickets, renderIssuedTickets, changeIssuedTicketsPage, showSessionTickets, selectTicket, newTicket, fillTicketForm, saveTicket, deleteTicket } = window.CineAdminModules.ticketCatalogView.createTicketCatalogView({
  state, $, activatePanel, adminCan, api, confirm, creationPlaceholder, currentTicket, escapeHtml, issuedTicketSessionLabel, money, movieById, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, setDisabled, showToast, syncCreationControl, ticketStatusText, upsertAdminCollection
});
const ticketSessionChangeView = window.CineAdminModules.ticketSessionChangeView.createTicketSessionChangeView({ $, api, closeOrderOverlay: () => closeOrderOverlay(), escapeHtml, loadContent, showToast });

const { renderOrders, renderTodaySalesSummary, orderTicketCount, renderOrdersTable, changeOrdersPage, statusClass, originLabel, paymentForOrder, movieForOrder, sectionHtml, orderDetailHtml, fillOrderEditor } = window.CineAdminModules.orderManagementView.createOrderManagementView({
  state, $, adminAssetUrl, adminCan, escapeHtml, financialStatusEventHtml, getOrderValidationSummary, isOrderEffectivelyActive, isOrderEffectivelyArchived, isOrderFullyValidated, isOrderSessionExpired, money, orderMatchesStatusFilter: (...args) => orderMatchesStatusFilter(...args), orderReference, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, providerLabel, renderManualSaleOptions: (...args) => renderManualSaleOptions(...args)
});

const { executeOrderRefundTickets, executeOrderRefundConcessions, openOrderView, openOrderEdit, closeOrderOverlay, saveOrderEdit, cancelOrDeleteOrder, archiveOrderAdmin, restoreOrderAdmin, printOrderTicket, resendOrderTicket, openPermanentDelete, closePermanentDelete, permanentlyDeleteSelectedOrder } = window.CineAdminModules.orderManagementActions.createOrderManagementActions({
  state, $, API_BASE, api, confirm, currentOrder, desktopThermalPrinterAvailable: (...args) => desktopThermalPrinterAvailable(...args), fillOrderEditor, loadContent, money, orderReference, orderStatusLabel, paymentForOrder, showToast, window
});

















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
    <button type="button" data-floating-order-action="view">Visualizar</button>
    ${!terminated && adminCan("orders.edit") ? `<button type="button" data-floating-order-action="edit">Editar</button>` : ""}
    ${!terminated && adminCan("orders.print") ? `<button type="button" data-floating-order-action="print">Imprimir ingresso</button>` : ""}
    ${!terminated && adminCan("orders.resend") ? `<button type="button" data-floating-order-action="resend">Reenviar ingresso</button>` : ""}
    ${isArchived || terminated || !adminCan("orders.cancel") ? "" : `<button type="button" data-floating-order-action="cancel">Cancelar</button>`}
    ${!adminCan("orders.archive") ? "" : order.archived
      ? `<button type="button" data-floating-order-action="restore">Restaurar pedido</button>`
      : isArchived
      ? ""
      : `<button type="button" data-floating-order-action="archive">Arquivar</button>`}
    ${adminCan("orders.delete") ? `<button class="danger-text" type="button" data-floating-order-action="delete">Excluir permanentemente</button>` : ""}
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
  floating.dataset.campaignId = campaignId;
  floating.classList.add("campaign-history-popover");
  floating.setAttribute("role", "menu");
  floating.setAttribute("aria-label", "Ações da campanha");
  floating.innerHTML = `
    ${editable ? `<button type="button" role="menuitem" data-campaign-edit="${escapeHtml(campaignId)}" data-floating-campaign-action="edit">Abrir</button>` : ""}
    ${campaign.status === "draft" ? `<button type="button" role="menuitem" data-floating-campaign-action="send">Enviar agora</button>` : ""}
    ${reportable ? `<button type="button" role="menuitem" data-floating-campaign-action="report">${["queued", "sending"].includes(campaign.status) ? "Ver progresso" : "Ver relatório"}</button>` : ""}
    ${retryable ? `<button type="button" role="menuitem" data-floating-campaign-action="retry">Reenviar falhas</button>` : ""}
    ${cancellable ? `<button class="danger-text" type="button" role="menuitem" data-floating-campaign-action="cancel">Cancelar</button>` : ""}
    <button type="button" role="menuitem" data-campaign-duplicate="${escapeHtml(campaignId)}" data-floating-campaign-action="duplicate">Duplicar</button>
    ${["draft", "failed", "cancelled"].includes(campaign.status) ? `<button class="danger-text" type="button" role="menuitem" data-campaign-delete="${escapeHtml(campaignId)}" data-floating-campaign-action="delete">Excluir</button>` : ""}
  `;
  anchor.setAttribute("aria-expanded", "true");
  positionFloatingMenu(anchor, floating);
  floating.querySelector("button")?.focus({ preventScroll: true });
}

async function copyTicketCode(code) {
  await navigator.clipboard?.writeText(code).catch(() => null);
  showToast("Código copiado.");
}











const { changePaymentsPage, renderPaymentsCenter } = window.CineAdminModules.paymentCenterView.createPaymentCenterView({ state, $, escapeHtml, financialStatusEventHtml, money, originLabel, paymentMethodLabel, paymentStatusLabel, providerLabel, statusClass });

const { manualSessionStartsAt, manualSessionDateIso, manualSessionDateDisplay, maskManualSessionDate, isManualSessionSellable, manualSessionsForDate, renderManualSaleOptions, renderManualSessionOptions, currentManualMovieSession, currentManualTicketTypes, renderManualTicketTypes } = window.CineAdminModules.boxOfficeSessionView.createBoxOfficeSessionView({
  state: state,
  $: $,
  escapeHtml: escapeHtml,
  money: money,
  sessionTicketTypes: sessionTicketTypes,
  renderSaleMode: (...args) => renderSaleMode(...args),
  renderManualSaleItems: (...args) => renderManualSaleItems(...args),
  loadManualSeatMap: (...args) => loadManualSeatMap(...args),
  updateManualTotal: (...args) => updateManualTotal(...args),
  reconcileManualSeatSelection: (...args) => reconcileManualSeatSelection(...args)
});

const { manualRequestedSeatCount, manualSeatById, manualSeatColor, manualSeatOwnerStorageKey, manualSeatOwnerToken, clearManualSeatOwnerToken, reconcileManualSeatSelection, closeManualSeatRealtime, applyManualSeatRealtimeState, applyManualSeatRealtimeChange, connectManualSeatRealtime, sendManualSeatRealtimeRequest, loadManualSeatMap, toggleManualSeat, renderManualSeatMap } = window.CineAdminModules.boxOfficeSeatMap.createBoxOfficeSeatMap({
  state: state,
  $: $,
  api: api,
  API_BASE: API_BASE,
  showToast: showToast,
  escapeHtml: escapeHtml,
  accessibilityIcon: accessibilityIcon,
  obeseSeatIcon: obeseSeatIcon,
  currentManualTicketTypes: (...args) => currentManualTicketTypes(...args),
  manualTicketItems: (...args) => manualTicketItems(...args),
  currentManualMovieSession: (...args) => currentManualMovieSession(...args),
  renderManualSaleSummary: (...args) => renderManualSaleSummary(...args)
});

const { manualConcessionItems, renderManualConcessions, manualTicketItems, manualSaleDraft, manualDraftSeatSelectionComplete, addManualSaleItem, removeManualSaleItem, clearManualSaleItems, renderManualSaleItems } = window.CineAdminModules.boxOfficeDraftView.createBoxOfficeDraftView({
  state: state,
  $: $,
  document: document,
  adminAssetUrl: adminAssetUrl,
  escapeHtml: escapeHtml,
  money: money,
  showToast: showToast,
  trashIcon: trashIcon,
  currentManualMovieSession: (...args) => currentManualMovieSession(...args),
  currentManualTicketTypes: (...args) => currentManualTicketTypes(...args),
  manualSeatById: (...args) => manualSeatById(...args),
  manualRequestedSeatCount: (...args) => manualRequestedSeatCount(...args),
  closeManualSeatRealtime: (...args) => closeManualSeatRealtime(...args),
  loadManualSeatMap: (...args) => loadManualSeatMap(...args),
  renderManualTicketTypes: (...args) => renderManualTicketTypes(...args),
  updateManualTotal: (...args) => updateManualTotal(...args),
  renderManualSaleSummary: (...args) => renderManualSaleSummary(...args)
});

async function deleteConcessionOrder(orderId) {
  if (!confirm("Excluir este registro das telas e do financeiro da bomboniere? A conciliação global e a auditoria serão preservadas.")) return;
  const btn = $("concessionModalDeleteButton");
  if (btn) btn.disabled = true;
  try {
    await api(`/api/admin/concession-sales/${encodeURIComponent(orderId)}`, { method: "DELETE" });
    showToast("Registro removido da bomboniere. A auditoria financeira foi preservada.");
    closeConcessionOrderOverlay();
    await Promise.all([loadConcessionDailySales(), loadConcessionFinance(), loadDashboard()]);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function orderMatchesStatusFilter(order = {}, filter = "all") {
  if (!filter || filter === "all") return true;
  const status = String(order.status || order.paymentStatus || "").toLowerCase();
  const paymentStatus = String(paymentForOrder(order.id)?.status || order.paymentStatus || "").toLowerCase();
  if (filter === "pending") return ["pending", "pending_payment", "processing", "pix_pending"].includes(status) || ["pending", "processing"].includes(paymentStatus);
  if (filter === "refunded") return status === "refunded" || paymentStatus === "refunded" || order.refundStatus === "completed" || order.ticketRefund?.status === "completed" || order.concessionRefund?.status === "completed";
  if (filter === "expired") return status === "expired" || paymentStatus === "expired";
  if (filter === "paid") return status === "paid" && !orderMatchesStatusFilter(order, "refunded");
  return status === filter || paymentStatus === filter;
}

function financialStatusEvent(record = {}, related = {}) {
  record = record || {};
  related = related || {};
  const refund = record.refund || record.concessionRefund || record.ticketRefund || related.refund || related.concessionRefund || related.ticketRefund || {};
  const status = String(record.status || related.status || "").toLowerCase();
  const refundedAt = refund.completedAt || record.refundedAt || related.refundedAt || record.concessionCancelledAt || related.concessionCancelledAt || "";
  if (refundedAt || status === "refunded") return { label: "Reembolsado em", at: refundedAt || record.updatedAt || related.updatedAt };
  const approvedAt = record.approvedAt || record.paidAt || related.approvedAt || related.paidAt || "";
  if (approvedAt || ["paid", "approved"].includes(status)) return { label: "Aprovado em", at: approvedAt || record.updatedAt || related.updatedAt };
  const expiredAt = record.expiredAt || related.expiredAt || (status === "expired" ? record.updatedAt || related.updatedAt : "");
  if (expiredAt) return { label: "Expirado em", at: expiredAt };
  const cancelledAt = record.cancelledAt || related.cancelledAt || (status === "cancelled" ? record.updatedAt || related.updatedAt : "");
  if (cancelledAt) return { label: "Cancelado em", at: cancelledAt };
  return { label: "Criado em", at: record.createdAt || related.createdAt || "" };
}

function financialStatusEventHtml(record = {}, related = {}) {
  const event = financialStatusEvent(record, related);
  if (!event.at || Number.isNaN(new Date(event.at).getTime())) return "";
  return `<span class="list-meta financial-event-time">${escapeHtml(event.label)} ${new Date(event.at).toLocaleString("pt-BR")}</span>`;
}

const { manualSaleSummaryCustomer, manualSaleSummaryMode, manualSaleSummaryPayment, manualTicketDeliveryMethod, manualTicketDeliveryLabel, renderManualSaleSummary } = window.CineAdminModules.boxOfficeSaleSummary.createBoxOfficeSaleSummary({
  state: state,
  $: $,
  document: document,
  escapeHtml: escapeHtml,
  money: money,
  manualSaleDraft: (...args) => manualSaleDraft(...args),
  manualConcessionItems: (...args) => manualConcessionItems(...args),
  manualSessionDateDisplay: (...args) => manualSessionDateDisplay(...args)
});

const { createManualTicket } = window.CineAdminModules.boxOfficeSaleCommand.createBoxOfficeSaleCommand({
  state: state,
  $: $,
  api: api,
  document: document,
  showToast: showToast,
  showSuccess: showSuccess,
  manualSaleDraft: (...args) => manualSaleDraft(...args),
  manualDraftSeatSelectionComplete: (...args) => manualDraftSeatSelectionComplete(...args),
  manualTicketDeliveryMethod: (...args) => manualTicketDeliveryMethod(...args),
  manualConcessionItems: (...args) => manualConcessionItems(...args),
  closeManualSeatRealtime: (...args) => closeManualSeatRealtime(...args),
  renderManualSaleItems: (...args) => renderManualSaleItems(...args),
  startPointPaymentTracking: (...args) => startPointPaymentTracking(...args),
  loadContent: (...args) => loadContent(...args),
  loadManualSeatMap: (...args) => loadManualSeatMap(...args)
});

const { pointPaymentStatusLabel, stopPointPaymentPolling, pointPaymentPrintUrl, desktopThermalPrinterAvailable, requestLocalPointPaymentPrint, renderPointPayment, schedulePointPaymentPoll, pollPointPayment, startPointPaymentTracking, cancelPointPayment, retryPendingSalePrint, resolvePendingSalePrint, resetPointPaymentPanel, printPhysicalTicket } = window.CineAdminModules.boxOfficePointController.createBoxOfficePointController({
  state: state,
  $: $,
  api: api,
  API_BASE: API_BASE,
  window: window,
  document: document,
  localStorage: localStorage,
  sessionStorage: sessionStorage,
  confirm: confirm,
  money: money,
  escapeHtml: escapeHtml,
  showToast: showToast,
  adminCan: adminCan,
  loadContent: (...args) => loadContent(...args),
  renderConcessionCounterPayment: (...args) => renderConcessionCounterPayment(...args),
  scheduleConcessionCounterPaymentPoll: (...args) => scheduleConcessionCounterPaymentPoll(...args),
  stopConcessionCounterPaymentPolling: (...args) => stopConcessionCounterPaymentPolling(...args),
  renderManualSaleItems: (...args) => renderManualSaleItems(...args)
});

const { concessionCounterItems, concessionCounterAvailableUnits, concessionCounterProducts, updateConcessionCounterQuantity, renderConcessionCounterSummary, renderConcessionCounterSale, printConcessionCounterReceipt, stopConcessionCounterPaymentPolling, renderConcessionCounterPayment, scheduleConcessionCounterPaymentPoll, pollConcessionCounterPayment, cancelConcessionCounterPayment, resetConcessionCounterSale, createConcessionCounterSale } = window.CineAdminModules.concessionCounterController.createConcessionCounterController({
  state: state,
  $: $,
  api: api,
  API_BASE: API_BASE,
  window: window,
  document: document,
  localStorage: localStorage,
  sessionStorage: sessionStorage,
  confirm: confirm,
  adminCan: adminCan,
  money: money,
  escapeHtml: escapeHtml,
  showToast: showToast,
  showSuccess: showSuccess,
  normalizedSearchText: normalizedSearchText,
  adminAssetUrl: adminAssetUrl,
  formatConcessionStock: formatConcessionStock,
  pointPaymentStatusLabel: (...args) => pointPaymentStatusLabel(...args),
  retryPendingSalePrint: (...args) => retryPendingSalePrint(...args),
  requestLocalPointPaymentPrint: (...args) => requestLocalPointPaymentPrint(...args),
  desktopThermalPrinterAvailable: (...args) => desktopThermalPrinterAvailable(...args),
  resolvePendingSalePrint: (...args) => resolvePendingSalePrint(...args),
  loadContent: (...args) => loadContent(...args),
  loadConcessionDailySales: (...args) => loadConcessionDailySales(...args),
  loadConcessionFinance: (...args) => loadConcessionFinance(...args),
  loadDashboard: (...args) => loadDashboard(...args)
});

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
  $("registeredCustomerBox")?.classList.remove("has-selected-customer");
  $("manualSelectedCustomer").className = "selected-customer-state empty";
  $("manualSelectedCustomer").innerHTML = `<span>Nenhum cliente selecionado. Digite pelo menos 2 caracteres para buscar.</span>`;
  renderManualSaleSummary();
}

function paginateAdminItems(items, key, selectedKey = "") {
  const pageKey = `${key}Page`;
  const pageSize = Math.max(1, Number(state[`${key}PageSize`] || 8));
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  state[pageKey] = Math.min(Math.max(1, Number(state[pageKey] || 1)), totalPages);
  const selectedIndex = selectedKey && state[selectedKey]
    ? items.findIndex((item) => String(item.id) === String(state[selectedKey]))
    : -1;
  if (selectedIndex >= 0) state[pageKey] = Math.floor(selectedIndex / pageSize) + 1;
  const start = (state[pageKey] - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  if (selectedKey && pageItems.length && !pageItems.some((item) => String(item.id) === String(state[selectedKey] || ""))) {
    state[selectedKey] = pageItems[0].id;
  }
  return { page: state[pageKey], pageSize, totalPages, start, pageItems, total: items.length };
}

function renderAdminListPager(key, pagination, label) {
  if (!pagination || pagination.total <= pagination.pageSize) return "";
  const end = Math.min(pagination.start + pagination.pageItems.length, pagination.total);
  return `
    <div class="table-pagination-bar admin-list-pagination">
      <span>Exibindo <strong>${pagination.start + 1}–${end}</strong> de <strong>${pagination.total}</strong> ${escapeHtml(label)}</span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${pagination.page <= 1 ? "disabled" : ""} data-admin-list-page="${escapeHtml(key)}" data-page-delta="-1">Anterior</button>
        <span class="pager-page-indicator">Página ${pagination.page} de ${pagination.totalPages}</span>
        <button class="ghost-button" type="button" ${pagination.page >= pagination.totalPages ? "disabled" : ""} data-admin-list-page="${escapeHtml(key)}" data-page-delta="1">Próxima</button>
      </div>
    </div>`;
}

function changeAdminListPage(key, delta) {
  const renderers = {
    movies: renderMovies,
    rooms: renderRooms,
    globalSessions: renderGlobalSessions,
    ticketTypes: renderTickets,
    concessions: renderConcessions,
    promotions: renderPromotions,
    ads: renderAds,
    users: renderUsers,
    clubPlans: renderClub
  };
  const selectedKeys = {
    movies: "selectedMovieId",
    rooms: "selectedRoomId",
    ticketTypes: "selectedTicketId",
    concessions: "selectedConcessionId",
    promotions: "selectedPromotionId",
    ads: "selectedAdId",
    users: "selectedUserId",
    clubPlans: "selectedClubPlanId"
  };
  if (!renderers[key]) return;
  state[`${key}Page`] = Math.max(1, Number(state[`${key}Page`] || 1) + Number(delta || 0));
  if (selectedKeys[key]) state[selectedKeys[key]] = "";
  renderers[key]();
}

function selectBoxOfficeCustomer(customer) {
  state.selectedCustomer = customer;
  $("manualCustomerUserId").value = customer.id;
  $("manualCustomerName").value = customer.name || "";
  $("manualCustomerEmail").value = customer.email || "";
  $("manualCustomerPhone").value = String(customer.phone || "").replace(/\D/g, "").slice(0, 11);
  $("manualCustomerCpf").value = String(customer.cpf || "").replace(/\D/g, "").slice(0, 11);
  $("manualCustomerSearch").value = customer.name || customer.email || "";
  $("registeredCustomerBox")?.classList.add("has-selected-customer");
  $("manualSelectedCustomer").className = "selected-customer-state confirmed";
  $("manualSelectedCustomer").innerHTML = `
    <span class="selected-customer-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
    </span>
    <span class="selected-customer-copy">
      <span class="selected-customer-label">Cliente selecionado</span>
      <strong>${escapeHtml(customer.name || "Cliente")}</strong>
      <small>${escapeHtml([customer.email, customer.phone].filter(Boolean).join(" · ") || "Conta cadastrada")}</small>
      <span>Ingressos e itens vinculados serão associados a esta conta.</span>
    </span>
    <button class="ghost-button compact-button" type="button" data-admin-command="change-box-office-customer">Trocar</button>`;
  $("manualCustomerResults").innerHTML = "";
  renderManualSaleSummary();
}

function changeBoxOfficeCustomer() {
  state.customerSearchRequestId += 1;
  state.customerSearchResults = [];
  $("manualCustomerSearch").value = "";
  $("manualCustomerResults").innerHTML = "";
  clearSelectedCustomer();
  $("manualCustomerSearch").focus();
}

function selectBoxOfficeCustomerById(customerId) {
  const customer = state.customerSearchResults.find((item) => item.id === customerId);
  if (customer) selectBoxOfficeCustomer(customer);
}

async function searchBoxOfficeCustomers() {
  const query = $("manualCustomerSearch").value.trim();
  const target = $("manualCustomerResults");
  const searchableLength = query.replace(/\s/g, "").length;
  const keepSelection = state.selectedCustomer && (
    query === state.selectedCustomer.name ||
    query === state.selectedCustomer.email ||
    query === state.selectedCustomer.phone
  );
  if (keepSelection) {
    target.innerHTML = "";
    return;
  }
  clearSelectedCustomer();
  state.customerSearchRequestId += 1;
  const requestId = state.customerSearchRequestId;
  if (searchableLength < 2) {
    state.customerSearchResults = [];
    target.innerHTML = query
      ? `<div class="customer-search-hint"><strong>Digite mais um caractere</strong><span>A busca começa com 2 caracteres.</span></div>`
      : "";
    return;
  }
  target.innerHTML = `<div class="skeleton-card compact"></div>`;
  try {
    const result = await api(`/api/admin/customers?query=${encodeURIComponent(query)}`);
    if (requestId !== state.customerSearchRequestId) return;
    const customers = result.customers || [];
    state.customerSearchResults = customers;
    target.innerHTML = customers.length
      ? customers.map((customer) => `
          <button type="button" class="customer-result" data-box-office-customer-id="${escapeHtml(customer.id)}">
            <strong>${escapeHtml(customer.name)}</strong>
            <span>${escapeHtml(customer.email || "")} ${customer.phone ? `- ${escapeHtml(customer.phone)}` : ""} ${customer.role ? `- ${escapeHtml(adminRoleLabel(customer.role))}` : ""}</span>
          </button>
        `).join("")
      : `<div class="empty-state compact"><strong>Nenhum cliente encontrado</strong><span>Use Cliente avulso ou Venda rapida.</span></div>`;
  } catch (error) {
    if (requestId !== state.customerSearchRequestId) return;
    target.innerHTML = `<div class="validation-result error">${escapeHtml(error.message)}</div>`;
  }
}

function scheduleBoxOfficeCustomerSearch({ immediate = false } = {}) {
  window.clearTimeout(state.customerSearchTimer);
  state.customerSearchTimer = window.setTimeout(searchBoxOfficeCustomers, immediate ? 0 : 280);
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
  localStorage.setItem("cine_admin_concession_tab", tab);
  document.querySelectorAll("[data-concession-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.concessionTab === tab);
  });
  const panelByTab = {
    todaySales: "concessionTodaySalesTab",
    counterSale: "concessionCounterSaleTab",
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
    } else if (tab === "counterSale") {
      renderConcessionCounterSale();
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

const { validationSessionOptions, validationSessionLabel, renderValidationSessionScope, updateValidationSessionLock, setTicketValidationMode, ticketResultDetails, renderTicketValidationResult, validateTicketByCode, confirmTicketConcessions, confirmTicketEntry } = window.CineAdminModules.ticketValidationController.createTicketValidationController({
  state: state,
  $: $,
  api: api,
  document: document,
  navigator: navigator,
  escapeHtml: escapeHtml,
  showToast: showToast,
  loadContent: (...args) => loadContent(...args),
  setQrReaderActive: (...args) => setQrReaderActive(...args),
  startQrReader: (...args) => startQrReader(...args)
});

const { startQrReader, getCameraPermissionState, requestCameraStream, prepareQrVideo, cameraRecoverySteps, renderCameraAccessError, updateQrCountdown, setQrReaderActive, stopQrReader, toggleQrTorch, toggleManualCodeBox, scanNextTicket } = window.CineAdminModules.ticketQrReader.createTicketQrReader({
  state: state,
  $: $,
  window: window,
  document: document,
  navigator: navigator,
  location: location,
  QR_SCAN_DURATION_MS: QR_SCAN_DURATION_MS,
  BarcodeDetector: window.BarcodeDetector,
  escapeHtml: escapeHtml,
  showToast: showToast,
  validateTicketByCode: (...args) => validateTicketByCode(...args),
  renderTicketValidationResult: (...args) => renderTicketValidationResult(...args)
});

const { renderConcessions, selectConcession, newConcession, fillConcessionForm, renderConcessionPreview, saveConcession, deleteConcession } = window.CineAdminModules.concessionProductsView.createConcessionProductsView({
  state, $, adminAssetUrl, api, cleanAdminAssetUrl, creationPlaceholder, currentConcession, escapeHtml, formatConcessionStock, money, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, renderConcessionInsights: (...args) => renderConcessionInsights(...args), setDisabled, showSuccess, showToast, syncConcessionStockFields, syncCreationControl, upsertAdminCollection, confirm
});

const { changeConcessionBreakdownPage, renderConcessionInsights } = window.CineAdminModules.concessionInsightsView.createConcessionInsightsView({ $, escapeHtml, money, state });















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

const { renderMarketingOverview } = window.CineAdminModules.marketingOverviewView.createMarketingOverviewView({ $, emailCampaignTemplateLabel: (...args) => emailCampaignTemplateLabel(...args), escapeHtml, humanizeEnum, state, statusClass });

function concessionStockUnitLabel(unit = "unit", amount = 0) {
  if (unit === "unit") return Number(amount) === 1 ? "unidade" : "unidades";
  return unit;
}

function formatConcessionStock(item = {}) {
  if (item.stock === "" || item.stock === undefined) return "Sem limite";
  const stock = Number(item.stock || 0);
  const unit = item.stockUnit || "unit";
  const formatted = stock.toLocaleString("pt-BR", { maximumFractionDigits: unit === "unit" ? 0 : 3 });
  const portions = unit === "unit" ? "" : ` · cerca de ${Math.floor(stock / Math.max(0.001, Number(item.usagePerSale || 1)))} porções`;
  return `${formatted} ${concessionStockUnitLabel(unit, stock)}${portions}`;
}

function syncConcessionStockFields() {
  const unit = $("concessionStockUnit")?.value || "unit";
  const usageField = $("concessionUsagePerSaleField");
  if (usageField) usageField.hidden = unit === "unit";
  const estimate = $("concessionStockEstimate");
  if (!estimate) return;
  const stockText = $("concessionStock")?.value;
  if (stockText === "") {
    estimate.textContent = "Sem limite de estoque. Defina um valor para habilitar o controle automático.";
    return;
  }
  const stock = Math.max(0, Number(stockText || 0));
  const usage = unit === "unit" ? 1 : Math.max(0.001, Number($("concessionUsagePerSale")?.value || 1));
  estimate.textContent = unit === "unit"
    ? `${Math.floor(stock)} item(ns) disponível(is) para venda.`
    : `${stock.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit} em estoque · consumo de ${usage.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit} por item · aproximadamente ${Math.floor(stock / usage)} item(ns) vendável(is).`;
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
  if (group === "rooms" && $("newRoomButton")) $("newRoomButton").hidden = tab !== "registered";
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



















const { EMAIL_CAMPAIGN_TEMPLATES, campaignObjectiveContext, resolveCampaignTemplateClient, campaignTemplateDefinition, campaignTemplateVariant, campaignTemplateTheme, campaignTemplateAbsoluteUrl, campaignEmailLogoUrl, selectedCampaignMovie, selectedCampaignMovies, selectedCampaignConcession, selectedCampaignConcessions, selectedCampaignClubPlan, campaignObjectiveCatalogType, selectedCampaignCatalogMovies, selectedCampaignCatalogItem, campaignTemplateLogo, campaignTemplateButton, campaignTemplateMessage, campaignTemplateImage, campaignMovieSessions, campaignTemplateShell, campaignTemplateHtml } = window.CineAdminModules.emailCampaignTemplateEngine.createEmailCampaignTemplateEngine({
  state, $, escapeHtml, money, campaignEditorAssetUrl: (...args) => campaignEditorAssetUrl(...args), window, API_BASE
});


























































































const { emailCampaignPayload, ensureCampaignBrandLogoInTemplate, campaignHtmlWithRequiredBrand, campaignCanonicalHtmlWithEdits, clearCampaignCanonicalHtml, refreshEmailCampaignRecipients, campaignPreviewVariables, campaignAudienceLabel, campaignBuiltInVariables, syncCampaignTemplateResolution, scheduleEmailCampaignResolution, applyEmailCampaignTemplate, renderEmailCampaignCatalogSummary, interpolateCampaignPreview, renderEmailCampaignVariables, insertCampaignVariable, campaignSafeUrl, campaignEditorAssetUrl, campaignColor, renderEmailCampaignPreview, syncCampaignColorControls, bindCampaignColorControls, sanitizeCampaignHtmlPreview, renderEmailBrandLogoPreview, syncEmailCampaignMode, updateEmailCampaignWorkspaceState, updateEmailCampaignContext, setEmailCampaignStep, saveEmailCampaign, sendEmailCampaign, sendEmailCampaignTest, renderEmailCampaignControls, syncCampaignImageMovieSelect } = window.CineAdminModules.emailCampaignEditor.createEmailCampaignEditor({
  state, $, API_BASE, EMAIL_CAMPAIGN_TEMPLATES, api, campaignEmailLogoUrl, campaignObjectiveCatalogType, campaignTemplateAbsoluteUrl, campaignTemplateDefinition, campaignTemplateHtml, campaignTemplateLogo, campaignTemplateTheme, campaignTemplateVariant, couponRuleLabel: (...args) => couponRuleLabel(...args), currentMovie, emailCampaignTemplateLabel: (...args) => emailCampaignTemplateLabel(...args), escapeHtml, loadEmailCampaignHistory: (...args) => loadEmailCampaignHistory(...args), money, normalizedSearchText, randomClientId, resolveCampaignTemplateClient, selectedCampaignCatalogItem, selectedCampaignCatalogMovies, selectedCampaignClubPlan, selectedCampaignConcessions, selectedCampaignMovie, selectedCampaignMovies, showToast, document, window
});

const { loadEmailCampaignHistory, campaignHistoryCount, renderEmailCampaigns, emailCampaignHistoryLinkedLabel, setCampaignField, setCampaignOpenLoading, setCampaignDeleteLoading, editEmailCampaign, deleteEmailCampaign, duplicateEmailCampaign, sendExistingEmailCampaign, cancelEmailCampaign, retryEmailCampaignFailures, viewEmailCampaignReport, emailCampaignTemplateLabel } = window.CineAdminModules.emailCampaignHistoryView.createEmailCampaignHistoryView({
  state, $, api, escapeHtml, randomClientId, clearCampaignCanonicalHtml, renderEmailCampaignControls, syncCampaignImageMovieSelect, campaignEmailLogoUrl, setEmailCampaignStep, applyEmailCampaignTemplate, syncCampaignTemplateResolution, refreshEmailCampaignRecipients, showToast, window, document, EMAIL_CAMPAIGN_TEMPLATES
});



const { emailTemplateLibraryQuery, loadEmailTemplateLibrary, emailTemplateSystemPreviewHtml, renderEmailTemplateLibrary, previewEmailTemplateLibraryItem, setEmailTemplateLibraryFavorite, useEmailTemplateLibraryItem } = window.CineAdminModules.emailTemplateLibraryView.createEmailTemplateLibraryView({
  state, $, api, escapeHtml, campaignTemplateAbsoluteUrl, campaignEmailLogoUrl, selectedCampaignMovie, selectedCampaignConcessions, selectedCampaignClubPlan, adminAssetUrl, campaignHtmlWithRequiredBrand, loadEmailCampaignHistory, editEmailCampaign, showToast, document, syncCampaignColorControls, resolveCampaignTemplateClient, syncCampaignTemplateResolution, applyEmailCampaignTemplate, setEmailCampaignStep
});














































const { renderPromotions, couponRuleLabel, couponStatusLabel, setPromotionView, selectPromotion, newPromotion, fillPromotionForm, formatCouponUsageDate, couponOrderReference, renderPromotionUsageHistory, loadPromotionUsage, savePromotion, deletePromotion } = window.CineAdminModules.promotionsView.createPromotionsView({ state, $, api, confirm, creationPlaceholder, currentPromotion, datetimeIsoValue, datetimeLocalValue, escapeHtml, money, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, setAdminSubtab, setDisabled, showSuccess, showToast, syncCreationControl, upsertAdminCollection });

const { renderAds, renderAdsMasterControl, toggleAdsStatus, selectAd, newAd, fillAdForm, saveAd, deleteAd } = window.CineAdminModules.adsView.createAdsView({ state, $, api, cleanAdminAssetUrl, confirm, creationPlaceholder, currentAd, datetimeIsoValue, datetimeLocalValue, escapeHtml, loadContent, paginateAdminItems, renderAdminImagePreview, renderAdminListPager, renderMarketingOverview, setAdminSubtab, setDisabled, showSuccess, showToast, syncCreationControl });

const { ADMIN_PERMISSION_PRESETS, selectedUserPermissions, syncUserPermissionEditor, renderUsers, selectUser, newUser, fillUserForm, saveUser, saveAdminSecurityPolicy, deleteUser } = window.CineAdminModules.teamAccountsView.createTeamAccountsView({
  state, $, document, api, confirm, creationPlaceholder, paginateAdminItems, escapeHtml, staffAvatarMarkup, adminRoleLabel, renderAdminListPager, currentUser, syncCreationControl, setDisabled, renderStaffAvatar, upsertAdminCollection, renderCustomerUsers: (...args) => renderCustomerUsers(...args), loadAdminUser, showSuccess, showToast, removeAdminCollectionItem, renderAccountSecuritySummary
});

















const { filteredCustomerAccounts, renderCustomerUsers, changeCustomerAccountsPage, selectCustomerAccount,
  newCustomerUser, fillCustomerUserForm, saveCustomerUser, deleteCustomerUser } = window.CineAdminModules.customerAccountsView.createCustomerAccountsView({
  state, $, api, confirm, creationPlaceholder, currentCustomerAccount, escapeHtml, normalizedSearchText,
  removeAdminCollectionItem, renderUsers, setDisabled, showSuccess, showToast, syncCreationControl,
  twoFactorDate, upsertAdminCollection
});





const { renderClub, viewClubSubscription, changeClubSubscriptionsPage, changeClubUsagePage, fillClubPlanForm, renderClubPlanExcludedItems, renderClubPlanFreeItems, selectClubPlan, newClubPlan, filterClubSubscriptions } = window.CineAdminModules.clubView.createClubView({
  state, $, adminAssetUrl, api, clubStatusLabel, creationPlaceholder, currentClubPlan, document, escapeHtml, isOwnerAdmin, money, paginateAdminItems, renderAdminImagePreview, renderAdminListPager, setAdminSubtab, setDisabled, showToast, syncCreationControl
});
const { saveClubPlan, deleteClubPlan, assignClubSubscription, updateClubSubscription, deleteClubSubscription, adjustClubCredit } = window.CineAdminModules.clubCommands.createClubCommands({
  state, $, api, cleanAdminAssetUrl, clubStatusLabel, confirm, currentClubPlan, document, CSS, isOwnerAdmin, loadContent, prompt, showSuccess, showToast
});

































const {
  renderIntegrations, integrationCategory, integrationStatusLabel, integrationSecurityHint, commercialCatalogEndpointUrl, commercialCatalogAccessMarkup,
  updateCommercialCatalogLinkPreview, loadCommercialCatalogToken, revealCommercialCatalogToken, copyCommercialCatalogToken, generateCommercialCatalogToken, copyCommercialCatalogLink,
  integrationDiagnosticsMarkup, renderIntegrationContext, integrationFieldInput, webhookStep, renderWebhookRun, renderWebhookHistory,
  changeWebhookHistoryPage, showWebhookRun, renderWebhookBatchProgress, watchWebhookBatch, loadWebhookSimulator, webhookSimulationPayload,
  simulateWebhook, runWebhookBatch, resendWebhookRun, openIntegrationConfig, closeIntegrationConfig, collectIntegrationForm,
  persistIntegrationForm, saveIntegration, testIntegration, toggleIntegration
} = window.CineAdminModules.integrationAdministration.createIntegrationAdministration({
  state, $, escapeHtml, API_BASE, api, showToast,
  showSuccess, refreshPointProviderControls
});

const { applyRbacVisibility } = window.CineAdminModules.adminAccessVisibility.createAdminAccessVisibility({ $, ADMIN_PERMISSION_PRESETS, activatePanel, setAdminSubtab, setBoxOfficeTab, setConcessionTab, state });

function bindEvents() {
  ticketSessionChangeView.bindEvents();
  const numericContactFields = new Set(["manualCustomerPhone", "manualCustomerCpf", "customerUserPhone", "customerUserCpf", "orderCustomerPhone", "orderCustomerCpf"]);
  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !numericContactFields.has(input.id)) return;
    const value = input.value.replace(/\D/g, "").slice(0, 11);
    if (value !== input.value) input.value = value;
  });
  bindAdminSubtabs();
  enhanceImageUploads();
  enhanceLongForms();
  const storedPanel = window.location.hash?.replace("#", "") || localStorage.getItem("cine_admin_panel") || "dashboardPanel";
  activatePanel(storedPanel, { scroll: false });
  document.body.classList.remove("admin-booting");
  setupResponsiveSelects();

  $("dashboardReportButton")?.addEventListener("click", () => window.open(`${API_BASE}/api/admin/reports/dashboard.csv?${dashboardQuery()}`, "_blank", "noopener"));
  bindTicketFinanceEvents();
  window.CineAdminModules.movieCatalogEvents.bindMovieCatalogEvents({
    $, state, renderMovies, toggleMovieMenu, duplicateMovie, moveMovie, archiveMovie, deleteMovie,
    selectMovie, handleMovieDragStart, handleMovieDragOver, handleMovieDragLeave, handleMovieDragEnd, handleMovieDrop
  });
  window.CineAdminModules.bindDelegatedEvents.bindDelegatedEvents({
    $, activatePanel, adjustClubCredit, applySessionAutocorrect, archiveOrderAdmin, cancelEmailCampaign, cancelOrDeleteOrder,
    changeAdminListPage, changeBoxOfficeCustomer, changeClubSubscriptionsPage, changeClubUsagePage, changeConcessionBreakdownPage, changeConcessionDailySalesPage, changeCustomerAccountsPage,
    changeDashLatestOrdersPage, changeDashMoviePage, changeDashSessionsPage, changeDashTopProductsPage, changeIssuedTicketsPage, changeMovieSessionsPage, changeOrdersPage,
    changePaymentsPage, changeWebhookHistoryPage, clearSessionAutocorrectPreview, closeAdminDrawer, closeAdminProfileMenu, closeConcessionOrderOverlay, closeFloatingActionMenu,
    closeIntegrationConfig, closeResponsiveSelects, closeTwoFactorSettings, copyCommercialCatalogLink, copyCommercialCatalogToken, copyTicketCode, createSessionFromDashboard,
    deleteClubSubscription, deleteEmailCampaign, duplicateEmailCampaign, editEmailCampaign, generateCommercialCatalogToken, importTmdbMovie, loadPromotionUsage,
    openConcessionOrderDetail, openGlobalSessionEditor, openIntegrationConfig, openOrderEdit, openOrderView, openPermanentDelete, openTicketSessionChange: ticketSessionChangeView.open, openSessionDashboardDetail,
    openSessionEditor, printOrderTicket, printPhysicalTicket, removeSession, requestLocalPointPaymentPrint, resendOrderTicket, resendWebhookRun,
    resolvePendingSalePrint, restoreOrderAdmin, retryCrmDeadLetters, retryEmailCampaignFailures, retryPendingSalePrint, revealCommercialCatalogToken, scanNextTicket,
    selectAd, selectBoxOfficeCustomerById, selectClubPlan, selectConcession, selectCustomerAccount, selectPromotion, selectRoom,
    selectTicket, selectUser, sendExistingEmailCampaign, setBoxOfficeTab, showChartHintFromPoint, showSessionTickets, showWebhookRun,
    testIntegration, toggleEmailCampaignMenu, toggleIntegration, toggleOrderMenu, updateClubSubscription, viewClubSubscription, viewEmailCampaignReport
  });
  window.CineAdminModules.bindAccountEvents.bindAccountEvents({
    $, activatePanel, api, closeAdminDrawer, closeAdminProfileMenu, closeTwoFactorSettings, downloadRecoveryCodes,
    loadAdminUser, loadContent, loadTwoFactorStatus, logoutAdmin, openTwoFactorSettings, renderStaffAvatar, renderTwoFactorSettings,
    saveAdminSecurityPolicy, saveMyAccount, setTicketValidationMode, showSuccess, showToast, state, toggleAdminDrawer,
    toggleAdminProfileMenu, uploadProfilePhoto
  });
  window.CineAdminModules.bindDashboardAndOverlayEvents.bindDashboardAndOverlayEvents({
    $, activatePanel, cancelOrDeleteOrder, closeAdminDrawer, closeIntegrationConfig, closeOrderOverlay, closePermanentDelete,
    executeOrderRefundConcessions, executeOrderRefundTickets, exportLogs, hideSuccess, loadConcessionDailySales, loadConcessionFinance, loadLogs,
    logoutAdmin, openPermanentDelete, permanentlyDeleteSelectedOrder, pruneLogs, refreshDashboardOnly, refreshPaymentsOnly, renderDashboardChart,
    runWebhookBatch, saveIntegration, saveOrderEdit, simulateWebhook, state, testIntegration, toggleIntegration
  });
  window.CineAdminModules.bindCatalogAndRoomEvents.bindCatalogAndRoomEvents({
    $, addRoomSeatType, cancelCreation, clearSessionAutocorrectPreview, closeSessionEditor, deleteMovie, deleteRoom,
    generateRoomSeatMap, handleRoomSeatSelectionAction, loadSessionSeatMap, movieFormSnapshot, newMovie, newRoom, openGlobalSessionEditor,
    openSessionEditor, previewSessionAutocorrect, removeRoomSeatType, renderMovieCatalogPositionPreview, renderMovieMediaPreview, renderRoomSeatEditor, renderRoomSeatMap,
    saveMovie, saveMovieWithAction, saveRoom, saveSession, searchTmdb, selectRoomSeatElement, setAdminSubtab,
    setMovieWizardStep, slugify, state, syncSessionCreationMode, updateGlobalSessionFilters, updateRoomSeatSelectionField, updateSessionScheduleSuggestion,
    uploadMovieImage, validateMovieWizardStep
  });
  window.CineAdminModules.bindSalesAndTicketEvents.bindSalesAndTicketEvents({
    $, addManualSaleItem, cancelConcessionCounterPayment, cancelCreation, cancelPointPayment, clearImageField, clearManualSaleItems,
    closeConcessionOrderOverlay, createConcessionCounterSale, createManualTicket, deleteConcession, deleteTicket, loadConcessionDailySales, loadManualSeatMap,
    manualSessionDateDisplay, manualSessionDateIso, maskManualSessionDate, newConcession, newTicket, pollConcessionCounterPayment, pollPointPayment,
    printConcessionCounterReceipt, refreshPaymentsOnly, renderConcessionCounterSale, renderConcessionCounterSummary, renderConcessionDailySales, renderConcessionPreview, renderConcessions,
    renderIssuedTickets, renderManualSaleOptions, renderManualSaleSummary, renderManualSessionOptions, renderManualTicketTypes, renderOrders, renderSaleMode,
    renderValidationSessionScope, resetConcessionCounterSale, resetPointPaymentPanel, saveConcession, saveTicket, scheduleBoxOfficeCustomerSearch, setBoxOfficeTab,
    setConcessionTab, setSaleMode, startQrReader, state, stopQrReader, syncConcessionStockFields, toggleManualCodeBox,
    toggleQrTorch, updateValidationSessionLock, uploadAdminImage, validateTicketByCode
  });
  window.CineAdminModules.bindMarketingEvents.bindMarketingEvents({
    $, api, applyEmailCampaignTemplate, campaignTemplateDefinition, clearCampaignCanonicalHtml, clearImageField, insertCampaignVariable,
    loadEmailCampaignHistory, loadEmailTemplateLibrary, previewEmailTemplateLibraryItem, refreshEmailCampaignRecipients, renderAdminImagePreview, renderEmailBrandLogoPreview, renderEmailCampaignCatalogSummary,
    renderEmailCampaignPreview, renderEmailTemplateLibrary, resolveCampaignTemplateClient, saveClubVisualSettings, saveEmailCampaign, saveSettings, scheduleEmailCampaignResolution,
    selectedCampaignClubPlan, selectedCampaignConcession, selectedCampaignMovie, sendEmailCampaign, sendEmailCampaignTest, setEmailCampaignStep, setEmailTemplateLibraryFavorite,
    showSuccess, showToast, state, syncCampaignTemplateResolution, syncEmailCampaignMode, syncTransparentImagePreviews, uploadAdminImage,
    useEmailTemplateLibraryItem
  });
  window.CineAdminModules.bindAdministrativeRecordEvents.bindAdministrativeRecordEvents({
    $, assignClubSubscription, cancelCreation, clearImageField, deleteAd, deleteClubPlan, deleteCustomerUser,
    deletePromotion, deleteUser, newAd, newClubPlan, newCustomerUser, newPromotion, newUser,
    renderAdminImagePreview, renderCustomerUsers, saveAd, saveClubPlan, saveCustomerUser, savePromotion, saveUser,
    selectedUserPermissions, setPromotionView, state, syncUserPermissionEditor, toggleAdsStatus, uploadAdminImage
  });
}

const { setupResponsiveSelects, syncResponsiveSelect, positionResponsiveSelectMenu, positionOpenResponsiveSelect, closeResponsiveSelects } = window.CineAdminModules.responsiveSelectControls.createResponsiveSelectControls({ $, escapeHtml });

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
  if (target === "myAccountPanel") fillMyAccount();
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
window.openGlobalSessionEditor = openGlobalSessionEditor;
window.clearSessionAutocorrectPreview = clearSessionAutocorrectPreview;
window.applySessionAutocorrect = applySessionAutocorrect;
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
window.requestLocalPointPaymentPrint = requestLocalPointPaymentPrint;
window.retryPendingSalePrint = retryPendingSalePrint;
window.resolvePendingSalePrint = resolvePendingSalePrint;
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
window.retryCrmDeadLetters = retryCrmDeadLetters;
window.testIntegration = testIntegration;
window.showWebhookRun = showWebhookRun;
window.resendWebhookRun = resendWebhookRun;
window.toggleIntegration = toggleIntegration;
window.loadPerformance = loadPerformance;
window.setPerformanceInterval = setPerformanceInterval;
window.startPerformanceStream = startPerformanceStream;
window.stopPerformanceStream = stopPerformanceStream;

function restoreActivePointPayment() {
  const paymentId = String(localStorage.getItem("cine_admin_active_point_payment") || "").trim();
  if (paymentId) {
    state.pointPaymentId = paymentId;
    activatePanel("ordersPanel", { scroll: false });
    setBoxOfficeTab("newSale");
    pollPointPayment({ manual: true });
    return;
  }
  const concessionPaymentId = String(localStorage.getItem("cine_admin_active_concession_point_payment") || "").trim();
  if (!concessionPaymentId) return;
  state.concessionCounterPaymentId = concessionPaymentId;
  activatePanel("concessionsPanel", { scroll: false });
  setConcessionTab("counterSale");
  pollConcessionCounterPayment({ manual: true });
}

function refreshPointProviderControls() {
  if (state.onlinePaymentProvider === undefined) {
    state.onlinePaymentProvider = null;
    api("/api/payments/config")
      .then((config) => {
        state.onlinePaymentProvider = config.provider || "mercado_pago";
        refreshPointProviderControls();
      })
      .catch(() => { state.onlinePaymentProvider = "mercado_pago"; });
    return;
  }
  const pagBankActive = state.onlinePaymentProvider === "pag_bank";
  for (const name of ["manualPaymentMethod", "concessionCounterPaymentMethod"]) {
    document.querySelectorAll(`input[name="${name}"][value^="point_"]`).forEach((input) => {
      input.disabled = pagBankActive;
      input.closest("label")?.classList.toggle("is-disabled", pagBankActive);
      if (pagBankActive && input.checked) {
        const cash = document.querySelector(`input[name="${name}"][value="cash"]`);
        if (cash) cash.checked = true;
      }
    });
  }
  if ($("manualTapOnStatus")) $("manualTapOnStatus").hidden = !pagBankActive;
  if ($("concessionTapOnStatus")) $("concessionTapOnStatus").hidden = !pagBankActive;
}

async function retryCrmDeadLetters() {
  try {
    const result = await api("/api/admin/integrations/crm/outbox/retry-dead", { method: "POST" });
    const integration = state.integrations?.integrations?.crm;
    if (integration) integration.outbox = result.outbox;
    if (state.selectedIntegrationKey === "crm" && integration) {
      $("integrationContext").innerHTML = renderIntegrationContext(integration);
    }
    showToast(`${Number(result.count || 0)} evento(s) reenfileirado(s).`, "ok");
  } catch (error) {
    showToast(error.message || "Não foi possível reenfileirar as falhas.", "error");
  }
}

let adminInitialization = null;
function initAdmin() {
  if (adminInitialization) return adminInitialization;
  adminInitialization = (async () => {
    const logo = $("adminLogoImg");
    if (logo && API_BASE) logo.src = `${API_BASE}/images/logo-display.webp?brand=cinecruzeiro-goldstars-v2-2026`;
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
    restoreActivePointPayment();
    if ($("logsPanel")?.classList.contains("active")) {
      startPerformanceStream();
      void loadPerformance();
    }
  })();
  return adminInitialization;
}

initAdmin();
