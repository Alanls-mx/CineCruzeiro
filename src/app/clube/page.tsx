"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, CircleHelp, Popcorn, ShieldCheck, Sparkles, Ticket, UserRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { fetchCinemaContent, fetchSubscriptionPlans, subscribeToPlan } from "@/services/cinemaApi";
import type { CinemaContent, SubscriptionPlan } from "@/services/cinemaApi";
import { money, publicAssetPath } from "@/utils/cinema";

function uploadedImageUrl(value: string | undefined) {
  return publicAssetPath(value) || "";
}

export default function ClubePage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [settings, setSettings] = useState<CinemaContent["settings"]>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [busyPlan, setBusyPlan] = useState("");

  useEffect(() => {
    Promise.all([fetchSubscriptionPlans(), fetchCinemaContent()])
      .then(([plansResult, content]) => {
        setPlans(plansResult);
        setSettings(content.settings || {});
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.displayOrder || 100) - Number(b.displayOrder || 100)),
    [plans]
  );

  async function handleSubscribe(planId: string) {
    setBusyPlan(planId);
    setMessage("");
    try {
      const result = await subscribeToPlan(planId);
      const checkoutUrl = result.checkoutUrl || result.initPoint || "";
      if (checkoutUrl) {
        setMessage("Redirecionando para a assinatura recorrente no Mercado Pago...");
        window.location.assign(checkoutUrl);
        return;
      }
      setMessage(result.message || "Assinatura iniciada. Aguarde a confirmação do Mercado Pago para liberar seus créditos.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.";
      setMessage(text);
    } finally {
      setBusyPlan("");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader />
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
              <img src={uploadedImageUrl(settings.clubHeroImageUrl)} alt="Público em uma sala de cinema" className="absolute inset-0 h-full w-full object-cover" />
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
              <p className="text-sm font-bold text-brand-300">Cobrança recorrente via Mercado Pago</p>
            </div>
            {status === "loading" && <div className="h-72 skeleton-soft" />}
            {status === "error" && <p className="text-rose-200">Não foi possível carregar os planos do backend.</p>}
            {status === "ready" && (
              <div className="grid gap-6 md:grid-cols-2">
                {sortedPlans.map((plan) => (
                  <Plan key={plan.id} plan={plan} busy={busyPlan === plan.id} onSubscribe={() => handleSubscribe(plan.id)} />
                ))}
              </div>
            )}
            {message && <p className="mt-6 max-w-3xl text-sm font-semibold text-amber-200">{message}</p>}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1320px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="relative min-h-[320px] overflow-hidden rounded-[10px]">
            {uploadedImageUrl(settings.clubBannerImageUrl) ? (
              <img src={uploadedImageUrl(settings.clubBannerImageUrl)} alt="Sala de cinema iluminada antes da sessão" className="absolute inset-0 h-full w-full object-cover" />
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

function Plan({ plan, busy, onSubscribe }: { plan: SubscriptionPlan; busy: boolean; onSubscribe: () => void }) {
  return (
    <article className={`grid overflow-hidden rounded-[10px] bg-[#0d1728] shadow-2xl shadow-blue-950/20 lg:grid-cols-[.86fr_1fr] ${plan.isFeatured ? "ring-1 ring-gold-400/45" : ""}`}>
      <div className="relative min-h-[240px]">
        {plan.imageUrl ? (
          <img src={publicAssetPath(plan.imageUrl)} alt={`Imagem do ${plan.name}`} className="absolute inset-0 h-full w-full object-cover" />
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
        <button type="button" onClick={onSubscribe} disabled={busy} className="mt-8 w-full bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300 disabled:opacity-50">
          {busy ? "Verificando..." : `Assinar ${plan.name}`}
        </button>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Cobrança recorrente segura via Mercado Pago
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
