const crypto = require("crypto");
const sharp = require("sharp");
const { LruTtlCache } = require("./cache");

const paletteCache = new LruTtlCache({ maxEntries: 96, ttlMs: 60 * 60 * 1000 });

const PALETTES = Object.freeze([
  { id: "automatic", name: "Do filme", colors: ["#151a22", "#ffffff", "#8497ab"] },
  { id: "arctic", name: "Gelo", colors: ["#101822", "#2867a1", "#80caff"] },
  { id: "ruby", name: "Rubi", colors: ["#211116", "#9c243c", "#ff7287"] },
  { id: "jade", name: "Jade", colors: ["#0d201c", "#18765e", "#70e1b9"] },
  { id: "amber", name: "Ouro", colors: ["#201b11", "#b27b20", "#ffd36a"] },
  { id: "mono", name: "Prata", colors: ["#171719", "#717780", "#e8ecf1"] }
]);

function applyPalette(palette, id) {
  const preset = PALETTES.find((item) => item.id === id && id !== "automatic");
  return preset ? { dominantColor: preset.colors[0], secondaryColor: preset.colors[1], accentColor: preset.colors[2], textColor: "#ffffff" } : palette;
}

function safeHex(value, fallback = "#0a1220") {
  const candidate = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function hexToRgb(value) {
  const hex = safeHex(value, "#000000").slice(1);
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a, b, ratio = 0.5) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex({
    r: left.r + (right.r - left.r) * ratio,
    g: left.g + (right.g - left.g) * ratio,
    b: left.b + (right.b - left.b) * ratio
  });
}

function blendProgramPalettes(featured, others = []) {
  if (!others.length) return featured;
  let dominantColor = featured.dominantColor;
  for (const palette of others.slice(0, 2)) dominantColor = mix(dominantColor, palette.dominantColor, .22);
  const secondaryColor = others.length > 1
    ? mix(others[0].secondaryColor, others[1].secondaryColor, .5)
    : others[0].secondaryColor;
  return {...featured, dominantColor, secondaryColor};
}

function distance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function saturation({ r, g, b }) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function imagePaletteKey(buffer, brand) {
  const hash = crypto.createHash("sha1").update(buffer).digest("hex");
  return `${hash}:${brand.primaryColor}:${brand.secondaryColor}:${brand.accentColor}`;
}

async function extractPalette(buffer, brand = {}) {
  const fallback = {
    dominantColor: safeHex(brand.primaryColor, "#07111f"),
    secondaryColor: safeHex(brand.secondaryColor, "#1d4ed8"),
    accentColor: safeHex(brand.accentColor, "#facc15"),
    textColor: safeHex(brand.textColor, "#ffffff")
  };
  if (!Buffer.isBuffer(buffer) || !buffer.length) return fallback;
  return paletteCache.getOrLoad(imagePaletteKey(buffer, fallback), async () => {
    const { data, info } = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize(56, 56, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const buckets = new Map();
    for (let index = 0; index < data.length; index += info.channels) {
      const color = { r: data[index], g: data[index + 1], b: data[index + 2] };
      const brightness = (color.r + color.g + color.b) / 3;
      if (brightness < 18 || brightness > 242) continue;
      const key = `${color.r >> 4},${color.g >> 4},${color.b >> 4}`;
      const current = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      current.count += 1;
      current.r += color.r;
      current.g += color.g;
      current.b += color.b;
      buckets.set(key, current);
    }
    const colors = [...buckets.values()]
      .map((entry) => ({
        count: entry.count,
        color: { r: entry.r / entry.count, g: entry.g / entry.count, b: entry.b / entry.count }
      }))
      .sort((a, b) => b.count - a.count);
    const dominant = colors[0]?.color || hexToRgb(fallback.dominantColor);
    const secondary = colors.find((entry) => distance(entry.color, dominant) > 72)?.color || hexToRgb(fallback.secondaryColor);
    const accent = colors
      .filter((entry) => distance(entry.color, dominant) > 60)
      .sort((a, b) => saturation(b.color) - saturation(a.color) || b.count - a.count)[0]?.color || hexToRgb(fallback.accentColor);
    return {
      dominantColor: mix(rgbToHex(dominant), fallback.dominantColor, 0.42),
      secondaryColor: mix(rgbToHex(secondary), fallback.secondaryColor, 0.28),
      accentColor: mix(rgbToHex(accent), fallback.accentColor, 0.22),
      textColor: fallback.textColor
    };
  });
}

module.exports = { extractPalette, blendProgramPalettes, hexToRgb, mix, paletteCache, rgbToHex, safeHex, PALETTES, applyPalette };
