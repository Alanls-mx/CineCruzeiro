"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Check, ChevronDown, ChevronLeft, ChevronRight, Popcorn, ShieldCheck, Sparkles, Ticket, UserRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { fetchCinemaContent, fetchSubscriptionPlans } from "@/services/cinemaApi";
import type { CinemaContent, SubscriptionPlan } from "@/services/cinemaApi";
import { isUploadedAsset, money, publicAssetPath } from "@/utils/cinema";

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

  const carouselPlans = useMemo(
    () => arrangePlansForCarousel(plans),
    [plans]
  );
  const preserveTransparentImages = settings.clubTransparentImages === true;

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
          <div className={`relative min-h-[190px] overflow-hidden rounded-[10px] shadow-[0_18px_44px_rgba(0,0,0,.32)] sm:min-h-[220px] lg:min-h-[280px] ${preserveTransparentImages ? "bg-[#091122]" : ""}`}>
            {uploadedImageUrl(settings.clubHeroImageUrl) ? (
              <Image
                src={uploadedImageUrl(settings.clubHeroImageUrl)}
                alt="Público em uma sala de cinema"
                fill
                priority
                unoptimized={isUploadedAsset(settings.clubHeroImageUrl)}
                quality={72}
                sizes="(max-width: 768px) 100vw, 44vw"
                className={preserveTransparentImages ? "object-contain p-4 sm:p-6" : "object-cover"}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(37,99,235,.28),transparent_36%),linear-gradient(135deg,#0d1930,#030712)]" />
            )}
            <div className={`absolute inset-0 ${preserveTransparentImages ? "bg-[linear-gradient(180deg,transparent_58%,rgba(6,10,18,.88))]" : "bg-[linear-gradient(180deg,transparent_32%,rgba(6,10,18,.9))]"}`} />
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
                <p className="font-bold text-brand-300">Assinatura no cartão de crédito via Mercado Pago</p>
                <p className="mt-1 text-xs text-slate-400">Cobrança recorrente autorizada no checkout seguro.</p>
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
              carouselPlans.length ? (
                <PlansCarousel plans={carouselPlans} />
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
          <div className={`relative min-h-[320px] overflow-hidden rounded-[10px] ${preserveTransparentImages ? "bg-[#091122]" : ""}`}>
            {uploadedImageUrl(settings.clubBannerImageUrl) ? (
              <Image
                src={uploadedImageUrl(settings.clubBannerImageUrl)}
                alt="Sala de cinema iluminada antes da sessão"
                fill
                unoptimized={isUploadedAsset(settings.clubBannerImageUrl)}
                quality={72}
                sizes="(max-width: 1024px) 100vw, 45vw"
                className={preserveTransparentImages ? "object-contain p-5 sm:p-8" : "object-cover"}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(250,204,21,.18),transparent_32%),linear-gradient(135deg,#0d1930,#030712)]" />
            )}
            <div className={`absolute inset-0 ${preserveTransparentImages ? "bg-brand-950/5" : "bg-brand-950/25"}`} />
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

function arrangePlansForCarousel(plans: SubscriptionPlan[]) {
  const indexedPlans = plans.map((plan, index) => ({ plan, index }));
  const byPriorityAscending = (a: typeof indexedPlans[number], b: typeof indexedPlans[number]) => (
    Number(a.plan.displayOrder ?? 100) - Number(b.plan.displayOrder ?? 100) || a.index - b.index
  );
  const recommended = indexedPlans
    .filter(({ plan }) => plan.isFeatured)
    .sort((a, b) => Number(b.plan.displayOrder ?? 100) - Number(a.plan.displayOrder ?? 100) || a.index - b.index)[0];

  if (!recommended) {
    return indexedPlans.sort(byPriorityAscending).map(({ plan }) => plan);
  }

  const remaining = indexedPlans.filter(({ index }) => index !== recommended.index).sort(byPriorityAscending);
  if (!remaining.length) return [recommended.plan];

  const lowest = remaining.shift();
  const highest = remaining.pop();
  return [
    ...remaining,
    ...(lowest ? [lowest] : []),
    recommended,
    ...(highest ? [highest] : []),
  ].map(({ plan }) => plan);
}

function PlansCarousel({ plans }: { plans: SubscriptionPlan[] }) {
  const featuredIndex = Math.max(0, plans.findIndex((plan) => plan.isFeatured));
  const [activeIndex, setActiveIndex] = useState(featuredIndex);
  const planRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    setActiveIndex(featuredIndex);
  }, [featuredIndex, plans]);

  const selectPlan = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const normalizedIndex = (index + plans.length) % plans.length;
    setActiveIndex(normalizedIndex);
    planRefs.current[normalizedIndex]?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  }, [plans.length]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => selectPlan(featuredIndex, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [featuredIndex, selectPlan]);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Planos do Clube Cine Cruzeiro"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          selectPlan(activeIndex - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          selectPlan(activeIndex + 1);
        }
      }}
    >
      {plans.length > 1 && (
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-between sm:flex">
          <button
            type="button"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#111b2d]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] transition hover:bg-[#1b2940] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
            aria-label="Mostrar plano anterior"
            title="Plano anterior"
            onClick={() => selectPlan(activeIndex - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#111b2d]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] transition hover:bg-[#1b2940] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
            aria-label="Mostrar próximo plano"
            title="Próximo plano"
            onClick={() => selectPlan(activeIndex + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="overflow-hidden">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[6%] pb-7 pt-2 [scrollbar-width:none] sm:gap-6 sm:px-[12%] lg:px-[21%] xl:px-[25%] [&::-webkit-scrollbar]:hidden">
          {plans.map((plan, index) => (
            <Plan
              key={plan.id}
              plan={plan}
              active={index === activeIndex}
              position={index + 1}
              total={plans.length}
              setRef={(element) => { planRefs.current[index] = element; }}
              onSelect={() => selectPlan(index)}
            />
          ))}
        </div>
      </div>

      {plans.length > 1 && (
        <div className="flex items-center justify-center gap-2" aria-label="Selecionar plano">
          {plans.map((plan, index) => (
            <button
              key={plan.id}
              type="button"
              className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 ${index === activeIndex ? "w-8 bg-gold-400" : "w-2.5 bg-slate-600 hover:bg-slate-400"}`}
              aria-label={`Mostrar ${plan.name}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => selectPlan(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Plan({ plan, active, position, total, setRef, onSelect }: {
  plan: SubscriptionPlan;
  active: boolean;
  position: number;
  total: number;
  setRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
}) {
  const configuredBenefits = [
    ...(plan.freeConcessionItems?.length ? [`${plan.freeConcessionItems.length} benefício(s) grátis na bomboniere por ciclo`] : []),
    ...(plan.benefits || []).map((item) => item.replace(/\bgratis\b/gi, "grátis")),
  ].filter((item, index, items) => items.indexOf(item) === index);
  return (
    <article
      ref={setRef}
      className={`shrink-0 snap-center overflow-hidden rounded-[12px] bg-[#0d1728] shadow-[0_22px_54px_rgba(0,0,0,.34)] transition-[transform,filter,opacity] duration-500 ease-out ${active ? "relative z-10 scale-100 opacity-100" : "scale-[.94] cursor-pointer opacity-45 blur-[.7px] hover:opacity-65"} ${plan.isFeatured ? "ring-1 ring-gold-400/65" : "ring-1 ring-white/10"}`}
      style={{ width: "min(88vw, 760px)", flexBasis: "min(88vw, 760px)" }}
      aria-label={`${plan.name}, plano ${position} de ${total}`}
      aria-current={active ? "true" : undefined}
      onClick={() => { if (!active) onSelect(); }}
      onFocusCapture={() => { if (!active) onSelect(); }}
    >
      <div className="grid items-start md:grid-cols-[minmax(190px,.78fr)_minmax(0,1.22fr)]">
      <div className="relative aspect-[4/5] w-full self-start bg-[#050914] md:aspect-[3/4]">
        {plan.imageUrl ? (
          <Image
            src={publicAssetPath(plan.imageUrl)}
            alt={`Imagem do ${plan.name}`}
            fill
            unoptimized={isUploadedAsset(plan.imageUrl)}
            quality={74}
            sizes="(max-width: 767px) 78vw, (max-width: 1280px) 32vw, 300px"
            className="object-contain p-3 sm:p-4"
          />
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center bg-brand-950 text-gold-400"><Sparkles className="h-12 w-12" /></div>
        )}
        {plan.isFeatured && <span className="absolute left-4 top-4 bg-gold-400 px-3 py-2 text-xs font-black text-slate-950 shadow-[0_8px_24px_rgba(250,204,21,.18)]">Destaque do Clube</span>}
      </div>
      <div className="flex min-h-full flex-col p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-3xl font-black">{plan.name}</h3>
            <p className="mt-3 text-4xl font-black text-gold-400">{money(plan.monthlyPrice)}<span className="text-base text-slate-400"> / mês</span></p>
          </div>
          <span className="bg-brand-700 px-3 py-2 text-xs font-black text-white">{plan.includedTickets} ingressos/mês</span>
        </div>
        <ul className="mt-7 space-y-3 text-slate-300">
          {configuredBenefits.map((item) => (
            <li key={item} className="flex gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Link href={`/clube/assinar/${encodeURIComponent(plan.id)}`} tabIndex={active ? 0 : -1} className="mt-auto flex min-h-[52px] w-full items-center justify-center bg-gold-400 px-7 py-4 text-center text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
          Assinar {plan.name}
        </Link>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Cartão de crédito via Mercado Pago. Créditos liberados após a aprovação.
        </p>
      </div>
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
        <ChevronDown className="h-5 w-5 text-gold-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <p className="mt-4 text-sm leading-6 text-slate-300">{text}</p>
    </details>
  );
}
