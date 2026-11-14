"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ConcessionCampaignSlide } from "@/utils/concessionCampaign";
import { assetPath, money } from "@/utils/cinema";
import styles from "./HomeConcessionBanner.module.css";

export function HomeConcessionBanner({ slides }: { slides: ConcessionCampaignSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  if (!slides.length) return null;
  const slide = slides[index % slides.length];
  const move = (step: number) => setIndex((current) => (current + step + slides.length) % slides.length);

  return (
    <section
      className={styles.region}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques da bomboniere"
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
      <div className={styles.inner}>
        <div className={styles.eyebrow} aria-hidden="true"><span className={styles.spark} /> Bomboniere em destaque</div>
        <div key={slide.id} className={styles.slide}>
          <div className={styles.artwork}>
            <img src={assetPath(`/images/login-bomboniere/${slide.file}`)} alt="" width={1080} height={1080} />
          </div>
          <div className={styles.copy}>
            <span className={styles.kicker}>{slide.savings ? `Economize ${money(slide.savings)}` : slide.badge || "Para acompanhar seu filme"}</span>
            <strong className={styles.title}>{slide.name}</strong>
            <span className={styles.description}>Escolha na bomboniere e aproveite a sessão.</span>
          </div>
          <div className={styles.action}>
            <span className={styles.price}>{money(slide.price)}</span>
            <Link href="/filmes" className={styles.link} aria-label="Ver programação de filmes">
              <span className={styles.linkDesktop}>Ver programação</span><span className={styles.linkMobile}>Ver filmes</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        {slides.length > 1 && (
          <div className={styles.controls}>
            <button type="button" onClick={() => move(-1)} aria-label="Promoção anterior"><ChevronLeft size={18} aria-hidden="true" /></button>
            <span aria-hidden="true" className={styles.count}>{index + 1} / {slides.length}</span>
            <button type="button" onClick={() => move(1)} aria-label="Próxima promoção"><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">{slide.name}, {money(slide.price)}. Destaque {index + 1} de {slides.length}.</p>
    </section>
  );
}
