"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AdminDashboardData } from "@/types/admin";
import { fetchAdminDashboard } from "@/services/adminApi";
import { DollarSign, Ticket, ShoppingBag, Users, Calendar, TrendingUp, RefreshCw } from "lucide-react";

export default function DashboardModule() {
  const [period, setPeriod] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminDashboard(period, from, to);
      setData(res);
    } catch {
      // Fallback empty data if backend returns error
      setData({
        summary: {
          revenueToday: 0,
          revenuePeriod: 0,
          revenueComparePercent: 0,
          ticketsSold: 0,
          averageTicket: 0,
          concessionRevenue: 0,
          occupancyRate: 0,
          activeSessions: 0,
        },
        charts: {
          occupancyByHour: [],
          revenueByDay: [],
        },
        recentOrders: [],
      });
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const money = (val = 0) =>
    Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const summary = data?.summary || {
    revenueToday: 0,
    revenuePeriod: 0,
    revenueComparePercent: 0,
    ticketsSold: 0,
    averageTicket: 0,
    concessionRevenue: 0,
    occupancyRate: 0,
    activeSessions: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Visão Geral Financeira e Operacional
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Métricas em tempo real sobre vendas, bomboniere e ocupação das salas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "today", label: "Hoje" },
            { id: "7d", label: "7 dias" },
            { id: "30d", label: "30 dias" },
            { id: "month", label: "Este mês" },
            { id: "custom", label: "Personalizado" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                period === item.id
                  ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          {period === "custom" && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white"
              />
              <span className="text-slate-500 text-xs">até</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          )}

          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="p-1.5 ml-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receita Hoje</span>
            <div className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{money(summary.revenueToday)}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Vendas bilheteria + bomboniere</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receita Período</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-400">{money(summary.revenuePeriod)}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            {summary.revenueComparePercent >= 0 ? "+" : ""}
            {summary.revenueComparePercent}% vs anterior
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingressos</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{summary.ticketsSold}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Ingressos emitidos</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Médio</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{money(summary.averageTicket)}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Média por transação</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bomboniere</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{money(summary.concessionRevenue)}</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Itens de bomboniere</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ocupação</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{summary.occupancyRate}%</p>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">Média das salas</p>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-400" />
            Últimos Pedidos do Período
          </h3>
          <span className="text-xs text-slate-400 font-bold">
            {data?.recentOrders?.length || 0} pedidos listados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-[11px] uppercase font-black text-slate-400 tracking-wider">
              <tr>
                <th className="py-3 px-3">Data / Hora</th>
                <th className="py-3 px-3">Cliente</th>
                <th className="py-3 px-3">Filme / Sessão</th>
                <th className="py-3 px-3">Poltronas</th>
                <th className="py-3 px-3">Pagamento</th>
                <th className="py-3 px-3 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
              {data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((order, idx) => (
                  <tr key={order.id || idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-3 text-xs text-slate-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white text-xs">{order.customerName || "Cliente"}</div>
                      <div className="text-[11px] text-slate-400">{order.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      <div className="font-bold text-yellow-300">{order.movieTitle || "Filme"}</div>
                      <div className="text-[11px] text-slate-400">{order.sessionFormat || order.sessionTime || "2D"}</div>
                    </td>
                    <td className="py-3.5 px-3 text-xs font-mono text-slate-300">
                      {order.selectedSeatIds && order.selectedSeatIds.length > 0
                        ? order.selectedSeatIds.join(", ")
                        : "Lugar livre"}
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20 text-[10px]">
                        {order.paymentMethod || "Aprovado"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-black text-sm text-yellow-400 font-mono">
                      {money(order.totalPrice)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-bold">
                    Nenhum pedido registrado no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
