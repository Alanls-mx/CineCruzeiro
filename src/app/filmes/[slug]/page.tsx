"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { filterLabel, filtersForMovies, firstAvailableDayIndex, MovieSessionSelector, SessionFilter } from "@/components/MovieSessionSelector";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TrailerModal } from "@/components/TrailerModal";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { calendarDayDate, calendarDayTitle, findMovieBySlug, movieSlug } from "@/utils/cinema";
import { trackMarketingEvent } from "@/utils/tracking";

export default function FilmeDetalhePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { content, status, error } = useCinemaContent();
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [filter, setFilter] = useState<SessionFilter>("todos");
  const movie = findMovieBySlug(content, params.slug);
  const days = content?.calendar?.days?.length
    ? content.calendar.days
    : [{ isoDate: "", label: "Hoje", weekday: "HOJE", displayDate: "--/--" }];
  const filters = useMemo(() => filtersForMovies(movie ? [movie] : []), [movie]);

  useEffect(() => {
    if (!movie) return;
    const canonicalSlug = movieSlug(movie);
    if (params.slug !== canonicalSlug) {
      router.replace(`/filmes/${canonicalSlug}`);
    }
  }, [movie, params.slug, router]);

  useEffect(() => {
    if (!movie || !days.length) return;
    const selectedDate = days[selectedDay]?.isoDate;
    const selectedHasSessions = movie.sessions.some((session) => String(session.date || "").slice(0, 10) === selectedDate);
    if (!selectedHasSessions) setSelectedDay(firstAvailableDayIndex([movie], days, filter));
  }, [days, filter, movie, selectedDay]);

  useEffect(() => {
    if (!movie) return;
    const trackingKey = `cine-view-content:${movie.id}`;
    if (window.sessionStorage.getItem(trackingKey)) return;
    window.sessionStorage.setItem(trackingKey, "1");
    trackMarketingEvent("view_content", { content_type: "movie", content_id: movie.id, content_name: movie.title });
  }, [movie]);

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader settings={content?.settings} />
      <main>
        {status === "loading" && <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8"><div className="h-96 skeleton-soft" /></div>}
        {status === "error" && <p className="mx-auto max-w-[1320px] px-4 py-20 text-rose-200 sm:px-6 lg:px-8">{error}</p>}
        {status === "ready" && !movie && <p className="mx-auto max-w-[1320px] px-4 py-20 text-slate-300 sm:px-6 lg:px-8">Filme não encontrado.</p>}
        {movie && (
          <>
            <section className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                {movie.backdropUrl && (
                  <Image src={movie.backdropUrl} alt="" fill priority quality={68} sizes="100vw" className="object-cover" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,.55),#060a12)]" />
              </div>
              <div className="relative mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[300px_1fr] lg:px-8">
                <div className="relative aspect-[2/3] w-full max-w-[300px] overflow-hidden bg-brand-950">
                  {movie.posterUrl && (
                    <Image src={movie.posterUrl} alt={`Poster de ${movie.title}`} fill quality={74} sizes="300px" className="object-cover" />
                  )}
                </div>
                <div className="self-end pb-4">
                  <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Filme</p>
                  <h1 className="mt-4 font-display text-5xl font-black leading-none tracking-tight sm:text-6xl">{movie.title}</h1>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-300">
                    <span>{movie.rating}</span>
                    <span>{movie.duration}</span>
                    <span>{movie.genre.join(" / ")}</span>
                  </div>
                  <p className="mt-6 max-w-3xl text-base leading-8 text-slate-200">{movie.synopsis}</p>
                  {movie.trailerYoutubeId && (
                    <button type="button" onClick={() => setTrailerOpen(true)} className="mt-8 inline-flex items-center gap-2 text-sm font-black text-gold-400 hover:text-gold-300">
                      <Play className="h-4 w-4" />
                      Ver trailer
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
              <h2 className="font-display text-3xl font-black">Sessões disponíveis</h2>
              {movie.sessions.length ? (
                <div className="mt-8 space-y-6">
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
                  <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
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
                  </div>
                  <MovieSessionSelector movie={movie} filter={filter} selectedDay={selectedDay} days={days} />
                </div>
              ) : (
                <p className="mt-5 text-slate-400">Sessões serão divulgadas em breve.</p>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
      <TrailerModal isOpen={trailerOpen} onClose={() => setTrailerOpen(false)} youtubeId={movie?.trailerYoutubeId} movieTitle={movie?.title} />
    </div>
  );
}
