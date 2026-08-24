"use client";

import React from "react";
import { Zap, Clock, Popcorn, Heart, Sparkles, X, Check } from "lucide-react";

export function DifferentiatorsSection() {
  return (
    <section id="diferenciais" className="relative w-full bg-brand-950 py-20 border-t border-brand-850">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-brand-300 border border-brand-500/30">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span>A Revolução do Cinema Local</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Cinema Sem Estresse. <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-gold-400 bg-clip-text text-transparent">
              Adeus filas de shopping.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            Criamos o Cine Cruzeiro para devolver o prazer de ir ao cinema: rápido, acolhedor,
            pertinho da sua casa e com preço honesto de verdade.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          
          {/* Card 1 */}
          <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-6 space-y-4 transition-all duration-300 hover:border-brand-500 hover:-translate-y-1 hover:shadow-glow-blue">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
              <Zap className="h-6 w-6 text-gold-400" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-brand-300 tracking-wider">
                Taxa Zero
              </span>
              <h3 className="text-lg font-bold text-white">Compre em 30 Segundos</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              1. Escolha o filme. 2. Chame no WhatsApp. 3. Pague com PIX e receba seu ingresso digital na hora. Sem baixar apps pesados.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-6 space-y-4 transition-all duration-300 hover:border-brand-500 hover:-translate-y-1 hover:shadow-glow-blue">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
              <Clock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-brand-300 tracking-wider">
                Zero Espera
              </span>
              <h3 className="text-lg font-bold text-white">Sem Filas de 40 Minutos</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Esqueça as filas quilométricas de shopping. Nosso atendimento na bomboniere leva menos de 2 minutos.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-6 space-y-4 transition-all duration-300 hover:border-brand-500 hover:-translate-y-1 hover:shadow-glow-blue">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
              <Popcorn className="h-6 w-6 text-gold-400 fill-gold-400" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-gold-400 tracking-wider">
                Feita na Hora
              </span>
              <h3 className="text-lg font-bold text-white">Pipoca Quentinha e Justa</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Pipoca crocante estourada na manteiga fresca e combos que não custam o valor de um jantar.
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-6 space-y-4 transition-all duration-300 hover:border-brand-500 hover:-translate-y-1 hover:shadow-glow-blue">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-500/30 text-brand-400">
              <Heart className="h-6 w-6 text-rose-400" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-brand-300 tracking-wider">
                Foco no Bairro
              </span>
              <h3 className="text-lg font-bold text-white">Comunidade e Conforto</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Sala Cruzeiro única com som imersivo 7.1, projeção Laser 4K e a comodidade de estar no seu bairro.
            </p>
          </div>

        </div>

        {/* Direct Comparison Table (Cine Cruzeiro vs Cinema de Shopping) */}
        <div className="rounded-3xl border border-brand-700/60 bg-brand-900/90 p-6 sm:p-8 max-w-4xl mx-auto shadow-2xl">
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Cine Cruzeiro <span className="text-gold-400">vs</span> Redes de Shopping
            </h3>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              Veja por que mais de 12.000 pessoas já escolheram o cinema local
            </p>
          </div>

          <div className="space-y-3">
            {/* Row 1 */}
            <div className="grid grid-cols-12 items-center rounded-2xl bg-brand-950/80 p-3 sm:p-4 text-xs sm:text-sm border border-brand-800">
              <div className="col-span-5 sm:col-span-4 font-bold text-white">Taxa de Conveniência</div>
              <div className="col-span-4 sm:col-span-4 text-emerald-400 font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 shrink-0 stroke-[3]" />
                <span>R$ 0,00 (Grátis)</span>
              </div>
              <div className="col-span-3 sm:col-span-4 text-slate-400 flex items-center gap-1.5">
                <X className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="truncate">R$ 6 a R$ 12 por ingresso</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-12 items-center rounded-2xl bg-brand-950/80 p-3 sm:p-4 text-xs sm:text-sm border border-brand-800">
              <div className="col-span-5 sm:col-span-4 font-bold text-white">Preço do Combo Pipoca</div>
              <div className="col-span-4 sm:col-span-4 text-emerald-400 font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 shrink-0 stroke-[3]" />
                <span>Apenas R$ 25,00</span>
              </div>
              <div className="col-span-3 sm:col-span-4 text-slate-400 flex items-center gap-1.5">
                <X className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="truncate">R$ 45 a R$ 65</span>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-12 items-center rounded-2xl bg-brand-950/80 p-3 sm:p-4 text-xs sm:text-sm border border-brand-800">
              <div className="col-span-5 sm:col-span-4 font-bold text-white">Tempo Médio em Fila</div>
              <div className="col-span-4 sm:col-span-4 text-emerald-400 font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 shrink-0 stroke-[3]" />
                <span>Menos de 2 min</span>
              </div>
              <div className="col-span-3 sm:col-span-4 text-slate-400 flex items-center gap-1.5">
                <X className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="truncate">25 a 45 minutos</span>
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-12 items-center rounded-2xl bg-brand-950/80 p-3 sm:p-4 text-xs sm:text-sm border border-brand-800">
              <div className="col-span-5 sm:col-span-4 font-bold text-white">Ingresso pelo WhatsApp</div>
              <div className="col-span-4 sm:col-span-4 text-emerald-400 font-bold flex items-center gap-1.5">
                <Check className="h-4 w-4 shrink-0 stroke-[3]" />
                <span>Instantâneo</span>
              </div>
              <div className="col-span-3 sm:col-span-4 text-slate-400 flex items-center gap-1.5">
                <X className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="truncate">App pesado e cadastro longo</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
