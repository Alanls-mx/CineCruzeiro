"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import {
  CustomerUser,
  fetchCinemaContent,
  fetchCurrentCustomer,
  fetchSubscriptionPlans,
  subscribeToPlan,
} from "@/services/cinemaApi";
import type { CinemaContent, SubscriptionPlan } from "@/services/cinemaApi";
import { money, publicAssetPath } from "@/utils/cinema";
import { trackMarketingEvent } from "@/utils/tracking";

export default function ClubSubscriptionCheckoutPage() {
  const params = useParams<{ planId: string }>();
  const planId = decodeURIComponent(String(params.planId || ""));
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [settings, setSettings] = useState<CinemaContent["settings"]>({});
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetchSubscriptionPlans(),
      fetchCinemaContent().catch(() => null),
      fetchCurrentCustomer().catch(() => null),
    ])
      .then(([plans, content, customer]) => {
        if (!mounted) return;
        const selectedPlan = plans.find((item) => item.id === planId && item.active !== false) || null;
        setPlan(selectedPlan);
        setSettings(content?.settings || {});
        setUser(customer?.user || null);
        setStatus(selectedPlan ? "ready" : "error");
        setAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus("error");
        setAuthReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [planId]);

  const returnPath = useMemo(
    () => `/clube/assinar/${encodeURIComponent(planId)}`,
    [planId]
  );

  async function continueToMercadoPago() {
    if (!plan || !user) return;
    setSubmitting(true);
    setMessage("");
    try {
      const result = await subscribeToPlan(plan.id, "credit_card");
      const checkoutUrl = result.checkoutUrl || result.initPoint || "";
      if (!checkoutUrl) {
        setMessage(result.message || "A assinatura foi iniciada, mas o Mercado Pago não retornou o checkout.");
        return;
      }
      trackMarketingEvent("begin_checkout", {
        checkout_type: "club_subscription",
        item_id: plan.id,
        item_name: plan.name,
        value: Number(plan.monthlyPrice || 0),
        currency: "BRL",
      });
      setMessage("Abrindo o ambiente seguro do Mercado Pago...");
      window.location.assign(checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader settings={settings} mutedPrimaryAction />
      <main className="flex-1">
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <Link href="/clube#planos" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-slate-300 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
            <ArrowLeft className="h-4 w-4" />
            Voltar aos planos
          </Link>

          {status === "loading" && <div className="mt-6 h-[520px] skeleton-soft" />}

          {status === "error" && (
            <section className="mt-8 bg-[#0d1728] px-5 py-10 text-center shadow-[0_20px_54px_rgba(0,0,0,.28)] sm:px-8">
              <h1 className="font-display text-3xl font-black">Plano indisponível</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">Este plano não foi encontrado ou não está aberto para novas assinaturas.</p>
              <Link href="/clube#planos" className="mt-6 inline-flex min-h-[48px] items-center justify-center bg-gold-400 px-6 text-sm font-black text-slate-950">Escolher outro plano</Link>
            </section>
          )}

          {status === "ready" && plan && (
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <section className="bg-[#0d1728] p-5 shadow-[0_20px_54px_rgba(0,0,0,.28)] sm:p-8">
                <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">Assine com cartão de crédito</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  A cobrança mensal é autorizada no ambiente seguro do Mercado Pago. O plano só fica ativo depois da confirmação do primeiro pagamento.
                </p>

                {!authReady ? (
                  <div className="mt-8 h-28 skeleton-soft" />
                ) : (
                  <>
                    <div className="mt-8 flex items-start gap-4 bg-[#091122] p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,.2)] sm:p-6">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400 text-slate-950">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-display text-xl font-black">Cartão de crédito</h2>
                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-300">
                          Autorize a cobrança mensal no checkout seguro do Mercado Pago.
                        </p>
                      </div>
                    </div>

                    {!user ? (
                      <div className="mt-7 border-t border-white/10 pt-6">
                        <h2 className="font-display text-xl font-black">Entre na sua conta para continuar</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">A assinatura e os créditos mensais precisam ficar vinculados ao seu cadastro.</p>
                        <Link href={`/conta?returnTo=${encodeURIComponent(returnPath)}`} className="mt-5 inline-flex min-h-[48px] items-center justify-center bg-gold-400 px-6 text-sm font-black text-slate-950 transition hover:bg-gold-300">
                          Entrar ou criar conta
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 flex items-start gap-3 text-sm text-slate-300">
                          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          <p>Você continuará no Mercado Pago para revisar e autorizar a cobrança no cartão de crédito. Nenhum crédito do Clube será liberado antes da aprovação.</p>
                        </div>

                        {message && (
                          <p role="alert" className="mt-5 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                            {message}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => void continueToMercadoPago()}
                          disabled={submitting}
                          className="mt-7 flex min-h-[54px] w-full items-center justify-center bg-gold-400 px-6 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {submitting ? "Preparando pagamento..." : "Continuar com cartão de crédito"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </section>

              <aside className="bg-[#091122] p-5 shadow-[0_18px_44px_rgba(0,0,0,.24)] sm:p-6 lg:sticky lg:top-28">
                <div className="grid grid-cols-[96px_1fr] items-center gap-4">
                  <div className="relative aspect-[2/3] overflow-hidden bg-brand-950">
                    {plan.imageUrl ? (
                      <Image src={publicAssetPath(plan.imageUrl)} alt={`Imagem do ${plan.name}`} fill quality={72} sizes="96px" className="object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gold-400"><ShieldCheck className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-black">{plan.name}</h2>
                    <p className="mt-2 text-3xl font-black text-gold-400">{money(plan.monthlyPrice)}<span className="text-sm text-slate-400"> / mês</span></p>
                    <p className="mt-2 text-sm font-bold text-brand-300">{plan.includedTickets} ingressos por mês</p>
                  </div>
                </div>
                  <ul className="mt-5 space-y-3 text-sm text-slate-300">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  {user && <p className="mt-6 border-t border-white/8 pt-4 text-xs text-slate-400">Assinatura para <span className="font-bold text-slate-200">{user.email}</span></p>}
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
