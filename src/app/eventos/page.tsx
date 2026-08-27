"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Building2, CalendarDays, CheckCircle2, Gamepad2, Mail, PartyPopper, Send, UsersRound } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { fetchCinemaContent } from "@/services/cinemaApi";
import type { CinemaContent } from "@/services/cinemaApi";
import { sendPrivateEventWebhook } from "@/services/webhook";
import type { PrivateEventRequest } from "@/types";
import { trackMarketingEvent } from "@/utils/tracking";
import { isUploadedAsset } from "@/utils/cinema";

export default function EventosPage() {
  const [settings, setSettings] = useState<CinemaContent["settings"]>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    eventType: "aniversario",
    estimatedGuests: "",
    desiredDate: "",
    desiredTime: "",
    notes: "",
    website: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);
  const preserveTransparentImages = settings.eventTransparentImages === true;

  useEffect(() => {
    fetchCinemaContent()
      .then((content) => setSettings(content.settings || {}))
      .catch(() => null);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageType("");
    const payload: PrivateEventRequest = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      eventType: form.eventType as PrivateEventRequest["eventType"],
      estimatedGuests: form.estimatedGuests,
      desiredDate: [form.desiredDate, form.desiredTime].filter(Boolean).join(" "),
      notes: form.notes,
      website: form.website,
      source: "landing_page_feche_o_cinema",
      createdAt: new Date().toISOString(),
    };
    try {
      const result = await sendPrivateEventWebhook(payload);
      setMessage(result.message || "Solicitação enviada. Em breve entraremos em contato.");
      setMessageType(result.success ? "success" : "error");
      if (result.success) {
        trackMarketingEvent("lead", { lead_type: "evento_privado" });
        setForm({ name: "", phone: "", email: "", eventType: "aniversario", estimatedGuests: "", desiredDate: "", desiredTime: "", notes: "", website: "" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#060a12] text-white">
      <SiteHeader />
      <main className="flex-1 overflow-hidden">
        <section className="mx-auto grid max-w-[1320px] items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <h1 className="font-display text-5xl font-black leading-none sm:text-7xl">Uma sessão só para o seu grupo.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Aniversários, games, eventos privados e encontros corporativos em um cinema de rua com tela grande, som forte e atendimento próximo.
            </p>
            <a href="#orcamento" className="mt-8 inline-flex min-h-[52px] items-center justify-center bg-gold-400 px-7 text-sm font-black text-slate-950 transition hover:bg-gold-300">
              Solicitar orçamento
            </a>
          </div>
          <div className={`relative min-h-[360px] overflow-hidden rounded-[10px] shadow-[0_30px_90px_rgba(0,0,0,.45)] lg:min-h-[560px] ${preserveTransparentImages ? "bg-[#091122]" : ""}`}>
            {settings.eventHeroImageUrl ? (
              <Image src={settings.eventHeroImageUrl} alt="Sala de cinema reservada para evento privado" fill priority unoptimized={isUploadedAsset(settings.eventHeroImageUrl)} className={preserveTransparentImages ? "object-contain p-5 sm:p-8" : "object-cover"} sizes="(max-width: 1024px) 100vw, 56vw" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(37,99,235,.28),transparent_36%),linear-gradient(135deg,#0d1930,#030712)]" />
            )}
            <div className={`absolute inset-0 ${preserveTransparentImages ? "bg-[linear-gradient(180deg,transparent_58%,rgba(6,10,18,.82))]" : "bg-[linear-gradient(180deg,rgba(6,10,18,.05),rgba(6,10,18,.78))]"}`} />
            <p className="absolute bottom-0 left-0 max-w-md p-6 font-display text-3xl font-black leading-tight">A tela grande vira aniversário, campeonato, apresentação ou sessão privada.</p>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1.08fr_.92fr]">
            <div className="grid gap-5">
              <Experience image={settings.eventGamesImageUrl || ""} preserveTransparency={preserveTransparentImages} icon={<Gamepad2 />} title="Games" text="Console na tela grande, som da sala e clima de campeonato com os amigos." />
              <Experience image={settings.eventPartiesImageUrl || ""} preserveTransparency={preserveTransparentImages} icon={<PartyPopper />} title="Aniversários e festas" text="Sessão especial, bomboniere e registro fotográfico para transformar a data em estreia." />
              <Experience image={settings.eventCorporateImageUrl || ""} preserveTransparency={preserveTransparentImages} icon={<Building2 />} title="Corporativo" text="Treinamentos, apresentações e encontros fora da sala de reunião convencional." />
            </div>
            <div className={`relative min-h-[420px] overflow-hidden rounded-[10px] ${preserveTransparentImages ? "bg-[#091122]" : ""}`}>
              {settings.eventGalleryImageUrl ? (
                <Image src={settings.eventGalleryImageUrl} alt="Público entrando em uma sala de cinema" fill unoptimized={isUploadedAsset(settings.eventGalleryImageUrl)} className={preserveTransparentImages ? "object-contain p-5 sm:p-8" : "object-cover"} sizes="(max-width: 768px) 100vw, 42vw" />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(250,204,21,.18),transparent_32%),linear-gradient(135deg,#0d1930,#030712)]" />
              )}
              <div className={`absolute inset-0 ${preserveTransparentImages ? "bg-brand-950/5" : "bg-brand-950/35"}`} />
            </div>
          </div>
        </section>

        <section className="bg-[#091122]">
          <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
            <Step title="Conte sua ideia" text="Você envia o tipo de evento e tamanho do grupo." />
            <Step title="Montamos a proposta" text="A equipe indica formato, horário e possibilidades." />
            <Step title="Reservamos a sala" text="A data fica alinhada com a programação do cinema." />
            <Step title="Seu grupo chega" text="Tela, som e atendimento prontos para a experiência." />
          </div>
        </section>

        <section id="orcamento" className="mx-auto grid max-w-[1320px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
          <div className="self-start">
            <h2 className="font-display text-4xl font-black sm:text-5xl">Solicitar orçamento</h2>
            <p className="mt-4 leading-7 text-slate-300">Campos rápidos, só o necessário para a equipe retornar pelo WhatsApp com uma proposta real.</p>
            <div className="mt-8 grid gap-4 text-sm font-bold text-slate-300">
              <span className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-gold-400" /> Ideal para grupos, turmas e empresas.</span>
              <span className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-gold-400" /> Data e horário dependem da programação.</span>
              <span className="flex items-center gap-3"><Mail className="h-5 w-5 text-gold-400" /> Integra com CRM quando configurado.</span>
            </div>
          </div>
          <form onSubmit={submit} className="grid gap-4 bg-brand-900/65 p-5 shadow-2xl shadow-blue-950/20 sm:grid-cols-2 sm:p-7">
            <Field label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
            <Field label="WhatsApp" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} required />
            <Field label="E-mail" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
            <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              Site
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Tipo de evento</span>
              <select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })} className="mt-2 w-full">
                <option value="videogame">Games</option>
                <option value="aniversario">Aniversário/Festa</option>
                <option value="corporativo">Corporativo</option>
                <option value="filme_classico">Sessão privada</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <Field label="Quantidade estimada" value={form.estimatedGuests} onChange={(value) => setForm({ ...form, estimatedGuests: value })} />
            <Field label="Data desejada" type="date" value={form.desiredDate} onChange={(value) => setForm({ ...form, desiredDate: value })} />
            <Field label="Horário desejado" type="time" value={form.desiredTime} onChange={(value) => setForm({ ...form, desiredTime: value })} />
            <label className="block sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Mensagem</span>
              <textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 w-full" placeholder="Conte se precisa de bomboniere, decoração, apresentação ou console." />
            </label>
            <button type="submit" disabled={loading} className="inline-flex min-h-[52px] items-center justify-center gap-2 bg-gold-400 px-7 text-sm font-black text-slate-950 transition hover:bg-gold-300 disabled:opacity-50 sm:col-span-2">
              <Send className="h-4 w-4" />
              {loading ? "Enviando..." : "Solicitar orçamento"}
            </button>
            {message && (
              <p role="status" className={`flex items-start gap-2 p-3 text-sm font-semibold sm:col-span-2 ${messageType === "success" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>
                {messageType === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{message}</span>
              </p>
            )}
          </form>
        </section>

        <section className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-5 bg-white/[0.04] p-6 md:flex-row md:items-center">
            <p className="max-w-2xl text-lg font-bold leading-7 text-slate-200">Prefere vir no fluxo normal? A programação do Cine Cruzeiro continua aberta com ingresso promocional.</p>
            <Link href="/filmes" className="inline-flex min-h-[52px] items-center justify-center bg-white/8 px-7 text-sm font-black text-white transition hover:bg-white/12">Ver programação</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Experience({ image, preserveTransparency, icon, title, text }: { image: string; preserveTransparency: boolean; icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="grid gap-4 sm:grid-cols-[190px_1fr]">
      <div className={`relative min-h-[160px] overflow-hidden rounded-[10px] ${preserveTransparency ? "bg-[#091122]" : ""}`}>
        {image ? (
          <Image src={image} alt={title} fill unoptimized={isUploadedAsset(image)} className={preserveTransparency ? "object-contain p-4" : "object-cover"} sizes="(max-width: 640px) 100vw, 190px" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(37,99,235,.24),transparent_38%),linear-gradient(135deg,#0d1930,#030712)]" />
        )}
      </div>
      <div className="self-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-gold-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <h2 className="font-display text-3xl font-black">{title}</h2>
        <p className="mt-3 leading-7 text-slate-300">{text}</p>
      </div>
    </article>
  );
}

function Step({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-black">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[.16em] text-slate-400">{label}</span>
      <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full" />
    </label>
  );
}
