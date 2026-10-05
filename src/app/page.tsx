import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { Ticket } from "lucide-react";
import { HomeTrailerButton } from "@/components/HomeTrailerButton";
import { MovieTagBadge } from "@/components/MovieTagBadge";
import { MovieMetadata } from "@/components/MovieMetadata";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { CinemaContent } from "@/services/cinemaApi";
import { homeFeaturedMovie, loadHomeContent } from "@/services/homeContent";
import { Movie } from "@/types";
import { isUploadedAsset, movieSlug, money } from "@/utils/cinema";
import { normalizeMovieTag } from "@/utils/movieTags";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://lumixengine.com" : "http://localhost:3000");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "")).replace(/\/+$/, "");

export async function generateMetadata(): Promise<Metadata> {
  try {
    const featured = homeFeaturedMovie(await loadHomeContent());
    if (!featured) return {};

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const artVersion = createHash("sha1")
      .update(`${featured.id}|${featured.title}|${featured.posterUrl}|${featured.backdropUrl}`)
      .digest("hex").slice(0, 10);
    const imageUrl = `${new URL(siteUrl).origin}${basePath}/og/home?day=${encodeURIComponent(day)}&movie=${encodeURIComponent(featured.id)}&art=${artVersion}`;
    const title = `${featured.title} | Cine Cruzeiro`;
    const description = featured.synopsis?.trim().slice(0, 180) || `Confira ${featured.title} no Cine Cruzeiro.`;

    return {
      title,
      description,
      openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630, alt: `${featured.title} em destaque no Cine Cruzeiro` }] },
      twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
    };
  } catch {
    return {};
  }
}

export default async function HomePage() {
  let content: CinemaContent | null = null;
  let error = "";

  try {
    content = await loadHomeContent();
  } catch {
    error = "Não foi possível carregar a programação agora. Tente novamente em instantes.";
  }

  const featured = homeFeaturedMovie(content);
  const firstSession = featured?.sessions[0];

  return (
    <div className="min-h-screen bg-[#060a12] text-white">
      <SiteHeader settings={content?.settings} />
      <main>
        {content && featured ? (
          <>
            <section className="relative overflow-hidden">
              <div className="absolute inset-0 hidden opacity-35 sm:block">
                {featured.backdropUrl && (
                  <Image
                    src={featured.backdropUrl}
                    alt=""
                    fill
                    priority
                    unoptimized={isUploadedAsset(featured.backdropUrl)}
                    fetchPriority="high"
                    quality={40}
                    sizes="(max-width: 639px) 1px, 100vw"
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,#060a12_0%,rgba(6,10,18,.86)_35%,rgba(6,10,18,.38)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#060a12] to-transparent" />
              </div>
              <div className="relative mx-auto grid min-h-[620px] max-w-[1320px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
                <div className="max-w-3xl">
                  <MovieTagBadge tag={featured.tag} className="mb-4" />
                  <p className="text-sm font-black uppercase tracking-[.22em] text-brand-300">{featuredMovieEyebrow(featured)}</p>
                  <h1 className="mt-5 font-display text-5xl font-black leading-none tracking-tight sm:text-6xl lg:text-7xl">{featured.title}</h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{featured.synopsis}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold text-slate-300">
                    <MovieMetadata rating={featured.rating} duration={featured.duration} genres={featured.genre} />
                    <span className="text-gold-400">Ingressos {money(firstSession?.priceFull || 10)}</span>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    {firstSession && (
                      <Link href={`/checkout/${firstSession.id}?novaCompra=1`} className="inline-flex items-center justify-center gap-2 bg-gold-400 px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400">
                        <Ticket className="h-4 w-4" />
                        Comprar ingresso
                      </Link>
                    )}
                    {featured.trailerYoutubeId && <HomeTrailerButton youtubeId={featured.trailerYoutubeId} movieTitle={featured.title} />}
                  </div>
                </div>
                <div className="cinema-hero-poster-frame relative w-full max-w-[260px] justify-self-center sm:max-w-[300px] lg:justify-self-end">
                  <Link href={`/filmes/${movieSlug(featured)}`} className="cinema-hero-poster relative z-10 block aspect-[2/3] w-full overflow-hidden bg-brand-950 shadow-[0_22px_80px_rgba(0,0,0,.45)]" aria-label={`Abrir ${featured.title}`}>
                    {featured.posterUrl && (
                      <Image
                        src={featured.posterUrl}
                        alt={`Poster de ${featured.title}`}
                        fill
                        unoptimized={isUploadedAsset(featured.posterUrl)}
                        quality={68}
                        sizes="(max-width: 640px) 260px, 300px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                </div>
              </div>
            </section>
            <MovieStrip title="Em Cartaz" movies={content.nowPlaying} />
            <MovieStrip title="Em Breve" movies={content.upcoming} muted />
          </>
        ) : (
          <HomeError message={error || "Nenhum filme disponível na programação."} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function featuredMovieEyebrow(movie: Movie) {
  const labels: Record<string, string> = {
    "pre-estreia": "Pré-estreia no Cine Cruzeiro",
    estreia: "Estreia no Cine Cruzeiro",
    "destaque da semana": "Destaque da semana no Cine Cruzeiro",
    "ultimos dias": "Últimos dias no Cine Cruzeiro",
    "em breve": "Em breve no Cine Cruzeiro",
    "sessao familia": "Sessão família no Cine Cruzeiro",
    "sessao especial": "Sessão especial no Cine Cruzeiro",
    classico: "Clássico no Cine Cruzeiro",
    reexibicao: "De volta ao Cine Cruzeiro",
  };

  return labels[normalizeMovieTag(movie.tag)] || "Novidade no Cine Cruzeiro";
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
                  quality={68}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  className="object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              )}
              <MovieTagBadge tag={movie.tag} className="absolute left-3 top-3" />
            </div>
            <h3 className="mt-3 line-clamp-2 text-sm font-black text-white">{movie.title}</h3>
            <MovieMetadata rating={movie.rating} duration={movie.duration} compact className="mt-2" />
          </Link>
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
