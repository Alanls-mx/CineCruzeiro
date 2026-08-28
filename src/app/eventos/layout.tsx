import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eventos e sessões privadas | Cine Cruzeiro",
  description: "Solicite uma sessão privada, aniversário ou evento corporativo no Cine Cruzeiro.",
  alternates: { canonical: "/projects/cinecruzeiro/eventos" },
};

export default function EventosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
