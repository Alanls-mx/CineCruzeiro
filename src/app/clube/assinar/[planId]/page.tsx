"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, CreditCard, Landmark, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
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

type PaymentMethod = "credit_card" | "debit_card" | "pix";
type SubscriptionPayment = Awaited<ReturnType<typeof subscribeToPlan>>["payment"];

export default function ClubSubscriptionCheckoutPage() {
  const params = useParams<{ planId: string }>();
  const planId = decodeURIComponent(String(params.planId || ""));
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [settings, setSettings] = useState<CinemaContent["settings"]>({});
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [pixPayment, setPixPayment] = useState<SubscriptionPayment | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedMethod = new URLSearchParams(window.location.search).get("method");
    if (requestedMethod === "credit_card" || requestedMethod === "debit_card" || requestedMethod === "pix") setPaymentMethod(requestedMethod);
  }, []);

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
  const checkoutReturnPath = paymentMethod ? `${returnPath}?method=${paymentMethod}` : returnPath;

  async function continueToMercadoPago() {
    if (!plan || !paymentMethod || !user) return;
    setSubmitting(true);
    setMessage("");
    try {
      const result = await subscribeToPlan(plan.id, paymentMethod);
      if (paymentMethod === "pix" && result.payment?.qrCode) {
        setPixPayment(result.payment);
        setMessage(result.message || "Pix recorrente gerado. O plano será ativado automaticamente após a aprovação.");
        return;
      }
      const checkoutUrl = result.checkoutUrl || result.initPoint || "";
      if (!checkoutUrl) {
        setMessage(result.message || "A assinatura foi iniciada, mas o Mercado Pago não retornou o checkout.");
        return;
      }
      setMessage("Abrindo o ambiente seguro do Mercado Pago...");
      window.location.assign(checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPixCode() {
    const code = pixPayment?.qrCode || "";
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    setCopiedPix(true);
    window.setTimeout(() => setCopiedPix(false), 1800);
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
                <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">Como você quer pagar?</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Escolha o meio de pagamento da assinatura mensal. A autorização é concluída no ambiente seguro do Mercado Pago e expira em 15 minutos se o pagamento não for aprovado.
                </p>

                {!authReady ? (
                  <div className="mt-8 h-28 skeleton-soft" />
                ) : (
                  <>
                    <fieldset className="mt-8 grid gap-4 lg:grid-cols-3">
                      <legend className="sr-only">Meio de pagamento recorrente</legend>
                      <PaymentOption
                        id="club-credit-card"
                        checked={paymentMethod === "credit_card"}
                        onChange={() => {
                          setPixPayment(null);
                          setPaymentMethod("credit_card");
                        }}
                        disabled={submitting}
                        icon={<CreditCard />}
                        title="Cartão de crédito"
                        description="Autorize a cobrança mensal no cartão de crédito pelo Mercado Pago."
                      />
                      <PaymentOption
                        id="club-debit-card"
                        checked={paymentMethod === "debit_card"}
                        onChange={() => {
                          setPixPayment(null);
                          setPaymentMethod("debit_card");
                        }}
                        disabled={submitting}
                        icon={<Landmark />}
                        title="Cartão de débito"
                        description="Use um cartão de débito aceito no fluxo seguro do Mercado Pago."
                      />
                      <PaymentOption
                        id="club-pix"
                        checked={paymentMethod === "pix"}
                        onChange={() => {
                          setPixPayment(null);
                          setPaymentMethod("pix");
                        }}
                        disabled={submitting}
                        icon={<QrCode />}
                        title="Pix recorrente"
                        description="Gere o Pix dentro do site. O plano entra em vigor somente quando o pagamento for aprovado."
                      />
                    </fieldset>

                    {!user ? (
                      <div className="mt-7 border-t border-white/10 pt-6">
                        <h2 className="font-display text-xl font-black">Entre na sua conta para continuar</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">A assinatura e os créditos mensais precisam ficar vinculados ao seu cadastro.</p>
                        {paymentMethod ? (
                          <Link href={`/conta?returnTo=${encodeURIComponent(checkoutReturnPath)}`} className="mt-5 inline-flex min-h-[48px] items-center justify-center bg-gold-400 px-6 text-sm font-black text-slate-950 transition hover:bg-gold-300">
                            Entrar ou criar conta
                          </Link>
                        ) : (
                          <button type="button" disabled className="mt-5 inline-flex min-h-[48px] cursor-not-allowed items-center justify-center bg-slate-700 px-6 text-sm font-black text-slate-400">
                            Escolha uma forma de pagamento
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 flex items-start gap-3 text-sm text-slate-300">
                          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                          <p>
                            {paymentMethod === "pix"
                              ? "O Pix será gerado aqui no site. O plano só será ativado após a confirmação do Mercado Pago e a tentativa pendente vence em 15 minutos."
                              : "Você continuará no ambiente seguro do Mercado Pago para revisar e autorizar a cobrança. O plano só será ativado após a confirmação do pagamento e a tentativa pendente vence em 15 minutos."}
                          </p>
                        </div>

                        {message && (
                          <p role="alert" className="mt-5 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                            {message}
                          </p>
                        )}

                        {pixPayment?.qrCode && (
                          <div className="mt-6 bg-[#091122] p-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,.16)]">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h2 className="font-display text-xl font-black">Pix gerado</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-300">Pague no app do seu banco. Assim que o Mercado Pago aprovar, seus créditos aparecem em Minha Conta.</p>
                              </div>
                              <span className="rounded-full bg-gold-400/12 px-3 py-1 text-xs font-black uppercase tracking-[.12em] text-gold-300">vence em 15 min</span>
                            </div>
                            {pixPayment.qrCodeBase64 && (
                              <div className="mt-5 inline-flex bg-white p-3">
                                <Image src={`data:image/png;base64,${pixPayment.qrCodeBase64}`} alt="QR Code Pix da assinatura" width={184} height={184} className="h-[184px] w-[184px]" unoptimized />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => void copyPixCode()}
                              className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300"
                            >
                              <Copy className="h-4 w-4" />
                              {copiedPix ? "Código copiado" : "Copiar Pix copia-e-cola"}
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => void continueToMercadoPago()}
                          disabled={!paymentMethod || submitting || Boolean(pixPayment?.qrCode)}
                          className="mt-7 flex min-h-[54px] w-full items-center justify-center bg-gold-400 px-6 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {submitting
                            ? "Preparando pagamento..."
                            : paymentMethod === "pix"
                              ? "Gerar Pix recorrente"
                              : "Continuar no Mercado Pago"}
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

function PaymentOption({ id, checked, onChange, disabled, icon, title, description }: {
  id: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label htmlFor={id} className={`relative flex min-h-[140px] cursor-pointer flex-col p-4 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-300 sm:p-5 ${disabled ? "cursor-wait opacity-65" : ""} ${checked ? "bg-brand-800 shadow-[inset_0_0_0_2px_#f5c518]" : "bg-[#091122] shadow-[inset_0_0_0_1px_rgba(148,163,184,.2)] hover:bg-[#101b2e]"}`}>
      <input id={id} type="radio" name="club-payment-method" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${checked ? "bg-gold-400 text-slate-950" : "bg-brand-700 text-brand-200"} [&>svg]:h-5 [&>svg]:w-5`}>{icon}</span>
      <span className="mt-4 font-display text-lg font-black">{title}</span>
      <span className="mt-2 text-sm leading-5 text-slate-300">{description}</span>
      <span className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-gold-400 bg-gold-400 text-slate-950" : "border-slate-500"}`} aria-hidden="true">
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
    </label>
  );
}
