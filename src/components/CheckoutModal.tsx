"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  Camera,
  Clock,
  Coffee,
  Cookie,
  Copy,
  Film,
  Info,
  Minus,
  Plus,
  Popcorn,
  QrCode,
  ShoppingBag,
  ShieldCheck,
  Tag,
  Ticket,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { ConcessionItem as AdminConcessionItem, Movie, Session, TicketOrder } from "@/types";
import { createCheckoutPayment } from "@/services/cinemaApi";
import { sendTicketCheckoutWebhook } from "@/services/webhook";
import { publicAssetPath } from "@/utils/cinema";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  movie: Movie | null;
  selectedSession: Session | null;
  concessions?: AdminConcessionItem[];
  onSuccessToast?: (msg: string) => void;
}

type ConcessionItem = {
  id: string;
  sku?: string;
  name: string;
  description: string;
  imageUrl?: string;
  badge?: string;
  price: number;
  compareAt?: number;
  category?: string;
  stock?: number | "";
  maxPerOrder?: number;
  featured?: boolean;
  sortOrder?: number;
  tags?: string[];
  comboItems?: Array<{ name: string; quantity: number }>;
  icon: React.ElementType;
};

type CheckoutStep = "TICKETS" | "CONCESSIONS" | "PROMO" | "CHECKOUT" | "PIX_READY";

const categoryIcons: Record<string, React.ElementType> = {
  combo: Popcorn,
  pipoca: Popcorn,
  bebida: Coffee,
  doce: Cookie,
  promocao: Camera,
  outro: Film,
};

const CUSTOMER_STORAGE_KEY = "cine-cruzeiro-customer";
const CART_STORAGE_KEY = "cine-cruzeiro-cart";

function createCheckoutAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `checkout-${crypto.randomUUID()}`;
  }
  return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CheckoutModal({
  isOpen,
  onClose,
  movie,
  selectedSession,
  concessions = [],
  onSuccessToast,
}: CheckoutModalProps) {
  const [fullTickets, setFullTickets] = useState<number>(1);
  const [halfTickets, setHalfTickets] = useState<number>(0);
  const [concessionQuantities, setConcessionQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [saveCustomer, setSaveCustomer] = useState(false);
  const [savedCustomer, setSavedCustomer] = useState<{ name: string; phone: string; email?: string; cpf?: string } | null>(null);
  const [showCustomerLogin, setShowCustomerLogin] = useState(false);
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("TICKETS");
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixCode, setPixCode] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixTicketUrl, setPixTicketUrl] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("credit_card");
  const [paymentError, setPaymentError] = useState("");
  const [checkoutAttemptId, setCheckoutAttemptId] = useState(createCheckoutAttemptId);

  const priceFull = selectedSession?.priceFull || 10;
  const priceHalf = selectedSession?.priceHalf || 10;
  const totalTickets = fullTickets + halfTickets;
  const ticketsSubtotal = fullTickets * priceFull + halfTickets * priceHalf;
  const concessionCatalog = useMemo<ConcessionItem[]>(() => {
    const activeItems = concessions
      .filter((item) => item.active !== false && item.stock !== 0)
      .sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return Number(a.sortOrder || 100) - Number(b.sortOrder || 100);
      });
    return activeItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      imageUrl: publicAssetPath(item.imageUrl),
      badge: item.badge,
      price: Number(item.price || 0),
      compareAt: typeof item.compareAt === "number" ? item.compareAt : undefined,
      category: item.category,
      stock: item.stock,
      maxPerOrder: item.maxPerOrder,
      featured: item.featured,
      sortOrder: item.sortOrder,
      tags: item.tags,
      comboItems: item.comboItems,
      icon: categoryIcons[item.category || "outro"] || Film,
    }));
  }, [concessions]);
  const promoCatalog = useMemo(
    () =>
      concessionCatalog.filter((item) => {
        const category = String(item.category || "").toLowerCase();
        const tags = (item.tags || []).map((tag) => String(tag).toLowerCase());
        return category === "promocao" || tags.includes("promocao") || tags.includes("promo");
      }),
    [concessionCatalog]
  );
  const concessionOnlyCatalog = useMemo(
    () => concessionCatalog.filter((item) => !promoCatalog.some((promo) => promo.id === item.id)),
    [concessionCatalog, promoCatalog]
  );
  const hasPromoStep = promoCatalog.length > 0;
  const checkoutSteps = useMemo<Array<{ id: Exclude<CheckoutStep, "PIX_READY">; label: string }>>(
    () => [
      { id: "TICKETS", label: "Ingressos" },
      { id: "CONCESSIONS", label: "Bomboniere" },
      ...(hasPromoStep ? [{ id: "PROMO" as const, label: "Ofertas" }] : []),
      { id: "CHECKOUT", label: "Checkout" },
    ],
    [hasPromoStep]
  );

  const selectedConcessions = useMemo(
    () =>
      concessionCatalog.map((item) => ({
        ...item,
        quantity: concessionQuantities[item.id] || 0,
      })).filter((item) => item.quantity > 0),
    [concessionCatalog, concessionQuantities]
  );

  const concessionSubtotal = selectedConcessions.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const couponDiscount =
    couponCode.trim().toUpperCase() === "CINE10"
      ? (ticketsSubtotal + concessionSubtotal) * 0.1
      : 0;
  const grandTotal = Math.max(0, ticketsSubtotal + concessionSubtotal - couponDiscount);
  const stepIndex = step === "PIX_READY" ? checkoutSteps.length : checkoutSteps.findIndex((item) => item.id === step);
  const primaryButtonLabel =
    step === "TICKETS"
      ? "Continuar para Bomboniere"
      : step === "CONCESSIONS" && hasPromoStep
        ? "Continuar para Ofertas"
        : step === "CONCESSIONS"
          ? "Ir para Checkout"
        : step === "PROMO"
          ? "Ir para Checkout"
          : paymentMethod === "credit_card" ? "Pagar com Cartão" : "Pix indisponível";

  useEffect(() => {
    if (isOpen) {
      setStep("TICKETS");
      setFullTickets(1);
      setHalfTickets(0);
      setConcessionQuantities({});
      setCouponExpanded(false);
      setCouponCode("");
      setSaveCustomer(false);
      setShowCustomerLogin(false);
      setCopiedPix(false);
      setPaymentError("");
      setPixCode("");
      setPixQrCodeBase64("");
      setPixTicketUrl("");
      setCheckoutAttemptId(createCheckoutAttemptId());
      const storedCustomer = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
      const parsedCustomer = storedCustomer ? JSON.parse(storedCustomer) : null;
      setSavedCustomer(parsedCustomer);
      setCustomerName(parsedCustomer?.name || "");
      setCustomerPhone(parsedCustomer?.phone || "");
      setCustomerEmail(parsedCustomer?.email || "");
      setCustomerCpf(parsedCustomer?.cpf || "");

      const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        const cart = JSON.parse(storedCart);
        if (cart.movieId === movie?.id && cart.sessionId === selectedSession?.id) {
          setFullTickets(Number(cart.fullTickets || 1));
          setHalfTickets(Number(cart.halfTickets || 0));
          setConcessionQuantities(cart.concessionQuantities || {});
          setCouponCode(cart.couponCode || "");
          setCouponExpanded(Boolean(cart.couponCode));
          setPaymentMethod(cart.paymentMethod === "credit_card" ? "credit_card" : "credit_card");
        }
      }
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, movie, selectedSession]);

  useEffect(() => {
    if (!isOpen || !movie || !selectedSession || step === "PIX_READY") return;

    const cartCount = totalTickets + selectedConcessions.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount <= 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          movieId: movie.id,
          sessionId: selectedSession.id,
          fullTickets,
          halfTickets,
          concessionQuantities,
          couponCode,
          paymentMethod,
          updatedAt: new Date().toISOString(),
        })
      );
    }

    window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated", { detail: { count: cartCount } }));
  }, [
    isOpen,
    step,
    movie,
    selectedSession,
    fullTickets,
    halfTickets,
    concessionQuantities,
    couponCode,
    paymentMethod,
    totalTickets,
    selectedConcessions,
  ]);

  const handlePhoneInput = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 2) {
      setCustomerPhone(raw);
    } else if (raw.length <= 7) {
      setCustomerPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else {
      setCustomerPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`);
    }
  };

  const updateConcessionQuantity = (id: string, amount: number) => {
    const item = concessionCatalog.find((concession) => concession.id === id);
    const stockLimit =
      item?.stock === "" || item?.stock === undefined ? Number.POSITIVE_INFINITY : Number(item.stock || 0);
    const max = Math.min(Number(item?.maxPerOrder || 8), stockLimit);
    setConcessionQuantities((current) => {
      const next = Math.max(0, Math.min(max, (current[id] || 0) + amount));
      return {
        ...current,
        [id]: next,
      };
    });
  };

  const fillSavedCustomer = () => {
    if (!savedCustomer) return;
    setCustomerName(savedCustomer.name);
    setCustomerPhone(savedCustomer.phone);
    setCustomerEmail(savedCustomer.email || "");
    setCustomerCpf(savedCustomer.cpf || "");
    setShowCustomerLogin(false);
  };

  const handleSubmitPayment = async () => {
    if (totalTickets === 0) return;
    if (paymentMethod === "pix") {
      setPaymentError("Pix online indisponível. Nenhum provedor Pix está configurado no momento.");
      return;
    }

    setIsLoading(true);
    setPaymentError("");

    if (saveCustomer && customerName.trim() && customerPhone.trim()) {
      window.localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify({ name: customerName.trim(), phone: customerPhone.trim(), email: customerEmail.trim(), cpf: customerCpf.replace(/\D/g, "") })
      );
    }

    const concessionItems: NonNullable<TicketOrder["concessionItems"]> = selectedConcessions.map((item) => ({
      id: item.id,
      quantity: item.quantity,
    }));

    const orderData: TicketOrder = {
      id: checkoutAttemptId,
      idempotencyKey: checkoutAttemptId,
      movieId: movie?.id || "",
      sessionId: selectedSession?.id || "",
      fullTicketsCount: fullTickets,
      halfTicketsCount: halfTickets,
      concessionItems,
      couponCode: couponCode.trim().toUpperCase() || undefined,
      customerName: customerName || "Cliente Cine Cruzeiro",
      customerPhone: customerPhone || "",
      customerEmail: customerEmail || "",
      customerCpf: customerCpf.replace(/\D/g, "") || undefined,
      paymentMethod: paymentMethod === "credit_card" ? "CREDIT_CARD" : "PIX",
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await createCheckoutPayment(orderData, paymentMethod, {
        idempotencyKey: checkoutAttemptId,
      });
      if (paymentMethod === "credit_card") {
        const checkoutUrl = result.payment.checkoutUrl;
        if (!checkoutUrl) throw new Error("Mercado Pago não retornou a URL do checkout oficial.");
        window.location.href = checkoutUrl;
        return;
      }
      setPixCode(result.payment.qrCode || "");
      setPixQrCodeBase64(result.payment.qrCodeBase64 || "");
      setPixTicketUrl(result.payment.ticketUrl || "");
      window.localStorage.removeItem(CART_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("cine-cruzeiro-cart-updated", { detail: { count: 0 } }));

      try {
        await sendTicketCheckoutWebhook({ ...orderData, ...result.order });
      } catch (err) {
        console.warn("Webhook background sync notice:", err);
      }

      setStep("PIX_READY");
      onSuccessToast?.("Pix gerado com segurança. Sem taxas de conveniência.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel iniciar o pagamento.";
      setPaymentError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (step === "TICKETS") {
      setStep("CONCESSIONS");
      return;
    }
    if (step === "CONCESSIONS") {
      setStep(hasPromoStep ? "PROMO" : "CHECKOUT");
      return;
    }
    if (step === "PROMO") {
      setStep("CHECKOUT");
      return;
    }
    if (step === "CHECKOUT") {
      handleSubmitPayment();
    }
  };

  const handleBack = () => {
    if (step === "CHECKOUT") setStep(hasPromoStep ? "PROMO" : "CONCESSIONS");
    else if (step === "PROMO") setStep("CONCESSIONS");
    else if (step === "CONCESSIONS") setStep("TICKETS");
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  if (!isOpen || !movie) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4 md:p-6">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity duration-200 animate-fade-in"
        onClick={onClose}
      />

      <div className="relative z-10 my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-brand-950 text-white shadow-2xl shadow-blue-950/60 animate-scale-up">
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-600 via-brand-500 to-gold-400" />

        <div className="flex items-start justify-between px-6 py-5 bg-brand-900/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/20 px-2.5 py-0.5 text-[11px] font-bold text-brand-300">
                <Film className="h-3 w-3" />
                Sala Única
              </span>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Taxa Zero
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{movie.title}</h3>
            <p className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-400" />
              <span>
                Hoje às {selectedSession?.time || "--:--"} • {selectedSession?.format || "Sessão"}
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition duration-200 hover:bg-brand-850 hover:text-white cursor-pointer"
            aria-label="Fechar checkout"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-brand-900/30 px-6 py-2.5">
          <div className="flex items-center gap-2 text-xs text-brand-200">
            <Info className="h-4 w-4 text-brand-400 shrink-0" />
            <span>
              <strong>Ordem de chegada:</strong> chegue com 15 min de antecedência e escolha sua poltrona.
            </span>
          </div>
        </div>

        {step !== "PIX_READY" && (
          <div
            className="grid gap-1 bg-brand-950 px-5 py-3"
            style={{ gridTemplateColumns: `repeat(${checkoutSteps.length}, minmax(0, 1fr))` }}
          >
            {checkoutSteps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`rounded-xl px-2 py-2 text-[10px] font-black transition ${
                  index <= stepIndex ? "bg-brand-600 text-white" : "bg-brand-900 text-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[72vh] overflow-y-auto custom-scrollbar p-6 space-y-6">
          {step !== "PIX_READY" ? (
            <>
              {step === "TICKETS" && <section className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                  Ingressos
                </h4>
                <TicketQuantity
                  title="Ingresso Inteira"
                  price={priceFull}
                  quantity={fullTickets}
                  onMinus={() => setFullTickets(Math.max(0, fullTickets - 1))}
                  onPlus={() => setFullTickets(fullTickets + 1)}
                />
                <TicketQuantity
                  title="Ingresso Meia"
                  price={priceHalf}
                  badge="Lei 12.933"
                  quantity={halfTickets}
                  onMinus={() => setHalfTickets(Math.max(0, halfTickets - 1))}
                  onPlus={() => setHalfTickets(halfTickets + 1)}
                />
              </section>}

              {step === "CONCESSIONS" && <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                    Bomboniere
                  </h4>
                  {concessionOnlyCatalog.length > 0 && (
                    <span className="text-[11px] font-semibold text-slate-400">Deslize para ver mais</span>
                  )}
                </div>
                {concessionOnlyCatalog.length === 0 ? (
                  <div className="rounded-3xl bg-brand-900/70 p-5 text-sm font-semibold leading-relaxed text-slate-300 shadow-xl shadow-blue-950/20">
                    Nenhum produto ativo na bomboniere agora. Você pode continuar direto para a próxima etapa.
                  </div>
                ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                  {concessionOnlyCatalog.map((item) => {
                    const Icon = item.icon;
                    const quantity = concessionQuantities[item.id] || 0;
                    const stockLimit =
                      item.stock === "" || item.stock === undefined ? Number.POSITIVE_INFINITY : Number(item.stock || 0);
                    const maxQuantity = Math.min(Number(item.maxPerOrder || 8), stockLimit);
                    const disablePlus = quantity >= maxQuantity;
                    return (
                      <div
                        key={item.id}
                        className="flex min-w-[250px] snap-start flex-col overflow-hidden rounded-3xl bg-brand-900/70 shadow-xl shadow-blue-950/20"
                      >
                        <div className="relative flex aspect-[16/10] items-center justify-center bg-transparent">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(37,99,235,0.28),rgba(3,7,18,0.96)_55%,rgba(250,204,21,0.16))] text-gold-400">
                              <Icon className="h-10 w-10" />
                            </div>
                          )}
                          {item.badge && (
                            <span className="absolute left-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 text-[10px] font-black text-slate-950 shadow-lg">
                              {item.badge}
                            </span>
                          )}
                          {item.featured && !item.badge && (
                            <span className="absolute left-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">
                              Destaque
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-4">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h5 className="text-sm font-black text-white">{item.name}</h5>
                              {item.stock !== "" && item.stock !== undefined && (
                                <span className="shrink-0 rounded-full bg-brand-850 px-2 py-0.5 text-[10px] font-bold text-brand-300">
                                  {item.stock} un.
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-3 text-xs leading-snug text-slate-300">{item.description}</p>
                            {!!item.comboItems?.length && (
                              <div className="mt-3 space-y-1 rounded-2xl bg-brand-950/45 p-3">
                                {item.comboItems.slice(0, 3).map((comboItem) => (
                                  <div key={`${item.id}-${comboItem.name}`} className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-300">
                                    <span>{comboItem.name}</span>
                                    <span className="text-gold-400">x{comboItem.quantity}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {!!item.tags?.length && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <span key={`${item.id}-${tag}`} className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[10px] font-bold text-brand-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                            <div>
                              {item.compareAt && (
                                <div className="text-[11px] text-slate-500 line-through">
                                  R$ {item.compareAt.toFixed(2).replace(".", ",")}
                                </div>
                              )}
                              <div className="text-base font-black text-gold-400">
                                R$ {item.price.toFixed(2).replace(".", ",")}
                              </div>
                            </div>
                            <QuantityStepper
                              quantity={quantity}
                              onMinus={() => updateConcessionQuantity(item.id, -1)}
                              onPlus={() => updateConcessionQuantity(item.id, 1)}
                              disablePlus={disablePlus}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </section>}

              {step === "CHECKOUT" && <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                    Dados para receber no WhatsApp
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowCustomerLogin((current) => !current)}
                    className="text-[11px] font-bold text-gold-400 transition duration-200 hover:text-gold-300"
                  >
                    Cliente recorrente?
                  </button>
                </div>

                {showCustomerLogin && (
                  <div className="rounded-2xl bg-brand-900/70 p-4 shadow-xl shadow-blue-950/20 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <UserRound className="mt-0.5 h-5 w-5 text-brand-300" />
                      <div className="flex-1">
                        <h5 className="text-sm font-black text-white">Login rápido opcional</h5>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          Use apenas para preencher nome e WhatsApp automaticamente. Comprar como visitante continua sendo o padrão.
                        </p>
                        <button
                          type="button"
                          onClick={fillSavedCustomer}
                          disabled={!savedCustomer}
                          className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-xs font-black text-white transition duration-200 hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {savedCustomer ? "Usar dados salvos" : "Nenhum dado salvo"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400">Nome completo</span>
                    <input
                      type="text"
                      placeholder="Seu nome completo"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl bg-brand-900/70 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400">WhatsApp</span>
                    <input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={customerPhone}
                      onChange={(e) => handlePhoneInput(e.target.value)}
                      className="w-full rounded-xl bg-brand-900/70 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400">E-mail</span>
                  <input
                    type="email"
                    placeholder="E-mail para comprovante do pagamento"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded-xl bg-brand-900/70 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400">CPF para nota fiscal, opcional</span>
                  <input
                    type="text"
                    placeholder="Somente números"
                    value={customerCpf}
                    onChange={(e) => setCustomerCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="w-full rounded-xl bg-brand-900/70 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </label>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                  <input
                    type="checkbox"
                    checked={saveCustomer}
                    onChange={(event) => setSaveCustomer(event.target.checked)}
                    className="h-4 w-4 rounded accent-gold-400"
                  />
                  Salvar dados neste dispositivo para próximas compras
                </label>
              </section>}

              {step === "CHECKOUT" && <section className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                  Pagamento
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled
                    className={`rounded-2xl px-4 py-3 text-left opacity-55 transition duration-200 ${
                      paymentMethod === "pix"
                        ? "bg-brand-600 text-white shadow-glow-blue"
                        : "bg-brand-900/70 text-slate-300 hover:bg-brand-850"
                    }`}
                  >
                    <span className="block text-sm font-black">Pix</span>
                    <span className="mt-1 block text-[11px] font-semibold opacity-80">Indisponível</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("credit_card")}
                    className={`rounded-2xl px-4 py-3 text-left transition duration-200 ${
                      paymentMethod === "credit_card"
                        ? "bg-brand-600 text-white shadow-glow-blue"
                        : "bg-brand-900/70 text-slate-300 hover:bg-brand-850"
                    }`}
                  >
                    <span className="block text-sm font-black">Cartão de crédito</span>
                    <span className="mt-1 block text-[11px] font-semibold opacity-80">Pagamento seguro</span>
                  </button>
                </div>

                {paymentMethod === "credit_card" && (
                  <div className="space-y-3 rounded-3xl bg-brand-900/60 p-4 shadow-xl shadow-blue-950/20 animate-fade-in">
                    <div className="flex items-start gap-2 rounded-2xl bg-brand-950/55 p-3 text-[11px] font-semibold leading-relaxed text-slate-300">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <span>
                        O pagamento por cartão acontece no checkout oficial do Mercado Pago. O Cine Cruzeiro não recebe número, validade ou CVV.
                      </span>
                    </div>
                    <p className="rounded-2xl bg-brand-950/55 px-4 py-3 text-xs font-semibold leading-relaxed text-slate-300">
                      Ao continuar, criaremos um pedido pendente e você será levado para o Mercado Pago. O ingresso só aparece na conta após aprovação confirmada pelo webhook.
                    </p>
                  </div>
                )}

                {paymentError && (
                  <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-semibold leading-relaxed text-rose-200">
                    {paymentError}
                  </p>
                )}
              </section>}

              {step === "PROMO" && <section className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                    Ofertas especiais
                  </h4>
                  <p className="text-xs font-semibold leading-relaxed text-slate-400">
                    Campanhas cadastradas pelo Cine Cruzeiro para esta etapa do carrinho.
                  </p>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                  {promoCatalog.map((item) => {
                    const Icon = item.icon;
                    const quantity = concessionQuantities[item.id] || 0;
                    const stockLimit =
                      item.stock === "" || item.stock === undefined ? Number.POSITIVE_INFINITY : Number(item.stock || 0);
                    const maxQuantity = Math.min(Number(item.maxPerOrder || 4), stockLimit);
                    const disablePlus = quantity >= maxQuantity;
                    return (
                      <div
                        key={item.id}
                        className="flex min-w-[280px] snap-start flex-col overflow-hidden rounded-3xl bg-brand-900/70 shadow-2xl shadow-blue-950/20"
                      >
                        <div className="relative flex aspect-[16/9] items-center justify-center bg-transparent">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(37,99,235,0.32),rgba(3,7,18,0.95)_58%,rgba(250,204,21,0.18))] text-gold-400">
                              <Icon className="h-10 w-10" />
                            </div>
                          )}
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-brand-950/75 px-3 py-1 text-[10px] font-black text-brand-200 shadow-lg">
                            <Camera className="h-3.5 w-3.5 text-gold-400" />
                            Oferta
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h5 className="text-sm font-black text-white">{item.name}</h5>
                          <p className="mt-1 line-clamp-3 text-xs leading-snug text-slate-300">{item.description}</p>
                          <div className="mt-auto flex items-end justify-between gap-4 pt-4">
                            <div>
                              {item.compareAt && (
                                <div className="text-[11px] text-slate-500 line-through">
                                  R$ {item.compareAt.toFixed(2).replace(".", ",")}
                                </div>
                              )}
                              <div className="text-base font-black text-gold-400">
                                R$ {item.price.toFixed(2).replace(".", ",")}
                              </div>
                            </div>
                            <QuantityStepper
                              quantity={quantity}
                              onMinus={() => updateConcessionQuantity(item.id, -1)}
                              onPlus={() => updateConcessionQuantity(item.id, 1)}
                              disablePlus={disablePlus}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCouponExpanded((current) => !current)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition duration-200 hover:text-gold-400"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Possui cupom de desconto?
                </button>
                {couponExpanded && (
                  <div className="grid grid-cols-[1fr_auto] gap-2 animate-fade-in">
                    <input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder="Digite seu cupom"
                      className="w-full rounded-xl bg-brand-900/70 py-2.5 px-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                    <div className="rounded-xl bg-brand-900/70 px-3 py-2.5 text-xs font-black text-gold-400">
                      {couponDiscount > 0 ? "Aplicado" : "Validar"}
                    </div>
                  </div>
                )}
              </section>}
            </>
          ) : (
            <div className="space-y-6 text-center animate-fade-in py-2">
              <div className="inline-flex rounded-full bg-brand-600/20 p-3 text-brand-400">
                <QrCode className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">Chave Pix pronta</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Copie o código abaixo ou escaneie o QR Code no app do seu banco. Confirmação instantânea.
                </p>
              </div>

              <div className="mx-auto w-48 h-48 bg-white rounded-2xl p-3 flex flex-col items-center justify-center shadow-xl">
                {pixQrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${pixQrCodeBase64}`}
                    alt="QR Code Pix"
                    className="h-full w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-2 text-center bg-slate-50">
                  <QrCode className="h-24 w-24 text-slate-900" />
                  <span className="text-[10px] font-black text-slate-800 mt-1">CINE CRUZEIRO PIX</span>
                  <span className="text-[9px] font-bold text-emerald-600">TAXA ZERO</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-brand-900/60 p-3 flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-slate-400">Total a pagar:</span>
                  <div className="text-base font-black text-gold-400">
                    R$ {grandTotal.toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">Sessão:</span>
                  <div className="font-bold text-white">Hoje • {selectedSession?.time}</div>
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-brand-300">Código Pix copia e cola</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixCode}
                    className="w-full rounded-xl bg-brand-900/80 px-3 py-2.5 text-xs text-slate-300 font-mono truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyPix}
                    className="flex items-center gap-1.5 rounded-xl bg-gold-400 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-gold-300 active:scale-95 transition duration-200 shrink-0 cursor-pointer shadow-md"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="h-4 w-4 stroke-[3]" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {pixTicketUrl && (
                <a
                  href={pixTicketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-2xl bg-brand-600 px-5 py-3 text-xs font-black text-white transition duration-200 hover:bg-brand-500"
                >
                  Abrir pagamento seguro
                </a>
              )}

              <button
                type="button"
                onClick={() => setStep("TICKETS")}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300 underline cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Alterar ingressos ou bomboniere
              </button>
            </div>
          )}
        </div>

        {step !== "PIX_READY" && (
          <div className="bg-brand-950 p-5 sm:p-6 space-y-3 shadow-[0_-18px_40px_rgba(0,0,0,0.22)]">
            <div className="flex items-end justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total a pagar
                </span>
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Taxa Zero no Pix</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="text-xs font-semibold text-gold-400">
                    Desconto: R$ {couponDiscount.toFixed(2).replace(".", ",")}
                  </div>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-gold-400">
                R$ {grandTotal.toFixed(2).replace(".", ",")}
              </div>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === "TICKETS" || isLoading}
                className="rounded-2xl bg-brand-900 px-4 py-4 text-sm font-black text-slate-200 transition duration-200 hover:bg-brand-850 disabled:opacity-40"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleContinue}
                disabled={totalTickets === 0 || isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-400 to-gold-500 px-6 py-4 text-base font-black text-slate-950 shadow-glow transition duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>{paymentMethod === "credit_card" ? "Abrindo Mercado Pago..." : "Gerando Pix..."}</span>
                  </div>
                ) : (
                  <>
                    {step === "CHECKOUT" ? <Zap className="h-5 w-5 fill-slate-950" /> : <ShoppingBag className="h-5 w-5" />}
                    <span>{primaryButtonLabel}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketQuantity({
  title,
  price,
  badge,
  quantity,
  onMinus,
  onPlus,
}: {
  title: string;
  price: number;
  badge?: string;
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-brand-900/60 p-4 shadow-xl shadow-blue-950/10">
      <div>
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-gold-400" />
          <span className="text-sm font-bold text-white">{title}</span>
          {badge && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs font-semibold text-brand-400">
          R$ {price.toFixed(2).replace(".", ",")}
        </div>
      </div>
      <QuantityStepper quantity={quantity} onMinus={onMinus} onPlus={onPlus} />
    </div>
  );
}

function QuantityStepper({
  quantity,
  onMinus,
  onPlus,
  disablePlus = false,
}: {
  quantity: number;
  onMinus: () => void;
  onPlus: () => void;
  disablePlus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMinus}
        disabled={quantity === 0}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-850 text-white transition duration-200 hover:bg-brand-700 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center font-black text-sm text-white">{quantity}</span>
      <button
        type="button"
        onClick={onPlus}
        disabled={disablePlus}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white transition duration-200 hover:bg-brand-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 shadow-md shadow-brand-600/30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
