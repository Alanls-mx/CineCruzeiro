"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { availableCalendarDays, filterLabel, filtersForMovies, MovieSessionSelector, SessionFilter } from "@/components/MovieSessionSelector";
import { MovieTagBadge } from "@/components/MovieTagBadge";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TrailerModal } from "@/components/TrailerModal";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { calendarDayDate, calendarDayTitle, findMovieBySlug, isUploadedAsset, movieSlug } from "@/utils/cinema";
import { trackMarketingEvent } from "@/utils/tracking";

export default function FilmeDetalhePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { content, status, error, retry } = useCinemaContent();
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [filter, setFilter] = useState<SessionFilter>("todos");
  const movie = findMovieBySlug(content, params.slug);
  const calendarDays = useMemo(() => content?.calendar?.days || [], [content?.calendar?.days]);
  const days = useMemo(() => availableCalendarDays(movie ? [movie] : [], calendarDays, filter), [calendarDays, filter, movie]);
  const selectedDay = Math.max(0, days.findIndex((day) => day.isoDate === selectedDate));
  const filters = useMemo(() => filtersForMovies(movie ? [movie] : []), [movie]);

  useEffect(() => {
    if (!movie) return;
    const canonicalSlug = movieSlug(movie);
    if (params.slug !== canonicalSlug) {
      router.replace(`/filmes/${canonicalSlug}`);
    }
  }, [movie, params.slug, router]);

  useEffect(() => setSelectedDate(""), [filter, movie?.id]);

  useEffect(() => {
    if (!days.some((day) => day.isoDate === selectedDate)) setSelectedDate(days[0]?.isoDate || "");
  }, [days, selectedDate]);

  useEffect(() => {
    if (!movie) return;
    const trackingKey = `cine-view-content:${movie.id}`;
    if (window.sessionStorage.getItem(trackingKey)) return;
    window.sessionStorage.setItem(trackingKey, "1");
    trackMarketingEvent("view_content", {
      currency: "BRL",
      items: [{ item_id: `movie-${movie.id}`, item_name: movie.title, item_category: "Filme" }],
    });
  }, [movie]);

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader settings={content?.settings} />
      <main>
        {status === "loading" && <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8"><div className="h-96 skeleton-soft" /></div>}
        {status === "error" && (
          <div role="alert" className="mx-auto flex max-w-[1320px] flex-col items-start gap-4 px-4 py-20 text-rose-100 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>{error}</p>
            <button type="button" onClick={retry} className="inline-flex min-h-[44px] items-center gap-2 bg-white/8 px-4 text-sm font-black text-white transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-300">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          </div>
        )}
        {status === "ready" && !movie && <p className="mx-auto max-w-[1320px] px-4 py-20 text-slate-300 sm:px-6 lg:px-8">Filme não encontrado.</p>}
        {movie && (
          <>
            <section className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                {movie.backdropUrl && (
                  <Image src={movie.backdropUrl} alt="" fill priority unoptimized={isUploadedAsset(movie.backdropUrl)} quality={68} sizes="100vw" className="object-cover" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,.55),#060a12)]" />
              </div>
              <div className="relative mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[300px_1fr] lg:px-8">
                <div className="relative aspect-[2/3] w-full max-w-[300px] overflow-hidden bg-brand-950">
                  {movie.posterUrl && (
                    <Image src={movie.posterUrl} alt={`Poster de ${movie.title}`} fill unoptimized={isUploadedAsset(movie.posterUrl)} quality={74} sizes="300px" className="object-cover" />
                  )}
                </div>
                <div className="self-end pb-4">
                  <MovieTagBadge tag={movie.tag} />
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
              {days.length ? (
                <div className="mt-8 space-y-6">
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {days.map((day, index) => (
                      <button
                        key={day.isoDate || `${day.label}-${index}`}
                        type="button"
                        onClick={() => setSelectedDate(day.isoDate)}
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
                <p className="mt-5 text-slate-400">Nenhuma sessão disponível para este formato.</p>
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
