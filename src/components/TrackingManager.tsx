"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { measurementConsentKey } from "@/utils/tracking";

type Consent = "granted" | "denied" | null;
type TrackingSettings = {
  enabled?: boolean;
  googleMeasurementId?: string;
  metaPixelId?: string;
};

const productionBasePath = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const apiBase = (process.env.NEXT_PUBLIC_BASE_PATH || productionBasePath).replace(/\/+$/, "");

export function TrackingManager() {
  const pathname = usePathname();
  const [tracking, setTracking] = useState<TrackingSettings | null>(null);
  const [consent, setConsent] = useState<Consent>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const lastGooglePath = useRef("");
  const lastMetaPath = useRef("");
  const initializedGoogleId = useRef("");
  const enabled = Boolean(tracking?.enabled && (tracking.googleMeasurementId || tracking.metaPixelId));

  useEffect(() => {
    setConsent((window.localStorage.getItem(measurementConsentKey) as Consent) || null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/api/content`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((content) => setTracking(content?.settings?.tracking || {}))
      .catch(() => setTracking({}));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const measurementId = tracking?.googleMeasurementId?.replace(/[^A-Za-z0-9-]/g, "") || "";
    if (consent !== "granted" || !measurementId || initializedGoogleId.current === measurementId) return;

    const trackedWindow = window as typeof window & {
      dataLayer?: unknown[][];
      gtag?: (...args: unknown[]) => void;
    };
    trackedWindow.dataLayer = trackedWindow.dataLayer || [];
    trackedWindow.gtag = trackedWindow.gtag || function gtag(...args: unknown[]) {
      trackedWindow.dataLayer?.push(args);
    };
    trackedWindow.gtag("js", new Date());
    trackedWindow.gtag("consent", "update", { analytics_storage: "granted", ad_storage: "granted" });
    trackedWindow.gtag("config", measurementId, { send_page_view: false, anonymize_ip: true });
    initializedGoogleId.current = measurementId;
    setGoogleReady(true);
  }, [consent, tracking?.googleMeasurementId]);

  useEffect(() => {
    if (consent !== "granted" || !googleReady || lastGooglePath.current === pathname) return;
    const trackedWindow = window as typeof window & { gtag?: (...args: unknown[]) => void };
    trackedWindow.gtag?.("event", "page_view", { page_path: pathname, page_location: window.location.href });
    lastGooglePath.current = pathname;
  }, [consent, googleReady, pathname]);

  useEffect(() => {
    if (consent !== "granted" || !metaReady || lastMetaPath.current === pathname) return;
    const trackedWindow = window as typeof window & { fbq?: (...args: unknown[]) => void };
    trackedWindow.fbq?.("track", "PageView");
    lastMetaPath.current = pathname;
  }, [consent, metaReady, pathname]);

  const choose = (value: Exclude<Consent, null>) => {
    window.localStorage.setItem(measurementConsentKey, value);
    setConsent(value);
  };

  if (!enabled) return null;

  return (
    <>
      {consent === "granted" && tracking?.googleMeasurementId && (
        <Script
          id="cine-google-analytics-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tracking.googleMeasurementId)}`}
          strategy="afterInteractive"
        />
      )}
      {consent === "granted" && tracking?.metaPixelId && (
        <Script id="cine-meta-pixel" strategy="lazyOnload" onReady={() => setMetaReady(true)}>{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${tracking.metaPixelId.replace(/\D/g, "")}');
        `}</Script>
      )}
      {consent === null && (
        <aside className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-2xl rounded-lg bg-[#101827] p-4 text-sm text-slate-200 shadow-[0_20px_70px_rgba(0,0,0,.55)] sm:flex sm:items-center sm:gap-5" aria-label="Preferências de medição">
          <p className="min-w-0 flex-1 leading-6">Usamos medição de audiência e anúncios para entender campanhas. Nenhum e-mail, telefone ou CPF é enviado a essas plataformas.</p>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <button type="button" onClick={() => choose("denied")} className="min-h-[42px] rounded-lg bg-white/8 px-4 font-bold text-white transition hover:bg-white/12">Somente essenciais</button>
            <button type="button" onClick={() => choose("granted")} className="min-h-[42px] rounded-lg bg-gold-400 px-4 font-black text-slate-950 transition hover:bg-gold-300">Aceitar medição</button>
          </div>
        </aside>
      )}
    </>
  );
}
