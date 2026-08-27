import { Movie } from "@/types";

type MovieTagBadgeProps = {
  tag?: Movie["tag"];
  className?: string;
};

const tagStyles: Record<string, string> = {
  estreia: "bg-gold-400 text-slate-950",
  "ultimos dias": "bg-rose-500 text-white",
  "destaque da semana": "bg-brand-600 text-white",
  "em breve": "bg-sky-400 text-sky-950",
  "sessao familia": "bg-emerald-400 text-emerald-950",
};

function normalizeTag(tag: string) {
  return tag
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function MovieTagBadge({ tag, className = "" }: MovieTagBadgeProps) {
  if (!tag) return null;

  const color = tagStyles[normalizeTag(tag)] || "bg-slate-200 text-slate-950";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-[11px] font-black uppercase leading-none tracking-wide shadow-[0_6px_18px_rgba(0,0,0,.24)] ${color} ${className}`}
    >
      {tag}
    </span>
  );
}
