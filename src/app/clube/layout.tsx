import type { Metadata } from "next";
import { cinemaBrand } from "@/utils/cinema";

const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lumixengine.com").origin;
const isEstacao = process.env.NEXT_PUBLIC_CINEMA_SLUG === "cine-estacao-amparo";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || (isEstacao ? "/projects/cine-estacao-amparo" : "/projects/cinecruzeiro")).replace(/\/+$/, "");
const brand = cinemaBrand();

export const metadata: Metadata = {
  title: `${brand.clubLabel} | Planos mensais`,
  description: `Conheça os planos e benefícios mensais do ${brand.clubLabel}.`,
  alternates: { canonical: `${origin}${basePath}/clube` },
};

export default function ClubeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
