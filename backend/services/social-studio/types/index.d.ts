export type SocialFormatId = "feed_portrait" | "square" | "story";
export type SocialVariantId = "cinematic" | "impact" | "clean" | "minimal";

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
