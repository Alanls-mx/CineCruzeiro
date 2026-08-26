"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Ticket } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TrailerModal } from "@/components/TrailerModal";
import { useCinemaContent } from "@/hooks/useCinemaContent";
import { isUploadedAsset, movieSlug, money } from "@/utils/cinema";
import { useState } from "react";
import { Movie } from "@/types";

export default function HomePage() {
  const { content, status, error } = useCinemaContent();
  const [trailer, setTrailer] = useState<{ title?: string; youtubeId?: string } | null>(null);
  const featured = content?.featuredMovie || content?.nowPlaying[0] || null;
  const firstSession = featured?.sessions[0];

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader settings={content?.settings} />
      <main>
        {status === "loading" && <HomeSkeleton />}
        {status === "error" && <HomeError message={error} />}
        {status === "ready" && content && featured && (
          <>
            <section className="relative overflow-hidden">
              <div className="absolute inset-0 opacity-35">
                {featured.backdropUrl && (
                  <Image
                    src={featured.backdropUrl}
                    alt=""
                    fill
                    priority
                    unoptimized={isUploadedAsset(featured.backdropUrl)}
                    fetchPriority="high"
                    quality={58}
                    sizes="100vw"
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,#060a12_0%,rgba(6,10,18,.86)_35%,rgba(6,10,18,.38)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#060a12] to-transparent" />
              </div>
              <div className="relative mx-auto grid min-h-[620px] max-w-[1320px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
                <div className="max-w-3xl">
                  <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">Cinema de bairro • Sala única laser 4K</p>
                  <h1 className="mt-5 font-display text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl">
                    {featured.title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{featured.synopsis}</p>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-300">
                    <span>{featured.rating}</span>
                    <span>{featured.duration}</span>
                    <span>{featured.genre.slice(0, 3).join(" / ")}</span>
                    <span className="text-gold-400">Ingressos {money(firstSession?.priceFull || 10)}</span>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    {firstSession && (
                      <Link href={`/checkout/${firstSession.id}`} className="inline-flex items-center justify-center gap-2 bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
                        <Ticket className="h-4 w-4" />
                        Comprar ingresso
                      </Link>
                    )}
                    {featured.trailerYoutubeId && (
                      <button type="button" onClick={() => setTrailer({ title: featured.title, youtubeId: featured.trailerYoutubeId })} className="inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold text-white transition hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
                        <Play className="h-4 w-4" />
                        Ver trailer
                      </button>
                    )}
                  </div>
                </div>
                <Link href={`/filmes/${movieSlug(featured)}`} className="relative block aspect-[2/3] w-full max-w-[260px] justify-self-center overflow-hidden bg-brand-950 shadow-[0_22px_80px_rgba(0,0,0,.45)] sm:max-w-[300px] lg:justify-self-end" aria-label={`Abrir ${featured.title}`}>
                  {featured.posterUrl && (
                    <Image
                      src={featured.posterUrl}
                      alt={`Poster de ${featured.title}`}
                      fill
                      unoptimized={isUploadedAsset(featured.posterUrl)}
                      quality={74}
                      sizes="(max-width: 640px) 260px, 300px"
                      className="object-cover"
                    />
                  )}
                </Link>
              </div>
            </section>

            <MovieStrip title="Em Cartaz" movies={content.nowPlaying} />
            <MovieStrip title="Em Breve" movies={content.upcoming} muted />
          </>
        )}
      </main>
      <SiteFooter />
      <TrailerModal isOpen={Boolean(trailer)} onClose={() => setTrailer(null)} youtubeId={trailer?.youtubeId} movieTitle={trailer?.title} />
    </div>
  );
}

function MovieStrip({ title, movies, muted = false }: { title: string; movies: Movie[]; muted?: boolean }) {
  if (!movies.length) return null;
  return (
    <section className="deferred-content mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-black sm:text-4xl">{title}</h2>
        <Link href="/filmes" className="text-sm font-bold text-brand-300 hover:text-gold-400">Ver programação</Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {movies.slice(0, 5).map((movie) => (
          <Link key={movie.id} href={`/filmes/${movieSlug(movie)}`} className={muted ? "opacity-90 transition hover:opacity-100" : "group"}>
            <div className="relative aspect-[2/3] overflow-hidden bg-brand-950">
              {movie.posterUrl && (
                <Image
                  src={movie.posterUrl}
                  alt={`Poster de ${movie.title}`}
                  fill
                  unoptimized={isUploadedAsset(movie.posterUrl)}
                  quality={72}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              )}
            </div>
            <h3 className="mt-3 line-clamp-2 text-sm font-black text-white">{movie.title}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">{movie.duration} • {movie.rating}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <section className="mx-auto grid min-h-[620px] max-w-[1320px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <div className="max-w-3xl">
          <div className="h-4 w-64 skeleton-soft" />
          <div className="mt-6 h-24 max-w-2xl skeleton-soft" />
          <div className="mt-5 h-28 max-w-2xl skeleton-soft" />
          <div className="mt-8 h-[52px] w-52 skeleton-soft" />
        </div>
        <div className="aspect-[2/3] w-full max-w-[260px] justify-self-center skeleton-soft sm:max-w-[300px] lg:justify-self-end" />
      </section>
      <SkeletonMovieStrip />
      <SkeletonMovieStrip />
    </div>
  );
}

function SkeletonMovieStrip() {
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 h-10 w-52 skeleton-soft" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <div className="aspect-[2/3] skeleton-soft" />
            <div className="mt-3 h-4 w-4/5 skeleton-soft" />
            <div className="mt-2 h-3 w-2/5 skeleton-soft" />
          </div>
        ))}
      </div>
    </section>
  );
}

function HomeError({ message }: { message: string }) {
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-black">Programação indisponível</h1>
      <p className="mt-4 max-w-xl text-slate-300">{message}</p>
    </section>
  );
}
