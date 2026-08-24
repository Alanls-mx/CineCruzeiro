"use client";

import React, { useState } from "react";
import { Film, Ticket, Menu, X, Zap, ShoppingCart, UserRound } from "lucide-react";
import { assetPath } from "@/utils/cinema";

interface HeaderProps {
  settings?: {
    announcementEnabled?: boolean;
    announcementText?: string;
  };
  onOpenCheckoutForHighlight: () => void;
  onOpenCart: () => void;
  onOpenAccount: () => void;
  cartCount?: number;
}

export function Header({ settings, onOpenCheckoutForHighlight, onOpenCart, onOpenAccount, cartCount = 0 }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const announcementText =
    (settings?.announcementText || "Promoção permanente no Cine Cruzeiro - Ingressos a apenas R$ 10,00")
      .replace(/⚡/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-brand-950/90 shadow-[0_1px_0_rgba(148,163,184,0.12)] backdrop-blur-xl transition-all">
      {/* Top Announcement Bar (Royal Blue gradient with Gold Highlight) */}
      {settings?.announcementEnabled !== false && (
        <div className="bg-gradient-to-r from-brand-900 via-brand-700 to-brand-900 px-4 py-1.5 text-center text-xs font-bold text-white tracking-wide flex items-center justify-center gap-2 shadow-[inset_0_-1px_rgba(255,255,255,0.08)]">
          <span>{announcementText}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between">
          {/* Brand Logo: Official Image */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex min-w-[112px] items-center cursor-pointer group sm:min-w-[148px]"
          >
            <div className="relative flex items-center justify-center group-hover:scale-105 transition-transform">
              <img
                src={assetPath("/images/logo.png")}
                alt="Cine Cruzeiro - Cultura e Lazer"
                className="h-16 w-auto object-contain drop-shadow-xl sm:h-20 lg:h-[88px]"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-200">
            <button
              onClick={() => scrollToSection("em-cartaz")}
              className="hover:text-gold-400 transition-colors cursor-pointer"
            >
              Em Cartaz
            </button>
            <button
              onClick={() => scrollToSection("diferenciais")}
              className="hover:text-gold-400 transition-colors cursor-pointer"
            >
              Por Que o Cruzeiro?
            </button>
            <button
              onClick={() => scrollToSection("clube")}
              className="hover:text-brand-200 transition-colors cursor-pointer flex items-center gap-1.5 text-brand-300"
            >
              <Ticket className="h-4 w-4" />
              <span>Clube Cine Cruzeiro</span>
            </button>
          </nav>

          {/* CTA Button: Gold / Amber Contrast */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={onOpenAccount}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-900/80 text-brand-200 shadow-lg shadow-blue-950/10 transition-all hover:bg-brand-850 hover:text-white active:scale-95"
              aria-label="Minha conta"
            >
              <UserRound className="h-5 w-5" />
            </button>
            <button
              onClick={onOpenCart}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-900/80 text-brand-200 shadow-lg shadow-blue-950/10 transition-all hover:bg-brand-850 hover:text-white active:scale-95"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-black text-slate-950">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              onClick={onOpenCheckoutForHighlight}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-gold-400 to-gold-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-glow hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Ticket className="h-4 w-4 fill-slate-950 group-hover:rotate-12 transition-transform" />
              <span>Comprar Ingresso</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg bg-brand-900/80 p-2.5 text-slate-300 hover:text-white hover:bg-brand-850 transition-colors"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-950 px-6 py-6 space-y-4 animate-fade-in shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col space-y-3 text-base font-bold text-slate-200">
            <button
              onClick={() => scrollToSection("em-cartaz")}
              className="flex items-center gap-2 text-left py-2 hover:text-gold-400 transition-colors"
            >
              <Film className="h-5 w-5 text-brand-300" />
              <span>Filmes em Cartaz</span>
            </button>
            <button
              onClick={() => scrollToSection("diferenciais")}
              className="flex items-center gap-2 text-left py-2 hover:text-gold-400 transition-colors"
            >
              <Zap className="h-5 w-5 text-gold-400" />
              <span>Por Que o Cine Cruzeiro?</span>
            </button>
            <button
              onClick={() => scrollToSection("clube")}
              className="text-left py-2 text-brand-300 flex items-center gap-2"
            >
              <Ticket className="h-5 w-5" />
              <span>Clube Cine Cruzeiro</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCart();
              }}
              className="text-left py-2 text-slate-200 flex items-center gap-2"
            >
              <ShoppingCart className="h-5 w-5 text-brand-300" />
              <span>Carrinho{cartCount > 0 ? ` (${cartCount})` : ""}</span>
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAccount();
              }}
              className="text-left py-2 text-slate-200 flex items-center gap-2"
            >
              <UserRound className="h-5 w-5 text-brand-300" />
              <span>Minha Conta</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCheckoutForHighlight();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-400 py-3.5 text-sm font-black text-slate-950 shadow-glow"
            >
              <Ticket className="h-4 w-4 fill-slate-950" />
              <span>Comprar Ingresso Agora</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
