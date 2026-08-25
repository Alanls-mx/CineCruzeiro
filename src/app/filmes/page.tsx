"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { filterLabel, filtersForMovies, firstAvailableDayIndex, MovieSessionSelector, SessionFilter } from "@/components/MovieSessionSelector";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { calendarDayDate, calendarDayTitle, movieSlug } from "@/utils/cinema";
import { Movie } from "@/types";

export default function FilmesPage() {
  const { content, status, error } = useCinemaContent();
  const [selectedDay, setSelectedDay] = useState(0);
  const [filter, setFilter] = useState<SessionFilter>("todos");

  const days = content?.calendar?.days?.length
    ? content.calendar.days
    : [{ isoDate: "", label: "Hoje", weekday: "HOJE", displayDate: "--/--" }];
  const movies = content?.nowPlaying || [];
  const availableFilters = useMemo(() => filtersForMovies(movies), [movies]);

  useEffect(() => {
    if (!movies.length || !days.length) return;
    const selectedDate = days[selectedDay]?.isoDate;
    const selectedHasSessions = movies.some((movie) => movie.sessions.some((session) => String(session.date || "").slice(0, 10) === selectedDate));
    if (!selectedHasSessions) setSelectedDay(firstAvailableDayIndex(movies, days, filter));
  }, [days, filter, movies, selectedDay]);

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader settings={content?.settings} />
      <main className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Programação</p>
          <h1 className="mt-4 font-display text-5xl font-black tracking-tight">Filmes no Cine Cruzeiro</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Escolha a data, filtre o formato e compre seu ingresso sem baixar aplicativo.
          </p>
        </div>

        {status === "loading" && <div className="h-80 skeleton-soft" />}
        {status === "error" && <p className="text-rose-200">{error}</p>}
        {status === "ready" && content && (
          <div className="space-y-8">
            <section className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.18em] text-brand-300">
                <CalendarDays className="h-4 w-4 text-gold-400" />
                Datas
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {days.map((day, index) => (
                  <button
                    key={day.isoDate || `${day.label}-${index}`}
                    type="button"
                    onClick={() => setSelectedDay(index)}
                    className={`min-w-[112px] rounded-lg px-4 py-3 text-left transition ${
                      selectedDay === index ? "bg-gold-400 text-slate-950" : "bg-brand-900/80 text-white hover:bg-brand-850"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase">{calendarDayTitle(day, index)}</span>
                    <span className="mt-1 block text-lg font-black">{calendarDayDate(day)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-wrap gap-2">
              {availableFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    filter === item ? "bg-brand-600 text-white shadow-glow-blue" : "bg-white/8 text-slate-300 hover:bg-white/12"
                  }`}
                >
                  {filterLabel(item)}
                </button>
              ))}
            </section>

            <section className="space-y-8">
              {movies.length ? movies.map((movie, index) => (
                <MovieSchedule key={movie.id} movie={movie} filter={filter} selectedDay={selectedDay} days={days} priority={index === 0} />
              )) : <p className="text-sm text-slate-400">Nenhum filme em cartaz.</p>}
            </section>

            {!!content.upcoming.length && (
              <section className="border-t border-white/8 pt-10">
                <h2 className="font-display text-3xl font-black">Em breve</h2>
                <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
                  {content.upcoming.map((movie) => (
                    <Link key={movie.id} href={`/filmes/${movieSlug(movie)}`} className="group">
                      <div className="relative aspect-[2/3] overflow-hidden bg-brand-950">
                        {movie.posterUrl && (
                          <Image
                            src={movie.posterUrl}
                            alt={`Poster de ${movie.title}`}
                            fill
                            quality={72}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover transition duration-200 group-hover:scale-[1.02]"
                          />
                        )}
                      </div>
                      <strong className="mt-3 block line-clamp-2 group-hover:text-gold-400">{movie.title}</strong>
                      <span className="mt-1 block text-sm text-slate-500">Em breve</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function MovieSchedule({ movie, filter, selectedDay, days, priority = false }: { movie: Movie; filter: SessionFilter; selectedDay: number; days: Array<{ isoDate: string; label: string; weekday: string; displayDate: string }>; priority?: boolean }) {
  return (
    <article className="grid gap-5 border-t border-white/8 pt-8 lg:grid-cols-[180px_1fr]">
      <Link href={`/filmes/${movieSlug(movie)}`} className="relative block aspect-[2/3] w-full max-w-[180px] overflow-hidden bg-brand-950">
        {movie.posterUrl && (
          <Image
            src={movie.posterUrl}
            alt={`Poster de ${movie.title}`}
            fill
            priority={priority}
            quality={72}
            sizes="180px"
            className="object-cover"
          />
        )}
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-black">{movie.title}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-400">{movie.rating} • {movie.duration}</p>
          </div>
        </div>
        <div className="mt-6">
          <MovieSessionSelector movie={movie} filter={filter} selectedDay={selectedDay} days={days} />
        </div>
      </div>
    </article>
  );
}
