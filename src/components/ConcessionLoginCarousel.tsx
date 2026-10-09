"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCinemaContent } from "@/services/cinemaApi";
import { assetPath } from "@/utils/cinema";

const ARTWORKS = [
  { id: "combo-classico", name: "Combo Clássico", price: 25, file: "combo-classico.webp" },
  { id: "pipoca-grande", name: "Pipoca Grande", price: 18, file: "pipoca-grande.webp" },
  { id: "combo-familia", name: "Combo Família", price: 42, file: "combo-familia.webp" },
  { id: "nachos-queijo", name: "Nachos com Queijo", price: 17, file: "nachos-queijo.webp" },
];

export function ConcessionLoginCarousel() {
  const [slides, setSlides] = useState<typeof ARTWORKS>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const cinemaSlug = String(process.env.NEXT_PUBLIC_CINEMA_SLUG || "cinecruzeiro").toLowerCase();

  useEffect(() => {
    if (cinemaSlug !== "cinecruzeiro") return;
    let active = true;
    fetchCinemaContent()
      .then((content) => {
        if (!active) return;
        setSlides(ARTWORKS.filter((art) => content.concessions.some((item) => item.id === art.id && item.active !== false && Number(item.price) === art.price)));
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
  const signature = assetPath("/images/social-studio/cine-cruzeiro-assinatura-oficial.png");

  return (
    <section
      className="overflow-hidden bg-[#101827] lg:flex lg:h-[420px]"
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
    >
      <div className="flex min-h-[280px] flex-1 items-center justify-center sm:min-h-[340px] lg:min-h-0">
        {slide ? (
          <a href={assetPath(`/images/login-bomboniere/${slide.file}`)} target="_blank" rel="noopener noreferrer" className="block h-[280px] w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold-400 sm:h-[340px] lg:h-full" aria-label={`Abrir arte de ${slide.name} em tamanho completo`}>
            <img src={assetPath(`/images/login-bomboniere/${slide.file}`)} alt={`Arte da bomboniere: ${slide.name}`} width={1080} height={1080} className="h-full w-full object-contain" />
          </a>
        ) : (
          <p className="px-6 text-center text-sm font-semibold text-slate-300">Bomboniere Cine Cruzeiro</p>
        )}
      </div>
      <div className="flex min-h-20 items-center justify-between gap-4 border-t border-white/10 px-5 py-3 lg:w-44 lg:flex-col lg:items-start lg:border-l lg:border-t-0 lg:px-5 lg:py-6">
        <div>
          <p className="text-xs font-black uppercase text-gold-300">Bomboniere</p>
          <img src={signature} alt="Cine Cruzeiro" width={1280} height={1280} className="mt-2 h-auto max-h-12 w-auto max-w-24 object-contain lg:mt-5 lg:max-h-20 lg:max-w-32" />
        </div>
        {slides.length > 1 && (
          <div className="flex items-center gap-1" aria-label="Navegação das artes">
            <button type="button" onClick={() => move(-1)} className="grid h-11 w-11 place-items-center text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Arte anterior" title="Arte anterior"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-9 text-center text-xs tabular-nums text-slate-200">{index + 1}/{slides.length}</span>
            <button type="button" onClick={() => move(1)} className="grid h-11 w-11 place-items-center text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400" aria-label="Próxima arte" title="Próxima arte"><ChevronRight className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    </section>
  );
}
