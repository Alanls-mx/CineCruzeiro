"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Check, Download, Eye, Send, Ticket as TicketIcon, WalletCards } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import {
  createGoogleWalletPass,
  fetchAccountTicketsGrouped,
  ticketDownloadUrl,
  TicketRecord,
  transferTicket,
} from "@/services/cinemaApi";

function formatSessionDate(value: string) {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  return value || "Data não informada";
}

export default function IngressosPage() {
  const [upcoming, setUpcoming] = useState<TicketRecord[]>([]);
  const [archived, setArchived] = useState<TicketRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<"upcoming" | "archived">("upcoming");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [validatedTicketId, setValidatedTicketId] = useState("");
  const ticketStatusesRef = useRef(new Map<string, TicketRecord["status"]>());
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleTickets = tab === "upcoming" ? upcoming : archived;
  const selectedTicket = useMemo(
    () => visibleTickets.find((ticket) => ticket.id === selectedId) || visibleTickets[0] || null,
    [selectedId, visibleTickets]
  );

  function reloadTickets(silent = false) {
    if (!silent) setStatus("loading");
    fetchAccountTicketsGrouped()
      .then((result) => {
        const allTickets = [...result.upcoming, ...result.archived];
        const newlyValidated = ticketStatusesRef.current.size
          ? allTickets.find((ticket) => ticket.status === "used" && ticketStatusesRef.current.get(ticket.id) === "active")
          : null;
        ticketStatusesRef.current = new Map(allTickets.map((ticket) => [ticket.id, ticket.status]));
        setUpcoming(result.upcoming);
        setArchived(result.archived);
        if (newlyValidated) {
          setTab("archived");
          setSelectedId(newlyValidated.id);
          setValidatedTicketId(newlyValidated.id);
          if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
          validationTimerRef.current = setTimeout(() => setValidatedTicketId(""), 4800);
        } else {
          setSelectedId((current) => current || result.upcoming[0]?.id || result.archived[0]?.id || "");
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!silent) setStatus("error");
      });
  }

  useEffect(() => {
    reloadTickets();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") reloadTickets(true);
    }, 3500);
    return () => {
      window.clearInterval(interval);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/conta" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-black text-slate-300 transition hover:text-gold-400">
          <ArrowLeft className="h-4 w-4" />
          Voltar para Minha conta
        </Link>
        <p className="mt-6 text-sm font-black uppercase tracking-[.22em] text-brand-300">Minha Conta</p>
        <h1 className="mt-4 font-display text-4xl font-black sm:text-5xl">Meus ingressos</h1>

        {status === "loading" && <div className="mt-10 h-64 skeleton-soft" />}
        {status === "error" && (
          <div className="mt-10">
            <p className="text-slate-300">Entre na sua conta para ver seus ingressos.</p>
            <Link href="/conta" className="mt-4 inline-flex text-gold-400">Ir para login</Link>
          </div>
        )}

        {status === "ready" && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">
            <aside>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-brand-900/70 p-1">
                <button type="button" onClick={() => setTab("upcoming")} className={`rounded-md px-3 py-3 text-sm font-black ${tab === "upcoming" ? "bg-brand-600 text-white" : "text-slate-400"}`}>
                  Próximos
                </button>
                <button type="button" onClick={() => setTab("archived")} className={`rounded-md px-3 py-3 text-sm font-black ${tab === "archived" ? "bg-brand-600 text-white" : "text-slate-400"}`}>
                  Arquivados
                </button>
              </div>
              <TicketList
                tickets={tab === "upcoming" ? upcoming : archived}
                selectedId={selectedTicket?.id || ""}
                onSelect={setSelectedId}
                empty={tab === "upcoming" ? "Nenhum ingresso futuro." : "Nenhum ingresso arquivado."}
              />
            </aside>

            {selectedTicket ? (
              <TicketDetails ticket={selectedTicket} justValidated={selectedTicket.id === validatedTicketId} onTransferred={(ticket) => {
                setSelectedId(ticket.id);
                reloadTickets();
              }} />
            ) : (
              <TicketEmptyState tab={tab} />
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function TicketList({ tickets, selectedId, onSelect, empty }: { tickets: TicketRecord[]; selectedId: string; onSelect: (id: string) => void; empty: string }) {
  if (!tickets.length) return <p className="rounded-lg bg-white/[0.04] p-4 text-sm text-slate-400">{empty}</p>;
  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          type="button"
          onClick={() => onSelect(ticket.id)}
          className={`w-full rounded-lg p-4 text-left transition ${ticket.id === selectedId ? "bg-brand-700 shadow-glow-blue" : "bg-brand-900/70 hover:bg-brand-850"}`}
        >
          <span className="text-xs font-black uppercase tracking-[.14em] text-gold-400">{formatSessionDate(ticket.sessionDate)} • {ticket.sessionTime}</span>
          <strong className="mt-2 block line-clamp-2 text-lg">{ticket.movieTitle}</strong>
          <span className="mt-1 block text-sm text-slate-300">{ticket.ticketType} • {statusLabel(ticket.status)}</span>
        </button>
      ))}
    </div>
  );
}

function TicketEmptyState({ tab }: { tab: "upcoming" | "archived" }) {
  const archived = tab === "archived";
  return (
    <section className="flex min-h-[440px] flex-col items-center justify-center bg-white/[0.035] px-6 py-12 text-center shadow-2xl shadow-blue-950/10">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-gold-400">
        <TicketIcon className="h-8 w-8" />
      </div>
      <h2 className="mt-6 font-display text-3xl font-black">
        {archived ? "Você ainda não possui ingressos arquivados." : "Você ainda não tem ingressos"}
      </h2>
      {!archived && (
        <>
          <p className="mt-3 max-w-md leading-7 text-slate-300">
            Escolha um filme da programação e seu próximo ingresso aparecerá aqui, com código e QR Code para a entrada.
          </p>
          <Link href="/filmes" className="mt-7 inline-flex min-h-[52px] items-center justify-center bg-gold-400 px-7 text-sm font-black text-slate-950 transition hover:bg-gold-300">
            Ver programação
          </Link>
        </>
      )}
    </section>
  );
}

function TicketDetails({ ticket, justValidated, onTransferred }: { ticket: TicketRecord; justValidated: boolean; onTransferred: (ticket: TicketRecord) => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [message, setMessage] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const statusClassName = ticket.status === "active"
    ? "bg-emerald-400/15 text-emerald-200"
    : "bg-white/8 text-slate-300";

  useEffect(() => {
    QRCode.toDataURL(ticket.qrPayload || ticket.code, {
      margin: 1,
      width: 220,
      color: { dark: "#020617", light: "#f8fafc" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [ticket.code, ticket.qrPayload]);

  async function addWallet() {
    setMessage("");
    try {
      const result = await createGoogleWalletPass(ticket.id);
      window.location.href = result.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Wallet indisponível.");
    }
  }

  async function submitTransfer(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await transferTicket(ticket.id, transferEmail);
      setTransferEmail("");
      setMessage("Ingresso transferido. O QR Code anterior foi invalidado.");
      setTransferSuccess(true);
      window.setTimeout(() => setTransferSuccess(false), 5200);
      onTransferred(result.ticket);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível transferir.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="relative overflow-hidden rounded-lg bg-[#101827] shadow-2xl shadow-blue-950/20">
      {justValidated && (
        <div className="ticket-validation-celebration" role="status" aria-live="assertive">
          <span className="ticket-validation-check" aria-hidden="true"><Check /></span>
          <strong>Entrada validada</strong>
          <span>QR Code confirmado pelo Cine Cruzeiro</span>
        </div>
      )}
      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <div className="bg-brand-950">
          {ticket.posterUrl ? (
            <img src={ticket.posterUrl} alt={`Poster de ${ticket.movieTitle}`} className="aspect-[2/3] h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-[2/3] h-full w-full items-center justify-center bg-brand-900 text-sm font-black text-slate-500">Poster</div>
          )}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-brand-300">Visualizar ingresso</p>
              <h2 className="mt-3 font-display text-3xl font-black leading-none sm:text-4xl">{ticket.movieTitle}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassName}`}>
              {statusLabel(ticket.status)}
            </span>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-[1fr_220px]">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Data e horário" value={`${formatSessionDate(ticket.sessionDate)} às ${ticket.sessionTime}`} />
              <Info label="Sala" value={ticket.sessionRoom || "Cine Cruzeiro"} />
              <Info label="Poltrona" value={ticket.seat || ticket.seatLabel || "Lugar livre"} />
              <Info label="Formato/idioma" value={ticket.sessionFormat} />
              <Info label="Tipo" value={ticket.ticketType} />
              <Info label="Pedido" value={ticketHumanReference(ticket)} title={ticket.orderReference || ticket.orderId || ticketHumanReference(ticket)} />
              <Info label="Código" value={ticket.code} mono />
            </dl>
            <div className="self-start justify-self-center rounded-lg bg-white p-4 text-center text-xs font-black text-slate-950">
              {qrDataUrl ? <img src={qrDataUrl} alt={`QR Code do ingresso ${ticket.code}`} className="mx-auto h-44 w-44 max-w-full" /> : ticket.code}
            </div>
          </div>

          <section className="mt-8 border-t border-white/8 pt-6">
            <h3 className="text-sm font-black uppercase tracking-[.16em] text-gold-400">Bomboniere no pedido</h3>
            {ticket.extras?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ticket.extras.map((item) => (
                  <div key={`${ticket.id}-${item.id || item.name}`} className="rounded-lg bg-brand-950/70 p-3">
                    <strong>{item.name}</strong>
                    <span className="block text-sm text-slate-400">Quantidade: {item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                {ticket.extrasSharedByOrder && ticket.orderTicketIndex
                  ? "Os extras deste pedido aparecem no ingresso principal para evitar duplicidade."
                  : "Sem extras comprados neste pedido."}
              </p>
            )}
          </section>

          <p className="mt-6 rounded-lg bg-brand-950/70 p-4 text-sm leading-6 text-slate-300">
            Apresente o QR Code na entrada. Chegue com 15 minutos de antecedência. Ingressos usados ou 4 horas após a sessão seguem disponíveis no histórico.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <a href={ticketDownloadUrl(ticket.id, { view: true })} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/12">
              <Eye className="h-4 w-4" />
              Visualizar ingresso
            </a>
            <a href={ticketDownloadUrl(ticket.id)} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/12">
              <Download className="h-4 w-4" />
              Baixar ingresso
            </a>
            <ActionButton icon={<WalletCards />} label="Adicionar à Google Wallet" onClick={addWallet} />
            <a href="#transferir-ingresso" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/12">
              <Send className="h-4 w-4" />
              Transferir ingresso
            </a>
          </div>

          <form id="transferir-ingresso" onSubmit={submitTransfer} className="mt-6 rounded-lg bg-brand-950/70 p-4">
            {transferSuccess && (
              <div className="mb-4 flex items-start gap-3 rounded-lg bg-emerald-400/12 p-4 text-emerald-100 shadow-[0_18px_44px_rgba(16,185,129,.12)] motion-safe:animate-pulse">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-sm font-black text-[#022c22]">✓</span>
                <div>
                  <strong className="block text-sm font-black">Transferência concluída</strong>
                  <span className="mt-1 block text-sm text-emerald-100/85">O destinatário receberá o ingresso na conta e o QR Code anterior foi invalidado.</span>
                </div>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[.16em] text-slate-400">E-mail do destinatário cadastrado</span>
              <input type="email" value={transferEmail} onChange={(event) => setTransferEmail(event.target.value)} disabled={!ticket.canTransfer} className="mt-2 w-full" placeholder="cliente@email.com" />
            </label>
            <button type="submit" disabled={!ticket.canTransfer || loading} className="mt-4 bg-gold-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-45">
              {loading ? "Transferindo..." : "Confirmar transferência"}
            </button>
            {!ticket.canTransfer && <p className="mt-3 text-sm text-slate-500">Este ingresso não pode ser transferido.</p>}
            {message && <p className="mt-3 text-sm font-semibold text-amber-200">{message}</p>}
          </form>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value, mono = false, title }: { label: string; value: string; mono?: boolean; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</dt>
      <dd title={title || value} className={`mt-1 max-w-full text-sm font-black text-white ${mono ? "font-mono break-all" : "break-words"}`}>{value}</dd>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/12">
      <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label}
    </button>
  );
}

function statusLabel(status: TicketRecord["status"]) {
  const labels: Record<TicketRecord["status"], string> = {
    active: "Válido",
    used: "Usado",
    archived: "Arquivado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    expired: "Expirado",
    pending_payment: "Aguardando pagamento",
  };
  return labels[status] || status;
}

function ticketHumanReference(ticket: TicketRecord) {
  return [
    ticket.movieTitle || "Filme",
    [ticket.sessionTime, ticket.sessionFormat].filter(Boolean).join(" • "),
  ].filter(Boolean).join(" - ");
}
