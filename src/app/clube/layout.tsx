import type { Metadata } from "next";

const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lumixengine.com").origin;
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "/projects/cinecruzeiro").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "Clube Cine Cruzeiro | Planos mensais",
  description: "Conheça os planos e benefícios mensais do Clube Cine Cruzeiro.",
  alternates: { canonical: `${origin}${basePath}/clube` },
};

export default function ClubeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
