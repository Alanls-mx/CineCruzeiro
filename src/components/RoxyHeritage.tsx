import Link from "next/link";
import { assetPath } from "@/utils/cinema";

const listedProgram = "https://www.adorocinema.com/programacao/cinema-F0894/";

export function RoxyWelcome() {
  return (
    <section className="roxy-welcome relative isolate flex min-h-[620px] items-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${assetPath("/images/cine-roxy/auditorio.jpg")})` }} aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,8,9,.98)_0%,rgba(12,8,9,.88)_43%,rgba(12,8,9,.35)_100%)]" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6 lg:px-8">
        <p className="roxy-eyebrow">Passos · Minas Gerais · Desde 1945</p>
        <h1 className="mt-5 max-w-[780px] font-display text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-7xl">
          A tela que faz parte da história de Passos.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-relaxed text-stone-200">
          O Cine Roxy reúne gerações em torno do cinema no coração da cidade. Uma história que começou em 1945 e continua a cada sessão.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a href={listedProgram} className="roxy-primary inline-flex items-center px-6 py-4 text-sm font-black">Consultar horários ↗</a>
          <Link href="/#historia" className="inline-flex items-center border border-white/30 px-6 py-4 text-sm font-bold text-white transition hover:border-white">Conheça nossa história</Link>
        </div>
        <p className="mt-6 text-sm text-stone-300">Consulte a programação publicada. Os horários podem mudar.</p>
      </div>
    </section>
  );
}

export function RoxyHistory() {
  return (
    <section id="historia" className="roxy-history scroll-mt-24 border-t border-white/10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-[.42fr_.58fr] lg:items-center">
        <div>
          <p className="roxy-eyebrow">Nossa história</p>
          <h2 className="mt-5 font-display text-4xl font-black leading-tight text-white sm:text-5xl">De 1945 para a próxima sessão.</h2>
          <p className="mt-6 text-base leading-8 text-stone-300">
            Em 22 de novembro de 1945, José Figueiredo apresentou o Cine Roxy a Passos. A primeira sessão exibiu <em>Por Quem os Sinos Dobram</em>.
          </p>
          <p className="mt-4 text-base leading-8 text-stone-300">
            Desde então, o cinema segue como ponto de encontro para quem gosta de viver grandes histórias diante da tela.
          </p>
        </div>
        <div className="relative overflow-hidden border border-white/10 bg-[#130e0f]">
          <img src={assetPath("/images/cine-roxy/auditorio.jpg")} alt="Sala de exibição do Cine Roxy em Passos" width={1920} height={400} loading="lazy" className="h-[280px] w-full object-cover sm:h-[360px]" />
          <div className="flex items-center justify-between border-t border-[#a5302b] px-6 py-5 text-sm text-stone-200">
            <span>Praça Monsenhor Messias Bragança, 178 · Centro</span>
            <span className="font-black tracking-[.2em] text-[#ff6b5d]">PASSOS · MG</span>
          </div>
        </div>
      </div>
    </section>
  );
}
