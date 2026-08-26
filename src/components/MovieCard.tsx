"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Play, Ticket, Clock, Film } from "lucide-react";
import { Movie, Session } from "@/types";
import { isUploadedAsset } from "@/utils/cinema";

interface MovieCardProps {
  movie: Movie;
  onOpenCheckout: (movie: Movie, session: Session) => void;
  onOpenTrailer: (youtubeId: string, title: string) => void;
}

export function MovieCard({ movie, onOpenCheckout, onOpenTrailer }: MovieCardProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(
    movie.sessions[0] || null
  );

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "L":
        return "bg-emerald-500 text-black";
      case "10":
        return "bg-blue-500 text-white";
      case "12":
        return "bg-yellow-500 text-black";
      case "14":
        return "bg-orange-500 text-white";
      case "16":
        return "bg-rose-600 text-white";
      case "18":
        return "bg-black text-white shadow-md shadow-rose-950/30";
      default:
        return "bg-slate-700 text-white";
    }
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-brand-900/85 shadow-2xl shadow-blue-950/20 transition duration-200 hover:-translate-y-1 hover:shadow-blue-950/40">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-brand-950">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={`Pôster de ${movie.title}`}
            fill
            unoptimized={isUploadedAsset(movie.posterUrl)}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 p-4">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,64,175,0.28),rgba(3,7,18,0.94)_48%,rgba(250,204,21,0.18))]" />
            <div className="relative flex h-full flex-col justify-between rounded-lg bg-brand-900/80 p-4 text-center shadow-inner">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gold-400/10 text-gold-400">
                <Film className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <div className="mx-auto h-px w-16 bg-gold-400/50" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-300">
                    Pôster Oficial
                  </span>
                  <h3 className="mt-2 line-clamp-3 text-2xl font-black leading-tight text-white">
                    {movie.title}
                  </h3>
                </div>
                <p className="mx-auto max-w-[12rem] text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Arte do filme em breve
                </p>
              </div>
              <div className="rounded-lg bg-brand-950/80 px-3 py-2 text-[11px] font-bold text-brand-200">
                Cine Cruzeiro
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-brand-950/95 to-transparent" />

        {/* Tag / Badge */}
        {movie.tag && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-600/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
              {movie.tag}
            </span>
          </div>
        )}

        {/* Age rating */}
        <div className="absolute top-3 right-3">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black shadow-md ${getRatingColor(
              movie.rating
            )}`}
          >
            {movie.rating}
          </span>
        </div>

        {/* Trailer play button overlay */}
        {movie.trailerYoutubeId && (
          <button
            onClick={() => onOpenTrailer(movie.trailerYoutubeId!, movie.title)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-brand-950/80 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-lg transition duration-200 hover:bg-brand-600 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-brand-400 text-brand-400" />
            <span>Trailer</span>
          </button>
        )}
      </div>

      {/* Movie Details */}
      <div className="flex flex-1 flex-col p-5 space-y-4">
        <div className="min-h-[82px]">
          <div className="flex items-center gap-2 text-xs text-brand-300 font-medium">
            <span className="flex items-center gap-1 text-slate-200">
              <Clock className="h-3.5 w-3.5 text-gold-400" />
              {movie.duration}
            </span>
            <span>•</span>
            <span className="truncate text-slate-300">{movie.genre.join(", ")}</span>
          </div>

          <h3 className="mt-1.5 text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-brand-300 transition-colors">
            {movie.title}
          </h3>
        </div>

        {/* Sessions list */}
        {movie.sessions.length > 0 ? (
          <div className="min-h-[128px] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-brand-300">
              <span>Sessões Disponíveis (Hoje):</span>
              <span className="text-gold-400">R$ 10,00</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {movie.sessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setSelectedSession(session);
                      onOpenCheckout(movie, session);
                    }}
                    className={`flex min-h-[54px] flex-col items-center justify-center rounded-lg p-2 text-center transition duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-brand-600/40 text-white font-bold shadow-glow-blue"
                        : "bg-brand-950/80 text-slate-200 hover:bg-brand-850"
                    }`}
                  >
                    <span className="text-sm font-black">{session.time}</span>
                    <span className="text-[10px] text-brand-300 truncate max-w-full">
                      {session.format}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[128px] items-center justify-center rounded-lg bg-brand-950/60 p-3 text-center">
            <span className="text-xs font-semibold text-slate-400">
              Estreia em breve no Cine Cruzeiro
            </span>
          </div>
        )}

        {/* CTA Button: Gold / Yellow for High Conversion */}
        <div className="mt-auto pt-2">
          {movie.sessions.length > 0 ? (
            <button
              onClick={() => {
                if (selectedSession) {
                  onOpenCheckout(movie, selectedSession);
                }
              }}
              className="w-full flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-gold-400 py-3 text-xs font-black text-slate-950 hover:bg-gold-300 active:scale-95 transition-all cursor-pointer shadow-glow"
            >
              <Ticket className="h-4 w-4 fill-slate-950" />
              <span>Comprar Ingresso</span>
            </button>
          ) : (
            <button
              disabled
              className="w-full min-h-[46px] rounded-lg bg-slate-800 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
            >
              Aguardando Sessões
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
