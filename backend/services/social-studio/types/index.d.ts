export type SocialFormatId = "feed_portrait" | "square" | "story";
export type SocialVisualStyle = "cinematic" | "impact" | "clean" | "minimal";
export type SocialLayoutId = "hero-left" | "hero-right" | "hero-center" | "full-bleed" | "editorial" | "poster-dominant" | "typography-dominant" | "split" | "diagonal";
export type SocialLook = "natural" | "cinematic" | "immersive" | "dramatic" | "vibrant";
/** Compatibility only: new drafts use visualStyle, layoutId and look separately. */
export type SocialVariantId = SocialVisualStyle | SocialLayoutId | "immersive" | "poster-blend" | "hero-cinematic" | "split-cinematic";
export type SocialCampaignType = "movie-premiere" | "movie-highlight" | "movie-price" | "movie-presale" | "ticket-offer" | "online-ticket" | "concession-combo" | "concession-offer" | "club-plan" | "sessions-today" | "sessions-week" | "multi-movies";
export interface SessionContent { movieId: string; date: string; time: string }
export interface PriceSelection { mode: 'ticket-type' | 'minimum' | 'manual' | 'legacy'; ticketTypeId?: string; sessionId?: string; value?: number; formatted?: string }
export type ArtworkStrategy = 'automatic' | 'FULL_POSTER' | 'CROPPED_POSTER' | 'BACKDROP_HERO' | 'LOGO_DOMINANT' | 'SYMBOL_DOMINANT' | 'CHARACTER_DOMINANT' | 'POSTER_BLEND' | 'FULL_BLEED';
export interface ArtworkMetadata { sourceUrl?: string; containsTitle?: boolean; containsMovieLogo?: boolean; containsReleaseDate?: boolean; containsBillingBlock?: boolean; dominantAsset?: 'logo' | 'symbol' | 'character' | 'poster'; embeddedReleaseDate?: string; releaseDateVerified?: boolean; contentBounds?: {x:number;y:number;width:number;height:number} }
export interface ArtworkDirection { artworkStrategy: ArtworkStrategy; artworkMetadata: ArtworkMetadata; primaryElement: 'artwork' | 'movieLogo' | 'symbol' | 'title' | 'date' | 'price' | 'sessions'; brandProminence: 'subtle' | 'normal' | 'strong'; signatureScale: number; signatureScaleMode: 'automatic' | 'manual'; priceSelection?: PriceSelection }
export interface ProgramMovieContent { id: string; title: string; posterUrl: string; backdropUrl?: string; featured?: boolean; schedule: { from: string; until: string; count: number; text: string; days: {date: string; times: string[]}[] } }
export interface CampaignContent {
  version: 1;
  campaignType: SocialCampaignType;
  copyBrief?: string;
  offerTerms?: string;
  offerHeadline?: string;
  movie?: {id: string; title: string; genres: string[]; synopsis?: string; socialHook?: string; director?: string; originalTitle?: string; duration?: string; rating?: string; tag?: string};
  headline: string; kicker: string; supportingText: string;
  releaseDate: string; presaleStartDate: string; sessionDate: string;
  primaryDateKind: "release" | "presale" | "session";
  primaryDate: string; primaryDateLabel: string;
  sessions: SessionContent[]; availableSessions: SessionContent[];
  price: {value?: number; formatted: string; label?: string; ticketType?: string; mode?: PriceSelection['mode']; from?: boolean; valid?: boolean};
  releaseScope: 'international' | 'cinema';
  action: {label: string; destinationType: "website" | "sessions" | "purchase" | "club" | "none"; destination: string};
  brandWebsite: string; purchaseAvailable: boolean; today: string;
  programMovies: ProgramMovieContent[]; period: {from: string; until: string};
}
export interface MotionSpec {
  version: 1; preset: string; duration: number; loop: boolean; wordCount: number; readableFrom: number;
  tracks: {id: string; role: string; start: number; end: number; fade: number; zoom: number}[];
}
export interface CopyBundle { headline: string; kicker: string; supportingText: string; detail: string; cta: string; destinationText: string; caption: string }
export interface CopyProvider { generate(context: CampaignContent, options?: {tone?: string; density?: "short" | "medium" | "long"; seed?: number}): {id: string; bundle: CopyBundle; score: number}[] }

export interface SocialTemplateDefinition {
  id: string;
  name: string;
  type: "movie" | "concession" | "club" | "institutional";
  category: string;
  formats: SocialFormatId[];
  variants: SocialVariantId[];
  fields: string[];
  requirements: Record<string, boolean>;
  render: (props: SocialRenderProps) => unknown;
}

export interface SocialRenderProps {
  draft: Record<string, unknown>;
  format: { id: SocialFormatId; width: number; height: number };
  palette: Record<string, string>;
  brand: Record<string, string>;
  assets: { artwork: string; logo: string };
}

export interface GenerateSocialCampaignInput {
  template: string;
  subject: Record<string, unknown>;
  formats?: SocialFormatId[];
  cinema?: Record<string, string>;
}
