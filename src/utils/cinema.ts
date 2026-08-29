import type { CinemaContent, TicketTypeRecord } from "@/services/cinemaApi";
import { Movie, Session } from "@/types";

export const CART_STORAGE_KEY = "cine-cruzeiro-cart";
export const CART_COLLECTION_STORAGE_KEY = "cine-cruzeiro-carts";
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

export type StoredCheckoutCart = {
  movieId: string;
  sessionId: string;
  fullTickets?: number;
  halfTickets?: number;
  ticketQuantities?: Record<string, number>;
  selectedSeatIds?: string[];
  concessionQuantities?: Record<string, number>;
  couponCode?: string;
  extrasVisited?: boolean;
  paymentMethod?: "pix" | "credit_card";
  useClubBenefits?: boolean;
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

export function money(value: number | undefined) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

export function readCheckoutCart(): StoredCheckoutCart | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readCheckoutCarts(): StoredCheckoutCart[] {
  if (typeof window === "undefined") return [];
  let carts: StoredCheckoutCart[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_COLLECTION_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) carts = parsed;
  } catch {
    carts = [];
  }
  const active = readCheckoutCart();
  if (active?.sessionId && !carts.some((cart) => cart.sessionId === active.sessionId)) carts.push(active);
  return carts
    .filter((cart) => cart?.sessionId && !cart.paymentResult && cartItemCount(cart) > 0)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function writeCheckoutCart(cart: StoredCheckoutCart) {
  if (typeof window === "undefined") return;
  const next = { ...cart, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  let carts: StoredCheckoutCart[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_COLLECTION_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) carts = parsed;
  } catch {
    carts = [];
  }
  carts = [next, ...carts.filter((item) => item.sessionId !== next.sessionId)].slice(0, 12);
  window.localStorage.setItem(CART_COLLECTION_STORAGE_KEY, JSON.stringify(carts));
  window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated"));
}

export function selectCheckoutCart(cart: StoredCheckoutCart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated"));
}

export function removeCheckoutCart(sessionId: string) {
  if (typeof window === "undefined") return;
  const remaining = readCheckoutCarts().filter((cart) => cart.sessionId !== sessionId);
  window.localStorage.setItem(CART_COLLECTION_STORAGE_KEY, JSON.stringify(remaining));
  const active = readCheckoutCart();
  if (active?.sessionId === sessionId) {
    if (remaining[0]) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remaining[0]));
    else window.localStorage.removeItem(CART_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated"));
}

export function clearCheckoutCarts() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
  window.localStorage.removeItem(CART_COLLECTION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated"));
}

export function checkoutCartsItemCount(carts = readCheckoutCarts()) {
  return carts.reduce((sum, cart) => sum + cartItemCount(cart), 0);
}

export function cartItemCount(cart: StoredCheckoutCart | null) {
  if (!cart) return 0;
  const concessions = Object.values(cart.concessionQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const selectedTickets = Object.values(cart.ticketQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const tickets = cart.ticketQuantities !== undefined
    ? selectedTickets
    : Number(cart.fullTickets || 0) + Number(cart.halfTickets || 0);
  return tickets + concessions;
}

export function cartTotal(
  cart: StoredCheckoutCart | null,
  session?: Session,
  concessions: CinemaContent["concessions"] = [],
  ticketTypes: TicketTypeRecord[] = []
) {
  if (!cart || !session) return 0;
  const selectedTickets = Object.entries(cart.ticketQuantities || {}).reduce((sum, [id, quantity]) => {
    const ticketType = ticketTypes.find((item) => item.id === id);
    return sum + Number(quantity || 0) * Number(ticketType?.price || 0);
  }, 0);
  const tickets = cart.ticketQuantities !== undefined
    ? selectedTickets
    : Number(cart.fullTickets || 0) * Number(session.priceFull || 0) + Number(cart.halfTickets || 0) * Number(session.priceHalf || 0);
  const extras = concessions.reduce((sum, item) => {
    const qty = Number(cart.concessionQuantities?.[item.id] || 0);
    return sum + qty * Number(item.price || 0);
  }, 0);
  return tickets + extras;
}
