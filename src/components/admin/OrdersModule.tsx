"use client";

import React, { useState, useEffect, useRef } from "react";
import { TicketOrder } from "@/types";
import { useAdminData } from "@/contexts/AdminDataContext";
import { validateTicket } from "@/services/cinemaApi";
import { ShoppingCart, Search, QrCode, CheckCircle, XCircle, AlertCircle, Camera, Printer, User, DollarSign, Calendar } from "lucide-react";

export default function OrdersModule() {
  const { content } = useAdminData();
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "scanner">("orders");

  // Orders list state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<TicketOrder | null>(null);

  // QR Validation state
  const [ticketCodeInput, setTicketCodeInput] = useState("");
  const [validationResult, setValidationResult] = useState<{
    status: "idle" | "valid" | "used" | "invalid";
    message: string;
    ticket?: any;
  }>({ status: "idle", message: "" });
  const [validating, setValidating] = useState(false);

  const handleValidateCode = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setValidating(true);
    try {
      const ticket = await validateTicket(clean);
      setValidationResult({
        status: "valid",
        message: "Ingresso validado com sucesso! Entrada liberada.",
        ticket,
      });
      setTicketCodeInput("");
    } catch (err: any) {
      const msg = err.message || "Ingresso inválido ou já utilizado.";
      setValidationResult({
        status: msg.includes("utilizado") || msg.includes("usado") ? "used" : "invalid",
        message: msg,
      });
    } finally {
      setValidating(false);
    }
  };

  const money = (val = 0) =>
    Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Top Navigation Subtabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-yellow-400" />
            Bilheteria e Validação de Ingressos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Controle de pedidos emitidos, segunda via e validação de ingressos na portaria.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab("orders")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "orders"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedidos e Vendas
          </button>
          <button
            onClick={() => setActiveSubTab("scanner")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === "scanner"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            Validador de Portaria
          </button>
        </div>
      </div>

      {/* SUBTAB 1: ORDERS LIST */}
      {activeSubTab === "orders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por cliente, e-mail, filme ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
              />
            </div>

            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-yellow-400"
            >
              <option value="all">Todas as formas de pagamento</option>
              <option value="PIX">Pix Mercado Pago</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="CLUB_CREDIT">Crédito Clube</option>
            </select>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Data / Pedido</th>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Filme / Sessão</th>
                    <th className="py-3.5 px-4">Lugares</th>
                    <th className="py-3.5 px-4">Pagamento</th>
                    <th className="py-3.5 px-4 text-right">Total</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs font-bold">
                      Consulte os pedidos recentes no Dashboard ou busque pelo código do cliente.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TICKET SCANNER / VALIDATOR */}
      {activeSubTab === "scanner" && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-yellow-400/10 text-yellow-400 rounded-2xl flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Validador de Entrada na Portaria</h3>
              <p className="text-xs text-slate-400">
                Digite o código do ingresso de 8 dígitos ou aponte o leitor óptico.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleValidateCode(ticketCodeInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Código do Ingresso
                </label>
                <input
                  type="text"
                  value={ticketCodeInput}
                  onChange={(e) => setTicketCodeInput(e.target.value.toUpperCase())}
                  placeholder="EX: CC-8A9F12"
                  autoFocus
                  className="w-full h-14 text-center font-mono text-2xl font-black tracking-widest uppercase rounded-xl bg-slate-950 border border-slate-700 text-yellow-400 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>

              <button
                type="submit"
                disabled={validating || !ticketCodeInput.trim()}
                className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-xl text-sm transition disabled:opacity-50 active:scale-[0.99]"
              >
                {validating ? "Validando..." : "Validar Ingresso"}
              </button>
            </form>

            {/* Validation Feedback Result */}
            {validationResult.status !== "idle" && (
              <div
                className={`p-5 rounded-2xl border flex items-start gap-4 ${
                  validationResult.status === "valid"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : validationResult.status === "used"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {validationResult.status === "valid" ? (
                  <CheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-400" />
                ) : validationResult.status === "used" ? (
                  <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-400" />
                ) : (
                  <XCircle className="w-6 h-6 flex-shrink-0 text-rose-400" />
                )}

                <div className="space-y-1">
                  <h4 className="font-black text-sm text-white">
                    {validationResult.status === "valid"
                      ? "ACESSO AUTORIZADO"
                      : validationResult.status === "used"
                      ? "INGRESSO JÁ UTILIZADO"
                      : "INGRESSO INVÁLIDO"}
                  </h4>
                  <p className="text-xs leading-relaxed">{validationResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
