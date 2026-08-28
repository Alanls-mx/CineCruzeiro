import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clube Cine Cruzeiro | Planos mensais",
  description: "Conheça os planos e benefícios mensais do Clube Cine Cruzeiro.",
  alternates: { canonical: "/projects/cinecruzeiro/clube" },
};

export default function ClubeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
