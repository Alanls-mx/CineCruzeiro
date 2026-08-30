import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Film, Home, Ticket } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Página não encontrada | Cine Cruzeiro",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader mutedPrimaryAction />
      <main className="relative flex flex-1 items-center overflow-hidden border-y border-white/8">
        <div className="absolute inset-x-0 top-0 h-px bg-gold-400/60" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:items-center md:py-24 lg:px-8">
          <section aria-labelledby="not-found-title" className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-brand-300">Erro 404</p>
            <h1 id="not-found-title" className="mt-3 font-display text-4xl font-black leading-tight sm:text-5xl">
              Página não encontrada
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Este endereço pode ter mudado ou a página saiu de cartaz. A programação e seus ingressos continuam disponíveis.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/filmes"
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
              >
                <Film className="h-5 w-5" aria-hidden="true" />
                Ver programação
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                <Home className="h-5 w-5" aria-hidden="true" />
                Voltar ao início
              </Link>
              <Link
                href="/conta/ingressos"
                className="inline-flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-brand-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
              >
                <Ticket className="h-5 w-5" aria-hidden="true" />
                Meus ingressos
              </Link>
            </div>
          </section>

          <div className="relative mx-auto flex aspect-[4/3] w-full max-w-[420px] items-center justify-center border border-white/10 bg-[#0b1425] p-8 shadow-2xl shadow-black/30" aria-hidden="true">
            <div className="absolute inset-x-8 top-7 h-1 bg-gold-400" />
            <div className="text-center">
              <span className="block font-display text-8xl font-black leading-none text-brand-300 sm:text-9xl">404</span>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                <ArrowLeft className="h-4 w-4" />
                Sessão indisponível
              </span>
            </div>
            <div className="absolute inset-x-8 bottom-7 flex justify-between border-t border-dashed border-white/15 pt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              <span>Cine Cruzeiro</span>
              <span>Sala única</span>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
