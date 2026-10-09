"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchCinemaContent } from "@/services/cinemaApi";
import { assetPath } from "@/utils/cinema";
import styles from "./ConcessionLoginCarousel.module.css";

const ARTWORKS = [
  { id: "combo-classico", name: "Combo Clássico", price: 25, file: "combo-classico.webp" },
  { id: "pipoca-grande", name: "Pipoca Grande", price: 18, file: "pipoca-grande.webp" },
  { id: "combo-familia", name: "Combo Família", price: 42, file: "combo-familia.webp" },
  { id: "nachos-queijo", name: "Nachos com Queijo", price: 17, file: "nachos-queijo.webp" },
];

type Slide = (typeof ARTWORKS)[number] & {
  badge?: string;
  savings?: number;
  offerEndsAt?: string;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function offerDeadline(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

export function ConcessionLoginCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cinemaSlug = String(process.env.NEXT_PUBLIC_CINEMA_SLUG || "cinecruzeiro").toLowerCase();

  useEffect(() => {
    if (cinemaSlug !== "cinecruzeiro") return;
    let active = true;
    fetchCinemaContent()
      .then((content) => {
        if (!active) return;
        setSlides(ARTWORKS.flatMap((art) => {
          const product = content.concessions.find((item) => item.id === art.id && item.active !== false && Number(item.price) === art.price);
          if (!product) return [];
          const compareAt = Number(product.compareAt || 0);
          const savings = compareAt > product.price ? compareAt - product.price : undefined;
          const offer = content.promotions.find((item) => item.active !== false && !item.couponCode && String(item.concessionId || item.productId || "") === product.id);
          return [{ ...art, badge: product.badge, savings, offerEndsAt: typeof offer?.endsAt === "string" ? offer.endsAt : undefined }];
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [cinemaSlug]);

  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  if (cinemaSlug !== "cinecruzeiro") {
    return (
      <div className="flex min-h-[280px] items-end bg-brand-900/40 p-6 sm:min-h-[340px] sm:p-8 lg:min-h-[420px] lg:p-10">
        <p className="max-w-md text-lg font-black leading-tight sm:text-2xl">Seus ingressos digitais ficam reunidos em um só lugar, prontos para validar na entrada.</p>
      </div>
    );
  }

  const slide = slides[index];
  const move = (step: number) => setIndex((current) => (current + step + slides.length) % slides.length);
  const deadline = offerDeadline(slide?.offerEndsAt);

  return (
    <section
      className="w-full max-w-[520px] justify-self-center"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Artes da bomboniere"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      onKeyDown={(event) => {
        if (slides.length < 2) return;
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null || slides.length < 2) return;
        const distance = event.changedTouches[0]?.clientX - touchStartX.current;
        if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#101827]">
        {slide ? (
          <div key={slide.id} className={`${styles.slide} h-full w-full`}>
            <a href={assetPath(`/images/login-bomboniere/${slide.file}`)} target="_blank" rel="noopener noreferrer" className="block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold-400" aria-label={`Abrir arte de ${slide.name} em tamanho completo`}>
              <img src={assetPath(`/images/login-bomboniere/${slide.file}`)} alt={`Arte da bomboniere: ${slide.name}`} width={1080} height={1080} className="block h-full w-full object-cover" />
            </a>
            {(slide.savings || slide.badge) && (
              <div className={`${styles.offer} absolute right-[4%] top-[29%] max-w-[43%] border border-white/20 bg-[#07111c]/85 px-3 py-2 text-right text-white shadow-[0_8px_24px_rgba(0,0,0,.3)] backdrop-blur-sm sm:px-4 sm:py-3`}>
                <p className="text-[10px] font-black uppercase text-[#ffda62] sm:text-xs">{slide.savings ? "Oferta na bomboniere" : slide.badge}</p>
                {slide.savings && <p className="mt-0.5 text-sm font-black sm:text-lg">Economize {currency.format(slide.savings)}</p>}
                {deadline && <p className="mt-1 text-[10px] text-white/90 sm:text-xs">Até {deadline}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-slate-300">Bomboniere Cine Cruzeiro</div>
        )}
        {slides.length > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-[#07111c]/65 text-white transition-colors hover:bg-[#07111c]/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Arte anterior" title="Arte anterior"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => move(1)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-[#07111c]/65 text-white transition-colors hover:bg-[#07111c]/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Próxima arte" title="Próxima arte"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-[3%] left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden="true">
              {slides.map((item, position) => <span key={item.id} className={`h-1 w-3 rounded-full ${position === index ? "bg-[#ffda62]" : "bg-white/45"}`} />)}
            </div>
          </>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{slide ? `${slide.name}, arte ${index + 1} de ${slides.length}${slide.savings ? `, oferta: economize ${currency.format(slide.savings)}` : ""}${deadline ? `, até ${deadline}` : ""}` : "Carregando artes da bomboniere"}</p>
    </section>
  );
}
