"use client";

import React from "react";
import { Camera, Heart, Sparkles } from "lucide-react";

export function TraditionSection() {
  return (
    <section id="tradicao" className="relative w-full bg-brand-950 py-20 border-t border-brand-850">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-brand-700 bg-brand-900 shadow-2xl">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,64,175,0.28),rgba(8,13,26,0.96)_52%,rgba(250,204,21,0.14))]" />
              <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-400/30 bg-gold-400/10 text-gold-400">
                  <Camera className="h-8 w-8" />
                </div>
                <div className="mt-5 max-w-md space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-brand-300">
                    Fotografia real
                  </span>
                  <p className="text-sm font-semibold text-slate-200">
                    Placeholder para fachada clássica do Cine Cruzeiro ou sala de exibição.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-brand-300 border border-brand-500/30">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              <span>Tradição e Cultura</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              O cinema de rua que a cidade reconhece pelo nome.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Há décadas sendo o coração cultural da cidade. A mesma magia de sempre,
              agora com o conforto da tecnologia que você merece.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-brand-800 bg-brand-900/70 p-4">
              <Heart className="h-5 w-5 shrink-0 text-rose-400" />
              <p className="text-xs font-semibold leading-relaxed text-slate-200">
                Uma experiência local, afetiva e simples: escolha o filme, pague no Pix e receba
                seu ingresso digital pelo WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
