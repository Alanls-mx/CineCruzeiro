"use client";

import Link from "next/link";
import { CalendarDays, Clock, MonitorPlay } from "lucide-react";
import { Movie, Session } from "@/types";
import { calendarDayFullLabel, money } from "@/utils/cinema";

export type SessionFilter = "todos" | "normal" | "dublado" | "legendado" | "3d";

export type CalendarDay = {
  isoDate: string;
  label: string;
  weekday: string;
  displayDate: string;
};

export const MAX_PROGRAMMING_DAYS = 6;

export function MovieSessionSelector({
  movie,
  filter,
  selectedDay,
  days,
}: {
  movie: Movie;
  filter: SessionFilter;
  selectedDay: number;
  days: CalendarDay[];
}) {
  const day = days[selectedDay] || days[0];
  if (!day) return null;
  const sessions = sessionsForCalendarDay(movie, day, filter);
  if (!sessions.length) return null;
  const grouped = groupSessions(sessions);

  return (
    <section className="rounded-lg bg-brand-900/60 p-5 shadow-xl shadow-blue-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[.18em] text-white">Cine Cruzeiro</h3>
          <p className="mt-1 text-sm text-slate-400">Sala única, projeção laser 4K, som Dolby 7.1. Lugares por ordem de chegada.</p>
        </div>
        <MonitorPlay className="h-5 w-5 text-brand-300" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-black text-brand-300">
          <CalendarDays className="h-4 w-4 text-gold-400" />
          {day ? calendarDayFullLabel(day, selectedDay) : "Hoje"}
        </span>
        {sessions[0] && <span className="rounded-full bg-gold-400/12 px-3 py-1 font-black text-gold-400">{money(sessions[0].priceFull)}</span>}
      </div>

      <div className="mt-5 space-y-5">
        {grouped.map(([label, items]) => (
          <div key={`${movie.id}-${label}`}>
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-brand-300">
              <Clock className="h-4 w-4 text-gold-400" />
              {label}
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((session) => (
                <Link
                  key={session.id}
                  href={`/checkout/${session.id}`}
                  className={`min-w-[82px] rounded-lg px-4 py-3 text-center text-lg font-black transition ${
                    session.status === "sold_out" ? "pointer-events-none bg-white/5 text-slate-600" : "bg-gold-400 text-slate-950 hover:bg-gold-300"
                  }`}
                >
                  {session.time}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function filtersForMovies(movies: Movie[]): SessionFilter[] {
  const sessions = movies.flatMap((movie) => movie.sessions || []);
  const filters: SessionFilter[] = ["todos"];
  if (sessions.some((session) => !session.format.toLowerCase().includes("3d"))) filters.push("normal");
  if (sessions.some((session) => session.format.toLowerCase().includes("dublado"))) filters.push("dublado");
  if (sessions.some((session) => session.format.toLowerCase().includes("legendado"))) filters.push("legendado");
  if (sessions.some((session) => session.format.toLowerCase().includes("3d"))) filters.push("3d");
  return filters;
}

export function availableCalendarDays(movies: Movie[], days: CalendarDay[], filter: SessionFilter = "todos") {
  const availableDates = new Set(
    movies
      .flatMap((movie) => movie.sessions || [])
      .filter((session) => session.status !== "sold_out" && sessionMatchesFilter(session, filter))
      .map((session) => String(session.date || "").slice(0, 10))
      .filter(Boolean)
  );
  return days.filter((day) => availableDates.has(day.isoDate)).slice(0, MAX_PROGRAMMING_DAYS);
}

export function sessionsForCalendarDay(movie: Movie, day: CalendarDay, filter: SessionFilter = "todos") {
  return (movie.sessions || []).filter(
    (session) => session.status !== "sold_out" && sessionMatchesFilter(session, filter) && sessionMatchesDay(session, day)
  );
}

export function filterLabel(filter: SessionFilter) {
  return {
    todos: "Todos",
    normal: "Normal",
    dublado: "Dublado",
    legendado: "Legendado",
    "3d": "3D",
  }[filter];
}

function sessionMatchesFilter(session: Session, filter: SessionFilter) {
  const format = session.format.toLowerCase();
  if (filter === "todos") return true;
  if (filter === "normal") return !format.includes("3d");
  if (filter === "dublado") return format.includes("dublado");
  if (filter === "legendado") return format.includes("legendado");
  return format.includes("3d");
}

function sessionMatchesDay(session: Session, day?: CalendarDay) {
  if (!day?.isoDate || !session.date) return false;
  return String(session.date).slice(0, 10) === day.isoDate;
}

function groupSessions(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  sessions.forEach((session) => {
    const label = session.format.replace(/^2D\s*•?\s*/i, "").replace(/^2D\s+/i, "").replace(/\s+/g, " ").trim().toUpperCase();
    const group = label || "NORMAL";
    map.set(group, [...(map.get(group) || []), session]);
  });
  return Array.from(map.entries()).map(([label, items]) => [label, [...items].sort(compareSessions)] as [string, Session[]]);
}

function compareSessions(a: Session, b: Session) {
  return `${a.date || "9999-12-31"}T${a.time || "23:59"}`.localeCompare(`${b.date || "9999-12-31"}T${b.time || "23:59"}`);
}
