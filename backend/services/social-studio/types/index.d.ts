export type SocialFormatId = "feed_portrait" | "square" | "story";
export type SocialVisualStyle = "cinematic" | "impact" | "clean" | "minimal";
export type SocialLayoutId = "hero-left" | "hero-right" | "hero-center" | "full-bleed" | "editorial" | "poster-dominant" | "typography-dominant" | "split" | "diagonal";
export type SocialLook = "natural" | "cinematic" | "immersive" | "dramatic" | "vibrant";
/** Compatibility only: new drafts use visualStyle, layoutId and look separately. */
export type SocialVariantId = SocialVisualStyle | SocialLayoutId | "immersive" | "poster-blend" | "hero-cinematic" | "split-cinematic";
export type SocialCampaignType = "movie-premiere" | "movie-highlight" | "movie-price" | "movie-presale" | "online-ticket" | "concession-combo" | "club-plan" | "sessions-today" | "sessions-week" | "multi-movies";
export interface SessionContent { movieId: string; date: string; time: string }
export interface ProgramMovieContent { id: string; title: string; posterUrl: string; backdropUrl?: string; featured?: boolean; schedule: { from: string; until: string; count: number; text: string; days: {date: string; times: string[]}[] } }
export interface CampaignContent {
  version: 1;
  campaignType: SocialCampaignType;
  movie?: {id: string; title: string; genres: string[]; synopsis?: string; socialHook?: string};
  headline: string; kicker: string; supportingText: string;
  releaseDate: string; presaleStartDate: string; sessionDate: string;
  primaryDateKind: "release" | "presale" | "session";
  primaryDate: string; primaryDateLabel: string;
  sessions: SessionContent[]; availableSessions: SessionContent[];
  price: {value?: number; formatted: string};
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
