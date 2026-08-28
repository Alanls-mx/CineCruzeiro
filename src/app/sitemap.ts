import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
  : "https://lumixengine.com";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "/projects/cinecruzeiro").replace(/\/+$/, "");
const backendUrl = (process.env.CINE_BACKEND_URL || process.env.NEXT_PUBLIC_CINE_API_URL || "http://127.0.0.1:4100").replace(/\/+$/, "");
const publicUrl = `${origin}${basePath}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: publicUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${publicUrl}/filmes`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${publicUrl}/clube`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${publicUrl}/eventos`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${publicUrl}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${publicUrl}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const response = await fetch(`${backendUrl}/api/content`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return staticEntries;
    const content = await response.json();
    const movies = [...(content.nowPlaying || []), ...(content.upcoming || [])];
    return [
      ...staticEntries,
      ...movies.map((movie: { id?: string; slug?: string; updatedAt?: string }) => ({
        url: `${publicUrl}/filmes/${encodeURIComponent(movie.slug || movie.id || "filme")}`,
        lastModified: movie.updatedAt ? new Date(movie.updatedAt) : now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
