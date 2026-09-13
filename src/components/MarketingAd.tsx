"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { MarketingAd as MarketingAdRecord } from "@/services/cinemaApi";
import { isUploadedAsset } from "@/utils/cinema";

const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");

export function MarketingAd({ ad }: { ad?: MarketingAdRecord | null }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!ad?.id || tracked.current) return;
    tracked.current = true;
    void fetch(`${API_BASE}/api/marketing/ads/${encodeURIComponent(ad.id)}/impression`, {
      method: "POST",
      keepalive: true
    }).catch(() => null);
  }, [ad?.id]);

  if (!ad?.id) return null;
  const href = safeAdHref(ad.linkUrl);
  const content = (
    <>
      {ad.imageUrl && (
        <div className="relative min-h-[180px] sm:min-h-[230px]">
          <Image
            src={ad.imageUrl}
            alt=""
            fill
            unoptimized={isUploadedAsset(ad.imageUrl)}
            sizes="(max-width: 1320px) 100vw, 1320px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a12]/95 via-[#060a12]/65 to-transparent" />
        </div>
      )}
      <div className="absolute inset-0 flex max-w-xl flex-col justify-center p-6 sm:p-10">
        <p className="font-display text-2xl font-black text-white sm:text-4xl">{ad.title}</p>
        {ad.description && <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">{ad.description}</p>}
        {href && <span className="mt-5 w-fit bg-gold-400 px-5 py-3 text-sm font-black text-slate-950">{ad.ctaLabel || "Saiba mais"}</span>}
      </div>
    </>
  );

  const className = "relative block min-h-[180px] overflow-hidden bg-[#0b1525] sm:min-h-[230px]";
  return href ? (
    <a
      href={href}
      className={className}
      onClick={() => {
        const url = `${API_BASE}/api/marketing/ads/${encodeURIComponent(ad.id)}/click`;
        if (navigator.sendBeacon) navigator.sendBeacon(url);
        else void fetch(url, { method: "POST", keepalive: true }).catch(() => null);
      }}
    >
      {content}
    </a>
  ) : <div className={className}>{content}</div>;
}

function safeAdHref(value?: string) {
  const href = String(value || "").trim();
  if (!href) return "";
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const parsed = new URL(href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}
