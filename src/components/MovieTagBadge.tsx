import { Movie } from "@/types";
import { isVisibleMovieTag, normalizeMovieTag } from "@/utils/movieTags";

type MovieTagBadgeProps = {
  tag?: Movie["tag"];
  className?: string;
};

const tagStyles: Record<string, string> = {
  "pre-estreia": "bg-cyan-400 text-cyan-950",
  estreia: "bg-gold-400 text-slate-950",
  "ultimos dias": "bg-rose-500 text-white",
  "destaque da semana": "bg-brand-600 text-white",
  "em breve": "bg-sky-400 text-sky-950",
  "sessao familia": "bg-emerald-400 text-emerald-950",
  "sessao especial": "bg-fuchsia-400 text-fuchsia-950",
  classico: "bg-amber-300 text-amber-950",
  reexibicao: "bg-teal-300 text-teal-950",
};

export function MovieTagBadge({ tag, className = "" }: MovieTagBadgeProps) {
  if (!isVisibleMovieTag(tag)) return null;

  const color = tagStyles[normalizeMovieTag(tag)] || "bg-slate-200 text-slate-950";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-[11px] font-black uppercase leading-none tracking-wide shadow-[0_6px_18px_rgba(0,0,0,.24)] ${color} ${className}`}
    >
      {tag}
    </span>
  );
}
