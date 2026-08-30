import { Clock3 } from "lucide-react";
import type { AgeRating } from "@/types";
import { AgeRatingBadge } from "@/components/AgeRatingBadge";

export function MovieMetadata({ rating, duration, genres = [], compact = false, className = "" }: {
  rating: AgeRating;
  duration: string;
  genres?: string[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-2 text-xs" : "gap-x-4 gap-y-2 text-sm"} font-semibold text-slate-300 ${className}`}>
      <AgeRatingBadge rating={rating} size={compact ? "sm" : "md"} />
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Clock3 className={compact ? "h-3.5 w-3.5 text-slate-500" : "h-4 w-4 text-slate-400"} aria-hidden="true" />
        <span>{duration}</span>
      </span>
      {genres.length > 0 && <span className="text-slate-400">{genres.slice(0, 3).join(" / ")}</span>}
    </div>
  );
}
