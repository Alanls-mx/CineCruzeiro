"use client";

import React, { useState, useEffect } from "react";
import { AdminIntegrationsStatus } from "@/types/admin";
import { fetchAdminIntegrations, sendTestEmail } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Link2, CreditCard, Film, Mail, Send, CheckCircle, AlertTriangle } from "lucide-react";

export default function IntegrationsModule() {
  const { isOwner } = useAdminAuth();
  const [status, setStatus] = useState<AdminIntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  useEffect(() => {
    fetchAdminIntegrations()
      .then(setStatus)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo) return;
    setSendingEmail(true);
    setEmailSuccess(false);
    try {
      await sendTestEmail(testEmailTo);
      setEmailSuccess(true);
      alert("E-mail de teste disparado com sucesso!");
    } catch (err: any) {
      alert(err.message || "Erro ao enviar e-mail de teste.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold text-sm bg-slate-900/60 rounded-2xl border border-slate-800">
        Esta seção é restrita exclusivamente ao Proprietário (Owner) do sistema.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-yellow-400" />
            Integrações e Serviços Externos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Status de conexão com gateway Mercado Pago, The Movie Database (TMDB) e SMTP de e-mails.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Mercado Pago */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                status?.mercadoPago?.configured
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {status?.mercadoPago?.configured ? "Conectado" : "Pendente"}
            </span>
          </div>

          <div>
            <h3 className="font-black text-white text-base">Mercado Pago</h3>
            <p className="text-xs text-slate-400 mt-1">
              Processador de pagamentos via Pix e Cartão de Crédito com conciliação automática via Webhook.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Ambiente:</span>
              <strong className="text-white uppercase font-mono">
                {status?.mercadoPago?.environment || "production"}
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Chave Pública:</span>
              <strong className="text-slate-300 font-mono text-[11px]">
                {status?.mercadoPago?.publicKey ? `${status.mercadoPago.publicKey.slice(0, 12)}...` : "Configurada"}
              </strong>
            </div>
          </div>
        </div>

        {/* TMDB API */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                status?.tmdb?.configured ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {status?.tmdb?.configured ? "Ativo" : "Não configurado"}
            </span>
          </div>

          <div>
            <h3 className="font-black text-white text-base">The Movie Database (TMDB)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Importação automática de pôsteres, backdrops em alta definição, sinopses e dados de elenco.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
            Busca integrada ativada diretamente no formulário de filmes.
          </div>
        </div>

        {/* SMTP / Resend Email */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                status?.email?.configured ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {status?.email?.configured ? "Ativo" : "Pendente"}
            </span>
          </div>

          <div>
            <h3 className="font-black text-white text-base">Disparo de E-mails Transacionais</h3>
            <p className="text-xs text-slate-400 mt-1">
              Envio de ingressos digitais, confirmação de compras e redefinição de senhas.
            </p>
          </div>

          <form onSubmit={handleSendTestEmail} className="pt-3 border-t border-slate-800 space-y-2">
            <label className="block text-[11px] font-bold text-slate-400">Enviar E-mail de Teste:</label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="seu-email@teste.com"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-yellow-400"
              />
              <button
                type="submit"
                disabled={sendingEmail}
                className="px-3 py-1.5 bg-yellow-400 text-slate-950 rounded-lg text-xs font-black hover:bg-yellow-300 transition"
              >
                {sendingEmail ? "..." : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
