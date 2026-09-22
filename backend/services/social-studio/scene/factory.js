const { fitFontSize, compactDate, compactWebsite } = require("../engine/typography");
const { mix } = require("../engine/palette");
const legacy = require("../../socialStudioService");
const { normalizeScene } = require("./schema");

function text(id, name, value, x, y, width, height, options = {}) {
  const content = options.uppercase ? String(value || "").toUpperCase() : String(value || "");
  const preferred = Number(options.fontSize || 42);
  const fontSize = fitFontSize(content, {
    width,
    preferred,
    min: Number(options.minFontSize || Math.max(12, preferred * 0.58)),
    max: preferred,
    lines: Number(options.lines || 1),
    letterSpacing: Number(options.letterSpacing || 0)
  });
  return {
    id, name, role: options.role || id, type: "text", x, y, width, height,
    text: content, fontFamily: options.fontFamily || "Social Text", fontSize,
    fontWeight: options.fontWeight || 600, fill: options.fill || "#ffffff",
    align: options.align || "center", letterSpacing: options.letterSpacing || 0,
    lineHeight: options.lineHeight || 1, opacity: options.opacity ?? 1,
    shadowColor: options.shadowColor || "rgba(0,0,0,0)", shadowBlur: options.shadowBlur || 0,
    locked: options.locked === true, protected: options.protected === true,
    required: options.required === true, visible: options.visible !== false
  };
}

function image(id, name, src, x, y, width, height, options = {}) {
  return {
    id, name, role: options.role || id, type: "image", src, x, y, width, height,
    fit: options.fit || "cover", focusX: options.focusX ?? 50, focusY: options.focusY ?? 50,
    opacity: options.opacity ?? 1, locked: options.locked === true,
    protected: options.protected === true, required: options.required === true,
    keepRatio: options.keepRatio !== false, visible: options.visible !== false
  };
}

function shape(id, name, x, y, width, height, fill, options = {}) {
  return {
    id, name, role: options.role || id, type: "shape", x, y, width, height,
    fill, stroke: options.stroke || "rgba(0,0,0,0)", strokeWidth: options.strokeWidth || 0,
    radius: options.radius || 0, opacity: options.opacity ?? 1, locked: options.locked === true,
    protected: options.protected === true, required: options.required === true,
    visible: options.visible !== false
  };
}

function gradient(id, name, x, y, width, height, direction, stops, options = {}) {
  return {
    id, name, role: options.role || id, type: "gradient", x, y, width, height,
    direction, stops, opacity: options.opacity ?? 1, locked: options.locked !== false,
    protected: options.protected === true, visible: options.visible !== false
  };
}

function ctaGroup(value, x, y, width, accent, options = {}) {
  const height = options.height || 62;
  const lineWidth = Math.max(34, Math.round(width * 0.09));
  const textWidth = width - lineWidth * 2 - 36;
  return {
    id: "cta", name: "Chamada", role: "cta", type: "group", x, y, width, height,
    opacity: 1, visible: true, locked: false, protected: false, required: false,
    children: [
      shape("cta-line-left", "Linha esquerda", 0, height / 2, lineWidth, 2, accent, { locked: true }),
      text("cta-text", "Texto da chamada", value, lineWidth + 18, 0, textWidth, height, {
        fontSize: options.fontSize || 28, minFontSize: 18, fontWeight: 600,
        fill: options.fill || "#ffffff", align: "center", letterSpacing: 5,
        role: "cta-text", required: true
      }),
      shape("cta-line-right", "Linha direita", width - lineWidth, height / 2, lineWidth, 2, accent, { locked: true })
    ]
  };
}

function commonArtwork(draft, format, sourceUrl) {
  if (!sourceUrl) return [];
  const presets = { center: [50, 50], left: [20, 50], right: [80, 50], top: [50, 18], bottom: [50, 82] };
  const focus = presets[draft.imagePreset] || [draft.imagePositionX ?? 50, draft.imagePositionY ?? 50];
  return [image("artwork", "Imagem principal", sourceUrl, 0, 0, format.width, format.height, {
    role: "background", focusX: focus[0], focusY: focus[1], locked: true, required: true
  })];
}

function movieCopy(draft) {
  if (draft.templateId === "movie-presale") return { label: "PRÉ-VENDA", detail: compactDate(draft.date) || "EM BREVE", cta: draft.cta || "GARANTA NA PRÉ-VENDA" };
  if (draft.templateId === "movie-price") return { label: draft.subtitle || "INGRESSOS", detail: draft.price, cta: draft.cta || "COMPRE AGORA" };
  if (draft.templateId === "movie-highlight") return { label: draft.subtitle || "EM CARTAZ", detail: draft.date || "CONFIRA AS SESSÕES", cta: draft.cta || "GARANTA SEU LUGAR" };
  return { label: draft.subtitle || "ESTREIA", detail: compactDate(draft.date) || "EM CARTAZ", cta: draft.cta || "CONFIRA AS SESSÕES" };
}

function movieScene(draft, format, palette, brand, sourceUrl, logoUrl) {
  const story = format.id === "story";
  const square = format.id === "square";
  const margin = story ? 92 : square ? 70 : 76;
  const contentWidth = format.width - margin * 2;
  const layout = story
    ? { top: 930, detailSize: 144, logoW: 390, logoH: 228, logoBottom: 62, websiteBottom: 316 }
    : square
      ? { top: 438, detailSize: 98, logoW: 280, logoH: 164, logoBottom: 12, websiteBottom: 176 }
      : { top: 610, detailSize: 126, logoW: 320, logoH: 188, logoBottom: 20, websiteBottom: 218 };
  const copy = movieCopy(draft);
  const accent = mix(brand.secondaryColor, "#6fb9ff", 0.6);
  const titleColor = mix(palette.accentColor, "#ffffff", 0.2);
  const hasPrice = draft.templateId === "movie-price" && legacy.hasCommercialPrice(copy.detail);
  const elements = commonArtwork(draft, format, sourceUrl);
  elements.push(gradient("content-gradient", "Proteção de leitura", 0, 0, format.width, format.height, "bottom", [
    { offset: story ? 0.31 : 0.25, color: "rgba(2,5,10,0)" },
    { offset: story ? 0.57 : 0.51, color: "rgba(2,5,10,0.76)" },
    { offset: story ? 0.74 : 0.68, color: "rgba(2,5,10,0.98)" },
    { offset: 1, color: "#02050a" }
  ]));
  let y = layout.top;
  elements.push(text("title", "Título", draft.title, margin, y, contentWidth, story ? 70 : 58, {
    fontSize: story ? 56 : 46, minFontSize: 28, fontWeight: 900, fill: titleColor,
    letterSpacing: 6, role: "title", required: true
  }));
  y += story ? 92 : 78;
  elements.push(text("subtitle", "Chamada", hasPrice ? copy.label : (draft.templateId === "movie-price" ? "SESSÕES DISPONÍVEIS" : copy.label), margin, y, contentWidth, story ? 62 : 52, {
    fontSize: story ? 45 : 37, minFontSize: 24, fontWeight: 600, fill: accent,
    letterSpacing: story ? 10 : 8, role: "subtitle", shadowColor: accent, shadowBlur: 10
  }));
  y += story ? 84 : 68;
  const detailText = hasPrice ? copy.detail : (draft.templateId === "movie-price" ? "ESCOLHA SEU HORÁRIO" : copy.detail);
  elements.push(text("detail", hasPrice ? "Preço" : "Data ou destaque", detailText, margin, y, contentWidth, story ? 170 : 138, {
    fontFamily: "Social Display", fontSize: hasPrice ? (story ? 154 : 124) : layout.detailSize,
    minFontSize: story ? 62 : 44, fontWeight: 900, fill: accent, role: hasPrice ? "price" : "date",
    shadowColor: accent, shadowBlur: 18, required: true
  }));
  y += story ? 190 : 152;
  elements.push(shape("divider", "Divisor", margin + contentWidth * 0.08, y, contentWidth * 0.84, 3, accent, { locked: true }));
  y += story ? 38 : 32;
  elements.push(text("cinema", "Cinema", "NO " + brand.name, margin, y, contentWidth, 58, {
    fontSize: story ? 45 : 36, minFontSize: 25, fontWeight: 900, fill: accent,
    letterSpacing: 8, role: "cinema", protected: true, required: true, shadowColor: accent, shadowBlur: 8
  }));
  y += story ? 70 : 58;
  if (draft.auxiliaryText) {
    elements.push(text("sessions", "Sessões", draft.auxiliaryText, margin, y, contentWidth, 42, {
      fontSize: story ? 28 : 23, minFontSize: 18, fontWeight: 600, fill: "#dbe7f7",
      letterSpacing: 3, role: "sessions"
    }));
    y += story ? 60 : 50;
  }
  elements.push(ctaGroup(copy.cta, margin + contentWidth * 0.1, y, contentWidth * 0.8, accent, {
    fontSize: story ? 29 : square ? 22 : 25
  }));
  const website = compactWebsite(brand.posterWebsite || brand.website);
  if (website) {
    elements.push(text("website", "Site", website, margin, format.height - layout.websiteBottom, contentWidth, 40, {
      fontSize: story ? 31 : 25, minFontSize: 18, fontWeight: 600, fill: "#ffffff",
      letterSpacing: 0.6, role: "website", protected: true, required: true
    }));
  }
  if (logoUrl) {
    elements.push(image("logo", "Logo do cinema", logoUrl, (format.width - layout.logoW) / 2, format.height - layout.logoBottom - layout.logoH, layout.logoW, layout.logoH, {
      role: "logo", fit: "contain", protected: true, required: true, keepRatio: true
    }));
  }
  return elements;
}

function commercialScene(draft, format, palette, brand, sourceUrl, logoUrl) {
  const story = format.id === "story";
  const square = format.id === "square";
  const margin = story ? 86 : square ? 64 : 68;
  const width = format.width - margin * 2;
  const top = story ? 360 : square ? 190 : 230;
  const accent = draft.templateId === "concession-combo"
    ? mix(palette.accentColor, brand.accentColor, 0.45)
    : brand.accentColor;
  const elements = commonArtwork(draft, format, sourceUrl);
  if (draft.templateId === "concession-combo") {
    elements.push(gradient("content-gradient", "Proteção de leitura", 0, 0, format.width, format.height, "bottom", [
      { offset: 0.23, color: "rgba(2,5,10,0)" },
      { offset: 0.52, color: "rgba(2,5,10,0.8)" },
      { offset: 1, color: "#02050a" }
    ]));
  } else {
    elements.unshift(gradient("brand-gradient", "Fundo institucional", 0, 0, format.width, format.height, "right", [
      { offset: 0, color: brand.primaryColor },
      { offset: 0.58, color: mix(palette.secondaryColor, brand.secondaryColor, 0.55) },
      { offset: 1, color: brand.primaryColor }
    ]));
  }
  let y = top;
  const defaultSubtitle = draft.templateId === "club-plan" ? "CINEMA TODO MÊS"
    : draft.templateId === "online-ticket" ? "BILHETERIA DIGITAL" : "SABOR PARA A SUA SESSÃO";
  elements.push(text("subtitle", "Chamada", draft.subtitle || defaultSubtitle, margin, y, width, 54, {
    fontSize: story ? 38 : 30, minFontSize: 22, fontWeight: 600, fill: accent,
    align: "left", letterSpacing: 6, role: "subtitle"
  }));
  y += story ? 86 : 70;
  elements.push(text("title", "Título", draft.title, margin, y, width, story ? 190 : 145, {
    fontFamily: "Social Display", fontSize: story ? 112 : 88, minFontSize: 44,
    lines: 2, fontWeight: 900, fill: "#ffffff", align: "left", lineHeight: 0.9,
    role: "title", required: true
  }));
  y += story ? 210 : 165;
  if (draft.templateId === "club-plan") {
    elements.push(text("price", "Preço", draft.price || "CONHEÇA OS PLANOS", margin, y, width, story ? 140 : 110, {
      fontFamily: "Social Display", fontSize: story ? 118 : 92, minFontSize: 46,
      fontWeight: 900, fill: accent, align: "left", role: "price"
    }));
    y += story ? 170 : 135;
  }
  if (draft.auxiliaryText) {
    const lines = draft.templateId === "club-plan"
      ? String(draft.auxiliaryText).split(/\s*[•|]\s*/).filter(Boolean).slice(0, 4).map((item) => "•  " + item).join("\n")
      : draft.auxiliaryText;
    elements.push(text("description", draft.templateId === "club-plan" ? "Benefícios" : "Descrição", lines, margin, y, width, story ? 220 : 170, {
      fontSize: story ? 34 : 28, minFontSize: 20, lines: 4, fontWeight: 600,
      fill: "#e4edf8", align: "left", lineHeight: 1.18, role: "description"
    }));
    y += story ? 245 : 190;
  }
  if (draft.templateId === "concession-combo") {
    elements.push(text("price", "Preço", draft.price || "CONFIRA NA BOMBONIERE", margin, y, width, story ? 140 : 110, {
      fontFamily: "Social Display", fontSize: story ? 118 : 92, minFontSize: 46,
      fontWeight: 900, fill: accent, align: "left", role: "price"
    }));
    y += story ? 165 : 130;
  }
  elements.push(ctaGroup(draft.cta || "SAIBA MAIS", margin, y, width * 0.72, accent, { fontSize: story ? 28 : 24 }));
  const website = compactWebsite(brand.posterWebsite || brand.website);
  if (website) {
    elements.push(text("website", "Site", website, margin, format.height - (story ? 250 : 180), width * 0.58, 40, {
      fontSize: story ? 28 : 23, minFontSize: 18, align: "left", role: "website",
      protected: true, required: true
    }));
  }
  if (logoUrl) {
    const logoW = story ? 340 : square ? 260 : 290;
    const logoH = story ? 198 : square ? 152 : 170;
    elements.push(image("logo", "Logo do cinema", logoUrl, format.width - margin - logoW, format.height - (story ? 68 : 24) - logoH, logoW, logoH, {
      role: "logo", fit: "contain", protected: true, required: true
    }));
  }
  return elements;
}

function buildEditableScene({ draft, format, palette, brand, sourceUrl = "", logoUrl = "" }) {
  const movieTemplates = ["movie-premiere", "movie-highlight", "movie-price", "movie-presale"];
  const elements = movieTemplates.includes(draft.templateId)
    ? movieScene(draft, format, palette, brand, sourceUrl, logoUrl)
    : commercialScene(draft, format, palette, brand, sourceUrl, logoUrl);
  const { entities, ...sourceDraft } = draft;
  return normalizeScene({
    id: "scene-" + draft.templateId + "-" + format.id,
    templateId: draft.templateId,
    formatId: format.id,
    width: format.width,
    height: format.height,
    backgroundColor: brand.primaryColor,
    elements,
    sourceDraft,
    createdAt: new Date().toISOString()
  });
}

module.exports = { buildEditableScene };
