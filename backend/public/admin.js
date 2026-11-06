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
  if ($("myAccountSecurityState")) {
    const remaining = state.twoFactorStatus?.recoveryCodesRemaining ?? state.adminUser?.twoFactorRecoveryCodesRemaining ?? 0;
    $("myAccountSecurityState").textContent = enabled
      ? `2FA ativo · ${remaining} códigos de recuperação disponíveis. Os códigos só são exibidos ao gerar um novo conjunto.`
      : "2FA ainda não configurado para esta conta.";
  }
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
  setDisabled, confirm, prompt, Option, document
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

function renderSessionSeatDetail() {
  const view = state.sessionSeatView;
  const seat = view?.map?.rows.flatMap((row) => row.seats).find((item) => item.id === view.seatId);
  const target = $("sessionSeatDetail");
  if (!seat) {
    target.innerHTML = `<div class="session-seat-detail-empty"><strong>Selecione uma poltrona</strong><p>O status e as informações disponíveis da compra aparecem aqui.</p></div>`;
    return;
  }
  const purchase = seat.purchase;
  target.innerHTML = `
    <span class="mini-label">Poltrona ${escapeHtml(seat.label)}</span>
    <h3>${escapeHtml(sessionSeatStatusLabels[seat.status] || seat.status)}</h3>
    <dl>
      <div><dt>Tipo</dt><dd>${escapeHtml(seat.typeName || "Padrão")}</dd></div>
      ${seat.accessibility ? `<div><dt>Acessibilidade</dt><dd>${escapeHtml(seat.accessibility === "wheelchair" ? "Cadeirante" : seat.accessibility === "obese" ? "Pessoa obesa" : seat.accessibility)}</dd></div>` : ""}
      ${purchase ? `
        <div><dt>Comprador</dt><dd>${escapeHtml(purchase.customerName)}</dd></div>
        <div><dt>Pedido</dt><dd>${escapeHtml(purchase.orderReference || purchase.orderId)}</dd></div>
        <div><dt>Situação</dt><dd>${escapeHtml(purchase.orderStatus === "paid" ? "Pago" : purchase.orderStatus === "paid_pending_print" ? "Pago, aguardando impressão" : purchase.orderStatus === "pending_payment" ? "Aguardando pagamento" : purchase.orderStatus || "Não informada")}</dd></div>
        <div><dt>Pedido criado</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.createdAt))}</dd></div>
        ${purchase.paidAt ? `<div><dt>Pagamento aprovado</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.paidAt))}</dd></div>` : ""}
        ${purchase.paymentMethod ? `<div><dt>Pagamento</dt><dd>${escapeHtml(purchase.paymentMethod === "PIX" ? "Pix" : purchase.paymentMethod === "CREDIT_CARD" ? "Cartão" : purchase.paymentMethod)}</dd></div>` : ""}
        ${purchase.ticketType ? `<div><dt>Ingresso</dt><dd>${escapeHtml(purchase.ticketType)}</dd></div>` : ""}
        <div><dt>Origem</dt><dd>${escapeHtml(purchase.origin === "box_office" ? "Bilheteria" : purchase.origin === "online" ? "Site" : purchase.origin || "Não informada")}</dd></div>
        ${purchase.usedAt ? `<div><dt>Entrada validada</dt><dd>${escapeHtml(sessionSeatDateTime(purchase.usedAt))}</dd></div>` : ""}
      ` : seat.status === "held" ? `<div><dt>Reserva</dt><dd>Temporária, ainda sem compra concluída.</dd></div>` : ""}
    </dl>
    ${purchase?.orderId ? `<button class="ghost-button" type="button" data-session-seat-order="${escapeHtml(purchase.orderId)}">Abrir pedido</button>` : ""}`;
  target.querySelector("[data-session-seat-order]")?.addEventListener("click", () => {
    $("sessionSeatDialog").close();
    openOrderView(purchase.orderId);
  });
}

function renderSessionSeatDialog() {
  const view = state.sessionSeatView;
  const map = view?.map;
  if (!map) return;
  $("sessionSeatTitle").textContent = map.movieTitle || "Mapa da sala";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(map.date || "") ? map.date.split("-").reverse().join("/") : map.date || "";
  $("sessionSeatSubtitle").textContent = `${map.roomName} · ${date} · ${map.time}`;
  $("sessionSeatSummary").innerHTML = [
    ["Livre", map.counts.available], ["Ocupada", map.counts.sold],
    ["Pagamento pendente", map.counts.pending], ["Reserva temporária", map.counts.held], ["Bloqueada", map.counts.blocked]
  ].map(([label, count]) => `<span><strong>${count}</strong>${label}</span>`).join("");
  if (!map.enabled || !map.rows.length) {
    $("sessionSeatMap").innerHTML = `<div class="ongoing-seat-empty">Esta sessão não possui mapa de poltronas configurado.</div>`;
    renderSessionSeatDetail();
    return;
  }
  $("sessionSeatMap").innerHTML = `
    <div class="session-seat-map-content">
      <div class="room-seat-screen">${escapeHtml(map.screenLabel)}</div>
      <div class="session-seat-map" aria-label="Mapa da sala ${escapeHtml(map.roomName)}">
        ${map.rows.map((row) => `<div class="session-seat-row">
          <span class="room-seat-row-label">${escapeHtml(row.label)}</span>
          <div class="session-seat-row-seats">${row.seats.map((seat) => `<button type="button"
            class="session-seat-button is-${escapeHtml(seat.status)} ${seat.aisleAfter ? "has-aisle" : ""} ${view.seatId === seat.id ? "is-current" : ""}"
            style="--seat-color:${manualSeatColor(seat.color)}"
            data-session-seat-id="${escapeHtml(seat.id)}"
            aria-label="${escapeHtml(`${seat.label}, ${seat.typeName}, ${sessionSeatStatusLabels[seat.status] || seat.status}`)}"
            aria-pressed="${view.seatId === seat.id}">${seat.accessibility === "wheelchair" ? accessibilityIcon : seat.accessibility === "obese" ? obeseSeatIcon : ""}<span>${escapeHtml(seat.label)}</span></button>`).join("")}</div>
          <span class="room-seat-row-label" aria-hidden="true">${escapeHtml(row.label)}</span>
        </div>`).join("")}
      </div>
      <div class="session-seat-legend">${Object.entries(sessionSeatStatusLabels).map(([status, label]) => `<span><i class="is-${status}"></i>${label}</span>`).join("")}</div>
    </div>`;
  $("sessionSeatMap").querySelectorAll("[data-session-seat-id]").forEach((button) => {
    button.addEventListener("click", () => {
      view.seatId = button.dataset.sessionSeatId;
      $("sessionSeatMap").querySelectorAll("[data-session-seat-id]").forEach((seatButton) => {
        const selected = seatButton.dataset.sessionSeatId === view.seatId;
        seatButton.classList.toggle("is-current", selected);
        seatButton.setAttribute("aria-pressed", String(selected));
      });
      renderSessionSeatDetail();
    });
  });
  renderSessionSeatDetail();
}

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
  state, $, activatePanel, api, confirm, creationPlaceholder, currentTicket, escapeHtml, issuedTicketSessionLabel, money, movieById, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, setDisabled, showToast, syncCreationControl, ticketStatusText, upsertAdminCollection
});

const { renderOrders, renderTodaySalesSummary, orderTicketCount, renderOrdersTable, changeOrdersPage, statusClass, originLabel, paymentForOrder, movieForOrder, sectionHtml, orderDetailHtml, fillOrderEditor } = window.CineAdminModules.orderManagementView.createOrderManagementView({
  state, $, adminAssetUrl, adminCan, escapeHtml, financialStatusEventHtml, getOrderValidationSummary, isOrderEffectivelyActive, isOrderEffectivelyArchived, isOrderFullyValidated, isOrderSessionExpired, money, orderMatchesStatusFilter: (...args) => orderMatchesStatusFilter(...args), orderReference, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, providerLabel, renderManualSaleOptions: (...args) => renderManualSaleOptions(...args)
});

const { executeOrderRefundTickets, executeOrderRefundConcessions, openOrderView, openOrderEdit, closeOrderOverlay, saveOrderEdit, cancelOrDeleteOrder, archiveOrderAdmin, restoreOrderAdmin, printOrderTicket, resendOrderTicket, openPermanentDelete, closePermanentDelete, permanentlyDeleteSelectedOrder } = window.CineAdminModules.orderManagementActions.createOrderManagementActions({
  state, $, API_BASE, api, confirm, currentOrder, desktopThermalPrinterAvailable: (...args) => desktopThermalPrinterAvailable(...args), fillOrderEditor, loadContent, money, orderReference, orderStatusLabel, paymentForOrder, prompt, showToast, window
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
  state, $, adminAssetUrl, api, cleanAdminAssetUrl, creationPlaceholder, currentConcession, escapeHtml, formatConcessionStock, money, paginateAdminItems, removeAdminCollectionItem, renderAdminListPager, renderConcessionInsights, setDisabled, showSuccess, showToast, syncConcessionStockFields, syncCreationControl, upsertAdminCollection, confirm
});

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
        <button class="ghost-button" type="button" ${state.concessionBreakdownPage <= 1 ? "disabled" : ""} data-static-pager="concession-breakdown" data-page-delta="-1">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.concessionBreakdownPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.concessionBreakdownPage >= totalPages ? "disabled" : ""} data-static-pager="concession-breakdown" data-page-delta="1">Próxima →</button>
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
  const metrics = state.marketingOverviewData || {};
  const email = metrics.email || {};
  const advertising = metrics.ads || {};
  const delivered = Number(email.delivered || email.sent || 0);
  const deliveryRate = Number(email.sent || 0) > 0 ? Math.round((delivered / Number(email.sent)) * 100) : 0;
  const clickRate = Number(email.delivered || 0) > 0 && email.clickedSupported
    ? Math.round((Number(email.clicked || 0) / Number(email.delivered)) * 1000) / 10
    : null;
  const adCtr = Number(advertising.impressions || 0) > 0
    ? Math.round((Number(advertising.clicks || 0) / Number(advertising.impressions)) * 1000) / 10
    : 0;
  $("marketingOverview").innerHTML = `
    <div class="mini-insight"><span>E-mails enviados</span><strong>${Number(email.sent || 0).toLocaleString("pt-BR")}</strong><small>${deliveryRate}% entregues</small></div>
    <div class="mini-insight"><span>Cliques em e-mail</span><strong>${email.clickedSupported ? Number(email.clicked || 0).toLocaleString("pt-BR") : "Indisponível"}</strong><small>${clickRate === null ? "Provider sem rastreamento" : `${clickRate}% das entregas`}</small></div>
    <div class="mini-insight"><span>Anúncios ativos</span><strong>${settings.adsEnabled === false ? 0 : Number(advertising.active ?? ads.filter((item) => item.active !== false).length)}</strong><small>${settings.adsEnabled === false ? "Exibição geral desligada" : `${Number(advertising.impressions || 0).toLocaleString("pt-BR")} impressões`}</small></div>
    <div class="mini-insight"><span>Cliques em anúncios</span><strong>${Number(advertising.clicks || 0).toLocaleString("pt-BR")}</strong><small>CTR de ${adCtr}%</small></div>
    <div class="mini-insight"><span>Cupons ativos</span><strong>${Number(metrics.coupons?.active ?? coupons.filter((item) => item.active !== false).length)}</strong><small>${Number(metrics.coupons?.uses || 0).toLocaleString("pt-BR")} uso(s)</small></div>
    <div class="mini-insight"><span>Faixa da home</span><strong>${settings.announcementEnabled === false ? "Oculta" : "Visível"}</strong><small>Canal institucional</small></div>
  `;
  const performance = $("marketingPerformance");
  if (!performance) return;
  const campaigns = metrics.recentCampaigns || [];
  const adRows = metrics.topAds || [];
  performance.innerHTML = `
    <section class="surface marketing-performance-panel">
      <div class="surface-head"><div><div class="section-title">Desempenho dos e-mails</div><p>Envios consolidados, falhas e interações informadas pelo provider.</p></div></div>
      <div class="marketing-funnel">
        <div><span>Destinatários</span><strong>${Number(email.recipients || 0).toLocaleString("pt-BR")}</strong></div>
        <div><span>Enviados</span><strong>${Number(email.sent || 0).toLocaleString("pt-BR")}</strong></div>
        <div><span>Entregues</span><strong>${email.deliveredSupported ? Number(email.delivered || 0).toLocaleString("pt-BR") : "-"}</strong></div>
        <div><span>Aberturas</span><strong>${email.openedSupported ? Number(email.opened || 0).toLocaleString("pt-BR") : "-"}</strong></div>
        <div><span>Cliques</span><strong>${email.clickedSupported ? Number(email.clicked || 0).toLocaleString("pt-BR") : "-"}</strong></div>
        <div><span>Falhas</span><strong>${Number(email.failed || 0).toLocaleString("pt-BR")}</strong></div>
      </div>
      <div class="marketing-rank-list">${campaigns.length ? campaigns.map((item) => `<div><span><strong>${escapeHtml(item.subject || "Campanha")}</strong><small>${escapeHtml(emailCampaignTemplateLabel(item.templateId || "announcement"))} · ${new Date(item.createdAt).toLocaleDateString("pt-BR")}</small></span><span class="status-label ${statusClass(item.status)}">${escapeHtml(item.statusLabel || humanizeEnum(item.status))}</span></div>`).join("") : '<div class="empty-state compact"><strong>Nenhuma campanha enviada</strong><span>Os resultados aparecerão após o primeiro envio.</span></div>'}</div>
    </section>
    <section class="surface marketing-performance-panel">
      <div class="surface-head"><div><div class="section-title">Desempenho dos anúncios</div><p>Exibições e acessos registrados nas posições publicadas do site.</p></div></div>
      <div class="marketing-rank-list">${adRows.length ? adRows.map((item) => `<div><span><strong>${escapeHtml(item.title || "Anúncio")}</strong><small>Páginas dos filmes · ${Number(item.impressions || 0).toLocaleString("pt-BR")} impressões</small></span><strong>${Number(item.clicks || 0).toLocaleString("pt-BR")} cliques</strong></div>`).join("") : '<div class="empty-state compact"><strong>Nenhuma interação registrada</strong><span>Publique um anúncio para começar a medir exibições e cliques.</span></div>'}</div>
    </section>
  `;
}

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
            <button class="ghost-button" type="button" data-integration-action="config" data-integration-key="${escapeHtml(key)}">Configurar</button>
            <button class="ghost-button" type="button" data-integration-action="test" data-integration-key="${escapeHtml(key)}">Testar</button>
            <button class="${item.enabled ? "danger-button" : "primary-button"}" type="button" data-integration-action="${item.enabled ? "disable" : "enable"}" data-integration-key="${escapeHtml(key)}">${item.enabled ? "Desativar" : "Ativar"}</button>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state"><strong>Acesso restrito</strong><span>Somente o proprietário pode ver integrações.</span></div>`;
}

function integrationCategory(key) {
  return {
    mercadoPago: "Pagamentos",
    pagBank: "Pagamentos",
    googleLogin: "Login",
    googleWallet: "Carteira digital",
    tmdb: "Catálogo",
    email: "E-mail",
    analytics: "Medição",
    crm: "CRM",
    discord: "Alertas e monitoramento",
    commercialCatalog: "Catálogo comercial"
  }[key] || "Integração";
}

function integrationStatusLabel(item) {
  if (item.key === "pagBank" && item.enabled && item.configured) return "Ativa; pedidos não verificados";
  if (item.enabled && item.configured) return "Operacional";
  if (item.configured) return "Configurada";
  return "Pendente";
}

function integrationSecurityHint(field, integration) {
  if (!field.secret) return "";
  const secret = integration.secrets?.[field.key];
  return secret?.hasValue
    ? `<small class="integration-field-hint">${secret.source === "environment" ? "Credencial fornecida pelo servidor" : "Credencial desta integração já configurada"}. Preencha somente para substituir.</small>`
    : `<small class="integration-field-hint">Campo sensível. O valor será criptografado e ocultado após salvar.</small>`;
}

function commercialCatalogEndpointUrl() {
  return new URL(`${API_BASE}/api/commercial/catalog`, window.location.origin).toString();
}

function commercialCatalogAccessMarkup() {
  return `
    <section class="integration-catalog-access">
      <strong>Link para aplicação externa</strong>
      <p>Após salvar e ativar, este catálogo disponibiliza filmes, sessões vendáveis, programação, bomboniere, promoções, cupons e datas.</p>
      <code>${escapeHtml(commercialCatalogEndpointUrl())}</code>
      <small>Prefira o header <code>Authorization: Bearer TOKEN</code>. Para integrações que exigem uma URL, use também <code>?token=TOKEN</code>.</small>
      <div class="integration-catalog-actions">
        <button class="ghost-button" type="button" data-admin-command="reveal-commercial-token">Revelar token</button>
        <button class="ghost-button" type="button" data-admin-command="copy-commercial-token">Copiar token</button>
      </div>
      <div id="commercialCatalogLinkPreview" class="integration-catalog-link-preview" aria-live="polite"></div>
    </section>
  `;
}

function updateCommercialCatalogLinkPreview() {
  const target = $("commercialCatalogLinkPreview");
  const input = document.querySelector('[data-integration-field="accessToken"]');
  if (!target || !input) return;
  const token = String(input.value || "").trim();
  if (!token) {
    target.innerHTML = `<span>O token salvo fica oculto por segurança. Gere um novo token apenas para renovar o acesso.</span>`;
    return;
  }
  const link = `${commercialCatalogEndpointUrl()}?token=${encodeURIComponent(token)}`;
  target.innerHTML = `<code>${escapeHtml(link)}</code><button class="ghost-button" type="button" data-admin-command="copy-commercial-link">Copiar link</button>`;
}

async function loadCommercialCatalogToken() {
  const input = document.querySelector('[data-integration-field="accessToken"]');
  if (!input) return "";
  const currentToken = String(input.value || "").trim();
  if (currentToken) return currentToken;
  const result = await api("/api/admin/integrations/commercialCatalog/access-token");
  input.value = String(result.token || "");
  input.type = "text";
  updateCommercialCatalogLinkPreview();
  return String(input.value || "").trim();
}

async function revealCommercialCatalogToken() {
  try {
    const token = await loadCommercialCatalogToken();
    if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
    const input = document.querySelector('[data-integration-field="accessToken"]');
    if (input) input.type = "text";
    showToast("Token revelado somente nesta sessão do painel.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function copyCommercialCatalogToken() {
  try {
    const token = await loadCommercialCatalogToken();
    if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
    await navigator.clipboard.writeText(token);
    showToast("Token do catálogo copiado.");
  } catch (error) {
    showToast(error.message || "Não foi possível copiar o token.", "error");
  }
}

function generateCommercialCatalogToken() {
  const input = document.querySelector('[data-integration-field="accessToken"]');
  if (!input) return;
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  input.value = `catalog_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  input.type = "text";
  updateCommercialCatalogLinkPreview();
  showToast("Novo token gerado. Salve a integração para ativá-lo.");
}

async function copyCommercialCatalogLink() {
  try {
    const token = await loadCommercialCatalogToken();
    if (!token) throw new Error("Nenhum token configurado para o catálogo comercial.");
    await navigator.clipboard.writeText(`${commercialCatalogEndpointUrl()}?token=${encodeURIComponent(token)}`);
    showToast("Link do catálogo copiado.");
  } catch (error) {
    showToast(error.message || "Não foi possível copiar automaticamente.", "error");
  }
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
    </dl>
    ${integration.key === "googleWallet" ? integrationDiagnosticsMarkup(testResult?.checks, testResult?.diagnostics) : ""}
    ${integration.key === "crm" ? `
      <section class="integration-catalog-access">
        <strong>O que esta integração recebe</strong>
        <p>Somente os eventos marcados são enfileirados. A entrega usa HMAC SHA-256 com timestamp, timeout configurável e fila persistente com novas tentativas para falhas transitórias.</p>
        <p>Fila: ${Number(integration.outbox?.queued || 0)} pendente(s), ${Number(integration.outbox?.processing || 0)} em processamento, ${Number(integration.outbox?.dead || 0)} em dead letter.</p>
        <button class="ghost-button" type="button" data-admin-command="retry-crm-dead-letters" ${Number(integration.outbox?.dead || 0) ? "" : "disabled"}>Reenfileirar falhas</button>
        <small>Falhas permanentes ficam para inspeção. Itens ainda pendentes que forem desmarcados são cancelados antes de enviar.</small>
      </section>
    ` : ""}
    ${integration.key === "discord" ? `
      <section class="integration-catalog-access">
        <strong>O que será enviado</strong>
        <p>Alertas de erro, falhas HTTP, desempenho, eventos de segurança e um resumo periódico de CPU, memória, disco e latência. Os eventos informativos podem ser ligados separadamente.</p>
        <p>Os embeds omitem IP, dados de clientes, conteúdo de requisições e credenciais. Tentativas de SQL injection são sinalizadas por padrões heurísticos em URL e query, sem bloquear a requisição e sem inspecionar corpos POST.</p>
      </section>
    ` : ""}
    ${integration.key === "commercialCatalog" ? commercialCatalogAccessMarkup() : ""}
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
  if (field.type === "checkboxGroup") {
    const selected = new Set(Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()));
    const original = escapeHtml(JSON.stringify([...selected]));
    return `
      <fieldset class="integration-checkbox-group" data-integration-checkbox-group="${escapeHtml(field.key)}" data-integration-original="${original}">
        <legend>${escapeHtml(field.label)}</legend>
        ${(field.options || []).map((option) => `
          <label class="check-field">
            <input type="checkbox" data-integration-field="${escapeHtml(field.key)}" data-integration-option="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""} />
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </fieldset>
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
    webhookUrl: "https://discord.com/api/webhooks/ID/TOKEN (tratado como segredo)",
    secret: "Cole o segredo de assinatura",
    events: "Ex.: order.created,payment.approved",
    timeout: "Ex.: 8000",
    retryLimit: "Ex.: 2",
    allowedOrigins: "Ex.: https://app.parceira.com",
    cacheSeconds: "Ex.: 60"
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
      ${integration.key === "commercialCatalog" && field.key === "accessToken" ? `<button class="ghost-button" type="button" data-admin-command="generate-commercial-token">Gerar token seguro</button>` : ""}
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
  const pageSize = state.webhookHistoryPageSize || 8;
  const pages = Math.max(1, Math.ceil(runs.length / pageSize));
  state.webhookHistoryPage = Math.min(Math.max(1, state.webhookHistoryPage || 1), pages);
  const start = (state.webhookHistoryPage - 1) * pageSize;
  const pageRuns = runs.slice(start, start + pageSize);
  $("webhookHistoryCount").textContent = runs.length ? `${runs.length} registro${runs.length === 1 ? "" : "s"}` : "Nenhum teste";
  target.innerHTML = runs.length ? pageRuns.map((run) => `
    <div class="webhook-history-row ${state.selectedWebhookRunId === run.id ? "selected" : ""}">
      <button type="button" class="webhook-history-main" data-webhook-action="show" data-webhook-id="${escapeHtml(run.id)}">
        <span>${escapeHtml(new Date(run.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))}</span>
        <strong>${escapeHtml(run.action || "Evento")}</strong>
        <span class="truncate">${escapeHtml(run.resourceId || "")}</span>
        <span class="webhook-http ${run.passed ? "ok" : "error"}">${escapeHtml(String(run.httpStatus || "--"))}</span>
        <span>${escapeHtml(run.passed ? "Aprovado" : "Falhou")}</span>
      </button>
      <button class="ghost-button webhook-resend" type="button" data-webhook-action="resend" data-webhook-id="${escapeHtml(run.id)}">Reenviar</button>
    </div>
  `).join("") + (runs.length > pageSize ? `
    <div class="table-pagination-bar">
      <span>Exibindo <strong>${start + 1}–${Math.min(start + pageRuns.length, runs.length)}</strong> de <strong>${runs.length}</strong></span>
      <div class="pager-controls">
        <button class="ghost-button" type="button" ${state.webhookHistoryPage <= 1 ? "disabled" : ""} data-static-pager="webhook-history" data-page-delta="-1">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.webhookHistoryPage} de ${pages}</span>
        <button class="ghost-button" type="button" ${state.webhookHistoryPage >= pages ? "disabled" : ""} data-static-pager="webhook-history" data-page-delta="1">Próxima →</button>
      </div>
    </div>` : "") : `<div class="empty-state compact"><strong>Console vazio</strong><span>Os testes recentes aparecerão aqui.</span></div>`;
}

function changeWebhookHistoryPage(delta) {
  state.webhookHistoryPage = Math.max(1, state.webhookHistoryPage + delta);
  renderWebhookHistory();
}

function showWebhookRun(id) {
  const run = state.webhookSimulatorRuns.find((item) => item.id === id);
  if (!run) return;
  state.selectedWebhookRunId = id;
  renderWebhookRun(run);
  renderWebhookHistory();
}

function renderWebhookBatchProgress(job) {
  const target = $("webhookTestResult");
  if (!target || !job) return;
  const completed = Number(job.completed || 0);
  const total = Number(job.total || 8);
  const label = job.status === "queued" ? "Aguardando início" : `Executando ${completed} de ${total} cenários`;
  target.innerHTML = `
    <div class="empty-state compact">
      <strong>Bateria de webhooks em andamento</strong>
      <span>${escapeHtml(label)}. A operação continua em segundo plano e não interfere na latência da jornada de compra.</span>
    </div>
  `;
}

async function watchWebhookBatch(job, button = null, originalLabel = "Executar bateria de testes", notifyOnComplete = true) {
  if (!job || state.webhookBatchPolling) return job;
  state.webhookBatchPolling = true;
  let current = job;
  try {
    while (["queued", "running"].includes(current.status)) {
      state.webhookBatchJob = current;
      renderWebhookBatchProgress(current);
      if (button) {
        button.disabled = true;
        button.textContent = current.status === "queued" ? "Preparando bateria..." : `Executando ${current.completed || 0}/${current.total || 8} testes...`;
      }
      await new Promise((resolve) => setTimeout(resolve, 900));
      const data = await api(`/api/admin/integrations/mercadoPago/webhook-simulations/batch/${encodeURIComponent(current.id)}`);
      current = data.job;
    }
    state.webhookBatchJob = null;
    await loadWebhookSimulator();
    if (current.status === "completed" && notifyOnComplete) {
      showSuccess("Bateria de Webhooks concluída", `${current.total} testes executados, ${current.passed} aprovados e ${current.failed} ${current.failed === 1 ? "falhou" : "falharam"}.`);
    } else if (current.status !== "completed") {
      showToast(current.error || "A bateria de webhooks não pôde ser concluída.", "error");
    }
  } finally {
    state.webhookBatchPolling = false;
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
  return current;
}

async function loadWebhookSimulator() {
  const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations");
  state.webhookSimulatorRuns = data.runs || [];
  state.webhookBatchJob = data.activeBatch || null;
  renderWebhookHistory();
  if (state.webhookBatchJob) {
    renderWebhookBatchProgress(state.webhookBatchJob);
    if (!state.webhookBatchPolling) {
      void watchWebhookBatch(state.webhookBatchJob, $("webhookBatchButton"), "Executar bateria de testes", false);
    }
  } else {
    renderWebhookRun(state.webhookSimulatorRuns.find((item) => item.id === state.selectedWebhookRunId) || state.webhookSimulatorRuns[0]);
  }
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
  button.textContent = "Iniciando bateria...";
  try {
    const data = await api("/api/admin/integrations/mercadoPago/webhook-simulations/batch", { method: "POST" });
    await watchWebhookBatch(data.job, button, original);
  } catch (error) {
    showToast(error.message, "error");
    button.disabled = false;
    button.textContent = original;
  } finally {
    if (!state.webhookBatchPolling) {
      button.disabled = false;
      button.textContent = original;
    }
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
    if (integration.key === "commercialCatalog") {
      document.querySelector('[data-integration-field="accessToken"]')?.addEventListener("input", updateCommercialCatalogLinkPreview);
      updateCommercialCatalogLinkPreview();
    }
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
  const collectedGroups = new Set();
  $("integrationForm").querySelectorAll("[data-integration-field]").forEach((input) => {
    const key = input.dataset.integrationField;
    if (!key) return;
    if (input.dataset.integrationOption) {
      if (collectedGroups.has(key)) return;
      collectedGroups.add(key);
      const group = input.closest("[data-integration-checkbox-group]");
      const current = [...group.querySelectorAll("[data-integration-option]:checked")].map((option) => option.dataset.integrationOption);
      let original = [];
      try { original = JSON.parse(group.dataset.integrationOriginal || "[]"); } catch {}
      if (JSON.stringify(current) !== JSON.stringify(original)) payload[key] = current;
      return;
    }
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
    if (["mercadoPago", "pagBank"].includes(key)) {
      state.onlinePaymentProvider = undefined;
      refreshPointProviderControls();
    }
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
    (has("dashboard.view") || has("ticket_finance.view")) && "dashboardPanel",
    has("movies.view") && "moviesPanel",
    has("rooms.view") && "roomsPanel",
    (has("ticket_types.view") || has("tickets.view")) && "ticketsPanel",
    (has("box_office.sell") || has("orders.view") || has("tickets.validate") || has("payments.view")) && "ordersPanel",
    has("concessions.view") && "concessionsPanel",
    has("marketing.view") && "marketingPanel",
    has("club.view") && "clubPanel",
    "usersPanel",
    "myAccountPanel",
    has("integrations.view") && "integrationsPanel",
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
  if (teamTab) teamTab.hidden = !has("users.manage");
  const customersTab = document.querySelector('[data-admin-tablist="accounts"] [data-admin-tab="customers"]');
  if (customersTab) customersTab.hidden = !has("users.manage");
  if (!has("users.manage") && state.adminSubtabs.accounts !== "security") setAdminSubtab("accounts", "security");
  document.querySelectorAll("[data-permission]").forEach((element) => {
    if (element.matches("[data-admin-tab-panel]")) {
      const [group, tab] = String(element.dataset.adminTabPanel || "").split(":");
      // Permission grants access, not selection of an inactive tab.
      element.hidden = !has(element.dataset.permission) || state.adminSubtabs[group] !== tab;
      return;
    }
    element.hidden = !has(element.dataset.permission);
  });
  const setFormAccess = (id, allowed) => {
    const form = $(id);
    if (!form) return;
    form.classList.toggle("is-readonly", !allowed);
    form.querySelectorAll("input, select, textarea, button[type='submit']").forEach((control) => {
      control.disabled = !allowed;
    });
  };
  setFormAccess("movieForm", state.creating.movie ? has("movies.create") : has("movies.edit"));
  setFormAccess("roomForm", state.creating.room ? has("rooms.create") : has("rooms.edit"));
  setFormAccess("ticketForm", state.creating.ticket ? has("ticket_types.create") : has("ticket_types.edit"));
  setFormAccess("manualTicketForm", has("box_office.sell"));
  setFormAccess("concessionCounterForm", has("concessions.sell"));
  setFormAccess("concessionForm", has("concessions.edit"));
  setFormAccess("settingsForm", has("settings.manage"));
  setFormAccess("emailCampaignForm", has("marketing.manage"));
  setFormAccess("promotionForm", has("marketing.manage"));
  setFormAccess("adForm", has("marketing.manage"));
  setFormAccess("userForm", has("users.manage"));
  setFormAccess("customerUserForm", has("users.manage"));
  setFormAccess("clubVisualForm", has("club.manage"));
  setFormAccess("clubPlanForm", has("club.manage"));
  setFormAccess("clubAssignForm", has("club.manage"));
  setFormAccess("integrationForm", has("integrations.manage"));
  [
    ["newPromotionButton", "marketing.manage"],
    ["newAdButton", "marketing.manage"],
    ["adsMasterToggle", "marketing.manage"],
    ["emailBrandSaveButton", "marketing.manage"],
    ["newClubPlanButton", "club.manage"],
    ["newUserButton", "users.manage"],
    ["newCustomerUserButton", "users.manage"]
  ].forEach(([id, permission]) => {
    const element = $(id);
    if (element) element.hidden = !has(permission);
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
  const handleSessionTicketAction = window.CineAdminModules.sessionTicketActions.createSessionTicketActionHandler({
    openSessionDashboardDetail, showSessionTickets, openSessionEditor, removeSession,
    openGlobalSessionEditor, copyTicketCode, openOrderView
  });

  document.addEventListener("mouseover", (event) => showChartHintFromPoint(event.target));
  document.addEventListener("focusin", (event) => showChartHintFromPoint(event.target));
  document.addEventListener("error", (event) => {
    if (event.target.matches?.("img[data-admin-image-fallback]")) {
      event.target.parentElement.textContent = "Imagem indisponível";
    }
  }, true);
  document.addEventListener("click", (event) => {
    const staticPager = event.target.closest?.("[data-static-pager][data-page-delta]");
    if (staticPager && !staticPager.disabled) {
      const pagers = {
        "concession-daily-sales": changeConcessionDailySalesPage,
        "movie-sessions": changeMovieSessionsPage,
        "issued-tickets": changeIssuedTicketsPage,
        payments: changePaymentsPage,
        "concession-breakdown": changeConcessionBreakdownPage,
        "customer-accounts": changeCustomerAccountsPage,
        "club-subscriptions": changeClubSubscriptionsPage,
        "club-usage": changeClubUsagePage,
        "webhook-history": changeWebhookHistoryPage
      };
      const pager = Object.hasOwn(pagers, staticPager.dataset.staticPager) ? pagers[staticPager.dataset.staticPager] : null;
      const delta = Number(staticPager.dataset.pageDelta);
      if (pager && (delta === -1 || delta === 1)) pager(delta);
      return;
    }
    const adminPanel = event.target.closest?.("[data-admin-panel]");
    if (adminPanel && ["ordersPanel", "concessionsPanel", "clubPanel"].includes(adminPanel.dataset.adminPanel)) {
      activatePanel(adminPanel.dataset.adminPanel, { scroll: true });
      return;
    }
    const adminCommand = event.target.closest?.("[data-admin-command]");
    if (adminCommand && !adminCommand.disabled) {
      const commands = {
        "show-box-office-payments": () => setBoxOfficeTab("payments"),
        "create-session-from-dashboard": createSessionFromDashboard,
        "open-session-editor": () => openSessionEditor(),
        "clear-session-autocorrect": clearSessionAutocorrectPreview,
        "apply-session-autocorrect": applySessionAutocorrect,
        "change-box-office-customer": changeBoxOfficeCustomer,
        "scan-next-ticket": scanNextTicket,
        "reveal-commercial-token": revealCommercialCatalogToken,
        "copy-commercial-token": copyCommercialCatalogToken,
        "copy-commercial-link": copyCommercialCatalogLink,
        "retry-crm-dead-letters": retryCrmDeadLetters,
        "generate-commercial-token": generateCommercialCatalogToken
      };
      const command = Object.hasOwn(commands, adminCommand.dataset.adminCommand) ? commands[adminCommand.dataset.adminCommand] : null;
      if (command) void command();
      return;
    }
    const adminClose = event.target.closest?.("[data-admin-close]");
    if (adminClose && ["campaign-report", "subscription-detail"].includes(adminClose.dataset.adminClose)) {
      const container = adminClose.closest(`.${adminClose.dataset.adminClose}`);
      if (container) container.hidden = true;
      return;
    }
    if (event.target.closest?.("[data-chart-hint-date]")) {
      showChartHintFromPoint(event.target);
      return;
    }
    const dashPager = event.target.closest?.("[data-dash-pager][data-page-delta]");
    if (dashPager) {
      const pagers = {
        movies: changeDashMoviePage,
        sessions: changeDashSessionsPage,
        products: changeDashTopProductsPage,
        orders: changeDashLatestOrdersPage
      };
      const pager = Object.hasOwn(pagers, dashPager.dataset.dashPager) ? pagers[dashPager.dataset.dashPager] : null;
      if (pager) pager(Number(dashPager.dataset.pageDelta));
      return;
    }
    const orderPager = event.target.closest?.("[data-order-page-target][data-page-delta]");
    if (orderPager) {
      changeOrdersPage(Number(orderPager.dataset.pageDelta), orderPager.dataset.orderPageTarget);
      return;
    }
    const adminListPager = event.target.closest?.("[data-admin-list-page][data-page-delta]");
    if (adminListPager) {
      changeAdminListPage(adminListPager.dataset.adminListPage, Number(adminListPager.dataset.pageDelta));
      return;
    }
    const tmdbMovie = event.target.closest?.("[data-tmdb-movie-id]");
    if (tmdbMovie) {
      void importTmdbMovie(tmdbMovie.dataset.tmdbMovieId);
      return;
    }
    const adminSelection = event.target.closest?.("[data-admin-select-kind][data-admin-select-id]");
    if (adminSelection) {
      const selectors = {
        room: selectRoom,
        ticket: selectTicket,
        concession: selectConcession,
        promotion: selectPromotion,
        ad: selectAd,
        user: selectUser,
        customer: selectCustomerAccount
      };
      const selector = Object.hasOwn(selectors, adminSelection.dataset.adminSelectKind)
        ? selectors[adminSelection.dataset.adminSelectKind] : null;
      if (selector) selector(adminSelection.dataset.adminSelectId);
      return;
    }
    const promotionUsage = event.target.closest?.("[data-promotion-usage-id][data-promotion-usage-page]");
    if (promotionUsage) {
      void loadPromotionUsage(promotionUsage.dataset.promotionUsageId, Number(promotionUsage.dataset.promotionUsagePage));
      return;
    }
    const pointPrint = event.target.closest?.("[data-point-print-action][data-point-print-id]");
    if (pointPrint) {
      const id = pointPrint.dataset.pointPrintId;
      const action = pointPrint.dataset.pointPrintAction;
      if (action === "retry") void retryPendingSalePrint(id);
      else if (action === "reprint") void requestLocalPointPaymentPrint(id, { manual: true });
      else if (action === "resolve") void resolvePendingSalePrint(id, pointPrint.dataset.pointResolution === "refund" ? "refund" : "cancel");
      else if (action === "ticket") printPhysicalTicket(id);
      return;
    }
    const customerResult = event.target.closest?.("[data-box-office-customer-id]");
    if (customerResult) {
      selectBoxOfficeCustomerById(customerResult.dataset.boxOfficeCustomerId);
      return;
    }
    const clubPlan = event.target.closest?.("[data-club-plan-id]");
    if (clubPlan) {
      selectClubPlan(clubPlan.dataset.clubPlanId);
      return;
    }
    const clubSubscription = event.target.closest?.("[data-club-subscription-action][data-club-subscription-id]");
    if (clubSubscription) {
      const id = clubSubscription.dataset.clubSubscriptionId;
      const action = clubSubscription.dataset.clubSubscriptionAction;
      if (action === "view") void viewClubSubscription(id);
      else if (action === "credit") void adjustClubCredit(id);
      else if (action === "delete") void deleteClubSubscription(id);
      else if (["active", "paused", "cancelled"].includes(action)) void updateClubSubscription(id, action);
      return;
    }
    const integration = event.target.closest?.("[data-integration-action][data-integration-key]");
    if (integration) {
      const key = integration.dataset.integrationKey;
      const action = integration.dataset.integrationAction;
      if (action === "config") void openIntegrationConfig(key);
      else if (action === "test") void testIntegration(key);
      else if (action === "enable" || action === "disable") void toggleIntegration(key, action === "enable");
      return;
    }
    const webhook = event.target.closest?.("[data-webhook-action][data-webhook-id]");
    if (webhook) {
      if (webhook.dataset.webhookAction === "show") showWebhookRun(webhook.dataset.webhookId);
      else if (webhook.dataset.webhookAction === "resend") void resendWebhookRun(webhook.dataset.webhookId);
      return;
    }
    if (handleSessionTicketAction(event)) return;
    const floating = $("floatingActionMenu");
    const floatingAction = event.target.closest?.("[data-floating-order-action], [data-floating-campaign-action]");
    if (floatingAction && floating && !floating.hidden && floating.contains(floatingAction)) {
      const orderActions = {
        view: openOrderView,
        edit: openOrderEdit,
        print: printOrderTicket,
        resend: resendOrderTicket,
        cancel: cancelOrDeleteOrder,
        restore: restoreOrderAdmin,
        archive: archiveOrderAdmin,
        delete: openPermanentDelete
      };
      const campaignActions = {
        edit: editEmailCampaign,
        send: sendExistingEmailCampaign,
        report: viewEmailCampaignReport,
        retry: retryEmailCampaignFailures,
        cancel: cancelEmailCampaign,
        duplicate: duplicateEmailCampaign,
        delete: deleteEmailCampaign
      };
      const orderKey = floatingAction.dataset.floatingOrderAction;
      const campaignKey = floatingAction.dataset.floatingCampaignAction;
      const orderAction = Object.hasOwn(orderActions, orderKey) ? orderActions[orderKey] : null;
      const campaignAction = Object.hasOwn(campaignActions, campaignKey) ? campaignActions[campaignKey] : null;
      if (orderAction && floating.dataset.orderId) {
        orderAction(floating.dataset.orderId);
        closeFloatingActionMenu();
      } else if (campaignAction && floating.dataset.campaignId) {
        void campaignAction(floating.dataset.campaignId).finally(closeFloatingActionMenu);
      }
      return;
    }
    const campaignMenu = event.target.closest?.("[data-admin-campaign-action='menu'][data-admin-campaign-id]");
    if (campaignMenu) {
      toggleEmailCampaignMenu(campaignMenu.dataset.adminCampaignId, { currentTarget: campaignMenu, stopPropagation() {} });
      return;
    }
    const orderAction = event.target.closest?.("[data-admin-order-action][data-admin-order-id]");
    if (orderAction) {
      const orderId = orderAction.dataset.adminOrderId;
      if (orderAction.dataset.adminOrderAction === "concession") openConcessionOrderDetail(orderId);
      else if (orderAction.dataset.adminOrderAction === "view") openOrderView(orderId);
      else if (orderAction.dataset.adminOrderAction === "menu") {
        toggleOrderMenu(orderId, { currentTarget: orderAction, stopPropagation() {} });
        return;
      }
    }
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
  $("myAccountTwoFactorButton")?.addEventListener("click", () => void openTwoFactorSettings());
  $("myAccountForm").addEventListener("submit", saveMyAccount);
  $("myPasswordForm").addEventListener("submit", saveMyAccount);
  ["myAccount", "user"].forEach((prefix) => {
    $(prefix + "Photo").addEventListener("change", (event) => void uploadProfilePhoto(prefix, event.target));
    $(prefix + "RemovePhoto").addEventListener("click", () => {
      $(prefix + "Picture").value = "";
      renderStaffAvatar($(prefix + "Avatar"), { name: $(prefix + "Name").value });
      $(prefix + "RemovePhoto").disabled = true;
    });
  });
  $("adminSecurityPolicyForm")?.addEventListener("submit", saveAdminSecurityPolicy);
  $("profileLogoutButton")?.addEventListener("click", logoutAdmin);
  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.profileAction === "account") {
        closeAdminProfileMenu();
        activatePanel("myAccountPanel", { scroll: true });
        return;
      }
      closeAdminProfileMenu();
      void openTwoFactorSettings();
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
      closeTwoFactorSettings();
      await loadAdminUser();
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
  window.CineAdminModules.logEvents.bindLogEvents({ $, document, state, loadLogs, exportLogs, pruneLogs });
  $("concessionSalesRefresh")?.addEventListener("click", () => loadConcessionDailySales());
  $("concessionSalesDate")?.addEventListener("change", () => loadConcessionDailySales());
  $("concessionSalesArchived")?.addEventListener("change", () => loadConcessionDailySales());
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
  $("sessionEditor").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input, select")) {
      event.preventDefault();
      void saveSession();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (state.movieFormSnapshot && state.movieFormSnapshot !== movieFormSnapshot()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  $("sessionCreationMode").addEventListener("change", syncSessionCreationMode);
  $("sessionDate").addEventListener("change", () => {
    if (state.editingSessionId) {
      state.editingSessionDateChanged = $("sessionDate").value !== state.editingSessionOriginalDate;
    }
    if ($("sessionCreationMode").value === "range" && (!$("sessionDateEnd").value || $("sessionDateEnd").value < $("sessionDate").value)) {
      $("sessionDateEnd").value = $("sessionDate").value;
    }
    updateSessionScheduleSuggestion({ apply: !state.sessionTimeManuallyEdited });
  });
  $("sessionRoom").addEventListener("change", () => updateSessionScheduleSuggestion({ apply: !state.sessionTimeManuallyEdited }));
  $("sessionUseSuggestedTime").addEventListener("click", () => {
    $("sessionTime").value = $("sessionUseSuggestedTime").dataset.suggestedTime || "";
    state.sessionTimeManuallyEdited = false;
    updateSessionScheduleSuggestion();
    $("sessionTime").focus();
  });
  $("sessionTime").addEventListener("input", () => {
    state.sessionTimeManuallyEdited = true;
    updateSessionScheduleSuggestion();
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
    renderMovieCatalogPositionPreview();
  });
  $("movieCatalogPosition").addEventListener("change", renderMovieCatalogPositionPreview);
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

  $("newRoomButton").addEventListener("click", () => {
    setAdminSubtab("rooms", "registered");
    newRoom();
  });
  ["globalSessionsFrom", "globalSessionsTo", "globalSessionsRoom", "globalSessionsMovie", "globalSessionsStatus", "globalSessionsConflictsOnly"].forEach((id) => {
    $(id)?.addEventListener("change", updateGlobalSessionFilters);
  });
  $("globalSessionCreateButton")?.addEventListener("click", () => openGlobalSessionEditor($("globalSessionCreateMovie").value));
  $("sessionSeatRefresh")?.addEventListener("click", () => void loadSessionSeatMap());
  $("sessionSeatClose")?.addEventListener("click", () => $("sessionSeatDialog").close());
  $("sessionSeatDialog")?.addEventListener("close", () => { state.sessionSeatView = null; });
  $("sessionSeatDialog")?.addEventListener("click", (event) => {
    if (event.target === $("sessionSeatDialog")) $("sessionSeatDialog").close();
  });
  $("sessionAutocorrectPreviewButton")?.addEventListener("click", previewSessionAutocorrect);
  ["sessionAutocorrectTurnaround", "sessionAutocorrectStep", "sessionAutocorrectIncludeSales"].forEach((id) => $(id)?.addEventListener("change", clearSessionAutocorrectPreview));
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
  $("manualCustomerSearch").addEventListener("input", () => scheduleBoxOfficeCustomerSearch());
  $("manualCustomerSearch").addEventListener("focus", () => scheduleBoxOfficeCustomerSearch({ immediate: true }));
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
  $("ordersStatusFilter")?.addEventListener("change", (event) => {
    state.ordersPage = 1;
    state.orderFilters.allStatus = event.target.value || "all";
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
  ["concessionStock", "concessionStockUnit", "concessionUsagePerSale"].forEach((id) => {
    $(id)?.addEventListener(id === "concessionStockUnit" ? "change" : "input", syncConcessionStockFields);
  });

  document.querySelectorAll("[data-concession-tab]").forEach((button) => {
    button.addEventListener("click", () => setConcessionTab(button.dataset.concessionTab));
  });
  $("concessionCounterForm")?.addEventListener("submit", createConcessionCounterSale);
  document.querySelectorAll("input[name='concessionCounterPaymentMethod']").forEach((input) => {
    input.addEventListener("change", renderConcessionCounterSummary);
  });
  $("concessionCounterSearch")?.addEventListener("input", (event) => {
    state.concessionCounterSearch = event.target.value;
    state.concessionCounterPage = 1;
    renderConcessionCounterSale();
  });
  $("concessionCounterCategory")?.addEventListener("change", (event) => {
    state.concessionCounterCategory = event.target.value || "all";
    state.concessionCounterPage = 1;
    renderConcessionCounterSale();
  });
  $("concessionCounterClearButton")?.addEventListener("click", () => {
    state.concessionCounterQuantities = {};
    renderConcessionCounterSale();
  });
  $("concessionCounterPaymentRetryButton")?.addEventListener("click", () => void pollConcessionCounterPayment({ manual: true }));
  $("concessionCounterPaymentCancelButton")?.addEventListener("click", cancelConcessionCounterPayment);
  $("concessionCounterPrintButton")?.addEventListener("click", () => printConcessionCounterReceipt());
  $("concessionCounterNewSaleButton")?.addEventListener("click", resetConcessionCounterSale);
  document.querySelectorAll("[data-concession-cat]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-concession-cat]").forEach((b) => b.classList.toggle("active", b === button));
      state.concessionCategoryFilter = button.dataset.concessionCat;
      state.concessionsPage = 1;
      state.selectedConcessionId = "";
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
  $("adsMasterToggle")?.addEventListener("click", toggleAdsStatus);
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
