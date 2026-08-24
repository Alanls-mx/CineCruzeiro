import type { CinemaContent } from "@/services/cinemaApi";
import { Movie, Session } from "@/types";

export const CART_STORAGE_KEY = "cine-cruzeiro-cart";
export const PUBLIC_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

export function assetPath(path: string) {
  const cleanPath = `/${String(path || "").replace(/^\/+/, "")}`;
  return `${PUBLIC_BASE_PATH}${cleanPath}`;
}

export function publicAssetPath(value: string | undefined | null) {
  const url = String(value || "").trim();
  if (!url || /^(data:|blob:|https?:)/i.test(url)) return url;
  if (PUBLIC_BASE_PATH && url.startsWith(`${PUBLIC_BASE_PATH}/`)) return url;
  if (url.startsWith("/uploads/") || url.startsWith("/images/") || url.startsWith("/trailers/")) {
    return assetPath(url);
  }
  return url;
}

export type StoredCheckoutCart = {
  movieId: string;
  sessionId: string;
  fullTickets?: number;
  halfTickets?: number;
  concessionQuantities?: Record<string, number>;
  couponCode?: string;
  extrasVisited?: boolean;
  paymentMethod?: "pix" | "credit_card";
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

export function calendarDayTitle(day: CalendarDayLike, index = 0) {
  if (index === 0) return "Hoje";
  if (index === 1 && String(day.label || "").toLowerCase().includes("aman")) return "Amanhã";
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

export function writeCheckoutCart(cart: StoredCheckoutCart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ ...cart, updatedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated"));
}

export function cartItemCount(cart: StoredCheckoutCart | null) {
  if (!cart) return 0;
  const concessions = Object.values(cart.concessionQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return Number(cart.fullTickets || 0) + Number(cart.halfTickets || 0) + concessions;
}

export function cartTotal(cart: StoredCheckoutCart | null, session?: Session, concessions: CinemaContent["concessions"] = []) {
  if (!cart || !session) return 0;
  const tickets = Number(cart.fullTickets || 0) * Number(session.priceFull || 0) + Number(cart.halfTickets || 0) * Number(session.priceHalf || 0);
  const extras = concessions.reduce((sum, item) => {
    const qty = Number(cart.concessionQuantities?.[item.id] || 0);
    return sum + qty * Number(item.price || 0);
  }, 0);
  return tickets + extras;
}
