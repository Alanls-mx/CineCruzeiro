import { ConcessionItem, Movie, TicketOrder } from "@/types";
import { publicAssetPath } from "@/utils/cinema";

const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");
const CUSTOMER_SESSION_TOKEN_KEY = "cine-cruzeiro-session-token";
const CUSTOMER_FALLBACK_COOKIE = "cine_customer_fallback";
const CUSTOMER_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;
const CINEMA_CONTENT_CACHE_TTL = 30_000;

let cinemaContentCache: { value: CinemaContent; expiresAt: number } | null = null;
let cinemaContentRequest: Promise<CinemaContent> | null = null;

function apiErrorMessage(payload: Record<string, unknown>, fallback: string) {
  const error = payload.error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return typeof error === "string" ? error : fallback;
}

function sessionToken() {
  if (typeof window === "undefined") return "";
  return safeStorage("sessionStorage").getItem(CUSTOMER_SESSION_TOKEN_KEY) || safeStorage("localStorage").getItem(CUSTOMER_SESSION_TOKEN_KEY) || "";
}

function rememberSessionToken(token?: string) {
  if (typeof window === "undefined" || !token) return;
  safeStorage("sessionStorage").setItem(CUSTOMER_SESSION_TOKEN_KEY, token);
  safeStorage("localStorage").setItem(CUSTOMER_SESSION_TOKEN_KEY, token);
  document.cookie = `${CUSTOMER_FALLBACK_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${CUSTOMER_TOKEN_MAX_AGE}`;
}

function clearSessionToken() {
  if (typeof window === "undefined") return;
  safeStorage("sessionStorage").removeItem(CUSTOMER_SESSION_TOKEN_KEY);
  safeStorage("localStorage").removeItem(CUSTOMER_SESSION_TOKEN_KEY);
  document.cookie = `${CUSTOMER_FALLBACK_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function safeStorage(kind: "localStorage" | "sessionStorage") {
  return {
    getItem(key: string) {
      try {
        return window[kind].getItem(key);
      } catch {
        return "";
      }
    },
    setItem(key: string, value: string) {
      try {
        window[kind].setItem(key, value);
      } catch {
        // Cookie HttpOnly segue sendo o caminho principal de autenticacao.
      }
    },
    removeItem(key: string) {
      try {
        window[kind].removeItem(key);
      } catch {
        // Ignore storage cleanup failures.
      }
    },
  };
}

function authHeaders(extra: Record<string, string> = {}) {
  const token = sessionToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  role?: string;
  authProvider?: "email" | "google";
  picture?: string;
  emailVerified?: boolean;
  pendingEmail?: string;
}

export interface TicketRecord {
  id: string;
  orderId?: string;
  code: string;
  qrPayload: string;
  movieId?: string;
  movieTitle: string;
  posterUrl?: string;
  backdropUrl?: string;
  sessionTime: string;
  sessionFormat: string;
  sessionRoom?: string;
  sessionDate: string;
  ticketType: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCpf?: string;
  customerUserId?: string;
  status: "active" | "used" | "archived" | "cancelled" | "refunded" | "expired" | "pending_payment";
  orderReference?: string;
  orderStatus?: string;
  paymentStatus?: string;
  extras?: Array<{
    id?: string;
    name: string;
    quantity: number;
    unitPrice?: number;
    imageUrl?: string;
  }>;
  extrasSharedByOrder?: boolean;
  orderTicketIndex?: number;
  orderTicketCount?: number;
  archived?: boolean;
  archiveAt?: string;
  canTransfer?: boolean;
  transferredAt?: string;
  usedAt?: string;
  createdAt: string;
}

export interface RoomRecord {
  id: string;
  name: string;
  capacity: number;
  technology?: string;
  status: "active" | "maintenance" | "hidden";
}

export interface TicketTypeRecord {
  id: string;
  name: string;
  price: number;
  description?: string;
  active: boolean;
}

export interface CinemaContent {
  featuredMovie: Movie | null;
  nowPlaying: Movie[];
  upcoming: Movie[];
  calendar?: {
    timezone: string;
    today: string;
    days: Array<{
      isoDate: string;
      label: string;
      weekday: string;
      displayDate: string;
    }>;
  };
  rooms: RoomRecord[];
  ticketTypes: TicketTypeRecord[];
  concessions: ConcessionItem[];
  promotions: Array<Record<string, unknown>>;
  ads: Array<Record<string, unknown>>;
  settings: {
    cinemaName?: string;
    defaultTicketPrice?: number;
    announcementEnabled?: boolean;
    announcementText?: string;
    clubHeroImageUrl?: string;
    clubBannerImageUrl?: string;
    eventHeroImageUrl?: string;
    eventGamesImageUrl?: string;
    eventPartiesImageUrl?: string;
    eventCorporateImageUrl?: string;
    eventGalleryImageUrl?: string;
  };
}

export interface AccountTicketsResponse {
  tickets: TicketRecord[];
  upcoming: TicketRecord[];
  archived: TicketRecord[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  price?: number;
  includedTickets: number;
  ticketsPerCycle?: number;
  billingCycle?: string;
  benefits: string[];
  imageUrl?: string;
  isFeatured?: boolean;
  displayOrder?: number;
  active: boolean;
}

export interface AccountSubscription {
  id: string;
  userId: string;
  planId: string;
  status: "pending_payment" | "active" | "paused" | "cancelled" | "ended" | "payment_failed";
  statusLabel?: string;
  creditsAvailable: number;
  creditsRemaining: number;
  creditsUsed: number;
  creditsTotal?: number;
  cycleStart?: string;
  cycleEnd?: string;
  nextBillingAt?: string;
  paymentExpiresAt?: string;
  paymentExpiredAt?: string;
  currentPeriodEnd?: string;
  plan?: SubscriptionPlan | null;
  credit?: {
    id: string;
    total: number;
    used: number;
    remaining: number;
    cycleStart: string;
    cycleEnd: string;
  } | null;
  usage?: Array<{
    id: string;
    orderId?: string;
    ticketId?: string;
    sessionId?: string;
    usedAt: string;
    refundedAt?: string;
  }>;
}

function normalizeMovie(movie: Partial<Movie> & { status?: string }): Movie {
  return {
    id: String(movie.id || `filme-${Date.now()}`),
    slug: movie.slug || movie.id || "",
    sortOrder: Number(movie.sortOrder ?? 100),
    title: String(movie.title || "Filme sem titulo"),
    originalTitle: movie.originalTitle || "",
    synopsis: movie.synopsis || "",
    duration: movie.duration || "1h 40m",
    genre: Array.isArray(movie.genre) ? movie.genre : [],
    rating: movie.rating || "L",
    posterUrl: publicAssetPath(movie.posterUrl || ""),
    backdropUrl: publicAssetPath(movie.backdropUrl || ""),
    trailerYoutubeId: movie.trailerYoutubeId || undefined,
    trailerVideoUrl: movie.trailerVideoUrl || undefined,
    localTrailerUrl: movie.localTrailerUrl || undefined,
    trailerSourceUrl: movie.trailerSourceUrl || undefined,
    trailerCacheStatus: movie.trailerCacheStatus || "idle",
    trailerCachedAt: movie.trailerCachedAt,
    trailerCacheError: movie.trailerCacheError,
    isHighlight: Boolean(movie.isHighlight),
    highlightTrailerBackground: movie.highlightTrailerBackground !== false,
    releaseDate: movie.releaseDate,
    autoPublish: Boolean(movie.autoPublish),
    publishedAt: movie.publishedAt,
    tag: movie.tag,
    sessions: Array.isArray(movie.sessions) ? movie.sessions : [],
  };
}

function normalizeCinemaContent(data: Record<string, any>): CinemaContent {
  const nowPlaying = Array.isArray(data.nowPlaying)
    ? data.nowPlaying.map(normalizeMovie)
    : [];
  const upcoming = Array.isArray(data.upcoming)
    ? data.upcoming.map(normalizeMovie)
    : [];
  const featuredMovie = data.featuredMovie ? normalizeMovie(data.featuredMovie) : nowPlaying[0] || null;

  return {
    featuredMovie,
    nowPlaying,
    upcoming,
    calendar: data.calendar,
    rooms: Array.isArray(data.rooms) ? data.rooms : [],
    ticketTypes: Array.isArray(data.ticketTypes) ? data.ticketTypes : [],
    concessions: Array.isArray(data.concessions)
      ? data.concessions.map((item: ConcessionItem) => ({ ...item, imageUrl: publicAssetPath(item.imageUrl) }))
      : [],
    promotions: Array.isArray(data.promotions)
      ? data.promotions.map((item: Record<string, unknown>) => ({ ...item, imageUrl: publicAssetPath(String(item.imageUrl || "")) }))
      : [],
    ads: Array.isArray(data.ads)
      ? data.ads.map((item: Record<string, unknown>) => ({ ...item, imageUrl: publicAssetPath(String(item.imageUrl || "")) }))
      : [],
    settings: {
      ...(data.settings || {}),
      clubHeroImageUrl: publicAssetPath(data.settings?.clubHeroImageUrl),
      clubBannerImageUrl: publicAssetPath(data.settings?.clubBannerImageUrl),
      eventHeroImageUrl: publicAssetPath(data.settings?.eventHeroImageUrl),
      eventGamesImageUrl: publicAssetPath(data.settings?.eventGamesImageUrl),
      eventPartiesImageUrl: publicAssetPath(data.settings?.eventPartiesImageUrl),
      eventCorporateImageUrl: publicAssetPath(data.settings?.eventCorporateImageUrl),
      eventGalleryImageUrl: publicAssetPath(data.settings?.eventGalleryImageUrl),
    },
  };
}

export function getCachedCinemaContent() {
  if (!cinemaContentCache || cinemaContentCache.expiresAt <= Date.now()) return null;
  return cinemaContentCache.value;
}

export async function fetchCinemaContent(): Promise<CinemaContent> {
  const cached = getCachedCinemaContent();
  if (cached) return cached;
  if (cinemaContentRequest) return cinemaContentRequest;

  cinemaContentRequest = fetch(`${API_BASE}/api/content`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar a programacao do backend.");
      }
      return normalizeCinemaContent(await response.json());
    })
    .then((content) => {
      cinemaContentCache = {
        value: content,
        expiresAt: Date.now() + CINEMA_CONTENT_CACHE_TTL,
      };
      return content;
    });

  try {
    return await cinemaContentRequest;
  } finally {
    cinemaContentRequest = null;
  }
}

export async function recordTicketOrder(order: TicketOrder) {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel registrar o pedido no backend.");
  }

  return response.json();
}

export async function createCheckoutPayment(
  order: TicketOrder,
  method: "pix" | "credit_card",
  paymentInput: {
    idempotencyKey?: string;
    cardToken?: string;
    paymentMethodId?: string;
    paymentTypeId?: string;
    installments?: number;
  } = {}
) {
  const endpoint = method === "pix" ? "/api/payments/pix" : "/api/payments/card";
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({
      "Content-Type": "application/json",
      ...(paymentInput.idempotencyKey ? { "X-Idempotency-Key": paymentInput.idempotencyKey } : {}),
    }),
    body: JSON.stringify({ order, method, ...paymentInput }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, data.detail || "Nao foi possivel gerar o pagamento."));
  }

  return data as {
    order: TicketOrder;
    payment: {
      provider: "mercado_pago";
      id: string;
      status: string;
      qrCode: string;
      qrCodeBase64?: string;
      ticketUrl?: string;
      checkoutUrl?: string;
    };
  };
}

export async function createPixPayment(order: TicketOrder) {
  return createCheckoutPayment(order, "pix");
}

export async function fetchMercadoPagoCheckoutConfig() {
  const response = await fetch(`${API_BASE}/api/payments/config/mercado-pago`, {
    cache: "no-store",
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel consultar Mercado Pago."));
  }
  return payload as {
    provider: "mercado_pago";
    enabled: boolean;
    configured: boolean;
    publicKey: string;
    environment: "sandbox" | "production";
    livePayments: boolean;
  };
}

export async function fetchSubscriptionPlans() {
  const response = await fetch(`${API_BASE}/api/subscription-plans`);
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel carregar os planos do Clube."));
  }
  return (Array.isArray(payload) ? payload : []).map((plan: SubscriptionPlan) => ({
    ...plan,
    imageUrl: publicAssetPath(plan.imageUrl),
  })) as SubscriptionPlan[];
}

export async function fetchMySubscriptions() {
  const response = await fetch(`${API_BASE}/api/me/subscriptions`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Entre na sua conta para consultar o Clube."));
  }
  return (payload.subscriptions || []) as AccountSubscription[];
}

export async function subscribeToPlan(planId: string, paymentMethod: "credit_card") {
  const response = await fetch(`${API_BASE}/api/subscriptions/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ planId, paymentMethod }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel iniciar a assinatura."));
  }
  return payload as {
    subscription: AccountSubscription;
    checkoutUrl?: string;
    initPoint?: string;
    provider?: string;
    paymentMethod?: "credit_card";
    externalBillingPending?: boolean;
    message?: string;
  };
}

export async function cancelMySubscription(subscriptionId: string, reason = "Cancelado pelo cliente", options: { cancelImmediately?: boolean } = {}) {
  const response = await fetch(`${API_BASE}/api/me/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason, cancelImmediately: Boolean(options.cancelImmediately) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel cancelar a assinatura."));
  }
  return payload as { subscription: AccountSubscription; message?: string };
}

export async function createClubCreditCheckout(data: {
  movieId: string;
  sessionId: string;
  fullTicketsCount: number;
  halfTicketsCount: number;
  concessionItems?: Array<{ id: string; quantity: number }>;
  couponCode?: string;
}) {
  const response = await fetch(`${API_BASE}/api/checkout/club-credit`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel usar o beneficio do Clube."));
  }
  return payload as {
    order: TicketOrder & { status?: string };
    payment: { id: string; status: string; method: "club_credit" };
    tickets: Array<{ code: string }>;
    subscription: AccountSubscription;
  };
}

export async function fetchCheckoutOrderStatus(orderId: string) {
  const response = await fetch(`${API_BASE}/api/checkout/orders/${encodeURIComponent(orderId)}`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel confirmar o pedido."));
  }
  return payload as {
    order: TicketOrder & { status?: string };
    payment: { id: string; status: string; qrCode?: string; ticketUrl?: string };
    tickets: Array<{ code: string }>;
  };
}

export async function registerCustomer(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  cpf?: string;
}) {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel criar a conta."));
  }
  rememberSessionToken(payload.token);
  return payload as { token?: string; user: CustomerUser };
}

export async function loginCustomer(data: { email: string; password: string }) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel entrar."));
  }
  rememberSessionToken(payload.token);
  return payload as { token?: string; user: CustomerUser };
}

export function googleLoginUrl(returnTo = "") {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "";
  return safeReturnTo
    ? `${API_BASE}/api/auth/google/start?returnTo=${encodeURIComponent(safeReturnTo)}`
    : `${API_BASE}/api/auth/google/start`;
}

export async function fetchCurrentCustomer() {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Entre na sua conta para continuar."));
  }
  return payload as { user: CustomerUser };
}

export async function updateCurrentCustomer(data: { name?: string; phone?: string; cpf?: string; currentPassword?: string; newPassword?: string; confirmPassword?: string }) {
  const response = await fetch(`${API_BASE}/api/me`, {
    method: "PATCH",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel atualizar sua conta."));
  }
  return payload as { user: CustomerUser };
}

export async function updateAccountProfile(data: { name?: string; phone?: string; cpf?: string; currentPassword?: string; newPassword?: string; confirmPassword?: string }) {
  return updateCurrentCustomer(data);
}

export async function requestEmailChange(email: string) {
  const response = await fetch(`${API_BASE}/api/me/email-change/request`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel solicitar verificacao do e-mail."));
  }
  return payload as { ok: boolean; message: string; user: CustomerUser };
}

export async function requestAccountEmailVerification() {
  const response = await fetch(`${API_BASE}/api/me/email-verification/request`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel enviar a confirmacao do e-mail."));
  }
  return payload as { ok: boolean; message: string; user: CustomerUser };
}

export async function confirmEmailChange(token: string) {
  const response = await fetch(`${API_BASE}/api/me/email-change/confirm`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel confirmar o e-mail."));
  }
  if (payload.token) rememberSessionToken(payload.token);
  return payload as { ok: boolean; token?: string; user: CustomerUser };
}

export async function logoutCustomer() {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
  }).catch(() => null);
  clearSessionToken();
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${API_BASE}/api/auth/password/request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel solicitar recuperacao de senha."));
  }
  return payload as { ok: boolean; message: string };
}

export async function resetPassword(data: { token: string; password: string }) {
  const response = await fetch(`${API_BASE}/api/auth/password/reset`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel redefinir a senha."));
  }
  if (payload.token) rememberSessionToken(payload.token);
  return payload as { ok: boolean; user: CustomerUser };
}

export async function fetchAccountTickets() {
  const response = await fetch(`${API_BASE}/api/me/tickets`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel carregar seus ingressos."));
  }
  return (payload.tickets || []) as TicketRecord[];
}

export async function fetchAccountTicketsGrouped(): Promise<AccountTicketsResponse> {
  const response = await fetch(`${API_BASE}/api/me/tickets`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel carregar seus ingressos."));
  }
  return {
    tickets: (payload.tickets || []) as TicketRecord[],
    upcoming: (payload.upcoming || []) as TicketRecord[],
    archived: (payload.archived || []) as TicketRecord[],
  };
}

export async function fetchAccountTicket(ticketId: string) {
  const response = await fetch(`${API_BASE}/api/me/tickets/${encodeURIComponent(ticketId)}`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel carregar o ingresso."));
  }
  return payload.ticket as TicketRecord;
}

export function ticketDownloadUrl(ticketId: string, options: { view?: boolean } = {}) {
  const base = `${API_BASE}/api/me/tickets/${encodeURIComponent(ticketId)}/download`;
  return options.view ? `${base}?view=1` : base;
}

export async function createGoogleWalletPass(ticketId: string) {
  const response = await fetch(`${API_BASE}/api/me/tickets/${encodeURIComponent(ticketId)}/google-wallet`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Google Wallet indisponivel para este ingresso."));
  }
  return payload as { url: string };
}

export async function transferTicket(ticketId: string, email: string) {
  const response = await fetch(`${API_BASE}/api/me/tickets/${encodeURIComponent(ticketId)}/transfer`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel transferir o ingresso."));
  }
  return payload as { ok: boolean; ticket: TicketRecord };
}

export async function validateTicket(code: string) {
  const response = await fetch(`${API_BASE}/api/tickets/validate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Nao foi possivel validar o ingresso."));
  }
  return payload.ticket as TicketRecord;
}
