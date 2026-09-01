import type { CinemaContent, TicketTypeRecord } from "@/services/cinemaApi";
import { Movie, Session } from "@/types";

export const CHECKOUT_DRAFT_STORAGE_KEY = "cine-cruzeiro-checkout-draft-v1";
const OBSOLETE_CHECKOUT_STORAGE_KEYS = ["cine-cruzeiro-cart", "cine-cruzeiro-carts"];
const OBSOLETE_CHECKOUT_QUEUE_STORAGE_KEY = "cine-cruzeiro-cart-checkout-queue";
const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const UPLOAD_ASSET_VERSION = "2";
export const PUBLIC_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");

export function assetPath(path: string) {
  const cleanPath = `/${String(path || "").replace(/^\/+/, "")}`;
  return `${PUBLIC_BASE_PATH}${cleanPath}`;
}

export function publicAssetPath(value: string | undefined | null) {
  const url = String(value || "").trim();
  if (!url || /^(data:|blob:|https?:)/i.test(url)) return url;
  if (PUBLIC_BASE_PATH && url.startsWith(`${PUBLIC_BASE_PATH}/`)) return url;
  if (url.startsWith("/uploads/") || url.startsWith("/images/") || url.startsWith("/trailers/")) {
    const publicUrl = assetPath(url);
    return url.startsWith("/uploads/") ? `${publicUrl}?v=${UPLOAD_ASSET_VERSION}` : publicUrl;
  }
  return url;
}

export function isUploadedAsset(value: string | undefined | null) {
  const url = publicAssetPath(value);
  if (!url) return false;
  try {
    return new URL(url, "http://cine-cruzeiro.local").pathname.includes("/uploads/");
  } catch {
    return url.includes("/uploads/");
  }
}

export type StoredCheckoutDraft = {
  movieId: string;
  sessionId: string;
  fullTickets?: number;
  halfTickets?: number;
  ticketQuantities?: Record<string, number>;
  selectedSeatIds?: string[];
  seatHoldToken?: string;
  concessionQuantities?: Record<string, number>;
  couponCode?: string;
  extrasVisited?: boolean;
  paymentMethod?: "pix" | "credit_card";
  useClubBenefits?: boolean;
  useClubCredits?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCpf?: string;
  paymentResult?: unknown;
  updatedAt?: string;
};

export function movieSlug(movie: Pick<Movie, "id" | "title"> & { slug?: string }) {
  const stableId = String(movie.slug || movie.id || "").trim();
  const titleSlug = String(movie.title || stableId)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return titleSlug || stableId;
}

export type CalendarDayLike = {
  isoDate?: string;
  label?: string;
  weekday?: string;
  displayDate?: string;
};

function titleCasePt(value = "") {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export function calendarDayTitle(day: CalendarDayLike, _index = 0) {
  const label = String(day.label || "").toLowerCase();
  if (label.includes("hoje")) return "Hoje";
  if (label.includes("aman")) return "Amanhã";
  return titleCasePt(day.weekday || day.label || "");
}

export function calendarDayDate(day: CalendarDayLike) {
  if (day.displayDate && !/[a-záéíóúãõç]/i.test(day.displayDate)) return day.displayDate;
  if (!day.isoDate) return day.displayDate || "--/--";
  const [, month, date] = day.isoDate.match(/^\d{4}-(\d{2})-(\d{2})$/) || [];
  return date && month ? `${date}/${month}` : day.displayDate || "--/--";
}

export function calendarDayFullLabel(day: CalendarDayLike, index = 0) {
  const title = calendarDayTitle(day, index);
  const date = calendarDayDate(day);
  return date ? `${title} • ${date}` : title;
}

export function allMovies(content: CinemaContent | null) {
  if (!content) return [];
  const map = new Map<string, Movie>();
  [content.featuredMovie, ...content.nowPlaying, ...content.upcoming].forEach((movie) => {
    if (movie) map.set(movie.id, movie);
  });
  return Array.from(map.values());
}

export function findMovieBySlug(content: CinemaContent | null, slug: string) {
  return allMovies(content).find((movie) => {
    const titleSlug = movieSlug(movie);
    return titleSlug === slug || movie.id === slug || slug.startsWith(`${movie.id}--`);
  }) || null;
}

export function findSession(content: CinemaContent | null, sessionId: string): { movie: Movie; session: Session } | null {
  for (const movie of allMovies(content)) {
    const session = movie.sessions.find((item) => item.id === sessionId);
    if (session) return { movie, session };
  }
  return null;
}

export function sessionStartsAt(session?: Pick<Session, "date" | "time"> | null) {
  const date = String(session?.date || "").slice(0, 10);
  const time = /^\d{2}:\d{2}$/.test(String(session?.time || "")) ? session?.time : "00:00";
  if (!date) return null;
  const parsed = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSessionCheckoutAvailable(session?: Session | null, now = new Date()) {
  if (!session || session.status === "sold_out") return false;
  const startsAt = sessionStartsAt(session);
  return startsAt ? startsAt.getTime() + 10 * 60 * 1000 > now.getTime() : false;
}

export function money(value: number | undefined) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

export function clearObsoleteCheckoutStorage() {
  if (typeof window === "undefined") return;
  OBSOLETE_CHECKOUT_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.sessionStorage.removeItem(OBSOLETE_CHECKOUT_QUEUE_STORAGE_KEY);
}

export function readCheckoutDraft(): StoredCheckoutDraft | null {
  if (typeof window === "undefined") return null;
  clearObsoleteCheckoutStorage();
  const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeCheckoutDraft(draft: StoredCheckoutDraft) {
  if (typeof window === "undefined") return;
  clearObsoleteCheckoutStorage();
  window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}

export function clearCheckoutDraft(sessionId?: string) {
  if (typeof window === "undefined") return;
  if (!sessionId) {
    window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
  } else {
    const draft = readCheckoutDraft();
    if (draft?.sessionId === sessionId) window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
  }
  clearObsoleteCheckoutStorage();
}

export function checkoutDraftTotal(
  draft: StoredCheckoutDraft | null,
  session?: Session,
  concessions: CinemaContent["concessions"] = [],
  ticketTypes: TicketTypeRecord[] = []
) {
  if (!draft || !session) return 0;
  const selectedTickets = Object.entries(draft.ticketQuantities || {}).reduce((sum, [id, quantity]) => {
    const ticketType = ticketTypes.find((item) => item.id === id);
    return sum + Number(quantity || 0) * Number(ticketType?.price || 0);
  }, 0);
  const tickets = draft.ticketQuantities !== undefined
    ? selectedTickets
    : Number(draft.fullTickets || 0) * Number(session.priceFull || 0) + Number(draft.halfTickets || 0) * Number(session.priceHalf || 0);
  const extras = concessions.reduce((sum, item) => {
    const qty = Number(draft.concessionQuantities?.[item.id] || 0);
    return sum + qty * Number(item.price || 0);
  }, 0);
  return tickets + extras;
}
