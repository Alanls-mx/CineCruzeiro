const crypto = require("crypto");
const { clamp } = require("../engine/typography");
const { normalizeEffects, normalizeMotion } = require("../composition-engine/config");

const SCENE_VERSION = 1;
const MAX_ELEMENTS = 80;
const ALLOWED_TYPES = new Set(["text", "image", "shape", "gradient", "group"]);
const ALLOWED_FONTS = new Set(["Social Display", "Social Text"]);
const ALLOWED_ALIGNS = new Set(["left", "center", "right"]);
const COLOR_PATTERN = /^(?:#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeColor(value, fallback = "#ffffff") {
  const candidate = String(value || "").trim();
  return COLOR_PATTERN.test(candidate) ? candidate : fallback;
}

function safeId(value, prefix = "element") {
  const normalized = String(value || "").trim().replace(/[^a-z0-9_-]/gi, "-").slice(0, 72);
  return normalized || prefix + "-" + crypto.randomBytes(4).toString("hex");
}

function safeText(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit);
}

function bounds(element, scene) {
  const width = clamp(finite(element.width, 120), 8, scene.width * 2);
  const height = clamp(finite(element.height, 40), 4, scene.height * 2);
  return {
    x: clamp(finite(element.x, 0), -width * 0.9, scene.width - width * 0.1),
    y: clamp(finite(element.y, 0), -height * 0.9, scene.height - height * 0.1),
    width,
    height
  };
}

function normalizeCrop(crop = {}) {
  if (!crop || typeof crop !== "object") return null;
  const width = finite(crop.width, 0);
  const height = finite(crop.height, 0);
  if (width <= 0 || height <= 0) return null;
  return {
    x: Math.max(0, finite(crop.x, 0)),
    y: Math.max(0, finite(crop.y, 0)),
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

function baseElement(input, scene) {
  const box = bounds(input, scene);
  return {
    id: safeId(input.id),
    name: safeText(input.name || input.id || "Elemento", 80),
    role: safeId(input.role || input.id || "element"),
    type: String(input.type || ""),
    ...box,
    rotation: clamp(finite(input.rotation, 0), -180, 180),
    opacity: clamp(finite(input.opacity, 1), 0, 1),
    visible: input.visible !== false,
    locked: input.locked === true,
    protected: input.protected === true,
    required: input.required === true,
    hierarchy: ["primary", "secondary", "tertiary", "branding"].includes(input.hierarchy) ? input.hierarchy : "tertiary"
  };
}

function normalizeElement(input, scene, depth = 0) {
  if (!input || typeof input !== "object" || !ALLOWED_TYPES.has(input.type)) return null;
  if (depth > 2) return null;
  const base = baseElement(input, scene);
  if (input.type === "text") {
    return {
      ...base,
      type: "text",
      text: safeText(input.text, 900),
      fontFamily: ALLOWED_FONTS.has(input.fontFamily) ? input.fontFamily : "Social Text",
      fontSize: clamp(finite(input.fontSize, 42), 12, 320),
      fontWeight: clamp(finite(input.fontWeight, 600), 300, 900),
      fill: safeColor(input.fill, "#ffffff"),
      align: ALLOWED_ALIGNS.has(input.align) ? input.align : "left",
      letterSpacing: clamp(finite(input.letterSpacing, 0), 0, 30),
      lineHeight: clamp(finite(input.lineHeight, 1), 0.75, 2),
      uppercase: input.uppercase === true,
      shadowColor: safeColor(input.shadowColor, "rgba(0,0,0,0)"),
      shadowBlur: clamp(finite(input.shadowBlur, 0), 0, 60),
      contrastRatio: clamp(finite(input.contrastRatio, 0), 0, 21)
    };
  }
  if (input.type === "image") {
    return {
      ...base,
      type: "image",
      src: safeText(input.src, 2000),
      fit: input.fit === "contain" ? "contain" : "cover",
      focusX: clamp(finite(input.focusX, 50), 0, 100),
      focusY: clamp(finite(input.focusY, 50), 0, 100),
      crop: normalizeCrop(input.crop),
      ...(input.effects && typeof input.effects === "object" ? { effects: normalizeEffects(input.effects) } : {}),
      keepRatio: input.keepRatio !== false
    };
  }
  if (input.type === "shape") {
    return {
      ...base,
      type: "shape",
      ...(Array.isArray(input.points) && input.points.length>=6 && input.points.length%2===0 && input.points.every(Number.isFinite) ? {points:input.points.slice(0,128).map(value=>clamp(value,0,1))} : {}),
      fill: safeColor(input.fill, "#ffffff"),
      stroke: safeColor(input.stroke, "rgba(0,0,0,0)"),
      strokeWidth: clamp(finite(input.strokeWidth, 0), 0, 30),
      radius: clamp(finite(input.radius, 0), 0, Math.min(base.width, base.height) / 2)
    };
  }
  if (input.type === "gradient") {
    const stops = (Array.isArray(input.stops) ? input.stops : []).slice(0, 6).map((stop) => ({
      offset: clamp(finite(stop?.offset, 0), 0, 1),
      color: safeColor(stop?.color, "#000000")
    })).sort((a, b) => a.offset - b.offset);
    return {
      ...base,
      type: "gradient",
      direction: ["bottom", "top", "left", "right"].includes(input.direction) ? input.direction : "bottom",
      stops: stops.length >= 2 ? stops : [
        { offset: 0, color: "rgba(0,0,0,0)" },
        { offset: 1, color: "#02050a" }
      ]
    };
  }
  const children = (Array.isArray(input.children) ? input.children : [])
    .slice(0, 12)
    .map((child) => normalizeElement(child, { width: base.width, height: base.height }, depth + 1))
    .filter(Boolean);
  return { ...base, type: "group", children };
}

function normalizeScene(input = {}) {
  const width = clamp(finite(input.width, 1080), 320, 2160);
  const height = clamp(finite(input.height, 1350), 320, 3840);
  const shell = { width, height };
  const elements = (Array.isArray(input.elements) ? input.elements : [])
    .slice(0, MAX_ELEMENTS)
    .map((element) => normalizeElement(element, shell))
    .filter(Boolean);
  return {
    version: SCENE_VERSION,
    id: safeId(input.id, "scene"),
    templateId: safeId(input.templateId || "movie-premiere", "template"),
    formatId: ["feed_portrait", "square", "story"].includes(input.formatId) ? input.formatId : "feed_portrait",
    width,
    height,
    backgroundColor: safeColor(input.backgroundColor, "#050b16"),
    motion: normalizeMotion(input.motion),
    elements,
    sourceDraft: input.sourceDraft && typeof input.sourceDraft === "object" ? JSON.parse(JSON.stringify(input.sourceDraft)) : {},
    createdAt: String(input.createdAt || new Date().toISOString()),
    rendererVersion: "v2-konva"
  };
}

module.exports = {
  ALLOWED_FONTS,
  MAX_ELEMENTS,
  SCENE_VERSION,
  normalizeElement,
  normalizeScene,
  safeColor
};
