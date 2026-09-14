"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { MarketingAd as MarketingAdRecord } from "@/services/cinemaApi";
import { isUploadedAsset } from "@/utils/cinema";

const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");

export function MarketingAd({ ad }: { ad?: MarketingAdRecord | null }) {
  const tracked = useRef(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(6);

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
        <div
          className="relative order-1 aspect-[var(--ad-ratio)] w-full bg-[#050911] lg:order-2"
          style={{
            "--ad-ratio": imageAspectRatio,
          } as CSSProperties}
        >
          <Image
            src={ad.imageUrl}
            alt={ad.title}
            fill
            unoptimized={isUploadedAsset(ad.imageUrl)}
            sizes="(max-width: 1320px) 100vw, 1320px"
            className="object-contain"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageAspectRatio(Math.min(8, Math.max(2, naturalWidth / naturalHeight)));
              }
            }}
          />
        </div>
      )}
      <div className="order-2 flex flex-col justify-center gap-6 bg-[#0b1525] px-5 py-6 sm:px-7 lg:order-1 lg:px-9">
        <div className="min-w-0">
          <p className="font-display text-xl font-black leading-tight text-white sm:text-2xl">{ad.title}</p>
          {ad.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{ad.description}</p>}
        </div>
        {href && (
          <span className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 bg-gold-400 px-5 text-sm font-black text-slate-950 transition group-hover:bg-gold-300 sm:w-auto sm:self-start">
            {ad.ctaLabel || "Saiba mais"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  );

  const className = `group overflow-hidden rounded-lg bg-[#0b1525] shadow-[0_18px_50px_rgba(0,0,0,.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400 ${ad.imageUrl ? "grid lg:grid-cols-2" : "block"}`;
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
