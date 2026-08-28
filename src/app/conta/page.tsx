"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import {
  AccountSubscription,
  cancelMySubscription,
  confirmEmailChange,
  CustomerUser,
  fetchCurrentCustomer,
  fetchMySubscriptions,
  googleLoginCallbackUrl,
  googleLoginUrl,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  requestAccountEmailVerification,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  updateAccountProfile,
} from "@/services/cinemaApi";
import { trackMarketingEvent } from "@/utils/tracking";

export default function ContaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060a12] text-white"><SiteHeader /><main className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8"><div className="h-80 skeleton-soft" /></main><SiteFooter /></div>}>
      <ContaPageContent />
    </Suspense>
  );
}

function ContaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailToken = searchParams.get("emailToken") || "";
  const googleCode = searchParams.get("code") || "";
  const googleState = searchParams.get("state") || "";
  const googleProviderError = searchParams.get("error") || "";
  const googleAuthError = searchParams.get("authError") || "";
  const requestedReturnTo = searchParams.get("returnTo") || "";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
    ? requestedReturnTo
    : "";
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "recover" | "reset">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", cpf: "" });
  const [resetToken, setResetToken] = useState("");
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", cpf: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [subscriptions, setSubscriptions] = useState<AccountSubscription[]>([]);
  const [clubMessage, setClubMessage] = useState("");
  const pendingSubscriptions = subscriptions.filter((subscription) => subscription.status === "pending_payment");
  const activeSubscriptions = subscriptions.filter((subscription) => ["active", "paused", "ending"].includes(subscription.status) && !isClubHistory(subscription));
  const historySubscriptions = subscriptions.filter(isClubHistory);

  useEffect(() => {
    if (!googleCode || !googleState) return;
    window.location.replace(googleLoginCallbackUrl(googleCode, googleState));
  }, [googleCode, googleState]);

  useEffect(() => {
    const errorCode = googleProviderError || googleAuthError;
    if (!errorCode) return;
    const messages: Record<string, string> = {
      access_denied: "O login com Google foi cancelado.",
      google_oauth: "A sessão de login com Google expirou. Tente novamente.",
      google_token: "O Google não autorizou a entrada. Tente novamente ou revise a integração no painel.",
      google_profile: "Não foi possível obter o perfil da conta Google selecionada.",
    };
    setMessage(messages[errorCode] || "Não foi possível entrar com Google. Tente novamente.");
    router.replace("/conta");
  }, [googleAuthError, googleProviderError, router]);

  useEffect(() => {
    if (emailToken || (googleCode && googleState)) return;
    let active = true;

    fetchCurrentCustomer()
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        setProfile({
          name: result.user.name || "",
          email: result.user.email || "",
          phone: result.user.phone || "",
          cpf: result.user.cpf || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        void loadClub();
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, [emailToken, googleCode, googleState]);

  async function loadClub() {
    fetchMySubscriptions()
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]));
  }

  useEffect(() => {
    if (!user || !pendingSubscriptions.length) return;
    const timer = window.setInterval(() => {
      void loadClub();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [user, pendingSubscriptions.length]);

  useEffect(() => {
    if (!user) return;
    activeSubscriptions.forEach((subscription) => {
      const plan = subscription.plan;
      if (!plan) return;
      const key = `cine-tracked-subscription-${subscription.id}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
      const parameters = {
        currency: "BRL",
        value: Number(plan.monthlyPrice || 0),
        transaction_id: `subscription-${subscription.id}`,
        items: [{ item_id: `club-${plan.id}`, item_name: plan.name, item_category: "Clube", price: Number(plan.monthlyPrice || 0), quantity: 1 }],
      };
      trackMarketingEvent("subscribe", parameters);
      trackMarketingEvent("purchase", { ...parameters, affiliation: "Clube Cine Cruzeiro" });
    });
  }, [activeSubscriptions, user]);

  useEffect(() => {
    if (!emailToken) return;
    let active = true;
    setAuthReady(false);
    confirmEmailChange(emailToken)
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        setProfile({
          name: result.user.name || "",
          email: result.user.email || "",
          phone: result.user.phone || "",
          cpf: result.user.cpf || "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setVerificationNotice({
          type: "success",
          title: "E-mail confirmado",
          message: "Seu endereço foi verificado e sua conta está protegida.",
        });
        trackMarketingEvent("email_verified", { method: "email_link" });
        setAuthReady(true);
        router.replace("/conta?emailVerified=success");
      })
      .catch((error) => {
        if (!active) return;
        setVerificationNotice({
          type: "error",
          title: "Não foi possível confirmar o e-mail",
          message: error instanceof Error ? error.message : "Solicite um novo link de confirmação na sua conta.",
        });
        setAuthReady(true);
        router.replace("/conta?emailVerified=error");
      });
    return () => {
      active = false;
    };
  }, [emailToken, router]);

  useEffect(() => {
    const status = searchParams.get("emailVerified");
    if (status === "success") {
      setVerificationNotice({
        type: "success",
        title: "E-mail confirmado",
        message: "Seu endereço foi verificado e sua conta está protegida.",
      });
    } else if (status === "error") {
      setVerificationNotice((current) => current || {
        type: "error",
        title: "Não foi possível confirmar o e-mail",
        message: "O link pode ter expirado. Entre na sua conta e solicite uma nova confirmação.",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get("resetToken");
    if (!token) return;
    setResetToken(token);
    setMode("reset");
  }, [searchParams]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "recover") {
        const result = await requestPasswordReset(form.email);
        setMessage(result.message || "Se o e-mail existir, enviaremos as instruções de recuperação.");
        return;
      }
      if (mode === "reset") {
        if (!resetToken) {
          setMessage("Abra o link recebido por e-mail para redefinir sua senha.");
          return;
        }
        await resetPassword({ token: resetToken, password: form.password });
        setMessage("Senha atualizada. Você já pode entrar com a nova senha.");
        setMode("login");
        setResetToken("");
        router.replace("/conta");
        return;
      }
      const result = mode === "register"
        ? await registerCustomer(form)
        : await loginCustomer({ email: form.email, password: form.password });
      setUser(result.user);
      setAuthReady(true);
      setProfile({
        name: result.user.name || "",
        email: result.user.email || "",
        phone: result.user.phone || "",
        cpf: result.user.cpf || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      loadClub();
      if (mode === "register") {
        trackMarketingEvent("sign_up", { method: "email" });
        setProfileMessage(result.message || "Conta criada. Confirme seu e-mail para manter sua conta protegida.");
        router.replace("/conta");
      } else {
        trackMarketingEvent("login", { method: "email" });
        router.replace(returnTo || "/conta/ingressos");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await logoutCustomer();
    setUser(null);
    setAuthReady(true);
    setSubscriptions([]);
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setProfileMessage("");
    try {
      const result = await updateAccountProfile({
        name: profile.name,
        phone: profile.phone,
        cpf: profile.cpf.replace(/\D/g, "").slice(0, 11),
        ...(profile.currentPassword || profile.newPassword || profile.confirmPassword
          ? {
              currentPassword: profile.currentPassword,
              newPassword: profile.newPassword,
              confirmPassword: profile.confirmPassword,
            }
          : {}),
      });
      setUser(result.user);
      setProfile((state) => ({ ...state, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setProfileMessage("Dados atualizados.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível atualizar sua conta.");
    }
  }

  async function requestEmailChangeVerification() {
    if (!profile.email || profile.email === user?.email) return;
    setProfileMessage("");
    setVerificationLoading(true);
    try {
      const result = await requestEmailChange(profile.email);
      trackMarketingEvent("email_verification_requested", { reason: "email_change" });
      setUser(result.user);
      setProfileMessage(result.message || "Enviamos a verificação para o novo e-mail.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível solicitar a verificação.");
    } finally {
      setVerificationLoading(false);
    }
  }

  async function requestCurrentEmailVerification() {
    if (!user || user.emailVerified) return;
    setProfileMessage("");
    setVerificationLoading(true);
    try {
      const result = await requestAccountEmailVerification();
      trackMarketingEvent("email_verification_requested", { reason: "account_confirmation" });
      setUser(result.user);
      setProfileMessage(result.message || "Enviamos um link de confirmação para o e-mail da sua conta.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Não foi possível enviar a confirmação do e-mail.");
    } finally {
      setVerificationLoading(false);
    }
  }

  async function cancelSubscription(subscriptionId: string, cancelImmediately = false) {
    setClubMessage("");
    const reason = window.prompt(cancelImmediately ? "Motivo para encerrar agora:" : "Motivo do cancelamento:", "Cancelado pelo cliente");
    if (reason === null) return;
    try {
      const result = await cancelMySubscription(subscriptionId, reason, { cancelImmediately });
      await loadClub();
      setClubMessage(result.message || (cancelImmediately
        ? "Cobrança encerrada. Seus créditos atuais continuam válidos até o fim do ciclo."
        : "Renovação cancelada. Não haverá nova cobrança e os créditos atuais continuam disponíveis até o fim do ciclo."));
    } catch (error) {
      setClubMessage(error instanceof Error ? error.message : "Não foi possível cancelar o Clube.");
    }
  }

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-black sm:text-5xl">
          {returnTo.startsWith("/clube/assinar") ? "Entre para continuar sua assinatura" : "Acesse seus ingressos"}
        </h1>

        {verificationNotice && (
          <div
            className={`mt-7 flex max-w-3xl items-start gap-4 rounded-[8px] p-4 shadow-[0_18px_45px_rgba(0,0,0,.22)] sm:p-5 ${
              verificationNotice.type === "success" ? "bg-emerald-950/70 text-emerald-50" : "bg-rose-950/70 text-rose-50"
            }`}
            role={verificationNotice.type === "success" ? "status" : "alert"}
            aria-live="polite"
          >
            {verificationNotice.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <strong className="block font-display text-lg font-black">{verificationNotice.title}</strong>
              <p className="mt-1 text-sm leading-6 opacity-90">{verificationNotice.message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVerificationNotice(null);
                router.replace("/conta");
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[7px] text-current opacity-70 transition hover:bg-white/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              aria-label="Fechar mensagem"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {!authReady ? (
          <AccountLoadingState />
        ) : user ? (
          <section className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="font-display text-3xl font-black">Olá, {user.name}</h2>
              <dl className="mt-6 space-y-4 text-sm text-slate-300">
                <div><dt className="font-bold text-white">E-mail</dt><dd>{user.email}</dd></div>
                <div><dt className="font-bold text-white">WhatsApp</dt><dd>{maskPhone(user.phone) || "Não informado"}</dd></div>
                <div><dt className="font-bold text-white">CPF</dt><dd>{maskCpf(user.cpf) || "Opcional, não informado"}</dd></div>
                <div>
                  <dt className="font-bold text-white">Verificação</dt>
                  <dd>{user.emailVerified ? "E-mail verificado" : "E-mail ainda não verificado"}</dd>
                </div>
              </dl>
              {!user.emailVerified && (
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={requestCurrentEmailVerification}
                    disabled={verificationLoading}
                    className="inline-flex min-h-[48px] items-center justify-center bg-gold-400 px-5 text-sm font-black text-slate-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verificationLoading ? "Enviando..." : "Confirmar e-mail"}
                  </button>
                  <button type="button" onClick={logout} className="inline-flex min-h-[48px] items-center text-sm font-black text-rose-200 transition hover:text-rose-100">Sair</button>
                </div>
              )}
              {user.emailVerified && (
                <button type="button" onClick={logout} className="mt-8 inline-flex text-sm font-black text-rose-200 transition hover:text-rose-100">Sair</button>
              )}
            </div>
            <div className="border-t border-white/8 pt-8 lg:border-t-0 lg:pt-0">
              <h2 className="font-display text-3xl font-black">Ingressos</h2>
              <p className="mt-4 leading-7 text-slate-300">Veja seus ingressos digitais, QR Codes e histórico de entradas.</p>
              <Link href="/conta/ingressos" className="mt-8 inline-flex bg-gold-400 px-7 py-4 text-sm font-black text-slate-950">Meus ingressos</Link>
            </div>
            <section className="border-t border-white/8 pt-8 lg:col-span-2">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-black">Meu Clube</h2>
                  <p className="mt-2 text-sm text-slate-400">Créditos expiram ao fim do ciclo e não acumulam nesta versão.</p>
                </div>
                <Link href="/clube" className="text-sm font-black text-gold-400 hover:text-gold-300">Ver planos</Link>
              </div>
              {subscriptions.length ? (
                <>
                  {pendingSubscriptions.length > 0 && (
                    <div className="mb-5" aria-live="polite">
                      <p className="mb-3 text-sm font-semibold text-amber-200">Confirmando o pagamento com o Mercado Pago. Esta página atualiza automaticamente.</p>
                      <div className="grid gap-5 lg:grid-cols-2">
                        {pendingSubscriptions.map((subscription) => (
                          <ClubSubscriptionCard key={subscription.id} subscription={subscription} onCancel={cancelSubscription} />
                        ))}
                      </div>
                    </div>
                  )}
                  {activeSubscriptions.length ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      {activeSubscriptions.map((subscription) => (
                        <ClubSubscriptionCard key={subscription.id} subscription={subscription} onCancel={cancelSubscription} />
                      ))}
                    </div>
                  ) : pendingSubscriptions.length === 0 ? (
                    <div className="bg-[#0d1728] p-5">
                      <p className="text-slate-300">Você não possui assinatura ativa com créditos disponíveis no momento.</p>
                      <Link href="/clube" className="mt-4 inline-flex bg-gold-400 px-6 py-3 text-sm font-black text-slate-950">Ver planos</Link>
                    </div>
                  ) : null}
                  {historySubscriptions.length > 0 && (
                    <details className="mt-6 bg-[#0d1728] p-5 shadow-xl shadow-blue-950/10">
                      <summary className="cursor-pointer text-sm font-black uppercase tracking-[.14em] text-gold-400">
                        Histórico do Clube ({historySubscriptions.length})
                      </summary>
                      <div className="mt-5 grid gap-4 lg:grid-cols-2">
                        {historySubscriptions.map((subscription) => (
                          <ClubSubscriptionCard key={subscription.id} subscription={subscription} compact />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="bg-[#0d1728] p-5">
                  <p className="text-slate-300">Você ainda não possui assinatura ativa ou pendente.</p>
                  <Link href="/clube" className="mt-4 inline-flex bg-gold-400 px-6 py-3 text-sm font-black text-slate-950">Conhecer o Clube</Link>
                </div>
              )}
              {clubMessage && <p className="mt-4 text-sm font-semibold text-amber-200">{clubMessage}</p>}
            </section>
            <form onSubmit={saveProfile} className="border-t border-white/8 pt-8 lg:col-span-2">
              <div className="mb-6">
                <h2 className="font-display text-3xl font-black">Dados da conta</h2>
                <p className="mt-2 text-sm text-slate-400">Atualize seus dados de compra. O e-mail só muda depois de verificação.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Nome" value={profile.name} onChange={(value) => setProfile({ ...profile, name: value })} />
                <Input label="WhatsApp" value={profile.phone} onChange={(value) => setProfile({ ...profile, phone: value })} />
                <Input label="CPF para nota fiscal" value={profile.cpf} onChange={(value) => setProfile({ ...profile, cpf: value.replace(/\D/g, "").slice(0, 11) })} />
                <Input label="Senha atual" type="password" value={profile.currentPassword} onChange={(value) => setProfile({ ...profile, currentPassword: value })} />
                <Input label="Nova senha" type="password" value={profile.newPassword} onChange={(value) => setProfile({ ...profile, newPassword: value })} />
                <Input label="Confirmar nova senha" type="password" value={profile.confirmPassword} onChange={(value) => setProfile({ ...profile, confirmPassword: value })} />
                <div className="md:col-span-2">
                  <Input label="E-mail" type="email" value={profile.email} onChange={(value) => setProfile({ ...profile, email: value })} />
                  {user.pendingEmail && <p className="mt-2 text-sm font-semibold text-amber-200">Pendente de verificação: {maskEmail(user.pendingEmail)}</p>}
                  {profile.email !== user.email && (
                    <button type="button" onClick={requestEmailChangeVerification} disabled={verificationLoading} className="mt-3 text-sm font-black text-gold-400 transition hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-60">
                      {verificationLoading ? "Enviando..." : "Enviar verificação para novo e-mail"}
                    </button>
                  )}
                </div>
              </div>
              {profileMessage && <p className="mt-5 text-sm font-semibold text-amber-200">{profileMessage}</p>}
              <button type="submit" className="mt-6 bg-gold-400 px-7 py-4 text-sm font-black text-slate-950">Salvar dados</button>
            </form>
          </section>
        ) : (
          <section className="mt-12 grid gap-10 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <div className="flex gap-5 border-b border-white/8 pb-4 text-sm font-black text-slate-400">
                <button onClick={() => setMode("login")} className={mode === "login" ? "text-gold-400" : ""}>Entrar</button>
                <button onClick={() => setMode("register")} className={mode === "register" ? "text-gold-400" : ""}>Criar conta</button>
              </div>
              <form onSubmit={submit} className="mt-8 space-y-5">
                {mode === "register" && <Input label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />}
                {mode !== "reset" && <Input label="E-mail" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />}
                {mode === "reset" && (
                  <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                    Link de recuperação validado. Digite sua nova senha para continuar.
                  </p>
                )}
                {mode !== "recover" && <Input label={mode === "reset" ? "Nova senha" : "Senha"} type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />}
                {mode === "register" && (
                  <>
                    <Input label="WhatsApp" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
                    <Input label="CPF para nota fiscal, opcional" value={form.cpf} onChange={(value) => setForm({ ...form, cpf: value.replace(/\D/g, "").slice(0, 11) })} />
                  </>
                )}
                {message && <p className="text-sm font-semibold text-amber-200">{message}</p>}
                <button disabled={submitting} className="w-full bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : mode === "reset" ? "Atualizar senha" : "Enviar recuperação"}
                </button>
              </form>
              <div className="mt-5 flex flex-wrap items-center gap-5 text-sm font-black">
                <a href={googleLoginUrl(returnTo || "/conta")} className="inline-flex min-h-[46px] items-center gap-3 bg-white px-5 text-sm font-black text-slate-950 shadow-lg shadow-blue-950/20 transition hover:bg-slate-100">
                  <GoogleG />
                  Entrar com Google
                </a>
                {mode === "login" && (
                  <button type="button" onClick={() => setMode("recover")} className="text-slate-300 hover:text-gold-400">
                    Esqueci minha senha
                  </button>
                )}
                {["recover", "reset"].includes(mode) && (
                  <button type="button" onClick={() => setMode("login")} className="text-slate-300 hover:text-gold-400">
                    Voltar para entrar
                  </button>
                )}
              </div>
            </div>
            <div className="hidden min-h-[420px] bg-brand-900/40 lg:block">
              <div className="flex h-full items-end p-10">
                <p className="max-w-md text-2xl font-black leading-tight">
                  Seus ingressos digitais ficam reunidos em um só lugar, prontos para validar na entrada.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function AccountLoadingState() {
  return (
    <section className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Verificando sua conta</span>
      <div>
        <div className="h-9 w-56 max-w-full skeleton-soft" />
        <div className="mt-7 space-y-4">
          <div className="h-10 w-full max-w-sm skeleton-soft" />
          <div className="h-10 w-full max-w-xs skeleton-soft" />
          <div className="h-10 w-full max-w-72 skeleton-soft" />
        </div>
      </div>
      <div className="border-t border-white/8 pt-8 lg:border-t-0 lg:pt-0">
        <div className="h-9 w-44 max-w-full skeleton-soft" />
        <div className="mt-5 h-5 w-full max-w-md skeleton-soft" />
        <div className="mt-3 h-5 w-2/3 max-w-xs skeleton-soft" />
        <div className="mt-8 h-12 w-40 skeleton-soft" />
      </div>
      <div className="h-48 skeleton-soft lg:col-span-2" />
    </section>
  );
}

function ClubSubscriptionCard({
  subscription,
  compact = false,
  onCancel,
}: {
  subscription: AccountSubscription;
  compact?: boolean;
  onCancel?: (subscriptionId: string, cancelImmediately?: boolean) => void;
}) {
  return (
    <article className="bg-[#0d1728] p-5 shadow-xl shadow-blue-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-black">{subscription.plan?.name || "Clube Cine Cruzeiro"}</h3>
          <p className="mt-1 text-sm font-bold text-brand-300">{subscription.statusLabel || clubStatusLabel(subscription.status)}</p>
        </div>
        <span className="bg-gold-400 px-3 py-2 text-xs font-black text-slate-950">
          {subscription.creditsRemaining ?? subscription.creditsAvailable} de {subscription.creditsTotal || subscription.plan?.includedTickets || 0}
        </span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <Info label="Ciclo" value={`${dateLabel(subscription.cycleStart)} → ${dateLabel(subscription.cycleEnd || subscription.currentPeriodEnd)}`} />
        <Info label="Próxima renovação" value={subscription.status === "ending" ? "Não haverá renovação" : dateLabel(subscription.nextBillingAt || subscription.cycleEnd)} />
        <Info label="Utilizados" value={String(subscription.creditsUsed || 0)} />
        <Info label="Disponíveis" value={String(subscription.creditsRemaining ?? subscription.creditsAvailable ?? 0)} />
      </dl>
      {subscription.usage?.length ? (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-black text-gold-400">Ver usos desta assinatura</summary>
          <div className="mt-3 space-y-2 text-sm text-slate-400">
            {subscription.usage.slice(0, 5).map((usage) => (
              <div key={usage.id} className="flex justify-between gap-4 border-t border-white/8 pt-2">
                <span>{dateTimeLabel(usage.usedAt)}</span>
                <span>{usage.refundedAt ? "Crédito devolvido" : "Ingresso emitido"}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {!compact && onCancel && !["ending", "cancelled", "ended"].includes(subscription.status) && (
        <div className="mt-5 flex flex-wrap gap-4 text-sm font-black">
          <button type="button" onClick={() => onCancel(subscription.id)} className="text-amber-200 transition hover:text-amber-100">
            Cancelar no fim do ciclo
          </button>
          <button type="button" onClick={() => onCancel(subscription.id, true)} className="text-rose-200 transition hover:text-rose-100">
            Encerrar agora
          </button>
        </div>
      )}
    </article>
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
        className="mt-2 min-h-[48px] w-full rounded-lg border border-white/12 bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/24 focus:border-gold-400 focus:bg-white/[0.09] focus:shadow-[0_0_0_4px_rgba(250,204,21,.12)]"
      />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-white">{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function clubStatusLabel(status = "") {
  return {
    active: "Ativa",
    pending_payment: "Aguardando pagamento",
    paused: "Pausada",
    ending: "Sem renovação; créditos válidos até o fim do ciclo",
    cancelled: "Cancelada",
    ended: "Encerrada",
    payment_failed: "Falha na renovação",
  }[status] || "Não informado";
}

function dateLabel(value = "") {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function dateTimeLabel(value = "") {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function maskPhone(value = "") {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return value;
  return `(**) *****-${digits.slice(-4)}`;
}

function maskCpf(value = "") {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function maskEmail(value = "") {
  const [name, domain] = value.split("@");
  if (!name || !domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
}

function isClubHistory(subscription: AccountSubscription) {
  const remaining = Number(subscription.creditsRemaining ?? subscription.creditsAvailable ?? 0);
  const endValue = subscription.cycleEnd || subscription.currentPeriodEnd || "";
  const ended = endValue ? new Date(endValue).getTime() <= Date.now() : false;
  return (remaining <= 0 && ended) || ["cancelled", "ended", "payment_failed"].includes(subscription.status);
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
