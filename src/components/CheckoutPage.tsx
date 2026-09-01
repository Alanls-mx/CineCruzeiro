"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Accessibility, CircleUserRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { useSeatRealtime } from "@/hooks/useSeatRealtime";
import { AccountSubscription, CustomerUser, SessionSeatMap, TicketTypeRecord, createCheckoutPayment, createClubCreditCheckout, fetchCheckoutOrderStatus, fetchCurrentCustomer, fetchMercadoPagoCheckoutConfig, fetchMySubscriptions, fetchSessionSeatMap } from "@/services/cinemaApi";
import { checkoutDraftTotal, clearCheckoutDraft, findSession, isSessionCheckoutAvailable, isUploadedAsset, money, publicAssetPath, readCheckoutDraft, StoredCheckoutDraft, writeCheckoutDraft } from "@/utils/cinema";
import { trackMarketingEvent } from "@/utils/tracking";

type Step = "ingressos" | "extras" | "pagamento" | "confirmacao";
type CheckoutPaymentResult = {
  order?: { id?: string; status?: string };
  payment?: { id?: string; status?: string; qrCode?: string; qrCodeBase64?: string; ticketUrl?: string; checkoutUrl?: string } | null;
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

function ticketTypesForSession(ticketTypes: TicketTypeRecord[], ticketTypeIds?: string[]) {
  const allowedIds = new Set(ticketTypeIds || []);
  return ticketTypes.filter((ticketType) => ticketType.active !== false && (!allowedIds.size || allowedIds.has(ticketType.id)));
}
function initialTicketQuantities(ticketTypes: TicketTypeRecord[], fullTickets = 1, halfTickets = 0) {
  if (!ticketTypes.length) return {};
  const fullType = ticketTypes.find((ticketType) => /inteira|normal|adulto/i.test(ticketType.name))
    || ticketTypes.find((ticketType) => !/meia/i.test(ticketType.name))
    || ticketTypes[0];
  const halfType = ticketTypes.find((ticketType) => /meia/i.test(ticketType.name)) || ticketTypes[1] || ticketTypes[0];
  const quantities: Record<string, number> = {};
  if (fullTickets > 0) quantities[fullType.id] = Number(fullTickets);
  if (halfTickets > 0) quantities[halfType.id] = Number(quantities[halfType.id] || 0) + Number(halfTickets);
  return quantities;
}

function selectedTicketItems(draft: StoredCheckoutDraft, ticketTypes: TicketTypeRecord[]) {
  const quantities = draft.ticketQuantities ?? initialTicketQuantities(ticketTypes, draft.fullTickets ?? 1, draft.halfTickets ?? 0);
  return Object.entries(quantities)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => ({ id, quantity: Number(quantity) }))
    .filter((item) => ticketTypes.some((ticketType) => ticketType.id === item.id));
}

function generatedTicketCount(draft: StoredCheckoutDraft, ticketTypes: TicketTypeRecord[]) {
  const byId = new Map(ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
  return selectedTicketItems(draft, ticketTypes).reduce((sum, item) => {
    const bundleQuantity = Math.max(1, Number(byId.get(item.id)?.bundleQuantity || 1));
    return sum + item.quantity * bundleQuantity;
  }, 0);
}

export function CheckoutPage({ sessionId, step }: { sessionId: string; step: Step }) {
  const router = useRouter();
  const { content, status, error } = useCinemaContent();
  const [draft, setDraft] = useState<StoredCheckoutDraft | null>(null);
  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [confirmationStatus, setConfirmationStatus] = useState<"idle" | "checking" | "ready" | "invalid">("idle");
  const [loading, setLoading] = useState(false);
  const [clubLoading, setClubLoading] = useState(false);
  const [clubSubscriptions, setClubSubscriptions] = useState<AccountSubscription[]>([]);
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [mercadoPagoConfig, setMercadoPagoConfig] = useState<MercadoPagoCheckoutConfig | null>(null);
  const [seatMap, setSeatMap] = useState<SessionSeatMap | null>(null);
  const [seatMapStatus, setSeatMapStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const loadedSeatSessionRef = useRef("");
  const found = findSession(content, sessionId);
  const sessionCanCheckout = isSessionCheckoutAvailable(found?.session);
  const availableTicketTypes = useMemo(
    () => ticketTypesForSession(content?.ticketTypes || [], found?.session.ticketTypeIds),
    [content?.ticketTypes, found?.session.ticketTypeIds]
  );
  const total = checkoutDraftTotal(draft, found?.session, content?.concessions || [], content?.ticketTypes || []);
  const requiredSeatCount = draft ? generatedTicketCount(draft, availableTicketTypes) : 0;
  const selectedSeatIds = draft?.selectedSeatIds || [];
  const availableSeatIds = new Set((seatMap?.rows || [])
    .flatMap((row) => row.seats)
    .filter((seat) => seat.status === "available" || seat.heldByMe)
    .map((seat) => seat.id));
  const ticketSelectionComplete = seatMapStatus === "ready"
    && requiredSeatCount > 0
    && (!seatMap?.enabled || (
      selectedSeatIds.length === requiredSeatCount
      && new Set(selectedSeatIds).size === requiredSeatCount
      && selectedSeatIds.every((seatId) => availableSeatIds.has(seatId))
    ));
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

  const activeSessionId = found?.session.id || "";
  const refreshSeatMap = useCallback(async () => {
    if (!activeSessionId) return;
    setSeatMapStatus("loading");
    try {
      const next = await fetchSessionSeatMap(activeSessionId, draft?.seatHoldToken || "");
      setSeatMap(next);
      setSeatMapStatus("ready");
    } catch {
      setSeatMap(null);
      setSeatMapStatus("error");
    }
  }, [activeSessionId, draft?.seatHoldToken]);

  const updateDraft = useCallback((patch: Partial<StoredCheckoutDraft>) => {
    if (!found) return;
    const persisted = readCheckoutDraft();
    const source = persisted?.sessionId === found.session.id ? persisted : draft;
    const next = {
      ...(source || {}),
      movieId: found.movie.id,
      sessionId: found.session.id,
      fullTickets: source?.fullTickets ?? 1,
      halfTickets: source?.halfTickets ?? 0,
      ticketQuantities: source?.ticketQuantities ?? initialTicketQuantities(availableTicketTypes, source?.fullTickets ?? 1, source?.halfTickets ?? 0),
      selectedSeatIds: source?.selectedSeatIds || [],
      seatHoldToken: source?.seatHoldToken || crypto.randomUUID(),
      concessionQuantities: source?.concessionQuantities || {},
      extrasVisited: source?.extrasVisited ?? false,
      paymentMethod: source?.paymentMethod || "credit_card",
      ...patch,
    };
    writeCheckoutDraft(next);
    setDraft(next);
  }, [availableTicketTypes, draft, found]);

  const applySeatChange = useCallback((change: { seatId: string; status: "available" | "held" | "unavailable"; heldByMe?: boolean }) => {
    setSeatMap((current) => current ? {
      ...current,
      rows: current.rows.map((row) => ({
        ...row,
        seats: row.seats.map((seat) => seat.id === change.seatId ? { ...seat, status: change.status, heldByMe: Boolean(change.heldByMe) } : seat)
      }))
    } : current);
    if ((change.status === "unavailable" || (change.status === "held" && !change.heldByMe)) && selectedSeatIds.includes(change.seatId)) {
      updateDraft({ selectedSeatIds: selectedSeatIds.filter((id) => id !== change.seatId), extrasVisited: false });
      setPaymentError("Uma poltrona selecionada ficou indisponível. Escolha outro lugar.");
    }
  }, [selectedSeatIds, updateDraft]);

  const applySeatSessionState = useCallback((state: { occupiedSeatIds: string[]; heldSeats: Array<{ seatId: string; heldByMe: boolean }> }) => {
    const occupied = new Set(state.occupiedSeatIds);
    const held = new Map(state.heldSeats.map((item) => [item.seatId, item]));
    setSeatMap((current) => current ? {
      ...current,
      rows: current.rows.map((row) => ({
        ...row,
        seats: row.seats.map((seat) => seat.enabled === false ? seat : occupied.has(seat.id)
          ? { ...seat, status: "unavailable", heldByMe: false }
          : held.has(seat.id)
            ? { ...seat, status: "held", heldByMe: Boolean(held.get(seat.id)?.heldByMe) }
            : { ...seat, status: "available", heldByMe: false })
      }))
    } : current);
  }, []);

  const seatRealtime = useSeatRealtime({
    sessionId: activeSessionId,
    ownerToken: draft?.seatHoldToken || "",
    enabled: Boolean(seatMap?.enabled && !isValidPaymentResult(draft?.paymentResult)),
    selectedSeatIds,
    onSeatChange: applySeatChange,
    onSessionState: applySeatSessionState,
    onSessionRefresh: refreshSeatMap
  });

  useEffect(() => {
    const stored = readCheckoutDraft();
    setDraft(stored?.sessionId === sessionId ? stored : null);
    setHydratedSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!found || !draft || draft.seatHoldToken || isValidPaymentResult(draft.paymentResult)) return;
    updateDraft({ seatHoldToken: crypto.randomUUID() });
  }, [draft, found, updateDraft]);

  useEffect(() => {
    if (status !== "ready" || step === "confirmacao" || sessionCanCheckout) return;
    clearCheckoutDraft(sessionId);
    setDraft(null);
    router.replace("/filmes");
  }, [router, sessionCanCheckout, sessionId, status, step]);

  useEffect(() => {
    const loadKey = `${activeSessionId}:${draft?.seatHoldToken || ""}`;
    if (!activeSessionId || loadedSeatSessionRef.current === loadKey) return;
    loadedSeatSessionRef.current = loadKey;
    void refreshSeatMap();
  }, [activeSessionId, draft?.seatHoldToken, refreshSeatMap]);

  useEffect(() => {
    if (!draft || !seatMap?.enabled || seatMapStatus !== "ready" || isValidPaymentResult(draft.paymentResult)) return;
    const validSeatIds = new Set(seatMap.rows
      .flatMap((row) => row.seats)
      .filter((seat) => seat.status === "available" || seat.heldByMe)
      .map((seat) => seat.id));
    const reconciled = [...new Set(draft.selectedSeatIds || [])]
      .filter((seatId) => validSeatIds.has(seatId))
      .slice(0, requiredSeatCount);
    if (reconciled.join("|") !== (draft.selectedSeatIds || []).join("|")) {
      updateDraft({ selectedSeatIds: reconciled });
    }
  }, [draft, requiredSeatCount, seatMap, seatMapStatus, updateDraft]);

  useEffect(() => {
    if (hydratedSessionId !== sessionId || !found || !sessionCanCheckout || draft?.sessionId === found.session.id) return;
    const next = {
      movieId: found.movie.id,
      sessionId: found.session.id,
      fullTickets: 1,
      halfTickets: 0,
      ticketQuantities: initialTicketQuantities(availableTicketTypes),
      selectedSeatIds: [],
      seatHoldToken: crypto.randomUUID(),
      concessionQuantities: {},
      extrasVisited: false,
      paymentMethod: "credit_card" as const,
    };
    writeCheckoutDraft(next);
    setDraft(next);
  }, [hydratedSessionId, sessionId, found, sessionCanCheckout, draft?.sessionId, availableTicketTypes]);

  useEffect(() => {
    if (!found || !draft) return;
    const hasPaymentResult = isValidPaymentResult(draft.paymentResult);
    const persistedDraft = readCheckoutDraft();
    const hasVisitedExtras = Boolean(
      draft.extrasVisited
      || (persistedDraft?.sessionId === found.session.id && persistedDraft.extrasVisited)
    );
    if (["extras", "pagamento"].includes(step) && seatMapStatus === "ready" && !ticketSelectionComplete) {
      router.replace(checkoutPathFor("ingressos"));
      return;
    }
    if (step === "extras" && !draft.extrasVisited) {
      updateDraft({ extrasVisited: true });
      return;
    }
    if (step === "pagamento" && !hasVisitedExtras) {
      router.replace(checkoutPathFor("extras"));
      return;
    }
    if (step === "confirmacao" && !hasPaymentResult) {
      router.replace(checkoutPathFor(draft.extrasVisited ? "pagamento" : "extras"));
      return;
    }
    if (step === "confirmacao" && hasPaymentResult && confirmationStatus === "idle") {
      setConfirmationStatus("checking");
      const result = draft.paymentResult as CheckoutPaymentResult;
      fetchCheckoutOrderStatus(result.order?.id || "")
        .then((fresh) => {
          updateDraft({ paymentResult: fresh });
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
  }, [draft, checkoutPathFor, confirmationStatus, found, router, seatMapStatus, step, ticketSelectionComplete, updateDraft]);

  const confirmationResult = draft?.paymentResult as CheckoutPaymentResult | undefined;
  const confirmationOrderId = String(confirmationResult?.order?.id || "");
  const confirmationPaymentStatus = String(confirmationResult?.payment?.status || "");
  const trackingItems = useMemo(() => {
    if (!draft || !found) return [];
    const ticketTypesById = new Map(availableTicketTypes.map((ticketType) => [ticketType.id, ticketType]));
    const ticketItems = selectedTicketItems(draft, availableTicketTypes).map((item) => {
      const ticketType = ticketTypesById.get(item.id);
      return {
        item_id: `ticket-${item.id}`,
        item_name: `${found.movie.title} - ${ticketType?.name || "Ingresso"}`,
        item_category: "Ingresso",
        item_variant: found.session.format || "",
        price: Number(ticketType?.price || 0),
        quantity: item.quantity,
      };
    });
    const concessionItems = (content?.concessions || []).filter((item) => Number(draft.concessionQuantities?.[item.id] || 0) > 0).map((item) => ({
      item_id: `concession-${item.id}`,
      item_name: item.name,
      item_category: "Bomboniere",
      price: Number(item.price || 0),
      quantity: Number(draft.concessionQuantities?.[item.id] || 0),
    }));
    return [...ticketItems, ...concessionItems];
  }, [availableTicketTypes, draft, content?.concessions, found]);

  useEffect(() => {
    if (!found || !draft) return;
    const key = `cine-tracked-checkout-${found.session.id}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    trackMarketingEvent("begin_checkout", {
      currency: "BRL",
      value: total,
      num_items: selectedTicketItems(draft, availableTicketTypes).reduce((sum, item) => sum + item.quantity, 0),
      items: trackingItems,
    });
  }, [availableTicketTypes, draft, found, total, trackingItems]);

  useEffect(() => {
    if (confirmationPaymentStatus !== "approved" || !confirmationOrderId) return;
    const key = `cine-tracked-purchase-${confirmationOrderId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    trackMarketingEvent("purchase", { currency: "BRL", value: total, transaction_id: confirmationOrderId, affiliation: "Cine Cruzeiro Online", items: trackingItems });
  }, [confirmationOrderId, confirmationPaymentStatus, total, trackingItems]);

  useEffect(() => {
    if (step !== "confirmacao" || !confirmationOrderId || !["pending", "processing"].includes(confirmationPaymentStatus)) return;

    let cancelled = false;
    let timer: number | undefined;

    const pollPayment = async () => {
      try {
        const fresh = await fetchCheckoutOrderStatus(confirmationOrderId);
        if (cancelled) return;
        updateDraft({ paymentResult: fresh });
        setConfirmationStatus("ready");
        if (["pending", "processing"].includes(String(fresh.payment?.status || ""))) {
          timer = window.setTimeout(pollPayment, 3000);
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(pollPayment, 5000);
      }
    };

    timer = window.setTimeout(pollPayment, 3000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [confirmationOrderId, confirmationPaymentStatus, step, updateDraft]);

  const continueToPayment = useCallback(() => {
    if (!found || !draft) return;
    if (!ticketSelectionComplete) {
      router.replace(checkoutPathFor("ingressos"));
      return;
    }
    const persisted = readCheckoutDraft();
    const source = persisted?.sessionId === found.session.id ? persisted : draft;
    const next: StoredCheckoutDraft = {
      ...source,
      movieId: found.movie.id,
      sessionId: found.session.id,
      extrasVisited: true,
    };
    writeCheckoutDraft(next);
    setDraft(next);
    router.push(checkoutPathFor("pagamento"));
  }, [draft, checkoutPathFor, found, router, ticketSelectionComplete]);

  const selectedConcessions = useMemo(() => {
    const quantities = draft?.concessionQuantities || {};
    return (content?.concessions || []).filter((item) => Number(quantities[item.id] || 0) > 0);
  }, [content?.concessions, draft?.concessionQuantities]);

  const submitPayment = useCallback(async (cardData?: MercadoPagoCardPayload) => {
    if (!found || !draft) return;
    setLoading(true);
    setPaymentError("");
    try {
      const persisted = readCheckoutDraft();
      const checkoutDraft = persisted?.sessionId === found.session.id ? persisted : draft;
      if (!mercadoPagoConfig?.enabled || !mercadoPagoConfig.configured || !mercadoPagoConfig.livePayments) {
        throw new Error("Pix real indisponível: configure o Mercado Pago no ambiente de produção.");
      }
      if (checkoutDraft.paymentMethod === "credit_card" && !cardData?.token) {
        throw new Error("Preencha os dados do cartão no formulário seguro do Mercado Pago.");
      }
      trackMarketingEvent("add_payment_info", {
        currency: "BRL",
        value: total,
        payment_type: checkoutDraft.paymentMethod === "credit_card" ? "credit_card" : "pix",
        items: trackingItems,
      });
      const idempotencyKey = `${found.session.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const result = await createCheckoutPayment(
        {
          id: idempotencyKey,
          idempotencyKey,
          movieId: found.movie.id,
          sessionId: found.session.id,
          fullTicketsCount: Number(checkoutDraft.fullTickets || 0),
          halfTicketsCount: Number(checkoutDraft.halfTickets || 0),
          ticketItems: selectedTicketItems(checkoutDraft, availableTicketTypes),
          selectedSeatIds: checkoutDraft.selectedSeatIds || [],
          seatHoldToken: checkoutDraft.seatHoldToken,
          concessionItems: Object.entries(checkoutDraft.concessionQuantities || {})
            .filter(([, qty]) => Number(qty) > 0)
            .map(([id, qty]) => ({ id, quantity: Number(qty) })),
          couponCode: checkoutDraft.couponCode,
          customerName: customerUser?.name || checkoutDraft.customerName || "Cliente Cine Cruzeiro",
          customerPhone: customerUser?.phone || checkoutDraft.customerPhone || "",
          customerEmail: customerUser?.email || checkoutDraft.customerEmail || "",
          customerCpf: customerUser?.cpf || checkoutDraft.customerCpf || "",
          useClubCredits: checkoutDraft.useClubCredits === true,
          useClubBenefits: checkoutDraft.useClubBenefits !== false && Boolean(activeClubSubscription(clubSubscriptions)),
          paymentMethod: checkoutDraft.paymentMethod === "credit_card" ? "CREDIT_CARD" : "PIX",
          createdAt: new Date().toISOString(),
        },
        checkoutDraft.paymentMethod || "pix",
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
      updateDraft({ paymentResult: result });
      router.push(checkoutPathFor("confirmacao"));
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Nao foi possivel iniciar o pagamento.");
      void refreshSeatMap();
      throw err;
    } finally {
      setLoading(false);
    }
  }, [availableTicketTypes, draft, checkoutPathFor, found, mercadoPagoConfig, router, updateDraft, customerUser, clubSubscriptions, total, trackingItems, refreshSeatMap]);

  async function submitClubCredit() {
    if (!found || !draft) return;
    setClubLoading(true);
    setPaymentError("");
    try {
      const result = await createClubCreditCheckout({
        movieId: found.movie.id,
        sessionId: found.session.id,
        fullTicketsCount: Number(draft.fullTickets || 0),
        halfTicketsCount: Number(draft.halfTickets || 0),
        ticketItems: selectedTicketItems(draft, availableTicketTypes),
        selectedSeatIds: draft.selectedSeatIds || [],
        seatHoldToken: draft.seatHoldToken,
        concessionItems: Object.entries(draft.concessionQuantities || {})
          .filter(([, qty]) => Number(qty) > 0)
          .map(([id, qty]) => ({ id, quantity: Number(qty) })),
        couponCode: draft.couponCode,
      });
      updateDraft({ paymentResult: result });
      router.push(checkoutPathFor("confirmacao"));
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Nao foi possivel usar o beneficio do Clube.");
      void refreshSeatMap();
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
  if (!found || !draft) return <PageShell><p className="text-slate-300">Sessão não encontrada. Volte para a programação.</p><Link className="mt-4 inline-flex text-gold-400" href="/filmes">Ver filmes</Link></PageShell>;
  if (["extras", "pagamento"].includes(step) && (seatMapStatus !== "ready" || !ticketSelectionComplete)) {
    return <PageShell><div className="h-96 skeleton-soft" aria-label="Validando ingressos e poltronas" /></PageShell>;
  }
  if (step === "pagamento" && !draft.extrasVisited) {
    return <PageShell><div className="h-96 skeleton-soft" aria-label="Redirecionando para extras" /></PageShell>;
  }

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
            extrasVisited={Boolean(draft.extrasVisited)}
            ticketsComplete={ticketSelectionComplete}
            onContinueToPayment={continueToPayment}
          />
          {step === "ingressos" && (
            <TicketsStep
              draft={draft}
              updateDraft={updateDraft}
              ticketTypes={availableTicketTypes}
              seatMap={seatMap}
              seatMapStatus={seatMapStatus}
              realtimeStatus={seatRealtime.status}
              onSelectSeat={seatRealtime.selectSeat}
              onReleaseSeat={seatRealtime.releaseSeat}
              onRefreshSeatMap={refreshSeatMap}
            />
          )}
          {step === "extras" && (
            <ExtrasStep
              draft={draft}
              updateDraft={updateDraft}
              concessions={content?.concessions || []}
              onContinue={continueToPayment}
            />
          )}
          {step === "pagamento" && (
            <PaymentStep
              draft={draft}
              updateDraft={updateDraft}
              total={total}
              mercadoPagoConfig={mercadoPagoConfig}
              paymentError={paymentError}
              loading={loading}
              clubLoading={clubLoading}
              clubSubscriptions={clubSubscriptions}
              customerUser={customerUser}
              onSubmit={submitPayment}
              onClubCredit={submitClubCredit}
              ticketTypes={availableTicketTypes}
            />
          )}
          {step === "confirmacao" && (
            <ConfirmationStep
              draft={draft}
              confirmationStatus={confirmationStatus}
              orderReference={`${found.movie.title} - ${found.session.time} • ${found.session.format}`}
            />
          )}
        </section>
        <OrderSummary draft={draft} total={total} selectedConcessions={selectedConcessions} ticketTypes={availableTicketTypes} seatMap={seatMap} />
      </div>
      <MobileCheckoutBar
        draft={draft}
        step={step}
        total={total}
        loading={loading || clubLoading}
        paymentMethod={draft.paymentMethod || "pix"}
        onSubmit={submitPayment}
        onContinueToPayment={continueToPayment}
        submitDisabled={draft.paymentMethod === "credit_card" || !mercadoPagoConfig?.enabled || !mercadoPagoConfig.configured || !mercadoPagoConfig.livePayments}
        continueDisabled={step === "ingressos" && !ticketSelectionComplete}
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

function Steps({ sessionId, step, extrasVisited, ticketsComplete, onContinueToPayment }: {
  sessionId: string;
  step: Step;
  extrasVisited: boolean;
  ticketsComplete: boolean;
  onContinueToPayment: () => void;
}) {
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
          || (id === "extras" && !ticketsComplete)
          || (id === "pagamento" && (step === "ingressos" || !extrasVisited || !ticketsComplete))
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

function TicketsStep({ draft, updateDraft, ticketTypes, seatMap, seatMapStatus, realtimeStatus, onSelectSeat, onReleaseSeat, onRefreshSeatMap }: {
  draft: StoredCheckoutDraft;
  updateDraft: (patch: Partial<StoredCheckoutDraft>) => void;
  ticketTypes: TicketTypeRecord[];
  seatMap: SessionSeatMap | null;
  seatMapStatus: "idle" | "loading" | "ready" | "error";
  realtimeStatus: "connecting" | "connected" | "disconnected";
  onSelectSeat: (seatId: string) => Promise<{ ok: boolean; message?: string }>;
  onReleaseSeat: (seatId: string) => Promise<{ ok: boolean; message?: string }>;
  onRefreshSeatMap: () => Promise<void>;
}) {
  const quantities = draft.ticketQuantities || {};
  const requiredSeats = generatedTicketCount(draft, ticketTypes);
  const selectedSeatIds = draft.selectedSeatIds || [];
  const seatsById = new Map((seatMap?.rows || []).flatMap((row) => row.seats).map((seat) => [seat.id, seat]));
  const seatTypesById = new Map((seatMap?.seatTypes || []).map((type) => [type.id, type]));
  const seatSelectionComplete = seatMapStatus === "ready" && (!seatMap?.enabled || selectedSeatIds.length === requiredSeats);

  const [seatActionError, setSeatActionError] = useState("");
  const toggleSeat = async (seatId: string) => {
    const seat = seatsById.get(seatId);
    if (!seat || (seat.status !== "available" && !seat.heldByMe) || realtimeStatus !== "connected") return;
    setSeatActionError("");
    if (selectedSeatIds.includes(seatId)) {
      const result = await onReleaseSeat(seatId);
      if (result.ok) updateDraft({ selectedSeatIds: selectedSeatIds.filter((id) => id !== seatId), extrasVisited: false });
      else setSeatActionError(result.message || "Não foi possível liberar a poltrona.");
      return;
    }
    if (selectedSeatIds.length >= requiredSeats) return;
    const result = await onSelectSeat(seatId);
    if (result.ok) updateDraft({ selectedSeatIds: [...selectedSeatIds, seatId], extrasVisited: false });
    else setSeatActionError(result.message || "Esta poltrona acabou de ser selecionada por outra pessoa.");
  };

  return (
    <div className="space-y-8">
      {ticketTypes.map((ticketType) => (
        <div key={ticketType.id}>
          <QuantityRow
            label={`${ticketType.name} · ${money(ticketType.price)}${Number(ticketType.bundleQuantity || 1) > 1 ? ` · gera ${ticketType.bundleQuantity} ingressos` : ""}`}
            value={Number(quantities[ticketType.id] || 0)}
            onChange={(value) => {
              updateDraft({ ticketQuantities: { ...quantities, [ticketType.id]: value }, extrasVisited: false });
            }}
          />
          {ticketType.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{ticketType.description}</p>}
        </div>
      ))}
      {!ticketTypes.length && <p className="text-sm font-semibold text-amber-200">Nenhum tipo de ingresso foi liberado para esta sessão.</p>}
      <section aria-labelledby="seat-selection-title" className="border-t border-white/10 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="seat-selection-title" className="font-display text-2xl font-black text-white">Escolha de poltronas</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {seatMap?.enabled
                ? `Selecione ${requiredSeats} lugar(es), um para cada ingresso que será emitido.`
                : seatMapStatus === "ready" ? "Esta sessão usa lugares livres, ocupados por ordem de chegada." : "Consultando o mapa desta sala..."}
            </p>
          </div>
          {seatMap?.enabled && (
            <strong className={`rounded-md px-3 py-2 text-sm ${selectedSeatIds.length === requiredSeats ? "bg-emerald-400/15 text-emerald-200" : "bg-gold-400/10 text-gold-300"}`}>
              {selectedSeatIds.length} de {requiredSeats}
            </strong>
          )}
        </div>

        {seatMapStatus === "error" && (
          <div className="mt-5 rounded-lg bg-rose-400/10 p-4 text-sm text-rose-100">
            Não foi possível carregar as poltronas. <button type="button" onClick={() => void onRefreshSeatMap()} className="font-black text-white underline underline-offset-4">Tentar novamente</button>
          </div>
        )}
        {seatMapStatus === "loading" && <div className="mt-6 h-28 animate-pulse rounded-lg bg-white/[0.04]" aria-label="Carregando poltronas" />}
        {seatMapStatus === "ready" && seatMap?.enabled && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-300">
              {seatMap.seatTypes.map((type) => (
                <span key={type.id} className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: type.color }} />{type.name}</span>
              ))}
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-slate-500" />Indisponível</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-rose-300 bg-rose-700" />Reservada temporariamente</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-gold-200 bg-gold-400" />Selecionada por você</span>
              <span className="inline-flex items-center gap-2"><Accessibility className="h-4 w-4" />Cadeirante</span>
              <span className="inline-flex items-center gap-2"><CircleUserRound className="h-4 w-4" />Pessoa obesa</span>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg bg-[#080f1b] px-4 pb-6 pt-5">
              <div className="mx-auto mb-7 w-[min(620px,75%)] border-t-[3px] border-gold-400 pt-2 text-center text-xs font-black uppercase tracking-[.16em] text-slate-500">
                {seatMap.screenLabel || "TELA"}
              </div>
              <div className="mx-auto grid w-max gap-2">
                {seatMap.rows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-1.5">
                    <span className="w-6 text-center text-[11px] font-black text-slate-500">{row.label}</span>
                    <div className="flex items-center justify-center gap-1.5">
                      {row.seats.map((seat) => {
                        const selected = selectedSeatIds.includes(seat.id);
                        const type = seatTypesById.get(seat.typeId);
                        const temporarilyReserved = seat.status === "held" && !seat.heldByMe;
                        const unavailable = (seat.status !== "available" && !seat.heldByMe) || realtimeStatus !== "connected";
                        let seatStateClass = "bg-brand-700 hover:-translate-y-0.5";
                        if (unavailable) seatStateClass = "cursor-not-allowed border-slate-700 bg-transparent text-slate-600 opacity-60";
                        if (temporarilyReserved) seatStateClass = "cursor-not-allowed border-rose-300 bg-rose-800 text-rose-50 opacity-90";
                        if (selected) seatStateClass = "scale-105 border-gold-700 bg-gold-400 !text-slate-950";
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={unavailable}
                            onClick={() => void toggleSeat(seat.id)}
                            aria-pressed={selected}
                            aria-label={`${seat.label}, ${type?.name || "poltrona"}${seat.accessibility === "wheelchair" ? ", cadeirante" : seat.accessibility === "obese" ? ", pessoa obesa" : ""}${temporarilyReserved ? ", reservada temporariamente por outra compra" : unavailable ? ", indisponível" : selected ? ", selecionada por você" : ""}`}
                            title={temporarilyReserved ? `${seat.label} • Reservada temporariamente por outra compra` : `${seat.label} • ${type?.name || "Padrão"}${seat.accessibility === "wheelchair" ? " • Cadeirante" : seat.accessibility === "obese" ? " • Pessoa obesa" : ""}`}
                            className={`relative flex h-9 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 text-xs font-black text-white shadow-[inset_0_-3px_0_rgba(2,6,23,.4)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${seatStateClass}`}
                            style={{
                              ...(selected || unavailable || temporarilyReserved || !(seat.color || type?.color) ? {} : { backgroundColor: seat.color || type?.color }),
                              marginRight: seat.aisleAfter ? 24 : 0,
                            }}
                          >
                            {seat.accessibility === "wheelchair" ? (
                              <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                                <Accessibility className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="text-[9px] font-black leading-none">{seat.label}</span>
                              </span>
                            ) : seat.accessibility === "obese" ? (
                              <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                                <CircleUserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="text-[9px] font-black leading-none">{seat.label}</span>
                              </span>
                            ) : (
                              <span>{seat.label}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-6" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
            {selectedSeatIds.length > 0 && (
              <p className="mt-4 text-sm font-bold text-slate-300">
                Selecionadas: {selectedSeatIds.map((id) => seatsById.get(id)?.label || id).join(", ")}
              </p>
            )}
            <p className={`mt-3 text-xs font-bold ${realtimeStatus === "connected" ? "text-emerald-300" : "text-amber-200"}`} role="status">
              {realtimeStatus === "connected" ? "Poltronas sincronizadas em tempo real." : realtimeStatus === "connecting" ? "Conectando à reserva de poltronas..." : "Reconectando à reserva de poltronas..."}
            </p>
            {seatActionError && <p className="mt-2 text-sm font-semibold text-rose-200" role="alert">{seatActionError}</p>}
          </div>
        )}
      </section>
      {seatSelectionComplete && requiredSeats > 0 ? (
        <Link href={`/checkout/${draft.sessionId}/extras`} className="inline-flex bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300">Continuar para Extras</Link>
      ) : (
        <button type="button" disabled className="inline-flex bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 opacity-45">
          {requiredSeats <= 0 ? "Selecione um ingresso" : seatMap?.enabled ? "Selecione todas as poltronas" : "Carregando a sala..."}
        </button>
      )}
    </div>
  );
}

function ExtrasStep({ draft, updateDraft, concessions, onContinue }: { draft: StoredCheckoutDraft; updateDraft: (patch: Partial<StoredCheckoutDraft>) => void; concessions: Parameters<typeof checkoutDraftTotal>[2]; onContinue: () => void }) {
  const quantities = draft.concessionQuantities || {};
  const visibleConcessions = (concessions || []).filter((item) => item.active !== false);
  const [openDescriptions, setOpenDescriptions] = useState<Record<string, boolean>>({});
  const setQty = (id: string, qty: number) => {
    const persisted = readCheckoutDraft();
    const baseQuantities = persisted?.sessionId === draft.sessionId ? persisted.concessionQuantities || {} : quantities;
    updateDraft({ concessionQuantities: { ...baseQuantities, [id]: Math.max(0, qty) } });
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
                  unoptimized={isUploadedAsset(item.imageUrl)}
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

function PaymentStep({ draft, updateDraft, total, mercadoPagoConfig, paymentError, loading, clubLoading, clubSubscriptions, customerUser, onSubmit, onClubCredit, ticketTypes }: {
  draft: StoredCheckoutDraft;
  updateDraft: (patch: Partial<StoredCheckoutDraft>) => void;
  total: number;
  mercadoPagoConfig: MercadoPagoCheckoutConfig | null;
  paymentError: string;
  loading: boolean;
  clubLoading: boolean;
  clubSubscriptions: AccountSubscription[];
  customerUser: CustomerUser | null;
  onSubmit: (cardData?: MercadoPagoCardPayload) => Promise<void>;
  onClubCredit: () => void;
  ticketTypes: TicketTypeRecord[];
}) {
  const activeClub = activeClubSubscription(clubSubscriptions);
  const requestedTickets = generatedTicketCount(draft, ticketTypes);
  const selectedExtras = Object.values(draft.concessionQuantities || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
  const clubCredits = Number(activeClub?.creditsRemaining || activeClub?.creditsAvailable || 0);
  const plan = activeClub?.plan;
  const clubBenefitsEnabled = draft.useClubBenefits !== false;
  const clubCreditsEnabled = draft.useClubCredits === true;
  const selectedTicketPurchases = selectedTicketItems(draft, ticketTypes);
  const ticketSubtotal = selectedTicketPurchases.reduce((sum, item) => sum + Number(ticketTypes.find((type) => type.id === item.id)?.price || 0) * item.quantity, 0);
  const estimatedTicketDiscount = clubBenefitsEnabled ? ticketSubtotal * (Number(plan?.ticketDiscountPercent || 0) / 100) : 0;
  const estimatedCreditBase = Math.max(0, ticketSubtotal - estimatedTicketDiscount);
  const referenceValue = Number(plan?.creditReferenceValue || 0);
  const estimatedCredit = clubCreditsEnabled
    ? Math.min(estimatedCreditBase, referenceValue > 0 ? referenceValue * requestedTickets : estimatedCreditBase)
    : 0;
  const estimatedPayable = Math.max(0, total - estimatedTicketDiscount - estimatedCredit);
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
              <Input label="Nome" value={draft.customerName || ""} onChange={(value) => updateDraft({ customerName: value })} />
              <Input label="WhatsApp" value={draft.customerPhone || ""} onChange={(value) => updateDraft({ customerPhone: value })} />
              <Input label="E-mail" type="email" value={draft.customerEmail || ""} onChange={(value) => updateDraft({ customerEmail: value })} />
              <Input label="CPF, opcional" value={draft.customerCpf || ""} onChange={(value) => updateDraft({ customerCpf: value.replace(/\D/g, "").slice(0, 11) })} />
            </div>
          </>
        )}
      </section>
      <section>
        <h2 className="font-display text-3xl font-black">Pagamento</h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => updateDraft({ paymentMethod: "pix" })} className={`py-4 text-sm font-black ${draft.paymentMethod !== "credit_card" ? "bg-brand-700 text-white" : "bg-white/5 text-slate-300"}`}>Pix</button>
          <button type="button" onClick={() => updateDraft({ paymentMethod: "credit_card" })} className={`py-4 text-sm font-black ${draft.paymentMethod === "credit_card" ? "bg-brand-700 text-white" : "bg-white/5 text-slate-300"}`}>Cartão</button>
        </div>
        {draft.paymentMethod === "credit_card" && (
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
        {draft.paymentMethod !== "credit_card" && (
          <div className="mt-6 rounded-lg bg-brand-900/70 p-5 shadow-soft">
            <h3 className="text-base font-black text-white">Pix Mercado Pago</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Gere o QR Code e o Pix copia-e-cola sem sair do checkout. O ingresso só é liberado após a confirmação do Mercado Pago.
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">Total recalculado pelo backend: {money(total)}.</p>
          </div>
        )}
        {paymentError && <p className="mt-5 text-sm font-semibold text-rose-200">{paymentError}</p>}
        {draft.paymentMethod !== "credit_card" && (
          <button type="button" onClick={() => void onSubmit()} disabled={loading || mercadoPagoUnavailable} className="mt-8 w-full bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 disabled:opacity-50">
            {loading ? "Processando..." : "Gerar Pix"}
          </button>
        )}
        {activeClub && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-brand-900/70 p-4">
              <input
                type="checkbox"
                checked={clubBenefitsEnabled}
                onChange={(event) => updateDraft({ useClubBenefits: event.target.checked })}
                className="mt-1 h-4 w-4 accent-yellow-400"
              />
              <span>
                <strong className="block text-sm text-white">Aplicar benefícios do {plan?.name || "Clube"}</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-300">
                  {Number(plan?.ticketDiscountPercent || 0)}% nos ingressos, {Number(plan?.concessionDiscountPercent || 0)}% na bomboniere e itens grátis elegíveis. O servidor valida o saldo do ciclo.
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg bg-brand-900/70 p-4">
              <input
                type="checkbox"
                checked={clubCreditsEnabled}
                disabled={clubCredits < requestedTickets}
                onChange={(event) => updateDraft({ useClubCredits: event.target.checked })}
                className="mt-1 h-4 w-4 accent-yellow-400"
              />
              <span>
                <strong className="block text-sm text-white">Usar {requestedTickets} crédito(s) do Clube</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-300">Você possui {clubCredits}. O valor e a elegibilidade serão confirmados pelo servidor antes da cobrança.</span>
              </span>
            </label>
            {clubCreditsEnabled && (
              <div className="mt-3 space-y-2 bg-slate-950/60 p-4 text-sm tabular-nums">
                <div className="flex justify-between gap-4"><span>Ingresso(s)</span><strong>{money(ticketSubtotal)}</strong></div>
                <div className="flex justify-between gap-4 text-emerald-300"><span>Crédito Clube</span><strong>-{money(estimatedCredit)}</strong></div>
                <div className="flex justify-between gap-4 border-t border-white/10 pt-2"><span>{estimatedPayable > 0 ? "Complemento estimado" : "A pagar"}</span><strong>{money(estimatedPayable)}</strong></div>
                <p className="pt-1 text-xs text-slate-400">Créditos restantes após confirmação: {Math.max(0, clubCredits - requestedTickets)}.</p>
              </div>
            )}
            {clubCreditsEnabled && estimatedPayable <= 0 && selectedExtras === 0 && (
              <button type="button" onClick={onClubCredit} disabled={clubLoading || loading || clubCredits < requestedTickets} className="mt-3 w-full bg-brand-700 px-7 py-4 text-sm font-black text-white transition hover:bg-brand-600 disabled:opacity-50">
                {clubLoading ? "Confirmando créditos..." : "Confirmar com créditos do Clube"}
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

function ConfirmationStep({ draft, confirmationStatus, orderReference }: { draft: StoredCheckoutDraft; confirmationStatus: "idle" | "checking" | "ready" | "invalid"; orderReference: string }) {
  const [copied, setCopied] = useState(false);
  const result = draft.paymentResult as CheckoutPaymentResult | undefined;
  const approved = result?.payment?.status === "approved" || (result?.order?.status === "paid" && Boolean(result?.tickets?.length));
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
            <div className="rounded-lg bg-brand-950/70 p-4" aria-live="polite">
              <span className="block text-xs font-black uppercase tracking-[.14em] text-slate-400">Status</span>
              <strong className="mt-2 block text-white">
                {approved ? "Pagamento aprovado" : pending ? "Aguardando confirmação" : "Pedido recebido"}
              </strong>
              {pending && (
                <span className="mt-2 flex items-center gap-2 text-xs font-semibold text-brand-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-300" aria-hidden="true" />
                  Atualização automática ativa
                </span>
              )}
            </div>
          </div>

          {pending && result?.payment?.qrCode && (
            <div className="mt-6 grid items-center gap-5 rounded-lg bg-gold-400/10 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
              <PixQrCode code={result.payment.qrCode} base64={result.payment.qrCodeBase64} />
              <div>
                <p className="text-sm font-black text-gold-200">Pix gerado</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Escaneie o QR Code ou copie o código Pix e conclua no app do seu banco. O ingresso só fica válido após aprovação.</p>
                <button type="button" onClick={copyPix} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-gold-400 px-5 text-sm font-black text-slate-950 transition duration-200 hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </button>
              </div>
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

function PixQrCode({ code, base64 }: { code: string; base64?: string }) {
  const providerImage = useMemo(() => {
    const value = String(base64 || "").trim();
    if (!value) return "";
    return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
  }, [base64]);
  const [generatedImage, setGeneratedImage] = useState("");

  useEffect(() => {
    let mounted = true;
    setGeneratedImage("");

    if (providerImage || !code) {
      return () => {
        mounted = false;
      };
    }

    QRCode.toDataURL(code, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 224,
      color: { dark: "#020617", light: "#f3f6fb" },
    })
      .then((imageUrl) => {
        if (mounted) setGeneratedImage(imageUrl);
      })
      .catch(() => {
        if (mounted) setGeneratedImage("");
      });

    return () => {
      mounted = false;
    };
  }, [code, providerImage]);

  const imageUrl = providerImage || generatedImage;

  return (
    <div className="flex h-[224px] w-[224px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-2 shadow-[0_12px_36px_rgba(2,6,23,.28)]" aria-live="polite">
      {imageUrl ? (
        <Image src={imageUrl} alt="QR Code para pagamento via Pix" width={208} height={208} className="h-[208px] w-[208px] object-contain" unoptimized />
      ) : (
        <div className="h-[208px] w-[208px] animate-pulse rounded bg-slate-100" role="status" aria-label="Gerando QR Code Pix" />
      )}
    </div>
  );
}

function isValidPaymentResult(value: unknown) {
  const result = value as CheckoutPaymentResult | null;
  const paymentStatus = result?.payment?.status;
  const confirmedWithoutCharge = result?.order?.status === "paid" && Boolean(result?.tickets?.length);
  const providerPayment = result?.payment?.id && ["pending", "processing", "approved"].includes(String(paymentStatus || ""));
  return Boolean(result?.order?.id && (confirmedWithoutCharge || providerPayment));
}

function activeClubSubscription(subscriptions: AccountSubscription[]) {
  const now = Date.now();
  return subscriptions.find((subscription) => {
    if (!['active', 'ending'].includes(subscription.status)) return false;
    if (Number(subscription.creditsRemaining ?? subscription.creditsAvailable ?? 0) <= 0) return false;
    const benefitsUntil = subscription.benefitsUntil || subscription.currentPeriodEnd || subscription.cycleEnd;
    return !benefitsUntil || new Date(benefitsUntil).getTime() > now;
  }) || null;
}

function OrderSummary({ draft, total, selectedConcessions, ticketTypes, seatMap }: { draft: StoredCheckoutDraft; total: number; selectedConcessions: Array<{ id: string; name: string; price: number }>; ticketTypes: TicketTypeRecord[]; seatMap: SessionSeatMap | null }) {
  const seatsById = new Map((seatMap?.rows || []).flatMap((row) => row.seats).map((seat) => [seat.id, seat.label]));
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="border-t border-white/12 pt-5 lg:border-t-0 lg:pt-0">
        <h2 className="font-display text-2xl font-black">Resumo</h2>
        <dl className="mt-5 space-y-3 text-sm text-slate-300">
          {ticketTypes.filter((ticketType) => Number(draft.ticketQuantities?.[ticketType.id] || 0) > 0).map((ticketType) => (
            <div key={ticketType.id} className="flex justify-between gap-4">
              <dt>{ticketType.name}</dt>
              <dd>{Number(ticketType.bundleQuantity || 1) > 1
                ? `${draft.ticketQuantities?.[ticketType.id] || 0} pacote(s) · ${Number(draft.ticketQuantities?.[ticketType.id] || 0) * Number(ticketType.bundleQuantity || 1)} ingressos`
                : draft.ticketQuantities?.[ticketType.id] || 0}</dd>
            </div>
          ))}
          {selectedConcessions.map((item) => (
            <div key={item.id} className="flex justify-between gap-4"><dt>{item.name}</dt><dd>{draft.concessionQuantities?.[item.id] || 0}</dd></div>
          ))}
          <div className="flex justify-between gap-4">
            <dt>Poltronas</dt>
            <dd className="max-w-[55%] text-right">{seatMap?.enabled
              ? (draft.selectedSeatIds || []).map((id) => seatsById.get(id) || id).join(", ") || "A selecionar"
              : "Lugar livre"}</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-end justify-between border-t border-white/8 pt-5">
          <span className="text-sm font-bold text-slate-400">Total</span>
          <span className="text-3xl font-black text-gold-400">{money(total)}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">O valor final é recalculado pelo backend antes do pagamento.</p>
      </div>
    </aside>
  );
}

function MobileCheckoutBar({ draft, step, total, loading, paymentMethod, onSubmit, onContinueToPayment, submitDisabled = false, continueDisabled = false }: { draft: StoredCheckoutDraft; step: Step; total: number; loading: boolean; paymentMethod: StoredCheckoutDraft["paymentMethod"]; onSubmit: () => void; onContinueToPayment: () => void; submitDisabled?: boolean; continueDisabled?: boolean }) {
  const hrefByStep: Partial<Record<Step, string>> = {
    ingressos: `/checkout/${draft.sessionId}/extras`,
    extras: `/checkout/${draft.sessionId}/pagamento`,
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
        ) : continueDisabled ? (
          <button type="button" disabled className="inline-flex min-h-[50px] min-w-[132px] items-center justify-center bg-gold-400 px-5 text-sm font-black text-slate-950 opacity-45">
            Selecione os lugares
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
