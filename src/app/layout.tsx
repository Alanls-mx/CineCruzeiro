import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { TrackingManager } from "@/components/TrackingManager";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "optional",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "optional",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://lumixengine.com" : "http://localhost:3000");
const productionBasePath = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || productionBasePath).replace(/\/+$/, "");
const logoUrl = `${basePath}/images/logo-display.webp`;
const iconUrl = `${basePath}/images/favicon-64.png`;
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
  alternates: {
    canonical: `${basePath || ""}/`,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Cine Cruzeiro | O Cinema do Seu Bairro",
    description: "Sem filas de shopping, pipoca crocante na manteiga e ingressos sem taxas no Pix.",
    url: `${basePath || ""}/`,
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
          window.gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
        ` }} />
      </head>
      <body className="min-h-dvh bg-brand-950 text-slate-100 antialiased selection:bg-gold-400 selection:text-slate-950">
        {children}
        <TrackingManager />
      </body>
    </html>
  );
}
