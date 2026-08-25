"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, CircleHelp, Popcorn, ShieldCheck, Sparkles, Ticket, UserRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { fetchCinemaContent, fetchSubscriptionPlans } from "@/services/cinemaApi";
import type { CinemaContent, SubscriptionPlan } from "@/services/cinemaApi";
import { money, publicAssetPath } from "@/utils/cinema";

function uploadedImageUrl(value: string | undefined) {
  return publicAssetPath(value) || "";
}

export default function ClubePage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [settings, setSettings] = useState<CinemaContent["settings"]>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  async function loadAvailablePlans() {
    setStatus("loading");
    try {
      const plansResult = await fetchSubscriptionPlans();
      setPlans(plansResult.filter((plan) => (
        plan.active !== false
        && Boolean(plan.id && plan.name)
        && Number(plan.monthlyPrice) > 0
        && Number(plan.includedTickets) > 0
      )));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadAvailablePlans();
    fetchCinemaContent()
      .then((content) => setSettings(content.settings || {}))
      .catch(() => setSettings({}));
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.displayOrder || 100) - Number(b.displayOrder || 100)),
    [plans]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader settings={settings} />
      <main className="flex-1 overflow-hidden">
        <section className="mx-auto grid max-w-[1040px] items-center gap-7 px-4 py-6 sm:px-6 md:grid-cols-[.9fr_.7fr] lg:px-8 lg:py-9">
          <div className="relative z-10 max-w-lg">
            <h1 className="font-display text-3xl font-black leading-[1.02] sm:text-4xl lg:text-5xl">
              Clube Cine Cruzeiro: cinema todo mês, sem pensar duas vezes.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
              Assine, receba créditos mensais e transforme a ida ao cinema em rotina de bairro: ingresso digital, benefícios na bomboniere e fila expressa.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="#planos" className="inline-flex min-h-[44px] items-center justify-center bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300">
                Ver planos
              </a>
              <Link href="/conta" className="inline-flex min-h-[44px] items-center justify-center bg-white/8 px-5 text-sm font-black text-white transition hover:bg-white/12">
                Minha conta
              </Link>
            </div>
          </div>
          <div className="relative min-h-[190px] overflow-hidden rounded-[10px] shadow-[0_18px_44px_rgba(0,0,0,.32)] sm:min-h-[220px] lg:min-h-[280px]">
            {uploadedImageUrl(settings.clubHeroImageUrl) ? (
              <Image
                src={uploadedImageUrl(settings.clubHeroImageUrl)}
                alt="Público em uma sala de cinema"
                fill
                priority
                quality={72}
                sizes="(max-width: 768px) 100vw, 44vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(37,99,235,.28),transparent_36%),linear-gradient(135deg,#0d1930,#030712)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_32%,rgba(6,10,18,.9))]" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <p className="max-w-[15rem] font-display text-lg font-black leading-tight sm:text-xl">Créditos prontos para a próxima sessão.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1040px] gap-5 px-4 py-5 sm:px-6 md:grid-cols-4 lg:px-8">
          <Benefit icon={<Ticket />} title="Ingressos mensais" text="Créditos renovados a cada ciclo para usar na programação." />
          <Benefit icon={<Popcorn />} title="Bomboniere" text="Benefícios e descontos em combos selecionados." />
          <Benefit icon={<CalendarCheck />} title="Escolha simples" text="Use no checkout quando sua assinatura estiver ativa." />
          <Benefit icon={<UserRound />} title="Controle pela conta" text="Histórico, créditos e ingressos ficam centralizados." />
        </section>

        <section id="planos" className="bg-[#091122]">
          <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="font-display text-3xl font-black sm:text-4xl">Escolha seu ritmo de cinema</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Planos recorrentes para quem vem sozinho, em casal ou divide a magia com a família.</p>
              </div>
              <div className="text-sm md:text-right">
                <p className="font-bold text-brand-300">Pix recorrente ou cartão de crédito/débito via Mercado Pago</p>
                <p className="mt-1 text-xs text-slate-400">O meio de pagamento é escolhido no checkout seguro.</p>
              </div>
            </div>
            {status === "loading" && <div className="h-72 skeleton-soft" />}
            {status === "error" && (
              <div className="flex flex-col items-start gap-4 bg-rose-950/20 p-5 text-rose-100 sm:flex-row sm:items-center sm:justify-between">
                <p>Não foi possível consultar os planos disponíveis agora.</p>
                <button type="button" onClick={() => void loadAvailablePlans()} className="min-h-[44px] bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/15">
                  Tentar novamente
                </button>
              </div>
            )}
            {status === "ready" && (
              sortedPlans.length ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {sortedPlans.map((plan) => (
                    <Plan key={plan.id} plan={plan} />
                  ))}
                </div>
              ) : (
                <div className="bg-white/[0.035] px-5 py-8 text-center">
                  <h3 className="font-display text-xl font-black">Nenhum plano disponível para assinatura</h3>
                  <p className="mt-2 text-sm text-slate-300">Os planos publicados no painel aparecerão aqui automaticamente.</p>
                </div>
              )
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1320px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="relative min-h-[320px] overflow-hidden rounded-[10px]">
            {uploadedImageUrl(settings.clubBannerImageUrl) ? (
              <Image
                src={uploadedImageUrl(settings.clubBannerImageUrl)}
                alt="Sala de cinema iluminada antes da sessão"
                fill
                quality={72}
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(250,204,21,.18),transparent_32%),linear-gradient(135deg,#0d1930,#030712)]" />
            )}
            <div className="absolute inset-0 bg-brand-950/25" />
          </div>
          <div className="self-center">
            <h2 className="font-display text-4xl font-black">Como funciona</h2>
            <div className="mt-8 grid gap-5">
              {["Assine o plano ideal.", "Receba seus créditos mensais.", "Escolha filme e sessão.", "Gere o ingresso sem nova cobrança."].map((item, index) => (
                <div key={item} className="grid grid-cols-[44px_1fr] items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-sm font-black text-slate-950">{index + 1}</span>
                  <p className="text-lg font-bold text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Faq title="Preciso ter conta?" text="Sim. A assinatura e os créditos ficam vinculados ao usuário para evitar uso inseguro." />
            <Faq title="Crédito vira ingresso na hora?" text="Ele aparece no pagamento do checkout quando a assinatura está ativa e com saldo disponível." />
            <Faq title="Posso comprar avulso?" text="Sim. O ingresso promocional continua disponível para quem prefere comprar sem assinatura." />
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-5 bg-brand-900/60 p-6 shadow-2xl shadow-blue-950/20 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl font-black">Pronto para voltar todo mês?</h2>
              <p className="mt-2 text-slate-300">Escolha seu plano e acompanhe tudo pela sua conta.</p>
            </div>
            <a href="#planos" className="inline-flex min-h-[52px] items-center justify-center bg-gold-400 px-7 text-sm font-black text-slate-950 transition hover:bg-gold-300">Assinar agora</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Plan({ plan }: { plan: SubscriptionPlan }) {
  return (
    <article className={`grid overflow-hidden rounded-[10px] bg-[#0d1728] shadow-2xl shadow-blue-950/20 lg:grid-cols-[.86fr_1fr] ${plan.isFeatured ? "ring-1 ring-gold-400/45" : ""}`}>
      <div className="relative min-h-[240px]">
        {plan.imageUrl ? (
          <Image
            src={publicAssetPath(plan.imageUrl)}
            alt={`Imagem do ${plan.name}`}
            fill
            quality={74}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 42vw, 280px"
            className="bg-brand-950 object-contain p-3"
          />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center bg-brand-950 text-gold-400"><Sparkles className="h-12 w-12" /></div>
        )}
        {plan.isFeatured && <span className="absolute left-4 top-4 bg-gold-400 px-3 py-2 text-xs font-black text-slate-950">Recomendado</span>}
      </div>
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-3xl font-black">{plan.name}</h3>
            <p className="mt-3 text-4xl font-black text-gold-400">{money(plan.monthlyPrice)}<span className="text-base text-slate-400"> / mês</span></p>
          </div>
          <span className="bg-brand-700 px-3 py-2 text-xs font-black text-white">{plan.includedTickets} ingressos/mês</span>
        </div>
        <ul className="mt-7 space-y-3 text-slate-300">
          {plan.benefits.map((item) => (
            <li key={item} className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Link href={`/clube/assinar/${encodeURIComponent(plan.id)}`} className="mt-8 flex min-h-[52px] w-full items-center justify-center bg-gold-400 px-7 py-4 text-center text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
          Assinar {plan.name}
        </Link>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Pix recorrente ou cartão de crédito/débito no Mercado Pago. Créditos após a aprovação.
        </p>
      </div>
    </article>
  );
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-gold-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div>
        <h2 className="font-display text-xl font-black">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function Faq({ title, text }: { title: string; text: string }) {
  return (
    <details className="group bg-white/[0.04] p-5 shadow-xl shadow-blue-950/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-black">
        {title}
        <CircleHelp className="h-5 w-5 text-gold-400 transition group-open:rotate-45" />
      </summary>
      <p className="mt-4 text-sm leading-6 text-slate-300">{text}</p>
    </details>
  );
}
