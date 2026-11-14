import type { CinemaContent } from "@/services/cinemaApi";

const ARTWORKS = [
  { id: "combo-classico", name: "Combo Clássico", price: 25, file: "combo-classico.webp" },
  { id: "pipoca-grande", name: "Pipoca Grande", price: 18, file: "pipoca-grande.webp" },
  { id: "combo-familia", name: "Combo Família", price: 42, file: "combo-familia.webp" },
  { id: "nachos-queijo", name: "Nachos com Queijo", price: 17, file: "nachos-queijo.webp" },
] as const;

export type ConcessionCampaignSlide = (typeof ARTWORKS)[number] & {
  description?: string;
  imageUrl?: string;
  badge?: string;
  savings?: number;
  offerEndsAt?: string;
};

export function concessionCampaignSlides(content: CinemaContent): ConcessionCampaignSlide[] {
  return ARTWORKS.flatMap((art) => {
    const product = content.concessions.find((item) => item.id === art.id && item.active !== false && Number(item.price) === art.price);
    if (!product) return [];
    const compareAt = Number(product.compareAt || 0);
    const savings = compareAt > product.price ? compareAt - product.price : undefined;
    const offer = content.promotions.find((item) => item.active !== false && !item.couponCode && String(item.concessionId || item.productId || "") === product.id);
    return [{
      ...art,
      description: product.description,
      imageUrl: product.imageUrl,
      badge: product.badge,
      savings,
      offerEndsAt: typeof offer?.endsAt === "string" ? offer.endsAt : undefined,
    }];
  });
}
