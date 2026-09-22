const crypto = require("crypto");
const sharp = require("sharp");
const { LruTtlCache } = require("../engine/cache");

// Ratios describe protected zones, not free random coordinates. Each layout has its own hierarchy.
const DIRECTIONS = {
  "hero-left": {
    grid: "60-40",
    art: [0.015, 0.1, 0.56, 0.72],
    copy: [0.61, 0.17, 0.33, 0.55],
    align: "left",
    logo: [0.08, 0.845, 0.26, 0.095],
    slots: {
      subtitle: [0.61, 0.12, 0.33, 0.045],
      title: [0.61, 0.19, 0.33, 0.18],
      detail: [0.61, 0.4, 0.33, 0.19],
      description: [0.61, 0.62, 0.33, 0.105],
      cta: [0.61, 0.775, 0.33, 0.055],
    },
    footer: [0.39, 0.88, 0.54, 0.065],
  },
  "hero-right": {
    grid: "40-60",
    art: [0.43, 0.07, 0.55, 0.73],
    copy: [0.065, 0.12, 0.32, 0.58],
    align: "left",
    logo: [0.69, 0.83, 0.25, 0.105],
    slots: {
      subtitle: [0.065, 0.09, 0.32, 0.045],
      title: [0.065, 0.155, 0.32, 0.22],
      detail: [0.065, 0.415, 0.32, 0.16],
      description: [0.065, 0.61, 0.32, 0.11],
      cta: [0.065, 0.77, 0.43, 0.055],
    },
    footer: [0.065, 0.875, 0.53, 0.07],
  },
  "hero-center": {
    grid: "thirds",
    art: [0.18, 0.01, 0.64, 0.62],
    copy: [0.08, 0.65, 0.84, 0.2],
    align: "center",
    logo: [0.39, 0.88, 0.22, 0.08],
    slots: {
      subtitle: [0.07, 0.64, 0.86, 0.03],
      title: [0.07, 0.685, 0.86, 0.055],
      detail: [0.07, 0.76, 0.56, 0.085],
      description: [0.65, 0.755, 0.28, 0.045],
      cta: [0.65, 0.812, 0.28, 0.033],
    },
    footer: [0.07, 0.895, 0.26, 0.06],
  },
  "full-bleed": {
    grid: "thirds",
    art: [0, 0, 1, 0.7],
    copy: [0.07, 0.61, 0.69, 0.23],
    align: "left",
    logo: [0.73, 0.885, 0.2, 0.075],
    slots: {
      subtitle: [0.07, 0.585, 0.69, 0.04],
      title: [0.07, 0.64, 0.69, 0.085],
      detail: [0.07, 0.745, 0.56, 0.09],
      description: [0.66, 0.755, 0.27, 0.045],
      cta: [0.66, 0.815, 0.27, 0.035],
    },
    footer: [0.07, 0.89, 0.58, 0.065],
  },
  diagonal: {
    grid: "golden",
    art: [0.42, 0.035, 0.55, 0.65],
    copy: [0.065, 0.34, 0.33, 0.39],
    align: "left",
    logo: [0.69, 0.83, 0.24, 0.1],
    slots: {
      subtitle: [0.065, 0.285, 0.32, 0.045],
      title: [0.065, 0.355, 0.32, 0.19],
      detail: [0.065, 0.58, 0.32, 0.15],
      description: [0.45, 0.715, 0.47, 0.065],
      cta: [0.45, 0.795, 0.47, 0.045],
    },
    footer: [0.065, 0.88, 0.55, 0.065],
  },
  split: {
    grid: "40-60",
    art: [0.035, 0.055, 0.44, 0.68],
    copy: [0.53, 0.08, 0.4, 0.58],
    align: "left",
    logo: [0.7, 0.88, 0.23, 0.085],
    slots: {
      subtitle: [0.53, 0.075, 0.4, 0.05],
      title: [0.53, 0.16, 0.4, 0.23],
      detail: [0.07, 0.765, 0.56, 0.09],
      description: [0.53, 0.44, 0.4, 0.105],
      cta: [0.53, 0.6, 0.4, 0.055],
    },
    footer: [0.07, 0.89, 0.52, 0.065],
  },
  editorial: {
    grid: "golden",
    art: [0.055, 0.04, 0.55, 0.68],
    copy: [0.66, 0.17, 0.28, 0.55],
    align: "left",
    logo: [0.07, 0.82, 0.27, 0.1],
    slots: {
      subtitle: [0.66, 0.13, 0.28, 0.045],
      title: [0.66, 0.215, 0.28, 0.18],
      detail: [0.38, 0.77, 0.55, 0.1],
      description: [0.66, 0.46, 0.28, 0.13],
      cta: [0.66, 0.655, 0.28, 0.045],
    },
    footer: [0.39, 0.9, 0.54, 0.055],
  },
  "poster-dominant": {
    grid: "60-40",
    art: [0.08, 0, 0.9, 0.77],
    copy: [0.07, 0.77, 0.86, 0.1],
    align: "left",
    logo: [0.76, 0.9, 0.18, 0.065],
    slots: {
      subtitle: [0.07, 0.755, 0.3, 0.035],
      title: [0.07, 0.803, 0.42, 0.055],
      detail: [0.54, 0.8, 0.39, 0.065],
      description: [0.07, 0.87, 0.42, 0.025],
      cta: [0.54, 0.875, 0.39, 0.03],
    },
    footer: [0.07, 0.925, 0.6, 0.03],
  },
  "typography-dominant": {
    grid: "golden",
    art: [0.57, 0.04, 0.39, 0.47],
    copy: [0.065, 0.12, 0.46, 0.73],
    align: "left",
    logo: [0.72, 0.84, 0.22, 0.105],
    slots: {
      subtitle: [0.065, 0.1, 0.44, 0.055],
      title: [0.065, 0.2, 0.45, 0.17],
      detail: [0.065, 0.54, 0.86, 0.225],
      description: [0.59, 0.455, 0.34, 0.065],
      cta: [0.065, 0.8, 0.47, 0.055],
    },
    footer: [0.065, 0.91, 0.55, 0.045],
  },
};

const analysisCache = new LruTtlCache({ maxEntries: 40, ttlMs: 1200000 });
function seedValue(draft) {
  return (
    crypto
      .createHash("sha256")
      .update(
        `${draft.movieId || draft.title}:${draft.artDirection?.seed || 0}`,
      )
      .digest()
      .readUInt32LE(0) / 4294967296
  );
}

async function analyzeArtwork(buffer) {
  if (!buffer) return null;
  const key = crypto.createHash("sha256").update(buffer).digest("hex");
  return analysisCache.getOrLoad(key, async () => {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(96, 96, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const luminances = new Float32Array(96 * 96),
      edges = new Float32Array(96 * 96);
    for (let i = 0; i < luminances.length; i++)
      luminances[i] =
        (data[i * info.channels] * 0.2126 +
          data[i * info.channels + 1] * 0.7152 +
          data[i * info.channels + 2] * 0.0722) /
        255;
    for (let y = 1; y < 95; y++)
      for (let x = 1; x < 95; x++) {
        const i = y * 96 + x;
        edges[i] =
          Math.abs(luminances[i - 1] - luminances[i + 1]) +
          Math.abs(luminances[i - 96] - luminances[i + 96]);
      }
    const region = (x, y, w, h) => {
      let mean = 0,
        squared = 0,
        edge = 0,
        count = 0;
      for (
        let yy = Math.max(0, Math.floor(y * 96));
        yy < Math.min(96, Math.ceil((y + h) * 96));
        yy++
      )
        for (
          let xx = Math.max(0, Math.floor(x * 96));
          xx < Math.min(96, Math.ceil((x + w) * 96));
          xx++
        ) {
          const i = yy * 96 + xx,
            v = luminances[i];
          mean += v;
          squared += v * v;
          edge += edges[i];
          count++;
        }
      mean /= count || 1;
      return {
        luminance: mean,
        complexity:
          edge / (count || 1) +
          Math.sqrt(Math.max(0, squared / (count || 1) - mean * mean)),
      };
    };
    const zones = [
      { id: "left", rect: [0.04, 0.1, 0.36, 0.55] },
      { id: "right", rect: [0.6, 0.1, 0.36, 0.55] },
      { id: "bottom", rect: [0.06, 0.65, 0.88, 0.28] },
    ]
      .map((z) => ({ ...z, ...region(...z.rect) }))
      .sort((a, b) => a.complexity - b.complexity);
    let weight = 0,
      xSum = 0,
      ySum = 0;
    for (let y = 10; y < 81; y++)
      for (let x = 5; x < 91; x++) {
        const v = edges[y * 96 + x];
        weight += v;
        xSum += v * x;
        ySum += v * y;
      }
    return {
      zones,
      quietest: zones[0].id,
      focusX: weight ? (xSum / weight / 95) * 100 : 50,
      focusY: weight ? (ySum / weight / 95) * 100 : 45,
      method: "luminance-edge-density",
    };
  });
}

function selectDirection(draft, analysis) {
  if (draft.artDirection?.enabled === false || !draft.composition?.enabled)
    return draft.style;
  if (!draft.automaticStyle) return draft.style;
  const genre = draft.genreProfile?.id,
    choices =
      genre === "horror"
        ? ["hero-right", "full-bleed", "poster-dominant"]
        : genre === "family"
          ? ["hero-left", "poster-dominant", "split"]
          : genre === "action"
            ? ["diagonal", "hero-right", "typography-dominant"]
            : genre === "comedy"
              ? ["split", "hero-left", "editorial"]
              : ["editorial", "hero-left", "hero-right"];
  const chosen = choices[Math.floor(seedValue(draft) * choices.length)];
  if (chosen.startsWith("hero-") && analysis)
    return analysis.quietest === "left" ? "hero-right" : "hero-left";
  return chosen;
}

function directionPlan(draft, analysis, { fullBleed = false } = {}) {
  if (draft.artDirection?.enabled === false || !DIRECTIONS[draft.style])
    return null;
  const plan = JSON.parse(JSON.stringify(DIRECTIONS[draft.style]));
  const d = draft.artDirection || {},
    seed = seedValue(draft),
    jitter = (seed - 0.5) * 0.022;
  if (
    draft.style === "full-bleed" &&
    fullBleed &&
    analysis &&
    ((analysis.quietest === "left" && analysis.focusX > 62) ||
      (analysis.quietest === "right" && analysis.focusX < 38))
  ) {
    const right = analysis?.quietest === "right";
    const side = DIRECTIONS[right ? "hero-left" : "hero-right"];
    plan.slots = structuredClone(side.slots);
    plan.copy = [...side.copy];
    plan.logo = [...side.logo];
    plan.footer = [...side.footer];
  }
  const datePrimary = require("./hierarchy").campaignHierarchy(draft).primary === "detail";
  if (
    datePrimary &&
    ![
      "poster-dominant",
      "hero-center",
      "full-bleed",
      "split",
      "editorial",
      "typography-dominant",
    ].includes(draft.style)
  ) {
    const title = plan.slots.title,
      detail = plan.slots.detail;
    const total = title[3] + detail[3],
      newTitle = Math.min(title[3], total * 0.35);
    const delta = title[3] - newTitle;
    title[3] = newTitle;
    detail[1] -= delta;
    detail[3] += delta;
  }
  if (!datePrimary && draft.style === "typography-dominant") {
    const temp = plan.slots.detail;
    plan.slots.detail = plan.slots.title;
    plan.slots.title = temp;
  }
  const heroFocus = analysis
    ? {
        focusX: Math.round(analysis.focusX),
        focusY: Math.round(analysis.focusY),
      }
    : { focusX: 50, focusY: 42 };
  plan.framing = {
    background: {
      focusX: heroFocus.focusX > 50 ? 23 : 77,
      focusY: 30 + seed * 35,
      scale: 1.3 + seed * 0.18,
      ...d.background,
    },
    hero: { ...heroFocus, scale: 0.97 + seed * 0.03, ...d.hero },
  };
  if (fullBleed && analysis?.backgroundFrame)
    plan.framing.background = analysis.backgroundFrame;
  // Jitter is confined to the reserved artwork area; copy never drifts into the subject.
  plan.art[0] = Math.max(0, Math.min(1 - plan.art[2], plan.art[0] + jitter));
  plan.datePrimary = datePrimary;
  plan.grid = d.grid && d.grid !== "automatic" ? d.grid : plan.grid;
  if (
    ["hero-left", "hero-right"].includes(draft.style) &&
    d.grid &&
    d.grid !== "automatic"
  ) {
    const heroLeft = draft.style === "hero-left";
    const pivot = {
      thirds: heroLeft ? 2 / 3 : 1 / 3,
      golden: heroLeft ? 0.618 : 0.382,
      "40-60": 0.4,
      "60-40": 0.6,
    }[d.grid];
    const old = plan.copy.slice();
    plan.copy[0] = heroLeft ? pivot + 0.035 : 0.065;
    plan.copy[2] = heroLeft ? 0.94 - plan.copy[0] : pivot - 0.105;
    for (const key of ["subtitle", "title", "detail", "description", "cta"]) {
      const slot = plan.slots[key];
      slot[0] = plan.copy[0] + ((slot[0] - old[0]) / old[2]) * plan.copy[2];
      slot[2] = Math.min(plan.copy[2], (slot[2] / old[2]) * plan.copy[2]);
    }
    plan.art[0] = heroLeft ? 0.015 : pivot + 0.035;
    plan.art[2] = heroLeft ? pivot - 0.045 : 0.98 - plan.art[0];
  }
  plan.heroMode = d.heroMode || "edge-dissolve";
  for (const key of ["subtitle", "title", "detail", "description", "cta"]) plan.slots[key][1] += jitter * .18;
  plan.glowScale = 0.85 + seed * 0.3;
  return plan;
}

module.exports = {
  DIRECTIONS,
  analyzeArtwork,
  selectDirection,
  directionPlan,
  seedValue,
};
