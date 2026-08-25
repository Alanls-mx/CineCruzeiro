"use client";

import React, { useState } from "react";
import { Sparkles, Gamepad2, Cake, Film, Send, CheckCircle2 } from "lucide-react";
import { sendPrivateEventWebhook } from "@/services/webhook";
import { PrivateEventRequest } from "@/types";

interface PrivateEventFormProps {
  onSuccessToast?: (msg: string) => void;
}

export function PrivateEventForm({ onSuccessToast }: PrivateEventFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState<
    "aniversario" | "videogame" | "filme_classico" | "corporativo" | "outro"
  >("aniversario");
  const [desiredDate, setDesiredDate] = useState("");
  const [estimatedGuests, setEstimatedGuests] = useState("Até 30 pessoas");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 11);
    if (raw.length <= 2) {
      setPhone(raw);
    } else if (raw.length <= 7) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim() || !desiredDate) return;

    setIsLoading(true);
    setErrorMessage("");

    const eventPayload: PrivateEventRequest = {
      name,
      phone,
      email,
      eventType,
      desiredDate,
      estimatedGuests,
      notes,
      source: "landing_page_feche_o_cinema",
      createdAt: new Date().toISOString(),
    };

    const response = await sendPrivateEventWebhook(eventPayload);

    setIsLoading(false);
    setIsSuccess(response.success);
    if (!response.success) setErrorMessage(response.message);

    if (onSuccessToast) {
      onSuccessToast(response.message);
    }
  };

  return (
    <section id="feche-o-cinema" className="relative w-full bg-brand-950 py-20 border-t border-brand-850">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/20 px-4 py-1 text-xs font-black uppercase tracking-wider text-brand-300 border border-brand-500/30">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span>Experiência VIP Exclusiva</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            Feche a Sala do Cine Cruzeiro <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-gold-400 bg-clip-text text-transparent">
              Só Para Você e Seus Convidados
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            Alugue nossa sala com telão 4K e som 7.1 para festas inesquecíveis, campeonatos de
            videogame ou exibições privadas do seu filme favorito.
          </p>
        </div>

        {/* 3 VIP Experience Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          
          <div className="rounded-3xl border border-brand-800 bg-brand-900/60 p-6 space-y-3 hover:border-brand-600 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-gold-400">
              <Cake className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Aniversários & Comemorações</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Traga o bolo e os amigos! Sessão fechada com pipoca liberada e direito a homenagens na tela grande.
            </p>
          </div>

          <div className="rounded-3xl border border-brand-800 bg-brand-900/60 p-6 space-y-3 hover:border-brand-600 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-400">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Videogame no Telão (PS5 / Xbox)</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Jogue FIFA, Mortal Kombat, Mario Kart ou Call of Duty no telão gigante com latência zero e som surround.
            </p>
          </div>

          <div className="rounded-3xl border border-brand-800 bg-brand-900/60 p-6 space-y-3 hover:border-brand-600 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-300">
              <Film className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Filmes Clássicos & Corporativo</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Escolha seu filme cult favorito para assistir com a galera ou faça palestras e lançamentos da sua empresa.
            </p>
          </div>

        </div>

        {/* Form Container */}
        <div className="max-w-2xl mx-auto rounded-3xl border border-brand-700/60 bg-brand-900/90 p-6 sm:p-10 shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex rounded-full bg-brand-600/20 p-4 text-brand-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black text-white">Solicitação recebida</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Obrigado, <strong>{name}</strong>! Nossa equipe entrará em contato pelo WhatsApp{" "}
                <strong>{phone}</strong> com o orçamento personalizado para a data{" "}
                <strong>{desiredDate}</strong>.
              </p>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setName("");
                  setPhone("");
                  setEmail("");
                  setDesiredDate("");
                  setNotes("");
                }}
                className="text-xs font-bold text-gold-400 hover:underline cursor-pointer"
              >
                Enviar nova solicitação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-left mb-4">
                <h3 className="text-lg font-bold text-white">Solicite um Orçamento Rápido</h3>
                <p className="text-xs text-slate-300 font-medium">
                  Preencha os campos abaixo e receba valores e disponibilidade no WhatsApp em até 2 horas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-300">Seu Nome *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-300">WhatsApp para Contato *</label>
                  <input
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-brand-300">E-mail para Confirmação *</label>
                  <input
                    type="email"
                    required
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-300">Tipo de Evento</label>
                  <select
                    value={eventType}
                    onChange={(e) =>
                      setEventType(
                        e.target.value as "aniversario" | "videogame" | "filme_classico" | "corporativo" | "outro"
                      )
                    }
                    className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="aniversario">Festa de Aniversário</option>
                    <option value="videogame">Sessão de Videogame no Telão</option>
                    <option value="filme_classico">Exibição de Filme Clássico</option>
                    <option value="corporativo">Evento Corporativo / Palestra</option>
                    <option value="outro">Outro Formato</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-300">Data Desejada *</label>
                  <input
                    type="date"
                    required
                    value={desiredDate}
                    onChange={(e) => setDesiredDate(e.target.value)}
                    className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-300">Número Estimado de Convidados</label>
                <select
                  value={estimatedGuests}
                  onChange={(e) => setEstimatedGuests(e.target.value)}
                  className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="Até 20 pessoas">Até 20 pessoas (Intimista)</option>
                  <option value="20 a 50 pessoas">20 a 50 pessoas (Médio)</option>
                  <option value="50 a 100 pessoas">50 a 100 pessoas (Sala Completa)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-300">Mensagem ou Detalhes (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Gostaria de saber valores para sábado à tarde com combo de pipoca incluso para todos."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-brand-800 bg-brand-950 py-3 px-4 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Gold / Royal Blue CTA */}
              <button
                type="submit"
                disabled={isLoading || !name.trim() || !phone.trim() || !email.trim() || !desiredDate}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gold-400 py-4 px-6 text-sm font-black text-slate-950 shadow-glow hover:bg-gold-300 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Enviando solicitação...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Solicitar Orçamento no WhatsApp</span>
                  </>
                )}
              </button>
              {errorMessage ? <p role="alert" className="bg-rose-400/10 p-3 text-sm font-semibold text-rose-200">{errorMessage}</p> : null}
            </form>
          )}
        </div>

      </div>
    </section>
  );
}
