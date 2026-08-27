"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  youtubeId?: string;
  movieTitle?: string;
}

export function TrailerModal({
  isOpen,
  onClose,
  youtubeId,
  movieTitle,
}: TrailerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !youtubeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-700/60 bg-cinema-900 shadow-2xl z-10 animate-scale-up">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 bg-cinema-950/80">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Trailer Oficial: <span className="text-amber-400">{movieTitle}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Fechar trailer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Embed */}
        <div className="relative aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&enablejsapi=1`}
            title={`Trailer de ${movieTitle}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
