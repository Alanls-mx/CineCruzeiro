"use client";

import React, { useState, useEffect } from "react";
import { ClubPlan, ClubSubscription } from "@/types/admin";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { fetchAdminSubscriptions, assignAdminSubscription } from "@/services/adminApi";
import { Crown, Plus, Edit2, Trash2, Users, DollarSign, ShieldAlert, Check } from "lucide-react";

export default function ClubModule() {
  const { content, saveContent } = useAdminData();
  const { isOwner } = useAdminAuth();
  const plans = content?.clubPlans || [];
  const concessions = content?.concessions || [];

  const [activeTab, setActiveTab] = useState<"plans" | "subscribers">("plans");
  const [subscriptions, setSubscriptions] = useState<ClubSubscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Plan modal state
  const [editingPlan, setEditingPlan] = useState<Partial<ClubPlan> | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  // Assign modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignCourtesy, setAssignCourtesy] = useState(false);

  useEffect(() => {
    if (activeTab === "subscribers") {
      setLoadingSubs(true);
      fetchAdminSubscriptions()
        .then(setSubscriptions)
        .catch(() => setSubscriptions([]))
        .finally(() => setLoadingSubs(false));
    }
  }, [activeTab]);

  const handleOpenAddPlan = () => {
    setEditingPlan({
      id: `plano-${Date.now()}`,
      name: "",
      description: "",
      price: 39.9,
      ticketsPerMonth: 2,
      ticketDiscountPercent: 50,
      concessionDiscountPercent: 20,
      maxRolloverCredits: 4,
      cancellationGraceDays: 7,
      active: true,
      accountingTicketAmount: 29.9,
      accountingBenefitAmount: 10.0,
      excludedItemIds: [],
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editingPlan.name) return;

    const finalPlan = editingPlan as ClubPlan;
    const exists = plans.some((p) => p.id === finalPlan.id);
    let updatedPlans: ClubPlan[];

    if (exists) {
      updatedPlans = plans.map((p) => (p.id === finalPlan.id ? finalPlan : p));
    } else {
      updatedPlans = [...plans, finalPlan];
    }

    const success = await saveContent({ clubPlans: updatedPlans }, "Plano salvo com sucesso.");
    if (success) {
      setIsPlanModalOpen(false);
      setEditingPlan(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm("Deseja realmente remover este plano do Clube?")) return;
    const updated = plans.filter((p) => p.id !== planId);
    await saveContent({ clubPlans: updated }, "Plano removido com sucesso.");
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmail || !assignPlanId) return;
    try {
      await assignAdminSubscription({
        customerEmail: assignEmail,
        planId: assignPlanId,
        courtesy: assignCourtesy,
      });
      alert("Assinatura atribuída com sucesso!");
      setIsAssignModalOpen(false);
      setAssignEmail("");
      // Reload subscribers
      const subs = await fetchAdminSubscriptions();
      setSubscriptions(subs);
    } catch (err: any) {
      alert(err.message || "Erro ao atribuir assinatura.");
    }
  };

  const money = (val = 0) =>
    Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            Clube de Assinaturas Cine Cruzeiro
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie planos de benefícios, regras de ingressos, controle contábil e assinantes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "plans"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Crown className="w-4 h-4" />
            Planos
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "subscribers"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Assinantes
          </button>
        </div>
      </div>

      {/* TAB 1: PLANS */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenAddPlan}
              className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Novo Plano
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black text-white text-lg">{plan.name}</h3>
                      <p className="text-2xl font-black text-yellow-400 font-mono mt-1">
                        {money(plan.price)}
                        <span className="text-xs font-sans text-slate-400 font-normal"> /mês</span>
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        plan.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {plan.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{plan.description}</p>

                  <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Ingressos mensais:</span>
                      <strong className="text-white">{plan.ticketsPerMonth} ingresso(s)</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Desconto em ingressos:</span>
                      <strong className="text-white">{plan.ticketDiscountPercent}%</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Desconto na bomboniere:</span>
                      <strong className="text-white">{plan.concessionDiscountPercent}%</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Créditos acumuláveis:</span>
                      <strong className="text-white">Até {plan.maxRolloverCredits || 0}</strong>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                      <span className="font-bold text-yellow-400 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        Divisão Fiscal (Owner):
                      </span>
                      <div className="flex justify-between text-slate-400">
                        <span>Ingresso (NFS-e):</span>
                        <strong className="text-slate-200">{money(plan.accountingTicketAmount)}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Benefícios / Bomboniere:</span>
                        <strong className="text-slate-200">{money(plan.accountingBenefitAmount)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-4 mt-4 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setEditingPlan({ ...plan });
                      setIsPlanModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    title="Editar Plano"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                    title="Excluir Plano"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIBERS */}
      {activeTab === "subscribers" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setAssignPlanId(plans[0]?.id || "");
                setIsAssignModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Atribuir Plano Manualmente
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Cliente</th>
                    <th className="py-3.5 px-4">Plano</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Saldo de Créditos</th>
                    <th className="py-3.5 px-4">Ciclo Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                  {subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{sub.customerName}</div>
                          <div className="text-[11px] text-slate-400">{sub.customerEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-bold text-yellow-300">{sub.planName}</td>
                        <td className="py-3.5 px-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {sub.status === "active" ? "Ativo" : sub.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono font-bold text-white">
                          {sub.creditsBalance} crédito(s)
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {sub.currentCycleStart ? new Date(sub.currentCycleStart).toLocaleDateString("pt-BR") : "—"} até{" "}
                          {sub.currentCycleEnd ? new Date(sub.currentCycleEnd).toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 text-xs font-bold">
                        {loadingSubs ? "Carregando assinaturas..." : "Nenhum assinante ativo no momento."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Plan Edit Modal */}
      {isPlanModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                Configurar Plano do Clube
              </h4>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nome do Plano</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name || ""}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="Ex: Clube Ouro"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Preço Mensal (R$)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingPlan.price || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editingPlan.description || ""}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Ingressos / Mês</label>
                  <input
                    type="number"
                    value={editingPlan.ticketsPerMonth || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, ticketsPerMonth: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Desc. Ingressos (%)</label>
                  <input
                    type="number"
                    value={editingPlan.ticketDiscountPercent || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, ticketDiscountPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Desc. Bomboniere (%)</label>
                  <input
                    type="number"
                    value={editingPlan.concessionDiscountPercent || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, concessionDiscountPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {isOwner && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-xs font-black text-yellow-400 uppercase tracking-wider block">
                    Configuração Contábil e Tributária (Exclusivo Owner)
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Valor do Ingressos (NFS-e)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingPlan.accountingTicketAmount || 0}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, accountingTicketAmount: Number(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Valor dos Benefícios</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingPlan.accountingBenefitAmount || 0}
                        onChange={(e) =>
                          setEditingPlan({ ...editingPlan, accountingBenefitAmount: Number(e.target.value) })
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black transition"
                >
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white">Atribuir Plano ao Cliente</h4>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1 text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">E-mail do Cliente</label>
                <input
                  type="email"
                  required
                  placeholder="cliente@email.com"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Plano</label>
                <select
                  value={assignPlanId}
                  onChange={(e) => setAssignPlanId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} - {money(p.price)}/mês</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignCourtesy}
                  onChange={(e) => setAssignCourtesy(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-yellow-400"
                />
                Conceder como Cortesia (Sem cobrança externa)
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-yellow-400 text-slate-950 text-xs font-black">Confirmar Atribuição</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
