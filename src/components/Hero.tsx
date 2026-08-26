"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Play, Ticket, Sparkles, Clock, ShieldCheck, Zap, Popcorn, Smartphone, Film } from "lucide-react";
import { Movie, Session } from "@/types";
import { isUploadedAsset } from "@/utils/cinema";

interface HeroProps {
  movie: Movie;
  onOpenCheckout: (movie: Movie, session: Session) => void;
  onOpenTrailer: (youtubeId: string, title: string) => void;
}

export function Hero({ movie, onOpenCheckout, onOpenTrailer }: HeroProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(
    movie.sessions[0] || null
  );

  useEffect(() => {
    setSelectedSession(movie.sessions[0] || null);
  }, [movie]);

  return (
    <section className="relative w-full overflow-hidden bg-brand-950 pt-8 pb-16 md:py-20">
      {/* Background Deep Navy Texture */}
      <div className="absolute inset-0 z-[1] pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(37,99,235,0.28),transparent_32%),linear-gradient(135deg,rgba(3,7,18,0.96),rgba(12,24,48,0.88)_48%,rgba(3,7,18,0.98))]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/70 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Value Prop & Highlight Movie Info */}
          <div className="lg:col-span-7 space-y-6 text-left">
            
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600/25 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-brand-300 shadow-glow-blue">
                <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                {movie.tag || "Destaque da Semana"}
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-brand-900/80 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-blue-950/10">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                Taxa Zero no Pix
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-brand-900/80 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-blue-950/10">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
                Sem Filas de Shopping
              </span>
            </div>

            {/* Main Headline */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-brand-400">
                O Cinema do Seu Bairro • Sala Única Laser 4K
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
                {movie.title}
              </h1>
            </div>

            {/* Metadata (Age rating, Duration, Genres) */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-200">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-xs font-black text-white shadow-md">
                {movie.rating}
              </span>
              <span className="flex items-center gap-1 font-semibold text-white">
                <Clock className="h-4 w-4 text-gold-400" />
                {movie.duration}
              </span>
              <span className="text-brand-500">•</span>
              <div className="flex flex-wrap gap-1.5">
                {movie.genre.map((g) => (
                  <span
                    key={g}
                    className="rounded-md bg-brand-900/90 px-2 py-0.5 text-xs font-semibold text-brand-200 shadow-sm shadow-blue-950/10"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Movie Synopsis */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-normal">
              {movie.synopsis}
            </p>

            {/* Quick Session Picker */}
            <div className="rounded-lg bg-brand-900/70 p-5 backdrop-blur-xl shadow-2xl shadow-blue-950/40 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-brand-300">
                  Sessões de Hoje • Sala Cruzeiro
                </span>
                <span className="text-xs font-extrabold text-gold-400 bg-gold-400/10 px-2.5 py-0.5 rounded-full shadow-sm">
                  Ingresso R$ 10,00
                </span>
              </div>

              {/* Session Buttons with Royal Blue Selection */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {movie.sessions.map((session) => {
                  const isSelected = selectedSession?.id === session.id;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedSession(session)}
                      className={`relative flex flex-col items-center justify-center rounded-lg p-3 text-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-glow-blue font-bold scale-[1.02]"
                          : "bg-brand-950/90 text-slate-200 hover:bg-brand-900"
                      }`}
                    >
                      <span className="text-base sm:text-lg font-black">{session.time}</span>
                      <span
                        className={`text-[10px] mt-0.5 truncate max-w-full ${
                          isSelected ? "text-brand-100 font-bold" : "text-brand-400"
                        }`}
                      >
                        {session.format}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons: Gold CTA */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSession) {
                      onOpenCheckout(movie, selectedSession);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 via-gold-400 to-gold-500 py-4 px-6 text-sm sm:text-base font-black text-slate-950 shadow-glow hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Ticket className="h-5 w-5 fill-slate-950" />
                  <span>Comprar Ingresso Agora</span>
                </button>

                {movie.trailerYoutubeId && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenTrailer(movie.trailerYoutubeId!, movie.title)
                    }
                    className="flex items-center justify-center gap-2 rounded-lg bg-brand-850 py-4 px-5 text-sm font-bold text-white hover:bg-brand-700 active:scale-95 transition duration-200 cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-brand-400 text-brand-400" />
                    <span>Ver Trailer</span>
                  </button>
                )}
              </div>
            </div>

            {/* Correção de Contraste: Diferenciais Super Visíveis */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2">
              <div className="flex items-center gap-2 rounded-lg bg-brand-900/80 px-3.5 py-2 shadow-lg shadow-blue-950/10">
                <Popcorn className="h-5 w-5 text-gold-400 fill-gold-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white tracking-tight">
                  Pipoca artesanal na manteiga
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-brand-900/80 px-3.5 py-2 shadow-lg shadow-blue-950/10">
                <Smartphone className="h-5 w-5 text-brand-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white tracking-tight">
                  Entrada direto pelo celular
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Official Poster Placeholder */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group w-full max-w-sm">
              {/* Vibrant Royal Blue & Gold Glow Border */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-brand-600 via-brand-500 to-gold-400 opacity-40 blur-lg group-hover:opacity-75 transition duration-500" />
              
              <div className="relative overflow-hidden rounded-3xl bg-brand-900 shadow-2xl">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-brand-950">
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={`Pôster de ${movie.title}`}
                      fill
                      priority
                      unoptimized={isUploadedAsset(movie.posterUrl)}
                      sizes="(min-width: 1024px) 384px, 90vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 p-6">
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,64,175,0.3),rgba(3,7,18,0.95)_48%,rgba(250,204,21,0.2))]" />
                      <div className="relative flex h-full flex-col justify-between rounded-3xl bg-brand-900/80 p-6 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-400">
                          <Film className="h-8 w-8" />
                        </div>
                        <div className="space-y-4">
                          <div className="mx-auto h-px w-20 bg-gold-400/50" />
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-brand-300">
                              Pôster Oficial
                            </span>
                            <h2 className="mt-3 text-4xl font-black leading-tight text-white">
                              {movie.title}
                            </h2>
                          </div>
                          <p className="mx-auto max-w-[14rem] text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Arte do filme em breve
                          </p>
                        </div>
                        <div className="rounded-2xl bg-brand-950/80 px-4 py-3 text-xs font-bold text-brand-200">
                          Sala Cruzeiro • Laser 4K
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-950/95 to-transparent" />
                  
                  {/* Floating quick trailer trigger */}
                  {movie.trailerYoutubeId && (
                    <button
                      onClick={() => onOpenTrailer(movie.trailerYoutubeId!, movie.title)}
                      className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 group-hover:opacity-100 backdrop-blur-xs transition-opacity cursor-pointer"
                      aria-label="Assistir trailer"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/90 text-white shadow-glow-blue hover:scale-110 transition-transform">
                        <Play className="h-7 w-7 fill-white translate-x-0.5" />
                      </div>
                    </button>
                  )}
                </div>

                <div className="p-4 bg-brand-950 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-brand-300">Próxima Sessão</span>
                    <div className="text-sm font-black text-white">
                      Hoje às {movie.sessions[0]?.time}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (movie.sessions[0]) {
                        onOpenCheckout(movie, movie.sessions[0]);
                      }
                    }}
                    className="rounded-xl bg-gold-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-gold-300 transition-colors shadow-md"
                  >
                    Garantir Lugar
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
