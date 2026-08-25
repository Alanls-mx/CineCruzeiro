"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { AccountSubscription, CustomerUser, createCheckoutPayment, createClubCreditCheckout, fetchCheckoutOrderStatus, fetchCurrentCustomer, fetchMercadoPagoCheckoutConfig, fetchMySubscriptions } from "@/services/cinemaApi";
import { cartTotal, findSession, money, publicAssetPath, readCheckoutCart, StoredCheckoutCart, writeCheckoutCart } from "@/utils/cinema";

type Step = "ingressos" | "extras" | "pagamento" | "confirmacao";
type CheckoutPaymentResult = {
  order?: { id?: string; status?: string };
  payment?: { id?: string; status?: string; qrCode?: string; qrCodeBase64?: string; ticketUrl?: string; checkoutUrl?: string };
  tickets?: Array<{ code: string }>;
};
type MercadoPagoCheckoutConfig = {
  enabled: boolean;
  configured: boolean;
  publicKey: string;
  environment: "sandbox" | "production";
  livePayments: boolean;
};
type MercadoPagoCardPayload = {
  token: string;
  paymentMethodId: string;
  paymentTypeId: string;
  installments: number;
};
type MercadoPagoBrickController = { unmount?: () => void };
type MercadoPagoConstructor = new (
  key: string,
  options?: Record<string, unknown>
) => {
  bricks: () => {
    create: (type: string, container: string, settings: Record<string, unknown>) => Promise<MercadoPagoBrickController>;
  };
};

export function CheckoutPage({ sessionId, step }: { sessionId: string; step: Step }) {
  const router = useRouter();
  const { content, status, error } = useCinemaContent();
  const [cart, setCart] = useState<StoredCheckoutCart | null>(null);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [confirmationStatus, setConfirmationStatus] = useState<"idle" | "checking" | "ready" | "invalid">("idle");
  const [loading, setLoading] = useState(false);
  const [clubLoading, setClubLoading] = useState(false);
  const [clubSubscriptions, setClubSubscriptions] = useState<AccountSubscription[]>([]);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [mercadoPagoConfig, setMercadoPagoConfig] = useState<MercadoPagoCheckoutConfig | null>(null);
  const effectiveSessionId = sessionId === "carrinho" ? cart?.sessionId || "" : sessionId;
  const found = findSession(content, effectiveSessionId);
  const total = cartTotal(cart, found?.session, content?.concessions || []);
  const checkoutPathFor = useCallback((targetStep: Step) => {
    if (!found) return "/filmes";
    const suffix: Record<Step, string> = {
      ingressos: "",
      extras: "/extras",
      pagamento: "/pagamento",
      confirmacao: "/confirmacao",
    };
    return `/checkout/${found.session.id}${suffix[targetStep]}`;
  }, [found]);

  const updateCart = useCallback((patch: Partial<StoredCheckoutCart>) => {
    if (!found) return;
    const persisted = readCheckoutCart();
    const source = persisted?.sessionId === found.session.id ? persisted : cart;
    const next = {
      movieId: found.movie.id,
      sessionId: found.session.id,
      fullTickets: source?.fullTickets ?? 1,
      halfTickets: source?.halfTickets ?? 0,
      concessionQuantities: source?.concessionQuantities || {},
      extrasVisited: source?.extrasVisited || false,
      paymentMethod: source?.paymentMethod || "credit_card",
      ...patch,
    };
    writeCheckoutCart(next);
    setCart(next);
  }, [cart, found]);

  useEffect(() => {
    const stored = readCheckoutCart();
    if (sessionId === "carrinho") {
      setCart(stored);
      setHydratedSessionId(sessionId);
      return;
    }
    setCart(stored?.sessionId === sessionId ? stored : null);
    setHydratedSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (hydratedSessionId !== sessionId || !found || cart?.sessionId === found.session.id) return;
    const next = {
      movieId: found.movie.id,
      sessionId: found.session.id,
      fullTickets: 1,
      halfTickets: 0,
      concessionQuantities: {},
      extrasVisited: false,
      paymentMethod: "credit_card" as const,
    };
    writeCheckoutCart(next);
    setCart(next);
  }, [hydratedSessionId, sessionId, found, cart?.sessionId]);

  useEffect(() => {
    if (!found || !cart) return;
    const hasPaymentResult = isValidPaymentResult(cart.paymentResult);
    const persistedCart = readCheckoutCart();
    const hasVisitedExtras = Boolean(
      cart.extrasVisited
      || (persistedCart?.sessionId === found.session.id && persistedCart.extrasVisited)
    );
    if (step === "extras" && !cart.extrasVisited) {
      updateCart({ extrasVisited: true });
      return;
    }
    if (step === "pagamento" && !hasVisitedExtras) {
      updateCart({ extrasVisited: true });
      return;
    }
    if (step === "confirmacao" && !hasPaymentResult) {
      router.replace(checkoutPathFor(cart.extrasVisited ? "pagamento" : "extras"));
      return;
    }
    if (step === "confirmacao" && hasPaymentResult && confirmationStatus === "idle") {
      setConfirmationStatus("checking");
      const result = cart.paymentResult as CheckoutPaymentResult;
      fetchCheckoutOrderStatus(result.order?.id || "")
        .then((fresh) => {
          updateCart({ paymentResult: fresh });
          setConfirmationStatus("ready");
        })
        .catch(() => {
          setConfirmationStatus("invalid");
          router.replace(checkoutPathFor("pagamento"));
        });
      return;
    }
    if (step !== "confirmacao" && confirmationStatus !== "idle") {
      setConfirmationStatus("idle");
    }
  }, [cart, checkoutPathFor, confirmationStatus, found, router, step, updateCart]);

  const continueToPayment = useCallback(() => {
    if (!found || !cart) return;
    const persisted = readCheckoutCart();
    const source = persisted?.sessionId === found.session.id ? persisted : cart;
    const next: StoredCheckoutCart = {
      ...source,
      movieId: found.movie.id,
      sessionId: found.session.id,
      extrasVisited: true,
    };
    writeCheckoutCart(next);
    setCart(next);
    router.push(checkoutPathFor("pagamento"));
  }, [cart, checkoutPathFor, found, router]);

  const selectedConcessions = useMemo(() => {
    const quantities = cart?.concessionQuantities || {};
    return (content?.concessions || []).filter((item) => Number(quantities[item.id] || 0) > 0);
  }, [content?.concessions, cart?.concessionQuantities]);

  const submitPayment = useCallback(async (cardData?: MercadoPagoCardPayload) => {
    if (!found || !cart) return;
    setLoading(true);
    setPaymentError("");
    try {
      const persisted = readCheckoutCart();
      const checkoutCart = persisted?.sessionId === found.session.id ? persisted : cart;
      if (!mercadoPagoConfig?.enabled || !mercadoPagoConfig.configured || !mercadoPagoConfig.livePayments) {
        throw new Error("Pix real indisponível: configure o Mercado Pago no ambiente de produção.");
      }
      if (checkoutCart.paymentMethod === "credit_card" && !cardData?.token) {
        throw new Error("Preencha os dados do cartão no formulário seguro do Mercado Pago.");
      }
      const idempotencyKey = `${found.session.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const result = await createCheckoutPayment(
        {
          id: idempotencyKey,
          idempotencyKey,
          movieId: found.movie.id,
          sessionId: found.session.id,
          fullTicketsCount: Number(checkoutCart.fullTickets || 0),
          halfTicketsCount: Number(checkoutCart.halfTickets || 0),
          concessionItems: Object.entries(checkoutCart.concessionQuantities || {})
            .filter(([, qty]) => Number(qty) > 0)
            .map(([id, qty]) => ({ id, quantity: Number(qty) })),
          couponCode: checkoutCart.couponCode,
          customerName: customerUser?.name || checkoutCart.customerName || "Cliente Cine Cruzeiro",
          customerPhone: customerUser?.phone || checkoutCart.customerPhone || "",
          customerEmail: customerUser?.email || checkoutCart.customerEmail || "",
          customerCpf: customerUser?.cpf || checkoutCart.customerCpf || "",
          useClubCredits: Boolean(activeClubForCart(clubSubscriptions, checkoutCart)),
          paymentMethod: checkoutCart.paymentMethod === "credit_card" ? "CREDIT_CARD" : "PIX",
          createdAt: new Date().toISOString(),
        },
        checkoutCart.paymentMethod || "pix",
        {
          idempotencyKey,
          ...(cardData
            ? {
                cardToken: cardData.token,
                paymentMethodId: cardData.paymentMethodId,
                paymentTypeId: cardData.paymentTypeId,
                installments: cardData.installments,
              }
            : {}),
        }
      );
      updateCart({ paymentResult: result });
      router.push(checkoutPathFor("confirmacao"));
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Nao foi possivel iniciar o pagamento.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cart, checkoutPathFor, found, mercadoPagoConfig, router, updateCart, customerUser, clubSubscriptions]);

  async function submitClubCredit() {
    if (!found || !cart) return;
    setClubLoading(true);
    setPaymentError("");
    try {
      const result = await createClubCreditCheckout({
        movieId: found.movie.id,
        sessionId: found.session.id,
        fullTicketsCount: Number(cart.fullTickets || 0),
        halfTicketsCount: Number(cart.halfTickets || 0),
        concessionItems: Object.entries(cart.concessionQuantities || {})
          .filter(([, qty]) => Number(qty) > 0)
          .map(([id, qty]) => ({ id, quantity: Number(qty) })),
        couponCode: cart.couponCode,
      });
      updateCart({ paymentResult: result });
      router.push(checkoutPathFor("confirmacao"));
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Nao foi possivel usar o beneficio do Clube.");
    } finally {
      setClubLoading(false);
    }
  }

  useEffect(() => {
    if (step !== "pagamento") return;
    let mounted = true;
    fetchCurrentCustomer()
      .then((result) => {
        if (mounted) setCustomerUser(result.user);
      })
      .catch(() => {
        if (mounted) setCustomerUser(null);
      });
    fetchMySubscriptions()
      .then((subscriptions) => {
        if (mounted) setClubSubscriptions(subscriptions);
      })
      .catch(() => {
        if (mounted) setClubSubscriptions([]);
      });
    return () => {
      mounted = false;
    };
  }, [step]);

  useEffect(() => {
    if (step !== "pagamento") return;
    let mounted = true;
    fetchMercadoPagoCheckoutConfig()
      .then((config) => {
        if (mounted) setMercadoPagoConfig(config);
      })
      .catch(() => {
        if (mounted) setMercadoPagoConfig({ enabled: false, configured: false, publicKey: "", environment: "sandbox", livePayments: false });
      });
    return () => {
      mounted = false;
    };
  }, [step]);

  if (status === "loading") return <PageShell><div className="h-96 skeleton-soft" /></PageShell>;
  if (status === "error") return <PageShell><p className="text-rose-200">{error}</p></PageShell>;
  if (hydratedSessionId !== sessionId) return <PageShell><div className="h-96 skeleton-soft" /></PageShell>;
  if (!found || !cart) return <PageShell><p className="text-slate-300">Sessão não encontrada. Volte para a programação.</p><Link className="mt-4 inline-flex text-gold-400" href="/filmes">Ver filmes</Link></PageShell>;

  return (
    <PageShell>
      <div className="mb-8">
        <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Checkout</p>
        <h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">{found.movie.title}</h1>
        <p className="mt-2 text-slate-300">{found.session.time} • {found.session.format}</p>
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <Steps
            sessionId={found.session.id}
            step={step}
            extrasVisited={Boolean(cart.extrasVisited)}
            onContinueToPayment={continueToPayment}
          />
          {step === "ingressos" && <TicketsStep cart={cart} updateCart={updateCart} />}
          {step === "extras" && (
            <ExtrasStep
              cart={cart}
              updateCart={updateCart}
              concessions={content?.concessions || []}
              onContinue={continueToPayment}
            />
          )}
          {step === "pagamento" && (
            <PaymentStep
              cart={cart}
              updateCart={updateCart}
              total={total}
              mercadoPagoConfig={mercadoPagoConfig}
              paymentError={paymentError}
              loading={loading}
              clubLoading={clubLoading}
              clubSubscriptions={clubSubscriptions}
              customerUser={customerUser}
              onSubmit={submitPayment}
              onClubCredit={submitClubCredit}
            />
          )}
          {step === "confirmacao" && (
            <ConfirmationStep
              cart={cart}
              confirmationStatus={confirmationStatus}
              orderReference={`${found.movie.title} - ${found.session.time} • ${found.session.format}`}
            />
          )}
        </section>
        <OrderSummary cart={cart} total={total} selectedConcessions={selectedConcessions} />
      </div>
      <MobileCheckoutBar
        cart={cart}
        step={step}
        total={total}
        loading={loading || clubLoading}
        paymentMethod={cart.paymentMethod || "pix"}
        onSubmit={submitPayment}
        onContinueToPayment={continueToPayment}
        submitDisabled={cart.paymentMethod === "credit_card" || !mercadoPagoConfig?.enabled || !mercadoPagoConfig.configured || !mercadoPagoConfig.livePayments}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-[1320px] px-4 py-10 pb-28 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Steps({ sessionId, step, extrasVisited, onContinueToPayment }: { sessionId: string; step: Step; extrasVisited: boolean; onContinueToPayment: () => void }) {
  const steps: Array<[Step, string, string]> = [
    ["ingressos", "Ingressos", `/checkout/${sessionId}`],
    ["extras", "Extras", `/checkout/${sessionId}/extras`],
    ["pagamento", "Pagamento", `/checkout/${sessionId}/pagamento`],
    ["confirmacao", "Confirmação", `/checkout/${sessionId}/confirmacao`],
  ];
  const currentIndex = steps.findIndex(([id]) => id === step);
  return (
    <nav className="mb-8 grid gap-3 sm:grid-cols-4" aria-label="Etapas do checkout">
      {steps.map(([id, label, href], index) => {
        const isCurrent = id === step;
        const isDone = index < currentIndex;
        const locked = step === "confirmacao"
          || (id === "pagamento" && !extrasVisited && step !== "extras")
          || id === "confirmacao";
        const numberClassName = isCurrent
          ? "bg-gold-400 text-slate-950"
          : isDone
            ? "bg-emerald-400 text-emerald-950"
            : "bg-white/8 text-slate-400";
        const stateClassName = isCurrent
          ? "bg-brand-700 text-white shadow-glow-blue"
          : isDone
            ? "bg-emerald-400/10 text-emerald-200"
            : locked
              ? "bg-white/[0.03] text-slate-600"
              : "bg-brand-900/70 text-slate-300 hover:bg-brand-850";
        const content = (
          <>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${numberClassName}`}>
              {isDone ? "OK" : index + 1}
            </span>
            <span>{label}</span>
          </>
        );
        const className = `flex min-h-[52px] items-center gap-3 rounded-lg px-3 text-sm font-black transition ${stateClassName}`;
        if (id === "pagamento" && step === "extras") {
          return (
            <button key={id} type="button" onClick={onContinueToPayment} className={className}>
              {content}
            </button>
          );
        }
        return locked ? (
          <div key={id} className={className} aria-disabled="true">{content}</div>
        ) : (
          <Link key={id} href={href} className={className}>{content}</Link>
        );
      })}
    </nav>
  );
}

function TicketsStep({ cart, updateCart }: { cart: StoredCheckoutCart; updateCart: (patch: Partial<StoredCheckoutCart>) => void }) {
  return (
    <div className="space-y-8">
      <QuantityRow label="Inteira" value={cart.fullTickets || 0} onChange={(value) => updateCart({ fullTickets: value })} />
      <QuantityRow label="Meia" value={cart.halfTickets || 0} onChange={(value) => updateCart({ halfTickets: value })} />
      <Link href={`/checkout/${cart.sessionId}/extras`} className="inline-flex bg-gold-400 px-7 py-4 text-sm font-black text-slate-950">Continuar para Extras</Link>
    </div>
  );
}

function ExtrasStep({ cart, updateCart, concessions, onContinue }: { cart: StoredCheckoutCart; updateCart: (patch: Partial<StoredCheckoutCart>) => void; concessions: Parameters<typeof cartTotal>[2]; onContinue: () => void }) {
  const quantities = cart.concessionQuantities || {};
  const visibleConcessions = (concessions || []).filter((item) => item.active !== false);
  const [openDescriptions, setOpenDescriptions] = useState<Record<string, boolean>>({});
  const setQty = (id: string, qty: number) => {
    const persisted = readCheckoutCart();
    const baseQuantities = persisted?.sessionId === cart.sessionId ? persisted.concessionQuantities || {} : quantities;
    updateCart({ concessionQuantities: { ...baseQuantities, [id]: Math.max(0, qty) } });
  };
  return (
    <div>
      <h2 className="font-display text-3xl font-black">Bomboniere</h2>
      <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {visibleConcessions.map((item) => (
          <article key={item.id}>
            <div className="relative aspect-[4/3] bg-transparent">
              {item.imageUrl ? (
                <Image
                  src={publicAssetPath(item.imageUrl)}
                  alt={item.name}
                  fill
                  quality={74}
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 260px"
                  className="object-contain"
                />
              ) : null}
            </div>
            <h3 className="mt-4 text-lg font-black">{item.name}</h3>
            {item.description && (
              <button
                type="button"
                onClick={() => setOpenDescriptions((current) => ({ ...current, [item.id]: !current[item.id] }))}
                className="mt-2 inline-flex text-sm font-black text-brand-300 underline-offset-4 transition hover:text-gold-400 hover:underline"
                aria-expanded={Boolean(openDescriptions[item.id])}
              >
                {openDescriptions[item.id] ? "Ocultar descrição" : "Ver descrição"}
              </button>
            )}
            {openDescriptions[item.id] && item.description && (
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.description}</p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <span className="font-black text-gold-400">{money(item.price)}</span>
              <QuantityControls value={Number(quantities[item.id] || 0)} onChange={(value) => setQty(item.id, value)} />
            </div>
          </article>
        ))}
      </div>
      <button type="button" onClick={onContinue} className="mt-10 inline-flex bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300">
        Continuar para Pagamento
      </button>
    </div>
  );
}

function PaymentStep({ cart, updateCart, total, mercadoPagoConfig, paymentError, loading, clubLoading, clubSubscriptions, customerUser, onSubmit, onClubCredit }: {
  cart: StoredCheckoutCart;
  updateCart: (patch: Partial<StoredCheckoutCart>) => void;
  total: number;
  mercadoPagoConfig: MercadoPagoCheckoutConfig | null;
  paymentError: string;
  loading: boolean;
  clubLoading: boolean;
  clubSubscriptions: AccountSubscription[];
  customerUser: CustomerUser | null;
  onSubmit: (cardData?: MercadoPagoCardPayload) => Promise<void>;
  onClubCredit: () => void;
}) {
  const activeClub = activeClubForCart(clubSubscriptions, cart);
  const requestedTickets = Number(cart.fullTickets || 0) + Number(cart.halfTickets || 0);
  const selectedExtras = Object.values(cart.concessionQuantities || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
  const clubCredits = Number(activeClub?.creditsRemaining || activeClub?.creditsAvailable || 0);
  const mercadoPagoUnavailable = !mercadoPagoConfig?.enabled || !mercadoPagoConfig.configured || !mercadoPagoConfig.livePayments;
  return (
    <div className="grid gap-10 xl:grid-cols-2">
      <section>
        {customerUser ? (
          <>
            <h2 className="font-display text-3xl font-black">Conta identificada</h2>
            <div className="mt-6 bg-brand-900/70 p-5 shadow-soft">
              <p className="text-lg font-black text-white">{customerUser.name || "Cliente Cine Cruzeiro"}</p>
              <p className="mt-2 text-sm text-slate-300">{customerUser.email}</p>
              <p className="mt-1 text-sm text-slate-400">{customerUser.phone || "WhatsApp nao informado"}</p>
              <Link href="/conta" className="mt-4 inline-flex text-sm font-black text-gold-400 hover:text-gold-300">
                Editar dados da conta
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-3xl font-black">Dados do visitante</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Pedir isso aqui só quando a compra for sem conta. Cliente logado usa os dados salvos automaticamente.</p>
            <div className="mt-6 space-y-4">
              <Input label="Nome" value={cart.customerName || ""} onChange={(value) => updateCart({ customerName: value })} />
              <Input label="WhatsApp" value={cart.customerPhone || ""} onChange={(value) => updateCart({ customerPhone: value })} />
              <Input label="E-mail" type="email" value={cart.customerEmail || ""} onChange={(value) => updateCart({ customerEmail: value })} />
              <Input label="CPF para nota fiscal, opcional" value={cart.customerCpf || ""} onChange={(value) => updateCart({ customerCpf: value.replace(/\D/g, "").slice(0, 11) })} />
            </div>
          </>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl font-black">Pagamento</h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => updateCart({ paymentMethod: "pix" })} className={`py-4 text-sm font-black ${cart.paymentMethod !== "credit_card" ? "bg-brand-700 text-white" : "bg-white/5 text-slate-300"}`}>Pix</button>
          <button type="button" onClick={() => updateCart({ paymentMethod: "credit_card" })} className={`py-4 text-sm font-black ${cart.paymentMethod === "credit_card" ? "bg-brand-700 text-white" : "bg-white/5 text-slate-300"}`}>Cartão</button>
        </div>
        {cart.paymentMethod === "credit_card" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-brand-900/70 p-5 shadow-soft">
              <h3 className="text-base font-black text-white">Cartão transparente Mercado Pago</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                O formulário seguro do Mercado Pago gera um token para processar a compra. O Cine Cruzeiro não recebe número, validade ou CVV do cartão.
              </p>
              <p className="mt-3 text-xs font-bold text-slate-500">
                Total recalculado pelo backend: {money(total)}. Ingressos liberados somente após pagamento aprovado.
              </p>
            </div>
            {mercadoPagoUnavailable && (
              <p className="text-sm font-semibold text-amber-200">
                Mercado Pago indisponível para cobranças reais. Ative a integração com credenciais de produção em Admin → Integrações.
              </p>
            )}
            {!mercadoPagoUnavailable && (
              <CardPaymentBrick publicKey={mercadoPagoConfig.publicKey} amount={total} loading={loading} onSubmit={onSubmit} />
            )}
          </div>
        )}
        {cart.paymentMethod !== "credit_card" && (
          <div className="mt-6 rounded-lg bg-brand-900/70 p-5 shadow-soft">
            <h3 className="text-base font-black text-white">Pix Mercado Pago</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Gere o QR Code e o Pix copia-e-cola sem sair do checkout. O ingresso só é liberado após a confirmação do Mercado Pago.
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">Total recalculado pelo backend: {money(total)}.</p>
          </div>
        )}
        {paymentError && <p className="mt-5 text-sm font-semibold text-rose-200">{paymentError}</p>}
        {cart.paymentMethod !== "credit_card" && (
          <button type="button" onClick={() => void onSubmit()} disabled={loading || mercadoPagoUnavailable} className="mt-8 w-full bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 disabled:opacity-50">
            {loading ? "Processando..." : "Gerar Pix"}
          </button>
        )}
        {activeClub && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-sm leading-6 text-slate-300">
              Seu Clube tem {clubCredits} crédito(s). Este pedido usa {requestedTickets} ingresso(s).
              {selectedExtras > 0 ? " Os créditos abatem os ingressos; Pix/cartão cobra apenas os extras restantes." : ""}
            </p>
            {selectedExtras > 0 ? (
              <p className="mt-3 text-xs font-bold text-brand-200">Finalize com Pix ou cartão para aplicar o abatimento dos ingressos e pagar os extras.</p>
            ) : (
              <button type="button" onClick={onClubCredit} disabled={clubLoading || loading || clubCredits < requestedTickets} className="mt-3 w-full bg-brand-700 px-7 py-4 text-sm font-black text-white transition hover:bg-brand-600 disabled:opacity-50">
                {clubLoading ? "Emitindo benefício..." : `Usar ${requestedTickets} crédito(s) do Clube`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CardPaymentBrick({ publicKey, amount, loading, onSubmit }: { publicKey: string; amount: number; loading: boolean; onSubmit: (cardData: MercadoPagoCardPayload) => Promise<void> }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    let mounted = true;
    let controller: MercadoPagoBrickController | null = null;

    async function mountBrick() {
      setReady(false);
      setError("");
      try {
        const { loadMercadoPago } = await import("@mercadopago/sdk-js");
        await loadMercadoPago();
        if (!mounted) return;
        const MercadoPago = (window as typeof window & { MercadoPago?: MercadoPagoConstructor }).MercadoPago;
        if (!MercadoPago) throw new Error("SDK do Mercado Pago não foi carregado.");
        const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        controller = await bricksBuilder.create("cardPayment", "cardPaymentBrick_container", {
          initialization: { amount: Number(amount.toFixed(2)) },
          customization: {
            visual: { style: { theme: "dark" } },
            paymentMethods: { maxInstallments: 6 }
          },
          callbacks: {
            onReady: () => {
              if (mounted) setReady(true);
            },
            onSubmit: (formData: Record<string, unknown>, additionalData: Record<string, unknown>) => {
              const payload: MercadoPagoCardPayload = {
                token: String(formData.token || ""),
                paymentMethodId: String(formData.payment_method_id || ""),
                paymentTypeId: String(additionalData.paymentTypeId || formData.payment_type_id || "credit_card"),
                installments: Number(formData.installments || 1)
              };
              return onSubmitRef.current(payload);
            },
            onError: (brickError: unknown) => {
              console.error("Mercado Pago Brick:", brickError);
              if (mounted) setError("Não foi possível carregar o formulário seguro do cartão.");
            }
          }
        });
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Não foi possível carregar o Mercado Pago.");
      }
    }

    if (publicKey && amount > 0) void mountBrick();
    return () => {
      mounted = false;
      controller?.unmount?.();
    };
  }, [amount, publicKey]);

  return (
    <div className="rounded-lg bg-white/[0.03] p-4 shadow-soft">
      {!ready && !error && <div className="h-48 skeleton-soft" />}
      <div id="cardPaymentBrick_container" className={loading ? "pointer-events-none opacity-70" : ""} />
      {error && <p className="mt-3 text-sm font-semibold text-rose-200">{error}</p>}
    </div>
  );
}

function ConfirmationStep({ cart, confirmationStatus, orderReference }: { cart: StoredCheckoutCart; confirmationStatus: "idle" | "checking" | "ready" | "invalid"; orderReference: string }) {
  const [copied, setCopied] = useState(false);
  const result = cart.paymentResult as CheckoutPaymentResult | undefined;
  const approved = result?.payment?.status === "approved";
  const pending = ["pending", "processing"].includes(String(result?.payment?.status || ""));
  const copyPix = async () => {
    if (!result?.payment?.qrCode) return;
    await navigator.clipboard?.writeText(result.payment.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="max-w-3xl">
      <div className="overflow-hidden rounded-xl bg-[#101827] shadow-[0_24px_80px_rgba(2,6,23,.38)]">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-xl font-black ${approved ? "bg-emerald-300 text-emerald-950" : "bg-gold-400 text-amber-950"}`}>
              {approved ? "✓" : "!"}
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-brand-300">
                {approved ? "Compra confirmada" : "Pagamento em andamento"}
              </p>
              <h2 className="mt-1 font-display text-3xl font-black leading-none sm:text-4xl">
                {confirmationStatus === "checking"
                  ? "Estamos conferindo seu pedido"
                  : approved
                  ? "Tudo certo com sua compra"
                  : "Pedido criado com segurança"}
              </h2>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
            {approved
              ? "Seus ingressos digitais foram liberados na sua conta. Lá você encontra QR Code, download, transferência e histórico da compra."
              : "Finalize o pagamento para liberar os ingressos. Assim que o provedor confirmar, eles aparecem automaticamente em Minha Conta."}
          </p>

          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-brand-950/70 p-4">
              <span className="block text-xs font-black uppercase tracking-[.14em] text-slate-400">Referência</span>
              <strong className="mt-2 block break-all text-white">{orderReference}</strong>
            </div>
            <div className="rounded-lg bg-brand-950/70 p-4">
              <span className="block text-xs font-black uppercase tracking-[.14em] text-slate-400">Status</span>
              <strong className="mt-2 block text-white">
                {approved ? "Pagamento aprovado" : pending ? "Aguardando confirmação" : "Pedido recebido"}
              </strong>
            </div>
          </div>

          {pending && result?.payment?.qrCode && (
            <div className="mt-6 rounded-lg bg-gold-400/10 p-4">
              <p className="text-sm font-black text-gold-200">Pix gerado</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Copie o código Pix e conclua no app do seu banco. O ingresso só fica válido após aprovação.</p>
              <button type="button" onClick={copyPix} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300">
                {copied ? "Código copiado" : "Copiar código Pix"}
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/conta/ingressos" className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300">
              Ver meus ingressos
            </Link>
            {(result?.payment?.checkoutUrl || result?.payment?.ticketUrl) && !approved && (
              <a href={result.payment.checkoutUrl || result.payment.ticketUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white/8 px-5 text-sm font-black text-white transition hover:bg-white/12">
                Abrir pagamento
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function isValidPaymentResult(value: unknown) {
  const result = value as CheckoutPaymentResult | null;
  const paymentStatus = result?.payment?.status;
  return Boolean(result?.order?.id && result?.payment?.id && ["pending", "processing", "approved"].includes(String(paymentStatus || "")));
}

function activeClubForCart(subscriptions: AccountSubscription[], cart: StoredCheckoutCart | null) {
  const requestedTickets = Number(cart?.fullTickets || 0) + Number(cart?.halfTickets || 0);
  if (!requestedTickets) return null;
  return subscriptions.find((subscription) =>
    subscription.status === "active" &&
    Number(subscription.creditsRemaining || subscription.creditsAvailable || 0) >= requestedTickets
  ) || null;
}

function OrderSummary({ cart, total, selectedConcessions }: { cart: StoredCheckoutCart; total: number; selectedConcessions: Array<{ id: string; name: string; price: number }> }) {
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="border-t border-white/12 pt-5 lg:border-t-0 lg:pt-0">
        <h2 className="font-display text-2xl font-black">Resumo</h2>
        <dl className="mt-5 space-y-3 text-sm text-slate-300">
          <div className="flex justify-between"><dt>Inteiras</dt><dd>{cart.fullTickets || 0}</dd></div>
          <div className="flex justify-between"><dt>Meias</dt><dd>{cart.halfTickets || 0}</dd></div>
          {selectedConcessions.map((item) => (
            <div key={item.id} className="flex justify-between gap-4"><dt>{item.name}</dt><dd>{cart.concessionQuantities?.[item.id] || 0}</dd></div>
          ))}
        </dl>
        <div className="mt-6 flex items-end justify-between border-t border-white/8 pt-5">
          <span className="text-sm font-bold text-slate-400">Total estimado</span>
          <span className="text-3xl font-black text-gold-400">{money(total)}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">O valor final é recalculado pelo backend antes do pagamento.</p>
      </div>
    </aside>
  );
}

function MobileCheckoutBar({ cart, step, total, loading, paymentMethod, onSubmit, onContinueToPayment, submitDisabled = false }: { cart: StoredCheckoutCart; step: Step; total: number; loading: boolean; paymentMethod: StoredCheckoutCart["paymentMethod"]; onSubmit: () => void; onContinueToPayment: () => void; submitDisabled?: boolean }) {
  const hrefByStep: Partial<Record<Step, string>> = {
    ingressos: `/checkout/${cart.sessionId}/extras`,
    extras: `/checkout/${cart.sessionId}/pagamento`,
    confirmacao: "/conta/ingressos",
  };
  const labelByStep: Record<Step, string> = {
    ingressos: "Continuar",
    extras: "Pagamento",
    pagamento: paymentMethod === "credit_card" ? "Use o formulário" : "Gerar Pix",
    confirmacao: "Meus ingressos",
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#060a12]/96 px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(0,0,0,.38)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-[1320px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-black uppercase tracking-[.14em] text-slate-400">Total</span>
          <strong className="block truncate text-xl font-black text-gold-400">{money(total)}</strong>
        </div>
        {step === "pagamento" ? (
          <button type="button" onClick={onSubmit} disabled={loading || submitDisabled} className="min-h-[50px] min-w-[132px] bg-gold-400 px-5 text-sm font-black text-slate-950 disabled:opacity-50">
            {loading ? "Aguarde" : labelByStep[step]}
          </button>
        ) : step === "extras" ? (
          <button type="button" onClick={onContinueToPayment} className="inline-flex min-h-[50px] min-w-[132px] items-center justify-center bg-gold-400 px-5 text-sm font-black text-slate-950">
            {labelByStep[step]}
          </button>
        ) : (
          <Link href={hrefByStep[step] || "/filmes"} className="inline-flex min-h-[50px] min-w-[132px] items-center justify-center bg-gold-400 px-5 text-sm font-black text-slate-950">
            {labelByStep[step]}
          </Link>
        )}
      </div>
    </div>
  );
}

function QuantityRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-white/8 pb-6">
      <span className="text-xl font-black">{label}</span>
      <QuantityControls value={value} onChange={onChange} />
    </div>
  );
}

function QuantityControls({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="h-10 w-10 bg-white/5 text-xl">-</button>
      <span className="w-8 text-center text-lg font-black">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="h-10 w-10 bg-brand-700 text-xl">+</button>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-white/15 bg-brand-950/80 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-gold-400 focus:ring-4 focus:ring-gold-400/10"
      />
    </label>
  );
}
