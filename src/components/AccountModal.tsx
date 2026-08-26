"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, LogOut, QrCode, ShieldCheck, Ticket, UserRound, X } from "lucide-react";
import {
  CustomerUser,
  TicketRecord,
  fetchAccountTickets,
  fetchCurrentCustomer,
  googleLoginUrl,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  updateCurrentCustomer,
} from "@/services/cinemaApi";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const CUSTOMER_STORAGE_KEY = "cine-cruzeiro-customer";

type AccountMode = "login" | "register" | "profile" | "forgot" | "reset";

function onlyCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatCpf(value: string) {
  const raw = onlyCpf(value);
  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 3)}.${raw.slice(3)}`;
  if (raw.length <= 9) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6)}`;
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

export function AccountModal({ isOpen, onClose, onSaved }: AccountModalProps) {
  const [mode, setMode] = useState<AccountMode>("login");
  const [auth, setAuth] = useState<{ user: CustomerUser } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [validatedTicketId, setValidatedTicketId] = useState("");
  const ticketStatusesRef = useRef(new Map<string, TicketRecord["status"]>());
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const storedCustomer = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    const customer = storedCustomer ? JSON.parse(storedCustomer) : {};
    setAuth(null);
    setMode("login");
    setName(customer.name || "");
    setPhone(customer.phone || "");
    setCpf(formatCpf(customer.cpf || ""));
    setEmail(customer.email || "");
    setPassword("");
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("resetToken") || "";
    setResetToken(tokenFromUrl);
    setResetNotice("");
    setError("");
    setSaved(false);
    setTickets([]);
    fetchCurrentCustomer()
      .then(({ user }) => {
        setAuth({ user });
        setMode("profile");
        setName(user.name || customer.name || "");
        setPhone(user.phone || customer.phone || "");
        setCpf(formatCpf(user.cpf || customer.cpf || ""));
        setEmail(user.email || customer.email || "");
      })
      .catch(() => {
        // Conta e login sao opcionais; checkout convidado continua sendo o caminho principal.
        if (tokenFromUrl) setMode("reset");
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "profile" || !auth) return;
    const applyTickets = (nextTickets: TicketRecord[]) => {
      const newlyValidated = ticketStatusesRef.current.size
        ? nextTickets.find((ticket) => ticket.status === "used" && ticketStatusesRef.current.get(ticket.id) === "active")
        : null;
      ticketStatusesRef.current = new Map(nextTickets.map((ticket) => [ticket.id, ticket.status]));
      setTickets(nextTickets);
      if (newlyValidated) {
        setValidatedTicketId(newlyValidated.id);
        if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
        validationTimerRef.current = setTimeout(() => setValidatedTicketId(""), 4800);
      }
    };
    setTicketsLoading(true);
    fetchAccountTickets()
      .then(applyTickets)
      .catch((err) => setError(err instanceof Error ? err.message : "Nao foi possivel carregar seus ingressos."))
      .finally(() => setTicketsLoading(false));
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchAccountTickets().then(applyTickets).catch(() => undefined);
    }, 3500);
    return () => {
      window.clearInterval(interval);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, [isOpen, mode, auth]);

  const persistAuth = (nextAuth: { token?: string; user: CustomerUser }) => {
    window.localStorage.setItem(
      CUSTOMER_STORAGE_KEY,
      JSON.stringify({
        name: nextAuth.user.name,
        phone: nextAuth.user.phone || phone,
        email: nextAuth.user.email,
        cpf: nextAuth.user.cpf || onlyCpf(cpf),
      })
    );
    setAuth({ user: nextAuth.user });
    setMode("profile");
    onSaved?.();
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      persistAuth(await loginCustomer({ email, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      persistAuth(await registerCustomer({ name, email, password, phone, cpf: onlyCpf(cpf) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    setLoading(true);
    setError("");
    setResetNotice("");
    try {
      const result = await requestPasswordReset(email);
      setResetNotice(result.message || "Se o e-mail existir, enviaremos as instruções de recuperação.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel solicitar recuperacao.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await resetPassword({ token: resetToken, password });
      persistAuth({ user: result.user });
      setResetNotice("Senha atualizada com sucesso.");
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSave = () => {
    const nextCustomer = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      cpf: onlyCpf(cpf),
    };
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(nextCustomer));
    if (auth) {
      updateCurrentCustomer(nextCustomer)
        .then(({ user }) => setAuth({ user }))
        .catch((err) => setError(err instanceof Error ? err.message : "Nao foi possivel atualizar sua conta."));
    }
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2200);
  };

  const handleLogout = async () => {
    await logoutCustomer();
    setAuth(null);
    setMode("login");
    setPassword("");
    onSaved?.();
  };

  const handleTicketValidated = (updatedTicket: TicketRecord) => {
    setTickets((current) => current.map((ticket) => (ticket.code === updatedTicket.code ? updatedTicket : ticket)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-brand-950 text-white shadow-2xl shadow-blue-950/60 animate-scale-up">
        <div className="flex items-start justify-between bg-brand-900/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black">Minha Conta</h3>
              <p className="text-xs font-semibold text-slate-400">Cadastro rápido para checkout e nota fiscal.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition duration-200 hover:bg-brand-850 hover:text-white"
            aria-label="Fechar minha conta"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!auth && (
          <div className="grid grid-cols-2 gap-2 bg-brand-950 px-6 pt-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                mode === "login" ? "bg-brand-600 text-white" : "bg-brand-900 text-slate-300"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                mode === "register" ? "bg-brand-600 text-white" : "bg-brand-900 text-slate-300"
              }`}
            >
              Criar conta
            </button>
          </div>
        )}

        <div className="space-y-3 p-6">
          {mode !== "login" && mode !== "forgot" && mode !== "reset" && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-xl bg-brand-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          )}
          {mode !== "reset" && (
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-mail"
              className="w-full rounded-xl bg-brand-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          )}
          {mode === "reset" && (
            <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-200">
              Link de recuperação recebido. Digite sua nova senha para continuar.
            </p>
          )}
          {mode !== "profile" && mode !== "forgot" && (
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
              className="w-full rounded-xl bg-brand-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          )}
          {mode !== "login" && mode !== "forgot" && mode !== "reset" && (
            <>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="WhatsApp"
                className="w-full rounded-xl bg-brand-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
              <input
                value={cpf}
                onChange={(event) => setCpf(formatCpf(event.target.value))}
                placeholder="CPF para emissão de nota fiscal"
                className="w-full rounded-xl bg-brand-900/70 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </>
          )}

          {error && (
            <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-200">
              {error}
            </p>
          )}

          {resetNotice && (
            <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-200">
              {resetNotice}
            </p>
          )}

          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full rounded-2xl bg-gold-400 px-4 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300 disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar com e-mail"}
              </button>
              <a
                href={googleLoginUrl()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
              >
                <GoogleG />
                Entrar com Google
              </a>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="w-full text-center text-xs font-bold text-slate-400 transition hover:text-gold-400"
              >
                Esqueci minha senha
              </button>
            </>
          )}

          {mode === "forgot" && (
            <>
              <button
                type="button"
                onClick={handlePasswordResetRequest}
                disabled={loading}
                className="w-full rounded-2xl bg-gold-400 px-4 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300 disabled:opacity-60"
              >
                {loading ? "Enviando..." : "Enviar instruções"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full rounded-2xl bg-brand-900 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-brand-850"
              >
                Voltar para login
              </button>
            </>
          )}

          {mode === "reset" && (
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading}
              className="w-full rounded-2xl bg-gold-400 px-4 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300 disabled:opacity-60"
            >
              {loading ? "Atualizando..." : "Redefinir senha"}
            </button>
          )}

          {mode === "register" && (
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="w-full rounded-2xl bg-gold-400 px-4 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300 disabled:opacity-60"
            >
              {loading ? "Criando..." : "Criar conta"}
            </button>
          )}

          {mode === "profile" && (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-emerald-200">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  Conta conectada. Seus dados serão usados para autopreencher o checkout e apoiar a emissão fiscal quando habilitada.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-brand-900 px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-brand-850"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
                <button
                  type="button"
                  onClick={handleLocalSave}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gold-400 px-4 py-3 text-sm font-black text-slate-950 shadow-glow transition hover:bg-gold-300"
                >
                  {saved && <Check className="h-4 w-4" />}
                  Salvar
                </button>
              </div>

              <section className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-300">
                    Meus ingressos
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">
                    {ticketsLoading ? "Carregando" : `${tickets.length} encontrado(s)`}
                  </span>
                </div>

                {tickets.length === 0 && !ticketsLoading ? (
                  <div className="rounded-2xl bg-brand-900/70 p-4 text-center">
                    <QrCode className="mx-auto h-8 w-8 text-brand-300" />
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">
                      Nenhum ingresso vinculado ao e-mail ou CPF desta conta.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket) => (
                      <AccountTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        justValidated={ticket.id === validatedTicketId}
                        onValidated={handleTicketValidated}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.16.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.59-2.59C13.46.87 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AccountTicketCard({
  ticket,
  justValidated,
  onValidated,
}: {
  ticket: TicketRecord;
  justValidated: boolean;
  onValidated: (ticket: TicketRecord) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const isUsed = ticket.status === "used";

  useEffect(() => {
    QRCode.toDataURL(ticket.qrPayload || ticket.code, {
      margin: 1,
      width: 160,
      color: { dark: "#020617", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [ticket.code, ticket.qrPayload]);

  const pointerX = (event: React.PointerEvent<HTMLDivElement>) => event.clientX;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isUsed || validating) return;
    setError("");
    setDragStart(pointerX(event));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart === null || isUsed || validating) return;
    setDragX(Math.max(0, Math.min(180, pointerX(event) - dragStart)));
  };

  const handlePointerUp = async () => {
    if (dragStart === null) return;
    const shouldValidate = dragX > 120;
    setDragStart(null);
    setDragX(0);
    if (!shouldValidate || isUsed) return;

    setError("Apresente este QR Code ao operador. A entrada so pode ser validada pelo painel autorizado.");
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-900/70 shadow-xl shadow-blue-950/20">
      {justValidated && (
        <div className="ticket-validation-celebration" role="status" aria-live="assertive">
          <span className="ticket-validation-check" aria-hidden="true"><Check /></span>
          <strong>Entrada validada</strong>
          <span>QR Code confirmado pelo Cine Cruzeiro</span>
        </div>
      )}
      <div className="grid grid-cols-[104px_1fr] gap-4 p-4">
        <div className="rounded-2xl bg-white p-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR Code do ingresso ${ticket.code}`} className="h-20 w-20" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center text-slate-900">
              <QrCode className="h-9 w-9" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h5 className="line-clamp-2 text-sm font-black text-white">{ticket.movieTitle}</h5>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isUsed ? "bg-emerald-500/15 text-emerald-300" : "bg-gold-400/15 text-gold-300"}`}>
              {isUsed ? "Usado" : "Ativo"}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-brand-300">
            {ticket.sessionDate} • {ticket.sessionTime} • {ticket.ticketType}
          </p>
          <p className="mt-2 font-mono text-xs font-black text-gold-400">{ticket.code}</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-12 overflow-hidden rounded-2xl ${isUsed ? "bg-emerald-500/15" : "bg-brand-950/80"}`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-brand-600/40 transition-[width]"
            style={{ width: `${isUsed ? 100 : Math.min(100, Math.max(12, dragX / 1.8))}%` }}
          />
          <div
            className="absolute left-1 top-1 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400 text-slate-950 shadow-glow transition-transform"
            style={{ transform: `translateX(${isUsed ? 0 : dragX}px)` }}
          >
            <Ticket className="h-5 w-5" />
          </div>
          <div className="relative flex h-full items-center justify-center pl-12 text-xs font-black text-slate-200">
            {isUsed ? "Entrada confirmada" : validating ? "Validando..." : "Arraste para ver orientação"}
          </div>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-rose-200">{error}</p>}
      </div>
    </div>
  );
}
