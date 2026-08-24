"use client";

import React from "react";
import { CheckCircle2, MailCheck, ShieldCheck, Sparkles, Ticket, Users } from "lucide-react";

interface ClubLeadFormProps {
  onSuccessToast?: (msg: string) => void;
}

export function ClubLeadForm({ onSuccessToast }: ClubLeadFormProps) {
  const handlePlanClick = (planName: string) => {
    onSuccessToast?.(`${planName} registrado. O Cine Cruzeiro avisara quando o Clube abrir oficialmente.`);
  };

  const plans = [
    {
      name: "Plano Individual",
      price: "R$ 24,90",
      period: "/ mês",
      icon: Ticket,
      highlight: "Para quem não perde uma estreia",
      benefits: [
        "3 ingressos por mês",
        "Fila expressa na bomboniere",
        "Descontos em combos",
      ],
      button: "Avisar quando abrir",
    },
    {
      name: "Plano Duplo",
      price: "R$ 44,90",
      period: "/ mês",
      icon: Users,
      highlight: "Melhor custo-benefício",
      benefits: [
        "6 ingressos por mês",
        "Fila expressa na bomboniere",
        "1 pipoca grátis no mês",
        "Descontos em combos",
      ],
      button: "Entrar na lista",
      featured: true,
    },
  ];

  return (
    <section id="clube" className="relative w-full bg-brand-950 py-20 border-t border-brand-850 overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-brand-300 border border-brand-500/30">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span>Lista de Interesse</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Clube Cine Cruzeiro: A Magia do Cinema Todo Mês
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            Conheça os planos previstos e deixe seu interesse registrado. A assinatura recorrente
            será ativada somente quando a cobrança oficial estiver pronta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-3xl border p-6 sm:p-7 shadow-xl ${
                  plan.featured
                    ? "border-gold-400/80 bg-gradient-to-b from-brand-900 via-brand-950 to-brand-900 shadow-gold-950/30"
                    : "border-brand-800 bg-brand-900/80"
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-5 top-5 rounded-full border border-gold-400/40 bg-gold-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gold-400">
                    Mais vendido
                  </div>
                )}

                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-600/20 text-gold-400">
                  <Icon className="h-6 w-6" />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-brand-300">
                    {plan.highlight}
                  </p>
                  <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                  <div className="flex items-end gap-1">
                    <span className="font-display text-4xl font-black text-gold-400">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm font-bold text-slate-400">{plan.period}</span>
                  </div>
                </div>

                <div className="my-6 h-px w-full bg-brand-800" />

                <div className="flex-1 space-y-3">
                  {plan.benefits.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2.5 text-sm text-slate-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handlePlanClick(plan.name)}
                  className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black transition-all active:scale-95 cursor-pointer ${
                    plan.featured
                      ? "bg-gold-400 text-slate-950 shadow-glow hover:bg-gold-300"
                      : "bg-brand-600 text-white hover:bg-brand-500 shadow-glow-blue"
                  }`}
                >
                  <MailCheck className="h-4 w-4" />
                  <span>{plan.button}</span>
                </button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Sem cobrança agora</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
