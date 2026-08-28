"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ShoppingBag, Ticket, Trash2, X } from "lucide-react";
import type { CinemaContent } from "@/services/cinemaApi";
import {
  allMovies,
  cartItemCount,
  clearCheckoutCarts,
  readCheckoutCarts,
  removeCheckoutCart,
  selectCheckoutCart,
  type StoredCheckoutCart,
} from "@/utils/cinema";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  content: CinemaContent | null;
}

function sessionDateLabel(value = "") {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}

export function CartDrawer({ isOpen, onClose, content }: CartDrawerProps) {
  const router = useRouter();
  const [carts, setCarts] = useState<StoredCheckoutCart[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => setCarts(readCheckoutCarts());
    update();
    window.addEventListener("cine-cruzeiro-cart-updated", update);
    window.addEventListener("storage", update);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("cine-cruzeiro-cart-updated", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const entries = useMemo(() => {
    const movies = allMovies(content);
    return carts.map((cart) => {
      const movie = movies.find((item) => item.id === cart.movieId);
      const session = movie?.sessions.find((item) => item.id === cart.sessionId);
      const ticketCount = cart.ticketQuantities !== undefined
        ? Object.values(cart.ticketQuantities).reduce((sum, value) => sum + Number(value || 0), 0)
        : Number(cart.fullTickets || 0) + Number(cart.halfTickets || 0);
      const concessionCount = Object.values(cart.concessionQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      return { cart, movie, session, ticketCount, concessionCount };
    });
  }, [carts, content]);

  const openCart = (cart: StoredCheckoutCart) => {
    selectCheckoutCart(cart);
    onClose();
    router.push(`/checkout/${cart.sessionId}/extras`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
      <button className="absolute inset-0 cursor-default bg-slate-950/78 backdrop-blur-sm" onClick={onClose} aria-label="Fechar carrinho" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col border-l border-white/10 bg-[#0d1420] text-white shadow-[-16px_0_48px_rgba(2,6,23,.46)]">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-blue-500/12 text-blue-300">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="cart-drawer-title" className="text-lg font-black">Seu carrinho</h2>
              <p className="truncate text-xs text-slate-400">{entries.length ? `${entries.length} sessão(ões) selecionada(s)` : "Nenhuma sessão selecionada"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label="Fechar carrinho">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {!entries.length ? (
            <div className="flex min-h-[56vh] flex-col items-center justify-center text-center">
              <ShoppingBag className="h-11 w-11 text-slate-600" />
              <h3 className="mt-4 text-xl font-black">Carrinho vazio</h3>
              <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-slate-400">Escolha uma sessão e seus ingressos aparecerão aqui.</p>
              <Link href="/filmes" onClick={onClose} className="mt-6 inline-flex min-h-11 items-center bg-gold-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
                Ver programação
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map(({ cart, movie, session, ticketCount, concessionCount }) => (
                <article key={cart.sessionId} className="rounded-lg bg-[#172235] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gold-400/10 text-gold-400">
                      <Ticket className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-black leading-snug">{movie?.title || "Filme indisponível"}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-200">
                        <CalendarDays className="h-3.5 w-3.5 flex-none" />
                        {session ? `${sessionDateLabel(session.date)} às ${session.time} • ${session.format}` : "Esta sessão não está mais disponível"}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeCheckoutCart(cart.sessionId)} className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-rose-300 transition hover:bg-rose-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400" aria-label={`Remover ${movie?.title || "sessão"} do carrinho`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-xs text-slate-300">
                    <span>{ticketCount} ingresso(s)</span>
                    <span>{concessionCount} item(ns) da bomboniere</span>
                  </div>
                  <button type="button" disabled={!movie || !session || cartItemCount(cart) <= 0} onClick={() => openCart(cart)} className="mt-4 min-h-11 w-full bg-white/8 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500/18 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
                    Revisar e continuar
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="border-t border-white/8 px-5 py-4 sm:px-6">
            <button type="button" onClick={() => { clearCheckoutCarts(); setCarts([]); }} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-slate-400 transition hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400">
              <Trash2 className="h-4 w-4" />
              Limpar carrinho
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
