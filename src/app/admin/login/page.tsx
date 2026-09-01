"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { adminLogin, adminLogin2fa } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Lock, ShieldCheck, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { refreshUser } = useAdminAuth();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminLogin(email, password);
      if (res.challenge) {
        setChallenge(res.challenge);
      } else {
        await refreshUser();
        router.push("/admin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminLogin2fa(twoFactorCode, challenge);
      await refreshUser();
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código de autenticação inválido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a12] text-slate-100 p-4 font-sans selection:bg-yellow-500/30 selection:text-yellow-200">
      <main className="w-full max-w-md bg-[#0b132b]/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl shadow-black/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-28 h-10">
            <Image
              src="/images/logo-display.webp"
              alt="Cine Cruzeiro"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {!challenge ? (
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Lock className="w-6 h-6 text-yellow-400" />
              Painel Administrativo
            </h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Entre com suas credenciais autorizadas para gerenciar programação, bilheteria, bomboniere e relatórios.
            </p>

            <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin@cinecruzeiro.com.br"
                  className="w-full h-12 px-4 rounded-lg bg-slate-900/90 border border-slate-700/60 text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-lg bg-slate-900/90 border border-slate-700/60 text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs font-bold">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-lg transition disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? "Entrando..." : "Entrar no painel"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Verificação em 2 Etapas</h2>
                <p className="text-xs text-slate-400">Autenticador TOTP ou código de recuperação</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Abra seu aplicativo autenticador (Google Authenticator, Authy, etc.) e informe o código de 6 dígitos.
            </p>

            <form onSubmit={handle2faSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\s+/g, "").toUpperCase())}
                  required
                  autoFocus
                  maxLength={11}
                  placeholder="000000"
                  className="w-full h-14 px-4 text-center text-2xl font-mono font-black tracking-widest rounded-lg bg-slate-900/90 border border-slate-700/60 text-yellow-400 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs font-bold">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-lg transition disabled:opacity-50 active:scale-[0.99]"
              >
                {loading ? "Verificando..." : "Confirmar e Entrar"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setChallenge("");
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full h-10 text-xs font-bold text-slate-400 hover:text-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
