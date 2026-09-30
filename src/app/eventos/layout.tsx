import type { Metadata } from "next";
import { cinemaBrand } from "@/utils/cinema";

const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lumixengine.com").origin;
const isEstacao = process.env.NEXT_PUBLIC_CINEMA_SLUG === "cine-estacao-amparo";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || (isEstacao ? "/projects/cine-estacao-amparo" : "/projects/cinecruzeiro")).replace(/\/+$/, "");
const brand = cinemaBrand();

export const metadata: Metadata = {
  title: `Eventos e sessões privadas | ${brand.name}`,
  description: `Solicite uma sessão privada, comemoração ou evento corporativo no ${brand.name}.`,
  alternates: { canonical: `${origin}${basePath}/eventos` },
};

export default function EventosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
