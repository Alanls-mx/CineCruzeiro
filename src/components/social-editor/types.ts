export type SceneElementType = "text" | "image" | "shape" | "gradient" | "group";

export type GradientStop = { offset: number; color: string };

export type SceneElement = {
  id: string;
  name: string;
  role: string;
  type: SceneElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  protected: boolean;
  required: boolean;
  text?: string;
  fontFamily?: "Social Display" | "Social Text";
  fontSize?: number;
  fontWeight?: number;
  fill?: string;
  align?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  uppercase?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  src?: string;
  fit?: "cover" | "contain";
  focusX?: number;
  focusY?: number;
  crop?: { x: number; y: number; width: number; height: number } | null;
  keepRatio?: boolean;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  direction?: "bottom" | "top" | "left" | "right";
  stops?: GradientStop[];
  children?: SceneElement[];
};

export type SocialScene = {
  version: number;
  id: string;
  templateId: string;
  formatId: "feed_portrait" | "square" | "story";
  width: number;
  height: number;
  backgroundColor: string;
  elements: SceneElement[];
  sourceDraft: Record<string, unknown>;
  createdAt: string;
  rendererVersion: string;
};

export type SocialPostSummary = {
  id: string;
  title: string;
  templateName: string;
  formatName: string;
  outputType: "png" | "jpg";
  activeVersion?: string;
  imageUrl?: string;
  originalImageUrl?: string;
  hasEditedScene?: boolean;
  hasDraftScene?: boolean;
};

export type SceneResponse = {
  editable: boolean;
  post: SocialPostSummary;
  originalScene: SocialScene;
  editedScene: SocialScene | null;
  draftScene: SocialScene | null;
  scene: SocialScene;
};
