import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { assetPath, cinemaBrand } from "@/utils/cinema";

const isGama = cinemaBrand().name === "Cine Gama";
export const metadata: Metadata = isGama ? {
  title: "Nossa história | Cine Gama, Colatina",
  description: "Conheça as raízes do Cine Gama no antigo Cine Alhambra, cinema de rua inaugurado no fim dos anos 1940 no Centro de Colatina.",
} : {};

export default function CinemaPage() {
  if (!isGama) redirect("/");
  return (
    <div className="min-h-dvh bg-[#100a20] text-white">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-[1320px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-black uppercase tracking-[.26em] text-[#ffb76c]">Cine Gama · Colatina, ES</p>
            <h1 className="mt-5 font-display text-5xl font-black leading-[1.05] sm:text-6xl">O cinema faz parte da cidade.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200">O Cine Gama está na Avenida Getúlio Vargas, no Centro de Colatina. Nesse espaço funcionou o Cine Alhambra, inaugurado no fim dos anos 1940. A fachada e a memória das sessões contam um capítulo da vida cultural da cidade.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/filmes" className="inline-flex min-h-12 items-center bg-[#ff9b42] px-6 text-sm font-black text-[#1c102b] transition hover:bg-[#ffb976]">Ver programação</Link>
              <a href="https://maps.google.com/?q=Cine+Gama+Avenida+Getulio+Vargas+481+Colatina" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center border border-white/25 px-6 text-sm font-bold text-white transition hover:border-[#ffb976]">Como chegar ↗</a>
            </div>
          </div>
          <div className="border border-[#f0a66d]/25 bg-[#1d112e] p-3 shadow-[0_30px_90px_rgba(0,0,0,.4)]">
            <Image src={assetPath("/images/cinema-editorial/cine-gama/history-marquee.svg")} alt="Ilustração autoral de uma entrada de cinema de rua, inspirada na memória do Cine Alhambra; não representa uma fotografia do edifício" width={960} height={560} className="h-auto w-full" priority />
            <p className="mt-2 px-1 text-xs text-slate-400">Ilustração conceitual. O registro histórico da fachada está nos acervos citados abaixo.</p>
          </div>
        </section>
        <section className="border-y border-white/10 bg-[#170e2a]">
          <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
            <Fact label="Origens" title="Final dos anos 1940" text="O Cine Alhambra foi inaugurado nesse período na avenida que atravessa o Centro." />
            <Fact label="Lugar" title="Av. Getúlio Vargas" text="O Cine Gama permanece ligado ao endereço histórico do cinema de rua de Colatina." />
            <Fact label="Hoje" title="Novas sessões, mesmo encontro" text="Consulte a programação atual e escolha sua próxima história na tela grande." />
          </div>
        </section>
        <section className="mx-auto max-w-[1320px] px-4 py-14 text-sm leading-7 text-slate-300 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-black text-white">Fontes da história</h2>
          <p className="mt-3 max-w-3xl">As datas e a ligação entre Cine Alhambra e Cine Gama foram conferidas em pesquisa do Instituto Federal do Espírito Santo. O acervo Cine Memória registra a fachada e a sala histórica. As imagens de época pertencem aos acervos indicados nas publicações e não foram reproduzidas aqui.</p>
          <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
            <a href="https://repositorio.ifes.edu.br/server/api/core/bitstreams/c2a6d96a-ba5b-4c1a-9cc7-3a304ce08c2b/content" target="_blank" rel="noreferrer" className="text-[#ffcd98] underline underline-offset-4">Pesquisa do Ifes ↗</a>
            <a href="https://mapa.cultura.es.gov.br/files/agent/3646/livro_memorias_fotografiacs_das_salas_de_cinema_do_es.pdf" target="_blank" rel="noreferrer" className="text-[#ffcd98] underline underline-offset-4">Cine Memória · acervo fotográfico ↗</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Fact({ label, title, text }: { label: string; title: string; text: string }) {
  return <div className="border-l border-[#ffb76c]/50 pl-5"><p className="text-xs font-black uppercase tracking-[.2em] text-[#ffb76c]">{label}</p><h3 className="mt-3 font-display text-2xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-300">{text}</p></div>;
}
