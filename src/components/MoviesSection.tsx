"use client";

import React, { useState } from "react";
import { Film, Calendar, Popcorn, Info } from "lucide-react";
import { Movie, Session } from "@/types";
import { MovieCard } from "./MovieCard";
import { calendarDayDate, calendarDayTitle } from "@/utils/cinema";

interface MoviesSectionProps {
  nowPlayingMovies: Movie[];
  upcomingMovies: Movie[];
  calendarDays?: Array<{
    isoDate: string;
    label: string;
    weekday: string;
    displayDate: string;
  }>;
  onOpenCheckout: (movie: Movie, session: Session) => void;
  onOpenTrailer: (youtubeId: string, title: string) => void;
}

export function MoviesSection({
  nowPlayingMovies,
  upcomingMovies,
  calendarDays = [],
  onOpenCheckout,
  onOpenTrailer,
}: MoviesSectionProps) {
  const [activeTab, setActiveTab] = useState<"NOW_PLAYING" | "UPCOMING">("NOW_PLAYING");
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const days = calendarDays.length
    ? calendarDays
    : [{ label: "Hoje", displayDate: "carregando", weekday: "hoje", isoDate: "" }];

  return (
    <section id="em-cartaz" className="relative w-full bg-brand-950 py-20 shadow-[inset_0_1px_rgba(148,163,184,0.08)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-3 py-1 text-xs font-bold text-brand-300 shadow-sm shadow-blue-950/10">
              <Film className="h-3.5 w-3.5" />
              <span>Programação da Semana</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              Filmes no Cine Cruzeiro
            </h2>
            <p className="text-sm text-slate-300 max-w-lg">
              Sala única climatizada, som Dolby 7.1 e projeção a laser 4K. Escolha sua sessão e garanta seu ingresso com Pix.
            </p>
          </div>

          {/* Tab Switcher: Royal Blue Highlight */}
          <div className="flex items-center rounded-lg bg-brand-900 p-1.5 shadow-xl shadow-blue-950/10 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("NOW_PLAYING")}
              className={`rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "NOW_PLAYING"
                    ? "bg-brand-600 text-white shadow-glow-blue"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Em Cartaz Hoje
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("UPCOMING")}
              className={`rounded-xl px-5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "UPCOMING"
                  ? "bg-brand-600 text-white shadow-glow-blue"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Em Breve
            </button>
          </div>
        </div>

        {/* Date Selector Pills (only in NOW_PLAYING tab) */}
        {activeTab === "NOW_PLAYING" && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-8 custom-scrollbar">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-300 pr-2 shrink-0">
              <Calendar className="h-4 w-4 text-gold-400" />
              <span>Dia:</span>
            </div>
            {days.map((day, idx) => (
              <button
                key={day.isoDate || day.label}
                type="button"
                onClick={() => setSelectedDay(idx)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedDay === idx
                    ? "bg-brand-600 text-white shadow-glow-blue"
                    : "bg-brand-900/80 text-slate-300 hover:bg-brand-850"
                }`}
              >
                <span>{calendarDayTitle(day, idx)}</span>
                <span
                  className={`text-[10px] ${
                    selectedDay === idx ? "text-brand-100 font-bold" : "text-slate-400"
                  }`}
                >
                  ({calendarDayDate(day)})
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Friendly Notice about Seating */}
        <div className="mb-8 rounded-lg bg-brand-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl shadow-blue-950/10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-600/20 p-2 text-brand-400 shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Como funciona o Cine Cruzeiro?</div>
              <div className="text-xs text-slate-300 font-medium">
                Sem poltronas numeradas: ocupação por ordem de chegada. Chegue com 15 min de antecedência!
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-gold-400 bg-gold-400/10 px-3 py-1.5 rounded-lg self-end sm:self-auto shadow-sm">
            <Popcorn className="h-4 w-4 fill-gold-400" />
            <span>Pipoca no balcão em 2 min</span>
          </div>
        </div>

        {/* Movies Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeTab === "NOW_PLAYING" ? (
            nowPlayingMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onOpenCheckout={onOpenCheckout}
                onOpenTrailer={onOpenTrailer}
              />
            ))
          ) : (
            upcomingMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onOpenCheckout={onOpenCheckout}
                onOpenTrailer={onOpenTrailer}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
