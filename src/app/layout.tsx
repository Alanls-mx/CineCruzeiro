import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
const logoUrl = `${basePath}/images/logo.png`;
const iconUrl = `${basePath}/images/logo-icon.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cine Cruzeiro | O Cinema do Seu Bairro • Sem Filas e Preço Justo",
  description:
    "Compre seus ingressos para o Cine Cruzeiro em 30 segundos via Pix. Sala única com projeção Laser 4K, som Dolby 7.1, pipoca quentinha artesanal e zero filas.",
  keywords: [
    "Cine Cruzeiro",
    "cinema de bairro",
    "ingressos de cinema",
    "cinema sem fila",
    "filmes em cartaz",
    "aluguel de cinema para eventos",
  ],
  icons: {
    icon: iconUrl,
    apple: iconUrl,
  },
  openGraph: {
    title: "Cine Cruzeiro | O Cinema do Seu Bairro",
    description: "Sem filas de shopping, pipoca crocante na manteiga e ingressos sem taxas no Pix.",
    type: "website",
    images: [logoUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable} dark scroll-smooth`}>
      <body className="min-h-dvh bg-brand-950 text-slate-100 antialiased selection:bg-gold-400 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
