"use client";

import dynamic from "next/dynamic";
import { Play } from "lucide-react";
import { useState } from "react";

const TrailerModal = dynamic(
  () => import("@/components/TrailerModal").then((module) => module.TrailerModal),
  { ssr: false }
);

export function HomeTrailerButton({ youtubeId, movieTitle }: { youtubeId: string; movieTitle: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold text-white transition hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
      >
        <Play className="h-4 w-4" />
        Ver trailer
      </button>
      {open && (
        <TrailerModal
          isOpen
          onClose={() => setOpen(false)}
          youtubeId={youtubeId}
          movieTitle={movieTitle}
        />
      )}
    </>
  );
}
