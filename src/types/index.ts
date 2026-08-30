export type AgeRating = "L" | "10" | "12" | "14" | "16" | "18";

export interface Session {
  id: string;
  date?: string;
  time: string; // e.g. "16:30", "19:00", "21:30"
  format: "2D Dublado" | "2D Legendado" | "3D Dublado" | "3D Legendado";
  room: string; // "Sala Cruzeiro (Única)"
  ticketTypeIds?: string[];
  priceFull: number; // e.g. 10.00
  priceHalf: number; // e.g. 10.00
  status: "available" | "filling_fast" | "sold_out";
}

export interface Movie {
  id: string;
  slug?: string;
  sortOrder?: number;
  status?: "now_playing" | "upcoming" | "hidden";
  title: string;
  originalTitle?: string;
  synopsis: string;
  duration: string; // e.g. "2h 15m"
  genre: string[];
  rating: AgeRating;
  posterUrl: string;
  backdropUrl: string;
  trailerYoutubeId?: string;
  trailerVideoUrl?: string;
  localTrailerUrl?: string;
  trailerSourceUrl?: string;
  trailerCacheStatus?: "idle" | "cached" | "failed";
  trailerCachedAt?: string;
  trailerCacheError?: string;
  isHighlight?: boolean;
  highlightTrailerBackground?: boolean;
  releaseDate?: string;
  autoPublish?: boolean;
  publishedAt?: string;
  tag?: "Pré-Estreia" | "Estreia" | "Destaque da Semana" | "Últimos Dias" | "Em Breve" | "Sessão Família";
  sessions: Session[];
}

export interface ConcessionItem {
  id: string;
  sku?: string;
  name: string;
  description: string;
  imageUrl?: string;
  badge?: string;
  price: number;
  compareAt?: number | "";
  category?: "combo" | "pipoca" | "bebida" | "doce" | "promocao" | "outro";
  stock?: number | "";
  maxPerOrder?: number;
  featured?: boolean;
  sortOrder?: number;
  tags?: string[];
  comboItems?: Array<{
    name: string;
    quantity: number;
  }>;
  active: boolean;
}

export interface TicketOrder {
  id?: string;
  idempotencyKey?: string;
  movieId: string;
  movieTitle?: string;
  sessionId: string;
  sessionTime?: string;
  sessionFormat?: string;
  sessionDate?: string;
  fullTicketsCount: number;
  halfTicketsCount: number;
  ticketItems?: Array<{
    id: string;
    name?: string;
    description?: string;
    quantity: number;
    bundleQuantity?: number;
    ticketQuantity?: number;
    unitPrice?: number;
  }>;
  selectedSeatIds?: string[];
  seatHoldToken?: string;
  selectedSeats?: Array<{
    id: string;
    label: string;
    rowLabel?: string;
    typeId?: string;
    typeName?: string;
  }>;
  seatSelectionEnabled?: boolean;
  seatDisplay?: string;
  includeComboUpsell?: boolean;
  comboUpsellQuantity?: number;
  concessionItems?: Array<{
    id: string;
    sku?: string;
    name?: string;
    category?: string;
    imageUrl?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  couponCode?: string;
  discountValue?: number;
  useClubCredits?: boolean;
  useClubBenefits?: boolean;
  clubSubscriptionId?: string;
  clubCreditQuantity?: number;
  totalPrice?: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCpf?: string;
  paymentMethod: "PIX" | "CREDIT_CARD" | "CLUB_CREDIT";
  paymentProvider?: "open_finance" | "mercado_pago" | "internal_club";
  paymentId?: string;
  paymentStatus?: string;
  pixCode?: string;
  pixQrCodeBase64?: string;
  pixTicketUrl?: string;
  createdAt: string;
}

export interface ClubLead {
  name: string;
  phone: string;
  favoriteGenre?: string;
  source: "landing_page_club";
  createdAt: string;
}

export interface PrivateEventRequest {
  name: string;
  phone: string;
  email: string;
  eventType: "aniversario" | "videogame" | "filme_classico" | "corporativo" | "outro";
  desiredDate: string;
  estimatedGuests: string;
  notes?: string;
  website?: string;
  source: "landing_page_feche_o_cinema";
  createdAt: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  orderId?: string;
}
