"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { fetchCinemaContent } from "@/services/cinemaApi";
import type { CinemaContent } from "@/services/cinemaApi";
import { assetPath, cinemaBrand, clearObsoleteCheckoutStorage } from "@/utils/cinema";

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
  const brand = cinemaBrand();
  const isRoxy = brand.name === "Cine Roxy";
  const activeNavItems = isRoxy
    ? [{ href: "/#historia", label: "Nossa história" }, { href: "/#localizacao", label: "Como chegar" }]
    : navItems;
  const programHref = isRoxy ? "https://www.adorocinema.com/programacao/cinema-F0894/" : "/filmes";
  const brandLogo = isRoxy
    ? assetPath("/images/cine-roxy/logo-horizontal.svg")
    : brand.name === "Cine Estação Amparo"
    ? assetPath("/images/cine-estacao/logo.webp?brand=estacao-amparo-v1")
    : assetPath("/images/logo-header-compact.webp?brand=cinecruzeiro-goldstars-v2-2026");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [remoteContent, setRemoteContent] = useState<CinemaContent | null>(null);

  const effectiveSettings = settings || remoteContent?.settings;
  const showAnnouncement = effectiveSettings?.announcementEnabled === true
    && !(isRoxy && /promoção permanente.*10,00/i.test(effectiveSettings?.announcementText || ""));
  const announcementText = effectiveSettings?.announcementText?.trim();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => clearObsoleteCheckoutStorage(), []);

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

  return (
    <header className="sticky top-0 z-40 bg-[#060a12]/92 backdrop-blur-xl">
      {showAnnouncement && announcementText && (
        <div className="border-b border-white/8 bg-brand-700 px-4 py-1.5 text-center text-xs font-bold text-white">
          {announcementText}
        </div>
      )}
      <div className="mx-auto flex h-20 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label={brand.name}>
          <img
            src={brandLogo}
            alt={brand.name}
            width={208}
            height={56}
            decoding="async"
            className="h-12 w-auto object-contain sm:h-16"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-200 md:flex">
          {activeNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-gold-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!isRoxy && <Link href="/conta" className="inline-flex h-11 w-11 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Minha conta">
            <UserRound className="h-5 w-5" />
          </Link>}
          <Link href={programHref} className={`${textPrimaryAction ? "bg-transparent text-slate-300 hover:text-white" : mutedPrimaryAction ? "bg-white/8 text-slate-100 hover:bg-white/12" : "bg-gold-400 text-slate-950 hover:bg-gold-300"} px-5 py-3 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400`}>
            {isRoxy ? "Ver horários" : "Comprar ingresso"}
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {!isRoxy && <Link href="/conta" className="inline-flex h-11 w-11 items-center justify-center text-slate-100" aria-label="Minha conta">
            <UserRound className="h-5 w-5" />
          </Link>}
          <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="site-mobile-navigation">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-mobile-navigation" className="border-t border-white/8 bg-[#060a12] px-4 py-5 md:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col gap-4 text-base font-bold text-slate-100">
          {activeNavItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            {!isRoxy && <Link href="/conta" onClick={() => setOpen(false)}>Minha conta</Link>}
            <Link href={programHref} onClick={() => setOpen(false)} className={`${textPrimaryAction ? "bg-transparent text-slate-300" : mutedPrimaryAction ? "bg-white/8 text-white" : "bg-gold-400 text-slate-950"} mt-2 px-5 py-3 text-center text-sm font-black`}>
              {isRoxy ? "Ver horários" : "Comprar ingresso"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const brand = cinemaBrand();
  const isRoxy = brand.name === "Cine Roxy";
  const showLocation = brand.name === "Cine Gama" || isRoxy;
  const mapQuery = isRoxy
    ? "Cine Roxy, Praça Monsenhor Messias Bragança, 178, Centro, Passos, MG"
    : "Cine Gama, Av. Getúlio Vargas, 481, Centro, Colatina, ES";
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const mapDirectionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const brandLogo = isRoxy
    ? assetPath("/images/cine-roxy/logo-horizontal.svg")
    : brand.name === "Cine Estação Amparo"
    ? assetPath("/images/cine-estacao/logo.webp?brand=estacao-amparo-v1")
    : assetPath("/images/logo-header-compact.webp?brand=cinecruzeiro-goldstars-v2-2026");
  return (
    <footer className="border-t border-white/8 bg-[#050810] text-xs text-slate-400">
      <div className={`mx-auto grid max-w-[1320px] gap-6 px-4 py-7 sm:px-6 lg:px-8 ${showLocation ? "md:grid-cols-2 lg:grid-cols-[1.2fr_.85fr_.85fr_.7fr_1.5fr]" : "md:grid-cols-[1.25fr_1fr_1fr_1fr]"}`}>
        <div>
          <img
            src={brandLogo}
            alt={brand.name}
            width={155}
            height={44}
            loading="lazy"
            decoding="async"
            className="h-11 w-auto"
          />
          <p className="mt-3 max-w-sm leading-relaxed">
            {brand.footerDescription}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[.16em] text-slate-400">{brand.footerSignature}</p>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">Programação</h3>
          {isRoxy ? (
            <>
              <a href="https://www.adorocinema.com/programacao/cinema-F0894/" className="block hover:text-white">Programação publicada ↗</a>
              <Link href="/#historia" className="block hover:text-white">Nossa história</Link>
            </>
          ) : (
            <>
              <Link href="/filmes" className="block hover:text-white">Filmes em cartaz</Link>
              <Link href="/clube" className="block hover:text-white">{brand.clubLabel}</Link>
              <Link href="/eventos" className="block hover:text-white">Eventos e sala fechada</Link>
            </>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">{isRoxy ? "Visite o cinema" : "Compra rápida"}</h3>
          {isRoxy ? (
            <>
              <a href="https://www.adorocinema.com/programacao/cinema-F0894/" className="block hover:text-white">Ver horários ↗</a>
              <a href={mapDirectionsUrl} target="_blank" rel="noopener noreferrer" className="block hover:text-white">Como chegar ↗</a>
            </>
          ) : (
            <>
              <Link href="/filmes" className="block hover:text-white">Comprar ingresso</Link>
              <Link href="/conta/ingressos" className="block hover:text-white">Meus ingressos</Link>
            </>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white">Legal</h3>
          <Link href="/privacidade" className="block hover:text-white">Política de privacidade</Link>
          <Link href="/termos" className="block hover:text-white">Termos de uso</Link>
        </div>
        {showLocation && (
          <div id={isRoxy ? "localizacao" : undefined} className="space-y-2 md:col-span-2 lg:col-span-1">
            <h3 className="font-bold text-white">Onde estamos</h3>
            {isRoxy ? (
              <a href={mapDirectionsUrl} target="_blank" rel="noopener noreferrer" className="flex h-36 flex-col justify-end rounded-lg border border-[#a5302b]/40 bg-[radial-gradient(circle_at_68%_30%,rgba(198,46,35,.23),transparent_55%),#1b1112] p-4 text-white transition hover:border-[#ee5144]">
                <span className="text-2xl text-[#f35b4d]">⌖</span>
                <span className="mt-2 text-xs font-black uppercase tracking-[.16em]">Centro de Passos</span>
                <span className="mt-1 text-xs text-stone-300">Abrir no Google Maps ↗</span>
              </a>
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#171127]">
                <iframe
                  title={`Mapa do ${brand.name}`}
                  src={mapEmbedUrl}
                  className="block h-36 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
            <a href={mapDirectionsUrl} target="_blank" rel="noopener noreferrer" className="block leading-relaxed text-slate-300 underline-offset-4 hover:text-white hover:underline">
              {isRoxy ? "Praça Monsenhor Messias Bragança, 178 · Centro, Passos–MG ↗" : "Av. Getúlio Vargas, 481 · Centro, Colatina–ES ↗"}
            </a>
          </div>
        )}
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-3 text-xs text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>© {brand.name}. {brand.footerSummary}</span>
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
