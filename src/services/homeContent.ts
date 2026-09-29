import { unstable_cache } from "next/cache";
import { CinemaContent, normalizeCinemaContent } from "@/services/cinemaApi";

export const backendUrl = (
  process.env.CINE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_CINE_API_URL ||
  (process.env.NODE_ENV === "production" ? "http://127.0.0.1:4100" : "http://127.0.0.1:4000")
).replace(/\/+$/, "");

export const loadHomeContent = unstable_cache(
  async () => {
    const response = await fetch(`${backendUrl}/api/content`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Não foi possível carregar a programação.");
    return normalizeCinemaContent(await response.json());
  },
  ["cine-cruzeiro-home-content"],
  { revalidate: 30 }
);

export function homeFeaturedMovie(content: CinemaContent | null) {
  return content?.featuredMovie || content?.nowPlaying[0] || null;
}
