import type { Metadata } from "next";

const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lumixengine.com").origin;
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "/projects/cinecruzeiro").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Eventos e sessões privadas | Cine Cruzeiro",
  description: "Solicite uma sessão privada, aniversário ou evento corporativo no Cine Cruzeiro.",
  alternates: { canonical: `${origin}${basePath}/eventos` },
};

export default function EventosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
