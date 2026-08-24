"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { fetchCinemaContent } from "@/services/cinemaApi";
import type { CinemaContent } from "@/services/cinemaApi";
import { assetPath, cartItemCount, readCheckoutCart } from "@/utils/cinema";

const navItems = [
  { href: "/filmes", label: "Filmes" },
  { href: "/clube", label: "Clube" },
  { href: "/eventos", label: "Eventos" },
];

type SiteHeaderProps = {
  settings?: CinemaContent["settings"];
};

export function SiteHeader({ settings }: SiteHeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartSessionId, setCartSessionId] = useState("");
  const [remoteSettings, setRemoteSettings] = useState<CinemaContent["settings"] | null>(null);

  const effectiveSettings = settings || remoteSettings;
  const showAnnouncement = effectiveSettings?.announcementEnabled === true;
  const announcementText = effectiveSettings?.announcementText?.trim();

  useEffect(() => {
    const update = () => {
      const cart = readCheckoutCart();
      setCartCount(cartItemCount(cart));
      setCartSessionId(cart?.sessionId || "");
    };
    update();
    window.addEventListener("cine-cruzeiro-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cine-cruzeiro-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const cartHref = cartCount > 0 && cartSessionId ? `/checkout/${cartSessionId}/extras` : "/filmes";

  useEffect(() => {
    if (settings) return;
    let mounted = true;
    fetchCinemaContent()
      .then((content) => {
        if (mounted) setRemoteSettings(content.settings);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, [settings]);

  return (
    <header className="sticky top-0 z-40 bg-[#060a12]/92 backdrop-blur-xl">
      {showAnnouncement && announcementText && (
        <div className="border-b border-white/8 bg-brand-700 px-4 py-1.5 text-center text-xs font-bold text-white">
          {announcementText}
        </div>
      )}
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="Cine Cruzeiro">
          <img src={assetPath("/images/logo.png")} alt="Cine Cruzeiro" className="h-14 w-auto object-contain sm:h-16" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-200 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/conta" className="inline-flex h-11 w-11 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Minha conta">
            <UserRound className="h-5 w-5" />
          </Link>
          <Link href={cartHref} className="relative inline-flex h-11 w-11 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Carrinho">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </Link>
          <Link href="/filmes" className="bg-gold-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
            Comprar ingresso
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Link href="/conta" className="inline-flex h-11 w-11 items-center justify-center text-slate-100" aria-label="Minha conta">
            <UserRound className="h-5 w-5" />
          </Link>
          <Link href={cartHref} className="relative inline-flex h-11 w-11 items-center justify-center text-slate-100" aria-label="Carrinho">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </Link>
          <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center text-white" aria-label="Abrir menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/8 bg-[#060a12] px-4 py-5 md:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col gap-4 text-base font-bold text-slate-100">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/conta" onClick={() => setOpen(false)}>Minha conta</Link>
            <Link href={cartHref} onClick={() => setOpen(false)}>Carrinho</Link>
            <Link href="/filmes" onClick={() => setOpen(false)} className="mt-2 bg-gold-400 px-5 py-3 text-center text-sm font-black text-slate-950">
              Comprar ingresso
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#050810] text-sm text-slate-400">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.35fr_1fr_1fr] lg:px-8">
        <div>
          <img src={assetPath("/images/logo.png")} alt="Cine Cruzeiro" className="h-16 w-auto" />
          <p className="mt-4 max-w-md leading-relaxed">
            Cinema de rua, sala única, preço justo e tecnologia para comprar sem complicação.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Cultura e lazer no bairro</p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">Programação</h3>
          <Link href="/filmes" className="block hover:text-white">Filmes em cartaz</Link>
          <Link href="/clube" className="block hover:text-white">Clube Cine Cruzeiro</Link>
          <Link href="/eventos" className="block hover:text-white">Eventos e sala fechada</Link>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">Compra rápida</h3>
          <Link href="/filmes" className="block hover:text-white">Comprar ingresso</Link>
          <Link href="/conta/ingressos" className="block hover:text-white">Meus ingressos</Link>
          <Link href="/checkout/carrinho/extras" className="block hover:text-white">Carrinho</Link>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© Cine Cruzeiro. Plataforma de vendas, bilheteria e relacionamento.</span>
          <span>Ingressos liberados somente após aprovação real do pagamento.</span>
        </div>
      </div>
    </footer>
  );
}
