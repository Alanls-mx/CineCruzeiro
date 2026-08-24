"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Ticket, Trash2, X } from "lucide-react";
import { CinemaContent } from "@/services/cinemaApi";
import { Movie, Session } from "@/types";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  content: CinemaContent | null;
  onCheckout: (movie: Movie, session: Session) => void;
  onCleared?: () => void;
}

const CART_STORAGE_KEY = "cine-cruzeiro-cart";

type StoredCart = {
  movieId: string;
  sessionId: string;
  fullTickets?: number;
  halfTickets?: number;
  concessionQuantities?: Record<string, number>;
};

function readCart(): StoredCart | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function CartDrawer({ isOpen, onClose, content, onCheckout, onCleared }: CartDrawerProps) {
  const [cart, setCart] = useState<StoredCart | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCart(readCart());
  }, [isOpen]);

  const { movie, session, concessionCount, totalItems } = useMemo(() => {
    const movies = [
      ...(content?.featuredMovie ? [content.featuredMovie] : []),
      ...(content?.nowPlaying || []),
      ...(content?.upcoming || []),
    ];
    const selectedMovie = cart ? movies.find((item) => item.id === cart.movieId) || null : null;
    const selectedSession = selectedMovie && cart
      ? selectedMovie.sessions.find((item) => item.id === cart.sessionId) || null
      : null;
    const concessions = Object.values(cart?.concessionQuantities || {}).reduce<number>(
      (sum, value) => sum + Number(value || 0),
      0
    );
    const items = Number(cart?.fullTickets || 0) + Number(cart?.halfTickets || 0) + concessions;
    return { movie: selectedMovie, session: selectedSession, concessionCount: concessions, totalItems: items };
  }, [cart, content]);

  const clearCart = () => {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated", { detail: { count: 0 } }));
    setCart(null);
    onCleared?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-brand-950 text-white shadow-2xl shadow-blue-950/60 animate-slide-in-right">
        <div className="flex items-center justify-between bg-brand-900/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-300">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">Carrinho</h3>
              <p className="text-xs font-semibold text-slate-400">Revise antes de seguir para o checkout.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-brand-850 hover:text-white"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {!cart || !movie || !session || totalItems <= 0 ? (
            <div className="rounded-3xl bg-brand-900/70 p-6 text-center shadow-xl shadow-blue-950/20">
              <ShoppingCart className="mx-auto h-10 w-10 text-brand-300" />
              <h4 className="mt-3 text-base font-black">Seu carrinho está vazio</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Escolha um filme, adicione ingressos e personalize a bomboniere.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-3xl bg-brand-900/70 p-5 shadow-xl shadow-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-400">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black">{movie.title}</h4>
                    <p className="mt-1 text-xs font-semibold text-brand-300">
                      Hoje às {session.time} • {session.format}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl bg-brand-950/70 p-3">
                    <span className="text-slate-400">Ingressos</span>
                    <div className="mt-1 text-lg font-black">{Number(cart.fullTickets || 0) + Number(cart.halfTickets || 0)}</div>
                  </div>
                  <div className="rounded-2xl bg-brand-950/70 p-3">
                    <span className="text-slate-400">Produtos</span>
                    <div className="mt-1 text-lg font-black">{concessionCount}</div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCheckout(movie, session);
                }}
                className="w-full rounded-2xl bg-gold-400 px-5 py-4 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300"
              >
                Editar carrinho e continuar
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-900 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-brand-850"
              >
                <Trash2 className="h-4 w-4" />
                Limpar carrinho
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
