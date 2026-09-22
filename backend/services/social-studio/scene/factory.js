const { compactDate, compactWebsite, visualLength } = require("../engine/typography");
const { mix } = require("../engine/palette");
const { normalizeScene } = require("./schema");
const legacy = require("../../socialStudioService");

// Every composition reserves separate rectangles for artwork, copy and branding.
const LAYOUTS = {
  cinematic: { art: [0, 0, 1, .53], copy: [.07, .56, .86, .29], align: "center" },
  impact: { art: [.43, .045, .52, .68], copy: [.06, .08, .32, .63], align: "left", detail: [.06, .755, .88, .1] },
  clean: { art: [.055, .055, .46, .74], copy: [.57, .09, .375, .68], align: "left" },
  minimal: { art: [.15, .04, .7, .57], copy: [.1, .645, .8, .20], align: "center" }
};

function box(rect, width, height) {
  return { x: Math.round(rect[0] * width), y: Math.round(rect[1] * height), width: Math.round(rect[2] * width), height: Math.round(rect[3] * height) };
}

function base(id, type, bounds, props = {}) {
  return { id, name: id, role: id, type, ...bounds, opacity: 1, visible: true, ...props };
}

function wrapText(value, width, height, preferred, maxLines = 3) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  for (let size = Math.floor(preferred); size >= 12; size--) {
    const lines = [];
    let line = "";
    let fits = true;
    for (const word of words) {
      if (visualLength(word) * size > width) { fits = false; break; }
      const next = line ? `${line} ${word}` : word;
      if (line && visualLength(next) * size > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (fits && lines.length <= maxLines && lines.length * size * 1.12 <= height) return { text: lines.join("\n"), fontSize: size };
  }
  const chunks = [];
  let line = "";
  for (const character of words.join(" ")) {
    if (visualLength(line + character) * 12 > width && line) { chunks.push(line.trim()); line = ""; }
    line += character;
  }
  if (line) chunks.push(line.trim());
  return { text: chunks.join("\n"), fontSize: 12 };
}

function text(id, name, value, bounds, options = {}) {
  const font = wrapText(value, bounds.width, bounds.height, options.fontSize || 44, options.lines || 3);
  return base(id, "text", bounds, {
    name, ...font, fontFamily: options.display ? "Social Display" : "Social Text",
    fontWeight: options.display ? 900 : 600, fill: options.fill || "#ffffff",
    align: options.align || "left", lineHeight: 1.12, letterSpacing: 0,
    ...options, fontSize: font.fontSize
  });
}

function movieCopy(draft) {
  if (draft.templateId === "movie-presale") return { label: draft.subtitle || "PRÉ-VENDA", detail: compactDate(draft.date) || "EM BREVE" };
  if (draft.templateId === "movie-price") return { label: draft.subtitle || "INGRESSOS", detail: legacy.hasCommercialPrice(draft.price) ? draft.price : "CONFIRA AS SESSÕES" };
  if (draft.templateId === "movie-highlight") return { label: draft.subtitle || "EM CARTAZ", detail: draft.date || "CONFIRA AS SESSÕES" };
  return { label: draft.subtitle || "ESTREIA", detail: compactDate(draft.date) || "EM BREVE" };
}

function buildEditableScene({ draft, format, palette, brand, sourceUrl = "", logoUrl = "" }) {
  const w = format.width;
  const h = format.height * (format.id === "story" ? .86 : 1);
  const topInset = format.id === "story" ? format.height * .04 : 0;
  const style = LAYOUTS[draft.style] ? draft.style : "cinematic";
  const layout = LAYOUTS[style];
  const light = style === "clean";
  const background = light ? mix(palette.accentColor, "#ffffff", .94) : mix(palette.dominantColor, "#000000", .83);
  const foreground = light ? "#151a22" : "#ffffff";
  const accent = light ? mix(palette.accentColor, "#000000", .62) : mix(palette.accentColor, "#ffffff", .35);
  const muted = light ? "#465260" : "#c8d1dc";
  const elements = [];
  const art = box(layout.art, w, h);
  const copyBox = box(sourceUrl ? layout.copy : [.1, .12, .8, .6], w, h);
  const align = draft.alignment === "center" ? "center" : layout.align;
  const presets = { center: [50, 50], left: [0, 50], right: [100, 50], top: [50, 0], bottom: [50, 100] };
  const focus = presets[draft.imagePreset] || [draft.imagePositionX ?? 50, draft.imagePositionY ?? 50];

  if (style === "impact") {
    elements.push(base("accent-rail", "shape", { x: 0, y: 0, width: 12, height: h }, { name: "Faixa de cor", fill: accent, locked: true }));
  }
  if (sourceUrl) elements.push(base("artwork", "image", art, {
    name: "Arte original", role: "background", src: sourceUrl, fit: "contain",
    focusX: focus[0], focusY: focus[1], locked: true, required: true, keepRatio: true
  }));

  const isMovie = draft.templateId.startsWith("movie-");
  const copy = isMovie ? movieCopy(draft) : {
    label: draft.subtitle || (draft.templateId === "club-plan" ? "SEU CLUBE DE CINEMA" : draft.templateId === "concession-combo" ? "BOMBONIERE" : "BILHETERIA DIGITAL"),
    detail: draft.price || (draft.templateId === "online-ticket" ? "ESCOLHA SUA SESSÃO" : "CONHEÇA AS OPÇÕES")
  };
  const priceDetail = ["movie-price", "concession-combo", "club-plan"].includes(draft.templateId);
  const rows = [
    { id: "subtitle", name: "Chamada", value: copy.label, weight: .65, size: 32, color: accent, lines: 2 },
    { id: "title", name: "Título", value: draft.title, weight: 1.8, size: 88 * (draft.titleScale || 100) / 100, color: foreground, display: true, lines: 4, required: true },
    ...(!layout.detail ? [{ id: "detail", name: "Data ou preço", value: copy.detail, weight: 1.2, size: 84, color: accent, display: true, lines: 3 }] : []),
    ...(draft.auxiliaryText ? [{ id: "description", name: "Informações", value: draft.auxiliaryText, weight: 1.3, size: 32, color: muted, lines: 6 }] : []),
    { id: "cta", name: "Chamada final", value: draft.cta || "CONFIRA AS SESSÕES", weight: .7, size: 32, color: foreground, lines: 2 }
  ];
  const gap = Math.round(Math.min(14, copyBox.height * .027));
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const available = copyBox.height - gap * (rows.length - 1);
  let y = copyBox.y;
  rows.forEach((row) => {
    const height = Math.floor(available * row.weight / totalWeight);
    elements.push(text(row.id, row.name, row.value, { x: copyBox.x, y, width: copyBox.width, height }, {
      fontSize: row.size, fill: row.color, display: row.display, align, lines: row.lines,
      required: row.required || row.id === "detail", role: row.id === "detail" ? (priceDetail ? "price" : "date") : row.id
    }));
    y += height + gap;
  });
  if (layout.detail) {
    const band = box(layout.detail, w, h);
    elements.push(base("detail-band", "shape", band, { name: "Faixa de destaque", fill: accent, locked: true }));
    elements.push(text("detail", "Data ou preço", copy.detail, { x: band.x + 22, y: band.y + 8, width: band.width - 44, height: band.height - 16 }, {
      fontSize: 96, fill: "#10141b", display: true, align: "center", lines: 2, role: priceDetail ? "price" : "date", required: true
    }));
  }

  const footer = box([.07, .885, .86, .085], w, h);
  elements.push(base("divider", "shape", { x: footer.x, y: footer.y - 18, width: footer.width, height: 2 }, { name: "Divisor", fill: accent, locked: true }));
  const logoWidth = Math.round(Math.min(footer.width * .35, 250 * (draft.signatureScale || 100) / 100));
  if (logoUrl) elements.push(base("logo", "image", {
    x: footer.x + footer.width - logoWidth, y: footer.y, width: logoWidth, height: footer.height
  }, { name: "Assinatura do cinema", role: "logo", src: logoUrl, fit: "contain", focusX: 100, focusY: 50, protected: true, required: true, keepRatio: true }));
  const footerTextWidth = footer.width * (logoUrl ? .6 : 1);
  elements.push(text("cinema", "Cinema", brand.name, { x: footer.x, y: footer.y, width: footerTextWidth, height: footer.height * .45 }, { fontSize: 30, fill: foreground, required: true, protected: true, lines: 1 }));
  const website = compactWebsite(brand.posterWebsite || brand.website);
  if (website) elements.push(text("website", "Site", website, { x: footer.x, y: footer.y + footer.height * .5, width: footerTextWidth, height: footer.height * .45 }, { fontSize: 25, fill: muted, required: true, protected: true, lines: 1 }));

  const { entities, ...sourceDraft } = draft;
  return normalizeScene({ id: `scene-${draft.templateId}-${format.id}`, templateId: draft.templateId, formatId: format.id,
    width: w, height: format.height, backgroundColor: background, elements: elements.map((element) => ({ ...element, y: element.y + topInset })), sourceDraft, createdAt: new Date().toISOString() });
}

module.exports = { buildEditableScene, LAYOUTS, wrapText };
