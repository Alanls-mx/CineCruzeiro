const number = (value, fallback, min, max) =>
  Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Number(value)))
    : fallback;
const MASKS = [
  "none",
  "fade-bottom",
  "fade-top",
  "fade-left",
  "fade-right",
  "fade-all",
  "radial",
  "cinematic-bottom",
];
const OVERLAYS = ["none", "fog", "dust", "light-leak", "gradient-light"];
const PRESETS = {
  neutral: {
    name: "Neutro",
    blur: 48,
    brightness: 0.65,
    saturation: 0.95,
    contrast: 1.05,
    vignette: 25,
    grain: 1,
    glow: 10,
    blend: 62,
    colorWash: 12,
    overlay: "none",
  },
  horror: {
    name: "Terror",
    blur: 55,
    brightness: 0.48,
    saturation: 0.72,
    contrast: 1.14,
    vignette: 48,
    grain: 3,
    glow: 5,
    blend: 74,
    colorWash: 15,
    overlay: "fog",
  },
  action: {
    name: "Ação",
    blur: 42,
    brightness: 0.6,
    saturation: 1.1,
    contrast: 1.16,
    vignette: 32,
    grain: 2,
    glow: 14,
    blend: 63,
    colorWash: 12,
    overlay: "gradient-light",
  },
  animation: {
    name: "Animação",
    blur: 45,
    brightness: 0.82,
    saturation: 1.18,
    contrast: 1.03,
    vignette: 12,
    grain: 0,
    glow: 16,
    blend: 60,
    colorWash: 8,
    overlay: "none",
  },
  drama: {
    name: "Drama",
    blur: 58,
    brightness: 0.65,
    saturation: 0.83,
    contrast: 1.06,
    vignette: 28,
    grain: 2,
    glow: 5,
    blend: 70,
    colorWash: 10,
    overlay: "none",
  },
  romance: {
    name: "Romance",
    blur: 62,
    brightness: 0.78,
    saturation: 0.95,
    contrast: 1.02,
    vignette: 16,
    grain: 1,
    glow: 12,
    blend: 70,
    colorWash: 10,
    overlay: "light-leak",
  },
  fantasy: {
    name: "Fantasia",
    blur: 50,
    brightness: 0.65,
    saturation: 1.1,
    contrast: 1.08,
    vignette: 25,
    grain: 1,
    glow: 20,
    blend: 70,
    colorWash: 16,
    overlay: "dust",
  },
};
const LOOKS = {
  natural: {
    name: "Natural",
    blur: 32,
    saturation: 1,
    contrast: 1,
    glow: 0,
    grain: 0,
    blend: 35,
  },
  cinematic: { name: "Cinematográfico" },
  immersive: { name: "Imersivo", blur: 65, blend: 85, glow: 15 },
  dramatic: {
    name: "Dramático",
    brightness: 0.48,
    contrast: 1.2,
    vignette: 48,
    blend: 72,
  },
  vibrant: {
    name: "Vibrante",
    brightness: 0.83,
    saturation: 1.25,
    vignette: 14,
    glow: 16,
  },
};
const STYLES = [
  ["immersive", "Imersivo"],
  ["poster-blend", "Pôster integrado"],
  ["hero-cinematic", "Hero cinematográfico"],
  ["split-cinematic", "Cinema lateral"],
  ["full-bleed", "Imagem inteira"],
  ["editorial", "Editorial imersivo"],
  ["hero-left", "Hero à esquerda"],
  ["hero-right", "Hero à direita"],
  ["hero-center", "Hero central"],
  ["diagonal", "Diagonal"],
  ["split", "Dividido"],
  ["poster-dominant", "Filme dominante"],
  ["typography-dominant", "Tipografia dominante"],
].map(([id, name]) => ({ id, name }));

function normalizeEffects(value = {}) {
  const v = value && typeof value === "object" ? value : {};
  return {
    layer: [
      "image",
      "background",
      "wash",
      "glow",
      "ambient-shadow",
      "contact-shadow",
      "atmosphere",
      "vignette",
      "contrast",
    ].includes(v.layer)
      ? v.layer
      : "image",
    blur: number(v.blur, 0, 0, 80),
    brightness: number(v.brightness, 1, 0.2, 1.5),
    saturation: number(v.saturation, 1, 0, 1.8),
    contrast: number(v.contrast, 1, 0.5, 1.6),
    vignette: number(v.vignette, 0, 0, 80),
    grain: number(v.grain, 0, 0, 8),
    glow: number(v.glow, 0, 0, 40),
    shadow: number(v.shadow, 0, 0, 60),
    blend: number(v.blend, 0, 0, 100),
    colorWash: number(v.colorWash, 0, 0, 35),
    color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : "#609edb",
    mask: MASKS.includes(v.mask) ? v.mask : "fade-all",
    overlay: OVERLAYS.includes(v.overlay) ? v.overlay : "none",
    scale: number(v.scale, 1, 0.7, 1.5),
    cropLeft: number(v.cropLeft, 0, 0, 40),
    cropRight: number(v.cropRight, 0, 0, 40),
    cropTop: number(v.cropTop, 0, 0, 40),
    cropBottom: number(v.cropBottom, 0, 0, 40),
    featherX: number(v.featherX, 0.2, 0.01, 0.45),
    featherY: number(v.featherY, 0.2, 0.01, 0.45),
  };
}

function normalizeComposition(value = {}, genre = "neutral") {
  const v = value && typeof value === "object" ? value : {};
  const inferred =
    genre === "family" ? "animation" : PRESETS[genre] ? genre : "neutral";
  const preset = PRESETS[v.preset] ? v.preset : "automatic";
  const look = LOOKS[v.look] ? v.look : "cinematic";
  const defaults = {
    ...PRESETS[preset === "automatic" ? inferred : preset],
    ...LOOKS[look],
  };
  // Only explicit overrides are stored separately, so automatic genre changes remain automatic.
  const overrides =
    v.adjustments && typeof v.adjustments === "object" ? v.adjustments : {};
  const effects = normalizeEffects({
    ...defaults,
    ...overrides,
    layer: "background",
    mask: overrides.mask || "cinematic-bottom",
    scale: 1.28,
  });
  return {
    enabled: v.enabled !== false,
    preset,
    resolvedPreset: preset === "automatic" ? inferred : preset,
    look,
    adjustments: Object.fromEntries(
      Object.keys(overrides)
        .filter((key) => key in effects)
        .map((key) => [key, effects[key]]),
    ),
    ...effects,
  };
}

function normalizeMotion(value = {}) {
  const v = value && typeof value === "object" ? value : {};
  return {
    animationPreset: ["slow-zoom", "pan-zoom", "reveal"].includes(
      v.animationPreset,
    )
      ? v.animationPreset
      : "slow-zoom",
    duration: [5, 8, 10].includes(Number(v.duration)) ? Number(v.duration) : 8,
    easing: "ease-in-out",
  };
}

function normalizeDirection(value = {}) {
  const v = value && typeof value === "object" ? value : {};
  const frame = (input) => {
    const f = input && typeof input === "object" ? input : {};
    return Object.fromEntries(
      [
        "focusX",
        "focusY",
        "scale",
        "cropLeft",
        "cropRight",
        "cropTop",
        "cropBottom",
      ]
        .filter((key) => f[key] !== undefined)
        .map((key) => [
          key,
          number(
            f[key],
            key === "scale" ? 1 : 0,
            key === "scale" ? 0.7 : 0,
            key === "scale" ? 1.5 : key.startsWith("crop") ? 40 : 100,
          ),
        ]),
    );
  };
  return {
    enabled: v.enabled !== false,
    heroMode: [
      "rectangle",
      "soft-rectangle",
      "edge-dissolve",
      "full-blend",
      "floating",
    ].includes(v.heroMode)
      ? v.heroMode
      : "edge-dissolve",
    grid: ["thirds", "golden", "40-60", "60-40"].includes(v.grid)
      ? v.grid
      : "automatic",
    emphasis: ["film", "date"].includes(v.emphasis) ? v.emphasis : "automatic",
    seed: Math.round(number(v.seed, 0, 0, 9999)),
    background: frame(v.background),
    hero: frame(v.hero),
    secondary: v.secondary === true,
    foreground: OVERLAYS.includes(v.foreground) ? v.foreground : "none",
    shadow: number(v.shadow, 25, 0, 60),
  };
}

module.exports = {
  normalizeEffects,
  normalizeComposition,
  normalizeMotion,
  normalizeDirection,
  MASKS,
  OVERLAYS,
  PRESETS,
  LOOKS,
  STYLES,
};
