"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Popcorn, ShoppingBag, Ticket, Trash2, X } from "lucide-react";
import type { CinemaContent } from "@/services/cinemaApi";
import {
  allMovies,
  cartItemCount,
  clearCheckoutCarts,
  isSessionCheckoutAvailable,
  pruneUnavailableCheckoutCarts,
  readCheckoutCarts,
  removeCheckoutCart,
  selectCheckoutCart,
  startCheckoutCartQueue,
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
  const [removedCount, setRemovedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const result = pruneUnavailableCheckoutCarts(content);
      setCarts(result.carts);
      if (result.removed) setRemovedCount((count) => count + result.removed);
    };
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
  }, [content, isOpen, onClose]);

  const entries = useMemo(() => {
    const movies = allMovies(content);
    return carts.map((cart) => {
      const movie = movies.find((item) => item.id === cart.movieId);
      const session = movie?.sessions.find((item) => item.id === cart.sessionId);
      const ticketItems = cart.ticketQuantities !== undefined
        ? Object.entries(cart.ticketQuantities)
          .map(([id, quantity]) => {
            const ticketType = content?.ticketTypes?.find((item) => item.id === id);
            return {
              id,
              name: ticketType?.name || "Tipo de ingresso indisponível",
              quantity: Number(quantity || 0),
              bundleQuantity: Math.max(1, Number(ticketType?.bundleQuantity || 1)),
            };
          })
          .filter((item) => item.quantity > 0)
        : [
          { id: "full", name: "Inteira", quantity: Number(cart.fullTickets || 0), bundleQuantity: 1 },
          { id: "half", name: "Meia-entrada", quantity: Number(cart.halfTickets || 0), bundleQuantity: 1 },
        ].filter((item) => item.quantity > 0);
      const concessionItems = Object.entries(cart.concessionQuantities || {})
        .map(([id, quantity]) => ({
          id,
          name: content?.concessions?.find((item) => item.id === id)?.name || "Item indisponível",
          quantity: Number(quantity || 0),
        }))
        .filter((item) => item.quantity > 0);
      return { cart, movie, session, ticketItems, concessionItems };
    });
  }, [carts, content]);

  const openCart = (cart: StoredCheckoutCart) => {
    selectCheckoutCart(cart);
    onClose();
    router.push(`/checkout/${cart.sessionId}/extras`);
  };

  const buyAll = () => {
    const available = entries
      .filter(({ cart, movie, session }) => movie && isSessionCheckoutAvailable(session) && cartItemCount(cart) > 0)
      .map(({ cart }) => cart);
    if (!available.length) return;
    startCheckoutCartQueue(available);
    openCart(available[0]);
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
          {removedCount > 0 && (
            <p className="mb-4 rounded-lg bg-amber-300/10 px-4 py-3 text-sm font-semibold leading-5 text-amber-100" role="status">
              {removedCount === 1 ? "Uma sessão encerrada ou esgotada foi removida" : `${removedCount} sessões encerradas ou esgotadas foram removidas`} antes do pagamento.
            </p>
          )}
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
              {entries.map(({ cart, movie, session, ticketItems, concessionItems }) => (
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
                  <div className="mt-4 space-y-3 border-t border-white/8 pt-3">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase text-blue-200">
                        <Ticket className="h-3.5 w-3.5" /> Ingressos
                      </p>
                      <div className="space-y-1 text-xs text-slate-300">
                        {ticketItems.map((item) => (
                          <div key={item.id} className="flex min-w-0 items-start justify-between gap-3">
                            <span className="min-w-0 break-words">{item.name}</span>
                            <strong className="flex-none text-white">
                              {item.quantity}x{item.bundleQuantity > 1 ? ` · ${item.quantity * item.bundleQuantity} ingressos` : ""}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    {concessionItems.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase text-gold-400">
                          <Popcorn className="h-3.5 w-3.5" /> Bomboniere
                        </p>
                        <div className="space-y-1 text-xs text-slate-300">
                          {concessionItems.map((item) => (
                            <div key={item.id} className="flex min-w-0 items-start justify-between gap-3">
                              <span className="min-w-0 break-words">{item.name}</span>
                              <strong className="flex-none text-white">{item.quantity}x</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
          <div className="space-y-2 border-t border-white/8 px-5 py-4 sm:px-6">
            <button type="button" onClick={buyAll} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
              <ShoppingBag className="h-4 w-4" />
              Comprar todos os itens
            </button>
            {entries.length > 1 && <p className="text-center text-xs leading-5 text-slate-400">Cada sessão será revisada e paga em sequência para preservar poltronas e disponibilidade.</p>}
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
