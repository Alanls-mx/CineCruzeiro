import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Filmes em cartaz | Cine Cruzeiro",
  description: "Consulte os filmes e as próximas sessões disponíveis no Cine Cruzeiro.",
  alternates: { canonical: "/projects/cinecruzeiro/filmes" },
};

export default function FilmesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
