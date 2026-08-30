import type { AgeRating } from "@/types";

const ratingConfig: Record<AgeRating, { background: string; foreground: string; label: string; border?: string }> = {
  L: { background: "#00a651", foreground: "#ffffff", label: "Livre para todos os públicos" },
  "10": { background: "#00a7e1", foreground: "#ffffff", label: "Não recomendado para menores de 10 anos" },
  "12": { background: "#f5c400", foreground: "#111827", label: "Não recomendado para menores de 12 anos" },
  "14": { background: "#f58220", foreground: "#111827", label: "Não recomendado para menores de 14 anos" },
  "16": { background: "#e31b23", foreground: "#ffffff", label: "Não recomendado para menores de 16 anos" },
  "18": { background: "#111111", foreground: "#ffffff", label: "Não recomendado para menores de 18 anos", border: "rgba(255,255,255,.55)" },
};

export function AgeRatingBadge({ rating, size = "md", className = "" }: { rating: AgeRating; size?: "sm" | "md"; className?: string }) {
  const normalized = (ratingConfig[rating] ? rating : "L") as AgeRating;
  const config = ratingConfig[normalized];
  const dimensions = size === "sm" ? "h-6 min-w-6 px-1 text-[11px]" : "h-8 min-w-8 px-1.5 text-sm";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] border font-black leading-none shadow-[0_2px_5px_rgba(0,0,0,.28)] ${dimensions} ${className}`}
      style={{ backgroundColor: config.background, color: config.foreground, borderColor: config.border || config.background }}
      role="img"
      aria-label={`Classificação indicativa: ${config.label}`}
      title={config.label}
    >
      {normalized}
    </span>
  );
}

export function ageRatingLabel(rating: AgeRating) {
  return ratingConfig[rating]?.label || ratingConfig.L.label;
}
