"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { fetchCinemaContent } from "@/services/cinemaApi";
import type { CinemaContent } from "@/services/cinemaApi";
import { assetPath, checkoutCartsItemCount, readCheckoutCarts } from "@/utils/cinema";
import { CartDrawer } from "@/components/CartDrawer";

const navItems = [
  { href: "/filmes", label: "Filmes" },
  { href: "/clube", label: "Clube" },
  { href: "/eventos", label: "Eventos" },
];

type SiteHeaderProps = {
  settings?: CinemaContent["settings"];
  mutedPrimaryAction?: boolean;
  textPrimaryAction?: boolean;
};

export function SiteHeader({ settings, mutedPrimaryAction = false, textPrimaryAction = false }: SiteHeaderProps = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { cartCount } = useCartDestination();
  const [remoteContent, setRemoteContent] = useState<CinemaContent | null>(null);

  const effectiveSettings = settings || remoteContent?.settings;
  const showAnnouncement = effectiveSettings?.announcementEnabled === true;
  const announcementText = effectiveSettings?.announcementText?.trim();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    let mounted = true;
    fetchCinemaContent()
      .then((content) => {
        if (mounted) setRemoteContent(content);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener("cine-cruzeiro-open-cart", openCart);
    return () => window.removeEventListener("cine-cruzeiro-open-cart", openCart);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-40 bg-[#060a12]/92 backdrop-blur-xl">
      {showAnnouncement && announcementText && (
        <div className="border-b border-white/8 bg-brand-700 px-4 py-1.5 text-center text-xs font-bold text-white">
          {announcementText}
        </div>
      )}
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="Cine Cruzeiro">
          <img
            src={assetPath("/images/logo-header-compact.webp")}
            alt="Cine Cruzeiro"
            width={112}
            height={64}
            decoding="async"
            className="h-14 w-auto object-contain sm:h-16"
          />
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
          <button type="button" onClick={() => setCartOpen(true)} className="relative inline-flex h-11 w-11 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Abrir carrinho">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </button>
          <Link href="/filmes" className={`${textPrimaryAction ? "bg-transparent text-slate-300 hover:text-white" : mutedPrimaryAction ? "bg-white/8 text-slate-100 hover:bg-white/12" : "bg-gold-400 text-slate-950 hover:bg-gold-300"} px-5 py-3 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400`}>
            Comprar ingresso
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Link href="/conta" className="inline-flex h-11 w-11 items-center justify-center text-slate-100" aria-label="Minha conta">
            <UserRound className="h-5 w-5" />
          </Link>
          <button type="button" onClick={() => setCartOpen(true)} className="relative inline-flex h-11 w-11 items-center justify-center text-slate-100" aria-label="Abrir carrinho">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </button>
          <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="site-mobile-navigation">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-mobile-navigation" className="border-t border-white/8 bg-[#060a12] px-4 py-5 md:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col gap-4 text-base font-bold text-slate-100">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/conta" onClick={() => setOpen(false)}>Minha conta</Link>
            <button type="button" className="text-left" onClick={() => { setOpen(false); setCartOpen(true); }}>Carrinho</button>
            <Link href="/filmes" onClick={() => setOpen(false)} className={`${textPrimaryAction ? "bg-transparent text-slate-300" : mutedPrimaryAction ? "bg-white/8 text-white" : "bg-gold-400 text-slate-950"} mt-2 px-5 py-3 text-center text-sm font-black`}>
              Comprar ingresso
            </Link>
          </nav>
        </div>
      )}
    </header>
    <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} content={remoteContent} />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#050810] text-xs text-slate-400">
      <div className="mx-auto grid max-w-[1320px] gap-6 px-4 py-7 sm:px-6 md:grid-cols-[1.25fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <img
            src={assetPath("/images/logo-header-compact.webp")}
            alt="Cine Cruzeiro"
            width={112}
            height={64}
            loading="lazy"
            decoding="async"
            className="h-11 w-auto"
          />
          <p className="mt-3 max-w-sm leading-relaxed">
            Cinema de rua, sala única, preço justo e tecnologia para comprar sem complicação.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Cultura e lazer no bairro</p>
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
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("cine-cruzeiro-open-cart"))} className="block cursor-pointer text-left hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">Meu carrinho</button>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">Legal</h3>
          <Link href="/privacidade" className="block hover:text-white">Política de privacidade</Link>
          <Link href="/termos" className="block hover:text-white">Termos de uso</Link>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-3 text-xs text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© Cine Cruzeiro. Plataforma de vendas, bilheteria e relacionamento.</span>
          <span className="flex items-center gap-2 md:ml-auto md:justify-end md:text-right">
            <span>Desenvolvido por</span>
            <a href="https://lumixengine.com" target="_blank" rel="noreferrer" className="group inline-flex shrink-0 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400" aria-label="Acessar o site da LumixEngine">
              <img
                src={assetPath("/images/lumixengine-wordmark.svg")}
                alt="LumixEngine"
                width={128}
                height={43}
                loading="lazy"
                decoding="async"
                className="h-6 w-auto opacity-80 transition-opacity group-hover:opacity-100"
              />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function useCartDestination() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const carts = readCheckoutCarts();
      setCartCount(checkoutCartsItemCount(carts));
    };
    update();
    window.addEventListener("cine-cruzeiro-cart-updated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cine-cruzeiro-cart-updated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return { cartCount };
}
