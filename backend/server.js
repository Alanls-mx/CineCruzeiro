if (process.env.CINE_OPERATION_MODE && process.env.CINE_OPERATION_MODE !== "normal") {
  throw new Error("CINE_OPERATION_MODE_INVALID: use backend/start.js para o modo quiescent.");
}

const http = require("http");
const { createWriteStream } = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
const { Readable, Transform } = require("stream");
const { pipeline } = require("stream/promises");
const QRCode = require("qrcode");
const sharp = require("sharp");
const {
  postgresEnabled,
  readDbFromPostgres,
  rememberSnapshot,
  enablePostgresCacheInvalidation,
  postgresDiagnostics,
  closePostgres,
  writeDbToPostgres,
  withPostgresMutationLock,
  outsidePostgresTransaction,
  deferUntilPostgresCommit,
  appendAuditLogToPostgres,
  appendSystemLogToPostgres,
  enqueueCrmWebhookEvent,
  claimNextCrmWebhookEvent,
  updateCrmWebhookEvent,
  summarizeCrmWebhookOutbox,
  requeueDeadCrmWebhookEvents,
  pruneCrmWebhookOutbox,
  listSystemLogsFromPostgres,
  pruneSystemLogsFromPostgres,
  checkPostgresReadiness,
  listActiveSeatHolds: listActiveSeatHoldsFromPostgres,
  acquireSeatHold: acquireSeatHoldInPostgres,
  releaseSeatHold: releaseSeatHoldInPostgres,
  releaseSeatHoldsForOwner: releaseSeatHoldsForOwnerInPostgres
} = require("./db/postgresStore");
const paymentService = require("./services/paymentService");
const pagBankPaymentService = require("./services/pagBankPaymentService");
const { MercadoPagoSubscriptionProvider } = require("./services/subscriptionPaymentProvider");
const integrationConfigService = require("./services/integrationConfigService");
const { phoneDigits, cpfDigits } = require("./services/customerContactValidationService");
const { createDiscordWebhookService } = require("./services/discordWebhookService");
const { readReleaseInfo } = require("./services/releaseInfoService");
const { createRuntimeLifecycle } = require("./services/runtimeLifecycleService");
const { normalizeSnapshotSettings } = require("./services/snapshotSettingsNormalizer");
const { normalizeSnapshotMovies } = require("./services/snapshotMovieNormalizer");
const { createStaticAssetHandler } = require("./services/staticAssetHandler");
const { createDesktopUpdateHandler } = require("./services/desktopUpdateHandler");
const { createPerformanceStreamService } = require("./services/performanceStreamService");
const { createHttpResponseService } = require("./services/httpResponseService");
const { createInfrastructureRoutes } = require("./services/infrastructureRoutes");
const { CRM_EVENT_TYPES, normalizeCrmEvents, sendCrmWebhook, createCrmWebhookWorker } = require("./services/crmWebhookDeliveryService");
const emailService = require("./services/emailService");
const { resolveCampaignContext, validateCampaignTemporalClaims, filterOfferRecipients } = require("./services/emailCampaignEligibilityService");
const { armCampaignCoupon, syncCampaignCouponSchedule, syncScheduledCampaignCoupons } = require("./services/emailCampaignCouponService");
const { archiveExpiredCoupons, couponUsageHistory, couponUsageSummary } = require("./services/couponLifecycleService");
const { resolveCampaignTemplate, normalizeObjective, scopeCampaignContext, validTemplate: validCampaignTemplate } = require("./services/emailCampaignTemplateResolver");
const { buildTemplateLibrary, definitionFor, variantFor, updateLibraryPreference } = require("./services/emailTemplateLibraryService");
const { buildEmailAutomationPlan, emailAutomationContext } = require("./services/emailAutomationService");
const { createEmailAutomationRoutes } = require("./services/emailAutomationRoutes");
const { publicApiError } = require("./services/publicApiErrorService");
const {
  SOCIAL_FORMATS,
  SOCIAL_SIGNATURES,
  SOCIAL_STYLES,
  SOCIAL_TEMPLATES,
  buildSocialReadyPosts,
  captionForDraft,
  createHistoryRecord,
  draftNotices: socialDraftNotices,
  generateSocialCampaign,
  normalizeBrand: normalizeSocialBrand,
  normalizeDraft: normalizeSocialDraft,
  normalizeScene: normalizeSocialScene,
  renderSocialPost,
  renderSocialScene
} = require("./services/socialStudioEngineService");
const { SOCIAL_STUDIO_EDITORIAL_MOVIES } = require("./services/socialStudioEditorialCatalog");
const emailCampaignRepository = require("./services/emailCampaignRepository");
const adMetricRepository = require("./repositories/adMetricRepository");
const { createEmailCampaignWorker } = require("./services/emailCampaignWorker");
const { createTicketEmailWorker } = require("./services/ticketEmailWorker");
const { createTicketEmailJobRepository } = require("./repositories/ticketEmailJobRepository");
const adminTwoFactorService = require("./services/adminTwoFactorService");
const { createStorageService } = require("./services/storageService");
const { createMovieImageService } = require("./services/movieImageService");
const cardTerminalProvider = require("./services/cardTerminalProvider");
const { createPointCreationCoordinator } = require("./services/pointCreationCoordinator");
const { createPointPaymentStateService } = require("./services/pointPaymentStateService");
const { createPointPaymentRecoveryHandler } = require("./services/pointPaymentRecoveryHandler");
const { createPointPaymentCancellationHandler } = require("./services/pointPaymentCancellationHandler");
const { createPointPrintFailureResolutionHandler } = require("./services/pointPrintFailureResolutionHandler");
const { createPointLocalPrintResultHandler } = require("./services/pointLocalPrintResultHandler");
const { createTicketEmailDeliveryCoordinator } = require("./services/ticketEmailDeliveryCoordinator");
const { createTicketDocumentPdfService } = require("./services/ticketDocumentPdfService");
const { createGoogleWalletIntegrationService } = require("./services/googleWalletIntegrationService");
const { createBackendMaintenanceTasks } = require("./services/backendMaintenanceTasks");
const { createFullOrderRefundCoordinator } = require("./services/fullOrderRefundCoordinator");
const { createConcessionRefundCoordinator } = require("./services/concessionRefundCoordinator");
const { createTicketRefundCoordinator } = require("./services/ticketRefundCoordinator");
const { createEmailCampaignPresenter } = require("./services/emailCampaignPresenter");
const { createEmailCampaignInputService } = require("./services/emailCampaignInputService");
const { createEmailCampaignAudienceService } = require("./services/emailCampaignAudienceService");
const { createAdminIntegrationRoutes } = require("./services/adminIntegrationRoutes");
const { createAdminReportRoutes } = require("./services/adminReportRoutes");
const { createAdminPaymentsReadHandler } = require("./services/adminPaymentsReadHandler");
const { createAdminTicketDistributorPresentation } = require("./services/adminTicketDistributorPresentation");
const { createAdminSocialStudioRoutes } = require("./services/adminSocialStudioRoutes");
const { createSocialStudioContextPresenter } = require("./services/socialStudioContextPresenter");
const { createAdminEmailRoutes } = require("./services/adminEmailRoutes");
const { createSeatRealtimeService } = require("./services/seatRealtimeService");
const { clientIp } = require("./services/clientIpService");
const { buildAdminSessionSeatMap } = require("./services/adminSessionSeatMapService");
const { sessionSeatAvailability } = require("./services/sessionSeatAvailability");
const { occupiedSeatIds, createOrderSeatAssignmentService } = require("./services/orderSeatAssignmentService");
const { checkoutIdentifier } = require("./services/checkoutIdentifier");
const { findExistingCheckout, createCheckoutPresentationService } = require("./services/checkoutPresentationService");
const { publicContentSettings } = require("./services/publicContentSettings");
const { openPublicResource, downloadPublicBuffer } = require("./services/publicRemoteResource");
const { allowedOrigins: normalizedAllowedOrigins } = require("./services/originPolicyService");
const { isCommercialCatalogRequest, commercialCatalogToken, catalogTokensMatch, commercialCatalogCorsHeaders } = require("./services/commercialCatalogAccessPolicy");
const clubDomainService = require("./services/clubDomainService");
const { createClubCheckoutBenefitsService } = require("./services/clubCheckoutBenefitsService");
const { createClubOrderCreditService } = require("./services/clubOrderCreditService");
const { ticketSubtotalForOrder, ticketUnitsForOrder, ticketUnitPricesForOrder, allocateDiscountAcrossAmounts, calculateCouponDiscountForAmounts, discountedTicketUnitsForOrder, summarizeClubCreditItems, calculateClubTicketDiscount, assertClubPlanEligibility } = require("./services/checkoutPricingService");
const { ticketTypesForSession, resolveOrderTicketItems } = require("./services/orderTicketSelectionService");
const { createOrderCatalogPricingService } = require("./services/orderCatalogPricingService");
const { summarizeConcessionFinance } = require("./services/concessionFinanceService");
const { createAdminDashboardService } = require("./services/adminDashboardService");
const { createAdminSubscriptionPresenter } = require("./services/adminSubscriptionPresenter");
const { createAdminCustomerSearchService } = require("./services/adminCustomerSearchService");
const { createPublicSessionSeatPresenter } = require("./services/publicSessionSeatPresenter");
const { createSeatMapReadHandler } = require("./services/seatMapReadHandler");
const { createMovieCatalogHandler } = require("./services/movieCatalogHandler");
const { createVenueConfigurationHandler } = require("./services/venueConfigurationHandler");
const { createCommercialCatalogHandler } = require("./services/commercialCatalogHandler");
const { createCommercialCatalogPresenter } = require("./services/commercialCatalogPresenter");
const { createAdminLogsHandler } = require("./services/adminLogsHandler");
const { tmdbMoviePayload } = require("./services/tmdbMovieMapper");
const {
  applyCompletedRefunds,
  isOrderFinanciallySettled,
  paymentFinancialState,
  recognitionDate
} = require("./services/financialRecognitionService");
const { evaluateTicketTransfer, transferLimits, createTicketTransferEligibility } = require("./services/ticketTransferPolicy");
const { PRE_PREMIERE_WINDOW_MS, moviePremiereTiming, shouldPublishUpcomingMovie } = require("./services/moviePublicationPolicy");
const { createMovieWorkflowService } = require("./services/movieWorkflowService");
const { createMovieSessionInputService } = require("./services/movieSessionInputService");
const { createVenueInputService } = require("./services/venueInputService");
const { createCinemaSettingsHandler } = require("./services/cinemaSettingsHandler");
const { createAdminUserWriteHandler } = require("./services/adminUserWriteHandler");
const { createAdminOrderReadRoutes } = require("./services/adminOrderReadRoutes");
const { createCustomerTicketReadRoutes } = require("./services/customerTicketReadRoutes");
const { createClubReadRoutes } = require("./services/clubReadRoutes");
const { createClubSubscriptionSummary } = require("./services/clubSubscriptionSummary");
const { createCommercialReportPeriodService } = require("./services/commercialReportPeriodService");
const { createAdminConcessionSalesReadHandler } = require("./services/adminConcessionSalesReadHandler");
const { createUserAccountModelService } = require("./services/userAccountModelService");
const { createCustomerAccountRoutes } = require("./services/customerAccountRoutes");
const { createCustomerAuthRoutes } = require("./services/customerAuthRoutes");
const { createAdminAccountRoutes } = require("./services/adminAccountRoutes");
const { createAdminSessionRoutes } = require("./services/adminSessionRoutes");
const { createCatalogReadHandler } = require("./services/catalogReadHandler");
const { createPublicContentPresenter } = require("./services/publicContentPresenter");
const { createAdminOverviewHandler } = require("./services/adminOverviewHandler");
const { createAdminCustomerHandler } = require("./services/adminCustomerHandler");
const { createCommercialCatalogInputService } = require("./services/commercialCatalogInputService");
const { createAdminContentPresenter } = require("./services/adminContentPresenter");
const { createTmdbLookupHandler } = require("./services/tmdbLookupHandler");
const { calendarDateKey, isValidCalendarDate, isValidSessionTime } = require("./services/calendarDateService");
const { isDeletedMovie, movieHistory, assertMovieCanBeDeleted, deletedMovieRecord } = require("./services/movieCatalogLifecycleService");
const { findSessionRoomConflicts } = require("./services/sessionRoomConflictService");
const { buildSessionAutocorrectPlan } = require("./services/sessionScheduleAutocorrectService");
const {
  ADMIN_PERMISSION_KEYS,
  adminHasPermission,
  effectiveAdminPermissions,
  expandAdminPermissions,
  roleAlias
} = require("./services/adminPermissionService");
const { calculateTicketDistributorReport, normalizeRules: normalizeTicketDistributorRules } = require("./services/ticketDistributorReportService");
const {
  assignConcessionsToTicket,
  concessionOrdersForTicket,
  orderTicketsSorted,
  pendingConcessionOrdersForTicket
} = require("./services/ticketConcessionAssignmentService");
const { GoodsFiscalService } = require("./services/goodsFiscalService");
const {
  applyMovieTagTransition,
  startMovieTagTransition,
  stopMovieTagTransition
} = require("./utils/movieTagLifecycle");
const { brazilianDate } = require("./utils/dateFormat");
const { requireRuntimeSecret } = require("./services/runtimeSecretService");
const ticketCodeService = require("./services/ticketCodeService");
const { createTicketIssuanceService } = require("./services/ticketIssuanceService");
const { createTicketValidationService } = require("./services/ticketValidationService");
const { toCustomerTicketDto } = require("./services/customerTicketDtoService");
const movieRepository = require("./repositories/movieRepository");
const sessionRepository = require("./repositories/sessionRepository");
const roomRepository = require("./repositories/roomRepository");
const ticketTypeRepository = require("./repositories/ticketTypeRepository");
const promotionRepository = require("./repositories/promotionRepository");
const concessionRepository = require("./repositories/concessionRepository");
const settingsRepository = require("./repositories/settingsRepository");
const { SocialStudioAutomationRepository } = require("./repositories/socialStudioAutomationRepository");
const { CampaignOrchestrator } = require("./services/social-studio/automation/orchestrator");
const userRepository = require("./repositories/userRepository");
const orderRepository = require("./repositories/orderRepository");
const { createPerformanceMonitor } = require("./services/performanceMonitor");
const { prepareRefund, prepareConcessionRefund, prepareTicketRefund, submitFullRefund, submitConcessionRefund, submitPartialRefund, supportedAutomaticRefund, refundError } = require("./services/orderRefundService");
const {
  buildGoogleWalletClassIdentityForCinema,
  buildGoogleWalletClassTemplateInfo,
  buildGoogleWalletTextModules,
  googleWalletTmdbImageUrl,
  normalizeGoogleWalletResourceId,
  resolveGoogleWalletClassId
} = require("./services/googleWalletPassLayoutService");

const requestContext = new AsyncLocalStorage();
const mutationContext = new AsyncLocalStorage();
const discordWebhookService = createDiscordWebhookService({
  logger: (entry) => console.warn(JSON.stringify({ level: "warn", ...entry }))
});
const adminTwoFactorChallenges = new Map();
const memorySeatHolds = new Map();
const paymentReconciliationAttempts = new Map();
const mobileAuthHandoffs = new Map();
let seatRealtimeService = null;
let jsonMutationQueue = Promise.resolve();
let emailCampaignWorker = null;
let ticketEmailWorker = null;
let crmWebhookWorker = null;
let crmWebhookRuntimeConfig = null;
let crmWebhookConfigVersion = 0;

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.BIND_HOST || process.env.HOST || "0.0.0.0";
const LATEST_SCHEMA_MIGRATION = "052_point_payment_methods.sql";
const SUBSCRIPTION_PENDING_PAYMENT_TTL_MS = 15 * 60 * 1000;
const SUBSCRIPTION_MAINTENANCE_INTERVAL_MS = 60 * 1000;
const TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS = 10;
const TICKET_ARCHIVED_DOCUMENT_RETENTION_MS = TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ROOT = __dirname;
const DATA_FILE = process.env.CINE_DATA_FILE ? path.resolve(process.env.CINE_DATA_FILE) : path.join(ROOT, "data", "db.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const TRAILERS_DIR = path.join(PUBLIC_DIR, "trailers");
const FRONTEND_PUBLIC_DIR = path.join(ROOT, "..", "public");
const storageService = createStorageService({
  publicDir: PUBLIC_DIR,
  rootDir: process.env.CINE_UPLOADS_DIR || ""
});
const EMAIL_ATTACHMENT_ROOT = path.resolve(process.env.CINE_EMAIL_ATTACHMENTS_DIR || path.join(ROOT, "data", "email-attachments"));
const TICKET_DOCUMENT_ROOT = path.resolve(process.env.CINE_TICKET_DOCUMENTS_DIR || path.join(ROOT, "data", "ticket-documents"));
let socialStudioAutomationRepository;
let socialStudioAutomationOrchestrator;
function getSocialStudioAutomationRepository() {
  if(!socialStudioAutomationRepository) socialStudioAutomationRepository=new SocialStudioAutomationRepository({
    readJson:readDb,
    mutateJson:callback=>withCriticalMutation(async()=>{const db=await readDb();const result=await callback(db);await writeDb(db);return result;})
  });
  return socialStudioAutomationRepository;
}
function getSocialStudioAutomationOrchestrator() {
  if(!socialStudioAutomationOrchestrator) socialStudioAutomationOrchestrator=new CampaignOrchestrator({
    repository:getSocialStudioAutomationRepository(),
    contextProvider:async()=>socialStudioContext(await readDb()),
    loadImage:loadSocialStudioImage,
    savePreview:async(rendered,{campaignId,variationIndex,formatId})=>{
      const uploaded=await storageService.uploadImageBuffer({buffer:rendered.buffer,filename:`${campaignId}-${variationIndex+1}-${formatId}${rendered.extension}`,contentType:rendered.contentType,folder:'social-studio-automation'});
      return uploaded.url;
    },
    logger:(level,event,metadata)=>logEvent(level,event,metadata)
  });
  return socialStudioAutomationOrchestrator;
}
const EMAIL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const EMAIL_ATTACHMENT_MAX_BYTES = Number(process.env.EMAIL_ATTACHMENT_MAX_BYTES || 5 * 1024 * 1024);
const EMAIL_ATTACHMENT_TOTAL_MAX_BYTES = Number(process.env.EMAIL_ATTACHMENT_TOTAL_MAX_BYTES || 12 * 1024 * 1024);
const movieImageService = createMovieImageService({ storageService });
const goodsFiscalService = new GoodsFiscalService();
const subscriptionPaymentProvider = new MercadoPagoSubscriptionProvider(paymentService);
const PROJECT_ROOT = path.resolve(ROOT, "..");
const MAX_TRAILER_BYTES = Number(process.env.MAX_TRAILER_BYTES || 120 * 1024 * 1024);
const MAX_JSON_BODY_BYTES = Number(process.env.MAX_JSON_BODY_BYTES || 8 * 1024 * 1024);
const ENV_FILES = [
  path.join(ROOT, ".env"),
  path.join(ROOT, ".env.local"),
  path.join(PROJECT_ROOT, ".env"),
  path.join(PROJECT_ROOT, ".env.local")
];
const TMDB_BEARER_ENV_KEYS = ["TMDB_BEARER_TOKEN", "TMDB_ACCESS_TOKEN", "THEMOVIEDB_BEARER_TOKEN"];
const TMDB_API_KEY_ENV_KEYS = ["TMDB_API_KEY", "THEMOVIEDB_API_KEY", "NEXT_PUBLIC_TMDB_API_KEY"];
const JWT_SECRET_ENV_KEYS = ["JWT_SECRET", "ADMIN_JWT_SECRET"];
const GOOGLE_CLIENT_ID_ENV_KEYS = ["GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"];
const GOOGLE_CLIENT_SECRET_ENV_KEYS = ["GOOGLE_CLIENT_SECRET"];
const GOOGLE_REDIRECT_URI_ENV_KEYS = ["GOOGLE_REDIRECT_URI"];
const FRONTEND_URL_ENV_KEYS = ["FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];
const CORS_ORIGIN_ENV_KEYS = ["CORS_ORIGIN", "CORS_ALLOWED_ORIGIN", "FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];
const CRM_WEBHOOK_ENV_KEYS = ["CRM_WEBHOOK_URL", "LUMIX_WEBHOOK_URL"];
const PASSWORD_RESET_EMAIL_WEBHOOK_ENV_KEYS = ["PASSWORD_RESET_EMAIL_WEBHOOK_URL", "PASSWORD_RESET_WEBHOOK_URL", "EMAIL_WEBHOOK_URL"];
const ADMIN_EMAIL_ENV_KEYS = ["ADMIN_EMAIL", "SEED_ADMIN_EMAIL"];
const ADMIN_PASSWORD_ENV_KEYS = ["ADMIN_PASSWORD", "SEED_ADMIN_PASSWORD"];
const GOOGLE_WALLET_ISSUER_ID_ENV_KEYS = ["GOOGLE_WALLET_ISSUER_ID"];
const GOOGLE_WALLET_CLASS_ID_ENV_KEYS = ["GOOGLE_WALLET_CLASS_ID"];
const GOOGLE_WALLET_CLIENT_EMAIL_ENV_KEYS = ["GOOGLE_WALLET_CLIENT_EMAIL"];
const GOOGLE_WALLET_PRIVATE_KEY_ENV_KEYS = ["GOOGLE_WALLET_PRIVATE_KEY"];
const GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_ENV_KEYS = ["GOOGLE_WALLET_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON"];
const GOOGLE_WALLET_ORIGINS_ENV_KEYS = ["GOOGLE_WALLET_ORIGINS", "FRONTEND_URL", "NEXT_PUBLIC_SITE_URL"];

let loadedEnvFiles = [];

function pathIsInside(rootDir, candidatePath) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidatePath));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function configuredAppBasePath() {
  let raw = String(process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_BASE_PATH || process.env.APP_BASE_PATH || "").trim();
  if (!raw) {
    const publicUrl = String(process.env.CINE_PUBLIC_BACKEND_URL || process.env.FRONTEND_URL || "").trim();
    try {
      raw = new URL(publicUrl).pathname;
    } catch {
      raw = "";
    }
  }
  if (!raw || raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

function publicAssetUrl(url) {
  const value = String(url || "");
  const basePath = configuredAppBasePath();
  if (!basePath || !value.startsWith("/uploads/")) return value;
  return `${basePath}${value}`;
}

function storedAssetUrl(url) {
  const value = String(url || "").trim();
  const basePath = configuredAppBasePath();
  if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
  return value;
}

function storedLocalUploadUrl(url) {
  const value = storedAssetUrl(url);
  return value.startsWith("/uploads/") ? value : "";
}

function storedEditorialImageUrl(url) {
  const value = storedAssetUrl(url);
  if (value.startsWith("/uploads/")) return value;
  if (/^\/images\/cinema-editorial\/(cine-estacao-amparo|cinemax-piraju|cine-gama|cinemania-cosmopolis)\/(club-hero|club-banner|events-hero|events-games|events-parties|events-corporate|events-gallery)\.webp$/.test(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "images.unsplash.com" ? value : "";
  } catch {
    return "";
  }
}

function stripPublicAssetBase(pathname) {
  const value = String(pathname || "");
  const basePath = configuredAppBasePath();
  if (basePath && value.startsWith(`${basePath}/uploads/`)) return value.slice(basePath.length);
  return value;
}

function appFrontendUrl() {
  const raw = (getFirstEnv(FRONTEND_URL_ENV_KEYS)?.value || "http://localhost:3000").replace(/\/+$/, "");
  const basePath = configuredAppBasePath();
  if (!basePath || raw.endsWith(basePath)) return raw;
  return `${raw}${basePath}`;
}

function parseEnvLine(line) {
  let trimmed = line.replace(/^\uFEFF/, "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim();

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return { key, value };
}

async function loadEnvFiles() {
  loadedEnvFiles = [];

  for (const file of ENV_FILES) {
    try {
      const raw = await fs.readFile(file, "utf8");
      loadedEnvFiles.push(file);

      raw.split(/\r?\n/).forEach((line) => {
        const parsed = parseEnvLine(line);
        if (parsed && !process.env[parsed.key]) {
          process.env[parsed.key] = parsed.value;
        }
      });
    } catch {
      // Env files are optional for local development.
    }
  }
}

function getFirstEnv(keys) {
  const key = keys.find((name) => process.env[name]);
  return key ? { key, value: process.env[key] } : null;
}

function getTmdbCredentials(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "tmdb") : null;
  if (configured?.bearerToken) {
    return { configured: true, mode: "bearer", token: configured.bearerToken, envKey: configured.updatedBy ? "admin.integrations.tmdb" : "env" };
  }
  if (configured?.apiKey) {
    return { configured: true, mode: "api_key", token: configured.apiKey, envKey: configured.updatedBy ? "admin.integrations.tmdb" : "env" };
  }
  const bearer = getFirstEnv(TMDB_BEARER_ENV_KEYS);
  const apiKey = getFirstEnv(TMDB_API_KEY_ENV_KEYS);

  if (bearer?.value) {
    return { configured: true, mode: "bearer", token: bearer.value, envKey: bearer.key };
  }

  if (apiKey?.value) {
    return { configured: true, mode: "api_key", token: apiKey.value, envKey: apiKey.key };
  }

  return { configured: false, mode: null, token: "", envKey: "" };
}

function getJwtSecret() {
  return requireRuntimeSecret({
    envKeys: JWT_SECRET_ENV_KEYS,
    errorCode: "JWT_SECRET_REQUIRED",
    errorMessage: "Configure JWT_SECRET no ambiente de produção."
  });
}

function getCrmWebhookConfig(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "crm") : null;
  const envUrl = getFirstEnv(CRM_WEBHOOK_ENV_KEYS)?.value || "";
  const envSecret = getFirstEnv(["CRM_WEBHOOK_SECRET", "LUMIX_WEBHOOK_SECRET"])?.value || "";
  const storedEnabled = Boolean(configured?.enabled && configured?.url);
  const url = storedEnabled ? configured.url : envUrl;
  const secret = storedEnabled ? (configured.secret || envSecret) : (envSecret || configured?.secret || "");
  const events = normalizeCrmEvents(configured?.events ?? ["order.created", "payment.approved", "ticket.used"]);
  const timeout = Math.min(30000, Math.max(1000, Number(configured?.timeout) || 8000));
  const retryLimit = Math.min(8, Math.max(0, Number.isInteger(Number(configured?.retryLimit)) ? Number(configured.retryLimit) : 2));
  const enabled = storedEnabled || Boolean(envUrl);
  return { ...(configured || {}), enabled, configured: Boolean(url && secret), url, secret, events, timeout, retryLimit };
}

function configureDiscordWebhook(db) {
  discordWebhookService.setConfig(integrationConfigService.resolvedConfig(db, "discord") || {});
}

function configureCrmWebhookWorker(db) {
  crmWebhookRuntimeConfig = getCrmWebhookConfig(db);
  const version = ++crmWebhookConfigVersion;
  const worker = getCrmWebhookWorker();
  worker.stop();
  if (crmWebhookRuntimeConfig.enabled && crmWebhookRuntimeConfig.configured && crmWebhookRuntimeConfig.events.length) {
    const timer = setTimeout(() => {
      if (version === crmWebhookConfigVersion) worker.start();
    }, 0);
    timer.unref?.();
  }
}

function getPasswordResetEmailWebhookUrl(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "email") : null;
  if (configured?.enabled && configured?.webhookUrl) return configured.webhookUrl;
  return getFirstEnv(PASSWORD_RESET_EMAIL_WEBHOOK_ENV_KEYS)?.value || "";
}

function getEmailVerificationWebhookUrl(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "email") : null;
  if (configured?.enabled && configured?.webhookUrl) return configured.webhookUrl;
  return getFirstEnv(["EMAIL_VERIFICATION_WEBHOOK_URL", "VERIFY_EMAIL_WEBHOOK_URL"])?.value || getPasswordResetEmailWebhookUrl(db);
}

function getGoogleWalletConfig(db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "googleWallet") : null;
  let serviceAccount = {};
  const serviceAccountJson = configured?.serviceAccountJson || getFirstEnv(GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_ENV_KEYS)?.value || "";
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      serviceAccount = {};
    }
  }

  const issuerId = configured?.issuerId || getFirstEnv(GOOGLE_WALLET_ISSUER_ID_ENV_KEYS)?.value || "";
  const configuredClassId = configured?.classId || getFirstEnv(GOOGLE_WALLET_CLASS_ID_ENV_KEYS)?.value || "";
  const resolvedClassId = configured?.resolvedClassId || "";
  const clientEmail = serviceAccount.client_email || configured?.clientEmail || getFirstEnv(GOOGLE_WALLET_CLIENT_EMAIL_ENV_KEYS)?.value || "";
  const privateKey = String(serviceAccount.private_key || configured?.privateKey || getFirstEnv(GOOGLE_WALLET_PRIVATE_KEY_ENV_KEYS)?.value || "").replace(/\\n/g, "\n");
  const origins = normalizeGoogleWalletOrigins(configured?.origins || getFirstEnv(GOOGLE_WALLET_ORIGINS_ENV_KEYS)?.value || appFrontendUrl());

  const canonicalConfiguredClassId = googleWalletResourceId(issuerId, configuredClassId);
  const effectiveClassId = resolveGoogleWalletClassId(issuerId, configuredClassId, resolvedClassId);

  return {
    configured: Boolean(issuerId && configuredClassId && clientEmail && privateKey),
    issuerId,
    classId: effectiveClassId,
    configuredClassId: canonicalConfiguredClassId,
    clientEmail,
    privateKey,
    origins,
    projectId: serviceAccount.project_id || "",
    serviceAccountConfigured: Boolean(serviceAccountJson || (clientEmail && privateKey)),
    environment: configured?.environment || "production"
  };
}

function normalizeGoogleWalletOrigins(value) {
  const candidates = String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  candidates.push(appFrontendUrl(), "https://lumixengine.com", "https://www.lumixengine.com");
  return [...new Set(candidates.map((origin) => {
    try {
      return new URL(origin).origin.replace(/\/+$/, "");
    } catch {
      return origin.replace(/\/+$/, "");
    }
  }).filter(Boolean))];
}

function googleWalletResourceId(issuerId, resourceId) {
  return normalizeGoogleWalletResourceId(issuerId, resourceId);
}

function googleWalletObjectId(config, ticket) {
  const stableId = String(ticket.id || ticket.code || "").replace(/[^A-Za-z0-9._-]/g, "_");
  return googleWalletResourceId(config.issuerId, `ticket_${stableId}`);
}

function getGoogleOAuthConfig(req, db) {
  const configured = db ? integrationConfigService.resolvedConfig(db, "googleLogin") : null;
  const forwardedHost = String(req?.headers["x-forwarded-host"] || "").trim();
  const forwardedProto = String(req?.headers["x-forwarded-proto"] || "http").trim();
  const origin = req
    ? `${forwardedProto || "http"}://${forwardedHost || req.headers.host}`
    : publicBackendUrl();
  return {
    clientId: configured?.clientId || getFirstEnv(GOOGLE_CLIENT_ID_ENV_KEYS)?.value || "",
    clientSecret: configured?.clientSecret || getFirstEnv(GOOGLE_CLIENT_SECRET_ENV_KEYS)?.value || "",
    redirectUri: configured?.redirectUri || getFirstEnv(GOOGLE_REDIRECT_URI_ENV_KEYS)?.value || `${origin}/api/auth/google/callback`,
    frontendUrl: appFrontendUrl()
  };
}

function corsOrigin() {
  return allowedCorsOrigins()[0] || "http://localhost:3000";
}

function allowedCorsOrigins() {
  return normalizedAllowedOrigins(getFirstEnv(CORS_ORIGIN_ENV_KEYS)?.value);
}

function responseCorsOrigin(req) {
  const requestOrigin = String(req?.headers?.origin || "").replace(/\/+$/, "");
  const allowed = allowedCorsOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || "http://localhost:3000";
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function cookieSameSite() {
  if (!isProduction()) return "SameSite=Lax";
  const frontendHost = originHost(allowedCorsOrigins()[0]);
  const backendHost = originHost(publicBackendUrl());
  return frontendHost && backendHost && frontendHost !== backendHost ? "SameSite=None" : "SameSite=Lax";
}

function securityHeaders(extra = {}) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "script-src 'self' https://sdk.mercadopago.com https://http2.mlstatic.com https://assets.pagseguro.com.br https://accounts.google.com https://static.cloudflareinsights.com",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https: wss:${isProduction() ? "" : " ws://localhost:3000 ws://localhost:4000 ws://localhost:4010 ws://127.0.0.1:3000 ws://127.0.0.1:4000 ws://127.0.0.1:4010"}`,
    "frame-src 'self' https://accounts.google.com https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com https://*.mercadolivre.com.br"
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    ...(isProduction() ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
    ...extra
  };
}

function tmdbSetupMessage() {
  return [
    "Configure uma chave do TMDB para usar a busca automatica.",
    `Arquivos lidos: ${ENV_FILES.map((file) => path.relative(PROJECT_ROOT, file)).join(", ")}.`,
    `Nomes aceitos: ${[...TMDB_BEARER_ENV_KEYS, ...TMDB_API_KEY_ENV_KEYS].join(", ")}.`
  ].join(" ");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ini": "text/plain; charset=utf-8",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".dll": "application/octet-stream",
  ".zip": "application/zip"
};

function redactLogValue(value) {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/password|hash|token|secret|authorization|cookie|pixCode|qrCode|qrPayload|qrToken|phone|cellphone|cpf|card|cvv|access/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, redactLogValue(item)];
    })
  );
}

function logEvent(level, event, fields = {}) {
  const store = requestContext.getStore();
  const payload = redactLogValue({
    level,
    event,
    requestId: store?.requestId,
    method: store?.method,
    path: store?.pathname,
    ip: store?.req ? clientIp(store.req) : undefined,
    ...fields,
    timestamp: new Date().toISOString()
  });
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else console.log(line);
  discordWebhookService.enqueue({
    level,
    event,
    requestId: payload.requestId,
    timestamp: payload.timestamp,
    fields: {
      ...(store?.method ? { method: store.method } : {}),
      ...(store?.pathname ? { path: store.pathname } : {}),
      ...fields
    }
  });
  if (postgresEnabled()) {
    const [category = "system"] = String(event || "system").split(".");
    void appendSystemLogToPostgres({
      level,
      category,
      event,
      message: String(fields.message || ""),
      requestId: store?.requestId || "",
      actorUserId: store?.adminUser?.id || store?.customerUser?.id || "",
      actorEmail: store?.adminUser?.email || store?.customerUser?.email || "",
      method: store?.method || "",
      path: store?.pathname || "",
      statusCode: fields.status,
      ip: store?.req ? clientIp(store.req) : "",
      userAgent: store?.req?.headers?.["user-agent"] || "",
      metadata: payload,
      createdAt: payload.timestamp
    }).catch((error) => console.error(JSON.stringify({ level: "error", event: "system_log.persist_failed", message: error.message })));
  }
}

const MERCADO_PAGO_ORDER_ACTIONS = new Set([
  "order.created",
  "order.updated",
  "order.processed",
  "order.action_required",
  "order.cancelled",
  "order.canceled",
  "order.refunded"
]);

const BUSINESS_LOG_EVENTS = new Set([
  "performance.anomaly",
  "performance.recovered",
  "order.refund_pending",
  "order.concession_refund_pending",
  "order.concession_refunded",
  "admin.action",
  "admin_two_factor.setup_started",
  "admin_two_factor.enabled",
  "admin_two_factor.disabled",
  "admin_two_factor.policy_updated",
  "admin_two_factor.recovery_codes_regenerated",
  "payment.created",
  "coupon.order_completed",
  "payment.reconciled",
  "payment.reconciliation_reference_mismatch",
  "payment.reconciliation_amount_mismatch",
  "ticket.used",
  "ticket.transferred",
  "ticket_email.failed",
  "ticket_email.pdf_failed",
  "ticket_transfer_email.failed",
  "ticket_transfer_pdf.failed",
  "box_office_sale.created",
  "box_office_point_sale.created",
  "box_office_point_sale.synced",
  "box_office_point_sale.cancelled",
  "box_office_ticket_print.queued",
  "box_office_ticket_print.failed",
  "webhook.processed",
  "webhook.subscription.processed",
  "webhook.payment.not_found",
  "webhook.subscription.not_found",
  "webhook.mercado_pago.rejected",
  "subscription.pending_payment_expiration_failed",
  "subscription.pending_payment_maintenance_failed",
  "email_verification.delivery_failed",
  "email_verification.delivery_missing_channel",
  "password_reset.delivery_failed",
  "password_reset.delivery_missing_channel",
  "password_reset.delivery_not_configured",
  "google_wallet.integration_failed",
  "deployment.completed",
  "deployment.failed",
  "deployment.rollback_completed",
  "service.outage.detected",
  "service.outage.recovered",
  "service.outage.recovery_failed",
  "service.runtime.started",
  "service.runtime.stopped",
  "logs.retention_applied",
  "logs.retention_failed"
]);

function businessLogVisible(log = {}) {
  return String(log.level || "").toLowerCase() === "error" || BUSINESS_LOG_EVENTS.has(String(log.event || ""));
}

function webhookTesterEnabled() {
  return String(process.env.WEBHOOK_TESTER_ENABLED || "true").toLowerCase() !== "false";
}

// These checks may intentionally wait for slow or unavailable dependencies. Keep their
// progress outside the request lifecycle so they never distort operational latency.
const webhookBatchJobs = new Map();
const mercadoPagoSimulatedOrders = new Map();

function webhookBatchJobSnapshot(job = {}) {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    passed: job.passed,
    failed: job.failed,
    createdAt: job.createdAt,
    startedAt: job.startedAt || "",
    completedAt: job.completedAt || "",
    error: job.error || ""
  };
}

function activeWebhookBatchJob() {
  return [...webhookBatchJobs.values()].find((job) => ["queued", "running"].includes(job.status)) || null;
}

function createWebhookBatchJob() {
  const job = {
    id: `webhook-batch-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    status: "queued",
    total: 8,
    completed: 0,
    passed: 0,
    failed: 0,
    createdAt: new Date().toISOString(),
    startedAt: "",
    completedAt: "",
    error: "",
    runs: []
  };
  webhookBatchJobs.set(job.id, job);
  const completed = [...webhookBatchJobs.values()]
    .filter((item) => ["completed", "failed"].includes(item.status))
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  while (webhookBatchJobs.size > 20 && completed.length) webhookBatchJobs.delete(completed.shift().id);
  return job;
}

function mercadoPagoWebhookAction(body = {}) {
  return String(body.action || body.type || "unknown").trim().toLowerCase() || "unknown";
}

function mercadoPagoWebhookEventId(body = {}, verification = {}) {
  const explicit = String(body.eventId || body.notificationId || "").trim();
  if (explicit) return explicit;
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const revision = String(data.version ?? body.version ?? data.status_detail ?? data.status ?? body.date_created ?? "").trim();
  return ["mercado_pago", mercadoPagoWebhookAction(body), verification.dataId || data.id || "sem-recurso", revision || "sem-revisao"].join(":");
}

function webhookSafeLogContext(req, url, body = {}) {
  return {
    signaturePresent: Boolean(req.headers["x-signature"]),
    requestIdPresent: Boolean(req.headers["x-request-id"]),
    dataIdPresent: Boolean(url.searchParams.get("data.id")),
    action: mercadoPagoWebhookAction(body),
    resourceId: String(url.searchParams.get("data.id") || "").slice(0, 96)
  };
}

function sanitizeWebhookTestPayload(body = {}) {
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const transaction = data.transactions?.payments?.[0] || {};
  return {
    action: body.action || "",
    api_version: body.api_version || "v1",
    type: body.type || "order",
    live_mode: Boolean(body.live_mode),
    date_created: body.date_created || "",
    data: {
      id: data.id || "",
      external_reference: data.external_reference || "",
      status: data.status || "",
      status_detail: data.status_detail || "",
      total_amount: data.total_amount || "",
      version: data.version ?? 1,
      transactions: {
        payments: transaction.id ? [{
          id: transaction.id,
          amount: transaction.amount,
          status: transaction.status,
          status_detail: transaction.status_detail,
          payment_method: {
            id: transaction.payment_method?.id || "",
            type: transaction.payment_method?.type || ""
          }
        }] : []
      }
    }
  };
}

const { sendJson, sendNoContent } = createHttpResponseService({
  publicApiError,
  requestContext,
  postgresEnabled,
  deferUntilPostgresCommit,
  isCommercialCatalogRequest,
  responseCorsOrigin,
  securityHeaders
});

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayIsoDate() {
  const { year, month, day } = datePartsInSaoPaulo();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sessionStartsAt(session = {}, fallbackDate = todayIsoDate()) {
  const date = String(session.date || fallbackDate || todayIsoDate()).slice(0, 10);
  const time = String(session.time || session.timeLabel || "00:00").trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sessionSellableUntil(session = {}, fallbackDate = todayIsoDate()) {
  const startsAt = sessionStartsAt(session, fallbackDate);
  return startsAt ? new Date(startsAt.getTime() + 10 * 60 * 1000) : null;
}

const PRE_PREMIERE_SALES_WINDOW_MS = PRE_PREMIERE_WINDOW_MS;

function sessionSalesOpenAt(session = {}, fallbackDate = todayIsoDate()) {
  const startsAt = sessionStartsAt(session, fallbackDate);
  return startsAt ? new Date(startsAt.getTime() - PRE_PREMIERE_SALES_WINDOW_MS) : null;
}

function normalizedSessionStatus(session = {}) {
  return String(session?.status || "available").trim().toLowerCase();
}

function isSessionSellable(session = {}, fallbackDate = todayIsoDate(), now = new Date()) {
  if (!session || ["sold_out", "cancelled", "hidden", "archived"].includes(normalizedSessionStatus(session))) return false;
  const salesOpenAt = sessionSalesOpenAt(session, fallbackDate);
  if (salesOpenAt && salesOpenAt.getTime() > now.getTime()) return false;
  const sellableUntil = sessionSellableUntil(session, fallbackDate);
  return sellableUntil ? sellableUntil.getTime() > now.getTime() : true;
}

function sellableSessions(movie = {}, now = new Date()) {
  return (movie.sessions || [])
    .filter((session) => isSessionSellable(session, session.date || todayIsoDate(), now))
    .sort((a, b) => (sessionStartsAt(a)?.getTime() || 0) - (sessionStartsAt(b)?.getTime() || 0));
}

function datePartsInSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function saoPauloDateFromOffset(offsetDays = 0) {
  const { year, month, day } = datePartsInSaoPaulo();
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12, 0, 0));
}

function buildCalendarDays(count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const date = saoPauloDateFromOffset(index);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long"
    }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short"
    }).format(date).replace(".", "");
    const dayMonth = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit"
    }).format(date);
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    return {
      isoDate,
      label: index === 0 ? "Hoje" : index === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate: dayMonth
    };
  });
}

function buildCalendarDaysForMovies(movies = [], minimumDays = 7) {
  const baseDays = buildCalendarDays(minimumDays);
  const dates = new Set(baseDays.map((day) => day.isoDate));
  (movies || []).forEach((movie) => {
    (movie.sessions || []).forEach((session) => {
      const date = String(session.date || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayIsoDate()) dates.add(date);
    });
  });
  const today = new Date(`${todayIsoDate()}T12:00:00-03:00`).getTime();
  return [...dates].sort().slice(0, 31).map((isoDate) => {
    const date = new Date(`${isoDate}T12:00:00-03:00`);
    const difference = Math.round((date.getTime() - today) / 86400000);
    const weekdayLong = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(date);
    const weekdayShort = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date).replace(".", "");
    const displayDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);
    return {
      isoDate,
      label: difference === 0 ? "Hoje" : difference === 1 ? "Amanhã" : weekdayShort,
      weekday: weekdayLong,
      displayDate
    };
  });
}

function applyScheduledPremieres(db) {
  let changed = false;
  const now = new Date();
  const today = todayIsoDate();
  db.movies = db.movies.map((movie) => {
    const workflowStatus = movie.workflowStatus || (movie.status === "hidden" ? "archived" : "published");
    if (workflowStatus !== "published") return movie;
    if (shouldPublishUpcomingMovie(movie, today, now)) {
      changed = true;
      const timing = moviePremiereTiming(movie, now);
      const usesAutomatedPremiereTag = ["", "Normal", "Em Breve", "Pré-Estreia", "Estreia"].includes(String(movie.tag || ""));
      const tag = usesAutomatedPremiereTag
        ? (timing?.tag || (movie.tag === "Em Breve" ? "Estreia" : movie.tag))
        : movie.tag;
      const metadata = timing && usesAutomatedPremiereTag
        ? {
            ...startMovieTagTransition(movie.metadata, timing.prePremiereAt, "Pré-Estreia"),
            movieTagSessionId: timing.session.id,
            movieTagSessionStartsAt: timing.startsAt.toISOString()
          }
        : tag === "Estreia"
          ? startMovieTagTransition(movie.metadata, now, "Estreia")
          : movie.metadata;
      return {
        ...movie,
        status: "now_playing",
        tag,
        metadata,
        sessions: movie.sessions || [],
        publishedAt: movie.publishedAt || new Date().toISOString()
      };
    }
    return movie;
  });
  return changed;
}

function applyAutomatedMovieTags(db, now = new Date()) {
  let changed = false;
  db.movies = (db.movies || []).map((movie) => {
    const result = applyMovieTagTransition(movie, now);
    if (result.changed) changed = true;
    return result.movie;
  });
  return changed;
}

async function readBody(req, { rawOnly = false } = {}) {
  const chunks = [];
  let receivedBytes = 0;
  const declaredBytes = Number(req.headers["content-length"] || 0);
  if (declaredBytes > MAX_JSON_BODY_BYTES) {
    const error = new Error("A requisição excede o limite permitido.");
    error.statusCode = 413;
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }
  for await (const chunk of req) {
    receivedBytes += chunk.length;
    if (receivedBytes > MAX_JSON_BODY_BYTES) {
      const error = new Error("A requisição excede o limite permitido.");
      error.statusCode = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  const rawBuffer = Buffer.concat(chunks);
  const raw = rawBuffer.toString("utf8");
  req.rawBodyBuffer = rawBuffer;
  req.rawBody = raw;
  if (rawOnly) return rawBuffer;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("JSON inválido. Revise o corpo da requisição.");
    error.statusCode = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

const rateBuckets = new Map();
let lastRateBucketSweep = 0;
const loginFailures = new Map();
const LOGIN_FAILURE_THRESHOLD = 5;
const LOGIN_BLOCK_BASE_MS = 30 * 1000;
const LOGIN_BLOCK_MAX_MS = 15 * 60 * 1000;
const RATE_BUCKET_MAX_ENTRIES = 50000;
const LOGIN_FAILURE_MAX_ENTRIES = 20000;
const ticketTransferLimits = transferLimits();

const RATE_LIMIT_RULES = [
  { id: "admin-password-change", limit: 6, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/admin/me/password" },
  { id: "admin-profile-photo", limit: 20, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/admin/profile/photo" },
  { id: "studio-automation", limit: 40, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/studio/campaigns/generate" },
  { id: "customer-login", limit: 12, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/auth/login" },
  { id: "admin-login", limit: 12, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/admin/login" },
  { id: "admin-2fa", limit: 6, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/admin/login/2fa" },
  { id: "account-registration", limit: 10, windowMs: 60 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/auth/register" },
  { id: "password-recovery-request", limit: 5, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/auth/password/request" },
  { id: "password-recovery-confirm", limit: 10, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/auth/password/reset" },
  { id: "email-verification", limit: 8, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/me/email-verification/request" },
  { id: "email-change", limit: 5, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/me/email-change/request" },
  { id: "email-verification-minute", limit: 2, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && ["/api/me/email-verification/request", "/api/me/email-change/request"].includes(path) },
  { id: "oauth-start", limit: 30, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "GET" && path === "/api/auth/google/start" },
  { id: "oauth-mobile-consume", limit: 20, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "GET" && path === "/api/auth/mobile/google/consume" },
  { id: "events", limit: 5, windowMs: 60 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/events" },
  { id: "payments", limit: 30, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "POST" && /^\/api\/payments\/(pix|card)$/.test(path) },
  { id: "subscriptions", limit: 10, windowMs: 15 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/subscriptions/subscribe" },
  { id: "coupon-preview", limit: 30, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/coupons/preview" },
  { id: "ticket-transfer", limit: 8, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && /^\/api\/me\/tickets\/[^/]+\/transfer$/.test(path) },
  { id: "ticket-artifacts", limit: 30, windowMs: 5 * 60 * 1000, matches: (method, path) => /^\/api\/me\/tickets\/[^/]+\/(download|google-wallet|qr)$/.test(path) },
  { id: "ticket-validation", limit: 180, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/tickets/validate" },
  { id: "uploads", limit: 20, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && path.startsWith("/api/uploads/") },
  { id: "email-attachments", limit: 20, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/admin/email/attachments" },
  { id: "integration-tests", limit: 10, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && path === "/api/integrations/test" },
  { id: "campaign-generation", limit: 12, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && /\/api\/admin\/email\/campaigns\/(preview|test)$/.test(path) },
  { id: "campaign-dispatch", limit: 10, windowMs: 10 * 60 * 1000, matches: (method, path) => method === "POST" && /\/api\/admin\/email\/campaigns\/[^/]+\/(send|retry-failures)$/.test(path) },
  { id: "ad-metrics", limit: 120, windowMs: 60 * 1000, matches: (method, path) => method === "POST" && /^\/api\/marketing\/ads\/[^/]+\/(impression|click)$/.test(path) },
  { id: "reports", limit: 20, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "GET" && path.startsWith("/api/admin/reports/") },
  { id: "commercial-catalog", limit: 120, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "GET" && path === "/api/commercial/catalog" },
  { id: "external-lookups", limit: 60, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "GET" && /^\/api\/(tmdb|admin\/integrations)/.test(path) },
  { id: "desktop-updates", limit: 30, windowMs: 5 * 60 * 1000, matches: (method, path) => method === "GET" && path.startsWith("/api/desktop/update/") },
  { id: "admin-mutations", limit: 180, windowMs: 60 * 1000, matches: (method, path) => mutatesState(method) && adminAuthRequired(path, method) },
  { id: "customer-mutations", limit: 120, windowMs: 60 * 1000, matches: (method, path) => mutatesState(method) && /^\/api\/(me|subscriptions|coupons)/.test(path) }
];

function consumeRateBucket(key, limit, windowMs, now) {
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > limit ? bucket : null;
}

function rateLimit(req, pathname, method = "GET") {
  if (!pathname.startsWith("/api/") || pathname.startsWith("/api/health") || pathname.startsWith("/api/webhooks/")) return null;
  const now = Date.now();
  if (now - lastRateBucketSweep >= 60 * 1000) {
    for (const [bucketKey, bucketValue] of rateBuckets) {
      if (bucketValue.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    while (rateBuckets.size > RATE_BUCKET_MAX_ENTRIES) rateBuckets.delete(rateBuckets.keys().next().value);
    lastRateBucketSweep = now;
  }

  const ip = clientIp(req);
  const globalRule = { id: "api-global", limit: 900, windowMs: 60 * 1000 };
  const applicableRules = [globalRule, ...RATE_LIMIT_RULES.filter((rule) => rule.matches(method, pathname))];
  for (const rule of applicableRules) {
    const bucket = consumeRateBucket(`${ip}:${rule.id}`, rule.limit, rule.windowMs, now);
    if (!bucket) continue;
    return {
      code: "RATE_LIMITED",
      message: "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      policy: `${rule.limit};w=${Math.ceil(rule.windowMs / 1000)}`,
      category: rule.id
    };
  }
  return null;
}

function loginFailureKey(req, scope, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase().slice(0, 160);
  return `${scope}:${clientIp(req)}:${normalizedEmail || "sem-email"}`;
}

function loginBlockStatus(req, scope, email) {
  const key = loginFailureKey(req, scope, email);
  const record = loginFailures.get(key);
  if (!record) return null;
  if (record.blockedUntil > Date.now()) {
    return { key, retryAfter: Math.max(1, Math.ceil((record.blockedUntil - Date.now()) / 1000)) };
  }
  if (record.lastFailureAt < Date.now() - LOGIN_BLOCK_MAX_MS) loginFailures.delete(key);
  return null;
}

function recordLoginFailure(req, scope, email) {
  const key = loginFailureKey(req, scope, email);
  const now = Date.now();
  const current = loginFailures.get(key) || { failures: 0, blockedUntil: 0, lastFailureAt: now };
  current.failures += 1;
  current.lastFailureAt = now;
  if (current.failures >= LOGIN_FAILURE_THRESHOLD) {
    const exponent = Math.min(5, current.failures - LOGIN_FAILURE_THRESHOLD);
    current.blockedUntil = now + Math.min(LOGIN_BLOCK_MAX_MS, LOGIN_BLOCK_BASE_MS * (2 ** exponent));
  }
  loginFailures.set(key, current);
  if (loginFailures.size > LOGIN_FAILURE_MAX_ENTRIES) {
    const expiry = now - LOGIN_BLOCK_MAX_MS;
    for (const [failureKey, failure] of loginFailures) {
      if (failure.lastFailureAt < expiry || loginFailures.size > LOGIN_FAILURE_MAX_ENTRIES) loginFailures.delete(failureKey);
      if (loginFailures.size <= LOGIN_FAILURE_MAX_ENTRIES) break;
    }
  }
}

function clearLoginFailures(req, scope, email) {
  loginFailures.delete(loginFailureKey(req, scope, email));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function signedValue(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifySignedValue(value) {
  const segments = String(value || "").split(".");
  if (segments.length !== 2) return null;
  const [encoded, signature] = segments;
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function adminCookie(value, maxAge = 60 * 60 * 8) {
  return [
    `cine_admin=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    cookieSameSite(),
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function customerCookie(value, maxAge = 60 * 60 * 24 * 30) {
  return [
    `cine_customer=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    cookieSameSite(),
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function checkoutAccessCookie(req, orderId, maxAge = 2 * 60 * 60) {
  const existing = verifySignedValue(parseCookies(req).cine_checkout);
  const orderIds = Array.isArray(existing?.orderIds)
    ? existing.orderIds.map(String).filter(Boolean).slice(-4)
    : [];
  const normalizedOrderId = String(orderId || "");
  if (normalizedOrderId && !orderIds.includes(normalizedOrderId)) orderIds.push(normalizedOrderId);
  const value = signedValue({ orderIds: orderIds.slice(-5), exp: Date.now() + maxAge * 1000 });
  return [
    `cine_checkout=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    cookieSameSite(),
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function googleOAuthCookie(value, maxAge = 60 * 10) {
  let cookiePath = "/";
  try {
    cookiePath = new URL(appFrontendUrl()).pathname.replace(/\/+$/, "") || "/";
  } catch {
    cookiePath = configuredAppBasePath() || "/";
  }
  return [
    `cine_google_oauth=${encodeURIComponent(value)}`,
    `Path=${cookiePath}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ["Secure"] : [])
  ].join("; ");
}

function mobileGoogleAuthRedirect(state, params = {}) {
  if (state?.mobileApp !== true) return "";
  const redirect = new URL("cinelumix://google-auth");
  const cinemaId = String(state.mobileCinema || "").trim();
  if (/^[a-z0-9-]{1,48}$/.test(cinemaId)) redirect.searchParams.set("cinema", cinemaId);
  Object.entries(params).forEach(([key, value]) => {
    if (value) redirect.searchParams.set(key, String(value));
  });
  return redirect.toString();
}

function googleAuthFailureRedirect(config, state, errorCode) {
  return mobileGoogleAuthRedirect(state, { error: errorCode })
    || `${config.frontendUrl}/conta?authError=${encodeURIComponent(errorCode)}`;
}

function issueMobileAuthHandoff(user, state) {
  const nonce = crypto.randomUUID();
  const expiresAt = Date.now() + 2 * 60 * 1000;
  mobileAuthHandoffs.set(nonce, { userId: user.id, expiresAt });
  for (const [key, handoff] of mobileAuthHandoffs) {
    if (handoff.expiresAt <= Date.now() || mobileAuthHandoffs.size > 500) mobileAuthHandoffs.delete(key);
  }
  return signedValue({
    type: "mobile_google_handoff",
    nonce,
    sub: user.id,
    sv: Number(user.sessionVersion || 0),
    returnTo: state.returnTo || "/conta",
    exp: expiresAt
  });
}

function adminRoles() {
  return new Set(["owner", "master", "manager", "operator", "seller"]);
}

function getAdminUser(req, db) {
  const session = verifySignedValue(parseCookies(req).cine_admin);
  if (!session?.sub) return null;
  const user = (db.users || []).find((item) => item.id === session.sub && item.active !== false);
  if (!user || !adminRoles().has(user.role) || Number(session.sv || 0) !== Number(user.sessionVersion || 0)) return null;
  const normalizedRole = roleAlias(user.role);
  const normalizedUser = normalizedRole === user.role ? user : { ...user, role: normalizedRole };
  return {
    ...normalizedUser,
    effectivePermissions: effectiveAdminPermissions(normalizedUser),
    twoFactorSetupRequired: db.settings?.adminTwoFactorRequired !== false && !normalizedUser.twoFactorEnabled
  };
}

function getCustomerUser(req, db) {
  const session = verifySignedValue(parseCookies(req).cine_customer);
  const userId = session?.sub;
  if (!userId) return null;
  const user = (db.users || []).find((item) => item.id === userId && item.active !== false);
  if (!user || !["customer", ...adminRoles()].includes(user.role) || Number(session.sv || 0) !== Number(user.sessionVersion || 0)) return null;
  const normalizedRole = roleAlias(user.role);
  const normalizedUser = normalizedRole === user.role ? user : { ...user, role: normalizedRole };
  const store = requestContext.getStore();
  if (store) store.customerUser = normalizedUser;
  return normalizedUser;
}

function adminAuthRequired(pathname, method) {
  if (pathname.startsWith("/api/webhooks/")) return false;
  if (pathname.startsWith("/api/studio/")) return false;
  if (pathname.startsWith("/api/email-automation/")) return false;
  if (pathname === "/api/admin/login" || pathname === "/api/admin/login/2fa") return false;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/dashboard")) return true;
  if (pathname.startsWith("/api/uploads/")) return true;
  if (pathname.startsWith("/api/integrations")) return true;
  if (pathname.startsWith("/api/box-office/")) return true;
  if (pathname === "/api/content" && method === "PUT") return true;
  if (pathname === "/api/settings") return true;
  if (/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads|users)(\/|$)/.test(pathname)) return true;
  if (/^\/api\/admin\/(subscription-plans|subscriptions)(\/|$)/.test(pathname)) return true;
  if (/^\/api\/orders(\/|$)/.test(pathname) && (["GET", "PATCH", "DELETE"].includes(method)
    || (method === "POST" && /^\/api\/orders\/[^/]+\/(?:refund-tickets|refund-concessions|resend-ticket-email)$/.test(pathname)))) return true;
  if (pathname === "/api/tickets/manual" || pathname === "/api/tickets/validate") return true;
  return false;
}

function studioAutomationAuthorized(req) {
  const expected=String(process.env.STUDIO_AUTOMATION_TOKEN || process.env.N8N_STUDIO_SHARED_SECRET || '').trim();
  if(!expected)return false;
  const authorization=String(req.headers.authorization || '');
  const supplied=String(authorization.match(/^Bearer\s+(.+)$/i)?.[1] || req.headers['x-studio-automation-token'] || '').trim();
  const left=Buffer.from(expected),right=Buffer.from(supplied);
  return left.length===right.length && left.length>0 && crypto.timingSafeEqual(left,right);
}

function emailAutomationAuthorized(req) {
  const expected = String(process.env.EMAIL_AUTOMATION_TOKEN || process.env.N8N_EMAIL_SHARED_SECRET || "").trim();
  if (!expected) return false;
  const authorization = String(req.headers.authorization || "");
  const supplied = String(authorization.match(/^Bearer\s+(.+)$/i)?.[1] || req.headers["x-email-automation-token"] || "").trim();
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function mutatesState(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function repositoryMutationRoute(pathname, method) {
  if (!mutatesState(method)) return false;
  return pathname === "/api/movies/order"
    || /^\/api\/movies(?:\/[^/]+(?:\/sessions(?:\/[^/]+)?)?)?$/.test(pathname)
    || /^\/api\/rooms(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/ticket-types(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/promotions(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/concessions(?:\/[^/]+)?$/.test(pathname)
    || pathname === "/api/settings"
    || pathname === "/api/admin/security-policy"
    || pathname === "/api/admin/goods-fiscal-settings"
    || /^\/api\/admin\/email\/(branding|attachments)$/.test(pathname)
    || /^\/api\/admin\/email\/template-library\/[^/]+$/.test(pathname)
    || /^\/api\/admin\/email\/campaigns(?:\/.*)?$/.test(pathname)
    || /^\/api\/admin\/social-studio\/(copy|resolve|preview|preview-scene|variations|uploads)$/.test(pathname)
    || /^\/api\/admin\/integrations\/[^/]+(?:\/(test|enable|disable))?$/.test(pathname)
    || /^\/api\/admin\/integrations\/mercadoPago\/webhook-simulations(?:\/batch|\/[^/]+\/resend)?$/.test(pathname)
    || /^\/api\/users(?:\/[^/]+)?$/.test(pathname)
    || (/^\/api\/orders\/[^/]+$/.test(pathname) && method === "PATCH")
    || pathname === "/api/admin/logout"
    || pathname === "/api/admin/me"
    || pathname === "/api/admin/me/password"
    || pathname === "/api/admin/profile/photo"
    || pathname.startsWith("/api/admin/2fa/");
}

function originHost(value) {
  try {
    return value ? new URL(value).host : "";
  } catch {
    return "";
  }
}

function adminOriginAllowed(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;

  const requestHost = String(req.headers.host || "").split(",")[0].trim();
  const origin = originHost(req.headers.origin);
  const referer = originHost(req.headers.referer);
  const allowedHosts = new Set([
    requestHost,
    ...allowedCorsOrigins().map(originHost),
    originHost(publicBackendUrl())
  ].filter(Boolean));

  if (origin) return allowedHosts.has(origin);
  if (referer) return allowedHosts.has(referer);
  return !isProduction();
}

function customerMutationOriginAllowed(req) {
  if (!mutatesState(req.method || "GET")) return true;
  if (parseCookies(req).cine_customer) return adminOriginAllowed(req);
  const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  const browserAuthMutation = [
    "/api/auth/register", "/api/auth/login", "/api/auth/password/request", "/api/auth/password/reset",
    "/api/admin/login", "/api/admin/login/2fa"
  ].includes(pathname);
  const browserHeaders = req.headers.origin || req.headers.referer || req.headers["sec-fetch-site"];
  return !browserAuthMutation || !browserHeaders || adminOriginAllowed(req);
}

function requiredAdminRoles(pathname, method) {
  if (pathname === "/api/admin/concession-counter-sales" && method === "POST") return ["owner", "manager", "operator"];
  if (/^\/api\/admin\/concession-sales\/[^/]+\/print$/.test(pathname) && method === "GET") return ["owner", "manager", "operator"];
  if (pathname.startsWith("/api/admin/concession-sales")) return ["owner", "manager"];
  if (pathname === "/api/admin/content") return ["owner", "manager", "operator"];
  if (pathname === "/api/admin/dashboard") return ["owner", "manager", "operator"];
  if (pathname.startsWith("/api/admin/logs")) return method === "DELETE" ? ["owner"] : ["owner", "manager"];
  if (pathname.startsWith("/api/admin/integrations")) return ["owner"];
  if (pathname.startsWith("/api/admin/email")) return ["owner", "manager"];
  if (pathname.startsWith("/api/admin/reports")) return ["owner", "manager"];
  if (pathname.startsWith("/api/admin/payments")) return ["owner", "manager"];
  if (/^\/api\/orders\/[^/]+\/permanent$/.test(pathname)) return ["owner", "master"];
  if (pathname.startsWith("/api/dashboard")) return ["owner", "manager", "operator"];
  if (pathname.startsWith("/api/uploads/")) return ["owner", "manager"];
  if (pathname.startsWith("/api/integrations")) return ["owner"];
  if (/^\/api\/admin\/(subscription-plans|subscriptions)(\/|$)/.test(pathname)) return ["owner", "manager"];
  if (pathname.startsWith("/api/box-office/")) return ["owner", "manager", "operator"];
  if (pathname === "/api/content" && method === "PUT") return ["owner"];
  if (pathname === "/api/settings") return ["owner"];
  if (/^\/api\/users(\/|$)/.test(pathname)) return ["owner"];
  if (/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads)(\/|$)/.test(pathname)) return ["owner", "manager"];
  if (/^\/api\/orders(\/|$)/.test(pathname) && method === "GET") return ["owner", "manager", "operator"];
  if (/^\/api\/orders\/[^/]+$/.test(pathname) && ["PATCH", "DELETE"].includes(method)) return ["owner", "manager"];
  if (pathname === "/api/tickets/manual" || pathname === "/api/tickets/validate") return ["owner", "manager", "operator"];
  return ["owner", "manager", "operator"];
}

function requiredAdminPermission(pathname, method) {
  if (pathname === "/api/admin/concession-counter-sales") return "concessions.sell";
  if (/^\/api\/admin\/concession-sales\/[^/]+\/refund$/.test(pathname)) return "concessions.refund";
  if (/^\/api\/admin\/concession-sales\/[^/]+$/.test(pathname) && method === "DELETE") return "concessions.delete";
  if (pathname.startsWith("/api/admin/concession-sales")) return method === "GET" ? "concessions.view" : "concessions.edit";
  if (pathname.startsWith("/api/admin/social-studio")) {
    if (method === "DELETE") return "social_studio.delete";
    return method === "GET" ? "social_studio.view" : "social_studio.create";
  }
  if (pathname.startsWith("/api/admin/marketing")) return method === "GET" ? "marketing.view" : "marketing.manage";
  if (/^\/api\/admin\/(tickets|orders)\/[^/]+\/print$/.test(pathname)) return "orders.print";
  if (["/api/admin/me", "/api/admin/me/password", "/api/admin/profile/photo", "/api/admin/logout"].includes(pathname) || pathname.startsWith("/api/admin/2fa/")) return "";
  if (pathname === "/api/admin/security-policy") return method === "GET" ? "settings.view" : "settings.manage";
  if (pathname === "/api/admin/content") return "";
  if (pathname === "/api/admin/sessions/autocorrect") return "sessions.autocorrect";
  if (/^\/api\/admin\/sessions\/[^/]+\/seat-map$/.test(pathname)) return "rooms.view";
  if (pathname.startsWith("/api/admin/logs")) return method === "DELETE" ? "logs.delete" : "logs.view";
  if (pathname.startsWith("/api/admin/integrations") || pathname.startsWith("/api/integrations")) return method === "GET" ? "integrations.view" : "integrations.manage";
  if (pathname.startsWith("/api/admin/email") || /^\/api\/(promotions|ads)(\/|$)/.test(pathname)) return method === "GET" ? "marketing.view" : "marketing.manage";
  if (/^\/api\/admin\/reports\/ticket-distributor\.(csv|pdf)$/.test(pathname)) return "ticket_finance.export";
  if (pathname.startsWith("/api/admin/reports/ticket-distributor/settings")) return "ticket_finance.configure";
  if (pathname.startsWith("/api/admin/reports/ticket-distributor")) return "ticket_finance.view";
  if (pathname.startsWith("/api/admin/reports")) return "dashboard.view";
  if (pathname.startsWith("/api/admin/payments")) return "payments.view";
  if (pathname.startsWith("/api/dashboard") || pathname === "/api/admin/dashboard") return "dashboard.view";
  if (/^\/api\/admin\/subscriptions\/[^/]+\/credits/.test(pathname)) return "club.credits";
  if (/^\/api\/admin\/(subscription-plans|subscriptions)(\/|$)/.test(pathname)) return method === "GET" ? "club.view" : "club.manage";
  if (/^\/api\/box-office\/point-payments\/[^/]+\/resolve-print-failure$/.test(pathname)) return "box_office.sell";
  if (pathname.startsWith("/api/box-office/") || pathname === "/api/tickets/manual") return "box_office.sell";
  if (pathname === "/api/tickets/validate") return "tickets.validate";
  if (pathname.startsWith("/api/uploads/")) return "media.manage";
  if (pathname === "/api/content" && method === "PUT" || pathname === "/api/settings" && method !== "GET") return "settings.manage";
  if (pathname === "/api/settings") return "settings.view";
  if (/^\/api\/movies\/[^/]+\/sessions/.test(pathname)) return "sessions.manage";
  if (pathname === "/api/movies/order") return "movies.edit";
  if (/^\/api\/movies(\/|$)/.test(pathname)) return method === "GET" ? "movies.view" : method === "POST" ? "movies.create" : method === "DELETE" ? "movies.delete" : "movies.edit";
  if (/^\/api\/rooms(\/|$)/.test(pathname)) return method === "GET" ? "rooms.view" : method === "POST" ? "rooms.create" : method === "DELETE" ? "rooms.delete" : "rooms.edit";
  if (/^\/api\/ticket-types(\/|$)/.test(pathname)) return method === "GET" ? "ticket_types.view" : method === "POST" ? "ticket_types.create" : method === "DELETE" ? "ticket_types.delete" : "ticket_types.edit";
  if (/^\/api\/concessions(\/|$)/.test(pathname)) return method === "GET" ? "concessions.view" : method === "POST" ? "concessions.edit" : method === "DELETE" ? "concessions.delete" : "concessions.edit";
  if (/^\/api\/orders\/[^/]+\/refund-(tickets|concessions)$/.test(pathname)) return "orders.refund";
  if (/^\/api\/orders\/[^/]+\/resend-ticket-email$/.test(pathname)) return "orders.resend";
  if (/^\/api\/orders\/[^/]+\/permanent$/.test(pathname)) return "orders.delete";
  if (/^\/api\/orders(\/|$)/.test(pathname)) return method === "GET" || method === "PATCH" ? "orders.view" : method === "DELETE" ? "orders.delete" : "orders.edit";
  if (/^\/api\/users(\/|$)/.test(pathname)) return "users.manage";
  return "dashboard.view";
}

function ensureAdmin(req, res, db, pathname, method, allowedRoles = null) {
  if (!adminAuthRequired(pathname, method)) return true;
  const user = getAdminUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para continuar." } });
    return false;
  }
  const setupAllowed = pathname === "/api/admin/me" || pathname === "/api/admin/logout" || pathname.startsWith("/api/admin/2fa/");
  if (user.twoFactorSetupRequired && !setupAllowed) {
    sendJson(res, 428, { error: { code: "ADMIN_2FA_SETUP_REQUIRED", message: "Configure a autenticação em duas etapas para continuar no painel." } });
    return false;
  }
  const permitted = Array.isArray(allowedRoles)
    ? allowedRoles.includes(user.role)
    : !requiredAdminPermission(pathname, method) || adminHasPermission(user, requiredAdminPermission(pathname, method));
  if (!permitted) {
    sendJson(res, 403, { error: { code: "ADMIN_FORBIDDEN", message: "Seu usuario nao tem permissao para esta acao." } });
    return false;
  }
  if (mutatesState(method) && !adminOriginAllowed(req)) {
    sendJson(res, 403, { error: { code: "ADMIN_CSRF_BLOCKED", message: "Origem da requisicao administrativa nao autorizada." } });
    return false;
  }
  req.adminUser = user;
  const store = requestContext.getStore();
  if (store) {
    store.adminUser = user;
    if (!req.repositoryMutation) store.beforeDb ||= structuredCloneSafe(db);
  }
  return true;
}

function ensureAdminAction(req, res, permission, message = "Seu usuario nao tem permissao para esta acao.") {
  if (adminHasPermission(req.adminUser, permission)) return true;
  sendJson(res, 403, { error: { code: "ADMIN_FORBIDDEN", message } });
  return false;
}

function repositoryAudit(req, entityType, entityId, before, after) {
  return {
    userId: req.adminUser?.id || "",
    action: `${req.method} ${new URL(req.url, `http://${req.headers.host}`).pathname}`,
    entityType,
    entityId: entityId || "",
    before: sanitizeAuditValue(before),
    after: sanitizeAuditValue(after),
    ip: clientIp(req)
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function auditCollectionForPath(pathname) {
  const match = pathname.match(/^\/api\/(movies|rooms|ticket-types|concessions|promotions|ads|users)(?:\/([^/]+))?/);
  if (match) {
    return {
      entityType: match[1].replace("ticket-types", "ticket_type"),
      collection: match[1] === "ticket-types" ? "ticketTypes" : match[1],
      entityId: match[2] ? decodeURIComponent(match[2]) : ""
    };
  }
  if (pathname === "/api/settings") return { entityType: "settings", collection: "settings", entityId: "app" };
  if (pathname === "/api/content") return { entityType: "content", collection: "movies", entityId: "bulk" };
  if (/^\/api\/orders(?:\/([^/]+))?/.test(pathname)) {
    const match = pathname.match(/^\/api\/orders(?:\/([^/]+))?/);
    return { entityType: "order", collection: "orders", entityId: match?.[1] ? decodeURIComponent(match[1]) : "" };
  }
  if (pathname === "/api/box-office/sales") return { entityType: "box_office_sale", collection: "orders", entityId: "" };
  if (pathname === "/api/admin/concession-counter-sales") return { entityType: "concession_counter_sale", collection: "orders", entityId: "" };
  if (pathname === "/api/tickets/manual") return { entityType: "manual_sale", collection: "orders", entityId: "" };
  if (pathname === "/api/tickets/validate") return { entityType: "ticket_validation", collection: "tickets", entityId: "" };
  return { entityType: "admin_action", collection: "", entityId: "" };
}

function sanitizeAuditValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/password|hash|token|secret|pixCode|qrCode|raw|authorization/i.test(key)) return [key, "[redacted]"];
      return [key, sanitizeAuditValue(item)];
    })
  );
}

function auditValueForCollection(db, collection) {
  if (!collection) return null;
  return sanitizeAuditValue(db?.[collection]);
}

function appendAuditLog(db) {
  const store = requestContext.getStore();
  if (!store?.adminUser || !store.beforeDb || store.auditInProgress) return;
  const { entityType, collection, entityId } = auditCollectionForPath(store.pathname);
  db.auditLogs ||= [];
  store.auditInProgress = true;
  db.auditLogs.push({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: store.adminUser.id,
    userEmail: store.adminUser.email,
    action: `${store.method} ${store.pathname}`,
    entityType,
    entityId,
    before: auditValueForCollection(store.beforeDb, collection),
    after: auditValueForCollection(db, collection),
    ip: clientIp(store.req),
    createdAt: new Date().toISOString()
  });
  logEvent("info", "admin.action", {
    entityType,
    entityId,
    actorUserId: store.adminUser.id,
    actorEmail: store.adminUser.email
  });
  store.beforeDb = structuredCloneSafe(db);
  store.auditInProgress = false;
}

function normalizeDb(db) {
  normalizeSnapshotSettings(db, {
    cinemaName: "Cine Cruzeiro",
    announcementText: "Promoção permanente no Cine Cruzeiro - Ingressos a apenas R$ 10,00",
    normalizeTicketDistributorRules,
    storedEditorialImageUrl
  });
  normalizeSnapshotMovies(db, { slugify });
  db.orders ||= [];
  db.payments ||= [];
  db.subscriptionPlans ||= db.settings.subscriptionPlans || [];
  db.subscriptions ||= db.settings.subscriptions || [];
  db.subscriptionCredits ||= db.settings.subscriptionCredits || [];
  db.subscriptionUsage ||= db.settings.subscriptionUsage || [];
  db.subscriptionCycles ||= [];
  db.subscriptionPayments ||= [];
  db.subscriptionCreditUnits ||= [];
  db.subscriptionCreditRedemptions ||= [];
  db.subscriptionAccountingRules ||= [];
  db.orderServiceItems ||= [];
  db.orderGoodsItems ||= [];
  db.goodsFiscalDocuments ||= [];
  clubDomainService.releaseExpiredReservations(db);
  db.subscriptionPlans = (db.subscriptionPlans || []).map((plan, index) => ({
    ...plan,
    imageUrl: storedLocalUploadUrl(plan.imageUrl || plan.heroImageUrl || ""),
    isFeatured: Boolean(plan.isFeatured || plan.featured),
    displayOrder: Number(plan.displayOrder ?? plan.sortOrder ?? index + 1)
  })).sort((a, b) => Number(a.displayOrder || 100) - Number(b.displayOrder || 100));
  db.webhookEvents ||= [];
  db.integrations ||= db.settings.integrations || {};
  delete db.integrations.gemini;
  delete db.settings.emailAiPromptTemplates;
  db.settings.integrations = db.integrations;
  db.settings.mercadoPagoSubscriptionPlans ||= db.settings.mercadoPagoSubscriptionPlans || {};
  db.emailCampaigns ||= postgresEnabled() ? [] : (db.settings.emailCampaigns || []);
  if (!postgresEnabled()) db.settings.emailCampaigns = db.emailCampaigns;
  db.auditLogs ||= [];
  db.tickets ||= [];
  db.concessions ||= [
    {
      id: "combo-classico",
      name: "Combo Classico",
      description: "Pipoca media + refrigerante",
      price: 25,
      compareAt: 30,
      category: "combo",
      imageUrl: "",
      badge: "Mais pedido",
      stock: 80,
      maxPerOrder: 6,
      featured: true,
      sortOrder: 1,
      tags: ["pipoca", "bebida"],
      comboItems: [
        { name: "Pipoca media", quantity: 1 },
        { name: "Refrigerante", quantity: 1 }
      ],
      active: true
    },
    {
      id: "pipoca-grande",
      name: "Pipoca Grande",
      description: "Pipoca quentinha na manteiga",
      price: 18,
      category: "pipoca",
      imageUrl: "",
      badge: "",
      stock: 100,
      maxPerOrder: 8,
      featured: false,
      sortOrder: 2,
      tags: ["pipoca"],
      comboItems: [],
      active: true
    },
    {
      id: "refrigerante",
      name: "Refrigerante",
      description: "Bebida gelada 500ml",
      price: 9,
      category: "bebida",
      imageUrl: "",
      badge: "",
      stock: 120,
      maxPerOrder: 10,
      featured: false,
      sortOrder: 3,
      tags: ["bebida"],
      comboItems: [],
      active: true
    }
  ];
  db.concessions = db.concessions
    .map((item) => normalizeConcession(item, item))
    .sort((a, b) => Number(a.sortOrder || 100) - Number(b.sortOrder || 100));
  db.promotions ||= [
    {
      id: "promocao-permanente",
      title: "Ingresso Promocional Permanente",
      description: "Todos os ingressos a R$ 10,00",
      discountType: "fixed_price",
      value: 10,
      couponCode: "",
      active: true
    }
  ];
  db.ads ||= [
    {
      id: "banner-site-pix",
      title: "Compre pelo site e pague no Pix",
      placement: "movie",
      imageUrl: "",
      linkUrl: "",
      active: true
    }
  ];
  db.ads = db.ads
    .filter((item) => item.id !== "banner-whatsapp-pix" && !/whatsapp/i.test(`${item.title || ""} ${item.description || ""}`))
    .map((item) => normalizeAd(item, item, { preserveTimestamp: true }));
  db.users ||= [
    {
      id: "admin",
      name: "Administrador",
      email: "admin@cinecruzeiro.local",
      role: "owner",
      active: true,
      createdAt: new Date().toISOString()
    }
  ];
  const configuredAdminEmail = getFirstEnv(ADMIN_EMAIL_ENV_KEYS)?.value || "admin@cinecruzeiro.local";
  const configuredAdminPassword = getFirstEnv(ADMIN_PASSWORD_ENV_KEYS)?.value || (isProduction() ? "" : "cine-cruzeiro-dev-admin");
  const adminUser = db.users.find((user) => user.email === configuredAdminEmail) || db.users.find((user) => user.role === "owner");
  if (adminUser && configuredAdminPassword && !adminUser.passwordHash) {
    adminUser.email = configuredAdminEmail;
    adminUser.role = "owner";
    adminUser.passwordHash = hashPassword(configuredAdminPassword);
    adminUser.authProvider = adminUser.authProvider || "email";
  }
  return db;
}

async function readDb(options = {}) {
  if (isProduction() && !postgresEnabled()) {
    throw Object.assign(new Error("PostgreSQL deve estar configurado em producao."), {
      code: "POSTGRES_REQUIRED_IN_PRODUCTION",
      statusCode: 500
    });
  }
  const db = postgresEnabled()
    ? await readDbFromPostgres({ includeAuditLogs: false, ...options, trackChanges: false })
    : JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const normalized = normalizeDb(db);
  if (postgresEnabled() && options.trackChanges !== false) rememberSnapshot(normalized);
  return normalized;
}

async function writeDb(db) {
  appendAuditLog(db);
  if (postgresEnabled()) {
    await writeDbToPostgres(normalizeDb(db), { normalize: normalizeDb });
    return;
  }
  const tempFile = `${DATA_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(tempFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(tempFile, DATA_FILE);
        break;
      } catch (error) {
        if (process.platform !== "win32" || !["EPERM", "EBUSY"].includes(error.code) || attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
  } finally {
    await fs.unlink(tempFile).catch(() => null);
  }
}

async function withCriticalMutation(callback) {
  if (postgresEnabled()) {
    return withPostgresMutationLock(callback);
  }
  if (mutationContext.getStore()?.active) return callback();
  const previous = jsonMutationQueue;
  let release;
  jsonMutationQueue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await mutationContext.run({ active: true }, callback);
  } finally {
    release();
  }
}

const releaseInfo = readReleaseInfo();
const runtimeLifecycle = createRuntimeLifecycle({
  statePath: isProduction() ? path.resolve(PROJECT_ROOT, "../..", "shared", "runtime-state.json") : "",
  onEvent: logEvent
});

function createCrmOutboxRepository() {
  async function mutateJson(mutator) {
    return withCriticalMutation(async () => {
      const db = await readDb();
      db.crmWebhookOutbox ||= [];
      const result = await mutator(db.crmWebhookOutbox);
      await writeDb(db);
      return result;
    });
  }

  return {
    async enqueue(event) {
      if (postgresEnabled()) return enqueueCrmWebhookEvent(event);
      return mutateJson((items) => {
        if (items.filter((item) => ["queued", "processing"].includes(item.status)).length >= 10000) {
          throw Object.assign(new Error("A fila persistente do CRM atingiu o limite temporário."), { code: "CRM_OUTBOX_FULL", statusCode: 503 });
        }
        if (items.some((item) => item.id === event.id)) return event.id;
        items.push({ ...event, status: "queued", attempts: 0, nextAttemptAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return event.id;
      });
    },
    async claimNext() {
      if (postgresEnabled()) return claimNextCrmWebhookEvent();
      return mutateJson((items) => {
        const now = Date.now();
        const item = items.filter((entry) => (entry.status === "queued" && new Date(entry.nextAttemptAt).getTime() <= now)
          || (entry.status === "processing" && now - new Date(entry.lockedAt || 0).getTime() > 120000))
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
        if (!item) return null;
        item.status = "processing";
        item.attempts = Number(item.attempts || 0) + 1;
        item.lockedAt = new Date(now).toISOString();
        item.updatedAt = item.lockedAt;
        return structuredCloneSafe(item);
      });
    },
    async deliver(id, httpStatus) {
      if (postgresEnabled()) return updateCrmWebhookEvent(id, { status: "delivered", httpStatus });
      return mutateJson((items) => {
        const item = items.find((entry) => entry.id === id);
        if (!item) return false;
        Object.assign(item, { status: "delivered", httpStatus, deliveredAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lockedAt: "" });
        return true;
      });
    },
    async fail(id, failure) {
      if (postgresEnabled()) return updateCrmWebhookEvent(id, failure);
      return mutateJson((items) => {
        const item = items.find((entry) => entry.id === id);
        if (!item) return false;
        Object.assign(item, { status: failure.status, httpStatus: failure.httpStatus, errorCode: failure.errorCode, nextAttemptAt: failure.nextAttemptAt || "", updatedAt: new Date().toISOString(), lockedAt: "" });
        return true;
      });
    },
    async cancel(id, reason) {
      if (postgresEnabled()) return updateCrmWebhookEvent(id, { status: "cancelled", errorCode: reason });
      return mutateJson((items) => {
        const item = items.find((entry) => entry.id === id);
        if (!item) return false;
        Object.assign(item, { status: "cancelled", errorCode: reason, updatedAt: new Date().toISOString(), lockedAt: "" });
        return true;
      });
    },
    async summary() {
      if (postgresEnabled()) return summarizeCrmWebhookOutbox();
      const db = await readDb();
      const summary = { queued: 0, processing: 0, delivered: 0, dead: 0, cancelled: 0, oldestPendingAt: "" };
      for (const item of db.crmWebhookOutbox || []) {
        if (Object.hasOwn(summary, item.status)) summary[item.status] += 1;
        if (["queued", "processing"].includes(item.status) && (!summary.oldestPendingAt || item.createdAt < summary.oldestPendingAt)) summary.oldestPendingAt = item.createdAt;
      }
      return summary;
    },
    async retryDead() {
      if (postgresEnabled()) return requeueDeadCrmWebhookEvents();
      return mutateJson((items) => {
        let count = 0;
        items.forEach((item) => {
          if (item.status !== "dead") return;
          Object.assign(item, { status: "queued", attempts: 0, nextAttemptAt: new Date().toISOString(), lockedAt: "", httpStatus: 0, errorCode: "", updatedAt: new Date().toISOString() });
          count += 1;
        });
        return count;
      });
    },
    async prune() {
      if (postgresEnabled()) return pruneCrmWebhookOutbox();
      return mutateJson((items) => {
        const now = Date.now();
        const keep = items.filter((item) => {
          const age = now - new Date(item.deliveredAt || item.updatedAt || item.createdAt).getTime();
          return !((item.status === "delivered" && age > 30 * 86400000) || (["dead", "cancelled"].includes(item.status) && age > 90 * 86400000));
        });
        const removed = items.length - keep.length;
        items.splice(0, items.length, ...keep);
        return removed;
      });
    }
  };
}

function getCrmWebhookWorker() {
  if (!crmWebhookWorker) {
    crmWebhookWorker = createCrmWebhookWorker({
      repository: createCrmOutboxRepository(),
      getConfig: async () => crmWebhookRuntimeConfig || getCrmWebhookConfig(await readDb()),
      logger: (level, event, metadata) => logEvent(level, event, metadata)
    });
  }
  return crmWebhookWorker;
}

function pruneMemorySeatHolds() {
  const now = Date.now();
  for (const [key, hold] of memorySeatHolds.entries()) {
    if (new Date(hold.expiresAt).getTime() <= now) memorySeatHolds.delete(key);
  }
}

async function listActiveSeatHolds(sessionId) {
  if (postgresEnabled()) return listActiveSeatHoldsFromPostgres(sessionId);
  pruneMemorySeatHolds();
  return [...memorySeatHolds.values()].filter((hold) => hold.sessionId === sessionId);
}

async function acquireSeatHold({ sessionId, seatId, ownerToken, connectionId = "", ttlMs = 120000 }) {
  if (postgresEnabled()) return acquireSeatHoldInPostgres({ sessionId, seatId, ownerToken, connectionId, ttlMs });
  pruneMemorySeatHolds();
  const key = `${sessionId}:${seatId}`;
  const current = memorySeatHolds.get(key);
  if (current && current.ownerToken !== ownerToken) return null;
  const hold = {
    sessionId,
    seatId,
    ownerToken,
    connectionId,
    expiresAt: new Date(Date.now() + Math.min(300000, Math.max(30000, Number(ttlMs || 120000)))).toISOString()
  };
  memorySeatHolds.set(key, hold);
  return hold;
}

async function releaseSeatHold({ sessionId, seatId, ownerToken }) {
  if (postgresEnabled()) return releaseSeatHoldInPostgres({ sessionId, seatId, ownerToken });
  pruneMemorySeatHolds();
  const key = `${sessionId}:${seatId}`;
  const current = memorySeatHolds.get(key);
  if (!current || current.ownerToken !== ownerToken) return null;
  memorySeatHolds.delete(key);
  return current;
}

async function releaseSeatHoldsForOwner({ sessionId, ownerToken }) {
  if (postgresEnabled()) return releaseSeatHoldsForOwnerInPostgres({ sessionId, ownerToken });
  pruneMemorySeatHolds();
  const released = [];
  for (const [key, hold] of memorySeatHolds.entries()) {
    if (hold.sessionId !== sessionId || hold.ownerToken !== ownerToken) continue;
    released.push(hold);
    memorySeatHolds.delete(key);
  }
  return released;
}

function getTrailerExtension(sourceUrl, contentType = "") {
  try {
    const pathname = new URL(sourceUrl).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".mp4", ".webm", ".mov"].includes(ext)) return ext;
  } catch {
    // The caller validates URLs before download.
  }

  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.startsWith("video/")) return ".mp4";
  return "";
}

function trailerFilename(movie, sourceUrl, extension) {
  const hash = crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
  return `${slugify(movie.id || movie.title || "trailer")}-${hash}${extension}`;
}

function localTrailerPathFromUrl(localTrailerUrl) {
  if (!localTrailerUrl) return "";

  let pathname = "";
  try {
    const parsed = new URL(localTrailerUrl, publicBackendUrl());
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return "";
  }

  if (!pathname.startsWith("/trailers/")) return "";
  const filename = path.basename(pathname);
  const resolved = path.resolve(TRAILERS_DIR, filename);
  const trailersRoot = path.resolve(TRAILERS_DIR);
  return resolved.startsWith(trailersRoot + path.sep) ? resolved : "";
}

function publicBackendUrl() {
  return (process.env.CINE_PUBLIC_BACKEND_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
}

async function deleteLocalTrailer(localTrailerUrl) {
  const trailerPath = localTrailerPathFromUrl(localTrailerUrl);
  if (!trailerPath) return;

  try {
    await fs.rm(trailerPath, { force: true });
  } catch {
    // Cache cleanup should not block catalog operations.
  }
}

function createByteLimitStream(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) {
        callback(new Error(`Trailer maior que o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`));
        return;
      }
      callback(null, chunk);
    }
  });
}

function normalizePaymentOrder(input) {
  const customerName = String(input.customerName || "Cliente Cine Cruzeiro").trim();
  const [firstName, ...lastNameParts] = customerName.split(/\s+/);
  const id = checkoutIdentifier(input.id || input.idempotencyKey || `pedido-${crypto.randomBytes(12).toString("hex")}`);
  const idempotencyKey = input.idempotencyKey ? checkoutIdentifier(input.idempotencyKey) : (input.id ? checkoutIdentifier(input.id) : "");
  const suppliedReference = String(input.reference || input.publicReference || "").trim().toUpperCase();
  const reference = isFriendlyOrderReference(suppliedReference)
    ? suppliedReference
    : createFriendlyOrderReference(input.movieTitle || input.title || "", id);

  return {
    id,
    reference,
    idempotencyKey,
    movieId: String(input.movieId || ""),
    sessionId: String(input.sessionId || ""),
    fullTicketsCount: Math.max(0, Number(input.fullTicketsCount || 0)),
    halfTicketsCount: Math.max(0, Number(input.halfTicketsCount || 0)),
    ticketItems: Array.isArray(input.ticketItems)
      ? input.ticketItems
          .map((item) => ({
            id: String(item.id || item.ticketTypeId || "").trim(),
            quantity: Math.max(0, Math.floor(Number(item.quantity || 0)))
          }))
          .filter((item) => item.id && item.quantity > 0)
      : [],
    concessionItems: Array.isArray(input.concessionItems)
      ? input.concessionItems.map((item) => ({
          id: String(item.id || ""),
          quantity: Math.max(0, Number(item.quantity || 0))
        }))
      : [],
    selectedSeatIds: Array.isArray(input.selectedSeatIds)
      ? input.selectedSeatIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
    seatHoldToken: String(input.seatHoldToken || "").trim(),
    autoAssignSeats: Boolean(input.autoAssignSeats),
    couponCode: String(input.couponCode || "").trim().toUpperCase(),
    customerUserId: String(input.customerUserId || input.userId || "").trim(),
    customerName,
    customerEmail: String(input.customerEmail || `cliente-${Date.now()}@cinecruzeiro.local`).trim(),
    customerPhone: String(input.customerPhone || "").trim(),
    customerCpf: input.customerCpf ? String(input.customerCpf).replace(/\D/g, "").slice(0, 11) : "",
    payerFirstName: firstName || "Cliente",
    payerLastName: lastNameParts.join(" ") || "Cine Cruzeiro",
    saleMode: String(input.saleMode || "").trim(),
    ticketDeliveryMethod: String(input.ticketDeliveryMethod || "").trim(),
    paymentMethod: input.paymentMethod || "PIX",
    useClubCredits: Boolean(input.useClubCredits),
    useClubBenefits: Boolean(input.useClubBenefits),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function createTicketCode(existingTickets = []) {
  return ticketCodeService.createTicketCode(existingTickets);
}

function ticketQrPayload(code, token = "") {
  return ticketCodeService.qrPayload(code, token);
}

function ensureTicketQrToken(ticket) {
  if (!ticket) return "";
  if (!ticket.qrToken) {
    ticket.qrToken = ticketCodeService.generateQrToken();
  }
  return ticket.qrToken;
}

function ticketSessionStartsAt(ticket, db = null) {
  const session = db ? sessionForTicket(db, ticket) : null;
  const date = String(session?.date || ticket.sessionDate || todayIsoDate()).trim();
  const time = String(session?.time || ticket.sessionTime || "00:00").trim();
  const parsed = new Date(`${date}T${time.length === 5 ? time : "00:00"}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ticketArchiveAt(ticket, db = null) {
  const startsAt = ticketSessionStartsAt(ticket, db);
  return startsAt ? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000) : null;
}

const ADMIN_SESSION_SECONDS = 60 * 60 * 8;
const DESKTOP_ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30;

function isDesktopAdminRequest(req) {
  const userAgent = String(req?.headers?.["user-agent"] || "");
  return /CineCruzeiroDesktop\/[\d.]+[\s\S]*CineCruzeiroAdmin/i.test(userAgent);
}

function adminSessionMaxAge(req) {
  return isDesktopAdminRequest(req) ? DESKTOP_ADMIN_SESSION_SECONDS : ADMIN_SESSION_SECONDS;
}

function adminPathForRequest(req, suffix = "") {
  const forwardedPrefix = String(req.headers["x-forwarded-prefix"] || "").replace(/\/+$/, "");
  return `${forwardedPrefix}/admin${suffix}`;
}


function ticketDocumentRetentionEndsAt(ticket, db = null) {
  const archiveAt = ticketArchiveAt(ticket, db);
  return archiveAt ? new Date(archiveAt.getTime() + TICKET_ARCHIVED_DOCUMENT_RETENTION_MS) : null;
}

function ticketDocumentDownloadAllowed(ticket, db = null, now = Date.now()) {
  const order = orderForTicket(db, ticket);
  const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
  if (status === "active") return { ok: true, status, retentionEndsAt: null };
  if (!isTicketArchived(ticket, db)) return { ok: false, status, retentionEndsAt: null };
  const retentionEndsAt = ticketDocumentRetentionEndsAt(ticket, db);
  return {
    ok: Boolean(retentionEndsAt && retentionEndsAt.getTime() > now),
    status,
    retentionEndsAt
  };
}

async function pruneExpiredTicketPdfArtifacts(db, now = new Date()) {
  const purgedTicketIds = [];
  let changed = false;

  for (const ticket of db.tickets || []) {
    const retentionEndsAt = ticketDocumentRetentionEndsAt(ticket, db);
    if (!isTicketArchived(ticket, db) || !retentionEndsAt || retentionEndsAt > now) continue;
    let ticketArtifactPurged = false;

    // PDFs are generated on demand today. This covers any legacy or future
    // artifact explicitly stored under the dedicated ticket-document directory.
    for (const field of ["pdfArtifactPath", "generatedPdfPath"]) {
      const candidate = String(ticket[field] || "").trim();
      if (!candidate) continue;
      const artifactPath = path.resolve(candidate);
      if (pathIsInside(TICKET_DOCUMENT_ROOT, artifactPath)) {
        await fs.unlink(artifactPath).catch(() => null);
      }
      ticket[field] = "";
      ticketArtifactPurged = true;
      changed = true;
    }

    if (ticketArtifactPurged) purgedTicketIds.push(ticket.id);
  }

  return { changed, purgedTicketIds };
}

function isTicketArchived(ticket, db = null) {
  if (["used", "cancelled", "refunded", "expired"].includes(String(ticket.status || ""))) return true;
  const archiveAt = ticketArchiveAt(ticket, db);
  return archiveAt ? archiveAt.getTime() <= Date.now() : false;
}

function ticketIsExpired(ticket, db = null) {
  return isTicketArchived(ticket, db);
}

function movieForTicket(db, ticket) {
  return (db.movies || []).find((movie) => movie.id === ticket.movieId) || null;
}

function sessionForTicket(db, ticket) {
  const movie = movieForTicket(db, ticket);
  return (movie?.sessions || []).find((session) => session.id === ticket.sessionId) || null;
}

function roomForSession(db, session) {
  if (!session) return null;
  const rooms = db.rooms || [];
  const roomId = String(session.roomId || "").trim();
  const roomById = roomId ? rooms.find((room) => String(room.id) === roomId) : null;
  const roomName = String(session.room || "").split("(")[0].trim().toLowerCase();
  const roomByLabel = rooms.find((room) => {
    const candidate = String(room.name || "").trim().toLowerCase();
    return candidate && (roomName === candidate || String(session.room || "").toLowerCase().includes(candidate));
  });
  // Legacy PostgreSQL writes could point roomId at the first room while keeping
  // the correct room name. Prefer that label when the two references disagree.
  return roomByLabel || roomById || null;
}

function roomDisplayLabel(room) {
  if (!room) return "";
  return `${String(room.name || "Sala").trim()} (${String(room.technology || "Sala").trim()})`;
}

function sessionWithCurrentRoom(db, session) {
  const room = roomForSession(db, session);
  return room ? { ...session, roomId: room.id, room: roomDisplayLabel(room) } : session;
}

function validateSessionRoom(db, session, existing = {}) {
  const rooms = db.rooms || [];
  const room = rooms.find((item) => session.roomId ? item.id === session.roomId : [item.name, roomDisplayLabel(item)].includes(session.room));
  const existingRoom = roomForSession(db, existing);
  if (!room || ((room.active === false || (room.status && room.status !== "active")) && existingRoom?.id !== room.id)) {
    throw Object.assign(new Error("Selecione uma sala ativa cadastrada para esta sessão."), { statusCode: 422, code: "SESSION_ROOM_INVALID" });
  }
  return { ...session, roomId: room.id, room: roomDisplayLabel(room) };
}

function roomSeatTypes(room) {
  return Array.isArray(room?.seatTypes) ? room.seatTypes : [];
}

function roomSeats(room) {
  const rows = Array.isArray(room?.seatLayout?.rows) ? room.seatLayout.rows : [];
  return rows.flatMap((row) => (Array.isArray(row.seats) ? row.seats : []).map((seat) => ({
    ...seat,
    rowId: row.id,
    rowLabel: row.label
  })));
}

function roomSeatSelectionEnabled(room) {
  return Boolean(room?.seatSelectionEnabled && roomSeats(room).some((seat) => seat.enabled !== false));
}

function roomSeatIdsInActiveUse(db, roomId) {
  const used = new Set();
  const now = Date.now();
  (db.orders || []).forEach((order) => {
    if (!["pending_payment", "paid", "paid_pending_print"].includes(order.status)) return;
    if (order.status === "pending_payment" && order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= now) return;
    const session = sessionForOrder(db, order);
    if (!session || roomForSession(db, session)?.id !== roomId) return;
    (order.selectedSeatIds || []).forEach((seatId) => used.add(String(seatId)));
  });
  (db.tickets || []).forEach((ticket) => {
    if (!ticket.seatId || ["cancelled", "refunded", "expired"].includes(ticket.status)) return;
    const session = sessionForTicket(db, ticket);
    if (!session || roomForSession(db, session)?.id !== roomId) return;
    used.add(String(ticket.seatId));
  });
  return used;
}

function findSessionWithMovie(db, sessionId) {
  for (const movie of db.movies || []) {
    if (isDeletedMovie(movie)) continue;
    const session = (movie.sessions || []).find((item) => item.id === sessionId);
    if (session) return { movie, session };
  }
  return null;
}

async function realtimeSeatState(sessionId, ownerToken = "") {
  const db = await readDb();
  const found = findSessionWithMovie(db, sessionId);
  if (!found) throw Object.assign(new Error("Sessão não encontrada."), { statusCode: 404, code: "SESSION_NOT_FOUND" });
  const room = roomForSession(db, found.session);
  const holds = roomSeatSelectionEnabled(room) ? await listActiveSeatHolds(sessionId) : [];
  const { sold, reserved } = sessionSeatAvailability(db, sessionId);
  return {
    sessionId,
    occupiedSeatIds: [...sold],
    reservedSeatIds: [...reserved],
    heldSeats: holds.map((hold) => ({
      seatId: hold.seatId,
      expiresAt: hold.expiresAt,
      heldByMe: Boolean(ownerToken && hold.ownerToken === ownerToken)
    }))
  };
}

async function selectRealtimeSeat({ sessionId, seatId, ownerToken, connectionId }) {
  return withCriticalMutation(async () => {
    const db = await readDb();
    const found = findSessionWithMovie(db, sessionId);
    if (!found) throw Object.assign(new Error("Sessão não encontrada."), { statusCode: 404, code: "SESSION_NOT_FOUND" });
    if (!isSessionSellable(found.session, found.session.date || todayIsoDate())) {
      throw Object.assign(new Error("Esta sessão não está mais disponível para venda."), { statusCode: 409, code: "SESSION_UNAVAILABLE" });
    }
    const room = roomForSession(db, found.session);
    const seat = roomSeats(room).find((item) => String(item.id) === String(seatId) && item.enabled !== false);
    if (!roomSeatSelectionEnabled(room) || !seat) {
      throw Object.assign(new Error("Esta poltrona não está disponível no mapa da sala."), { statusCode: 409, code: "SEAT_LAYOUT_CHANGED" });
    }
    if (occupiedSeatIds(db, sessionId).has(String(seatId))) {
      throw Object.assign(new Error(`A poltrona ${seat.label || seatId} já está ocupada.`), { statusCode: 409, code: "SEAT_UNAVAILABLE" });
    }
    const hold = await acquireSeatHold({ sessionId, seatId, ownerToken, connectionId, ttlMs: 120000 });
    if (!hold) {
      throw Object.assign(new Error(`A poltrona ${seat.label || seatId} acabou de ser selecionada por outra pessoa.`), { statusCode: 409, code: "SEAT_ALREADY_HELD" });
    }
    return hold;
  });
}

async function claimSeatHoldsForOrder(db, order) {
  if (!order.seatSelectionEnabled || !(order.selectedSeatIds || []).length) return;
  order.seatHoldToken = order.seatHoldToken || `checkout-${order.id || crypto.randomUUID()}`;
  const holds = await listActiveSeatHolds(order.sessionId);
  const bySeat = new Map(holds.map((hold) => [String(hold.seatId), hold]));
  for (const seatId of order.selectedSeatIds) {
    const current = bySeat.get(String(seatId));
    if (current && current.ownerToken !== order.seatHoldToken) {
      throw Object.assign(new Error(`A poltrona ${seatId} está em seleção por outra pessoa.`), { statusCode: 409, code: "SEAT_ALREADY_HELD" });
    }
    const acquired = await acquireSeatHold({ sessionId: order.sessionId, seatId, ownerToken: order.seatHoldToken, connectionId: "payment", ttlMs: 120000 });
    if (!acquired) {
      throw Object.assign(new Error(`A poltrona ${seatId} não está mais disponível.`), { statusCode: 409, code: "SEAT_ALREADY_HELD" });
    }
  }
}

async function releaseOrderSeatHolds(order, broadcastStatus = "unavailable") {
  const sessionId = order?.sessionId || order?.archivedSeatHoldSessionId || order?.archivedSessionId;
  if (!order?.seatHoldToken || !sessionId) return [];
  const released = await releaseSeatHoldsForOwner({ sessionId, ownerToken: order.seatHoldToken });
  released.forEach((hold) => seatRealtimeService?.broadcastSeatStatus(sessionId, hold.seatId, broadcastStatus));
  return released;
}

async function releaseBoxOfficeSeatHolds(orders) {
  const release = async () => {
    for (const order of orders) await releaseOrderSeatHolds(order);
  };
  if (!deferUntilPostgresCommit(release)) await release();
}

async function broadcastReleasedOrderSeats(order) {
  if (!order) return;
  const sessionId = order.sessionId || order.archivedSeatHoldSessionId || order.archivedSessionId;
  const seatIds = Array.isArray(order.selectedSeatIds) ? order.selectedSeatIds : [];
  try {
    await releaseOrderSeatHolds(order, "available");
  } catch (err) {
    logEvent("warn", "seat_realtime.release_hold_error", { orderId: order.id, message: err.message });
  }
  if (sessionId) {
    for (const seatId of seatIds) {
      seatRealtimeService?.broadcastSeatStatus(sessionId, seatId, "available");
    }
    seatRealtimeService?.broadcastSessionRefresh(sessionId);
  }
}

function publicSessionStatus(db, session) {
  const status = normalizedSessionStatus(session);
  if (!session || ["cancelled", "hidden", "archived"].includes(status)) return status || "sold_out";
  if (status === "sold_out") return "sold_out";
  const room = roomForSession(db, session);
  const capacity = roomSeatSelectionEnabled(room)
    ? roomSeats(room).filter((seat) => seat.enabled !== false).length
    : Number(room?.capacity || session.capacity || 120);
  const issued = (db.tickets || []).filter((ticket) =>
    ticket.sessionId === session.id && !["cancelled", "refunded", "expired"].includes(String(ticket.status || ""))
  ).length;
  const reserved = (db.orders || []).filter((order) =>
    order.sessionId === session.id
    && order.status === "pending_payment"
    && (!order.reservationExpiresAt || new Date(order.reservationExpiresAt).getTime() > Date.now())
  ).reduce((sum, order) => sum + orderTicketCount(order), 0);
  const occupied = issued + reserved;
  if (capacity > 0 && occupied >= capacity) return "sold_out";
  if (capacity > 0 && occupied / capacity >= 0.7) return "filling_fast";
  return status === "filling_fast" ? "filling_fast" : "available";
}

const { assignSeatsToOrder } = createOrderSeatAssignmentService({
  roomForSession, roomSeatSelectionEnabled, roomSeats, roomSeatTypes, orderTicketCount
});

function sessionTicketStats(db, sessionId) {
  const tickets = (db.tickets || []).filter((ticket) => ticket.sessionId === sessionId);
  const pendingPrintCount = (db.orders || [])
    .filter((order) => order.sessionId === sessionId && order.status === "paid_pending_print")
    .reduce((sum, order) => sum + (order.pendingPrintTickets || []).length, 0);
  const sold = pendingPrintCount + tickets.filter((ticket) => {
    const order = orderForTicket(db, ticket);
    const status = effectiveTicketStatus(ticket, order, sessionForTicket(db, ticket), db);
    return !["cancelled", "refunded", "expired", "pending_payment"].includes(status);
  }).length;
  return {
    sold,
    total: tickets.length,
    active: tickets.filter((ticket) => effectiveTicketStatus(ticket, orderForTicket(db, ticket), sessionForTicket(db, ticket), db) === "active").length,
    used: tickets.filter((ticket) => ticket.status === "used").length,
    cancelled: tickets.filter((ticket) => ["cancelled", "refunded"].includes(ticket.status)).length
  };
}

function orderForTicket(db, ticket) {
  if (!ticket) return null;
  return (db.orders || []).find((order) => order.id === ticket.orderId) || null;
}

function persistedTicketTransferHistory(db, ticket) {
  const records = [
    ...(Array.isArray(ticket?.transferHistory) ? ticket.transferHistory : []),
    ...(Array.isArray(db.ticketTransfers) ? db.ticketTransfers : [])
  ];
  const seen = new Set();
  return records.filter((entry) => {
    const key = String(entry.id || `${entry.ticketId}:${entry.transferredAt}:${entry.fromUserId}:${entry.toUserId}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function effectiveTicketStatus(ticket, order, session = null, db = null) {
  if (ticket.status === "used") return "used";
  if (["cancelled", "refunded", "expired"].includes(ticket.status)) return ticket.status;
  if (order && ["cancelled", "refunded", "expired"].includes(order.status)) return order.status;
  if (order && order.status !== "paid") return "pending_payment";
  if (order?.refundStatus === "pending") return "refund_pending";
  if (session && ["cancelled", "hidden"].includes(session.status)) return "cancelled";
  if (ticketIsExpired(ticket, db)) return "archived";
  return ticket.status || "active";
}

function ticketCanRedeemPendingConcessionsToday(ticket, db, now = new Date()) {
  if (!ticket || ticket.status !== "used" || !ticket.usedAt) return false;
  const usedAt = new Date(ticket.usedAt);
  if (Number.isNaN(usedAt.getTime())) return false;
  const usedDate = datePartsInSaoPaulo(usedAt);
  const currentDate = datePartsInSaoPaulo(now);
  if (usedDate.year !== currentDate.year || usedDate.month !== currentDate.month || usedDate.day !== currentDate.day) return false;
  return pendingConcessionOrdersForTicket(db, ticket).length > 0;
}

function ticketBelongsToUser(db, ticket, user) {
  if (!ticket || !user) return false;
  const ticketUserId = String(ticket.customerUserId || "").trim();
  if (ticketUserId) return ticketUserId === user.id;

  const order = orderForTicket(db, ticket);
  if (order?.customerUserId) return order.customerUserId === user.id;

  const ticketEmail = String(ticket.customerEmail || "").trim().toLowerCase();
  const ticketCpf = String(ticket.customerCpf || "").replace(/\D/g, "");
  return (ticketEmail && ticketEmail === user.email) || (ticketCpf && user.cpf && ticketCpf === String(user.cpf).replace(/\D/g, ""));
}

function getOwnedTicket(db, ticketId, user) {
  if (!ticketId || !user) return null;
  const ticket = (db.tickets || []).find((item) => item.id === ticketId);
  if (!ticket || !ticketBelongsToUser(db, ticket, user)) return null;
  return ticket;
}

function requireCustomerAuth(req, res, db) {
  const user = getCustomerUser(req, db);
  if (!user) {
    sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar ingressos." } });
    return null;
  }
  return user;
}

function enrichTicket(db, ticket) {
  const order = orderForTicket(db, ticket);
  const movie = movieForTicket(db, ticket);
  const session = sessionForTicket(db, ticket);
  const room = roomForSession(db, session);
  const archiveAt = ticketArchiveAt(ticket, db);
  const status = effectiveTicketStatus(ticket, order, session, db);
  const stats = session ? sessionTicketStats(db, session.id) : null;
  const sessionDate = session?.date || order?.sessionDate || ticket.sessionDate || todayIsoDate();
  const sessionTime = session?.time || order?.sessionTime || ticket.sessionTime || "";
  const sessionRoom = roomDisplayLabel(room) || session?.room || order?.sessionRoom || ticket.sessionRoom || "Sala Cruzeiro";
  const sessionFormat = session?.format || order?.sessionFormat || ticket.sessionFormat || "";
  const capacity = Number(session?.capacity || room?.capacity || 0);
  const orderTickets = orderTicketsSorted(db, ticket.orderId);
  const orderTicketIndex = Math.max(0, orderTickets.findIndex((item) => item.id === ticket.id));
  const orderTicketCount = orderTickets.length || 1;
  const concessionOrders = concessionOrdersForTicket(db, ticket);
  const pendingConcessionOrders = pendingConcessionOrdersForTicket(db, ticket);
  const canRedeemConcessionsToday = ticketCanRedeemPendingConcessionsToday(ticket, db);
  const orderExtras = concessionOrders.flatMap((sourceOrder) =>
    (Array.isArray(sourceOrder?.concessionItems) ? sourceOrder.concessionItems : []).map((item) => ({
      ...assetRecord(item, ["imageUrl"]),
      sourceOrderId: sourceOrder.id
    }))
  );
  const transferCheck = canTransferTicket(db, ticket);
  const displayCode = ticketCodeService.displayCode(ticket);
  return {
    ...ticket,
    displayCode,
    displayQrPayload: ticketQrPayload(displayCode),
    customerEmail: ticket.customerEmail || order?.customerEmail || "",
    customerPhone: ticket.customerPhone || order?.customerPhone || "",
    customerCpf: ticket.customerCpf || order?.customerCpf || "",
    customerUserId: ticket.customerUserId || order?.customerUserId || "",
    movieTitle: movie?.title || order?.movieTitle || ticket.movieTitle || "",
    posterUrl: publicAssetUrl(movie?.posterUrl || ""),
    backdropUrl: publicAssetUrl(movie?.backdropUrl || ""),
    sessionDate,
    sessionTime,
    sessionRoom,
    sessionFormat,
    sessionStatus: session?.status || "",
    sessionCapacity: capacity,
    sessionSold: stats?.sold || 0,
    sessionAvailable: capacity ? Math.max(0, capacity - (stats?.sold || 0)) : null,
    seat: ticket.seat || ticket.seatLabel || ticket.assento || ticket.metadata?.seat || "Lugar livre",
    orderReference: shortOrderReference(order || { id: ticket.orderId }, movie?.title || ticket.movieTitle || ""),
    orderStatus: order?.status || "",
    paymentStatus: order?.paymentStatus || "",
    extras: orderExtras,
    extrasSharedByOrder: Boolean((order?.concessionItems || []).length),
    extrasAttachedToTicket: pendingConcessionOrders.length > 0,
    canRedeemConcessionsToday,
    orderTicketIndex,
    orderTicketCount,
    status,
    archived: ["archived", "used", "cancelled", "refunded", "expired"].includes(status),
    archiveAt: archiveAt?.toISOString() || "",
    canTransfer: transferCheck.ok,
    transferBlockedReason: transferCheck.ok ? "" : transferCheck.message
  };
}

const { canTransferTicket } = createTicketTransferEligibility({
  orderForTicket, effectiveTicketStatus, sessionForTicket, ticketIsExpired,
  persistedTicketTransferHistory, ticketSessionStartsAt, ticketTransferLimits
});

function extractTicketCode(value) {
  return ticketCodeService.normalizeCode(value);
}

const { buildTicketsForOrder } = createTicketIssuanceService({
  todayIsoDate, fallbackCustomerName: "Cliente Cine Cruzeiro"
});

function orderRequiresConfirmedPrint(order = {}) {
  if (order.saleMode === "concession_counter") return true;
  if (order.saleMode === "quick") return true;
  return order.saleMode === "guest" && String(order.ticketDeliveryMethod || "physical") === "physical";
}

function stagePaidOrderForPrint(db, order, payment, source = "box_office") {
  const existingTickets = (db.tickets || []).filter((ticket) => ticket.orderId === order?.id);
  if (!order || existingTickets.length) return existingTickets;
  if (payment) {
    payment.status = "approved";
    payment.approvedAt ||= new Date().toISOString();
    payment.updatedAt = new Date().toISOString();
  }
  order.status = "paid_pending_print";
  order.paymentStatus = payment ? "approved" : "not_required";
  order.paidAt ||= new Date().toISOString();
  order.pendingPrintTickets = Array.isArray(order.pendingPrintTickets)
    ? order.pendingPrintTickets
    : buildTicketsForOrder(order, db, source);
  order.printFulfillment = {
    ...(order.printFulfillment || {}),
    status: ["printed", "completed"].includes(String(order.printFulfillment?.status || "")) ? order.printFulfillment.status : "pending",
    stagedAt: order.printFulfillment?.stagedAt || new Date().toISOString(),
    ticketCount: order.pendingPrintTickets.length
  };
  return order.pendingPrintTickets;
}

function isOrderFullyValidated(order, tickets = []) {
  if (!order) return false;
  const hasTickets = Array.isArray(tickets) && tickets.length > 0;
  const allTicketsValidated = !hasTickets || tickets.every((t) => ["used", "cancelled", "refunded"].includes(String(t.status || "")));
  const concessions = Array.isArray(order.concessionItems) ? order.concessionItems : [];
  const hasConcessions = concessions.length > 0;
  const allConcessionsValidated = !hasConcessions || concessions.every((item) => {
    if (item.status === "cancelled" || item.refundStatus === "completed") return true;
    return Number(item.fulfilledQuantity || 0) >= Number(item.quantity || 0);
  }) || Boolean(order.concessionsFulfilledAt) || ["cancelled", "refunded"].includes(String(order.concessionStatus || ""));
  return allTicketsValidated && allConcessionsValidated;
}

function orderSessionStartsAt(order = {}, db = null) {
  let date = String(order?.sessionDate || "").slice(0, 10);
  let time = String(order?.sessionTime || "").trim();
  if ((!date || !time) && db && order?.sessionId) {
    const foundSession = (db.sessions || []).find((s) => s.id === order.sessionId);
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

function isOrderSessionExpired(order = {}, db = null, now = new Date()) {
  if (!order) return false;
  const startsAt = orderSessionStartsAt(order, db);
  if (!startsAt) return false;
  return startsAt.getTime() <= now.getTime();
}

function isOrderEffectivelyArchived(order, tickets = [], db = null) {
  if (!order) return false;
  if (order.archived === true) return true;
  if (["cancelled", "refunded", "expired"].includes(String(order.status || ""))) return true;
  if (isOrderSessionExpired(order, db)) return true;
  if (order.status === "paid" && isOrderFullyValidated(order, tickets)) return true;
  return false;
}

function isOrderEffectivelyActive(order, tickets = [], db = null) {
  if (!order) return false;
  return !isOrderEffectivelyArchived(order, tickets, db) && ["pending", "pending_payment", "processing", "paid_pending_print", "paid"].includes(String(order.status || ""));
}

function checkAndAutoArchiveOrder(db, order, adminUser, reason = "Todos os itens validados pelo cinema") {
  if (!order || order.archived) return false;
  const tickets = orderTickets(db, order.id) || [];
  const sessionExpired = isOrderSessionExpired(order, db);
  if (sessionExpired || isOrderFullyValidated(order, tickets)) {
    const archiveReason = sessionExpired ? "Sessão de cinema já expirada" : reason;
    const now = new Date().toISOString();
    order.archived = true;
    order.archivedAt = now;
    order.archivedBy = adminUser?.id || "system";
    order.archivedByEmail = adminUser?.email || "system@cinecruzeiro.local";
    order.archivedReason = reason;
    order.updatedAt = now;
    appendOrderAudit(order, {
      action: "archive",
      updatedBy: order.archivedBy,
      reason,
      after: structuredCloneSafe(order)
    });
    return true;
  }
  return false;
}

const { inspectTicket, validateTicket } = createTicketValidationService({
  enrichTicket, effectiveTicketStatus, sessionForTicket, checkAndAutoArchiveOrder
});

function inspectTicketConcessions(db, code) {
  const ticket = ticketCodeService.findTicketByCode(db.tickets || [], code);
  if (!ticket) {
    const error = new Error("Ingresso não encontrado.");
    error.statusCode = 404;
    error.code = "TICKET_NOT_FOUND";
    throw error;
  }
  const assignedOrders = concessionOrdersForTicket(db, ticket);
  const legacyOrder = orderForTicket(db, ticket);
  if (!assignedOrders.length && legacyOrder && !legacyOrder.concessionTicketId && (legacyOrder.concessionItems || []).length) {
    assignedOrders.push(legacyOrder);
  }
  if (!assignedOrders.length) {
    const error = new Error("Este ingresso não possui itens de bomboniere vinculados.");
    error.statusCode = 409;
    error.code = "ORDER_WITHOUT_CONCESSIONS";
    error.ticket = ticket;
    throw error;
  }
  const paidOrders = assignedOrders.filter((order) => order.status === "paid");
  if (!paidOrders.length) {
    const error = new Error("A bomboniere só pode ser entregue após a aprovação do pagamento.");
    error.statusCode = 409;
    error.code = "TICKET_PAYMENT_PENDING";
    error.ticket = ticket;
    throw error;
  }
  if (["cancelled", "refunded", "expired"].includes(String(ticket.status || ""))) {
    const error = new Error("Este ingresso não está disponível para retirada na bomboniere.");
    error.statusCode = 409;
    error.code = "TICKET_EXPIRED";
    error.ticket = ticket;
    throw error;
  }

  const activeOrders = paidOrders.filter((order) =>
    order.concessionStatus !== "cancelled" && !order.concessionCancelledAt && order.concessionRefund?.status !== "completed" && !["cancelled", "refunded"].includes(String(order.status || ""))
  );
  if (!activeOrders.length) {
    const error = new Error("Os itens de bomboniere deste pedido foram cancelados ou reembolsados.");
    error.statusCode = 409;
    error.code = "CONCESSIONS_CANCELLED";
    error.ticket = ticket;
    throw error;
  }

  const concessions = activeOrders.flatMap((order) => order.concessionItems || []);
  const pending = concessions.filter((item) => item.status !== "cancelled" && item.refundStatus !== "completed" && Number(item.quantity || 0) > Number(item.fulfilledQuantity || 0));
  if (!pending.length) {
    const fulfilledAt = activeOrders.find((order) => order.concessionsFulfilledAt)?.concessionsFulfilledAt || concessions[0]?.fulfilledAt;
    const error = new Error(`Itens já entregues em ${new Date(fulfilledAt || Date.now()).toLocaleString("pt-BR")}.`);
    error.statusCode = 409;
    error.code = "CONCESSIONS_ALREADY_FULFILLED";
    error.ticket = ticket;
    error.concessions = concessions;
    throw error;
  }

  return { ticket, order: activeOrders[0], orders: activeOrders, concessions: pending };
}

function validateTicketConcessions(db, code, adminUser) {
  const validation = inspectTicketConcessions(db, code);
  const { ticket, orders: activeOrders, concessions: pending } = validation;
  const fulfilledAt = new Date().toISOString();
  pending.forEach((item) => {
    item.fulfilledQuantity = Number(item.quantity || 0);
    item.fulfilledAt = fulfilledAt;
    item.fulfilledBy = adminUser?.id || "";
  });
  activeOrders.forEach((order) => {
    order.concessionsFulfilledAt = fulfilledAt;
    order.concessionsFulfilledBy = adminUser?.id || "";
    checkAndAutoArchiveOrder(db, order, adminUser, "Ingressos e bomboniere validados pelo cinema");
  });
  return { ...validation, fulfilledAt };
}

async function createOpenFinancePixPayment(order, config = {}) {
  return paymentService.createOpenFinancePixPayment(order, config);
}

async function createMercadoPagoOrderPayment(order, config = {}, options = {}) {
  return paymentService.createMercadoPagoOrderPayment(order, config, options);
}

function activeOnlinePaymentProvider(db) {
  const pagBank = integrationConfigService.resolvedConfig(db, "pagBank");
  const mercadoPago = integrationConfigService.resolvedConfig(db, "mercadoPago");
  if (pagBank?.enabled && mercadoPago?.enabled) {
    const error = new Error("Desative um dos provedores de pagamento nas Integrações.");
    error.statusCode = 409;
    error.code = "PAYMENT_PROVIDER_CONFLICT";
    throw error;
  }
  if (pagBank?.enabled) return { provider: "pag_bank", config: pagBank, name: "PagBank" };
  return { provider: "mercado_pago", config: mercadoPago || {}, name: "Mercado Pago" };
}

function refundProviderConfig(db, payment) {
  const provider = payment?.provider === "pag_bank" ? "pagBank" : "mercadoPago";
  const config = { ...(integrationConfigService.resolvedConfig(db, provider) || {}) };
  const originalEnvironment = String(payment?.metadata?.providerEnvironment || "");
  if (["sandbox", "production"].includes(originalEnvironment)) config.environment = originalEnvironment;
  return config;
}

async function createActiveOnlinePayment(order, active, options = {}) {
  const payment = await (active.provider === "pag_bank"
    ? pagBankPaymentService.createOrderPayment(order, active.config, options)
    : createMercadoPagoOrderPayment(order, active.config, options));
  payment.providerEnvironment = active.config?.environment === "sandbox" ? "sandbox" : "production";
  return payment;
}

function mercadoPagoDeviceId(req) {
  const value = String(req.headers["x-mp-device-id"] || "").trim();
  return /^[A-Za-z0-9._:-]{8,256}$/.test(value) ? value : "";
}

function frontendUrlForRequest(req, db) {
  return getGoogleOAuthConfig(req, db).frontendUrl;
}

function mercadoPagoSubscriptionPlanMap(db) {
  db.settings ||= {};
  db.settings.mercadoPagoSubscriptionPlans ||= {};
  return db.settings.mercadoPagoSubscriptionPlans;
}

function mercadoPagoPlanIdFor(db, plan) {
  const mapping = mercadoPagoSubscriptionPlanMap(db)[plan.id] || {};
  return String(plan.providerPlanId || plan.mercadoPagoPlanId || mapping.providerPlanId || "").trim();
}

function rememberMercadoPagoPlanId(db, plan, providerPlan) {
  if (!providerPlan?.id) return "";
  const id = String(providerPlan.id);
  const mapping = mercadoPagoSubscriptionPlanMap(db);
  mapping[plan.id] = {
    provider: "mercado_pago",
    providerPlanId: id,
    planName: plan.name,
    amount: Number(plan.monthlyPrice ?? plan.price ?? 0),
    status: providerPlan.status || "active",
    updatedAt: new Date().toISOString()
  };
  plan.providerPlanId = id;
  plan.mercadoPagoPlanId = id;
  return id;
}

async function ensureMercadoPagoSubscriptionPlan(db, plan, integrationConfig, req) {
  const existing = mercadoPagoPlanIdFor(db, plan);
  if (existing) return existing;
  const providerPlan = await paymentService.createMercadoPagoSubscriptionPlan(plan, integrationConfig, {
    frontendUrl: frontendUrlForRequest(req, db)
  });
  return rememberMercadoPagoPlanId(db, plan, providerPlan);
}

function applyMercadoPagoSubscriptionStatus(db, subscription, providerSubscription, actor = "mercado_pago", options = {}) {
  const now = new Date().toISOString();
  const nextStatus = providerSubscription?.localStatus || paymentService.normalizeMercadoPagoSubscriptionStatus(providerSubscription?.status);
  const previousStatus = subscription.status;
  subscription.provider = "mercado_pago";
  subscription.providerSubscriptionId = providerSubscription?.id || subscription.providerSubscriptionId || "";
  subscription.providerStatus = providerSubscription?.status || subscription.providerStatus || "";
  subscription.providerPlanId = providerSubscription?.planId || subscription.providerPlanId || "";
  subscription.nextBillingAt = providerSubscription?.nextPaymentDate || subscription.nextBillingAt || "";
  subscription.updatedAt = now;

  const paymentApproved = options.paymentApproved === true || subscription.paymentStatus === "approved";

  if (["ending", "cancelled", "ended"].includes(previousStatus) && nextStatus === "active") {
    subscription.status = previousStatus;
    subscription.paymentStatus = subscription.paymentStatus || "cancelled";
    subscription.nextBillingAt = "";
  } else if (nextStatus === "active" && paymentApproved) {
    subscription.status = "active";
    subscription.paymentStatus = "approved";
    subscription.approvedAt ||= now;
    subscription.startedAt ||= now;
    const paidCyclePaymentId = String(options.payment?.providerPaymentId || "");
    const shouldIssuePaidCycle = paidCyclePaymentId
      ? clubDomainService.shouldIssueSubscriptionPaymentCycle(db, { ...options.payment, provider: options.payment?.provider || subscription.provider })
      : !currentSubscriptionCredit(db, subscription);
    if (shouldIssuePaidCycle) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      const approvedAt = options.payment?.approvedAt ? new Date(options.payment.approvedAt) : new Date();
      if (plan) createSubscriptionCreditCycle(db, subscription, plan, Number.isNaN(approvedAt.getTime()) ? new Date() : approvedAt, options.payment || null);
    }
  } else if (nextStatus === "active") {
    subscription.status = "pending_payment";
    subscription.paymentStatus = "pending";
  } else if (nextStatus === "cancelled" && previousStatus === "ending") {
    subscription.status = "ending";
    subscription.nextBillingAt = "";
  } else if (nextStatus === "cancelled") {
    subscription.status = "cancelled";
    subscription.paymentStatus = "cancelled";
    subscription.cancelledAt ||= now;
  } else if (nextStatus === "paused") {
    subscription.status = "paused";
  } else if (nextStatus === "payment_failed") {
    subscription.status = "payment_failed";
    subscription.paymentStatus = "failed";
  } else if (previousStatus === "active" && subscription.paymentStatus === "approved") {
    // Mercado Pago may deliver an older pending event after authorization.
    subscription.status = "active";
    subscription.paymentStatus = "approved";
  } else {
    subscription.status = "pending_payment";
    subscription.paymentStatus = "pending";
  }

  subscription.history ||= [];
  subscription.history.push({
    action: "mercado_pago_status",
    from: previousStatus,
    to: subscription.status,
    providerStatus: subscription.providerStatus,
    by: actor,
    at: now
  });
  return refreshSubscriptionCredits(db, subscription);
}

function isMercadoPagoAlreadyCancelledError(error) {
  const message = String(error?.message || error?.raw?.message || "").toLowerCase();
  return message.includes("cancelled preapproval")
    || message.includes("canceled preapproval")
    || message.includes("cannot modify a cancelled")
    || message.includes("can not modify a cancelled");
}

async function cancelMercadoPagoSubscriptionSafely(subscription, integrationConfig = {}) {
  if (subscription.provider !== "mercado_pago" || !subscription.providerSubscriptionId) return null;
  if (["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())) {
    return { id: subscription.providerSubscriptionId, status: "cancelled", localStatus: "cancelled", alreadyCancelled: true };
  }
  try {
    return await subscriptionPaymentProvider.cancelSubscription(subscription.providerSubscriptionId, integrationConfig || {});
  } catch (error) {
    if (!isMercadoPagoAlreadyCancelledError(error)) throw error;
    return { id: subscription.providerSubscriptionId, status: "cancelled", localStatus: "cancelled", alreadyCancelled: true };
  }
}

function subscriptionEntitlementEnd(db, subscription, now = new Date()) {
  const credit = currentSubscriptionCredit(db, subscription, now);
  const candidates = [
    credit?.cycleEnd,
    subscription.benefitsUntil,
    subscription.currentPeriodEnd,
    subscription.cycleEnd
  ].filter(Boolean).map((value) => new Date(value)).filter((value) => Number.isFinite(value.getTime()) && value.getTime() > now.getTime());
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0]?.toISOString() || now.toISOString();
}

function markSubscriptionWithoutRenewal(db, subscription, options = {}) {
  const now = options.now || new Date();
  const timestamp = now.toISOString();
  const benefitsUntil = subscriptionEntitlementEnd(db, subscription, now);
  subscription.status = new Date(benefitsUntil).getTime() > now.getTime() ? "ending" : "ended";
  subscription.cancelAtPeriodEnd = true;
  subscription.cancellationRequestedAt ||= timestamp;
  subscription.billingCancelledAt ||= timestamp;
  subscription.benefitsUntil = benefitsUntil;
  subscription.cancellationMode = options.mode || "period_end";
  subscription.reactivationBlocked = true;
  subscription.cancelledAt ||= timestamp;
  subscription.endedAt = subscription.status === "ended" ? (subscription.endedAt || timestamp) : "";
  subscription.nextBillingAt = "";
  subscription.updatedAt = timestamp;
  return subscription;
}

function finalizeEndingSubscriptions(db, options = {}) {
  const now = options.now || new Date();
  const timestamp = now.toISOString();
  let changed = 0;
  for (const subscription of db.subscriptions || []) {
    const activeCredit = currentSubscriptionCredit(db, subscription, now);
    if (subscription.status === "cancelled" && activeCredit && Number(activeCredit.remaining || 0) > 0) {
      subscription.status = "ending";
      subscription.cancelAtPeriodEnd = true;
      subscription.benefitsUntil = activeCredit.cycleEnd;
      subscription.billingCancelledAt ||= subscription.cancelledAt || timestamp;
      subscription.cancellationRequestedAt ||= subscription.cancelledAt || timestamp;
      subscription.cancellationMode ||= "period_end";
      subscription.reactivationBlocked = true;
      subscription.nextBillingAt = "";
      subscription.updatedAt = timestamp;
      changed += 1;
      continue;
    }
    if (subscription.status !== "ending") continue;
    const endValue = subscription.benefitsUntil || subscription.currentPeriodEnd || subscription.cycleEnd || "";
    if (endValue && new Date(endValue).getTime() > now.getTime()) continue;
    subscription.status = "ended";
    subscription.endedAt ||= timestamp;
    subscription.creditsAvailable = 0;
    subscription.nextBillingAt = "";
    subscription.updatedAt = timestamp;
    changed += 1;
  }
  return { changed: changed > 0, finalized: changed };
}

function subscriptionPaymentExpiresAt(subscription, now = new Date()) {
  const explicit = subscription.paymentExpiresAt || subscription.pendingPaymentExpiresAt || subscription.expiresAt || "";
  if (explicit) return new Date(explicit);
  const createdAt = subscription.createdAt || subscription.updatedAt || now.toISOString();
  return new Date(new Date(createdAt).getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS);
}

function subscriptionPendingPaymentExpired(subscription, now = new Date()) {
  if (subscription.status !== "pending_payment") return false;
  return subscriptionPaymentExpiresAt(subscription, now).getTime() <= now.getTime();
}

function markSubscriptionPaymentExpired(db, subscription, providerSubscription, now = new Date()) {
  const timestamp = now.toISOString();
  const payment = findSubscriptionPayment(db, subscription.id);
  if (payment && payment.status !== "approved") {
    payment.status = "expired";
    payment.expiredAt ||= timestamp;
    payment.updatedAt = timestamp;
  }
  subscription.status = "cancelled";
  subscription.paymentStatus = "expired";
  subscription.providerStatus = providerSubscription?.status || subscription.providerStatus || "cancelled";
  subscription.cancelledAt ||= timestamp;
  subscription.paymentExpiredAt = timestamp;
  subscription.paymentExpiresAt = subscription.paymentExpiresAt || subscriptionPaymentExpiresAt(subscription, now).toISOString();
  subscription.nextBillingAt = "";
  subscription.cycleEnd = timestamp;
  subscription.currentPeriodEnd = timestamp;
  subscription.creditsAvailable = 0;
  subscription.creditsUsed = 0;
  const credit = currentSubscriptionCredit(db, subscription, now);
  if (credit) {
    credit.remaining = 0;
    credit.updatedAt = timestamp;
    syncSubscriptionCreditMirror(subscription, credit);
  }
  subscription.updatedAt = timestamp;
  subscription.history ||= [];
  subscription.history.push({
    action: "pending_payment_expired",
    reason: "Pagamento nao aprovado em 15 minutos.",
    provider: subscription.provider || "",
    providerStatus: subscription.providerStatus || "",
    at: timestamp
  });
}

async function expirePendingPaymentSubscriptions(db, options = {}) {
  const now = options.now || new Date();
  const expired = (db.subscriptions || []).filter((subscription) => subscriptionPendingPaymentExpired(subscription, now));
  if (!expired.length) return { changed: false, expired: 0, failed: 0 };

  const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
  let changed = 0;
  let failed = 0;
  for (const subscription of expired) {
    let providerSubscription = null;
    try {
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        providerSubscription = await subscriptionPaymentProvider.getSubscription(
          subscription.providerSubscriptionId,
          mercadoPagoConfig || {}
        );
        if (providerSubscription?.localStatus === "active") {
          applyMercadoPagoSubscriptionStatus(
            db,
            subscription,
            providerSubscription,
            "mercado_pago_expiration_reconciliation",
            { paymentApproved: true }
          );
          changed += 1;
          continue;
        }
      }
      providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
      markSubscriptionPaymentExpired(db, subscription, providerSubscription, now);
      changed += 1;
    } catch (error) {
      failed += 1;
      subscription.history ||= [];
      subscription.history.push({
        action: "pending_payment_expiration_failed",
        reason: error?.code || error?.message || "Falha ao cancelar assinatura pendente no provedor.",
        at: now.toISOString()
      });
      logEvent("warn", "subscription.pending_payment_expiration_failed", {
        subscriptionId: subscription.id,
        provider: subscription.provider || "",
        providerSubscriptionId: subscription.providerSubscriptionId || "",
        code: error?.code || "SUBSCRIPTION_EXPIRATION_FAILED"
      });
    }
  }
  return { changed: changed > 0 || failed > 0, expired: changed, failed };
}

function normalizeProviderPaymentStatus(status) {
  return paymentService.normalizeProviderPaymentStatus(status);
}

function createPaymentRecord(order, providerPayment, method) {
  return paymentService.createPaymentRecord(order, providerPayment, method);
}

function createBoxOfficePaymentRecord(order, method, adminUser) {
  const now = new Date().toISOString();
  const origin = order?.saleMode === "concession_counter" ? "concession_counter" : "box_office";
  const provider = method === "courtesy"
    ? "admin"
    : method === "card_terminal"
    ? (cardTerminalProvider.configured() ? cardTerminalProvider.providerName() : "manual_external")
    : method === "external_pix"
    ? "external_manual"
    : "box_office";
  return {
    id: `pagamento-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: order.id,
    method,
    provider,
    providerPaymentId: `${method}-${order.id}`,
    providerReference: order.id,
    status: "approved",
    amount: Number(order.totalPrice || 0),
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    metadata: {
      origin,
      kind: orderRequiresConfirmedPrint(order) ? "counter_sale" : "counter_sale_completed",
      ...(method === "card_terminal" ? cardTerminalProvider.manualTerminalPaymentMetadata({}, adminUser) : {}),
      manualConfirmation: !cardTerminalProvider.configured() || method !== "card_terminal",
      createdBy: adminUser?.id || "",
      createdByEmail: adminUser?.email || ""
    }
  };
}

function createPointPaymentRecord(orders, providerPayment, adminUser, batchId, method = "card_terminal") {
  const now = new Date().toISOString();
  const relatedOrderIds = orders.map((order) => order.id);
  const origin = orders.some((order) => order?.saleMode === "concession_counter") ? "concession_counter" : "box_office";
  return {
    id: `pagamento-point-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    orderId: relatedOrderIds[0],
    method,
    provider: "mercado_pago",
    providerPaymentId: providerPayment.id,
    providerReference: providerPayment.externalReference,
    status: providerPayment.status || "pending",
    amount: orders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0),
    currency: "BRL",
    createdAt: now,
    updatedAt: now,
    approvedAt: providerPayment.status === "approved" ? now : "",
    metadata: {
      kind: "point_sale",
      origin,
      batchId,
      relatedOrderIds,
      terminalId: providerPayment.terminalId || "",
      providerStatus: providerPayment.providerStatus || "",
      statusDetail: providerPayment.statusDetail || "",
      idempotencyKey: providerPayment.idempotencyKey || "",
      createdBy: adminUser?.id || "",
      createdByEmail: adminUser?.email || ""
    }
  };
}

function pointPaymentOrders(db, payment) {
  const ids = Array.isArray(payment?.metadata?.relatedOrderIds) && payment.metadata.relatedOrderIds.length
    ? payment.metadata.relatedOrderIds
    : [payment?.orderId].filter(Boolean);
  return ids.map((id) => (db.orders || []).find((order) => order.id === id)).filter(Boolean);
}

function pointSaleFingerprint(pathname, body) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
      : value;
  return crypto.createHash("sha256").update(JSON.stringify(canonical({ pathname, body }))).digest("hex");
}

function pointProviderAccountFingerprint(config) {
  const token = String(config.accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "");
  return crypto.createHash("sha256").update(token).digest("hex");
}

const { pdfRect, pdfLine, pdfWriteText, brl, buildPdf,
  ticketThermalPdf, concessionThermalPdf, ticketDownloadPdf } = createTicketDocumentPdfService({
  backendDir: __dirname, fs, path, crypto, QRCode, sharp, storageService,
  stripPublicAssetBase, pathIsInside, movieForTicket, slugify,
  downloadPublicBuffer, enrichTicket, brazilianDate, methodLabel
});

const { deliverTicketsByEmail, processQueuedTicketEmailDelivery, queueTicketEmailDelivery } = createTicketEmailDeliveryCoordinator({
  enrichTicket, googleWalletSaveUrl, ticketDownloadPdf, logEvent, emailService,
  appFrontendUrl, readDb, orderTickets, shouldDeliverBoxOfficeTicketsByEmail,
  structuredCloneSafe, deliverBoxOfficeTicketsBySelectedMethod,
  withCriticalMutation, writeDb, deferUntilPostgresCommit, postgresEnabled,
  getTicketEmailWorker: () => ticketEmailWorker, outsidePostgresTransaction,
  requestContext, mutationContext
});

const { claimPointCreation, markPointRequestSent, attemptPointCreation } = createPointCreationCoordinator({
  withCriticalMutation, readDb, writeDb, pointPaymentOrders, pointProviderAccountFingerprint, cardTerminalProvider
});

function paymentStatusAfterWebhook(currentStatus, incomingStatus) {
  const current = String(currentStatus || "pending").toLowerCase();
  const incoming = String(incomingStatus || "pending").toLowerCase();
  if (current === "refunded") return "refunded";
  if (current === "approved" && incoming !== "refunded") return "approved";
  if (["cancelled", "expired", "rejected"].includes(current) && ["pending", "processing"].includes(incoming)) {
    return current;
  }
  return incoming === "pending" ? current : incoming;
}

function pointReservationExpiresAt(config = {}) {
  const match = String(config.pointExpirationTime || "PT15M").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  const requested = match
    ? (Number(match[1] || 0) * 60 * 60 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000
    : 15 * 60 * 1000;
  const duration = Math.min(3 * 60 * 60 * 1000, Math.max(30 * 1000, requested || 15 * 60 * 1000));
  return new Date(Date.now() + duration).toISOString();
}

const { applyPointPaymentStatus } = createPointPaymentStateService({
  paymentStatusAfterWebhook, pointPaymentOrders, orderRequiresConfirmedPrint, stagePaidOrderForPrint, finalizePaidOrder, releaseConcessionReservation
});

const handlePointPaymentRecovery = createPointPaymentRecoveryHandler({
  getAdminUser, sendJson, integrationConfigService, attemptPointCreation, cardTerminalProvider, pointPaymentOrders, orderRequiresConfirmedPrint, mercadoPagoReferenceMatches, withCriticalMutation,
  readDb, writeDb, applyPointPaymentStatus, queueBoxOfficePointPrint, syncBoxOfficePointPrint, finalizePrintedOrders, shouldDeliverBoxOfficeTicketsByEmail, queueTicketEmailDelivery, logEvent
});

const handlePointPaymentCancellation = createPointPaymentCancellationHandler({
  getAdminUser, sendJson, withCriticalMutation, readDb, writeDb, integrationConfigService, cardTerminalProvider, mercadoPagoReferenceMatches, applyPointPaymentStatus, logEvent
});

const handlePointPrintFailureResolution = createPointPrintFailureResolutionHandler({
  readBody, pointPaymentOrders, sendJson, ensureAdminAction, withCriticalMutation,
  readDb, writeDb, integrationConfigService, cardTerminalProvider,
  releaseConcessionReservation, appendOrderAudit, logEvent,
  broadcastReleasedOrderSeats
});

const handlePointLocalPrintResult = createPointLocalPrintResultHandler({
  readBody, withCriticalMutation, readDb, writeDb, sendJson,
  pointPaymentOrders, orderTickets, finalizePrintedOrders, logEvent
});

function boxOfficeOrdersForAutomaticPrint(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter((order) => (
    order?.saleMode === "quick" ||
    order?.saleMode === "concession_counter" ||
    (order?.saleMode === "guest" && String(order.ticketDeliveryMethod || "physical") === "physical")
  ));
}

function boxOfficeTicketDeliveryMethod(saleMode, requestedMethod) {
  if (saleMode === "registered") return "online";
  if (["quick", "concession_counter"].includes(saleMode)) return "physical";
  return requestedMethod === "online" ? "online" : "physical";
}

function shouldDeliverBoxOfficeTicketsByEmail(order) {
  return Boolean(order?.customerEmail) && boxOfficeTicketDeliveryMethod(order?.saleMode, order?.ticketDeliveryMethod) === "online";
}

async function deliverBoxOfficeTicketsBySelectedMethod(db, order, tickets) {
  if (!shouldDeliverBoxOfficeTicketsByEmail(order) || !tickets?.length) {
    return { method: order?.ticketDeliveryMethod || "physical", status: "not_requested", message: "" };
  }
  if (order.ticketDelivery?.status === "delivered") return order.ticketDelivery;
  const groupedTickets = tickets.reduce((groups, ticket) => {
    const key = String(ticket.customerUserId || order.customerUserId || "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ticket);
    return groups;
  }, new Map());
  const deliveries = await Promise.all([...groupedTickets.entries()].map(async ([userId, customerTickets]) => {
    const customer = (db.users || []).find((user) => String(user.id) === userId && user.active !== false);
    const firstTicket = customerTickets[0] || {};
    return deliverTicketsByEmail(db, {
      ...order,
      concessionItems: String(userId) === String(order.customerUserId || "") ? order.concessionItems : [],
      customerUserId: customer?.id || firstTicket.customerUserId || order.customerUserId,
      customerName: customer?.name || firstTicket.customerName || order.customerName,
      customerEmail: customer?.email || firstTicket.customerEmail || order.customerEmail,
      customerPhone: customer?.phone || firstTicket.customerPhone || order.customerPhone,
      customerCpf: customer?.cpf || firstTicket.customerCpf || order.customerCpf
    }, customerTickets);
  }));
  const delivered = deliveries.length > 0 && deliveries.every(Boolean);
  if (delivered) order.emailDeliveredAt = new Date().toISOString();
  order.ticketDelivery = {
    method: "online",
    status: delivered ? "delivered" : "failed",
    processedAt: new Date().toISOString(),
    message: delivered
      ? groupedTickets.size > 1
        ? `Os ingressos digitais e PDFs foram enviados para ${groupedTickets.size} clientes.`
        : "Os ingressos digitais e PDFs foram enviados por e-mail."
      : "Os ingressos foram emitidos, mas ao menos um e-mail não pôde ser entregue."
  };
  return order.ticketDelivery;
}

async function queueBoxOfficePointPrint(db, orders, tickets, config, context = {}) {
  const printableOrders = boxOfficeOrdersForAutomaticPrint(orders);
  const printableOrderIds = new Set(printableOrders.map((order) => order.id));
  const printableTickets = (Array.isArray(tickets) ? tickets : []).filter((ticket) => printableOrderIds.has(ticket.orderId));
  const existingPrint = printableOrders.find((order) => ["queued", "on_terminal", "printed"].includes(String(order.pointPrint?.status || "")))?.pointPrint;
  if (!context.forceRetry && existingPrint && printableOrders.every((order) => ["queued", "on_terminal", "printed"].includes(String(order.pointPrint?.status || "")))) {
    return { requested: true, ...existingPrint, message: "A impressão desta venda já foi enviada para a Point." };
  }
  const printableConcessionCount = printableOrders.reduce((sum, order) => sum + (order.concessionItems || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  if (!printableOrders.length || (!printableTickets.length && !printableConcessionCount)) {
    return { requested: false, status: "not_requested", terminalId: "", actionId: "", message: "" };
  }
  if (context.forceLocal || config?.pointTicketPrintEnabled === false) {
    const localPrint = {
      requested: false,
      status: "local_required",
      mode: "local",
      jobId: crypto.randomUUID(),
      terminalId: "",
      actionId: "",
      message: context.forceLocal
        ? "A venda será impressa na impressora térmica padrão deste computador."
        : "A impressão de ingressos pela Point está desativada. O aplicativo do painel usará a impressora térmica deste computador."
    };
    printableOrders.forEach((order) => { order.pointPrint = { ...localPrint }; });
    return localPrint;
  }
  if (!cardTerminalProvider.configured(config)) {
    return {
      requested: false,
      status: "not_configured",
      terminalId: "",
      actionId: "",
      message: "A venda foi concluída, mas o Mercado Pago Point não está habilitado para impressão automática."
    };
  }

  const batchId = String(context.batchId || printableOrders[0]?.batchId || Date.now());
  const previousPrint = printableOrders[0]?.pointPrint || {};
  const attempt = context.forceRetry && previousPrint.actionId
    ? Math.max(1, Number(previousPrint.attempt || 0) + 1)
    : Math.max(0, Number(previousPrint.attempt || 0));
  const printReference = attempt ? `print-${batchId}-${attempt}` : `print-${batchId}`;
  const paymentMethod = String(context.paymentMethod || printableOrders[0]?.paymentMethod || "");
  try {
    const printAction = await cardTerminalProvider.createTicketPrint(
      printableTickets.map((ticket) => enrichTicket(db, ticket)),
      config,
      {
        orders: printableOrders,
        externalReference: printReference,
        idempotencyKey: printReference,
        cinemaName: String(db.settings?.cinemaName || db.settings?.name || "Cinema").trim()
      }
    );
    const pointPrint = {
      requested: true,
      status: "queued",
      mode: "point",
      attempt,
      terminalId: printAction.terminalId,
      actionId: printAction.id,
      requestedAt: new Date().toISOString(),
      ticketCount: printableTickets.length,
      concessionItemCount: printableOrders.reduce((sum, order) => sum + (order.concessionItems || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0),
      message: printableTickets.length
        ? "Ingressos e itens da bomboniere foram enviados para impressão na Point."
        : "O comprovante da bomboniere foi enviado para impressão na Point."
    };
    printableOrders.forEach((order) => { order.pointPrint = { ...pointPrint }; });
    logEvent("info", "box_office_ticket_print.queued", {
      actionId: printAction.id,
      terminalId: printAction.terminalId,
      orderIds: printableOrders.map((order) => order.id),
      ticketIds: printableTickets.map((ticket) => ticket.id),
      concessionItemCount: pointPrint.concessionItemCount,
      paymentMethod,
      createdBy: context.adminUser?.id || ""
    });
    return pointPrint;
  } catch (error) {
    const pointPrint = {
      requested: true,
      status: "failed",
      mode: "point",
      attempt,
      terminalId: String(config?.pointTerminalId || config?.pointDeviceId || ""),
      actionId: "",
      requestedAt: new Date().toISOString(),
      code: error.code || "POINT_PRINT_FAILED",
      message: `A venda foi concluída, mas a Point não recebeu a impressão: ${error.message}`
    };
    printableOrders.forEach((order) => { order.pointPrint = { ...pointPrint }; });
    logEvent("warn", "box_office_ticket_print.failed", {
      code: pointPrint.code,
      message: error.message,
      terminalId: pointPrint.terminalId,
      orderIds: printableOrders.map((order) => order.id),
      ticketIds: printableTickets.map((ticket) => ticket.id),
      paymentMethod,
      createdBy: context.adminUser?.id || ""
    });
    return pointPrint;
  }
}

async function syncBoxOfficePointPrint(orders = [], config = {}) {
  const print = (orders || []).find((order) => order?.pointPrint?.actionId)?.pointPrint;
  if (!print?.actionId || !["queued", "on_terminal"].includes(String(print.status || ""))) return print || null;
  const requestedAt = new Date(print.requestedAt || 0).getTime();
  const timeoutMs = Math.min(10 * 60 * 1000, Math.max(30000, Number(config.pointPrintTimeout || 120000)));
  if (requestedAt && Date.now() - requestedAt >= timeoutMs) {
    const timedOut = {
      ...print,
      status: "timed_out",
      checkedAt: new Date().toISOString(),
      message: "A Point não confirmou a impressão dentro do tempo limite. Imprima pela térmica conectada ao computador para não deixar o cliente sem ingresso."
    };
    orders.forEach((order) => { if (order?.pointPrint?.actionId === print.actionId) order.pointPrint = { ...timedOut }; });
    return timedOut;
  }
  try {
    const action = await cardTerminalProvider.getPrintStatus(print.actionId, config);
    const synced = {
      ...print,
      status: action.status === "printed" ? "printed" : action.providerStatus === "on_terminal" ? "on_terminal" : action.status,
      providerStatus: action.providerStatus,
      statusDetail: action.statusDetail,
      checkedAt: new Date().toISOString(),
      message: action.status === "printed"
        ? "A Point confirmou a impressão do ingresso."
        : action.status === "failed"
          ? "A Point não concluiu a impressão. Use a térmica conectada ao computador."
          : action.providerStatus === "on_terminal"
            ? "A impressão chegou à Point e aguarda confirmação final."
            : "A impressão continua na fila da Point."
    };
    orders.forEach((order) => { if (order?.pointPrint?.actionId === print.actionId) order.pointPrint = { ...synced }; });
    return synced;
  } catch (error) {
    return {
      ...print,
      checkedAt: new Date().toISOString(),
      connectionError: error.message,
      message: "A confirmação da impressão está reconectando. A cobrança não será repetida."
    };
  }
}

function findSubscriptionPayment(db, subscriptionId, method = "") {
  return (db.payments || []).find((payment) =>
    payment.metadata?.kind === "club_subscription" &&
    payment.metadata?.subscriptionId === subscriptionId &&
    (!method || payment.method === method) &&
    !["approved", "expired", "cancelled", "rejected", "refunded"].includes(String(payment.status || ""))
  ) || null;
}

function activateSubscriptionFromPayment(db, subscription, payment, actor = "mercado_pago_order_webhook") {
  if (!subscription) return null;
  if (subscription.status === "active" && currentSubscriptionCredit(db, subscription)) return refreshSubscriptionCredits(db, subscription);
  subscription.status = "active";
  subscription.paymentStatus = "approved";
  subscription.provider = subscription.provider || "mercado_pago";
  subscription.providerStatus = payment?.status || subscription.providerStatus || "approved";
  subscription.providerPaymentId = payment?.providerPaymentId || subscription.providerPaymentId || "";
  subscription.approvedAt ||= payment?.approvedAt || new Date().toISOString();
  subscription.startedAt ||= subscription.approvedAt;
  subscription.paymentExpiredAt = "";
  subscription.updatedAt = new Date().toISOString();
  if (!currentSubscriptionCredit(db, subscription)) {
    const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
    if (plan) createSubscriptionCreditCycle(db, subscription, plan, new Date(), payment);
  }
  subscription.history ||= [];
  subscription.history.push({
    action: "payment_approved",
    by: actor,
    paymentId: payment?.id || "",
    providerPaymentId: payment?.providerPaymentId || "",
    at: subscription.approvedAt
  });
  return refreshSubscriptionCredits(db, subscription);
}

function failSubscriptionFromPayment(db, subscription, payment, status, actor = "mercado_pago_order_webhook") {
  if (!subscription || subscription.status === "active") return subscription;
  const now = new Date().toISOString();
  const terminalStatus = status === "expired" || status === "cancelled" ? "cancelled" : "payment_failed";
  subscription.status = terminalStatus;
  subscription.paymentStatus = status === "expired" ? "expired" : status === "cancelled" ? "cancelled" : "failed";
  subscription.providerStatus = status || subscription.providerStatus || "";
  subscription.cancelledAt ||= terminalStatus === "cancelled" ? now : "";
  subscription.paymentExpiredAt = status === "expired" ? now : subscription.paymentExpiredAt || "";
  subscription.nextBillingAt = "";
  subscription.creditsAvailable = 0;
  subscription.creditsUsed = 0;
  subscription.updatedAt = now;
  subscription.history ||= [];
  subscription.history.push({
    action: "payment_not_approved",
    by: actor,
    status,
    paymentId: payment?.id || "",
    providerPaymentId: payment?.providerPaymentId || "",
    at: now
  });
  return refreshSubscriptionCredits(db, subscription);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signWalletJwt(claims, privateKey) {
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedBody = base64Url(JSON.stringify(claims));
  const payload = `${encodedHeader}.${encodedBody}`;
  const signature = crypto.createSign("RSA-SHA256").update(payload).sign(privateKey, "base64url");
  return `${payload}.${signature}`;
}

function googleWalletLocalized(value) {
  return { defaultValue: { language: "pt-BR", value: String(value || "") } };
}

function walletEventTicketObjectForTicket(db, ticket, user, req) {
  const config = getGoogleWalletConfig(db);
  const enriched = enrichTicket(db, ticket);
  const walletPosterUrl = googleWalletTmdbImageUrl(movieForTicket(db, ticket));
  const objectId = googleWalletObjectId(config, ticket);
  const sessionStart = new Date(`${enriched.sessionDate || ""}T${enriched.sessionTime || "00:00"}:00-03:00`);
  const archiveAt = new Date(enriched.archiveAt || "");
  const validTimeInterval = Number.isFinite(sessionStart.getTime())
    ? {
        start: { date: sessionStart.toISOString() },
        end: {
          date: (Number.isFinite(archiveAt.getTime()) && archiveAt > sessionStart
            ? archiveAt
            : new Date(sessionStart.getTime() + 24 * 60 * 60 * 1000)).toISOString()
        }
      }
    : undefined;
  const frontendUrl = getGoogleOAuthConfig(req, db).frontendUrl;
  const seatLabel = String(enriched.seat || "").trim();
  const seatRow = seatLabel.match(/^[A-Za-z]+/)?.[0] || "";

  return {
    id: objectId,
    classId: config.classId,
    state: enriched.status === "active" ? "ACTIVE" : "INACTIVE",
    heroImage: walletPosterUrl ? {
      sourceUri: { uri: walletPosterUrl },
      contentDescription: googleWalletLocalized(`Poster de ${enriched.movieTitle || "filme"}`)
    } : undefined,
    imageModulesData: [],
    hexBackgroundColor: "#0b1424",
    ticketHolderName: user.name || enriched.customerName || "Cliente",
    ticketNumber: enriched.displayCode,
    ticketType: googleWalletLocalized(enriched.ticketType || "Ingresso"),
    seatInfo: seatLabel ? {
      seat: googleWalletLocalized(seatLabel),
      ...(seatRow ? { row: googleWalletLocalized(seatRow) } : {})
    } : undefined,
    reservationInfo: {
      confirmationCode: String(enriched.orderId || ticket.orderId || enriched.displayCode || ticket.id)
    },
    barcode: {
      type: "QR_CODE",
      value: enriched.displayQrPayload,
      alternateText: enriched.displayCode
    },
    validTimeInterval,
    textModulesData: buildGoogleWalletTextModules(enriched),
    linksModuleData: {
      uris: [
        {
          id: "conta",
          uri: `${frontendUrl}/conta/ingressos`,
          description: "Meus ingressos"
        }
      ]
    }
  };
}

async function syncGoogleWalletEventTicketObject(config, eventTicketObject) {
  try {
    await googleWalletApiGet(`/eventTicketObject/${encodeURIComponent(eventTicketObject.id)}`, config);
    const { id, classId, ...mutableFields } = eventTicketObject;
    await googleWalletApiPatch(
      `/eventTicketObject/${encodeURIComponent(eventTicketObject.id)}`,
      config,
      mutableFields
    );
    return "updated";
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    await googleWalletApiRequest("/eventTicketObject", config, {
      method: "POST",
      body: eventTicketObject
    });
    return "created";
  }
}

const walletClassReadiness = new Map();

async function googleWalletSaveUrl(db, ticket, user, req) {
  const config = getGoogleWalletConfig(db);
  if (!config.configured) {
    const error = new Error("Configure GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_CLASS_ID e credenciais da service account para habilitar Google Wallet.");
    error.statusCode = 412;
    throw error;
  }
  const enriched = enrichTicket(db, ticket);
  if (enriched.status !== "active") {
    const error = new Error("Google Wallet esta disponivel apenas para ingressos validos.");
    error.statusCode = 409;
    throw error;
  }
  if (process.env.NEXT_PUBLIC_CINEMA_SLUG === "cinecruzeiro"
    && config.classId === `${config.issuerId}.cine_cruzeiro_ingressos`
    && Date.now() - (walletClassReadiness.get(config.classId) || 0) > 60 * 60 * 1000) {
    const readiness = await testGoogleWalletIntegration(db);
    if (!readiness.ok) {
      const error = new Error(readiness.message || "A classe de ingresso do Cine Cruzeiro não está pronta no Google Wallet.");
      error.statusCode = 502;
      throw error;
    }
    walletClassReadiness.set(config.classId, Date.now());
  }
  const eventTicketObject = walletEventTicketObjectForTicket(db, ticket, user, req);
  const syncAction = String(process.env.GOOGLE_WALLET_SYNC_OBJECTS || "true").toLowerCase() === "false"
    ? "skipped"
    : await syncGoogleWalletEventTicketObject(config, eventTicketObject);
  const claims = {
    iss: config.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: config.origins,
    payload: {
      eventTicketObjects: [eventTicketObject]
    }
  };
  logEvent("info", "google_wallet.jwt.generated", {
    issuerId: config.issuerId,
    classId: config.classId,
    objectId: eventTicketObject.id,
    clientEmail: config.clientEmail,
    origins: config.origins,
    passType: "eventTicketObjects",
    objectPreview: {
      syncAction,
      state: eventTicketObject.state,
      movieTitle: enriched.movieTitle || "",
      ticketType: eventTicketObject.ticketType?.defaultValue?.value || "",
      barcodeType: eventTicketObject.barcode?.type || "",
      hasHeroImage: Boolean(eventTicketObject.heroImage),
      hasPoster: Boolean(eventTicketObject.imageModulesData?.length)
    }
  });
  return `https://pay.google.com/gp/v/save/${signWalletJwt(claims, config.privateKey)}`;
}

function finalizePaidOrder(db, order, payment, source = "online") {
  const existingTickets = (db.tickets || []).filter((ticket) => ticket.orderId === order?.id);
  if (order?.refundStatus === "pending" || order?.refundStatus === "completed") return existingTickets;
  if (!order || (order.status === "paid" && existingTickets.length > 0)) {
    return existingTickets;
  }
  if (payment) {
    payment.status = "approved";
    payment.approvedAt = payment.approvedAt || new Date().toISOString();
    payment.updatedAt = new Date().toISOString();
  }
  const wasPendingPrint = order.status === "paid_pending_print";
  order.status = "paid";
  order.paymentStatus = payment ? "approved" : "not_required";
  order.paidAt = order.paidAt || new Date().toISOString();
  const tickets = Array.isArray(order.pendingPrintTickets)
    ? order.pendingPrintTickets.map((ticket) => ({ ...ticket, status: "active" }))
    : buildTicketsForOrder(order, db, source);
  if (!order.clubCreditPending) {
    const unitPrices = ticketUnitPricesForOrder(order);
    const serviceItems = tickets.map((ticket, index) => {
      const basePrice = Number(unitPrices[index] || 0);
      ticket.basePrice = basePrice;
      ticket.additionalPaymentAmount = source === "courtesy" ? 0 : basePrice;
      return {
        id: `servico-${order.id}-${index + 1}`,
        orderId: order.id,
        ticketId: ticket.id,
        itemId: ticket.id,
        name: ticket.ticketType || "Ingresso",
        quantity: 1,
        unitPrice: basePrice,
        basePrice,
        subscriptionCreditAmount: 0,
        additionalPaymentAmount: ticket.additionalPaymentAmount,
        paymentSource: ticket.paymentSource,
        subscriptionCreditId: "",
        createdAt: new Date().toISOString()
      };
    });
    db.orderServiceItems = (db.orderServiceItems || []).filter((item) => item.orderId !== order.id).concat(serviceItems);
  }
  order.ticketCodes = tickets.map((ticket) => ticket.code);
  if (order.saleMode === "concession_counter") {
    const fulfilledAt = new Date().toISOString();
    order.concessionItems = (order.concessionItems || []).map((item) => ({
      ...item,
      fulfilledQuantity: Number(item.quantity || 0),
      fulfilledAt: item.fulfilledAt || fulfilledAt
    }));
    order.concessionDeliveryStatus = "delivered";
    order.concessionStatus = "fulfilled";
    order.concessionsFulfilledAt ||= fulfilledAt;
    order.concessionsFulfilledBy ||= order.createdBy || "counter_sale";
    materializeOrderAccounting(db, order);
  }
  confirmConcessionStock(db, order);
  db.tickets.unshift(...tickets);
  if (order.customerEmail && tickets.length && source !== "promotional" &&
      (!["box_office", "courtesy"].includes(source) || shouldDeliverBoxOfficeTicketsByEmail(order))) {
    order.ticketEmailRequested = true;
  }
  delete order.pendingPrintTickets;
  if (wasPendingPrint) {
    order.printFulfillment = {
      ...(order.printFulfillment || {}),
      status: "printed",
      completedAt: new Date().toISOString(),
      ticketCount: tickets.length
    };
  }
  return tickets;
}

function finalizePrintedOrders(db, orders = [], fallbackPayment = null) {
  const tickets = [];
  const newlyPaidOrders = [];
  for (const order of orders) {
    const wasPaid = order.status === "paid";
    const payment = (db.payments || []).find((item) => item.id === order.paymentId) || fallbackPayment || orderPayment(db, order.id);
    const source = payment?.method === "courtesy" ? "courtesy" : "box_office";
    const orderTickets = finalizePaidOrder(db, order, payment, source);
    tickets.push(...orderTickets);
    if (!wasPaid && order.status === "paid") newlyPaidOrders.push(order);
  }
  return { orders, tickets, newlyPaidOrders };
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(res, filename, headers, rows) {
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const store = requestContext.getStore();
  res.writeHead(200, {
    ...securityHeaders(),
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": responseCorsOrigin(store?.req),
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  });
  res.end(csv);
}

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).format(date);
}

function billingCycleStart(date = new Date()) {
  const base = new Date(date);
  return new Date(base.getTime()).toISOString();
}

function nextMonthIso(date = new Date()) {
  const base = new Date(date);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds())).toISOString();
}

function billingCycleEnd(date = new Date()) {
  return nextMonthIso(date);
}

function normalizeSubscriptionPlan(input, existing = {}) {
  const name = String(input.name || existing.name || "Plano do Clube").trim();
  const monthlyPrice = Number(input.monthlyPrice ?? input.priceMonthly ?? input.price ?? existing.monthlyPrice ?? existing.price ?? 0);
  const includedTickets = Math.max(0, Number(input.includedTickets ?? input.creditsPerMonth ?? input.ticketsPerCycle ?? existing.includedTickets ?? existing.ticketsPerCycle ?? 0));
  const normalizePercent = (value) => Math.min(90, Math.max(0, Number(value || 0)));
  const freeConcessionItems = (Array.isArray(input.freeConcessionItems) ? input.freeConcessionItems : existing.freeConcessionItems || [])
    .map((item) => ({
      concessionId: String(item.concessionId || item.id || "").trim(),
      quantityPerCycle: Math.min(20, Math.max(1, Math.floor(Number(item.quantityPerCycle || item.quantity || 1))))
    }))
    .filter((item, index, items) => item.concessionId && items.findIndex((candidate) => candidate.concessionId === item.concessionId) === index);
  const rawBenefits = Array.isArray(input.benefits)
    ? input.benefits
    : String(input.benefits || existing.benefits || "").split(/\n|,/);
  const benefits = rawBenefits
    .map((item) => String(item).trim().replace(/\bgratis\b/gi, "grátis"))
    .filter((item, index, items) => item && items.findIndex((candidate) => candidate.toLocaleLowerCase("pt-BR") === item.toLocaleLowerCase("pt-BR")) === index);
  const uniqueIds = (value, fallback = []) => [...new Set((Array.isArray(value) ? value : fallback).map((item) => String(item || "").trim()).filter(Boolean))];
  const nullableNonNegative = (value, fallback = null) => {
    if (value === "" || value === null) return null;
    if (value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
  };
  const accountingInput = input.accounting && typeof input.accounting === "object" ? input.accounting : existing.accounting || {};
  const accountingEffectiveFrom = String(accountingInput.effectiveFrom || existing.accounting?.effectiveFrom || "").trim();
  const accountingEffectiveDate = accountingEffectiveFrom ? new Date(accountingEffectiveFrom) : null;
  return {
    id: String(input.id || existing.id || slugify(name) || `plano-${Date.now()}`),
    name,
    monthlyPrice,
    price: monthlyPrice,
    includedTickets,
    ticketsPerCycle: includedTickets,
    billingCycle: input.billingCycle || input.billing_cycle || existing.billingCycle || "monthly",
    benefits,
    ticketDiscountPercent: normalizePercent(input.ticketDiscountPercent ?? existing.ticketDiscountPercent),
    concessionDiscountPercent: normalizePercent(input.concessionDiscountPercent ?? existing.concessionDiscountPercent),
    freeConcessionItems,
    creditReferenceValue: nullableNonNegative(input.creditReferenceValue, existing.creditReferenceValue ?? null),
    creditValidityDays: nullableNonNegative(input.creditValidityDays, existing.creditValidityDays ?? null),
    allowCreditRollover: input.allowCreditRollover !== undefined ? Boolean(input.allowCreditRollover) : Boolean(existing.allowCreditRollover),
    maxAccumulatedCredits: nullableNonNegative(input.maxAccumulatedCredits, existing.maxAccumulatedCredits ?? null),
    gracePeriodDays: Math.floor(nullableNonNegative(input.gracePeriodDays, existing.gracePeriodDays ?? 0) || 0),
    allowPriceDifference: input.allowPriceDifference !== undefined ? Boolean(input.allowPriceDifference) : existing.allowPriceDifference !== false,
    excludedConcessionIds: uniqueIds(input.excludedConcessionIds, existing.excludedConcessionIds || []),
    eligibleFormats: uniqueIds(input.eligibleFormats, existing.eligibleFormats || []),
    eligibleSessionIds: uniqueIds(input.eligibleSessionIds, existing.eligibleSessionIds || []),
    cancellationRules: input.cancellationRules && typeof input.cancellationRules === "object" ? input.cancellationRules : existing.cancellationRules || {},
    accounting: {
      ticketComponentValue: nullableNonNegative(accountingInput.ticketComponentValue, existing.accounting?.ticketComponentValue ?? null),
      benefitsComponentValue: nullableNonNegative(accountingInput.benefitsComponentValue, existing.accounting?.benefitsComponentValue ?? null),
      ruleVersion: String(accountingInput.ruleVersion || existing.accounting?.ruleVersion || "").trim(),
      effectiveFrom: accountingEffectiveDate && Number.isFinite(accountingEffectiveDate.getTime()) ? accountingEffectiveDate.toISOString() : ""
    },
    imageUrl: input.imageUrl !== undefined ? storedLocalUploadUrl(input.imageUrl) : storedLocalUploadUrl(existing.imageUrl || ""),
    isFeatured: input.isFeatured !== undefined ? Boolean(input.isFeatured) : Boolean(existing.isFeatured || existing.featured),
    displayOrder: Math.min(999, Math.max(0, Math.floor(Number(input.displayOrder ?? input.sortOrder ?? existing.displayOrder ?? existing.sortOrder ?? 100) || 0))),
    providerPlanId: String(input.providerPlanId || input.mercadoPagoPlanId || existing.providerPlanId || existing.mercadoPagoPlanId || "").trim(),
    mercadoPagoPlanId: String(input.mercadoPagoPlanId || input.providerPlanId || existing.mercadoPagoPlanId || existing.providerPlanId || "").trim(),
    active: input.active !== undefined ? Boolean(input.active) : existing.active !== false,
    createdAt: existing.createdAt || input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function persistPlanAccountingRule(db, plan, previous, adminUser) {
  const next = plan.accounting || {};
  const before = previous?.accounting || {};
  if (JSON.stringify(next) === JSON.stringify(before)) return;
  if (roleAlias(adminUser?.role) !== "owner") {
    const error = new Error("Somente o proprietário pode alterar regras contábeis do Clube.");
    error.statusCode = 403;
    error.code = "OWNER_REQUIRED";
    throw error;
  }
  const hasValues = next.ticketComponentValue !== null || next.benefitsComponentValue !== null;
  if (!hasValues && !next.ruleVersion && !next.effectiveFrom) return;
  if (!next.ruleVersion || !next.effectiveFrom || Number.isNaN(new Date(next.effectiveFrom).getTime())) {
    const error = new Error("Informe a versão e a vigência da regra contábil orientada pelo contador.");
    error.statusCode = 400;
    error.code = "ACCOUNTING_RULE_VERSION_REQUIRED";
    throw error;
  }
  db.subscriptionAccountingRules ||= [];
  const duplicate = db.subscriptionAccountingRules.find((item) => item.planId === plan.id && item.ruleVersion === next.ruleVersion);
  if (duplicate) {
    const error = new Error("Esta versão contábil já existe e não pode ser sobrescrita.");
    error.statusCode = 409;
    error.code = "ACCOUNTING_RULE_VERSION_EXISTS";
    throw error;
  }
  db.subscriptionAccountingRules.unshift({
    id: `regra-contabil-${plan.id}-${slugify(next.ruleVersion) || Date.now()}`,
    planId: plan.id,
    ruleVersion: next.ruleVersion,
    effectiveFrom: new Date(next.effectiveFrom).toISOString(),
    ticketComponentValue: next.ticketComponentValue,
    benefitsComponentValue: next.benefitsComponentValue,
    configuration: { source: "owner_panel", reviewedByAccountant: false },
    createdBy: adminUser?.id || "",
    createdAt: new Date().toISOString()
  });
}

function subscriptionStatusLabel(status = "") {
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

function currentSubscriptionCredit(db, subscription, now = new Date()) {
  const timestamp = now.getTime();
  return (db.subscriptionCredits || [])
    .filter((credit) => credit.subscriptionId === subscription.id)
    .find((credit) => new Date(credit.cycleStart).getTime() <= timestamp && new Date(credit.cycleEnd).getTime() > timestamp) || null;
}

function syncSubscriptionCreditMirror(subscription, credit) {
  subscription.currentCreditId = credit?.id || "";
  subscription.currentPeriodKey = credit?.cycleStart ? monthKey(new Date(credit.cycleStart)) : subscription.currentPeriodKey || "";
  subscription.currentPeriodStart = credit?.cycleStart || subscription.currentPeriodStart || "";
  subscription.currentPeriodEnd = credit?.cycleEnd || subscription.currentPeriodEnd || "";
  subscription.cycleStart = subscription.currentPeriodStart;
  subscription.cycleEnd = subscription.currentPeriodEnd;
  subscription.creditsAvailable = Number(credit?.remaining || 0);
  subscription.creditsUsed = Number(credit?.used || 0);
  return subscription;
}

function createSubscriptionCreditCycle(db, subscription, plan, now = new Date(), payment = null) {
  db.subscriptionCredits ||= [];
  const cycleStart = billingCycleStart(now);
  const cycleEnd = billingCycleEnd(now);
  const total = Number(plan.includedTickets ?? plan.ticketsPerCycle ?? 0);
  const credit = {
    id: `credito-clube-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    subscriptionId: subscription.id,
    cycleStart,
    cycleEnd,
    total,
    used: 0,
    remaining: total,
    rolloverFromId: "",
    metadata: { rolloverPolicy: "none" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.subscriptionCredits.unshift(credit);
  clubDomainService.issueCycle(db, {
    subscription,
    plan,
    payment,
    cycleStart,
    cycleEnd,
    idempotencyKey: `subscription-cycle:${subscription.id}:${payment?.providerPaymentId || payment?.id || cycleStart}`,
    now
  });
  subscription.startedAt ||= new Date().toISOString();
  subscription.cycleStart = cycleStart;
  subscription.cycleEnd = cycleEnd;
  subscription.nextBillingAt = isManualSubscription(subscription) ? "" : cycleEnd;
  subscription.currentPeriodKey = monthKey(now);
  subscription.currentPeriodStart = cycleStart;
  subscription.currentPeriodEnd = cycleEnd;
  subscription.renewedAt = new Date().toISOString();
  syncSubscriptionCreditMirror(subscription, credit);
  return credit;
}

function isManualSubscription(subscription = {}) {
  return ["manual_admin", "migration"].includes(String(subscription.provider || ""))
    || subscription.billingMode === "manual"
    || subscription.autoRenew === false;
}

function ensureDetailedSubscriptionCycle(db, subscription, plan, credit) {
  if (!credit || !plan) return null;
  const existing = (db.subscriptionCycles || []).find((cycle) => cycle.subscriptionId === subscription.id && cycle.cycleStart === credit.cycleStart);
  if (existing) return existing;
  return clubDomainService.issueCycle(db, {
    subscription,
    plan,
    cycleStart: credit.cycleStart,
    cycleEnd: credit.cycleEnd,
    idempotencyKey: `legacy-credit-cycle:${credit.id}`,
    now: new Date(credit.createdAt || credit.cycleStart)
  });
}

function refreshSubscriptionCredits(db, subscription, now = new Date()) {
  const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
  if (!plan) return subscription;
  let credit = currentSubscriptionCredit(db, subscription, now);
  const status = String(subscription.status || "");
  const manuallyManaged = isManualSubscription(subscription);
  if (!credit && !db.subscriptionCredits?.some((item) => item.subscriptionId === subscription.id) && status === "active" && manuallyManaged) {
    credit = createSubscriptionCreditCycle(db, subscription, plan, now);
  }
  if (!credit && status === "active" && manuallyManaged) {
    subscription.status = "ended";
    subscription.endedAt ||= now.toISOString();
    subscription.creditsAvailable = 0;
    subscription.nextBillingAt = "";
    subscription.updatedAt = now.toISOString();
    return subscription;
  }
  if (!credit && subscription.status === "ending") {
    subscription.status = "ended";
    subscription.endedAt ||= now.toISOString();
    subscription.creditsAvailable = 0;
    subscription.nextBillingAt = "";
    return subscription;
  }
  if (credit) ensureDetailedSubscriptionCycle(db, subscription, plan, credit);
  return syncSubscriptionCreditMirror(subscription, credit);
}

function subscriptionCanUseCredit(subscription, now = new Date()) {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  if (subscription.status === "ending") {
    const benefitsUntil = subscription.benefitsUntil || subscription.currentPeriodEnd || subscription.cycleEnd || "";
    return Boolean(benefitsUntil && new Date(benefitsUntil).getTime() > now.getTime());
  }
  return false;
}

function activeSubscriptionForUser(db, userId) {
  const now = new Date();
  const subscriptions = (db.subscriptions || [])
    .filter((item) => item.userId === userId && subscriptionCanUseCredit(item, now))
    .map((item) => refreshSubscriptionCredits(db, item, now));
  return subscriptions.find((item) => Number(item.creditsAvailable || 0) > 0) || subscriptions[0] || null;
}

function subscriptionBlocksNewPlan(subscription, now = new Date()) {
  if (!subscription) return false;
  const status = String(subscription.status || "");
  if (["pending_payment", "active", "paused", "ending"].includes(status)) return true;
  return false;
}

function blockingSubscriptionForUser(db, userId) {
  const now = new Date();
  return (db.subscriptions || [])
    .filter((item) => item.userId === userId)
    .map((item) => refreshSubscriptionCredits(db, item, now))
    .find((item) => subscriptionBlocksNewPlan(item, now)) || null;
}

function createSubscription(db, userId, planId, adminUser, status = "pending_payment", provider = "external_pending") {
  const plan = (db.subscriptionPlans || []).find((item) => item.id === planId && item.active !== false);
  if (!plan) {
    const error = new Error("Plano do Clube nao encontrado ou inativo.");
    error.statusCode = 404;
    throw error;
  }
  const existing = (db.subscriptions || []).find((item) => item.userId === userId && item.planId === planId && ["pending_payment", "active", "paused"].includes(item.status));
  if (existing) {
    const now = new Date();
    existing.status = status;
    existing.updatedAt = now.toISOString();
    existing.provider = existing.provider || provider;
    existing.billingMode ||= provider === "manual_admin" ? "manual" : "automatic";
    if (provider === "manual_admin") {
      existing.autoRenew = false;
      if (status === "active") existing.paymentStatus = "not_required";
    }
    if (status === "pending_payment") {
      existing.paymentStatus = "pending";
      existing.paymentExpiresAt = new Date(now.getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS).toISOString();
      existing.paymentExpiredAt = "";
    }
    existing.history ||= [];
    existing.history.push({ action: status === "active" ? "activate" : "status", status, by: adminUser?.id || userId || "", at: now.toISOString() });
    if (status === "active" && !currentSubscriptionCredit(db, existing)) {
      createSubscriptionCreditCycle(db, existing, plan);
    } else if (status !== "active") {
      existing.creditsAvailable = 0;
    }
    return refreshSubscriptionCredits(db, existing);
  }
  const now = new Date();
  const subscription = {
    id: `assinatura-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId,
    planId,
    status,
    provider,
    billingMode: provider === "manual_admin" ? "manual" : "automatic",
    autoRenew: provider !== "manual_admin",
    providerSubscriptionId: "",
    cycleStart: "",
    cycleEnd: "",
    nextBillingAt: "",
    startedAt: status === "active" ? new Date().toISOString() : "",
    currentPeriodKey: "",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    creditsAvailable: 0,
    creditsUsed: 0,
    paymentStatus: status === "active" ? (provider === "manual_admin" ? "not_required" : "approved") : "pending",
    paymentExpiresAt: status === "pending_payment" ? new Date(now.getTime() + SUBSCRIPTION_PENDING_PAYMENT_TTL_MS).toISOString() : "",
    paymentExpiredAt: "",
    cancelAtPeriodEnd: false,
    cancellationRequestedAt: "",
    billingCancelledAt: "",
    benefitsUntil: "",
    cancellationMode: "",
    reactivationBlocked: false,
    endedAt: "",
    createdBy: adminUser?.id || "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [{ action: status === "active" ? "assign" : "subscribe", by: adminUser?.id || userId || "", at: now.toISOString(), provider }]
  };
  db.subscriptions.unshift(subscription);
  if (status === "active") createSubscriptionCreditCycle(db, subscription, plan, now);
  return subscription;
}

function createManualSubscription(db, userId, planId, adminUser, status = "active") {
  return createSubscription(db, userId, planId, adminUser, status, "manual_admin");
}

function consumeSubscriptionCredit(db, subscription, context) {
  const credit = currentSubscriptionCredit(db, subscription);
  const quantity = Math.max(1, Number(context.quantity || 1));
  if (!credit || Number(credit.remaining || 0) < quantity) {
    const error = new Error("Creditos do Clube esgotados neste ciclo.");
    error.statusCode = 409;
    error.code = "CLUB_CREDITS_EXHAUSTED";
    throw error;
  }
  if (context.idempotencyKey && (db.subscriptionUsage || []).some((item) => item.idempotencyKey === context.idempotencyKey)) {
    const error = new Error("Uso duplicado do credito do Clube.");
    error.statusCode = 409;
    error.code = "CLUB_CREDIT_DUPLICATE";
    throw error;
  }
  credit.used = Number(credit.used || 0) + quantity;
  credit.remaining = Number(credit.remaining || 0) - quantity;
  credit.updatedAt = new Date().toISOString();
  syncSubscriptionCreditMirror(subscription, credit);
  const usage = {
    id: `uso-clube-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    subscriptionId: subscription.id,
    creditId: credit.id,
    userId: context.userId,
    ticketId: context.ticketId || "",
    orderId: context.orderId || "",
    movieId: context.movieId || "",
    sessionId: context.sessionId || "",
    monthKey: monthKey(new Date(credit.cycleStart)),
    cycleStart: credit.cycleStart,
    cycleEnd: credit.cycleEnd,
    creditsUsed: quantity,
    idempotencyKey: context.idempotencyKey || "",
    usedAt: new Date().toISOString()
  };
  db.subscriptionUsage ||= [];
  db.subscriptionUsage.unshift(usage);
  return usage;
}

const { reserveClubCreditsForOrder, consumePendingClubCredit, refundSubscriptionCreditForUsage } = createClubOrderCreditService({
  activeSubscriptionForUser, subscriptionCanUseCredit, assertClubPlanEligibility, ticketUnitPricesForOrder, clubDomainService, discountedTicketUnitsForOrder, summarizeClubCreditItems, consumeSubscriptionCredit, syncSubscriptionCreditMirror,
  creditBenefitLabel: "Crédito do Clube Cine Cruzeiro"
});

function materializeOrderAccounting(db, order) {
  const serviceSubtotal = Number(ticketSubtotalForOrder(db, order).toFixed(2));
  const goodsSubtotal = Number((order.concessionItems || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.originalPrice ?? item.unitPrice ?? 0), 0).toFixed(2));
  const goodsDiscount = Number((order.concessionItems || []).reduce((sum, item) => sum + Number(item.clubDiscount || 0), 0).toFixed(2));
  order.serviceSubtotal = serviceSubtotal;
  order.goodsSubtotal = goodsSubtotal;
  order.clubCreditsApplied = Number(order.clubCreditsApplied || 0);
  order.clubDiscount = Number((Number(order.clubBenefits?.ticketDiscount || 0) + goodsDiscount + Number(order.clubBenefits?.freeConcessionDiscount || 0)).toFixed(2));
  order.additionalPayment = Number(order.totalPrice || 0);
  order.serviceFiscalStatus = order.serviceFiscalStatus || "pending_accounting_rule";
  order.goodsFiscalTrigger = order.goodsFiscalTrigger || db.settings?.nfceTrigger || "goods_delivered";
  order.goodsItems = (order.concessionItems || []).map((item) => ({
    id: `mercadoria-${order.id}-${item.id}`,
    orderId: order.id,
    concessionId: item.id,
    sku: item.sku || "",
    name: item.name,
    quantity: Number(item.quantity || 0),
    originalUnitPrice: Number(item.originalPrice ?? item.unitPrice ?? 0),
    clubDiscount: Number(item.clubDiscount || 0),
    finalUnitPrice: Number(item.finalPrice ?? item.unitPrice ?? 0),
    metadata: {
      couponDiscount: Number(item.couponDiscount || 0),
      clubFreeDiscount: Number(item.clubFreeDiscount || 0)
    },
    createdAt: order.createdAt || new Date().toISOString()
  }));
  db.orderGoodsItems = (db.orderGoodsItems || []).filter((item) => item.orderId !== order.id).concat(order.goodsItems);
  goodsFiscalService.prepare(db, order, order.goodsFiscalTrigger);
  return order;
}

const { clubSavingsSummary, activeClubPlanForBenefits, reservedFreeConcessionQuantity, applyClubPlanBenefits } = createClubCheckoutBenefitsService({
  activeSubscriptionForUser, subscriptionCanUseCredit, currentSubscriptionCredit, ticketSubtotalForOrder, ticketUnitsForOrder, calculateCouponDiscountForAmounts, calculateClubTicketDiscount, clubDomainService
});

const subscriptionSummary = createClubSubscriptionSummary({
  refreshSubscriptionCredits,
  currentSubscriptionCredit,
  shortOrderReference,
  clubDomainService,
  reservedFreeConcessionQuantity,
  subscriptionStatusLabel,
  isManualSubscription,
  clubSavingsSummary,
  subscriptionCanUseCredit
});

function checkoutAccessAllowed(req, db, order) {
  const user = getCustomerUser(req, db);
  if (user && order.customerUserId) return order.customerUserId === user.id;
  const proof = verifySignedValue(parseCookies(req).cine_checkout);
  return Array.isArray(proof?.orderIds) && proof.orderIds.map(String).includes(String(order.id));
}

const { checkoutResponse } = createCheckoutPresentationService({ enrichTicket });

function expireStaleReservations(db, expiredOrders = []) {
  const now = Date.now();
  let changed = false;
  (db.orders || []).forEach((order) => {
    if (
      order.status !== "pending_payment" ||
      !order.reservationExpiresAt ||
      new Date(order.reservationExpiresAt).getTime() > now
    ) {
      return;
    }

    order.status = "expired";
    order.paymentStatus = order.paymentStatus === "approved" ? "approved" : "expired";
    order.expiredAt = order.expiredAt || new Date().toISOString();
    order.expirationCleanupPending = true;
    order.clubCreditPending = false;
    clubDomainService.releaseOrderCredits(db, order.id);
    changed = releaseConcessionReservation(db, order) || changed;
    changed = true;

    (db.payments || [])
      .filter((payment) => payment.orderId === order.id && !["approved", "refunded"].includes(payment.status))
      .forEach((payment) => {
        payment.status = "expired";
        payment.expiredAt = payment.expiredAt || new Date().toISOString();
        payment.updatedAt = new Date().toISOString();
        payment.qrCode = "";
        payment.qrCodeBase64 = "";
        payment.ticketUrl = "";
        payment.checkoutUrl = "";
      });
  });
  (db.orders || []).filter((order) => order.expirationCleanupPending || (
    order.status === "expired"
    && (db.payments || []).some((payment) => payment.orderId === order.id && ["mercado_pago", "pag_bank"].includes(payment.provider) && payment.qrCode)
  )).forEach((order) => {
    changed = true;
    const payment = (db.payments || []).find((item) => item.orderId === order.id) || null;
    if (payment) {
      payment.qrCode = "";
      payment.qrCodeBase64 = "";
      payment.ticketUrl = "";
      payment.checkoutUrl = "";
    }
    if (!expiredOrders.some((item) => item.orderId === order.id)) {
      expiredOrders.push({
        orderId: order.id,
        sessionId: order.sessionId,
        seatHoldToken: order.seatHoldToken,
        selectedSeatIds: [...(order.selectedSeatIds || [])],
        provider: payment?.provider || "",
        providerPaymentId: payment?.providerPaymentId || ""
      });
    }
  });
  return changed;
}

async function cleanupExpiredCheckoutOrders(expiredOrders) {
  for (const expired of expiredOrders) {
    await releaseOrderSeatHolds(expired, "available");
    (expired.selectedSeatIds || []).forEach((seatId) => seatRealtimeService?.broadcastSeatStatus(expired.sessionId, seatId, "available"));
    if (expired.provider === "mercado_pago" && expired.providerPaymentId) {
      try {
        const currentDb = await readDb();
        const config = integrationConfigService.resolvedConfig(currentDb, "mercadoPago");
        await paymentService.cancelMercadoPagoOrder(expired.providerPaymentId, config || {}, `expire-${expired.orderId}`);
      } catch (error) {
        logEvent("warn", "payment.expired_cancellation_failed", {
          orderId: expired.orderId,
          providerPaymentId: expired.providerPaymentId,
          message: error.message
        });
      }
    }
  }
  if (!expiredOrders.length) return;
  await withCriticalMutation(async () => {
    const db = await readDb();
    const completedIds = new Set(expiredOrders.map((item) => item.orderId));
    (db.orders || []).forEach((order) => {
      if (completedIds.has(order.id)) order.expirationCleanupPending = false;
    });
    await writeDb(db);
  });
}

async function downloadTrailerForMovie(movie) {
  const sourceUrl = String(movie.trailerVideoUrl || "").trim();
  if (!sourceUrl) {
    await deleteLocalTrailer(movie.localTrailerUrl);
    return {
      ...movie,
      localTrailerUrl: "",
      trailerSourceUrl: "",
      trailerCacheStatus: "idle",
      trailerCachedAt: "",
      trailerCacheError: ""
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return { ...movie, trailerCacheStatus: "failed", trailerCacheError: "URL direta do trailer invalida." };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return { ...movie, trailerCacheStatus: "failed", trailerCacheError: "Use uma URL direta http(s) autorizada." };
  }

  if (movie.localTrailerUrl && movie.trailerSourceUrl === sourceUrl) {
    return { ...movie, trailerCacheStatus: "cached", trailerCacheError: "" };
  }

  try {
    const response = await openPublicResource(sourceUrl, { timeoutMs: 15000, maxBytes: MAX_TRAILER_BYTES });

    const contentType = response.headers["content-type"] || "";
    const extension = getTrailerExtension(sourceUrl, contentType);
    if (!extension || (!contentType.startsWith("video/") && !path.extname(parsedUrl.pathname))) {
      throw new Error("A URL precisa apontar para um arquivo de video direto (.mp4, .webm ou .mov).");
    }

    const contentLength = Number(response.headers["content-length"] || 0);
    if (contentLength > MAX_TRAILER_BYTES) {
      throw new Error(`Trailer maior que o limite de ${Math.round(MAX_TRAILER_BYTES / 1024 / 1024)} MB.`);
    }

    await fs.mkdir(TRAILERS_DIR, { recursive: true });
    const filename = trailerFilename(movie, sourceUrl, extension);
    const destination = path.join(TRAILERS_DIR, filename);
    const tempDestination = `${destination}.download`;

    await pipeline(
      response,
      createByteLimitStream(MAX_TRAILER_BYTES),
      createWriteStream(tempDestination)
    );
    await fs.rename(tempDestination, destination);

    const nextLocalTrailerUrl = `${publicBackendUrl()}/trailers/${filename}`;
    if (movie.localTrailerUrl && movie.localTrailerUrl !== nextLocalTrailerUrl) {
      await deleteLocalTrailer(movie.localTrailerUrl);
    }

    return {
      ...movie,
      localTrailerUrl: nextLocalTrailerUrl,
      trailerSourceUrl: sourceUrl,
      trailerCacheStatus: "cached",
      trailerCachedAt: new Date().toISOString(),
      trailerCacheError: ""
    };
  } catch (error) {
    try {
      const sourceUrlHash = sourceUrl ? crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12) : "";
      const partialFiles = await fs.readdir(TRAILERS_DIR).catch(() => []);
      await Promise.all(
        partialFiles
          .filter((file) => file.includes(sourceUrlHash) && file.endsWith(".download"))
          .map((file) => fs.rm(path.join(TRAILERS_DIR, file), { force: true }))
      );
    } catch {
      // Ignore temporary cache cleanup errors.
    }

    return {
      ...movie,
      trailerCacheStatus: "failed",
      trailerCacheError: error.message || "Falha ao baixar trailer."
    };
  }
}

async function syncHighlightTrailerCache(db, previousMovies = []) {
  await Promise.all(
    previousMovies
      .filter((movie) => movie.localTrailerUrl)
      .map((movie) => deleteLocalTrailer(movie.localTrailerUrl))
  );

  db.movies = db.movies.map((movie) => ({
    ...movie,
    localTrailerUrl: "",
    trailerSourceUrl: "",
    trailerCacheStatus: "idle",
    trailerCachedAt: "",
    trailerCacheError: ""
  }));
}

const { normalizeMovie, validateMovieForWorkflow } = createMovieWorkflowService({
  slugify,
  calendarDateKey,
  isValidCalendarDate,
  sessionStartsAt,
  startMovieTagTransition,
  stopMovieTagTransition
});

function valueReferencesAsset(value, assetUrl, seen = new Set()) {
  if (typeof value === "string") return value === assetUrl;
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => valueReferencesAsset(item, assetUrl, seen));
  return Object.values(value).some((item) => valueReferencesAsset(item, assetUrl, seen));
}

async function deleteUnreferencedAssets(db, urls = []) {
  const uniqueUrls = [...new Set(urls.map((url) => String(url || "")).filter(Boolean))];
  await Promise.all(uniqueUrls.map((url) => valueReferencesAsset(db, url) ? false : storageService.deleteByPublicUrl(url)));
}

const { normalizeMovieSession, createMovieSessionBatch } = createMovieSessionInputService({
  isValidCalendarDate,
  isValidSessionTime,
  crypto
});

function sessionHasAuditHistory(db, sessionId) {
  return (db.orders || []).some((order) => order.sessionId === sessionId || (order.items || []).some((item) => item.sessionId === sessionId))
    || (db.tickets || []).some((ticket) => ticket.sessionId === sessionId)
    || (db.payments || []).some((payment) => payment.sessionId === sessionId)
    || (db.subscriptionUsage || db.subscriptionUsages || []).some((usage) => usage.sessionId === sessionId);
}

function sessionHasActiveSeatAssignments(db, sessionId) {
  const activeOrders = (db.orders || []).some((order) =>
    order.sessionId === sessionId
    && ["pending_payment", "paid", "paid_pending_print"].includes(String(order.status || ""))
    && Array.isArray(order.selectedSeatIds)
    && order.selectedSeatIds.length > 0
  );
  const activeTickets = (db.tickets || []).some((ticket) =>
    ticket.sessionId === sessionId
    && ticket.seatId
    && !["cancelled", "refunded", "expired"].includes(String(ticket.status || ""))
  );
  return activeOrders || activeTickets;
}

function sessionCommercialChanges(previous = {}, next = {}) {
  return ["date", "time", "room", "roomId", "format"]
    .filter((field) => String(previous[field] || "") !== String(next[field] || ""));
}

function syncSessionSnapshotRecords(db, movie, session, options = {}) {
  const timestamp = new Date().toISOString();
  let ordersUpdated = 0;
  let ticketsUpdated = 0;
  (db.orders || []).forEach((order) => {
    if (String(order.sessionId || "") !== String(session.id || "")) return;
    order.movieId = movie.id;
    order.movieTitle = movie.title || order.movieTitle || "";
    order.sessionDate = session.date;
    order.sessionTime = session.time;
    order.sessionRoom = session.room;
    order.sessionFormat = session.format;
    order.sessionStatus = session.status;
    order.sessionUpdatedAt = timestamp;
    if (session.status === "cancelled") {
      order.sessionCancelledAt = timestamp;
      order.sessionCancellationReason = options.reason || "Sessão cancelada pelo cinema";
      const payment = orderPayment(db, order.id);
      if (order.status === "paid" && payment?.status === "approved") {
        order.refundStatus = order.refundStatus || "required";
        payment.refundStatus = payment.refundStatus || "required";
        payment.metadata = { ...(payment.metadata || {}), sessionCancellationReason: order.sessionCancellationReason };
      }
    }
    ordersUpdated += 1;
  });
  (db.tickets || []).forEach((ticket) => {
    if (String(ticket.sessionId || "") !== String(session.id || "")) return;
    ticket.movieId = movie.id;
    ticket.movieTitle = movie.title || ticket.movieTitle || "";
    ticket.sessionDate = session.date;
    ticket.sessionTime = session.time;
    ticket.sessionRoom = session.room;
    ticket.sessionFormat = session.format;
    ticket.sessionStatus = session.status;
    ticket.sessionUpdatedAt = timestamp;
    if (session.status === "cancelled") {
      ticket.sessionCancelledAt = timestamp;
      ticket.sessionCancellationReason = options.reason || "Sessão cancelada pelo cinema";
    }
    ticketsUpdated += 1;
  });
  return { ordersUpdated, ticketsUpdated, timestamp };
}

function movieDurationMinutes(movie = {}) {
  const raw = String(movie.duration || "").trim().toLowerCase();
  const hours = Number(raw.match(/(\d+(?:[.,]\d+)?)\s*h/)?.[1]?.replace(",", ".") || 0);
  const minutes = Number(raw.match(/(\d+)\s*(?:m|min)/)?.[1] || raw.match(/h\s*(\d+)\s*$/)?.[1] || 0);
  if (hours || minutes) return Math.max(1, Math.round(hours * 60 + minutes));
  const numeric = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 100;
}

function sessionRoomConflicts(db, movie, candidate, options = {}) {
  return findSessionRoomConflicts({
    movies: db.movies || [],
    rooms: db.rooms || [],
    candidateMovie: movie,
    candidate,
    ignoreSessionId: options.ignoreSessionId,
    additional: options.additional
  });
}

function requireSessionRoomConflictConfirmation(res, conflicts, confirmed) {
  const cleanupMinutes = Math.max(0, ...conflicts.map((item) => Number(item.cleanupMinutes || 0)));
  if (cleanupMinutes > 0) {
    sendJson(res, 409, { error: { code: "SESSION_CLEANUP_CONFLICT", message: `A sala exige pelo menos ${cleanupMinutes} minutos de limpeza entre o fim de um filme e a próxima sessão. Escolha outro horário ou ajuste o intervalo no cadastro da sala.`, conflicts } });
    return true;
  }
  if (!conflicts.length || confirmed === true) return false;
  sendJson(res, 409, {
    error: {
      code: "SESSION_ROOM_CONFLICT",
      message: "Já existe uma sessão ocupando esta sala no período informado. Revise a agenda ou confirme a sobreposição.",
      conflicts
    }
  });
  return true;
}

function finishedSessionEndsAt(movie, session) {
  const startsAt = sessionStartsAt(session, session.date || todayIsoDate());
  return startsAt ? new Date(startsAt.getTime() + movieDurationMinutes(movie) * 60 * 1000) : null;
}

function snapshotFinishedSessionRecord(record, movie, session, archivedAt) {
  if (!record || String(record.sessionId || "") !== String(session.id || "")) return false;
  record.archivedSessionId = record.archivedSessionId || session.id;
  if (record.seatHoldToken) record.archivedSeatHoldSessionId = record.archivedSeatHoldSessionId || session.id;
  record.movieId = movie.id;
  record.movieTitle = movie.title || record.movieTitle || "";
  record.sessionDate = session.date || record.sessionDate || "";
  record.sessionTime = session.time || record.sessionTime || "";
  record.sessionRoom = session.room || record.sessionRoom || "Sala Cruzeiro";
  record.sessionFormat = session.format || record.sessionFormat || "";
  record.sessionStatus = "finished";
  record.sessionEndedAt = archivedAt;
  record.sessionId = "";
  return true;
}

function snapshotFinishedSessionItems(record, movie, session, archivedAt) {
  if (!Array.isArray(record?.items)) return false;
  return record.items.some((item) => snapshotFinishedSessionRecord(item, movie, session, archivedAt));
}

function expirePendingOrderForFinishedSession(db, order, session, expiredOrders) {
  if (!order || order.status !== "pending_payment") return;
  const payment = (db.payments || []).find((item) => item.orderId === order.id) || null;
  if (["approved", "refunded"].includes(String(payment?.status || ""))) return;

  order.status = "expired";
  order.paymentStatus = "expired";
  order.expiredAt = order.expiredAt || new Date().toISOString();
  order.expirationCleanupPending = true;
  order.clubCreditPending = false;
  clubDomainService.releaseOrderCredits(db, order.id);
  releaseConcessionReservation(db, order);
  (db.payments || [])
    .filter((item) => item.orderId === order.id && !["approved", "refunded"].includes(item.status))
    .forEach((item) => {
      item.status = "expired";
      item.expiredAt = item.expiredAt || order.expiredAt;
      item.updatedAt = new Date().toISOString();
      item.qrCode = "";
      item.qrCodeBase64 = "";
      item.ticketUrl = "";
      item.checkoutUrl = "";
    });
  if (!expiredOrders.some((item) => item.orderId === order.id)) {
    expiredOrders.push({
      orderId: order.id,
      sessionId: session.id,
      seatHoldToken: order.seatHoldToken,
      selectedSeatIds: [...(order.selectedSeatIds || [])],
      provider: payment?.provider || "",
      providerPaymentId: payment?.providerPaymentId || ""
    });
  }
}

function archiveFinishedSessions(db, now = new Date(), expiredOrders = []) {
  const archived = [];
  const archivedAt = now.toISOString();
  for (const movie of db.movies || []) {
    const activeSessions = [];
    for (const session of movie.sessions || []) {
      const endsAt = finishedSessionEndsAt(movie, session);
      if (!endsAt || endsAt.getTime() > now.getTime()) {
        activeSessions.push(session);
        continue;
      }

      let detachedOrders = 0;
      let detachedTickets = 0;
      (db.orders || []).forEach((order) => {
        const detached = snapshotFinishedSessionRecord(order, movie, session, archivedAt);
        const detachedItem = snapshotFinishedSessionItems(order, movie, session, archivedAt);
        if (detached || detachedItem) {
          expirePendingOrderForFinishedSession(db, order, session, expiredOrders);
          detachedOrders += 1;
        }
      });
      (db.tickets || []).forEach((ticket) => {
        if (!snapshotFinishedSessionRecord(ticket, movie, session, archivedAt)) return;
        if (!['used', 'cancelled', 'refunded'].includes(String(ticket.status || ''))) ticket.status = 'expired';
        detachedTickets += 1;
      });
      (db.payments || []).forEach((payment) => {
        if (String(payment.sessionId || "") === String(session.id || "")) {
          payment.archivedSessionId = payment.archivedSessionId || session.id;
          payment.sessionStatus = "finished";
          payment.sessionEndedAt = payment.sessionEndedAt || archivedAt;
          payment.sessionId = "";
        }
      });
      (db.subscriptionUsage || db.subscriptionUsages || []).forEach((usage) => {
        if (String(usage.sessionId || "") === String(session.id || "")) {
          usage.archivedSessionId = usage.archivedSessionId || session.id;
          usage.sessionStatus = "finished";
          usage.sessionEndedAt = usage.sessionEndedAt || archivedAt;
          usage.sessionId = "";
        }
      });
      archived.push({
        sessionId: session.id,
        movieId: movie.id,
        movieTitle: movie.title || "",
        endedAt: endsAt.toISOString(),
        detachedOrders,
        detachedTickets
      });
    }
    if (activeSessions.length !== (movie.sessions || []).length) {
      movie.sessions = activeSessions;
      movie.updatedAt = archivedAt;
    }
  }
  return { changed: archived.length > 0, archived };
}

const { normalizeRoom, normalizeTicketType } = createVenueInputService({ slugify });

const { normalizeConcession, normalizePromotion, assertPromotionRules, normalizeAd } = createCommercialCatalogInputService({ slugify, storedLocalUploadUrl });

function finiteStock(item) {
  return item && item.stock !== "" && item.stock !== undefined;
}

function concessionStockConsumption(item, orderItem, quantity) {
  const explicit = Number(orderItem?.stockDeduction);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const usage = item?.stockUnit && item.stockUnit !== "unit" ? Math.max(0.001, Number(item.usagePerSale || 1)) : 1;
  return Number((Math.max(0, Number(quantity || 0)) * usage).toFixed(3));
}

function adjustConcessionStock(item, delta) {
  item.stock = Number((Number(item.stock || 0) + Number(delta || 0)).toFixed(3));
}

function eachStockedOrderItem(db, order, callback) {
  (order.concessionItems || []).forEach((orderItem) => {
    const item = db.concessions.find((concession) => concession.id === orderItem.id);
    if (!item || !finiteStock(item)) return;
    const quantity = Math.max(0, Number(orderItem.quantity || 0));
    const stockQuantity = concessionStockConsumption(item, orderItem, quantity);
    if (!stockQuantity) return;
    callback(item, stockQuantity, quantity);
  });
}

function reserveConcessionStock(db, order) {
  if (order.stockReservationStatus === "reserved" || order.stockReservationStatus === "sold") return;

  eachStockedOrderItem(db, order, (item, quantity) => {
    if (Number(item.stock || 0) < quantity) {
      const error = new Error(`${item.name} nao possui estoque suficiente.`);
      error.statusCode = 409;
      throw error;
    }
  });

  eachStockedOrderItem(db, order, (item, quantity) => {
    adjustConcessionStock(item, -quantity);
    item.reserved = Math.max(0, Number(item.reserved || 0) + quantity);
  });
  order.stockReservationStatus = "reserved";
  order.stockReservedAt = order.stockReservedAt || new Date().toISOString();
}

function confirmConcessionStock(db, order) {
  if (order.stockReservationStatus === "sold") return;

  if (order.stockReservationStatus === "reserved") {
    eachStockedOrderItem(db, order, (item, quantity) => {
      item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
      item.sold = Math.max(0, Number(item.sold || 0) + quantity);
    });
  } else {
    eachStockedOrderItem(db, order, (item, quantity) => {
      if (Number(item.stock || 0) < quantity) {
        const error = new Error(`${item.name} nao possui estoque suficiente para confirmar a venda.`);
        error.statusCode = 409;
        throw error;
      }
      adjustConcessionStock(item, -quantity);
      item.sold = Math.max(0, Number(item.sold || 0) + quantity);
    });
  }

  order.stockReservationStatus = "sold";
  order.stockSoldAt = order.stockSoldAt || new Date().toISOString();
}

function releaseConcessionReservation(db, order) {
  let changed = false;
  if (goodsFiscalService.cancelUnissued(db, order, "order_terminated")) changed = true;
  if (order?.id && (db.subscriptionCreditRedemptions || []).some((item) => item.orderId === order.id && item.status === "reserved")) {
    clubDomainService.releaseOrderCredits(db, order.id);
    order.clubCreditPending = false;
    changed = true;
  }
  if (order.stockReservationStatus !== "reserved") return changed;

  eachStockedOrderItem(db, order, (item, quantity) => {
    adjustConcessionStock(item, quantity);
    item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
  });
  order.stockReservationStatus = "released";
  order.stockReleasedAt = new Date().toISOString();
  return true;
}

function orderTickets(db, orderId) {
  return (db.tickets || []).filter((ticket) => ticket.orderId === orderId);
}

function orderPayment(db, orderId) {
  return (db.payments || []).find((payment) => payment.orderId === orderId || payment.metadata?.relatedOrderIds?.includes(orderId)) || null;
}

function appendOrderAudit(order, entry) {
  order.auditTrail ||= [];
  order.auditTrail.push({
    id: `order-audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    ...entry,
    at: new Date().toISOString()
  });
}

function safeOrderUpdate(order, body, adminUser) {
  const allowedFields = ["customerName", "customerPhone", "customerEmail", "customerCpf", "operationalNotes"];
  if (Object.hasOwn(body, "customerPhone")) phoneDigits(body.customerPhone);
  if (Object.hasOwn(body, "customerCpf")) cpfDigits(body.customerCpf);
  const before = structuredCloneSafe(order);
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      order[field] = String(body[field] || "").trim();
    }
  });
  order.updatedBy = adminUser?.id || "";
  order.updatedByEmail = adminUser?.email || "";
  order.updatedAt = new Date().toISOString();
  appendOrderAudit(order, {
    action: "edit",
    updatedBy: order.updatedBy,
    reason: String(body.reason || "Edição operacional").trim(),
    before,
    after: structuredCloneSafe(order)
  });
}

const { cancelOrderWithRefund } = createFullOrderRefundCoordinator({
  withCriticalMutation, readDb, writeDb, refundError, orderPayment, orderTickets, isOrderSessionExpired, cancelOrder, refundProviderConfig, paymentService,
  prepareRefund, appendOrderAudit, structuredCloneSafe, broadcastReleasedOrderSeats, submitFullRefund, logEvent, goodsFiscalService, eachStockedOrderItem, adjustConcessionStock
});

const { concessionRefundEligibility, refundOrderConcessions } = createConcessionRefundCoordinator({
  withCriticalMutation, readDb, writeDb, refundError, orderPayment, isOrderSessionExpired,
  orderFinancialBreakdown, supportedAutomaticRefund, eachStockedOrderItem,
  adjustConcessionStock, goodsFiscalService, orderTickets, appendOrderAudit,
  refundProviderConfig, paymentService, prepareConcessionRefund, structuredCloneSafe,
  submitConcessionRefund, logEvent, broadcastReleasedOrderSeats
});

const { ticketRefundEligibility, refundOrderTickets } = createTicketRefundCoordinator({
  withCriticalMutation, readDb, writeDb, refundError, orderPayment, orderTickets,
  isOrderSessionExpired, orderFinancialBreakdown, supportedAutomaticRefund,
  appendOrderAudit, refundProviderConfig, paymentService, prepareTicketRefund,
  structuredCloneSafe, submitPartialRefund, logEvent, broadcastReleasedOrderSeats
});

function cancelOrder(db, order, reason, adminUser) {
  const payment = orderPayment(db, order.id);
  const tickets = orderTickets(db, order.id);
  if (tickets.some((ticket) => ticket.status === "used")) {
    const error = new Error("Pedido com ingresso já utilizado não pode ser cancelado pelo painel.");
    error.statusCode = 409;
    throw error;
  }

  const before = structuredCloneSafe({ order, payment, tickets });
  const now = new Date().toISOString();
  releaseConcessionReservation(db, order);
  delete order.pendingPrintTickets;
  order.status = "cancelled";
  order.archived = true;
  order.archivedAt = now;
  order.archivedBy = adminUser?.id || "system";
  order.archivedReason = String(reason || "Cancelado pelo painel").trim();
  order.cancelledBy = adminUser?.id || "";
  order.cancelledByEmail = adminUser?.email || "";
  order.cancelledAt = now;
  order.updatedAt = now;
  order.cancellationReason = String(reason || "Cancelado pelo painel").trim();
  order.concessionStatus = "cancelled";
  order.concessionCancelledAt = now;
  order.concessionCancelledBy = adminUser?.id || "";
  order.concessionCancellationReason = order.cancellationReason;
  (order.concessionItems || []).forEach((item) => {
    item.status = "cancelled";
  });
  goodsFiscalService.cancelUnissued(db, order, "order_cancelled", new Date(now));

  if (payment) {
    payment.updatedAt = now;
    if (payment.status === "approved") {
      payment.refundStatus = payment.refundStatus || "required";
      payment.metadata = { ...(payment.metadata || {}), cancellationReason: order.cancellationReason };
      order.refundStatus = "required";
      order.paymentStatus = "approved";
    } else {
      payment.status = "cancelled";
      payment.cancelledAt = now;
      order.paymentStatus = "cancelled";
    }
  } else {
    order.paymentStatus = "cancelled";
  }

  tickets.forEach((ticket) => {
    ticket.status = "cancelled";
    ticket.cancelledAt = now;
    ticket.cancelledBy = adminUser?.id || "";
  });

  const creditUsages = (db.subscriptionUsage || []).filter((usage) => usage.orderId === order.id);
  if (order.clubCreditUsageId && !creditUsages.some((usage) => usage.id === order.clubCreditUsageId)) {
    throw refundError("CLUB_CREDIT_USAGE_MISSING", "O uso do crédito do Clube não foi localizado. O cancelamento não foi concluído.", 409);
  }
  for (const usage of creditUsages) {
    if (!usage.refundedAt && !refundSubscriptionCreditForUsage(db, usage, adminUser, order.cancellationReason)) {
      throw refundError("CLUB_CREDIT_REFUND_FAILED", "O crédito do Clube não pôde ser devolvido. O cancelamento não foi concluído.", 409);
    }
  }

  appendOrderAudit(order, {
    action: "cancel",
    cancelledBy: order.cancelledBy,
    reason: order.cancellationReason,
    before,
    after: structuredCloneSafe({ order, payment, tickets: orderTickets(db, order.id) })
  });
}

function archiveOrder(order, reason, adminUser) {
  if (order.archived === true) return;
  const before = structuredCloneSafe(order);
  const now = new Date().toISOString();
  order.archived = true;
  order.archivedAt = now;
  order.archivedBy = adminUser?.id || "";
  order.archivedByEmail = adminUser?.email || "";
  order.updatedAt = now;
  appendOrderAudit(order, {
    action: "archive",
    updatedBy: order.archivedBy,
    reason: String(reason || "Arquivado pelo painel").trim(),
    before,
    after: structuredCloneSafe(order)
  });
}

function unarchiveOrder(order, reason, adminUser) {
  if (order.archived !== true) return;
  const before = structuredCloneSafe(order);
  const now = new Date().toISOString();
  order.archived = false;
  order.archivedAt = "";
  order.archivedBy = "";
  order.archivedByEmail = "";
  order.updatedAt = now;
  appendOrderAudit(order, {
    action: "unarchive",
    updatedBy: adminUser?.id || "",
    reason: String(reason || "Restaurado pelo painel").trim(),
    before,
    after: structuredCloneSafe(order)
  });
}

function reverseConcessionStockForDeletion(db, order) {
  const status = order.stockReservationStatus;
  if (!["reserved", "sold"].includes(status)) return;
  eachStockedOrderItem(db, order, (item, quantity) => {
    adjustConcessionStock(item, quantity);
    if (status === "reserved") item.reserved = Math.max(0, Number(item.reserved || 0) - quantity);
    if (status === "sold") item.sold = Math.max(0, Number(item.sold || 0) - quantity);
  });
  order.stockReservationStatus = "deleted_reversed";
}

function permanentlyDeleteOrder(db, orderId, body = {}, adminUser = {}) {
  if (orderPayment(db, orderId)?.metadata?.cancellationRefund) {
    throw refundError("REFUND_HISTORY_PROTECTED", "Pedidos com devolucao devem ser arquivados para preservar a conciliacao financeira.");
  }
  if (!adminHasPermission(adminUser, "orders.delete")) {
    const error = new Error("Esta conta não possui permissão para excluir pedidos permanentemente.");
    error.statusCode = 403;
    throw error;
  }
  if (String(body.confirmation || "").trim().toUpperCase() !== "EXCLUIR") {
    const error = new Error("Digite EXCLUIR para confirmar a exclusão permanente.");
    error.statusCode = 422;
    throw error;
  }
  const reason = String(body.reason || "").trim();
  if (reason.length < 6) {
    const error = new Error("Informe um motivo claro para a exclusão permanente.");
    error.statusCode = 422;
    throw error;
  }
  const index = (db.orders || []).findIndex((item) => item.id === orderId);
  if (index === -1) {
    const error = new Error("Pedido nao encontrado.");
    error.statusCode = 404;
    throw error;
  }
  const order = db.orders[index];
  const payment = orderPayment(db, order.id);
  const tickets = orderTickets(db, order.id);
  const snapshot = structuredCloneSafe({
    order,
    payment,
    tickets,
    subscriptionUsage: (db.subscriptionUsage || []).filter((usage) => usage.orderId === order.id),
    webhookEvents: (db.webhookEvents || []).filter((event) => event.orderId === order.id)
  });
  reverseConcessionStockForDeletion(db, order);
  db.auditLogs ||= [];
  db.auditLogs.push({
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: adminUser.id,
    userEmail: adminUser.email,
    action: "order.permanently_deleted",
    entityType: "order",
    entityId: order.id,
    before: sanitizeAuditValue(snapshot),
    after: null,
    orderReference: shortOrderReference(order),
    deletedBy: adminUser.id,
    deletedAt: new Date().toISOString(),
    reason,
    ip: requestContext.getStore()?.req ? clientIp(requestContext.getStore().req) : "",
    createdAt: new Date().toISOString()
  });
  db.payments = (db.payments || []).filter((item) => item.orderId !== order.id);
  db.tickets = (db.tickets || []).filter((item) => item.orderId !== order.id);
  db.subscriptionUsage = (db.subscriptionUsage || []).filter((item) => item.orderId !== order.id);
  db.webhookEvents = (db.webhookEvents || []).filter((item) => item.orderId !== order.id);
  db.orders.splice(index, 1);
  return { deleted: true, orderId, orderReference: shortOrderReference(order), externalFinancialProvider: payment && !["box_office", "admin", "external_manual", "manual_external", "internal_club"].includes(payment.provider) };
}

function removableDraftOrder(order, payment, tickets) {
  const draftStatuses = new Set(["draft", "test"]);
  return draftStatuses.has(order.status) && !payment && !tickets.some((ticket) => ticket.status === "used");
}

function couponCustomerKey(order) {
  if (order.customerUserId) return `user:${order.customerUserId}`;
  const cpf = String(order.customerCpf || "").replace(/\D/g, "");
  if (cpf) return `cpf:${cpf}`;
  const email = String(order.customerEmail || "").trim().toLowerCase();
  return email ? `email:${email}` : "";
}

function syncRoomSessionReferences(db, room, linkedSessions = []) {
  const roomLabel = roomDisplayLabel(room);
  let sessionsUpdated = 0;
  let ordersUpdated = 0;
  let ticketsUpdated = 0;
  linkedSessions.forEach(({ movie, session }) => {
    if (!movie || !session) return;
    const changed = session.roomId !== room.id || session.room !== roomLabel;
    session.roomId = room.id;
    session.room = roomLabel;
    if (!changed) return;
    const synchronized = syncSessionSnapshotRecords(db, movie, session, { reason: "Cadastro da sala atualizado" });
    sessionsUpdated += 1;
    ordersUpdated += synchronized.ordersUpdated;
    ticketsUpdated += synchronized.ticketsUpdated;
  });
  return { sessionsUpdated, ordersUpdated, ticketsUpdated };
}

function couponOrderCounts(db, coupon, order) {
  const customerKey = couponCustomerKey(order);
  const countedStatuses = new Set(["paid", "paid_pending_print", "pending_payment", "processing"]);
  const now = Date.now();
  const matching = (db.orders || []).filter((existing) => {
    if (existing.id === order.id || !countedStatuses.has(existing.status)) return false;
    if (existing.status === "pending_payment" && existing.reservationExpiresAt) {
      const expiresAt = new Date(existing.reservationExpiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
    }
    const existingCouponDiscount = existing.couponDiscount !== undefined && existing.couponDiscount !== null
      ? Number(existing.couponDiscount || 0)
      : Number(existing.discountValue || 0);
    if (existingCouponDiscount <= 0) return false;
    return existing.couponId === coupon.id || String(existing.couponCode || "").toUpperCase() === coupon.couponCode;
  });
  return {
    total: matching.length,
    customer: customerKey ? matching.filter((existing) => couponCustomerKey(existing) === customerKey).length : 0
  };
}

async function finalizeOrderWithoutCharge(db, order, customerUser) {
  const savedOrder = {
    ...order,
    status: "paid",
    origin: "online",
    paymentMethod: order.clubCreditsApplied > 0 ? "CLUB_CREDIT_COUPON" : "COUPON",
    paymentProvider: "internal_coupon",
    paymentId: "",
    paymentStatus: "not_required",
    reservationExpiresAt: "",
    paidAt: new Date().toISOString()
  };
  reserveConcessionStock(db, savedOrder);
  const tickets = finalizePaidOrder(db, savedOrder, null, "promotional");
  if (tickets.length) consumePendingClubCredit(db, savedOrder, tickets, customerUser?.id);
  db.orders.unshift(savedOrder);
  logEvent("info", "coupon.order_completed", {
    orderId: savedOrder.id,
    couponCode: savedOrder.couponCode,
    couponDiscount: savedOrder.couponDiscount,
    customerEmail: savedOrder.customerEmail,
    tickets: tickets.length
  });
  return { order: savedOrder, tickets };
}

function applyCouponPricing(db, order, ticketTotal, concessionTotal) {
  const code = String(order.couponCode || "").trim().toUpperCase();
  if (!code) return { discountValue: 0, ticketDiscount: 0, concessionDiscount: 0, coupon: null };
  const coupon = (db.promotions || []).find((item) => item.couponCode === code);
  if (!coupon) throw Object.assign(new Error("Cupom não encontrado. Confira o código e tente novamente."), { statusCode: 422, code: "COUPON_NOT_FOUND" });
  if (coupon.archivedAt) throw Object.assign(new Error("Este cupom expirou e foi arquivado."), { statusCode: 409, code: "COUPON_EXPIRED" });
  if (coupon.active === false) throw Object.assign(new Error("Este cupom está desativado."), { statusCode: 409, code: "COUPON_INACTIVE" });

  const now = Date.now();
  const startsAt = coupon.startsAt ? new Date(coupon.startsAt).getTime() : 0;
  const endsAt = coupon.endsAt ? new Date(coupon.endsAt).getTime() : 0;
  if (startsAt && startsAt > now) throw Object.assign(new Error("Este cupom ainda não está disponível."), { statusCode: 409, code: "COUPON_NOT_STARTED" });
  if (endsAt && endsAt < now) throw Object.assign(new Error("Este cupom expirou."), { statusCode: 409, code: "COUPON_EXPIRED" });

  const allowedMovieIds = Array.isArray(coupon.allowedMovieIds) ? coupon.allowedMovieIds : [];
  if (allowedMovieIds.length && !allowedMovieIds.includes(order.movieId)) {
    throw Object.assign(new Error("Este cupom não é válido para o filme selecionado."), { statusCode: 409, code: "COUPON_MOVIE_NOT_ELIGIBLE" });
  }
  const subtotal = Number((ticketTotal + concessionTotal).toFixed(2));
  if (subtotal < Number(coupon.minimumOrderValue || 0)) {
    const minimum = Number(coupon.minimumOrderValue || 0).toFixed(2).replace(".", ",");
    throw Object.assign(new Error(`Este cupom exige um pedido mínimo de R$ ${minimum}.`), { statusCode: 409, code: "COUPON_MINIMUM_NOT_REACHED" });
  }

  const counts = couponOrderCounts(db, coupon, order);
  if (Number(coupon.usageLimit || 0) > 0 && counts.total >= Number(coupon.usageLimit)) {
    throw Object.assign(new Error("O limite de utilizações deste cupom foi atingido."), { statusCode: 409, code: "COUPON_USAGE_LIMIT_REACHED" });
  }
  if (Number(coupon.perCustomerLimit || 0) > 0) {
    if (!couponCustomerKey(order)) {
      throw Object.assign(new Error("Informe seu e-mail ou entre na conta para usar este cupom."), { statusCode: 422, code: "COUPON_CUSTOMER_REQUIRED" });
    }
    if (counts.customer >= Number(coupon.perCustomerLimit)) {
      throw Object.assign(new Error("Você já utilizou este cupom o máximo de vezes permitido."), { statusCode: 409, code: "COUPON_CUSTOMER_LIMIT_REACHED" });
    }
  }
  if (coupon.firstPurchaseOnly) {
    const customerKey = couponCustomerKey(order);
    if (!customerKey) throw Object.assign(new Error("Entre na conta ou informe seu e-mail para usar este cupom de primeira compra."), { statusCode: 422, code: "COUPON_CUSTOMER_REQUIRED" });
    const hasPaidOrder = (db.orders || []).some((existing) => existing.status === "paid" && couponCustomerKey(existing) === customerKey);
    if (hasPaidOrder) throw Object.assign(new Error("Este cupom é exclusivo para a primeira compra."), { statusCode: 409, code: "COUPON_FIRST_PURCHASE_ONLY" });
  }

  const appliesTo = ["tickets", "concessions"].includes(coupon.appliesTo) ? coupon.appliesTo : "all";
  const eligibleSubtotal = appliesTo === "tickets" ? ticketTotal : appliesTo === "concessions" ? concessionTotal : subtotal;
  if (eligibleSubtotal <= 0) throw Object.assign(new Error("O pedido não possui itens elegíveis para este cupom."), { statusCode: 409, code: "COUPON_NO_ELIGIBLE_ITEMS" });
  const { discountValue, ticketDiscount, concessionDiscount } = calculateCouponDiscountForAmounts(coupon, ticketTotal, concessionTotal);
  if (discountValue <= 0) throw Object.assign(new Error("Este cupom não gera desconto para o pedido atual."), { statusCode: 409, code: "COUPON_NO_DISCOUNT" });
  return { discountValue, ticketDiscount, concessionDiscount, coupon };
}

function prioritizeClubCreditsInCouponPricing(db, order, ticketItems, ticketTotal, concessionTotal, couponPricing) {
  if (!order?.useClubCredits || !couponPricing.coupon || couponPricing.coupon.allowClubStacking !== true) return couponPricing;
  const membership = activeClubPlanForBenefits(db, order.customerUserId);
  if (!membership?.plan) return couponPricing;
  const referenceValue = Math.max(0, Number(membership.plan.creditReferenceValue || 0));
  const creditAmount = ticketUnitsForOrder({ ...order, ticketItems }).reduce((sum, unit) => (
    sum + Math.min(unit.unitPrice, referenceValue > 0 ? referenceValue : unit.unitPrice)
  ), 0);
  const ticketTotalAfterCredits = Math.max(0, Number((ticketTotal - creditAmount).toFixed(2)));
  const prioritized = calculateCouponDiscountForAmounts(couponPricing.coupon, ticketTotalAfterCredits, concessionTotal);
  return {
    ...prioritized,
    coupon: couponPricing.coupon,
    originalDiscountValue: couponPricing.discountValue,
    appliedAfterClubCredits: true
  };
}

const { repriceOrderFromCatalog, repriceConcessionCounterOrder, assertClientPricingMatches } = createOrderCatalogPricingService({
  todayIsoDate, sessionSalesOpenAt, isSessionSellable, resolveOrderTicketItems, roomForSession, roomSeatSelectionEnabled, roomSeats, orderTicketCount,
  concessionStockConsumption, finiteStock, applyCouponPricing, prioritizeClubCreditsInCouponPricing, allocateDiscountAcrossAmounts, roomDisplayLabel, ensureFriendlyOrderReference, assignSeatsToOrder
});

function adIsVisible(ad, now = Date.now()) {
  return Boolean(ad && ad.active !== false
    && (!ad.startsAt || new Date(ad.startsAt).getTime() <= now)
    && (!ad.endsAt || new Date(ad.endsAt).getTime() > now));
}

const { normalizeUser, adminProfilePicture, adminUserPayload, sanitizeUser } = createUserAccountModelService({
  slugify,
  phoneDigits,
  cpfDigits,
  hashPassword,
  expandAdminPermissions,
  adminRoles,
  roleAlias,
  passwordPolicyError,
  effectiveAdminPermissions
});

const PASSWORD_HASH_ITERATIONS = 600000;
const PASSWORD_MIN_LENGTH = 10;
const COMMON_PASSWORDS = new Set([
  "1234567890", "123456789", "password", "password123", "qwerty12345", "senha12345", "admin12345"
]);

function passwordPolicyError(password) {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN_LENGTH || value.length > 128) return `Use uma senha entre ${PASSWORD_MIN_LENGTH} e 128 caracteres.`;
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return "Escolha uma senha menos comum.";
  return "";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PASSWORD_HASH_ITERATIONS, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  const [algorithm, iterations, salt, expectedHash] = String(passwordHash).split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;
  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256")
    .toString("base64url");
  if (Buffer.byteLength(actualHash) !== Buffer.byteLength(expectedHash)) return false;
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

function passwordNeedsRehash(passwordHash) {
  const [algorithm, iterations] = String(passwordHash || "").split("$");
  return algorithm !== "pbkdf2_sha256" || Number(iterations) < PASSWORD_HASH_ITERATIONS;
}

function createAdminTwoFactorChallenge(userId) {
  const now = Date.now();
  for (const [token, challenge] of adminTwoFactorChallenges.entries()) {
    if (challenge.expiresAt <= now || challenge.used) adminTwoFactorChallenges.delete(token);
  }
  const token = crypto.randomBytes(32).toString("base64url");
  adminTwoFactorChallenges.set(token, {
    userId,
    expiresAt: now + 5 * 60 * 1000,
    attempts: 0,
    used: false
  });
  return token;
}

function readAdminTwoFactorChallenge(token) {
  const key = String(token || "");
  const challenge = adminTwoFactorChallenges.get(key);
  if (!challenge || challenge.used || challenge.expiresAt <= Date.now() || challenge.attempts >= 6) {
    if (challenge) adminTwoFactorChallenges.delete(key);
    return null;
  }
  return challenge;
}

async function sendAdminLoginSuccess(req, res, db, user, twoFactorMethod = "not_required") {
  const methods = twoFactorMethod === "not_required" ? ["pwd"] : ["pwd", "otp"];
  const sessionMaxAge = adminSessionMaxAge(req);
  const session = signedValue({ sub: user.id, role: user.role, sv: Number(user.sessionVersion || 0), exp: Date.now() + sessionMaxAge * 1000, amr: methods });
  const loginAudit = {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: user.id,
    userEmail: user.email,
    action: "POST /api/admin/login",
    entityType: "admin_session",
    entityId: user.id,
    before: null,
    after: { role: user.role, twoFactorMethod, persistentDesktopSession: isDesktopAdminRequest(req) },
    ip: clientIp(req),
    createdAt: new Date().toISOString()
  };
  if (postgresEnabled()) {
    await appendAuditLogToPostgres(loginAudit);
  } else {
    db.auditLogs ||= [];
    db.auditLogs.push(loginAudit);
    await writeDb(db);
  }
  res.writeHead(200, {
    ...securityHeaders({ "Content-Type": "application/json; charset=utf-8" }),
    "Set-Cookie": adminCookie(session, sessionMaxAge),
    "Access-Control-Allow-Origin": responseCorsOrigin(req),
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  });
  res.end(JSON.stringify({
    user: sanitizeUser({
      ...user,
      twoFactorSetupRequired: db.settings?.adminTwoFactorRequired !== false && !user.twoFactorEnabled
    })
  }, null, 2));
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("base64url");
}

const EMAIL_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;

function requestStillCoolingDown(value, windowMs = EMAIL_REQUEST_COOLDOWN_MS) {
  if (!value) return false;
  const requestedAt = new Date(value).getTime();
  return Number.isFinite(requestedAt) && Date.now() - requestedAt < windowMs;
}

function ensureEmailUnsubscribeToken(user) {
  if (!user) return "";
  if (!user.emailUnsubscribeToken) {
    user.emailUnsubscribeToken = crypto.randomBytes(32).toString("base64url");
    user.updatedAt = new Date().toISOString();
  }
  return user.emailUnsubscribeToken;
}

function emailUnsubscribeUrlForUser(user) {
  const token = ensureEmailUnsubscribeToken(user);
  return token ? `${appFrontendUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}` : "";
}

function transactionalEmailConfigured(db) {
  const config = integrationConfigService.resolvedConfig(db, "email");
  return Boolean((config?.enabled && config?.configured) || getPasswordResetEmailWebhookUrl(db) || getEmailVerificationWebhookUrl(db));
}

async function notifyPasswordReset(email, resetUrl, db, options = {}) {
  const sentBySmtp = await emailService.sendPasswordReset(db, email, resetUrl, options).catch(() => false);
  if (sentBySmtp) return true;
  const deliveryUrl = getPasswordResetEmailWebhookUrl(db);
  if (!deliveryUrl) {
    logEvent("warn", "password_reset.delivery_missing_channel", { email });
    return false;
  }
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Origin-Client": "CineCruzeiro-Backend"
    },
    body: JSON.stringify({
      event: "password_reset.requested",
      timestamp: new Date().toISOString(),
      cinemaId: "cine_cruzeiro_sala_1",
      data: { email, resetUrl }
    })
  }).catch(() => null);
  const ok = Boolean(response?.ok);
  if (!ok) logEvent("warn", "password_reset.delivery_failed", { email, status: response?.status || 0 });
  return ok;
}

async function notifyEmailVerification(email, verificationUrl, db, options = {}) {
  const brandedOptions = {
    logoUrl: `${appFrontendUrl()}/images/favicon-email.png`,
    siteUrl: appFrontendUrl(),
    ...options
  };
  const sentBySmtp = await emailService.sendEmailVerification(db, email, verificationUrl, brandedOptions).catch(() => false);
  if (sentBySmtp) return true;
  const deliveryUrl = getEmailVerificationWebhookUrl(db);
  if (!deliveryUrl) {
    logEvent("warn", "email_verification.delivery_missing_channel", { email });
    return false;
  }
  const response = await fetch(deliveryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Origin-Client": "CineCruzeiro-Backend"
    },
    body: JSON.stringify({
      event: "email_verification.requested",
      timestamp: new Date().toISOString(),
      cinemaId: "cine_cruzeiro_sala_1",
      data: { email, verificationUrl }
    })
  }).catch(() => null);
  const ok = Boolean(response?.ok);
  if (!ok) logEvent("warn", "email_verification.delivery_failed", { email, status: response?.status || 0 });
  return ok;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

const JWT_ISSUER = "cine-cruzeiro";
const JWT_AUDIENCE = "cine-cruzeiro-web";

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 8,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE
  };
  const encoded = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
  const signature = crypto.createHmac("sha256", getJwtSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyJwt(token) {
  const segments = String(token || "").split(".");
  if (segments.length !== 3) return null;
  const [header, body, signature] = segments;
  if (!header || !body || !signature) return null;
  const expected = crypto.createHmac("sha256", getJwtSecret()).update(`${header}.${body}`).digest("base64url");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now || payload.iat > now + 60) return null;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;
    return payload;
  } catch {
    return null;
  }
}

function authResponse(user) {
  return {
    user: sanitizeUser(user)
  };
}

function customerSessionValue(user) {
  return signedValue({
    sub: user.id,
    role: user.role,
    email: user.email,
    sv: Number(user.sessionVersion || 0),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  });
}

function tmdbAuthUrl(pathname, params = {}, db) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  const tmdb = getTmdbCredentials(db);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  if (tmdb.mode === "api_key") {
    url.searchParams.set("api_key", tmdb.token);
  }

  return url;
}

async function tmdbFetch(pathname, params = {}, db) {
  const tmdb = getTmdbCredentials(db);

  if (!tmdb.configured) {
    const error = new Error(tmdbSetupMessage());
    error.statusCode = 412;
    throw error;
  }

  const headers = tmdb.mode === "bearer" ? { Authorization: `Bearer ${tmdb.token}` } : {};

  const response = await fetch(tmdbAuthUrl(pathname, params, db), { headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.status_message || "Erro ao consultar o TMDB.");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function assetRecord(record, keys) {
  if (!record) return record;
  const next = { ...record };
  keys.forEach((key) => {
    if (next[key]) next[key] = publicAssetUrl(next[key]);
  });
  return next;
}

function assetMovie(movie) {
  return assetRecord(movie, ["posterUrl", "backdropUrl"]);
}

const getContent = createPublicContentPresenter({
  assetMovie,
  assetRecord,
  buildCalendarDaysForMovies,
  clubSavingsSummary,
  couponUsageSummary,
  enrichTicket,
  integrationConfigService,
  isDeletedMovie,
  publicContentSettings,
  publicSessionStatus,
  sanitizeUser,
  sellableSessions,
  sessionWithCurrentRoom,
  todayIsoDate,
});

const { buildCommercialCatalog } = createCommercialCatalogPresenter({
  appFrontendUrl,
  isSessionSellable,
  normalizedSessionStatus,
  publicAssetUrl,
  publicSessionStatus,
  roomDisplayLabel,
  roomForSession,
  sessionSalesOpenAt,
  sessionStartsAt,
  ticketTypesForSession,
  todayIsoDate
});

const { socialStudioBrand, socialStudioContext } = createSocialStudioContextPresenter({
  appFrontendUrl,
  buildCommercialCatalog,
  buildSocialReadyPosts,
  configuredAppBasePath,
  normalizeSocialBrand,
  publicAssetUrl,
  publicSocialStudioPost,
  slugify,
  SOCIAL_FORMATS,
  SOCIAL_SIGNATURES,
  SOCIAL_STUDIO_EDITORIAL_MOVIES,
  SOCIAL_STYLES,
  SOCIAL_TEMPLATES,
});

function publicSocialStudioPost(post = {}) {
  return {
    ...post,
    originalScene: undefined,
    draftScene: undefined,
    editedScene: undefined,
    sceneVersions: Array.isArray(post.sceneVersions)
      ? post.sceneVersions.map(({ scene, ...version }) => version)
      : [],
    editable: post.rendererVersion === "v2" || Boolean(post.originalScene),
    hasEditedScene: Boolean(post.editedScene),
    hasDraftScene: Boolean(post.draftScene)
  };
}

async function editableSceneForPost(post, db) {
  if (post.originalScene) return normalizeSocialScene(post.originalScene);
  if (post.rendererVersion !== "v2" || !post.payload) return null;
  const rendered = await renderSocialPost(post.payload, socialStudioContext(db), { loadImage: loadSocialStudioImage });
  return rendered.scene ? normalizeSocialScene(rendered.scene) : null;
}

function socialStudioPublicPath(value = "") {
  let pathname = String(value || "").trim();
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    // Caminhos locais seguem para a validacao abaixo.
  }
  const basePath = configuredAppBasePath();
  if (basePath && pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
  return stripPublicAssetBase(pathname);
}

async function readSocialStudioLocalImage(value = "") {
  const pathname = socialStudioPublicPath(value);
  let root = null;
  let relative = "";
  if (pathname.startsWith("/uploads/")) {
    root = storageService.rootDir;
    relative = pathname.replace(/^\/uploads\//, "");
  } else if (pathname.startsWith("/images/")) {
    root = FRONTEND_PUBLIC_DIR;
    relative = pathname.replace(/^\//, "");
  }
  if (!root || !relative) return null;
  const filePath = path.normalize(path.join(root, relative));
  if (!pathIsInside(root, filePath)) return null;
  return fs.readFile(filePath).catch(() => null);
}

async function validateSocialStudioImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 8 * 1024 * 1024) return null;
  const metadata = await sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!metadata || !["jpeg", "png", "webp"].includes(metadata.format) || !metadata.width || !metadata.height) return null;
  if (metadata.width * metadata.height > 40_000_000) return null;
  return buffer;
}

async function loadSocialStudioImage(value = "") {
  const local = await readSocialStudioLocalImage(value);
  if (local) return validateSocialStudioImageBuffer(local);
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const configuredHost = (() => {
    try { return new URL(appFrontendUrl()).hostname; } catch { return ""; }
  })();
  const allowedHosts = new Set([configuredHost, "image.tmdb.org", "images.unsplash.com"].filter(Boolean));
  if (!allowedHosts.has(parsed.hostname)) return null;
  try {
    const { buffer } = await downloadPublicBuffer(parsed, {
      httpsOnly: true,
      allowedHosts,
      timeoutMs: 8000,
      maxBytes: 8 * 1024 * 1024,
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" }
    });
    return validateSocialStudioImageBuffer(buffer);
  } catch { return null; }
}

async function persistSocialStudioPosts(db, posts, req, before = null) {
  const normalized = (Array.isArray(posts) ? posts : []).slice(0, 100);
  db.settings ||= {};
  db.settings.socialStudioPosts = normalized;
  if (postgresEnabled()) {
    await settingsRepository.updateSection("socialStudioPosts", normalized, {
      audit: repositoryAudit(req, "settings", "socialStudioPosts", before, normalized)
    });
  } else {
    await writeDb(db);
  }
  return normalized;
}

function socialStudioDownloadName(post = {}) {
  const title = slugify(post.title || post.templateName || "post") || "post";
  const extension = post.outputType === "jpg" ? "jpg" : "png";
  return `${title}-${post.formatId || "social"}.${extension}`;
}

function paymentStatusLabel(status = "") {
  return {
    approved: "Pago",
    paid: "Pago",
    pending: "Aguardando pagamento",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    rejected: "Pagamento recusado",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function orderStatusLabel(status = "") {
  return {
    paid: "Pago",
    paid_pending_print: "Pago; aguardando impressão",
    pending: "Pendente",
    pending_payment: "Aguardando pagamento",
    processing: "Processando",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    draft: "Rascunho",
    test: "Teste"
  }[String(status || "").toLowerCase()] || status || "Nao informado";
}

function originLabel(origin = "") {
  return {
    online: "Site",
    box_office: "Bilheteria",
    club: "Clube",
    manual: "Bilheteria"
  }[String(origin || "").toLowerCase()] || origin || "Site";
}

function methodLabel(method = "") {
  return {
    pix: "Pix",
    external_pix: "Pix",
    point_qr: "Pix na Point",
    PIX: "Pix",
    credit_card: "Cartão",
    CREDIT_CARD: "Cartão",
    cash: "Dinheiro",
    card_terminal: "Débito/crédito na Point",
    point_debit: "Débito na Point",
    point_credit: "Crédito na Point",
    courtesy: "Cortesia",
    club_credit: "Crédito do Clube",
    CLUB_CREDIT: "Crédito do Clube"
  }[String(method || "")] || method || "Nao informado";
}

function providerLabel(provider = "") {
  return {
    open_finance: "Pix legado",
    mercado_pago: "Mercado Pago",
    pag_bank: "PagBank",
    box_office: "Bilheteria",
    admin: "Administração",
    internal_club: "Clube",
    external_manual: "Registro manual",
    manual_external: "Maquininha externa"
  }[String(provider || "").toLowerCase()] || provider || "Manual";
}

const { parseAdminPeriod, inDateRange, compareMetric } = createCommercialReportPeriodService({ todayIsoDate, isValidCalendarDate, datePartsInSaoPaulo });





function orderReferencePrefix(movieTitle = "") {
  const ignoredWords = new Set(["A", "AS", "O", "OS", "DE", "DA", "DAS", "DO", "DOS", "E", "EM", "NO", "NA", "VS", "THE"]);
  const words = String(movieTitle || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const word = words.find((item) => item.length >= 3 && !ignoredWords.has(item)) || words.find((item) => !ignoredWords.has(item));
  return String(word || "PEDIDO").slice(0, 4);
}

function orderReferenceDigits(seed = "") {
  const digest = crypto.createHash("sha256").update(String(seed || "pedido")).digest();
  return String(digest.readUInt32BE(0) % 100000).padStart(5, "0");
}

function isFriendlyOrderReference(reference = "") {
  return /^[A-Z0-9]{2,8}-\d{5}$/.test(String(reference || "").trim().toUpperCase());
}

function createFriendlyOrderReference(movieTitle = "", seed = "") {
  return `${orderReferencePrefix(movieTitle)}-${orderReferenceDigits(seed || crypto.randomUUID())}`;
}

function ensureFriendlyOrderReference(db, order, movie = null) {
  if (!order) return "";
  const current = String(order.reference || order.publicReference || "").trim().toUpperCase();
  const prefix = orderReferencePrefix(movie?.title || order.movieTitle || "");
  const occupiedByAnotherOrder = (reference) => (db.orders || []).some((item) => (
    item.id !== order.id && String(item.reference || item.publicReference || "").trim().toUpperCase() === reference
  ));
  if (isFriendlyOrderReference(current) && current.startsWith(`${prefix}-`) && !occupiedByAnotherOrder(current)) {
    order.reference = current;
    return current;
  }

  const seed = order.id || order.idempotencyKey || current || crypto.randomUUID();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const digits = attempt === 0 ? orderReferenceDigits(seed) : String(crypto.randomInt(0, 100000)).padStart(5, "0");
    const candidate = `${prefix}-${digits}`;
    if (!occupiedByAnotherOrder(candidate)) {
      order.reference = candidate;
      return candidate;
    }
  }
  const fallback = `${prefix}-${String(Date.now() % 100000).padStart(5, "0")}`;
  order.reference = fallback;
  return fallback;
}

function shortOrderReference(order, movieTitle = "") {
  const reference = String(order?.reference || order?.publicReference || "").trim().toUpperCase();
  if (isFriendlyOrderReference(reference)) return reference;
  return createFriendlyOrderReference(movieTitle || order?.movieTitle || "", order?.id || reference || "pedido");
}

function movieForOrder(db, order) {
  return (db.movies || []).find((movie) => movie.id === order.movieId) || null;
}

function sessionForOrder(db, order) {
  const movie = movieForOrder(db, order);
  return (movie?.sessions || []).find((session) => session.id === order.sessionId) || null;
}

function orderTicketCount(order) {
  if (Array.isArray(order.ticketItems) && order.ticketItems.length) {
    return order.ticketItems.reduce((sum, item) => {
      const selectedQuantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
      const bundleQuantity = Math.max(1, Math.floor(Number(item.bundleQuantity || 1)));
      return sum + Math.max(0, Math.floor(Number(item.ticketQuantity ?? selectedQuantity * bundleQuantity)));
    }, 0);
  }
  return Number(order.fullTicketsCount || 0) + Number(order.halfTicketsCount || 0);
}

function recognizedTicketCount(db, orders) {
  return orders.reduce((total, order) => {
    const issued = (db.tickets || []).filter((ticket) => ticket.orderId === order.id);
    if (!issued.length) return total + orderTicketCount(order);
    return total + issued.filter((ticket) => !["cancelled", "refunded", "expired"].includes(String(ticket.status || ""))).length;
  }, 0);
}

function sessionCapacity(db, session) {
  const room = roomForSession(db, session);
  return Number(room?.capacity || 120);
}

function campaignStatusLabel(status = "") {
  return {
    draft: "Rascunho",
    scheduled: "Agendada",
    queued: "Na fila",
    sending: "Enviando",
    sent: "Concluída",
    completed: "Concluída",
    completed_with_errors: "Concluída com falhas",
    cancelled: "Cancelada",
    failed: "Falhou"
  }[String(status || "")] || "Rascunho";
}

const { campaignCustomerPool, campaignRecipients, eligibleCampaignRecipients,
  resolveCampaignForInput, applyCampaignTemplateResolution } = createEmailCampaignAudienceService({
  emailUnsubscribeUrlForUser, filterOfferRecipients, scopeCampaignContext,
  resolveCampaignTemplate, resolveCampaignContext, validateCampaignTemporalClaims
});

async function storeEmailAttachment(input = {}) {
  const contentType = String(input.contentType || "").toLowerCase().split(";")[0].trim();
  if (!EMAIL_ATTACHMENT_TYPES.has(contentType)) {
    const error = new Error("Tipo de anexo não permitido. Use PDF, TXT, CSV, JPG, PNG ou WebP.");
    error.statusCode = 415;
    throw error;
  }
  const raw = String(input.data || "");
  const encoded = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > EMAIL_ATTACHMENT_MAX_BYTES) {
    const error = new Error(`O anexo deve ter entre 1 byte e ${Math.round(EMAIL_ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB.`);
    error.statusCode = 413;
    throw error;
  }
  const signatures = {
    "application/pdf": buffer.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/png": buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9,
    "image/webp": buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  };
  if (contentType in signatures && !signatures[contentType]) {
    const error = new Error("O conteúdo real do arquivo não corresponde ao tipo informado.");
    error.statusCode = 415;
    throw error;
  }
  const safeName = path.basename(String(input.filename || "anexo"))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 90) || "anexo";
  await fs.mkdir(EMAIL_ATTACHMENT_ROOT, { recursive: true });
  const id = `email-anexo-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const filePath = path.join(EMAIL_ATTACHMENT_ROOT, `${id}-${safeName}`);
  await fs.writeFile(filePath, buffer, { flag: "wx" });
  return { id, filename: safeName, contentType, size: buffer.length, path: filePath, createdAt: new Date().toISOString() };
}

function validateCampaignAttachmentTotal(attachments = []) {
  const total = (attachments || []).reduce((sum, item) => sum + Math.max(0, Number(item.size || 0)), 0);
  if (total > EMAIL_ATTACHMENT_TOTAL_MAX_BYTES) {
    const error = new Error(`Os anexos da campanha não podem ultrapassar ${Math.round(EMAIL_ATTACHMENT_TOTAL_MAX_BYTES / 1024 / 1024)} MB no total.`);
    error.statusCode = 413;
    throw error;
  }
}

const { normalizeCampaignBlocks, normalizeEmailLogoUrl, normalizeEmailBrand, normalizeCampaignInput } =
  createEmailCampaignInputService({ crypto, validCampaignTemplate, appFrontendUrl });

const { publicCampaign, campaignDetails } = createEmailCampaignPresenter({ normalizeEmailBrand });

const { getAdminContent } = createAdminContentPresenter({
  getContent,
  roleAlias,
  adminHasPermission,
  campaignCustomerPool,
  publicCampaign
});


async function listPersistedCampaigns(filters = {}) {
  if (postgresEnabled()) return emailCampaignRepository.listCampaigns(filters);
  const db = await readDb();
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 25)));
  let campaigns = (db.emailCampaigns || []).map((item) => item.status === "sent" ? { ...item, status: item.failed ? "completed_with_errors" : "completed" } : item);
  if (filters.statuses?.length) campaigns = campaigns.filter((item) => filters.statuses.includes(item.status));
  if (filters.templateId) campaigns = campaigns.filter((item) => item.templateId === filters.templateId);
  if (filters.origin === "ai") campaigns = campaigns.filter((item) => item.aiGenerated);
  if (filters.origin === "manual") campaigns = campaigns.filter((item) => !item.aiGenerated);
  if (filters.search) campaigns = campaigns.filter((item) => `${item.subject || ""} ${item.headline || ""}`.toLowerCase().includes(String(filters.search).toLowerCase()));
  const total = campaigns.length;
  return { campaigns: campaigns.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)), totals: {} };
}

async function findPersistedCampaign(id) {
  if (postgresEnabled()) return emailCampaignRepository.getCampaign(id);
  const db = await readDb();
  return (db.emailCampaigns || []).find((item) => item.id === id) || null;
}

async function findPersistedCampaignByIdempotencyKey(key) {
  const normalized = String(key || "").trim();
  if (!normalized) return null;
  if (postgresEnabled()) return emailCampaignRepository.getCampaignByIdempotencyKey(normalized);
  const db = await readDb();
  return (db.emailCampaigns || []).find((item) => item.idempotencyKey === normalized) || null;
}

async function createPersistedCampaign(campaign) {
  if (postgresEnabled()) return emailCampaignRepository.createCampaign(campaign);
  let result = { campaign, created: true };
  await withCriticalMutation(async () => {
    const db = await readDb();
    db.emailCampaigns ||= [];
    const duplicate = campaign.idempotencyKey ? db.emailCampaigns.find((item) => item.idempotencyKey === campaign.idempotencyKey) : null;
    if (duplicate) result = { campaign: duplicate, created: false };
    else { db.emailCampaigns.unshift(campaign); await writeDb(db); }
  });
  return result;
}

async function persistAutoCampaignCoupon(coupon) {
  if (!coupon) return null;
  if (postgresEnabled()) {
    const current = await promotionRepository.findById(coupon.id);
    const fresh = await readDb();
    const normalized = normalizePromotion(coupon, current || {});
    assertPromotionRules(fresh, normalized, current?.id || "");
    return current
      ? promotionRepository.update(normalized)
      : promotionRepository.create(normalized);
  }
  let persisted = null;
  await withCriticalMutation(async () => {
    const fresh = await readDb();
    fresh.promotions ||= [];
    const current = fresh.promotions.find((item) => String(item.id) === String(coupon.id));
    const normalized = normalizePromotion(coupon, current || {});
    assertPromotionRules(fresh, normalized, current?.id || "");
    fresh.promotions = fresh.promotions.filter((item) => String(item.id) !== String(normalized.id));
    fresh.promotions.push(normalized);
    await writeDb(fresh);
    persisted = normalized;
  });
  return persisted;
}

async function removeAutoCampaignCoupon(campaignId, couponId = "") {
  if (postgresEnabled()) return promotionRepository.removeCampaignCoupon(campaignId, couponId);
  let removed = null;
  await withCriticalMutation(async () => {
    const fresh = await readDb();
    const index = (fresh.promotions || []).findIndex((item) =>
      item.autoManagedByCampaign === true &&
      String(item.sourceCampaignId || "") === String(campaignId || "") &&
      (!couponId || String(item.id) === String(couponId))
    );
    if (index < 0) return;
    [removed] = fresh.promotions.splice(index, 1);
    await writeDb(fresh);
  });
  return removed;
}

async function updatePersistedCampaign(id, campaign, allowedStates = ["draft", "failed"]) {
  if (postgresEnabled()) return emailCampaignRepository.updateCampaign(id, campaign);
  let updated = null;
  await withCriticalMutation(async () => {
    const db = await readDb();
    const existing = (db.emailCampaigns || []).find((item) => item.id === id);
    if (!existing || !allowedStates.includes(existing.status)) return;
    Object.assign(existing, campaign, { updatedAt: new Date().toISOString() });
    updated = existing;
    await writeDb(db);
  });
  return updated;
}

async function deletePersistedCampaign(id) {
  if (postgresEnabled()) return emailCampaignRepository.deleteCampaign(id);
  let deleted = false;
  await withCriticalMutation(async () => {
    const db = await readDb();
    const existing = (db.emailCampaigns || []).find((item) => item.id === id);
    if (!existing || !["draft", "failed", "cancelled"].includes(existing.status)) return;
    db.emailCampaigns = db.emailCampaigns.filter((item) => item.id !== id);
    deleted = true;
    await writeDb(db);
  });
  return deleted;
}

function resolveCampaignAttachments(db, attachments = []) {
  const library = new Map((db.settings?.emailAttachments || []).map((item) => [String(item.id), item]));
  return (Array.isArray(attachments) ? attachments : []).slice(0, 5).map((item) => {
    const stored = library.get(String(item.id || ""));
    return stored ? { ...stored } : item;
  }).filter((item) => item?.id && item?.path);
}

function buildEmailCampaignWorker() {
  if (!postgresEnabled()) return null;
  return createEmailCampaignWorker({
    repository: emailCampaignRepository,
    readDb,
    resolveAudience: eligibleCampaignRecipients,
    prepareCampaign: async (campaign) => {
      const db = await readDb();
      const coupon = (db.promotions || []).find((item) =>
        item.autoManagedByCampaign === true &&
        String(item.sourceCampaignId || "") === String(campaign.id || "")
      );
      if (!coupon) return campaign;
      const armedCoupon = armCampaignCoupon(coupon, campaign, new Date());
      await persistAutoCampaignCoupon(armedCoupon);
      logEvent("info", "email_campaign.coupon_synchronized", {
        campaignId: campaign.id,
        couponId: armedCoupon.id,
        active: armedCoupon.active,
        startsAt: armedCoupon.startsAt,
        endsAt: armedCoupon.endsAt
      });
      return campaign;
    },
    decorateRecipient: async (db, campaign, recipient) => {
      const token = recipient.customerId ? await emailCampaignRepository.issueUnsubscribeToken(recipient.customerId) : "";
      const coupon = (db.promotions || []).find((item) => String(item.id) === String(campaign.couponId || ""));
      return {
        ...recipient,
        unsubscribeUrl: token ? `${appFrontendUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}` : "",
        couponCode: coupon?.couponCode || "",
        couponExpiresAt: coupon?.endsAt ? brazilianDate(coupon.endsAt) : "",
        couponUrl: campaign.ctaUrl || appFrontendUrl()
      };
    },
    deliver: (db, campaign, recipient, correlation) => {
      const brand = normalizeEmailBrand(campaign.brand || db.settings?.emailBranding || {});
      return emailService.sendMarketingDelivery(db, {
        ...campaign,
        logoUrl: brand.logoUrl,
        brand,
        siteUrl: appFrontendUrl(),
        attachments: campaign.attachments || []
      }, recipient, correlation);
    },
    log: logEvent
  });
}

function sessionAvailabilityStatus(session, sold, capacity) {
  const now = new Date();
  const status = normalizedSessionStatus(session);
  if (["cancelled", "hidden", "archived"].includes(status)) return status === "cancelled" ? "Cancelada" : "Oculta";
  const startsAt = sessionStartsAt(session);
  if (startsAt && startsAt.getTime() < now.getTime()) return "Encerrada";
  if (sold >= capacity || status === "sold_out") return "Esgotada";
  const rate = capacity ? sold / capacity : 0;
  if (rate >= 0.9) return "Quase lotada";
  if (rate >= 0.7 || status === "filling_fast") return "Enchendo rápido";
  return "Boa disponibilidade";
}

function concessionAmountForOrderItem(item = {}, mode = "final") {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitPrice = mode === "original"
    ? Number(item.originalPrice ?? item.unitPrice ?? item.price ?? 0)
    : Number(item.finalPrice ?? item.unitPrice ?? item.price ?? 0);
  return Number((quantity * Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0)).toFixed(2));
}

function orderFinancialBreakdown(db, order = {}) {
  const ticketGross = Math.max(0, Number(ticketSubtotalForOrder(db, order) || 0));
  const concessionGross = Number((order.concessionItems || [])
    .reduce((sum, item) => sum + concessionAmountForOrderItem(item, "original"), 0).toFixed(2));
  const clubBenefits = order.clubBenefits && typeof order.clubBenefits === "object" ? order.clubBenefits : {};
  const ticketClubDiscount = Math.max(0, Number(clubBenefits.ticketDiscount || 0));
  const concessionClubDiscount = Number((order.concessionItems || []).reduce((sum, item) => sum + Math.max(0, Number(item.clubDiscount || 0)), 0).toFixed(2));
  const concessionFreeDiscount = Math.max(0, Number(clubBenefits.freeConcessionDiscount || 0));
  let ticketNet = Math.max(0, ticketGross - ticketClubDiscount - Number(order.clubCreditsApplied || 0));
  let concessionNet = Number((order.concessionItems || [])
    .reduce((sum, item) => sum + concessionAmountForOrderItem(item), 0).toFixed(2));
  concessionNet = Math.max(0, concessionNet - concessionFreeDiscount);

  const coupon = (db.promotions || []).find((item) => String(item.id) === String(order.couponId || ""));
  const couponDiscount = Math.max(0, Number(order.couponDiscount || 0));
  const appliesTo = ["tickets", "concessions"].includes(coupon?.appliesTo) ? coupon.appliesTo : "all";
  let ticketCouponDiscount = Math.max(0, Number(order.couponTicketDiscount || 0));
  let concessionCouponDiscount = Math.max(0, Number(order.couponConcessionDiscount || 0));
  if (couponDiscount > 0) {
    if (ticketCouponDiscount + concessionCouponDiscount <= 0 && appliesTo === "tickets") ticketCouponDiscount = Math.min(ticketNet, couponDiscount);
    else if (ticketCouponDiscount + concessionCouponDiscount <= 0 && appliesTo === "concessions") concessionCouponDiscount = Math.min(concessionNet, couponDiscount);
    else if (ticketCouponDiscount + concessionCouponDiscount <= 0) {
      const eligibleTotal = ticketNet + concessionNet;
      const ticketShare = eligibleTotal ? ticketNet / eligibleTotal : 1;
      ticketCouponDiscount = Math.min(ticketNet, couponDiscount * ticketShare);
      concessionCouponDiscount = Math.min(concessionNet, couponDiscount - ticketCouponDiscount);
    }
    ticketCouponDiscount = Math.min(ticketNet, ticketCouponDiscount);
    concessionCouponDiscount = Math.min(concessionNet, concessionCouponDiscount);
    ticketNet = Math.max(0, ticketNet - ticketCouponDiscount);
    concessionNet = Math.max(0, concessionNet - concessionCouponDiscount);
  }

  const orderTotal = Math.max(0, Number(order.totalPrice || 0));
  const calculatedTotal = ticketNet + concessionNet;
  const concessionBeforeReconciliation = concessionNet;
  if (calculatedTotal > 0 && Math.abs(calculatedTotal - orderTotal) > 0.009) {
    const factor = orderTotal / calculatedTotal;
    ticketNet = Number((ticketNet * factor).toFixed(2));
    concessionNet = Number(Math.max(0, orderTotal - ticketNet).toFixed(2));
  } else if (calculatedTotal === 0 && orderTotal > 0) {
    ticketNet = orderTotal;
  }

  const concessionAdjustment = Number((concessionNet - concessionBeforeReconciliation).toFixed(2));
  const ticketRevenueBeforeRefund = Number(ticketNet.toFixed(2));
  const concessionRevenueBeforeRefund = Number(concessionNet.toFixed(2));
  const refunds = applyCompletedRefunds({
    ticketRevenue: ticketRevenueBeforeRefund,
    concessionRevenue: concessionRevenueBeforeRefund,
    order,
    payment: orderPayment(db, order.id)
  });
  ticketNet = refunds.ticketRevenue;
  concessionNet = refunds.concessionRevenue;

  return {
    orderId: order.id || "",
    ticketGross: Number(ticketGross.toFixed(2)),
    concessionGross,
    ticketRevenueBeforeRefund,
    concessionRevenueBeforeRefund,
    ticketRevenue: Number(ticketNet.toFixed(2)),
    ticketRefunded: refunds.ticketRefunded,
    concessionRevenue: Number(concessionNet.toFixed(2)),
    concessionRefunded: refunds.concessionRefunded,
    ticketClubDiscount: Number(ticketClubDiscount.toFixed(2)),
    concessionClubDiscount: Number(concessionClubDiscount.toFixed(2)),
    concessionFreeDiscount: Number(concessionFreeDiscount.toFixed(2)),
    ticketCouponDiscount: Number(ticketCouponDiscount.toFixed(2)),
    concessionCouponDiscount: Number(concessionCouponDiscount.toFixed(2)),
    concessionAdjustment,
    approvedBeforeRefunds: Number((ticketRevenueBeforeRefund + concessionRevenueBeforeRefund).toFixed(2)),
    refundTotal: refunds.refundTotal,
    totalRevenue: Number((ticketNet + concessionNet).toFixed(2)),
    discount: Number(Math.max(0, ticketGross + concessionGross - orderTotal).toFixed(2))
  };
}

const { ticketDistributorReport, ticketDistributorCategoryLabel, ticketDistributorStatusLabel, ticketDistributorDateTime, ticketDistributorSessionSummary, ticketDistributorReportPdf } = createAdminTicketDistributorPresentation({
  brazilianDate,
  brl,
  buildPdf,
  calculateTicketDistributorReport,
  inDateRange,
  isOrderFinanciallySettled,
  movieForOrder,
  normalizeTicketDistributorRules,
  orderFinancialBreakdown,
  orderPayment,
  orderTickets,
  pdfLine,
  pdfRect,
  pdfWriteText,
  recognitionDate,
  sessionForOrder,
  shortOrderReference,
  todayIsoDate,
});

const adminDashboard = createAdminDashboardService({ todayIsoDate, sessionStartsAt, normalizedSessionStatus, sessionWithCurrentRoom, finishedSessionEndsAt, orderPayment, paymentStatusLabel, orderStatusLabel, originLabel, methodLabel, providerLabel, inDateRange, compareMetric, shortOrderReference, movieForOrder, recognizedTicketCount, sessionCapacity, sessionAvailabilityStatus, orderFinancialBreakdown });
const adminSubscriptionPresenter = createAdminSubscriptionPresenter({ refreshSubscriptionCredits, clubSavingsSummary,
  subscriptionStatusLabel, currentSubscriptionCredit, sanitizeUser, subscriptionSummary, enrichTicket });
const adminCustomerSearch = createAdminCustomerSearchService({ adminRoles, sanitizeUser });
const publicSessionSeatPresenter = createPublicSessionSeatPresenter({ roomSeats, roomSeatTypes });

function adminIntegrationsStatus(req, db) {
  const integrations = integrationConfigService.list(db);
  const googleOAuth = getGoogleOAuthConfig(req, db);
  const wallet = getGoogleWalletConfig(db);
  const tmdb = getTmdbCredentials(db);
  integrations.googleLogin.configured = Boolean(googleOAuth.clientId && googleOAuth.clientSecret);
  integrations.googleWallet.configured = Boolean(wallet.configured);
  integrations.tmdb.configured = Boolean(tmdb.configured);
  integrations.email.configured = Boolean(integrationConfigService.resolvedConfig(db, "email")?.configured || getEmailVerificationWebhookUrl(db) || getPasswordResetEmailWebhookUrl(db));
  integrations.crm.configured = Boolean(getCrmWebhookConfig(db).configured);
  return integrations;
}

const { googleWalletApiRequest, googleWalletApiGet, googleWalletApiPatch,
  testGoogleWalletIntegration } = createGoogleWalletIntegrationService({
  getGoogleWalletConfig, appFrontendUrl,
  buildGoogleWalletClassIdentityForCinema, buildGoogleWalletClassTemplateInfo,
  signWalletJwt, logEvent, fetch
});

async function testIntegrationProvider(db, provider, req) {
  const key = integrationConfigService.providerKey(provider);
  const config = integrationConfigService.resolvedConfig(db, key);
  if (!key || !config) {
    return { ok: false, message: "Integração não encontrada." };
  }
  if (key === "mercadoPago") {
    if (!config.accessToken || !config.publicKey) return { ok: false, message: "Informe public key e access token do Mercado Pago." };
    const response = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { ok: false, message: "Mercado Pago recusou as credenciais." };
    const methodsUrl = new URL("https://api.mercadopago.com/v1/payment_methods/search");
    methodsUrl.searchParams.set("public_key", String(config.publicKey));
    methodsUrl.searchParams.set("locale", "pt-BR");
    methodsUrl.searchParams.set("status", "active");
    methodsUrl.searchParams.set("limit", "1");
    const methodsResponse = await fetch(methodsUrl, { signal: AbortSignal.timeout(10000) });
    if (!methodsResponse.ok) return { ok: false, message: "Access Token autenticado, mas a Public Key não foi aceita pelo Mercado Pago. Confira a chave pública completa de produção." };
    if (!config.pointEnabled) return { ok: true, message: "Mercado Pago autenticado com sucesso. A integração Point está desativada." };
    if (!config.pointDeviceId) return { ok: false, message: "Informe o Terminal ID para testar o Mercado Pago Point." };
    try {
      const terminals = await cardTerminalProvider.listTerminals(config);
      const selected = terminals.find((terminal) => terminal.id === String(config.pointDeviceId));
      if (!selected) return { ok: false, message: "Credenciais válidas, mas o Terminal ID informado não pertence a esta conta." };
      if (selected.operatingMode && String(selected.operatingMode).toLowerCase() !== "pdv") {
        return { ok: false, message: `O terminal ${selected.name || selected.id} está no modo ${selected.operatingMode}. Altere-o para PDV no Mercado Pago.` };
      }
      const mode = selected.operatingMode ? `, modo ${selected.operatingMode}` : "";
      return { ok: true, message: `Mercado Pago e terminal ${selected.name || selected.id} conectados${mode}.` };
    } catch (error) {
      return { ok: false, message: error.message || "Não foi possível consultar os terminais Point." };
    }
  }
  if (key === "tmdb") {
    const data = await tmdbFetch("/configuration", {}, db).catch((error) => ({ error }));
    return data.error ? { ok: false, message: data.error.message || "TMDB indisponível." } : { ok: true, message: "TMDB conectado com sucesso." };
  }
  if (key === "googleLogin") {
    const googleOAuth = getGoogleOAuthConfig(req, db);
    return googleOAuth.clientId && googleOAuth.clientSecret
      ? { ok: true, message: "Login com Google possui credenciais mínimas." }
      : { ok: false, message: "Informe Client ID e Client secret." };
  }
  if (key === "googleWallet") {
    return testGoogleWalletIntegration(db);
  }
  if (key === "email") {
    if (String(config.provider || "smtp") === "smtp" || config.smtpHost) {
      const verified = await emailService.verifySmtp(db);
      if (!verified.ok) return verified;
      return emailService.sendIntegrationTest(db, req.adminUser?.email || config.fromEmail);
    }
    if (!config.webhookUrl) return { ok: false, message: "Informe SMTP ou webhook do provedor de e-mail." };
    return emailService.sendIntegrationTest(db, req.adminUser?.email || config.fromEmail);
  }
  if (key === "analytics") {
    const googleValid = !config.googleMeasurementId || /^G-[A-Z0-9]+$/i.test(config.googleMeasurementId);
    const metaValid = !config.metaPixelId || /^\d{5,30}$/.test(config.metaPixelId);
    const configured = Boolean(config.googleMeasurementId || config.metaPixelId);
    return {
      ok: configured && googleValid && metaValid,
      message: !configured
        ? "Informe ao menos um identificador de medição."
        : googleValid && metaValid
          ? "Identificadores válidos. A coleta inicia somente após consentimento do visitante."
          : "Revise o ID do Google Analytics ou do Pixel da Meta."
    };
  }
  if (key === "crm") {
    const crm = getCrmWebhookConfig(db);
    if (!crm.url) return { ok: false, message: "Informe a URL do webhook CRM." };
    if (!crm.secret) return { ok: false, message: "Informe o segredo usado para assinar as entregas HMAC." };
    const eventId = crypto.randomUUID();
    const body = { event: "integration.tested", eventId, timestamp: new Date().toISOString(), cinemaId: "cine_cruzeiro_sala_1", source: "cine-cruzeiro-admin" };
    const result = await sendCrmWebhook({ url: crm.url, secret: crm.secret, eventId, eventName: body.event, body, timeout: crm.timeout });
    return {
      ok: result.ok,
      code: result.errorCode || "",
      message: result.ok ? "Webhook CRM respondeu com sucesso e validou a chamada assinada." : result.httpStatus
        ? `Webhook CRM respondeu HTTP ${result.httpStatus}.`
        : result.errorCode === "CRM_TIMEOUT" ? "Webhook CRM excedeu o timeout configurado." : "Não foi possível chamar o webhook CRM."
    };
  }
  if (key === "pagBank") {
    if (!config.accessToken || !config.publicKey) return { ok: false, message: "Informe token e chave pública do PagBank." };
    try {
      const keyResponse = await pagBankPaymentService.request("/public-keys/card", config);
      if (!keyResponse.public_key || keyResponse.public_key !== config.publicKey) {
        return { ok: false, message: "O token foi aceito, mas a chave pública de cartão não corresponde a esta conta/ambiente." };
      }
      return { ok: true, message: "Token e chave pública PagBank válidos. Este teste não comprova liberação da API de Pedidos; confirme a homologação/whitelist com o PagBank antes de receber pagamentos em produção. Tap On e Clube requerem integrações separadas." };
    } catch (error) {
      return { ok: false, message: error.message || "Não foi possível validar as credenciais PagBank." };
    }
  }
  if (key === "discord") {
    if (!config.webhookUrl) return { ok: false, message: "Informe a URL privada do webhook do Discord." };
    return discordWebhookService.test(config);
  }
  if (key === "commercialCatalog") {
    return config.accessToken
      ? { ok: true, message: "Catálogo comercial protegido por token e pronto para ser consumido pela aplicação externa." }
      : { ok: false, message: "Gere e salve um token de acesso para publicar o catálogo comercial." };
  }
  return { ok: false, message: "Teste ainda não disponível para esta integração." };
}

function webhookTestStatus(input = {}) {
  const value = String(input.status || "processed").toLowerCase();
  if (["processed", "pending", "action_required", "cancelled", "canceled", "refunded", "rejected"].includes(value)) return value;
  return "processed";
}

function webhookTestAction(input = {}, status = "processed") {
  const requested = String(input.action || "").trim().toLowerCase();
  if (requested) return requested;
  if (status === "action_required") return "order.action_required";
  if (["cancelled", "canceled"].includes(status)) return "order.cancelled";
  if (status === "refunded") return "order.refunded";
  return "order.processed";
}

function buildMercadoPagoWebhookTestPayload(input = {}) {
  const status = webhookTestStatus(input);
  const action = webhookTestAction(input, status);
  const resourceId = String(input.resourceId || `ORDTST${crypto.randomBytes(13).toString("hex").toUpperCase()}`).slice(0, 96);
  const externalReference = String(input.externalReference || `webhook-test-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`).slice(0, 96);
  const amount = Math.max(0.01, Number(input.amount || 10));
  const providerStatus = status === "pending" ? "created" : status;
  const statusDetail = status === "processed" ? "accredited" : status === "pending" ? "waiting_payment" : status;
  return {
    action,
    api_version: "v1",
    application_id: "CINE_CRUZEIRO_WEBHOOK_TESTER",
    data: {
      currency_id: "BRL",
      external_reference: externalReference,
      id: resourceId,
      status: providerStatus,
      status_detail: statusDetail,
      total_amount: amount.toFixed(2),
      total_paid_amount: status === "processed" ? amount.toFixed(2) : "0.00",
      transactions: {
        payments: [{
          amount: amount.toFixed(2),
          id: `PAYTST${crypto.randomBytes(10).toString("hex").toUpperCase()}`,
          paid_amount: status === "processed" ? amount.toFixed(2) : "0.00",
          payment_method: { id: "master", installments: 1, type: "credit_card" },
          status: providerStatus,
          status_detail: statusDetail
        }]
      },
      type: "online",
      version: Number(input.version || 1)
    },
    date_created: input.dateCreated || new Date().toISOString(),
    live_mode: false,
    type: "order",
    user_id: "CINE_CRUZEIRO_TESTER"
  };
}

async function ensureWebhookTestFixture(payload, options = {}) {
  if (options.resourceMissing || mercadoPagoWebhookAction(payload) === "order.unknown") return;
  await withCriticalMutation(async () => {
    const db = await readDb();
    const reference = payload.data.external_reference;
    const resourceId = payload.data.id;
    const existing = (db.orders || []).find((item) => item.id === reference);
    if (existing && existing.origin !== "webhook_test") {
      const error = new Error("O simulador não pode alterar um pedido real. Use uma referência de teste exclusiva.");
      error.code = "WEBHOOK_TEST_REAL_ORDER_BLOCKED";
      error.statusCode = 409;
      throw error;
    }
    if (!existing) {
      const now = new Date().toISOString();
      db.orders.unshift({
        id: reference,
        idempotencyKey: reference,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentMethod: "credit_card",
        origin: "webhook_test",
        testOnly: true,
        movieTitle: "Teste de Webhook",
        fullTicketsCount: 0,
        halfTicketsCount: 0,
        concessionItems: [],
        customerName: "Simulador de Webhook",
        customerEmail: "",
        totalPrice: Number(payload.data.total_amount || 0),
        createdAt: now,
        updatedAt: now
      });
    }
    const payment = (db.payments || []).find((item) => item.orderId === reference && item.provider === "mercado_pago");
    if (!payment) {
      const now = new Date().toISOString();
      db.payments.unshift({
        id: `pagamento-webhook-test-${crypto.randomBytes(8).toString("hex")}`,
        orderId: reference,
        method: "credit_card",
        provider: "mercado_pago",
        providerPaymentId: resourceId,
        providerReference: reference,
        status: "pending",
        amount: Number(payload.data.total_amount || 0),
        currency: "BRL",
        metadata: { webhookSimulator: true },
        createdAt: now,
        updatedAt: now
      });
    }
    await writeDb(db);
  });
}

function webhookTestExpectation(scenario = "valid") {
  if (["invalid_signature", "missing_signature", "missing_request_id", "missing_data_id"].includes(scenario)) return 401;
  if (scenario === "invalid_payload") return 400;
  if (scenario === "resource_not_found") return 503;
  return 200;
}

async function storeWebhookSimulationRun(run) {
  if (postgresEnabled()) {
    await settingsRepository.prependArrayItem("webhookSimulatorRuns", run, 60);
    return;
  }
  await withCriticalMutation(async () => {
    const db = await readDb();
    db.settings ||= {};
    db.settings.webhookSimulatorRuns ||= [];
    db.settings.webhookSimulatorRuns.unshift(run);
    db.settings.webhookSimulatorRuns = db.settings.webhookSimulatorRuns.slice(0, 60);
    await writeDb(db);
  });
}

async function runMercadoPagoWebhookSimulation(input = {}, options = {}) {
  if (!webhookTesterEnabled()) {
    const error = new Error("O simulador de webhooks está desativado por WEBHOOK_TESTER_ENABLED.");
    error.code = "WEBHOOK_TESTER_DISABLED";
    error.statusCode = 404;
    throw error;
  }
  const currentDb = await readDb();
  const config = integrationConfigService.resolvedConfig(currentDb, "mercadoPago") || {};
  const secret = paymentService.getMercadoPagoWebhookSecret(config);
  if (!secret) {
    const error = new Error("Configure o Segredo do webhook do Mercado Pago antes de executar o simulador.");
    error.code = "MERCADO_PAGO_WEBHOOK_SECRET_REQUIRED";
    error.statusCode = 412;
    throw error;
  }

  const scenario = String(input.scenario || "valid").toLowerCase();
  const payload = buildMercadoPagoWebhookTestPayload(input);
  if (scenario === "unknown_event") payload.action = "order.unknown";
  const resourceMissing = scenario === "resource_not_found" || webhookTestExpectation(scenario) !== 200;
  await ensureWebhookTestFixture(payload, { resourceMissing });

  const requestId = String(input.requestId || crypto.randomUUID());
  const timestamp = String(input.timestamp || Math.floor(Date.now() / 1000));
  const signature = paymentService.createMercadoPagoWebhookSignature({ dataId: payload.data.id, requestId, timestamp }, secret);
  const query = new URLSearchParams({ type: "order" });
  if (scenario !== "missing_data_id") query.set("data.id", payload.data.id);
  const headers = { "Content-Type": "application/json" };
  if (scenario !== "missing_request_id") headers["x-request-id"] = requestId;
  if (scenario !== "missing_signature") headers["x-signature"] = scenario === "invalid_signature"
    ? `${signature.header.slice(0, -1)}${signature.header.endsWith("0") ? "1" : "0"}`
    : signature.header;

  if (!resourceMissing) {
    mercadoPagoSimulatedOrders.set(payload.data.id, {
      order: paymentService.normalizeMercadoPagoWebhookOrder(payload),
      expiresAt: Date.now() + 15000
    });
  }

  const startedAt = Date.now();
  let status = 0;
  let responsePayload = {};
  let responseText = "";
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/mercado-pago?${query}`, {
      method: "POST",
      headers,
      body: scenario === "invalid_payload" ? "{" : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
    status = response.status;
    responseText = await response.text();
    responsePayload = JSON.parse(responseText || "{}");
  } catch (error) {
    responsePayload = { error: { code: "WEBHOOK_TEST_REQUEST_FAILED", message: error.message } };
  } finally {
    mercadoPagoSimulatedOrders.delete(payload.data.id);
  }
  const elapsedMs = Date.now() - startedAt;
  const expectedStatus = webhookTestExpectation(scenario);
  const processing = responsePayload.processing || {};
  const run = {
    id: options.runId || `webhook-run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    scenario,
    action: payload.action,
    resourceId: payload.data.id,
    externalReference: payload.data.external_reference,
    requestId,
    timestamp: new Date().toISOString(),
    httpStatus: status,
    expectedStatus,
    passed: status === expectedStatus && (scenario !== "duplicate" || Boolean(responsePayload.duplicate)),
    signatureValid: status !== 401 && !["invalid_signature", "missing_signature", "missing_request_id", "missing_data_id"].includes(scenario),
    result: responsePayload.duplicate ? "Webhook já processado — nenhuma duplicação realizada." : responsePayload.ok ? "Processamento concluído" : responsePayload.error?.message || responseText || "Sem resposta",
    processing,
    duplicate: Boolean(responsePayload.duplicate),
    elapsedMs,
    payload: sanitizeWebhookTestPayload(payload),
    request: {
      signaturePresent: Boolean(headers["x-signature"]),
      requestIdPresent: Boolean(headers["x-request-id"]),
      dataIdPresent: query.has("data.id")
    },
    response: {
      ok: Boolean(responsePayload.ok),
      errorCode: responsePayload.error?.code || "",
      processed: Boolean(responsePayload.processed),
      duplicate: Boolean(responsePayload.duplicate)
    },
    replay: { scenario, payload: sanitizeWebhookTestPayload(payload), requestId, timestamp }
  };
  await storeWebhookSimulationRun(run);
  return run;
}

async function runWebhookBatchJob(job) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  const seed = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const collect = async (input) => {
    const run = await runMercadoPagoWebhookSimulation(input);
    job.runs.push(run);
    job.completed += 1;
    job.passed += run.passed ? 1 : 0;
    job.failed += run.passed ? 0 : 1;
    return run;
  };

  try {
    const valid = await collect({
      scenario: "valid",
      action: "order.processed",
      externalReference: `webhook-bateria-${seed}`,
      resourceId: `ORDTSTBATCH${crypto.randomBytes(10).toString("hex").toUpperCase()}`
    });
    await collect({
      scenario: "duplicate",
      action: valid.action,
      externalReference: valid.externalReference,
      resourceId: valid.resourceId,
      requestId: valid.requestId,
      timestamp: valid.replay.timestamp
    });
    await collect({ scenario: "invalid_signature", action: "order.processed" });
    await collect({ scenario: "missing_signature", action: "order.processed" });
    await collect({ scenario: "unknown_event" });
    await collect({ scenario: "resource_not_found", action: "order.processed" });
    await collect({ scenario: "valid", action: "order.action_required", status: "action_required" });
    await collect({ scenario: "valid", action: "order.processed" });
    job.status = "completed";
  } catch (error) {
    job.status = "failed";
    job.error = error.message || "A bateria de testes não pôde ser concluída.";
  } finally {
    job.completedAt = new Date().toISOString();
  }
}

const serveStatic = createStaticAssetHandler({
  stripPublicAssetBase,
  storageService,
  pathIsInside,
  sendJson,
  securityHeaders,
  MIME_TYPES,
  corsOrigin,
  readDb,
  getAdminUser,
  adminPathForRequest,
  PUBLIC_DIR,
  TRAILERS_DIR,
  FRONTEND_PUBLIC_DIR
});

const serveDesktopUpdate = createDesktopUpdateHandler({ PUBLIC_DIR, pathIsInside, sendJson, securityHeaders, MIME_TYPES });

function mercadoPagoReferenceMatches(payment, externalReference) {
  const received = String(externalReference || "");
  if (!received) return true;
  const localOrderId = String(payment?.orderId || "");
  const providerReference = String(payment?.providerReference || "");
  return received === providerReference
    || received === localOrderId
    || received === localOrderId.slice(0, 64);
}

async function reconcileOnlineCheckoutOrder(orderId, snapshotDb) {
  const snapshotOrder = (snapshotDb.orders || []).find((item) => item.id === orderId || item.idempotencyKey === orderId);
  if (!snapshotOrder) return false;
  const snapshotPayment = (snapshotDb.payments || []).find((item) => item.orderId === snapshotOrder.id);
  if (!snapshotPayment || !["mercado_pago", "pag_bank"].includes(snapshotPayment.provider) || !snapshotPayment.providerPaymentId) return false;

  const hasTickets = (snapshotDb.tickets || []).some((ticket) => ticket.orderId === snapshotOrder.id);
  const needsReconciliation = ["pending", "processing", "expired"].includes(String(snapshotPayment.status || ""))
    || (snapshotPayment.status === "approved" && (snapshotOrder.status !== "paid" || !hasTickets));
  if (!needsReconciliation) return false;

  const now = Date.now();
  const lastAttempt = Number(paymentReconciliationAttempts.get(snapshotOrder.id) || 0);
  if (now - lastAttempt < 10000) return false;
  paymentReconciliationAttempts.set(snapshotOrder.id, now);
  if (paymentReconciliationAttempts.size > 5000) {
    for (const [candidateId, attemptedAt] of paymentReconciliationAttempts) {
      if (now - attemptedAt > 30 * 60 * 1000) paymentReconciliationAttempts.delete(candidateId);
    }
  }

  const providerConfig = integrationConfigService.resolvedConfig(snapshotDb, snapshotPayment.provider === "pag_bank" ? "pagBank" : "mercadoPago");
  let providerStatus = snapshotPayment.provider === "pag_bank"
    ? await pagBankPaymentService.fetchOrder(snapshotPayment.providerPaymentId, providerConfig || {})
    : await paymentService.fetchProviderPaymentStatus("mercado_pago", snapshotPayment.providerPaymentId, providerConfig || {});
  if (snapshotPayment.provider === "pag_bank" && providerStatus?.status === "processing") {
    providerStatus = await pagBankPaymentService.captureAuthorizedOrder(providerStatus, providerConfig || {});
  }
  if (!providerStatus || providerStatus.status === "pending") return false;

  if (String(providerStatus.id || "").toLowerCase() !== String(snapshotPayment.providerPaymentId).toLowerCase()
    || (providerStatus.status === "approved" && !providerStatus.externalReference)
    || !mercadoPagoReferenceMatches(snapshotPayment, providerStatus.externalReference)) {
    logEvent("warn", "payment.reconciliation_reference_mismatch", {
      orderId: snapshotOrder.id,
      providerPaymentId: snapshotPayment.providerPaymentId
    });
    return false;
  }
  if ((providerStatus.status === "approved" && (!Number.isFinite(Number(providerStatus.amount)) || Number(providerStatus.amount) <= 0))
    || (providerStatus.amount && Math.round(Number(providerStatus.amount) * 100) !== Math.round(Number(snapshotPayment.amount) * 100))) {
    logEvent("warn", "payment.reconciliation_amount_mismatch", {
      orderId: snapshotOrder.id,
      providerPaymentId: snapshotPayment.providerPaymentId
    });
    return false;
  }

  return withCriticalMutation(async () => {
    const lockedDb = await readDb();
    const order = (lockedDb.orders || []).find((item) => item.id === snapshotOrder.id);
    const payment = (lockedDb.payments || []).find((item) => item.orderId === snapshotOrder.id);
    if (!order || !payment) return false;

    const wasAlreadyPaid = order.status === "paid";
    payment.status = paymentStatusAfterWebhook(payment.status, providerStatus.status);
    payment.updatedAt = new Date().toISOString();
    payment.metadata = {
      ...(payment.metadata || {}),
      lastReconciliationAt: new Date().toISOString(),
      providerStatus: providerStatus.raw || null
    };
    if (providerStatus.externalReference) payment.providerReference = providerStatus.externalReference;
    if (payment.metadata?.cancellationRefund) {
      await writeDb(lockedDb);
      return true;
    }

    let tickets = [];
    if (payment.status === "approved" && ["pending_payment", "paid"].includes(order.status)) {
      tickets = finalizePaidOrder(lockedDb, order, payment, "online");
      if (!wasAlreadyPaid && tickets.length) {
        consumePendingClubCredit(lockedDb, order, tickets, order.customerUserId);
      }
    } else if (payment.status === "approved" && order.status === "expired") {
      order.latePaymentReview = { provider: payment.provider, detectedAt: payment.updatedAt, amount: payment.amount };
      logEvent("error", "payment.late_after_reservation_expired", { orderId: order.id, providerPaymentId: payment.providerPaymentId, amount: payment.amount });
    } else if (payment.status === "approved" && ["cancelled", "refunded"].includes(order.status)) {
      order.latePaymentReview = { provider: payment.provider, detectedAt: payment.updatedAt, amount: payment.amount };
      logEvent("error", "payment.approved_after_order_cancelled", { orderId: order.id, providerPaymentId: payment.providerPaymentId, amount: payment.amount });
    } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status) && order.status !== "paid") {
      releaseConcessionReservation(lockedDb, order);
      order.status = payment.status === "refunded" ? "refunded" : payment.status === "rejected" ? "cancelled" : payment.status;
      order.paymentStatus = payment.status;
    }

    await writeDb(lockedDb);
    if (order.sessionId) seatRealtimeService?.broadcastSessionRefresh(order.sessionId);
    if (!wasAlreadyPaid && tickets.length) queueTicketEmailDelivery(order.id);
    logEvent("info", "payment.reconciled", {
      orderId: order.id,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      tickets: tickets.length
    });
    return true;
  });
}

const handleMovieCatalogRoutes = createMovieCatalogHandler({
  assertMovieCanBeDeleted,
  buildSessionAutocorrectPlan,
  createMovieSessionBatch,
  crypto,
  deleteLocalTrailer,
  deleteUnreferencedAssets,
  deletedMovieRecord,
  isDeletedMovie,
  listActiveSeatHolds,
  memorySeatHolds,
  movieDurationMinutes,
  movieHistory,
  movieImageService,
  movieRepository,
  normalizeMovie,
  normalizeMovieSession,
  postgresEnabled,
  readBody,
  repositoryAudit,
  requireSessionRoomConflictConfirmation,
  roomForSession,
  sendJson,
  sessionCommercialChanges,
  sessionHasActiveSeatAssignments,
  sessionHasAuditHistory,
  sessionRepository,
  sessionRoomConflicts,
  sessionStartsAt,
  sessionWithCurrentRoom,
  syncHighlightTrailerCache,
  syncSessionSnapshotRecords,
  validateMovieForWorkflow,
  validateSessionRoom,
  writeDb,
  getSeatRealtimeService: () => seatRealtimeService
});

const handleVenueConfigurationRoutes = createVenueConfigurationHandler({
  movieDurationMinutes,
  normalizeRoom,
  normalizeTicketType,
  postgresEnabled,
  readBody,
  repositoryAudit,
  roomDisplayLabel,
  roomForSession,
  roomRepository,
  roomSeatIdsInActiveUse,
  roomSeats,
  sendJson,
  sessionRoomConflicts,
  sessionStartsAt,
  syncRoomSessionReferences,
  ticketTypeRepository,
  writeDb,
  getSeatRealtimeService: () => seatRealtimeService
});

const handleCommercialCatalogRoutes = createCommercialCatalogHandler({
  assertPromotionRules,
  concessionRepository,
  couponUsageHistory,
  couponUsageSummary,
  normalizeAd,
  normalizeConcession,
  normalizePromotion,
  postgresEnabled,
  promotionRepository,
  readBody,
  repositoryAudit,
  sendJson,
  settingsRepository,
  writeDb
});

const { openPerformanceStream, broadcastPerformanceSnapshot } = createPerformanceStreamService({
  releaseInfo,
  sendJson,
  securityHeaders,
  getSnapshot: () => performanceMonitor.snapshot()
});

const handleAdminLogsRoutes = createAdminLogsHandler({
  BUSINESS_LOG_EVENTS,
  businessLogVisible,
  getPerformanceMonitor: () => performanceMonitor,
  listSystemLogsFromPostgres,
  logEvent,
  openPerformanceStream,
  postgresDiagnostics,
  postgresEnabled,
  pruneSystemLogsFromPostgres,
  readBody,
  releaseInfo,
  sendJson
});

const { handleHealthRoute, handleDesktopUpdateRoute } = createInfrastructureRoutes({
  checkPostgresReadiness,
  latestSchemaMigration: LATEST_SCHEMA_MIGRATION,
  isProduction,
  postgresEnabled,
  sendJson,
  serveDesktopUpdate
});

const handleCinemaSettingsRoutes = createCinemaSettingsHandler({
  readBody,
  storedEditorialImageUrl,
  postgresEnabled,
  settingsRepository,
  repositoryAudit,
  writeDb,
  sendJson,
  assetRecord
});

const handleAdminUserWriteRoutes = createAdminUserWriteHandler({
  roleAlias,
  normalizeUser,
  adminUserPayload,
  postgresEnabled,
  userRepository,
  repositoryAudit,
  writeDb,
  sanitizeUser,
  readBody,
  sendJson
});

const { handlePublicContentRoute, handleAdminContentRoute } = createCatalogReadHandler({
  sendJson,
  getContent,
  getAdminContent,
  postgresEnabled,
  adminHasPermission,
  emailCampaignRepository,
  publicCampaign
});

const handleAdminOverviewRoutes = createAdminOverviewHandler({
  sendJson,
  adminDashboard,
  parseAdminPeriod,
  listPersistedCampaigns,
  postgresEnabled,
  emailCampaignRepository,
  adIsVisible,
  couponUsageSummary,
  publicCampaign
});

const handleAdminCustomerRoute = createAdminCustomerHandler({ adminCustomerSearch, sendJson });

const { handleTmdbSearchRoute, handleTmdbMovieRoute } = createTmdbLookupHandler({
  tmdbFetch,
  tmdbMoviePayload,
  slugify,
  sendJson
});

const handleAdminEmailRoute = createAdminEmailRoutes({
  appFrontendUrl,
  applyCampaignTemplateResolution,
  armCampaignCoupon,
  buildTemplateLibrary,
  campaignCustomerPool,
  campaignDetails,
  campaignRecipients,
  createPersistedCampaign,
  definitionFor,
  deletePersistedCampaign,
  eligibleCampaignRecipients,
  emailCampaignRepository,
  emailService,
  findPersistedCampaign,
  integrationConfigService,
  listPersistedCampaigns,
  logEvent,
  normalizeCampaignInput,
  normalizeEmailBrand,
  normalizeEmailLogoUrl,
  persistAutoCampaignCoupon,
  postgresEnabled,
  publicCampaign,
  readBody,
  removeAutoCampaignCoupon,
  repositoryAudit,
  resolveCampaignAttachments,
  sendJson,
  settingsRepository,
  storeEmailAttachment,
  syncCampaignCouponSchedule,
  updateLibraryPreference,
  updatePersistedCampaign,
  validCampaignTemplate,
  validateCampaignAttachmentTotal,
  variantFor,
  writeDb,
});

const handleAdminSocialStudioRoute = createAdminSocialStudioRoutes({
  adminHasPermission,
  captionForDraft,
  createHistoryRecord,
  editableSceneForPost,
  generateSocialCampaign,
  getSocialStudioAutomationOrchestrator,
  loadSocialStudioImage,
  logEvent,
  normalizeSocialDraft,
  normalizeSocialScene,
  persistSocialStudioPosts,
  publicAssetUrl,
  publicSocialStudioPost,
  readBody,
  renderSocialPost,
  renderSocialScene,
  responseCorsOrigin,
  securityHeaders,
  sendJson,
  slugify,
  socialDraftNotices,
  socialStudioBrand,
  socialStudioContext,
  socialStudioDownloadName,
  storageService,
  SOCIAL_FORMATS,
});

const handleAdminReportRoute = createAdminReportRoutes({
  adminDashboard,
  brazilianDate,
  csvResponse,
  logEvent,
  normalizeTicketDistributorRules,
  parseAdminPeriod,
  postgresEnabled,
  readBody,
  repositoryAudit,
  responseCorsOrigin,
  securityHeaders,
  sendJson,
  settingsRepository,
  ticketDistributorCategoryLabel,
  ticketDistributorDateTime,
  ticketDistributorReport,
  ticketDistributorReportPdf,
  ticketDistributorStatusLabel,
  writeDb,
});

const handleEmailAutomationRoute = createEmailAutomationRoutes({
  appFrontendUrl,
  applyCampaignTemplateResolution,
  buildEmailAutomationPlan,
  createPersistedCampaign,
  eligibleCampaignRecipients,
  emailAutomationAuthorized,
  emailAutomationContext,
  emailCampaignRepository,
  findPersistedCampaignByIdempotencyKey,
  integrationConfigService,
  listPersistedCampaigns,
  logEvent,
  normalizeCampaignInput,
  postgresEnabled,
  publicCampaign,
  readBody,
  sendJson,
});

const handleAdminIntegrationRoute = createAdminIntegrationRoutes({
  activeOnlinePaymentProvider,
  activeWebhookBatchJob,
  adminIntegrationsStatus,
  configureCrmWebhookWorker,
  configureDiscordWebhook,
  createCrmOutboxRepository,
  createWebhookBatchJob,
  ensureAdmin,
  getCrmWebhookWorker,
  integrationConfigService,
  isProduction,
  logEvent,
  outsidePostgresTransaction,
  postgresEnabled,
  readBody,
  readDb,
  repositoryAudit,
  roleAlias,
  runMercadoPagoWebhookSimulation,
  runWebhookBatchJob,
  sendJson,
  settingsRepository,
  testIntegrationProvider,
  webhookBatchJobSnapshot,
  webhookBatchJobs,
  webhookTesterEnabled,
  withCriticalMutation,
  writeDb,
});

const handleAdminPaymentsRead = createAdminPaymentsReadHandler({
  cardTerminalProvider,
  inDateRange,
  integrationConfigService,
  methodLabel,
  movieForOrder,
  orderStatusLabel,
  originLabel,
  parseAdminPeriod,
  paymentStatusLabel,
  providerLabel,
  sendJson,
  shortOrderReference,
});

const handleSeatMapRead = createSeatMapReadHandler({
  adminHasPermission,
  buildAdminSessionSeatMap,
  findSessionWithMovie,
  listActiveSeatHolds,
  occupiedSeatIds,
  publicSessionSeatPresenter,
  roomForSession,
  roomSeatSelectionEnabled,
  sendJson,
  sessionSeatAvailability,
});

const handleAdminSessionRoutes = createAdminSessionRoutes({
  crypto,
  readBody,
  loginBlockStatus,
  sendJson,
  postgresEnabled,
  userRepository,
  adminRoles,
  verifyPassword,
  recordLoginFailure,
  clearLoginFailures,
  passwordNeedsRehash,
  hashPassword,
  writeDb,
  adminTwoFactorService,
  createAdminTwoFactorChallenge,
  readAdminTwoFactorChallenge,
  adminTwoFactorChallenges,
  withCriticalMutation,
  readDb,
  sendAdminLoginSuccess,
  getAdminUser,
  adminOriginAllowed,
  repositoryAudit,
  clientIp,
  securityHeaders,
  adminCookie,
  responseCorsOrigin,
  sanitizeUser
});

const handleAdminAccountRoutes = createAdminAccountRoutes({
  crypto,
  readBody,
  storageService,
  sendJson,
  adminProfilePicture,
  repositoryAudit,
  postgresEnabled,
  userRepository,
  withCriticalMutation,
  readDb,
  getAdminUser,
  writeDb,
  sanitizeUser,
  passwordPolicyError,
  verifyPassword,
  hashPassword,
  verifySignedValue,
  parseCookies,
  signedValue,
  adminCookie,
  adminTwoFactorService,
  QRCode,
  logEvent,
  settingsRepository
});

const handleCustomerAuthRoutes = createCustomerAuthRoutes({
  crypto,
  readBody,
  sendJson,
  passwordPolicyError,
  postgresEnabled,
  userRepository,
  normalizeUser,
  hashPassword,
  getGoogleOAuthConfig,
  hashResetToken,
  writeDb,
  notifyEmailVerification,
  isProduction,
  authResponse,
  customerCookie,
  customerSessionValue,
  loginBlockStatus,
  recordLoginFailure,
  clearLoginFailures,
  passwordNeedsRehash,
  verifyPassword,
  getCustomerUser,
  sanitizeUser,
  checkoutAccessCookie,
  requestStillCoolingDown,
  transactionalEmailConfigured,
  logEvent,
  notifyPasswordReset
});

const handleCustomerAccountRoutes = createCustomerAccountRoutes({
  crypto,
  readBody,
  sendJson,
  getCustomerUser,
  phoneDigits,
  cpfDigits,
  verifyPassword,
  passwordPolicyError,
  hashPassword,
  postgresEnabled,
  userRepository,
  writeDb,
  sanitizeUser,
  customerCookie,
  customerSessionValue,
  requestStillCoolingDown,
  getGoogleOAuthConfig,
  hashResetToken,
  notifyEmailVerification,
  isProduction,
  transactionalEmailConfigured,
  authResponse
});

const { handleAdminConcessionSalesRead } = createAdminConcessionSalesReadHandler({
  todayIsoDate,
  orderPayment,
  inDateRange,
  sessionForOrder,
  sessionStartsAt,
  finishedSessionEndsAt,
  orderFinancialBreakdown,
  summarizeConcessionFinance,
  methodLabel,
  paymentStatusLabel,
  concessionRefundEligibility,
  sendJson
});

const { handlePublicClubRead, handleAdminClubPlanRead, handleAdminClubSubscriptionRead } = createClubReadRoutes({
  sendJson,
  assetRecord,
  getCustomerUser,
  subscriptionSummary,
  adminSubscriptionPresenter
});

const { handleAdminOrderListRead, handleAdminOrderDetailRead } = createAdminOrderReadRoutes({
  postgresEnabled,
  orderRepository,
  orderPayment,
  orderTickets,
  enrichTicket,
  sendJson
});

const { handleCustomerTicketListRead, handleCustomerTicketDetailRead } = createCustomerTicketReadRoutes({
  appFrontendUrl,
  securityHeaders,
  requireCustomerAuth,
  ticketBelongsToUser,
  enrichTicket,
  toCustomerTicketDto,
  getOwnedTicket,
  sendJson
});

async function handleApi(req, res, pathname) {
  const method = req.method;
  if (method === "OPTIONS") {
    const catalogConfig = pathname === "/api/commercial/catalog"
      ? integrationConfigService.resolvedConfig(await readDb(), "commercialCatalog")
      : null;
    sendNoContent(res, catalogConfig ? commercialCatalogCorsHeaders(req, catalogConfig) : {});
    return;
  }

  if (await handleHealthRoute({ res, pathname, method })) return;

  const context = requestContext.getStore();
  if (!req.rateLimitChecked) {
    req.rateLimitChecked = true;
    const limited = rateLimit(req, pathname, method);
    if (limited) {
      sendJson(res, 429, { error: limited }, {
        "Retry-After": String(limited.retryAfter),
        "RateLimit-Policy": limited.policy
      });
      return;
    }
  }

  if (await handleDesktopUpdateRoute({ res, pathname, method })) return;

  const targetedRepositoryMutation = postgresEnabled() && repositoryMutationRoute(pathname, method);
  const selfManagedOrderDeletion = method === "DELETE" && /^\/api\/orders\/[^/]+$/.test(pathname);
  const selfManagedPermanentOrderDeletion = method === "DELETE" && /^\/api\/orders\/[^/]+\/permanent$/.test(pathname);
  const selfManagedConcessionArchive = method === "POST" && /^\/api\/admin\/concession-sales\/[^/]+\/archive$/.test(pathname);
  const selfManagedTicketValidation = method === "POST" && pathname === "/api/tickets/validate";
  const selfManagedClubAssignment = method === "POST" && pathname === "/api/admin/subscriptions/assign";
  const selfManagedBoxOfficeSale = method === "POST" && ["/api/box-office/sales", "/api/tickets/manual", "/api/admin/concession-counter-sales"].includes(pathname);
  const selfManagedPointCancellation = method === "POST" && /^\/api\/box-office\/point-payments\/[^/]+\/cancel$/.test(pathname);
  const selfManagedRefundFlow = method === "POST" && (
    /^\/api\/orders\/[^/]+\/refund-(tickets|concessions)$/.test(pathname)
    || /^\/api\/admin\/concession-sales\/[^/]+\/refund$/.test(pathname)
    || /^\/api\/box-office\/point-payments\/[^/]+\/resolve-print-failure$/.test(pathname)
  );
  req.commitResponseAfterMutation = selfManagedBoxOfficeSale || pathname.startsWith("/api/box-office/point-payments/");
  req.repositoryMutation = targetedRepositoryMutation;
  if (postgresEnabled() && mutatesState(method) && adminAuthRequired(pathname, method)
    && !targetedRepositoryMutation && !selfManagedOrderDeletion && !selfManagedPermanentOrderDeletion && !selfManagedConcessionArchive && !selfManagedTicketValidation && !selfManagedClubAssignment && !selfManagedBoxOfficeSale && !selfManagedPointCancellation && !selfManagedRefundFlow && !context?.adminMutationLocked) {
    context.adminMutationLocked = true;
    try {
      await withCriticalMutation(() => handleApi(req, res, pathname));
    } finally {
      context.adminMutationLocked = false;
    }
    return;
  }

  if (!customerMutationOriginAllowed(req)) {
    sendJson(res, 403, { error: { code: "CUSTOMER_CSRF_BLOCKED", message: "Origem da requisição não autorizada." } });
    return;
  }

  const db = await readDb({ trackChanges: method !== "GET" && method !== "HEAD" });

  if (await handleEmailAutomationRoute({ req, res, pathname, method, db })) return;

  if (pathname.startsWith("/api/studio/") && !studioAutomationAuthorized(req)) {
    const configured=Boolean(process.env.STUDIO_AUTOMATION_TOKEN || process.env.N8N_STUDIO_SHARED_SECRET);
    sendJson(res,configured?401:503,{error:{code:'STUDIO_AUTOMATION_UNAVAILABLE',message:configured?'Credencial de automação inválida.':'A integração de automação ainda não foi configurada.'}});
    return;
  }
  if (pathname === "/api/studio/context" && method === "GET") {
    const studio=socialStudioContext(db);
    sendJson(res,200,{cinema:studio.brand,movies:studio.movies,concessions:studio.concessions,clubPlans:studio.clubPlans,formats:studio.formats.map(({id,name,width,height})=>({id,name,width,height})),templates:studio.templates.map(({id,name,category})=>({id,name,category}))},{'Cache-Control':'no-store'});
    return;
  }
  if (pathname === "/api/studio/campaigns/generate" && method === "POST") {
    const body=await readBody(req);
    body.idempotencyKey ||= String(req.headers['idempotency-key'] || '');
    const campaign=await getSocialStudioAutomationOrchestrator().create({...body,source:'n8n',triggerType:body.triggerType || 'webhook'},{createdBy:'n8n'});
    sendJson(res,campaign.duplicate?200:202,{campaign,statusUrl:`${publicBackendUrl()}/api/studio/campaigns/${campaign.id}`},{'Cache-Control':'no-store'});
    return;
  }
  const studioAutomationMatch=pathname.match(/^\/api\/studio\/campaigns\/([a-f0-9-]{36})$/);
  if(studioAutomationMatch && method==='GET') {
    const campaign=await getSocialStudioAutomationOrchestrator().get(studioAutomationMatch[1]);
    if(!campaign){sendJson(res,404,{error:{code:'STUDIO_CAMPAIGN_NOT_FOUND',message:'Campanha automática não encontrada.'}});return;}
    sendJson(res,200,{campaign},{'Cache-Control':'no-store'});return;
  }

  if (pathname === "/api/commercial/catalog" && method === "GET") {
    const catalogConfig = integrationConfigService.resolvedConfig(db, "commercialCatalog") || {};
    const legacyQueryToken = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.has("token");
    const legacyHeaders = legacyQueryToken ? {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      Deprecation: "true"
    } : {};
    if (!catalogConfig.enabled || !catalogConfig.configured) {
      sendJson(res, 404, { error: { code: "COMMERCIAL_CATALOG_UNAVAILABLE", message: "O catálogo comercial externo não está disponível." } }, { "Cache-Control": "no-store", ...legacyHeaders });
      return;
    }
    if (!catalogTokensMatch(catalogConfig.accessToken, commercialCatalogToken(req))) {
      sendJson(res, 401, { error: { code: "COMMERCIAL_CATALOG_UNAUTHORIZED", message: "Token de acesso inválido." } }, {
        ...commercialCatalogCorsHeaders(req, catalogConfig),
        "Cache-Control": "no-store",
        ...legacyHeaders
      });
      return;
    }
    const cacheSeconds = Math.min(300, Math.max(0, Math.floor(Number(catalogConfig.cacheSeconds || 60))));
    sendJson(res, 200, buildCommercialCatalog(db), {
      ...commercialCatalogCorsHeaders(req, catalogConfig),
      "Cache-Control": cacheSeconds ? `private, max-age=${cacheSeconds}` : "no-store",
      ...legacyHeaders
    });
    return;
  }

  if (await handleAdminSessionRoutes({ req, res, pathname, method, db })) return;

  const publicAdMetricMatch = pathname.match(/^\/api\/marketing\/ads\/([^/]+)\/(impression|click)$/);
  if (publicAdMetricMatch && method === "POST") {
    const adId = decodeURIComponent(publicAdMetricMatch[1]);
    const metric = publicAdMetricMatch[2];
    let found = false;
    const currentAd = (db.ads || []).find((item) => item.id === adId);
    if (db.settings?.adsEnabled !== false && currentAd && adIsVisible(currentAd)) {
      found = true;
      if (postgresEnabled()) {
        await adMetricRepository.increment(adId, metric);
      } else {
        await withCriticalMutation(async () => {
          const currentDb = await readDb();
          const ad = (currentDb.ads || []).find((item) => item.id === adId);
          if (currentDb.settings?.adsEnabled === false || !ad || !adIsVisible(ad)) return;
          const now = new Date().toISOString();
          if (metric === "impression") {
            ad.impressions = Math.max(0, Number(ad.impressions || 0)) + 1;
            ad.lastImpressionAt = now;
          } else {
            ad.clicks = Math.max(0, Number(ad.clicks || 0)) + 1;
            ad.lastClickAt = now;
          }
          ad.updatedAt = now;
          await writeDb(currentDb);
        });
      }
    }
    res.writeHead(found ? 204 : 404, securityHeaders());
    res.end();
    return;
  }

  if (!ensureAdmin(req, res, db, pathname, method)) return;

  if (await handleAdminAccountRoutes({ req, res, pathname, method, db })) return;

  if (handlePublicContentRoute({ res, pathname, method, db })) return;

  if (await handleSeatMapRead({ req, res, pathname, method, db })) return;

  if (await handleAdminContentRoute({ req, res, pathname, method, db })) return;

  if (await handleAdminOverviewRoutes({ req, res, pathname, method, db })) return;

  if (await handleAdminSocialStudioRoute({ req, res, pathname, method, db })) return;

  if (await handleAdminReportRoute({ req, res, pathname, method, db })) return;

  if (await handleAdminConcessionSalesRead({ req, res, pathname, method, db })) return;

  const concessionArchiveMatch = pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/archive$/);
  if (concessionArchiveMatch && method === "POST") {
    const body = await readBody(req);
    const archived = await withCriticalMutation(async () => {
      const currentDb = await readDb();
      const order = (currentDb.orders || []).find((item) => item.id === decodeURIComponent(concessionArchiveMatch[1]));
      if (!order) throw refundError("ORDER_NOT_FOUND", "Pedido nao encontrado.", 404);
      order.concessionArchived = body.archived !== false;
      order.updatedAt = new Date().toISOString();
      appendOrderAudit(order, { action: order.concessionArchived ? "concessions.archive" : "concessions.unarchive", updatedBy: req.adminUser.id });
      await writeDb(currentDb);
      return order.concessionArchived;
    });
    sendJson(res, 200, { archived });
    return;
  }

  const concessionRefundMatch = pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/refund$/);
  if (concessionRefundMatch && method === "POST") {
    const body = await readBody(req);
    const orderId = decodeURIComponent(concessionRefundMatch[1]);
    sendJson(res, 200, await refundOrderConcessions(orderId, body.reason, req.adminUser));
    return;
  }

  const concessionDeleteMatch = pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)$/);
  if (concessionDeleteMatch && method === "DELETE") {
    const orderId = decodeURIComponent(concessionDeleteMatch[1]);
    const deletion = await withCriticalMutation(async () => {
      const currentDb = await readDb();
      const order = (currentDb.orders || []).find((item) => item.id === orderId);
      if (!order || !(order.concessionItems || []).length) throw refundError("CONCESSION_ORDER_NOT_FOUND", "Pedido de bomboniere não encontrado.", 404);
      const payment = orderPayment(currentDb, order.id);
      const completed = order.concessionRefund?.status === "completed"
        || order.concessionStatus === "cancelled"
        || ["cancelled", "refunded", "expired"].includes(String(order.status || ""));
      if (!completed) throw refundError("CONCESSION_DELETE_REQUIRES_CANCELLATION", "Cancele ou reembolse a bomboniere antes de removê-la desta área.", 409);
      if (order.concessionDeletedAt) {
        return { deleted: true, deletedAt: order.concessionDeletedAt };
      }
      const now = new Date().toISOString();
      order.concessionDeletedAt = now;
      order.concessionDeletedBy = req.adminUser.id;
      order.updatedAt = now;
      appendOrderAudit(order, {
        action: "concessions.delete_from_finance_view",
        updatedBy: req.adminUser.id,
        metadata: {
          paymentId: payment?.id || "",
          items: order.concessionItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }))
        }
      });
      await writeDb(currentDb);
      return { deleted: true, deletedAt: now };
    });
    sendJson(res, 200, deletion);
    return;
  }

  if (await handleAdminLogsRoutes({ req, res, pathname, method, db })) return;

  if (handleAdminPaymentsRead({ req, res, pathname, method, db })) return;

  if (await handleAdminIntegrationRoute({ req, res, pathname, method, db })) return;

  if (await handleAdminEmailRoute({ req, res, pathname, method, db })) return;

  if (handleAdminCustomerRoute({ req, res, pathname, method, db })) return;

  if (pathname === "/api/events" && method === "POST") {
    const body = await readBody(req);
    if (!CRM_EVENT_TYPES.includes(body.event)) {
      sendJson(res, 400, { error: { code: "EVENT_NOT_ALLOWED", message: "Evento nao suportado." } });
      return;
    }
    if (body.event === "private_rental.inquiry") {
      const inquiry = body.data && typeof body.data === "object" ? body.data : {};
      if (String(inquiry.website || "").trim()) {
        sendJson(res, 202, { success: true, message: "Solicitação recebida." });
        return;
      }
      inquiry.name = String(inquiry.name || "").trim().slice(0, 100);
      inquiry.phone = phoneDigits(inquiry.phone);
      inquiry.email = String(inquiry.email || "").trim().toLowerCase().slice(0, 160);
      inquiry.desiredDate = String(inquiry.desiredDate || "").trim().slice(0, 80);
      inquiry.estimatedGuests = String(inquiry.estimatedGuests || "").trim().slice(0, 80);
      inquiry.notes = String(inquiry.notes || "").trim().slice(0, 2000);
      if (inquiry.name.length < 2 || !inquiry.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email)) {
        sendJson(res, 422, { error: { code: "EVENT_INQUIRY_INVALID", message: "Informe nome, telefone e um e-mail válido para receber a confirmação." } });
        return;
      }
      const emailConfig = integrationConfigService.resolvedConfig(db, "email");
      if (!(emailConfig?.enabled && emailConfig?.configured)) {
        sendJson(res, 412, { error: { code: "EVENT_EMAIL_NOT_CONFIGURED", message: "O canal de atendimento por e-mail está temporariamente indisponível. Tente novamente em instantes." } });
        return;
      }
      const delivery = await emailService.sendPrivateEventInquiry(db, inquiry);
      if (!delivery.inquiryDelivered) {
        sendJson(res, 502, { error: { code: "EVENT_EMAIL_DELIVERY_FAILED", message: "Não foi possível entregar sua solicitação agora. Confira os dados e tente novamente." } });
        return;
      }
      body.data = inquiry;
      body.delivery = { acknowledgementSent: Boolean(delivery.acknowledgementDelivered) };
    }
    const crm = getCrmWebhookConfig(db);
    let crmQueued = false;
    if (crm.enabled && crm.url && crm.events.includes(body.event)) {
      if (!crm.secret) {
        sendJson(res, 503, { error: { code: "CRM_SIGNATURE_SECRET_MISSING", message: "A integração CRM está ativa, mas falta configurar o segredo HMAC." } });
        return;
      }
      const eventId = crypto.randomUUID();
      const payload = {
        ...body,
        eventId,
        timestamp: body.timestamp || new Date().toISOString(),
        cinemaId: "cine_cruzeiro_sala_1"
      };
      await createCrmOutboxRepository().enqueue({
        id: eventId,
        eventName: body.event,
        payload,
        maxAttempts: crm.retryLimit + 1
      });
      crmQueued = true;
      getCrmWebhookWorker().wake();
      logEvent("info", "crm_webhook.queued", { event: body.event, eventId });
    }
    sendJson(res, 202, {
      success: true,
      crmQueued,
      acknowledgementSent: body.event === "private_rental.inquiry" ? Boolean(body.delivery?.acknowledgementSent) : undefined,
      message: body.event === "private_rental.inquiry"
        ? (body.delivery?.acknowledgementSent
          ? "Solicitação enviada. Enviamos uma confirmação para o seu e-mail."
          : "Solicitação recebida. Nossa equipe entrará em contato em breve.")
        : "Evento recebido pelo backend."
    });
    return;
  }

  if (pathname === "/api/content" && method === "PUT") {
    if (!ensureAdmin(req, res, db, pathname, method, ["owner"])) return;
    const body = await readBody(req);
    const allowedKeys = new Set(["movies", "rooms", "ticketTypes", "concessions", "promotions", "ads", "settings"]);
    const nextDb = { ...db };
    if (postgresEnabled()) rememberSnapshot(nextDb);
    Object.entries(body || {}).forEach(([key, value]) => {
      if (allowedKeys.has(key)) nextDb[key] = value;
    });
    const previousMovies = db.movies.map((movie) => ({ ...movie }));
    await syncHighlightTrailerCache(nextDb, previousMovies);
    await writeDb(nextDb);
    sendJson(res, 200, getContent(nextDb));
    return;
  }

  if (await handleCinemaSettingsRoutes({ req, res, pathname, method, db })) return;

  if (pathname === "/api/email/unsubscribe" && ["GET", "POST"].includes(method)) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = String(url.searchParams.get("token") || "").trim();
    let user = null;
    if (token && postgresEnabled()) {
      user = method === "POST"
        ? await emailCampaignRepository.unsubscribeByToken(token)
        : await emailCampaignRepository.findUnsubscribeUser(token);
    } else if (token) {
      user = (db.users || []).find((item) => {
        const expected = Buffer.from(hashResetToken(item.emailUnsubscribeToken || ""));
        const provided = Buffer.from(hashResetToken(token));
        return expected.length === provided.length && crypto.timingSafeEqual(expected, provided) && item.active !== false;
      }) || null;
      if (user && method === "POST") {
        user.emailUnsubscribedAt ||= new Date().toISOString();
        user.updatedAt = new Date().toISOString();
        await writeDb(db);
      }
    }
    const confirmed = Boolean(user && method === "POST");
    const title = !user ? "Link indisponível" : confirmed ? "Descadastro confirmado" : "Confirmar descadastro";
    const message = !user
      ? "Este link de descadastro não existe ou já não está disponível."
      : confirmed
        ? "Você não receberá mais e-mails promocionais do Cine Cruzeiro. Mensagens essenciais de conta e compra ainda podem ser enviadas quando necessário."
        : "Confirme abaixo que deseja parar de receber campanhas promocionais. Seus ingressos, recibos e mensagens essenciais de conta continuarão chegando.";
    const confirmButton = user && !confirmed
      ? `<form method="post" action="/api/email/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit" style="border:0;margin-top:24px;background:#facc15;color:#020617;padding:14px 18px;border-radius:8px;font-weight:900;cursor:pointer">Confirmar descadastro</button></form>`
      : "";
    res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8" }));
    res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)} - Cine Cruzeiro</title></head><body style="margin:0;background:#060a12;color:#f8fafc;font-family:Inter,Arial,sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="max-width:560px;background:#0d1728;padding:32px;border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.34)"><p style="margin:0 0 10px;color:#facc15;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase">Cine Cruzeiro</p><h1 style="margin:0 0 14px;font-size:34px;line-height:1.05">${htmlEscape(title)}</h1><p style="margin:0;color:#cbd5e1;line-height:1.7">${htmlEscape(message)}</p>${confirmButton}<a href="${htmlEscape(appFrontendUrl())}" style="display:inline-block;margin-top:24px;color:#bfdbfe;text-decoration:none;font-weight:800">Voltar ao site</a></section></main></body></html>`);
    return;
  }

  if (await handleCustomerAuthRoutes({ req, res, pathname, method, db })) return;

  if (await handleCustomerAccountRoutes({ req, res, pathname, method, db })) return;

  if (pathname === "/api/auth/google/start" && method === "GET") {
    const config = getGoogleOAuthConfig(req, db);
    if (!config.clientId || !config.clientSecret) {
      sendJson(res, 412, { error: "Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend/.env." });
      return;
    }

    const startUrl = new URL(req.url, `http://${req.headers.host}`);
    const requestedReturnTo = String(startUrl.searchParams.get("returnTo") || "");
    const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "";
    const mobileApp = startUrl.searchParams.get("mobile") === "cinelumix";
    const requestedCinema = String(startUrl.searchParams.get("cinema") || "").trim();
    const mobileCinema = /^[a-z0-9-]{1,48}$/.test(requestedCinema) ? requestedCinema : "";
    const state = signJwt({ type: "google_oauth", nonce: crypto.randomUUID(), returnTo, mobileApp, mobileCinema });
    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", config.clientId);
    googleUrl.searchParams.set("redirect_uri", config.redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid email profile");
    googleUrl.searchParams.set("state", state);
    googleUrl.searchParams.set("prompt", "select_account");
    logEvent("info", "google_oauth.started", {
      redirectPath: (() => {
        try { return new URL(config.redirectUri).pathname; } catch { return "invalid"; }
      })(),
      hasReturnTo: Boolean(returnTo),
      mobileApp
    });
    res.writeHead(302, { Location: googleUrl.toString(), "Set-Cookie": googleOAuthCookie(state) });
    res.end();
    return;
  }

  if (pathname === "/api/auth/google/callback" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const state = verifyJwt(stateParam);
    const stateCookie = parseCookies(req).cine_google_oauth;
    const config = getGoogleOAuthConfig(req, db);
    if (!code || state?.type !== "google_oauth" || stateParam !== stateCookie) {
      logEvent("warn", "google_oauth.failed", { reason: "invalid_state", codePresent: Boolean(code), statePresent: Boolean(stateParam), cookiePresent: Boolean(stateCookie) });
      res.writeHead(302, { Location: googleAuthFailureRedirect(config, state, "google_oauth"), "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.access_token) {
      logEvent("warn", "google_oauth.failed", { reason: "token_exchange", providerError: String(tokenData.error || "unknown").slice(0, 80) });
      res.writeHead(302, { Location: googleAuthFailureRedirect(config, state, "google_token"), "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.email) {
      logEvent("warn", "google_oauth.failed", { reason: "profile_unavailable", status: profileResponse.status });
      res.writeHead(302, { Location: googleAuthFailureRedirect(config, state, "google_profile"), "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }

    const email = String(profile.email).toLowerCase();
    const emailUser = postgresEnabled()
      ? await userRepository.findByEmail(email)
      : db.users.find((item) => item.email === email) || null;
    const googleUser = postgresEnabled()
      ? await userRepository.findByGoogleSub(profile.sub)
      : db.users.find((item) => item.googleSub === profile.sub) || null;
    const googleIdentityConflict = (emailUser && googleUser && emailUser.id !== googleUser.id)
      || (emailUser?.googleSub && emailUser.googleSub !== profile.sub);
    if (googleIdentityConflict) {
      logEvent("warn", "google_oauth.failed", { reason: "identity_conflict" });
      res.writeHead(302, { Location: googleAuthFailureRedirect(config, state, "google_account_conflict"), "Set-Cookie": googleOAuthCookie("", 0) });
      res.end();
      return;
    }
    const existingUser = googleUser || emailUser;
    const existingIndex = existingUser ? db.users.findIndex((item) => item.id === existingUser.id) : -1;
    let user = normalizeUser(
      {
        name: profile.name || email,
        email,
        googleSub: profile.sub,
        picture: profile.picture || "",
        emailVerified: Boolean(profile.email_verified),
        role: existingUser?.role || "customer",
        authProvider: existingUser?.passwordHash ? (existingUser.authProvider || "email") : "google",
        active: true
      },
      existingUser || {}
    );

    if (postgresEnabled()) {
      user = existingUser
        ? await userRepository.updateFields(existingUser.id, {
          name: user.name, email: user.email, googleSub: user.googleSub, picture: user.picture,
          emailVerified: user.emailVerified, authProvider: user.authProvider, active: true
        }, { event: "repository.user.google_login", operation: "googleLogin" })
        : await userRepository.create(user);
    } else {
      if (existingIndex >= 0) db.users[existingIndex] = user;
      else db.users.push(user);
      await writeDb(db);
    }
    logEvent("info", "google_oauth.completed", { userId: user.id, accountCreated: !existingUser });

    if (state.mobileApp === true) {
      const handoffToken = issueMobileAuthHandoff(user, state);
      res.writeHead(302, {
        Location: mobileGoogleAuthRedirect(state, { token: handoffToken }),
        "Set-Cookie": googleOAuthCookie("", 0),
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer"
      });
      res.end();
      return;
    }

    const successUrl = new URL(`${config.frontendUrl}${state.returnTo || "/"}`);
    successUrl.searchParams.set("auth", "google_success");
    res.writeHead(302, {
      Location: successUrl.toString(),
      "Set-Cookie": [customerCookie(customerSessionValue(user)), googleOAuthCookie("", 0)]
    });
    res.end();
    return;
  }

  if (await handleTmdbSearchRoute({ req, res, pathname, method, db })) return;

  if (await handlePublicClubRead({ req, res, pathname, method, db })) return;

  const mySubscriptionCancelMatch = pathname.match(/^\/api\/me\/subscriptions\/([^/]+)\/cancel$/);
  if (mySubscriptionCancelMatch && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para cancelar o Clube." } });
      return;
    }
    const id = decodeURIComponent(mySubscriptionCancelMatch[1]);
    const body = await readBody(req);
    const cancellation = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const lockedUser = getCustomerUser(req, lockedDb);
      const subscription = (lockedDb.subscriptions || []).find((item) => item.id === id && item.userId === lockedUser.id);
      if (!subscription) {
        return { status: 404, payload: { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } } };
      }
      if (["ending", "ended", "cancelled"].includes(subscription.status)) {
        return { status: 200, payload: {
          subscription: { ...refreshSubscriptionCredits(lockedDb, subscription), statusLabel: subscriptionStatusLabel(subscription.status) },
          message: subscription.status === "ending" ? "A renovação já está cancelada. Seus créditos continuam válidos até o fim do ciclo." : "Esta assinatura já está encerrada."
        } };
      }
      const now = new Date().toISOString();
      const cancelImmediately = Boolean(body.cancelImmediately || body.immediate);
      const plan = (lockedDb.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      const cancellationRules = plan?.cancellationRules || {};
      if ((!cancelImmediately && cancellationRules.allowPeriodEnd === false) || (cancelImmediately && cancellationRules.allowImmediateBillingEnd === false)) {
        return { status: 409, payload: {
          error: {
            code: "SUBSCRIPTION_CANCELLATION_MODE_NOT_ALLOWED",
            message: "Este plano não permite a modalidade de cancelamento selecionada. Entre em contato com o cinema."
          }
        } };
      }
      let providerSubscription = null;
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
        providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
        subscription.providerStatus = providerSubscription?.status || "cancelled";
      }
      markSubscriptionWithoutRenewal(lockedDb, subscription, {
        mode: cancelImmediately ? "immediate_billing_end" : "period_end",
        now: new Date(now)
      });
      subscription.history ||= [];
      subscription.history.push({
        action: "cancel",
        by: lockedUser.id,
        reason: String(body.reason || "Cancelado pelo cliente").trim(),
        effective: cancelImmediately ? "immediate" : "period_end",
        provider: subscription.provider || "",
        providerStatus: providerSubscription?.status || subscription.providerStatus || "",
        at: subscription.cancelledAt
      });
      await writeDb(lockedDb);
      return { status: 200, payload: {
        subscription: { ...refreshSubscriptionCredits(lockedDb, subscription), statusLabel: subscriptionStatusLabel(subscription.status) },
        message: cancelImmediately
          ? "Cobrança encerrada. Seus créditos atuais continuam válidos até o fim do ciclo."
          : "Renovação cancelada. Não haverá nova cobrança e os créditos atuais continuam válidos até o fim do ciclo."
      } };
    });
    sendJson(res, cancellation.status, cancellation.payload);
    return;
  }

  if (pathname === "/api/subscriptions/subscribe" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para assinar o Clube." } });
      return;
    }
    const body = await readBody(req);
    const paymentMethod = String(body.paymentMethod || "").trim().toLowerCase();
    if (!["card", "credit_card"].includes(paymentMethod)) {
      sendJson(res, 422, {
        error: {
          code: "SUBSCRIPTION_PAYMENT_METHOD_REQUIRED",
          message: "Assinaturas do Clube aceitam somente cartão de crédito via Mercado Pago."
        }
      });
      return;
    }
    try {
      const outcome = await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const lockedUser = getCustomerUser(req, lockedDb);
        if (!lockedUser) {
          return { status: 401, payload: { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para assinar o Clube." } } };
        }
        const plan = (lockedDb.subscriptionPlans || []).find((item) => item.id === body.planId && item.active !== false);
        if (!plan) {
          return { status: 404, payload: { error: { code: "PLAN_NOT_FOUND", message: "Plano do Clube nao encontrado." } } };
        }
        const existingSubscription = blockingSubscriptionForUser(lockedDb, lockedUser.id);
        if (existingSubscription) {
          return { status: 409, payload: {
            error: {
              code: "SUBSCRIPTION_ALREADY_EXISTS",
              message: "Voce ja possui uma assinatura do Clube ativa ou pendente. Cancele a atual antes de assinar outro plano."
            },
            subscription: {
              ...existingSubscription,
              plan: (lockedDb.subscriptionPlans || []).find((item) => item.id === existingSubscription.planId) || null,
              statusLabel: subscriptionStatusLabel(existingSubscription.status)
            }
          } };
        }

        const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago");
        const activeProvider = activeOnlinePaymentProvider(lockedDb);
        if (activeProvider.provider !== "mercado_pago" || (!(mercadoPagoConfig?.enabled && mercadoPagoConfig?.configured) && process.env.PAYMENTS_MODE !== "test")) {
          return { status: 412, payload: { error: { code: "MERCADO_PAGO_NOT_CONFIGURED", message: "Ative e configure o Mercado Pago nas Integracoes para vender assinaturas recorrentes." } } };
        }

        const subscription = createSubscription(lockedDb, lockedUser.id, plan.id, lockedUser, "pending_payment", "mercado_pago");
        const normalizedPaymentMethod = paymentMethod === "card" ? "credit_card" : paymentMethod;
        subscription.provider = "mercado_pago";
        subscription.providerPlanId = "";
        subscription.externalBillingPending = true;
        subscription.paymentStatus = "pending";
        subscription.preferredPaymentMethod = normalizedPaymentMethod;

        const providerSubscription = await subscriptionPaymentProvider.createSubscription(subscription, plan, lockedUser, mercadoPagoConfig || {}, {
          // Checkout hospedado: assinatura pendente sem plano associado. O
          // Mercado Pago recebe a recorrencia em auto_recurring e coleta o
          // meio de pagamento no proprio checkout.
          associatedPlan: false,
          frontendUrl: frontendUrlForRequest(req, lockedDb),
          notificationUrl: `${frontendUrlForRequest(req, lockedDb)}/api/webhooks/mercado-pago?source_news=webhooks`
        });
        subscription.providerSubscriptionId = providerSubscription.id;
        subscription.providerStatus = providerSubscription.status;
        subscription.checkoutUrl = providerSubscription.checkoutUrl || providerSubscription.initPoint || "";
        subscription.nextBillingAt = providerSubscription.nextPaymentDate || "";
        subscription.history ||= [];
        subscription.history.push({
          action: "mercado_pago_checkout_created",
          providerSubscriptionId: subscription.providerSubscriptionId,
          paymentMethod: normalizedPaymentMethod,
          at: new Date().toISOString()
        });

        await writeDb(lockedDb);
        return { status: 202, payload: {
          subscription: {
            ...subscription,
            plan,
            statusLabel: subscriptionStatusLabel(subscription.status)
          },
          checkoutUrl: subscription.checkoutUrl,
          initPoint: subscription.checkoutUrl,
          provider: "mercado_pago",
          paymentMethod: normalizedPaymentMethod,
          externalBillingPending: true,
          message: "Finalize a assinatura recorrente no Mercado Pago para liberar os creditos do Clube."
        } };
      });
      sendJson(res, outcome.status, outcome.payload);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: { code: error.code || "SUBSCRIPTION_PROVIDER_ERROR", message: error.message || "Nao foi possivel iniciar a assinatura." } });
    }
    return;
  }

  if (pathname === "/api/checkout/club-credit" && method === "POST") {
    const user = getCustomerUser(req, db);
    if (!user) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para usar o benefício do Clube." } });
      return;
    }
    const body = await readBody(req);
    try {
      let completedCheckout = null;
      await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const lockedUser = getCustomerUser(req, lockedDb);
      const idempotencyKey = String(req.headers["x-idempotency-key"] || body.idempotencyKey || `club-${lockedUser.id}-${body.movieId}-${body.sessionId}`).trim();
      const existing = (lockedDb.orders || []).find((order) => order.idempotencyKey === idempotencyKey && order.origin === "club");
      if (existing) {
        if (existing.customerUserId !== lockedUser.id) {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência de compra já está em uso." } });
          return;
        }
        sendJson(res, 200, {
          order: existing,
          payment: orderPayment(lockedDb, existing.id),
          tickets: orderTickets(lockedDb, existing.id),
          subscription: (lockedDb.subscriptions || []).find((item) => item.id === existing.clubSubscriptionId) || null
        }, { "Set-Cookie": checkoutAccessCookie(req, existing.id) });
        return;
      }
      const subscription = activeSubscriptionForUser(lockedDb, lockedUser.id);
      if (!subscription || !subscriptionCanUseCredit(subscription)) {
        sendJson(res, 409, { error: { code: "NO_ACTIVE_SUBSCRIPTION", message: "Voce nao possui assinatura ativa com creditos disponiveis." } });
        return;
      }
      const pricedOrder = repriceOrderFromCatalog(lockedDb, normalizePaymentOrder({
        ...body,
        idempotencyKey,
        fullTicketsCount: Array.isArray(body.ticketItems) && body.ticketItems.length ? Number(body.fullTicketsCount || 0) : Number(body.fullTicketsCount ?? 1),
        halfTicketsCount: Number(body.halfTicketsCount || 0),
        concessionItems: Array.isArray(body.concessionItems) ? body.concessionItems : [],
        customerUserId: lockedUser.id,
        customerName: lockedUser.name,
        customerEmail: lockedUser.email,
        customerPhone: lockedUser.phone || "",
        customerCpf: lockedUser.cpf || "",
        paymentMethod: "CLUB_CREDIT",
        useClubCredits: true,
        useClubBenefits: body.useClubBenefits !== false
      }));
      await claimSeatHoldsForOrder(lockedDb, pricedOrder);
      pricedOrder.reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      if (pricedOrder.useClubBenefits) applyClubPlanBenefits(lockedDb, pricedOrder, lockedUser);
      reserveClubCreditsForOrder(lockedDb, pricedOrder, lockedUser, idempotencyKey);
      materializeOrderAccounting(lockedDb, pricedOrder);
      if (pricedOrder.totalPrice > 0) {
        clubDomainService.releaseOrderCredits(lockedDb, pricedOrder.id);
        sendJson(res, 409, {
          error: {
            code: "CLUB_REMAINING_PAYMENT_REQUIRED",
            message: `Crédito aplicado. Pague o complemento de R$ ${Number(pricedOrder.totalPrice).toFixed(2).replace(".", ",")} por Pix ou cartão.`
          },
          pricing: {
            serviceSubtotal: pricedOrder.serviceSubtotal,
            goodsSubtotal: pricedOrder.goodsSubtotal,
            clubCreditsApplied: pricedOrder.clubCreditsApplied,
            clubDiscount: pricedOrder.clubDiscount,
            additionalPayment: pricedOrder.totalPrice,
            orderTotal: pricedOrder.totalPrice
          }
        });
        return;
      }
      pricedOrder.idempotencyKey = idempotencyKey;

      const savedOrder = {
        ...pricedOrder,
        status: "paid",
        origin: "club",
        paymentMethod: "CLUB_CREDIT",
        paymentProvider: "",
        paymentId: "",
        paymentStatus: "not_required",
        paidAt: new Date().toISOString()
      };
      const tickets = finalizePaidOrder(lockedDb, savedOrder, null, "club_credit");
      consumePendingClubCredit(lockedDb, savedOrder, tickets, lockedUser.id);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      completedCheckout = {
        order: savedOrder,
        payment: null,
        tickets,
        subscription,
        creditsRemaining: clubDomainService.creditCounts(lockedDb, subscription.id).available
      };
      });
      if (completedCheckout) {
        try {
          await releaseOrderSeatHolds(completedCheckout.order, "unavailable");
        } catch (error) {
          logEvent("warn", "club_checkout.seat_hold_release_failed", {
            orderId: completedCheckout.order.id,
            message: error.message
          });
        }
        sendJson(res, 201, completedCheckout, {
          "Set-Cookie": checkoutAccessCookie(req, completedCheckout.order.id)
        });
        if (completedCheckout.tickets.length) queueTicketEmailDelivery(completedCheckout.order.id);
      }
    } catch (error) {
      sendJson(res, error.statusCode || 400, { error: { code: error.code || "CLUB_CREDIT_ERROR", message: error.message } });
    }
    return;
  }

  if (await handleAdminClubPlanRead({ req, res, pathname, method, db })) return;

  if (pathname === "/api/admin/goods-fiscal-settings" && method === "PUT") {
    if (roleAlias(req.adminUser?.role) !== "owner") {
      sendJson(res, 403, { error: { code: "OWNER_REQUIRED", message: "Somente o proprietário pode alterar a regra fiscal da bomboniere." } });
      return;
    }
    const body = await readBody(req);
    db.settings.nfceTrigger = body.nfceTrigger === "payment_approved" ? "payment_approved" : "goods_delivered";
    if (postgresEnabled()) {
      await settingsRepository.patchAppSettings({ nfceTrigger: db.settings.nfceTrigger }, {
        audit: repositoryAudit(req, "settings", "nfceTrigger", null, { nfceTrigger: db.settings.nfceTrigger })
      });
    } else {
      await writeDb(db);
    }
    sendJson(res, 200, { nfceTrigger: db.settings.nfceTrigger });
    return;
  }

  if (pathname === "/api/admin/subscription-plans" && method === "POST") {
    const body = await readBody(req);
    if (body.accounting !== undefined && roleAlias(req.adminUser?.role) !== "owner") {
      sendJson(res, 403, { error: { code: "OWNER_REQUIRED", message: "Somente o proprietário pode alterar regras contábeis do Clube." } });
      return;
    }
    const plan = normalizeSubscriptionPlan(body);
    persistPlanAccountingRule(db, plan, null, req.adminUser);
    db.subscriptionPlans = (db.subscriptionPlans || []).filter((item) => item.id !== plan.id);
    if (plan.isFeatured) {
      db.subscriptionPlans = db.subscriptionPlans.map((item) => ({ ...item, isFeatured: false }));
    }
    db.subscriptionPlans.push(plan);
    await writeDb(db);
    sendJson(res, 201, plan);
    return;
  }

  const subscriptionPlanMatch = pathname.match(/^\/api\/admin\/subscription-plans\/([^/]+)$/);
  if (subscriptionPlanMatch && method === "PUT") {
    const id = decodeURIComponent(subscriptionPlanMatch[1]);
    const index = (db.subscriptionPlans || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
      return;
    }
    const body = await readBody(req);
    if (body.accounting !== undefined && roleAlias(req.adminUser?.role) !== "owner") {
      sendJson(res, 403, { error: { code: "OWNER_REQUIRED", message: "Somente o proprietário pode alterar regras contábeis do Clube." } });
      return;
    }
    const previousPlan = db.subscriptionPlans[index];
    const plan = normalizeSubscriptionPlan({ ...body, id }, previousPlan);
    persistPlanAccountingRule(db, plan, previousPlan, req.adminUser);
    if (plan.isFeatured) {
      db.subscriptionPlans = db.subscriptionPlans.map((item) => item.id === id ? item : ({ ...item, isFeatured: false }));
    }
    db.subscriptionPlans[index] = plan;
    await writeDb(db);
    sendJson(res, 200, plan);
    return;
  }

  if (subscriptionPlanMatch && method === "DELETE") {
    const id = decodeURIComponent(subscriptionPlanMatch[1]);
    const index = (db.subscriptionPlans || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
      return;
    }
    const body = await readBody(req);
    const hasSubscriptions = (db.subscriptions || []).some((item) => item.planId === id);
    let plan;
    if (hasSubscriptions) {
      plan = { ...db.subscriptionPlans[index], active: false, deletedAt: new Date().toISOString(), deletedBy: req.adminUser?.id || "", deleteReason: String(body.reason || "Desativado pelo painel").trim() };
      db.subscriptionPlans[index] = plan;
    } else {
      [plan] = db.subscriptionPlans.splice(index, 1);
      plan = { ...plan, deletedAt: new Date().toISOString(), deletedBy: req.adminUser?.id || "", deleteReason: String(body.reason || "Excluido pelo painel").trim() };
    }
    db.auditLogs ||= [];
    db.auditLogs.push({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      userId: req.adminUser?.id || "",
      userEmail: req.adminUser?.email || "",
      action: hasSubscriptions ? "subscription_plan.deactivated" : "subscription_plan.deleted",
      entityType: "subscription_plan",
      entityId: id,
      before: null,
      after: plan,
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    sendJson(res, 200, { plan, deactivated: hasSubscriptions, deleted: !hasSubscriptions });
    return;
  }

  if (await handleAdminClubSubscriptionRead({ req, res, pathname, method, db })) return;

  if (pathname === "/api/admin/subscriptions/assign" && method === "POST") {
    const body = await readBody(req);
    const outcome = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const adminUser = getAdminUser(req, lockedDb);
      const user = (lockedDb.users || []).find((item) => item.id === body.userId || item.email === String(body.email || "").toLowerCase());
      if (!user) {
        return { status: 404, payload: { error: { code: "USER_NOT_FOUND", message: "Usuario cadastrado nao encontrado." } } };
      }
      const existingSubscription = blockingSubscriptionForUser(lockedDb, user.id);
      if (existingSubscription && existingSubscription.planId !== body.planId) {
        return { status: 409, payload: {
          error: {
            code: "SUBSCRIPTION_ALREADY_EXISTS",
            message: "Este cliente ja possui uma assinatura ativa ou pendente."
          },
          subscription: existingSubscription
        } };
      }
      const subscription = createManualSubscription(lockedDb, user.id, body.planId, adminUser, body.status || "active");
      await writeDb(lockedDb);
      return { status: 201, payload: { subscription } };
    });
    sendJson(res, outcome.status, outcome.payload);
    return;
  }

  const adminSubscriptionMatch = pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)$/);
  if (adminSubscriptionMatch && method === "GET") {
    const id = decodeURIComponent(adminSubscriptionMatch[1]);
    const detail = adminSubscriptionPresenter.detail(db, id);
    if (!detail) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura não encontrada." } });
      return;
    }
    sendJson(res, 200, detail);
    return;
  }
  if (adminSubscriptionMatch && method === "PATCH") {
    const id = decodeURIComponent(adminSubscriptionMatch[1]);
    const body = await readBody(req);
    const subscription = (db.subscriptions || []).find((item) => item.id === id);
    if (!subscription) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    const allowedStatus = new Set(["pending_payment", "active", "paused", "ending", "cancelled", "ended", "payment_failed"]);
    if (body.status === "active" && (
      subscription.reactivationBlocked
      || ["cancelled", "canceled"].includes(String(subscription.providerStatus || "").toLowerCase())
      || ["ending", "cancelled", "ended"].includes(String(subscription.status || "").toLowerCase())
    )) {
      sendJson(res, 409, {
        error: {
          code: "SUBSCRIPTION_REAUTHORIZATION_REQUIRED",
          message: "Esta autorização de cobrança foi encerrada. Crie uma nova assinatura para obter uma nova autorização do cliente; a anterior não pode ser reativada."
        }
      });
      return;
    }
    if (allowedStatus.has(body.status)) subscription.status = body.status;
    if (body.status === "active" && !currentSubscriptionCredit(db, subscription)) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      if (plan) createSubscriptionCreditCycle(db, subscription, plan);
      subscription.startedAt ||= new Date().toISOString();
    }
    if (body.status === "cancelled") {
      const now = new Date().toISOString();
      let providerSubscription = null;
      if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
        const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
        providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
        subscription.providerStatus = providerSubscription?.status || "cancelled";
      }
      markSubscriptionWithoutRenewal(db, subscription, { mode: "admin_billing_end", now: new Date(now) });
    }
    subscription.updatedAt = new Date().toISOString();
    subscription.history ||= [];
    subscription.history.push({ action: "status", status: subscription.status, statusLabel: subscriptionStatusLabel(subscription.status), by: req.adminUser?.id || "", reason: body.reason || "", at: new Date().toISOString() });
    await writeDb(db);
    sendJson(res, 200, { ...subscription, statusLabel: subscriptionStatusLabel(subscription.status), credit: currentSubscriptionCredit(db, subscription) });
    return;
  }

  if (adminSubscriptionMatch && method === "DELETE") {
    const id = decodeURIComponent(adminSubscriptionMatch[1]);
    const index = (db.subscriptions || []).findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    const subscription = db.subscriptions[index];
    const terminalStatus = ["cancelled", "ended", "cancelled_by_admin"].includes(String(subscription.status || "").toLowerCase());
    if (!terminalStatus) {
      sendJson(res, 409, { error: { code: "SUBSCRIPTION_NOT_CANCELLED", message: "Cancele ou encerre a assinatura antes de excluir." } });
      return;
    }
    const before = {
      subscription,
      credits: (db.subscriptionCredits || []).filter((credit) => credit.subscriptionId === id),
      usage: (db.subscriptionUsage || []).filter((usage) => usage.subscriptionId === id)
    };
    if (subscription.provider === "mercado_pago" && subscription.providerSubscriptionId) {
      const mercadoPagoConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
      const providerSubscription = await cancelMercadoPagoSubscriptionSafely(subscription, mercadoPagoConfig || {});
      subscription.providerStatus = providerSubscription?.status || "cancelled";
    }
    subscription.archivedAt = new Date().toISOString();
    subscription.archivedBy = req.adminUser?.id || "";
    subscription.updatedAt = subscription.archivedAt;
    subscription.history ||= [];
    subscription.history.push({ action: "archive", by: subscription.archivedBy, at: subscription.archivedAt });
    db.auditLogs ||= [];
    db.auditLogs.push({
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      userId: req.adminUser?.id || "",
      userEmail: req.adminUser?.email || "",
      action: "subscription.archived",
      entityType: "subscription",
      entityId: id,
      before: sanitizeAuditValue(before),
      after: sanitizeAuditValue(subscription),
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    sendJson(res, 200, { archived: true, subscriptionId: id });
    return;
  }

  const adminCreditAdjustMatch = pathname.match(/^\/api\/admin\/subscriptions\/([^/]+)\/credits\/adjust$/);
  if (adminCreditAdjustMatch && method === "POST") {
    const id = decodeURIComponent(adminCreditAdjustMatch[1]);
    const body = await readBody(req);
    const reason = String(body.reason || "").trim();
    if (!reason) {
      sendJson(res, 400, { error: { code: "REASON_REQUIRED", message: "Informe o motivo do ajuste de crédito." } });
      return;
    }
    const subscription = (db.subscriptions || []).find((item) => item.id === id);
    if (!subscription) {
      sendJson(res, 404, { error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Assinatura nao encontrada." } });
      return;
    }
    let credit = currentSubscriptionCredit(db, subscription);
    if (!credit) {
      const plan = (db.subscriptionPlans || []).find((item) => item.id === subscription.planId);
      if (!plan) {
        sendJson(res, 404, { error: { code: "PLAN_NOT_FOUND", message: "Plano nao encontrado." } });
        return;
      }
      credit = createSubscriptionCreditCycle(db, subscription, plan);
    }
    const delta = Math.trunc(Number(body.delta || 0));
    if (!delta) {
      sendJson(res, 400, { error: { code: "INVALID_DELTA", message: "Informe um ajuste diferente de zero." } });
      return;
    }
    const nextRemaining = Number(credit.remaining || 0) + delta;
    if (nextRemaining < 0) {
      sendJson(res, 409, { error: { code: "NEGATIVE_CREDITS", message: "O ajuste deixaria créditos negativos." } });
      return;
    }
    credit.remaining = nextRemaining;
    credit.total = Number(credit.used || 0) + nextRemaining;
    credit.updatedAt = new Date().toISOString();
    syncSubscriptionCreditMirror(subscription, credit);
    subscription.history ||= [];
    subscription.history.push({ action: "credit_adjust", delta, reason, by: req.adminUser?.id || "", at: new Date().toISOString() });
    await writeDb(db);
    sendJson(res, 200, { subscription, credit });
    return;
  }

  if (await handleTmdbMovieRoute({ res, pathname, method, db })) return;

  if (pathname === "/api/uploads/images" && method === "POST") {
    const body = await readBody(req);
    const uploaded = await storageService.uploadImage({
      data: body.data || body.base64,
      filename: body.filename,
      contentType: body.contentType,
      folder: body.folder || "admin"
    });
    sendJson(res, 201, { ...uploaded, url: uploaded.url, publicUrl: publicAssetUrl(uploaded.url) });
    return;
  }

  if (await handleMovieCatalogRoutes({ req, res, pathname, method, db })) return;

  if (await handleVenueConfigurationRoutes({ req, res, pathname, method, db })) return;

  if (await handleCommercialCatalogRoutes({ req, res, pathname, method, db })) return;

  if (await handleAdminUserWriteRoutes({ req, res, pathname, method, db })) return;

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) {
    const id = decodeURIComponent(userMatch[1]);
    const index = db.users.findIndex((item) => item.id === id);
    const repositoryUser = postgresEnabled() ? await userRepository.findById(id) : null;
    if (index === -1 && !repositoryUser) {
      sendJson(res, 404, { error: "Usuario nao encontrado" });
      return;
    }

    if (method === "DELETE") {
      if (req.adminUser?.id === id) {
        sendJson(res, 409, { error: "Sua propria conta nao pode ser excluida enquanto estiver em uso." });
        return;
      }
      const existingUser = repositoryUser || db.users[index];
      const activeOwnerCount = postgresEnabled()
        ? await userRepository.countActiveOwners()
        : db.users.filter((candidate) => roleAlias(candidate.role) === "owner" && candidate.active !== false).length;
      if (roleAlias(existingUser.role) === "owner" && activeOwnerCount <= 1) {
        sendJson(res, 409, { error: { code: "LAST_OWNER_REQUIRED", message: "A última conta de dono ativa não pode ser excluída." } });
        return;
      }
      const linkedSubscriptions = (db.subscriptions || []).filter((subscription) => subscription.userId === id);
      const billableSubscription = linkedSubscriptions.find((subscription) =>
        ["pending_payment", "active", "paused"].includes(subscription.status)
        && (subscription.providerSubscriptionId || subscription.provider === "mercado_pago")
      );
      if (billableSubscription) {
        sendJson(res, 409, { error: "Cancele a assinatura recorrente deste usuario antes de excluir a conta." });
        return;
      }
      const subscriptionIds = new Set(linkedSubscriptions.map((subscription) => subscription.id));
      db.subscriptions = (db.subscriptions || []).filter((subscription) => subscription.userId !== id);
      db.subscriptionCredits = (db.subscriptionCredits || []).filter((credit) => !subscriptionIds.has(credit.subscriptionId));
      db.subscriptionUsage = (db.subscriptionUsage || []).filter((usage) => usage.userId !== id && !subscriptionIds.has(usage.subscriptionId));
      db.orders = (db.orders || []).map((order) => order.customerUserId === id ? { ...order, customerUserId: "" } : order);
      const [removed] = index >= 0 ? db.users.splice(index, 1) : [existingUser];
      const saved = postgresEnabled()
        ? await userRepository.remove(id, { audit: repositoryAudit(req, "user", id, sanitizeUser(existingUser), null) })
        : (await writeDb(db), removed);
      sendJson(res, 200, sanitizeUser(saved));
      return;
    }
  }

  if (pathname === "/api/coupons/preview" && method === "POST") {
    const customerUser = getCustomerUser(req, db);
    if (!customerUser) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para aplicar um cupom." } });
      return;
    }
    const body = await readBody(req);
    const input = body.order || body;
    const normalizedOrder = normalizePaymentOrder(input);
    normalizedOrder.customerUserId = customerUser.id;
    normalizedOrder.customerEmail = customerUser.email || "";
    normalizedOrder.customerCpf = customerUser.cpf || "";
    const pricedOrder = repriceOrderFromCatalog(db, normalizedOrder, { assignSeats: false });
    const subtotal = Number((Number(pricedOrder.totalPrice || 0) + Number(pricedOrder.couponDiscount || 0)).toFixed(2));
    sendJson(res, 200, {
      valid: true,
      coupon: {
        id: pricedOrder.couponId,
        code: pricedOrder.couponCode,
        title: pricedOrder.couponTitle,
        discountValue: pricedOrder.couponDiscount,
        allowsClubStacking: pricedOrder.couponAllowsClubStacking
      },
      subtotal,
      total: pricedOrder.totalPrice
    }, { "Cache-Control": "no-store" });
    return;
  }

  if (pathname === "/api/checkout/club-benefits/preview" && method === "POST") {
    const customerUser = getCustomerUser(req, db);
    if (!customerUser) {
      sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para consultar os benefícios do Clube." } });
      return;
    }
    const body = await readBody(req);
    const input = body.order || body;
    const normalizedOrder = normalizePaymentOrder({
      ...input,
      customerUserId: customerUser.id,
      customerName: customerUser.name || "Cliente Cine Cruzeiro",
      customerEmail: customerUser.email || "",
      customerPhone: customerUser.phone || "",
      customerCpf: customerUser.cpf || "",
      useClubBenefits: input.useClubBenefits !== false
    });
    const pricedOrder = repriceOrderFromCatalog(db, normalizedOrder, { assignSeats: false });
    const subtotal = Number(pricedOrder.totalPrice || 0);
    const membership = activeClubPlanForBenefits(db, customerUser.id);
    if (!membership) {
      throw Object.assign(new Error("Nenhuma assinatura ativa foi encontrada para aplicar os benefícios."), {
        statusCode: 409,
        code: "NO_ACTIVE_SUBSCRIPTION"
      });
    }
    const { plan } = membership;
    if (normalizedOrder.useClubCredits) assertClubPlanEligibility(plan, pricedOrder);
    if (normalizedOrder.useClubBenefits) applyClubPlanBenefits(db, pricedOrder, customerUser);
    const creditSummary = normalizedOrder.useClubCredits ? summarizeClubCreditItems(pricedOrder, plan) : null;
    if (creditSummary) {
      pricedOrder.totalPrice = Math.max(0, Number((Number(pricedOrder.totalPrice || 0) - creditSummary.totalAmount).toFixed(2)));
    }
    sendJson(res, 200, {
      valid: true,
      plan: { id: plan.id, name: plan.name || "Clube Cine Cruzeiro" },
      coupon: pricedOrder.couponId ? {
        discountValue: Number(pricedOrder.couponDiscount || 0),
        originalDiscountValue: Number(pricedOrder.couponOriginalDiscount || pricedOrder.couponDiscount || 0),
        appliedAfterClubCredits: pricedOrder.couponAppliedAfterClubCredits === true
      } : null,
      benefits: pricedOrder.clubBenefits || null,
      creditSummary,
      subtotal,
      total: pricedOrder.totalPrice
    }, { "Cache-Control": "no-store" });
    return;
  }

  if (pathname === "/api/payments/pix" && method === "POST") {
    const body = await readBody(req);
    const created = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      expireStaleReservations(lockedDb);
      const customerUser = getCustomerUser(req, lockedDb);
      if (!customerUser) {
        sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para gerar o pagamento por Pix." } });
        return;
      }
      if (String(customerUser.name || "").trim().split(/\s+/).length < 2) {
        sendJson(res, 422, { error: { code: "CUSTOMER_LAST_NAME_REQUIRED", message: "Complete nome e sobrenome em Minha Conta antes de pagar." } });
        return;
      }
      const rawOrder = body.order || body;
      const normalizedOrder = normalizePaymentOrder(rawOrder);
      normalizedOrder.idempotencyKey = checkoutIdentifier(body.idempotencyKey || req.headers["x-idempotency-key"] || normalizedOrder.idempotencyKey || normalizedOrder.id);
      normalizedOrder.customerUserId = customerUser.id;
      normalizedOrder.customerEmail = customerUser.email || "";
      normalizedOrder.customerCpf = customerUser.cpf || "";
      normalizedOrder.customerName = customerUser.name || "";
      normalizedOrder.customerRegisteredAt = customerUser.createdAt || "";
      const existing = findExistingCheckout(lockedDb, normalizedOrder, "pix");
      if (existing) {
        if (!checkoutAccessAllowed(req, lockedDb, existing.order)) {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência de compra já está em uso." } });
          return;
        }
        sendJson(res, 200, checkoutResponse(lockedDb, existing.order, existing.payment, existing.tickets), {
          "Set-Cookie": checkoutAccessCookie(req, existing.order.id)
        });
        return;
      }
      const order = repriceOrderFromCatalog(lockedDb, normalizedOrder);
      const pixReservationTtlMs = paymentService.mercadoPagoPixExpirationMs();
      order.reservationExpiresAt = new Date(Date.now() + pixReservationTtlMs).toISOString();
      applyClubPlanBenefits(lockedDb, order, customerUser);
      if (normalizedOrder.useClubCredits) reserveClubCreditsForOrder(lockedDb, order, customerUser, normalizedOrder.idempotencyKey);
      assertClientPricingMatches(rawOrder, order);
      materializeOrderAccounting(lockedDb, order);
      await claimSeatHoldsForOrder(lockedDb, order);
      if (order.totalPrice <= 0) {
        if (!order.couponId) {
          sendJson(res, 409, { error: { code: "PAYMENT_AMOUNT_INVALID", message: "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de gerar o Pix." } });
          return;
        }
        const completed = await finalizeOrderWithoutCharge(lockedDb, order, customerUser);
        await writeDb(lockedDb);
        return { response: checkoutResponse(lockedDb, completed.order, null, completed.tickets), order: completed.order, tickets: completed.tickets };
      }
      const active = activeOnlinePaymentProvider(lockedDb);
      if (!(active.config?.enabled && active.config?.configured) && process.env.PAYMENTS_MODE !== "test") {
        sendJson(res, 412, { error: { code: "PAYMENT_PROVIDER_NOT_CONFIGURED", message: `${active.name} está indisponível. Configure e habilite a integração no painel administrativo.` } });
        return;
      }
      const providerPayment = await createActiveOnlinePayment(order, active, {
        method: "pix",
        deviceId: mercadoPagoDeviceId(req),
        idempotencyKey: body.idempotencyKey || req.headers["x-idempotency-key"],
        notificationUrl: `${frontendUrlForRequest(req, lockedDb).replace(/\/$/, "")}/api/webhooks/pag-bank`
      });
      const payment = createPaymentRecord(order, providerPayment, "pix");
      const savedOrder = {
        ...order,
        paymentMethod: "PIX",
        paymentProvider: payment.provider,
        paymentId: payment.providerPaymentId,
        paymentStatus: payment.status,
        status: payment.status === "approved" ? "paid" : "pending_payment",
        reservationExpiresAt: payment.status === "approved" ? "" : (payment.expiresAt || order.reservationExpiresAt)
      };
      reserveConcessionStock(lockedDb, savedOrder);
      const tickets = payment.status === "approved" ? finalizePaidOrder(lockedDb, savedOrder, payment, "online") : [];
      if (tickets.length) consumePendingClubCredit(lockedDb, savedOrder, tickets, customerUser?.id);
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      logEvent("info", "payment.created", {
        orderId: savedOrder.id,
        paymentId: payment.id,
        method: payment.method,
        provider: payment.provider,
        status: payment.status,
        couponCode: savedOrder.couponCode || "",
        couponDiscount: savedOrder.couponDiscount || 0
      });
      return { response: checkoutResponse(lockedDb, savedOrder, payment, tickets), order: savedOrder, tickets };
    });
    if (created) {
      try {
        await releaseOrderSeatHolds(created.order, created.order.status === "pending_payment" ? "held" : "unavailable");
        seatRealtimeService?.broadcastSessionRefresh(created.order.sessionId);
      } catch (error) {
        logEvent("warn", "seat_realtime.release_hold_error", { orderId: created.order.id, message: error.message });
      }
      if (created.tickets.length) queueTicketEmailDelivery(created.order.id);
      sendJson(res, 201, created.response, { "Set-Cookie": checkoutAccessCookie(req, created.order.id) });
    }
    return;
  }

  if (pathname === "/api/payments/card" && method === "POST") {
    const body = await readBody(req);
    if (body.cardNumber || body.cvv || body.securityCode || body.cardExpiration || body.cardholderName) {
      sendJson(res, 400, { error: { code: "CARD_DATA_NOT_ALLOWED", message: "O Cine Cruzeiro não recebe dados de cartão. Envie apenas o token ou cartão criptografado gerado pelo provedor ativo." } });
      return;
    }
    const created = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      expireStaleReservations(lockedDb);
      const customerUser = getCustomerUser(req, lockedDb);
      if (!customerUser) {
        sendJson(res, 401, { error: { code: "AUTH_REQUIRED", message: "Entre na sua conta para pagar com cartão." } });
        return;
      }
      if (String(customerUser.name || "").trim().split(/\s+/).length < 2) {
        sendJson(res, 422, { error: { code: "CUSTOMER_LAST_NAME_REQUIRED", message: "Complete nome e sobrenome em Minha Conta antes de pagar." } });
        return;
      }
      const rawOrder = body.order || body;
      const normalizedOrder = normalizePaymentOrder(rawOrder);
      normalizedOrder.idempotencyKey = checkoutIdentifier(body.idempotencyKey || req.headers["x-idempotency-key"] || normalizedOrder.idempotencyKey || normalizedOrder.id);
      normalizedOrder.customerUserId = customerUser.id;
      normalizedOrder.customerEmail = customerUser.email || "";
      normalizedOrder.customerCpf = customerUser.cpf || "";
      normalizedOrder.customerName = customerUser.name || "";
      normalizedOrder.customerRegisteredAt = customerUser.createdAt || "";
      const existing = findExistingCheckout(lockedDb, normalizedOrder, "credit_card");
      if (existing) {
        if (!checkoutAccessAllowed(req, lockedDb, existing.order)) {
          sendJson(res, 409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "Esta referência de compra já está em uso." } });
          return;
        }
        sendJson(res, 200, checkoutResponse(lockedDb, existing.order, existing.payment, existing.tickets), {
          "Set-Cookie": checkoutAccessCookie(req, existing.order.id)
        });
        return;
      }
      const order = repriceOrderFromCatalog(lockedDb, normalizedOrder);
      order.reservationExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      applyClubPlanBenefits(lockedDb, order, customerUser);
      if (normalizedOrder.useClubCredits) reserveClubCreditsForOrder(lockedDb, order, customerUser, normalizedOrder.idempotencyKey);
      assertClientPricingMatches(rawOrder, order);
      materializeOrderAccounting(lockedDb, order);
      await claimSeatHoldsForOrder(lockedDb, order);
      if (order.totalPrice <= 0) {
        if (!order.couponId) {
          sendJson(res, 409, { error: { code: "PAYMENT_AMOUNT_INVALID", message: "O valor desta compra ficou zerado. Revise os benefícios selecionados antes de pagar." } });
          return;
        }
        const completed = await finalizeOrderWithoutCharge(lockedDb, order, customerUser);
        await writeDb(lockedDb);
        return { response: checkoutResponse(lockedDb, completed.order, null, completed.tickets), order: completed.order, tickets: completed.tickets };
      }
      const active = activeOnlinePaymentProvider(lockedDb);
      if (!(active.config?.enabled && active.config?.configured) && process.env.PAYMENTS_MODE !== "test") {
        sendJson(res, 412, { error: { code: "PAYMENT_PROVIDER_NOT_CONFIGURED", message: `${active.name} está indisponível. Configure e habilite a integração no painel administrativo.` } });
        return;
      }
      const providerPayment = await createActiveOnlinePayment(order, active, {
        method: "credit_card",
        deviceId: mercadoPagoDeviceId(req),
        card: {
          token: body.cardToken || body.token || body.card?.token || body.payment?.token,
          encrypted: body.encryptedCard || body.card?.encrypted,
          holderName: body.cardHolderName || body.card?.holderName,
          holderTaxId: cpfDigits(body.cardHolderTaxId || body.card?.holderTaxId),
          paymentMethodId: body.paymentMethodId || body.payment_method_id || body.card?.paymentMethodId || body.card?.payment_method_id,
          paymentTypeId: body.paymentTypeId || body.payment_type_id || body.card?.paymentTypeId || body.card?.payment_type_id || "credit_card",
          installments: body.installments || body.card?.installments || 1
        },
        idempotencyKey: body.idempotencyKey || req.headers["x-idempotency-key"],
        statementDescriptor: "CINE CRUZEIRO",
        notificationUrl: `${frontendUrlForRequest(req, lockedDb).replace(/\/$/, "")}/api/webhooks/pag-bank`
      });
      const payment = createPaymentRecord(order, providerPayment, "credit_card");
      const savedOrder = {
        ...order,
        paymentMethod: "CREDIT_CARD",
        paymentProvider: payment.provider,
        paymentId: payment.providerPaymentId,
        paymentStatus: payment.status,
        status: payment.status === "approved" ? "paid" : "pending_payment",
        reservationExpiresAt: payment.status === "approved" ? "" : (payment.expiresAt || order.reservationExpiresAt)
      };
      reserveConcessionStock(lockedDb, savedOrder);
      const tickets = payment.status === "approved" ? finalizePaidOrder(lockedDb, savedOrder, payment, "online") : [];
      if (tickets.length) consumePendingClubCredit(lockedDb, savedOrder, tickets, customerUser?.id);
      lockedDb.payments.unshift(payment);
      lockedDb.orders.unshift(savedOrder);
      await writeDb(lockedDb);
      logEvent("info", "payment.created", {
        orderId: savedOrder.id,
        paymentId: payment.id,
        method: payment.method,
        provider: payment.provider,
        status: payment.status,
        couponCode: savedOrder.couponCode || "",
        couponDiscount: savedOrder.couponDiscount || 0
      });
      return { response: checkoutResponse(lockedDb, savedOrder, payment, tickets), order: savedOrder, tickets };
    });
    if (created) {
      try {
        await releaseOrderSeatHolds(created.order, created.order.status === "pending_payment" ? "held" : "unavailable");
        seatRealtimeService?.broadcastSessionRefresh(created.order.sessionId);
      } catch (error) {
        logEvent("warn", "seat_realtime.release_hold_error", { orderId: created.order.id, message: error.message });
      }
      if (created.tickets.length) queueTicketEmailDelivery(created.order.id);
      sendJson(res, 201, created.response, { "Set-Cookie": checkoutAccessCookie(req, created.order.id) });
    }
    return;
  }

  if (pathname === "/api/account/tickets" && method === "GET") {
    sendJson(res, 410, { error: { code: "ENDPOINT_REMOVED", message: "Use /api/me/tickets com sessao autenticada." } });
    return;
  }

  const checkoutOrderMatch = pathname.match(/^\/api\/checkout\/orders\/([^/]+)$/);
  if (checkoutOrderMatch && method === "GET") {
    const orderId = decodeURIComponent(checkoutOrderMatch[1]);
    let snapshotDb = db;
    let snapshotOrder = (snapshotDb.orders || []).find((item) => item.id === orderId || item.idempotencyKey === orderId);
    if (!snapshotOrder || !checkoutAccessAllowed(req, db, snapshotOrder)) {
      sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
      return;
    }
    if (snapshotOrder.status === "pending_payment" && snapshotOrder.reservationExpiresAt && new Date(snapshotOrder.reservationExpiresAt).getTime() <= Date.now()) {
      const expiredOrders = [];
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        if (expireStaleReservations(lockedDb, expiredOrders)) await writeDb(lockedDb);
      });
      await cleanupExpiredCheckoutOrders(expiredOrders);
      snapshotDb = await readDb();
      snapshotOrder = (snapshotDb.orders || []).find((item) => item.id === snapshotOrder.id);
    }
    await reconcileOnlineCheckoutOrder(snapshotOrder.id, snapshotDb);
    const currentDb = await readDb();
    const order = (currentDb.orders || []).find((item) => item.id === snapshotOrder.id);
    if (!order) {
      sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
      return;
    }
    const payment = (currentDb.payments || []).find((item) => item.orderId === order.id) || null;
    if (!payment && order.status !== "paid") {
      sendJson(res, 404, { error: { code: "PAYMENT_NOT_FOUND", message: "Pagamento nao encontrado para este pedido." } });
      return;
    }
    const tickets = (payment?.status === "approved" || (!payment && order.status === "paid"))
      ? (currentDb.tickets || []).filter((ticket) => ticket.orderId === order.id).map((ticket) => enrichTicket(currentDb, ticket))
      : [];
    sendJson(res, 200, checkoutResponse(currentDb, order, payment, tickets), {
      "Cache-Control": "private, no-store, max-age=0"
    });
    return;
  }

  if (handleCustomerTicketListRead({ req, res, pathname, method, db })) return;

  const accountTicketMatch = pathname.match(/^\/api\/me\/tickets\/([^/]+)(?:\/([^/]+))?$/);
  if (accountTicketMatch) {
    const user = requireCustomerAuth(req, res, db);
    if (!user) return;
    const ticketId = decodeURIComponent(accountTicketMatch[1]);
    const action = accountTicketMatch[2] ? decodeURIComponent(accountTicketMatch[2]) : "";

    if (handleCustomerTicketDetailRead({ res, method, action, db, ticketId, user })) return;

    if (method === "GET" && action === "qr") {
      const ticket = getOwnedTicket(db, ticketId, user);
      if (!ticket) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      const order = orderForTicket(db, ticket);
      const session = sessionForTicket(db, ticket);
      const status = effectiveTicketStatus(ticket, order, session, db);
      const canRedeemConcessionsToday = ticketCanRedeemPendingConcessionsToday(ticket, db);
      if ((status === "used" || ticket.status === "used" || ticket.usedAt) && !canRedeemConcessionsToday) {
        sendJson(res, 409, { error: { code: "TICKET_ALREADY_USED", message: "Este ingresso ja foi utilizado e nao possui QR Code ativo." } }, {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache"
        });
        return;
      }
      if (["cancelled", "refunded"].includes(status) || ["cancelled", "refunded"].includes(ticket.status)) {
        sendJson(res, 409, { error: { code: "TICKET_CANCELLED", message: "Este ingresso foi cancelado e nao possui QR Code ativo." } }, {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache"
        });
        return;
      }
      if ((status === "expired" || ticketIsExpired(ticket, db)) && !canRedeemConcessionsToday) {
        sendJson(res, 409, { error: { code: "TICKET_EXPIRED", message: "Este ingresso expirou e nao possui QR Code ativo." } }, {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache"
        });
        return;
      }
      if (status !== "active" && !canRedeemConcessionsToday) {
        sendJson(res, 409, { error: { code: "TICKET_UNAVAILABLE", message: "Este ingresso nao esta disponivel para uso." } }, {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache"
        });
        return;
      }
      if (!ticket.qrToken) {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const lockedTicket = (lockedDb.tickets || []).find((item) => item.id === ticket.id);
          if (lockedTicket) {
            ensureTicketQrToken(lockedTicket);
            await writeDb(lockedDb);
            ticket.qrToken = lockedTicket.qrToken;
          }
        });
      }
      const qrPayload = ticketCodeService.qrPayload(ticket.code, ticket.qrToken);
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "Surrogate-Control": "no-store"
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin"
      });
      res.end(JSON.stringify({
        ticketId: ticket.id,
        code: ticketCodeService.displayCode(ticket),
        qrPayload,
        status: canRedeemConcessionsToday ? "concessions_pending" : "active"
      }));
      return;
    }

    if (method === "GET" && action === "download") {
      const ticket = getOwnedTicket(db, ticketId, user);
      if (!ticket) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      const documentAccess = ticketDocumentDownloadAllowed(ticket, db);
      if (!documentAccess.ok) {
        sendJson(res, 410, {
          error: {
            code: "TICKET_DOCUMENT_EXPIRED",
            message: "O PDF deste ingresso arquivado foi removido apos o prazo de 10 dias."
          }
        }, { "Cache-Control": "private, no-store, max-age=0" });
        return;
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      const disposition = url.searchParams.get("view") === "1" ? "inline" : "attachment";
      const enrichedTicket = enrichTicket(db, ticket);
      const pdf = await ticketDownloadPdf(db, ticket);
      const downloadName = enrichedTicket.status === "active"
        ? `cine-cruzeiro-${ticket.code}.pdf`
        : `cine-cruzeiro-ingresso-${ticket.id}.pdf`;
      res.writeHead(200, {
        ...securityHeaders({
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${downloadName}"`,
          "Cache-Control": "no-store"
        }),
        "Access-Control-Allow-Origin": responseCorsOrigin(req),
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin"
      });
      res.end(pdf);
      return;
    }

    if (method === "POST" && action === "google-wallet") {
      const ticket = getOwnedTicket(db, ticketId, user);
      if (!ticket) {
        sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
        return;
      }
      const ticketStatus = effectiveTicketStatus(ticket, orderForTicket(db, ticket), sessionForTicket(db, ticket), db);
      if (ticketStatus !== "active") {
        sendJson(res, 410, {
          error: {
            code: "TICKET_ARCHIVED",
            message: "Google Wallet esta disponivel apenas para ingressos ativos."
          }
        }, { "Cache-Control": "private, no-store, max-age=0" });
        return;
      }
      try {
        const url = await googleWalletSaveUrl(db, ticket, user, req);
        const config = getGoogleWalletConfig(db);
        logEvent("info", "google_wallet.save_url_issued", {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          issuerId: config.issuerId,
          classId: config.classId,
          userId: user.id
        });
        sendJson(res, 200, { url });
      } catch (error) {
        logEvent("warn", "google_wallet.save_url_failed", {
          ticketId: ticket.id,
          message: error.message,
          statusCode: error.statusCode || 400
        });
        sendJson(res, error.statusCode || 400, { error: { code: error.statusCode === 412 ? "GOOGLE_WALLET_NOT_CONFIGURED" : "GOOGLE_WALLET_UNAVAILABLE", message: error.message } });
      }
      return;
    }

    if (method === "POST" && action === "transfer") {
      const body = await readBody(req);
      const targetEmail = String(body.email || "").trim().toLowerCase();
      const concessionTargetTicketId = String(body.concessionTargetTicketId || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        sendJson(res, 400, { error: { code: "EMAIL_INVALID", message: "Informe o e-mail de uma conta cadastrada." } });
        return;
      }
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const freshUser = getCustomerUser(req, lockedDb);
        const ticket = getOwnedTicket(lockedDb, ticketId, freshUser);
        if (!freshUser || !ticket) {
          sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso nao encontrado nesta conta." } });
          return;
        }
        const targetUser = (lockedDb.users || []).find((item) => item.email === targetEmail && item.active !== false && ["customer", ...adminRoles()].includes(item.role));
        if (!targetUser) {
          sendJson(res, 404, { error: { code: "TRANSFER_TARGET_NOT_FOUND", message: "Este e-mail ainda nao possui conta cadastrada." } });
          return;
        }
        if (targetUser.id === freshUser.id) {
          sendJson(res, 400, { error: { code: "TRANSFER_SAME_USER", message: "Este ingresso ja esta na sua conta." } });
          return;
        }
        const transferCheck = canTransferTicket(lockedDb, ticket);
        if (!transferCheck.ok) {
          sendJson(res, transferCheck.statusCode || 409, {
            error: { code: transferCheck.code || "TICKET_NOT_TRANSFERABLE", message: transferCheck.message }
          }, transferCheck.retryAfter ? {
            "Retry-After": String(transferCheck.retryAfter),
            "RateLimit-Policy": `${ticketTransferLimits.maxPerTicketPerWindow};w=${Math.ceil(ticketTransferLimits.windowMs / 1000)};scope=ticket`
          } : {});
          return;
        }
        const transferPolicy = evaluateTicketTransfer(persistedTicketTransferHistory(lockedDb, ticket), {
          ticketId: ticket.id,
          fromUserId: freshUser.id,
          toUserId: targetUser.id,
          sessionStartsAt: ticketSessionStartsAt(ticket, lockedDb)
        }, ticketTransferLimits);
        if (!transferPolicy.ok) {
          sendJson(res, transferPolicy.statusCode || 429, { error: { code: transferPolicy.code, message: transferPolicy.message } }, {
            ...(transferPolicy.retryAfter ? { "Retry-After": String(transferPolicy.retryAfter) } : {}),
            "RateLimit-Policy": transferPolicy.code === "TICKET_TRANSFER_RECIPIENT_LIMIT_REACHED"
              ? `${ticketTransferLimits.maxIncomingPerWindow};w=${Math.ceil(ticketTransferLimits.windowMs / 1000)};scope=recipient`
              : transferPolicy.code === "TICKET_TRANSFER_USER_LIMIT_REACHED"
                ? `${ticketTransferLimits.maxOutgoingPerWindow};w=${Math.ceil(ticketTransferLimits.windowMs / 1000)};scope=sender`
                : transferPolicy.retryAfter
                  ? `1;w=${Math.ceil(ticketTransferLimits.cooldownMs / 1000)};scope=ticket`
                  : `${ticketTransferLimits.maxPerTicketPerWindow};w=${Math.ceil(ticketTransferLimits.windowMs / 1000)};scope=ticket`
          });
          return;
        }
        const attachedConcessionOrders = pendingConcessionOrdersForTicket(lockedDb, ticket);
        let concessionTargetTicket = null;
        if (concessionTargetTicketId && attachedConcessionOrders.length) {
          concessionTargetTicket = (lockedDb.tickets || []).find((item) => item.id === concessionTargetTicketId) || null;
          const targetStatus = concessionTargetTicket
            ? effectiveTicketStatus(concessionTargetTicket, orderForTicket(lockedDb, concessionTargetTicket), sessionForTicket(lockedDb, concessionTargetTicket), lockedDb)
            : "";
          if (!concessionTargetTicket || concessionTargetTicket.id === ticket.id || !ticketBelongsToUser(lockedDb, concessionTargetTicket, freshUser) || targetStatus !== "active") {
            sendJson(res, 409, { error: { code: "CONCESSION_TRANSFER_TARGET_INVALID", message: "Escolha outro ingresso ativo da sua conta para manter a bomboniere." } });
            return;
          }
          assignConcessionsToTicket(attachedConcessionOrders, concessionTargetTicket.id);
        }
        const oldCode = ticket.code;
        const newCode = createTicketCode(lockedDb.tickets || []);
        const newQrToken = ticketCodeService.generateQrToken();
        ticket.customerUserId = targetUser.id;
        ticket.customerName = targetUser.name || ticket.customerName;
        ticket.customerEmail = targetUser.email;
        ticket.customerPhone = targetUser.phone || "";
        ticket.customerCpf = targetUser.cpf || "";
        ticket.code = newCode;
        ticket.qrToken = newQrToken;
        ticket.qrPayload = ticketQrPayload(newCode, newQrToken);
        ticket.transferredAt = new Date().toISOString();
        ticket.transferredFromUserId = freshUser.id;
        ticket.updatedAt = new Date().toISOString();
        lockedDb.ticketTransfers ||= [];
        const transferRecord = {
          id: `transfer-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          fromUserId: freshUser.id,
          toUserId: targetUser.id,
          ticketId: ticket.id,
          oldCode,
          newCode,
          transferredAt: ticket.transferredAt,
          concessionsTransferred: attachedConcessionOrders.length > 0 && !concessionTargetTicket,
          concessionTargetTicketId: concessionTargetTicket?.id || ""
        };
        lockedDb.ticketTransfers.push(transferRecord);
        ticket.transferHistory = [...(Array.isArray(ticket.transferHistory) ? ticket.transferHistory : []), transferRecord].slice(-100);
        lockedDb.auditLogs ||= [];
        lockedDb.auditLogs.push({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          userId: freshUser.id,
          userEmail: freshUser.email,
          action: "POST /api/me/tickets/:id/transfer",
          entityType: "ticket",
          entityId: ticket.id,
          before: { customerUserId: freshUser.id, code: oldCode },
          after: {
            customerUserId: targetUser.id,
            code: newCode,
            concessionsTransferred: transferRecord.concessionsTransferred,
            concessionTargetTicketId: transferRecord.concessionTargetTicketId
          },
          ip: clientIp(req),
          createdAt: ticket.transferredAt
        });
        const enrichedTransferTicket = enrichTicket(lockedDb, ticket);
        let transferAttachment = null;
        try {
          transferAttachment = {
            filename: `cine-cruzeiro-${String(ticket.code || ticket.id || "ingresso").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.pdf`,
            content: await ticketDownloadPdf(lockedDb, ticket),
            contentType: "application/pdf"
          };
        } catch (error) {
          logEvent("warn", "ticket_transfer_pdf.failed", { ticketId: ticket.id, message: error.message });
        }
        await writeDb(lockedDb);
        emailService.sendTicketTransfer(lockedDb, {
          ticket: enrichedTransferTicket,
          fromUser: freshUser,
          toUser: targetUser,
          accountUrl: `${appFrontendUrl()}/conta/ingressos`,
          logoUrl: `${appFrontendUrl()}/images/favicon-email.png`,
          siteUrl: appFrontendUrl(),
          concessionsTransferred: transferRecord.concessionsTransferred,
          concessionTargetTicketId: transferRecord.concessionTargetTicketId,
          attachments: transferAttachment ? [transferAttachment] : []
        }).catch((error) => {
          logEvent("warn", "ticket_transfer_email.failed", { ticketId: ticket.id, message: error.message });
        });
        logEvent("info", "ticket.transferred", {
          ticketId: ticket.id,
          fromUserId: freshUser.id,
          toUserId: targetUser.id,
          concessionsTransferred: transferRecord.concessionsTransferred,
          concessionTargetTicketId: transferRecord.concessionTargetTicketId
        });
        sendJson(res, 200, {
          ok: true,
          ticket: toCustomerTicketDto(enrichTicket(lockedDb, ticket)),
          concessionsTransferred: transferRecord.concessionsTransferred,
          concessionTargetTicketId: transferRecord.concessionTargetTicketId
        });
      });
      return;
    }
  }

  const concessionCounterPrintMatch = pathname.match(/^\/api\/admin\/concession-sales\/([^/]+)\/print$/);
  if (concessionCounterPrintMatch && method === "GET") {
    const order = (db.orders || []).find((item) => item.id === decodeURIComponent(concessionCounterPrintMatch[1]));
    if (!order || order.saleMode !== "concession_counter" || !(order.concessionItems || []).length) {
      sendJson(res, 404, { error: { code: "CONCESSION_SALE_NOT_FOUND", message: "Venda presencial da bomboniere não encontrada." } });
      return;
    }
    const payment = orderPayment(db, order.id);
    const pdf = concessionThermalPdf(order, payment);
    res.writeHead(200, {
      ...securityHeaders({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="cine-cruzeiro-bomboniere-pdv.pdf"',
        "Cache-Control": "no-store"
      }),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });
    res.end(pdf);
    return;
  }

  const adminTicketPrintMatch = pathname.match(/^\/api\/admin\/tickets\/([^/]+)\/print$/);
  const adminOrderPrintMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/print$/);
  if ((adminTicketPrintMatch || adminOrderPrintMatch) && method === "GET") {
    const adminUser = getAdminUser(req, db);
    if (!adminUser) {
      sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para imprimir o ingresso." } });
      return;
    }
    const identifier = decodeURIComponent((adminTicketPrintMatch || adminOrderPrintMatch)[1]);
    const tickets = (db.tickets || []).filter((item) => adminOrderPrintMatch ? item.orderId === identifier : item.id === identifier);
    if (!tickets.length) {
      sendJson(res, 404, { error: { code: "TICKET_NOT_FOUND", message: "Ingresso não encontrado." } });
      return;
    }
    const pdf = ticketThermalPdf(db, tickets);
    res.writeHead(200, {
      ...securityHeaders({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="cine-cruzeiro-pdv.pdf"',
        "Cache-Control": "no-store"
      }),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });
    res.end(pdf);
    return;
  }

  if (pathname === "/api/box-office/point-terminals" && method === "GET") {
    const adminUser = getAdminUser(req, db);
    if (!adminUser) {
      sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para consultar as maquininhas." } });
      return;
    }
    if (activeOnlinePaymentProvider(db).provider === "pag_bank") {
      sendJson(res, 412, { error: { code: "TAP_ON_ANDROID_NOT_CONNECTED", message: "O PagBank está ativo para pagamentos online. A cobrança presencial Tap On exige o aplicativo Android de operação homologado; não é uma maquininha Point Bluetooth." } });
      return;
    }
    const config = integrationConfigService.resolvedConfig(db, "mercadoPago") || {};
    if (!cardTerminalProvider.configured(config)) {
      sendJson(res, 412, { error: { code: "POINT_NOT_CONFIGURED", message: "Mercado Pago Point ainda não está configurado." } });
      return;
    }
    const terminals = await cardTerminalProvider.listTerminals(config);
    sendJson(res, 200, { terminals, selectedTerminalId: config.pointDeviceId || "" });
    return;
  }

  if (pathname === "/api/auth/mobile/google/consume" && method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = String(url.searchParams.get("token") || "");
    const handoff = verifySignedValue(token);
    const pending = handoff?.nonce ? mobileAuthHandoffs.get(handoff.nonce) : null;
    if (handoff?.nonce) mobileAuthHandoffs.delete(handoff.nonce);
    const validHandoff = handoff?.type === "mobile_google_handoff"
      && pending?.userId === handoff.sub
      && Number(pending?.expiresAt || 0) > Date.now();
    const user = validHandoff
      ? (postgresEnabled() ? await userRepository.findById(handoff.sub) : (db.users || []).find((item) => item.id === handoff.sub))
      : null;
    if (!user || user.active === false || Number(user.sessionVersion || 0) !== Number(handoff?.sv || 0)) {
      res.writeHead(303, {
        Location: `${appFrontendUrl()}/conta?authError=google_oauth`,
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer"
      });
      res.end();
      return;
    }

    const returnTo = String(handoff.returnTo || "");
    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/conta";
    const successUrl = new URL(`${appFrontendUrl()}${safeReturnTo}`);
    successUrl.searchParams.set("auth", "google_success");
    res.writeHead(303, {
      Location: successUrl.toString(),
      "Set-Cookie": customerCookie(customerSessionValue(user)),
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer"
    });
    res.end();
    return;
  }

  const pointPaymentPrintMatch = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/print$/);
  if (pointPaymentPrintMatch && method === "GET") {
    const adminUser = getAdminUser(req, db);
    if (!adminUser) {
      sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: "Entre no painel para imprimir a venda." } });
      return;
    }
    const paymentId = decodeURIComponent(pointPaymentPrintMatch[1]);
    const payment = (db.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
    if (!payment || payment.status !== "approved") {
      sendJson(res, 409, { error: { code: "POINT_PAYMENT_NOT_PRINTABLE", message: "A venda só pode ser impressa após a confirmação do pagamento." } });
      return;
    }
    const orders = pointPaymentOrders(db, payment);
    const orderIds = new Set(orders.map((order) => order.id));
    const issuedTickets = (db.tickets || []).filter((ticket) => orderIds.has(ticket.orderId));
    const tickets = issuedTickets.length
      ? issuedTickets
      : orders.flatMap((order) => Array.isArray(order.pendingPrintTickets) ? order.pendingPrintTickets : []);
    if (!tickets.length && orders[0]?.saleMode !== "concession_counter") {
      sendJson(res, 404, { error: { code: "POINT_TICKETS_NOT_FOUND", message: "Nenhum ingresso emitido foi encontrado para esta venda." } });
      return;
    }
    const pdf = tickets.length ? ticketThermalPdf(db, tickets) : concessionThermalPdf(orders[0], payment);
    res.writeHead(200, {
      ...securityHeaders({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="cine-cruzeiro-venda-pdv.pdf"',
        "Cache-Control": "no-store"
      }),
      "Access-Control-Allow-Origin": responseCorsOrigin(req),
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin"
    });
    res.end(pdf);
    return;
  }

  if (await handlePointLocalPrintResult({ req, res, pathname, method })) return;

  const pointPaymentRetryPrintMatch = pathname.match(/^\/api\/box-office\/point-payments\/([^/]+)\/retry-print$/);
  if (pointPaymentRetryPrintMatch && method === "POST") {
    const body = await readBody(req);
    const paymentId = decodeURIComponent(pointPaymentRetryPrintMatch[1]);
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const payment = (lockedDb.payments || []).find((item) => item.id === paymentId && ["point_sale", "counter_sale"].includes(item.metadata?.kind));
      if (!payment || payment.status !== "approved") {
        sendJson(res, 409, { error: { code: "PRINT_RETRY_INVALID", message: "A venda não está disponível para nova tentativa de impressão." } });
        return;
      }
      const orders = pointPaymentOrders(lockedDb, payment);
      if (!orders.some((order) => order.status === "paid_pending_print")) {
        sendJson(res, 409, { error: { code: "PRINT_ALREADY_COMPLETED", message: "Os ingressos desta venda já foram emitidos." } });
        return;
      }
      if (orders.some((order) => !["failed", "timed_out", "local_required"].includes(String(order.pointPrint?.status || "")))) {
        sendJson(res, 409, { error: { code: "PRINT_STILL_IN_PROGRESS", message: "A impressão anterior ainda pode estar em andamento. Aguarde a confirmação antes de tentar novamente." } });
        return;
      }
      const config = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {};
      const previousPointPrint = orders.find((order) => order.pointPrint?.status === "timed_out" && order.pointPrint?.actionId)?.pointPrint;
      if (previousPointPrint) {
        let previousAction;
        try {
          previousAction = await cardTerminalProvider.getPrintStatus(previousPointPrint.actionId, config);
        } catch {
          sendJson(res, 503, { error: { code: "PRINT_STATUS_UNCERTAIN", message: "Não foi possível confirmar se a Point já imprimiu. Reconecte a maquininha antes de tentar outra impressão." } });
          return;
        }
        if (previousAction.status === "printed") {
          orders.forEach((order) => { order.pointPrint = { ...order.pointPrint, status: "printed", checkedAt: new Date().toISOString() }; });
          const finalized = finalizePrintedOrders(lockedDb, orders, payment);
          await writeDb(lockedDb);
          sendJson(res, 200, { payment, ...finalized, pointPrint: orders[0]?.pointPrint, completed: true });
          return;
        }
        if (previousAction.status !== "failed") {
          sendJson(res, 409, { error: { code: "PRINT_STILL_IN_PROGRESS", message: "A Point ainda pode imprimir esta venda. Aguarde a conclusão antes de enviar outra via." } });
          return;
        }
      }
      const tickets = orders.flatMap((order) => Array.isArray(order.pendingPrintTickets) ? order.pendingPrintTickets : []);
      const usePoint = body.mode === "point" && payment.metadata?.kind === "point_sale" && config.pointTicketPrintEnabled !== false;
      const pointPrint = await queueBoxOfficePointPrint(lockedDb, orders, tickets, config, {
        batchId: payment.metadata?.batchId,
        paymentMethod: payment.method,
        adminUser: req.adminUser,
        forceRetry: usePoint,
        forceLocal: !usePoint
      });
      await writeDb(lockedDb);
      sendJson(res, 200, { payment, orders, tickets: [], pointPrint, completed: false });
    });
    return;
  }

  if (await handlePointPrintFailureResolution({ req, res, db, pathname, method })) return;

  if (await handlePointPaymentRecovery({ req, res, db, pathname, method })) return;

  if (await handlePointPaymentCancellation({ req, res, db, pathname, method })) return;

  if ((pathname === "/api/box-office/sales" || pathname === "/api/tickets/manual" || pathname === "/api/admin/concession-counter-sales") && method === "POST") {
    const body = await readBody(req);
    if (["courtesy", "cortesia"].includes(String(body.paymentMethod || "").trim().toLowerCase())
      && !ensureAdminAction(req, res, "box_office.courtesy", "Esta conta pode vender na bilheteria, mas não pode emitir cortesias.")) return;
    const pointPreparation = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const adminUser = getAdminUser(req, lockedDb);
      if (!adminUser) {
        sendJson(res, 401, { error: { code: "ADMIN_AUTH_REQUIRED", message: pathname === "/api/admin/concession-counter-sales" ? "Entre no painel para vender na bomboniere." : "Entre no painel para vender na bilheteria." } });
        return;
      }
      const methodMap = {
        cash: "cash",
        money: "cash",
        card_terminal: "card_terminal",
        terminal: "card_terminal",
        point_card: "card_terminal",
        point_debit: "point_debit",
        point_credit: "point_credit",
        point_qr: "point_qr",
        external_pix: "external_pix",
        pix_counter: "external_pix",
        courtesy: "courtesy",
        cortesia: "courtesy"
      };
      const paymentMethod = methodMap[String(body.paymentMethod || "cash").trim()] || "cash";
      const pointPayment = ["card_terminal", "point_debit", "point_credit", "point_qr"].includes(paymentMethod);
      const clientRequestId = /^[a-zA-Z0-9_-]{8,80}$/.test(String(body.clientRequestId || ""))
        ? String(body.clientRequestId)
        : "";
      if (pointPayment && !clientRequestId) {
        sendJson(res, 422, { error: { code: "POINT_REQUEST_ID_REQUIRED", message: "Esta venda precisa de um identificador estável. Atualize o painel e tente novamente." } });
        return;
      }
      const requestFingerprint = pointPayment ? pointSaleFingerprint(pathname, body) : "";
      if (pointPayment && clientRequestId) {
        const existingPayment = (lockedDb.payments || []).find((item) => item.metadata?.kind === "point_sale" && item.metadata?.clientRequestId === clientRequestId);
        if (existingPayment) {
          const selectedTerminal = String((integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {}).pointDeviceId
            || (integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {}).pointTerminalId || "");
          if (existingPayment.metadata?.requestFingerprint && (existingPayment.metadata.requestFingerprint !== requestFingerprint
            || existingPayment.metadata.terminalId !== selectedTerminal
            || existingPayment.metadata.providerAccountFingerprint !== pointProviderAccountFingerprint(integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {}))) {
            sendJson(res, 409, { error: { code: "POINT_REQUEST_ID_CONFLICT", message: "Este identificador já pertence a outra venda ou terminal. Concilie a venda original antes de continuar." } });
            return;
          }
          const existingOrders = pointPaymentOrders(lockedDb, existingPayment);
          const existingOrderIds = new Set(existingOrders.map((order) => order.id));
          const existingTickets = (lockedDb.tickets || []).filter((ticket) => existingOrderIds.has(ticket.orderId));
          sendJson(res, 200, {
            order: existingOrders[0] || null,
            payment: existingPayment,
            orders: existingOrders,
            payments: [existingPayment],
            tickets: existingTickets,
            pointPrint: existingOrders.find((order) => order.pointPrint)?.pointPrint || { status: "not_requested" },
            batchId: existingPayment.metadata?.batchId || "",
            totalPrice: existingPayment.amount,
            resumed: true,
            point: {
              status: existingPayment.status,
              providerOrderId: existingPayment.providerPaymentId,
              terminalId: existingPayment.metadata?.terminalId || ""
            }
          });
          return;
        }
      }
      const selectedCustomer = body.customerUserId
        ? (lockedDb.users || []).find((user) => user.id === body.customerUserId && user.active !== false && ["customer", ...adminRoles()].includes(user.role))
        : null;
      if (body.customerUserId && !selectedCustomer) {
        sendJson(res, 404, { error: { code: "BOX_OFFICE_CUSTOMER_NOT_FOUND", message: "O usuário selecionado não está mais disponível. Busque o cliente novamente." } });
        return;
      }
      const saleMode = pathname === "/api/admin/concession-counter-sales"
        ? "concession_counter"
        : body.saleMode || (selectedCustomer ? "registered" : body.customerName ? "guest" : "quick");
      const concessionCounterSale = saleMode === "concession_counter";
      const saleOrigin = concessionCounterSale ? "concession_counter" : "box_office";
      const ticketDeliveryMethod = boxOfficeTicketDeliveryMethod(saleMode, body.ticketDeliveryMethod);
      const guestDeliveryEmail = String(body.customerEmail || "").trim().toLowerCase();
      if (saleMode === "guest" && ticketDeliveryMethod === "online" && (guestDeliveryEmail.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestDeliveryEmail))) {
        sendJson(res, 422, { error: { code: "BOX_OFFICE_DELIVERY_EMAIL_INVALID", message: "Informe um e-mail válido para entregar o ingresso online." } });
        return;
      }
      const requestedSales = concessionCounterSale ? [body] : Array.isArray(body.saleItems) && body.saleItems.length ? body.saleItems : [body];
      if (requestedSales.length > 20) {
        sendJson(res, 400, { error: { code: "BOX_OFFICE_BATCH_LIMIT", message: "Finalize no máximo 20 filmes por venda." } });
        return;
      }
      const saleKeys = requestedSales.map((item) => `${String(item?.movieId || "").trim()}::${String(item?.sessionId || "").trim()}`);
      if (!concessionCounterSale && new Set(saleKeys).size !== saleKeys.length) {
        sendJson(res, 409, { error: { code: "BOX_OFFICE_DUPLICATE_SESSION", message: "A mesma sessão foi adicionada mais de uma vez. Ajuste as quantidades no item existente." } });
        return;
      }

      const batchId = clientRequestId
        ? `venda-lote-${clientRequestId}`
        : `venda-lote-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const customerData = {
        customerUserId: selectedCustomer?.id || "",
        customerName: selectedCustomer?.name || body.customerName || (concessionCounterSale ? "Venda presencial da bomboniere" : saleMode === "quick" ? "Venda rápida de balcão" : "Cliente avulso"),
        customerEmail: selectedCustomer?.email || body.customerEmail || "",
        customerPhone: selectedCustomer?.phone || phoneDigits(body.customerPhone),
        customerCpf: selectedCustomer?.cpf || cpfDigits(body.customerCpf)
      };

      // Valida e precifica o lote inteiro antes de emitir qualquer ingresso.
      const sharedConcessionItems = Array.isArray(body.concessionItems) ? body.concessionItems : [];
      const preparedOrders = requestedSales.map((saleItem, index) => {
        const normalizedOrder = normalizePaymentOrder({
          ...body,
          ...saleItem,
          concessionItems: index === 0 ? sharedConcessionItems : (Array.isArray(saleItem.concessionItems) ? saleItem.concessionItems : []),
          id: saleItem.id || (clientRequestId
            ? `pedido-bilheteria-${clientRequestId}-${index}`
            : `pedido-bilheteria-${Date.now()}-${index}-${crypto.randomBytes(4).toString("hex")}`),
          ...customerData,
          paymentMethod,
          ticketDeliveryMethod,
          status: pointPayment ? "pending_payment" : "paid",
          paymentStatus: pointPayment ? "pending" : "approved",
          autoAssignSeats: saleItem.autoAssignSeats !== false
        });
        const order = concessionCounterSale
          ? repriceConcessionCounterOrder(lockedDb, normalizedOrder)
          : repriceOrderFromCatalog(lockedDb, normalizedOrder);
        if (paymentMethod === "courtesy") {
          order.discountValue = Number(order.totalPrice || 0);
          order.totalPrice = 0;
        }
        if (!selectedCustomer && !body.customerEmail) order.customerEmail = "";
        return order;
      });
      if (!concessionCounterSale) {
        for (const order of preparedOrders) {
          await claimSeatHoldsForOrder(lockedDb, order);
        }
      }

      if (pointPayment) {
        if (activeOnlinePaymentProvider(lockedDb).provider === "pag_bank") {
          sendJson(res, 412, { error: { code: "TAP_ON_ANDROID_NOT_CONNECTED", message: "A cobrança presencial PagBank Tap On ainda não está conectada ao aplicativo Android de operação. Use dinheiro ou Pix externo até a homologação; nenhuma venda em cartão foi registrada." } });
          return;
        }
        const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {};
        if (!cardTerminalProvider.configured(mercadoPagoConfig)) {
          sendJson(res, 412, {
            error: {
              code: "POINT_NOT_CONFIGURED",
              message: "Habilite o Mercado Pago Point e informe o Terminal ID em Integrações antes de vender pelo terminal."
            }
          });
          return;
        }
        if (!postgresEnabled()) await cardTerminalProvider.terminalConnection(mercadoPagoConfig);
        const totalPrice = preparedOrders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0);
        preparedOrders.forEach((order) => reserveConcessionStock(lockedDb, order));
        const externalReference = postgresEnabled()
          ? `point-${crypto.createHash("sha256").update(`${process.env.NEXT_PUBLIC_CINEMA_SLUG || "default"}:${clientRequestId}`).digest("hex").slice(0, 48)}`
          : cardTerminalProvider.safeReference(`point-${batchId}`);
        const defaultPaymentType = {
          point_qr: "qr",
          point_credit: "credit_card",
          point_debit: "debit_card",
          card_terminal: "debit_card"
        }[paymentMethod];
        const cinemaName = String(lockedDb.settings?.cinemaName || lockedDb.settings?.name || "Cinema").trim();
        const paymentDescription = concessionCounterSale
          ? `Venda presencial da bomboniere - ${cinemaName}`
          : preparedOrders.length === 1
          ? `Ingresso ${preparedOrders[0].movieTitle || cinemaName}`
          : `Venda de ${preparedOrders.length} filmes - ${cinemaName}`;
        const idempotencyKey = postgresEnabled()
          ? `point-${crypto.createHash("sha256").update(`${process.env.NEXT_PUBLIC_CINEMA_SLUG || "default"}:${clientRequestId}`).digest("hex")}`
          : `point-${batchId}`;
        const localPaymentId = postgresEnabled() ? `pagamento-point-${clientRequestId}` : `pagamento-point-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const timestamp = new Date().toISOString();
        const buildPointOrders = (paymentRecord) => preparedOrders.map((order) => ({
          ...order,
          batchId,
          status: "pending_payment",
          origin: saleOrigin,
          saleMode,
          ticketDeliveryMethod,
          paymentMethod,
          paymentProvider: paymentRecord.provider,
          paymentId: paymentRecord.id,
          paymentStatus: paymentRecord.status,
          createdBy: adminUser.id,
          createdByEmail: adminUser.email,
          createdAt: order.createdAt || timestamp,
          reservationExpiresAt: paymentRecord.status === "approved" ? "" : pointReservationExpiresAt(mercadoPagoConfig),
          audit: {
            origin: saleOrigin,
            batchId,
            paymentMethod,
            ticketDeliveryMethod,
            createdBy: adminUser.id,
            createdAt: timestamp,
            customerId: selectedCustomer?.id || ""
          }
        }));
        if (postgresEnabled()) {
          const pointPaymentRecord = {
            id: localPaymentId,
            orderId: preparedOrders[0].id,
            method: paymentMethod,
            provider: "mercado_pago",
            providerPaymentId: "",
            providerReference: externalReference,
            status: "pending",
            amount: totalPrice,
            currency: "BRL",
            createdAt: timestamp,
            updatedAt: timestamp,
            metadata: {
              kind: "point_sale", origin: saleOrigin, batchId, clientRequestId,
              requestFingerprint,
              installationId: String(process.env.NEXT_PUBLIC_CINEMA_SLUG || "default"),
              providerAccountFingerprint: pointProviderAccountFingerprint(mercadoPagoConfig),
              relatedOrderIds: preparedOrders.map((order) => order.id),
              terminalId: String(mercadoPagoConfig.pointDeviceId || mercadoPagoConfig.pointTerminalId || ""),
              idempotencyKey,
              pointCreateState: "prepared",
              pointCreateAttempts: 0,
              pointCreateLeaseUntil: "",
              recoveryRequest: { externalReference, idempotencyKey, ticketNumber: batchId, defaultPaymentType, description: paymentDescription, totalPrice },
              createdBy: adminUser.id,
              createdByEmail: adminUser.email
            }
          };
          const orders = buildPointOrders(pointPaymentRecord);
          lockedDb.orders.unshift(...orders);
          lockedDb.payments.unshift(pointPaymentRecord);
          await writeDb(lockedDb);
          await releaseBoxOfficeSeatHolds(orders);
          return { pointPaymentId: pointPaymentRecord.id, orderIds: orders.map((order) => order.id), adminUserId: adminUser.id };
        }
        let providerPayment;
        try {
          providerPayment = await cardTerminalProvider.createPayment({
          id: externalReference,
          totalPrice,
          description: paymentDescription
        }, mercadoPagoConfig, {
          externalReference,
          idempotencyKey,
          ticketNumber: batchId,
          defaultPaymentType,
          description: paymentDescription
          });
        } catch (error) {
          if (error.code !== "POINT_CONNECTION_LOST") throw error;
          const pointPaymentRecord = {
            id: localPaymentId,
            orderId: preparedOrders[0].id,
            method: paymentMethod,
            provider: "mercado_pago",
            providerPaymentId: "",
            providerReference: externalReference,
            status: "pending",
            amount: totalPrice,
            currency: "BRL",
            createdAt: timestamp,
            updatedAt: timestamp,
            approvedAt: "",
            metadata: {
              kind: "point_sale",
              origin: saleOrigin,
              batchId,
              clientRequestId,
              relatedOrderIds: preparedOrders.map((order) => order.id),
              terminalId: String(mercadoPagoConfig.pointDeviceId || mercadoPagoConfig.pointTerminalId || ""),
              providerStatus: "connection_lost",
              statusDetail: "reconnect_required",
              idempotencyKey,
              reconnectRequired: true,
              reconnectAttempts: 0,
              recoveryRequest: { externalReference, idempotencyKey, ticketNumber: batchId, defaultPaymentType, description: paymentDescription, totalPrice },
              createdBy: adminUser.id,
              createdByEmail: adminUser.email
            }
          };
          const orders = buildPointOrders(pointPaymentRecord);
          lockedDb.orders.unshift(...orders);
          lockedDb.payments.unshift(pointPaymentRecord);
          await writeDb(lockedDb);
          await releaseBoxOfficeSeatHolds(orders);
          logEvent("warn", "box_office_point_sale.reconnect_required", { paymentId: pointPaymentRecord.id, orderIds: orders.map((order) => order.id), batchId, createdBy: adminUser.id });
          sendJson(res, 202, {
            order: orders[0], payment: pointPaymentRecord, orders, payments: [pointPaymentRecord], tickets: [],
            pointPrint: { requested: false, status: "not_requested", message: "" }, batchId, totalPrice,
            reconnecting: true, retryAfterMs: 3500,
            point: { status: "pending", providerOrderId: "", terminalId: pointPaymentRecord.metadata.terminalId }
          });
          return;
        }
        const pointPaymentRecord = createPointPaymentRecord(preparedOrders, providerPayment, adminUser, batchId, paymentMethod);
        pointPaymentRecord.id = localPaymentId;
        pointPaymentRecord.metadata.clientRequestId = clientRequestId;
        const orders = buildPointOrders(pointPaymentRecord);
        lockedDb.orders.unshift(...orders);
        lockedDb.payments.unshift(pointPaymentRecord);
        const pointResult = applyPointPaymentStatus(lockedDb, pointPaymentRecord, providerPayment);
        const pointPrint = pointPaymentRecord.status === "approved"
          ? await queueBoxOfficePointPrint(lockedDb, orders, pointResult.tickets, mercadoPagoConfig, {
            batchId,
            paymentMethod,
            adminUser
          })
          : { requested: false, status: "not_requested", message: "" };
        await writeDb(lockedDb);
        await releaseBoxOfficeSeatHolds(orders);
        logEvent("info", concessionCounterSale ? "concession_counter_point_sale.created" : "box_office_point_sale.created", {
          paymentId: pointPaymentRecord.id,
          providerPaymentId: pointPaymentRecord.providerPaymentId,
          orderIds: orders.map((order) => order.id),
          batchId,
          amount: totalPrice,
          status: pointPaymentRecord.status,
          terminalId: pointPaymentRecord.metadata.terminalId,
          createdBy: adminUser.id
        });
        sendJson(res, pointPaymentRecord.status === "approved" ? 201 : 202, {
          order: orders[0],
          payment: pointPaymentRecord,
          orders,
          payments: [pointPaymentRecord],
          tickets: pointResult.tickets,
          pointPrint,
          batchId,
          totalPrice,
          point: {
            status: pointPaymentRecord.status,
            providerOrderId: pointPaymentRecord.providerPaymentId,
            terminalId: pointPaymentRecord.metadata.terminalId
          }
        });
        pointResult.newlyPaidOrders
          .filter((order) => shouldDeliverBoxOfficeTicketsByEmail(order))
          .forEach((order) => queueTicketEmailDelivery(order.id));
        return;
      }

      const stagedOrders = [];
      const sales = preparedOrders.map((order) => {
        const payment = createBoxOfficePaymentRecord(order, paymentMethod, adminUser);
        const timestamp = new Date().toISOString();
        const requiresPrintConfirmation = orderRequiresConfirmedPrint(order);
        const savedOrder = {
          ...order,
          id: order.id,
          batchId,
          status: requiresPrintConfirmation ? "paid_pending_print" : "paid",
          origin: saleOrigin,
          saleMode,
          ticketDeliveryMethod,
          paymentMethod,
          paymentProvider: payment.provider,
          paymentId: payment.id,
          paymentStatus: "approved",
          createdBy: adminUser.id,
          createdByEmail: adminUser.email,
          createdAt: order.createdAt || timestamp,
          paidAt: timestamp,
          audit: {
            origin: saleOrigin,
            batchId,
            paymentMethod,
            ticketDeliveryMethod,
            createdBy: adminUser.id,
            createdAt: timestamp,
            customerId: selectedCustomer?.id || ""
          }
        };
        if (requiresPrintConfirmation) reserveConcessionStock(lockedDb, savedOrder);
        const tickets = requiresPrintConfirmation
          ? stagePaidOrderForPrint({ ...lockedDb, orders: [...lockedDb.orders, ...stagedOrders] }, savedOrder, payment, paymentMethod === "courtesy" ? "courtesy" : "box_office")
          : finalizePaidOrder(lockedDb, savedOrder, payment, paymentMethod === "courtesy" ? "courtesy" : "box_office");
        stagedOrders.push(savedOrder);
        return { order: savedOrder, payment, tickets };
      });
      const orders = sales.map((sale) => sale.order);
      const payments = sales.map((sale) => sale.payment);
      const tickets = sales.flatMap((sale) => sale.tickets);
      payments.forEach((payment) => {
        payment.metadata = { ...(payment.metadata || {}), batchId, relatedOrderIds: orders.map((order) => order.id) };
      });
      lockedDb.payments.unshift(...payments);
      lockedDb.orders.unshift(...orders);
      const mercadoPagoConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {};
      const pointPrint = orders.some(orderRequiresConfirmedPrint)
        ? await queueBoxOfficePointPrint(lockedDb, orders, tickets, mercadoPagoConfig, {
        batchId,
        paymentMethod,
        adminUser,
        forceLocal: true
      })
        : { requested: false, status: "not_requested", message: "" };
      await writeDb(lockedDb);
      await releaseBoxOfficeSeatHolds(orders);
      logEvent("info", concessionCounterSale ? "concession_counter_sale.created" : "box_office_sale.created", {
        orderId: orders[0].id,
        orderIds: orders.map((order) => order.id),
        batchId,
        movies: concessionCounterSale ? 0 : orders.length,
        tickets: tickets.length,
        paymentMethod,
        createdBy: adminUser.id,
        customerId: selectedCustomer?.id || ""
      });
      sendJson(res, 201, {
        order: orders[0],
        payment: payments[0],
        orders,
        payments,
        tickets,
        batchId,
        pointPrint,
        totalPrice: orders.reduce((sum, order) => sum + Number(order.totalPrice || 0), 0)
      });
      sales
        .filter((sale) => sale.tickets.length && shouldDeliverBoxOfficeTicketsByEmail(sale.order))
        .forEach((sale) => queueTicketEmailDelivery(sale.order.id));
    });
    if (pointPreparation?.pointPaymentId) {
      const paymentId = pointPreparation.pointPaymentId;
      const config = integrationConfigService.resolvedConfig(await readDb(), "mercadoPago") || {};
      let providerPayment = null;
      try {
        providerPayment = await attemptPointCreation(paymentId, config);
      } catch (error) {
        logEvent("warn", "box_office_point_sale.reconnect_required", { paymentId, code: error.code || "POINT_PROVIDER_ERROR" });
      }
      if (providerPayment && (!providerPayment.id || !providerPayment.externalReference
        || providerPayment.externalReference !== (await readDb()).payments.find((item) => item.id === paymentId)?.providerReference)) {
        await recordPointCreateUncertainty(paymentId, { code: "POINT_PROVIDER_MISMATCH" });
        providerPayment = null;
      }
      if (providerPayment) {
        const result = await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const payment = (lockedDb.payments || []).find((item) => item.id === paymentId);
          if (!payment) throw Object.assign(new Error("A intenção Point não foi encontrada."), { code: "POINT_INTENT_MISSING", statusCode: 409 });
          if (providerPayment.amount && Math.abs(Number(providerPayment.amount) - Number(payment.amount)) > 0.01) {
            payment.metadata.pointCreateState = "review_required";
            payment.metadata.reconciliationRequired = true;
            payment.metadata.reconciliationReason = "point_amount_mismatch";
            payment.providerPaymentId = providerPayment.id;
            await writeDb(lockedDb);
            return { mismatch: true };
          }
          if (providerPayment.terminalId && providerPayment.terminalId !== payment.metadata.terminalId) {
            payment.metadata.pointCreateState = "review_required";
            payment.metadata.reconciliationRequired = true;
            payment.metadata.reconciliationReason = "point_terminal_mismatch";
            payment.providerPaymentId = providerPayment.id;
            await writeDb(lockedDb);
            return { mismatch: true };
          }
          payment.providerPaymentId = providerPayment.id;
          payment.metadata.pointCreateState = "known";
          payment.metadata.pointCreateLeaseUntil = "";
          const pointResult = applyPointPaymentStatus(lockedDb, payment, providerPayment);
          const pointPrint = payment.status === "approved" && !pointResult.reconciliationRequired
            ? await queueBoxOfficePointPrint(lockedDb, pointResult.orders, pointResult.tickets, config, {
              batchId: payment.metadata.batchId, paymentMethod: payment.method,
              adminUser: (lockedDb.users || []).find((user) => user.id === pointPreparation.adminUserId)
            })
            : { requested: false, status: "not_requested", message: "" };
          await writeDb(lockedDb);
          return { payment, orders: pointResult.orders, tickets: pointResult.tickets, pointPrint,
            emailOrderIds: pointResult.newlyPaidOrders.filter(shouldDeliverBoxOfficeTicketsByEmail).map((order) => order.id) };
        });
        if (result.mismatch) {
          sendJson(res, 409, { error: { code: "POINT_PAYMENT_MISMATCH", message: "A cobrança retornou dados divergentes. Concilie antes de prosseguir." } });
          return;
        }
        sendJson(res, result.payment.status === "approved" ? 201 : 202, {
          order: result.orders[0], payment: result.payment, orders: result.orders, payments: [result.payment],
          tickets: result.tickets, pointPrint: result.pointPrint, batchId: result.payment.metadata.batchId,
          totalPrice: result.payment.amount,
          point: { status: result.payment.status, providerOrderId: result.payment.providerPaymentId, terminalId: result.payment.metadata.terminalId }
        });
        result.emailOrderIds.forEach(queueTicketEmailDelivery);
        return;
      }
      const pendingDb = await readDb();
      const pendingPayment = (pendingDb.payments || []).find((item) => item.id === paymentId);
      const orders = pointPaymentOrders(pendingDb, pendingPayment);
      sendJson(res, 202, {
        order: orders[0], payment: pendingPayment, orders, payments: [pendingPayment], tickets: [],
        pointPrint: { requested: false, status: "not_requested", message: "" },
        batchId: pendingPayment.metadata.batchId, totalPrice: pendingPayment.amount,
        reconnecting: true, retryAfterMs: 3500,
        point: { status: pendingPayment.status, providerOrderId: "", terminalId: pendingPayment.metadata.terminalId }
      });
    }
    return;
  }

  if (pathname === "/api/tickets/validate" && method === "POST") {
    const body = await readBody(req);
    const validationMode = body.mode === "concessions" ? "concessions" : "entry";
    const inspectConcessions = validationMode === "concessions" && body.action === "inspect";
    const inspectEntry = validationMode === "entry" && body.action === "inspect";
    try {
      const outcome = await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const adminUser = getAdminUser(req, lockedDb);
        const validation = validationMode === "concessions"
          ? inspectConcessions
            ? inspectTicketConcessions(lockedDb, body.code || body.qrPayload)
            : validateTicketConcessions(lockedDb, body.code || body.qrPayload, adminUser)
          : { ticket: inspectEntry
            ? inspectTicket(lockedDb, body.code || body.qrPayload, body.sessionId)
            : validateTicket(lockedDb, body.code || body.qrPayload, adminUser, body.sessionId) };
        const ticket = validation.ticket;
        if (inspectEntry) {
          return {
            payload: {
              ok: true,
              result: "ticket_pending_confirmation",
              confirmationRequired: true,
              ticket: enrichTicket(lockedDb, ticket)
            },
            event: "ticket.inspected",
            fields: { ticketId: ticket.id, orderId: ticket.orderId, inspectedBy: adminUser?.id || "" }
          };
        }
        if (inspectConcessions) {
          return {
            payload: {
              ok: true,
              result: "concessions_pending_confirmation",
              confirmationRequired: true,
              ticket: enrichTicket(lockedDb, ticket),
              concessions: validation.concessions.map((item) => ({
                ...item,
                quantity: Math.max(0, Number(item.quantity || 0) - Number(item.fulfilledQuantity || 0))
              }))
            },
            event: "concessions.inspected",
            fields: {
              ticketId: ticket.id,
              orderIds: validation.orders.map((order) => order.id),
              inspectedBy: adminUser?.id || "",
              items: validation.concessions.length
            }
          };
        }
        lockedDb.auditLogs ||= [];
        lockedDb.auditLogs.push({
          id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          entityType: "ticket_validation",
          entityId: ticket.id,
          action: validationMode === "concessions" ? "concessions.fulfilled" : "ticket.validated",
          updatedBy: adminUser?.id || "",
          updatedByEmail: adminUser?.email || "",
          at: new Date().toISOString(),
          before: null,
          after: {
            ticketId: ticket.id,
            orderId: ticket.orderId,
            operatorId: adminUser?.id || "",
            validatedAt: validationMode === "concessions" ? validation.fulfilledAt : ticket.usedAt,
            result: validationMode === "concessions" ? "concessions_fulfilled" : "validated",
            concessions: validationMode === "concessions"
              ? validation.concessions.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }))
              : []
          }
        });
        await writeDb(lockedDb);
        if (validationMode === "concessions") {
          return {
            payload: {
              ok: true,
              result: "concessions_fulfilled",
              ticket: enrichTicket(lockedDb, ticket),
              concessions: validation.concessions
            },
            event: "concessions.fulfilled",
            fields: {
              ticketId: ticket.id,
              orderId: ticket.orderId,
              fulfilledBy: adminUser?.id || "",
              items: validation.concessions.length
            }
          };
        }
        return {
          payload: { ok: true, result: "valid", ticket: enrichTicket(lockedDb, ticket) },
          event: "ticket.used",
          fields: { ticketId: ticket.id, orderId: ticket.orderId, usedBy: ticket.usedBy }
        };
      });
      logEvent("info", outcome.event, outcome.fields);
      sendJson(res, 200, outcome.payload);
    } catch (error) {
      try {
        await withCriticalMutation(async () => {
          const lockedDb = await readDb();
          const adminUser = getAdminUser(req, lockedDb);
          const failedTicketId = error.ticket?.id || "";
          const result = error.code === "TICKET_ALREADY_USED" ? "used"
            : error.code === "CONCESSIONS_ALREADY_FULFILLED" ? "concessions_already_fulfilled"
            : error.code === "ORDER_WITHOUT_CONCESSIONS" ? "without_concessions"
            : error.code === "TICKET_EXPIRED" ? "expired"
            : error.code === "TICKET_SESSION_MISMATCH" ? "wrong_session"
            : "invalid";
          lockedDb.auditLogs ||= [];
          lockedDb.auditLogs.push({
            id: `audit-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
            entityType: "ticket_validation",
            entityId: failedTicketId,
            action: validationMode === "concessions" ? "concessions.validation_denied" : "ticket.validation_denied",
            updatedBy: adminUser?.id || "",
            updatedByEmail: adminUser?.email || "",
            at: new Date().toISOString(),
            before: null,
            after: {
              ticketId: failedTicketId,
              operatorId: adminUser?.id || "",
              validatedAt: new Date().toISOString(),
              result,
              validationMode,
              expectedSessionId: error.expectedSessionId || String(body.sessionId || ""),
              actualSessionId: error.actualSessionId || error.ticket?.sessionId || "",
              code: error.code || "TICKET_VALIDATION_FAILED",
              message: error.message,
              payloadPreview: String(body.code || body.qrPayload || "").slice(0, 80)
            }
          });
          await writeDb(lockedDb);
        });
      } catch {
        // A falha de auditoria nao deve mascarar o motivo real da validacao.
      }
      sendJson(res, error.statusCode || 400, {
        ok: false,
        result: error.code === "TICKET_ALREADY_USED" ? "used"
          : error.code === "CONCESSIONS_ALREADY_FULFILLED" ? "concessions_already_fulfilled"
          : error.code === "ORDER_WITHOUT_CONCESSIONS" ? "without_concessions"
          : error.code === "TICKET_EXPIRED" ? "expired"
          : error.code === "TICKET_SESSION_MISMATCH" ? "wrong_session"
          : "invalid",
        error: {
          code: error.code || "TICKET_VALIDATION_FAILED",
          message: error.message
        },
        ticket: error.ticket ? enrichTicket(db, error.ticket) : null,
        concessions: error.concessions || []
      });
    }
    return;
  }

  if (pathname === "/api/webhooks/pag-bank" && method === "POST") {
    await readBody(req, { rawOnly: true });
    const providerConfig = integrationConfigService.resolvedConfig(db, "pagBank") || {};
    const webhookAuth = await pagBankPaymentService.verifyOrderWebhook(req, providerConfig, {
      allowUnsignedSandboxHint: providerConfig.environment === "sandbox"
    });
    let body;
    try {
      body = JSON.parse(req.rawBody);
    } catch {
      throw Object.assign(new Error("JSON inválido. Revise o corpo da notificação PagBank."), { code: "INVALID_JSON", statusCode: 400 });
    }
    const { chargeId: signedChargeId, orderId: providerOrderId } = pagBankPaymentService.resolveWebhookOrder(body, db.payments || []);
    if (!/^ORDE_[A-Za-z0-9-]+$/.test(providerOrderId)) {
      sendJson(res, signedChargeId ? 503 : 200, { ok: !signedChargeId, processed: false, reason: signedChargeId ? "charge_not_recorded" : "unknown_event" });
      return;
    }
    if (!webhookAuth.verified) {
      const knownPayment = (db.payments || []).find((item) => item.provider === "pag_bank" && item.providerPaymentId === providerOrderId);
      const knownOrder = knownPayment && (db.orders || []).find((item) => item.id === knownPayment.orderId);
      if (!knownPayment || !knownOrder || (signedChargeId && knownPayment.metadata?.transactionId !== signedChargeId)) {
        sendJson(res, 404, { ok: false, processed: false, reason: "untrusted_sandbox_hint_without_matching_order" });
        return;
      }
      logEvent("warn", "webhook.pag_bank_unsigned_sandbox_hint", { orderId: knownOrder.id, providerOrderId });
    }
    const eventId = crypto.createHash("sha256").update(req.rawBody).digest("hex");
    const providerStatus = await pagBankPaymentService.fetchOrder(providerOrderId, providerConfig);
    if (!providerStatus || providerStatus.id !== providerOrderId || (signedChargeId && providerStatus.transactionId !== signedChargeId)) {
      throw Object.assign(new Error("O pedido informado pelo webhook não pôde ser confirmado no PagBank."), { code: "PAGBANK_ORDER_LOOKUP_FAILED", statusCode: 503 });
    }
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      lockedDb.webhookEvents ||= [];
      if (lockedDb.webhookEvents.some((event) => event.provider === "pag_bank" && event.eventId === eventId)) {
        sendJson(res, 200, { ok: true, duplicate: true });
        return;
      }
      const payment = (lockedDb.payments || []).find((item) => item.provider === "pag_bank" && item.providerPaymentId === providerOrderId);
      const order = payment && (lockedDb.orders || []).find((item) => item.id === payment.orderId);
      if (!payment || !order) {
        sendJson(res, 503, { error: { code: "PAGBANK_ORDER_NOT_RECORDED", message: "Pedido ainda não persistido; o PagBank pode reenviar a notificação." } });
        return;
      }
      if (!mercadoPagoReferenceMatches(payment, providerStatus.externalReference)
        || !providerStatus.externalReference
        || Math.abs(Number(providerStatus.amount) - Number(payment.amount)) > 0.01) {
        logEvent("error", "webhook.pag_bank_mismatch", { orderId: order.id, providerOrderId });
        sendJson(res, 409, { error: { code: "PAGBANK_PAYMENT_MISMATCH", message: "Referência ou valor do pedido não confere." } });
        return;
      }
      const wasPaid = order.status === "paid";
      payment.status = paymentStatusAfterWebhook(payment.status, providerStatus.status);
      payment.updatedAt = new Date().toISOString();
      payment.metadata = { ...(payment.metadata || {}), providerStatus: providerStatus.raw || null, lastWebhookAt: payment.updatedAt };
      if (payment.status === "approved") payment.approvedAt ||= payment.updatedAt;
      if (payment.status === "refunded") payment.refundedAt ||= payment.updatedAt;
      let tickets = [];
      if (payment.status === "approved" && ["pending_payment", "paid"].includes(order.status)) {
        tickets = finalizePaidOrder(lockedDb, order, payment, "online");
        if (!wasPaid && tickets.length) consumePendingClubCredit(lockedDb, order, tickets, order.customerUserId);
      } else if (payment.status === "approved" && order.status === "expired") {
        order.latePaymentReview = { provider: "pag_bank", detectedAt: payment.updatedAt, amount: payment.amount };
        logEvent("error", "payment.late_after_reservation_expired", { orderId: order.id, providerOrderId, amount: payment.amount });
      } else if (payment.status === "approved" && ["cancelled", "refunded"].includes(order.status)) {
        order.latePaymentReview = { provider: "pag_bank", detectedAt: payment.updatedAt, amount: payment.amount };
        logEvent("error", "payment.approved_after_order_cancelled", { orderId: order.id, providerOrderId, amount: payment.amount });
      } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status) && order.status !== "paid") {
        releaseConcessionReservation(lockedDb, order);
        order.status = payment.status === "refunded" ? "refunded" : payment.status === "rejected" ? "cancelled" : payment.status;
        order.paymentStatus = payment.status;
      }
      lockedDb.webhookEvents.push({ provider: "pag_bank", eventId, providerPaymentId: providerOrderId, orderId: order.id, status: payment.status, verified: true, createdAt: payment.updatedAt });
      await writeDb(lockedDb);
      if (order.sessionId) seatRealtimeService?.broadcastSessionRefresh(order.sessionId);
      if (!wasPaid && tickets.length) queueTicketEmailDelivery(order.id);
      sendJson(res, 200, { ok: true, processed: true, status: payment.status, ticketsCreated: tickets.length });
    });
    return;
  }

  if (pathname === "/api/webhooks/mercado-pago" && method === "POST") {
    const body = await readBody(req);
    const provider = "mercado_pago";
    const webhookUrl = new URL(req.url, `http://${req.headers.host}`);
    const providerConfig = integrationConfigService.resolvedConfig(db, "mercadoPago");
    const receivedContext = webhookSafeLogContext(req, webhookUrl, body);
    logEvent("info", "webhook.mercado_pago.received", receivedContext);
    let verification;
    try {
      verification = paymentService.verifyWebhookRequest(provider, req, webhookUrl, body, providerConfig || {});
    } catch (error) {
      logEvent("warn", "webhook.mercado_pago.rejected", {
        ...receivedContext,
        validation: "rejected",
        reason: error.code || "MERCADO_PAGO_WEBHOOK_INVALID_SIGNATURE"
      });
      throw error;
    }
    logEvent("info", "webhook.mercado_pago.validated", {
      ...receivedContext,
      validation: "approved"
    });
    const signedOrderStatus = paymentService.normalizeMercadoPagoWebhookOrder(body);
    const providerPaymentId = String(verification.dataId || signedOrderStatus?.id || body.data?.id || body.providerPaymentId || body.paymentId || "");
    const orderId = String(body.orderId || body.externalReference || body.external_reference || signedOrderStatus?.externalReference || body.data?.external_reference || body.reference || "");
    let eventId = mercadoPagoWebhookEventId(body, verification);
    const webhookAction = mercadoPagoWebhookAction(body);
    const webhookTopic = String([
      webhookUrl.searchParams.get("type"),
      webhookUrl.searchParams.get("topic"),
      body.type,
      body.topic,
      body.action
    ].filter(Boolean).join(" ")).toLowerCase();

    if (!providerPaymentId && !orderId) {
      logEvent("info", "webhook.accepted_without_reference", {
        provider,
        eventId,
        topic: webhookTopic || "unknown",
        verified: verification.verified
      });
      sendJson(res, 200, { ok: true, accepted: true, processed: false });
      return;
    }

    const isAuthorizedPaymentEvent = /subscription_authorized_payment|authorized_payment/.test(webhookTopic);
    const isSubscriptionEvent = /preapproval|subscription|authorized_payment/.test(webhookTopic);
    if (!isSubscriptionEvent && !MERCADO_PAGO_ORDER_ACTIONS.has(webhookAction)) {
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        const duplicate = lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId);
        if (!duplicate) {
          lockedDb.webhookEvents.push({
            provider,
            eventId,
            providerPaymentId,
            orderId,
            requestId: verification.requestId,
            action: webhookAction,
            status: "ignored_unknown_event",
            verified: true,
            createdAt: new Date().toISOString()
          });
          await writeDb(lockedDb);
        }
        logEvent("info", "webhook.mercado_pago.ignored", { eventId, action: webhookAction, providerPaymentId, duplicate });
        sendJson(res, 200, {
          ok: true,
          accepted: true,
          processed: false,
          duplicate,
          processing: { recognized: false, orderLocated: false, stateUpdated: false }
        });
      });
      return;
    }

    if (provider === "mercado_pago" && isSubscriptionEvent) {
      const authorizedPayment = isAuthorizedPaymentEvent
        ? await paymentService.fetchMercadoPagoAuthorizedPayment(providerPaymentId, providerConfig || {})
        : null;
      const effectiveProviderSubscriptionId = authorizedPayment?.preapprovalId || providerPaymentId;
      const providerSubscription = effectiveProviderSubscriptionId
        ? await subscriptionPaymentProvider.getSubscription(effectiveProviderSubscriptionId, providerConfig || {})
        : null;
      if ((isAuthorizedPaymentEvent && !authorizedPayment) || !providerSubscription) {
        sendJson(res, 503, { error: { code: "SUBSCRIPTION_LOOKUP_FAILED", message: "A assinatura ainda não pôde ser confirmada no Mercado Pago. Reenvie a notificação." } });
        return;
      }
      await withCriticalMutation(async () => {
        const lockedDb = await readDb();
        if (lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId)) {
          logEvent("info", "webhook.subscription.duplicate", { provider, eventId, providerPaymentId });
          sendJson(res, 200, { ok: true, duplicate: true, processing: { recognized: true, stateUpdated: false } });
          return;
        }
        const subscription = (lockedDb.subscriptions || []).find((item) =>
          item.provider === "mercado_pago" &&
          (
            item.providerSubscriptionId === effectiveProviderSubscriptionId
            || item.id === providerSubscription?.externalReference
            || item.id === authorizedPayment?.externalReference
          )
        );
        if (!subscription) {
          logEvent("info", "webhook.subscription.not_found", { provider, eventId, providerPaymentId, verified: verification.verified });
          sendJson(res, 503, { error: { code: "SUBSCRIPTION_NOT_RECORDED", message: "Assinatura ainda não persistida; reenvie a notificação." } });
          return;
        }
        if (isAuthorizedPaymentEvent) {
          const paymentApproved = authorizedPayment?.paymentStatus === "approved";
          if (paymentApproved) {
            applyMercadoPagoSubscriptionStatus(lockedDb, subscription, {
              ...(providerSubscription || {}),
              id: effectiveProviderSubscriptionId,
              status: "authorized",
              localStatus: "active"
            }, "mercado_pago_authorized_payment_webhook", {
              paymentApproved: true,
              payment: {
                provider: "mercado_pago",
                providerPaymentId: authorizedPayment?.paymentId || authorizedPayment?.id || providerPaymentId,
                amount: authorizedPayment?.amount || (lockedDb.subscriptionPlans || []).find((item) => item.id === subscription.planId)?.monthlyPrice || 0,
                currency: "BRL",
                approvedAt: authorizedPayment?.approvedAt || new Date().toISOString(),
                metadata: { authorizedPaymentId: authorizedPayment?.id || providerPaymentId }
              }
            });
          } else if (["rejected", "cancelled", "refunded", "expired"].includes(authorizedPayment?.paymentStatus || "")) {
            applyMercadoPagoSubscriptionStatus(lockedDb, subscription, {
              ...(providerSubscription || {}),
              id: effectiveProviderSubscriptionId,
              status: "payment_failed",
              localStatus: "payment_failed"
            }, "mercado_pago_authorized_payment_webhook", { paymentApproved: false });
          } else {
            subscription.paymentStatus = "pending";
            subscription.updatedAt = new Date().toISOString();
          }
          subscription.lastAuthorizedPaymentId = authorizedPayment?.id || providerPaymentId;
          subscription.lastProviderPaymentId = authorizedPayment?.paymentId || "";
        } else {
          const providerAuthorizationApproved = providerSubscription?.localStatus === "active";
          applyMercadoPagoSubscriptionStatus(lockedDb, subscription, providerSubscription || {
            id: effectiveProviderSubscriptionId,
            status: body.status || body.action || "pending"
          }, "mercado_pago_webhook", {
            paymentApproved: providerAuthorizationApproved || subscription.paymentStatus === "approved"
          });
        }
        lockedDb.webhookEvents.push({
          provider,
          eventId,
          providerPaymentId,
          orderId: "",
          subscriptionId: subscription.id,
          authorizedPaymentId: authorizedPayment?.id || "",
          status: subscription.status,
          verified: verification.verified,
          createdAt: new Date().toISOString()
        });
        await writeDb(lockedDb);
        logEvent("info", "webhook.subscription.processed", { provider, eventId, providerPaymentId, subscriptionId: subscription.id, status: subscription.status, verified: verification.verified });
        sendJson(res, 200, { ok: true, processed: true, processing: { recognized: true, subscriptionLocated: true, stateUpdated: true, status: subscription.status } });
      });
      return;
    }

    // The HMAC covers the resource ID, not the status or amount in the webhook body.
    const simulated = mercadoPagoSimulatedOrders.get(providerPaymentId);
    const localRequest = ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(String(req.socket.remoteAddress || ""));
    const providerStatus = localRequest && simulated?.expiresAt > Date.now()
      ? simulated.order
      : localRequest && !isProduction() && process.env.PAYMENTS_MODE === "test"
        ? signedOrderStatus
        : await paymentService.fetchMercadoPagoWebhookOrder(providerPaymentId, providerConfig || {});
    if (!providerStatus || String(providerStatus.id).toLowerCase() !== providerPaymentId.toLowerCase()) {
      sendJson(res, 503, { error: { code: "MERCADO_PAGO_WEBHOOK_LOOKUP_FAILED", message: "O pedido notificado ainda não pôde ser confirmado. Reenvie a notificação." } });
      return;
    }
    eventId = crypto.createHash("sha256").update(JSON.stringify({
      provider,
      id: providerStatus.id,
      status: providerStatus.status,
      detail: providerStatus.statusDetail,
      amount: providerStatus.amount,
      reference: providerStatus.externalReference
    })).digest("hex");
    const webhookOutcome = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      if (lockedDb.webhookEvents.some((event) => event.provider === provider && event.eventId === eventId)) {
        logEvent("info", "webhook.duplicate", { provider, eventId, providerPaymentId });
        return {
          status: 200,
          payload: {
            ok: true,
            duplicate: true,
            processed: false,
            processing: { recognized: true, orderLocated: true, stateUpdated: false }
          }
        };
      }

      const effectiveOrderId = providerStatus.externalReference || "";
      const payment = lockedDb.payments.find((item) =>
        item.provider === provider &&
        (String(item.providerPaymentId || "").toLowerCase() === providerPaymentId.toLowerCase()
          || (item.metadata?.kind === "point_sale" && !item.providerPaymentId && item.providerReference === effectiveOrderId))
      );
      if (!payment) {
        logEvent("info", "webhook.payment.not_found", { provider, eventId, providerPaymentId, orderId: effectiveOrderId, verified: verification.verified });
        return { status: 503, payload: { error: { code: "PAYMENT_NOT_RECORDED", message: "Pagamento ainda não persistido; reenvie a notificação." } } };
      }

      const isClubSubscriptionPayment = payment.metadata?.kind === "club_subscription";
      const isPointPayment = payment.metadata?.kind === "point_sale";
      const order = isClubSubscriptionPayment ? null : lockedDb.orders.find((item) => item.id === payment.orderId);
      if (providerPaymentId && payment.providerPaymentId !== providerPaymentId && providerStatus.id) {
        payment.metadata = { ...(payment.metadata || {}), previousProviderPaymentId: payment.providerPaymentId };
        payment.providerPaymentId = providerStatus.id;
      }
      if ((providerStatus.status === "approved" && !providerStatus.externalReference)
        || !mercadoPagoReferenceMatches(payment, providerStatus.externalReference)) {
        return {
          status: 409,
          payload: {
            error: {
              code: "PAYMENT_REFERENCE_MISMATCH",
              message: "Referencia externa do pagamento nao confere com o pedido."
            }
          }
        };
      }
      if (providerStatus?.externalReference) payment.providerReference = providerStatus.externalReference;
      if ((providerStatus.status === "approved" && (!Number.isFinite(Number(providerStatus.amount)) || Number(providerStatus.amount) <= 0))
        || (providerStatus.amount && Math.round(Number(providerStatus.amount) * 100) !== Math.round(Number(payment.amount) * 100))) {
        return {
          status: 409,
          payload: {
            error: {
              code: "PAYMENT_AMOUNT_MISMATCH",
              message: "Valor confirmado pelo provedor nao confere com o pedido."
            }
          }
        };
      }

      const nextStatus = providerStatus.status;
      payment.metadata = { ...(payment.metadata || {}), lastWebhookAt: new Date().toISOString(), verification, providerStatus: providerStatus.raw || null };
      payment.status = paymentStatusAfterWebhook(payment.status, nextStatus);
      payment.updatedAt = new Date().toISOString();
      if (payment.status === "approved") payment.approvedAt = payment.approvedAt || new Date().toISOString();
      if (payment.status === "expired") payment.expiredAt = payment.expiredAt || new Date().toISOString();
      if (payment.status === "cancelled") payment.cancelledAt = payment.cancelledAt || new Date().toISOString();
      if (payment.status === "refunded") payment.refundedAt = payment.refundedAt || new Date().toISOString();
      if (payment.metadata?.cancellationRefund) {
        await writeDb(lockedDb);
        return { status: 200, payload: { received: true, refundPending: payment.metadata.cancellationRefund.status !== "completed" } };
      }
      let tickets = [];
      let subscription = null;
      const emailDeliveryOrderIds = [];
      if (isClubSubscriptionPayment) {
        subscription = (lockedDb.subscriptions || []).find((item) => item.id === payment.metadata?.subscriptionId) || null;
        if (payment.status === "approved") {
          activateSubscriptionFromPayment(lockedDb, subscription, payment);
        } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status)) {
          failSubscriptionFromPayment(lockedDb, subscription, payment, payment.status);
        }
      } else if (isPointPayment) {
        const pointResult = applyPointPaymentStatus(lockedDb, payment, {
          ...(providerStatus || {}),
          status: payment.status
        });
        tickets = pointResult.tickets;
        emailDeliveryOrderIds.push(...pointResult.newlyPaidOrders
          .filter((paidOrder) => shouldDeliverBoxOfficeTicketsByEmail(paidOrder))
          .map((paidOrder) => paidOrder.id));
        if (payment.status === "approved") {
          const pointConfig = integrationConfigService.resolvedConfig(lockedDb, "mercadoPago") || {};
          await queueBoxOfficePointPrint(lockedDb, pointResult.orders, tickets, pointConfig, {
            batchId: payment.metadata?.batchId,
            paymentMethod: payment.method
          });
        }
      } else if (payment.status === "approved" && order?.status === "expired") {
        order.latePaymentReview = { provider, detectedAt: payment.updatedAt, amount: payment.amount };
        logEvent("error", "payment.late_after_reservation_expired", { orderId: order.id, providerPaymentId, amount: payment.amount });
      } else if (payment.status === "approved" && ["cancelled", "refunded"].includes(order?.status || "")) {
        order.latePaymentReview = { provider, detectedAt: payment.updatedAt, amount: payment.amount };
        logEvent("error", "payment.approved_after_order_cancelled", { orderId: order.id, providerPaymentId, amount: payment.amount });
      } else if (payment.status === "approved" && ["pending_payment", "paid"].includes(order?.status || "")) {
        const wasAlreadyPaid = order?.status === "paid";
        tickets = finalizePaidOrder(lockedDb, order, payment, "online");
        if (!wasAlreadyPaid && tickets.length) consumePendingClubCredit(lockedDb, order, tickets, order?.customerUserId);
        if (!wasAlreadyPaid && tickets.length) emailDeliveryOrderIds.push(order.id);
      } else if (["expired", "cancelled", "rejected", "refunded"].includes(payment.status) && order?.status !== "paid") {
        releaseConcessionReservation(lockedDb, order);
        order.status = payment.status === "refunded" ? "refunded" : payment.status === "rejected" ? "cancelled" : payment.status;
        order.paymentStatus = payment.status;
      }

      lockedDb.webhookEvents.push({
        provider,
        eventId,
        providerPaymentId,
        orderId: payment.orderId,
        requestId: verification.requestId,
        action: webhookAction,
        status: payment.status,
        subscriptionId: subscription?.id || "",
        verified: verification.verified,
        createdAt: new Date().toISOString()
      });
      await writeDb(lockedDb);
      return {
        status: 200,
        sessionId: order?.sessionId,
        emailDeliveryOrderIds,
        log: { provider, eventId, providerPaymentId, orderId: payment.orderId, status: payment.status, tickets: tickets.length, verified: verification.verified },
        payload: {
          ok: true,
          processed: true,
          processing: {
            recognized: true,
            orderLocated: Boolean(order),
            stateUpdated: true,
            status: payment.status,
            ticketsCreated: tickets.length
          }
        }
      };
    });
    if (webhookOutcome.sessionId) seatRealtimeService?.broadcastSessionRefresh(webhookOutcome.sessionId);
    if (webhookOutcome.log) logEvent("info", "webhook.processed", webhookOutcome.log);
    sendJson(res, webhookOutcome.status, webhookOutcome.payload);
    webhookOutcome.emailDeliveryOrderIds?.forEach(queueTicketEmailDelivery);
    return;
  }

  if (await handleAdminOrderListRead({ req, res, pathname, method, db })) return;

  const permanentOrderDeleteMatch = pathname.match(/^\/api\/orders\/([^/]+)\/permanent$/);
  if (permanentOrderDeleteMatch && method === "DELETE") {
    const orderId = decodeURIComponent(permanentOrderDeleteMatch[1]);
    const body = await readBody(req);
    const result = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const deletion = permanentlyDeleteOrder(lockedDb, orderId, body, req.adminUser);
      await writeDb(lockedDb);
      return deletion;
    });
    sendJson(res, 200, result);
    return;
  }

  const adminOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  const orderResendEmailMatch = pathname.match(/^\/api\/orders\/([^/]+)\/resend-ticket-email$/);
  if (orderResendEmailMatch && method === "POST") {
    const orderId = decodeURIComponent(orderResendEmailMatch[1]);
    const outcome = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const order = (lockedDb.orders || []).find((item) => item.id === orderId);
      if (!order) {
        return { status: 404, payload: { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } } };
      }
      const tickets = orderTickets(lockedDb, order.id);
      if (order.status !== "paid" || !tickets.length) {
        return { status: 409, payload: { error: { code: "ORDER_NOT_DELIVERABLE", message: "Somente pedidos pagos com ingressos emitidos podem ser reenviados." } } };
      }
      const delivered = await deliverTicketsByEmail(lockedDb, order, tickets);
      await writeDb(lockedDb);
      return { status: 200, payload: { ok: delivered, emailDeliveredAt: order.emailDeliveredAt || "" } };
    });
    sendJson(res, outcome.status, outcome.payload);
    return;
  }

  const orderRefundTicketsMatch = pathname.match(/^\/api\/orders\/([^/]+)\/refund-tickets$/);
  if (orderRefundTicketsMatch && method === "POST") {
    if (!ensureAdminAction(req, res, "orders.refund", "Esta conta não pode reembolsar ingressos.")) return;
    const orderId = decodeURIComponent(orderRefundTicketsMatch[1]);
    const body = await readBody(req);
    sendJson(res, 200, await refundOrderTickets(orderId, body.reason, req.adminUser));
    return;
  }

  const orderRefundConcessionsMatch = pathname.match(/^\/api\/orders\/([^/]+)\/refund-concessions$/);
  if (orderRefundConcessionsMatch && method === "POST") {
    if (!ensureAdminAction(req, res, "orders.refund", "Esta conta não pode reembolsar itens de bomboniere.")) return;
    const orderId = decodeURIComponent(orderRefundConcessionsMatch[1]);
    const body = await readBody(req);
    sendJson(res, 200, await refundOrderConcessions(orderId, body.reason, req.adminUser));
    return;
  }

  if (await handleAdminOrderDetailRead({ req, res, pathname, method, db, adminOrderMatch })) return;

  if (adminOrderMatch && method === "PATCH") {
    const orderId = decodeURIComponent(adminOrderMatch[1]);
    const body = await readBody(req);
    if (["archive", "unarchive"].includes(body.action)
      && !ensureAdminAction(req, res, "orders.archive", "Esta conta não pode arquivar ou restaurar pedidos.")) return;
    if (body.action === "cancel") {
      if (!ensureAdminAction(req, res, "orders.cancel", "Esta conta não pode cancelar pedidos.")) return;
      const currentOrder = (db.orders || []).find((item) => item.id === orderId);
      if (currentOrder && isOrderFinanciallySettled(currentOrder, orderPayment(db, orderId))
        && !ensureAdminAction(req, res, "orders.refund", "O cancelamento exige reembolso e esta conta não possui essa permissão.")) return;
      sendJson(res, 200, await cancelOrderWithRefund(orderId, body.reason, req.adminUser));
      return;
    }
    if (body.action === "refund_tickets") {
      if (!ensureAdminAction(req, res, "orders.refund", "Esta conta não pode reembolsar ingressos.")) return;
      sendJson(res, 200, await refundOrderTickets(orderId, body.reason, req.adminUser));
      return;
    }
    if (body.action === "refund_concessions") {
      if (!ensureAdminAction(req, res, "orders.refund", "Esta conta não pode reembolsar itens de bomboniere.")) return;
      sendJson(res, 200, await refundOrderConcessions(orderId, body.reason, req.adminUser));
      return;
    }
    if (!ensureAdminAction(req, res, "orders.edit", "Esta conta pode consultar pedidos, mas não pode alterá-los.")) return;
    if (postgresEnabled() && !["cancel"].includes(body.action)) {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return;
      }
      const before = structuredCloneSafe(order);
      const expectedRowVersion = order.rowVersion;
      if (body.action === "archive") archiveOrder(order, body.reason, req.adminUser);
      else if (body.action === "unarchive") unarchiveOrder(order, body.reason, req.adminUser);
      else safeOrderUpdate(order, body, req.adminUser);
      const saved = await orderRepository.update(order, {}, {
        expectedRowVersion,
        operation: body.action || "edit",
        audit: {
          userId: req.adminUser?.id,
          action: `order.${body.action || "updated"}`,
          entityType: "order",
          entityId: order.id,
          before,
          after: order,
          ip: clientIp(req)
        }
      });
      const currentDb = await readDb();
      sendJson(res, 200, {
        order: saved,
        payment: orderPayment(currentDb, saved.id),
        tickets: orderTickets(currentDb, saved.id).map((ticket) => enrichTicket(currentDb, ticket))
      });
      return;
    }
    await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const order = (lockedDb.orders || []).find((item) => item.id === orderId);
      if (!order) {
        sendJson(res, 404, { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } });
        return;
      }
      if (body.action === "cancel") {
        cancelOrder(lockedDb, order, body.reason, req.adminUser);
      } else if (body.action === "archive") {
        archiveOrder(order, body.reason, req.adminUser);
      } else if (body.action === "unarchive") {
        unarchiveOrder(order, body.reason, req.adminUser);
      } else {
        safeOrderUpdate(order, body, req.adminUser);
      }
      await writeDb(lockedDb);
      if (body.action === "cancel") {
        await broadcastReleasedOrderSeats(order);
      }
      sendJson(res, 200, {
        order,
        payment: orderPayment(lockedDb, order.id),
        tickets: orderTickets(lockedDb, order.id).map((ticket) => enrichTicket(lockedDb, ticket))
      });
    });
    return;
  }

  if (adminOrderMatch && method === "DELETE") {
    const orderId = decodeURIComponent(adminOrderMatch[1]);
    const body = await readBody(req);
    const currentOrder = (db.orders || []).find((item) => item.id === orderId);
    if (currentOrder && !removableDraftOrder(currentOrder, orderPayment(db, orderId), orderTickets(db, orderId))) {
      if (!ensureAdminAction(req, res, "orders.cancel", "Esta conta não pode cancelar pedidos.")) return;
      if (isOrderFinanciallySettled(currentOrder, orderPayment(db, orderId))
        && !ensureAdminAction(req, res, "orders.refund", "O cancelamento exige reembolso e esta conta não possui essa permissão.")) return;
      sendJson(res, 200, { deleted: false, ...await cancelOrderWithRefund(orderId, body.reason, req.adminUser) });
      return;
    }
    const deletion = await withCriticalMutation(async () => {
      const lockedDb = await readDb();
      const index = (lockedDb.orders || []).findIndex((item) => item.id === orderId);
      if (index === -1) {
        return { status: 404, payload: { error: { code: "ORDER_NOT_FOUND", message: "Pedido nao encontrado." } } };
      }
      const order = lockedDb.orders[index];
      const payment = orderPayment(lockedDb, order.id);
      const tickets = orderTickets(lockedDb, order.id);
      if (removableDraftOrder(order, payment, tickets)) {
        lockedDb.orders.splice(index, 1);
        await writeDb(lockedDb);
        return { status: 200, payload: { deleted: true, orderId }, releasedOrder: order };
      }
      throw refundError("ORDER_CHANGED", "O pedido mudou durante a operacao. Atualize e solicite o cancelamento novamente.");
    });
    if (deletion.releasedOrder) await broadcastReleasedOrderSeats(deletion.releasedOrder)
      .catch((error) => logEvent("warn", "seat_realtime.release_failed", { orderId, message: error.message }));
    sendJson(res, deletion.status, deletion.payload);
    return;
  }

  if (pathname === "/api/orders" && method === "POST") {
    sendJson(res, 410, { error: { code: "ENDPOINT_REMOVED", message: "Use um fluxo de pagamento autenticado para criar pedidos." } });
    return;
  }

  sendJson(res, 404, { error: "Rota nao encontrada" });
}


const performanceMonitor = createPerformanceMonitor({
  diskPath: ROOT,
  onAlert: logEvent,
  onSample: broadcastPerformanceSnapshot,
  intervalMs: 1000
});
function suspiciousRequestRule(url) {
  let target = `${url.pathname}?${url.searchParams.toString()}`;
  try { target = decodeURIComponent(target); } catch {}
  const signatures = [
    ["sqli.union_select", /\bunion\b[\s/+-]+\bselect\b/i],
    ["sqli.boolean_condition", /(?:\b(or|and)\b\s+['"\d]+\s*=\s*['"\d]+|\b(or|and)\b\s+1\s*=\s*1\b)/i],
    ["sqli.time_function", /\b(sleep|benchmark|pg_sleep)\s*\(/i],
    ["sqli.stacked_statement", /;\s*(select|insert|update|delete|drop|alter)\b/i],
    ["sqli.comment_probe", /(?:--|\/\*|\bload_file\s*\()/i]
  ];
  const match = signatures.find(([, pattern]) => pattern.test(target));
  if (match) return { attackType: "possible_sql_injection", rule: match[0] };
  if (/\/(?:\.env|\.git|wp-admin|wp-login\.php|phpmyadmin)(?:\/|$)/i.test(url.pathname)) {
    return { attackType: "common_exploit_probe", rule: "path.common_exploit_probe" };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const store = {
    req,
    pathname,
    method: req.method,
    requestId: crypto.randomUUID(),
    startedAt: Date.now()
  };
  res.once("finish", () => {
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/admin/logs")) {
      performanceMonitor.record(Date.now() - store.startedAt, res.statusCode, {
        method: req.method,
        path: pathname
      });
    }
    if (!pathname.startsWith("/api/") || pathname.startsWith("/api/admin/logs")) return;
    const durationMs = Date.now() - store.startedAt;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    discordWebhookService.enqueue({
      level,
      event: "http.request.completed",
      requestId: store.requestId,
      timestamp: new Date().toISOString(),
      fields: { method: req.method, path: pathname, statusCode: res.statusCode, durationMs }
    });
    if (!postgresEnabled()) return;
    void appendSystemLogToPostgres({
      level,
      category: "http",
      event: "http.request.completed",
      message: `${req.method} ${pathname} respondeu ${res.statusCode}`,
      requestId: store.requestId,
      actorUserId: store.adminUser?.id || store.customerUser?.id || "",
      actorEmail: store.adminUser?.email || store.customerUser?.email || "",
      method: req.method,
      path: pathname,
      statusCode: res.statusCode,
      durationMs,
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
      metadata: { statusCode: res.statusCode, durationMs },
      createdAt: new Date().toISOString()
    }).catch((error) => console.error(JSON.stringify({ level: "error", event: "system_log.request_persist_failed", message: error.message })));
  });
  requestContext.run(store, async () => {
    try {
      const securitySignal = suspiciousRequestRule(url);
      if (securitySignal) {
        logEvent("warn", "security.suspicious_request", {
          ...securitySignal,
          method: req.method,
          path: pathname
        });
      }

      if (/^\/(?:api\/admin\/whatsapp|admin\/whatsapp|whatsapp)(?:\/|$)/.test(pathname.replace(/\/{2,}/g, "/"))) {
        sendJson(res, 410, { error: { code: "MODULE_REMOVED", message: "Este módulo foi removido." } });
        return;
      }

      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname);
        return;
      }

      if (pathname === "/admin") {
        res.writeHead(308, {
          ...securityHeaders(),
          Location: adminPathForRequest(req, "/")
        });
        res.end();
        return;
      }

      if (pathname === "/" || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/images/") || pathname.startsWith("/trailers/") || stripPublicAssetBase(pathname).startsWith("/uploads/")) {
        await serveStatic(req, res, pathname === "/" ? "/admin" : pathname);
        return;
      }

      sendJson(res, 404, { error: "Nao encontrado" });
    } catch (error) {
      const publicError = publicApiError(error, store.requestId);
      const status = publicError.status;
      logEvent(status >= 500 ? "error" : "warn", "request.failed", {
        status,
        code: error.code || "REQUEST_ERROR",
        errorType: error.name || "Error",
        cause: error.cause?.message || "",
        message: error.message
      });
      sendJson(res, status, {
        error: {
          code: publicError.code,
          message: publicError.message,
          requestId: publicError.requestId
        },
        ...(isProduction() ? {} : { detail: error.message })
      });
    }
    });
});

server.once("close", () => {
  performanceMonitor.close();
  discordWebhookService.close();
  crmWebhookWorker?.stop();
});
seatRealtimeService = createSeatRealtimeService(server, {
  allowedOrigins: allowedCorsOrigins,
  getSessionState: realtimeSeatState,
  selectSeat: selectRealtimeSeat,
  releaseSeat: ({ sessionId, seatId, ownerToken }) => releaseSeatHold({ sessionId, seatId, ownerToken }),
  onError: (error) => logEvent("warn", "seat_realtime.connection_error", { message: error.message })
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Porta ${PORT} ocupada. Rode npm run dev:stop e tente iniciar novamente.`);
    process.exit(1);
  }
  throw error;
});

const { runSubscriptionMaintenance, runMovieImageMaintenance,
  runEmailAttachmentMaintenance, runSystemLogMaintenance } = createBackendMaintenanceTasks({
  withCriticalMutation, readDb, writeDb, applyScheduledPremieres,
  applyAutomatedMovieTags, archiveFinishedSessions, pruneExpiredTicketPdfArtifacts,
  expireStaleReservations, syncScheduledCampaignCoupons, archiveExpiredCoupons,
  expirePendingPaymentSubscriptions, finalizeEndingSubscriptions,
  cleanupExpiredCheckoutOrders, logEvent,
  ticketDocumentRetentionDays: TICKET_ARCHIVED_DOCUMENT_RETENTION_DAYS,
  movieImageService, deleteUnreferencedAssets, postgresEnabled,
  emailCampaignRepository, path, fs, emailAttachmentRoot: EMAIL_ATTACHMENT_ROOT,
  settingsRepository, pruneSystemLogsFromPostgres,
  businessLogEvents: BUSINESS_LOG_EVENTS
});

loadEnvFiles().then(() => {
  if (isProduction() && !postgresEnabled()) {
    console.error("POSTGRES_REQUIRED_IN_PRODUCTION: configure DATABASE_URL ou POSTGRES_URL antes de iniciar em producao.");
    process.exit(1);
  }
  enablePostgresCacheInvalidation();
  void readDb().then((db) => {
    configureDiscordWebhook(db);
    configureCrmWebhookWorker(db);
  }).catch((error) => {
    console.warn(JSON.stringify({ level: "warn", event: "discord.configuration_load_failed", reason: error.name || "database" }));
  });
  server.listen(PORT, HOST, () => {
    runtimeLifecycle.start(releaseInfo);
    const tmdb = getTmdbCredentials();
    console.log(`Cine Cruzeiro backend: http://${HOST}:${PORT}`);
    console.log(`Painel admin: http://${HOST}:${PORT}/admin`);
    console.log(`TMDB: ${tmdb.configured ? `configurado via ${tmdb.mode}` : "nao configurado"}`);
    void runSubscriptionMaintenance();
    void runMovieImageMaintenance();
    void runEmailAttachmentMaintenance();
    void getSocialStudioAutomationOrchestrator().resumePending().then(count=>{if(count)logEvent('info','social_studio.automation.resumed',{count});}).catch(error=>logEvent('warn','social_studio.automation.resume_failed',{message:error.message}));
    const socialStudioRecoveryTimer=setInterval(()=>{
      void getSocialStudioAutomationOrchestrator().resumePending().then(count=>{if(count)logEvent('info','social_studio.automation.resumed',{count});}).catch(error=>logEvent('warn','social_studio.automation.resume_failed',{message:error.message}));
    },60*1000);
    socialStudioRecoveryTimer.unref?.();
    if (postgresEnabled()) {
      emailCampaignWorker = buildEmailCampaignWorker();
      emailCampaignWorker?.start();
      ticketEmailWorker = createTicketEmailWorker({
        repository: createTicketEmailJobRepository(),
        deliver: processQueuedTicketEmailDelivery,
        logger: logEvent
      });
      ticketEmailWorker.start();
      logEvent("info", "email_campaign.worker_started", { workerId: emailCampaignWorker?.workerId || "", config: emailCampaignWorker?.config || {} });
      void runSystemLogMaintenance();
    }
    const systemLogMaintenanceTimer = setInterval(() => {
      void runSystemLogMaintenance();
    }, 6 * 60 * 60 * 1000);
    systemLogMaintenanceTimer.unref?.();
    const subscriptionMaintenanceTimer = setInterval(() => {
      void runSubscriptionMaintenance();
    }, SUBSCRIPTION_MAINTENANCE_INTERVAL_MS);
    subscriptionMaintenanceTimer.unref?.();
    const movieImageMaintenanceTimer = setInterval(() => {
      void runMovieImageMaintenance();
    }, 6 * 60 * 60 * 1000);
    movieImageMaintenanceTimer.unref?.();
    const emailAttachmentMaintenanceTimer = setInterval(() => {
      void runEmailAttachmentMaintenance();
    }, 24 * 60 * 60 * 1000);
    emailAttachmentMaintenanceTimer.unref?.();
    void createCrmOutboxRepository().prune().catch((error) => logEvent("warn", "crm_webhook.outbox_prune_failed", { message: error.message }));
    const crmOutboxMaintenanceTimer = setInterval(() => {
      void createCrmOutboxRepository().prune().catch((error) => logEvent("warn", "crm_webhook.outbox_prune_failed", { message: error.message }));
    }, 24 * 60 * 60 * 1000);
    crmOutboxMaintenanceTimer.unref?.();
    let lastDiscordHealthAt = 0;
    const discordHealthTimer = setInterval(() => {
      if (!discordWebhookService.isEnabled()) return;
      const now = Date.now();
      if (now - lastDiscordHealthAt < discordWebhookService.healthIntervalMs()) return;
      const snapshot = performanceMonitor.snapshot();
      if (!snapshot.current) return;
      lastDiscordHealthAt = now;
      discordWebhookService.enqueueHealth(snapshot);
    }, 15000);
    discordHealthTimer.unref?.();
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    runtimeLifecycle.stop(signal);
    emailCampaignWorker?.stop();
    ticketEmailWorker?.stop();
    crmWebhookWorker?.stop();
    server.close(() => { void closePostgres().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref?.();
  });
}

module.exports = server;
