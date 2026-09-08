import type { Metadata } from "next";

const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lumixengine.com").origin;
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "/projects/cinecruzeiro").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Filmes em cartaz | Cine Cruzeiro",
  description: "Consulte os filmes e as próximas sessões disponíveis no Cine Cruzeiro.",
  alternates: { canonical: `${origin}${basePath}/filmes` },
};

export default function FilmesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
