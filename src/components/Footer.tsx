"use client";

import React from "react";
import { Film, MapPin, Clock, Phone, Instagram, ShieldCheck, Popcorn, Sparkles } from "lucide-react";
import { assetPath } from "@/utils/cinema";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full bg-brand-950 border-t border-brand-850 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Column 1: Brand & Bio */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={assetPath("/images/logo.png")}
                alt="Cine Cruzeiro - Cultura e Lazer"
                className="h-12 w-auto object-contain drop-shadow-md"
              />
              <div>
                <span className="font-display text-xl font-black text-white">
                  CINE CRUZEIRO
                </span>
                <p className="text-[10px] text-brand-300 font-semibold uppercase tracking-wider">
                  Cultura e Lazer
                </p>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs font-normal">
              O cinema independente do seu bairro. Sala única com projeção Laser 4K, som Dolby 7.1,
              pipoca artesanal quentinha e zero burocracia de assentos.
            </p>
            <div className="flex items-center gap-2 text-brand-300 text-xs font-bold">
              <Sparkles className="h-4 w-4 text-gold-400" />
              <span>Ocupação por ordem de chegada</span>
            </div>
          </div>

          {/* Column 2: Location & Hours */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Localização & Horários
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
                <span className="text-slate-300">Rua do Cruzeiro, 450 - Bairro Cruzeiro, São Paulo - SP</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
                <div className="text-slate-300">
                  <p>Terça a Domingo: 13h30 às 23h00</p>
                  <p className="text-[11px] text-slate-500">Segunda-feira: Fechado para manutenção</p>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Contact & Direct Channels */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Fale Conosco
            </h4>
            <div className="space-y-2.5">
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-200 hover:text-emerald-400 transition-colors"
              >
                <Phone className="h-4 w-4 text-emerald-400" />
                <span>WhatsApp: (11) 99999-9999</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-200 hover:text-brand-300 transition-colors"
              >
                <Instagram className="h-4 w-4 text-brand-400" />
                <span>@cinecruzeiro.oficial</span>
              </a>
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Pagamento Seguro via Pix Direto</span>
              </div>
            </div>
          </div>

          {/* Column 4: Guarantees */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Nossa Promessa
            </h4>
            <div className="rounded-2xl border border-brand-800 bg-brand-900/80 p-4 space-y-2">
              <div className="flex items-center gap-2 text-white font-bold">
                <Popcorn className="h-4 w-4 text-gold-400 fill-gold-400" />
                <span>Pipoca de Verdade</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug font-normal">
                Estourada na manteiga fresca. Sem aromas artificiais e com preço que cabe no bolso.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-brand-850 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-slate-400">
          <p>© {currentYear} Cine Cruzeiro. Todos os direitos reservados. O cinema do seu bairro.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="hover:underline cursor-pointer">Meia-Entrada (Lei 12.933)</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer">Termos</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
