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
        ...(order.tickets || []).map((ticket) => ticket.displayCode || ticket.code)
      ].join(" ").toLowerCase().includes(query))
    : filteredOrders;
  if (state.orderFilters.allStatus !== "all") {
    filteredOrders = filteredOrders.filter((order) => orderMatchesStatusFilter(order, state.orderFilters.allStatus));
  }

  renderOrdersTable("ordersList", filteredOrders, {
    compact: false,
    emptyTitle: state.orderFilters.archiveStatus === "archived" ? "Nenhum pedido arquivado" : "Nenhum pedido encontrado",
    emptyMessage: state.orderFilters.archiveStatus === "archived"
      ? "Os pedidos arquivados (validados por QR Code, cancelados ou reembolsados) ficam preservados aqui."
      : "Ajuste a busca ou aguarde uma nova venda."
  });
  const today = state.content?.calendar?.today || new Date().toISOString().slice(0, 10);
  const relevantDate = (order, filter) => {
    const payment = paymentForOrder(order.id) || {};
    if (filter === "refunded") return payment.refundedAt || order.refundedAt || order.concessionRefund?.completedAt || order.createdAt;
    if (filter === "expired") return payment.expiredAt || order.expiredAt || order.createdAt;
    if (filter === "paid") return payment.approvedAt || order.paidAt || order.createdAt;
    return order.createdAt;
  };
  let todayOrders = orders.filter((order) => String(relevantDate(order, state.orderFilters.todayStatus) || "").slice(0, 10) === today);
  if (state.orderFilters.todayOrigin !== "all") todayOrders = todayOrders.filter((order) => String(order.origin || "online") === state.orderFilters.todayOrigin);
  if (state.orderFilters.todayStatus !== "all") {
    todayOrders = todayOrders.filter((order) => orderMatchesStatusFilter(order, state.orderFilters.todayStatus));
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
        <button class="ghost-button" type="button" ${state[pageKey] <= 1 ? "disabled" : ""} data-order-page-target="${targetId}" data-page-delta="-1">← Anterior</button>
        <span class="pager-page-indicator">Página ${state[pageKey]} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state[pageKey] >= totalPages ? "disabled" : ""} data-order-page-target="${targetId}" data-page-delta="1">Próxima →</button>
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
                const tickets = (order.tickets || []).slice(0, 2).map((ticket) => `<button class="copy-code" type="button" data-admin-ticket-action="copy" data-admin-ticket-value="${escapeHtml(ticket.displayCode || ticket.code)}">${escapeHtml(ticket.displayCode || ticket.code)}</button>`).join(" ");
                const quickSale = order.saleMode === "quick";
                const customerLabel = quickSale ? "Venda rápida" : order.customerName || "Cliente avulso";
                const isArchived = isOrderEffectivelyArchived(order);
                return `
                <tr class="order-table-row ${isArchived ? "is-archived" : ""}" data-admin-order-action="view" data-admin-order-id="${escapeHtml(order.id)}">
                  <td data-label="Data/Hora"><strong>${escapeHtml(orderReference(order))}</strong><br><span class="list-meta">${new Date(order.createdAt).toLocaleString("pt-BR")}</span></td>
                  <td data-label="Cliente">${escapeHtml(customerLabel)}<br><span class="list-meta">${escapeHtml(quickSale ? "Sem identificação do cliente" : order.customerPhone || order.customerEmail || "")}</span></td>
                  <td data-label="Filme/Sessão"><strong>${escapeHtml(order.movieTitle || "-")}</strong><br><span class="list-meta">${escapeHtml([order.sessionTime, order.sessionFormat].filter(Boolean).join(" • ") || "-")}</span></td>
                  <td data-label="Itens">${orderTicketCount(order)} ingresso(s)<br><span class="list-meta">${extras}</span>${tickets ? `<div class="ticket-code-row">${tickets}</div>` : ""}</td>
                  <td data-label="Total"><strong>${money(order.totalPrice)}</strong></td>
                  <td data-label="Pagamento">${escapeHtml(originLabel(order.origin || "online"))}<br><span class="list-meta">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span></td>
                  <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span>${isArchived ? '<span class="status-label archived">Arquivado</span>' : ""}${financialStatusEventHtml(order, paymentForOrder(order.id))}</div></td>
                  <td data-label="Ações">
                    <div class="context-menu">
                      <button class="ghost-button" type="button" data-admin-order-action="view" data-admin-order-id="${escapeHtml(order.id)}">Visualizar</button>
                      <button class="icon-button" type="button" data-admin-order-action="menu" data-admin-order-id="${escapeHtml(order.id)}" aria-label="Ações do pedido">•••</button>
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
  const sandboxRefundSimulated = [order.ticketRefund, order.concessionRefund, payment?.metadata?.cancellationRefund, payment?.metadata?.ticketRefund, payment?.metadata?.concessionRefund].some((refund) => refund?.simulated === true);
  const tickets = (order.tickets || []).map((ticket) => `
    <button class="copy-code" type="button" data-admin-ticket-action="copy" data-admin-ticket-value="${escapeHtml(ticket.displayCode || ticket.code)}">${escapeHtml(ticket.displayCode || ticket.code)}</button>
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
      ["Pagamento aprovado em", payment?.approvedAt || order.paidAt ? new Date(payment?.approvedAt || order.paidAt).toLocaleString("pt-BR") : "-"],
      ["Reembolso", sandboxRefundSimulated ? "Simulado (Sandbox; sem movimentação real)" : order.refundStatus === "required" ? "Devolução manual necessária" : order.refundStatus === "completed" ? "Concluído" : order.refundStatus === "pending" ? "Em processamento" : "-"],
      ["Reembolso concluído em", payment?.refundedAt || order.refundedAt || order.ticketRefund?.completedAt || order.concessionRefund?.completedAt ? new Date(payment?.refundedAt || order.refundedAt || order.ticketRefund?.completedAt || order.concessionRefund?.completedAt).toLocaleString("pt-BR") : "-"],
      ["Orientação", order.manualRefundReason || payment?.metadata?.manualRefund?.reason || "-"],
      ["Referência externa", payment?.providerPaymentId || payment?.providerReference || "-"]
    ])}
    ${sectionHtml("Histórico", [["Eventos", history], ["Observação", order.operationalNotes || "-"]])}
  `;
}

function fillOrderEditor(order, mode) {
  if (mode === "edit" && !adminCan("orders.edit")) mode = "view";
  state.selectedOrderId = order?.id || "";
  $("orderOverlayTitle").textContent = mode === "edit" ? "Editar pedido" : "Visualizar pedido";
  $("orderOverlaySubtitle").textContent = order ? `${orderReference(order)} • ${orderStatusLabel(order.status)}` : "Pedido não encontrado.";
  $("orderDetailBody").innerHTML = order ? orderDetailHtml(order) : "";
  $("orderEditFields").hidden = mode !== "edit";
  $("orderSaveButton").hidden = mode !== "edit" || !adminCan("orders.edit");

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

  if (!adminCan("orders.cancel")) cancelBtn.hidden = true;
  if (!adminCan("orders.refund")) {
    if (refundTicketsBtn) refundTicketsBtn.hidden = true;
    if (refundConcessionsBtn) refundConcessionsBtn.hidden = true;
  }

  $("orderPermanentDeleteButton").hidden = !order || !adminCan("orders.delete");
  if (order) {
    $("orderCustomerName").value = order.customerName || "";
    $("orderCustomerPhone").value = String(order.customerPhone || "").replace(/\D/g, "").slice(0, 11);
    $("orderCustomerEmail").value = order.customerEmail || "";
    $("orderCustomerCpf").value = String(order.customerCpf || "").replace(/\D/g, "").slice(0, 11);
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

function printOrderTicket(orderId) {
  const url = `${API_BASE}/api/admin/orders/${encodeURIComponent(orderId)}/print`;
  if (desktopThermalPrinterAvailable()) {
    window.cineDesktop.printUrl(url, `order-${orderId}`);
    return;
  }
  const popup = window.open(url, "_blank");
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
        <button class="ghost-button" type="button" ${state.paymentsPage <= 1 ? "disabled" : ""} data-static-pager="payments" data-page-delta="-1">← Anterior</button>
        <span class="pager-page-indicator">Página ${state.paymentsPage} de ${totalPages}</span>
        <button class="ghost-button" type="button" ${state.paymentsPage >= totalPages ? "disabled" : ""} data-static-pager="payments" data-page-delta="1">Próxima →</button>
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
          <tr class="order-table-row" data-admin-order-action="view" data-admin-order-id="${escapeHtml(payment.orderId)}">
            <td data-label="Pedido"><strong>${escapeHtml(payment.orderReference || payment.orderId)}</strong><br><span class="list-meta">${new Date(payment.createdAt).toLocaleString("pt-BR")}</span></td>
            <td data-label="Cliente">${escapeHtml(payment.customerName || "Cliente")}</td>
            <td data-label="Filme">${escapeHtml(payment.movieTitle || "-")}</td>
            <td data-label="Origem">${escapeHtml(payment.originLabel || originLabel(payment.origin))}</td>
            <td data-label="Método">${escapeHtml(payment.methodLabel || paymentMethodLabel(payment.method))}</td>
            <td data-label="Provider">${escapeHtml(payment.providerLabel || providerLabel(payment.provider))}</td>
            <td data-label="Valor"><strong>${money(payment.amount)}</strong></td>
            <td data-label="Status"><div class="order-status-stack"><span class="status-label ${statusClass(payment.status)}">${escapeHtml(payment.statusLabel || paymentStatusLabel(payment.status))}</span>${financialStatusEventHtml(payment)}</div></td>
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

function manualSeatOwnerStorageKey(sessionId) {
  return `cine_admin_manual_seat_owner:${String(sessionId || "")}`;
}

function manualSeatOwnerToken(sessionId) {
  const key = manualSeatOwnerStorageKey(sessionId);
  try {
    const stored = window.sessionStorage.getItem(key);
    if (/^admin-box-office-[a-z0-9-]+$/i.test(String(stored || ""))) return stored;
    const token = `admin-box-office-${crypto.randomUUID()}`;
    window.sessionStorage.setItem(key, token);
    return token;
  } catch {
    return `admin-box-office-${crypto.randomUUID()}`;
  }
}

function clearManualSeatOwnerToken(sessionId) {
  try {
    window.sessionStorage.removeItem(manualSeatOwnerStorageKey(sessionId));
  } catch {
    // A reserva ainda será descartada pelo tempo de expiração no servidor.
  }
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
    if (releaseSeats) clearManualSeatOwnerToken(id);
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
    ownerToken: manualSeatOwnerToken(sessionId),
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
  if (!seat || (!selected && seat.status !== "available" && !seat.heldByMe)) return;
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
  const seatRowsMarkup = seatRows.map((row) => `
    <div class="manual-seat-row">
      <span class="manual-seat-row-label">${escapeHtml(row.label)}</span>
      <div class="manual-seat-row-seats">
        ${(row.seats || []).map((seat) => {
          const type = typeById.get(String(seat.typeId));
          const isSelected = state.manualSelectedSeatIds.includes(String(seat.id));
          const heldByMe = seat.status === "held" && seat.heldByMe;
          const temporarilyReserved = seat.status === "held" && !seat.heldByMe;
          const unavailable = (seat.status !== "available" && !seat.heldByMe) || temporarilyReserved;
          const pending = state.manualSeatRealtimeChannels.get(state.manualSeatMapSessionId)?.pendingSeatIds.has(String(seat.id));
          const accessibility = seat.accessibility === "wheelchair" ? "Cadeirante" : seat.accessibility === "obese" ? "Pessoa obesa" : "";
          return `<button
            type="button"
            class="manual-seat-button ${isSelected ? "is-selected" : ""} ${temporarilyReserved ? "is-temporarily-reserved" : unavailable ? "is-unavailable" : ""} ${pending ? "is-pending" : ""} ${accessibility ? "has-accessibility" : ""}"
            style="--manual-seat-color:${manualSeatColor(seat.color || type?.color)};${seat.aisleAfter ? "margin-right:24px" : ""}"
            data-manual-seat-id="${escapeHtml(seat.id)}"
            aria-label="${escapeHtml(`${seat.label}, ${type?.name || "Padrão"}${accessibility ? `, ${accessibility}` : ""}${temporarilyReserved ? ", reservada temporariamente por outra compra" : unavailable ? ", indisponível" : heldByMe ? ", reserva retomada nesta venda" : isSelected ? ", selecionada nesta venda" : ""}`)}"
            title="${escapeHtml(temporarilyReserved ? `${seat.label} • Reservada temporariamente por outra compra` : heldByMe ? `${seat.label} • Reserva retomada nesta venda` : `${seat.label} • ${type?.name || "Padrão"}`)}"
            aria-pressed="${isSelected}"
            ${unavailable || pending ? "disabled" : ""}
          >${seat.accessibility === "wheelchair" ? accessibilityIcon : seat.accessibility === "obese" ? obeseSeatIcon : ""}<span>${escapeHtml(seat.label)}</span></button>`;
        }).join("")}
      </div>
      <span class="manual-seat-row-label" aria-hidden="true">${escapeHtml(row.label)}</span>
    </div>
  `).join("");
  $("manualSeatMap").innerHTML = seatRowsMarkup;
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
  const section = $("manualConcessionsSection");
  if (section) section.hidden = false;
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
          ${item.imageUrl ? `<img class="manual-concession-image" src="${escapeHtml(adminAssetUrl(item.imageUrl))}" alt="" loading="lazy" />` : `<span class="manual-concession-image manual-concession-image--empty" aria-hidden="true">◈</span>`}
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
    const requiresLocalPrint = (saleMode === "quick" || (saleMode === "guest" && ticketDeliveryMethod === "physical"))
      && ["cash", "courtesy"].includes(paymentMethod);
    if (requiresLocalPrint) {
      if (!window.cineDesktop?.checkPrinter) {
        showToast("A impressão física exige o aplicativo desktop atualizado e uma impressora térmica instalada.", "error");
        return;
      }
      const printer = await window.cineDesktop.checkPrinter();
      if (!printer.ready) {
        showToast(printer.message || "Configure uma impressora térmica física em Dispositivos antes de vender.", "error");
        return;
      }
    }
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
    const pointPayment = ["point_debit", "point_credit", "point_card", "point_qr"].includes(paymentMethod);
    if (pointPayment) {
      state.pointCheckoutKey ||= String(sessionStorage.getItem("cine_admin_point_checkout_key") || "") || crypto.randomUUID();
      sessionStorage.setItem("cine_admin_point_checkout_key", state.pointCheckoutKey);
      payload.clientRequestId = state.pointCheckoutKey;
    }
    const result = await api("/api/box-office/sales", { method: "POST", body: JSON.stringify(payload) });
    const orders = result.orders || (result.order ? [result.order] : []);
    state.manualSaleItems = [];
    state.manualConcessionQuantities = {};
    state.manualSelectedSeatIds = [];
    closeManualSeatRealtime();
    renderManualSaleItems();
    if (pointPayment) {
      state.pointCheckoutKey = "";
      sessionStorage.removeItem("cine_admin_point_checkout_key");
    }
    if (pointPayment || orders.some((order) => order.status === "paid_pending_print")) {
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
    connecting: "Conectando à maquininha",
    reconnecting: "Reconectando à maquininha",
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

function pointPaymentPrintUrl(paymentId = state.pointPaymentId) {
  return `${API_BASE}/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print`;
}

function desktopThermalPrinterAvailable() {
  return Boolean(window.cineDesktop?.printUrl);
}

async function requestLocalPointPaymentPrint(paymentId = state.pointPaymentId, { manual = false } = {}) {
  if (!paymentId) return false;
  const jobKey = `point-${paymentId}`;
  if (state.localPointPrintJobs.has(jobKey) && state.localPointPrintStatus === "printing") return true;
  if (!manual && state.localPointPrintJobs.has(jobKey)) return true;
  const snapshot = state.pointPaymentId === paymentId ? state.pointPaymentSnapshot : state.concessionCounterPaymentSnapshot;
  let printJob = snapshot?.pointPrint;
  if (!desktopThermalPrinterAvailable()) {
    state.localPointPrintStatus = "unavailable";
    if (!state.localPointPrintJobs.has(jobKey) && printJob?.mode === "local") {
      state.localPointPrintJobs.add(jobKey);
      void api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print-result`, {
        method: "POST",
        body: JSON.stringify({ ok: false, jobId: printJob.jobId, message: "O aplicativo desktop com impressora térmica padrão não está disponível neste dispositivo." })
      }).then((result) => {
        if (state.pointPaymentId === paymentId) renderPointPayment(result);
        if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(result);
      }).catch((error) => showToast(error.message, "error"));
    }
    if (manual) showToast("Abra esta venda no aplicativo desktop com uma impressora térmica padrão configurada.", "error");
    return false;
  }
  state.localPointPrintJobs.add(jobKey);
  state.localPointPrintStatus = "printing";
  const pendingPrint = (snapshot?.orders || []).some((order) => order.status === "paid_pending_print");
  if (pendingPrint && (snapshot?.pointPrint?.mode !== "local" || ["failed", "timed_out"].includes(String(snapshot?.pointPrint?.status || "")))) {
    try {
      const retry = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/retry-print`, {
        method: "POST",
        body: JSON.stringify({ mode: "local" })
      });
      if (retry.completed) {
        state.localPointPrintStatus = "printed";
        if (state.pointPaymentId === paymentId) renderPointPayment(retry);
        if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(retry);
        await loadContent({ silent: true });
        return true;
      }
      printJob = retry.pointPrint;
    } catch (error) {
      state.localPointPrintStatus = "failed";
      state.localPointPrintJobs.delete(jobKey);
      showToast(error.message, "error");
      return false;
    }
  }
  if (pendingPrint && !printJob?.jobId) {
    state.localPointPrintStatus = "failed";
    state.localPointPrintJobs.delete(jobKey);
    showToast("A tentativa de impressão não foi identificada. Atualize a venda e tente novamente.", "error");
    return false;
  }
  const jobId = `${jobKey}::${printJob?.jobId || "reprint"}`;
  window.cineDesktop.printUrl(pointPaymentPrintUrl(paymentId), jobId);
  return true;
}

window.addEventListener("cine-desktop-print-result", async (event) => {
  const detail = event.detail || {};
  if (/^(order-|ticket-)/.test(String(detail.jobId || ""))) {
    showToast(detail.ok ? "Via enviada à impressora térmica." : detail.message || "A impressora não confirmou a reimpressão.", detail.ok ? undefined : "error");
    return;
  }
  if (!String(detail.jobId || "").startsWith("point-")) return;
  const [paymentId, printJobId] = String(detail.jobId).slice("point-".length).split("::");
  let result = null;
  let confirmationError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/print-result`, {
        method: "POST",
        body: JSON.stringify({ ok: Boolean(detail.ok), message: detail.message || "", jobId: printJobId })
      });
      confirmationError = null;
      break;
    } catch (error) {
      confirmationError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
    }
  }
  state.localPointPrintStatus = detail.ok && result?.completed ? "printed" : "failed";
  if (detail.ok && result?.completed) {
    localStorage.removeItem("cine_admin_active_point_payment");
    localStorage.removeItem("cine_admin_active_concession_point_payment");
    showToast("Impressão confirmada. Os ingressos foram emitidos e ativados.");
    await loadContent({ silent: true });
  } else {
    showToast(confirmationError?.message || detail.message || "A impressora térmica não confirmou a impressão. O ingresso não foi emitido.", "error");
  }
  if (result && state.pointPaymentSnapshot) renderPointPayment(result);
  else if (state.pointPaymentSnapshot) renderPointPayment(state.pointPaymentSnapshot);
  if (result && state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(result);
  else if (state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(state.concessionCounterPaymentSnapshot);
});

function renderPointPayment(data = {}) {
  const payment = data.payment || state.pointPaymentSnapshot?.payment || {};
  const orders = data.orders || state.pointPaymentSnapshot?.orders || [];
  const tickets = data.tickets || state.pointPaymentSnapshot?.tickets || [];
  const pointPrint = data.pointPrint || state.pointPaymentSnapshot?.pointPrint || {};
  const ticketDelivery = orders[0]?.ticketDelivery || {};
  const onlineDelivery = orders.some((order) => order.ticketDeliveryMethod === "online");
  const status = data.reconnecting ? "reconnecting" : payment.status || "pending";
  const reconciliationRequired = Boolean(data.reconciliationRequired || payment.metadata?.reconciliationRequired);
  const pendingPrint = status === "approved" && orders.some((order) => order.status === "paid_pending_print") && !data.completed;
  const finalStatus = ["rejected", "cancelled", "expired", "refunded"].includes(status) || (status === "approved" && !pendingPrint);
  state.pointPaymentSnapshot = { ...data, payment, orders, tickets, pointPrint };

  const panel = $("pointPaymentPanel");
  panel.hidden = false;
  document.querySelector("#boxOfficeNewSale .box-office-sale-workspace").hidden = true;
  panel.dataset.status = status;
  $("pointPaymentAmount").textContent = money(payment.amount);
  $("pointPaymentTerminal").textContent = payment.metadata?.terminalId || data.terminal?.id || "Impressora local";
  $("pointPaymentReference").textContent = payment.providerReference || payment.providerPaymentId || "-";
  $("pointPaymentStatus").textContent = status === "approved" && payment.metadata?.kind === "counter_sale"
    ? "Recebido" : pointPaymentStatusLabel(status);
  $("pointPaymentRetryButton").hidden = status === "approved";
  $("pointPaymentCancelButton").hidden = status === "approved" || finalStatus || status === "reconnecting";
  $("pointPaymentNewSaleButton").hidden = !finalStatus;

  const needsLocalPrint = ["local_required", "failed"].includes(String(pointPrint.status || ""));
  if (pendingPrint && needsLocalPrint && !onlineDelivery && !["failed", "unavailable"].includes(state.localPointPrintStatus)) {
    requestLocalPointPaymentPrint(payment.id || state.pointPaymentId);
  }
  if (payment.status === "approved" && data.completed === true) {
    localStorage.removeItem("cine_admin_active_point_payment");
  }

  const copy = reconciliationRequired ? [
    "Conciliação financeira necessária",
    "A Point confirmou um pagamento para um pedido encerrado ou ausente. Nenhum ingresso será emitido automaticamente. Confira a referência no painel antes de qualquer nova cobrança ou reembolso."
  ] : {
    approved: [
      pendingPrint ? "Pagamento registrado, aguardando impressão" : "Venda concluída; ingressos emitidos",
      onlineDelivery
        ? ticketDelivery.message || "Os ingressos digitais estão sendo enviados ao e-mail informado."
        : pointPrint.status === "printed"
        ? "O pagamento e a impressão dos ingressos foram confirmados pela Point."
        : ["queued", "on_terminal"].includes(pointPrint.status)
        ? pointPrint.message || "A impressão foi enviada à Point e está sendo confirmada."
        : state.localPointPrintStatus === "printed"
        ? "O trabalho foi aceito pela impressora térmica deste computador."
        : state.localPointPrintStatus === "printing"
        ? "Pagamento confirmado. Enviando o ingresso à impressora térmica deste computador."
        : pointPrint.message || (pendingPrint ? "O ingresso só será emitido depois que a impressão for confirmada." : "A venda foi confirmada.")
    ],
    rejected: ["Pagamento recusado", "Nenhum ingresso foi emitido. Inicie uma nova venda para tentar outra forma de pagamento."],
    cancelled: ["Cobrança cancelada", "A ordem foi cancelada no terminal e nenhum ingresso foi emitido."],
    expired: ["Tempo de pagamento encerrado", "A cobrança expirou sem aprovação e os ingressos não foram emitidos."],
    refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta cobrança."],
    reconnecting: ["Reconectando à maquininha", payment.metadata?.connectionMessage || "A cobrança continua vinculada à mesma Order. O sistema tentará novamente sem duplicar o pagamento."]
  }[status] || ["Aguardando pagamento na Point", "A cobrança foi enviada. Oriente o cliente a concluir o pagamento no terminal."];
  $("pointPaymentTitle").textContent = copy[0];
  $("pointPaymentMessage").textContent = copy[1];

  const printActions = $("pointPaymentPrintActions");
  if (status === "approved" && orders.length && !onlineDelivery && !reconciliationRequired) {
    const printFailed = ["failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
    const canRetryPrint = ["local_required", "failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
    const resolutionLabel = payment.metadata?.kind === "point_sale" ? "Reembolsar pagamento" : "Cancelar pedido";
    const canResolve = adminCan(payment.metadata?.kind === "point_sale" ? "orders.refund" : "orders.cancel");
    printActions.hidden = false;
    printActions.innerHTML = `
      <strong>Impressão da venda</strong>
      <p>${pendingPrint ? `A emissão está bloqueada até a impressora confirmar o trabalho. ${tickets.length || orders.reduce((sum, order) => sum + Number(order.printFulfillment?.ticketCount || 0), 0)} ingresso(s) aguardando ativação.` : `${tickets.length} ingresso(s) emitido(s).`}</p>
      <div class="button-row">
        ${pendingPrint ? canRetryPrint ? `<button class="ghost-button" type="button" data-point-print-action="retry" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}">Tentar imprimir novamente</button>` : "" : `<button class="ghost-button" type="button" data-point-print-action="reprint" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}">Imprimir venda novamente</button>`}
        ${pendingPrint && printFailed && canResolve ? `<button class="danger-button" type="button" data-point-print-action="resolve" data-point-print-id="${escapeHtml(payment.id || state.pointPaymentId)}" data-point-resolution="${payment.metadata?.kind === "point_sale" ? "refund" : "cancel"}">${resolutionLabel}</button>` : ""}
        ${pendingPrint ? "" : tickets.map((ticket, index) => `<button class="ghost-button" type="button" data-point-print-action="ticket" data-point-print-id="${escapeHtml(ticket.id)}">Imprimir apenas ${escapeHtml(ticket.movieTitle || ticket.ticketType || `ingresso ${index + 1}`)}</button>`).join("")}
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
    if (result.reconnecting) {
      state.pointPaymentPollAttempts += 1;
      schedulePointPaymentPoll(Math.min(15000, Number(result.retryAfterMs || 3500) + state.pointPaymentPollAttempts * 1000));
      return;
    }
    state.pointPaymentPollAttempts = 0;
    if (result.reconciliationRequired) {
      stopPointPaymentPolling();
      await loadContent({ silent: true });
      renderPointPayment(result);
      showToast("Pagamento exige conciliação administrativa. Não refaça a cobrança.");
      return;
    }
    if (result.payment?.status === "approved") {
      await loadContent({ silent: true });
      renderPointPayment(result);
      if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) schedulePointPaymentPoll(2500);
      else stopPointPaymentPolling();
      showToast("Pagamento aprovado. Finalizando a impressão dos ingressos.");
    } else if (["rejected", "cancelled", "expired", "refunded"].includes(result.payment?.status)) {
      stopPointPaymentPolling();
      localStorage.removeItem("cine_admin_active_point_payment");
      await loadContent({ silent: true });
    } else {
      schedulePointPaymentPoll();
    }
  } catch (error) {
    state.pointPaymentPollAttempts += 1;
    $("pointPaymentMessage").textContent = `${error.message} Tentaremos consultar novamente automaticamente.`;
    schedulePointPaymentPoll(Math.min(15000, 3000 + state.pointPaymentPollAttempts * 1500));
  } finally {
    state.pointPaymentSyncing = false;
    retryButton.disabled = false;
  }
}

function startPointPaymentTracking(result) {
  state.pointPaymentId = result.payment?.id || "";
  state.localPointPrintStatus = "";
  state.pointPaymentPollAttempts = 0;
  if (state.pointPaymentId) localStorage.setItem("cine_admin_active_point_payment", state.pointPaymentId);
  renderPointPayment(result);
  if (result.payment?.status === "approved") {
    void loadContent({ silent: true }).then(() => renderPointPayment(result));
    if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) schedulePointPaymentPoll(2500);
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
    renderPointPayment(result);
    await loadContent({ silent: true });
    if (result.cancellationPending) {
      schedulePointPaymentPoll(1200);
      showToast("Cancelamento solicitado. Aguardando confirmação da Point.");
    } else {
      stopPointPaymentPolling();
      showToast("Cobrança encerrada no Mercado Pago Point.");
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function retryPendingSalePrint(paymentId = state.pointPaymentId) {
  if (!paymentId) return;
  state.localPointPrintStatus = "";
  if (desktopThermalPrinterAvailable()) {
    await requestLocalPointPaymentPrint(paymentId, { manual: true });
    if (state.pointPaymentSnapshot) renderPointPayment(state.pointPaymentSnapshot);
    if (state.concessionCounterPaymentSnapshot) renderConcessionCounterPayment(state.concessionCounterPaymentSnapshot);
    return;
  }
  const snapshot = state.pointPaymentId === paymentId ? state.pointPaymentSnapshot : state.concessionCounterPaymentSnapshot;
  if (snapshot?.payment?.metadata?.kind === "counter_sale") {
    showToast("A impressão desta venda exige o aplicativo desktop com uma impressora térmica padrão configurada.", "error");
    return;
  }
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/retry-print`, {
      method: "POST",
      body: JSON.stringify({ mode: "point" })
    });
    if (state.pointPaymentId === paymentId) {
      renderPointPayment(result);
      schedulePointPaymentPoll(1800);
    }
    if (state.concessionCounterPaymentId === paymentId) {
      renderConcessionCounterPayment(result);
      scheduleConcessionCounterPaymentPoll(1800);
    }
    showToast(result.pointPrint?.status === "queued" ? "Nova tentativa enviada para a Point." : "Prepare a impressora térmica padrão e tente novamente pelo aplicativo do painel.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function resolvePendingSalePrint(paymentId = state.pointPaymentId, action = "refund") {
  if (!paymentId) return;
  const verb = action === "refund" ? "reembolsar o pagamento" : "cancelar o pedido";
  if (!confirm(`A impressão ainda não foi confirmada. Deseja ${verb}? O ingresso não será emitido.`)) return;
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(paymentId)}/resolve-print-failure`, {
      method: "POST",
      body: JSON.stringify({ action, reason: "Falha na impressão do ingresso" })
    });
    stopPointPaymentPolling();
    stopConcessionCounterPaymentPolling();
    localStorage.removeItem("cine_admin_active_point_payment");
    localStorage.removeItem("cine_admin_active_concession_point_payment");
    await loadContent({ silent: true });
    if (state.pointPaymentId === paymentId) renderPointPayment(result);
    if (state.concessionCounterPaymentId === paymentId) renderConcessionCounterPayment(result);
    showToast(result.resolution === "refunded" ? "Pagamento reembolsado. Nenhum ingresso foi emitido." : "Pedido cancelado. Nenhum ingresso foi emitido.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function resetPointPaymentPanel() {
  stopPointPaymentPolling();
  state.pointPaymentId = "";
  state.pointCheckoutKey = "";
  sessionStorage.removeItem("cine_admin_point_checkout_key");
  state.pointPaymentPollAttempts = 0;
  state.localPointPrintStatus = "";
  localStorage.removeItem("cine_admin_active_point_payment");
  state.pointPaymentSnapshot = null;
  $("pointPaymentPanel").hidden = true;
  document.querySelector("#boxOfficeNewSale .box-office-sale-workspace").hidden = false;
  $("manualTicketForm").hidden = false;
  renderManualSaleItems();
  $("manualTicketForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function printPhysicalTicket(ticketId) {
  const url = `${API_BASE}/api/admin/tickets/${encodeURIComponent(ticketId)}/print`;
  if (desktopThermalPrinterAvailable()) {
    window.cineDesktop.printUrl(url, `ticket-${ticketId}`);
    return;
  }
  const popup = window.open(url, "_blank");
  if (popup) popup.opener = null;
  else showToast("O navegador bloqueou a abertura do PDF. Permita pop-ups para imprimir.", "error");
}

function concessionCounterItems() {
  return Object.entries(state.concessionCounterQuantities || {})
    .map(([id, quantity]) => ({ id, quantity: Math.max(0, Math.floor(Number(quantity || 0))) }))
    .filter((item) => item.id && item.quantity > 0);
}

function concessionCounterAvailableUnits(item = {}) {
  const maxPerOrder = Math.max(1, Math.floor(Number(item.maxPerOrder || 8)));
  if (item.stock === "" || item.stock === null || item.stock === undefined) return maxPerOrder;
  const stock = Math.max(0, Number(item.stock || 0));
  const unit = item.stockUnit || "unit";
  const usage = unit === "unit" ? 1 : Math.max(0.001, Number(item.usagePerSale || 1));
  return Math.max(0, Math.min(maxPerOrder, Math.floor(stock / usage)));
}

function concessionCounterProducts() {
  const search = normalizedSearchText(state.concessionCounterSearch);
  return (state.content?.concessions || [])
    .filter((item) => item.active !== false)
    .filter((item) => state.concessionCounterCategory === "all" || item.category === state.concessionCounterCategory)
    .filter((item) => !search || normalizedSearchText([item.name, item.sku, item.category, item.description].join(" ")).includes(search))
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function updateConcessionCounterQuantity(id, value) {
  const product = (state.content?.concessions || []).find((item) => item.id === id && item.active !== false);
  if (!product) return;
  const quantity = Math.max(0, Math.min(concessionCounterAvailableUnits(product), Math.floor(Number(value || 0))));
  if (quantity) state.concessionCounterQuantities[id] = quantity;
  else delete state.concessionCounterQuantities[id];
  renderConcessionCounterSale();
}

function renderConcessionCounterSummary() {
  const target = $("concessionCounterSummary");
  if (!target) return;
  const products = new Map((state.content?.concessions || []).map((item) => [item.id, item]));
  const items = concessionCounterItems().map((item) => ({ ...item, product: products.get(item.id) })).filter((item) => item.product);
  const grossTotal = items.reduce((sum, item) => sum + item.quantity * Number(item.product.price || 0), 0);
  const paymentMethod = document.querySelector("input[name='concessionCounterPaymentMethod']:checked")?.value || "cash";
  const courtesy = paymentMethod === "courtesy";
  const total = courtesy ? 0 : grossTotal;
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  target.innerHTML = `
    <div class="concession-counter-summary-head">
      <div><span>Venda em andamento</span><h2>Resumo do balcão</h2></div>
      <span class="status-pill muted">${quantity} ${quantity === 1 ? "item" : "itens"}</span>
    </div>
    <div class="concession-counter-summary-items">
      ${items.length ? items.map((item) => `<div><span>${item.quantity}× ${escapeHtml(item.product.name)}</span><strong>${money(item.quantity * Number(item.product.price || 0))}</strong></div>`).join("") : `<div class="manual-sale-empty">Os produtos selecionados aparecerão aqui.</div>`}
    </div>
    ${courtesy && items.length ? `<div class="concession-counter-summary-benefit"><span>Valor concedido como cortesia</span><strong>-${money(grossTotal)}</strong></div>` : ""}
    <div class="concession-counter-summary-total"><span>${courtesy ? "Total da cortesia" : "Total calculado"}</span><strong>${money(total)}</strong></div>`;
  const submit = $("concessionCounterSubmitButton");
  if (submit) submit.disabled = items.length === 0;
}

function renderConcessionCounterSale() {
  const target = $("concessionCounterProducts");
  if (!target) return;
  if (!state.content) {
    target.innerHTML = `
      <div class="concession-counter-loading" role="status" aria-live="polite">
        <span class="inline-spinner" aria-hidden="true"></span>
        <span><strong>Carregando produtos</strong><small>Sincronizando cardápio e estoque...</small></span>
      </div>`;
    const pager = $("concessionCounterPager");
    if (pager) pager.innerHTML = "";
    renderConcessionCounterSummary();
    return;
  }
  const products = concessionCounterProducts();
  const productIds = new Set((state.content?.concessions || []).filter((item) => item.active !== false).map((item) => item.id));
  state.concessionCounterQuantities = Object.fromEntries(Object.entries(state.concessionCounterQuantities || {}).filter(([id, quantity]) => productIds.has(id) && Number(quantity) > 0));
  const pageSize = state.concessionCounterPageSize || 8;
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  state.concessionCounterPage = Math.min(Math.max(1, state.concessionCounterPage || 1), totalPages);
  const start = (state.concessionCounterPage - 1) * pageSize;
  const visible = products.slice(start, start + pageSize);
  target.innerHTML = visible.length ? visible.map((item) => {
    const max = concessionCounterAvailableUnits(item);
    const quantity = Math.min(max, Number(state.concessionCounterQuantities[item.id] || 0));
    if (quantity) state.concessionCounterQuantities[item.id] = quantity;
    return `<article class="concession-counter-product ${max === 0 ? "unavailable" : ""}">
      <div class="concession-counter-product-copy">
        ${item.imageUrl ? `<img src="${escapeHtml(adminAssetUrl(item.imageUrl))}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ""}
        <div><strong>${escapeHtml(item.name)}</strong><span>${money(item.price)} · ${escapeHtml(formatConcessionStock(item))}</span></div>
      </div>
      <div class="stepper">
        <button type="button" data-counter-step="-1" data-counter-id="${escapeHtml(item.id)}" aria-label="Remover ${escapeHtml(item.name)}" ${quantity <= 0 ? "disabled" : ""}>-</button>
        <input type="number" min="0" max="${max}" value="${quantity}" data-counter-quantity="${escapeHtml(item.id)}" aria-label="Quantidade de ${escapeHtml(item.name)}" ${max === 0 ? "disabled" : ""} />
        <button type="button" data-counter-step="1" data-counter-id="${escapeHtml(item.id)}" aria-label="Adicionar ${escapeHtml(item.name)}" ${max === 0 || quantity >= max ? "disabled" : ""}>+</button>
      </div>
    </article>`;
  }).join("") : `<div class="empty-state compact"><strong>Nenhum produto encontrado</strong><span>Ajuste a busca ou verifique os produtos ativos no cardápio.</span></div>`;
  target.querySelectorAll("[data-counter-step]").forEach((button) => button.addEventListener("click", () => {
    updateConcessionCounterQuantity(button.dataset.counterId, Number(state.concessionCounterQuantities[button.dataset.counterId] || 0) + Number(button.dataset.counterStep || 0));
  }));
  target.querySelectorAll("[data-counter-quantity]").forEach((input) => input.addEventListener("change", () => updateConcessionCounterQuantity(input.dataset.counterQuantity, input.value)));
  const pager = $("concessionCounterPager");
  if (pager) {
    pager.innerHTML = products.length ? `<span>Exibindo <strong>${start + 1}-${Math.min(start + visible.length, products.length)}</strong> de <strong>${products.length}</strong></span><div class="pager-controls"><button class="ghost-button" type="button" data-counter-page="-1" ${state.concessionCounterPage <= 1 ? "disabled" : ""}>Anterior</button><span>Página ${state.concessionCounterPage} de ${totalPages}</span><button class="ghost-button" type="button" data-counter-page="1" ${state.concessionCounterPage >= totalPages ? "disabled" : ""}>Próxima</button></div>` : "";
    pager.querySelectorAll("[data-counter-page]").forEach((button) => button.addEventListener("click", () => {
      state.concessionCounterPage += Number(button.dataset.counterPage || 0);
      renderConcessionCounterSale();
    }));
  }
  renderConcessionCounterSummary();
}

function printConcessionCounterReceipt(orderId = state.concessionCounterLastOrderId) {
  if (state.concessionCounterPaymentId && state.concessionCounterPaymentSnapshot?.payment?.status === "approved") {
    const pendingPrint = (state.concessionCounterPaymentSnapshot?.orders || []).some((order) => order.status === "paid_pending_print");
    if (pendingPrint) void retryPendingSalePrint(state.concessionCounterPaymentId);
    else requestLocalPointPaymentPrint(state.concessionCounterPaymentId, { manual: true });
    return;
  }
  if (!orderId) return;
  const url = `${API_BASE}/api/admin/concession-sales/${encodeURIComponent(orderId)}/print`;
  if (desktopThermalPrinterAvailable()) {
    window.cineDesktop.printUrl(url, `concession-${orderId}`);
    return;
  }
  const popup = window.open(url, "_blank");
  if (popup) popup.opener = null;
  else showToast("O navegador bloqueou o comprovante. Permita pop-ups para imprimir.", "error");
}

function stopConcessionCounterPaymentPolling() {
  clearTimeout(state.concessionCounterPaymentTimer);
  state.concessionCounterPaymentTimer = null;
}

function renderConcessionCounterPayment(data = {}) {
  const payment = data.payment || state.concessionCounterPaymentSnapshot?.payment || {};
  const orders = data.orders || state.concessionCounterPaymentSnapshot?.orders || [];
  const order = orders[0] || data.order || {};
  const pointPrint = data.pointPrint || state.concessionCounterPaymentSnapshot?.pointPrint || {};
  const status = data.reconnecting ? "reconnecting" : payment.status || "pending";
  const reconciliationRequired = Boolean(data.reconciliationRequired || payment.metadata?.reconciliationRequired);
  const pendingPrint = status === "approved" && orders.some((item) => item.status === "paid_pending_print") && !data.completed;
  const finalStatus = ["rejected", "cancelled", "expired", "refunded"].includes(status) || (status === "approved" && !pendingPrint);
  state.concessionCounterPaymentSnapshot = { ...data, payment, orders, order, pointPrint };
  state.concessionCounterLastOrderId = order.id || state.concessionCounterLastOrderId;
  $("concessionCounterWorkspace").hidden = true;
  const panel = $("concessionCounterPaymentPanel");
  panel.hidden = false;
  panel.dataset.status = status;
  $("concessionCounterPaymentStatus").textContent = pointPaymentStatusLabel(status);
  $("concessionCounterPaymentAmount").textContent = money(payment.amount || order.totalPrice || 0);
  $("concessionCounterPaymentReference").textContent = payment.providerReference || payment.providerPaymentId || "-";
  const needsLocalPrint = ["local_required", "failed"].includes(String(pointPrint.status || ""));
  if (pendingPrint && needsLocalPrint && !["failed", "unavailable"].includes(state.localPointPrintStatus)) requestLocalPointPaymentPrint(payment.id || state.concessionCounterPaymentId);
  if (payment.status === "approved" && data.completed === true) {
    localStorage.removeItem("cine_admin_active_concession_point_payment");
  }
  const copy = reconciliationRequired ? [
    "Conciliação financeira necessária",
    "A Point confirmou um pagamento para um pedido encerrado ou ausente. Os produtos não serão liberados automaticamente. Confira a referência antes de nova cobrança ou reembolso."
  ] : {
    approved: [pendingPrint ? "Pagamento aprovado, aguardando impressão" : "Venda aprovada", pointPrint.status === "printed"
      ? "O pagamento e a impressão foram confirmados pela Point."
      : ["queued", "on_terminal"].includes(pointPrint.status)
        ? pointPrint.message || "O comprovante foi enviado automaticamente para a Point."
        : state.localPointPrintStatus === "printing"
          ? "Pagamento confirmado. Enviando o comprovante à impressora térmica deste computador."
          : pointPrint.message || (pendingPrint ? "A venda só será concluída depois que a impressão for confirmada." : "O pagamento foi confirmado.")],
    rejected: ["Pagamento recusado", "Nenhum produto foi baixado do estoque. Inicie outra venda para tentar novamente."],
    cancelled: ["Cobrança cancelada", "A venda não foi concluída e o estoque foi liberado."],
    expired: ["Tempo de pagamento encerrado", "A cobrança expirou e o estoque foi liberado."],
    refunded: ["Pagamento estornado", "O Mercado Pago informou o estorno desta venda."],
    reconnecting: ["Reconectando à maquininha", payment.metadata?.connectionMessage || "A cobrança permanece vinculada à mesma Order e será consultada novamente sem duplicar o pagamento."]
  }[status] || ["Aguardando pagamento na Point", "Oriente o cliente a concluir o pagamento na maquininha."];
  $("concessionCounterPaymentTitle").textContent = copy[0];
  $("concessionCounterPaymentMessage").textContent = copy[1];
  $("concessionCounterPaymentRetryButton").hidden = status === "approved";
  const printFailed = ["failed", "timed_out"].includes(String(pointPrint.status || "")) || ["failed", "unavailable"].includes(state.localPointPrintStatus);
  $("concessionCounterPaymentCancelButton").hidden = (finalStatus || status === "reconnecting") && !(pendingPrint && printFailed && adminCan(payment.metadata?.kind === "point_sale" ? "orders.refund" : "orders.cancel"));
  $("concessionCounterPaymentCancelButton").textContent = payment.metadata?.kind === "point_sale" ? "Reembolsar pagamento" : "Cancelar pedido";
  $("concessionCounterPrintButton").hidden = reconciliationRequired || status !== "approved" || !state.concessionCounterLastOrderId || (pendingPrint && !["local_required", "failed", "timed_out"].includes(String(pointPrint.status || "")));
  $("concessionCounterPrintButton").textContent = pendingPrint ? "Tentar imprimir novamente" : "Imprimir comprovante novamente";
  $("concessionCounterNewSaleButton").hidden = !finalStatus;
}

function scheduleConcessionCounterPaymentPoll(delay = 2200) {
  stopConcessionCounterPaymentPolling();
  if (!state.concessionCounterPaymentId) return;
  state.concessionCounterPaymentTimer = setTimeout(() => void pollConcessionCounterPayment(), delay);
}

async function pollConcessionCounterPayment({ manual = false } = {}) {
  if (!state.concessionCounterPaymentId || state.concessionCounterPaymentSyncing) return;
  state.concessionCounterPaymentSyncing = true;
  const button = $("concessionCounterPaymentRetryButton");
  if (manual) button.disabled = true;
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.concessionCounterPaymentId)}`);
    renderConcessionCounterPayment(result);
    if (result.reconnecting) {
      scheduleConcessionCounterPaymentPoll(Math.min(15000, Number(result.retryAfterMs || 5000)));
      return;
    }
    if (result.reconciliationRequired) {
      stopConcessionCounterPaymentPolling();
      await loadContent({ silent: true });
      renderConcessionCounterPayment(result);
      showToast("Pagamento exige conciliação administrativa. Não refaça a cobrança.");
      return;
    }
    if (result.payment?.status === "approved") {
      state.concessionCounterQuantities = {};
      await Promise.all([loadContent({ silent: true }), loadConcessionDailySales()]);
      renderConcessionCounterPayment(result);
      if (["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) {
        scheduleConcessionCounterPaymentPoll(2500);
      } else {
        stopConcessionCounterPaymentPolling();
      }
      showToast("Pagamento aprovado. Finalizando a impressão do comprovante.");
    } else if (["rejected", "cancelled", "expired", "refunded"].includes(result.payment?.status)) {
      stopConcessionCounterPaymentPolling();
      localStorage.removeItem("cine_admin_active_concession_point_payment");
      await loadContent({ silent: true });
    } else scheduleConcessionCounterPaymentPoll();
  } catch (error) {
    $("concessionCounterPaymentMessage").textContent = `${error.message} A consulta será repetida automaticamente.`;
    scheduleConcessionCounterPaymentPoll(3500);
  } finally {
    state.concessionCounterPaymentSyncing = false;
    button.disabled = false;
  }
}

async function cancelConcessionCounterPayment() {
  const snapshotPayment = state.concessionCounterPaymentSnapshot?.payment;
  const pendingPrint = snapshotPayment?.status === "approved" && (state.concessionCounterPaymentSnapshot?.orders || []).some((order) => order.status === "paid_pending_print");
  if (pendingPrint) {
    await resolvePendingSalePrint(state.concessionCounterPaymentId, snapshotPayment.metadata?.kind === "point_sale" ? "refund" : "cancel");
    return;
  }
  if (!state.concessionCounterPaymentId || !confirm("Cancelar a cobrança enviada à Point?")) return;
  const button = $("concessionCounterPaymentCancelButton");
  button.disabled = true;
  try {
    const result = await api(`/api/box-office/point-payments/${encodeURIComponent(state.concessionCounterPaymentId)}/cancel`, { method: "POST" });
    renderConcessionCounterPayment(result);
    await loadContent({ silent: true });
    if (result.cancellationPending) {
      scheduleConcessionCounterPaymentPoll(1200);
      showToast("Cancelamento solicitado. Aguardando confirmação da Point.");
    } else {
      stopConcessionCounterPaymentPolling();
      localStorage.removeItem("cine_admin_active_concession_point_payment");
      showToast("Cobrança encerrada no Mercado Pago Point.");
    }
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function resetConcessionCounterSale() {
  stopConcessionCounterPaymentPolling();
  state.concessionCounterPaymentId = "";
  state.concessionCounterPaymentSnapshot = null;
  state.concessionCounterLastOrderId = "";
  state.concessionCounterCheckoutKey = "";
  sessionStorage.removeItem("cine_admin_concession_checkout_key");
  state.localPointPrintStatus = "";
  localStorage.removeItem("cine_admin_active_concession_point_payment");
  state.concessionCounterQuantities = {};
  $("concessionCounterPaymentPanel").hidden = true;
  $("concessionCounterWorkspace").hidden = false;
  renderConcessionCounterSale();
}

async function createConcessionCounterSale(event) {
  event.preventDefault();
  const concessionItems = concessionCounterItems();
  if (!concessionItems.length) {
    showToast("Selecione pelo menos um produto da bomboniere.", "error");
    return;
  }
  const paymentMethod = document.querySelector("input[name='concessionCounterPaymentMethod']:checked")?.value || "cash";
  const pointPayment = ["point_debit", "point_credit", "point_qr"].includes(paymentMethod);
  const popup = null;
  const button = $("concessionCounterSubmitButton");
  try {
    button.disabled = true;
    button.textContent = pointPayment ? "Enviando à Point..." : "Finalizando venda...";
    if (pointPayment) {
      state.concessionCounterCheckoutKey ||= String(sessionStorage.getItem("cine_admin_concession_checkout_key") || "") || crypto.randomUUID();
      sessionStorage.setItem("cine_admin_concession_checkout_key", state.concessionCounterCheckoutKey);
    }
    const result = await api("/api/admin/concession-counter-sales", {
      method: "POST",
      body: JSON.stringify({
        saleMode: "concession_counter",
        paymentMethod,
        concessionItems,
        createdAt: new Date().toISOString(),
        ...(pointPayment ? { clientRequestId: state.concessionCounterCheckoutKey } : {})
      })
    });
    const order = result.orders?.[0] || result.order || {};
    state.concessionCounterLastOrderId = order.id || "";
    if (pointPayment) {
      state.concessionCounterCheckoutKey = "";
      sessionStorage.removeItem("cine_admin_concession_checkout_key");
    }
    if (pointPayment || order.status === "paid_pending_print") {
      state.concessionCounterPaymentId = result.payment?.id || result.payments?.[0]?.id || "";
      state.localPointPrintStatus = "";
      if (state.concessionCounterPaymentId) localStorage.setItem("cine_admin_active_concession_point_payment", state.concessionCounterPaymentId);
      renderConcessionCounterPayment(result);
      const trackedPayment = result.payment || result.payments?.[0];
      if (trackedPayment?.status !== "approved" || ["queued", "on_terminal"].includes(String(result.pointPrint?.status || ""))) scheduleConcessionCounterPaymentPoll(1200);
      else {
        state.concessionCounterQuantities = {};
        await Promise.all([loadContent({ silent: true }), loadConcessionDailySales()]);
      }
      return;
    }
    state.concessionCounterQuantities = {};
    await Promise.all([loadContent({ silent: true }), loadConcessionDailySales(), loadConcessionFinance(), loadDashboard()]);
    if (popup) {
      popup.opener = null;
      popup.location = `${API_BASE}/api/admin/concession-sales/${encodeURIComponent(order.id)}/print`;
    } else showToast("Venda concluída. Permita pop-ups para abrir o comprovante PDV.", "error");
    showSuccess("Venda da bomboniere concluída", "O estoque foi atualizado e o comprovante presencial foi gerado.");
  } catch (error) {
    if (popup) popup.close();
    showToast(error.message, "error");
  } finally {
    button.textContent = "Finalizar e imprimir";
    renderConcessionCounterSale();
  }
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
      ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmConcessionFulfillmentButton" type="button" disabled>${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" data-admin-command="scan-next-ticket">Cancelar e ler outro QR</button></div>`
      : pendingEntryConfirmation
        ? `<div class="scanner-confirmation-actions"><button class="primary-button full" id="confirmTicketEntryButton" type="button">${escapeHtml(template.action)}</button><button class="ghost-button full" type="button" data-admin-command="scan-next-ticket">Cancelar e ler outro QR</button></div>`
      : `<button class="primary-button full" type="button" data-admin-command="scan-next-ticket">${escapeHtml(template.action)}</button>`}
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
